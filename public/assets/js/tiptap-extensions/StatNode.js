import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
export default Node.create({
  name: "statNode",
  group: "inline",
  inline: !0,
  atom: !0,
  addAttributes: () => ({
    label: { default: null },
    value: { default: null },
    position: { default: "" },
    isHidden: { default: !1 },
  }),
  parseHTML: () => [
    {
      tag: 'span[data-node-type="statNode"]',
      getAttrs: (t) => ({
        label: t.getAttribute("data-label"),
        value: t.getAttribute("data-value"),
        position: t.getAttribute("data-position") || "",
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
      "data-position": e.attrs.position,
      "data-is-hidden": e.attrs.isHidden,
    }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[stat\s+"([^"]*)"\s+"([^"]*)"(?:\s+(.*?))?\]\s$/,
        type: this.type,
        getAttributes: (t) => {
          const e = t[3] || "";
          return {
            label: t[1].trim(),
            value: t[2].trim(),
            isHidden: e.includes("#"),
            position:
              ["left", "right", "bottom", "top"].find((t) => e.includes(t)) ||
              "",
          };
        },
      }),
    ];
  },
  addNodeView() {
    return ({ node: t, getPos: e }) => {
      const a = document.createElement("span");
      (a.className = "shortcode-stat is-rendered-in-editor"),
        t.attrs.isHidden && a.classList.add("is-hidden-preview"),
        (a.contentEditable = "false");
      const n = document.createElement("strong");
      n.textContent = t.attrs.label ? `${t.attrs.label}: ` : "";
      const o = document.createElement("span");
      return (
        (o.textContent = t.attrs.value || ""),
        t.attrs.position &&
          (o.textContent += ` (${t.attrs.position.toUpperCase()})`),
        a.append(n, o),
        a.addEventListener("dblclick", () => {
          document.dispatchEvent(
            new CustomEvent("edit-shortcode", {
              detail: { type: this.name, attrs: t.attrs, pos: e() },
            })
          );
        }),
        { dom: a }
      );
    };
  },
});