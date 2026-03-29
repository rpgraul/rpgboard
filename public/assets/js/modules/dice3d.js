export function visualizeDiceRoll(diceType, result, userName, infoLabel = '', hideLabel = false, hideDie = false) {
    showDiceNotification(userName, result, infoLabel, null, hideLabel);
}

export function showDiceNotification(userName, total, formula = '', individualRolls = null, showDetails = true) {
    const container = document.getElementById('dice-container');
    if (!container) return;

    if (container.children.length > 8) {
        const oldNotifications = container.querySelectorAll('.dice-notification');
        if (oldNotifications.length > 0) {
            oldNotifications[0].remove();
        }
    }

    const uid = `dice-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const notification = document.createElement('div');
    notification.className = 'dice-notification';
    notification.id = uid;

    const rollsHtml = individualRolls && individualRolls.length > 0
        ? `<div class="dice-notification-rolls">[${individualRolls.join(' + ')}]</div>`
        : '';

    notification.innerHTML = `
        <div class="dice-notification-header">
            <span class="dice-user-name">${userName || 'Anônimo'} rolou</span>
        </div>
        <div class="dice-notification-result">${total}</div>
        ${formula ? `<div class="dice-notification-formula">${formula}</div>` : ''}
        ${rollsHtml}
    `;

    container.appendChild(notification);

    setTimeout(() => {
        const el = document.getElementById(uid);
        if (el) {
            el.classList.add('dice-exit');
            setTimeout(() => el.remove(), 500);
        }
    }, 4000);
}
