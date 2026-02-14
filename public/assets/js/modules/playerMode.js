import * as cardManager from './cardManager.js';
import * as shortcodeParser from './shortcodeParser.js';
import * as firebaseService from './firebaseService.js';
import { openModal, closeModal } from './modal.js';
import * as chat from './chat.js';
import * as auth from './auth.js';

let currentPlayerItem = null;
let tiptapEditor = null;
let cardsCache = [];
let noteUpdateTimeout = null;

// --- DOM Elements ---
const sheetModeView = document.getElementById('sheet-mode-view');
const mainContent = document.getElementById('main-content');
const mainFabContainer = document.querySelector('.fab-container');
const sheetFabContainer = document.getElementById('sheet-fab-container');
const charSelectionModal = document.getElementById('char-selection-modal');

// Top Bar Elements
const sheetBackBtn = document.getElementById('sheet-back-btn');
const sheetCharNameTop = document.getElementById('sheet-char-name-top');
const mainNavButtons = document.getElementById('main-nav-buttons');
const userArea = document.getElementById('user-area');
const topBarTitle = document.querySelector('.top-bar-title');


// --- Helper Functions ---
function getStorageKey(userName) {
    return `rpg_sheet_char_id_${userName || 'anon'}`;
}

function saveCurrentCharId(userName, charId) {
    if (!userName) return;
    localStorage.setItem(getStorageKey(userName), charId);
}

function getSavedCharId(userName) {
    return localStorage.getItem(getStorageKey(userName));
}

function clearSavedCharId(userName) {
    localStorage.removeItem(getStorageKey(userName));
}

// --- Core UI Logic ---

/**
 * Hides the main board and shows the character sheet mode.
 */
function showSheetMode() {
    mainContent.classList.add('is-hidden');
    mainFabContainer.classList.add('is-hidden');
    userArea.classList.add('is-hidden');
    mainNavButtons.classList.add('is-hidden');
    topBarTitle.classList.add('is-hidden');

    sheetModeView.classList.remove('is-hidden');
    sheetFabContainer.classList.remove('is-hidden');
    sheetBackBtn.classList.remove('is-hidden');
    sheetCharNameTop.classList.remove('is-hidden');
    
    document.body.classList.add('sheet-active');
}

/**
 * Hides the character sheet mode and shows the main board.
 */
function hideSheetMode() {
    sheetModeView.classList.add('is-hidden');
    sheetFabContainer.classList.add('is-hidden');
    sheetBackBtn.classList.add('is-hidden');
    sheetCharNameTop.classList.add('is-hidden');

    mainContent.classList.remove('is-hidden');
    mainFabContainer.classList.remove('is-hidden');
    userArea.classList.remove('is-hidden');
    mainNavButtons.classList.remove('is-hidden');
    topBarTitle.classList.remove('is-hidden');

    document.body.classList.remove('sheet-active');
}

/**
 * Renders the data from a character item into the sheet UI.
 * @param {object} item The character card item.
 */
function renderSheetFor(item) {
    if (!item) return;
    currentPlayerItem = item;

    // --- Get all UI element references ---
    const avatarEl = document.getElementById('sheet-avatar');
    const charTitleEl = document.getElementById('sheet-char-title');
    const contentWrapperEl = document.getElementById('sheet-content-wrapper');
    const playerNotesEditorEl = document.getElementById('sheet-notes-editor');

    // 1. Update Header and basic info
    sheetCharNameTop.querySelector('.title').textContent = item.titulo;
    avatarEl.style.backgroundImage = item.url ? `url('${item.url}')` : 'none';
    charTitleEl.textContent = item.titulo;

    // 2. Parse all shortcodes
    const parsed = shortcodeParser.parseAllShortcodes(item);
    const cardNotesHTML = shortcodeParser.parseNotas(item.conteudo);

    // 3. Assemble the content in a stacked, grid-like format
    let stackedContent = '';
    
    // Top-aligned content (left and right)
    if (parsed.left || parsed.right) {
        stackedContent += `<div class="card-actions-top">
            <div class="card-actions-top-left">${parsed.left}</div>
            <div class="card-actions-top-right">${parsed.right}</div>
        </div>`;
    }
    
    // Bottom-aligned content (like HP)
    if (parsed.bottom) {
        stackedContent += `<div class="card-actions-bottom">
            <div class="card-actions-bottom-center">${parsed.bottom}</div>
        </div>`;
    }

    // Append details and card notes
    if (parsed.details) {
        stackedContent += `<div class="content">${parsed.details}</div>`;
    }
    if (cardNotesHTML) {
        stackedContent += `<div class="content">${cardNotesHTML}</div>`;
    }

    contentWrapperEl.innerHTML = stackedContent;

    // 4. Populate Player's personal notes (Tiptap)
    initializeTiptap(playerNotesEditorEl, item);

    // 5. Show the UI
    showSheetMode();
}


/**
 * Opens the character selection modal, populated with PJ cards.
 */
function displayCharSelection() {
    const pjCards = cardsCache.filter(c => c.tags && c.tags.some(tag => tag.toLowerCase() === 'pj'));
    const modalBody = document.getElementById('char-selection-modal-body');

    if (!pjCards.length) {
        modalBody.innerHTML = '<p>Nenhum personagem com a tag "pj" foi encontrado. Peça para o narrador configurar.</p>';
        openModal(charSelectionModal);
        return;
    }

    const list = document.createElement('div');
    list.className = 'buttons';
    pjCards.forEach(pj => {
        const btn = document.createElement('button');
        btn.className = 'button is-fullwidth';
        btn.textContent = pj.titulo;
        btn.onclick = () => {
            const userName = auth.getCurrentUserName();
            saveCurrentCharId(userName, pj.id);
            renderSheetFor(pj);
            closeModal(charSelectionModal);
        };
        list.appendChild(btn);
    });

    modalBody.innerHTML = '';
    modalBody.appendChild(list);
    openModal(charSelectionModal);
}

// --- Tiptap Integration ---

async function initializeTiptap(element, item) {
    if (tiptapEditor) {
        tiptapEditor.off('update');
        tiptapEditor.commands.setContent(item.playerNotes || '');
        tiptapEditor.on('update', handleNoteUpdate);
        return;
    }

    try {
        const { Editor } = await import('https://esm.sh/@tiptap/core@2.2.4');
        const StarterKit = (await import('https://esm.sh/@tiptap/starter-kit@2.2.4')).default;

        tiptapEditor = new Editor({
            element,
            extensions: [StarterKit],
            content: item.playerNotes || '',
            onUpdate: handleNoteUpdate
        });
    } catch (error) {
        console.error("Failed to load Tiptap editor, falling back to textarea.", error);
        element.innerHTML = `<textarea class="textarea" placeholder="Suas anotações..." style="height: 100%;">${item.playerNotes || ''}</textarea>`;
        const fallback = element.querySelector('textarea');
        fallback.addEventListener('input', () => handleNoteUpdate({ editor: { getHTML: () => fallback.value } }));
    }
}

function handleNoteUpdate({ editor }) {
    if (noteUpdateTimeout) clearTimeout(noteUpdateTimeout);
    noteUpdateTimeout = setTimeout(() => {
        if (!currentPlayerItem) return;
        const newNotes = editor.getHTML();
        if (newNotes === currentPlayerItem.playerNotes) return;

        firebaseService.updateItem(currentPlayerItem, { playerNotes: newNotes })
            .catch(err => console.error("Failed to save player notes:", err));
    }, 1000);
}


// --- Event Handlers & Initialization ---

function onCardsUpdate(newItems) {
    cardsCache = newItems;
    if (currentPlayerItem && !sheetModeView.classList.contains('is-hidden')) {
        const updatedItem = newItems.find(c => c.id === currentPlayerItem.id);
        if (updatedItem) {
            // Re-render if the core content has changed
             if (JSON.stringify(updatedItem) !== JSON.stringify(currentPlayerItem)) {
                 renderSheetFor(updatedItem);
             }
        } else {
            hideSheetMode();
            currentPlayerItem = null;
        }
    }
}

export function openFicha() {
    const userName = auth.getCurrentUserName();
    if (!userName || userName === 'Visitante') {
        alert("Você precisa se identificar para ver sua ficha. Por favor, defina um nome de usuário.");
        document.getElementById('user-login-btn').click();
        return;
    }

    const savedId = getSavedCharId(userName);
    if (savedId) {
        const item = cardsCache.find(c => c.id === savedId);
        if (item) {
            renderSheetFor(item);
            return;
        }
    }

    displayCharSelection();
}

export function initialize() {
    cardManager.subscribe(onCardsUpdate);
    cardsCache = cardManager.getItems();

    sheetBackBtn.addEventListener('click', hideSheetMode);

    // FAB listeners
    document.getElementById('sheet-fab-chat').addEventListener('click', () => chat.toggleChat());
    document.getElementById('sheet-fab-change-char').addEventListener('click', () => {
        const userName = auth.getCurrentUserName();
        clearSavedCharId(userName);
        displayCharSelection();
    });
    document.getElementById('sheet-fab-help').addEventListener('click', () => openModal(document.getElementById('help-modal')));
    
    // Dice bar and chat input listeners
    const diceBar = document.querySelector('.sheet-dice-controls');
    diceBar.addEventListener('click', (e) => {
        const button = e.target.closest('.dice-button');
        if (button && button.dataset.dice) {
            const diceType = button.dataset.dice;
            const sides = parseInt(diceType.slice(1), 10);
            const result = Math.floor(Math.random() * sides) + 1;
            const userName = auth.getCurrentUserName();
            firebaseService.sendDiceRoll(userName, diceType, result);
        }
    });

    const quickChatInput = document.getElementById('sheet-chat-quick-input');
    quickChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const message = quickChatInput.value.trim();
            if (message) {
                chat.sendMessage(message);
                quickChatInput.value = '';
            }
        }
    });
}

export function getCurrentPlayerId() {
    return currentPlayerItem ? currentPlayerItem.id : null;
}