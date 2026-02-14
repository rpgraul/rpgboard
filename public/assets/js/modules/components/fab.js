/**
 * FAB Module - Floating Action Button System
 * 
 * Manages all floating action buttons in the application.
 * Buttons are rendered dynamically based on an array of active button keys.
 * 
 * @example
 * import { renderFab } from './components/fab.js';
 * const fabContainer = renderFab(['help', 'chat', 'add-card']);
 */

/**
 * Dictionary of all available FAB buttons in the system.
 * Each key corresponds to a unique button identifier.
 * Each value contains the HTML template for that button.
 */
const FAB_BUTTONS = {
  /**
   * Settings Button - Opens site configuration modal
   * @key settings
   * @class narrator-only (hidden for players)
   */
  'settings': `
    <button id="fab-settings" class="button is-dark is-rounded fab-button narrator-only is-hidden" title="Configurações">
      <span class="icon"><i class="fas fa-cog"></i></span>
    </button>`,

  /**
   * Bulk Edit Button - Enables multiple item visibility toggle mode
   * @key bulk-edit
   * @class narrator-only (hidden for players)
   */
  'bulk-edit': `
    <button id="fab-bulk-edit" class="button is-info is-rounded fab-button narrator-only is-hidden" title="Edição em Massa">
      <span class="icon"><i class="fas fa-tasks"></i></span>
    </button>`,

  /**
   * Mass Import Button - Links to AI/Text converter
   * @key converter
   * @url converter.html
   */
  'converter': `
    <a href="converter.html" class="button is-warning is-rounded fab-button" title="Adicionar em Massa">
      <span class="icon"><i class="fas fa-layer-group"></i></span>
    </a>`,

  /**
   * Help Button - Opens help modal with shortcode guide
   * @key help
   */
  'help': `
    <button id="fab-help" class="button is-primary is-rounded fab-button" title="Ajuda">
      <span class="icon"><i class="fas fa-question-circle"></i></span>
    </button>`,

  /**
   * Chat Toggle Button - Opens/closes chat sidebar
   * @key chat
   */
  'chat': `
    <button id="toggle-chat-btn" class="button is-info is-rounded fab-button" title="Chat">
      <span class="icon"><i class="fas fa-comments"></i></span>
    </button>`,

  /**
   * Dice Roller Button - Expandable button with quick dice selection
   * @key dice
   * @expandable Hovers to reveal d4-d20 buttons
   */
  'dice': `
    <div id="dice-fab-wrapper" class="dice-wrapper">
      <div class="dice-list">
        <button class="button is-small is-rounded dice-quick-btn" data-dice="d4">D4</button>
        <button class="button is-small is-rounded dice-quick-btn" data-dice="d6">D6</button>
        <button class="button is-small is-rounded dice-quick-btn" data-dice="d8">D8</button>
        <button class="button is-small is-rounded dice-quick-btn" data-dice="d10">D10</button>
        <button class="button is-small is-rounded dice-quick-btn" data-dice="d12">D12</button>
        <button class="button is-small is-rounded dice-quick-btn" data-dice="d20">D20</button>
      </div>
      <button id="dice-main-btn" class="button is-success is-rounded fab-button">
        <span class="icon"><i class="fas fa-dice"></i></span>
      </button>
    </div>`,

  /**
   * Add Card Button - Opens manual card creation modal
   * @key add-card
   */
  'add-card': `
    <button id="fab-add-card" class="button is-link is-rounded fab-button" title="Adicionar Card">
      <span class="icon"><i class="fas fa-plus"></i></span>
    </button>`,

  /**
   * Macros Button - Opens player macro management modal
   * @key macros
   */
  'macros': `
    <button id="fab-macros" class="button is-warning is-rounded fab-button" title="Criar Macro">
      <span class="icon"><i class="fas fa-terminal"></i></span>
    </button>`,

  /**
   * Change Character Button - Opens character selection modal
   * @key change-char
   */
  'change-char': `
    <button id="fab-change-char" class="button is-primary is-rounded fab-button" title="Trocar Personagem">
      <span class="icon"><i class="fas fa-user-friends"></i></span>
    </button>`,

  /**
   * Toggle View Button - Switches between grid and board visualization
   * @key toggle-view
   * @state Dynamic icon based on current view (grid ↔ board)
   */
  'toggle-view': `
    <button id="fab-toggle-view" class="button is-warning is-rounded fab-button" title="Mudar Visualização">
      <span class="icon"><i class="fas fa-project-diagram"></i></span>
    </button>`,

  /**
   * Text Mode Button - Navigates to text editor mode
   * @key text-mode
   */
  'text-mode': `
    <a href="text-mode.html" class="button is-light is-rounded fab-button" title="Modo Texto">
      <span class="icon"><i class="fas fa-file-alt"></i></span>
    </a>`,

  /**
   * Drawing Mode Button - Navigates to whiteboard/drawing mode
   * @key drawing-mode
   */
  'drawing-mode': `
    <a href="drawing-mode.html" class="button is-warning is-rounded fab-button" title="Modo Desenho">
      <span class="icon"><i class="fas fa-paint-brush"></i></span>
    </a>`,

  /**
   * Sheet Mode Button - Navigates to character sheet mode
   * @key sheet-mode
   */
  'sheet-mode': `
    <a href="sheet-mode.html" class="button is-info is-rounded fab-button" title="Modo Ficha">
      <span class="icon"><i class="fas fa-id-card"></i></span>
    </a>`
};

/**
 * Renders floating action buttons based on requested button keys.
 * 
 * Creates or updates the #app-fab container and injects buttons in the order specified.
 * Returns the FAB container element for event listener attachment.
 * 
 * @param {string[]} activeButtons - Array of button keys to render
 *   Example: ['help', 'chat', 'add-card', 'dice']
 * @returns {HTMLElement} The FAB container element (#app-fab)
 * 
 * @example
 * const fabContainer = renderFab(['chat', 'dice', 'add-card']);
 * // Now attach event listeners to buttons as needed:
 * fabContainer.querySelector('#toggle-chat-btn').addEventListener('click', toggleChat);
 */
export function renderFab(activeButtons = []) {
  // Sempre renderiza todos os botões, visibilidade será controlada por classes
  let appFab = document.getElementById('app-fab');
  if (!appFab) {
    appFab = document.createElement('div');
    appFab.id = 'app-fab';
    document.body.appendChild(appFab);
  }

  // Determina o modo atual
  const path = window.location.pathname.toLowerCase();
  let mode = 'grid';
  if (path.includes('sheet-mode')) mode = 'sheet';
  else if (path.includes('index')) mode = 'grid';
  else if (path.includes('text-mode')) mode = 'notas';
  else if (path.includes('drawing-mode')) mode = 'whiteboard';

  // Permissão de narrador
  const isNarrator = localStorage.getItem('isNarrator') === 'true';

  // Botões por modo
  let buttonOrder = [];
  if (mode === 'sheet') {
    buttonOrder = ['dice', 'macros', 'change-char', 'chat', 'help'];
  } else if (mode === 'grid') {
    buttonOrder = ['add-card', 'dice', 'chat', 'converter'];
    if (isNarrator) buttonOrder.push('bulk-edit', 'settings');
    buttonOrder.push('help');
  } else if (mode === 'notas') {
    buttonOrder = ['dice', 'chat'];
    if (isNarrator) buttonOrder.push('settings');
    buttonOrder.push('help');
  } else if (mode === 'whiteboard') {
    buttonOrder = ['dice', 'chat'];
    if (isNarrator) buttonOrder.push('settings');
    buttonOrder.push('help');
  } else {
    // fallback: só Ajuda
    buttonOrder = ['help'];
  }

  const buttonsHtml = buttonOrder
    .map(key => {
      if (!FAB_BUTTONS[key]) {
        console.warn(`[FAB] Button key "${key}" not found in FAB_BUTTONS dictionary`);
        return '';
      }
      return FAB_BUTTONS[key];
    })
    .filter(html => html !== '')
    .join('\n');

  appFab.innerHTML = `<div class="fab-container">${buttonsHtml}</div>`;
  return appFab;
}

/**
 * Returns the dictionary of all available FAB buttons.
 * Useful for checking which buttons are available.
 * 
 * @returns {Object} FAB_BUTTONS dictionary
 */
export function getAvailableButtons() {
  return Object.keys(FAB_BUTTONS);
}

export default { renderFab, getAvailableButtons };