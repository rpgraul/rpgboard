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
