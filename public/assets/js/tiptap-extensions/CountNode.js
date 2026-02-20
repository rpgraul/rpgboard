import { Node, mergeAttributes, textInputRule } from "@tiptap/core";

export default Node.create({
  name: "countNode",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({
    label: { default: "" },
    max: { default: 0 },
    current: { default: 0 },
    theme: { default: "number" },
    icon: { default: "" },
    isOverlay: { default: false },
    isHidden: { default: false },
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
        isHidden: "true" === t.getAttribute("data-is-hidden"),
      }),
    },
  ],
  renderHTML: ({ HTMLAttributes: t, node: e }) => [
    "span",
    mergeAttributes(t, {
      "data-node-type": "countNode",
      "data-label": e.attrs.label,
      "data-max": e.attrs.max,
      "data-current": e.attrs.current,
      "data-theme": e.attrs.theme,
      "data-icon": e.attrs.icon,
      "data-is-overlay": e.attrs.isOverlay,
      "data-is-hidden": e.attrs.isHidden,
    }),
  ],
  addInputRules() {
    return [
      textInputRule({
        find: /\[(\*?)count\s+([^\]]*?)\]\s*$/,
        getAttributes: (t) => {
          const isOverlay = t[1] === "*";
          const argsStr = t[2];
          const matches = argsStr.match(/"([^"]+)"|\S+/g) || [];
          const attrs = {};

          matches.forEach(m => {
            if (m.includes("=")) {
              const [k, v] = m.split("=");
              attrs[k.toLowerCase()] = v.replace(/^["']|["']$/g, "");
            }
          });

          const label = matches.find(m => !m.includes("=") && m !== "#" && m !== "checkbox") || "";
          const isHidden = argsStr.includes("#");
          const theme = argsStr.includes("checkbox") ? "checkbox" : (attrs.theme || "number");

          return {
            label: label.replace(/^["']|["']$/g, ""),
            max: parseInt(attrs.max || 0, 10),
            current: parseInt(attrs.current || 0, 10),
            theme,
            icon: attrs.icon || "",
            isOverlay,
            isHidden,
          };
        },
      }),
    ];
  },
  addNodeView() {
    return ({ node: t, getPos: e, editor: n }) => {
      const a = document.createElement("span");
      a.className = `shortcode-count is-interactive theme-${t.attrs.theme}`;
      if (t.attrs.isHidden) a.classList.add("is-hidden-preview");
      a.contentEditable = "false";

      const r = document.createElement("span");
      r.className = "count-representation";

      if (t.attrs.theme === "checkbox") {
        for (let i = 1; i <= t.attrs.max; i++) {
          const cb = document.createElement("span");
          cb.className = "count-checkbox " + (i <= t.attrs.current ? "is-checked" : "");
          cb.textContent = "✔";
          cb.addEventListener("click", (ev) => {
            ev.stopPropagation();
            let newCurrent = i === t.attrs.current ? i - 1 : i;
            if (typeof e === "function") {
              n.view.dispatch(n.view.state.tr.setNodeMarkup(e(), undefined, {
                ...t.attrs,
                current: newCurrent,
              }));
            }
          });
          r.appendChild(cb);
        }
      } else {
        const btnDec = document.createElement("button");
        btnDec.className = "count-btn";
        btnDec.textContent = "-";
        btnDec.onclick = (ev) => {
          ev.stopPropagation();
          if (typeof e === "function") {
            const next = Math.max(0, t.attrs.current - 1);
            n.view.dispatch(n.view.state.tr.setNodeMarkup(e(), undefined, {
              ...t.attrs,
              current: next,
            }));
          }
        };

        const btnInc = document.createElement("button");
        btnInc.className = "count-btn";
        btnInc.textContent = "+";
        btnInc.onclick = (ev) => {
          ev.stopPropagation();
          if (typeof e === "function") {
            const next = Math.min(t.attrs.max, t.attrs.current + 1);
            n.view.dispatch(n.view.state.tr.setNodeMarkup(e(), undefined, {
              ...t.attrs,
              current: next,
            }));
          }
        };

        const display = document.createElement("span");
        display.className = "count-current-value";
        display.textContent = t.attrs.current;
        display.style.cursor = "pointer";
        display.style.borderBottom = "1px dashed rgba(255,255,255,0.3)";

        const input = document.createElement("input");
        input.type = "number";
        input.className = "count-value-input is-hidden";
        input.style.width = "40px";
        input.style.background = "transparent";
        input.style.border = "none";
        input.style.color = "#fff";
        input.value = t.attrs.current;

        const save = (val) => {
          if (typeof e !== "function") return;
          const next = Math.max(0, Math.min(t.attrs.max, parseInt(val, 10) || 0));
          n.view.dispatch(n.view.state.tr.setNodeMarkup(e(), undefined, {
            ...t.attrs,
            current: next,
          }));
        };

        display.onclick = (ev) => {
          ev.stopPropagation();
          display.classList.add("is-hidden");
          input.classList.remove("is-hidden");
          input.focus();
        };

        input.onblur = () => {
          save(input.value);
          input.classList.add("is-hidden");
          display.classList.remove("is-hidden");
        };

        input.onkeydown = (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            input.blur();
          }
        };
        input.onclick = (ev) => ev.stopPropagation();

        if (t.attrs.icon) {
          const icon = document.createElement("i");
          icon.className = `fas fa-${t.attrs.icon} mr-1`;
          r.appendChild(icon);
        }

        const nameSpace = document.createElement("span");
        nameSpace.className = "count-name mr-1";
        nameSpace.textContent = t.attrs.label;

        r.append(btnDec, nameSpace, display, input, document.createTextNode(` / ${t.attrs.max}`), btnInc);
      }

      a.appendChild(r);
      a.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        document.dispatchEvent(
          new CustomEvent("edit-shortcode", {
            detail: { type: this.name, attrs: t.attrs, pos: e() },
          })
        );
      });

      return {
        dom: a,
        ignoreMutation: () => true,
        stopEvent: (e) => ["INPUT", "BUTTON"].includes(e.target.tagName),
      };
    };
  },
});