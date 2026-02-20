
// 1. ATUALIZAÇÃO DO PARSER DE ENTRADA (Texto -> Editor)
export function preParseShortcodesForEditor(t) {
    if (!t) return "";

    // ContainerShortcode: [container label="..." type="..." # close]...[/container]
    t = t.replace(/\[container\s+([^\]]+)\]([\s\S]*?)\[\/container\]/gi, (match, args, content) => {
        const params = _parseKeyValueArgs(args);
        const label = params.label || "Container";
        const type = params.type || "default";
        const isHidden = args.includes("#");
        const isClosed = args.includes("close");
        return `<div data-node-type="containerShortcode" data-label="${label}" data-type="${type}" data-is-hidden="${isHidden}" data-is-closed="${isClosed}"><div class="container-content-area">${content}</div></div>`;
    });

    // Ficha Wrapper: [ficha]...[/ficha]
    t = t.replace(/\[ficha\]([\s\S]*?)\[\/ficha\]/gi, (match, content) => {
        return `<div data-node-type="fichaShortcode"><div class="ficha-content-area">${content}</div></div>`;
    });

    // Money: [money current="100" gold #]
    t = t.replace(/\[money\s+([^\]]+)\]/gi, (match, args) => {
        const params = _parseKeyValueArgs(args);
        const hidden = args.includes("#");
        const pos = ["left", "right", "bottom", "top"].find(a => args.toLowerCase().includes(a)) || "";
        const curr = args.toLowerCase().includes("gold") ? "gold" : (args.toLowerCase().includes("silver") ? "silver" : "copper");
        return `<span data-node-type="moneyNode" data-current="${params.current || "0"}" data-currency="${curr}" data-is-hidden="${hidden}" data-position="${pos}"></span>`;
    });

    // HP: [hp max="20" current="15" #]
    t = t.replace(/\[hp\s+([^\]]+)\]/gi, (match, args) => {
        const params = _parseKeyValueArgs(args);
        const hidden = args.includes("#");
        const pos = ["left", "right", "bottom", "top"].find(a => args.toLowerCase().includes(a)) || "";
        return `<span data-node-type="hpNode" data-max="${params.max || "0"}" data-current="${params.current || "0"}" data-is-hidden="${hidden}" data-position="${pos}"></span>`;
    });

    // Stat: [stat "Força" "18" #]
    t = t.replace(/\[stat\s+([^\]]+)\]/gi, (match, args) => {
        const hidden = args.includes("#");
        const pos = ["left", "right", "bottom", "top"].find(a => args.toLowerCase().includes(a)) || "";
        const parts = _splitArgs(args);
        const label = parts[0] || "Stat";
        const value = parts[1] || "0";
        return `<span data-node-type="statNode" data-label="${label.replace(/^["']|["']$/g, "")}" data-value="${value.replace(/^["']|["']$/g, "")}" data-is-hidden="${hidden}" data-position="${pos}"></span>`;
    });

    // Count: [* "Flechas" max=20 current=10 #] ou [count "Peso" max=50 current=20 #]
    t = t.replace(/\[(\*|count)\s+([^\]]+)\]/gi, (match, type, args) => {
        const isOverlay = type === "*";
        const params = _parseKeyValueArgs(args);
        const splitted = _splitArgs(args);
        let label = "";
        if (splitted[0] && !splitted[0].includes("=")) {
            label = splitted[0];
        }
        const max = params.max ? parseInt(params.max, 10) : 0;
        const current = params.current ? parseInt(params.current, 10) : 0;
        let theme = params.theme || (args.includes("checkbox") ? "checkbox" : "number");
        const pos = ["left", "right", "bottom", "top"].find(a => args.includes(a.toLowerCase())) || "";
        const hidden = args.includes("#");
        return `<span data-node-type="countNode" data-label="${label.replace(/^["']|["']$/g, "")}" data-max="${max}" data-current="${current}" data-theme="${theme}" data-icon="${params.icon || ""}" data-is-overlay="${isOverlay}" data-position="${pos}" data-is-hidden="${hidden}"></span>`;
    });

    return t;
}

// 2. ATUALIZAÇÃO DO PARSER DE SAÍDA (Editor -> Texto)
export function convertEditorHtmlToShortcodes(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const body = doc.body;

    // Processa os containers de forma limpa
    body.querySelectorAll('[data-node-type="containerShortcode"]').forEach((e) => {
        const label = e.getAttribute("data-label") || "Container";
        const type = e.getAttribute("data-type") || "default";
        const isHidden = e.getAttribute("data-is-hidden") === "true";
        const isClosed = e.getAttribute("data-is-closed") === "true";

        const openTag = `[container label="${label}" type="${type}"${isClosed ? ' close' : ''}${isHidden ? ' #' : ''}]`;
        const closeTag = `[/container]`;

        const contentArea = e.querySelector('.container-content-area') || e;
        const innerHTML = contentArea.innerHTML;

        e.replaceWith(document.createTextNode(openTag), ...parser.parseFromString(innerHTML, "text/html").body.childNodes, document.createTextNode(closeTag));
    });

    // Processa Wrapper de Ficha
    body.querySelectorAll('[data-node-type="fichaShortcode"]').forEach((e) => {
        const contentArea = e.querySelector('.ficha-content-area') || e;
        const innerHTML = contentArea.innerHTML;
        e.replaceWith(document.createTextNode("[ficha]"), ...parser.parseFromString(innerHTML, "text/html").body.childNodes, document.createTextNode("[/ficha]"));
    });

    body.querySelectorAll('[data-node-type="moneyNode"]').forEach((e) => {
        const args = [];
        const curr = e.getAttribute("data-currency"); if (curr) args.push(curr);
        const pos = e.getAttribute("data-position"); if (pos) args.push(pos);
        if (e.getAttribute("data-is-hidden") === "true") args.push("#");
        e.replaceWith(document.createTextNode(`[money current="${e.getAttribute("data-current") || "0"}"${args.length ? " " + args.join(" ") : ""}]`));
    });
    body.querySelectorAll('[data-node-type="hpNode"]').forEach((e) => {
        const args = [];
        const pos = e.getAttribute("data-position"); if (pos) args.push(pos);
        if (e.getAttribute("data-is-hidden") === "true") args.push("#");
        e.replaceWith(document.createTextNode(`[hp max="${e.getAttribute("data-max") || "0"}" current="${e.getAttribute("data-current") || "0"}"${args.length ? " " + args.join(" ") : ""}]`));
    });
    body.querySelectorAll('[data-node-type="statNode"]').forEach((e) => {
        const args = [];
        const pos = e.getAttribute("data-position"); if (pos) args.push(pos);
        if (e.getAttribute("data-is-hidden") === "true") args.push("#");
        e.replaceWith(document.createTextNode(`[stat "${(e.getAttribute("data-label") || "").replace(/"/g, "'")}" "${(e.getAttribute("data-value") || "").replace(/"/g, "'")}"${args.length ? " " + args.join(" ") : ""}]`));
    });
    body.querySelectorAll('[data-node-type="countNode"]').forEach((e) => {
        const c = [];
        const label = e.getAttribute("data-label"); if (label) c.push(`"${label.trim()}"`);
        c.push(`max=${e.getAttribute("data-max") || "0"}`);
        c.push(`current=${e.getAttribute("data-current") || "0"}`);
        const theme = e.getAttribute("data-theme"); if (theme && theme !== "number") c.push(theme);
        const icon = e.getAttribute("data-icon"); if (icon) c.push(`icon="${icon.trim()}"`);
        const pos = e.getAttribute("data-position"); if (pos) c.push(pos);
        if (e.getAttribute("data-is-overlay") === "true") c.unshift("*");
        if (e.getAttribute("data-is-hidden") === "true") c.push("#");
        e.replaceWith(document.createTextNode(`[${c.join(" ")}]`));
    });

    return body.innerHTML;
}

// Helpers privados para o parser (copiados de shortcodeParser.js ou similares)
function _parseKeyValueArgs(t) {
    const r = {};
    const e = t.match(/(\w+)=(?:(["'])(.*?)\2|(\S+))/g);
    if (e) e.forEach(t => { const [e, n] = t.split("="); r[e] = n.replace(/^["']|["']$/g, ""); });
    return r;
}

function _splitArgs(t) {
    const r = [];
    let e = "", n = !1;
    for (let s = 0; s < t.length; s++) {
        const i = t[s];
        '"' === i || "'" === i ? (n = !n, e += i) : " " !== i || n ? (e += i) : (r.push(e), e = "");
    }
    return e && r.push(e), r.filter(t => t.trim().length > 0);
}
