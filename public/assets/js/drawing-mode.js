import { initializeLayout } from './modules/layout.js';
import { initializeAuth } from './modules/auth.js';
import { initWhiteboard } from './whiteboard/index.js';
import * as chat from './modules/chat.js';
import { initializeDice } from './modules/diceLogic.js';
import { initializeModals } from './modules/modal.js';
import { initializeCardModal } from './modules/cardModal.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Layout Base
    const layout = await initializeLayout();

    // 2. Autenticação e Modais
    initializeAuth();
    initializeModals();

    // 3. Chat (Opcional, mas útil)
    chat.initializeChat();
    initializeDice(layout);

    // 4. Carregar settings e garantir título no header
    try {
        const firebaseService = await import('./modules/firebaseService.js');
        const appSettings = await firebaseService.getSettings();
        window.appSettings = appSettings;
        firebaseService.initFirebaseService();
        if (appSettings.siteTitle) {
            document.title = `${appSettings.siteTitle} - GameBoard`;
        }
        if (typeof import('./modules/components/header.js').then === 'function') {
            import('./modules/components/header.js').then(mod => mod.renderHeader && mod.renderHeader());
        }

        // 5. Inicializar modal de card com onSave -> updateItem
        await initializeCardModal({
            onSave: async (data, file, editingItem) => {
                if (!editingItem) return;
                await firebaseService.updateItem(editingItem, data, file || null);
            }
        });
    } catch (error) {
        console.error('Falha ao carregar configurações do site:', error);
    }

    // 6. Inicializar Whiteboard
    initWhiteboard();
});