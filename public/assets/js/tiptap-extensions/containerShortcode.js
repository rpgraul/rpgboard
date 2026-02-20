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
      isOpen: { default: true }, 
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-node-type="containerShortcode"]',
      getAttrs: dom => ({
        label: dom.getAttribute("data-label"),
        type: dom.getAttribute("data-type"),
        isHidden: dom.getAttribute("data-is-hidden") === "true",
      }),
    }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-node-type": "containerShortcode" }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      // Container Principal
      const dom = document.createElement("div");
      dom.className = `shortcode-container-editor type-${node.attrs.type}`;
      dom.classList.toggle("is-hidden-preview", node.attrs.isHidden);
      dom.classList.toggle("is-collapsed", !node.attrs.isOpen);
      dom.setAttribute("data-label", node.attrs.label);

      // Header
      const header = document.createElement("div");
      header.className = "container-header";
      header.contentEditable = "false";

      // Ícone
      const iconSpan = document.createElement("span");
      iconSpan.className = "icon is-small";
      const getIcon = (type) => {
        if (type === 'inventory') return 'fa-suitcase';
        if (type === 'spells') return 'fa-scroll';
        if (type === 'skills') return 'fa-fist-raised';
        return 'fa-box';
      };
      iconSpan.innerHTML = `<i class="fas ${getIcon(node.attrs.type)}"></i>`;

      // Label
      const labelSpan = document.createElement("strong");
      labelSpan.className = "container-label";
      labelSpan.textContent = node.attrs.label;

      // Botões
      const actions = document.createElement("div");
      actions.className = "container-actions";

      const visibilityBtn = document.createElement("button");
      visibilityBtn.className = `button is-small is-ghost ${node.attrs.isHidden ? 'has-text-danger' : 'has-text-success'}`;
      visibilityBtn.innerHTML = `<i class="fas ${node.attrs.isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
      visibilityBtn.onclick = () => {
        if (typeof getPos === "function") editor.commands.updateAttributes("containerShortcode", { isHidden: !node.attrs.isHidden });
      };

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "button is-small is-ghost";
      toggleBtn.innerHTML = `<i class="fas ${node.attrs.isOpen ? 'fa-chevron-down' : 'fa-chevron-right'}"></i>`;
      toggleBtn.onclick = () => {
        if (typeof getPos === "function") editor.commands.updateAttributes("containerShortcode", { isOpen: !node.attrs.isOpen });
      };

      actions.append(visibilityBtn, toggleBtn);
      header.append(iconSpan, labelSpan, actions);

      // Área de Conteúdo
      const contentDOM = document.createElement("div");
      contentDOM.className = "container-content-area";
      // Não forçamos contentEditable aqui, o Tiptap gerencia via contentDOM

      dom.append(header, contentDOM);

      // Listener para o modal de edição (Clique duplo no header)
      header.ondblclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.dispatchEvent(new CustomEvent("edit-shortcode", {
          detail: { type: "container", attrs: node.attrs, pos: getPos() }
        }));
      };

      return {
        dom,
        contentDOM,
        // stopEvent permite que cliques nos botões funcionem sem o Tiptap interceptar
        stopEvent: event => {
          const isButton = !!event.target.closest('button');
          return isButton;
        },
        ignoreMutation: mutation => {
          // Ignora mudanças feitas pelo FontAwesome (SVG)
          return mutation.type === 'childList' && (mutation.target.nodeName === 'SVG' || mutation.target.nodeName === 'path');
        },
        update: updatedNode => {
          if (updatedNode.type.name !== this.name) return false;
          return true; // Deixa o Tiptap re-renderizar se houver mudanças
        }
      };
    };
  },
});