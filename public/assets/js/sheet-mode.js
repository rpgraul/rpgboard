import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";

import { listenToItems, updateItem, listenToDiceRolls, addChatMessage } from './modules/firebaseService.js';
import { initializeAuth, getCurrentUserName } from './modules/auth.js';
import { initializeLayout } from './modules/layout.js'; // Importação do Orquestrador
import { uploadImage } from './imgbbService.js';
import { openModal, closeModal, initializeModals } from './modules/modal.js';
import * as shortcodeParser from './modules/shortcodeParser.js';
import * as chat from './modules/chat.js';
import { visualizeDiceRoll } from './modules/dice3d.js';
import { processRoll } from './modules/diceLogic.js';

let allItems = [];
let currentCharacterId = null;
let currentCharacter = null;
let autoSaveTimeout = null;
let contentEditor = null;
let contentEditorSaveTimeout = null;

// Referências de elementos que serão preenchidos após o layout carregar
let imgEl, nameEl, visualStatsContainer, visualCountsContainer, rawContentEditor, notesEditor;

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

    if (layout.fabChangeChar) {
        layout.fabChangeChar.addEventListener('click', openCharSelection);
    }

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
    rawContentEditor = document.getElementById('raw-content-editor');
    notesEditor = document.getElementById('player-notes-editor');


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
                        <button id="edit-content-btn" class="button is-small is-light" data-tooltip="Editar Conteúdo">
                            <span class="icon is-small"><i class="fas fa-pen"></i></span>
                        </button>
                    </div>
                    <div id="visual-stats-container" class="content mt-4"></div>
                    <div id="visual-counts-container" class="content mt-4"></div>
                </div>
            </div>
            <div class="sheet-column column-raw-editor">
                <div class="box is-full-height">
                    <h3 class="title is-6"><i class="fas fa-align-left"></i> Descrição</h3>
                    <div id="desc-tiptap-wrapper" class="tiptap-editor-wrapper" style="flex: 1; display: flex; flex-direction: column;">
                        <div role="toolbar" aria-label="toolbar" class="tiptap-toolbar">
                            <!-- Toolbar será preenchida pelo JS -->
                        </div>
                        <div id="desc-editor" class="tiptap-editor-content" style="flex: 1; overflow-y: auto;"></div>
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
    }

    if (rawContentEditor && document.activeElement !== rawContentEditor) rawContentEditor.value = htmlToRaw(char.conteudo || '');

    if (notesEditor && document.activeElement !== notesEditor) notesEditor.value = char.playerNotes || '';
}

function htmlToRaw(html) {
    if (!html) return "";
    let t = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<p>/gi, '').replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, '');
    const e = document.createElement("textarea");
    e.innerHTML = t;
    return e.value.trim();
}

function setupSheetSpecificListeners() {
    if (rawContentEditor) rawContentEditor.addEventListener('input', (e) => handleAutoSave('conteudo', e.target.value, true));
    if (notesEditor) notesEditor.addEventListener('input', (e) => handleAutoSave('playerNotes', e.target.value, false));

    // Listener para upload de imagem do personagem
    const imgUploadInput = document.getElementById('char-image-upload');
    if (imgUploadInput) {
        imgUploadInput.addEventListener('change', handleCharImageUpload);
    }

    // Listener para botão de editar conteúdo
    const editContentBtn = document.getElementById('edit-content-btn');
    if (editContentBtn) {
        editContentBtn.addEventListener('click', openContentEditorModal);
    }

    // Listeners para modal de conteúdo
    const contentEditorModal = document.getElementById('content-editor-modal');
    if (contentEditorModal) {
        const closeBtn = contentEditorModal.querySelector('.modal-background');
        const deleteBtn = contentEditorModal.querySelector('.delete');
        const cancelBtn = contentEditorModal.querySelector('.modal-cancel');
        const saveBtn = document.getElementById('save-content-btn');

        closeBtn.addEventListener('click', () => closeModal(contentEditorModal));
        deleteBtn.addEventListener('click', () => closeModal(contentEditorModal));
        cancelBtn.addEventListener('click', () => closeModal(contentEditorModal));
        saveBtn.addEventListener('click', () => {
            if (contentEditorModal.dataset.mode === 'container') {
                saveContainerContent();
            } else {
                saveContentEditor();
            }
        });
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

function handleAutoSave(field, value, isRaw = false) {
    if (!currentCharacterId) return;
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        const updateData = {};
        updateData[field] = isRaw ? value.replace(/\n/g, '<br>') : value;
        updateItem({ id: currentCharacterId }, updateData).catch(console.error);
    }, 1000);
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

function openContentEditorModal() {
    if (!currentCharacter) return;

    // Se o editor não existe, criar
    if (!contentEditor) {
        initializeContentEditor();
    }

    // Carregar conteúdo no editor
    if (contentEditor) {
        contentEditor.commands.setContent(currentCharacter.conteudo || '');
    }

    // Abrir modal
    const modal = document.getElementById('content-editor-modal');
    openModal(modal);
}

function initializeContentEditor() {
    try {
        const element = document.querySelector('#content-editor');
        if (!element) {
            console.warn('Elemento #content-editor não encontrado');
            return;
        }

        contentEditor = new Editor({
            element: element,
            extensions: [
                StarterKit,
                Highlight,
                Underline,
                Link.configure({ openOnClick: false }),
                TextAlign.configure({ types: ['heading', 'paragraph'] }),
            ],
            editorProps: {
                attributes: { class: 'ProseMirror' },
            },
            onUpdate: () => {
                clearTimeout(contentEditorSaveTimeout);
                // Não precisamos salvar automaticamente aqui, apenas ao clicar em Salvar
            }
        });

        // Vincular toolbar ao editor
        setupContentToolbar(contentEditor);
        console.log('Editor de conteúdo inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar editor de conteúdo:', error);
    }
}

function setupContentToolbar(editor) {
    if (!editor) return;
    const toolbar = document.querySelector('#content-tiptap-wrapper .tiptap-toolbar');
    if (!toolbar) return;

    toolbar.querySelectorAll('.tiptap-button').forEach(btn => {
        const action = btn.dataset.action;
        if (!action) return;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const level = btn.dataset.level ? parseInt(btn.dataset.level) : undefined;
            const align = btn.dataset.align;

            switch (action) {
                case 'undo':
                    editor.commands.undo();
                    break;
                case 'redo':
                    editor.commands.redo();
                    break;
                case 'toggleHeading':
                    editor.commands.toggleHeading({ level });
                    break;
                case 'toggleBulletList':
                    editor.commands.toggleBulletList();
                    break;
                case 'toggleOrderedList':
                    editor.commands.toggleOrderedList();
                    break;
                case 'toggleBold':
                    editor.commands.toggleBold();
                    break;
                case 'toggleItalic':
                    editor.commands.toggleItalic();
                    break;
                case 'toggleStrike':
                    editor.commands.toggleStrike();
                    break;
                case 'toggleHighlight':
                    editor.commands.toggleHighlight();
                    break;
                case 'setTextAlign':
                    editor.commands.setTextAlign(align);
                    break;
                case 'setLink':
                    const url = prompt('URL:');
                    if (url) {
                        editor.commands.setLink({ href: url });
                    }
                    break;
            }
        });
    });

    // Atualizar estado dos botões
    editor.on('update', () => updateContentToolbarButtonStates(editor));
    updateContentToolbarButtonStates(editor);
}

function updateContentToolbarButtonStates(editor) {
    const toolbar = document.querySelector('#content-tiptap-wrapper .tiptap-toolbar');
    if (!toolbar) return;

    toolbar.querySelectorAll('.tiptap-button').forEach(btn => {
        const action = btn.dataset.action;
        const level = btn.dataset.level ? parseInt(btn.dataset.level) : undefined;
        const align = btn.dataset.align;

        let isActive = false;
        switch (action) {
            case 'toggleHeading':
                isActive = editor.isActive('heading', { level });
                break;
            case 'toggleBulletList':
                isActive = editor.isActive('bulletList');
                break;
            case 'toggleOrderedList':
                isActive = editor.isActive('orderedList');
                break;
            case 'toggleBold':
                isActive = editor.isActive('bold');
                break;
            case 'toggleItalic':
                isActive = editor.isActive('italic');
                break;
            case 'toggleStrike':
                isActive = editor.isActive('strike');
                break;
            case 'toggleHighlight':
                isActive = editor.isActive('highlight');
                break;
            case 'setTextAlign':
                isActive = editor.isActive({ textAlign: align });
                break;
        }

        btn.classList.toggle('is-active', isActive);
    });
}

function saveContentEditor() {
    if (!currentCharacterId || !contentEditor) return;
    const html = contentEditor.getHTML();

    handleAutoSave('conteudo', html, false);

    closeModal(document.getElementById('content-editor-modal'));
}

function insertShortcodeInContent() {
    if (!contentEditor) return;

    // Prompt simples para o usuário escolher o tipo de shortcode
    const types = ['stat', 'hp', 'money', 'count'];
    let type = prompt(`Selecione o tipo de shortcode:\n\n${types.join(', ')}`);

    if (!type || !types.includes(type.toLowerCase())) {
        alert('Tipo de shortcode inválido');
        return;
    }

    type = type.toLowerCase();

    // Exemplos de shortcodes
    const examples = {
        'stat': '[stat "atributo" "valor"]',
        'hp': '[hp "valor_atual" "valor_máximo"]',
        'money': '[money "quantidade" "moeda"]',
        'count': '[count "nome" "valor"]'
    };

    const shortcode = examples[type];
    if (shortcode) {
        contentEditor.chain().focus().insertContent(shortcode).run();
    }
}

if (isContentModalOpen && contentEditor) {
    // Usar o editor de conteúdo
    insertShortcodeInContent();
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

        // Hide all form sections
        document.getElementById('shortcode-options-stat').classList.add('is-hidden');
        document.getElementById('shortcode-options-hp').classList.add('is-hidden');
        document.getElementById('shortcode-options-count').classList.add('is-hidden');
        document.getElementById('shortcode-options-money').classList.add('is-hidden');
        document.getElementById('shortcode-options-nota').classList.add('is-hidden');

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

    if (!contentEditor) {
        initializeContentEditor();
    }

    if (contentEditor) {
        contentEditor.commands.setContent(container.content || '');
    }

    openModal(modal);
}

/**
 * Salva o conteúdo editado de volta para o shortcode do container.
 */
async function saveContainerContent() {
    if (!currentCharacterId || !contentEditor) return;

    const modal = document.getElementById('content-editor-modal');
    const index = parseInt(modal.dataset.containerIndex, 10);
    const containers = shortcodeParser.extractContainers(currentCharacter.conteudo);

    if (containers[index]) {
        const newInnerContent = contentEditor.getHTML();
        const oldFullMatch = containers[index].fullMatch;

        // Reconstrói o shortcode preservando as flags/tokens originais (# e close)
        const headerMatch = oldFullMatch.match(/\[container\s+[^\]]*\]/i)[0];
        const newFullShortcode = `${headerMatch}\n${newInnerContent}\n[/container]`;

        // Substituição granular no conteúdo total
        const newConteudo = currentCharacter.conteudo.replace(oldFullMatch, newFullShortcode);

        await updateItem({ id: currentCharacterId }, { conteudo: newConteudo });

        // Atualiza o estado local para evitar inconsistências se salvar de novo sem recarregar
        currentCharacter.conteudo = newConteudo;

        closeModal(modal);
    }
}

function insertShortcodeFromModal() {
    const type = document.getElementById('shortcode-type').value;
    if (!type) {
        alert('Selecione um tipo de shortcode');
        return;
    }

    let shortcode = '';

    switch (type) {
        case 'stat':
            const statLabel = document.getElementById('stat-label').value || 'atributo';
            const statValue = document.getElementById('stat-value').value || '0';
            shortcode = `[stat "${statLabel}" "${statValue}"]`;
            break;
        case 'hp':
            const hpMax = document.getElementById('hp-max').value || '100';
            const hpCurrent = document.getElementById('hp-current').value || '100';
            shortcode = `[hp max="${hpMax}" current="${hpCurrent}"]`;
            break;
        case 'count':
            const countLabel = document.getElementById('count-label').value || 'contador';
            const countValue = document.getElementById('count-value').value || '0';
            const countMax = document.getElementById('count-max').value || '10';
            shortcode = `[count "${countLabel}" "${countValue}" max="${countMax}"]`;
            break;
        case 'money':
            const moneyValue = document.getElementById('money-value').value || '0';
            const moneyCurrency = document.getElementById('money-currency').value || 'ouro';
            shortcode = `[money "${moneyValue}" "${moneyCurrency}"]`;
            break;
        case 'nota':
            const notaTitulo = document.getElementById('nota-titulo').value || 'nota';
            shortcode = `[nota "${notaTitulo}"]`;
            break;
    }

    if (!shortcode) return;

    if (isContentModalOpen && contentEditor) {
        // Insert into content editor
        contentEditor.chain().focus().insertContent(shortcode).run();
    }

    // Close modal
    closeModal(document.getElementById('shortcode-generator-modal'));
}