import { Node, mergeAttributes } from "@tiptap/core";
import { Suggestion } from "@tiptap/suggestion";

export default Node.create({
  name: "cardLink",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => ({
    cardName: {
      default: null,
      parseHTML: (e) => e.dataset.cardName,
      renderHTML: (e) => ({ "data-card-name": e.cardName }),
    },
  }),
  parseHTML: () => [{ tag: "span.card-link", getAttrs: (e) => ({ cardName: e.dataset.cardName }) }],
  renderHTML: ({ node: e, HTMLAttributes: t }) => [
    "span",
    mergeAttributes(t, {
      class: "card-link",
      "data-card-name": e.attrs.cardName
    }),
    `@${e.attrs.cardName}`
  ],
  addCommands() {
    return {
      setCardLink: (e) => ({ commands: t }) => t.insertContent({ type: this.name, attrs: { cardName: e } }),
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "@",
        allowSpaces: true,
        command: ({ editor: e, range: t, props: a }) => {
          e.chain().focus().insertContentAt(t, [{ type: this.name, attrs: { cardName: a.id } }, { type: "text", text: " " }]).run();
        },
        items: this.options.suggestion.items,
        render: () => {
          let popup, component;
          return {
            onStart: (props) => {
              component = document.createElement("div");
              component.className = "tiptap-suggestion-list";
              component.style.cssText = "background:#2c2f33; border:1px solid #444; border-radius:6px; box-shadow:0 4px 15px rgba(0,0,0,0.5); min-width:220px; padding:4px; z-index:9999; display:flex; flex-direction:column; gap:2px;";

              const renderItems = (items) => {
                component.innerHTML = "";
                if (!items.length) {
                  component.style.display = "none";
                  return;
                }
                component.style.display = "flex";
                items.forEach((item) => {
                  const btn = document.createElement("button");
                  btn.style.cssText = "display:block; width:100%; text-align:left; background:transparent; border:none; color:#fff; padding:8px 12px; cursor:pointer; font-size:0.9rem; border-radius:4px; transition: background 0.1s;";
                  btn.textContent = item.title;
                  btn.addEventListener("mouseenter", () => btn.style.background = "#3e8ed0");
                  btn.addEventListener("mouseleave", () => btn.style.background = "transparent");
                  btn.addEventListener("mousedown", (ev) => {
                    ev.preventDefault();
                    props.command(item);
                  });
                  component.appendChild(btn);
                });
              };

              renderItems(props.items);

              if (props.items.length) {
                popup = window.tippy("body", {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              }
            },
            onUpdate: (props) => {
              if (!popup) return;

              component.innerHTML = "";
              props.items.forEach((item) => {
                const btn = document.createElement("button");
                btn.style.cssText = "display:block; width:100%; text-align:left; background:transparent; border:none; color:#fff; padding:8px 12px; cursor:pointer; font-size:0.9rem; border-radius:4px;";
                btn.textContent = item.title;
                btn.addEventListener("mousedown", (ev) => {
                  ev.preventDefault();
                  props.command(item);
                });
                component.appendChild(btn);
              });

              if (!props.items.length) {
                popup[0].hide();
              } else {
                popup[0].show();
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
              }
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                popup[0].hide();
                return true;
              }
              return false;
            },
            onExit: () => {
              if (popup) {
                popup[0].destroy();
                popup = null;
              }
            },
          };
        },
      }),
    ];
  },
});