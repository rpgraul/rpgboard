/**
 * Layout Orchestrator Module
 * 
 * Centralizes the initialization of the unified UI layout across all application pages.
 * Coordinates rendering of:
 * - Header (navigation, user info)
 * - FAB (floating action buttons)
 * - Overlays (chat sidebar, modals, dice 3D container)
 * 
 * This module ensures consistent structure and provides references to all major UI elements
 * for event binding and interaction.
 * 
 * @example
 * import { initializeLayout } from './modules/layout.js';
 * const layout = await initializeLayout({
 *   fabActions: ['help', 'chat', 'change-char', 'macros']
 * });
 * 
 * // Now you can attach event listeners:
 * layout.toggleChatBtn?.addEventListener('click', () => chat.toggleChat());
 * layout.fabHelp?.addEventListener('click', () => openModal(layout.helpModal));
 */

import { renderHeader } from "./components/header.js";
import { renderOverlays } from "./components/commonHTML.js";
import { renderFab } from "./components/fab.js";
import { toggleChat } from './chat.js';
import { processRoll } from './diceLogic.js';
import { getCurrentUserName } from './auth.js';
import { openModal } from './modal.js';
import { addChatMessage, listenToDiceRolls } from './firebaseService.js';
import { visualizeDiceRoll } from './dice3d.js';

/**
 * Initializes the complete layout structure for a GameBoard page.
 * 
 * This function coordinates the rendering of all global UI components:
 * 1. Injects overlays (chat, modals, dice container) into the DOM
 * 2. Renders the header with navigation (fixed 'GameBoard' title)
 * 3. Renders the FAB with requested buttons
 * 4. Returns references to all major UI elements for event binding
 * 
 * @param {Object} [config={}] - Configuration object
 * @param {string[]} [config.fabActions=[]] - Array of FAB button keys to render
 *   Example valid keys: 'help', 'chat', 'dice', 'add-card', 'settings', 'bulk-edit',
 *   'converter', 'macros', 'change-char', 'toggle-view', 'text-mode', 'drawing-mode', 'sheet-mode'
 * 
 * @returns {Promise<Object>} Object containing references to all major UI elements:
 *   - header: Header container element
 *   - fab: FAB container element
 *   - overlays: Overlays container element
 *   - chatSidebar: Chat sidebar element (#chat-sidebar)
 *   - chatInputArea: Chat input form element (#chat-input-area)
 *   - chatInput: Chat text input element (#chat-input)
 *   - chatMessages: Chat messages container (#chat-messages)
 *   - toggleChatBtn: Chat toggle button (#toggle-chat-btn)
 *   - closeChatBtn: Chat close button (#close-chat-btn)
 *   - helpModal: Help modal element (#help-modal)
 *   - fabHelp: Help button in FAB (#fab-help)
 *   - userLoginBtn: User login button (#user-login-btn)
 *   - userLoginModal: Login modal (#user-login-modal) - to be populated by auth
 *   - narratorLoginBtn: Narrator toggle button (#narrator-login-btn)
 *   - narratorModal: Narrator modal (#narrator-modal) - to be populated by auth
 *   - diceContainer: 3D dice container (#dice-container)
 *   - diceMainBtn: Main dice button (#dice-main-btn)
 * 
 * @throws {Error} If critical containers (#app-header, #app-fab) are not found
 * 
 * @example
 * // Basic usage with default settings
 * const layout = await initializeLayout();
 * 
 * @example
 * // Usage with custom buttons
 * const layout = await initializeLayout({
 *   fabActions: ['help', 'macros', 'change-char', 'chat']
 * });
 * 
 * @example
 * // Attaching event listeners after initialization
 * const layout = await initializeLayout({
 *   fabActions: ['help', 'chat', 'add-card', 'dice', 'bulk-edit']
 * });
 * 
 * // Chat toggle
 * layout.toggleChatBtn?.addEventListener('click', (e) => {
 *   e.stopPropagation();
 *   chatModule.toggleChat();
 * });
 * 
 * // Close chat
 * layout.closeChatBtn?.addEventListener('click', () => {
 *   layout.chatSidebar?.classList.add('is-hidden');
 * });
 * 
 * // Help modal
 * layout.fabHelp?.addEventListener('click', () => {
 *   modalModule.openModal(layout.helpModal);
 * });
 */
export async function initializeLayout(config = {}) {
  const {
    fabActions = []
  } = config;

  console.log('[Layout] Initializing modular layout system...');
  console.log(`[Layout] FAB Actions: [${fabActions.join(', ')}]`);

  // Verify required containers exist or will be created
  const headerContainer = document.getElementById('app-header');
  const fabContainer = document.getElementById('app-fab');

  if (!headerContainer) {
    console.error('[Layout] Missing required element: #app-header');
    throw new Error('Layout initialization failed: #app-header not found in DOM');
  }
  if (!fabContainer && fabActions.length > 0) {
    console.warn('[Layout] #app-fab not found, will be created by renderFab()');
  }

  // Step 1: Render overlays (Chat, Modals, Dice Container)
  // Must be done first so auth.js and other modules can find their elements
  console.log('[Layout] Step 1: Rendering overlays...');
  const overlaysContainer = renderOverlays();
  if (!overlaysContainer) {
    console.error('[Layout] Failed to render overlays');
    throw new Error('Layout initialization failed: renderOverlays() returned null');
  }

  // Step 2: Render header (Navigation, User Area)
  console.log('[Layout] Step 2: Rendering header...');
  const headerElement = renderHeader();
  if (!headerElement) {
    console.error('[Layout] Failed to render header');
    throw new Error('Layout initialization failed: renderHeader() returned null');
  }

  // Step 3: Render FAB (Floating Action Buttons)
  console.log('[Layout] Step 3: Rendering FAB...');
  const fabElement = renderFab(fabActions);
  if (!fabElement) {
    console.error('[Layout] Failed to render FAB');
    throw new Error('Layout initialization failed: renderFab() returned null');
  }

  // Small delay to ensure DOM is fully updated before querying elements
  await new Promise(resolve => setTimeout(resolve, 0));

  console.log('[Layout] Step 4: Gathering element references...');

  // Collect all references for external use
  const layoutReferences = {
    // Core containers
    header: headerElement,
    fab: fabElement,
    overlays: overlaysContainer,

    // Chat elements
    chatSidebar: document.getElementById('chat-sidebar'),
    chatInputArea: document.getElementById('chat-input-area'),
    chatInput: document.getElementById('chat-input'),
    chatMessages: document.getElementById('chat-messages'),
    toggleChatBtn: document.getElementById('toggle-chat-btn'),
    closeChatBtn: document.getElementById('close-chat-btn'),

    // Help modal
    helpModal: document.getElementById('help-modal'),
    fabHelp: document.getElementById('fab-help'),

    // User authentication
    userLoginBtn: document.getElementById('nav-login'),
    userNameTag: document.getElementById('user-name'),
    userArea: document.getElementById('user-area'),
    userLoginModal: document.getElementById('user-login-modal'),

    // Narrator mode
    narratorModal: document.getElementById('narrator-modal'),

    // Dice system
    diceContainer: document.getElementById('dice-container'),
    diceMainBtn: document.getElementById('dice-main-btn'),
    diceFabWrapper: document.getElementById('dice-fab-wrapper')
  };

  // Step 5: Setup global event listeners
  console.log('[Layout] Step 5: Setting up global event listeners...');

  // Chat:
  layoutReferences.toggleChatBtn?.addEventListener('click', toggleChat);

  // Dice:
  layoutReferences.diceMainBtn?.addEventListener('click', () => {
    layoutReferences.diceFabWrapper?.classList.toggle('is-active');
  });

  document.querySelectorAll('.dice-quick-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
      const dType = e.currentTarget.dataset.dice;
      const userName = getCurrentUserName();
      const command = `/r 1${dType}`;

      await addChatMessage(command, 'user', userName);
      processRoll(command, null, userName);
      // Close the dice fab wrapper after a quick roll
      layoutReferences.diceFabWrapper?.classList.remove('is-active');
    });
  });

  // Help:
  layoutReferences.fabHelp?.addEventListener('click', () => {
    openModal(layoutReferences.helpModal);
  });

  // Settings & Bulk Edit (if buttons exist and modals are present in layoutReferences)
  const fabSettingsBtn = document.getElementById('fab-settings-btn');
  const settingsModal = document.getElementById('settings-modal'); // Assuming this ID
  if (fabSettingsBtn && settingsModal) {
    fabSettingsBtn.addEventListener('click', () => openModal(settingsModal));
  }

  const fabBulkEditBtn = document.getElementById('fab-bulk-edit-btn');
  const bulkEditModal = document.getElementById('bulk-edit-modal'); // Assuming this ID
  if (fabBulkEditBtn && bulkEditModal) {
    fabBulkEditBtn.addEventListener('click', () => openModal(bulkEditModal));
  }

  // Validate critical elements
  const criticalElements = [
    'chatSidebar',
    'chatInput',
    'helpModal'
  ];

  const missingElements = criticalElements.filter(key => !layoutReferences[key]);
  if (missingElements.length > 0) {
    console.warn(`[Layout] Missing optional elements: ${missingElements.join(', ')}`);
  }

  // Step 6: Initialize global dice listener
  console.log('[Layout] Step 6: Initializing global dice listener...');
  listenToDiceRolls((change) => {
    const d = change.doc.data();
    if (d) {
      let t = (d.diceType || '').toString().toLowerCase().trim().replace(/^\d+/, '');
      visualizeDiceRoll(t, d.result, d.userName, d.label);
    }
  });

  console.log('[Layout] Layout initialization complete!');
  console.log('[Layout] Available references:', Object.keys(layoutReferences));

  return layoutReferences;
}
// Adiciona CSS customizado do header se ainda não estiver presente
if (!document.getElementById('header-menu-css')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/css/header-menu.css';
  link.id = 'header-menu-css';
  document.head.appendChild(link);
}

// Adiciona CSS de dados se ainda não estiver presente
if (!document.getElementById('rpg-dice-css')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/css/rpg-dice.css';
  link.id = 'rpg-dice-css';
  document.head.appendChild(link);
}

export default { initializeLayout };