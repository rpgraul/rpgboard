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
import NotaShortcode from "./tiptap-extensions/notaShortcode.js";

import {
  listenToItems,
  updateItem,
  addItem,
  removeImageFromItem,
  deleteItem,
  deleteItems,
  updateItemsVisibility,
  addTagsToItems,
  getSettings,
} from "./modules/firebaseService.js";
import { isNarrator, initializeAuth } from "./modules/auth.js";
import { showConfirmationPopover, showToast } from "./modules/ui.js";
import { initializeLayout } from "./modules/layout.js"; // Importação do Orquestrador
import * as chat from "./modules/chat.js"; // Importação do Chat
import { openModal, closeModal, initializeModals } from "./modules/modal.js";

// VARIÁVEIS DE ESTADO
let allCards = [];
let selectedIds = [];
let currentEditorCardId = null;
let sideViewEditor = null;
let currentSideViewCardId = null;
let editingNodePos = null;
let mainEditorSaveTimeout = null;
let sideViewSaveTimeout = null;
let isProcessingUpdate = false;

// 1. UTILITÁRIOS DE TRATAMENTO DE SHORTCODES PARA O TIPTAP
function preParseShortcodesForEditor(content) {
  if (!content) return "";
  let t = content;
  // Stat
  t = t.replace(/[\[]stat\s+"([^"]*)"\s+"([^"]*)"(?:\s+(.*?))?[\]]/gi, (e, t, i, s) => {
    const o = s || "", a = o.includes("#"), n = ["left", "right", "bottom", "top"].find((e) => o.includes(e)) || "";
    return `<span data-node-type="statNode" data-label="${t}" data-value="${i}" data-position="${n}" data-is-hidden="${a}"></span>`;
  });
  // HP
  t = t.replace(/[\[]hp\s+max=(?:["']?)(\d+)(?:["']?)\s+current=(?:["']?)(\d+)(?:["']?)(?:\s+(.*?))?[\]]/gi, (e, t, i, s) => {
    const o = s || "", a = o.includes("#"), n = ["left", "right", "bottom", "top"].find((e) => o.includes(e)) || "";
    return `<span data-node-type="hpNode" data-max="${t}" data-current="${i}" data-position="${n}" data-is-hidden="${a}"></span>`;
  });
  // Money
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
  // Count
  const argRegex = /"([^"]+)"|\S+/g;
  t = t.replace(/[\[](\*?)count\s+([^\\]+)[\]]/gi, (match, overlayPrefix, rawArgs) => {
    const isOverlay = "*" === overlayPrefix;
    const args = []; let m; while ((m = argRegex.exec(rawArgs)) !== null) args.push(m[1] || m[0]);
    const params = {}; args.forEach(a => { if (a.includes("=")) { const [k, v] = a.split("="); params[k.toLowerCase()] = v.replace(/^["']|["']$/g, ""); } });
    const label = args.find(a => !a.includes("=") && !a.includes("#") && !["left", "right", "bottom", "top"].includes(a.toLowerCase())) || "";
    const max = params.max ? parseInt(params.max, 10) : 0;
    const current = params.current ? parseInt(params.current, 10) : 0;
    let theme = params.theme || (args.includes("checkbox") ? "checkbox" : "number");
    const pos = ["left", "right", "bottom", "top"].find(a => args.includes(a.toLowerCase())) || "";
    const hidden = args.includes("#");
    return `<span data-node-type="countNode" data-label="${label.replace(/^["']|["']$/g, "")}" data-max="${max}" data-current="${current}" data-theme="${theme}" data-icon="${params.icon || ""}" data-is-overlay="${isOverlay}" data-position="${pos}" data-is-hidden="${hidden}"></span>`;
  });
  // Nota
  t = t.replace(/[\[]nota\s+titulo="([^"]+)"\s*(#)?[\]]/gi, (e, t, i) => `<div data-node-type="notaShortcode" data-titulo="${t}" data-is-hidden="${!!i}">`);
  t = t.replace(/\[\/nota\]/gi, "</div>");
  return t;
}

function convertEditorHtmlToShortcodes(html) {
  const parser = new DOMParser(), doc = parser.parseFromString(html, "text/html"), body = doc.body;
  // Money
  body.querySelectorAll('[data-node-type="moneyNode"]').forEach((e) => {
    const args = [];
    const curr = e.getAttribute("data-currency"); if (curr) args.push(curr);
    const pos = e.getAttribute("data-position"); if (pos) args.push(pos);
    if (e.getAttribute("data-is-hidden") === "true") args.push("#");
    e.replaceWith(document.createTextNode(`[money current="${e.getAttribute("data-current") || "0"}"${args.length ? " " + args.join(" ") : ""}]`));
  });
  // HP
  body.querySelectorAll('[data-node-type="hpNode"]').forEach((e) => {
    const args = [];
    const pos = e.getAttribute("data-position"); if (pos) args.push(pos);
    if (e.getAttribute("data-is-hidden") === "true") args.push("#");
    e.replaceWith(document.createTextNode(`[hp max="${e.getAttribute("data-max") || "0"}" current="${e.getAttribute("data-current") || "0"}"${args.length ? " " + args.join(" ") : ""}]`));
  });
  // Stat
  body.querySelectorAll('[data-node-type="statNode"]').forEach((e) => {
    const args = [];
    const pos = e.getAttribute("data-position"); if (pos) args.push(pos);
    if (e.getAttribute("data-is-hidden") === "true") args.push("#");
    e.replaceWith(document.createTextNode(`[stat "${(e.getAttribute("data-label") || "").replace(/"/g, "'")}" "${(e.getAttribute("data-value") || "").replace(/"/g, "'")}"${args.length ? " " + args.join(" ") : ""}]`));
  });
  // Count
  body.querySelectorAll('[data-node-type="countNode"]').forEach((e) => {
    const c = [];
    const label = e.getAttribute("data-label"); if (label) c.push(`"${label.trim()}"`);
    c.push(`max=${e.getAttribute("data-max") || "0"}`);
    c.push(`current=${e.getAttribute("data-current") || "0"}`);
    const theme = e.getAttribute("data-theme"); if (theme && theme !== "number") c.push(theme);
    const icon = e.getAttribute("data-icon"); if (icon) c.push(`icon="${icon.trim()}"`);
    const pos = e.getAttribute("data-position"); if (pos) c.push(pos);
    if (e.getAttribute("data-is-hidden") === "true") c.push("#");
    e.replaceWith(document.createTextNode(`[${e.getAttribute("data-is-overlay") === "true" ? "*" : ""}count ${c.join(" ")}]`));
  });
  // Nota
  body.querySelectorAll('[data-node-type="notaShortcode"]').forEach((e) => {
    const hidden = e.getAttribute("data-is-hidden") === "true" ? " #" : "";
    e.replaceWith(document.createTextNode(`[nota titulo="${e.getAttribute("data-titulo") || "Nota"}"${hidden}]${e.innerHTML}[/nota]`));
  });
  return body.innerHTML;
}

// 2. INICIALIZAÇÃO PRINCIPAL
document.addEventListener("DOMContentLoaded", async () => {
  
  // A. INICIALIZAR LAYOUT MODULAR
  const layout = await initializeLayout({
    fabActions: ['help', 'chat'] // No modo texto, queremos menos distrações
  });

  // B. INICIALIZAR COMPONENTES
  initializeAuth();
  initializeModals();
  chat.initializeChat();

  // C. Carregar settings e garantir título no header
  try {
    const firebaseService = await import('./modules/firebaseService.js');
    const appSettings = await firebaseService.getSettings();
    window.appSettings = appSettings;
    if (appSettings.siteTitle) {
      document.title = `${appSettings.siteTitle} - GameBoard`;
    }
    // Re-renderizar header para garantir título correto
    if (typeof import('./modules/components/header.js').then === 'function') {
      import('./modules/components/header.js').then(mod => mod.renderHeader && mod.renderHeader());
    }
  } catch (error) {
    console.error('Falha ao carregar configurações do site:', error);
  }

  // C. REFERÊNCIAS DO DOM
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

  // D. INICIALIZAR EDITOR TIPTAP PRINCIPAL
  const mainEditor = new Editor({
    element: document.querySelector("#editor"),
    extensions: [
      StarterKit, Highlight, Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CardLink.configure({
        suggestion: {
          items: ({ query }) => allCards.filter(c => c.titulo.toLowerCase().startsWith(query.toLowerCase())).map(c => ({ id: c.titulo, title: c.titulo })).slice(0, 5),
        },
      }),
      StatNode, HpNode, MoneyNode, CountNode, NotaShortcode,
    ],
    editorProps: {
      attributes: { class: "ProseMirror" },
      handleKeyDown: (view, event) => {
        if (event.key === "]" || (event.key === "/" && event.shiftKey)) {
          setTimeout(() => {
            const html = mainEditor.getHTML();
            if (html.includes("[stat") || html.includes("[hp") || html.includes("[money") || html.includes("[count") || html.includes("[nota") || html.includes("[#")) {
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

  // E. FUNÇÕES DE PERSISTÊNCIA
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

    // Apenas salva se houver mudança real
    updateItem({ id: currentEditorCardId }, updated).catch(err => console.error("Erro ao salvar:", err));
  }

  function forceEditorReparse(editor, html) {
    if (isProcessingUpdate) return;
    isProcessingUpdate = true;
    const parsed = preParseShortcodesForEditor(html);
    editor.commands.setContent(parsed, true);
    setTimeout(() => { isProcessingUpdate = false; }, 0);
  }

  // F. GESTÃO DA LISTA DE CARDS
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

    mainEditor.commands.setContent(preParseShortcodesForEditor(card.conteudo || ""), false);
    renderCardList();
    history.pushState({ cardId: id }, "", `#${id}`);
  }

  // G. LISTENERS E EVENTOS DE UI
  listenToItems((snapshot) => {
    allCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (a.titulo||"").localeCompare(b.titulo||""));
    renderCardList();
    // Auto-load se houver hash na URL
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

  // Botão Adicionar
  document.getElementById("add-card-btn").onclick = async () => {
    const id = await addItem({ titulo: "Novo Card", conteudo: "", tags: [], isVisibleToPlayers: true });
    loadCardIntoEditor(id);
  };

  // Botão Deletar
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

  // Toolbars do Editor
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

  // Gerador de Shortcodes
  const shortcodeModal = document.getElementById("shortcode-generator-modal");
  document.getElementById("shortcode-generator-btn").onclick = () => openModal(shortcodeModal);
  
  // Eventos de Fechar/Abrir Chat e Ajuda vindos do Orquestrador
  if (layout.toggleChatBtn) layout.toggleChatBtn.onclick = () => chat.toggleChat();
  if (layout.fabHelp) layout.fabHelp.onclick = () => openModal(layout.helpModal);

});