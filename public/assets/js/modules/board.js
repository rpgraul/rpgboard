// Este módulo será responsável por toda a lógica do modo de visualização em board.
import * as cardRenderer from './cardRenderer.js';
import { showConfirmationPopover } from './ui.js';

// (Renderizar cards, arrastar e soltar, posicionamento, conexões, etc.)

let localItems = [];
let filteredItems = [];
let eventHandlers = {}; // Objeto para armazenar as funções de callback

const boardContainer = document.getElementById('board-view-container');
let boardSearchInput = null;

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

    boardSearchInput = document.getElementById('board-search-input');
    if (boardSearchInput) {
        boardSearchInput.addEventListener('input', filterAndRender);
    }

    // Delegação de eventos para os botões dos cards no board
    boardContainer.addEventListener('click', (e) => {
        const target = e.target;
        const actionButton = target.closest('.action-icon');
        const card = target.closest('.card');

        if (!actionButton || !card) return;

        const id = card.dataset.id;
        // Busca tanto nos itens filtrados quanto nos locais para garantir
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
 * Recebe a lista completa de itens e dispara a renderização.
 * @param {Array} items - A lista completa de itens.
 */
export function renderBoardItems(items) {
    localItems = items;
    filterAndRender(); // Renderização inicial com todos os itens
}

/**
 * Filtra os itens com base na busca e redesenha o board.
 */
function filterAndRender() {
    const searchTerm = boardSearchInput ? boardSearchInput.value.toLowerCase().trim() : '';

    if (!searchTerm) {
        filteredItems = [...localItems];
    } else {
        filteredItems = localItems.filter(item => {
            const titleMatch = item.titulo.toLowerCase().includes(searchTerm);
            const contentMatch = item.tipo === 'texto' && item.conteudo.toLowerCase().includes(searchTerm);
            const descriptionMatch = item.tipo === 'imagem' && item.descricao?.toLowerCase().includes(searchTerm);
            const tagMatch = item.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            return titleMatch || contentMatch || descriptionMatch || tagMatch;
        });
    }

    drawBoard();
}

/**
 * Limpa e desenha todos os itens filtrados no board.
 */
function drawBoard() {
    // Limpa apenas os cards, preservando a barra de busca
    const existingCards = boardContainer.querySelectorAll('.card');
    existingCards.forEach(card => card.remove());

    if (filteredItems.length > 0) {
        const cardElements = filteredItems.map((item, index) => {
            const cardElement = cardRenderer.createCardElement(item);

            // Posição inicial. Aumentei o 'top' para não ficar sob a busca.
            const top = 80 + (index * 30);
            const left = 40 + (index * 30);
            cardElement.style.top = `${top}px`;
            cardElement.style.left = `${left}px`;

            return cardElement;
        });
        boardContainer.append(...cardElements);
    }
    // Opcional: Adicionar mensagem de "nenhum item encontrado" aqui se desejar.
}