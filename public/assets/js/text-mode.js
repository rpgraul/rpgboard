import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { preParseShortcodesForEditor, convertEditorHtmlToShortcodes, handleToolbarAction } from './modules/editorUtils.js';
import CardLink from "./tiptap-extensions/cardLink.js";
import StatNode from "./tiptap-extensions/StatNode.js";
import HpNode from "./tiptap-extensions/HpNode.js";
import MoneyNode from "./tiptap-extensions/MoneyNode.js";
import XpNode from "./tiptap-extensions/XpNode.js";
import CountNode from "./tiptap-extensions/CountNode.js";
import ContainerShortcode from "./tiptap-extensions/containerShortcode.js";
import FichaShortcode from "./tiptap-extensions/fichaShortcode.js";
import { normalizeString } from './modules/utils.js';
import { getSuggestionItems } from './modules/suggestionItems.js';
import { setupShortcodeMenu, openConfigModal } from './modules/shortcodeInserter.js';

import * as firebaseService from "./modules/firebaseService.js";
import { initializeApp } from "./modules/appInitializer.js";
import * as shortcodeParser from "./modules/shortcodeParser.js";
import { isNarrator, initializeAuth } from "./modules/auth.js";
import { showConfirmationPopover, showToast } from "./modules/ui.js";
import { initializeLayout } from "./modules/layout.js";
import * as chat from "./modules/chat.js";
import { initializeDice } from "./modules/diceLogic.js";
import { showDetailModal } from './modules/modal.js';
import { openModal, closeModal, initializeModals } from "./modules/modal.js";
import * as audio from "./modules/audio.js";

let allCards = [];
let selectedIds = [];
let currentEditorCardId = null;
let sideViewEditor = null;
let currentSideViewCardId = null;
let editingNodePos = null;
let mainEditorSaveTimeout = null;
let sideViewSaveTimeout = null;
let isProcessingUpdate = false;
let unsubscribeCards = null;
let mainEditor = null;

export function destroy() {
  if (unsubscribeCards) { unsubscribeCards(); unsubscribeCards = null; }
  if (mainEditor) { try { mainEditor.destroy(); } catch(e) {} mainEditor = null; }
  allCards = [];
  selectedIds = [];
  currentEditorCardId = null;
}

export async function init() {
  const layout = await initializeLayout();
  initializeAuth();
  initializeModals();
  chat.initializeChat();
  initializeDice(layout);

  try {
    await initializeApp({ pageTitle: 'Notes' });
  } catch (error) {
    console.error('Falha ao carregar configurações do site:', error);
  }

  const searchInput = document.getElementById("search-input");
  const cardList = document.getElementById("card-list");
  const editorContainer = document.getElementById("text-editor-container");
  const emptyState = document.getElementById("empty-state");
  const cardTitle = document.getElementById("card-title");
  const cardTags = document.getElementById("card-tags");
  const cardVisibility = document.getElementById("card-visibility-editor");
  const deleteBtn = document.getElementById("delete-card-btn");
  const bulkActions = document.getElementById("bulk-actions-container");

  const mainEditorEl = document.querySelector("#editor");
  if (!mainEditorEl) return;

  mainEditor = new Editor({
    element: document.querySelector("#editor"),
    extensions: [
      StarterKit,
      Highlight,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CardLink.configure({
        suggestion: {
          items: ({ query }) => getSuggestionItems(allCards, query),
        },
      }),
      StatNode,
      HpNode,
      MoneyNode,
      XpNode,
      CountNode,
      ContainerShortcode,
      FichaShortcode,
    ],
    editorProps: {
      attributes: { class: "ProseMirror" },
      handleKeyDown: (view, event) => {
        if (event.key === "]" || (event.key === "/" && event.shiftKey)) {
          setTimeout(() => {
            const html = mainEditor.getHTML();
            if (html.includes("[stat") || html.includes("[hp") || html.includes("[money") || html.includes("[xp") || html.includes("[count") || html.includes("[container") || html.includes("[#") || html.includes("[ficha")) {
              forceEditorReparse(mainEditor, html);
            }
          }, 10);
        }
        return false;
      }
    },
    onUpdate: () => {
      clearTimeout(mainEditorSaveTimeout);
      mainEditorSaveTimeout = setTimeout(saveCurrentCard, 3000);
    },
    onBlur: () => {
      clearTimeout(mainEditorSaveTimeout);
      saveCurrentCard();
    }
  });

  function saveCurrentCard() {
    if (!currentEditorCardId) return;
    const cardData = allCards.find(c => c.id === currentEditorCardId);
    if (!cardData) return;
    const updated = {
      titulo: cardTitle.textContent.trim(),
      tags: cardTags.textContent.split(",").map(t => t.trim()).filter(Boolean),
      conteudo: convertEditorHtmlToShortcodes(mainEditor.getHTML()),
    };
    if (isNarrator()) updated.isVisibleToPlayers = cardVisibility.checked;
    firebaseService.updateItem({ id: currentEditorCardId }, updated).catch(err => console.error("Erro ao salvar:", err));
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
    if (isNarrator()) cardVisibility.checked = card.isVisibleToPlayers !== false;

    const parsedContent = preParseShortcodesForEditor(card.conteudo || "");
    if (!mainEditor.isFocused) {
      mainEditor.commands.setContent(parsedContent, false);
    }

    renderCardList();
    history.pushState({ cardId: id }, "", `#${id}`);
  }

  unsubscribeCards = firebaseService.listenToItems((snapshot) => {
    allCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""));
    renderCardList();
    const hashId = window.location.hash.substring(1);
    if (hashId && !currentEditorCardId) loadCardIntoEditor(hashId);
  });

  searchInput.addEventListener("input", renderCardList);
  [cardTitle, cardTags, cardVisibility].filter(Boolean).forEach(el => {
    el.addEventListener("input", () => {
      clearTimeout(mainEditorSaveTimeout);
      mainEditorSaveTimeout = setTimeout(saveCurrentCard, 800);
    });
  });

  document.getElementById("add-card-btn").onclick = async () => {
    const id = await firebaseService.addItem({ titulo: "Novo Card", conteudo: "", tags: [], isVisibleToPlayers: true });
    loadCardIntoEditor(id);
  };

  deleteBtn.onclick = () => {
    const card = allCards.find(c => c.id === currentEditorCardId);
    if (card) {
      showConfirmationPopover({
        targetElement: deleteBtn,
        message: `Deletar "${card.titulo}"?`,
        onConfirm: () => {
          firebaseService.deleteItem(card).then(() => {
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
    handleToolbarAction(mainEditor, btn.dataset.action, btn.dataset.level || btn.dataset.align);
  };

  const scContainer = document.getElementById('text-mode-shortcode-container');
  if (scContainer) {
    setupShortcodeMenu(scContainer, mainEditor);
  }

  document.addEventListener("edit-shortcode", (e) => {
    const { type, attrs, pos, editor } = e.detail;
    const targetEditor = editor || mainEditor;
    const typeMap = {
      'containerShortcode': 'container',
      'statNode': 'stat',
      'hpNode': 'hp',
      'moneyNode': 'money',
      'xpNode': 'xp',
      'countNode': 'count'
    };
    const mappedType = typeMap[type] || type;
    openConfigModal(mappedType, targetEditor, { pos, attrs, nodeType: type });
  });

  document.addEventListener('click', (e) => {
    const target = e.target.closest('.card-link');
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    const cardName = target.getAttribute('data-card-name');
    if (!cardName) return;
    const found = allCards.find(it => normalizeString(it.titulo) === normalizeString(cardName));
    if (found) showDetailModal(found);
  });
}
