import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
export default Node.create({
  name: "hpNode",
  group: "block",
  atom: !0,
  addAttributes: () => ({
    max: { default: 100 },
    current: { default: 100 },
    position: { default: "" },
    isHidden: { default: !1 },
  }),
  parseHTML: () => [
    {
      tag: 'span[data-node-type="hpNode"]',
      getAttrs: (t) => ({
        max: parseInt(t.getAttribute("data-max"), 10),
        current: parseInt(t.getAttribute("data-current"), 10),
        position: t.getAttribute("data-position") || "",
        isHidden: "true" === t.getAttribute("data-is-hidden"),
      }),
    },
  ],
  renderHTML: ({ HTMLAttributes: t, node: e }) => [
    "span",
    mergeAttributes(t, {
      "data-node-type": "hpNode",
      "data-max": e.attrs.max,
      "data-current": e.attrs.current,
      "data-position": e.attrs.position,
      "data-is-hidden": e.attrs.isHidden,
    }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[hp\s+max=(?:["']?)(\d+)(?:["']?)\s+current=(?:["']?)(\d+)(?:["']?)(?:\s+(.*?))?\]\s*$/,
        type: this.type,
        getAttributes: (t) => {
          const e = t[3] || "";
          return {
            max: parseInt(t[1], 10),
            current: parseInt(t[2], 10),
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
    return ({ node: t, editor: e, getPos: a }) => {
      const r =
        e.view.dom.closest("[data-item-id]")?.dataset.itemId ||
        "unknown-item",
        n = document.createElement("div");
      (n.className = "shortcode-hp"),
        t.attrs.isHidden && n.classList.add("is-hidden-preview"),
        (n.contentEditable = "false"),
        (n.dataset.itemId = r),
        (n.dataset.shortcode = encodeURIComponent(
          `[hp max=${t.attrs.max} current=${t.attrs.current}]`
        )),
        (n.dataset.maxHp = t.attrs.max);

      // Header with Label and Text
      const header = document.createElement("div");
      header.className = "hp-header";

      const o = document.createElement("strong");
      o.className = "hp-label";
      o.textContent = `PV${t.attrs.position ? ` (${t.attrs.position})` : ""}`;

      const hpText = document.createElement("span");
      hpText.className = "hp-text";
      hpText.textContent = `${t.attrs.current} / ${t.attrs.max}`;

      header.append(o, hpText);

      // Bar Container and Fill
      const barContainer = document.createElement("div");
      barContainer.className = "hp-bar-container";

      const barFill = document.createElement("div");
      barFill.className = "hp-bar-fill";

      const updateBar = (current) => {
        const percent = Math.round((current / t.attrs.max) * 100);
        barFill.style.width = `${percent}%`;
        barFill.classList.remove("is-low", "is-medium", "is-high");
        if (percent < 25) barFill.classList.add("is-low");
        else if (percent < 50) barFill.classList.add("is-medium");
        else barFill.classList.add("is-high");
        hpText.textContent = `${current} / ${t.attrs.max}`;
      };

      updateBar(t.attrs.current);
      barContainer.appendChild(barFill);

      // Hidden Input for editing
      const i = document.createElement("input");
      (i.type = "number"),
        (i.className = "hp-current-input is-hidden"),
        (i.value = t.attrs.current),
        (i.max = t.attrs.max),
        (i.min = "0");

      i.addEventListener("input", (event) => {
        let val = parseInt(event.target.value, 10) || 0;
        val = Math.max(0, Math.min(val, t.attrs.max));
        updateBar(val);
      });

      i.addEventListener("change", () => {
        if ("number" == typeof a()) {
          let r = parseInt(i.value, 10) || 0;
          r = Math.max(0, Math.min(r, t.attrs.max)),
            (i.value = r);
          updateBar(r);
          e.view.dispatch(
            e.view.state.tr.setNodeMarkup(a(), void 0, {
              ...t.attrs,
              current: r,
            })
          );
        }
      });

      n.addEventListener("click", (e) => {
        e.stopPropagation();
        i.classList.toggle("is-hidden");
        if (!i.classList.contains("is-hidden")) i.focus();
      });

      i.addEventListener("click", (t) => t.stopPropagation());
      i.addEventListener("dblclick", (t) => t.stopPropagation());

      n.append(header, barContainer, i);
      n.addEventListener("dblclick", () => {
        document.dispatchEvent(
          new CustomEvent("edit-shortcode", {
            detail: { type: this.name, attrs: t.attrs, pos: a() },
          })
        );
      });

      return {
        dom: n,
        ignoreMutation: () => !0,
        stopEvent: (t) => "INPUT" === t.target.tagName,
      };
    };
  },
});