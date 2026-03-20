import { updateItem } from './firebaseService.js';

/**
 * Centralized debouncer for Firestore updates from NodeViews.
 * Ensures we don't hit rate limits while providing real-time-like feedback.
 */
const syncDebouncers = new Map();

/**
 * Syncs a specific field of an item to Firebase with a debounce.
 * @param {string} itemId - ID of the item (card).
 * @param {string} content - Full content string to sync.
 * @param {number} delay - Debounce delay in ms (default 2000).
 */
export function debouncedSyncContent(itemId, content, delay = 2000) {
    if (!itemId) return;

    if (syncDebouncers.has(itemId)) {
        clearTimeout(syncDebouncers.get(itemId));
    }

    const timeout = setTimeout(async () => {
        try {
            await updateItem({ id: itemId }, { conteudo: content });
            console.log(`[Sync] Content persisted for item ${itemId}`);
        } catch (error) {
            console.error(`[Sync] Failed to persist item ${itemId}:`, error);
        } finally {
            syncDebouncers.delete(itemId);
        }
    }, delay);

    syncDebouncers.set(itemId, timeout);
}

/**
 * Immediately cancels any pending sync for an item.
 */
export function cancelPendingSync(itemId) {
    if (syncDebouncers.has(itemId)) {
        clearTimeout(syncDebouncers.get(itemId));
        syncDebouncers.delete(itemId);
    }
}
