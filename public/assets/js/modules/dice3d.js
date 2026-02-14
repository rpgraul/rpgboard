export function visualizeDiceRoll(diceType, result, userName, infoLabel = '') {
    const container = document.getElementById('dice-container');
    if (!container) return; // Se não houver container, não faz nada (não quebra)

    const cleanDiceType = (diceType || '').toString().toLowerCase().trim();
    const validTypes = ['d4','d6','d8','d10','d12','d20','d100'];
    const visualType = validTypes.includes(cleanDiceType) ? cleanDiceType : 'd20';

    // Limpeza de excesso
    if (container.children.length > 8) {
        if (container.firstElementChild) container.removeChild(container.firstElementChild);
    }

    const uid = `dice-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const rollWrapper = document.createElement('div');
    rollWrapper.className = 'dice-roll-wrapper';
    rollWrapper.id = uid;

    // Dado
    const die = document.createElement('div');
    die.classList.add('rpg-die', visualType);
    const num = document.createElement('span');
    num.innerText = String(result);
    die.appendChild(num);

    // Rótulo
    const labelDiv = document.createElement('div');
    labelDiv.className = 'dice-label';
    
    // Linha 1: Nome do Usuário
    const userSpan = document.createElement('div');
    userSpan.className = 'dice-user-name';
    userSpan.textContent = userName || 'Anônimo';
    
    labelDiv.appendChild(userSpan);

    // Linha 2: Info Extra (Total ou Macro)
    // Só exibe se infoLabel existir e for diferente do nome do usuário
    if (infoLabel && infoLabel !== userName) {
        const infoSpan = document.createElement('div');
        infoSpan.className = 'dice-info-text';
        infoSpan.textContent = infoLabel;
        labelDiv.appendChild(infoSpan);
    }

    rollWrapper.appendChild(die);
    rollWrapper.appendChild(labelDiv);

    rollWrapper.classList.add('die-enter');
    container.appendChild(rollWrapper);

    // Timer de saída
    setTimeout(() => {
        const el = document.getElementById(uid);
        if (el) {
            el.classList.remove('die-enter');
            el.classList.add('die-exit');
            setTimeout(() => el.remove(), 500);
        }
    }, 4000);
}