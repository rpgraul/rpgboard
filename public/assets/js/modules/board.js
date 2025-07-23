// Este módulo será responsável por toda a lógica do modo de visualização em board.
import * as cardRenderer from './cardRenderer.js';
import { showConfirmationPopover } from './ui.js';
import * as cardManager from './cardManager.js';

let eventHandlers = {}; // Objeto para armazenar as funções de callback

const boardContainer = document.getElementById('board-view-container');

/**
 * Inicializa o módulo do board.
 * @param {object} handlers - Funções para lidar com ações (onDelete, onSave, onView, onTagInputInit).
 */
export function initializeBoard(handlers) {
    eventHandlers = handlers;

    if (!boardContainer) {
        console.error("Board container not found!");
        return;
    }

    // Delegação de eventos para os botões dos cards no board
    boardContainer.addEventListener('click', (e) => {
        const target = e.target;
        const actionButton = target.closest('.action-icon');
        const card = target.closest('.card');

        if (!actionButton || !card) return;

        const id = card.dataset.id;
        // Busca tanto nos itens filtrados quanto nos locais para garantir
        const item = cardManager.getItems().find(i => i.id === id);
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
            eventHandlers.onEdit(card, item, boardContainer);
        } else if (actionButton.classList.contains('save-btn')) {
            eventHandlers.onSave(card, item, boardContainer);
        } else if (actionButton.classList.contains('cancel-btn')) {
            boardContainer.classList.remove('is-editing-item');
            cardRenderer.renderCardViewMode(card, item); // Reverte para o modo de visualização
            if (card._newImageFile) delete card._newImageFile;
        }
    });
}

/**
 * Limpa e desenha todos os itens filtrados no board.
 * @param {Array} items - A lista de itens a serem exibidos.
 */
export function setItems(items) {
    // Limpa apenas os cards, preservando a barra de busca
    const existingCards = boardContainer.querySelectorAll('.card');
    existingCards.forEach(card => card.remove());

    // Se não houver itens e a busca estiver ativa, mostra uma mensagem.
    const boardSearchInput = document.getElementById('board-search-input');
    if (items.length === 0 && boardSearchInput?.value) {
        // Adiciona um elemento temporário para a mensagem
        const messageEl = document.createElement('div');
        messageEl.innerHTML = `<div class="column is-full has-text-centered has-text-white"><p class="is-size-5">Nenhum item encontrado.</p></div>`;
        boardContainer.appendChild(messageEl);
    } else if (items.length > 0) {
        const cardElements = items.map((item, index) => {
            const cardElement = cardRenderer.createCardElement(item);
            cardElement.style.position = 'absolute';
            // Se houver posição salva, usa ela; senão, distribui inicial
            if (item.boardPosition && typeof item.boardPosition.x === 'number' && typeof item.boardPosition.y === 'number') {
                cardElement.style.left = item.boardPosition.x + 'px';
                cardElement.style.top = item.boardPosition.y + 'px';
            } else {
                const top = 80 + (index * 30);
                const left = 40 + (index * 30);
                cardElement.style.top = `${top}px`;
                cardElement.style.left = `${left}px`;
            }

            // Drag & drop livre
            let isDragging = false;
            let offsetX = 0, offsetY = 0;

            cardElement.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return; // Só botão esquerdo
                isDragging = true;
                cardElement.style.zIndex = 10;
                offsetX = e.clientX - cardElement.offsetLeft;
                offsetY = e.clientY - cardElement.offsetTop;
                document.body.style.userSelect = 'none';
            });
            document.addEventListener('mousemove', function(e) {
                if (isDragging) {
                    cardElement.style.left = (e.clientX - offsetX) + 'px';
                    cardElement.style.top = (e.clientY - offsetY) + 'px';
                }
            });
            document.addEventListener('mouseup', async function(e) {
                if (isDragging) {
                    isDragging = false;
                    cardElement.style.zIndex = 1;
                    document.body.style.userSelect = '';
                    // Salva posição no Firebase através do cardManager
                    const x = cardElement.offsetLeft;
                    const y = cardElement.offsetTop;
                    if (eventHandlers.onPositionChange) {
                        eventHandlers.onPositionChange(item.id, { x, y });
                    }
                }
            });

            return cardElement;
        });
        boardContainer.append(...cardElements);
    }
}