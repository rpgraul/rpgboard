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
      getAttrs: (t) => ({ titulo: t.getAttribute("data-titulo") }),
      contentElement: "div[data-content]",
    },
  ],
  renderHTML: ({ HTMLAttributes: t, node: e }) => [
    "div",
    mergeAttributes(t, { "data-node-type": "notaShortcode" }),
    ["div", { "data-titulo": t.titulo, "data-content": "" }, 0],
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
      (i.className = "nota-content"), (i.style.display = "none");
      const l = document.createElement("div");
      return (
        l.setAttribute("data-content", ""),
        i.appendChild(l),
        n.appendChild(i),
        o.addEventListener("click", () => {
          n.classList.toggle("is-active");
          const t = n.classList.contains("is-active");
          (i.style.display = t ? "block" : "none"),
            (c.className = t ? "fas fa-minus" : "fas fa-plus");
        }),
        {
          dom: n,
          contentDOM: l,
          update: (e) =>
            e.type.name === this.name &&
            (e.attrs.titulo !== t.attrs.titulo &&
              (d.textContent = e.attrs.titulo),
            !0),
        }
      );
    };
  },
});
