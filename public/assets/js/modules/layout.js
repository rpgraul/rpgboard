/**
 * Layout Orchestrator Module
 * 
 * Centralizes the initialization of the unified UI layout across all application pages.
 * Returns references to all major UI elements for other modules to bind logic.
 */

import { renderHeader } from "./components/header.js";
import { renderOverlays } from "./components/commonHTML.js";
import { renderFab } from "./components/fab.js";
import { openModal } from './modal.js';

/**
 * Initializes the complete layout structure for a GameBoard page.
 * 
 * @param {Object} [config={}] - Configuration object
 * @param {string[]} [config.fabActions=[]] - FAB button keys to render
 * @returns {Promise<Object>} Object containing references to all major UI elements.
 */
let _layoutInitialized = false;
let _layoutReferences = null;

export async function initializeLayout() {
  // Guard: se o shell já inicializou o layout, retorna as referências sem re-renderizar.
  // Isso garante que o iframe do YouTube nunca seja destruído durante a navegação.
  if (_layoutInitialized && _layoutReferences) {
    console.log('[Layout] Already initialized (shell context). Returning cached references.');
    return _layoutReferences;
  }

  console.log('[Layout] Initializing layout rendering...');

  // Step 1: Render overlays (Chat, Modals, Dice Container)
  const overlaysContainer = renderOverlays();
  if (!overlaysContainer) {
    throw new Error('Layout failed: overlays not rendered');
  }

  // Step 2: Render header
  const headerElement = renderHeader();
  if (!headerElement) {
    throw new Error('Layout failed: header not rendered');
  }

  // Step 3: Render FAB (pass current path for soft navigation support)
  const fabElement = renderFab(window.location.pathname);
  if (!fabElement) {
    throw new Error('Layout failed: FAB not rendered');
  }

  // Small delay for DOM updates
  await new Promise(resolve => setTimeout(resolve, 0));

  // Collect references
  const layoutReferences = {
    header: headerElement,
    fab: fabElement,
    overlays: overlaysContainer,

    // Chat
    chatSidebar: document.getElementById('chat-sidebar'),
    chatInputArea: document.getElementById('chat-input-area'),
    chatInput: document.getElementById('chat-input'),
    chatMessages: document.getElementById('chat-messages'),
    toggleChatBtn: document.getElementById('toggle-chat-btn'),
    closeChatBtn: document.getElementById('close-chat-btn'),

    // Help
    helpModal: document.getElementById('help-modal'),
    fabHelp: document.getElementById('fab-help'),

    // Auth AREA
    userLoginBtn: document.getElementById('nav-login'),
    userNameTag: document.getElementById('user-name'),
    userArea: document.getElementById('user-area'),
    userLoginModal: document.getElementById('user-login-modal'),
    narratorModal: document.getElementById('narrator-modal'),

    // Dice
    diceContainer: document.getElementById('dice-container'),
    diceMainBtn: document.getElementById('dice-main-btn'),
    diceFabWrapper: document.getElementById('dice-fab-wrapper')
  };

  // Setup layout-ONLY events (mostly navigations/modals tied to layout buttons)
  layoutReferences.fabHelp?.addEventListener('click', () => {
    openModal(layoutReferences.helpModal);
  });

  const fabSettingsBtn = document.getElementById('fab-settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  if (fabSettingsBtn && settingsModal) {
    fabSettingsBtn.addEventListener('click', () => openModal(settingsModal));
  }

  const fabBulkEditBtn = document.getElementById('fab-bulk-edit-btn');
  const bulkEditModal = document.getElementById('bulk-edit-modal');
  if (fabBulkEditBtn && bulkEditModal) {
    fabBulkEditBtn.addEventListener('click', () => openModal(bulkEditModal));
  }

  console.log('[Layout] Available references:', Object.keys(layoutReferences));

  _layoutInitialized = true;
  _layoutReferences = layoutReferences;

  return layoutReferences;
}



export default { initializeLayout };