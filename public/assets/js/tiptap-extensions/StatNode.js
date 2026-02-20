import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
export default Node.create({
  name: "statNode",
  group: "inline",
  inline: !0,
  atom: !0,
  addAttributes: () => ({
    label: { default: null },
    value: { default: null },
    isHidden: { default: false },
  }),
  parseHTML: () => [
    {
      tag: 'span[data-node-type="statNode"]',
      getAttrs: (t) => ({
        label: t.getAttribute("data-label"),
        value: t.getAttribute("data-value"),
        isHidden: "true" === t.getAttribute("data-is-hidden"),
      }),
    },
  ],
  renderHTML: ({ HTMLAttributes: t, node: e }) => [
    "span",
    mergeAttributes(t, {
      "data-node-type": "statNode",
      "data-label": e.attrs.label,
      "data-value": e.attrs.value,
      "data-is-hidden": e.attrs.isHidden,
    }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[stat\s+"([^"]*)"\s+"([^"]*)"(?:\s+(#))?\]\s$/,
        getAttributes: (t) => ({
          label: t[1].trim(),
          value: t[2].trim(),
          isHidden: t[3] === "#",
        }),
      }),
    ];
  },
  addNodeView() {
    return ({ node: t, getPos: e, editor: r }) => {
      const a = document.createElement("span");
      a.className = "shortcode-stat is-rendered-in-editor";
      if (t.attrs.isHidden) a.classList.add("is-hidden-preview");
      a.contentEditable = "false";

      const n = document.createElement("strong");
      n.textContent = t.attrs.label ? `${t.attrs.label}: ` : "";

      const i = document.createElement("input");
      i.type = "text";
      i.className = "stat-value-input-inline";
      i.value = t.attrs.value || "";
      i.style.width = `${Math.max(2, (i.value.length || 1) + 1)}ch`;

      i.addEventListener("input", () => {
        i.style.width = `${Math.max(2, i.value.length + 1)}ch`;
      });

      i.addEventListener("change", () => {
        if (typeof e === "function") {
          r.view.dispatch(
            r.view.state.tr.setNodeMarkup(e(), undefined, {
              ...t.attrs,
              value: i.value,
            })
          );
        }
      });

      i.addEventListener("click", (e) => e.stopPropagation());
      i.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          i.blur();
          r.commands.focus();
        }
      });

      a.append(n, i);

      a.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        document.dispatchEvent(
          new CustomEvent("edit-shortcode", {
            detail: { type: this.name, attrs: t.attrs, pos: e() },
          })
        );
      });

      return {
        dom: a,
        ignoreMutation: () => true,
        stopEvent: (e) => e.target.tagName === "INPUT"
      };
    };
  },
});
