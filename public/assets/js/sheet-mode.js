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

import { listenToItems, updateItem, listenToDiceRolls, addChatMessage } from './modules/firebaseService.js';
import { initializeAuth, getCurrentUserName } from './modules/auth.js';
import { initializeLayout } from './modules/layout.js'; // Importação do Orquestrador
import { uploadImage } from './imgbbService.js';
import { openModal, closeModal, initializeModals } from './modules/modal.js';
import * as shortcodeParser from './modules/shortcodeParser.js';
import * as chat from './modules/chat.js';
import { visualizeDiceRoll } from './modules/dice3d.js';
import { processRoll } from './modules/diceLogic.js';
import { preParseShortcodesForEditor, convertEditorHtmlToShortcodes } from './modules/editorUtils.js';

let allItems = [];
let currentCharacterId = null;
let currentCharacter = null;
let autoSaveTimeout = null;
let contentEditor = null;
let contentEditorSaveTimeout = null;

// Referências de elementos que serão preenchidos após o layout carregar
let imgEl, nameEl, visualStatsContainer, visualCountsContainer, notesEditor;
let mainEditor, mainEditorSaveTimeout;
let sideViewEditor;
let isProcessingUpdate = false;
let editingNodePos = null;
let currentFichaBlock = ""; // Armazena o bloco [ficha] integral
let fichaEditor = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. INICIALIZAÇÃO DO LAYOUT MODULAR
    // Aqui definimos o título da página e quais botões queremos no FAB desta tela
    const layout = await initializeLayout({
        fabActions: ['help', 'macros', 'change-char', 'chat', 'dice']
    });
    // Carregar configurações globais e atualizar título/header
    try {
        const firebaseService = await import('./modules/firebaseService.js');
        const appSettings = await firebaseService.getSettings();
        window.appSettings = appSettings;
        window.IMGBB_API_KEY = appSettings.imgbbApiKey;
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

    // 3. VINCULAÇÃO DE EVENTOS DOS COMPONENTES INJETADOS
    // Os botões FAB e elementos globais já foram criados pelo layout.js
    // Listeners for #toggle-chat-btn, #fab-help, #dice-main-btn, .dice-quick-btn are now handled in layout.js.
    // Keeping page-specific listeners.

    const fabChangeChar = document.getElementById('fab-change-char');
    if (fabChangeChar) {
        fabChangeChar.addEventListener('click', openCharSelection);
    }

    const editSheetBtn = document.getElementById('edit-sheet-btn');
    if (editSheetBtn) {
        editSheetBtn.addEventListener('click', openSheetEditor);
    }

    document.getElementById('ficha-save-btn').addEventListener('click', saveFichaEditorContent);

    if (layout.fabMacros) {
        layout.fabMacros.addEventListener('click', () => openModal(document.getElementById('macro-modal')));
    }

    // 4. INJETAR HTML DA FICHA NA .sheet-layout
    injectSheetLayoutHTML();

    // 5. CONFIGURAÇÃO DOS ELEMENTOS DA PÁGINA (após injeção)
    imgEl = document.getElementById('char-image');
    nameEl = document.getElementById('char-name');
    visualStatsContainer = document.getElementById('visual-stats-container');
    visualCountsContainer = document.getElementById('visual-counts-container');
    notesEditor = document.getElementById('player-notes-editor');

    // 5.1 INICIALIZAR EDITOR TIPTAP (após injeção)
    await initializeMainEditor();


    // 6. CARREGAMENTO DE DADOS (FIREBASE)
    listenToItems((snapshot) => {
        allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        checkUrlAndLoad();
    });

    setupSheetSpecificListeners();
    loadMacros();
});

// Função para injetar o HTML da ficha na .sheet-layout
function injectSheetLayoutHTML() {
    const layout = document.querySelector('.sheet-layout');
    if (!layout) return;
    layout.innerHTML = `
            <div class="sheet-column column-visual">
                <div class="box is-full-height">
                    <div id="char-image-container" class="char-image-container">
                        <img id="char-image" src="" alt="Personagem">
                        <label class="image-change-btn" data-tooltip="Trocar Imagem do Personagem">
                            <i class="fas fa-camera"></i>
                            <input type="file" id="char-image-upload" class="is-hidden" accept="image/*">
                        </label>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; margin-bottom: 1rem;">
                        <h2 id="char-name" class="title is-4" style="margin: 0; flex: 1;"></h2>
                        <button id="edit-sheet-btn" class="button is-small is-dark" title="Editar Ficha Técnica">
                            <i class="fas fa-edit mr-1"></i> Ficha
                        </button>
                    </div>
                    <div id="visual-stats-container" class="content mt-4"></div>
                    <div id="visual-counts-container" class="content mt-4"></div>
                </div>
            </div>
            <div class="sheet-column column-raw-editor">
                <div class="box is-full-height" style="display: flex; flex-direction: column;">
                    <h3 class="title is-6"><i class="fas fa-align-left"></i> Conteúdo Principal</h3>
                    <div id="tiptap-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
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
                                <button id="shortcode-generator-btn" class="tiptap-button" data-tooltip="Gerador de Shortcodes"><i class="fas fa-magic"></i></button>
                            </div>
                        </div>
                        <div id="editor" style="flex: 1; overflow-y: auto; padding: 1rem;"></div>
                    </div>
                    <p class="help">Alterações são salvas automaticamente.</p>
                </div>
            </div>
            <div class="sheet-column column-notes">
                <div class="box is-full-height">
                    <h3 class="title is-6"><i class="fas fa-sticky-note"></i> Notas Rápidas</h3>
                    <div class="field is-full-height">
                        <div class="control is-full-height">
                            <textarea id="player-notes-editor" class="textarea player-notes-area" placeholder="Suas anotações pessoais (salvas no servidor)..."></textarea>
                        </div>
                    </div>
                </div>
            </div>
            <footer class="sheet-footer">
                <div id="macro-bar" class="macro-bar">
                    <!-- Botões de Macro serão injetados aqui -->
                </div>
                <div class="dice-bar">
                    <button class="button is-small is-rounded dice-btn" data-dice="d4">d4</button>
                    <button class="button is-small is-rounded dice-btn" data-dice="d6">d6</button>
                    <button class="button is-small is-rounded dice-btn" data-dice="d8">d8</button>
                    <button class="button is-small is-rounded dice-btn" data-dice="d10">d10</button>
                    <button class="button is-small is-rounded dice-btn" data-dice="d12">d12</button>
                    <button class="button is-small is-rounded dice-btn" data-dice="d20">d20</button>
                    <button class="button is-small is-rounded dice-btn" data-dice="d100">d100</button>
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
    const pjs = allItems.filter(i => i.tags && i.tags.some(t => t.toLowerCase() === 'pj'));
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
    const char = allItems.find(i => i.id === id);
    if (!char) return;
    currentCharacterId = id;
    currentCharacter = char;
    localStorage.setItem(`sheet_last_char_${getCurrentUserName()}`, id);
    window.location.hash = id;

    if (imgEl) imgEl.src = char.url || '';
    if (nameEl) nameEl.textContent = char.titulo;

    if (visualStatsContainer) {
        visualStatsContainer.innerHTML = '';
        if (visualCountsContainer) visualCountsContainer.innerHTML = '';

        // Extrai apenas o conteúdo dentro de [ficha] para a lógica técnica
        const fichaContent = shortcodeParser.extractFichaContent(char.conteudo || "");
        const finalTechContent = fichaContent || char.conteudo || ""; // Fallback para conteúdo completo se não houver wrapper

        const parsed = shortcodeParser.parseAllShortcodes({ conteudo: finalTechContent }, { isPlayerSheet: true });

        visualStatsContainer.innerHTML = parsed.all.filter(s => s.type === 'stat' || s.type === 'money').map(s => s.html).join('');
        if (visualCountsContainer) visualCountsContainer.innerHTML = parsed.all.filter(s => s.type === 'count').map(s => s.html).join('');

        // Renderizar Containers Dinâmicos (passando o conteúdo técnico)
        renderContainers({ conteudo: finalTechContent });

        setupInteractiveSheetListeners();
    }

    if (mainEditor) {
        isProcessingUpdate = true;

        // Isolar a ficha da narrativa
        const fichaMatch = char.conteudo ? char.conteudo.match(/\[ficha\]([\s\S]*?)\[\/ficha\]/i) : null;
        currentFichaBlock = fichaMatch ? fichaMatch[0] : "";

        let narrativeContent = char.conteudo || "";
        if (fichaMatch) {
            narrativeContent = char.conteudo.replace(fichaMatch[0], "").trim();
        }

        const parsed = preParseShortcodesForEditor(narrativeContent);
        mainEditor.commands.setContent(parsed, false);
        isProcessingUpdate = false;
    }

    if (notesEditor && document.activeElement !== notesEditor) notesEditor.value = char.playerNotes || '';

    // Visibilidade narrativa-only no modal
    if (isNarrator()) {
        document.querySelectorAll(".narrator-only").forEach(el => el.classList.remove("is-hidden"));
    }
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

    // Listener para upload de imagem do personagem
    const imgUploadInput = document.getElementById('char-image-upload');
    if (imgUploadInput) {
        imgUploadInput.addEventListener('change', handleCharImageUpload);
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
        const cancelBtn = shortcodeModal.querySelector('.modal-cancel');
        const bgBtn = shortcodeModal.querySelector('.modal-background');

        typeSelect.addEventListener('change', updateShortcodeOptions);
        insertBtn.addEventListener('click', insertShortcodeFromModal);
        closeBtn.addEventListener('click', () => closeModal(shortcodeModal));
        cancelBtn.addEventListener('click', () => closeModal(shortcodeModal));
        bgBtn.addEventListener('click', () => closeModal(shortcodeModal));
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
                    items: ({ query }) => allItems.filter(c => c.titulo.toLowerCase().startsWith(query.toLowerCase())).map(c => ({ id: c.titulo, title: c.titulo })).slice(0, 5),
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
                            forceEditorReparse(mainEditor, html);
                        }
                    }, 10);
                }
                return false;
            }
        },
        onUpdate: () => {
            if (isProcessingUpdate) return;
            clearTimeout(mainEditorSaveTimeout);
            mainEditorSaveTimeout = setTimeout(saveMainEditorContent, 800);
        }
    });

    // Toolbar Events
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
        else if (action === "toggleStrike") chain.toggleStrike().run();
        else if (action === "toggleHighlight") chain.toggleHighlight().run();
        else if (action === "toggleHeading") chain.toggleHeading({ level: parseInt(val) }).run();
        else if (action === "toggleBulletList") chain.toggleBulletList().run();
        else if (action === "toggleOrderedList") chain.toggleOrderedList().run();
        else if (action === "setTextAlign") chain.setTextAlign(val).run();
    };

    const shortcodeModal = document.getElementById("shortcode-generator-modal");
    const typeSelect = document.getElementById("shortcode-type");

    typeSelect.addEventListener("change", (e) => {
        document.querySelectorAll(".shortcode-options").forEach(el => el.classList.add("is-hidden"));
        const target = document.getElementById(`shortcode-options-${e.target.value}`);
        if (target) target.classList.remove("is-hidden");
        document.getElementById("shortcode-common-options").classList.remove("is-hidden");
    });

    document.getElementById("shortcode-generator-btn").onclick = () => {
        editingNodePos = null;
        document.getElementById("shortcode-generator-form").reset();
        typeSelect.dispatchEvent(new Event("change"));
        openModal(shortcodeModal);
    };

    // Re-bind shortcode editing
    document.addEventListener("edit-shortcode", (e) => {
        const { type, attrs, pos } = e.detail;
        editingNodePos = pos;
        document.getElementById("shortcode-generator-form").reset();

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

        if (mappedType === "container") {
            document.getElementById("container-label").value = attrs.label || "";
            document.getElementById("container-type").value = attrs.type || "default";
            document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
        } else if (mappedType === "stat") {
            document.getElementById("stat-label").value = attrs.label || "";
            document.getElementById("stat-value").value = attrs.value || "";
            document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
            document.getElementById("shortcode-position").value = attrs.position || "";
        } else if (mappedType === "hp") {
            document.getElementById("hp-max").value = attrs.max || "";
            document.getElementById("hp-current").value = attrs.current || "";
            document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
            document.getElementById("shortcode-position").value = attrs.position || "";
        } else if (mappedType === "money") {
            document.getElementById("money-value").value = attrs.current || "";
            document.getElementById("money-currency").value = attrs.currency || "";
            document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
            document.getElementById("shortcode-position").value = attrs.position || "";
        } else if (mappedType === "count") {
            document.getElementById("count-label").value = attrs.label || "";
            document.getElementById("count-value").value = attrs.current || 0;
            document.getElementById("count-max").value = attrs.max || 0;
            document.getElementById("count-icon").value = attrs.icon || "";
            document.getElementById("count-theme").value = attrs.theme || "number";
            document.getElementById("count-overlay").checked = !!attrs.isOverlay;
            document.getElementById("shortcode-hidden").checked = !!attrs.isHidden;
            document.getElementById("shortcode-position").value = attrs.position || "";
        }

        openModal(shortcodeModal);
    });
}

function saveMainEditorContent() {
    if (!currentCharacterId) return;
    const html = mainEditor.getHTML();
    const narrativeShortcodes = convertEditorHtmlToShortcodes(html);

    // Recombina com a ficha que está isolada
    const fullContent = currentFichaBlock
        ? `${currentFichaBlock}\n\n${narrativeShortcodes}`
        : narrativeShortcodes;

    // Atualiza localmente
    currentCharacter.conteudo = fullContent;

    updateItem({ id: currentCharacterId }, { conteudo: fullContent }).catch(console.error);
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

function getMacros() {
    return JSON.parse(localStorage.getItem(`macros_${getCurrentUserName()}`) || '[]');
}

function saveMacro() {
    const n = document.getElementById('macro-name').value.trim();
    const c = document.getElementById('macro-command').value.trim();
    if (!n || !c) return;
    const m = getMacros();
    m.push({ name: n, command: c });
    localStorage.setItem(`macros_${getCurrentUserName()}`, JSON.stringify(m));
    loadMacros();
    closeModal(document.getElementById('macro-modal'));
    document.getElementById('macro-name').value = '';
    document.getElementById('macro-command').value = '';
}

function loadMacros() {
    const container = document.getElementById('macro-bar');
    if (!container) return;
    container.innerHTML = '';
    const m = getMacros();
    m.forEach((mac, i) => {
        const b = document.createElement('button');
        b.className = 'button is-small is-rounded is-primary is-light';
        b.textContent = mac.name;
        b.style.marginRight = '5px';
        b.onclick = () => {
            const user = getCurrentUserName();
            addChatMessage(mac.command, 'user', user);
            processRoll(mac.command, currentCharacter, user, mac.name);
        };
        b.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm('Deletar macro?')) {
                m.splice(i, 1);
                localStorage.setItem(`macros_${getCurrentUserName()}`, JSON.stringify(m));
                loadMacros();
            }
        };
        container.appendChild(b);
    });
}

async function handleCharImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentCharacterId) return;

    try {
        // Mostrar loading (opcional)
        imgEl.style.opacity = '0.5';

        // Fazer upload da imagem
        const result = await uploadImage(file);

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

// Shortcode Generator Integration
async function handleShortcodeGeneration() {
    const type = document.getElementById('shortcode-type').value;
    if (!type) return;

    let nodeType = '';
    let attrs = {
        isHidden: document.getElementById('shortcode-hidden').checked
    };

    if (type === 'stat') {
        nodeType = 'statNode';
        attrs.label = document.getElementById('stat-label').value.trim();
        attrs.value = document.getElementById('stat-value').value.trim();
    } else if (type === 'hp') {
        nodeType = 'hpNode';
        attrs.max = document.getElementById('hp-max').value.trim();
        attrs.current = document.getElementById('hp-current').value.trim();
    } else if (type === 'money') {
        nodeType = 'moneyNode';
        attrs.current = document.getElementById('money-value').value.trim();
        attrs.currency = document.getElementById('money-currency').value;
    } else if (type === 'count') {
        nodeType = 'countNode';
        attrs.label = document.getElementById('count-label').value.trim();
        attrs.max = parseInt(document.getElementById('count-max').value, 10) || 0;
        attrs.current = parseInt(document.getElementById('count-value').value, 10) || 0;
        attrs.isOverlay = document.getElementById('count-overlay').checked;
        attrs.icon = document.getElementById('count-icon').value.trim();
        attrs.theme = document.getElementById('count-theme').value || "number";
    } else if (type === 'container') {
        nodeType = 'containerShortcode';
        attrs.label = document.getElementById('container-label').value.trim();
        attrs.type = document.getElementById('container-type').value;
    }

    if (editingNodePos !== null) {
        mainEditor.chain().focus().insertContentAt(editingNodePos, { type: nodeType, attrs }).run();
    } else {
        mainEditor.chain().focus().insertContent({ type: nodeType, attrs }).run();
    }

    closeModal(document.getElementById('shortcode-generator-modal'));
}

function openShortcodeGeneratorModal() {
    const modal = document.getElementById('shortcode-generator-modal');
    if (modal) {
        // Reset form
        document.getElementById('shortcode-type').value = '';
        document.getElementById('stat-label').value = '';
        document.getElementById('stat-value').value = '';
        document.getElementById('hp-max').value = '';
        document.getElementById('hp-current').value = '';
        document.getElementById('count-label').value = '';
        document.getElementById('count-value').value = '';
        document.getElementById('count-max').value = '';
        document.getElementById('money-value').value = '';
        document.getElementById('money-currency').value = 'ouro';
        document.getElementById('nota-titulo').value = '';

        document.getElementById('count-icon').value = '';
        document.getElementById('count-theme').value = 'number';
        document.getElementById('count-overlay').checked = false;

        // Hide all form sections
        document.getElementById('shortcode-options-stat').classList.add('is-hidden');
        document.getElementById('shortcode-options-hp').classList.add('is-hidden');
        document.getElementById('shortcode-options-count').classList.add('is-hidden');
        document.getElementById('shortcode-options-money').classList.add('is-hidden');
        document.getElementById('shortcode-options-container').classList.add('is-hidden');

        openModal(modal);
    }
}

function updateShortcodeOptions() {
    const type = document.getElementById('shortcode-type').value;

    // Hide all sections
    document.getElementById('shortcode-options-stat').classList.add('is-hidden');
    document.getElementById('shortcode-options-hp').classList.add('is-hidden');
    document.getElementById('shortcode-options-count').classList.add('is-hidden');
    document.getElementById('shortcode-options-money').classList.add('is-hidden');
    document.getElementById('shortcode-options-nota').classList.add('is-hidden');

    // Show the selected type section
    switch (type) {
        case 'stat':
            document.getElementById('shortcode-options-stat').classList.remove('is-hidden');
            break;
        case 'hp':
            document.getElementById('shortcode-options-hp').classList.remove('is-hidden');
            break;
        case 'count':
            document.getElementById('shortcode-options-count').classList.remove('is-hidden');
            break;
        case 'money':
            document.getElementById('shortcode-options-money').classList.remove('is-hidden');
            break;
        case 'nota':
            document.getElementById('shortcode-options-nota').classList.remove('is-hidden');
            break;
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

    // Título discreto
    const title = document.createElement('p');
    title.className = 'is-size-7 has-text-centered has-text-grey mb-2';
    title.innerHTML = '<i class="fas fa-boxes"></i> ACESSÓRIOS E CONTEÚDOS';
    containerList.appendChild(title);

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
}

/**
 * Salva o conteúdo editado de um container de volta para o documento principal.
 */
function setupInteractiveSheetListeners() {
    const containers = [visualStatsContainer, visualCountsContainer];

    containers.forEach(container => {
        if (!container) return;

        container.onclick = (e) => {
            const interactive = e.target.closest('.is-interactive');
            if (!interactive) return;

            e.stopPropagation();

            // Lógica específica por tipo
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
            } else if (interactive.classList.contains('shortcode-stat') || interactive.classList.contains('shortcode-money')) {
                const display = interactive.querySelector('.stat-value-display, .money-value-display');
                const input = interactive.querySelector('input');
                if (display && input) {
                    display.classList.add('is-hidden');
                    input.classList.remove('is-hidden');
                    input.focus();
                    input.select();
                }
            }
        };

        container.onchange = async (e) => {
            const input = e.target;
            const interactive = input.closest('.is-interactive');
            if (!interactive || !interactive.dataset.shortcode) return;

            const oldShortcode = decodeURIComponent(interactive.dataset.shortcode);
            let newValue = input.value.trim();
            let newShortcode = "";

            if (interactive.classList.contains('shortcode-hp')) {
                const max = interactive.dataset.maxHp;
                newShortcode = `[hp max="${max}" current="${newValue}"]`;
            } else if (interactive.classList.contains('shortcode-stat')) {
                // Regex para pegar o rótulo do shortcode antigo e manter o novo valor
                const labelMatch = oldShortcode.match(/\[stat\s+"([^"]*)"/i);
                const label = labelMatch ? labelMatch[1] : "";
                newShortcode = `[stat "${label}" "${newValue}"]`;
            } else if (interactive.classList.contains('shortcode-money')) {
                const currencyMatch = oldShortcode.match(/\[money\s+current=".*?"\s*(.*?)\]/i);
                const currency = currencyMatch ? currencyMatch[1].trim() : "";
                newShortcode = `[money current="${newValue}" ${currency}]`.replace(/\s+\]/, ']');
            }

            if (newShortcode) {
                await updateFichaShortcode(oldShortcode, newShortcode);
            }
        };

        // Atalhos de teclado para inputs
        container.onkeydown = (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.target.blur();
            }
        };
    });
}

/**
 * Atualiza um shortcode específico dentro do bloco [ficha] e sincroniza tudo.
 */
async function updateFichaShortcode(oldSc, newSc) {
    if (!currentFichaBlock || !currentCharacterId) return;

    // Atualiza o bloco isolado
    currentFichaBlock = currentFichaBlock.replace(oldSc, newSc);

    // Recombina com a narrativa do mainEditor
    const narrativeShortcodes = convertEditorHtmlToShortcodes(mainEditor.getHTML());
    const fullContent = `${currentFichaBlock}\n\n${narrativeShortcodes}`;

    currentCharacter.conteudo = fullContent;
    await updateItem({ id: currentCharacterId }, { conteudo: fullContent });

    // Recarrega a visualização (sem re-parsear o editor principal se possível)
    loadCharacter(currentCharacterId);
}
async function saveContainerContent() {
    if (!currentCharacterId || !sideViewEditor) return;

    const modal = document.getElementById('content-editor-modal');
    const index = parseInt(modal.dataset.containerIndex, 10);
    const containers = shortcodeParser.extractContainers(currentCharacter.conteudo);

    if (containers[index]) {
        const newInnerContent = convertEditorHtmlToShortcodes(sideViewEditor.getHTML());
        const oldFullMatch = containers[index].fullMatch;

        const headerMatch = oldFullMatch.match(/\[container\s+[^\]]*\]/i)[0];
        const newFullShortcode = `${headerMatch}\n${newInnerContent}\n[/container]`;

        const newConteudo = currentCharacter.conteudo.replace(oldFullMatch, newFullShortcode);

        // Atualiza a ficha isolada se o container veio dela
        if (currentFichaBlock && currentFichaBlock.includes(oldFullMatch)) {
            currentFichaBlock = currentFichaBlock.replace(oldFullMatch, newFullShortcode);
        }

        await updateItem({ id: currentCharacterId }, { conteudo: newConteudo });
        currentCharacter.conteudo = newConteudo;

        if (mainEditor) {
            isProcessingUpdate = true;
            // Se mudou um container, precisamos regenerar a narrativa sem ficha
            const narrative = currentCharacter.conteudo.replace(/\[ficha\]([\s\S]*?)\[\/ficha\]/i, "").trim();
            mainEditor.commands.setContent(preParseShortcodesForEditor(narrative), false);
            isProcessingUpdate = false;
        }

        closeModal(modal);
    }
}

async function initializeFichaEditor() {
    fichaEditor = new Editor({
        element: document.querySelector("#ficha-tiptap-editor"),
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

    // Injetar toolbar no modal de ficha (reutilizando a existente na tela)
    const toolbarHTML = document.querySelector(".column-raw-editor .tiptap-toolbar").innerHTML;
    const fichaToolbar = document.querySelector("#ficha-tiptap-container .tiptap-toolbar");
    if (fichaToolbar) {
        fichaToolbar.innerHTML = toolbarHTML;
        fichaToolbar.onclick = (e) => {
            const btn = e.target.closest("button[data-action]");
            if (!btn) return;
            const action = btn.dataset.action;
            const chain = fichaEditor.chain().focus();
            if (action === "toggleBold") chain.toggleBold().run();
            // ... (adicionar outros se necessário, ou unificar função de toolbar)
        };
        // Unificar botões comuns
        fichaToolbar.querySelectorAll(".tiptap-button").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const action = btn.dataset.action;
                const val = btn.dataset.level || btn.dataset.align;
                const chain = fichaEditor.chain().focus();
                if (action === "undo") chain.undo().run();
                else if (action === "redo") chain.redo().run();
                else if (action === "toggleBold") chain.toggleBold().run();
                else if (action === "toggleItalic") chain.toggleItalic().run();
                else if (action === "toggleStrike") chain.toggleStrike().run();
                else if (action === "toggleHighlight") chain.toggleHighlight().run();
                else if (action === "toggleHeading") chain.toggleHeading({ level: parseInt(val) }).run();
                else if (action === "toggleBulletList") chain.toggleBulletList().run();
                else if (action === "toggleOrderedList") chain.toggleOrderedList().run();
                else if (action === "setTextAlign") chain.setTextAlign(val).run();
            });
        });
    }
}

function openSheetEditor() {
    if (!fichaEditor) return;

    // O conteúdo da ficha já está isolado em currentFichaBlock
    // Removemos os wrappers para editar apenas o interior
    let innerContent = currentFichaBlock.replace(/^\[ficha\]/i, "").replace(/\[\/ficha\]$/i, "").trim();

    fichaEditor.commands.setContent(preParseShortcodesForEditor(innerContent));
    openModal(document.getElementById("ficha-editor-modal"));
}

async function saveFichaEditorContent() {
    if (!currentCharacterId || !fichaEditor) return;

    const innerShortcodes = convertEditorHtmlToShortcodes(fichaEditor.getHTML());
    currentFichaBlock = `[ficha]\n${innerShortcodes}\n[/ficha]`;

    // Recombina com a narrativa do mainEditor
    const narrativeShortcodes = convertEditorHtmlToShortcodes(mainEditor.getHTML());
    const fullContent = `${currentFichaBlock}\n\n${narrativeShortcodes}`;

    currentCharacter.conteudo = fullContent;
    await updateItem({ id: currentCharacterId }, { conteudo: fullContent });

    // Atualiza a visualização técnica na ficha (esquerda)
    loadCharacter(currentCharacterId);

    closeModal(document.getElementById("ficha-editor-modal"));
}
