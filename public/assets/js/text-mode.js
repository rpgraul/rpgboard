import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import CardLink from "./tiptap-extensions/cardLink.js";
import StatNode from "./tiptap-extensions/StatNode.js";
import HpNode from "./tiptap-extensions/HpNode.js";
import MoneyNode from "./tiptap-extensions/MoneyNode.js";
import CountNode from "./tiptap-extensions/CountNode.js";
import NotaShortcode from "./tiptap-extensions/notaShortcode.js";
import {
  listenToItems,
  updateItem,
  addItem,
  removeImageFromItem,
  deleteItem,
  deleteItems,
  updateItemsVisibility,
  addTagsToItems,
} from "./modules/firebaseService.js";
import { isNarrator, initializeAuth } from "./modules/auth.js";
import { showConfirmationPopover, showToast } from "./modules/ui.js";
let sideViewSaveTimeout,
  sideViewEditor = null,
  currentSideViewCardId = null;
function preParseShortcodesForEditor(e) {
  if (!e) return "";
  let t = e;
  (t = t.replace(
    /[\[]stat\s+([^\\]+?):\s*([^\\]*?)\s*[\]]/gi,
    (e, t, i) =>
      `<span data-node-type="statNode" data-label="${t.trim()}" data-value="${i.trim()}"></span>`
  )),
    (t = t.replace(
      /[\[]stat\s+\"([^\"]+)\"\s+\"([^\"]+)\"\s*[\]]/gi,
      (e, t, i) =>
        `<span data-node-type="statNode" data-label="${t}" data-value="${i}"></span>`
    )),
    (t = t.replace(
      /[\[]hp\s+max=(\\\\d+)\s+current=(\\\\d+)\s*[\]]/gi,
      (e, t, i) =>
        `<span data-node-type="hpNode" data-max="${t}" data-current="${i}"></span>`
    )),
    (t = t.replace(
      /[\[]money\s+current=([\\d.]+)(?:\s+([^\\]*?))?\s*[\]]/gi,
      (e, t, i = "") => {
        let s = "";
        if (i) {
          const e = i.trim().split(/\s+/),
            t = ["left", "right", "bottom", "top"];
          s = e.find((e) => !t.includes(e.toLowerCase())) || "";
        }
        return `<span data-node-type="moneyNode" data-current="${t}" data-currency="${s}"></span>`;
      }
    ));
  const i = /\"([^\"]+)\"|\\S+/g;
  return (
    (t = t.replace(/[\[](\*?)count\s+([^\\]+)[\]]/gi, (e, t, s) => {
      const o = "*" === t,
        a = ((e) => {
          const t = [];
          let s;
          for (; null !== (s = i.exec(e)); ) t.push(s[1] || s[0]);
          return t;
        })(s),
        n = ((e) => {
          const t = {};
          return (
            e.forEach((e) => {
              const i = e.split("=");
              2 === i.length &&
                (t[i[0].toLowerCase()] = i[1].replace(/^[\\]"|[\\]"$/g, ""));
            }),
            t
          );
        })(a),
        r = a.find((e) => !e.includes("=")) || "",
        d = n.max || 0,
        c = n.current || 0,
        l = n.icon || "";
      let u = n.theme || "number";
      return (
        a.includes("checkbox") && (u = "checkbox"),
        `<span data-node-type="countNode" data-label="${r}" data-max="${d}" data-current="${c}" data-theme="${u}" data-icon="${l}" data-is-overlay="${o}"></span>`
      );
    })),
    t
  );
}
let isProcessingUpdate = !1;
function forceEditorReparse(e, t) {
  if (isProcessingUpdate) return;
  isProcessingUpdate = !0;
  const i = preParseShortcodesForEditor(t || "");
  e.commands.setContent(i, !0),
    setTimeout(() => {
      isProcessingUpdate = !1;
    }, 0);
}
function saveSideViewCard() {
  if (!currentSideViewCardId || !sideViewEditor) return;
  const e = document.querySelector(".editor-column.is-side-view");
  if (!e) return;
  const t = allCards.find((e) => e.id === currentSideViewCardId);
  if (!t) return;
  const i = {
    titulo: e.querySelector("#side-view-title").textContent.trim(),
    tags: e
      .querySelector("#side-view-tags")
      .textContent.split(",")
      .map((e) => e.trim())
      .filter(Boolean),
    descricao: e
      .querySelector("#side-view-description")
      .innerText.trim()
      .replace(/\n/g, "<br>"),
    conteudo: sideViewEditor.getHTML(),
  };
  isNarrator() &&
    (i.isVisibleToPlayers = e.querySelector("#side-view-visibility").checked);
  Object.keys(i).some((e) =>
    "isVisibleToPlayers" === e
      ? i.isVisibleToPlayers !== (!1 !== t.isVisibleToPlayers)
      : JSON.stringify(i[e]) !==
        JSON.stringify(t[e] || ("tags" === e ? [] : ""))
  ) &&
    updateItem({ id: currentSideViewCardId }, i)
      .then(() => {
        console.log(`Card da aba lateral '${i.titulo}' salvo.`);
        const e = allCards.find((e) => e.id === currentSideViewCardId);
        e && Object.assign(e, i);
      })
      .catch((e) => console.error("Erro ao salvar card da aba lateral:", e));
}
document.addEventListener("DOMContentLoaded", () => {
  const e = document.querySelector("#editor"),
    t = document.querySelector(".tiptap-toolbar"),
    i = document.getElementById("add-card-btn"),
    s = document.getElementById("search-input"),
    o =
      (document.getElementById("search-suggestions"),
      document.getElementById("card-list")),
    a = document.getElementById("text-editor-container"),
    n = document.getElementById("empty-state"),
    r = document.getElementById("card-avatar"),
    d = document.getElementById("card-title"),
    c = document.getElementById("card-tags"),
    l = document.getElementById("card-description"),
    u = document.getElementById("card-visibility-editor"),
    m = document.getElementById("card-visibility-editor-container"),
    p = document.getElementById("delete-card-btn"),
    g = document.getElementById("image-modal"),
    v = document.getElementById("image-modal-img"),
    h = document.getElementById("image-upload-input"),
    y = document.getElementById("remove-image-btn"),
    f = document.getElementById("bulk-actions-container"),
    b = document.getElementById("bulk-delete-btn"),
    E = document.getElementById("bulk-add-tags-btn"),
    w = document.getElementById("bulk-visibility-btn");
  let k,
    L = [],
    I = [],
    S = null,
    C = !1,
    T = -1;
  function x() {
    if (!S) return;
    const e = L.find((e) => e.id === S);
    if (!e) return;
    const t = {
      titulo: d.textContent.trim(),
      tags: c.textContent
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
      descricao: l.innerText.trim().replace(/\n/g, "<br>"),
      conteudo: V.getHTML(),
    };
    isNarrator() && (t.isVisibleToPlayers = u.checked);
    (t.titulo !== (e.titulo || "") ||
      JSON.stringify(t.tags) !== JSON.stringify(e.tags || []) ||
      t.descricao !== (e.descricao || "") ||
      t.conteudo !== (e.conteudo || "") ||
      (isNarrator() &&
        t.isVisibleToPlayers !== (!1 !== e.isVisibleToPlayers))) &&
      updateItem({ id: S }, t)
        .then(() => {
          console.log(`Card '${t.titulo}' salvo.`);
          const e = L.find((e) => e.id === S);
          e && Object.assign(e, t);
        })
        .catch((e) => console.error("Erro ao salvar card:", e));
  }
  const N = () => {
      clearTimeout(k), (k = setTimeout(x, 500));
    },
    V = new Editor({
      element: e,
      extensions: [
        StarterKit,
        Highlight,
        Underline,
        Link.configure({ openOnClick: !1 }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Extension.create({
          name: "customKeybindings",
          addKeyboardShortcuts: () => ({
            "Mod-Shift-h": () => {
              const { view: e, state: t } = V,
                { from: i, to: s } = t.selection;
              return i === s
                ? (showToast("Selecione um texto para ocultar.", "is-warning"),
                  !1)
                : (V.chain()
                    .focus()
                    .insertContentAt(
                      { from: i, to: s },
                      `[#]${t.doc.textBetween(i, s)}[/#]`
                    )
                    .run(),
                  showToast("Texto ocultado para jogadores", "is-success"),
                  !0);
            },
            Enter: () => V.commands.splitBlock(),
          }),
        }),
        CardLink.configure({
          suggestion: {
            items: ({ query: e }) =>
              L.filter((t) =>
                t.titulo.toLowerCase().startsWith(e.toLowerCase())
              )
                .map((e) => ({ id: e.titulo, title: e.titulo }))
                .slice(0, 5),
          },
        }),
        StatNode,
        HpNode,
        MoneyNode,
        CountNode,
        NotaShortcode,
      ],
      editorProps: {
        attributes: { class: "ProseMirror" },
        handleKeyDown: (e, t) => (
          ("]" === t.key || ("/" === t.key && t.shiftKey)) &&
            setTimeout(() => {
              const e = V.getHTML();
              ((e.includes("[stat") && e.includes("]")) ||
                (e.includes("[hp") && e.includes("]")) ||
                (e.includes("[money") && e.includes("]")) ||
                (e.includes("[count") && e.includes("]")) ||
                (e.includes("[*count") && e.includes("]")) ||
                (e.includes("[nota") && e.includes("[/nota]")) ||
                (e.includes("[hide") && e.includes("[/hide]")) ||
                (e.includes("[#") && e.includes("[/#]"))) &&
                forceEditorReparse(V, e);
            }, 10),
          !1
        ),
      },
      content: "",
      onUpdate: N,
      onSelectionUpdate: ({ editor: e }) => {
        t.querySelectorAll("button[data-action]").forEach((t) => {
          const i = t.dataset.action,
            s = t.dataset.level ? { level: parseInt(t.dataset.level) } : {},
            o = t.dataset.align ? { textAlign: t.dataset.align } : {};
          let a = !1;
          if (i.startsWith("toggle")) {
            const t = i.replace("toggle", "").toLowerCase();
            a = e.isActive(t, s);
          } else
            "setTextAlign" === i
              ? (a = e.isActive(o))
              : "setLink" === i && (a = e.isActive("link"));
          t.dataset.activeState = a ? "true" : "false";
        });
      },
    });
  function B() {
    m && m.classList.toggle("is-hidden", !isNarrator()), P();
  }
  function $() {
    (a.style.display = "none"), (n.style.display = "block"), (S = null);
  }
  function P() {
    const e = s.value.toLowerCase();
    const t = (
      isNarrator() ? L : L.filter((e) => !1 !== e.isVisibleToPlayers)
    ).filter(
      (t) =>
        !e ||
        (t.titulo || "").toLowerCase().includes(e) ||
        (t.tags || []).some((t) => t.toLowerCase().includes(e))
    );
    var i;
    (i = t),
      (o.innerHTML = ""),
      i.forEach((e) => {
        const t = document.createElement("li");
        t.dataset.cardId = e.id;
        const i = document.createElement("div");
        (i.className = "menu-item-container"),
          e.id === S && i.classList.add("is-active");
        const s = document.createElement("label");
        s.className = "card-select-label";
        const a = document.createElement("input");
        (a.type = "checkbox"),
          (a.className = "card-select-checkbox"),
          (a.dataset.cardId = e.id),
          (a.checked = I.includes(e.id)),
          a.checked && s.classList.add("is-checked"),
          s.appendChild(a);
        const n = document.createElement("a");
        if (
          ((n.textContent = e.titulo),
          (n.dataset.cardId = e.id),
          isNarrator() &&
            !1 === e.isVisibleToPlayers &&
            n.classList.add("is-invisible-to-players"),
          i.appendChild(s),
          i.appendChild(n),
          isNarrator() && !1 === e.isVisibleToPlayers)
        ) {
          const t = document.createElement("button");
          (t.className = "card-visibility-btn"),
            (t.innerHTML = '<i class="fas fa-eye"></i>'),
            (t.dataset.cardId = e.id),
            i.appendChild(t);
        }
        const r = document.createElement("button");
        (r.className = "card-delete-btn"),
          (r.innerHTML = '<i class="fas fa-trash"></i>'),
          (r.dataset.cardId = e.id),
          i.appendChild(r),
          t.appendChild(i),
          o.appendChild(t);
      });
  }
  function q() {
    f.classList.toggle("is-hidden", 0 === I.length);
  }
  function A(e) {
    const t = L.find((t) => t.id === e);
    t
      ? ((S = t.id),
        (d.textContent = t.titulo || ""),
        (c.textContent = Array.isArray(t.tags) ? t.tags.join(", ") : ""),
        (l.innerText = (t.descricao || "").replace(/<br\s*\/?>>/gi, "\n")),
        V.off("update", N),
        forceEditorReparse(V, t.conteudo || ""),
        V.on("update", N),
        isNarrator() && (u.checked = !1 !== t.isVisibleToPlayers),
        (r.style.backgroundImage = t.url ? `url(${t.url})` : "none"),
        (r.querySelector(".placeholder-icon").style.display = t.url
          ? "none"
          : "block"),
        (a.style.display = "block"),
        (n.style.display = "none"),
        P(),
        history.pushState({ cardId: t.id }, "", `#${t.id}`))
      : $();
  }
  t.addEventListener("click", (e) => {
    const t = e.target.closest("button[data-action]");
    if (!t) return;
    const i = t.dataset.action,
      s = V.chain().focus();
    switch (i) {
      case "undo":
        s.undo().run();
        break;
      case "redo":
        s.redo().run();
        break;
      case "toggleBold":
        s.toggleBold().run();
        break;
      case "toggleItalic":
        s.toggleItalic().run();
        break;
      case "toggleStrike":
        s.toggleStrike().run();
        break;
      case "toggleBulletList":
        s.toggleBulletList().run();
        break;
      case "toggleOrderedList":
        s.toggleOrderedList().run();
        break;
      case "toggleHighlight":
        s.toggleHighlight().run();
        break;
      case "toggleHeading":
        s.toggleHeading({ level: parseInt(t.dataset.level) }).run();
        break;
      case "setTextAlign":
        s.setTextAlign(t.dataset.align).run();
        break;
      case "setLink":
        const e = window.prompt("URL", V.getAttributes("link").href || "");
        if (null === e) return;
        "" === e ? s.unsetLink().run() : s.setLink({ href: e }).run();
    }
  }),
    window.addEventListener("narratorStatusChange", B),
    s.addEventListener("input", P),
    o.addEventListener("click", (e) => {
      const t = e.target.closest("li");
      if (!t) return;
      const i = t.dataset.cardId,
        s = e.target.closest(".card-delete-btn"),
        a = e.target.closest(".card-visibility-btn"),
        n = e.target.closest("a"),
        r = e.target.closest(".card-select-label");
      if (s) {
        e.preventDefault();
        const t = L.find((e) => e.id === i);
        t &&
          showConfirmationPopover({
            targetElement: s,
            message: `Deletar "${t.titulo}"?`,
            onConfirm: () => {
              deleteItem(t).then(() => {
                showToast(`Card "${t.titulo}" deletado.`, "is-success"),
                  i === S && $();
              });
            },
          });
      } else {
        if (a)
          return (
            e.preventDefault(),
            void updateItem({ id: i }, { isVisibleToPlayers: !0 })
          );
        if (
          e.ctrlKey ||
          e.shiftKey ||
          (r && o.classList.contains("selection-active"))
        ) {
          e.preventDefault(), o.classList.add("selection-active");
          const s = t.querySelector(".card-select-checkbox");
          if (!s) return;
          const a = Array.from(o.querySelectorAll(".card-select-checkbox")),
            n = a.indexOf(s);
          if (e.shiftKey && -1 !== T) {
            const e = Math.min(T, n),
              t = Math.max(T, n);
            for (let i = e; i <= t; i++)
              if (!a[i].checked) {
                (a[i].checked = !0),
                  a[i].closest("label").classList.add("is-checked");
                const e = a[i].dataset.cardId;
                I.includes(e) || I.push(e);
              }
          } else
            (s.checked = !s.checked),
              s.closest("label").classList.toggle("is-checked", s.checked),
              s.checked
                ? I.includes(i) || I.push(i)
                : (I = I.filter((e) => e !== i));
          (T = n),
            q(),
            0 === I.length && o.classList.remove("selection-active");
        } else n && A(i);
      }
    }),
    [d, c, l, u].forEach((e) => e.addEventListener("input", N)),
    r.addEventListener("click", () => {
      const e = L.find((e) => e.id === S);
      e?.url ? ((v.src = e.url), g.classList.add("is-active")) : h.click();
    }),
    h.addEventListener(
      "change",
      (e) =>
        e.target.files?.[0] &&
        (async function (e) {
          if (S && e) {
            g.classList.remove("is-active");
            try {
              await updateItem({ id: S }, {}, e);
            } catch (e) {
              console.error("Erro no upload da imagem:", e);
            }
          }
        })(e.target.files[0])
    ),
    y.addEventListener("click", () => {
      const e = L.find((e) => e.id === S);
      e &&
        showConfirmationPopover({
          targetElement: y,
          message: "Remover a imagem?",
          onConfirm: () => {
            removeImageFromItem(e), g.classList.remove("is-active");
          },
        });
    }),
    g
      .querySelector(".modal-background")
      .addEventListener("click", () => g.classList.remove("is-active")),
    g
      .querySelector(".modal-close")
      .addEventListener("click", () => g.classList.remove("is-active")),
    p.addEventListener("click", () => {
      const e = L.find((e) => e.id === S);
      e &&
        showConfirmationPopover({
          targetElement: p,
          message: "Deletar este card?",
          onConfirm: () => deleteItem(e).then($),
        });
    }),
    i.addEventListener("click", async () => {
      i.disabled = !0;
      try {
        const e = await addItem({
            titulo: "Novo Card",
            conteudo: "<p></p>",
            tags: [],
            isVisibleToPlayers: !isNarrator(),
          }),
          t = () => {
            L.some((t) => t.id === e) &&
              (A(e),
              d.focus(),
              document.removeEventListener("cardListUpdated", t));
          };
        document.addEventListener("cardListUpdated", t);
      } finally {
        i.disabled = !1;
      }
    }),
    b.addEventListener("click", () => {
      0 !== I.length &&
        showConfirmationPopover({
          targetElement: b,
          message: `Deletar ${I.length} cards?`,
          onConfirm: async () => {
            try {
              await deleteItems(I),
                showToast(`${I.length} cards deletados.`, "is-success"),
                I.includes(S) && $(),
                (I = []),
                q(),
                o.classList.remove("selection-active");
            } catch (e) {
              console.error("Erro ao deletar cards em massa:", e),
                showToast("Erro ao deletar cards.", "is-danger");
            }
          },
        });
    }),
    E.addEventListener("click", () => {
      if (0 === I.length) return;
      const e = prompt("Adicionar tags (separadas por vírgula):");
      if (e) {
        const t = e
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        t.length > 0 &&
          addTagsToItems(I, t)
            .then(() => {
              showToast(`Tags adicionadas a ${I.length} cards.`, "is-success");
            })
            .catch((e) => {
              console.error("Erro ao adicionar tags em massa:", e),
                showToast("Erro ao adicionar tags.", "is-danger");
            });
      }
    });
  let H = null;
  function M() {
    H && (H.remove(), (H = null), document.removeEventListener("click", j, !0));
  }
  function j(e) {
    !H ||
      H.contains(e.target) ||
      e.target.closest("#bulk-visibility-btn") ||
      M();
  }
  w.addEventListener("click", async (e) => {
    if (0 === I.length) return;
    e.stopPropagation();
    const t = await (function ({ targetElement: e }) {
      return (
        M(),
        new Promise((t) => {
          const i = document.createElement("div");
          (i.className = "confirmation-popover"),
            (i.innerHTML =
              '\n                <p>Alterar visibilidade:</p>\n                <div class="buttons">\n                    <button class="button is-primary is-small" id="show-to-players-popover-btn">Mostrar para Jogadores</button>\n                    <button class="button is-danger is-small" id="hide-from-players-popover-btn">Ocultar dos Jogadores</button>\n                </div>\n            '),
            document.body.appendChild(i),
            (H = i);
          const s = e.getBoundingClientRect();
          (i.style.position = "absolute"),
            setTimeout(() => {
              const e = i.getBoundingClientRect();
              (i.style.top = s.top + window.scrollY - e.height - 8 + "px"),
                (i.style.left = s.right + window.scrollX - e.width + "px"),
                parseFloat(i.style.left) < 0 &&
                  (i.style.left = `${s.left + window.scrollX}px`);
            }, 0);
          const o = (e) => {
            M(), t(e);
          };
          i
            .querySelector("#show-to-players-popover-btn")
            .addEventListener("click", () => o(!0)),
            i
              .querySelector("#hide-from-players-popover-btn")
              .addEventListener("click", () => o(!1)),
            setTimeout(() => {
              document.addEventListener("click", j, !0);
            }, 0);
        })
      );
    })({ targetElement: w });
    null !== t &&
      updateItemsVisibility(I, t)
        .then(() => {
          showToast(
            `Visibilidade alterada para ${I.length} cards.`,
            "is-success"
          );
        })
        .catch((e) => {
          console.error("Erro ao alterar visibilidade em massa:", e),
            showToast("Erro ao alterar visibilidade.", "is-danger");
        });
  }),
    document.addEventListener("keydown", (e) => {
      "Escape" === e.key &&
        ((I = []), o.classList.remove("selection-active"), P(), q());
    }),
    initializeAuth(),
    listenToItems((e) => {
      if (
        ((L = e.docs
          .map((e) => ({ id: e.id, ...e.data() }))
          .sort((e, t) => (e.titulo || "").localeCompare(t.titulo || ""))),
        document.dispatchEvent(new CustomEvent("cardListUpdated")),
        C)
      )
        P();
      else {
        C = !0;
        const e = window.location.hash.substring(1);
        e && L.some((t) => t.id === e) ? A(e) : P();
      }
      !(S && L.some((e) => e.id === S)) && S && $();
    }),
    window.addEventListener("popstate", (e) => {
      const t = e.state?.cardId || window.location.hash.substring(1);
      t && L.some((e) => e.id === t) ? A(t) : $();
    }),
    $(),
    B();
  const O = document.getElementById("shortcode-generator-modal"),
    U = document.getElementById("shortcode-generator-btn"),
    D = document.getElementById("shortcode-type"),
    K = document.querySelectorAll(".shortcode-options"),
    R = O.querySelector(".button.is-success"),
    F = O.querySelector(".button:not(.is-success)"),
    J = O.querySelector(".delete");
  function W() {
    O.classList.remove("is-active");
  }
  U.addEventListener("click", function () {
    O.classList.add("is-active");
  }),
    J.addEventListener("click", W),
    F.addEventListener("click", W),
    D.addEventListener("change", function () {
      const e = D.value;
      K.forEach((t) => {
        t.classList.toggle("is-hidden", t.id !== `shortcode-options-${e}`);
      });
    }),
    R.addEventListener("click", function () {
      let e = "",
        t = {};
      switch (D.value) {
        case "stat":
          (e = "statNode"),
            (t = {
              label: document.getElementById("stat-label").value || "Label",
              value: document.getElementById("stat-value").value || "10",
            });
          break;
        case "hp":
          (e = "hpNode"),
            (t = {
              max: parseInt(document.getElementById("hp-max").value || "100"),
              current: parseInt(
                document.getElementById("hp-current").value || "100"
              ),
            });
          break;
        case "count":
          (e = "countNode"),
            (t = {
              label: document.getElementById("count-label").value || "Item",
              max: parseInt(
                document.getElementById("count-value").value || "0"
              ),
              current: parseInt(
                document.getElementById("count-value").value || "0"
              ),
              isOverlay: !0,
            });
          break;
        case "money":
          (e = "moneyNode"),
            (t = {
              current: parseFloat(
                document.getElementById("money-value").value || "0"
              ),
              currency: "",
            });
      }
      e &&
        (V.chain().focus().insertContent({ type: e, attrs: t }).run(),
        setTimeout(() => {
          forceEditorReparse(V, V.getHTML());
        }, 100)),
        W();
    }),
    O.querySelector(".modal-background").addEventListener("click", W);
});
const debounceSaveSideView = () => {
  clearTimeout(sideViewSaveTimeout),
    (sideViewSaveTimeout = setTimeout(saveSideViewCard, 500));
};
function openSideView(e) {
  const t = document.querySelector(".editor-layout");
  let i = document.querySelector(".editor-column.is-side-view");
  sideViewEditor && (sideViewEditor.destroy(), (sideViewEditor = null)),
    i && (i.remove(), t.classList.remove("side-view-active"));
  const s = allCards.find((t) => t.id === e);
  if (!s)
    return void showToast(`Card com ID "${e}" não encontrado.`, "is-danger");
  (currentSideViewCardId = s.id),
    (i = document.createElement("div")),
    (i.className = "editor-column is-side-view"),
    t.appendChild(i),
    (i.innerHTML = `\n        <div class="side-view-header">\n            <h3 id="side-view-title" class="title is-4" contenteditable="true">${
      s.titulo
    }</h3>\n            <button class="delete is-large close-side-view" aria-label="close"></button>\n        </div>\n        <div id="side-view-tags" contenteditable="true" class="editable-field" data-placeholder="Tags..." spellcheck="false">${
      Array.isArray(s.tags) ? s.tags.join(", ") : ""
    }</div>\n        ${
      isNarrator()
        ? `\n            <div class="field narrator-only">\n                <label class="checkbox narrator-control">\n                    <input type="checkbox" id="side-view-visibility" ${
            !1 !== s.isVisibleToPlayers ? "checked" : ""
          }>\n                    <span class="switch-track"></span><span class="switch-label-text">Visível</span>\n                </label>\n            </div>`
        : ""
    }\n        <hr>\n        <div id="side-view-editor-container"></div>\n        <hr>\n        <div id="side-view-description" contenteditable="true" class="editable-field" data-placeholder="Descrição...">${(
      s.descricao || ""
    ).replace(/<br\s*\/?>>/gi, "\n")}</div>\n    `);
  const o = preParseShortcodesForEditor(s.conteudo || ""),
    a = new Editor({
      element: i.querySelector("#side-view-editor-container"),
      extensions: [
        StarterKit,
        Highlight,
        Underline,
        Link.configure({ openOnClick: !1 }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        CardLink.configure({
          suggestion: {
            items: ({ query: e }) =>
              allCards
                .filter((t) =>
                  t.titulo.toLowerCase().startsWith(e.toLowerCase())
                )
                .map((e) => ({ id: e.id, title: e.titulo }))
                .slice(0, 5),
          },
        }),
        StatNode,
        HpNode,
        MoneyNode,
        CountNode,
        NotaShortcode,
      ],
      content: o,
      editorProps: { attributes: { class: "ProseMirror" } },
      onUpdate: debounceSaveSideView,
    });
  (sideViewEditor = a),
    ["#side-view-title", "#side-view-tags", "#side-view-description"].forEach(
      (e) => {
        i.querySelector(e).addEventListener("input", debounceSaveSideView);
      }
    ),
    isNarrator() &&
      i
        .querySelector("#side-view-visibility")
        .addEventListener("change", debounceSaveSideView),
    i.querySelector(".close-side-view").addEventListener("click", () => {
      sideViewEditor && sideViewEditor.destroy(),
        (sideViewEditor = null),
        (currentSideViewCardId = null),
        i.remove(),
        t.classList.remove("side-view-active");
    }),
    i.addEventListener("click", (e) => {
      const t = e.target.closest(".card-link");
      if (t) {
        e.preventDefault();
        const i = t.dataset.cardName,
          s = allCards.find((e) => e.titulo === i);
        if (s) {
          if (s.id === currentSideViewCardId) return;
          saveSideViewCard(),
            loadCard(currentSideViewCardId),
            openSideView(s.id);
        }
      }
    }),
    t.classList.add("side-view-active");
}
