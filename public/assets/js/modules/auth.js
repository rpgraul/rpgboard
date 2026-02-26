import { openModal, closeModal } from "./modal.js";

const NARRATOR_PASSWORDS = ["dimitrinho", "tomatinho"];
const STORAGE_KEY = "isNarrator";
const USER_NAME_KEY = "rpgboard_user_name";

let narratorModal = null;
let loginBtn = null;
let loginForm = null;
let passwordInput = null;
let errorMessage = null;

export const isNarrator = () => "true" === localStorage.getItem(STORAGE_KEY);

export const getCurrentUserName = () => localStorage.getItem(USER_NAME_KEY) || 'Visitante';

export const validateNarratorPassword = (pwd) => !!pwd && NARRATOR_PASSWORDS.some(p => p === pwd);

export const loginAsNarrator = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.setItem(USER_NAME_KEY, "Mestre");
    window.dispatchEvent(new Event("narratorStatusChange"));
};

export const loginAsPlayer = (name) => {
    localStorage.setItem(STORAGE_KEY, "false");
    localStorage.setItem(USER_NAME_KEY, name);
    window.dispatchEvent(new Event("narratorStatusChange"));
};

export const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    window.dispatchEvent(new Event("narratorStatusChange"));
};

function handleLoginAttempt(event) {
    event.preventDefault();
    const pwd = (passwordInput && passwordInput.value) ? passwordInput.value.trim() : "";
    if (validateNarratorPassword(pwd)) {
        if (errorMessage) errorMessage.classList.add("is-hidden");
        loginAsNarrator();
        closeModal(narratorModal);
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
