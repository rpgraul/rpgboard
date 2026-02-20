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
export function showToast(message, type = "is-info") {
  let container = document.getElementById("notification-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "notification-container";
    document.body.appendChild(container);
  }

  const notification = document.createElement("div");
  notification.className = `notification toast-notification ${type}`;

  // AQUI ESTÁ A CORREÇÃO: Usar innerHTML para interpretar as tags <strong> e <span>
  notification.innerHTML = `
        <button class="delete" type="button"></button>
        <div>${message}</div>
    `;

  // Reativa o evento de fechar no botão criado via HTML string
  const closeBtn = notification.querySelector(".delete");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      notification.classList.add("is-exit");
      setTimeout(() => notification.remove(), 300);
    });
  }

  container.prepend(notification);

  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.classList.add("is-exit");
      setTimeout(() => notification.remove(), 300);
    }
  }, 4000);
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
let activeSaves = 0;
let statusTimeout = null;

export function updateSyncStatus(isSaving, hasError = false) {
  let indicator = document.getElementById("sync-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "sync-indicator";
    document.body.appendChild(indicator);
  }

  if (hasError) {
    clearTimeout(statusTimeout);
    indicator.className = "is-error";
    indicator.innerHTML = "❌ Erro ao salvar";
    indicator.style.display = "flex";
    indicator.style.opacity = "1";
    return;
  }

  if (isSaving) {
    activeSaves++;
    clearTimeout(statusTimeout);
    indicator.className = "is-syncing";
    indicator.innerHTML = "☁️ Sincronizando...";
    indicator.style.display = "flex";
    indicator.style.opacity = "1";
  } else {
    activeSaves = Math.max(0, activeSaves - 1);
    if (activeSaves === 0) {
      indicator.className = "is-saved";
      indicator.innerHTML = "✅ Alterações salvas";

      statusTimeout = setTimeout(() => {
        indicator.style.opacity = "0";
        setTimeout(() => {
          if (activeSaves === 0) indicator.style.display = "none";
        }, 500);
      }, 3000);
    }
  }
}

export function initializeUI() {
  const e = document.getElementById("filter-toggle-btn");
  e && e.addEventListener("click", toggleFilterMenu);
}
