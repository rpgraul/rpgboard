import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
import { calculateMathExpression } from "../modules/shortcodeParser.js";
export default Node.create({
  name: "hpNode",
  group: "block",
  atom: !0,
  addAttributes: () => ({
    max: { default: 100 },
    current: { default: 100 },
    isHidden: { default: false },
  }),
  parseHTML: () => [
    {
      tag: 'span[data-node-type="hpNode"]',
      getAttrs: (t) => ({
        max: parseInt(t.getAttribute("data-max"), 10),
        current: parseInt(t.getAttribute("data-current"), 10),
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
      "data-is-hidden": e.attrs.isHidden,
    }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[hp\s+max=(?:["']?)(\d+)(?:["']?)\s+current=(?:["']?)([-\d]+)(?:["']?)(?:\s+(#))?\]\s*$/,
        type: this.type,
        getAttributes: (t) => ({
          max: parseInt(t[1], 10),
          current: parseInt(t[2], 10),
          isHidden: t[3] === "#",
        }),
      }),
    ];
  },
  addNodeView() {
    return ({ node: t, editor: e, getPos: a }) => {
      const n = document.createElement("div");
      n.className = "shortcode-hp interactive-node-view";
      if (t.attrs.isHidden) n.classList.add("is-hidden-preview");
      n.contentEditable = "false";

      // Progress bar logic
      const updateUI = (current, max) => {
          const percent = Math.min(100, Math.max(0, Math.round((current / max) * 100)));
          barFill.style.width = `${percent}%`;
          hpText.textContent = `${current} / ${max}`;
          
          barFill.classList.remove("is-low", "is-medium", "is-high", "is-critical");
          if (percent <= 20) barFill.classList.add("is-critical");
          else if (percent <= 40) barFill.classList.add("is-low");
          else if (percent <= 70) barFill.classList.add("is-medium");
          else barFill.classList.add("is-high");
      };

      const container = document.createElement("div");
      container.className = "hp-widget-container";

      const header = document.createElement("div");
      header.className = "hp-header";

      const label = document.createElement("span");
      label.className = "hp-label-tag";
      label.textContent = "PV";

      const hpText = document.createElement("span");
      hpText.className = "hp-text-value";
      
      header.append(label, hpText);

      const barContainer = document.createElement("div");
      barContainer.className = "hp-bar-track";
      const barFill = document.createElement("div");
      barFill.className = "hp-bar-fill";
      barContainer.appendChild(barFill);

      // Controls
      const controls = document.createElement("div");
      controls.className = "hp-controls";

      const btnMinus = document.createElement("button");
      btnMinus.className = "hp-btn minus";
      btnMinus.innerHTML = '<i class="fas fa-minus"></i>';
      
      const btnPlus = document.createElement("button");
      btnPlus.className = "hp-btn plus";
      btnPlus.innerHTML = '<i class="fas fa-plus"></i>';

      const input = document.createElement("input");
      input.type = "text";
      input.className = "hp-inline-input";
      input.placeholder = "±";

      const syncValue = (val) => {
          if (typeof a !== "function") return;
          const pos = a();
          e.view.dispatch(e.view.state.tr.setNodeMarkup(pos, undefined, {
              ...t.attrs,
              current: val
          }));
      };

      btnMinus.onclick = (ev) => {
          ev.stopPropagation();
          const newVal = Math.max(0, t.attrs.current - 1);
          syncValue(newVal);
      };

      btnPlus.onclick = (ev) => {
          ev.stopPropagation();
          const newVal = Math.min(t.attrs.max, t.attrs.current + 1);
          syncValue(newVal);
      };

      input.onclick = (ev) => ev.stopPropagation();
      input.onkeydown = (ev) => {
          if (ev.key === "Enter") {
              ev.preventDefault();
              const result = calculateMathExpression(t.attrs.current, input.value);
              const finalVal = Math.max(0, Math.min(Math.round(result), t.attrs.max));
              syncValue(finalVal);
              input.value = "";
              input.blur();
          }
      };

      updateUI(t.attrs.current, t.attrs.max);
      controls.append(btnMinus, input, btnPlus);
      container.append(header, barContainer, controls);
      n.appendChild(container);

      n.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        document.dispatchEvent(
          new CustomEvent("edit-shortcode", {
            detail: { type: this.name, attrs: t.attrs, pos: a(), editor: e },
          })
        );
      });

      return {
        dom: n,
        update: (newNode) => {
            if (newNode.type !== this.type) return false;
            updateUI(newNode.attrs.current, newNode.attrs.max);
            t = newNode; // Sync local reference
            return true;
        },
        ignoreMutation: () => true,
        stopEvent: (t) => ["INPUT", "BUTTON", "I"].some(tag => t.target.tagName === tag) || t.target.closest("button"),
      };
    };
  },
});