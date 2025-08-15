/**
 * Rola a tela até o card com o id especificado
 * @param {string} cardId - O id do card a focar
 */
export function scrollToCard(cardId) {
    const cardElement = itemsContainer.querySelector(`.card[data-id="${cardId}"]`);
    if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardElement.classList.add('is-highlighted');
        setTimeout(() => cardElement.classList.remove('is-highlighted'), 1200);
    }
}
import * as cardRenderer from './cardRenderer.js';
import { showConfirmationPopover } from './ui.js';
import * as cardManager from './cardManager.js';

let eventHandlers = {}; // Objeto para armazenar as funções de callback
let muuriGrid = null; // Instância do Muuri, agora gerenciada aqui

// Referências aos elementos da UI
const itemsContainer = document.getElementById('grid-view-container');
const searchInput = document.getElementById('search-input');
const loadingIndicator = document.getElementById('loading-indicator');

/**
 * Inicializa o módulo da Grade, configurando Muuri e os event listeners.
 * @param {object} handlers - Funções para lidar com ações (onDelete, onSave, onView).
 */
export function initializeGrid(handlers) {
    eventHandlers = handlers;

    // Delegação de eventos para os botões dos cards
    itemsContainer.addEventListener('click', (e) => {
        const target = e.target;
        const card = target.closest('.card');
        if (!card) return;

        // Se o clique for dentro da camada de informações, não faz nada,
        // permitindo interações com inputs e outros elementos dentro dela.
        if (target.closest('.card-info-layer')) {
            return;
        }

        const actionButton = target.closest('.action-icon');
        const cardImage = target.closest('.card-image');

        const id = card.dataset.id;
        const item = cardManager.getItems().find(i => i.id === id);
        if (!item) return;

        if (actionButton) {
            if (actionButton.classList.contains('delete-btn')) {
                showConfirmationPopover({
                    targetElement: actionButton,
                    message: 'Deletar este card?',
                    onConfirm: () => eventHandlers.onDelete(item)
                });
            } else if (actionButton.classList.contains('edit-btn')) {
                eventHandlers.onEdit(card, item, itemsContainer);
            } else if (actionButton.classList.contains('save-btn')) {
                eventHandlers.onSave(card, item, itemsContainer);
            } else if (actionButton.classList.contains('cancel-btn')) {
                itemsContainer.classList.remove('is-editing-item');
                cardRenderer.renderCardViewMode(card, item);
                if (card._newImageFile) {
                    delete card._newImageFile;
                }
                muuriGrid?.layout(true);
            }
        } else if (cardImage) {
            eventHandlers.onView(item);
        }
    });

    // O Muuri será inicializado sob demanda pela função show().
}

/**
 * Define os itens a serem exibidos no grid, sincronizando de forma inteligente.
 * Adiciona, remove e atualiza cards sem recriar a grade inteira,
 * preservando a posição e o estado durante edições e filtros.
 * @param {Array} itemsToShow - A lista de itens a serem exibidos.
 */
export function setItems(itemsToShow, selectedTags = []) {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    if (!muuriGrid) return;

    const currentMuuriItems = muuriGrid.getItems();
    const currentIds = new Set(currentMuuriItems.map(item => item.getElement().dataset.id));
    const newIds = new Set(itemsToShow.map(item => item.id));

    // 1. Encontra e remove os itens que não estão na nova lista
    const itemsToRemove = currentMuuriItems.filter(item => !newIds.has(item.getElement().dataset.id));
    if (itemsToRemove.length > 0) {
        muuriGrid.remove(itemsToRemove, { removeElements: true });
    }

    // 2. Encontra e adiciona os novos itens
    const itemsToAdd = itemsToShow
        .filter(item => !currentIds.has(item.id))
        .map(item => cardRenderer.createCardElement(item, selectedTags));

    // 3. Atualiza o conteúdo dos itens existentes
    currentMuuriItems.forEach(muuriItem => {
        const element = muuriItem.getElement();
        if (newIds.has(element.dataset.id)) {
            const newData = itemsToShow.find(item => item.id === element.dataset.id);
            if (newData && !element.classList.contains('editing')) {
                cardRenderer.renderCardViewMode(element, newData, selectedTags);
            }
        }
    });

    // 4. Adiciona os novos elementos e reordena o grid para corresponder à ordem dos dados
    if (itemsToAdd.length > 0) {
        muuriGrid.add(itemsToAdd);
    }

    const finalOrderIds = itemsToShow.map(item => item.id);
    muuriGrid.sort((itemA, itemB) => finalOrderIds.indexOf(itemA.getElement().dataset.id) - finalOrderIds.indexOf(itemB.getElement().dataset.id), { layout: 'instant' });
}

/**
 * Atualiza o texto do nome do arquivo no componente de upload.
 * @param {HTMLInputElement} fileInput - O input de arquivo.
 */
export function updateFileName(fileInput) {
    const fileNameSpan = fileInput.closest('.file.has-name')?.querySelector('.file-name');
    if (fileNameSpan) {
        if (fileInput.files.length > 0) {
            fileNameSpan.textContent = fileInput.files[0].name;
        } else {
            fileNameSpan.textContent = "Nenhuma imagem selecionada";
        }
    }
}

/**
 * Inicializa o grid com Muuri, movido de script.js para cá.
 */
function initializeMuuri() {
    if (!itemsContainer) {
        console.error('O contêiner do grid não foi encontrado.');
        return;
    }

    // Garante que não haja instâncias duplicadas
    if (muuriGrid) {
        muuriGrid.destroy();
    }

    // Cria uma nova instância do Muuri
    muuriGrid = new Muuri(itemsContainer, {
        items: '.card',
        dragEnabled: true,
        dragStartPredicate: function (item, event) {
            const cardElement = item.getElement();
            console.log(event);
            const clickTarget = event.target; // O elemento exato que foi clicado

            // Condições para NUNCA arrastar
            if (document.body.classList.contains('is-bulk-editing') ||
                cardElement.classList.contains('editing') ||
                cardElement.classList.contains('is-details-visible') ||
                clickTarget.closest('.shortcode-hp') ||
                clickTarget.closest('.shortcode-count') ||
                clickTarget.closest('.shortcode-stat') ||
                clickTarget.closest('.toggle-view-icon') ||
                clickTarget.closest('.card-actions-top') ||
                clickTarget.closest('.card-content .title') ||
                clickTarget.closest('.card-content .content')) {
                return false;
            }

            // Lógica da "alça de arrasto" na borda
            const rect = cardElement.getBoundingClientRect();
            const handleSize = 15; // Tamanho da borda sensível ao arraste (em pixels)

            const x = event.srcEvent.clientX || event.clientX;
            const y = event.srcEvent.clientY || event.clientY;

            const isNearBorder =
                (x - rect.left < handleSize) ||
                (rect.right - x < handleSize) ||
                (y - rect.top < handleSize) ||
                (rect.bottom - y < handleSize);

            if (isNearBorder) {
                return Muuri.ItemDrag.defaultStartPredicate(item, event);
            }

            return false;
        }
    });

    muuriGrid.on('dragEnd', () => {
        const orderedItems = muuriGrid.getItems();        
        console.log("dragEnd event triggered!");
        
        const orderedIds = orderedItems.map(item => item.getElement().dataset.id);
                        
    if (eventHandlers.onReorder) {
          eventHandlers.onReorder(orderedIds);
        }
   });
}

export function refreshLayout() {
    muuriGrid?.layout(true);
}

export function hide() {
    if (muuriGrid) {
        muuriGrid.destroy();
        muuriGrid = null;
    }
}

export function destroy() {
    if (muuriGrid) {
        muuriGrid.destroy();
        muuriGrid = null;
    }
    // Potentially remove other event listeners added by this module
    // if they are not automatically cleaned up by the destroy method.
}

export function show() {
    if (!muuriGrid) initializeMuuri();
}