import { sendDiceRoll, addChatMessage, listenToDiceRolls } from './firebaseService.js';
import { visualizeDiceRoll } from './dice3d.js';
import { getCurrentUserName } from './auth.js';
import { openModal } from './modal.js';

/**
 * Processa a lógica matemática e gera a resposta do SISTEMA.
 * NÃO gera a mensagem do usuário (isso é responsabilidade do chat.js).
 */
export function processRoll(command, character, userName, macroName = null) {
    let formula = command.replace(/^\/(r|roll)\s+/, '').toLowerCase();

    // 1. Substituição de Stats (Lógica de Ficha)
    if (character && character.conteudo) {
        // Limpa HTML para pegar texto puro
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = character.conteudo.replace(/<[^>]+>/g, ' ');
        const rawText = tempDiv.textContent;

        const statRegex = /\[stat\s+["']([^"']+)["']\s+["']([^"']+)["']/gi;
        let match;
        const stats = {};

        // Extrai todos os stats
        while ((match = statRegex.exec(rawText)) !== null) {
            const key = match[1].toLowerCase();
            const val = parseInt(match[2], 10);
            if (!isNaN(val)) stats[key] = val;
        }

        // Substitui na fórmula
        Object.keys(stats).forEach(statName => {
            const regex = new RegExp(`\\b${statName}\\b`, 'g');
            formula = formula.replace(regex, stats[statName]);
        });
    }

    try {
        const diceRegex = /(\d+)d(\d+)/g;
        let evaluatedFormula = formula;
        const rollsToSend = [];

        // 2. Executa as rolagens matemáticas
        evaluatedFormula = evaluatedFormula.replace(diceRegex, (match, qtd, sides) => {
            let subTotal = 0;
            const q = parseInt(qtd);
            const s = parseInt(sides);

            for (let i = 0; i < q; i++) {
                const r = Math.floor(Math.random() * s) + 1;
                subTotal += r;
                // Guarda cada dado para o 3D
                rollsToSend.push({ sides: s, result: r });
            }
            return subTotal;
        });

        // 3. Calcula o total final
        if (!/^[\d\s+\-*/().]+$/.test(evaluatedFormula)) {
            throw new Error("Fórmula inválida ou insegura");
        }
        const totalResult = new Function('return ' + evaluatedFormula)();

        // 4. Define o Rótulo Visual (Para o dado 3D)
        const infoLabel = macroName ? `${macroName}: ${totalResult}` : `Total: ${totalResult}`;

        // 5. Gera a mensagem do SISTEMA
        // Nota: O remetente aqui é 'Sistema', pois é a resposta do comando.
        const logMsg = macroName
            ? `<strong>${userName}</strong> usou <strong>${macroName}</strong>: ${totalResult} <span style="color:#ccc; font-size:0.8em">(${formula})</span>`
            : `<strong>${userName}</strong> rolou: ${totalResult} <span style="color:#ccc; font-size:0.8em">(${formula})</span>`;

        addChatMessage(logMsg, 'system', 'Sistema');

        // 6. Envia para o Visualizador 3D
        rollsToSend.forEach(roll => {
            sendDiceRoll(userName, `d${roll.sides}`, roll.result, infoLabel);
        });

    } catch (e) {
        console.error("Erro na rolagem:", e);
        addChatMessage(`Erro ao processar: ${formula}`, 'system', 'Sistema');
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
            visualizeDiceRoll(t, d.result, d.userName, d.label);
        }
    });

    // 2. Eventos do FAB de Dados
    const { diceMainBtn, diceFabWrapper } = layoutRefs;

    diceMainBtn?.addEventListener('click', () => {
        diceFabWrapper?.classList.toggle('is-active');
    });

    // Botões rápidos (d4, d6, etc)
    document.querySelectorAll('.dice-quick-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const dType = e.currentTarget.dataset.dice;
            const userName = getCurrentUserName();
            const command = `/r 1${dType}`;

            await addChatMessage(command, 'user', userName);
            processRoll(command, null, userName);

            // Fecha o wrapper após rolar
            diceFabWrapper?.classList.remove('is-active');
        });
    });
}