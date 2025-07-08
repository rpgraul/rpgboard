// Constantes para os textos, facilitando futuras alterações.
export const NARRATOR_FILTER_LABELS = {
    VISIBLE: 'Visível para jogadores',
    HIDDEN: 'Oculto dos jogadores'
};

/**
 * Atualiza a visibilidade dos elementos da UI exclusivos do narrador.
 * @param {boolean} isNarrator - Se o usuário está logado como narrador.
 */
export function updateNarratorUI(isNarrator) {
    const narratorElements = document.querySelectorAll('.narrator-only');
    const loginBtn = document.getElementById('narrator-login-btn');

    narratorElements.forEach(el => {
        // Usamos a classe 'is-hidden' do Bulma para controlar a visibilidade
        el.classList.toggle('is-hidden', !isNarrator);
    });

    if (loginBtn) {
        loginBtn.textContent = isNarrator ? 'Sair' : 'Entrar como Narrador';
    }
}