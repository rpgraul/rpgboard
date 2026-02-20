import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
import { getSettings } from "../modules/firebaseService.js";

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
        find: /\[money\s+current=(?:["']?)([\d.]+)(?:["']?)(?:\s+([^\]]*?))?\s*\]\s*$/,
        getAttributes: (t) => {
          const e = parseFloat(t[1]) || 0;
          let currency = "", isHidden = false;
          if (t[2]) {
            const parts = t[2].trim().split(/\s+/);
            isHidden = parts.includes("#");
            currency = parts.find(p => p !== "#") || "";
          }
          return { current: e, currency, isHidden };
        },
      }),
    ];
  },
  addNodeView() {
    return ({ node: t, getPos: e, editor: r }) => {
      const n = document.createElement("span");
      n.className = "shortcode-money is-interactive";
      if (t.attrs.isHidden) n.classList.add("is-hidden-preview");
      n.contentEditable = "false";
      n.style.display = "inline-flex";
      n.style.alignItems = "center";
      n.style.gap = "0.25rem";

      const icon = document.createElement("i");
      icon.className = "fas fa-coins";
      icon.style.color = "#ffdd57";

      const display = document.createElement("span");
      display.className = "money-value-display";
      display.style.cursor = "pointer";
      display.style.borderBottom = "1px dashed rgba(255,255,255,0.3)";

      const updateDisplay = (val, curr) => {
        const formatted = new Intl.NumberFormat("pt-BR", {
          style: "decimal",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(val);
        display.textContent = curr ? `${formatted} ${curr}` : formatted;
      };

      updateDisplay(t.attrs.current, t.attrs.currency);

      if (!t.attrs.currency) {
        getSettings().then(s => s?.defaultCurrency && updateDisplay(t.attrs.current, s.defaultCurrency));
      }

      const input = document.createElement("input");
      input.type = "text";
      input.className = "money-value-input is-hidden";
      input.style.width = "60px";
      input.style.background = "transparent";
      input.style.border = "none";
      input.style.borderBottom = "1px solid #fff";
      input.style.color = "#fff";
      input.style.outline = "none";
      input.value = t.attrs.current;

      const save = (val) => {
        if (typeof e !== "function") return;
        let cleaned = val.toString().trim().replace(/,/g, ".");
        let result = parseFloat(cleaned) || 0;

        // Simples suporte a +X / -X
        if (val.startsWith("+") || val.startsWith("-")) {
          result = (t.attrs.current || 0) + (parseFloat(val) || 0);
        }

        r.view.dispatch(
          r.view.state.tr.setNodeMarkup(e(), undefined, {
            ...t.attrs,
            current: Math.round(result * 100) / 100,
          })
        );
      };

      display.addEventListener("click", (ev) => {
        ev.stopPropagation();
        display.classList.add("is-hidden");
        input.classList.remove("is-hidden");
        input.focus();
        input.select();
      });

      input.addEventListener("blur", () => {
        save(input.value);
        input.classList.add("is-hidden");
        display.classList.remove("is-hidden");
      });

      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        }
      });

      input.addEventListener("click", (ev) => ev.stopPropagation());

      n.append(icon, display, input);

      n.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        document.dispatchEvent(
          new CustomEvent("edit-shortcode", {
            detail: { type: this.name, attrs: t.attrs, pos: e() },
          })
        );
      });

      return {
        dom: n,
        ignoreMutation: () => true,
        stopEvent: (e) => e.target.tagName === "INPUT",
      };
    };
  },
});
