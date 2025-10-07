<<<<<<< HEAD
import * as firebaseService from "./firebaseService.js";
const bulkEditToolbar = document.getElementById("bulk-edit-toolbar"),
  bulkEditCount = document.getElementById("bulk-edit-count"),
  bulkActionCancel = document.getElementById("bulk-action-cancel"),
  bulkActionVisible = document.getElementById("bulk-action-visible"),
  bulkActionHidden = document.getElementById("bulk-action-hidden");
let isBulkEditing = !1;
const selectedItems = new Set();
function updateCountDisplay() {
  const e = selectedItems.size;
  bulkEditCount.textContent = `${e} card${1 !== e ? "s" : ""} selecionado${
    1 !== e ? "s" : ""
  }`;
}
export function enterBulkEditMode() {
  (isBulkEditing = !0), document.body.classList.add("is-bulk-editing");
}
export function exitBulkEditMode() {
  (isBulkEditing = !1),
    document.body.classList.remove("is-bulk-editing"),
    document.querySelectorAll(".card.is-bulk-selected").forEach((e) => {
      e.classList.remove("is-bulk-selected");
    }),
    selectedItems.clear(),
    updateCountDisplay();
}
export function isBulkEditingActive() {
  return isBulkEditing;
}
export function toggleCardSelection(e) {
  if (!isBulkEditing) return;
  const i = e.dataset.id;
  i &&
    (e.classList.toggle("is-bulk-selected"),
    selectedItems.has(i) ? selectedItems.delete(i) : selectedItems.add(i),
    updateCountDisplay());
}
async function applyBulkVisibilityChange(e) {
  if (0 === selectedItems.size) return void alert("Nenhum card selecionado.");
  bulkActionVisible.classList.add("is-loading"),
    bulkActionHidden.classList.add("is-loading");
  const i = Array.from(selectedItems);
  try {
    await firebaseService.updateItemsVisibility(i, e), exitBulkEditMode();
  } catch (e) {
    console.error("Falha ao atualizar a visibilidade em massa:", e),
      alert("Ocorreu um erro ao aplicar as alterações.");
  } finally {
    bulkActionVisible.classList.remove("is-loading"),
      bulkActionHidden.classList.remove("is-loading");
  }
}
export function initializeBulkEdit() {
  bulkEditToolbar &&
    bulkActionCancel &&
    bulkActionVisible &&
    bulkActionHidden &&
    (bulkActionCancel.addEventListener("click", exitBulkEditMode),
    bulkActionVisible.addEventListener("click", () =>
      applyBulkVisibilityChange(!0)
    ),
    bulkActionHidden.addEventListener("click", () =>
      applyBulkVisibilityChange(!1)
    ));
}
=======
import * as firebaseService from './firebaseService.js';

const bulkEditToolbar = document.getElementById('bulk-edit-toolbar');
const bulkEditCount = document.getElementById('bulk-edit-count');
const bulkActionCancel = document.getElementById('bulk-action-cancel');
const bulkActionVisible = document.getElementById('bulk-action-visible');
const bulkActionHidden = document.getElementById('bulk-action-hidden');

let isBulkEditing = false;
const selectedItems = new Set();

/**
 * Atualiza o contador de itens selecionados na barra de ferramentas.
 */
function updateCountDisplay() {
    const count = selectedItems.size;
    bulkEditCount.textContent = `${count} card${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}`;
}

/**
 * Entra no modo de edição em massa.
 */
export function enterBulkEditMode() {
    isBulkEditing = true;
    document.body.classList.add('is-bulk-editing');
}

/**
 * Sai do modo de edição em massa e limpa a seleção.
 */
export function exitBulkEditMode() {
    isBulkEditing = false;
    document.body.classList.remove('is-bulk-editing');

    // Limpa a seleção visual e o array de selecionados
    document.querySelectorAll('.card.is-bulk-selected').forEach(card => {
        card.classList.remove('is-bulk-selected');
    });
    selectedItems.clear();
    updateCountDisplay();
}

/**
 * Verifica se o modo de edição em massa está ativo.
 * @returns {boolean}
 */
export function isBulkEditingActive() {
    return isBulkEditing;
}

/**
 * Alterna a seleção de um card.
 * @param {HTMLElement} cardElement - O elemento do card que foi clicado.
 */
export function toggleCardSelection(cardElement) {
    if (!isBulkEditing) return;

    const cardId = cardElement.dataset.id;
    if (!cardId) return;

    cardElement.classList.toggle('is-bulk-selected');

    if (selectedItems.has(cardId)) {
        selectedItems.delete(cardId);
    } else {
        selectedItems.add(cardId);
    }

    updateCountDisplay();
}

/**
 * Lida com a aplicação da ação de visibilidade em massa.
 * @param {boolean} isVisible - O novo estado de visibilidade a ser aplicado.
 */
async function applyBulkVisibilityChange(isVisible) {
    if (selectedItems.size === 0) {
        alert("Nenhum card selecionado.");
        return;
    }

    // Adiciona feedback de carregamento
    bulkActionVisible.classList.add('is-loading');
    bulkActionHidden.classList.add('is-loading');

    const itemIds = Array.from(selectedItems);

    try {
        await firebaseService.updateItemsVisibility(itemIds, isVisible);
        // O listener do Firebase cuidará de atualizar a UI. Apenas saímos do modo de edição.
        exitBulkEditMode();
    } catch (error) {
        console.error("Falha ao atualizar a visibilidade em massa:", error);
        alert("Ocorreu um erro ao aplicar as alterações.");
    } finally {
        bulkActionVisible.classList.remove('is-loading');
        bulkActionHidden.classList.remove('is-loading');
    }
}

export function initializeBulkEdit() {
    if (!bulkEditToolbar || !bulkActionCancel || !bulkActionVisible || !bulkActionHidden) return;
    bulkActionCancel.addEventListener('click', exitBulkEditMode);
    bulkActionVisible.addEventListener('click', () => applyBulkVisibilityChange(true));
    bulkActionHidden.addEventListener('click', () => applyBulkVisibilityChange(false));
}
>>>>>>> 104b23cfc07483eae944d9e675e87949d0da4616
