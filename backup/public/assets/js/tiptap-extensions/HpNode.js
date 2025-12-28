import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
export default Node.create({
  name: "hpNode",
  group: "block",
  atom: !0,
  addAttributes: () => ({ max: { default: 100 }, current: { default: 100 } }),
  parseHTML: () => [
    {
      tag: 'span[data-node-type="hpNode"]',
      getAttrs: (t) => ({
        max: parseInt(t.getAttribute("data-max"), 10),
        current: parseInt(t.getAttribute("data-current"), 10),
      }),
    },
  ],
  renderHTML: ({ HTMLAttributes: t }) => [
    "span",
    mergeAttributes(t, { "data-node-type": "hpNode" }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[hp\s+max=(\d+)\s+current=(\d+)\s*\]\s*$/,
        type: this.type,
        getAttributes: (t) => ({
          max: parseInt(t[1], 10),
          current: parseInt(t[2], 10),
        }),
      }),
    ];
  },
  addNodeView:
    () =>
    ({ node: t, editor: e }) => {
      const a =
          e.view.dom.closest("[data-item-id]")?.dataset.itemId ||
          "unknown-item",
        r = document.createElement("div");
      (r.className = "shortcode-hp"),
        (r.contentEditable = "false"),
        (r.dataset.itemId = a),
        (r.dataset.shortcode = encodeURIComponent(
          `[hp max=${t.attrs.max} current=${t.attrs.current}]`
        )),
        (r.dataset.maxHp = t.attrs.max);
      const n = document.createElement("strong");
      (n.className = "hp-label"), (n.textContent = "PV");
      const s = document.createElement("div");
      s.className = "hp-input-wrapper";
      const d = document.createElement("input");
      (d.type = "number"),
        (d.className = "hp-current-input"),
        (d.value = t.attrs.current),
        (d.max = t.attrs.max),
        (d.min = "0");
      const m = document.createElement("span");
      return (
        (m.className = "hp-max-value"),
        (m.textContent = `/ ${t.attrs.max}`),
        s.append(d, m),
        r.append(n, s),
        { dom: r }
      );
    },
});
