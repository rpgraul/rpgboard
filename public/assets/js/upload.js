import { writeBatch, collection, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Obtém a instância do DB do objeto global inicializado pelo firebase-config.js
const { db, storage } = window.firebaseInstances;

/**
 * Fetches an image from a URL, uploads it to Firebase Storage, and returns its data.
 * @param {string} imageUrl The URL of the image to process.
 * @returns {Promise<object|null>} An object with url, storagePath, width, and height, or null on failure.
 */
async function processImageFromUrl(imageUrl) {
    try {
        // AVISO: A busca direta de imagens pode falhar devido a políticas de CORS do site de origem.
        // SOLUÇÃO: Usamos um proxy CORS para contornar essa restrição.
        // Este é um serviço público e gratuito.
        const proxyUrl = 'https://corsproxy.io/?';
        const response = await fetch(proxyUrl + encodeURIComponent(imageUrl));
        if (!response.ok) throw new Error(`Falha ao buscar imagem: ${response.statusText}`);

        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) {
            console.warn(`URL não aponta para uma imagem válida: ${imageUrl}`);
            return null;
        }

        // Obtém as dimensões da imagem
        const dimensions = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(img.src); resolve({ width: img.width, height: img.height }); };
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
        });

        // Faz o upload para o Firebase Storage
        const fileName = imageUrl.split('/').pop().split('?')[0] || `image_${Date.now()}`;
        const storageRef = ref(storage, `images/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '')}`);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        return { url: downloadURL, storagePath: storageRef.fullPath, ...dimensions };
    } catch (error) {
        console.error(`Não foi possível processar a imagem da URL ${imageUrl}:`, error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const jsonInput = document.getElementById('json-input');
    const importBtn = document.getElementById('import-btn');
    const notificationArea = document.getElementById('notification-area');

    /**
     * Exibe uma notificação para o usuário.
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - O tipo de notificação (ex: 'is-success', 'is-danger').
     */
    function showNotification(message, type = 'is-success') {
        notificationArea.innerHTML = `
            <div class="notification ${type}">
                <button class="delete"></button>
                ${message}
            </div>
        `;
        const deleteButton = notificationArea.querySelector('.delete');
        deleteButton.addEventListener('click', () => {
            notificationArea.innerHTML = '';
        });
    }

    importBtn.addEventListener('click', async () => {
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
        notificationArea.innerHTML = '';

        try {
            const batch = writeBatch(db);
            const itemsCollectionRef = collection(db, 'rpg-items');

            // Usamos um loop for...of para poder usar 'await' dentro dele
            for (const card of cards) {
                const newCardRef = doc(itemsCollectionRef); // Cria uma referência com ID automático
                
                // Define os dados do card, garantindo valores padrão para campos essenciais
                const dataToWrite = {
                    ...card,
                    titulo: card.titulo || 'Card Sem Título',
                    conteudo: card.conteudo || '',
                    descricao: card.descricao || '',
                    tags: card.tags || [],
                    isVisibleToPlayers: card.isVisibleToPlayers ?? true, // Padrão é visível
                    createdAt: serverTimestamp(),
                    order: card.order ?? -Date.now() // Garante uma ordem padrão
                };

                // Se o card tiver uma URL de imagem, processa-a
                if (card.imagem && typeof card.imagem === 'string') {
                    showNotification(`Processando imagem para: ${card.titulo}...`, 'is-info');
                    const imageData = await processImageFromUrl(card.imagem);
                    if (imageData) {
                        Object.assign(dataToWrite, imageData);
                    }
                }
                // Remove a chave temporária 'imagem' para não salvá-la no Firestore
                delete dataToWrite.imagem;

                batch.set(newCardRef, dataToWrite);
            }

            await batch.commit();
            showNotification(`${cards.length} card(s) importado(s) com sucesso!`, 'is-success');
            jsonInput.value = ''; // Limpa o campo após o sucesso
        } catch (error) {
            console.error("Erro ao importar cards:", error);
            showNotification(`Ocorreu um erro durante a importação: ${error.message}`, 'is-danger');
        } finally {
            importBtn.classList.remove('is-loading');
        }
    });
<<<<<<< HEAD
});
=======
});
>>>>>>> 104b23cfc07483eae944d9e675e87949d0da4616
