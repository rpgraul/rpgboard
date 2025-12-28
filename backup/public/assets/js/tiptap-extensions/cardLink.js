import { Node, mergeAttributes } from "@tiptap/core";
import { Suggestion } from "@tiptap/suggestion";
export default Node.create({
  name: "cardLink",
  group: "inline",
  inline: !0,
  atom: !0,
  draggable: !0,
  selectable: !0,
  addAttributes: () => ({
    cardName: {
      default: null,
      parseHTML: (e) => e.dataset.cardName,
      renderHTML: (e) => ({ "data-card-name": e.cardName }),
    },
  }),
  parseHTML: () => [
    {
      tag: "span.card-link",
      getAttrs: (e) => ({ cardName: e.dataset.cardName }),
    },
  ],
  renderHTML: ({ node: e, HTMLAttributes: t }) => [
    "span",
    mergeAttributes(t, {
      class: "card-link",
      "data-card-name": e.attrs.cardName,
    }),
    `@${e.attrs.cardName}`,
  ],
  addCommands() {
    return {
      setCardLink:
        (e) =>
        ({ commands: t }) =>
          t.insertContent({ type: this.name, attrs: { cardName: e } }),
    };
  },
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor: e }) => {
        const { state: t } = e,
          { selection: a } = t,
          { empty: n, $anchor: r } = a;
        if (!n) return !1;
        const s = r.nodeBefore;
        if (s && s.type.name === this.name) {
          const t = r.pos - s.nodeSize;
          return e.chain().deleteRange({ from: t, to: r.pos }).run(), !0;
        }
        return !1;
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "@",
        command: ({ editor: e, range: t, props: a }) => {
          e.chain()
            .focus()
            .insertContentAt(t, [
              { type: this.name, attrs: { cardName: a.id } },
              { type: "text", text: " " },
            ])
            .run();
        },
        items: this.options.suggestion.items,
        render: () => {
          let e, t, a;
          const n = (e, t) => {
            (t.innerHTML = ""),
              e.length
                ? ((t.style.display = ""),
                  e.forEach((e) => {
                    const n = document.createElement("div");
                    n.classList.add("tiptap-suggestion-item"),
                      (n.textContent = e.title),
                      n.addEventListener("mousedown", (t) => {
                        t.preventDefault(), a.command({ id: e.title });
                      }),
                      t.appendChild(n);
                  }))
                : (t.style.display = "none");
          };
          return {
            onStart: (r) => {
              (a = r),
                (e = document.createElement("div")),
                e.classList.add("tiptap-suggestion-list"),
                n(r.items, e),
                r.items.length &&
                  (t = tippy("body", {
                    getReferenceClientRect: r.clientRect,
                    appendTo: () => document.body,
                    content: e,
                    showOnCreate: !0,
                    interactive: !0,
                    trigger: "manual",
                    placement: "bottom-start",
                  }));
            },
            onUpdate: (r) => {
              (a = r),
                n(r.items, e),
                r.items.length
                  ? t &&
                    t[0] &&
                    t[0].setProps({ getReferenceClientRect: r.clientRect })
                  : t && t[0] && t[0].hide();
            },
            onKeyDown: ({ event: e }) =>
              "Escape" === e.key && (t && t[0] && t[0].hide(), !0),
            onExit: () => {
              t && t[0] && t[0].destroy();
            },
          };
        },
      }),
    ];
  },
});
