import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
import { getSettings } from "../modules/firebaseService.js";
import { calculateMathExpression } from "../modules/shortcodeParser.js";

export default Node.create({
  name: "moneyNode",
  group: "inline",
  inline: !0,
  atom: !0,
  addAttributes() {
    return {
      current: { default: 0 },
      currency: { default: "" },
      isHidden: { default: false },
    };
  },
  parseHTML: () => [
    {
      tag: 'span[data-node-type="moneyNode"]',
      getAttrs: (t) => ({
        current: parseFloat(t.getAttribute("data-current")) || 0,
        currency: t.getAttribute("data-currency") || "",
        isHidden: "true" === t.getAttribute("data-is-hidden"),
      }),
    },
  ],
  renderHTML: ({ HTMLAttributes: t, node: e }) => [
    "span",
    mergeAttributes(t, {
      "data-node-type": "moneyNode",
      "data-current": e.attrs.current,
      "data-currency": e.attrs.currency,
      "data-is-hidden": e.attrs.isHidden,
    }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[money\s+([^\]]*?)\s*current=(?:["']?)([\d.]+)(?:["']?)(?:\s+([^\]]*?))?\s*\]\s*$/,
        getAttributes: (t) => {
          const currency = t[1].trim();
          const current = parseFloat(t[2]) || 0;
          let isHidden = false;
          if (t[3]) {
            isHidden = t[3].includes("#");
          }
          return { current, currency, isHidden };
        },
      }),
    ];
  },
  addNodeView() {
    return ({ node: t, getPos: e, editor: r }) => {
      const n = document.createElement("span");
      n.className = "shortcode-money interactive-node-view";
      if (t.attrs.isHidden) n.classList.add("is-hidden-preview");
      n.contentEditable = "false";

      const icon = document.createElement("i");
      icon.className = "fas fa-coins money-icon";

      const display = document.createElement("span");
      display.className = "money-display";

      const updateUI = (val, curr) => {
          const formatted = new Intl.NumberFormat("pt-BR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
          }).format(val);
          display.textContent = curr ? `${formatted} ${curr}` : formatted;
      };

      if (!t.attrs.currency) {
          getSettings().then(s => {
              if (s?.defaultCurrency) updateUI(t.attrs.current, s.defaultCurrency);
          });
      }
      updateUI(t.attrs.current, t.attrs.currency);

      const input = document.createElement("input");
      input.type = "text";
      input.className = "money-inline-input";
      input.placeholder = "±";

      const syncValue = (val) => {
          if (typeof e !== "function") return;
          const result = calculateMathExpression(t.attrs.current || 0, val);
          const finalVal = Math.round(result * 100) / 100;
          
          r.view.dispatch(
              r.view.state.tr.setNodeMarkup(e(), undefined, {
                  ...t.attrs,
                  current: finalVal,
              })
          );
      };

      // Buttons for +/-
      const btnMinus = document.createElement("button");
      btnMinus.className = "money-btn minus";
      btnMinus.innerHTML = '<i class="fas fa-minus"></i>';
      btnMinus.onclick = (ev) => {
          ev.stopPropagation();
          syncValue("-1");
      };

      const btnPlus = document.createElement("button");
      btnPlus.className = "money-btn plus";
      btnPlus.innerHTML = '<i class="fas fa-plus"></i>';
      btnPlus.onclick = (ev) => {
          ev.stopPropagation();
          syncValue("+1");
      };

      input.onclick = (ev) => ev.stopPropagation();
      input.onkeydown = (ev) => {
          if (ev.key === "Enter") {
              ev.preventDefault();
              syncValue(input.value);
              input.value = "";
              input.blur();
          }
      };

      n.append(icon, btnMinus, display, btnPlus, input);

      n.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        document.dispatchEvent(
          new CustomEvent("edit-shortcode", {
            detail: { type: this.name, attrs: t.attrs, pos: e(), editor: r },
          })
        );
      });

      return {
        dom: n,
        update: (newNode) => {
            if (newNode.type !== this.type) return false;
            updateUI(newNode.attrs.current, newNode.attrs.currency);
            t = newNode;
            return true;
        },
        ignoreMutation: () => true,
        stopEvent: (e) => ["INPUT", "BUTTON", "I"].some(tag => e.target.tagName === tag) || e.target.closest("button"),
      };
    };
  },
});
