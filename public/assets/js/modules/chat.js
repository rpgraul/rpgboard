import * as firebaseService from './firebaseService.js';

const messagesContainer = () => document.getElementById('chat-messages');
const inputForm = () => document.getElementById('chat-input-area');
const inputField = () => document.getElementById('chat-input');
const toggleBtn = () => document.getElementById('toggle-chat-btn');
const closeBtn = () => document.getElementById('close-chat-btn');
const sidebar = () => document.getElementById('chat-sidebar');

let unsubscribeChat = null;

function renderMessage(doc) {
  const data = doc.data ? doc.data() : doc;
  const id = doc.id || (data && data.id) || null;
  const el = document.createElement('div');
  el.className = 'chat-message';
  
  // Determina a classe com base no tipo
  const messageType = data.type === 'system' ? 'is-system' : 'is-user';
  el.classList.add(messageType);
  
  // Formata a hora (se disponível)
  let timeStr = '';
  if (data.createdAt) {
    try {
      const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      timeStr = ` ${hours}:${minutes}`;
    } catch (e) {
      // fallback se não conseguir formatar
    }
  }
  
  // Cria a estrutura: message-sender com nome e hora, depois o texto
  el.innerHTML = `
    <span class="message-sender">${data.sender || 'Anônimo'}${timeStr}</span>
    <span class="message-text">${data.text}</span>
  `;
  el.dataset.id = id;
  return el;
}

export function logSystemMessage(text) {
  try {
    return firebaseService.addChatMessage(text, 'system', 'Sistema');
  } catch (e) {
    console.error('Falha ao enviar mensagem do sistema:', e);
  }
}

export function initializeChat() {
  if (!toggleBtn()) return;

  toggleBtn().addEventListener('click', () => {
    const s = sidebar();
    if (!s) return;
    s.classList.toggle('is-hidden');
  });

  if (closeBtn()) {
    closeBtn().addEventListener('click', () => {
      const s = sidebar();
      if (!s) return;
      s.classList.add('is-hidden');
    });
  }

  // Submit handler
  if (inputForm()) {
    inputForm().addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = (inputField() && inputField().value || '').trim();
      if (!text) return;
      const sender = localStorage.getItem('rpgboard_user_name') || 'Anônimo';
      inputField().value = '';
      try {
        await firebaseService.addChatMessage(text, 'user', sender);
      } catch (err) {
        console.error('Erro ao enviar mensagem de chat:', err);
      }
    });
  }

  // Real-time listener
  if (unsubscribeChat) unsubscribeChat();
  unsubscribeChat = firebaseService.listenToChat((snapshot) => {
    const container = messagesContainer();
    if (!container) return;
    container.innerHTML = '';
    snapshot.docs.forEach(doc => {
      const el = renderMessage(doc);
      container.appendChild(el);
    });
    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  });
}

export default {
  initializeChat,
  logSystemMessage,
};
