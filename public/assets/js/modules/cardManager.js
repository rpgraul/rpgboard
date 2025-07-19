// Este módulo é responsável pelo gerenciamento central dos cards
import * as cardRenderer from './cardRenderer.js';

let items = [];
let eventHandlers = {};
let subscribers = [];
let isInitialized = false;

/**
 * Inicializa o gerenciador de cards
 * @param {object} handlers - Handlers para ações nos cards (onDelete, onSave, onView, etc)
 * @returns {Promise} Promise que resolve quando a inicialização estiver completa
 */
export function initialize(handlers) {
    if (isInitialized) {
        return Promise.resolve();
    }
    
    return new Promise((resolve) => {
        eventHandlers = handlers;
        isInitialized = true;
        resolve();
    });
}

/**
 * Carrega os cards no gerenciador
 * @param {Array} newItems - Lista de items para carregar
 * @returns {Promise} Promise que resolve quando todos os cards estiverem carregados
 */
export async function loadItems(newItems) {
    if (!isInitialized) {
        throw new Error('CardManager não foi inicializado. Chame initialize() primeiro.');
    }

    items = newItems;
    await Promise.all(subscribers.map(subscriber => {
        try {
            return Promise.resolve(subscriber(items));
        } catch (error) {
            console.error('Erro ao notificar subscriber:', error);
            return Promise.resolve();
        }
    }));
}

/**
 * Retorna a lista atual de items
 */
export function getItems() {
    return items;
}

/**
 * Filtra os items com base em um termo de busca
 * @param {string} searchTerm - Termo para filtrar
 */
export function filterItems(searchTerm) {
    if (!searchTerm) {
        return items;
    }
    return items.filter(item => {
        const term = searchTerm.toLowerCase().trim();
        const titleMatch = item.titulo.toLowerCase().includes(term);
        const contentMatch = item.tipo === 'texto' && item.conteudo.toLowerCase().includes(term);
        const descriptionMatch = item.tipo === 'imagem' && item.descricao?.toLowerCase().includes(term);
        const tagMatch = item.tags.some(tag => tag.toLowerCase().includes(term));
        return titleMatch || contentMatch || descriptionMatch || tagMatch;
    });
}

/**
 * Atualiza a posição de um card no modo board
 * @param {string} itemId - ID do item
 * @param {object} position - Nova posição {x, y}
 */
export async function updateItemPosition(itemId, position) {
    const item = items.find(i => i.id === itemId);
    if (item && window.firebaseService && window.firebaseService.updateItem) {
        await window.firebaseService.updateItem({ id: itemId }, { boardPosition: position });
        notifySubscribers();
    }
}

/**
 * Subscreve para receber atualizações quando os items mudarem
 * @param {Function} callback - Função a ser chamada quando houver mudanças
 */
export function subscribe(callback) {
    subscribers.push(callback);
}

/**
 * Remove a subscrição de atualizações
 * @param {Function} callback - Função a ser removida
 */
export function unsubscribe(callback) {
    subscribers = subscribers.filter(cb => cb !== callback);
}

// Notifica todos os subscribers sobre mudanças
function notifySubscribers() {
    subscribers.forEach(callback => callback(items));
}
