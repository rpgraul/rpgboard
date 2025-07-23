// Importar os módulos
import { initializeModals, openModal, closeModal } from './modules/modal.js';
import * as auth from './modules/auth.js';
import * as firebaseService from './modules/firebaseService.js';
import * as narrator from './modules/narrator.js';
import * as bulkEdit from './modules/bulkEdit.js';
import * as settings from './modules/settings.js';
import * as grid from './modules/grid.js'; 
import * as board from './modules/board.js';
import * as cardRenderer from './modules/cardRenderer.js';
import * as shortcodeParser from './modules/shortcodeParser.js';


let allItems = []; // Cache local de todos os itens para a busca
let tagSuggestionsContainer = null; // Container único para as sugestões de tags
let isInitialGridLoaded = false; // Flag para controlar o carregamento inicial da grade

let appSettings = {}; // Armazena as configurações carregadas do site
const VISIBILITY_FILTERS = {
    VISIBLE: 'visible',
    HIDDEN: 'hidden'
};

/**
 * Normaliza uma string, removendo acentos e convertendo para minúsculas.
 * @param {string} str A string a ser normalizada.
 * @returns {string} A string normalizada.
 */
function normalizeString(str) {
    if (!str) return '';
    return str
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Gera os checkboxes de filtro de tag dinamicamente a partir das configurações.
 * @param {Array<object>} filters - Array de objetos de filtro, ex: [{label: 'PJs', value: 'pjs'}].
 * @param {HTMLElement} container - O elemento onde os filtros serão inseridos.
 */
function generateTagFilters(filters, container) {
    if (!container || !Array.isArray(filters)) return;

    const firstNarratorFilter = container.querySelector('.narrator-only');

    filters.forEach(filter => {
        const controlDiv = document.createElement('div');
        controlDiv.className = 'control';
        controlDiv.innerHTML = `
            <label class="checkbox">
                <input type="checkbox" value="${filter.value}">
                <span>${filter.label}</span>
            </label>
        `;
        // Insere os filtros dinâmicos antes dos filtros do narrador.
        container.insertBefore(controlDiv, firstNarratorFilter);
    });
}

/**
 * Injeta estilos CSS na cabeça do documento para melhorar a usabilidade do drag-and-drop.
 */
function injectDragDropStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Adiciona o cursor de "agarrar" aos cards que podem ser arrastados */
        .card.muuri-item-draggable {
            cursor: grab;
        }
        .card.muuri-item-dragging {
            cursor: grabbing;
        }
        /* Reseta o cursor para o conteúdo interno, fazendo com que a "alça" seja a borda/padding do card */
        .card.muuri-item-draggable .card-content,
        .card.muuri-item-draggable .card-image,
        .card.muuri-item-draggable .card-actions-top,
        .card.muuri-item-draggable .card-info-layer {
            cursor: auto;
        }
    `;
    document.head.appendChild(style);
}

import * as cardManager from './modules/cardManager.js';


document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obter referências aos elementos principais
    const viewToggleButton = document.getElementById('fab-toggle-view');
    const addCardButton = document.getElementById('fab-add-card');
    const fabHelp = document.getElementById('fab-help');
    const fabBulkEdit = document.getElementById('fab-bulk-edit');
    const searchInput = document.getElementById('search-input');
    const activeFiltersContainer = document.getElementById('active-filters-container');
    const boardSearchInput = document.getElementById('board-search-input');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const tagFiltersContainer = document.getElementById('tag-filters');
    const viewWrapper = document.getElementById('view-wrapper');
    const topBarTitle = document.querySelector('.top-bar-title');
    const narratorLoginBtn = document.getElementById('narrator-login-btn');

    const detailModal = document.getElementById('detail-modal');
    const addCardModal = document.getElementById('add-card-modal');
    const helpModal = document.getElementById('help-modal');
    const formAddCard = document.getElementById('form-add-card');
    const fabSettings = document.getElementById('fab-settings');
    const cardFileInput = document.getElementById('card-arquivo');
    const cardTagsInput = document.getElementById('card-tags');
    const gridViewContainer = document.getElementById('grid-view-container');
    const boardViewContainer = document.getElementById('board-view-container');

    // Injeta os estilos para a alça de arrasto
    injectDragDropStyles();

    // Carrega e aplica as configurações do site
    console.log('Iniciando carregamento das configurações do site...');
    try {
        appSettings = await firebaseService.getSettings();
        console.log('Configurações carregadas:', appSettings);
        if (topBarTitle) topBarTitle.textContent = appSettings.siteTitle;
        document.title = `${appSettings.siteTitle} - GameBoard`;
        cardRenderer.initializeCardRenderer(appSettings); // Inicializa o renderizador com as configurações
        generateTagFilters(appSettings.filters, tagFiltersContainer);
    } catch (error) {
        console.error("Falha ao carregar as configurações do site:", error);
        // A aplicação continuará com os valores de fallback definidos em getSettings()
    }


    // 2. Inicializar os módulos
    // Passa o detailModal para que possa ser fechado globalmente
    
    // Define a visualização padrão
    viewWrapper.classList.add('view-grid');

    // Inicializa o módulo de autenticação primeiro
    await auth.initializeAuth();

    // Inicializa o gerenciador de cards depois da autenticação
    await cardManager.initialize({
        onDelete: handleDeleteItem,
        onEdit: handleEditCard,
        onSave: handleSaveCard,
        onView: showDetailModal,
        onTagInputInit: (inputElement) => initializeTagInput(inputElement, { suggestions: appSettings.recommendedTags || [] }),
        onReorder: (orderedIds) => firebaseService.updateItemsOrder(orderedIds).catch(err => {
            console.error("Falha ao reordenar:", err);
        }),
        gridContainer: gridViewContainer,
        boardContainer: boardViewContainer,
    });
    
    // Inicializa o módulo de autenticação
    auth.initializeAuth();
    // Inicializa o módulo de edição em massa
    bulkEdit.initializeBulkEdit();
    // Inicializa o módulo de configurações
    settings.initializeSettings();

    // Função para atualizar a UI com base no status do narrador
    function updateMasterView(isNarrator) {
        narrator.updateNarratorUI(isNarrator);
        document.body.classList.toggle('master-view', isNarrator);
    }

    // Verifica o status do narrador no carregamento da página e atualiza a UI
    updateMasterView(auth.isNarrator());

    // Ouve por mudanças no status do narrador para atualizar a UI
    window.addEventListener('narratorStatusChange', () => {
        const isNarrator = auth.isNarrator();
        updateMasterView(isNarrator);
        
        // Se o usuário fizer logout, sai do modo de edição em massa
        if (!isNarrator) {
            bulkEdit.exitBulkEditMode();
        }

        // A UI será atualizada automaticamente pelo listener do Firebase, que refiltrará os dados
        // com base no novo status de narrador.
        applyFilters();
    });

    // Handlers centralizados para as ações dos cards
    function handleEditCard(card, item, container) {
        container.classList.add('is-editing-item');
        cardRenderer.renderCardEditMode(card, item, cardActionHandlers);

        const imageInput = card.querySelector('.edit-image-input'); // Sempre existirá
        if (imageInput) {
            imageInput.addEventListener('change', () => {
                if (imageInput.files && imageInput.files[0]) {
                    const file = imageInput.files[0];
                    const reader = new FileReader();
                    const figure = card.querySelector('.card-image .image');
                    const img = figure.querySelector('img');
                    const cardImageContainer = card.querySelector('.card-image');

                    cardImageContainer.classList.remove('is-placeholder');

                    reader.onload = (e) => { img.src = e.target.result; };
                    reader.readAsDataURL(file);

                    cardRenderer.getImageDimensions(file).then(dimensions => {
                        const newAspectRatio = (dimensions.height / dimensions.width) * 100;
                        figure.style.paddingBottom = `${newAspectRatio}%`;
                        // A lógica de layout será tratada pelo grid.js
                        grid.refreshLayout();
                    });

                    card._newImageFile = file;
                }
            });
        }
    }

    async function handleSaveCard(cardElement, item) {
        const saveButton = cardElement.querySelector('.save-btn');
        saveButton.classList.add('is-loading');

        const updatedData = cardRenderer.getCardFormData(cardElement);
        const newImageFile = cardElement._newImageFile || null;

        try {
            // Se houver uma nova imagem, obtém suas dimensões antes de salvar
            if (newImageFile) {
                const dimensions = await cardRenderer.getImageDimensions(newImageFile);
                updatedData.width = dimensions.width;
                updatedData.height = dimensions.height;
            }

            // Envia a atualização para o Firebase
            await firebaseService.updateItem(item, updatedData, newImageFile);

            // Limpa o arquivo de imagem temporário, se houver
            if (cardElement._newImageFile) {
                delete cardElement._newImageFile;
            }

            // Retorna o item atualizado para que o cardRenderer possa re-renderizar o card
            // O listener do Firebase também atualizará o cache local, mas retornar o item aqui
            // permite uma atualização visual imediata sem esperar o round-trip do listener.
            return { ...item, ...updatedData };

        } catch (error) {
            console.error("Falha ao salvar as alterações:", error);
            alert("Falha ao salvar as alterações.");
            saveButton.classList.remove('is-loading');
            // Rejeita a promessa para que o chamador (cardRenderer) saiba que algo deu errado
            throw error;
        }
    }

    /**
     * Função genérica para atualizar o valor 'current' de qualquer shortcode.
     * Substitui handleHpChange e handleCountChange.
     * @param {string} itemId - O ID do item.
     * @param {string} encodedShortcode - O shortcode original, já codificado para uso em atributos de dados.
     * @param {number} newCurrentValue - O novo valor para 'current'.
     * @param {HTMLElement|null} triggerElement - O elemento que iniciou a ação, para feedback visual.
     */
    async function handleShortcodeValueChange(itemId, encodedShortcode, newCurrentValue, triggerElement = null) {
        const item = allItems.find(i => i.id === itemId);
        if (!item || !item.conteudo) {
            console.error("Item não encontrado para atualização de shortcode:", itemId);
            return;
        }

        // --- Feedback Visual Otimista ---
        if (triggerElement) {
            const componentRoot = triggerElement.closest('.shortcode-hp, .shortcode-count');
            if (componentRoot) {
                componentRoot.classList.add('is-updating');
                // Remove a classe após a animação para que possa ser acionada novamente.
                setTimeout(() => componentRoot.classList.remove('is-updating'), 700);
            }
        }

        const decodedShortcode = decodeURIComponent(encodedShortcode);

        let newShortcode;
        if (/current=/.test(decodedShortcode)) {
            // Substitui current=valor ou current="valor" por current="novoValor"
            newShortcode = decodedShortcode.replace(/current=("?)(\d+)("?)/, `current="${newCurrentValue}"`);
        } else {
            newShortcode = decodedShortcode.replace(/]$/, ` current="${newCurrentValue}"]`);
        }

        const newContent = item.conteudo.replace(decodedShortcode, newShortcode);

        try {
            await firebaseService.updateItem(item, { conteudo: newContent });
        } catch (error) {
            console.error("Falha ao atualizar shortcode:", error);
            alert("Falha ao salvar a alteração.");
        }
    }

    /**
     * Lida com a alteração do valor do shortcode de dinheiro, incluindo operações matemáticas.
     * @param {HTMLInputElement} inputElement - O elemento de input que foi editado.
     */
    async function handleMoneyChange(inputElement) {
        const moneyComponent = inputElement.closest('.shortcode-money');
        if (!moneyComponent || !moneyComponent.dataset.itemId) return;

        const { itemId, shortcode: encodedShortcode } = moneyComponent.dataset;
        const item = allItems.find(i => i.id === itemId);
        if (!item) return;

        const decodedShortcode = decodeURIComponent(encodedShortcode);
        const originalArgs = shortcodeParser._parseArguments(decodedShortcode.slice(1, -1)).slice(1);
        const originalParams = shortcodeParser._parseKeyValueArgs(originalArgs);
        const originalValue = parseFloat(originalParams.current) || 0;

        const userInput = inputElement.value.trim();
        // Remove dots (thousand separators) to allow for calculation.
        const cleanedInput = userInput.replace(/\./g, '');
        let newValue = originalValue;

        // Case 1: Full expression (e.g., "10+10", "5 * 2")
        const fullExpressionMatch = cleanedInput.match(/^(\d+\.?\d*)\s*([+\-*\/])\s*(\d+\.?\d*)$/);
        if (fullExpressionMatch) {
            const operand1 = parseFloat(fullExpressionMatch[1]);
            const operator = fullExpressionMatch[2];
            const operand2 = parseFloat(fullExpressionMatch[3]);

            if (!isNaN(operand1) && !isNaN(operand2)) {
                if (operator === '+') newValue = operand1 + operand2;
                else if (operator === '-') newValue = operand1 - operand2;
                else if (operator === '*') newValue = operand1 * operand2;
                else if (operator === '/' && operand2 !== 0) newValue = operand1 / operand2;
            }
        }
        // Case 2: Relative operation (e.g., "+10", "-5")
        else {
            const relativeOperationMatch = cleanedInput.match(/^([+\-*\/])\s*(\d+\.?\d*)$/);
            if (relativeOperationMatch) {
                const operator = relativeOperationMatch[1];
                const operand = parseFloat(relativeOperationMatch[2]);
                if (!isNaN(operand)) {
                    if (operator === '+') newValue = originalValue + operand;
                    else if (operator === '-') newValue = originalValue - operand;
                    else if (operator === '*') newValue = originalValue * operand;
                    else if (operator === '/' && operand !== 0) newValue = originalValue / operand;
                }
            }
            // Case 3: Absolute value (e.g., "20")
            else if (!isNaN(parseFloat(cleanedInput))) {
                newValue = parseFloat(cleanedInput);
            }
        }

        newValue = Math.round(newValue * 100) / 100; // Arredonda para 2 casas decimais

        // Atualiza o shortcode na string de conteúdo
        const newShortcode = decodedShortcode.replace(/current=([\d\."]+)/, `current="${newValue}"`);
        const newContent = item.conteudo.replace(decodedShortcode, newShortcode);

        // Salva no Firebase apenas se o conteúdo mudou
        if (newContent !== item.conteudo) await firebaseService.updateItem(item, { conteudo: newContent });
    }

    /**
     * Lida com a mudança de posição de um card no board.
     * @param {string} itemId - O ID do item.
     * @param {{x: number, y: number}} position - A nova posição.
     */
    async function handlePositionChange(itemId, position) {
        await firebaseService.updateItem({ id: itemId }, { boardPosition: position });
    }

    // Objeto unificado de handlers para os cards
    const cardActionHandlers = {
        onDelete: handleDeleteItem,
        onEdit: handleEditCard,
        onSave: handleSaveCard,
        onView: showDetailModal,
        onTagInputInit: (inputElement) => initializeTagInput(inputElement, { suggestions: appSettings.recommendedTags || [] }),
        onPositionChange: handlePositionChange, // Handler para o board
    };

    initializeModals();
    // Passa os handlers para ambos os módulos de visualização
    grid.initializeGrid(cardActionHandlers);
    board.initializeBoard(cardActionHandlers);

    // --- Manipulador de Cliques Unificado e Inteligente ---
    // Um único listener no body para gerenciar todas as interações,
    // evitando conflitos ao checar o alvo mais específico primeiro.
    document.body.addEventListener('click', (event) => {
        const target = event.target;

        // Prioridade 0: Links de Card.
        const cardLink = target.closest('.card-link');
        if (cardLink) {
            event.stopPropagation();
            const cardNameToFind = cardLink.dataset.cardName;
            if (cardNameToFind) {
                // Procura o card no cache local, ignorando maiúsculas/minúsculas e espaços.
            }
            return;
        }

        // Prioridade 1: Alterações nos contadores.
        const countTrigger = target.closest('.count-btn, .count-checkbox');
        if (countTrigger) {
            event.stopPropagation();

            const countComponent = countTrigger.closest('.shortcode-count');
            if (!countComponent) return;

            const { itemId, shortcode } = countComponent.dataset;
            if (itemId && shortcode) {
                const decodedShortcode = decodeURIComponent(shortcode);
                const maxMatch = decodedShortcode.match(/max=(?:"|')?(\d+)(?:"|')?/);
                const currentMatch = decodedShortcode.match(/current=(?:"|')?(\d+)(?:"|')?/);
                const max = maxMatch ? parseInt(maxMatch[1], 10) : 0;
                let current = currentMatch ? parseInt(currentMatch[1], 10) : 0;
                let newCurrent = current;

                if (countTrigger.classList.contains('count-btn')) {
                    const action = countTrigger.dataset.action;
                    if (action === 'increment') {
                        newCurrent = Math.min(current + 1, max);
                    } else if (action === 'decrement') {
                        newCurrent = Math.max(current - 1, 0);
                    }
                } else if (countTrigger.classList.contains('count-checkbox')) {
                    const clickedValue = parseInt(countTrigger.dataset.value, 10);
                    if (clickedValue === current) {
                        newCurrent = 0;
                    } else {
                        newCurrent = clickedValue;
                    }
                }

                handleShortcodeValueChange(itemId, shortcode, newCurrent, countTrigger);
            }
            return;
        }

        // Prioridade 1.5: Edição do dinheiro.
        const moneyDisplay = target.closest('.shortcode-money .money-value-display');
        if (moneyDisplay) {
            event.stopPropagation();
            const moneyComponent = moneyDisplay.closest('.shortcode-money');
            const input = moneyComponent.querySelector('.money-value-input');
            moneyDisplay.classList.add('is-hidden');
            input.classList.remove('is-hidden');
            input.focus();
            input.select();
            return;
        }

        // Prioridade 2: Toggle do Tooltip.
        const toggleTrigger = target.closest('.toggle-view-icon, .tooltip-close-btn');
        if (toggleTrigger) {
            const card = toggleTrigger.closest('.card');
            if (card) card.classList.toggle('is-details-visible');
            return; // Encerra após tratar o toggle.
        }

        // Prioridade 3: Seleção de cards no modo de edição em massa
        if (bulkEdit.isBulkEditingActive()) {
            const cardElement = target.closest('.card');
            if (cardElement) {
                // Como os cliques mais específicos (contadores, etc.) já foram tratados,
                // qualquer clique restante em um card é para seleção.
                bulkEdit.toggleCardSelection(cardElement);
                return; // Ação de seleção tratada.
            }
        }
    });

    // Listener para o novo FAB de edição em massa
    if (fabBulkEdit) {
        fabBulkEdit.addEventListener('click', bulkEdit.enterBulkEditMode);
    }

    // Listener para o FAB de Ajuda
    if (fabHelp) {
        fabHelp.addEventListener('click', () => openModal(helpModal));
    }

    // Listener global para a tecla "Escape"
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // Prioridade 1: Sair do modo de edição em massa
            if (bulkEdit.isBulkEditingActive()) {
                bulkEdit.exitBulkEditMode();
                return; // Ação tratada, encerra.
            }

            // Prioridade 2: Fechar qualquer modal ativo
            const activeModal = document.querySelector('.modal.is-active');
            if (activeModal) {
                closeModal(activeModal);
                return; // Ação tratada, encerra.
            }

            // Prioridade 3: Cancelar a edição de um card
            const editingContainer = document.querySelector('.is-editing-item');
            if (editingContainer) {
                const editingCard = editingContainer.querySelector('.card.editing');
                const cancelButton = editingCard?.querySelector('.cancel-btn');
                if (cancelButton) {
                    // Simula um clique no botão de cancelar para reutilizar a lógica existente
                    cancelButton.click();
                }
                return; // Ação tratada, encerra.
            }

            // Prioridade 4: Fechar a visualização de detalhes de um card
            const detailsVisibleCard = document.querySelector('.card.is-details-visible');
            if (detailsVisibleCard) {
                detailsVisibleCard.classList.remove('is-details-visible');
                return; // Ação tratada, encerra.
            }
        }
    });

    // Listener global para alterações nos inputs (ex: HP)
    document.body.addEventListener('change', (event) => {
        const target = event.target;

        // Manipulador para o input de HP
        if (target.classList.contains('hp-current-input')) {
            const hpComponent = target.closest('.shortcode-hp');
            if (!hpComponent) return;

            const { itemId, shortcode, maxHp } = hpComponent.dataset;
            const newHpValue = parseInt(target.value, 10);

            if (!itemId || !shortcode || isNaN(newHpValue)) return;

            const clampedValue = Math.max(0, Math.min(newHpValue, parseInt(maxHp, 10)));

            // Se o usuário digitar um valor inválido, corrige o input visualmente
            if (clampedValue !== newHpValue) {
                target.value = clampedValue;
            }

            handleShortcodeValueChange(itemId, shortcode, clampedValue, target);
        }
    });

    // Listener para os inputs de dinheiro (quando perdem o foco)
    document.body.addEventListener('focusout', (event) => {
        if (event.target.classList.contains('money-value-input')) {
            handleMoneyChange(event.target);
        }
    });

    // Listener para as teclas Enter/Escape nos inputs de dinheiro
    document.body.addEventListener('keydown', (event) => {
        if (event.target.classList.contains('money-value-input')) {
            if (event.key === 'Enter') {
                event.preventDefault();
                event.target.blur(); // Aciona o 'focusout' para salvar
            } else if (event.key === 'Escape') {
                event.preventDefault();
                const moneyComponent = event.target.closest('.shortcode-money');
                const display = moneyComponent.querySelector('.money-value-display');

                // Re-parse to get original raw value to avoid issues with formatted display value
                const { shortcode: encodedShortcode } = moneyComponent.dataset;
                const decodedShortcode = decodeURIComponent(encodedShortcode);
                const originalArgs = shortcodeParser._parseArguments(decodedShortcode.slice(1, -1)).slice(1);
                const originalParams = shortcodeParser._parseKeyValueArgs(originalArgs);
                const originalValue = parseFloat(originalParams.current) || 0;

                event.target.classList.add('is-hidden');
                display.classList.remove('is-hidden');
                event.target.value = originalValue; // Reseta o valor do input para o valor puro
            }
        }
    });

    // 3. Conectar o backend (Firebase) com o frontend (UI)
    firebaseService.listenToItems(async (snapshot) => {
        try {
            // Se for o primeiro carregamento de dados, renderiza tudo de uma vez.
            if (!isInitialGridLoaded) {
                let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Filtra os itens para não-narradores já no carregamento inicial
                if (!auth.isNarrator()) {
                    items = items.filter(item => item.isVisibleToPlayers !== false);
                }
                allItems = items;

                allItems.sort((a, b) => (a.order || 0) - (b.order || 0));

                // Carrega os items no cardManager e espera a conclusão
                await cardManager.loadItems(allItems);
                                
                isInitialGridLoaded = true;

                // Dispara a primeira renderização da UI
                applyFilters();
                return;
            }
        } catch (error) {
            console.error('Erro ao processar os dados do Firebase:', error);
            const loadingIndicator = document.querySelector('.loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.innerHTML = `
                    <div class="notification is-danger">
                        Erro ao carregar os cards. <a href="javascript:location.reload()">Tente novamente</a>.
                    </div>
                `;
            }
        }
        // Para todas as atualizações subsequentes, processa apenas as mudanças (deltas).
        // A lógica aqui é manter o cache `allItems` perfeitamente sincronizado com o DB.
        // A renderização é delegada para a função `applyFilters` no final.

        snapshot.docChanges().forEach((change) => {
            const itemData = { id: change.doc.id, ...change.doc.data() };
            const indexInCache = allItems.findIndex(i => i.id === itemData.id);
            const isNarrator = auth.isNarrator();

            switch (change.type) {
                case "added":
                    // Adiciona se for narrador, ou se for jogador e o item for visível.
                    if (isNarrator || itemData.isVisibleToPlayers !== false) {
                        if (indexInCache === -1) allItems.push(itemData);
                    }
                    break;
                case "modified":
                    const shouldBeVisible = isNarrator || itemData.isVisibleToPlayers !== false;
                    if (indexInCache > -1) { // Estava no cache
                        if (shouldBeVisible) allItems[indexInCache] = itemData; // Atualiza
                        else allItems.splice(indexInCache, 1); // Tornou-se invisível, remove
                    } else { // Não estava no cache
                        if (shouldBeVisible) allItems.push(itemData); // Tornou-se visível, adiciona
                    }
                    break;
                case "removed":
                    if (indexInCache > -1) {
                        allItems.splice(indexInCache, 1);
                    }
                    // Adicionalmente, se o modal de detalhes estiver aberto com este item, fecha-o.
                    if (detailModal.classList.contains('is-active')) {
                        const modalBox = detailModal.querySelector('.box');
                        if (modalBox && modalBox.dataset.itemId === itemData.id) {
                            closeModal(detailModal);
                        }
                    }
                    break;
                }
        });

        // Após processar todas as mudanças, reordena o cache local e dispara a atualização da UI
        allItems.sort((a, b) => (a.order || 0) - (b.order || 0));
        // Dispara o filtro/renderização que usará o `allItems` atualizado
        applyFilters();
    });

    // Função unificada para aplicar todos os filtros (busca e tags)
    function applyFilters() {
        const searchTerm = searchInput.value.trim();
        const selectedTags = Array.from(tagFiltersContainer.querySelectorAll('input:not([value="visible"]):not([value="hidden"]):checked'))
                                  .map(checkbox => checkbox.value);

        const normalizedSearchTerm = normalizeString(searchTerm);
        const visibilityFilters = {
            visible: tagFiltersContainer.querySelector(`input[value="${VISIBILITY_FILTERS.VISIBLE}"]`)?.checked,
            hidden: tagFiltersContainer.querySelector(`input[value="${VISIBILITY_FILTERS.HIDDEN}"]`)?.checked
        };

        // Remove o indicador de carregamento se ele ainda existir
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        const filteredItems = allItems.filter(dataItem => {
            // 1. Verifica o filtro de texto
            const textMatch = !normalizedSearchTerm ||
                (normalizeString(dataItem.titulo || '').includes(normalizedSearchTerm) ||
                (normalizeString(dataItem.conteudo || '').includes(normalizedSearchTerm)) ||
                (normalizeString(dataItem.descricao || '').includes(normalizedSearchTerm)) ||
                (dataItem.tags.some(tag => normalizeString(tag).includes(normalizedSearchTerm))));

            // 2. Verifica o filtro de tags (checkboxes)
            // O item deve ter TODAS as tags selecionadas
            const tagMatch = selectedTags.length === 0 ||
                selectedTags.every(selectedTag =>
                    dataItem.tags.some(itemTag => normalizeString(itemTag) === selectedTag)
                );

            // 3. Verifica o filtro de visibilidade (apenas para o narrador)
            let visibilityMatch = true;
            if (auth.isNarrator() && (visibilityFilters.visible || visibilityFilters.hidden)) {
                // Se ambos ou nenhum estiveram marcados, não filtra por visibilidade
                if (visibilityFilters.visible && !visibilityFilters.hidden) {
                    visibilityMatch = dataItem.isVisibleToPlayers !== false;
                } else if (!visibilityFilters.visible && visibilityFilters.hidden) {
                    visibilityMatch = dataItem.isVisibleToPlayers === false;
                }
            }

            return textMatch && tagMatch && visibilityMatch;
        });

        // Delega a renderização para os módulos de visualização ativos
        if (viewWrapper.classList.contains('view-grid')) {
            grid.setItems(filteredItems);
        }
        if (viewWrapper.classList.contains('view-board')) {
            board.setItems(filteredItems);
        }
    }

    /**
     * Mostra ou esconde o botão de limpar filtros com base no estado atual.
     */
    function updateClearButtonVisibility() {
        const isSearchActive = searchInput.value.trim() !== '';
        const areFiltersActive = tagFiltersContainer.querySelector('input:checked') !== null;
        if (clearFiltersBtn) {
            clearFiltersBtn.classList.toggle('is-hidden', !isSearchActive && !areFiltersActive);
        }
    }

    function updateActiveFiltersDisplay() {
        activeFiltersContainer.innerHTML = '';
        const checkedFilters = tagFiltersContainer.querySelectorAll('input:checked');

        checkedFilters.forEach(checkbox => {
            const tagPill = document.createElement('div');
            tagPill.className = 'tags has-addons';
            tagPill.innerHTML = `
                <span class="tag is-link">${checkbox.nextElementSibling.textContent}</span>
                <a class="tag is-delete" data-value="${checkbox.value}"></a>
            `;
            activeFiltersContainer.appendChild(tagPill);
        });
    }

    // Listeners para os filtros
    searchInput.addEventListener('input', () => {
        applyFilters();
        updateClearButtonVisibility();
    });
    boardSearchInput.addEventListener('input', () => {
        applyFilters();
    });

    tagFiltersContainer.addEventListener('change', (event) => {
        // Garante que o evento veio de um checkbox
        if (event.target.type === 'checkbox') {
            const clickedCheckbox = event.target;
            const clickedValue = clickedCheckbox.value;

            // Lógica para os filtros de visibilidade se comportarem como radio buttons
            if (auth.isNarrator() && (clickedValue === VISIBILITY_FILTERS.VISIBLE || clickedValue === VISIBILITY_FILTERS.HIDDEN)) {
                if (clickedCheckbox.checked) {
                    const otherValue = clickedValue === VISIBILITY_FILTERS.VISIBLE ? VISIBILITY_FILTERS.HIDDEN : VISIBILITY_FILTERS.VISIBLE;
                    const otherCheckbox = tagFiltersContainer.querySelector(`input[value="${otherValue}"]`);
                    if (otherCheckbox && otherCheckbox.checked) {
                        otherCheckbox.checked = false;
                        otherCheckbox.closest('label').classList.remove('is-active');
                    }
                }
            }

            const label = clickedCheckbox.closest('label');
            // Adiciona ou remove a classe 'is-active' no label
            label.classList.toggle('is-active', clickedCheckbox.checked);
            applyFilters();
            updateActiveFiltersDisplay();
            updateClearButtonVisibility();
        }
    });

    activeFiltersContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('is-delete')) {
            const valueToRemove = event.target.dataset.value;
            const checkbox = tagFiltersContainer.querySelector(`input[value="${valueToRemove}"]`);
            if (checkbox) {
                checkbox.checked = false;
                // Dispara o evento 'change' manualmente para atualizar tudo
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            // 1. Limpa o campo de busca
            searchInput.value = '';

            // 2. Desmarca todos os checkboxes de filtro
            const allCheckboxes = tagFiltersContainer.querySelectorAll('input[type="checkbox"]');
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
                checkbox.closest('label').classList.remove('is-active');
            });

            // 3. Atualiza a UI
            applyFilters();
            updateActiveFiltersDisplay();
            updateClearButtonVisibility();
        });
    }

    /**
     * Inicializa um campo de input para ter sugestões de tags.
     * @param {HTMLInputElement} inputElement - O campo de input de tags.
     * @param {object} options - Opções de configuração.
     * @param {boolean} [options.isMultiTag=true] - Se o input aceita múltiplas tags.
     * @param {string[]} [options.suggestions=[]] - Lista de tags recomendadas.
     */
    function initializeTagInput(inputElement, options = {}) {
        const { isMultiTag = true, suggestions = appSettings.recommendedTags || [], showRecsOnFocus = true } = options;
        // Cria o container de sugestões uma única vez e o reutiliza
        if (!tagSuggestionsContainer) {
            tagSuggestionsContainer = document.createElement('div');
            tagSuggestionsContainer.className = 'tag-suggestions';
            document.body.appendChild(tagSuggestionsContainer);
        }

        const showSuggestions = (suggestions) => {
            tagSuggestionsContainer.innerHTML = '';
            if (suggestions.length === 0) {
                hideSuggestions();
                return;
            }

            suggestions.forEach(tag => {
                const item = document.createElement('div');
                item.className = 'tag-suggestion-item';
                item.textContent = tag;
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectSuggestion(tag);
                });
                tagSuggestionsContainer.appendChild(item);
            });

            const inputRect = inputElement.getBoundingClientRect();
            tagSuggestionsContainer.style.left = `${inputRect.left + window.scrollX}px`;
            tagSuggestionsContainer.style.top = `${inputRect.bottom + window.scrollY + 2}px`;
            tagSuggestionsContainer.style.width = `${inputRect.width}px`;
            tagSuggestionsContainer.style.display = 'block';
        };

        const hideSuggestions = () => {
            if (tagSuggestionsContainer) {
                tagSuggestionsContainer.style.display = 'none';
            }
        };

        const selectSuggestion = (tag) => {
            if (isMultiTag) {
                const parts = inputElement.value.split(',').map(p => p.trim());
                parts[parts.length - 1] = tag;
                inputElement.value = parts.join(', ') + ', ';
            } else {
                inputElement.value = tag;
                // Dispara o evento 'input' manualmente para aplicar o filtro
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
            hideSuggestions();
            inputElement.focus();
        };

        inputElement.addEventListener('focus', () => {
            // Mostra as recomendações no foco se o campo estiver vazio,
            // ou se for um campo de múltiplas tags que termina em vírgula.
            const value = inputElement.value.trim();
            if (showRecsOnFocus) {
                if (value === '' || (isMultiTag && value.endsWith(','))) {
                    showSuggestions(suggestions);
                }
            }
        });

        inputElement.addEventListener('input', () => {
            let currentTyping;
            if (isMultiTag) {
                const parts = inputElement.value.split(',').map(p => p.trim());
                currentTyping = normalizeString(parts[parts.length - 1]);
            } else {
                currentTyping = normalizeString(inputElement.value);
            }

            // Se o usuário apagar o que estava digitando, mostra as recomendações novamente.
            if (!currentTyping) {
                if (showRecsOnFocus) {
                    showSuggestions(suggestions);
                } else {
                    hideSuggestions();
                }
                return;
            }

            // Se estiver digitando, faz o autocompletar com as tags existentes.
            // A adição de '|| []' e 'tag &&' torna a função mais robusta contra cards sem tags.
            const allExistingTags = [...new Set(allItems.flatMap(item => item.tags || []))];
            const autocompleteSuggestions = allExistingTags.filter(tag => tag && normalizeString(tag).includes(currentTyping));
            showSuggestions(autocompleteSuggestions);
        });

        inputElement.addEventListener('blur', () => setTimeout(hideSuggestions, 150));
    }

    // Listener para abrir o modal de adição
    addCardButton.addEventListener('click', () => {
        // Reseta o formulário para um estado limpo
        formAddCard.reset();
        grid.updateFileName(cardFileInput);

        // Garante que, para o narrador, a opção de visibilidade comece desmarcada.
        const visibilityInput = document.getElementById('card-visibility');
        if (auth.isNarrator() && visibilityInput) {
            visibilityInput.checked = false;
        }

        openModal(addCardModal);
    });

    // Manipulador para o formulário do novo modal de adição
    formAddCard.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = formAddCard.closest('.modal-card').querySelector('button[type="submit"]');
        submitButton.classList.add('is-loading');

        const file = cardFileInput.files.length > 0 ? cardFileInput.files[0] : null;
        const visibilityInput = document.getElementById('card-visibility');
        const itemData = {
            titulo: document.getElementById('card-titulo').value,
            conteudo: document.getElementById('card-conteudo').value,
            descricao: document.getElementById('card-descricao').value,
            tags: cardTagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
            // Se o narrador estiver logado, usa o valor do checkbox. Senão, o card é visível por padrão.
            isVisibleToPlayers: (auth.isNarrator() && visibilityInput) ? visibilityInput.checked : true
        };

        try {
            if (file) {
                const dimensions = await cardRenderer.getImageDimensions(file);
                itemData.width = dimensions.width;
                itemData.height = dimensions.height;
            }

            await firebaseService.addItem(itemData, file);
            
            formAddCard.reset();
            grid.updateFileName(cardFileInput); // Reutiliza a função para resetar o label do arquivo
            closeModal(addCardModal);
        } catch (error) {
            console.error("Erro ao adicionar novo card:", error);
            alert("Falha ao adicionar o novo card.");
        } finally {
            submitButton.classList.remove('is-loading');
        }
    });
    cardFileInput.addEventListener('change', () => grid.updateFileName(cardFileInput));

    // Persistência do modo de visualização no localStorage
    function setViewMode(mode) {
        localStorage.setItem('rpgboard_view_mode', mode);
    }
    function getViewMode() {
        return localStorage.getItem('rpgboard_view_mode') || 'grid';
    }

    // Troca de modo com persistência
    viewToggleButton.addEventListener('click', () => {
        const icon = viewToggleButton.querySelector('.icon i');
        if (viewWrapper.classList.contains('view-board')) {
            // Mudar para a visualização em Grade
            document.body.classList.remove('body-view-board');
            viewWrapper.classList.remove('view-board');
            viewWrapper.classList.add('view-grid');
            viewToggleButton.title = "Mudar para Visualização em Board";
            icon.className = 'fas fa-project-diagram';
            setViewMode('grid');
            grid.show()
        } else {
            // Mudar para a visualização em Board
            document.body.classList.add('body-view-board');
            viewWrapper.classList.remove('view-grid');
            viewWrapper.classList.add('view-board');
            viewToggleButton.title = "Mudar para Visualização em Grade";
            icon.className = 'fas fa-th';
            setViewMode('board');
            grid.hide();
            setupBoardZoomAndPan();
        }
    });

    // Ao carregar, restaura o modo salvo
    setTimeout(() => {
        const mode = getViewMode();
        if (mode === 'board') {
            document.body.classList.add('body-view-board');
            viewWrapper.classList.remove('view-grid');
            viewWrapper.classList.add('view-board');
            viewToggleButton.title = "Mudar para Visualização em Grade";
            viewToggleButton.querySelector('.icon i').className = 'fas fa-th';
            grid.hide();
            setupBoardZoomAndPan();
        } else {
            document.body.classList.remove('body-view-board');
            viewWrapper.classList.remove('view-board');
            viewWrapper.classList.add('view-grid');
            viewToggleButton.title = "Mudar para Visualização em Board";
            viewToggleButton.querySelector('.icon i').className = 'fas fa-project-diagram';
            grid.show();
        }
    }, 0);

    // 5. Funções de callback para a UI
    function showDetailModal(item) {
        if (!item || !detailModal) return;
    
        const modalContent = detailModal.querySelector('.modal-content');
        modalContent.innerHTML = ''; // Clear previous content
    
        const box = document.createElement('div');
        box.className = 'box';
        box.dataset.itemId = item.id; 
    
        let imageHTML = '';
        let textHTML = '';
    
        // 1. Monta o conteúdo de texto
        textHTML += `<h2 class="title is-3">${item.titulo}</h2>`;
    
        if (item.conteudo) {
            const parsed = shortcodeParser.parseAllShortcodes(item);
            // Combina todos os shortcodes em um único bloco para o modal.
            const allShortcodes = (parsed.left || '') + (parsed.right || '') + (parsed.bottom || '') + (parsed.details || '');
            if (allShortcodes) {
                textHTML += `<div class="content modal-shortcodes">${allShortcodes}</div>`;
            }
        }
    
        if (item.descricao) {
            textHTML += `<hr><div class="content is-small"><strong>Descrição:</strong><br>${item.descricao.replace(/\n/g, '<br>')}</div>`;
        }
    
        // 2. Lida com a imagem e define a classe de layout
        if (item.url) {
            imageHTML = `<div class="modal-image-container"><img src="${item.url}" alt="${item.titulo}"></div>`;
            const isVertical = item.height > item.width;
            box.classList.add(isVertical ? 'is-layout-vertical' : 'is-layout-horizontal');
        } else {
            box.classList.add('is-layout-horizontal'); // Layout de coluna única se não houver imagem
        }
    
        // 3. Monta o HTML final
        box.innerHTML = `${imageHTML}<div class="modal-text-container">${textHTML}</div>`;
    
        modalContent.appendChild(box);
        openModal(detailModal);
    }

    /**
     * Lida com a exclusão de um item, atualizando a UI otimisticamente.
     * @param {object} item - O objeto do item a ser deletado.
     */
    function handleDeleteItem(item) {
        // Abordagem Reativa: Apenas envia o comando de exclusão para o Firebase.
        // O listener 'listenToItems' detectará a mudança 'removed' e atualizará a UI
        // de forma consistente, garantindo que a UI sempre reflita o estado do banco de dados.
        firebaseService.deleteItem(item).catch(err => {
            console.error("Falha ao deletar item no backend:", err);
            alert("Ocorreu um erro ao deletar o item.");
        });
    }

    // Inicializa os campos de tag com a funcionalidade de sugestão
    initializeTagInput(cardTagsInput, { suggestions: appSettings.recommendedTags || [] });
    initializeTagInput(searchInput, { isMultiTag: false, showRecsOnFocus: false });

    /**
     * Creates a temporary visual feedback element near the cursor.
     * @param {MouseEvent} event - The click event.
     * @param {string} text - The text to display.
     */
    function createClickFeedback(event, text = 'Copiado!') {
        const feedbackEl = document.createElement('div');
        feedbackEl.textContent = text;
        feedbackEl.className = 'click-feedback';
        document.body.appendChild(feedbackEl);

        // Position near the cursor
        feedbackEl.style.left = `${event.pageX + 15}px`;
        feedbackEl.style.top = `${event.pageY}px`;

        // Animate out and remove
        setTimeout(() => {
            feedbackEl.style.opacity = '0';
            setTimeout(() => {
                feedbackEl.remove();
            }, 500);
        }, 700);
    }

    // Listener global para copiar conteúdo de tags <code> dentro de modais
    document.body.addEventListener('click', async (event) => {
        if (event.target.closest('.modal-card-body')) {
            const codeBlock = event.target.closest('pre > code');
            if (codeBlock) {
                await navigator.clipboard.writeText(codeBlock.textContent);
                createClickFeedback(event);
            }
        }
    });

    function setupBoardZoomAndPan() {
        const boardContainer = document.getElementById('board-view-container');
        if (!boardContainer) return;

        // Avoid duplicate wrappers
        if (boardContainer.querySelector('.board-zoom-wrapper')) return;

        // Wrap all board content
        const zoomWrapper = document.createElement('div');
        zoomWrapper.className = 'board-zoom-wrapper';
        const panWrapper = document.createElement('div');
        panWrapper.className = 'board-pan-wrapper';

        // Move all children into panWrapper
        while (boardContainer.firstChild) {
            panWrapper.appendChild(boardContainer.firstChild);
        }
        zoomWrapper.appendChild(panWrapper);
        boardContainer.appendChild(zoomWrapper);

        // State
        let scale = 1;
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let startX, startY;

        // Zoom controls
        function applyTransform() {
            zoomWrapper.style.transform = `scale(${scale}) translate(${panX/scale}px, ${panY/scale}px)`;
        }
        function zoomIn() {
            scale = Math.min(scale + 0.1, 2);
            applyTransform();
        }
        function zoomOut() {
            scale = Math.max(scale - 0.1, 0.5);
            applyTransform();
        }
        // Add zoom buttons if not present
        if (!document.getElementById('board-zoom-in')) {
            const zoomInBtn = document.createElement('button');
            zoomInBtn.id = 'board-zoom-in';
            zoomInBtn.textContent = '+';
            zoomInBtn.style.position = 'absolute';
            zoomInBtn.style.top = '10px';
            zoomInBtn.style.right = '60px';
            zoomInBtn.style.zIndex = '20';
            zoomInBtn.className = 'button is-link';
            zoomInBtn.onclick = zoomIn;
            boardContainer.appendChild(zoomInBtn);
        }
        if (!document.getElementById('board-zoom-out')) {
            const zoomOutBtn = document.createElement('button');
            zoomOutBtn.id = 'board-zoom-out';
            zoomOutBtn.textContent = '-';
            zoomOutBtn.style.position = 'absolute';
            zoomOutBtn.style.top = '10px';
            zoomOutBtn.style.right = '10px';
            zoomOutBtn.style.zIndex = '20';
            zoomOutBtn.className = 'button is-link';
            zoomOutBtn.onclick = zoomOut;
            boardContainer.appendChild(zoomOutBtn);
        }
        // Mouse/touch drag
        panWrapper.addEventListener('mousedown', (e) => {
            isPanning = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
            panWrapper.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            panX = e.clientX - startX;
            panY = e.clientY - startY;
            applyTransform();
        });
        document.addEventListener('mouseup', () => {
            isPanning = false;
            panWrapper.style.cursor = 'grab';
        });
        // Touch drag
        panWrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            isPanning = true;
            startX = e.touches[0].clientX - panX;
            startY = e.touches[0].clientY - panY;
        });
        document.addEventListener('touchmove', (e) => {
            if (!isPanning || e.touches.length !== 1) return;
            panX = e.touches[0].clientX - startX;
            panY = e.touches[0].clientY - startY;
            applyTransform();
        });
        document.addEventListener('touchend', () => {
            isPanning = false;
        });
        // WASD keys
        document.addEventListener('keydown', (e) => {
            const step = 40;
            if (document.body.classList.contains('body-view-board')) {
                if (e.key === 'w') panY -= step;
                if (e.key === 's') panY += step;
                if (e.key === 'a') panX -= step;
                if (e.key === 'd') panX += step;
                applyTransform();
            }
        });
        // Initial transform
        applyTransform();
    }

    console.log('Verificando instâncias do Firebase:', window.firebaseInstances);
    if (!window.firebaseInstances || !window.firebaseInstances.db || !window.firebaseInstances.storage) {
        console.error('As instâncias do Firebase não estão configuradas corretamente. Verifique a configuração do Firebase.');
    }
});