import { addChatMessage, listenToDiceRolls, sendDiceRoll } from './firebaseService.js';
import { visualizeDiceRoll, showDiceNotification } from './dice3d.js';
import { rollDice, initDice3D } from './dice3d-box.js';
import { getCurrentUserName } from './auth.js';

let diceInitialized = false;

function extractDiceFromFormula(formula) {
    const diceRegex = /(\d+)d(\d+)/gi;
    const matches = [...formula.matchAll(diceRegex)];
    if (matches.length > 0) {
        const first = matches[0];
        return `${first[1]}d${first[2]}`;
    }
    return '1d20';
}

async function processRollWith3D(command, character, userName, macroName = null) {
    const rawFormula = command.replace(/^\/(r|roll)\s+/, '');
    const lines = rawFormula.split('\n');
    const chatLines = [];
    const notificationSummary = [];

    if (macroName) {
        notificationSummary.push(`<strong>[${macroName}]</strong>`);
    }

    if (macroName) {
        chatLines.push(`<div class="macro-header"><strong>${userName}</strong> usou <strong>${macroName}</strong></div>`);
    } else {
        chatLines.push(`<div class="macro-header"><strong>${userName}</strong> rolou:</div>`);
    }

    const stats = {};
    if (character && character.conteudo) {
        const content = character.conteudo;
        const rawStatRegex = /\[stat\s+["']?([^"']+)["']?\s+["']?([^"']+)["']?\]/gi;
        let rMatch;
        while ((rMatch = rawStatRegex.exec(content)) !== null) {
            const val = parseInt(rMatch[2], 10);
            if (!isNaN(val)) stats[rMatch[1].toLowerCase()] = val;
        }
        const htmlStatRegex = /data-label="([^"]+)"\s+data-value="([^"]+)"/gi;
        let hMatch;
        while ((hMatch = htmlStatRegex.exec(content)) !== null) {
            const val = parseInt(hMatch[2], 10);
            if (!isNaN(val)) stats[hMatch[1].toLowerCase()] = val;
        }
    }

    let diceNotation = '';
    let processedFormula = rawFormula;

    for (let line of lines) {
        let currentLine = line.trim();
        if (!currentLine) continue;

        let lineLabel = "";
        let cleanLabel = "";
        if (currentLine.includes(':')) {
            const parts = currentLine.split(':');
            cleanLabel = parts[0].trim();
            lineLabel = `<strong>${cleanLabel}:</strong> `;
            currentLine = parts.slice(1).join(':').trim();
        }

        const sortedStatKeys = Object.keys(stats).sort((a, b) => b.length - a.length);
        sortedStatKeys.forEach(s => {
            const r = new RegExp(`\\b${s}\\b`, 'gi');
            currentLine = currentLine.replace(r, stats[s]);
        });

        const diceRegex = /(\d+)d(\d+)(!)?(?:([<>]=?|=)(\d+))?(?:f(\d+))?/gi;

        if (diceRegex.test(currentLine)) {
            const diceMatches = [...currentLine.matchAll(diceRegex)];
            const activePool = diceMatches.some(m => {
                const qtd = parseInt(m[1]);
                const sides = parseInt(m[2]);
                const op = m[4];
                return op && (qtd > 1 || (sides !== 100 && sides !== 20));
            });

            if (activePool) {
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
                    notificationSummary.push(`${cleanLabel ? cleanLabel + ': ' : ''}${successes} Suc`);
                });
            } else {
                if (!diceNotation) {
                    diceNotation = extractDiceFromFormula(currentLine);
                }
                processedFormula = currentLine;
                lineResultHtml = `${lineLabel}${currentLine}`;
            }
        } else {
            lineResultHtml = `${lineLabel}${currentLine}`;
        }

        chatLines.push(`<p class="dice-line">${lineResultHtml}</p>`);
    }

    const hasDice = notificationSummary.length > 0 || diceNotation !== '';

    if (!hasDice) {
        return { success: false, error: 'Fórmula sem dados válidos' };
    }

    let rollResult = null;

    if (diceNotation) {
        try {
            rollResult = await rollDice(processedFormula, userName);
        } catch (error) {
            console.error('3D Dice roll failed, using fallback:', error);
        }
    }

    const total = rollResult ? rollResult.total : 0;
    const individualRolls = rollResult ? rollResult.rolls : [];
    const diceType = rollResult ? rollResult.diceType : 'd20';

    const chatHtml = rollResult
        ? `<div class="dice-roll-result">${chatLines.join('')}<p class="dice-line"><strong>Resultado:</strong> ${total} ${individualRolls.length > 0 ? `[${individualRolls.join(', ')}]` : ''}</p></div>`
        : `<div class="dice-roll-result">${chatLines.join('')}</div>`;

    addChatMessage(chatHtml, 'system', 'Sistema');

    showDiceNotification(userName, total, processedFormula, individualRolls);

    await sendDiceRoll({
        userName: userName,
        formula: processedFormula,
        total: total,
        individualRolls: individualRolls.length > 0 ? JSON.stringify(individualRolls) : null,
        diceType: diceType,
        label: userName
    });

    return {
        success: true,
        summary: notificationSummary,
        html: chatHtml,
        total: total,
        rolls: individualRolls
    };
}

function parseRollResult(result) {
    if (!result) return { total: 0, rolls: [], formula: '', userName: '' };

    let rolls = [];
    if (result.individualRolls) {
        try {
            rolls = typeof result.individualRolls === 'string' 
                ? JSON.parse(result.individualRolls) 
                : result.individualRolls;
        } catch (e) {
            rolls = [];
        }
    }

    return {
        total: result.total || result.result || 0,
        rolls: rolls,
        formula: result.formula || '',
        userName: result.userName || 'Anônimo',
        diceType: result.diceType || 'd20'
    };
}

export async function processRoll(command, character, userName, macroName = null) {
    if (!diceInitialized) {
        try {
            await initDice3D('#dice-container');
            diceInitialized = true;
        } catch (error) {
            console.error('Failed to initialize 3D dice:', error);
        }
    }

    return processRollWith3D(command, character, userName, macroName);
}

export async function initializeDice(layoutRefs) {
    if (!layoutRefs) return;

    try {
        await initDice3D('#dice-container');
        diceInitialized = true;
    } catch (error) {
        console.error('Failed to initialize 3D dice:', error);
    }

    const currentUserName = getCurrentUserName();

    listenToDiceRolls((data) => {
        if (data && data.userName) {
            const isOwnRoll = data.userName === currentUserName;
            if (isOwnRoll) return;

            const parsed = parseRollResult(data);
            showDiceNotification(
                parsed.userName,
                parsed.total,
                parsed.formula,
                parsed.rolls
            );
        }
    });

    const { diceMainBtn, diceFabWrapper } = layoutRefs;

    diceMainBtn?.addEventListener('click', () => {
        diceFabWrapper?.classList.toggle('is-active');
    });

    document.addEventListener('click', async (e) => {
        const button = e.target.closest('.dice-quick-btn');
        if (!button) return;

        const dType = button.dataset.dice;
        const userName = getCurrentUserName() || 'Anônimo';
        const command = `/r 1${dType}`;

        await addChatMessage(command, 'user', userName);
        processRoll(command, null, userName);

        diceFabWrapper?.classList.remove('is-active');
    });
}
