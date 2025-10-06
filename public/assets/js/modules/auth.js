import { openModal, closeModal } from "./modal.js";
const NARRATOR_PASSWORDS = ["dimitrinho", "tomatinho"],
    STORAGE_KEY = "isNarrator";
let narratorModal = null,
    loginBtn = null,
    loginForm = null,
    passwordInput = null,
    errorMessage = null;
export function isNarrator() {
    return "true" === localStorage.getItem(STORAGE_KEY);
}
function login() {
    localStorage.setItem(STORAGE_KEY, "true"), closeModal(narratorModal), window.dispatchEvent(new Event("narratorStatusChange"));
}
function logout() {
    localStorage.removeItem(STORAGE_KEY), window.dispatchEvent(new Event("narratorStatusChange"));
}
function handleLoginAttempt(t) {
    t.preventDefault(), NARRATOR_PASSWORDS.includes(passwordInput.value) ? (errorMessage.classList.add("is-hidden"), login()) : (errorMessage.classList.remove("is-hidden"), (passwordInput.value = ""));
}
export function initializeAuth() {
    (narratorModal = document.getElementById("narrator-modal")),
        (loginBtn = document.getElementById("narrator-login-btn")),
        (loginForm = document.getElementById("form-narrator-login")),
        (passwordInput = document.getElementById("narrator-password")),
        (errorMessage = document.getElementById("narrator-error-message")),
        narratorModal &&
            loginBtn &&
            loginForm &&
            (loginBtn.addEventListener("click", () => {
                isNarrator() ? logout() : openModal(narratorModal);
            }),
            loginForm.addEventListener("submit", handleLoginAttempt));
}
