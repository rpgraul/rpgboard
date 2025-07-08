import * as cardRenderer from './cardRenderer.js';
import { showConfirmationPopover } from './ui.js';

let localItems = [];
let eventHandlers = {}; // Objeto para armazenar as funções de callback

// Referências aos elementos da UI
const itemsContainer = document.getElementById('grid-view-container');
const searchInput = document.getElementById('search-input');
const loadingIndicator = document.getElementById('loading-indicator');

/**
 * Inicializa o módulo da Grade, configurando os event listeners.
 * @param {object} handlers - Funções para lidar com ações (onDelete, onSave, onView).
 */
export function initializeGrid(handlers) {
    eventHandlers = handlers;

    // Delegação de eventos para os botões dos cards
    itemsContainer.addEventListener('click', (e) => {
        const target = e.target;
        const actionButton = target.closest('.action-icon');
        const card = target.closest('.card');

        if (!actionButton || !card) return;

        const id = card.dataset.id;
        const item = localItems.find(i => i.id === id);
        if (!item) return;

        if (actionButton.classList.contains('view-btn')) {
            eventHandlers.onView(item);
        } else if (actionButton.classList.contains('delete-btn')) {
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
    });
}

/**
 * Atualiza a lista local de itens e renderiza na tela.
 * @param {Array} newItems - A nova lista de itens vinda do Firebase.
 */
export function updateItems(newItems) {
    localItems = newItems;
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    renderAllItems(newItems);
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

function renderAllItems(itemsToRender) {
    itemsContainer.innerHTML = '';
    if (itemsToRender.length === 0 && searchInput.value) {
        itemsContainer.innerHTML = `<div class="column is-full has-text-centered"><p class="is-size-5 has-text-grey">Nenhum item encontrado para "${searchInput.value}".</p></div>`;
    } else {
        const cardElements = itemsToRender.map(cardRenderer.createCardElement);
        itemsContainer.append(...cardElements);
    }
}