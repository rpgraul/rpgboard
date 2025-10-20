let activePopover = null;
function removeActivePopover() {
  activePopover &&
    (activePopover.remove(),
    (activePopover = null),
    document.removeEventListener("click", handleOutsideClick, !0));
}
function handleOutsideClick(e) {
  activePopover && !activePopover.contains(e.target) && removeActivePopover();
}
export function showConfirmationPopover({
  targetElement: e,
  message: t,
  onConfirm: o,
}) {
  removeActivePopover();
  const n = document.createElement("div");
  (n.className = "confirmation-popover"),
    (n.innerHTML = `\n        <p>${t}</p>\n        <div class="buttons">\n            <button class="button is-danger is-small confirm-btn">Confirmar</button>\n            <button class="button is-small cancel-btn">Cancelar</button>\n        </div>\n    `),
    document.body.appendChild(n),
    (activePopover = n);
  const i = e.getBoundingClientRect(),
    l = n.getBoundingClientRect();
  n.style.position = "absolute";
  const c = window.innerWidth,
    d = window.innerHeight,
    a = window.scrollX,
    s = window.scrollY;
  let r, m;
  const v = c - i.right,
    u = i.left;
  v >= l.width + 8
    ? (r = i.right + a + 8)
    : u >= l.width + 8
    ? (r = i.left + a - l.width - 8)
    : ((r = i.left + a + i.width / 2 - l.width / 2),
      r < 8 ? (r = 8) : r + l.width > c - 8 && (r = c - l.width - 8));
  const p = d - i.bottom,
    g = i.top;
  p >= l.height + 8
    ? (m = i.bottom + s + 8)
    : g >= l.height + 8
    ? (m = i.top + s - l.height - 8)
    : ((m = i.bottom + s + 8),
      m + l.height > d - 8 && ((m = d - l.height - 8), m < 8 && (m = 8))),
    (n.style.left = `${r}px`),
    (n.style.top = `${m}px`),
    n.querySelector(".confirm-btn").addEventListener("click", () => {
      o(), removeActivePopover();
    }),
    n
      .querySelector(".cancel-btn")
      .addEventListener("click", removeActivePopover),
    setTimeout(() => {
      document.addEventListener("click", handleOutsideClick, !0);
    }, 0);
}
export function showToast(e, t = "is-info") {
  const o = document.createElement("div");
  (o.className = `toast notification ${t}`),
    (o.textContent = e),
    document.body.appendChild(o),
    setTimeout(() => {
      o.classList.add("is-active");
    }, 10),
    setTimeout(() => {
      o.classList.remove("is-active"),
        setTimeout(() => {
          o.remove();
        }, 300);
    }, 3e3);
}
export function showGlobalLoader(e) {
  let t = document.getElementById("global-loader");
  t ||
    ((t = document.createElement("div")),
    (t.id = "global-loader"),
    (t.className = "global-loader"),
    document.body.appendChild(t)),
    (t.style.display = e ? "block" : "none");
}
export function showOverlay(e) {
  let t = document.getElementById("loading-overlay");
  t ||
    ((t = document.createElement("div")),
    (t.id = "loading-overlay"),
    (t.className = "loading-overlay"),
    document.body.appendChild(t)),
    (t.style.display = e ? "flex" : "none");
}
function toggleFilterMenu() {
  const e = document.getElementById("filter-menu");
  e && e.classList.toggle("is-active");
}
export function initializeUI() {
  const e = document.getElementById("filter-toggle-btn");
  e && e.addEventListener("click", toggleFilterMenu);
}
