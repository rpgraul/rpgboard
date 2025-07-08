import { db, storage } from '../firebase-config.js';
import { 
    collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, 
    serverTimestamp, query, orderBy, writeBatch,
    getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { 
    ref, uploadBytes, getDownloadURL, deleteObject 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

const itemsCollectionRef = collection(db, "rpg-items");

/**
 * Escuta por atualizações em tempo real na coleção de itens.
 * @param {function} callback - Função a ser chamada com os novos dados.
 */
export function listenToItems(callback) {
    // Agora ordena pelo campo 'order'. Itens com menor 'order' vêm primeiro.
    const q = query(itemsCollectionRef, orderBy("order", "asc"));
    // Passa o snapshot inteiro para o callback, para que possamos verificar metadados.
    return onSnapshot(q, callback);
}

/**
 * Adiciona um novo item ao Firestore. Pode opcionalmente incluir uma imagem.
 * @param {object} itemData - Objeto com os dados do item (titulo, conteudo, etc.).
 * @param {File|null} file - O arquivo de imagem, se houver.
 */
export async function addItem(itemData, file = null) {
    const newItem = {
        ...itemData,
        createdAt: serverTimestamp(),
        order: -Date.now()
    };

    if (file) {
        const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        newItem.url = await getDownloadURL(storageRef);
        newItem.storagePath = storageRef.fullPath;
        // As dimensões (width/height) devem ser adicionadas ao `itemData` antes de chamar esta função.
    }

    return addDoc(itemsCollectionRef, newItem);
}

/**
 * Deleta um item do Firestore e, se for imagem, do Storage.
 * @param {object} item - O objeto do item a ser deletado.
 */
export async function deleteItem(item) {
    // Se o item tiver um caminho no storage, delete o arquivo de imagem.
    if (item.storagePath) {
        const imageRef = ref(storage, item.storagePath);
        console.log(`Tentando deletar imagem do storage: ${item.storagePath}`);
        await deleteObject(imageRef).catch(error => {
            // Loga o erro mas não impede a deleção do documento no Firestore.
            console.error("Falha ao deletar imagem do storage, mas o item será deletado do banco de dados:", error);
        });
    }
    // Deleta o documento do Firestore.
    const itemDocRef = doc(db, "rpg-items", item.id);
    return deleteDoc(itemDocRef);
}

/**
 * Atualiza um item no Firestore. Se um novo arquivo de imagem for fornecido,
 * ele faz o upload da nova imagem, deleta a antiga e atualiza a URL.
 * @param {object} item - O objeto do item original (necessário para o storagePath antigo).
 * @param {object} updatedData - Os novos dados de texto a serem salvos.
 * @param {File|null} newImageFile - O novo arquivo de imagem, se houver.
 */
export async function updateItem(item, updatedData, newImageFile = null) {
    // Se um novo arquivo for fornecido (para adicionar ou trocar imagem)
    if (newImageFile) {
        // 1. Faz o upload da nova imagem
        const newImageRef = ref(storage, `images/${Date.now()}_${newImageFile.name}`);
        await uploadBytes(newImageRef, newImageFile);
        
        // 2. Obtém a nova URL e atualiza os dados
        updatedData.url = await getDownloadURL(newImageRef);
        updatedData.storagePath = newImageRef.fullPath;

        // 3. Deleta a imagem antiga para não deixar lixo no storage
        if (item.storagePath) {
            const oldImageRef = ref(storage, item.storagePath);
            console.log(`Tentando deletar imagem antiga do storage: ${item.storagePath}`);
            // Usamos .catch() para não quebrar a operação de atualização se a imagem antiga não for encontrada
            await deleteObject(oldImageRef).catch(err => {
                console.warn("Não foi possível deletar a imagem antiga (pode já ter sido removida ou o caminho é inválido):", err);
            });
        }
    }

    const itemDocRef = doc(db, "rpg-items", item.id);
    return updateDoc(itemDocRef, updatedData);
}

/**
 * Atualiza a ordem de múltiplos itens usando um batch write para eficiência.
 * @param {Array<string>} orderedIds - Um array de IDs de item na nova ordem desejada.
 */
export async function updateItemsOrder(orderedIds) {
    const batch = writeBatch(db);

    orderedIds.forEach((id, index) => {
        const docRef = doc(db, "rpg-items", id);
        batch.update(docRef, { order: index });
    });

    await batch.commit();
}

/**
 * Busca as configurações principais do site no Firestore.
 * @returns {Promise<object|null>} Um objeto com as configurações ou um objeto de fallback.
 */
export async function getSettings() {
    const docRef = doc(db, "config", "mainSettings");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        console.warn("Documento de configurações 'mainSettings' não encontrado. Usando valores padrão.");
        // Retorna um objeto de fallback para evitar que a aplicação quebre
        return {
            siteTitle: "RPG Painel",
            recommendedTags: ["NPC", "Aliado"],
            filters: [{ label: "PJs", value: "pjs" }]
        };
    }
}

/**
 * Salva as configurações principais do site no Firestore.
 * @param {object} settingsData - O objeto com as novas configurações.
 */
export async function saveSettings(settingsData) {
    const docRef = doc(db, "config", "mainSettings");
    // Usamos set com merge:true para criar o documento se ele não existir, ou atualizar se existir.
    await setDoc(docRef, settingsData, { merge: true });
}

/**
 * Atualiza a visibilidade de múltiplos itens em massa.
 * @param {string[]} itemIds - Array de IDs dos itens a serem atualizados.
 * @param {boolean} isVisible - O novo estado de visibilidade.
 */
export async function updateItemsVisibility(itemIds, isVisible) {
    const batch = writeBatch(db);

    itemIds.forEach(id => {
        const docRef = doc(db, "rpg-items", id);
        batch.update(docRef, { isVisibleToPlayers: isVisible });
    });

    await batch.commit();
}