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

function _parseStat(args) {
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
    
    if (mainArgs.length === 1 || mainArgs[0].toLowerCase() === 'null') {
        const content = mainArgs.length === 1 ? mainArgs[0] : mainArgs.slice(1).join(' ');
        return `<div class="shortcode-stat">${addTooltip(content)}</div>`;
    }

    const value = mainArgs[mainArgs.length - 1];
    const label = mainArgs.slice(0, -1).join(' ');
    
    return `<div class="shortcode-stat"><strong>${label}:</strong> ${addTooltip(value)}</div>`;
}


function _parseHp(args, itemId, originalShortcode) {
    const params = _parseKeyValueArgs(args);
    const maxHp = parseInt(params.max, 10) || 100;
    const currentHp = params.current !== undefined ? parseInt(params.current, 10) : maxHp;
    const finalCurrentHp = Math.max(0, Math.min(currentHp, maxHp));

    return `<div class="shortcode-hp" data-item-id="${itemId}" data-shortcode="${encodeURIComponent(originalShortcode)}" data-max-hp="${maxHp}">
              <strong class="hp-label">PV</strong>
              <div class="hp-input-wrapper">
                  <input type="number" class="hp-current-input" value="${finalCurrentHp}" max="${maxHp}" min="0">
                  <span class="hp-max-value">/ ${maxHp}</span>
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


export function parseMainContent(content) {
    if (!content) return "";
    let processedContent = content;
    
    processedContent = processedContent.replace(/<p>\s*(\[nota\s+[^\]]+\])\s*<\/p>/gi, '');
    processedContent = processedContent.replace(/<p>\s*(\[\/nota\])\s*<\/p>/gi, '');
    
    processedContent = processedContent.replace(/\[nota\s+titulo="([^"]+)"\s*(#)?\]([\s\S]*?)\[\/nota\]/gi, (match, title, isHidden, noteContent) => {
        return `<div class="shortcode-nota ${isHidden ? 'is-hidden-from-players' : ''}">
          <div class="nota-header" role="button" tabindex="0">
              <span class="nota-title">${title}</span>
              <span class="nota-icon"><i class="fas fa-plus"></i></span>
          </div>
          <div class="nota-content">${noteContent.trim()}</div>
      </div>`;
    });

    processedContent = processedContent.replace(/\[(hide|#)\]([\s\S]*?)\[\/(hide|#)\]/gi, (match, startTag, hiddenContent, endTag) => {
        if (startTag.toLowerCase() !== endTag.toLowerCase()) return match;
        return `<div class="is-hidden-from-players">${hiddenContent}</div>`;
    });

    processedContent = processedContent.replace(/\[(\*?)(stat|hp|count|money)\s.*?\]/gi, '');
    processedContent = processedContent.replace(/<p>\s*<\/p>/gi, '');
    
    return processedContent.trim();
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
        foundShortcodes.push({ full: match[0], inner: match[1], index: match.index });
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
                html = _parseStat(finalArgs);
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
            shortcodeData.html = html; // Store the unwrapped HTML
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
    
    export function parseNotas(content) {
        if (!content) return "";
        let result = '';
        
        // This regex finds all [nota] blocks and extracts their parts.
        const notaRegex = /\[nota\s+titulo="([^"]+)"\s*(#)?\]([\s\S]*?)\[\/nota\]/gi;
        
        // Use replace to iterate over all matches, but build the result separately.
        content.replace(notaRegex, (match, title, isHidden, noteContent) => {
            result += `<div class="shortcode-nota ${isHidden ? 'is-hidden-from-players' : ''}">
              <div class="nota-header" role="button" tabindex="0">
                  <span class="nota-title">${title}</span>
                  <span class="nota-icon"><i class="fas fa-plus"></i></span>
              </div>
              <div class="nota-content">${noteContent.trim()}</div>
          </div>`;
          return ''; // Return empty string as we are not modifying the original content string here.
        });
    
        return result;
    }
    