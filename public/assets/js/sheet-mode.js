import { Editor } from "@tiptap/core";
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
import ContainerShortcode from "./tiptap-extensions/containerShortcode.js";
import FichaShortcode from "./tiptap-extensions/fichaShortcode.js";
import { setupShortcodeMenu, openConfigModal } from './modules/shortcodeInserter.js';
import { normalizeString } from './modules/utils.js';
import { getSuggestionItems } from './modules/suggestionItems.js';

import { listenToItems, updateItem, addChatMessage, uploadImageToImgBB } from './modules/firebaseService.js';
import { initializeApp } from './modules/appInitializer.js';
import { initializeAuth, getCurrentUserName, isNarrator } from './modules/auth.js';
import { initializeLayout } from './modules/layout.js';
import { openModal, closeModal, initializeModals, showDetailModal } from './modules/modal.js';
import * as chat from './modules/chat.js';
import { processRoll, initializeDice } from './modules/diceLogic.js';
import { preParseShortcodesForEditor, convertEditorHtmlToShortcodes, handleToolbarAction } from './modules/editorUtils.js';
import { showToast } from './modules/ui.js';

let allItems = [];
let currentCharacterId = null;
let currentCharacter = null;
let autoSaveTimeout = null;
let contentEditor = null;
let contentEditorSaveTimeout = null;

// Referências de elementos que serão preenchidos após o layout carregar
let imgEl, nameEl, notesEditor;
let mainEditor, mainEditorSaveTimeout;
let editingNodePos = null;
let isDataLoading = false;
let isDataReady = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. INICIALIZAÇÃO DO LAYOUT MODULAR
    // Aqui definimos o título da página e quais botões queremos no FAB desta tela
    const layout = await initializeLayout();
    // Carregar configurações globais e atualizar título/header
    try {
        await initializeApp({ pageTitle: 'Sheet' });
    } catch (error) {
        console.error('Falha ao carregar configurações do site:', error);
    }

    // 2. INICIALIZAÇÃO DE MÓDULOS BÁSICOS
    initializeAuth();
    initializeModals();
    chat.initializeChat();
    initializeDice(layout);

    // 3. VINCULAÇÃO DE EVENTOS DOS COMPONENTES INJETADOS
    // Os botões FAB e elementos globais já foram criados pelo layout.js
    // Listeners for #toggle-chat-btn, #fab-help, #dice-main-btn, .dice-quick-btn are now handled in layout.js.
    // Keeping page-specific listeners.

    const fabChangeChar = document.getElementById('fab-change-char');
    if (fabChangeChar) {
        fabChangeChar.addEventListener('click', openCharSelection);
    }




    const fabMacros = document.getElementById('fab-macros');
    if (fabMacros) {
        fabMacros.addEventListener('click', () => openModal(document.getElementById('macro-modal')));
    }

    // 4. INJETAR HTML DA FICHA NA .sheet-layout
    injectSheetLayoutHTML();

    // 5. CONFIGURAÇÃO DOS ELEMENTOS DA PÁGINA (após injeção)
    imgEl = document.getElementById('char-image');
    nameEl = document.getElementById('char-name');
    notesEditor = document.getElementById('player-notes-editor');

    // 5.1 INICIALIZAR EDITOR TIPTAP (após injeção)
    await initializeMainEditor();

    // Listener global para CardLinks (@mentions)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.card-link');
        if (target) {
            e.preventDefault();
            const cardName = target.dataset.cardName;
            const found = allItems.find(it => normalizeString(it.titulo) === normalizeString(cardName));
            if (found) showDetailModal(found);
        }
    });


    // 6. CARREGAMENTO DE DADOS (FIREBASE)
    listenToItems((snapshot) => {
        allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        checkUrlAndLoad();
    });

    setupSheetSpecificListeners();

});

// Função para injetar o HTML da ficha na .sheet-layout
function injectSheetLayoutHTML() {
    const layout = document.querySelector('.sheet-layout');
    if (!layout) return;
    layout.innerHTML = `
            <aside class="sheet-sidebar box is-full-height">
                <div id="char-image-container" class="char-image-container">
                    <img id="char-image" src="" alt="Personagem">
                    <label class="image-change-btn" data-tooltip="Trocar Imagem do Personagem">
                        <i class="fas fa-camera"></i>
                        <input type="file" id="char-image-upload" class="is-hidden" accept="image/*">
                    </label>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; margin-bottom: 1rem;">
                    <span id="char-category-label" class="tag is-info is-light is-uppercase" style="align-self: flex-start; font-weight: bold; font-size: 10px;">PERSONAGEM</span>
                    <h2 id="char-name" class="title is-4" style="margin: 0;"></h2>
                </div>
                <div class="sheet-macros-section">
                    <div class="is-flex is-justify-content-space-between is-align-items-center mb-2">
                        <span class="is-size-7 has-text-weight-bold has-text-grey">MACROS</span>
                    </div>
                    <div id="macro-bar" class="sheet-macro-list"></div>
                </div>
            </aside>
            <main class="sheet-main box is-full-height" style="display: flex; flex-direction: row; padding: 0; gap: 1rem;">
                <div id="editor-column" style="flex: 2; display: flex; flex-direction: column; min-height: 0; padding: 1rem;">
                    <div id="tiptap-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                        <!-- Tiptap Toolbar e Editor aqui -->
                    </div>
                    <p class="help">Alterações são salvas automaticamente.</p>
                </div>
                <div id="notes-column" style="flex: 1; display: flex; flex-direction: column; padding: 1rem; border-left: 1px solid #333;">
                    <label class="label is-small has-text-white">Notas do Player</label>
                    <textarea id="player-notes-editor" class="textarea is-small" style="flex: 1; min-height: 200px;" placeholder="Suas anotações pessoais..."></textarea>
                    <span id="player-notes-status" class="help is-hidden">Salvando...</span>
                </div>
            </main>
            <footer class="sheet-footer">
                <div class="dice-bar">
                    <button class="button is-small is-dark is-rounded dice-quick-btn" data-dice="d4">D4</button>
                    <button class="button is-small is-dark is-rounded dice-quick-btn" data-dice="d6">D6</button>
                    <button class="button is-small is-dark is-rounded dice-quick-btn" data-dice="d8">D8</button>
                    <button class="button is-small is-dark is-rounded dice-quick-btn" data-dice="d10">D10</button>
                    <button class="button is-small is-dark is-rounded dice-quick-btn" data-dice="d12">D12</button>
                    <button class="button is-small is-dark is-rounded dice-quick-btn" data-dice="d20">D20</button>
                    <button class="button is-small is-dark is-rounded dice-quick-btn" data-dice="d100">D100</button>
                </div>
                <div class="chat-input-wrapper">
                    <input id="sheet-chat-input" class="input is-small" type="text" placeholder="Mensagem ou comando (/r 1d20+5)...">
                </div>
            </footer>
        `;
}
function checkUrlAndLoad() {
    const hash = window.location.hash.substring(1);
    if (hash && allItems.some(i => i.id === hash)) loadCharacter(hash);
    else {
        const savedId = localStorage.getItem(`sheet_last_char_${getCurrentUserName()}`);
        if (savedId && allItems.find(i => i.id === savedId)) loadCharacter(savedId);
        else openCharSelection();
    }
}

function openCharSelection() {
    const modal = document.getElementById('char-selection-modal');
    const container = document.getElementById('char-selection-body');
    if (!modal || !container) return;
    
    // Filtra por categoria 'pj' suportando retrocompatibilidade com 'personagem' e tag 'pj'
    const isPJ = (c) => {
        const val = String(c.cat || c.category || c.categoria || "").toLowerCase();
        const validValues = ['pj', 'personagem', 'personagens'];
        const hasPJTag = Array.isArray(c.tags) && c.tags.some(t => String(t).toLowerCase() === 'pj');
        return validValues.includes(val) || hasPJTag;
    };
    const pjs = allItems.filter(isPJ);
    
    container.innerHTML = '';
    if (pjs.length === 0) container.innerHTML = '<p>Nenhum personagem PJ encontrado.</p>';
    else {
        const list = document.createElement('div');
        list.className = 'buttons';
        pjs.forEach(pj => {
            const btn = document.createElement('button');
            btn.className = 'button is-fullwidth is-dark';
            btn.textContent = pj.titulo;
            btn.onclick = () => { closeModal(modal); loadCharacter(pj.id); };
            list.appendChild(btn);
        });
        container.appendChild(list);
    }
    openModal(modal);
}

function loadCharacter(id) {
    isDataReady = false;
    const char = allItems.find(i => i.id === id);
    if (!char) return;
    currentCharacterId = id;
    currentCharacter = char;
    localStorage.setItem(`sheet_last_char_${getCurrentUserName()}`, id);
    window.location.hash = id;

    if (imgEl) imgEl.src = char.url || '';
    if (nameEl) nameEl.textContent = char.titulo;

    const catLabel = document.getElementById('char-category-label');
    if (catLabel) {
        const catValue = char.cat || char.category || char.categoria || 'pj';
        catLabel.textContent = catValue.toUpperCase();
        catLabel.className = `tag is-${catValue === 'monstro' ? 'danger' : (catValue === 'item' ? 'warning' : 'info')} is-light is-uppercase`;
    }

    if (mainEditor) {
        const parsedContext = preParseShortcodesForEditor(char.conteudo || "");
        mainEditor.commands.setContent(parsedContext, false);
    }

    if (notesEditor && document.activeElement !== notesEditor) notesEditor.value = char.playerNotes || '';

    if (isNarrator()) {
        document.querySelectorAll(".narrator-only").forEach(el => el.classList.remove("is-hidden"));
    }

    renderMacroButtons();

    setTimeout(() => {
        isDataReady = true;
    }, 100);
}



function htmlToRaw(html) {
    if (!html) return "";
    let t = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<p>/gi, '').replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, '');
    const e = document.createElement("textarea");
    e.innerHTML = t;
    return e.value.trim();
}

function setupSheetSpecificListeners() {
    if (notesEditor) notesEditor.addEventListener('input', (e) => handleAutoSave('playerNotes', e.target.value, false));

    const imgUploadInput = document.getElementById('char-image-upload');
    if (imgUploadInput) {
        imgUploadInput.addEventListener('change', handleCharImageUpload);
    }

    const quickChatInput = document.getElementById('sheet-chat-input');
    if (quickChatInput) {
        quickChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const msg = quickChatInput.value.trim();
                const user = getCurrentUserName();
                if (msg) {
                    if (msg.startsWith('/r ') || msg.startsWith('/roll ')) {
                        processRoll(msg, currentCharacter, user, null);
                    } else {
                        addChatMessage(msg, 'user', user);
                    }
                    quickChatInput.value = '';
                }
            }
        });
    }

    const saveMacroBtn = document.getElementById('save-macro-btn');
    if (saveMacroBtn) saveMacroBtn.onclick = saveMacro;

    const testMacroBtn = document.getElementById('test-macro-btn');
    if (testMacroBtn) testMacroBtn.onclick = testMacro;
}

function handleAutoSave(field, value, isRaw) {
    if (!currentCharacterId) return;
    
    if (field === 'playerNotes') {
        const statusEl = document.getElementById('player-notes-status');
        if (statusEl) {
            statusEl.textContent = 'Salvando...';
            statusEl.classList.remove('is-hidden', 'is-success');
            statusEl.classList.add('is-warning');
        }
    }
    
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        const updateData = {};
        updateData[field] = isRaw ? value.replace(/\n/g, '<br>') : value;
        await updateItem({ id: currentCharacterId }, updateData).catch(console.error);
        
        if (field === 'playerNotes') {
            const statusEl = document.getElementById('player-notes-status');
            if (statusEl) {
                statusEl.textContent = 'Salvo ✓';
                statusEl.classList.remove('is-warning', 'is-hidden');
                statusEl.classList.add('is-success');
                setTimeout(() => statusEl.classList.add('is-hidden'), 2000);
            }
        }
    }, 1000);
}

async function initializeMainEditor() {
    const editorContainer = document.querySelector("#tiptap-container");
    if (!editorContainer) return;
    
    // Injetar Toolbar
    editorContainer.innerHTML = `
        <div role="toolbar" aria-label="toolbar" class="tiptap-toolbar">
            <div role="group" class="tiptap-toolbar-group">
                <button class="tiptap-button" data-action="undo" data-tooltip="Desfazer"><i class="fas fa-undo"></i></button>
                <button class="tiptap-button" data-action="redo" data-tooltip="Refazer"><i class="fas fa-redo"></i></button>
            </div>
            <div class="tiptap-separator"></div>
             <div role="group" class="tiptap-toolbar-group">
                <button class="tiptap-button" data-action="toggleHeading" data-level="1" data-tooltip="Título 1">H1</button>
                <button class="tiptap-button" data-action="toggleHeading" data-level="2" data-tooltip="Título 2">H2</button>
                <button class="tiptap-button" data-action="toggleHeading" data-level="3" data-tooltip="Título 3">H3</button>
                <button class="tiptap-button" data-action="toggleBulletList" data-tooltip="Lista"><i class="fas fa-list-ul"></i></button>
                <button class="tiptap-button" data-action="toggleOrderedList" data-tooltip="Lista Numerada"><i class="fas fa-list-ol"></i></button>
            </div>
             <div class="tiptap-separator"></div>
            <div role="group" class="tiptap-toolbar-group">
                <button class="tiptap-button" data-action="toggleBold" data-tooltip="Negrito"><i class="fas fa-bold"></i></button>
                <button class="tiptap-button" data-action="toggleItalic" data-tooltip="Itálico"><i class="fas fa-italic"></i></button>
                 <button class="tiptap-button" data-action="toggleStrike" data-tooltip="Riscado"><i class="fas fa-strikethrough"></i></button>
                <button class="tiptap-button" data-action="toggleHighlight" data-tooltip="Destacar"><i class="fas fa-highlighter"></i></button>
            </div>
            <div class="tiptap-separator"></div>
            <div role="group" class="tiptap-toolbar-group">
                <button class="tiptap-button" data-action="setTextAlign" data-align="left" data-tooltip="Alinhar à Esquerda"><i class="fas fa-align-left"></i></button>
                <button class="tiptap-button" data-action="setTextAlign" data-align="center" data-tooltip="Centralizar"><i class="fas fa-align-center"></i></button>
                <button class="tiptap-button" data-action="setTextAlign" data-align="right" data-tooltip="Alinhar à Direita"><i class="fas fa-align-right"></i></button>
            </div>
             <div class="tiptap-separator"></div>
             <div role="group" class="tiptap-toolbar-group">
                <button class="tiptap-button sc-shortcut" data-type="hp" data-tooltip="Novo HP"><i class="fas fa-heartbeat"></i></button>
                <button class="tiptap-button sc-shortcut" data-type="stat" data-tooltip="Novo Atributo"><i class="fas fa-dice-d20"></i></button>
                <button class="tiptap-button sc-shortcut" data-type="money" data-tooltip="Novo Dinheiro"><i class="fas fa-coins"></i></button>
                <button class="tiptap-button sc-shortcut" data-type="count" data-tooltip="Novo Contador"><i class="fas fa-list-ol"></i></button>
            </div>
            <div class="tiptap-separator"></div>
             <div role="group" class="tiptap-toolbar-group" id="sheet-mode-shortcode-container"></div>
        </div>
        <div id="editor" style="flex: 1; overflow-y: auto; padding: 1rem;"></div>
    `;

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
                    items: ({ query }) => getSuggestionItems(allItems, query),
                },
            }),
            StatNode,
            HpNode,
            MoneyNode,
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
                        if (html.includes("[stat") || html.includes("[hp") || html.includes("[money") || html.includes("[count") || html.includes("[container") || html.includes("[#") || html.includes("[ficha")) {
                            const parsed = preParseShortcodesForEditor(html);
                            mainEditor.commands.setContent(parsed, true);
                        }
                    }, 10);
                }
                return false;
            }
        },
        onUpdate: () => {
            if (!isDataReady || !currentCharacterId) return;
            clearTimeout(mainEditorSaveTimeout);
            mainEditorSaveTimeout = setTimeout(syncToFirebase, 2000);
        },
        onBlur: () => {
            if (!isDataReady || !currentCharacterId) return;
            clearTimeout(mainEditorSaveTimeout);
            syncToFirebase();
        }
    });

    // Toolbar Events
    document.querySelector(".tiptap-toolbar").onclick = (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        handleToolbarAction(mainEditor, btn.dataset.action, btn.dataset.level || btn.dataset.align);
    };

    // Shortcut Buttons Events
    document.querySelectorAll(".sc-shortcut").forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const type = btn.dataset.type;
            openConfigModal(type, mainEditor);
        };
    });

    const scContainer = document.getElementById('sheet-mode-shortcode-container');
    if (scContainer) {
        setupShortcodeMenu(scContainer, mainEditor);
    }

    // Re-bind shortcode editing
    document.addEventListener("edit-shortcode", (e) => {
        const { type, attrs, pos, editor } = e.detail;
        const targetEditor = editor || mainEditor;
        const typeMap = {
            'containerShortcode': 'container',
            'statNode': 'stat',
            'hpNode': 'hp',
            'moneyNode': 'money',
            'countNode': 'count'
        };
        const mappedType = typeMap[type] || type;
        openConfigModal(mappedType, targetEditor, { pos, attrs, nodeType: type });
    });
}

function syncToFirebase() {
    if (!currentCharacterId || !isDataReady) return;
    const html = mainEditor.getHTML();
    const finalContent = convertEditorHtmlToShortcodes(html);
    currentCharacter.conteudo = finalContent;
    updateItem({ id: currentCharacterId }, { conteudo: finalContent }).catch(console.error);
}


async function testMacro() {
    const n = document.getElementById('macro-name').value.trim();
    const f = document.getElementById('macro-formula').value.trim();
    const resultEl = document.getElementById('macro-test-result');
    
    if (!f) {
        resultEl.className = 'notification is-danger is-light mt-2';
        resultEl.textContent = 'Digite uma fórmula para testar.';
        resultEl.classList.remove('is-hidden');
        return;
    }

    const testResult = await processRoll(f, currentCharacter || {}, getCurrentUserName() || 'Teste', 'Teste');
    
    if (!testResult || !testResult.success) {
        resultEl.className = 'notification is-danger is-light mt-2';
        resultEl.textContent = testResult?.error || 'Fórmula inválida. Verifique a sintaxe e tente novamente.';
        resultEl.classList.remove('is-hidden');
    } else {
        resultEl.className = 'notification is-success is-light mt-2';
        resultEl.textContent = `✓ Fórmula válida! Resultado: ${testResult.summary?.join(', ') || 'OK'}`;
        resultEl.classList.remove('is-hidden');
    }
}

async function saveMacro() {
    const n = document.getElementById('macro-name').value.trim();
    const f = document.getElementById('macro-formula').value.trim();
    if (!n || !f || !currentCharacterId) return;

    const testResult = await processRoll(f, currentCharacter, getCurrentUserName() || 'Teste', 'Teste');
    if (!testResult || !testResult.success) {
        showToast(testResult?.error || 'Fórmula inválida. Verifique e tente novamente.', 'is-danger');
        return;
    }

    if (!currentCharacter.macros) currentCharacter.macros = [];
    currentCharacter.macros.push({ nome: n, formula: f });

    await updateItem({ id: currentCharacterId }, { macros: currentCharacter.macros });
    renderMacroButtons();
    closeModal(document.getElementById('macro-modal'));
    document.getElementById('macro-name').value = '';
    document.getElementById('macro-formula').value = '';
    document.getElementById('macro-test-result').classList.add('is-hidden');
    showToast(`Macro "${n}" criado!`, 'is-success');
}

function renderMacroButtons() {
    const container = document.getElementById('macro-bar');
    if (!container) return;
    container.innerHTML = '';

    const macros = currentCharacter?.macros || [];
    macros.forEach((mac, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'macro-btn-wrap';

        const b = document.createElement('button');
        b.className = 'button is-small is-fullwidth is-rounded is-dark has-text-weight-bold sheet-macro-btn';
        b.title = `Fórmula: ${mac.formula}`;
        b.innerHTML = `<span>${mac.nome}</span>`;
        b.onclick = () => {
            const user = getCurrentUserName() || 'Anônimo';
            processRoll(mac.formula, currentCharacter, user, mac.nome);
        };

        const del = document.createElement('button');
        del.className = 'delete is-small';
        del.title = 'Remover macro';
        del.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Deletar macro "${mac.nome}"?`)) {
                currentCharacter.macros.splice(i, 1);
                await updateItem({ id: currentCharacterId }, { macros: currentCharacter.macros });
                renderMacroButtons();
            }
        };

        wrap.appendChild(b);
        wrap.appendChild(del);
        container.appendChild(wrap);
    });
}

async function handleCharImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentCharacterId) return;

    try {
        // Mostrar loading (opcional)
        imgEl.style.opacity = '0.5';

        // Fazer upload da imagem
        const result = await uploadImageToImgBB(file);

        // Atualizar Firebase com a nova URL
        await updateItem({ id: currentCharacterId }, { url: result.url });

        // Atualizar imagem na tela
        imgEl.src = result.url;
        imgEl.style.opacity = '1';

        // Limpar input
        event.target.value = '';

        console.log('Imagem atualizada com sucesso');
    } catch (error) {
        imgEl.style.opacity = '1';
        console.error('Erro ao fazer upload da imagem:', error);
        alert('Erro ao fazer upload da imagem: ' + error.message);
        event.target.value = '';
    }
}



