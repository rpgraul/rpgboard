import { openModal, closeModal } from './modal.js';

const NARRATOR_PASSWORD = 'dimitrinho';
const STORAGE_KEY = 'isNarrator'; // Alterado para localStorage para persistência

let narratorModal = null;
let loginBtn = null;
let loginForm = null;
let passwordInput = null;
let errorMessage = null;

/**
 * Verifica se o usuário atual está autenticado como narrador.
 * @returns {boolean} True se o usuário for o narrador.
 */
export function isNarrator() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Realiza o login do usuário como narrador.
 */
function login() {
    localStorage.setItem(STORAGE_KEY, 'true');
    closeModal(narratorModal);
    // Dispara um evento global para que outras partes da UI possam reagir à mudança de status.
    window.dispatchEvent(new Event('narratorStatusChange'));
}

/**
 * Realiza o logout do narrador.
 */
function logout() {
    localStorage.removeItem(STORAGE_KEY);
    // Dispara o evento para a UI reagir.
    window.dispatchEvent(new Event('narratorStatusChange'));
}

/**
 * Lida com a tentativa de login do formulário.
 * @param {Event} event
 */
function handleLoginAttempt(event) {
    event.preventDefault();
    if (passwordInput.value === NARRATOR_PASSWORD) {
        errorMessage.classList.add('is-hidden');
        login();
    } else {
        errorMessage.classList.remove('is-hidden');
        passwordInput.value = '';
    }
}

/**
 * Inicializa o módulo de autenticação do narrador.
 */
export function initializeAuth() {
    narratorModal = document.getElementById('narrator-modal');
    loginBtn = document.getElementById('narrator-login-btn');
    loginForm = document.getElementById('form-narrator-login');
    passwordInput = document.getElementById('narrator-password');
    errorMessage = document.getElementById('narrator-error-message');

    if (!narratorModal || !loginBtn || !loginForm) return;

    loginBtn.addEventListener('click', () => {
        if (isNarrator()) logout();
        else openModal(narratorModal);
    });

    loginForm.addEventListener('submit', handleLoginAttempt);
}