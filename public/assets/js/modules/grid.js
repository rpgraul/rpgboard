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
    // MODIFICADO: Adicionamos 'async' para poder usar 'await' dentro do listener
    itemsContainer.addEventListener("click", async (event) => {
      const t = event.target;
      const n = t.closest(".card");
      if (!n) return;
      if (t.closest(".card-info-layer")) return;
      const i = t.closest(".action-icon");
      const r = t.closest(".card-image");
      const o = n.dataset.id;
      const s = cardManager.getItems().find((item) => item.id === o);
      
      if (s) {
        if (i) {
          if (i.classList.contains("delete-btn")) {
            showConfirmationPopover({
              targetElement: i,
              message: "Deletar este card?",
              onConfirm: () => eventHandlers.onDelete(s),
            });
          } else if (i.classList.contains("edit-btn")) {
            eventHandlers.onEdit(n, s, itemsContainer);
          } else if (i.classList.contains("save-btn")) {
            // --- INÍCIO DA CORREÇÃO ---
            const saveButton = n.querySelector('.save-btn');
            if (saveButton) saveButton.classList.add('is-loading');

            try {
              // 1. Esperamos o salvamento ser concluído e pegamos os dados atualizados
              const updatedItem = await eventHandlers.onSave(n, s, itemsContainer);
              
              // 2. Removemos o estado de edição e redesenhamos o card
              itemsContainer.classList.remove("is-editing-item");
              cardRenderer.renderCardViewMode(n, updatedItem);
              
              // 3. Limpamos o arquivo de imagem temporário
              if (n._newImageFile) delete n._newImageFile;

              // 4. Atualizamos o layout do Muuri caso a imagem tenha mudado de tamanho
              muuriGrid?.layout(true);

            } catch (error) {
              console.error("Falha ao salvar e re-renderizar o card:", error);
              // Se der erro, a UI continua em modo de edição para o usuário tentar novamente.
            } finally {
               // 5. Garantimos que o estado de loading seja removido, com sucesso ou falha
               if (saveButton) saveButton.classList.remove('is-loading');
            }
            // --- FIM DA CORREÇÃO ---
          } else if (i.classList.contains("cancel-btn")) {
            itemsContainer.classList.remove("is-editing-item");
            cardRenderer.renderCardViewMode(n, s);
            if (n._newImageFile) delete n._newImageFile;
            muuriGrid?.layout(true);
          }
        } else if (r && eventHandlers.onView) {
          eventHandlers.onView(s);
        }
      }
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
