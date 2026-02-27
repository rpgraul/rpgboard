import { sendDiceRoll, addChatMessage, listenToDiceRolls } from './firebaseService.js';
import { visualizeDiceRoll } from './dice3d.js';
import { getCurrentUserName } from './auth.js';
import { openModal } from './modal.js';

/**
 * Processa a lógica matemática e gera a resposta do SISTEMA.
 * NÃO gera a mensagem do usuário (isso é responsabilidade do chat.js).
 */
export function processRoll(command, character, userName, macroName = null) {
    const rawFormula = command.replace(/^\/(r|roll)\s+/, '');
    const lines = rawFormula.split('\n');
    let outputHtml = `<div class="dice-roll-result">`;
    if (macroName) outputHtml += `<div class="macro-header"><strong>${userName}</strong> usou <strong>${macroName}</strong></div>`;
    else outputHtml += `<div class="macro-header"><strong>${userName}</strong> rolou:</div>`;

    // 1. Extração de Stats (Cache para evitar re-parse em cada linha)
    const stats = {};
    if (character && character.conteudo) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = character.conteudo.replace(/<[^>]+>/g, ' ');
        const rawText = tempDiv.textContent;
        const statRegex = /\[stat\s+["']([^"']+)["']\s+["']([^"']+)["']/gi;
        let sMatch;
        while ((sMatch = statRegex.exec(rawText)) !== null) {
            stats[sMatch[1].toLowerCase()] = parseInt(sMatch[2], 10);
        }
    }

    lines.forEach(line => {
        let currentLine = line.trim();
        if (!currentLine) return;

        // Se a linha não tem comando de dado nem comparação, apenas exibe como texto
        if (!currentLine.includes('d') && !/[<>=]/.test(currentLine)) {
            outputHtml += `<p class="dice-line text-only">${currentLine}</p>`;
            return;
        }

        // --- SUBSTITUIÇÃO DE ATRIBUTOS ---
        Object.keys(stats).forEach(s => {
            const r = new RegExp(`\\b${s}\\b`, 'gi');
            currentLine = currentLine.replace(r, stats[s]);
        });

        const rollsTo3D = [];
        const diceRegex = /(\d+)d(\d+)(!)?(?:([<>]=?|=)(\d+))?(?:f(\d+))?/gi;

        let hasDice = false;
        let lineDetails = currentLine;

        // --- PROCESSAMENTO DE DADOS ---
        const processedLine = currentLine.replace(diceRegex, (match, qtd, sides, explode, op, target, fail) => {
            hasDice = true;
            const q = parseInt(qtd);
            const s = parseInt(sides);
            const isPool = !!op;
            const targetVal = isPool ? parseInt(target) : 0;
            const failVal = fail ? parseInt(fail) : 0;

            let results = [];
            for (let i = 0; i < q; i++) {
                let r = Math.floor(Math.random() * s) + 1;
                results.push(r);
                rollsTo3D.push({ sides: s, result: r });

                if (explode) {
                    let lastRoll = r;
                    while (lastRoll === s) {
                        lastRoll = Math.floor(Math.random() * s) + 1;
                        results.push(lastRoll);
                        rollsTo3D.push({ sides: s, result: lastRoll });
                    }
                }
            }

            if (isPool) {
                let successes = 0;
                results.forEach(val => {
                    let isSuccess = false;
                    if (op === '>') isSuccess = val > targetVal;
                    else if (op === '>=') isSuccess = val >= targetVal;
                    else if (op === '<') isSuccess = val < targetVal;
                    else if (op === '<=') isSuccess = val <= targetVal;
                    else if (op === '=') isSuccess = val === targetVal;

                    if (isSuccess) successes++;
                    else if (fail && val <= failVal) successes--;
                });
                return `${successes} [${results.join(',')}]`;
            } else {
                const sum = results.reduce((a, b) => a + b, 0);
                return `${sum} [${results.join(',')}]`;
            }
        });

        // --- COMPARAÇÃO FINAL ---
        let finalLabel = "";
        const comparisonRegex = /(-?\d+)\s*([<>]=?|=)\s*(-?\d+)/;
        const compMatch = processedLine.match(comparisonRegex);
        if (compMatch) {
            const v1 = parseInt(compMatch[1]);
            const op = compMatch[2];
            const v2 = parseInt(compMatch[3]);
            let success = false;
            if (op === '>') success = v1 > v2;
            else if (op === '>=') success = v1 >= v2;
            else if (op === '<') success = v1 < v2;
            else if (op === '<=') success = v1 <= v2;
            else if (op === '=') success = v1 === v2;

            finalLabel = success
                ? ' <span class="tag is-success is-light ml-1">SUCESSO</span>'
                : ' <span class="tag is-danger is-light ml-1">FALHA</span>';
        }

        outputHtml += `<p class="dice-line">${processedLine}${finalLabel}</p>`;

        // Envia para o 3D
        rollsTo3D.forEach(r => {
            sendDiceRoll(userName, `d${r.sides}`, r.result, macroName || 'Roll');
        });
    });

    outputHtml += `</div>`;
    addChatMessage(outputHtml, 'system', 'Sistema');
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
            visualizeDiceRoll(t, d.result, d.userName, d.label);
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