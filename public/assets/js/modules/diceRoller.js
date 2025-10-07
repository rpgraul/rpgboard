<<<<<<< HEAD
export function rollDice(e) {
  return Math.floor(Math.random() * e) + 1;
}
export function showDiceResult(e, t) {
  const o = document.createElement("div");
  (o.className = "notification is-info dice-notification"),
    (o.style.position = "fixed"),
    (o.style.bottom = "20px"),
    (o.style.right = "20px"),
    (o.style.zIndex = "9999"),
    (o.innerHTML = `\n        <button class="delete" type="button"></button>\n        <p><strong>${
      t || "Alguém"
    }</strong> rolou:</p>\n        <div class="dice-result">${e}</div>\n    `),
    document.body.appendChild(o);
  o.querySelector(".delete").addEventListener("click", () => {
    o.remove();
  }),
    setTimeout(() => {
      document.body.contains(o) && o.remove();
    }, 5e3);
=======
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
>>>>>>> 104b23cfc07483eae944d9e675e87949d0da4616
}
