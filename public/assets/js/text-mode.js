import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import CardLink from "./tiptap-extensions/cardLink.js";
import StatNode from "./tiptap-extensions/StatNode.js";
import HpNode from "./tiptap-extensions/HpNode.js";
import MoneyNode from "./tiptap-extensions/MoneyNode.js";
import CountNode from "./tiptap-extensions/CountNode.js";
// REMOVIDO: import NotaShortcode from "./tiptap-extensions/notaShortcode.js";
import ContainerShortcode from "./tiptap-extensions/containerShortcode.js"; // NOVO

import { listenToItems, updateItem, addItem, removeImageFromItem, deleteItem, deleteItems, updateItemsVisibility, addTagsToItems, getSettings, } from "./modules/firebaseService.js";
import { isNarrator, initializeAuth } from "./modules/auth.js";
import { showConfirmationPopover, showToast } from "./modules/ui.js";
import { initializeLayout } from "./modules/layout.js";
import * as chat from "./modules/chat.js";
import { openModal, closeModal, initializeModals } from "./modules/modal.js";

let allCards = [];
let selectedIds = [];
let currentEditorCardId = null;
let sideViewEditor = null;
let currentSideViewCardId = null;
let editingNodePos = null;
let mainEditorSaveTimeout = null;
let sideViewSaveTimeout = null;
let isProcessingUpdate = false;

// 1. ATUALIZAÇÃO DO PARSER DE ENTRADA (Texto -> Editor)
function preParseShortcodesForEditor(content) {
  if (!content) return "";
  let t = content;

  // Regex corrigida para o Container
  const containerRegex = /\[container\s+([^\]]*)\]([\s\S]*?)\[\/container\]/gi;
  t = t.replace(containerRegex, (match, argsStr, innerContent) => {
    const unescapedArgsStr = argsStr.replace(/&quot;/g, '"').replace(/&apos;/g, "'");

    const args = {};
    const argRegex = /(\w+)=["']?([^"']*)["']?/g;
    let m;
    while ((m = argRegex.exec(unescapedArgsStr)) !== null) {
      args[m[1].toLowerCase()] = m[2];
    }

    const label = args.label || "Container";
    const type = args.type || "default";

    // Verifica tokens de visibilidade (#) e estado (close)
    const isHidden = unescapedArgsStr.includes('#') || args.ishidden === "true";
    const isClosed = /\bclose\b/i.test(unescapedArgsStr);

    return `<div data-node-type="containerShortcode" data-label="${label}" data-type="${type}" data-is-hidden="${isHidden}" data-is-closed="${isClosed}">${innerContent}</div>`;
  });

  // Mantém os outros parsers (stat, hp, money, count)
  t = t.replace(/[\[]stat\s+"([^"]*)"\s+"([^"]*)"(?:\s+(.*?))?[\]]/gi, (e, t, i, s) => {
    const o = s || "", a = o.includes("#"), n = ["left", "right", "bottom", "top"].find((e) => o.includes(e)) || "";
    return `<span data-node-type="statNode" data-label="${t}" data-value="${i}" data-position="${n}" data-is-hidden="${a}"></span>`;
  });
  t = t.replace(/[\[]hp\s+max=(?:["']?)(\d+)(?:["']?)\s+current=(?:["']?)(\d+)(?:["']?)(?:\s+(.*?))?[\]]/gi, (e, t, i, s) => {
    const o = s || "", a = o.includes("#"), n = ["left", "right", "bottom", "top"].find((e) => o.includes(e)) || "";
    return `<span data-node-type="hpNode" data-max="${t}" data-current="${i}" data-position="${n}" data-is-hidden="${a}"></span>`;
  });
  t = t.replace(/[\[]money\s+current=(?:["']?)(-?\d+(?:\.\d+)?)(?:["']?)(?:\s+([^\]]*?))?[\]]/gi, (e, t, i = "") => {
    let s = "", o = "", a = false;
    if (i) {
      const parts = i.trim().split(/\s+/), keywords = ["left", "right", "bottom", "top"];
      o = parts.find((e) => keywords.includes(e.toLowerCase())) || "";
      a = parts.includes("#");
      s = parts.find((e) => !keywords.includes(e) && "#" !== e) || "";
    }
    return `<span data-node-type="moneyNode" data-current="${t}" data-currency="${s}" data-position="${o}" data-is-hidden="${a}"></span>`;
  });

  const argRegexSimple = /"([^"]+)"|\S+/g;
  t = t.replace(/[\[](\*?)count\s+([^\\]+)[\]]/gi, (match, overlayPrefix, rawArgs) => {
    const isOverlay = "*" === overlayPrefix;
    const args = [];
    let m;
    while ((m = argRegexSimple.exec(rawArgs)) !== null) args.push(m[1] || m[0]);
    const params = {};
    args.forEach(a => {
      if (a.includes("=")) {
        const [k, v] = a.split("=");
        params[k.toLowerCase()] = v.replace(/^["']|["']$/g, "");
      }
    });
    const label = args.find(a => !a.includes("=") && !a.includes("#") && !["left", "right", "bottom", "top"].includes(a.toLowerCase())) || "";
    const max = params.max ? parseInt(params.max, 10) : 0;
    const current = params.current ? parseInt(params.current, 10) : 0;
    let theme = params.theme || (args.includes("checkbox") ? "checkbox" : "number");
    const pos = ["left", "right", "bottom", "top"].find(a => args.includes(a.toLowerCase())) || "";
    const hidden = args.includes("#");
    return `<span data-node-type="countNode" data-label="${label.replace(/^["']|["']$/g, "")}" data-max="${max}" data-current="${current}" data-theme="${theme}" data-icon="${params.icon || ""}" data-is-overlay="${isOverlay}" data-position="${pos}" data-is-hidden="${hidden}"></span>`;
  });

  return t;
}

// 2. ATUALIZAÇÃO DO PARSER DE SAÍDA (Editor -> Texto)
function convertEditorHtmlToShortcodes(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  // Processa os containers de forma limpa
  body.querySelectorAll('[data-node-type="containerShortcode"]').forEach((e) => {
    const label = e.getAttribute("data-label") || "Container";
    const type = e.getAttribute("data-type") || "default";
    const isHidden = e.getAttribute("data-is-hidden") === "true";
    const isClosed = e.getAttribute("data-is-closed") === "true";

    // Constrói a tag usando a sintaxe de tokens (# e close)
    const openTag = `[container label="${label}" type="${type}"${isClosed ? ' close' : ''}${isHidden ? ' #' : ''}]`;
    const closeTag = `[/container]`;

    // O conteúdo real está dentro da div que o Tiptap usa como contentDOM
    const contentArea = e.querySelector('.container-content-area') || e;
    const innerHTML = contentArea.innerHTML;

    e.replaceWith(document.createTextNode(openTag), ...parser.parseFromString(innerHTML, "text/html").body.childNodes, document.createTextNode(closeTag));
  });

  // Outros conversores (money, hp, stat, count) permanecem iguais aos que você já tinha.
  body.querySelectorAll('[data-node-type="moneyNode"]').forEach((e) => {
    const args = [];
    const curr = e.getAttribute("data-currency"); if (curr) args.push(curr);
    const pos = e.getAttribute("data-position"); if (pos) args.push(pos);
    if (e.getAttribute("data-is-hidden") === "true") args.push("#");
    e.replaceWith(document.createTextNode(`[money current="${e.getAttribute("data-current") || "0"}"${args.length ? " " + args.join(" ") : ""}]`));
  });
  body.querySelectorAll('[data-node-type="hpNode"]').forEach((e) => {
    const args = [];
    const pos = e.getAttribute("data-position"); if (pos) args.push(pos);
    if (e.getAttribute("data-is-hidden") === "true") args.push("#");
    e.replaceWith(document.createTextNode(`[hp max="${e.getAttribute("data-max") || "0"}" current="${e.getAttribute("data-current") || "0"}"${args.length ? " " + args.join(" ") : ""}]`));
  });
  body.querySelectorAll('[data-node-type="statNode"]').forEach((e) => {
    const args = [];
    const pos = e.getAttribute("data-position"); if (pos) args.push(pos);
    if (e.getAttribute("data-is-hidden") === "true") args.push("#");
    e.replaceWith(document.createTextNode(`[stat "${(e.getAttribute("data-label") || "").replace(/"/g, "'")}" "${(e.getAttribute("data-value") || "").replace(/"/g, "'")}"${args.length ? " " + args.join(" ") : ""}]`));
  });
  body.querySelectorAll('[data-node-type="countNode"]').forEach((e) => {
    const c = [];
    const label = e.getAttribute("data-label"); if (label) c.push(`"${label.trim()}"`);
    c.push(`max=${e.getAttribute("data-max") || "0"}`);
    c.push(`current=${e.getAttribute("data-current") || "0"}`);
    const theme = e.getAttribute("data-theme"); if (theme && theme !== "number") c.push(theme);
    const icon = e.getAttribute("data-icon"); if (icon) c.push(`icon="${icon.trim()}"`);
    const pos = e.getAttribute("data-position"); if (pos) c.push(pos);
    if (e.getAttribute("data-is-overlay") === "true") c.unshift("*");
    if (e.getAttribute("data-is-hidden") === "true") c.push("#");
    e.replaceWith(document.createTextNode(`[${c.join(" ")}]`));
  });

  return body.innerHTML;
}


document.addEventListener("DOMContentLoaded", async () => {
  const layout = await initializeLayout({ fabActions: ['help', 'chat'] });
  initializeAuth();
  initializeModals();
  chat.initializeChat();

  try {
    const firebaseService = await import('./modules/firebaseService.js');
    const appSettings = await firebaseService.getSettings();
    window.appSettings = appSettings;
    window.IMGBB_API_KEY = appSettings.imgbbApiKey;
    if (appSettings.siteTitle) {
      document.title = `${appSettings.siteTitle} - GameBoard`;
    }
    if (typeof import('./modules/components/header.js').then === 'function') {
      import('./modules/components/header.js').then(mod => mod.renderHeader && mod.renderHeader());
    }
  } catch (error) {
    console.error('Falha ao carregar configurações do site:', error);
  }

  const searchInput = document.getElementById("search-input");
  const cardList = document.getElementById("card-list");
  const editorContainer = document.getElementById("text-editor-container");
  const emptyState = document.getElementById("empty-state");
  const cardTitle = document.getElementById("card-title");
  const cardTags = document.getElementById("card-tags");
  const cardDesc = document.getElementById("card-description");
  const cardVisibility = document.getElementById("card-visibility-editor");
  const deleteBtn = document.getElementById("delete-card-btn");
  const bulkActions = document.getElementById("bulk-actions-container");

  const mainEditor = new Editor({
    element: document.querySelector("#editor"),
    extensions: [
      StarterKit,
      Highlight,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CardLink.configure({
        suggestion: {
          items: ({ query }) => allCards.filter(c => c.titulo.toLowerCase().startsWith(query.toLowerCase())).map(c => ({ id: c.titulo, title: c.titulo })).slice(0, 5),
        },
      }),
      StatNode,
      HpNode,
      MoneyNode,
      CountNode,
      ContainerShortcode, // ADICIONADO AQUI
    ],
    editorProps: {
      attributes: { class: "ProseMirror" },
      handleKeyDown: (view, event) => {
        if (event.key === "]" || (event.key === "/" && event.shiftKey)) {
          setTimeout(() => {
            const html = mainEditor.getHTML();
            if (html.includes("[stat") || html.includes("[hp") || html.includes("[money") || html.includes("[count") || html.includes("[container") || html.includes("[#")) {
              forceEditorReparse(mainEditor, html);
            }
          }, 10);
        }
        return false;
      }
    },
    onUpdate: () => {
      clearTimeout(mainEditorSaveTimeout);
      mainEditorSaveTimeout = setTimeout(saveCurrentCard, 800);
    }
  });

  // ... (O restante do arquivo permanece igual ao original: saveCurrentCard, forceEditorReparse, listeners, etc)
  function saveCurrentCard() {
    if (!currentEditorCardId) return;
    const cardData = allCards.find(c => c.id === currentEditorCardId);
    if (!cardData) return;
    const updated = {
      titulo: cardTitle.textContent.trim(),
      tags: cardTags.textContent.split(",").map(t => t.trim()).filter(Boolean),
      descricao: cardDesc.innerText.trim().replace(/\n/g, "<br>"),
      conteudo: convertEditorHtmlToShortcodes(mainEditor.getHTML()),
    };
    if (isNarrator()) updated.isVisibleToPlayers = cardVisibility.checked;
    updateItem({ id: currentEditorCardId }, updated).catch(err => console.error("Erro ao salvar:", err));
  }

  function forceEditorReparse(editor, html) {
    if (isProcessingUpdate) return;
    isProcessingUpdate = true;
    const parsed = preParseShortcodesForEditor(html);
    editor.commands.setContent(parsed, true);
    setTimeout(() => {
      isProcessingUpdate = false;
    }, 0);
  }

  function renderCardList() {
    const term = searchInput.value.toLowerCase();
    const filtered = allCards.filter(c => {
      const matchSearch = !term || c.titulo.toLowerCase().includes(term) || (c.tags || []).some(t => t.toLowerCase().includes(term));
      const matchVisibility = isNarrator() || c.isVisibleToPlayers !== false;
      return matchSearch && matchVisibility;
    });
    cardList.innerHTML = "";
    filtered.forEach(card => {
      const li = document.createElement("li");
      const container = document.createElement("div");
      container.className = `menu-item-container ${card.id === currentEditorCardId ? "is-active" : ""}`;
      const label = document.createElement("label");
      label.className = "card-select-label";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = selectedIds.includes(card.id);
      check.onclick = (e) => { e.stopPropagation(); toggleSelection(card.id); };
      label.appendChild(check);
      const a = document.createElement("a");
      a.textContent = card.titulo;
      if (isNarrator() && card.isVisibleToPlayers === false) a.className = "is-invisible-to-players";
      a.onclick = () => loadCardIntoEditor(card.id);
      container.append(label, a);
      li.appendChild(container);
      cardList.appendChild(li);
    });
    bulkActions.classList.toggle("is-hidden", selectedIds.length === 0);
  }

  function toggleSelection(id) {
    if (selectedIds.includes(id)) selectedIds = selectedIds.filter(i => i !== id);
    else selectedIds.push(id);
    renderCardList();
  }

  function loadCardIntoEditor(id) {
    const card = allCards.find(c => c.id === id);
    if (!card) return;
    currentEditorCardId = id;
    editorContainer.style.display = "block";
    emptyState.style.display = "none";
    cardTitle.textContent = card.titulo || "";
    cardTags.textContent = (card.tags || []).join(", ");
    cardDesc.innerText = (card.descricao || "").replace(/<br\s*\/?>/gi, "\n");
    if (isNarrator()) cardVisibility.checked = card.isVisibleToPlayers !== false;

    const parsedContent = preParseShortcodesForEditor(card.conteudo || "");
    mainEditor.commands.setContent(parsedContent, false);

    renderCardList();
    history.pushState({ cardId: id }, "", `#${id}`);
  }

  listenToItems((snapshot) => {
    allCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""));
    renderCardList();
    const hashId = window.location.hash.substring(1);
    if (hashId && !currentEditorCardId) loadCardIntoEditor(hashId);
  });

  searchInput.addEventListener("input", renderCardList);
  [cardTitle, cardTags, cardDesc, cardVisibility].forEach(el => {
    el.addEventListener("input", () => {
      clearTimeout(mainEditorSaveTimeout);
      mainEditorSaveTimeout = setTimeout(saveCurrentCard, 800);
    });
  });

  document.getElementById("add-card-btn").onclick = async () => {
    const id = await addItem({ titulo: "Novo Card", conteudo: "", tags: [], isVisibleToPlayers: true });
    loadCardIntoEditor(id);
  };

  deleteBtn.onclick = () => {
    const card = allCards.find(c => c.id === currentEditorCardId);
    if (card) {
      showConfirmationPopover({
        targetElement: deleteBtn,
        message: `Deletar "${card.titulo}"?`,
        onConfirm: () => {
          deleteItem(card).then(() => {
            currentEditorCardId = null;
            editorContainer.style.display = "none";
            emptyState.style.display = "block";
          });
        }
      });
    }
  };

  document.querySelector(".tiptap-toolbar").onclick = (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const val = btn.dataset.level || btn.dataset.align;
    const chain = mainEditor.chain().focus();
    if (action === "undo") chain.undo().run();
    else if (action === "redo") chain.redo().run();
    else if (action === "toggleBold") chain.toggleBold().run();
    else if (action === "toggleItalic") chain.toggleItalic().run();
    else if (action === "toggleHeading") chain.toggleHeading({ level: parseInt(val) }).run();
    else if (action === "setTextAlign") chain.setTextAlign(val).run();
  };

  const shortcodeModal = document.getElementById("shortcode-generator-modal");
  const typeSelect = document.getElementById("shortcode-type");

  // Mostra/Oculta campos no modal
  typeSelect.addEventListener("change", (e) => {
    document.querySelectorAll(".shortcode-options").forEach(el => el.classList.add("is-hidden"));
    const target = document.getElementById(`shortcode-options-${e.target.value}`);
    if (target) target.classList.remove("is-hidden");
    document.getElementById("shortcode-common-options").classList.remove("is-hidden");
  });

  document.getElementById("shortcode-generator-btn").onclick = () => {
    editingNodePos = null; // Zera a posição (indica que é criação nova)
    document.getElementById("shortcode-generator-form").reset();
    typeSelect.dispatchEvent(new Event("change"));
    openModal(shortcodeModal);
  };

  // Escuta o duplo clique nas caixas
  document.addEventListener("edit-shortcode", (e) => {
    const { type, attrs, pos } = e.detail;
    editingNodePos = pos;
    document.getElementById("shortcode-generator-form").reset();

    // Mapeamento de tipos internos para valores do select
    const typeMap = {
      'containerShortcode': 'container',
      'statNode': 'stat',
      'hpNode': 'hp',
      'moneyNode': 'money',
      'countNode': 'count'
    };

    const mappedType = typeMap[type] || type;
    typeSelect.value = mappedType;
    typeSelect.dispatchEvent(new Event("change"));

    // Preenchimento de dados baseado no tipo
    if (mappedType === "container") {
      document.getElementById("container-label").value = attrs.label || "";
      document.getElementById("container-type").value = attrs.type || "default";
      document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
    } else if (mappedType === "stat") {
      document.getElementById("stat-label").value = attrs.label || "";
      document.getElementById("stat-value").value = attrs.value || "";
      document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
    } else if (mappedType === "hp") {
      document.getElementById("hp-max").value = attrs.max || "";
      document.getElementById("hp-current").value = attrs.current || "";
      document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
    } else if (mappedType === "money") {
      document.getElementById("money-value").value = attrs.current || "";
      document.getElementById("money-currency").value = attrs.currency || "";
      document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
    } else if (mappedType === "count") {
      document.getElementById("count-label").value = attrs.label || "";
      document.getElementById("count-max").value = attrs.max || "";
      document.getElementById("count-value").value = attrs.current || "";
      document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
    }

    openModal(shortcodeModal);
  });

  // 3. LÓGICA DO BOTÃO SALVAR NO MODAL
  document.querySelector("#shortcode-generator-modal .button.is-success").onclick = (e) => {
    e.preventDefault();
    const type = document.getElementById("shortcode-type").value;
    if (!type) return;

    let newAttrs = { isHidden: document.getElementById("shortcode-hidden").checked };
    let nodeType = '';

    if (type === "container") {
      nodeType = 'containerShortcode';
      newAttrs = {
        ...newAttrs,
        label: document.getElementById("container-label").value || "Container",
        type: document.getElementById("container-type").value || "default"
      };
    } else if (type === "stat") {
      nodeType = 'statNode';
      newAttrs = { ...newAttrs, label: document.getElementById("stat-label").value, value: document.getElementById("stat-value").value };
    } else if (type === "hp") {
      nodeType = 'hpNode';
      newAttrs = { ...newAttrs, max: document.getElementById("hp-max").value, current: document.getElementById("hp-current").value };
    } else if (type === "money") {
      nodeType = 'moneyNode';
      newAttrs = { ...newAttrs, current: document.getElementById("money-value").value, currency: document.getElementById("money-currency").value };
    } else if (type === "count") {
      nodeType = 'countNode';
      newAttrs = { ...newAttrs, label: document.getElementById("count-label").value, max: document.getElementById("count-max").value, current: document.getElementById("count-value").value };
    }

    if (editingNodePos !== null) {
      // Edição segura via Transaction preservando atributos não editáveis no modal (como isOpen)
      const currentNode = mainEditor.view.state.doc.nodeAt(editingNodePos);
      if (currentNode) {
        mainEditor.view.dispatch(mainEditor.view.state.tr.setNodeMarkup(editingNodePos, undefined, { ...currentNode.attrs, ...newAttrs }));
      }
    } else {
      // Inserção nova
      if (type === 'container') {
        mainEditor.chain().focus().insertContent({
          type: nodeType,
          attrs: newAttrs,
          content: [{ type: 'paragraph' }]
        }).run();
      } else {
        mainEditor.chain().focus().insertContent({ type: nodeType, attrs: newAttrs }).run();
      }
    }

    closeModal(document.getElementById("shortcode-generator-modal"));
  };
});
