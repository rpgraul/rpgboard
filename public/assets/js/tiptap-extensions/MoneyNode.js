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
      position: { default: "" },
      isHidden: { default: !1 },
    };
  },
  parseHTML: () => [
    {
      tag: 'span[data-node-type="moneyNode"]',
      getAttrs: (t) => ({
        current: parseFloat(t.getAttribute("data-current")) || 0,
        currency: t.getAttribute("data-currency") || "",
        position: t.getAttribute("data-position") || "",
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
      "data-position": e.attrs.position,
      "data-is-hidden": e.attrs.isHidden,
    }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[money\s+current=(?:["']?)([\d.]+)(?:["']?)(?:\s+([^\]]*?))?\s*\]\s*$/,
        type: this.type,
        getAttributes: (t) => {
          const e = parseFloat(t[1]) || 0;
          let r = "",
            n = "",
            a = !1;
          if (t[2]) {
            const e = t[2].trim().split(/\s+/),
              o = ["left", "right", "bottom", "top"];
            (n = e.find((t) => o.includes(t.toLowerCase())) || ""),
              (a = e.includes("#")),
              (r = e.find((t) => !o.includes(t) && "#" !== t) || "");
          }
          return { current: e, currency: r, position: n, isHidden: a };
        },
      }),
    ];
  },
  addNodeView() {
    return ({ node: t, getPos: e, editor: r }) => {
      const n = document.createElement("span");
      (n.className = "shortcode-money is-interactive"),
        t.attrs.isHidden && n.classList.add("is-hidden-preview"),
        (n.contentEditable = "false"),
        (n.style.display = "inline-flex"),
        (n.style.alignItems = "center"),
        (n.style.gap = "0.25rem");
      const a = document.createElement("i");
      (a.className = "fas fa-coins"), (a.style.color = "#ffdd57");
      const o = document.createElement("span");
      (o.className = "money-value-display"),
        (o.style.cursor = "pointer"),
        (o.style.borderBottom = "1px dashed rgba(255,255,255,0.3)");
      
      const formatDisplay = (currencyVal) => {
        const i = new Intl.NumberFormat("pt-BR", {
          style: "decimal",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(t.attrs.current);
        o.textContent = i;
        if (currencyVal) o.textContent += ` ${currencyVal}`;
        if (t.attrs.position) o.textContent += ` (${t.attrs.position.toUpperCase()})`;
      };

      // Renderização inicial
      formatDisplay(t.attrs.currency);

      // Se não houver moeda definida, busca o padrão
      if (!t.attrs.currency) {
        getSettings().then(settings => {
            if (settings && settings.defaultCurrency) {
                formatDisplay(settings.defaultCurrency);
            }
        }).catch(err => console.error("Erro ao carregar moeda padrão no editor:", err));
      }

      const s = document.createElement("input");
      (s.type = "text"),
        (s.className = "money-value-input is-hidden"),
        (s.style.width = "80px"),
        (s.style.background = "transparent"),
        (s.style.border = "none"),
        (s.style.borderBottom = "1px solid #fff"),
        (s.style.color = "#fff"),
        (s.style.fontSize = "0.9em"),
        (s.style.padding = "0"),
        (s.style.outline = "none"),
        (s.value = t.attrs.current);
      const c = (n) => {
        if ("number" == typeof e()) {
          const currentVal = parseFloat(t.attrs.current) || 0;
          let cleaned = n.toString().replace(/\u00A0/g, " ").trim();
          if (cleaned.includes(".") && cleaned.includes(","))
            cleaned.indexOf(".") < cleaned.indexOf(",")
              ? (cleaned = cleaned.replace(/\./g, "").replace(/,/g, "."))
              : (cleaned = cleaned.replace(/,/g, ""));
          else if (cleaned.includes(",")) cleaned = cleaned.replace(/,/g, ".");
          else if ((cleaned.match(/\./g) || []).length > 1)
            cleaned = cleaned.replace(/\./g, "");
          if (((cleaned = cleaned.replace(/\s+/g, "")), !cleaned)) return;
          let result = currentVal;
          const fullMatch = cleaned.match(
              /^(-?\d+(?:\.\d+)?)([\+\-\*\/])(-?\d+(?:\.\d+)?)$/
            ),
            relMatch = cleaned.match(/^([\+\-\*\/])(-?\d+(?:\.\d+)?)$/);
          if (fullMatch) {
            const v1 = parseFloat(fullMatch[1]),
              op = fullMatch[2],
              v2 = parseFloat(fullMatch[3]);
            !isNaN(v1) &&
              !isNaN(v2) &&
              ("+" === op
                ? (result = v1 + v2)
                : "-" === op
                ? (result = v1 - v2)
                : "*" === op
                ? (result = v1 * v2)
                : "/" === op && 0 !== v2 && (result = v1 / v2));
          } else if (relMatch) {
            const op = relMatch[1],
              v = parseFloat(relMatch[2]);
            !isNaN(v) &&
              ("+" === op
                ? (result = currentVal + v)
                : "-" === op
                ? (result = currentVal - v)
                : "*" === op
                ? (result = currentVal * v)
                : "/" === op && 0 !== v && (result = currentVal / v));
          } else {
            const parsed = parseFloat(cleaned);
            !isNaN(parsed) && (result = parsed);
          }
          (result = Math.round(100 * result) / 100),
            r.view.dispatch(
              r.view.state.tr.setNodeMarkup(e(), void 0, {
                ...t.attrs,
                current: result,
              })
            );
        }
      };
      return (
        o.addEventListener("click", (t) => {
          t.stopPropagation(),
            o.classList.add("is-hidden"),
            s.classList.remove("is-hidden"),
            s.focus(),
            s.select();
        }),
        s.addEventListener("blur", () => {
          c(s.value),
            s.classList.add("is-hidden"),
            o.classList.remove("is-hidden");
        }),
        s.addEventListener("keydown", (t) => {
          "Enter" === t.key && (t.preventDefault(), s.blur());
        }),
        s.addEventListener("click", (t) => t.stopPropagation()),
        n.append(a, o, s),
        n.addEventListener("dblclick", () => {
          document.dispatchEvent(
            new CustomEvent("edit-shortcode", {
              detail: { type: this.name, attrs: t.attrs, pos: e() },
            })
          );
        }),
        {
          dom: n,
          ignoreMutation: () => !0,
          stopEvent: (t) => "INPUT" === t.target.tagName,
        }
      );
    };
  },
});