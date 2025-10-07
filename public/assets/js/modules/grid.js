<<<<<<< HEAD
export function scrollToCard(e) {
  const t = itemsContainer.querySelector(`.card[data-id="${e}"]`);
  t &&
    (t.scrollIntoView({ behavior: "smooth", block: "center" }),
    t.classList.add("is-highlighted"),
    setTimeout(() => t.classList.remove("is-highlighted"), 1200));
}
import * as cardRenderer from "./cardRenderer.js";
import { showConfirmationPopover } from "./ui.js";
import * as cardManager from "./cardManager.js";
let eventHandlers = {},
  muuriGrid = null;
const itemsContainer = document.getElementById("grid-view-container"),
  searchInput = document.getElementById("search-input"),
  loadingIndicator = document.getElementById("loading-indicator");
export function initializeGrid(e) {
  (eventHandlers = e),
    itemsContainer.addEventListener("click", (e) => {
      const t = e.target,
        n = t.closest(".card");
      if (!n) return;
      if (t.closest(".card-info-layer")) return;
      const i = t.closest(".action-icon"),
        r = t.closest(".card-image"),
        o = n.dataset.id,
        s = cardManager.getItems().find((e) => e.id === o);
      s &&
        (i
          ? i.classList.contains("delete-btn")
            ? showConfirmationPopover({
                targetElement: i,
                message: "Deletar este card?",
                onConfirm: () => eventHandlers.onDelete(s),
              })
            : i.classList.contains("edit-btn")
            ? eventHandlers.onEdit(n, s, itemsContainer)
            : i.classList.contains("save-btn")
            ? eventHandlers.onSave(n, s, itemsContainer)
            : i.classList.contains("cancel-btn") &&
              (itemsContainer.classList.remove("is-editing-item"),
              cardRenderer.renderCardViewMode(n, s),
              n._newImageFile && delete n._newImageFile,
              muuriGrid?.layout(!0))
          : r && eventHandlers.onView(s));
    });
}
export function setItems(e, t = []) {
  if (
    (loadingIndicator && (loadingIndicator.style.display = "none"), !muuriGrid)
  )
    return;
  const n = muuriGrid.getItems(),
    i = new Set(n.map((e) => e.getElement().dataset.id)),
    r = new Set(e.map((e) => e.id)),
    o = n.filter((e) => !r.has(e.getElement().dataset.id));
  o.length > 0 && muuriGrid.remove(o, { removeElements: !0 });
  const s = e
    .filter((e) => !i.has(e.id))
    .map((e) => cardRenderer.createCardElement(e, t));
  n.forEach((n) => {
    const i = n.getElement();
    if (r.has(i.dataset.id)) {
      const n = e.find((e) => e.id === i.dataset.id);
      n &&
        !i.classList.contains("editing") &&
        cardRenderer.renderCardViewMode(i, n, t);
    }
  }),
    s.length > 0 && muuriGrid.add(s);
  const a = e.map((e) => e.id);
  muuriGrid.sort(
    (e, t) =>
      a.indexOf(e.getElement().dataset.id) -
      a.indexOf(t.getElement().dataset.id),
    { layout: "instant" }
  );
}
export function updateFileName(e) {
  const t = e.closest(".file.has-name")?.querySelector(".file-name");
  t &&
    (e.files.length > 0
      ? (t.textContent = e.files[0].name)
      : (t.textContent = "Nenhuma imagem selecionada"));
}
function initializeMuuri() {
  itemsContainer
    ? (muuriGrid && muuriGrid.destroy(),
      (muuriGrid = new Muuri(itemsContainer, {
        items: ".card",
        dragEnabled: !0,
        dragStartPredicate: function (e, t) {
          const n = e.getElement();
          console.log(t);
          const i = t.target;
          if (
            document.body.classList.contains("is-bulk-editing") ||
            n.classList.contains("editing") ||
            n.classList.contains("is-details-visible") ||
            i.closest(".shortcode-hp") ||
            i.closest(".shortcode-count") ||
            i.closest(".shortcode-stat") ||
            i.closest(".toggle-view-icon") ||
            i.closest(".card-actions-top") ||
            i.closest(".card-content .title") ||
            i.closest(".card-content .content")
          )
            return !1;
          const r = n.getBoundingClientRect(),
            o = t.srcEvent.clientX || t.clientX,
            s = t.srcEvent.clientY || t.clientY;
          return (
            !!(
              o - r.left < 15 ||
              r.right - o < 15 ||
              s - r.top < 15 ||
              r.bottom - s < 15
            ) && Muuri.ItemDrag.defaultStartPredicate(e, t)
          );
        },
      })),
      muuriGrid.on("dragEnd", () => {
        const e = muuriGrid.getItems();
        console.log("dragEnd event triggered!");
        const t = e.map((e) => e.getElement().dataset.id);
        eventHandlers.onReorder && eventHandlers.onReorder(t);
      }))
    : console.error("O contêiner do grid não foi encontrado.");
}
export function refreshLayout() {
  muuriGrid?.layout(!0);
}
export function hide() {
  muuriGrid && (muuriGrid.destroy(), (muuriGrid = null));
}
export function destroy() {
  muuriGrid && (muuriGrid.destroy(), (muuriGrid = null));
}
export function show() {
  muuriGrid || initializeMuuri();
}
=======
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
>>>>>>> 104b23cfc07483eae944d9e675e87949d0da4616
