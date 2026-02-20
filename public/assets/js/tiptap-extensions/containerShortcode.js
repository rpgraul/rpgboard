import { Node, mergeAttributes } from "@tiptap/core";

export default Node.create({
  name: "containerShortcode",
  group: "block",
  content: "block+",
  defining: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      label: { default: "Novo Container" },
      type: { default: "default" },
      isHidden: { default: false },
      isClosed: { default: false },
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-node-type="containerShortcode"]',
      getAttrs: dom => ({
        label: dom.getAttribute("data-label"),
        type: dom.getAttribute("data-type"),
        isHidden: dom.getAttribute("data-is-hidden") === "true",
        isClosed: dom.getAttribute("data-is-closed") === "true",
      }),
    }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, {
      "data-node-type": "containerShortcode",
      "data-label": HTMLAttributes.label,
      "data-type": HTMLAttributes.type,
      "data-is-hidden": HTMLAttributes.isHidden,
      "data-is-closed": HTMLAttributes.isClosed,
    }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("div");
      dom.className = `shortcode-container-editor type-${node.attrs.type}`;
      dom.classList.toggle("is-hidden-preview", !!node.attrs.isHidden);
      dom.classList.toggle("is-collapsed", !!node.attrs.isClosed);

      const header = document.createElement("div");
      header.className = "container-header";
      header.contentEditable = "false";

      const iconSpan = document.createElement("span");
      iconSpan.className = "icon is-small";
      const getIcon = (type) => {
        if (type === 'inventory') return '🎒';
        if (type === 'spells') return '📜';
        if (type === 'skills') return '✊';
        return '📦';
      };
      iconSpan.innerText = getIcon(node.attrs.type);

      const labelSpan = document.createElement("strong");
      labelSpan.className = "container-label";
      labelSpan.textContent = node.attrs.label;

      const actions = document.createElement("div");
      actions.className = "container-actions";

      // Botão de Visibilidade
      const visibilityBtn = document.createElement("button");
      visibilityBtn.className = `button is-small is-ghost ${node.attrs.isHidden ? 'has-text-danger' : 'has-text-success'}`;
      visibilityBtn.innerText = node.attrs.isHidden ? '🙈' : '👁️';

      const handleVisibility = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof getPos === "function") {
          const currentNode = editor.view.state.doc.nodeAt(getPos());
          if (currentNode) {
            editor.view.dispatch(editor.state.tr.setNodeMarkup(getPos(), undefined, {
              ...currentNode.attrs,
              isHidden: !currentNode.attrs.isHidden
            }));
          }
        }
      };
      visibilityBtn.onclick = handleVisibility;
      visibilityBtn.ondblclick = handleVisibility; // Bloqueia o bubble do duplo clique

      // Botão Expandir/Recolher
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "button is-small is-ghost";
      toggleBtn.innerText = node.attrs.isClosed ? '▶' : '▼';

      const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof getPos === "function") {
          const currentNode = editor.view.state.doc.nodeAt(getPos());
          if (currentNode) {
            editor.view.dispatch(editor.state.tr.setNodeMarkup(getPos(), undefined, {
              ...currentNode.attrs,
              isClosed: !currentNode.attrs.isClosed
            }));
          }
        }
      };
      toggleBtn.onclick = handleToggle;
      toggleBtn.ondblclick = handleToggle; // Bloqueia o bubble do duplo clique

      actions.append(visibilityBtn, toggleBtn);
      header.append(iconSpan, labelSpan, actions);

      header.ondblclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Busca o nó mais recente para evitar dados obsoletos no modal
        const latestNode = editor.view.state.doc.nodeAt(getPos());
        if (latestNode) {
          document.dispatchEvent(new CustomEvent("edit-shortcode", {
            detail: { type: "containerShortcode", attrs: latestNode.attrs, pos: getPos() }
          }));
        }
      };

      const contentDOM = document.createElement("div");
      contentDOM.className = "container-content-area";

      dom.append(header, contentDOM);

      return {
        dom,
        contentDOM,
        stopEvent: (e) => e.target.closest('button') !== null,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false;

          labelSpan.textContent = updatedNode.attrs.label;
          iconSpan.innerText = getIcon(updatedNode.attrs.type);

          visibilityBtn.innerText = updatedNode.attrs.isHidden ? '🙈' : '👁️';
          visibilityBtn.className = `button is-small is-ghost ${updatedNode.attrs.isHidden ? 'has-text-danger' : 'has-text-success'}`;
          dom.classList.toggle("is-hidden-preview", !!updatedNode.attrs.isHidden);

          toggleBtn.innerText = updatedNode.attrs.isClosed ? '▶' : '▼';
          dom.classList.toggle("is-collapsed", !!updatedNode.attrs.isClosed);

          return true;
        }
      };
    };
  },
});