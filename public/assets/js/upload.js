import { initializeLayout } from './modules/layout.js';
import { getSettings, initFirebaseService, importCards } from './modules/firebaseService.js';
import { initializeAuth } from './modules/auth.js';
import * as chat from './modules/chat.js';
import { initializeModals } from './modules/modal.js';

export async function initializeUpload() {
    // 1. Inicializar Interface Global (Header, FAB, Modais)
    await initializeLayout();

    // 2. Inicializar Módulos Globais (Autenticação, Modais, Chat)
    initializeAuth();
    initializeModals();
    chat.initializeChat();

    // 3. Carregar Configurações e Título Original via Firebase
    try {
        const appSettings = await getSettings();
        window.appSettings = appSettings;
        initFirebaseService();
        if (appSettings.siteTitle) {
            document.title = `${appSettings.siteTitle} - Upload | GameBoard`;
        }

        // Renderizar header atualizado com o Firebase Config carregado
        if (typeof import('./modules/components/header.js').then === 'function') {
            import('./modules/components/header.js').then(mod => mod.renderHeader && mod.renderHeader());
        }
    } catch (error) {
        console.error('Falha ao carregar configurações do site:', error);
    }

    // 4. Elementos específicos do Upload
    const jsonInput = document.getElementById('json-input');
    const importBtn = document.getElementById('import-btn');
    const notificationArea = document.getElementById('notification-area');

    function showNotification(message, type = 'is-success') {
        if (!notificationArea) return;
        notificationArea.innerHTML = `
            <div class="notification ${type}">
                <button class="delete"></button>
                ${message}
            </div>
        `;
        notificationArea.querySelector('.delete').addEventListener('click', () => {
            notificationArea.innerHTML = '';
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            if (!jsonInput) return;
            const jsonText = jsonInput.value.trim();
            if (!jsonText) {
                showNotification('O campo de JSON não pode estar vazio.', 'is-danger');
                return;
            }

            let cards;
            try {
                cards = JSON.parse(jsonText);
            } catch (error) {
                showNotification(`Erro de sintaxe no JSON: ${error.message}`, 'is-danger');
                return;
            }

            if (!Array.isArray(cards) || cards.length === 0) {
                showNotification('O JSON deve ser um array de cards e não pode estar vazio.', 'is-danger');
                return;
            }

            importBtn.classList.add('is-loading');
            if (notificationArea) notificationArea.innerHTML = '';

            try {
                const count = await importCards(cards, showNotification);
                showNotification(`${count} card(s) importado(s) com sucesso!`, 'is-success');
                jsonInput.value = '';
            } catch (error) {
                console.error("Erro ao importar cards:", error);
                showNotification(`Ocorreu um erro durante a importação: ${error.message}`, 'is-danger');
            } finally {
                importBtn.classList.remove('is-loading');
            }
        });
    }
}

// Quando carregado diretamente pelo upload.html
document.addEventListener('DOMContentLoaded', initializeUpload);
