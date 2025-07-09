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

let muuriGrid = null; // Variável para a instância do Muuri
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

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obter referências aos elementos principais
    const viewToggleButton = document.getElementById('fab-toggle-view');
    const addCardButton = document.getElementById('fab-add-card');
    const fabHelp = document.getElementById('fab-help');
    const fabBulkEdit = document.getElementById('fab-bulk-edit');
    const searchInput = document.getElementById('search-input');
    const activeFiltersContainer = document.getElementById('active-filters-container');
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

    // Carrega e aplica as configurações do site
    try {
        appSettings = await firebaseService.getSettings();
        if (topBarTitle) topBarTitle.textContent = appSettings.siteTitle;
        document.title = `${appSettings.siteTitle} - GameBoard`;
        generateTagFilters(appSettings.filters, tagFiltersContainer);
    } catch (error) {
        console.error("Falha ao carregar as configurações do site:", error);
        // A aplicação continuará com os valores de fallback definidos em getSettings()
    }

    function initializeGrid() {
        // Garante que só execute na visualização em grade
        if (!viewWrapper.classList.contains('view-grid')) return;

        // Destrói a instância antiga se existir, para evitar conflitos
        if (muuriGrid) {
            muuriGrid.destroy();
            muuriGrid = null;
        }

        // Cria a nova instância do Muuri
        muuriGrid = new Muuri(gridViewContainer, {
            items: '.card',
            dragEnabled: true,
            dragStartPredicate: function (item, event) {
                const cardElement = item.getElement();
                const clickTarget = event.target;

                // Impede o arraste quando em modo de edição em massa
                if (bulkEdit.isBulkEditingActive()) {
                    return false;
                }

                // 1. Não arrastar se o card estiver em modo de edição.
                if (cardElement.classList.contains('editing')) {
                    return false;
                }

                // 2. Não arrastar se a visualização de detalhes estiver ativa.
                if (cardElement.classList.contains('is-details-visible')) {
                    return false;
                }

                // 3. Não arrastar se o clique for em qualquer um dos nossos componentes interativos.
                if (clickTarget.closest('.shortcode-hp') || clickTarget.closest('.shortcode-count') || clickTarget.closest('.shortcode-stat') || clickTarget.closest('.toggle-view-icon')) {
                    return false;
                }

                // 4. Para todo o resto (cliques na imagem vazia, no título, etc.),
                // usa o comportamento padrão do Muuri, que já impede o arraste
                // a partir de inputs e botões padrão, mas não dos nossos
                // componentes customizados.
                return Muuri.ItemDrag.defaultStartPredicate(item, event);
            }
        });

        // Registra o evento de 'dragEnd' para salvar a nova ordem.
        muuriGrid.on('dragEnd', function (item) {
            const orderedItems = muuriGrid.getItems();
            const orderedIds = orderedItems.map(item => item.getElement().dataset.id);

            // Chama a função do Firebase para salvar a nova ordem de forma persistente
            firebaseService.updateItemsOrder(orderedIds).catch(err => {
                console.error("Falha ao reordenar:", err);
                alert("Não foi possível salvar a nova ordem. A grade será restaurada.");
            });
        });
    }

    // Inicializa a grade do Muuri uma única vez.
    // A função será chamada novamente apenas se a visualização for trocada.
    initializeGrid();

    // 2. Inicializar os módulos
    // Passa o detailModal para que possa ser fechado globalmente
    
    // Define a visualização padrão
    viewWrapper.classList.add('view-grid');

    // Inicializa o módulo de autenticação
    auth.initializeAuth();
    // Inicializa o módulo de edição em massa
    bulkEdit.initializeBulkEdit();
    // Inicializa o módulo de configurações
    settings.initializeSettings();

    // Verifica o status do narrador no carregamento da página e atualiza a UI
    narrator.updateNarratorUI(auth.isNarrator());

    // Ouve por mudanças no status do narrador para atualizar a UI
    window.addEventListener('narratorStatusChange', () => {
        const isNarrator = auth.isNarrator();
        narrator.updateNarratorUI(isNarrator);
        // Se o usuário fizer logout, sai do modo de edição em massa
        if (!isNarrator) {
            bulkEdit.exitBulkEditMode();
        }

        // Força uma reavaliação dos filtros e da renderização quando o status muda
        if (isInitialGridLoaded) {
            let itemsToRender = [...allItems];
            if (!isNarrator) {
                itemsToRender = itemsToRender.filter(item => item.isVisibleToPlayers !== false);
            }
            grid.updateItems(itemsToRender);
            initializeGrid(); // Re-inicializa o Muuri sobre os novos elementos
        }
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
                        // Se estivermos na grade, recalcula o layout
                        if (container.id === 'grid-view-container') {
                            muuriGrid?.layout(true);
                        }
                    });

                    card._newImageFile = file;
                }
            });
        }
    }

    async function handleSaveCard(card, item, container) {
        const saveButton = card.querySelector('.save-btn');
        saveButton.classList.add('is-loading');

        const updatedData = cardRenderer.getCardFormData(card);
        const newImageFile = card._newImageFile || null;

        // Compara os dados antigos com os novos para ver se houve alteração
        const originalTags = (item.tags || []).sort();
        const updatedTags = (updatedData.tags || []).sort();
        const tagsChanged = JSON.stringify(originalTags) !== JSON.stringify(updatedTags);

        const hasTextChanged =
            (item.titulo || '') !== updatedData.titulo ||
            (item.conteudo || '') !== updatedData.conteudo ||
            (item.descricao || '') !== updatedData.descricao ||
            tagsChanged ||
            (item.isVisibleToPlayers !== false) !== updatedData.isVisibleToPlayers;

        const hasChanges = hasTextChanged || newImageFile;

        if (hasChanges) {
            // Se houver mudanças, salva no Firebase
            if (newImageFile) {
                const dimensions = await cardRenderer.getImageDimensions(newImageFile);
                updatedData.width = dimensions.width;
                updatedData.height = dimensions.height;
            }

            try {
                await firebaseService.updateItem(item, updatedData, newImageFile);
                // O listener do Firebase cuidará de atualizar a UI.
                // Apenas removemos a classe do container e limpamos o arquivo temporário.
                container.classList.remove('is-editing-item');
                if (card._newImageFile) delete card._newImageFile;
            } catch (error) {
                console.error("Falha ao salvar as alterações:", error);
                alert("Falha ao salvar as alterações.");
                saveButton.classList.remove('is-loading'); // Reabilita o botão em caso de erro
            }
        } else {
            // Se não houver mudanças, apenas sai do modo de edição
            container.classList.remove('is-editing-item');
            cardRenderer.renderCardViewMode(card, item); // Reverte para o modo de visualização
            if (card._newImageFile) delete card._newImageFile;
            if (container.id === 'grid-view-container') muuriGrid?.layout(true);
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
            newShortcode = decodedShortcode.replace(/current=(\d+)/, `current=${newCurrentValue}`);
        } else {
            newShortcode = decodedShortcode.replace(/\]$/, ` current=${newCurrentValue}]`);
        }

        const newContent = item.conteudo.replace(decodedShortcode, newShortcode);

        try {
            await firebaseService.updateItem(item, { conteudo: newContent });
        } catch (error) {
            console.error("Falha ao atualizar shortcode:", error);
            alert("Falha ao salvar a alteração.");
        }
    }

    // Objeto unificado de handlers para os cards
    const cardActionHandlers = {
        onDelete: handleDeleteItem,
        onEdit: handleEditCard,
        onSave: handleSaveCard,
        onView: showDetailModal,
        onTagInputInit: (inputElement) => initializeTagInput(inputElement, { suggestions: appSettings.recommendedTags || [] }),
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

        // Prioridade 1: Alterações nos contadores.
        const countTrigger = target.closest('.count-btn, .count-checkbox');
        if (countTrigger) {
            // A CHAVE: Impede que o clique "vaze" para outros listeners.
            // Isso resolve o bug do tooltip fechando sozinho.
            event.stopPropagation();

            const countComponent = countTrigger.closest('.shortcode-count');
            if (!countComponent) return;

            const { itemId, shortcode } = countComponent.dataset;
            if (itemId && shortcode) {
                const decodedShortcode = decodeURIComponent(shortcode);
                const maxMatch = decodedShortcode.match(/max=(\d+)/);
                const currentMatch = decodedShortcode.match(/current=(\d+)/);
                const max = maxMatch ? parseInt(maxMatch[1], 10) : 0;
                let current = currentMatch ? parseInt(currentMatch[1], 10) : max;
                let newCurrent;

                if (countTrigger.classList.contains('count-btn')) {
                    const action = countTrigger.dataset.action;
                    newCurrent = action === 'increment' ? current + 1 : current - 1;
                } else { // .count-checkbox
                    newCurrent = parseInt(countTrigger.dataset.value, 10);
                    if (newCurrent === current) newCurrent = 0;
                }

                const clampedValue = Math.max(0, Math.min(newCurrent, max));
                handleShortcodeValueChange(itemId, shortcode, clampedValue, countTrigger);
            }
            return; // Encerra após tratar o clique no contador.
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

    // 3. Conectar o backend (Firebase) com o frontend (UI)
    firebaseService.listenToItems((snapshot) => {
        // Se for o primeiro carregamento de dados, renderiza tudo de uma vez.
        if (!isInitialGridLoaded) {
            let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filtra os itens para não-narradores já no carregamento inicial
            if (!auth.isNarrator()) {
                items = items.filter(item => item.isVisibleToPlayers !== false);
            }
            allItems = items;

            allItems.sort((a, b) => (a.order || 0) - (b.order || 0));

            // Renderiza a grade e o board com os itens iniciais
            grid.updateItems(allItems);
            board.renderBoardItems(allItems);
            initializeGrid(); // Inicializa o Muuri sobre os elementos recém-criados

            isInitialGridLoaded = true; // Marca que o carregamento inicial foi concluído
            return;
        }

        // Para todas as atualizações subsequentes, processa apenas as mudanças (deltas).
        let orderChanged = false;
        snapshot.docChanges().forEach((change) => {
            const itemData = { id: change.doc.id, ...change.doc.data() };
            const isVisibleForPlayers = itemData.isVisibleToPlayers !== false;
            const indexInCache = allItems.findIndex(i => i.id === itemData.id);
            const isInCache = indexInCache > -1;

            switch (change.type) {
                case "added": {
                    if (auth.isNarrator() || isVisibleForPlayers) {
                        allItems.push(itemData);
                        if (muuriGrid) {
                            const newCardElement = cardRenderer.createCardElement(itemData);
                            muuriGrid.add(newCardElement, { index: change.newIndex });
                        }
                    }
                    break;
                }
                case "modified": {
                    const existingCardElement = gridViewContainer.querySelector(`.card[data-id="${itemData.id}"]`);
                    if (auth.isNarrator()) {
                        // Narrador sempre vê a modificação
                        if (isInCache) {
                            if (allItems[indexInCache].order !== itemData.order) orderChanged = true;
                            allItems[indexInCache] = itemData;
                        } else {
                            allItems.push(itemData);
                            orderChanged = true;
                        }
                        if (existingCardElement) cardRenderer.renderCardViewMode(existingCardElement, itemData);

                    } else { // Lógica para o jogador
                        if (isVisibleForPlayers && !isInCache) {
                            // Um card oculto se tornou visível: Adiciona à UI
                            allItems.push(itemData);
                            if (muuriGrid) muuriGrid.add(cardRenderer.createCardElement(itemData));
                            orderChanged = true;
                        } else if (!isVisibleForPlayers && isInCache) {
                            // Um card visível se tornou oculto: Remove da UI
                            allItems.splice(indexInCache, 1);
                            if (muuriGrid && existingCardElement) muuriGrid.remove([existingCardElement], { removeElements: true });
                        } else if (isVisibleForPlayers && isInCache) {
                            // Modificação padrão de um card visível
                            if (allItems[indexInCache].order !== itemData.order) orderChanged = true;
                            allItems[indexInCache] = itemData;
                            if (existingCardElement) cardRenderer.renderCardViewMode(existingCardElement, itemData);
                        }

                        // Adicionalmente, verifica se o modal de detalhes está aberto e mostrando este item
                        if (detailModal.classList.contains('is-active')) {
                            const modalBox = detailModal.querySelector('.box');
                            // Se o modal estiver mostrando o item modificado, re-renderiza o conteúdo do modal
                            if (modalBox && modalBox.dataset.itemId === itemData.id) {
                                showDetailModal(itemData);
                            }
                        }
                    }
                    break;
                }
                case "removed": {
                    // Encontra o item do Muuri correspondente ao ID do card deletado.
                    const muuriItem = muuriGrid?.getItems().find(item => item.getElement().dataset.id === itemData.id);
                    if (muuriItem) {
                        // Usa o método do Muuri para remover o item da grade de forma segura.
                        muuriGrid.remove([muuriItem], { removeElements: true });
                    }
                    allItems = allItems.filter(i => i.id !== itemData.id);
                    break;
                }
            }
        });

        // Após processar as mudanças, atualiza a ordem e o board
        allItems.sort((a, b) => (a.order || 0) - (b.order || 0));
        if (orderChanged && muuriGrid) {
            const orderedItems = allItems.map(data => muuriGrid.getItems().find(item => item.getElement().dataset.id === data.id)).filter(Boolean);
            if (orderedItems.length > 0) muuriGrid.sort(orderedItems, { layout: 'instant' });
        }
        board.renderBoardItems(allItems);
    });

    // Função unificada para aplicar todos os filtros (busca e tags)
    function applyFilters() {
        if (!muuriGrid) return;

        const normalizedSearchTerm = normalizeString(searchInput.value.trim());
        const selectedTags = Array.from(tagFiltersContainer.querySelectorAll('input:not([value="visible"]):not([value="hidden"]):checked'))
                                  .map(checkbox => normalizeString(checkbox.value));

        // Lógica para os filtros de visibilidade do narrador
        const visibilityFilters = {
            visible: tagFiltersContainer.querySelector(`input[value="${VISIBILITY_FILTERS.VISIBLE}"]`)?.checked,
            hidden: tagFiltersContainer.querySelector(`input[value="${VISIBILITY_FILTERS.HIDDEN}"]`)?.checked
        };

        muuriGrid.filter(item => {
            const element = item.getElement();
            const id = element.dataset.id;
            const dataItem = allItems.find(i => i.id === id);

            if (!dataItem) return false;

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
                // Se ambos ou nenhum estiverem marcados, não filtra por visibilidade
                if (visibilityFilters.visible && !visibilityFilters.hidden) {
                    visibilityMatch = dataItem.isVisibleToPlayers !== false;
                } else if (!visibilityFilters.visible && visibilityFilters.hidden) {
                    visibilityMatch = dataItem.isVisibleToPlayers === false;
                }
            }

            return textMatch && tagMatch && visibilityMatch;
        });
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
    searchInput.addEventListener('input', applyFilters);
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

    // Lógica para trocar o modo de visualização
    viewToggleButton.addEventListener('click', () => {
        const icon = viewToggleButton.querySelector('.icon i');

        if (viewWrapper.classList.contains('view-board')) {
            // Mudar para a visualização em Grade
            viewWrapper.classList.remove('view-board');
            viewWrapper.classList.add('view-grid');
            viewToggleButton.title = "Mudar para Visualização em Board";
            icon.className = 'fas fa-project-diagram';
            // Inicializa a grade ao voltar para esta visualização
            initializeGrid();
        } else {
            // Mudar para a visualização em Board
            viewWrapper.classList.remove('view-grid');
            viewWrapper.classList.add('view-board');
            viewToggleButton.title = "Mudar para Visualização em Grade";
            icon.className = 'fas fa-th';
            // Destrói a instância da grade para liberar recursos
            if (muuriGrid) {
                muuriGrid.destroy();
                muuriGrid = null;
            }
        }
    });

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
});