import { initializeLayout } from './modules/layout.js';
import { initializeAuth } from './modules/auth.js';
import { initWhiteboard } from './whiteboard/index.js';
import * as chat from './modules/chat.js';
import { initializeDice } from './modules/diceLogic.js';
import { initializeModals } from './modules/modal.js';
import { initializeCardModal } from './modules/cardModal.js';
import * as firebaseService from './modules/firebaseService.js';
import { initializeApp } from './modules/appInitializer.js';

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
        await initializeApp({ pageTitle: 'Canvas' });

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