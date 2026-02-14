import { openModal, closeModal } from "./modal.js";

const NARRATOR_PASSWORDS = ["dimitrinho", "tomatinho"];
const STORAGE_KEY = "isNarrator";
const USER_NAME_KEY = "rpgboard_user_name";

let narratorModal = null;
let loginBtn = null;
let loginForm = null;
let passwordInput = null;
let errorMessage = null;

export function isNarrator() {
    return "true" === localStorage.getItem(STORAGE_KEY);
}

export function getCurrentUserName() {
    return localStorage.getItem(USER_NAME_KEY) || 'Visitante';
}

function login() {
    localStorage.setItem(STORAGE_KEY, "true");
    closeModal(narratorModal);
    window.dispatchEvent(new Event("narratorStatusChange"));
}

function logout() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("narratorStatusChange"));
}

function handleLoginAttempt(event) {
    event.preventDefault();
    const pwd = (passwordInput && passwordInput.value) ? passwordInput.value.trim() : "";
    if (pwd && NARRATOR_PASSWORDS.some(p => p === pwd)) {
        if (errorMessage) errorMessage.classList.add("is-hidden");
        login();
    } else {
        if (errorMessage) errorMessage.classList.remove("is-hidden");
        if (passwordInput) passwordInput.value = "";
    }
}

export function initializeAuth() {
    narratorModal = document.getElementById("narrator-modal");
    loginBtn = document.getElementById("narrator-login-btn");
    loginForm = document.getElementById("form-narrator-login");
    passwordInput = document.getElementById("narrator-password");
    errorMessage = document.getElementById("narrator-error-message");

    if (narratorModal && loginBtn && loginForm) {
        loginBtn.addEventListener("click", () => {
            if (isNarrator()) {
                logout();
            } else {
                openModal(narratorModal);
            }
        });
        loginForm.addEventListener("submit", handleLoginAttempt);
    }
}
