import { initializeModals, openModal, closeModal } from './modules/modal.js';
import * as auth from './modules/auth.js';
import * as firebaseService from './modules/firebaseService.js';
import * as narrator from './modules/narrator.js';
import * as bulkEdit from './modules/bulkEdit.js';
import * as settings from './modules/settings.js';
import * as grid from './modules/grid.js';
import * as cardRenderer from './modules/cardRenderer.js';
import * as shortcodeParser from './modules/shortcodeParser.js';
import { visualizeDiceRoll } from './modules/dice3d.js';
import * as chat from './modules/chat.js';
import * as cardManager from './modules/cardManager.js';
import { processRoll } from './modules/diceLogic.js';
import { initializeLayout } from './modules/layout.js';

let allItems = [];
let isInitialGridLoaded = false;
let appSettings = {};
let tagSuggestionsContainer = null;

const VISIBILITY_FILTERS = { VISIBLE: 'visible', HIDDEN: 'hidden' };

// --- Funções Utilitárias ---

async function fetchRandomFantasyName() {
    try {
        const response = await fetch('https://gist.githubusercontent.com/tkfu/9819e4ac6d529e225e9fc58b358c3479/raw/srd_5e_monsters.json');
        if (!response.ok) throw new Error('Falha');
        const data = await response.json();
        return data[Math.floor(Math.random() * data.length)].name;
    } catch (e) {
        return "Viajante Desconhecido";
    }
}

function normalizeString(str) {
    if (!str) return '';
    return str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

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
        container.insertBefore(controlDiv, firstNarratorFilter);
    });
}

function injectDragDropStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .card.muuri-item-draggable { cursor: grab; }
        .card.muuri-item-dragging { cursor: grabbing; }
        .card.muuri-item-draggable .card-content,
        .card.muuri-item-draggable .card-image,
        .card.muuri-item-draggable .card-actions-top,
        .card.muuri-item-draggable .card-info-layer { cursor: auto; }
    `;
    document.head.appendChild(style);
}

async function updateUserState(userName) {
    const loginBtn = document.getElementById('user-login-btn');
    const userNameSpan = document.getElementById('user-name');
    const userNameInput = document.getElementById('user-name-input');

    if (userName) {
        localStorage.setItem('rpgboard_user_name', userName);
        if(loginBtn) loginBtn.style.display = 'none';
        if(userNameSpan) {
            userNameSpan.textContent = userName;
            userNameSpan.style.display = 'inline-block';
        }
        if (userNameInput) userNameInput.value = userName;

        try {
            await firebaseService.saveUser(userName);
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
        }
    } else {
        localStorage.removeItem('rpgboard_user_name');
        if(loginBtn) loginBtn.style.display = 'inline-flex';
        if(userNameSpan) userNameSpan.style.display = 'none';
    }
}

// --- Listeners de Ações de Card ---

function handleDeleteItem(item) {
    firebaseService.deleteItem(item).then(() => {
        try {
            const u = localStorage.getItem('rpgboard_user_name') || 'Visitante';
            chat.logSystemMessage(`${u} deletou o card "${item.titulo || item.id}"`);
        } catch (e) {}
    }).catch(err => { console.error(err); alert("Erro ao deletar."); });
}

async function handlePositionChange(itemId, position) {
    await firebaseService.updateItem({ id: itemId }, { boardPosition: position });
}

async function handleReorder(orderedIds) {
    try {
        await firebaseService.updateItemsOrder(orderedIds);
    } catch (error) {
        console.error("Failed to update card order:", error);
    }
}

// INICIALIZAÇÃO PRINCIPAL
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. PRIMEIRO: Construir o Layout (Menu, FAB, Chat, Modais)
    await initializeLayout({
        fabActions: ['settings', 'bulk-edit', 'converter', 'help', 'chat', 'dice', 'add-card']
    });

    // 2. SEGUNDO: Inicializar o Chat agora que o container existe
    chat.initializeChat();
    
    // 3. TERCEIRO: Referências aos Elementos (DEPOIS do layout pronto)
    const addCardButton = document.getElementById('fab-add-card');
    const fabHelp = document.getElementById('fab-help');
    const fabBulkEdit = document.getElementById('fab-bulk-edit');
    const searchInput = document.getElementById('search-input');
    const activeFiltersContainer = document.getElementById('active-filters-container');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const tagFiltersContainer = document.getElementById('tag-filters');
    const viewWrapper = document.getElementById('view-wrapper');
    const topBarTitle = document.querySelector('.top-bar-title');
    const detailModal = document.getElementById('detail-modal');
    const addCardModal = document.getElementById('add-card-modal');
    const helpModal = document.getElementById('help-modal');
    const formAddCard = document.getElementById('form-add-card');
    const cardFileInput = document.getElementById('card-arquivo');
    const cardTagsInput = document.getElementById('card-tags');
    const gridViewContainer = document.getElementById('grid-view-container');
    const userLoginBtn = document.getElementById('user-login-btn');
    const userLoginModal = document.getElementById('user-login-modal');
    const formUserLogin = document.getElementById('form-user-login');
    const userNameInput = document.getElementById('user-name-input');
    const diceFabWrapper = document.getElementById('dice-fab-wrapper');
    const diceMainBtn = document.getElementById('dice-main-btn');
    const diceQuickBtns = document.querySelectorAll('.dice-quick-btn');
    const toggleChatBtn = document.getElementById('toggle-chat-btn');

    // 4. Inicializar Autenticação (Precisa dos modais gerados pelo layout)
    await auth.initializeAuth();
    bulkEdit.initializeBulkEdit();
    settings.initializeSettings();
    initializeModals();

    // 5. Configurar Estado do Usuário
    let savedUserName = localStorage.getItem('rpgboard_user_name');
    if (!savedUserName) {
        savedUserName = await fetchRandomFantasyName();
        localStorage.setItem('rpgboard_user_name', savedUserName);
    }
    updateUserState(savedUserName);

    // --- Listeners de UI ---

    if(userLoginBtn) userLoginBtn.addEventListener('click', () => openModal(userLoginModal));
    if(formUserLogin) formUserLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const userName = userNameInput.value.trim();
        if (userName) {
            updateUserState(userName);
            closeModal(userLoginModal);
            userNameInput.value = '';
        }
    });

    if (diceQuickBtns) {
        diceQuickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const diceType = btn.dataset.dice;
                if (!diceType) return;
                const userName = localStorage.getItem('rpgboard_user_name') || 'Visitante';
                const command = `/r 1${diceType}`;
                firebaseService.addChatMessage(command, 'user', userName);
                processRoll(command, null, userName, null);
                if (diceFabWrapper) diceFabWrapper.classList.remove('is-active');
            });
        });
    }

    if (diceMainBtn && diceFabWrapper) {
        diceMainBtn.addEventListener('click', () => diceFabWrapper.classList.toggle('is-active'));
    }

    if (toggleChatBtn) {
        toggleChatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chat.toggleChat();
        });
    }

    injectDragDropStyles();

    // 6. Carregar Configurações e Inicializar Grid
    try {
        appSettings = await firebaseService.getSettings();
        window.appSettings = appSettings;
        if (appSettings.siteTitle) {
            document.title = `${appSettings.siteTitle} - GameBoard`;
        }
        // Re-renderizar header para garantir título correto
        if (typeof import('./modules/components/header.js').then === 'function') {
            import('./modules/components/header.js').then(mod => mod.renderHeader && mod.renderHeader());
        }
        cardRenderer.initializeCardRenderer(appSettings);
        generateTagFilters(appSettings.filters, tagFiltersContainer);
    } catch (error) {
        console.error("Falha ao carregar as configurações do site:", error);
    }

    const cardActionHandlers = {
        onDelete: handleDeleteItem,
        onEdit: handleEditCard,
        onSave: handleSaveCard,
        onView: showDetailModal,
        onTagInputInit: (inputElement) => initializeTagInput(inputElement, { suggestions: appSettings.recommendedTags || [] }),
        onPositionChange: handlePositionChange,
        onReorder: handleReorder
    };

    await cardManager.initialize(cardActionHandlers);
    grid.initializeGrid(cardActionHandlers);
    viewWrapper.classList.add('view-grid');
    grid.show();

    // 7. Sincronização do Modo Narrador
    function updateMasterView(isNarrator) {
        narrator.updateNarratorUI(isNarrator);
        document.body.classList.toggle('master-view', isNarrator);
    }
    updateMasterView(auth.isNarrator());

    window.addEventListener('narratorStatusChange', () => {
        const isNarrator = auth.isNarrator();
        updateMasterView(isNarrator);
        if (!isNarrator) bulkEdit.exitBulkEditMode();
        applyFilters();
    });

    // 8. Handlers para Editar/Salvar/Detalhes (Lógica Completa)
    function handleEditCard(card, item, container) {
        container.classList.add('is-editing-item');
        cardRenderer.renderCardEditMode(card, item, cardActionHandlers);
        const imageInput = card.querySelector('.edit-image-input');
        if (imageInput) {
            imageInput.addEventListener('change', () => {
                if (imageInput.files && imageInput.files[0]) {
                    const file = imageInput.files[0];
                    const reader = new FileReader();
                    const figure = card.querySelector('.card-image .image');
                    const img = figure.querySelector('img');
                    card.querySelector('.card-image').classList.remove('is-placeholder');
                    reader.onload = (e) => { img.src = e.target.result; };
                    reader.readAsDataURL(file);
                    cardRenderer.getImageDimensions(file).then(dimensions => {
                        const newAspectRatio = (dimensions.height / dimensions.width) * 100;
                        figure.style.paddingBottom = `${newAspectRatio}%`;
                        grid.refreshLayout();
                    });
                    card._newImageFile = file;
                }
            });
        }
    }

    async function handleSaveCard(cardElement, item) {
        const updatedData = cardRenderer.getCardFormData(cardElement);
        const newImageFile = cardElement._newImageFile || null;
        try {
            if (newImageFile) {
                const dimensions = await cardRenderer.getImageDimensions(newImageFile);
                updatedData.width = dimensions.width; updatedData.height = dimensions.height;
            }
            await firebaseService.updateItem(item, updatedData, newImageFile);
            if (cardElement._newImageFile) delete cardElement._newImageFile;
            try {
                const userName = localStorage.getItem('rpgboard_user_name') || 'Visitante';
                chat.logSystemMessage(`${userName} atualizou o card "${updatedData.titulo || item.titulo}"`);
            } catch (e) {}
            return { ...item, ...updatedData };
        } catch (error) { console.error(error); alert("Falha ao salvar."); throw error; }
    }

    async function handleShortcodeValueChange(itemId, encodedShortcode, newCurrentValue, triggerElement = null) {
        const item = allItems.find(i => i.id === itemId);
        if (!item || !item.conteudo) return;
        if (triggerElement) {
            const componentRoot = triggerElement.closest('.shortcode-hp, .shortcode-count');
            if (componentRoot) {
                componentRoot.classList.add('is-updating');
                setTimeout(() => componentRoot.classList.remove('is-updating'), 700);
            }
        }
        const decodedShortcode = decodeURIComponent(encodedShortcode);
        let newShortcode;
        if (/current=/.test(decodedShortcode)) {
            newShortcode = decodedShortcode.replace(/current=(?:["']?)-?\d+(?:\.\d+)?(?:["']?)/, `current="${newCurrentValue}"`);
        } else {
            newShortcode = decodedShortcode.replace(/]$/, ` current="${newCurrentValue}"]`);
        }
        const newContent = item.conteudo.replace(decodedShortcode, newShortcode);
        try { await firebaseService.updateItem(item, { conteudo: newContent }); } catch (error) { console.error(error); }
    }

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
        let cleanedInput = inputElement.value.trim().replace(/\u00A0/g, ' ').replace(/\s+/g, '');
        if (cleanedInput === '') return;
        if (cleanedInput.includes('.') && cleanedInput.includes(',')) {
            cleanedInput = cleanedInput.indexOf('.') < cleanedInput.indexOf(',') ? cleanedInput.replace(/\./g, '').replace(/,/g, '.') : cleanedInput.replace(/,/g, '');
        } else if (cleanedInput.includes(',')) { cleanedInput = cleanedInput.replace(/,/g, '.'); }
        let newValue = originalValue;
        const fullExpr = cleanedInput.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*\/])\s*(-?\d+(?:\.\d+)?)$/);
        if (fullExpr) {
            const v1 = parseFloat(fullExpr[1]), op = fullExpr[2], v2 = parseFloat(fullExpr[3]);
            if (!isNaN(v1) && !isNaN(v2)) {
                if (op === '+') newValue = v1 + v2;
                else if (op === '-') newValue = v1 - v2;
                else if (op === '*') newValue = v1 * v2;
                else if (op === '/' && v2 !== 0) newValue = v1 / v2;
            }
        } else {
            const relExpr = cleanedInput.match(/^([+\-*\/])\s*(-?\d+(?:\.\d+)?)$/);
            if (relExpr) {
                const op = relExpr[1], v = parseFloat(relExpr[2]);
                if (!isNaN(v)) {
                    if (op === '+') newValue = originalValue + v;
                    else if (op === '-') newValue = originalValue - v;
                    else if (op === '*') newValue = originalValue * v;
                    else if (op === '/' && v !== 0) newValue = originalValue / v;
                }
            } else if (!isNaN(parseFloat(cleanedInput))) { newValue = parseFloat(cleanedInput); }
        }
        newValue = Math.round(newValue * 100) / 100;
        if (isNaN(newValue)) return;
        const newShortcode = decodedShortcode.replace(/current=(?:["']?)-?\d+(?:\.\d+)?(?:["']?)/, `current="${newValue}"`);
        const newContent = item.conteudo.replace(decodedShortcode, newShortcode);
        if (newContent !== item.conteudo) await firebaseService.updateItem(item, { conteudo: newContent });
    }

    // 9. Listeners Realtime Firebase
    firebaseService.listenToItems(async (snapshot) => {
        try {
            if (!isInitialGridLoaded) {
                let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (!auth.isNarrator()) items = items.filter(item => item.isVisibleToPlayers !== false);
                allItems = items;
                allItems.sort((a, b) => (a.order || 0) - (b.order || 0));
                await cardManager.loadItems(allItems);
                isInitialGridLoaded = true;
                applyFilters();
                return;
            }
        } catch (error) { console.error(error); }

        snapshot.docChanges().forEach((change) => {
            const itemData = { id: change.doc.id, ...change.doc.data() };
            const indexInCache = allItems.findIndex(i => i.id === itemData.id);
            const isNarrator = auth.isNarrator();
            if (change.type === "added") {
                if (isNarrator || itemData.isVisibleToPlayers !== false) {
                    if (indexInCache === -1) allItems.push(itemData);
                }
            } else if (change.type === "modified") {
                const visible = isNarrator || itemData.isVisibleToPlayers !== false;
                if (indexInCache > -1) {
                    if (visible) allItems[indexInCache] = itemData;
                    else allItems.splice(indexInCache, 1);
                } else if (visible) { allItems.push(itemData); }
            } else if (change.type === "removed") {
                if (indexInCache > -1) allItems.splice(indexInCache, 1);
                if (detailModal.classList.contains('is-active')) {
                    if (detailModal.querySelector('.box')?.dataset.itemId === itemData.id) closeModal(detailModal);
                }
            }
        });
        allItems.sort((a, b) => (a.order || 0) - (b.order || 0));        
        applyFilters();
    });

    firebaseService.listenToDiceRolls((change) => {
        const d = change.doc.data();
        if (d) {
            let t = (d.diceType || '').toString().toLowerCase().trim().replace(/^\d+/, '');
            visualizeDiceRoll(t, d.result, d.userName, d.label);
        }
    });

    // 10. Filtros e Pesquisa (Lógica Completa)
    function applyFilters() {
        const searchTerm = searchInput.value.trim();
        const selectedTags = Array.from(tagFiltersContainer.querySelectorAll('input:not([value="visible"]):not([value="hidden"]):checked')).map(checkbox => checkbox.value);
        const normalizedSearchTerm = normalizeString(searchTerm);
        const visibilityFilters = {
            visible: tagFiltersContainer.querySelector(`input[value="${VISIBILITY_FILTERS.VISIBLE}"]`)?.checked,
            hidden: tagFiltersContainer.querySelector(`input[value="${VISIBILITY_FILTERS.HIDDEN}"]`)?.checked
        };
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        const filteredItems = allItems.filter(dataItem => {
            const textMatch = !normalizedSearchTerm || [dataItem.titulo, dataItem.conteudo, dataItem.descricao].some(t => normalizeString(t || '').includes(normalizedSearchTerm)) || dataItem.tags.some(tag => normalizeString(tag).includes(normalizedSearchTerm));
            const tagMatch = selectedTags.length === 0 || selectedTags.every(selectedTag => dataItem.tags.some(itemTag => normalizeString(itemTag) === selectedTag));
            let visibilityMatch = true;
            if (auth.isNarrator() && (visibilityFilters.visible || visibilityFilters.hidden)) {
                if (visibilityFilters.visible && !visibilityFilters.hidden) visibilityMatch = dataItem.isVisibleToPlayers !== false;
                else if (!visibilityFilters.visible && visibilityFilters.hidden) visibilityMatch = dataItem.isVisibleToPlayers === false;
            }
            return textMatch && tagMatch && visibilityMatch;
        });
        if (viewWrapper.classList.contains('view-grid')) {
            grid.setItems(filteredItems, selectedTags);
        }
        updateClearButtonVisibility(); updateActiveFiltersDisplay();
    }

    function updateClearButtonVisibility() {
        const isSearchActive = searchInput.value.trim() !== '';
        const areFiltersActive = tagFiltersContainer.querySelector('input:checked') !== null;
        if (clearFiltersBtn) clearFiltersBtn.classList.toggle('is-hidden', !isSearchActive && !areFiltersActive);
    }

    function updateActiveFiltersDisplay() {
        activeFiltersContainer.innerHTML = '';
        const checkedFilters = tagFiltersContainer.querySelectorAll('input:checked');
        checkedFilters.forEach(checkbox => {
            const tagPill = document.createElement('div');
            tagPill.className = 'tags has-addons';
            tagPill.innerHTML = `<span class="tag is-link">${checkbox.nextElementSibling.textContent}</span><a class="tag is-delete" data-value="${checkbox.value}"></a>`;
            tagPill.querySelector('.is-delete').onclick = () => {
                checkbox.checked = false; applyFilters();
            };
            activeFiltersContainer.appendChild(tagPill);
        });
    }

    searchInput.addEventListener('input', applyFilters);
    tagFiltersContainer.addEventListener('change', applyFilters);
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            searchInput.value = '';
            tagFiltersContainer.querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = false; });
            applyFilters();
        });
    }

    // 11. Tags e Adição de Card (Lógica Completa)
    function initializeTagInput(inputElement, options = {}) {
        const { isMultiTag = true, suggestions = [], showRecsOnFocus = true } = options;
        if (!tagSuggestionsContainer) {
            tagSuggestionsContainer = document.createElement('div');
            tagSuggestionsContainer.className = 'tag-suggestions';
            document.body.appendChild(tagSuggestionsContainer);
        }
        const showSuggestions = (list) => {
            tagSuggestionsContainer.innerHTML = '';
            if (list.length === 0) { tagSuggestionsContainer.style.display = 'none'; return; }
            list.forEach(tag => {
                const item = document.createElement('div'); item.className = 'tag-suggestion-item'; item.textContent = tag;
                item.onmousedown = (e) => {
                    e.preventDefault();
                    if (isMultiTag) {
                        const parts = inputElement.value.split(',').map(p => p.trim());
                        parts[parts.length - 1] = tag;
                        inputElement.value = parts.join(', ') + ', ';
                    } else { inputElement.value = tag; }
                    tagSuggestionsContainer.style.display = 'none'; inputElement.focus();
                };
                tagSuggestionsContainer.appendChild(item);
            });
            const rect = inputElement.getBoundingClientRect();
            tagSuggestionsContainer.style.cssText = `display:block; left:${rect.left + window.scrollX}px; top:${rect.bottom + window.scrollY}px; width:${rect.width}px;`;
        };
        inputElement.onfocus = () => { if (showRecsOnFocus && inputElement.value === '') showSuggestions(suggestions); };
        inputElement.oninput = () => {
            const parts = inputElement.value.split(',');
            const curr = normalizeString(parts[parts.length - 1].trim());
            if (!curr) return showSuggestions(suggestions);
            const allTags = [...new Set(allItems.flatMap(i => i.tags || []))];
            showSuggestions(allTags.filter(t => normalizeString(t).includes(curr)));
        };
        inputElement.onblur = () => setTimeout(() => { tagSuggestionsContainer.style.display = 'none'; }, 200);
    }

    if (addCardButton) {
        addCardButton.addEventListener('click', () => {
            formAddCard.reset(); grid.updateFileName(cardFileInput);
            openModal(addCardModal);
        });
    }

    formAddCard.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formAddCard.querySelector('button[type="submit"]');
        btn.classList.add('is-loading');
        const data = {
            titulo: document.getElementById('card-titulo').value,
            conteudo: document.getElementById('card-conteudo').value,
            descricao: document.getElementById('card-descricao').value,
            tags: cardTagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
            isVisibleToPlayers: auth.isNarrator() ? document.getElementById('card-visibility').checked : true
        };
        try {
            const id = await firebaseService.addItem(data, cardFileInput.files[0]);
            closeModal(addCardModal); grid.scrollToCard(id);
        } catch (error) { console.error(error); alert("Falha ao adicionar."); }
        finally { btn.classList.remove('is-loading'); }
    });

    // 12. Modal Detalhes e Eventos Globais
    function showDetailModal(item) {
        if (!item || !detailModal) return;
        const content = detailModal.querySelector('.modal-content');
        content.innerHTML = '';
        const box = document.createElement('div');
        box.className = 'box';
        const parsed = shortcodeParser.parseAllShortcodes(item);
        const allShortcodes = (parsed.left||'')+(parsed.right||'')+(parsed.bottom||'')+(parsed.details||'');
        box.innerHTML = `
            ${item.url ? `<div class="modal-image-container"><img src="${item.url}"></div>` : ''}
            <div class="modal-text-container">
                <h2 class="title is-3">${item.titulo}</h2>
                <div class="content modal-shortcodes">${allShortcodes}</div>
                ${item.descricao ? `<hr><div class="content is-small"><strong>Descrição:</strong><br>${item.descricao.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
        `;
        content.appendChild(box); openModal(detailModal);
    }

    // Global Click para Dinheiro e Links
    document.body.addEventListener('click', (event) => {
        const target = event.target;
        const activeMoneyInput = document.querySelector('.money-value-input:not(.is-hidden)');
        if (activeMoneyInput && !activeMoneyInput.contains(target) && !target.closest('.shortcode-money')) {
            activeMoneyInput.closest('.shortcode-money').querySelector('.money-value-display').classList.remove('is-hidden');
            activeMoneyInput.classList.add('is-hidden');
        }

        const moneyComponent = target.closest('.shortcode-money');
        if (moneyComponent) {
            const display = moneyComponent.querySelector('.money-value-display');
            const input = moneyComponent.querySelector('.money-value-input');
            if (display && input) {
                display.classList.add('is-hidden'); input.classList.remove('is-hidden');
                input.focus(); input.select();
            }
        }

        const cardLink = target.closest('.card-link');
        if (cardLink) {
            event.stopPropagation();
            const foundCard = allItems.find(item => normalizeString(item.titulo) === normalizeString(cardLink.dataset.cardName));
            if (foundCard) showDetailModal(foundCard);
        }

        const countTrigger = target.closest('.count-btn, .count-checkbox');
        if (countTrigger) {
            event.stopPropagation();
            const countComponent = countTrigger.closest('.shortcode-count');
            if (!countComponent) return;
            const { itemId, shortcode } = countComponent.dataset;
            if (itemId && shortcode) {
                const decoded = decodeURIComponent(shortcode);
                const max = parseInt(decoded.match(/max=(?:["']?)(\d+)(?:["']?)/)?.[1] || 0);
                let current = parseInt(decoded.match(/current=(?:["']?)(-?\d+)(?:["']?)/)?.[1] || 0);
                let next = current;
                if (countTrigger.classList.contains('count-btn')) {
                    next = (countTrigger.dataset.action === 'increment') ? Math.min(current + 1, max) : Math.max(current - 1, 0);
                } else if (countTrigger.classList.contains('count-checkbox')) {
                    const val = parseInt(countTrigger.dataset.value, 10);
                    next = (val === current) ? 0 : val;
                }
                handleShortcodeValueChange(itemId, shortcode, next, countTrigger);
            }
        }
    });

    document.body.addEventListener('focusout', (event) => {
        if (event.target.classList.contains('money-value-input')) {
            handleMoneyChange(event.target);
            event.target.closest('.shortcode-money').querySelector('.money-value-display').classList.remove('is-hidden');
            event.target.classList.add('is-hidden');
        }
    });

    initializeTagInput(cardTagsInput, { suggestions: appSettings.recommendedTags || [] });
    initializeTagInput(searchInput, { isMultiTag: false, showRecsOnFocus: false });
});