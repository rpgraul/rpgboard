import { addChatMessage, listenToDiceRolls, sendDiceRoll } from './firebaseService.js';
import { visualizeDiceRoll } from './dice3d.js';
import { getCurrentUserName } from './auth.js';

/**
 * Processa a lógica matemática e gera a resposta do SISTEMA.
 * NÃO gera a mensagem do usuário (isso é responsabilidade do chat.js).
 */
export async function processRoll(command, character, userName, macroName = null) {
    const rawFormula = command.replace(/^\/(r|roll)\s+/, '');
    const lines = rawFormula.split('\n');
    const chatLines = [];
    const notificationSummary = []; // Para a etiqueta flutuante única

    // Prefixar resumo com Nome do Macro se existir
    if (macroName) {
        notificationSummary.push(`<strong>[${macroName}]</strong>`);
    }

    // Header do balão
    if (macroName) {
        chatLines.push(`<div class="macro-header"><strong>${userName}</strong> usou <strong>${macroName}</strong></div>`);
    } else {
        chatLines.push(`<div class="macro-header"><strong>${userName}</strong> rolou:</div>`);
    }

    // 1. Extração de Stats (Robustecida para Raw e HTML)
    const stats = {};
    if (character && character.conteudo) {
        const content = character.conteudo;

        // A. Tenta extrair de raw: [stat "Nome" "Valor"]
        const rawStatRegex = /\[stat\s+["']?([^"']+)["']?\s+["']?([^"']+)["']?\]/gi;
        let rMatch;
        while ((rMatch = rawStatRegex.exec(content)) !== null) {
            const val = parseInt(rMatch[2], 10);
            if (!isNaN(val)) stats[rMatch[1].toLowerCase()] = val;
        }

        // B. Tenta extrair de HTML (data-attributes do StatNode): data-label="..." data-value="..."
        const htmlStatRegex = /data-label="([^"]+)"\s+data-value="([^"]+)"/gi;
        let hMatch;
        while ((hMatch = htmlStatRegex.exec(content)) !== null) {
            const val = parseInt(hMatch[2], 10);
            if (!isNaN(val)) stats[hMatch[1].toLowerCase()] = val;
        }
    }

    for (let line of lines) {
        let currentLine = line.trim();
        if (!currentLine) continue;

        // Título da linha
        let lineLabel = "";
        let cleanLabel = "";
        if (currentLine.includes(':')) {
            const parts = currentLine.split(':');
            cleanLabel = parts[0].trim();
            lineLabel = `<strong>${cleanLabel}:</strong> `;
            currentLine = parts.slice(1).join(':').trim();
        }

        // --- SUBSTITUIÇÃO DE ATRIBUTOS ---
        const sortedStatKeys = Object.keys(stats).sort((a, b) => b.length - a.length);
        sortedStatKeys.forEach(s => {
            // Substitui apenas se for uma palavra isolada (Case-Insensitive)
            const r = new RegExp(`\\b${s}\\b`, 'gi');
            currentLine = currentLine.replace(r, stats[s]);
        });

        const diceRegex = /(\d+)d(\d+)(!)?(?:([<>]=?|=)(\d+))?(?:f(\d+))?/gi;
        let lineResultHtml = "";

        // Se a linha tem dados, processamos
        if (diceRegex.test(currentLine)) {
            // DETERMINAÇÃO: POOL vs COMPARAÇÃO
            // É um POOL se: qtd > 1 E tem operador colado E NÃO é d100
            // Motivo: 1d20 >= 10 ou 1d100 <= 50 são comparações de teste, não pools de sucessos.
            const diceMatches = [...currentLine.matchAll(diceRegex)];
            const activePool = diceMatches.some(m => {
                const qtd = parseInt(m[1]);
                const sides = parseInt(m[2]);
                const op = m[4];
                return op && (qtd > 1 || (sides !== 100 && sides !== 20));
            });

            if (activePool) {
                // CENÁRIO: Pool de Dados (Sucessos)
                currentLine.replace(diceRegex, (match, qtd, sides, explode, op, target, fail) => {
                    if (!op) return match; // Não deveria acontecer se activePool deu true, mas por segurança

                    const q = parseInt(qtd);
                    const s = parseInt(sides);
                    const targetVal = parseInt(target);
                    const failVal = fail ? parseInt(fail) : 0;
                    const results = [];
                    let successes = 0;

                    const rollOne = () => {
                        const r = Math.floor(Math.random() * s) + 1;
                        results.push(r);
                        return r;
                    };

                    for (let i = 0; i < q; i++) {
                        let r = rollOne();
                        if (explode && r === s) {
                            while (r === s) r = rollOne();
                        }
                    }

                    results.forEach(val => {
                        let ok = false;
                        if (op === '>') ok = val > targetVal;
                        else if (op === '>=') ok = val >= targetVal;
                        else if (op === '<') ok = val < targetVal;
                        else if (op === '<=') ok = val <= targetVal;
                        else if (op === '=') ok = val === targetVal;

                        if (ok) successes++;
                        else if (fail && val <= failVal) successes--;
                    });

                    lineResultHtml = `${lineLabel}${successes} Sucessos [ ${results.join(', ')} ]`;
                    notificationSummary.push(`${cleanLabel ? cleanLabel + ': ' : ''}${successes} Suc`);
                });
            } else {
                // CENÁRIO: Soma ou Comparação de Resultado Único
                let details = currentLine;
                const diceResults = [];

                // 1. Resolve os dados primeiro, guardando os totais para cada match
                const processedForMath = currentLine.replace(diceRegex, (match, qtd, sides) => {
                    const q = parseInt(qtd);
                    const s = parseInt(sides);
                    let sum = 0;
                    const rolls = [];
                    for (let i = 0; i < q; i++) {
                        const r = Math.floor(Math.random() * s) + 1;
                        sum += r;
                        rolls.push(r);
                    }
                    details = details.replace(match, `${match}(${rolls.join('+')})`);
                    return sum;
                });

                // 2. Tenta resolver a expressão (Soma ou Comparação)
                try {
                    const compRegex = /([\d.+\-*/() ]+)\s*([<>]=?|=)\s*([\d.+\-*/() ]+)/;
                    const compMatch = processedForMath.match(compRegex);

                    // Função auxiliar para eval seguro
                    const safeEval = (expr) => {
                        const sanitized = expr.replace(/[^-+*/().0-9\s]/g, '');
                        return new Function(`return ${sanitized || '0'}`)();
                    };

                    if (compMatch) {
                        // COMPARAÇÃO (ex: 45 <= 80)
                        const leftVal = safeEval(compMatch[1]);
                        const op = compMatch[2];
                        const rightVal = safeEval(compMatch[3]);

                        let success = false;
                        if (op === '>') success = leftVal > rightVal;
                        else if (op === '>=') success = leftVal >= rightVal;
                        else if (op === '<') success = leftVal < rightVal;
                        else if (op === '<=') success = leftVal <= rightVal;
                        else if (op === '=') success = leftVal === rightVal;

                        const tag = success
                            ? '<span class="tag is-success is-light ml-1">SUCESSO</span>'
                            : '<span class="tag is-danger is-light ml-1">FALHA</span>';

                        lineResultHtml = `${lineLabel}${leftVal} ${op} ${rightVal} ➔${tag}`;
                        notificationSummary.push(`${cleanLabel ? cleanLabel + ': ' : ''}${leftVal} ${success ? 'Sucesso' : 'Falha'}`);
                    } else {
                        // SOMA SIMPLES (ex: 10 + 5)
                        const total = safeEval(processedForMath);
                        lineResultHtml = `${lineLabel}${total} [${details}]`;
                        notificationSummary.push(`${cleanLabel ? cleanLabel + ': ' : ''}${total}`);
                    }
                } catch (e) {
                    console.error("Erro na rolagem:", e);
                    lineResultHtml = `${lineLabel}${currentLine} (Erro)`;
                }
            }
        } else {
            // Texto puro ou comandos sem 'd'
            lineResultHtml = `${lineLabel}${currentLine}`;
        }

        chatLines.push(`<p class="dice-line">${lineResultHtml}</p>`);
    }

    // DISPARO DO CHAT
    const htmlFinal = `<div class="dice-roll-result">${chatLines.join('')}</div>`;
    addChatMessage(htmlFinal, 'system', 'Sistema');

    // DISPARO DA NOTIFICAÇÃO (Etiqueta consolidada via sendDiceRoll)
    if (notificationSummary.length > 0) {
        const summary = notificationSummary.join('<br>');
        // Usamos um tipo fictício 'summary' para a etiqueta e hideDie: true
        sendDiceRoll(userName, 'summary', 0, summary, false, true);
    }
}


/**
 * Inicializa os ouvintes globais de rolagens e botões de dados do layout.
 */
export function initializeDice(layoutRefs) {
    if (!layoutRefs) return;

    // 1. Escuta mudanças no Firebase para exibir rolagens 3D
    listenToDiceRolls((change) => {
        const d = change.doc.data();
        if (d) {
            let t = (d.diceType || '').toString().toLowerCase().trim().replace(/^\d+/, '');
            visualizeDiceRoll(t, d.result, d.userName, d.label, d.hideLabel, d.hideDie);
        }
    });

    // 2. Eventos do FAB de Dados
    const { diceMainBtn, diceFabWrapper } = layoutRefs;

    diceMainBtn?.addEventListener('click', () => {
        diceFabWrapper?.classList.toggle('is-active');
    });

    // Botões rápidos (d4, d6, etc) - Delegação global para suportar botões injetados dinamicamente (ex: Ficha)
    document.addEventListener('click', async (e) => {
        const button = e.target.closest('.dice-quick-btn');
        if (!button) return;

        const dType = button.dataset.dice;
        const userName = getCurrentUserName() || 'Anônimo';
        const command = `/r 1${dType}`;

        await addChatMessage(command, 'user', userName);
        processRoll(command, null, userName);

        // Fecha o wrapper do FAB se existir
        diceFabWrapper?.classList.remove('is-active');
    });
}