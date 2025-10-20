import * as cardRenderer from "./cardRenderer.js";
import { showConfirmationPopover } from "./ui.js";
import * as cardManager from "./cardManager.js";
let eventHandlers = {};
const boardContainer = document.getElementById("board-view-container");
export function initializeBoard(e) {
  (eventHandlers = e),
    boardContainer
      ? // MODIFICADO: Adicionamos 'async' aqui também
        boardContainer.addEventListener("click", async (event) => {
          const n = event.target;
          const t = n.closest(".action-icon");
          const o = n.closest(".card");
          if (!t || !o) return;
          const s = o.dataset.id;
          const a = cardManager.getItems().find((item) => item.id === s);
          
          if (a) {
            if (t.classList.contains("view-btn")) {
              eventHandlers.onView(a);
            } else if (t.classList.contains("delete-btn")) {
              showConfirmationPopover({
                targetElement: t,
                message: "Deletar este card?",
                confirmButtonType: "is-danger",
                onConfirm: () => eventHandlers.onDelete(a),
              });
            } else if (t.classList.contains("edit-btn")) {
              eventHandlers.onEdit(o, a, boardContainer);
            } else if (t.classList.contains("save-btn")) {
              // --- INÍCIO DA CORREÇÃO ---
              const saveButton = o.querySelector('.save-btn');
              if (saveButton) saveButton.classList.add('is-loading');

              try {
                // 1. Esperamos o salvamento ser concluído
                const updatedItem = await eventHandlers.onSave(o, a, boardContainer);

                // 2. Redesenhamos o card no modo de visualização
                boardContainer.classList.remove("is-editing-item"); // Opcional, mas bom para consistência
                cardRenderer.renderCardViewMode(o, updatedItem);
                
                // 3. Limpamos o arquivo temporário
                if (o._newImageFile) delete o._newImageFile;

              } catch(error) {
                console.error("Falha ao salvar o card no modo board:", error);
              } finally {
                // 4. Removemos o estado de loading
                if (saveButton) saveButton.classList.remove('is-loading');
              }
              // --- FIM DA CORREÇÃO ---
            } else if (t.classList.contains("cancel-btn")) {
              boardContainer.classList.remove("is-editing-item");
              cardRenderer.renderCardViewMode(o, a);
              if (o._newImageFile) delete o._newImageFile;
            }
          }
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
