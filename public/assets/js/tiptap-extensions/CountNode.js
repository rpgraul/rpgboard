import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
export default Node.create({
  name: "countNode",
  group: "inline",
  inline: !0,
  atom: !0,
  addAttributes: () => ({
    label: { default: "" },
    max: { default: 0 },
    current: { default: 0 },
    theme: { default: "number" },
    icon: { default: "" },
    isOverlay: { default: !1 },
  }),
  parseHTML: () => [
    {
      tag: 'span[data-node-type="countNode"]',
      getAttrs: (t) => ({
        label: t.getAttribute("data-label"),
        max: parseInt(t.getAttribute("data-max"), 10),
        current: parseInt(t.getAttribute("data-current"), 10),
        theme: t.getAttribute("data-theme"),
        icon: t.getAttribute("data-icon") || "",
        isOverlay: "true" === t.getAttribute("data-is-overlay"),
      }),
    },
  ],
  renderHTML: ({ HTMLAttributes: t }) => [
    "span",
    mergeAttributes(t, { "data-node-type": "countNode" }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[(\*?)count\s+([^\]]*?)\]\s*$/,
        type: this.type,
        getAttributes: (t) => {
          const e = "*" === t[1],
            n = t[2],
            a = /"([^"]+)"|\S+/g,
            c = ((t) => {
              const e = [];
              let n;
              for (; null !== (n = a.exec(t)); ) e.push(n[1] || n[0]);
              return e;
            })(n),
            r = ((t) => {
              const e = {};
              return (
                t.forEach((t) => {
                  if (t.includes("=")) {
                    const [n, a] = t.split("=");
                    e[n.toLowerCase()] = a.replace(/^["']|["']$/g, "");
                  }
                }),
                e
              );
            })(c),
            o =
              c.find(
                (t) =>
                  !t.includes("=") &&
                  "checkbox" !== t &&
                  !["left", "right", "bottom", "top"].includes(t.toLowerCase())
              ) || "",
            s = r.max ? parseInt(r.max, 10) : 0,
            u = r.current ? parseInt(r.current, 10) : 0;
          let d = r.theme || "number";
          c.includes("checkbox") && (d = "checkbox");
          return {
            label: o,
            max: s,
            current: u,
            theme: d,
            icon: r.icon || "",
            isOverlay: e,
          };
        },
      }),
    ];
  },
  addNodeView:
    () =>
    ({ node: t }) => {
      const e = document.createElement("span");
      (e.className = `shortcode-count is-interactive theme-${t.attrs.theme}`),
        (e.contentEditable = "false");
      const n = document.createElement("span");
      if (
        ((n.className = "count-representation"), "checkbox" === t.attrs.theme)
      )
        for (let e = 1; e <= t.attrs.max; e++) {
          const a = document.createElement("span");
          (a.className =
            "count-checkbox " + (e <= t.attrs.current ? "is-checked" : "")),
            (a.dataset.value = e),
            (a.textContent = "✔"),
            n.appendChild(a);
        }
      else {
        const e = document.createElement("button");
        if (
          ((e.className = "count-btn"),
          (e.dataset.action = "decrement"),
          (e.textContent = "-"),
          n.appendChild(e),
          t.attrs.icon)
        ) {
          const e = document.createElement("i");
          (e.className = `fas fa-${t.attrs.icon}`), n.appendChild(e);
        }
        const a = document.createElement("span");
        (a.className = "count-name"),
          (a.textContent = t.attrs.label),
          n.appendChild(a);
        const c = document.createElement("span");
        (c.className = "count-current-value"),
          (c.textContent = t.attrs.current),
          n.appendChild(c);
        const r = document.createElement("span");
        (r.textContent = `/${t.attrs.max}`), n.appendChild(r);
        const o = document.createElement("button");
        (o.className = "count-btn"),
          (o.dataset.action = "increment"),
          (o.textContent = "+"),
          n.appendChild(o);
      }
      return e.appendChild(n), { dom: e };
    },
});
