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
      a.className = `shortcode-count interactive-node-view theme-${t.attrs.theme}`;
      if (t.attrs.isHidden) a.classList.add("is-hidden-preview");
      a.contentEditable = "false";

      const r = document.createElement("span");
      r.className = "count-widget-container";

      const syncValue = (val) => {
        if (typeof e === "function") {
          n.view.dispatch(n.view.state.tr.setNodeMarkup(e(), undefined, {
            ...t.attrs,
            current: val,
          }));
        }
      };

      if (t.attrs.theme === "checkbox") {
        for (let i = 1; i <= t.attrs.max; i++) {
          const cb = document.createElement("span");
          cb.className = "count-check-box " + (i <= t.attrs.current ? "is-checked" : "");
          cb.innerHTML = '<i class="fas fa-check"></i>';
          cb.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const newCurrent = i === t.attrs.current ? i - 1 : i;
            syncValue(newCurrent);
          });
          r.appendChild(cb);
        }
      } else {
        const btnDec = document.createElement("button");
        btnDec.className = "count-btn minus";
        btnDec.innerHTML = '<i class="fas fa-minus"></i>';
        btnDec.onclick = (ev) => {
          ev.stopPropagation();
          syncValue(Math.max(0, t.attrs.current - 1));
        };

        const btnInc = document.createElement("button");
        btnInc.className = "count-btn plus";
        btnInc.innerHTML = '<i class="fas fa-plus"></i>';
        btnInc.onclick = (ev) => {
          ev.stopPropagation();
          syncValue(Math.min(t.attrs.max, t.attrs.current + 1));
        };

        const label = document.createElement("span");
        label.className = "count-label-text";
        if (t.attrs.icon) {
            label.innerHTML = `<i class="fas fa-${t.attrs.icon}"></i> ${t.attrs.label}`;
        } else {
            label.textContent = t.attrs.label;
        }

        const display = document.createElement("span");
        display.className = "count-value-display";
        display.textContent = `${t.attrs.current} / ${t.attrs.max}`;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "count-inline-input";
        input.placeholder = "±";

        input.onclick = (ev) => ev.stopPropagation();
        input.onkeydown = (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            const val = parseInt(input.value, 10);
            if (!isNaN(val)) {
                // Support ± syntax or just number
                let next = t.attrs.current;
                if (input.value.startsWith("+")) next += val;
                else if (input.value.startsWith("-")) next += val;
                else next = val;
                syncValue(Math.max(0, Math.min(t.attrs.max, next)));
            }
            input.value = "";
            input.blur();
          }
        };

        r.append(btnDec, label, display, btnInc, input);
      }

      a.appendChild(r);
      a.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        document.dispatchEvent(
          new CustomEvent("edit-shortcode", {
            detail: { type: this.name, attrs: t.attrs, pos: e(), editor: n },
          })
        );
      });

      return {
        dom: a,
        update: (newNode) => {
            if (newNode.type !== this.type) return false;
            t = newNode;
            // Update UI would be complex here due to DOM recreation, simpler to let Tiptap handle it or selectively update
            // For now, returning false will force recreation which is safe for small widgets
            return false; 
        },
        ignoreMutation: () => true,
        stopEvent: (e) => ["INPUT", "BUTTON", "I"].some(tag => e.target.tagName === tag) || e.target.closest("button"),
      };
    };
  },
});