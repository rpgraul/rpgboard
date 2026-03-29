export function showDiceNotification(userName, total, formula = '', individualRolls = null) {
  const existing = document.querySelector('.dice-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'dice-notification';
  notification.innerHTML = `
    <div class="dice-user-name">${userName}</div>
    <div class="dice-total">${total}</div>
    <div class="dice-formula">${formula}</div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentNode) notification.remove();
      }, 500);
    }
  }, 4000);
}

export function visualizeDiceRoll(diceType, result, userName, infoLabel = '') {
  showDiceNotification(userName, result, infoLabel);
}

export function clearDiceNotifications() {
  document.querySelectorAll('.dice-notification').forEach(n => n.remove());
}
