import { parseArguments, parseKeyValueArgs, shortcodeRegexes } from './parserUtils.js';

export function preParseShortcodesForEditor(t) {
    if (!t) return "";

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
        const splitted = parseArguments(args);
        const label = params.label || (splitted[0] && !splitted[0].includes('=') ? splitted[0] : "");
        const hidden = args.includes("#");
        return `<span data-node-type="xpNode" data-current="${params.current || "0"}" data-label="${label.replace(/^["']|["']$/g, "")}" data-is-hidden="${hidden}"></span>`;
    });

    return t;
}

export function convertEditorHtmlToShortcodes(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const body = doc.body;

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
        const label = e.getAttribute("data-label");
        if (label) args.push(`"${label.replace(/"/g, "'")}"`);
        if (e.getAttribute("data-is-hidden") === "true") args.push("#");
        e.replaceWith(document.createTextNode(`[xp current="${e.getAttribute("data-current") || "0"}"${args.length ? " " + args.join(" ") : ""}]`));
    });

    return body.innerHTML;
}

export function handleToolbarAction(editor, action, val) {
    if (!editor || !action) return;
    const chain = editor.chain().focus();
    if (action === "undo") chain.undo().run();
    else if (action === "redo") chain.redo().run();
    else if (action === "toggleBold") chain.toggleBold().run();
    else if (action === "toggleItalic") chain.toggleItalic().run();
    else if (action === "toggleStrike") chain.toggleStrike().run();
    else if (action === "toggleHighlight") chain.toggleHighlight().run();
    else if (action === "toggleHeading") chain.toggleHeading({ level: parseInt(val) }).run();
    else if (action === "toggleBulletList") chain.toggleBulletList().run();
    else if (action === "toggleOrderedList") chain.toggleOrderedList().run();
    else if (action === "setTextAlign") chain.setTextAlign(val).run();
}
