import { parseArguments, parseKeyValueArgs, shortcodeRegexes } from './parserUtils.js';

// 1. ATUALIZAÇÃO DO PARSER DE ENTRADA (Texto -> Editor)
export function preParseShortcodesForEditor(t) {
    if (!t) return "";

    // ContainerShortcode: [container label="..." type="..." # close]...[/container]
    t = t.replace(shortcodeRegexes.container, (match, argsStr, content) => {
        const params = parseKeyValueArgs(argsStr);
        const label = params.label || "Container";
        const type = params.type || "default";
        const isHidden = argsStr.includes("#") || params.ishidden === "true";
        const isClosed = /\bclose\b/i.test(argsStr);
        return `<div data-node-type="containerShortcode" data-label="${label}" data-type="${type}" data-is-hidden="${isHidden}" data-is-closed="${isClosed}"><div class="container-content-area">${content}</div></div>`;
    });

    // Ficha Wrapper: [ficha]...[/ficha]
    t = t.replace(shortcodeRegexes.ficha, (match, content) => {
        return `<div data-node-type="fichaShortcode"><div class="ficha-content-area">${content}</div></div>`;
    });

    // Money: [money current="100" gold #]
    t = t.replace(shortcodeRegexes.money, (match, args) => {
        const params = parseKeyValueArgs(args);
        const hidden = args.includes("#");
        const pos = ["left", "right", "bottom", "top"].find(a => args.toLowerCase().includes(a)) || "";
        const curr = args.toLowerCase().includes("gold") ? "gold" : (args.toLowerCase().includes("silver") ? "silver" : "copper");
        return `<span data-node-type="moneyNode" data-current="${params.current || "0"}" data-currency="${curr}" data-is-hidden="${hidden}" data-position="${pos}"></span>`;
    });

    // HP: [hp max="20" current="15" #]
    t = t.replace(shortcodeRegexes.hp, (match, args) => {
        const params = parseKeyValueArgs(args);
        const hidden = args.includes("#");
        const pos = ["left", "right", "bottom", "top"].find(a => args.toLowerCase().includes(a)) || "";
        return `<span data-node-type="hpNode" data-max="${params.max || "0"}" data-current="${params.current || "0"}" data-is-hidden="${hidden}" data-position="${pos}"></span>`;
    });

    // Stat: [stat "Força" "18" #]
    t = t.replace(shortcodeRegexes.stat, (match, args) => {
        const hidden = args.includes("#");
        const pos = ["left", "right", "bottom", "top"].find(a => args.toLowerCase().includes(a)) || "";
        const parts = parseArguments(args);
        const label = parts[0] || "Stat";
        const value = parts[1] || "0";
        return `<span data-node-type="statNode" data-label="${label.replace(/^["']|["']$/g, "")}" data-value="${value.replace(/^["']|["']$/g, "")}" data-is-hidden="${hidden}" data-position="${pos}"></span>`;
    });

    // Count: [* "Flechas" max=20 current=10 #] ou [count "Peso" max=50 current=20 #]
    t = t.replace(shortcodeRegexes.count, (match, type, args) => {
        const isOverlay = type === "*";
        const params = parseKeyValueArgs(args);
        const splitted = parseArguments(args);
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
    
    // XP: [xp current="100" #]
    t = t.replace(shortcodeRegexes.xp, (match, args) => {
        const params = parseKeyValueArgs(args);
        const hidden = args.includes("#");
        return `<span data-node-type="xpNode" data-current="${params.current || "0"}" data-is-hidden="${hidden}"></span>`;
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

        const openTag = `[container label="${label}" type="${type}"${isClosed ? ' close' : ''}${isHidden ? ' #' : ''}]\n`;
        const closeTag = `\n[/container]`;

        const contentArea = e.querySelector('.container-content-area') || e;
        const innerHTML = contentArea.innerHTML;

        e.replaceWith(document.createTextNode(openTag), ...parser.parseFromString(innerHTML, "text/html").body.childNodes, document.createTextNode(closeTag));
    });

    // Processa Wrapper de Ficha
    body.querySelectorAll('[data-node-type="fichaShortcode"]').forEach((e) => {
        const contentArea = e.querySelector('.ficha-content-area') || e;
        const innerHTML = contentArea.innerHTML;
        e.replaceWith(document.createTextNode("[ficha]\n"), ...parser.parseFromString(innerHTML, "text/html").body.childNodes, document.createTextNode("\n[/ficha]"));
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
    
    body.querySelectorAll('[data-node-type="xpNode"]').forEach((e) => {
        const args = [];
        if (e.getAttribute("data-is-hidden") === "true") args.push("#");
        e.replaceWith(document.createTextNode(`[xp current="${e.getAttribute("data-current") || "0"}"${args.length ? " " + args.join(" ") : ""}]`));
    });

    return body.innerHTML;
}
