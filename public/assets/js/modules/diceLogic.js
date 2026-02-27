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

    // 1. Extração de Stats (Cache)
    const stats = {};
    if (character && character.conteudo) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = character.conteudo.replace(/<[^>]+>/g, ' ');
        const statRegex = /\[stat\s+["']([^"']+)["']\s+["']([^"']+)["']/gi;
        let sMatch;
        const textToSearch = tempDiv.textContent;
        while ((sMatch = statRegex.exec(textToSearch)) !== null) {
            stats[sMatch[1].toLowerCase()] = parseInt(sMatch[2], 10);
        }
    }

    for (let line of lines) {
        let currentLine = line.trim();
        if (!currentLine) continue;

        // Título da linha (se houver o formato Nome: Rolagem)
        let lineLabel = "";
        let cleanLabel = ""; // Sem HTML para a etiqueta flutuante
        if (currentLine.includes(':')) {
            const parts = currentLine.split(':');
            cleanLabel = parts[0].trim();
            lineLabel = `<strong>${cleanLabel}:</strong> `;
            currentLine = parts.slice(1).join(':').trim();
        }

        // --- SUBSTITUIÇÃO DE ATRIBUTOS ---
        Object.keys(stats).forEach(s => {
            const r = new RegExp(`\\b${s}\\b`, 'gi');
            currentLine = currentLine.replace(r, stats[s]);
        });

        const diceRegex = /(\d+)d(\d+)(!)?(?:([<>]=?|=)(\d+))?(?:f(\d+))?/gi;
        let lineResultHtml = "";

        // Se a linha tem dados, processamos
        if (diceRegex.test(currentLine)) {
            const isPool = /([<>]=?|=)/.test(currentLine);

            if (isPool) {
                // CENÁRIO: Pool de Dados (Sucessos)
                currentLine.replace(diceRegex, (match, qtd, sides, explode, op, target, fail) => {
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
                    notificationSummary.push(`${cleanLabel ? cleanLabel + ': ' : ''}${successes} Sucessos`);
                });
            } else {
                // CENÁRIO: Soma Matemática ou Comparação
                let mathExpression = currentLine;
                let details = currentLine;

                const processedMath = currentLine.replace(diceRegex, (match, qtd, sides) => {
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

                // Tenta resolver a matemática (eval seguro básico)
                try {
                    // Sanitiza para permitir apenas números e operadores básicos
                    const sanitized = processedMath.replace(/[^-+*/().0-9\s]/g, '');
                    const total = new Function(`return ${sanitized}`)();

                    // Verifica se há uma comparação no final
                    const compRegex = /([\d.]+)\s*([<>]=?|=)\s*([\d.]+)/;
                    const compMatch = currentLine.replace(diceRegex, '0').match(compRegex); // Usa 0 como placeholder pra achar o op

                    if (compMatch) {
                        const op = compMatch[2];
                        const target = parseFloat(compMatch[3]);
                        let success = false;
                        if (op === '>') success = total > target;
                        else if (op === '>=') success = total >= target;
                        else if (op === '<') success = total < target;
                        else if (op === '<=') success = total <= target;
                        else if (op === '=') success = total === target;

                        const tag = success
                            ? '<span class="tag is-success is-light ml-1">SUCESSO</span>'
                            : '<span class="tag is-danger is-light ml-1">FALHA</span>';

                        lineResultHtml = `${lineLabel}${total} ${op} ${target} ➔${tag}`;
                        notificationSummary.push(`${cleanLabel ? cleanLabel + ': ' : ''}${total} ${success ? 'PASSO' : 'FALHOU'}`);
                    } else {
                        lineResultHtml = `${lineLabel}${total} [${details}]`;
                        notificationSummary.push(`${cleanLabel ? cleanLabel + ': ' : ''}${total}`);
                    }
                } catch (e) {
                    lineResultHtml = `${lineLabel}${currentLine} (Erro de cálculo)`;
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