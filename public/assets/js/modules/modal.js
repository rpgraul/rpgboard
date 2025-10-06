export function openModal(e) {
  e && e.classList.add("is-active");
}
export function closeModal(e) {
  e && e.classList.remove("is-active");
}
function closeAllModals() {
  (document.querySelectorAll(".modal") || []).forEach(closeModal);
}
export function initializeModals() {
  (
    document.querySelectorAll(
      ".modal-background, .modal-close, .delete, .modal-cancel"
    ) || []
  ).forEach((e) => {
    const o = e.closest(".modal");
    o && e.addEventListener("click", () => closeModal(o));
  }),
    document.addEventListener("keydown", (e) => {
      "Escape" === e.key && closeAllModals();
    });
}
