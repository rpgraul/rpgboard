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

import { listenToItems, updateItem, updateCharacterStat, listenToDiceRolls, addChatMessage, uploadImageToImgBB, initFirebaseService } from './modules/firebaseService.js';
import { initializeAuth, getCurrentUserName, isNarrator } from './modules/auth.js';
import { initializeLayout } from './modules/layout.js';
import { openModal, closeModal, initializeModals, showDetailModal } from './modules/modal.js';
import * as shortcodeParser from './modules/shortcodeParser.js';
import * as chat from './modules/chat.js';
import { visualizeDiceRoll } from './modules/dice3d.js';
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
let sideViewEditor;
let editingNodePos = null;
let isDataLoading = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. INICIALIZAÇÃO DO LAYOUT MODULAR
    // Aqui definimos o título da página e quais botões queremos no FAB desta tela
    const layout = await initializeLayout();
    // Carregar configurações globais e atualizar título/header
    try {
        const firebaseService = await import('./modules/firebaseService.js');
        const appSettings = await firebaseService.getSettings();
        window.appSettings = appSettings;
        initFirebaseService();
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
    setupInteractiveSheetListeners();
    loadMacros();

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
            </aside>
            <main class="sheet-main box is-full-height" style="display: flex; flex-direction: column; padding: 0;">
                <div id="tiptap-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 1rem;">
                    <!-- Tiptap Toolbar e Editor aqui -->
                </div>
                <p class="help mx-4 mb-2">Alterações são salvas automaticamente.</p>
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
                <div id="macro-bar" class="macro-bar">
                    <!-- Botões de Macro serão injetados aqui -->
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

    if (visualStatsContainer) {
        visualStatsContainer.innerHTML = '';
        if (visualCountsContainer) visualCountsContainer.innerHTML = '';

        const parsed = shortcodeParser.parseAllShortcodes({ conteudo: char.conteudo || "" }, { isPlayerSheet: true });

        visualStatsContainer.innerHTML = parsed.all.filter(s => s.type === 'stat' || s.type === 'money').map(s => s.html).join('');
        if (visualCountsContainer) visualCountsContainer.innerHTML = parsed.all.filter(s => s.type === 'count').map(s => s.html).join('');

        renderContainers(char);
        renderMacroButtons();
    }

    if (mainEditor) {
        const parsedContext = preParseShortcodesForEditor(char.conteudo || "");
        mainEditor.commands.setContent(parsedContext, false);
    }

    if (notesEditor && document.activeElement !== notesEditor) notesEditor.value = char.playerNotes || '';

    if (isNarrator()) {
        document.querySelectorAll(".narrator-only").forEach(el => el.classList.remove("is-hidden"));
    }

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
    const editSheetBtn = document.getElementById('edit-sheet-btn');
    if (editSheetBtn) {
        editSheetBtn.addEventListener('click', openSheetEditor);
    }

    const tabs = document.querySelectorAll('.tabs li');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    if (notesEditor) notesEditor.addEventListener('input', (e) => handleAutoSave('playerNotes', e.target.value, false));

    // Listener para upload de imagem do personagem
    const imgUploadInput = document.getElementById('char-image-upload');
    if (imgUploadInput) {
        imgUploadInput.addEventListener('change', handleCharImageUpload);
    }

    const saveContentBtn = document.getElementById('save-content-btn');
    if (saveContentBtn) {
        saveContentBtn.addEventListener('click', saveContainerContent);
    }


    // Listeners para modal de gerador de shortcodes
    const shortcodeInsertBtn = document.getElementById('shortcode-insert-btn');
    if (shortcodeInsertBtn) {
        shortcodeInsertBtn.addEventListener('click', handleShortcodeGeneration);
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

    // Listeners para botões de shortcode generator (pode haver vários em diferentes toolbars)
    document.querySelectorAll('.shortcode-generator-btn').forEach(btn => {
        btn.addEventListener('click', openShortcodeGeneratorModal);
    });

    // Listeners para modal de shortcode generator
    const shortcodeModal = document.getElementById('shortcode-generator-modal');
    if (shortcodeModal) {
        const typeSelect = document.getElementById('shortcode-type');
        const insertBtn = document.getElementById('shortcode-insert-btn');
        const closeBtn = shortcodeModal.querySelector('.delete');
        if (closeBtn) closeBtn.addEventListener('click', () => closeModal(shortcodeModal));
        const cancelBtn = shortcodeModal.querySelector('.modal-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(shortcodeModal));
        const bgBtn = shortcodeModal.querySelector('.modal-background');
        if (bgBtn) bgBtn.addEventListener('click', () => closeModal(shortcodeModal));
    }
}

function handleAutoSave(field, value, isRaw) {
    if (!currentCharacterId) return;
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        const updateData = {};
        updateData[field] = isRaw ? value.replace(/\n/g, '<br>') : value;
        updateItem({ id: currentCharacterId }, updateData).catch(console.error);
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
                    items: ({ query }) => {
                        const cleanQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        return allItems
                            .filter(c => {
                                const cleanTitle = (c.titulo || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                return cleanTitle.includes(cleanQuery);
                            })
                            .map(c => ({ id: c.titulo, title: c.titulo }))
                            .slice(0, 10);
                    },
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

function getMacros() {
    return JSON.parse(localStorage.getItem(`macros_${getCurrentUserName()}`) || '[]');
}

async function saveMacro() {
    const n = document.getElementById('macro-name').value.trim();
    const f = document.getElementById('macro-formula').value.trim();
    if (!n || !f || !currentCharacterId) return;

    if (!currentCharacter.macros) currentCharacter.macros = [];
    currentCharacter.macros.push({ nome: n, formula: f });

    await updateItem({ id: currentCharacterId }, { macros: currentCharacter.macros });
    renderMacroButtons();
    closeModal(document.getElementById('macro-modal'));
    document.getElementById('macro-name').value = '';
    document.getElementById('macro-formula').value = '';
}

function renderMacroButtons() {
    const container = document.getElementById('macro-bar');
    if (!container) return;
    container.innerHTML = '';

    const macros = currentCharacter?.macros || [];
    macros.forEach((mac, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'macro-btn-wrap';
        wrap.style.cssText = 'display:inline-flex; align-items:center; margin-right:8px; background:rgba(255,255,255,0.05); border-radius:4px; padding:2px 4px;';

        const b = document.createElement('button');
        b.className = 'button is-small is-rounded is-info has-text-weight-bold';
        b.textContent = mac.nome;
        b.style.border = 'none';
        b.onclick = () => {
            const user = getCurrentUserName() || 'Anônimo';
            processRoll(mac.formula, currentCharacter, user, mac.nome);
        };

        const del = document.createElement('button');
        del.className = 'delete is-small macro-delete-btn';
        del.style.marginLeft = '4px';
        del.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Deletar macro "${mac.nome}"?`)) {
                currentCharacter.macros.splice(i, 1);
                await updateItem({ id: currentCharacterId }, { macros: currentCharacter.macros });
                renderMacroButtons();
            }
        };

        wrap.append(b, del);
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

/**
 * Renderiza containers como botões interativos na ficha.
 */
function renderContainers(char) {
    if (!visualStatsContainer) return;

    // Remove qualquer lista anterior
    const existingList = visualStatsContainer.querySelector('.sheet-containers-list');
    if (existingList) existingList.remove();

    const containers = shortcodeParser.extractContainers(char.conteudo);
    if (containers.length === 0) return;

    const containerList = document.createElement('div');
    containerList.className = 'sheet-containers-list mt-4 mb-4';


    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.className = 'buttons are-small is-centered';

    containers.forEach((c, index) => {
        const btn = document.createElement('button');
        btn.className = `button is-dark type-${c.type}`;

        let emoji = '📦';
        if (c.type === 'inventory') emoji = '🎒';
        if (c.type === 'spells') emoji = '📜';
        if (c.type === 'skills') emoji = '✊';

        btn.innerHTML = `
            <span class="mr-1">${emoji}</span>
            <span>${c.label}</span>
        `;

        btn.onclick = () => openContainerEditor(c, index);
        buttonsWrapper.appendChild(btn);
    });

    containerList.appendChild(buttonsWrapper);
    visualStatsContainer.appendChild(containerList);
}

/**
 * Abre o modal de edição para um container específico.
 */
function openContainerEditor(container, index) {
    const modal = document.getElementById('content-editor-modal');
    modal.dataset.mode = 'container';
    modal.dataset.containerIndex = index;
    modal.querySelector('.modal-card-title').textContent = `Editar: ${container.label}`;

    // Usaremos o terminal visual do editor para facilitar a edição focada
    // Se quiser usar o mainEditor para isso, precisamos de um mecanismo de swap ou apenas usar o modal como antes mas com o novo sistema.
    // Como o usuário quer "mesma forma que text-mode", no text-mode editamos direto.
    // Mas no sheet-mode os botões laterais são úteis.

    // Vou inicializar um segundo editor se necessário (sideViewEditor equivalente do text-mode)
    if (!sideViewEditor) {
        initializeSideViewEditor();
    }

    if (sideViewEditor) {
        sideViewEditor.commands.setContent(preParseShortcodesForEditor(container.content || ''));
    }

    openModal(modal);
}

function initializeSideViewEditor() {
    sideViewEditor = new Editor({
        element: document.querySelector("#content-tiptap-wrapper"),
        extensions: [
            StarterKit,
            Highlight,
            Underline,
            Link.configure({ openOnClick: false }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            StatNode,
            HpNode,
            MoneyNode,
            CountNode,
            ContainerShortcode,
        ],
        editorProps: { attributes: { class: "ProseMirror" } }
    });

    // Injetar toolbar se houver container
    const toolbarWrap = document.createElement('div');
    toolbarWrap.className = 'tiptap-toolbar mb-2';
    // Reutiliza HTML da toolbar principal
    const mainToolbar = document.querySelector(".column-raw-editor .tiptap-toolbar");
    if (mainToolbar) {
        toolbarWrap.innerHTML = mainToolbar.innerHTML;
        // Limpa shortcode menu se não quiser em containers ou configura novo
        const scMenu = toolbarWrap.querySelector('#sheet-mode-shortcode-container');
        if (scMenu) {
            scMenu.id = 'container-shortcode-container';
            scMenu.innerHTML = '';
            setupShortcodeMenu(scMenu, sideViewEditor);
        }

        toolbarWrap.onclick = (e) => {
            const btn = e.target.closest("button[data-action]");
            if (!btn) return;
            handleToolbarAction(sideViewEditor, btn.dataset.action, btn.dataset.level || btn.dataset.align);
        };
    }

    const containerWrapper = document.querySelector("#content-tiptap-wrapper");
    if (containerWrapper) {
        containerWrapper.prepend(toolbarWrap);
    }
}

function setupInteractiveSheetListeners() {
    const containers = [visualStatsContainer, visualCountsContainer];

    containers.forEach(container => {
        if (!container) return;

        container.onclick = (e) => {
            const interactive = e.target.closest('.is-interactive');
            if (!interactive) return;

            e.stopPropagation();

            if (interactive.classList.contains('shortcode-hp')) {
                const display = interactive.querySelector('.hp-display-mode');
                const edit = interactive.querySelector('.hp-edit-mode');
                if (display && edit) {
                    display.classList.add('is-hidden');
                    edit.classList.remove('is-hidden');
                    const input = edit.querySelector('input');
                    input.focus();
                    input.select();
                }
            } else if (interactive.classList.contains('shortcode-stat') || interactive.classList.contains('shortcode-money') || interactive.classList.contains('shortcode-xp')) {
                const display = interactive.querySelector('.stat-value-display, .money-value-display, .xp-value-display');
                const input = interactive.querySelector('input');
                if (display && input) {
                    display.classList.add('is-hidden');
                    input.classList.remove('is-hidden');
                    input.focus();
                    input.select();
                }
            }
        };

        container.addEventListener('focusout', async (e) => {
            const input = e.target;
            if (input.tagName !== 'INPUT') return;
            const interactive = input.closest('.is-interactive');
            if (!interactive || !interactive.dataset.shortcode) return;

            const oldShortcode = decodeURIComponent(interactive.dataset.shortcode);
            const args = shortcodeParser.parseArguments(oldShortcode.slice(1, -1));
            const params = shortcodeParser.parseKeyValueArgs(args);
            const inputVal = input.value.trim();

            let newShortcode = "";

            if (interactive.classList.contains('shortcode-hp')) {
                const max = parseInt(params.max, 10) || 100;
                const current = parseInt(params.current, 10) || 0;
                let newValue = Math.round(shortcodeParser.calculateMathExpression(current, inputVal));
                newValue = Math.max(-10, Math.min(newValue, max));
                if (current === newValue) {
                    interactive.querySelector('.hp-display-mode').classList.remove('is-hidden');
                    interactive.querySelector('.hp-edit-mode').classList.add('is-hidden');
                    return;
                }
                newShortcode = `[hp max="${max}" current="${newValue}"]`;
                input.value = newValue;
            } else if (interactive.classList.contains('shortcode-stat')) {
                const label = args[1] || "";
                const oldValue = args[2] || "";
                if (oldValue === inputVal) {
                    interactive.querySelector('.stat-value-display').classList.remove('is-hidden');
                    input.classList.add('is-hidden');
                    return;
                }
                newShortcode = `[stat "${label}" "${inputVal}"]`;
            } else if (interactive.classList.contains('shortcode-money')) {
                const current = parseFloat(params.current) || 0;
                const newValue = Math.round(shortcodeParser.calculateMathExpression(current, inputVal) * 100) / 100;
                if (current === newValue) {
                    interactive.querySelector('.money-value-display').classList.remove('is-hidden');
                    input.classList.add('is-hidden');
                    return;
                }
                let currency = params.currency || "";
                if (!currency) {
                    currency = args.find(a => !a.includes('=') && a.toLowerCase() !== 'money') || "";
                }
                newShortcode = `[money ${currency} current="${newValue}"]`.replace(/\s+\]/, ']');
                input.value = newValue;
            } else if (interactive.classList.contains('shortcode-xp')) {
                const current = parseInt(params.current, 10) || 0;
                const newValue = Math.round(shortcodeParser.calculateMathExpression(current, inputVal));
                if (current === newValue) {
                    interactive.querySelector('.xp-value-display').classList.remove('is-hidden');
                    input.classList.add('is-hidden');
                    return;
                }
                newShortcode = `[xp current="${newValue}"]`;
                input.value = newValue;
            }

            if (newShortcode && newShortcode !== oldShortcode) {
                const dataField = input.dataset.field;
                if (dataField) {
                    await updateCharacterStat(currentCharacterId, dataField, newValue);
                    // Sincroniza cache local para o stat
                    const itemIdx = allItems.findIndex(i => i.id === currentCharacterId);
                    if (itemIdx !== -1) {
                        const keys = dataField.split('.');
                        let obj = allItems[itemIdx];
                        for (let i = 0; i < keys.length - 1; i++) {
                            if (!obj[keys[i]]) obj[keys[i]] = {};
                            obj = obj[keys[i]];
                        }
                        obj[keys[keys.length - 1]] = newValue;
                    }
                }
                await updateFichaShortcode(oldShortcode, newShortcode);

                interactive.dataset.shortcode = encodeURIComponent(newShortcode);

                if (interactive.classList.contains('shortcode-hp')) {
                    const txt = interactive.querySelector('.hp-text');
                    if (txt) txt.textContent = `${newValue} / ${params.max || 10}`;
                } else if (interactive.classList.contains('shortcode-stat') || interactive.classList.contains('shortcode-money') || interactive.classList.contains('shortcode-xp')) {
                    const display = interactive.querySelector('.stat-value-display, .money-value-display, .xp-value-display');
                    if (display) {
                        const val = interactive.classList.contains('shortcode-xp') ? `${input.value} XP` : input.value;
                        display.textContent = val;
                    }
                }
            } else {
                const display = interactive.querySelector('.hp-display-mode, .stat-value-display, .money-value-display, .xp-value-display');
                const edit = interactive.querySelector('.hp-edit-mode, input');
                if (display && edit) {
                    display.classList.remove('is-hidden');
                    edit.classList.add('is-hidden');
                }
            }
        });

        container.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault();
                e.target.blur();
            }
        });
    });
}



