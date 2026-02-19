import { initializeLayout } from './modules/layout.js';
import { initializeAuth } from './modules/auth.js';
import { initWhiteboard } from './whiteboard/index.js';
import * as chat from './modules/chat.js';
import { initializeModals } from './modules/modal.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Layout Base
    const layout = await initializeLayout({
        fabActions: ['help', 'chat', 'settings']
    });

    // 2. Autenticação e Modais
    initializeAuth();
    initializeModals();

    // 3. Chat (Opcional, mas útil)
    chat.initializeChat();

    // 4. Carregar settings e garantir título no header
    try {
        const firebaseService = await import('./modules/firebaseService.js');
        const appSettings = await firebaseService.getSettings();
        window.appSettings = appSettings;
        window.IMGBB_API_KEY = appSettings.imgbbApiKey;
        if (appSettings.siteTitle) {
            document.title = `${appSettings.siteTitle} - GameBoard`;
        }
        // Re-renderizar header para garantir título correto
        if (typeof import('./modules/components/header.js').then === 'function') {
            import('./modules/components/header.js').then(mod => mod.renderHeader && mod.renderHeader());
        }
    } catch (error) {
        console.error('Falha ao carregar configurações do site:', error);
    }

    // 5. Inicializar Whiteboard
    initWhiteboard();
});