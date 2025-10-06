import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
export default Node.create({
  name: "statNode",
  group: "inline",
  inline: !0,
  atom: !0,
  addAttributes: () => ({ label: { default: null }, value: { default: null } }),
  parseHTML: () => [
    {
      tag: 'span[data-node-type="statNode"]',
      getAttrs: (t) => ({
        label: t.getAttribute("data-label"),
        value: t.getAttribute("data-value"),
      }),
    },
  ],
  renderHTML: ({ HTMLAttributes: t }) => [
    "span",
    mergeAttributes(t, { "data-node-type": "statNode" }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[stat\s+"([^"]+?)"\s+"([^"]+?)"\]\s$/,
        type: this.type,
        getAttributes: (t) => ({ label: t[1].trim(), value: t[2].trim() }),
      }),
    ];
  },
  addNodeView:
    () =>
    ({ node: t }) => {
      const e = document.createElement("span");
      (e.className = "shortcode-stat is-rendered-in-editor"),
        (e.contentEditable = "false");
      const a = document.createElement("strong");
      a.textContent = t.attrs.label ? `${t.attrs.label}: ` : "";
      const n = document.createElement("span");
      return (n.textContent = t.attrs.value || ""), e.append(a, n), { dom: e };
    },
});
