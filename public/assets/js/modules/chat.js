import { addChatMessage, listenToChat } from './firebaseService.js';
import { processRoll } from './diceLogic.js';
import { getCurrentUserName } from './auth.js';

const messagesContainer = () => document.getElementById('chat-messages');
const sidebar = () => document.getElementById('chat-sidebar');
const inputField = () => document.getElementById('chat-input');
const inputForm = () => document.getElementById('chat-input-area');
const closeBtn = () => document.getElementById('close-chat-btn');

function renderMessage(doc) {
    const data = doc.data ? doc.data() : doc;
    const el = document.createElement('div');
    el.className = `chat-message ${data.type === 'system' ? 'is-system' : 'is-user'}`;

    let timeStr = '';
    if (data.createdAt && data.createdAt.toDate) {
        const date = data.createdAt.toDate();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        timeStr = ` ${hours}:${minutes}`;
    }

    el.innerHTML = `
        <span class="message-sender">${data.sender || 'Anônimo'}${timeStr}</span>
        <span class="message-text">${data.text}</span>
    `;
    return el;
}

function scrollToBottom() {
    const el = messagesContainer();
    if (el) {
        setTimeout(() => { el.scrollTop = el.scrollHeight; }, 100);
    }
}

export function toggleChat() {
    const s = sidebar();
    if (s) {
        const isHidden = s.classList.contains('is-hidden');
        s.classList.toggle('is-hidden');
        if (isHidden) {
            const input = inputField();
            if (input) setTimeout(() => input.focus(), 100);
            scrollToBottom();
        }
    }
}

/**
 * Função ÚNICA para enviar mensagens.
 * Centraliza a lógica de criar a mensagem do usuário e processar comandos.
 */
export async function sendMessage(text, user, characterContext = null, macroName = null) {
    if (!text || !user) return;

    // 1. Grava a mensagem do usuário no banco (O "Eco" visual: "Usuario: /r 1d20")
    try {
        await addChatMessage(text, 'user', user);
        scrollToBottom();
    } catch (err) {
        console.error("Erro ao enviar mensagem:", err);
        return;
    }

    // 2. Verifica se é comando e processa a resposta do Sistema
    const cleanText = text.trim();
    if (cleanText.startsWith('/r ') || cleanText.startsWith('/roll ')) {
        // A diceLogic vai gerar a mensagem do sistema e o dado 3D
        processRoll(cleanText, characterContext, user, macroName);
    }
}

// --- Inicialização ---
export function initializeChat() {
    // Event delegation for chat buttons (works after FAB re-render)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#toggle-chat-btn')) {
            e.stopPropagation();
            toggleChat();
        }
        if (e.target.closest('#close-chat-btn')) {
            const s = sidebar();
            if (s) s.classList.add('is-hidden');
        }
    });

    // Escape key to close chat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const s = sidebar();
            if (s && !s.classList.contains('is-hidden')) {
                toggleChat();
            }
        }
    });

    const form = inputForm();
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const input = inputField();
            if (!input) return;

            const text = input.value.trim();
            if (!text) return;

            const user = getCurrentUserName() || 'Anônimo';
            input.value = '';

            await sendMessage(text, user, null);
        };
    }

    listenToChat((snapshot) => {
        const container = messagesContainer();
        if (!container) return;

        container.innerHTML = '';
        snapshot.docs.forEach(doc => container.appendChild(renderMessage(doc)));
        scrollToBottom();
    });
}

export function logSystemMessage(text, senderName = 'Sistema') {
    return addChatMessage(text, 'system', senderName);
}