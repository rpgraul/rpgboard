// Módulo centralizado para renderizar e manipular a aparência dos cards.
import * as shortcodeParser from './shortcodeParser.js';
import { isNarrator } from './auth.js';

let appSettings = {};

/**
 * Inicializa o renderizador de cards com as configurações globais do aplicativo.
 * @param {object} settings - O objeto de configurações carregado.
 */
export function initializeCardRenderer(settings) {
    appSettings = settings;
}

/**
 * Cria o elemento base do card e o popula com o conteúdo inicial.
 * @param {object} item - O objeto de dados do item.
 * @returns {HTMLElement} O elemento do card pronto para ser adicionado ao DOM.
 */
export function createCardElement(item) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    cardElement.dataset.id = item.id;

    renderCardViewMode(cardElement, item); // Popula com o modo de visualização padrão

    return cardElement;
}

/**
 * Renderiza o conteúdo de um card.
 * Se o card já existir no DOM, atualiza apenas as partes necessárias para evitar o "pisca-pisca" da imagem.
 * Se for um novo card, renderiza a estrutura completa.
 * @param {HTMLElement} cardElement - O elemento do card a ser populado.
 * @param {object} item - O objeto de dados do item.
 */
export function renderCardViewMode(cardElement, item) {
    const isAlreadyInViewMode = cardElement.querySelector('.card-info-layer');

    // Se o card já está no modo de visualização (não está saindo da edição),
    // executa a atualização "cirúrgrica" para evitar o pisca-pisca da imagem.
    // Se estiver saindo da edição, a estrutura precisa ser totalmente recriada,
    // então pulamos este bloco e executamos a renderização completa abaixo.
    if (isAlreadyInViewMode) {
        updateCardView(cardElement, item);
        return;
    }

    // --- LÓGICA DE RENDERIZAÇÃO COMPLETA (APENAS PARA CRIAÇÃO INICIAL) ---
    cardElement.classList.remove('editing');
    cardElement.classList.remove('has-overlay-content'); // Limpa a classe para garantir um estado inicial limpo
    cardElement.classList.remove('is-description-only');
    cardElement.classList.remove('is-hidden-from-players');

    if (isNarrator() && item.isVisibleToPlayers === false) {
        cardElement.classList.add('is-hidden-from-players');
    }

    const cardActions = `
        <div class="card-actions-top">
            <button class="action-icon edit-btn"><i class="fas fa-pencil-alt"></i></button>
            <button class="action-icon delete-btn"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;

    let cardContent = '';

    // Renderiza a imagem se uma URL existir
    if (item.url) {
        const hasDimensions = item.width && item.height;
        const aspectRatio = hasDimensions ? (item.height / item.width) * 100 : 75;
        const placeholderStyle = `padding-bottom: ${aspectRatio}%;`;

        // Gera o HTML para os shortcodes, já agrupados.
        const parsedShortcodes = item.conteudo ? shortcodeParser.parseAllShortcodes(item, appSettings) : {};
        
        // Pega a descrição separadamente.
        const descriptionForTooltip = item.descricao ? item.descricao.replace(/\n/g, '<br>') : '';

        // Monta a camada de informação unificada
        let infoLayerHTML = '';
        const hasAnyShortcodes = Object.values(parsedShortcodes).some(v => v);
        const hasAnyInfo = hasAnyShortcodes || descriptionForTooltip;

        if (hasAnyInfo) {
            // Adiciona a classe se houver qualquer shortcode, para habilitar o hover do ícone de toggle.
            if (hasAnyShortcodes) cardElement.classList.add('has-overlay-content');

            // Adiciona a classe especial se SÓ tiver descrição
            if (descriptionForTooltip && !hasAnyShortcodes) {
                cardElement.classList.add('is-description-only');
            }

            infoLayerHTML = `
                <div class="card-info-layer">
                    <div class="info-content">
                        <div class="info-group-left">${parsedShortcodes.left || ''}</div>
                        <div class="info-group-right">${parsedShortcodes.right || ''}</div>
                        <div class="info-group-bottom">${parsedShortcodes.bottom || ''}</div>
                        <div class="info-group-details">
                            ${parsedShortcodes.details || ''}
                        </div>
                        ${hasAnyShortcodes && descriptionForTooltip ? `<hr class="tooltip-divider">` : ''}
                        ${descriptionForTooltip ? `<div class="tooltip-description">${descriptionForTooltip}</div>` : ''}
                    </div>
                </div>`;
        }

        cardContent += `
            <div class="card-image">
                <figure class="image" style="${placeholderStyle}">
                    <img src="${item.url}" alt="${item.titulo}">
                    ${infoLayerHTML}
                </figure>
            </div>
        `;
    }

    cardContent += `<div class="card-content">
        <p class="title is-4">${item.titulo}</p>`;

    if (item.conteudo) {
        // Processa o conteúdo para renderizar shortcodes inline e remover os visíveis
        const mainContentHTML = shortcodeParser.parseMainContent(item.conteudo);
        if (mainContentHTML) {
            cardContent += `<div class="content">${mainContentHTML}</div>`;
        }
    }

    if (item.tags && item.tags.length > 0) {
        const tagsHTML = item.tags.map(tag => `<span class="tag is-info">${tag}</span>`).join(' ');
        cardContent += `<div class="tags">${tagsHTML}</div>`;
    }

    cardContent += `</div>`;

    cardElement.innerHTML = cardActions + cardContent;
}

/**
 * Atualiza seletivamente o conteúdo de um card já existente no DOM.
 * Esta função é chamada para evitar a re-renderização completa e o "pisca-pisca" da imagem.
 * @param {HTMLElement} cardElement - O elemento do card a ser atualizado.
 * @param {object} item - O objeto de dados atualizado do item.
 */
function updateCardView(cardElement, item) {
    cardElement.classList.remove('editing');
    cardElement.classList.remove('has-overlay-content');
    cardElement.classList.remove('is-description-only');
    cardElement.classList.remove('is-hidden-from-players');

    if (isNarrator() && item.isVisibleToPlayers === false) {
        cardElement.classList.add('is-hidden-from-players');
    }

    // Encontra o contêiner principal da camada de informação
    const infoLayerContainer = cardElement.querySelector('.card-info-layer');
    if (infoLayerContainer) {
        // Gera o HTML para os shortcodes, já agrupados.
        const parsedShortcodes = item.conteudo ? shortcodeParser.parseAllShortcodes(item, appSettings) : {};
        const descriptionForTooltip = item.descricao ? item.descricao.replace(/\n/g, '<br>') : '';

        const hasAnyShortcodes = Object.values(parsedShortcodes).some(v => v);

        if (hasAnyShortcodes) {
            cardElement.classList.add('has-overlay-content');
        }

        if (descriptionForTooltip && !hasAnyShortcodes) {
            cardElement.classList.add('is-description-only');
        }

        // Atualiza o conteúdo da camada de informação
        const infoContentContainer = infoLayerContainer.querySelector('.info-content');
        if (infoContentContainer) {
            // Reconstrói o conteúdo interno para garantir que o divisor apareça/desapareça corretamente.
            infoContentContainer.innerHTML = `
                <div class="info-group-left">${parsedShortcodes.left || ''}</div>
                <div class="info-group-right">${parsedShortcodes.right || ''}</div>
                <div class="info-group-bottom">${parsedShortcodes.bottom || ''}</div>
                <div class="info-group-details">
                    ${parsedShortcodes.details || ''}
                </div>
                ${hasAnyShortcodes && descriptionForTooltip ? `<hr class="tooltip-divider">` : ''}
                ${descriptionForTooltip ? `<div class="tooltip-description">${descriptionForTooltip}</div>` : ''}
            `;
        }
    }

    // Atualiza o Conteúdo Principal (Título, Texto, Tags)
    const contentContainer = cardElement.querySelector('.card-content');
    if (contentContainer) {
        let newContentHTML = `<p class="title is-4">${item.titulo}</p>`;
        if (item.conteudo) {
            const mainContentHTML = shortcodeParser.parseMainContent(item.conteudo);
            if (mainContentHTML) newContentHTML += `<div class="content">${mainContentHTML}</div>`;
        }
        if (item.tags && item.tags.length > 0) {
            newContentHTML += `<div class="tags">${item.tags.map(tag => `<span class="tag is-info">${tag}</span>`).join(' ')}</div>`;
        }
        contentContainer.innerHTML = newContentHTML;
    }
}

/**
 * Transforma um card para o modo de edição, renderizando os campos de formulário.
 * @param {HTMLElement} cardElement - O elemento do card a ser transformado.
 * @param {object} item - O objeto de dados do item.
 * @param {object} eventHandlers - Objeto contendo handlers, como onTagInputInit.
 */
export function renderCardEditMode(cardElement, item, eventHandlers) {
    cardElement.classList.add('editing');


    const editActions = `
        <div class="card-actions-top">
            <button class="action-icon save-btn"><i class="fas fa-save"></i></button>
            <button class="action-icon cancel-btn"><i class="fas fa-times-circle"></i></button>
        </div>`;

    let editHTML = '';

    // Seção da Imagem (sempre presente no modo de edição)
    const hasDimensions = item.width && item.height;
    const aspectRatio = hasDimensions ? (item.height / item.width) * 100 : 56.25; // Fallback 16:9
    const placeholderStyle = `padding-bottom: ${aspectRatio}%;`;
    const imageSrc = item.url || '';

    editHTML = `
        <div class="card-image ${!imageSrc ? 'is-placeholder' : ''}">
            <figure class="image" style="${placeholderStyle}">
                <img src="${imageSrc}" alt="${item.titulo || ''}">
                <div class="change-image-overlay">
                    <label class="button is-light">
                        <span class="icon is-small"><i class="fas fa-camera"></i></span>
                        <span>${imageSrc ? 'Trocar' : 'Adicionar'} Imagem</span>
                        <input type="file" class="edit-image-input" accept="image/*" style="display: none;">
                    </label>
                </div>
            </figure>
        </div>
        <div class="card-content">
            <div class="field"><div class="control"><input class="input edit-titulo" type="text" value="${item.titulo || ''}" placeholder="Título"></div></div>
            <div class="field"><div class="control"><textarea class="textarea edit-conteudo" placeholder="Conteúdo...">${item.conteudo || ''}</textarea></div></div>
            <div class="field"><div class="control"><textarea class="textarea edit-descricao" placeholder="Descrição (visível ao passar o mouse)">${item.descricao || ''}</textarea></div></div>
            <div class="field"><div class="control"><input class="input edit-tags" type="text" value="${item.tags?.join(', ') || ''}" placeholder="Tags"></div></div>
            ${
                isNarrator() ? `
                <div class="field">
                    <label class="checkbox narrator-control">
                        <input type="checkbox" class="edit-visibility" ${item.isVisibleToPlayers !== false ? 'checked' : ''}>
                        <span class="switch-track"></span>
                        <span class="switch-label-text">Visível para jogadores</span>
                    </label>
                </div>
                ` : ''
            }
            <div class="field" style="margin-top: 1.5em; text-align: right;">
                <button class="button is-primary save-btn"><span class="icon is-small"><i class="fas fa-save"></i></span> <span>Salvar</span></button>
            </div>
        </div>
    `;

    cardElement.innerHTML = editActions + editHTML;

    // Inicializa o input de tags, se o handler for fornecido
    const editTagsInput = cardElement.querySelector('.edit-tags');
    if (editTagsInput && eventHandlers?.onTagInputInit) {
        eventHandlers.onTagInputInit(editTagsInput);
    }

    // Aplica o mesmo handler de salvar para todos os botões save-btn
    const saveButtons = cardElement.querySelectorAll('.save-btn');
    saveButtons.forEach(btn => {
        btn.onclick = async (e) => { // Tornando o handler assíncrono
            e.preventDefault();
            if (eventHandlers?.onSave) {
                try {
                    // O onSave agora deve ser uma função que retorna uma Promise
                    // que resolve com o item atualizado.
                    const updatedItem = await eventHandlers.onSave(cardElement, item);
                    if (updatedItem) {
                        // Re-renderiza o card no modo de visualização com os dados atualizados
                        renderCardViewMode(cardElement, updatedItem);
                    }
                } catch (error) {
                    console.error("Erro ao salvar o card:", error);
                    // Opcional: Adicionar feedback visual para o usuário sobre o erro
                }
            }
        };
    });
}

/**
 * Extrai os dados do formulário de edição de um card.
 * @param {HTMLElement} cardElement - O elemento do card em modo de edição.
 * @returns {object} Um objeto com os dados atualizados.
 */
export function getCardFormData(cardElement) {
    const updatedData = {
        titulo: cardElement.querySelector('.edit-titulo').value,
        conteudo: cardElement.querySelector('.edit-conteudo').value,
        descricao: cardElement.querySelector('.edit-descricao').value,
        tags: cardElement.querySelector('.edit-tags').value.split(',').map(t => t.trim()).filter(Boolean)
    };

    const visibilityInput = cardElement.querySelector('.edit-visibility');
    if (visibilityInput) {
        updatedData.isVisibleToPlayers = visibilityInput.checked;
    }

    return updatedData;
}

/**
 * Helper para obter as dimensões de um arquivo de imagem.
 * @param {File} file - O arquivo de imagem.
 * @returns {Promise<{width: number, height: number}>}
 */
export function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => { const img = new Image(); img.onload = () => resolve({ width: img.width, height: img.height }); img.onerror = reject; img.src = e.target.result; };
        reader.readAsDataURL(file);
    });
}