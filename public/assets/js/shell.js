/**
 * shell.js — Entry point do Shell permanente.
 * Inicializa o layout global (header, overlays, fab) e o áudio UMA ÚNICA VEZ.
 * Em seguida, entrega o controle ao router.js para gerenciar as rotas.
 */
import { initializeLayout } from './modules/layout.js';
import { initializeAuth } from './modules/auth.js';
import { initializeModals } from './modules/modal.js';
import * as chat from './modules/chat.js';
import { initializeDice } from './modules/diceLogic.js';
import * as audio from './modules/audio.js';
import { initializeApp } from './modules/appInitializer.js';
import { initRouter } from './router.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Layout global (header, overlays com iframe YouTube, fab)
  const layout = await initializeLayout();

  // 2. Módulos globais — inicializados UMA VEZ, persistem entre navegações
  initializeAuth();
  initializeModals();
  chat.initializeChat();
  initializeDice(layout);
  audio.initializeAudio(); // iframe YouTube nunca é destruído

  // 3. Settings globais
  try {
    await initializeApp({ pageTitle: 'GameBoard' });
  } catch (e) {
    console.error('[Shell] Falha ao carregar settings:', e);
  }

  // 4. Iniciar o router (carrega a rota atual e configura navegação)
  await initRouter();
});
