<<<<<<< HEAD
import * as cardRenderer from "./cardRenderer.js";
import { showConfirmationPopover } from "./ui.js";
import * as cardManager from "./cardManager.js";
let eventHandlers = {};
const boardContainer = document.getElementById("board-view-container");
export function initializeBoard(e) {
  (eventHandlers = e),
    boardContainer
      ? boardContainer.addEventListener("click", (e) => {
          const n = e.target,
            t = n.closest(".action-icon"),
            o = n.closest(".card");
          if (!t || !o) return;
          const s = o.dataset.id,
            a = cardManager.getItems().find((e) => e.id === s);
          a &&
            (t.classList.contains("view-btn")
              ? eventHandlers.onView(a)
              : t.classList.contains("delete-btn")
              ? showConfirmationPopover({
                  targetElement: t,
                  message: "Deletar este card?",
                  confirmButtonType: "is-danger",
                  onConfirm: () => eventHandlers.onDelete(a),
                })
              : t.classList.contains("edit-btn")
              ? eventHandlers.onEdit(o, a, boardContainer)
              : t.classList.contains("save-btn")
              ? eventHandlers.onSave(o, a, boardContainer)
              : t.classList.contains("cancel-btn") &&
                (boardContainer.classList.remove("is-editing-item"),
                cardRenderer.renderCardViewMode(o, a),
                o._newImageFile && delete o._newImageFile));
        })
      : console.error("Board container not found!");
}
export function setItems(e) {
  boardContainer.querySelectorAll(".card").forEach((e) => e.remove()),
    console.log("SetItems Board", e);
  const n = document.getElementById("board-search-input");
  if (0 === e.length && n?.value) {
    const e = document.createElement("div");
    (e.innerHTML =
      '<div class="column is-full has-text-centered has-text-white"><p class="is-size-5">Nenhum item encontrado.</p></div>'),
      boardContainer.appendChild(e);
  } else if (e.length > 0) {
    const n = e.map((e, n) => {
      const t = cardRenderer.createCardElement(e);
      if (
        ((t.style.position = "absolute"),
        e.boardPosition &&
          "number" == typeof e.boardPosition.x &&
          "number" == typeof e.boardPosition.y)
      )
        (t.style.left = e.boardPosition.x + "px"),
          (t.style.top = e.boardPosition.y + "px");
      else {
        const e = 80 + 30 * n,
          o = 40 + 30 * n;
        (t.style.top = `${e}px`), (t.style.left = `${o}px`);
      }
      let o = !1,
        s = 0,
        a = 0;
      return (
        t.addEventListener("mousedown", function (e) {
          0 === e.button &&
            ((o = !0),
            (t.style.zIndex = 10),
            (s = e.clientX - t.offsetLeft),
            (a = e.clientY - t.offsetTop),
            (document.body.style.userSelect = "none"));
        }),
        document.addEventListener("mousemove", function (e) {
          o &&
            ((t.style.left = e.clientX - s + "px"),
            (t.style.top = e.clientY - a + "px"));
        }),
        document.addEventListener("mouseup", async function (n) {
          if (o) {
            (o = !1),
              (t.style.zIndex = 1),
              (document.body.style.userSelect = "");
            const n = t.offsetLeft,
              s = t.offsetTop;
            eventHandlers.onPositionChange &&
              (eventHandlers.onPositionChange(e.id, { x: n, y: s }),
              console.log(
                "onPositionChange called for item:",
                e.id,
                "position:",
                { x: n, y: s }
              ));
          }
        }),
        t
      );
    });
    boardContainer.append(...n);
  }
}
=======
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
                confirmButtonType: 'is-danger',
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
    console.log('SetItems Board', items);
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
                        console.log("onPositionChange called for item:", item.id, "position:", { x, y });

                    }
                }
            });

            return cardElement;
        });

        boardContainer.append(...cardElements);
    }
}
>>>>>>> 104b23cfc07483eae944d9e675e87949d0da4616
