/**
 * Adiciona a classe 'is-active' para mostrar um modal.
 * @param {HTMLElement} modal O elemento do modal a ser aberto.
 */
export function openModal(modal) {
    if (modal) modal.classList.add('is-active');
}

/**
 * Remove a classe 'is-active' para esconder um modal.
 * @param {HTMLElement} modal O elemento do modal a ser fechado.
 */
export function closeModal(modal) {
    if (modal) modal.classList.remove('is-active');
}

/**
 * Fecha todos os modais ativos na página.
 */
function closeAllModals() {
    (document.querySelectorAll('.modal') || []).forEach(closeModal);
}

/**
 * Configura todos os event listeners para o controle de modais.
 */
export function initializeModals() {

    // Fechar modais com botões de fechar/cancelar ou clicando no fundo
    (document.querySelectorAll('.modal-background, .modal-close, .delete, .modal-cancel') || []).forEach((close) => {
        const modal = close.closest('.modal');
        if (modal) close.addEventListener('click', () => closeModal(modal));
    });

    // Fechar modais com a tecla Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") closeAllModals();
    });
}