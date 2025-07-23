/**
 * Módulo para analisar e renderizar shortcodes dentro de um texto.
 */

// Helper para identificar quais shortcodes são sempre visíveis por padrão.
const ALWAYS_VISIBLE_COMMANDS = ['stat']; // HP agora é tratado separadamente

/**
 * Analisa uma string de argumentos, respeitando strings entre aspas.
 * @param {string} argString - A string de conteúdo do shortcode.
 * @returns {string[]} Um array de argumentos.
 */
export function _parseArguments(argString) {
    // Regex: Encontra palavras entre aspas ou sequências de caracteres sem espaço.
    const regex = /"([^"]+)"|\S+/g;
    const args = [];
    let match;
    // Itera sobre todas as correspondências na string.
    while ((match = regex.exec(argString)) !== null) {
        // Adiciona o grupo capturado (sem aspas) ou a correspondência inteira.
        args.push(match[1] || match[0]);
    }
    return args;
}

/**
 * Helper para analisar argumentos no formato chave=valor.
 * @param {string[]} args - Array de argumentos como ["max=100", "current=80"].
 * @returns {object} - Objeto com os pares chave-valor.
 */
export function _parseKeyValueArgs(args) {
    const params = {};
    args.forEach(arg => {
        const parts = arg.split('=');
        if (parts.length === 2) {
            // Remove aspas do início e do fim do valor, se existirem.
            params[parts[0].toLowerCase()] = parts[1].replace(/^"|"$/g, '');
        }
    });
    return params;
}

/**
 * Formats a number with dots as thousand separators.
 * @param {number} num The number to format.
 * @returns {string} The formatted number string.
 */
function formatNumber(num) {
    if (typeof num !== 'number' && typeof num !== 'string') return num;
    // Handles both numbers and strings that might represent numbers
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Analisa um shortcode de estatística.
 * @param {string[]} args - Argumentos do shortcode. Ex: ['Força', '18']
 * @returns {string} O HTML renderizado.
 */
function _parseStat(args) {
    const positionKeywords = ['left', 'right', 'bottom'];
    const filteredArgs = args.filter(arg => !positionKeywords.includes(arg));

    if (filteredArgs.length === 0) {
        return '';
    }

    /**
     * Helper para analisar um valor e extrair o texto principal e o tooltip.
     * @param {string} value - O valor a ser analisado.
     * @returns {string} O HTML com o atributo data-tooltip, se aplicável.
     */
    const parseValueForTooltip = (value) => {
        const tooltipMatch = value.match(/(.*?)\s*\((.*?)\)/);
        if (tooltipMatch) {
            const mainText = tooltipMatch[1].trim();
            const tooltipText = tooltipMatch[2].trim();
            return `<span class="has-tooltip" data-tooltip="${tooltipText}">${mainText}</span>`;
        }
        return value || '';
    };

    if (filteredArgs.length === 1 || filteredArgs[0].toLowerCase() === 'null') {
        const value = filteredArgs.length === 1 ? filteredArgs[0] : filteredArgs.slice(1).join(' ');
        const valueHtml = parseValueForTooltip(value);
        return `<div class="shortcode-stat">${valueHtml}</div>`;
    }

    const value = filteredArgs[filteredArgs.length - 1];
    const name = filteredArgs.slice(0, -1).join(' ');
    const valueHtml = parseValueForTooltip(value);

    return `<div class="shortcode-stat"><strong>${name}:</strong> ${valueHtml}</div>`;
}

/**
 * Analisa um shortcode de pontos de vida.
 * @param {string[]} args - Argumentos do shortcode. Ex: ['max=100'].
 * @param {string} itemId - O ID do card ao qual este shortcode pertence.
 * @param {string} originalShortcode - O texto exato do shortcode original.
 * @returns {string} O HTML renderizado.
 */
function _parseHp(args, itemId, originalShortcode) {
    const params = _parseKeyValueArgs(args);
    const max = parseInt(params.max, 10) || 100;
    const current = params.current !== undefined ? parseInt(params.current, 10) : max;

    const clampedCurrent = Math.max(0, Math.min(current, max));

    // Retorna o HTML em uma única linha para evitar que a conversão de \n para <br> quebre a tag.
    return `<div class="shortcode-hp" data-item-id="${itemId}" data-shortcode="${encodeURIComponent(originalShortcode)}" data-max-hp="${max}"><strong class="hp-label">PV</strong><div class="hp-input-wrapper"><input type="number" class="hp-current-input" value="${clampedCurrent}" max="${max}" min="0"><span class="hp-max-value">/ ${max}</span></div></div>`;
}

/**
 * Encontra e renderiza o primeiro HP shortcode encontrado no conteúdo.
 * @param {object} item - O objeto completo do item { id, conteudo, ... }.
 * @returns {string} O HTML para o componente de HP, ou uma string vazia.
 */
export function parseHpShortcode(item) {
    if (!item || !item.conteudo) return '';

    const hpMatch = item.conteudo.match(/\[hp\s+(.*?)\]/);
    if (hpMatch) {
        const allArgs = _parseArguments(hpMatch[1]);
        // O shortcode original é a correspondência completa da regex
        return _parseHp(allArgs, item.id, hpMatch[0]);
    }

    return '';
}

/**
 * Analisa um shortcode de contador.
 * Esta função agora gera SEMPRE a versão interativa do contador.
 * @param {string[]} args - Argumentos do shortcode. Ex: ['Poções', 'max=5', 'current=3', 'type=checkbox']
 * @param {string} itemId - O ID do item do card.
 * @param {string} originalShortcode - O texto original do shortcode.
 * @returns {string} O HTML renderizado.
 */
function _parseCount(args, itemId, originalShortcode) {
    const positionKeywords = ['left', 'right', 'bottom'];
    const hasCheckboxFlag = args.includes('checkbox');
    // Filtra as flags de posição e tema para que não sejam tratadas como parte do nome.
    const filteredArgs = args.filter(arg => arg !== 'checkbox' && !positionKeywords.includes(arg));

    const params = _parseKeyValueArgs(filteredArgs.filter(arg => arg.includes('=')));

    // Determina o tema, com prioridade para 'icon'.
    let theme = 'number';
    if (params.icon) {
        theme = 'custom-icon';
    } else if (params.theme) {
        theme = params.theme;
    } else if (hasCheckboxFlag) {
        theme = 'default';
    }


    // O primeiro argumento que não é chave=valor é o nome.
    const name = filteredArgs.find(arg => !arg.includes('=')) || '';

    const max = parseInt(params.max, 10) || 0;
    let current = params.current !== undefined ? parseInt(params.current, 10) : max;
    current = Math.max(0, Math.min(current, max));

    if (!name && max === 0) return ''; // Não renderiza se não tiver informação útil

    // --- Versão Interativa (agora a única versão) ---
    const dataAttrs = `data-item-id="${itemId}" data-shortcode="${encodeURIComponent(originalShortcode)}"`;
    let representation = '';

    const isCheckboxLike = ['default', 'arrow', 'potion', 'custom-icon'].includes(theme);

    if (isCheckboxLike && max > 0) {
        representation = `<span class="count-checkboxes-interactive theme-${theme}">`;
        for (let i = 1; i <= max; i++) {
            const isChecked = i <= current;
            let content = '';
            // Adiciona o ícone para os temas específicos
            if (theme === 'arrow') {
                content = '<i class="fas fa-arrow-up"></i>'; // Ícone de flecha
            } else if (theme === 'potion') {
                content = '<i class="fas fa-flask"></i>'; // Ícone de poção
            } else if (theme === 'custom-icon') {
                // Usa o ícone fornecido pelo usuário.
                const iconName = params.icon.replace(/["']/g, ''); // Remove aspas para segurança
                content = `<i class="fas fa-${iconName}"></i>`;
            }

            // Cada checkbox é um 'botão' com o valor que ele representa
            representation += `<span class="count-checkbox ${isChecked ? 'is-checked' : ''}" data-value="${i}" role="button" tabindex="0">${content}</span>`;
        }
        representation += '</span>';
    } else { // 'number' ou padrão
        representation = `
            <span class="count-value-interactive">
                <button class="count-btn" data-action="decrement" aria-label="Diminuir">-</button>
                <span class="count-current-value">${current}</span>
                <span class="count-separator">/</span>
                <span class="count-max-value">${max}</span>
                <button class="count-btn" data-action="increment" aria-label="Aumentar">+</button>
            </span>
        `.trim().replace(/\s+/g, ' ');
    }
    const nameHtml = name ? `<strong class="count-name">${name}:</strong> ` : '';
    // A estrutura interna é alterada para permitir o layout empilhado com CSS
    representation = `<div class="count-representation">${representation}</div>`;
    return `<div class="shortcode-count is-interactive" ${dataAttrs}>${nameHtml}${representation}</div>`;
}

/**
 * Processa o texto do conteúdo principal: remove os shortcodes visíveis e renderiza os inline.
 * @param {string} text - O texto bruto do conteúdo.
 * @returns {string} O conteúdo HTML para o corpo do card.
 */
export function parseMainContent(text) {
    if (!text) return '';

    // Pass 1: Processa blocos [hide]...[/hide] e [#]...[/#]
    let processedText = text.replace(/\[(hide|#)\]([\s\S]*?)\[\/(hide|#)\]/gi, (match, openTag, content, closeTag) => {
        if (openTag.toLowerCase() !== closeTag.toLowerCase()) {
            return match; // Retorna a correspondência original se as tags não forem iguais
        }
        // Envolve o conteúdo em um div que pode ser estilizado para ser oculto.
        return `<div class="is-hidden-from-players">${content}</div>`;
    });

    // Pass 2: Remove os shortcodes de bloco do conteúdo.
    processedText = processedText.replace(/\[(.*?)\]/g, (match, content) => {
        const allArgs = _parseArguments(content);
        const command = allArgs[0] || '';
        const cleanCommand = command.replace(/^[#*]/, ''); // Remove prefixos # ou *

        // Se for um comando visível (*), oculto (#) ou um de bloco, remove-o do conteúdo principal.
        if (command.startsWith('*') || command.startsWith('#') || allArgs.includes('#') || ALWAYS_VISIBLE_COMMANDS.includes(cleanCommand.toLowerCase()) || ['hp', 'count', 'money'].includes(cleanCommand.toLowerCase())) {
            return '';
        }

        // Nenhum shortcode é renderizado inline por enquanto.
        // Retorna shortcodes não reconhecidos como texto para não quebrar nada.
        return match;
    });

    // Após remover os shortcodes de bloco, processa os links de card {nome do card}
    processedText = processedText.replace(/\{(.*?)\}/g, (match, cardName) => {
        const sanitizedName = cardName.replace(/"/g, '&quot;'); // Sanitização básica para o atributo
        return `<span class="card-link" data-card-name="${sanitizedName}">${cardName}</span>`;
    });

    // Remove os espaços em branco (incluindo quebras de linha) no início e no fim do texto restante.
    processedText = processedText.trim();

    // Converte as quebras de linha restantes para <br> e remove quebras de linha em excesso.
    return processedText.replace(/\n/g, '<br>').replace(/(<br>\s*){2,}/g, '<br>');
}


/**
 * Recebe um texto e extrai, ordena e renderiza TODOS os shortcodes em um bloco HTML.
 * Ideal para o modal de detalhes e tooltips.
 * @param {object} item - O objeto do item completo, necessário para IDs e shortcodes originais.
 * @returns {string} O texto com os shortcodes renderizados como HTML.
 */
export function parseAllShortcodes(item, settings = {}) {
    if (!item || !item.conteudo) return { left: '', right: '', bottom: '', details: '' };

    const rendered = {
        left: [],
        right: [],
        bottom: [],
        details: []
    };

    const ORDER = { stat: 1, money: 2, hp: 3, count: 4, default: 99 };
    const content = item.conteudo;

    // --- START: Logic to identify hidden shortcodes ---
    const hideRanges = [];
    const HIDE_BLOCK_REGEX = /\[(hide|#)\]([\s\S]*?)\[\/(hide|#)\]/gi;
    let hideMatch;
    while ((hideMatch = HIDE_BLOCK_REGEX.exec(content)) !== null) {
        const [fullMatch, openTag, innerContent, closeTag] = hideMatch;
        if (openTag.toLowerCase() === closeTag.toLowerCase()) {
            const startIndex = hideMatch.index + fullMatch.indexOf(innerContent);
            hideRanges.push({ start: startIndex, end: startIndex + innerContent.length });
        }
    }

    const isInHideBlock = (shortcodeIndex) => {
        return hideRanges.some(range => shortcodeIndex >= range.start && shortcodeIndex < range.end);
    };
    // --- END: Logic to identify hidden shortcodes ---

    const allShortcodes = [];
    const SHORTCODE_REGEX = /\[(.*?)\]/g;
    let scMatch;

    // 1. Extrai todos os shortcodes do texto
    while ((scMatch = SHORTCODE_REGEX.exec(content)) !== null) {
        const originalShortcode = scMatch[0];
        const innerContent = scMatch[1];
        
        const allArgs = _parseArguments(innerContent);
        const commandWithPrefix = allArgs[0] || '';
        
        const isHiddenByPrefix = commandWithPrefix.startsWith('#');
        const isHiddenByBlock = isInHideBlock(scMatch.index);
        const isHiddenByArg = allArgs.includes('#');

        let isHidden = isHiddenByPrefix || isHiddenByBlock || isHiddenByArg;

        const command = commandWithPrefix.replace(/^[#*]+/, '').toLowerCase();
        let args = allArgs.slice(1);

        if (isHiddenByArg) {
            args = args.filter(arg => arg !== '#');
        }

        if (['stat', 'hp', 'count', 'money'].includes(command)) {
            allShortcodes.push({ command, args, originalShortcode, isHidden });
        }
    }

    // 2. Ordena os shortcodes extraídos
    allShortcodes.sort((a, b) => (ORDER[a.command] || ORDER.default) - (ORDER[b.command] || ORDER.default));

    // Helper para envolver o HTML se estiver oculto
    const addHiddenWrapper = (html, isHidden) => {
        return isHidden ? `<div class="is-hidden-from-players">${html}</div>` : html;
    };

    // 3. Renderiza os shortcodes ordenados
    allShortcodes.forEach(sc => {
        let position = null;
        if (sc.args.includes('left')) position = 'left';
        else if (sc.args.includes('right')) position = 'right';
        else if (sc.args.includes('bottom')) position = 'bottom';

        let html = '';
        switch (sc.command) {
            case 'stat':
                html = _parseStat(sc.args);
                rendered[position || 'left'].push(addHiddenWrapper(html, sc.isHidden));
                break;
            case 'hp':
                html = _parseHp(sc.args, item.id, sc.originalShortcode);
                rendered[position || 'bottom'].push(addHiddenWrapper(html, sc.isHidden));
                break;
            case 'money':
                const moneyParams = _parseKeyValueArgs(sc.args);
                const currentAmount = parseFloat(moneyParams.current) || 0;

                let currency = moneyParams.currency || '';
                if (!currency) {
                    const positionKeywords = ['left', 'right', 'bottom'];
                    const currencyArg = sc.args.find(arg => !arg.includes('=') && !positionKeywords.includes(arg));
                    if (currencyArg) {
                        currency = currencyArg;
                    } else if (settings.defaultCurrency) {
                        currency = settings.defaultCurrency;
                    }
                }
                const formattedAmount = formatNumber(currentAmount);

                html = `
                    <div class="shortcode-money is-interactive" data-item-id="${item.id}" data-shortcode="${encodeURIComponent(sc.originalShortcode)}">
                        <i class="fas fa-coins"></i>
                        <span class="money-value-display">${formattedAmount}</span><input type="text" class="money-value-input is-hidden" value="${currentAmount}"><span class="money-currency">${currency}</span>
                    </div>
                `.trim().replace(/\s+/g, ' ');
                rendered[position || 'left'].push(addHiddenWrapper(html, sc.isHidden));
                break;
            case 'count':
                const isVisibleOnOverlay = sc.originalShortcode.includes('[*count');
                const countHtml = _parseCount(sc.args, item.id, sc.originalShortcode);
                const wrappedCountHtml = addHiddenWrapper(countHtml, sc.isHidden);

                if (isVisibleOnOverlay) {
                    rendered[position || 'right'].push(wrappedCountHtml);
                } else {
                    if (position) {
                        rendered[position].push(wrappedCountHtml);
                    } else {
                        rendered.details.push(wrappedCountHtml);
                    }
                }
                break;
        }
    });

    return {
        left: rendered.left.join(''),
        right: rendered.right.join(''),
        bottom: rendered.bottom.join(''),
        details: rendered.details.join('')
    };
}