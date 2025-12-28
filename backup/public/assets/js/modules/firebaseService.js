import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
  getDoc,
  setDoc,
  getDocs,
  arrayUnion,
  deleteField,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- INÍCIO DA MODIFICAÇÃO PARA IMGBB ---

// Não precisamos mais das funções do Firebase Storage, então elas foram removidas.
// O objeto 'storage' também não é mais necessário.
const { db } = window.firebaseInstances;

/**
 * Função auxiliar para fazer upload de uma imagem para o ImgBB.
 * @param {File} file - O arquivo de imagem a ser enviado.
 * @returns {Promise<{url: string}>} - Um objeto contendo a URL da imagem no ImgBB.
 */
async function uploadImageToImgBB(file) {
  const apiKey = window.IMGBB_API_KEY;
  if (!apiKey) {
    console.error("Chave da API do ImgBB não foi encontrada em window.IMGBB_API_KEY");
    throw new Error("Chave da API do ImgBB não configurada.");
  }

  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Erro da API do ImgBB:", errorData);
      throw new Error(`Falha no upload para o ImgBB: ${errorData.error.message}`);
    }

    const jsonResponse = await response.json();

    // Verificação de segurança para garantir que a resposta tem o formato esperado
    if (jsonResponse && jsonResponse.data && jsonResponse.data.url) {
      return { url: jsonResponse.data.url };
    } else {
      console.error("Resposta inesperada do ImgBB:", jsonResponse);
      throw new Error("Formato de resposta inesperado do ImgBB.");
    }
  } catch (error) {
    console.error("Erro crítico ao fazer upload da imagem para o ImgBB:", error);
    // Propaga o erro para que a função que chamou possa tratá-lo
    throw error;
  }
}

// --- FIM DA MODIFICAÇÃO PARA IMGBB ---


const itemsCollectionRef = collection(db, "rpg-items");
const usersCollectionRef = collection(db, "rpg-users");

export async function saveUser(userName) {
  const userDoc = doc(usersCollectionRef, userName.toLowerCase());
  await setDoc(userDoc, { name: userName, lastSeen: serverTimestamp() }, { merge: true });
}

export function listenToItems(callback) {
  const q = query(itemsCollectionRef, orderBy("order", "asc"));
  return onSnapshot(q, callback);
}

/**
 * Adiciona um novo item ao Firestore. Se um arquivo for fornecido, faz o upload para o ImgBB.
 */
export async function addItem(itemData, file = null) {
  const snapshot = await getDocs(itemsCollectionRef);
  const itemsCount = snapshot.size;
  const newItem = {
    ...itemData,
    createdAt: serverTimestamp(),
    order: itemsCount + 1,
  };

  if (file) {
    // MODIFICADO: Usa a função de upload do ImgBB
    const imageData = await uploadImageToImgBB(file);
    newItem.url = imageData.url;
    // O campo 'storagePath' não é mais necessário com o ImgBB
  }

  const docRef = await addDoc(itemsCollectionRef, newItem);
  return docRef.id;
}

/**
 * Deleta um item do Firestore.
 * A imagem no ImgBB não pode ser deletada via API gratuita, então ela permanecerá lá.
 */
export async function deleteItem(item) {
  // MODIFICADO: Lógica de deleção de imagem do Firebase Storage foi removida.
  const itemDocRef = doc(db, "rpg-items", item.id);
  return deleteDoc(itemDocRef);
}

/**
 * Deleta múltiplos itens em massa do Firestore.
 * As imagens no ImgBB não podem ser deletadas.
 */
export async function deleteItems(itemIds) {
  const batch = writeBatch(db);

  for (const id of itemIds) {
    const docRef = doc(db, "rpg-items", id);
    batch.delete(docRef);
  }
  
  // MODIFICADO: Lógica de deleção de imagens do Firebase Storage foi removida.
  await batch.commit();
}

/**
 * Atualiza um item no Firestore. Se uma nova imagem for fornecida,
 * faz o upload para o ImgBB e substitui a URL antiga.
 */
export async function updateItem(item, updatedData, newImageFile = null) {
  // updateItem called
  
  if (newImageFile) {
    try {
      // MODIFICADO: Substitui o upload do Firebase pelo do ImgBB
      const imageData = await uploadImageToImgBB(newImageFile);
      updatedData.url = imageData.url;
      // Remove o campo 'storagePath' caso ele exista de um item antigo
      updatedData.storagePath = deleteField(); 
    } catch (error) {
      console.error("Erro ao fazer upload da nova imagem para o ImgBB:", error);
      // Lança um erro para que a interface do usuário possa mostrá-lo.
      throw new Error("Falha ao fazer upload da imagem");
    }
  }

  const itemDocRef = doc(db, "rpg-items", item.id);
  return updateDoc(itemDocRef, updatedData);
}

/**
 * Remove a referência da imagem de um item no Firestore.
 * A imagem no ImgBB não pode ser deletada.
 */
export async function removeImageFromItem(item) {
  if (!item || !item.id) {
    throw new Error("É necessário um item válido para remover sua imagem.");
  }
  
  // MODIFICADO: Lógica de deleção de imagem do Firebase Storage foi removida.
  const itemDocRef = doc(db, "rpg-items", item.id);
  await updateDoc(itemDocRef, {
    url: deleteField(),
    storagePath: deleteField(), // Remove também o storagePath se existir
  });
}

export async function updateItemsOrder(orderedIds) {
  const batch = writeBatch(db);

  orderedIds.forEach((id, index) => {
    const docRef = doc(db, "rpg-items", id);
    batch.update(docRef, { order: index });
  });

  await batch.commit();
}

export async function getItemsCount() {
  const snapshot = await getDocs(itemsCollectionRef);
  return snapshot.size;
}

export async function getSettings() {
  const docRef = doc(db, "config", "mainSettings");
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data();
  } else {
  // Documento de configurações 'mainSettings' não encontrado. Usando valores padrão.
    return {
      siteTitle: "RPG Painel",
      recommendedTags: ["NPC", "Aliado"],
      filters: [{ label: "PJs", value: "pj" }],
    };
  }
}

export async function saveSettings(settingsData) {
  const docRef = doc(db, "config", "mainSettings");
  await setDoc(docRef, settingsData, { merge: true });
}

export async function updateItemsVisibility(itemIds, isVisible) {
  const batch = writeBatch(db);

  itemIds.forEach((id) => {
    const docRef = doc(db, "rpg-items", id);
    batch.update(docRef, { isVisibleToPlayers: isVisible });
  });

  await batch.commit();
}

export async function addTagsToItems(itemIds, tagsToAdd) {
  const batch = writeBatch(db);

  itemIds.forEach((id) => {
    const docRef = doc(db, "rpg-items", id);
    batch.update(docRef, {
      tags: arrayUnion(...tagsToAdd),
    });
  });

  return batch.commit();
}