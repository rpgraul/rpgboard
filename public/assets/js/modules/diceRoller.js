export function rollDice(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

export function showDiceResult(result, userName) {
    const notification = document.createElement('div');
    notification.className = 'notification is-info dice-notification';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    
    notification.innerHTML = `
        <button class="delete" type="button"></button>
        <p><strong>${userName || 'Alguém'}</strong> rolou:</p>
        <div class="dice-result">${result}</div>
    `;

    document.body.appendChild(notification);

    // Adiciona evento para fechar a notificação
    const closeButton = notification.querySelector('.delete');
    closeButton.addEventListener('click', () => {
        notification.remove();
    });

    // Remove automaticamente após 5 segundos
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.remove();
        }
    }, 5000);
}
