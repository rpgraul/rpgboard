let activePopover = null;

/**
 * Remove o popover de confirmação ativo, se houver.
 */
function removeActivePopover() {
    if (activePopover) {
        activePopover.remove();
        activePopover = null;
        document.removeEventListener('click', handleOutsideClick, true);
    }
}

/**
 * Lida com cliques fora do popover para fechá-lo.
 * @param {Event} event
 */
function handleOutsideClick(event) {
    if (activePopover && !activePopover.contains(event.target)) {
        removeActivePopover();
    }
}

/**
 * Exibe um popover de confirmação próximo a um elemento alvo.
 * @param {object} options
 * @param {HTMLElement} options.targetElement - O elemento ao qual o popover será anexado.
 * @param {string} options.message - A mensagem a ser exibida.
 * @param {function} options.onConfirm - Callback a ser executado na confirmação.
 */
export function showConfirmationPopover({ targetElement, message, onConfirm }) {
    // Remove qualquer popover anterior para garantir que apenas um exista.
    removeActivePopover();

    const popover = document.createElement('div');
    popover.className = 'confirmation-popover';
    popover.innerHTML = `
        <p>${message}</p>
        <div class="buttons">
            <button class="button is-danger is-small confirm-btn">Confirmar</button>
            <button class="button is-small cancel-btn">Cancelar</button>
        </div>
    `;

    document.body.appendChild(popover);
    activePopover = popover;

    const targetRect = targetElement.getBoundingClientRect();
    popover.style.position = 'absolute';
    popover.style.top = `${targetRect.bottom + window.scrollY + 8}px`;
    popover.style.left = `${targetRect.right + window.scrollX - popover.offsetWidth}px`;

    popover.querySelector('.confirm-btn').addEventListener('click', () => {
        onConfirm();
        removeActivePopover();
    });

    popover.querySelector('.cancel-btn').addEventListener('click', removeActivePopover);

    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick, true);
    }, 0);
}