export function _parseArguments(str) {
    const regex = /"([^"]+)"|\S+/g;
    const args = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
        args.push(match[1] || match[0]);
    }
    return args;
}

export function _parseKeyValueArgs(args) {
    const params = {};
    if (!args) return params;
    args.forEach(arg => {
        const parts = arg.split('=');
        if (parts.length === 2) {
            params[parts[0].toLowerCase()] = parts[1].replace(/^['"]|['"]$/g, '');
        }
    });
    return params;
}

function formatNumber(num) {
    if (typeof num !== 'number' && typeof num !== 'string') return num;
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function _parseStat(args, originalShortcode) {
    const positionKeywords = ["left", "right", "bottom"];
    const mainArgs = args.filter(arg => !positionKeywords.includes(arg) && arg !== 'isPlayerSheet');

    if (mainArgs.length === 0) return "";

    const addTooltip = (text) => {
        if (!text) return "";
        const match = text.match(/(.*?)\s*\((.*?)\)/);
        if (match) {
            const mainText = match[1].trim();
            const tooltipText = match[2].trim();
            return `<span class="has-tooltip" data-tooltip="${tooltipText}">${mainText}</span>`;
        }
        return text;
    };

    const value = mainArgs[mainArgs.length - 1] || "";
    const label = mainArgs.length > 1 ? mainArgs.slice(0, -1).join(' ') : "";

    const dataAttrs = originalShortcode ? `data-shortcode="${encodeURIComponent(originalShortcode)}"` : "";

    return `<div class="shortcode-stat is-interactive" ${dataAttrs}>
                ${label ? `<strong>${label}:</strong> ` : ""}
                <span class="stat-value-display">${addTooltip(value)}</span>
                <input type="text" class="stat-value-input is-hidden" value="${value}">
            </div>`;
}


function _parseHp(args, itemId, originalShortcode) {
    const params = _parseKeyValueArgs(args);
    const maxHp = parseInt(params.max, 10) || 100;
    const currentHp = params.current !== undefined ? parseInt(params.current, 10) : maxHp;
    const finalCurrentHp = Math.max(-10, Math.min(currentHp, maxHp));
    const percent = finalCurrentHp > 0 ? Math.round((finalCurrentHp / maxHp) * 100) : 0;

    const safeShortcode = `[hp current="${finalCurrentHp}" max="${maxHp}"]`;

    let colorClass = 'is-high';
    if (finalCurrentHp <= 0) colorClass = 'is-dead';
    else if (percent < 15) colorClass = 'is-critical';
    else if (percent < 30) colorClass = 'is-low';
    else if (percent < 60) colorClass = 'is-medium';

    const deadClass = finalCurrentHp <= 0 ? 'is-unconscious' : '';

    return `<div class="shortcode-hp ${deadClass}" data-item-id="${itemId}" data-shortcode="${encodeURIComponent(safeShortcode)}" data-max-hp="${maxHp}">
              <div class="hp-display-mode">
                  <div class="hp-header">
                      <strong class="hp-label">PV</strong>
                      <span class="hp-text">${finalCurrentHp} / ${maxHp}</span>
                  </div>
                  <div class="hp-bar-container">
                      <div class="hp-bar-fill ${colorClass}" style="width: ${percent}%"></div>
                  </div>
              </div>
              <div class="hp-edit-mode is-hidden">
                  <input type="text" class="hp-current-input" value="${finalCurrentHp}" placeholder="Add +/- or value">
              </div>
          </div>`;
}

export function parseHpShortcode(item) {
    if (!item || !item.conteudo) return "";
    const match = item.conteudo.match(/\[hp\s+(.*?)\]/i);
    if (match) {
        const args = _parseArguments(match[1]);
        return _parseHp(args, item.id, match[0]);
    }
    return "";
}

function _parseCount(args, itemId, originalShortcode) {
    const positionKeywords = ["left", "right", "bottom"];
    const isCheckbox = args.includes("checkbox");
    const mainArgs = args.filter(arg => arg !== "checkbox" && !positionKeywords.includes(arg));

    const params = _parseKeyValueArgs(mainArgs.filter(arg => arg.includes('=')));
    let theme = 'number';
    if (params.icon) theme = 'custom-icon';
    else if (params.theme) theme = params.theme;
    else if (isCheckbox) theme = 'default';

    const name = mainArgs.find(arg => !arg.includes('=')) || '';
    const max = parseInt(params.max, 10) || 0;
    let current = params.current !== undefined ? parseInt(params.current, 10) : max;
    current = Math.max(0, Math.min(current, max));

    if (!name && max === 0) return "";

    const dataAttrs = `data-item-id="${itemId}" data-shortcode="${encodeURIComponent(originalShortcode)}"`;
    let representation = '';

    if (['default', 'arrow', 'potion', 'custom-icon'].includes(theme) && max > 0) {
        representation = `<span class="count-checkboxes-interactive theme-${theme}">`;
        for (let i = 1; i <= max; i++) {
            const isChecked = i <= current;
            let icon = '';
            if (theme === 'arrow') icon = '<i class="fas fa-arrow-up"></i>';
            else if (theme === 'potion') icon = '<i class="fas fa-flask"></i>';
            else if (theme === 'custom-icon') icon = `<i class="fas fa-${params.icon.replace(/["']/g, '')}"></i>`;
            representation += `<span class="count-checkbox ${isChecked ? 'is-checked' : ''}" data-value="${i}" role="button" tabindex="0">${icon}</span>`;
        }
        representation += `</span>`;
    } else {
        representation = `<span class="count-value-interactive">
      <button class="count-btn" data-action="decrement" aria-label="Diminuir">-</button>
      <span class="count-current-value">${current}</span>
      <span class="count-separator">/</span>
      <span class="count-max-value">${max}</span>
      <button class="count-btn" data-action="increment" aria-label="Aumentar">+</button>
      </span>`.replace(/\s+/g, ' ');
    }

    representation = `<div class="count-representation">${representation}</div>`;

    return `<div class="shortcode-count is-interactive" ${dataAttrs}>
              ${name ? `<strong class="count-name">${name}:</strong> ` : ''}
              ${representation}
          </div>`;
}

/**
 * Renderiza o conteúdo principal para o Grid/Visualização Padrão.
 * Transforma [container] em HTML colapsável simples.
 */
export function parseMainContent(content) {
    if (!content) return "";
    let processedContent = content;

    // Novo Parser de Containers (Substitui [nota])
    // Formato: [container label="Mochila" type="inventory" isHidden="false"]...[/container]
    const containerRegex = /\[container\s+([^\]]*)\]([\s\S]*?)\[\/container\]/gi;

    processedContent = processedContent.replace(containerRegex, (match, argsStr, innerContent) => {
        const args = _parseKeyValueArgs(_parseArguments(argsStr));
        const label = args.label || "Container";
        const type = args.type || "default";
        const isHidden = argsStr.includes('#') || args.ishidden === "true";
        const isClosed = /\bclose\b/i.test(argsStr);

        // Ícone baseado no tipo
        let icon = "fa-box";
        if (type === 'inventory') icon = "fa-suitcase";
        if (type === 'spells') icon = "fa-scroll";
        if (type === 'skills') icon = "fa-fist-raised";

        return `<div class="shortcode-container-view ${isHidden ? 'is-hidden-from-players' : ''} ${!isClosed ? 'is-open' : ''} type-${type}">
            <div class="container-header" onclick="this.parentElement.classList.toggle('is-open')">
                <span class="icon"><i class="fas ${icon}"></i></span>
                <span class="container-label">${label}</span>
                <span class="icon toggle-icon"><i class="fas fa-chevron-down"></i></span>
            </div>
            <div class="container-body">
                ${innerContent.trim()}
            </div>
        </div>`;
    });

    // Novo Parser de Ficha (Isola no editor, remove no grid para narrativa pura)
    const fichaRegex = /\[ficha\]([\s\S]*?)\[\/ficha\]/gi;
    processedContent = processedContent.replace(fichaRegex, "");

    // Remove tags de Hide isoladas, stats soltos, etc, que não devem aparecer no texto corrido
    processedContent = processedContent.replace(/\[(hide|#)\]([\s\S]*?)\[\/(hide|#)\]/gi, (match, startTag, hiddenContent, endTag) => {
        if (startTag.toLowerCase() !== endTag.toLowerCase()) return match;
        return `<div class="is-hidden-from-players">${hiddenContent}</div>`;
    });

    processedContent = processedContent.replace(/\[(\*?)(stat|hp|count|money)\s.*?\]/gi, '');
    processedContent = processedContent.replace(/<p>\s*<\/p>/gi, '');

    return processedContent.trim();
}

/**
 * Extrai apenas os containers para serem usados como botões/modais na Ficha.
 * Retorna um array de objetos com label, type, content, isHidden.
 */
export function extractContainers(content) {
    if (!content) return [];
    const containers = [];
    // Regex aprimorada para capturar atributos e conteúdo de forma mais robusta
    const containerRegex = /\[container\s+([^\]]*)\]([\s\S]*?)\[\/container\]/gi;
    let match;

    while ((match = containerRegex.exec(content)) !== null) {
        const argsStr = match[1];
        const innerContent = match[2];
        const args = _parseKeyValueArgs(_parseArguments(argsStr));

        const type = args.type || "default";
        // Fallback: se não houver label, usa o type com inicial maiúscula
        const label = args.label || (type.charAt(0).toUpperCase() + type.slice(1));

        containers.push({
            label: label,
            type: type,
            isHidden: argsStr.includes('#') || args.ishidden === "true",
            isClosed: /\bclose\b/i.test(argsStr),
            content: innerContent.trim(),
            fullMatch: match[0]
        });
    }
    return containers;
}

/**
 * Extrai apenas o conteúdo dentro das tags [ficha].
 */
export function extractFichaContent(content) {
    if (!content) return "";
    const match = content.match(/\[ficha\]([\s\S]*?)\[\/ficha\]/i);
    return match ? match[1].trim() : "";
}

export function parseAllShortcodes(item, options = {}) {
    if (!item || !item.conteudo) return { all: [], left: "", right: "", bottom: "", details: "" };

    const result = { all: [], left: [], right: [], bottom: [], details: [] };
    const commandOrder = { stat: 1, money: 2, hp: 3, count: 4, default: 99 };
    const content = item.conteudo;
    const shortcodeRegex = /\[(.*?)\]/g;
    let match;

    const foundShortcodes = [];
    while ((match = shortcodeRegex.exec(content)) !== null) {
        // Ignorar se estiver dentro de um container (hack simples, ideal seria parser de árvore)
        // Por enquanto, assumimos que shortcodes globais não estão aninhados profundamente em texto
        if (!match[0].startsWith('[container') && !match[0].startsWith('[/container')) {
            foundShortcodes.push({ full: match[0], inner: match[1], index: match.index });
        }
    }

    const hiddenRanges = [];
    const hideRegex = /\[(hide|#)\]([\s\S]*?)\[\/(hide|#)\]/gi;
    let hideMatch;
    while ((hideMatch = hideRegex.exec(content)) !== null) {
        const [full, startTag, innerContent, endTag] = hideMatch;
        if (startTag.toLowerCase() === endTag.toLowerCase()) {
            const startIndex = hideMatch.index + full.indexOf(innerContent);
            hiddenRanges.push({ start: startIndex, end: startIndex + innerContent.length });
        }
    }

    const parsedShortcodes = foundShortcodes.map(sc => {
        const args = _parseArguments(sc.inner);
        const commandRaw = args[0] || '';
        const command = commandRaw.replace(/^[#*]+/, '').toLowerCase();

        if (!['stat', 'hp', 'count', 'money'].includes(command)) return null;

        const isHashHidden = commandRaw.startsWith('#');
        const isArgHidden = args.includes('#');
        const isInsideHideBlock = hiddenRanges.some(range => sc.index >= range.start && sc.index < range.end);

        let finalArgs = args.slice(1);
        if (isArgHidden) {
            finalArgs = finalArgs.filter(arg => arg !== '#');
        }

        return {
            command: command,
            args: finalArgs,
            originalShortcode: sc.full,
            isHidden: isHashHidden || isArgHidden || isInsideHideBlock,
            order: commandOrder[command] || commandOrder.default
        };
    }).filter(Boolean);

    parsedShortcodes.sort((a, b) => a.order - b.order);

    const wrapIfHidden = (html, isHidden) => isHidden ? `<div class="is-hidden-from-players">${html}</div>` : html;

    parsedShortcodes.forEach(sc => {
        let position = null;
        if (sc.args.includes("left")) position = "left";
        else if (sc.args.includes("right")) position = "right";
        else if (sc.args.includes("bottom")) position = "bottom";

        let html = '';
        let shortcodeData = {
            type: sc.command,
            isResource: false,
            html: ''
        };

        const finalArgs = options.isPlayerSheet ? [...sc.args, 'isPlayerSheet'] : sc.args;

        switch (sc.command) {
            case "stat":
                html = _parseStat(finalArgs, sc.originalShortcode);
                result[position || 'left'].push(wrapIfHidden(html, sc.isHidden));
                break;
            case "hp":
                html = _parseHp(finalArgs, item.id, sc.originalShortcode);
                result[position || 'bottom'].push(wrapIfHidden(html, sc.isHidden));
                break;
            case "money":
                const params = _parseKeyValueArgs(finalArgs);
                const currentRaw = (params.current || "").replace(/[^\d.\-]/g, '');
                const currentValue = parseFloat(currentRaw) || 0;
                let currency = params.currency || '';
                if (!currency) {
                    const positionKeywords = ['left', 'right', 'bottom'];
                    const currencyArg = finalArgs.find(arg => !arg.includes('=') && !positionKeywords.includes(arg));
                    if (currencyArg) currency = currencyArg;
                    else if (options.defaultCurrency) currency = options.defaultCurrency;
                }
                const formattedValue = formatNumber(currentValue);

                html = `<div class="shortcode-money is-interactive" data-item-id="${item.id}" data-shortcode="${encodeURIComponent(sc.originalShortcode)}">
                          <i class="fas fa-coins"></i>
                          <span class="money-value-display">${formattedValue}</span>
                          <input type="text" class="money-value-input is-hidden" value="${currentValue}">
                          <span class="money-currency">${currency}</span>
                        </div>`.replace(/\s+/g, ' ');
                result[position || 'left'].push(wrapIfHidden(html, sc.isHidden));
                break;
            case "count":
                const isResource = sc.originalShortcode.includes("[*count");
                shortcodeData.isResource = isResource;
                html = _parseCount(finalArgs, item.id, sc.originalShortcode);
                const wrappedHtml = wrapIfHidden(html, sc.isHidden);

                if (isResource) {
                    result[position || 'right'].push(wrappedHtml);
                } else if (position) {
                    result[position].push(wrappedHtml);
                } else {
                    result.details.push(wrappedHtml);
                }
                break;
        }

        if (html) {
            shortcodeData.html = html;
            result.all.push(shortcodeData);
        }
    });

    return {
        all: result.all,
        left: result.left.join(''),
        right: result.right.join(''),
        bottom: result.bottom.join(''),
        details: result.details.join('')
    };
}

export function extractRawShortcodes(content) {
    if (!content) return [];
    const regex = /\[(.*?)\]/g;
    const shortcodes = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        shortcodes.push(match[0]);
    }
    return shortcodes;
}

// Legacy support (opcional, pode ser removido se migrarmos tudo)
export function parseNotas(content) {
    return "";
}