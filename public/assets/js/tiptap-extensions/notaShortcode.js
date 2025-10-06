import { Node, mergeAttributes } from "@tiptap/core";
export default Node.create({
  name: "notaShortcode",
  group: "block",
  content: "block+",
  defining: !0,
  addAttributes: () => ({ titulo: { default: "Nota" } }),
  parseHTML: () => [
    {
      tag: 'div[data-node-type="notaShortcode"]',
      getAttrs: (t) => ({ titulo: t.querySelector(".nota-title")?.textContent || "Nota" }),
      contentElement: "div[data-content]",
    },
  ],
  renderHTML: ({ HTMLAttributes: t }) => [
    "div",
    mergeAttributes(t, { "data-node-type": "notaShortcode", class: "shortcode-nota" }),
    ["div", { class: "nota-header" }, ["strong", { class: "nota-title" }, t.titulo], ["span", { class: "nota-icon" }, ["i", { class: "fas fa-plus" }]]],
    ["div", { class: "nota-content" }, ["div", { "data-content": "" }]],
  ],
  addNodeView() {
    return ({ node: t, getPos: e, editor: a }) => {
      const n = document.createElement("div");
      (n.className = "shortcode-nota"), (n.contentEditable = "false");
      const o = document.createElement("div");
      o.className = "nota-header";
      const d = document.createElement("strong");
      (d.className = "nota-title"), (d.textContent = t.attrs.titulo);
      const s = document.createElement("span");
      s.className = "nota-icon";
      const c = document.createElement("i");
      (c.className = "fas fa-plus"),
        s.appendChild(c),
        o.append(d, s),
        n.appendChild(o);
      const i = document.createElement("div");
      i.className = "nota-content";
      const l = document.createElement("div");
      return (
        l.setAttribute("data-content", ""),
        i.appendChild(l),
        n.appendChild(i),
        o.addEventListener("click", () => {
          n.classList.toggle("is-active");
          const t = n.classList.contains("is-active");
          c.className = t ? "fas fa-minus" : "fas fa-plus";
        }),
        {
          dom: n,
          contentDOM: l,
          update: (updatedNode) => {
            return t.eq(updatedNode);
          },
        }
      );
    };
  },
});
