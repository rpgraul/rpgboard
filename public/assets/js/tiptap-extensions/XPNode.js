import { Node, mergeAttributes, textInputRule } from "@tiptap/core";
import { calculateMathExpression } from "../modules/shortcodeParser.js";

export default Node.create({
  name: "xpNode",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      current: { default: 0 },
      isHidden: { default: false },
    };
  },
  parseHTML: () => [
    {
      tag: 'span[data-node-type="xpNode"]',
      getAttrs: (t) => ({
        current: parseInt(t.getAttribute("data-current"), 10) || 0,
        isHidden: "true" === t.getAttribute("data-is-hidden"),
      }),
    },
  ],
  renderHTML: ({ HTMLAttributes: t, node: e }) => [
    "span",
    mergeAttributes(t, {
      "data-node-type": "xpNode",
      "data-current": e.attrs.current,
      "data-is-hidden": e.attrs.isHidden,
    }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[xp\s+current=(?:["']?)([-\d]+)(?:["']?)(?:\s+(#))?\]\s*$/,
        getAttributes: (t) => ({
          current: parseInt(t[1], 10) || 0,
          isHidden: t[2] === "#",
        }),
      }),
    ];
  },
  addNodeView() {
    return ({ node: t, getPos: e, editor: r }) => {
      const n = document.createElement("span");
      n.className = "shortcode-xp is-interactive";
      if (t.attrs.isHidden) n.classList.add("is-hidden-preview");
      n.contentEditable = "false";
      n.style.display = "inline-flex";
      n.style.alignItems = "center";
      n.style.gap = "0.25rem";

      const icon = document.createElement("i");
      icon.className = "fas fa-star";
      icon.style.color = "#3273dc";

      const display = document.createElement("span");
      display.className = "xp-value-display";
      display.style.cursor = "pointer";
      display.style.borderBottom = "1px dashed rgba(255,255,255,0.3)";
      display.textContent = `${t.attrs.current} XP`;

      const input = document.createElement("input");
      input.type = "text";
      input.className = "xp-value-input is-hidden";
      input.style.width = "60px";
      input.style.background = "transparent";
      input.style.border = "none";
      input.style.borderBottom = "1px solid #fff";
      input.style.color = "#fff";
      input.style.outline = "none";
      input.value = t.attrs.current;

      const save = (val) => {
        if (typeof e !== "function") return;
        const result = calculateMathExpression(t.attrs.current, val);
        
        r.view.dispatch(
          r.view.state.tr.setNodeMarkup(e(), undefined, {
            ...t.attrs,
            current: Math.round(result),
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
            detail: { type: this.name, attrs: t.attrs, pos: e(), editor: r },
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
