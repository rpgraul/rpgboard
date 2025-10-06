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
    (n.innerHTML = `
        <p>${t}</p>
        <div class="buttons">
            <button class="button is-danger is-small confirm-btn">Confirmar</button>
            <button class="button is-small cancel-btn">Cancelar</button>
        </div>
    `),
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

export function showAddTagsPopover({ targetElement, onAdd }) {
  removeActivePopover();
  const popover = document.createElement("div");
  popover.className = "confirmation-popover add-tags-popover";
  popover.innerHTML = `
        <p>Adicionar tags (separadas por vírgula):</p>
        <div class="control">
            <input type="text" class="input is-small" id="tags-input" placeholder="tag1, tag2, tag3">
        </div>
        <div class="buttons mt-3">
            <button class="button is-primary is-small add-btn">Adicionar</button>
            <button class="button is-small cancel-btn">Cancelar</button>
        </div>
    `;
  document.body.appendChild(popover);
  activePopover = popover;

  const targetRect = targetElement.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  popover.style.position = "absolute";

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  let left, top;

  // Horizontal positioning
  const spaceRight = viewportWidth - targetRect.right;
  const spaceLeft = targetRect.left;

  if (spaceRight >= popoverRect.width + 8) {
    left = targetRect.right + scrollX + 8;
  } else if (spaceLeft >= popoverRect.width + 8) {
    left = targetRect.left + scrollX - popoverRect.width - 8;
  } else {
    left = targetRect.left + scrollX + targetRect.width / 2 - popoverRect.width / 2;
    if (left < 8) left = 8;
    if (left + popoverRect.width > viewportWidth - 8) left = viewportWidth - popoverRect.width - 8;
  }

  // Vertical positioning
  const spaceBottom = viewportHeight - targetRect.bottom;
  const spaceTop = targetRect.top;

  if (spaceBottom >= popoverRect.height + 8) {
    top = targetRect.bottom + scrollY + 8;
  } else if (spaceTop >= popoverRect.height + 8) {
    top = targetRect.top + scrollY - popoverRect.height - 8;
  } else {
    top = targetRect.bottom + scrollY + 8;
    if (top + popoverRect.height > viewportHeight - 8) {
      top = viewportHeight - popoverRect.height - 8;
      if (top < 8) top = 8;
    }
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

  const tagsInput = popover.querySelector("#tags-input");
  tagsInput.focus();

  popover.querySelector(".add-btn").addEventListener("click", () => {
    onAdd(tagsInput.value);
    removeActivePopover();
  });

  popover.querySelector(".cancel-btn").addEventListener("click", removeActivePopover);

  setTimeout(() => {
    document.addEventListener("click", handleOutsideClick, true);
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
