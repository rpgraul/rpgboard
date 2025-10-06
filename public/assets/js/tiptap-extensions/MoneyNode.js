import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
export default Node.create({
  name: "moneyNode",
  group: "inline",
  inline: !0,
  atom: !0,
  addAttributes: () => ({ current: { default: 0 }, currency: { default: "" } }),
  parseHTML: () => [
    {
      tag: 'span[data-node-type="moneyNode"]',
      getAttrs: (t) => ({
        current: parseFloat(t.getAttribute("data-current")) || 0,
        currency: t.getAttribute("data-currency") || "",
      }),
    },
  ],
  renderHTML: ({ HTMLAttributes: t }) => [
    "span",
    mergeAttributes(t, { "data-node-type": "moneyNode" }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[money\s+current=([\d.]+)(?:\s+([^\]]*?))?\s*\]\s*$/,
        type: this.type,
        getAttributes: (t) => {
          const e = parseFloat(t[1]) || 0;
          let r = "";
          if (t[2]) {
            const e = t[2].trim().split(/\s+/),
              n = ["left", "right", "bottom", "top"];
            r = e.find((t) => !n.includes(t.toLowerCase())) || "";
          }
          return { current: e, currency: r };
        },
      }),
    ];
  },
  addNodeView:
    () =>
    ({ node: t }) => {
      const e = document.createElement("span");
      (e.className = "shortcode-money is-interactive"),
        (e.contentEditable = "false");
      const r = document.createElement("i");
      r.className = "fas fa-coins";
      const n = document.createElement("span");
      n.className = "money-value-display";
      const a = new Intl.NumberFormat("pt-BR", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(t.attrs.current);
      return (
        (n.textContent = t.attrs.currency ? `${a} ${t.attrs.currency}` : a),
        e.append(r, n),
        { dom: e }
      );
    },
});
