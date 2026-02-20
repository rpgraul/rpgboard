import { Node, mergeAttributes } from "@tiptap/core";

export default Node.create({
    name: "fichaShortcode",
    group: "block",
    content: "block+",
    defining: true,
    draggable: true,
    selectable: true,

    parseHTML() {
        return [{
            tag: 'div[data-node-type="fichaShortcode"]',
        }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, {
            "data-node-type": "fichaShortcode",
            "class": "shortcode-ficha-editor"
        }), 0];
    },

    addNodeView() {
        return ({ node, getPos, editor }) => {
            const dom = document.createElement("div");
            dom.className = "shortcode-ficha-editor";

            const header = document.createElement("div");
            header.className = "ficha-header";
            header.innerHTML = "<span>📋 FICHA DE PERSONAGEM</span>";
            header.contentEditable = "false";

            const contentDOM = document.createElement("div");
            contentDOM.className = "ficha-content-area";

            dom.append(header, contentDOM);

            return {
                dom,
                contentDOM,
                update: (updatedNode) => {
                    if (updatedNode.type.name !== this.name) return false;
                    return true;
                }
            };
        };
    },
});
