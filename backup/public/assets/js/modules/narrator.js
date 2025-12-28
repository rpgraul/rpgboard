export const NARRATOR_FILTER_LABELS = {
  VISIBLE: "Visível para jogadores",
  HIDDEN: "Oculto dos jogadores",
};
export function updateNarratorUI(o) {
  const r = document.querySelectorAll(".narrator-only"),
    t = document.getElementById("narrator-login-btn");
  r.forEach((r) => {
    r.classList.toggle("is-hidden", !o);
  }),
    t && (t.textContent = o ? "Sair" : "Entrar como Narrador");
}
