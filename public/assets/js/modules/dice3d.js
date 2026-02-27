export function visualizeDiceRoll(diceType, result, userName, infoLabel = '', hideLabel = false, hideDie = false) {
    const container = document.getElementById('dice-container');
    if (!container) return;

    const cleanDiceType = (diceType || '').toString().toLowerCase().trim();
    const validTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
    const visualType = validTypes.includes(cleanDiceType) ? cleanDiceType : 'd20';

    if (container.children.length > 8) {
        if (container.firstElementChild) container.removeChild(container.firstElementChild);
    }

    const uid = `dice-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const rollWrapper = document.createElement('div');
    rollWrapper.className = 'dice-roll-wrapper';
    if (hideDie) rollWrapper.classList.add('hide-die'); // CSS opcional para ajustes de margem
    rollWrapper.id = uid;

    // Dado (Opcional)
    if (!hideDie) {
        const die = document.createElement('div');
        die.classList.add('rpg-die', visualType);
        const num = document.createElement('span');
        num.innerText = String(result);
        die.appendChild(num);
        rollWrapper.appendChild(die);
    }

    // Rótulo (Consolidado)
    if (!hideLabel) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'dice-label';

        const userSpan = document.createElement('div');
        userSpan.className = 'dice-user-name';
        userSpan.textContent = userName || 'Anônimo';
        labelDiv.appendChild(userSpan);

        if (infoLabel && infoLabel !== userName) {
            const infoSpan = document.createElement('div');
            infoSpan.className = 'dice-info-text';
            // Permite HTML simples para multi-line (<br>)
            infoSpan.innerHTML = infoLabel;
            labelDiv.appendChild(infoSpan);
        }
        rollWrapper.appendChild(labelDiv);
    }

    rollWrapper.classList.add('die-enter');
    container.appendChild(rollWrapper);

    setTimeout(() => {
        const el = document.getElementById(uid);
        if (el) {
            el.classList.remove('die-enter');
            el.classList.add('die-exit');
            setTimeout(() => el.remove(), 500);
        }
    }, 4000);
}