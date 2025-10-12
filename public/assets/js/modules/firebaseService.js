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

import { uploadImage } from './imgbbService.js';

const { db } = window.firebaseInstances;

const itemsCollectionRef = collection(db, "rpg-items");
const usersCollectionRef = collection(db, "rpg-users");

export async function saveUser(userName) {
  const userDoc = doc(usersCollectionRef, userName.toLowerCase());
  await setDoc(
    userDoc,
    {
      name: userName,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );
}

export function listenToItems(callback) {
  const q = query(itemsCollectionRef, orderBy("order", "asc"));
  return onSnapshot(q, callback);
}

export async function addItem(itemData, file = null) {
  const snapshot = await getDocs(itemsCollectionRef);
  const itemsCount = snapshot.size;

  const newItem = {
    ...itemData,
    createdAt: serverTimestamp(),
    order: itemsCount + 1,
  };

  if (file) {
    try {
      // Faz upload da imagem para o ImgBB
      const uploadResult = await uploadImage(file);
      
      newItem.url = uploadResult.url;
      newItem.deleteUrl = uploadResult.deleteUrl; // Armazena a URL de deleção
      // Removido: newItem.storagePath (não usado mais)
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      throw new Error('Falha ao fazer upload da imagem');
    }
  }

  const docRef = await addDoc(itemsCollectionRef, newItem);
  return docRef.id;
}

export async function deleteItem(item) {
  // Nota: ImgBB não permite deleção programática de imagens pela API
  // As imagens podem ser deletadas manualmente usando a deleteUrl
  // ou configurando expiração no momento do upload
  
  if (item.deleteUrl) {
    console.log(`Imagem pode ser deletada manualmente em: ${item.deleteUrl}`);
  }

  const itemDocRef = doc(db, "rpg-items", item.id);
  return deleteDoc(itemDocRef);
}

export async function deleteItems(itemIds) {
  const batch = writeBatch(db);

  for (const id of itemIds) {
    const docRef = doc(db, "rpg-items", id);
    
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const item = docSnap.data();
        
        if (item.deleteUrl) {
          console.log(`Imagem pode ser deletada manualmente em: ${item.deleteUrl}`);
        }
      }
    } catch (error) {
      console.error(`Erro ao buscar o item ${id} para deleção:`, error);
    }

    batch.delete(docRef);
  }

  await batch.commit();
  console.log(`${itemIds.length} itens deletados com sucesso.`);
}

export async function updateItem(item, updatedData, newImageFile = null) {
  console.log("updateItem called with:", item, updatedData, newImageFile);

  if (newImageFile) {
    try {
      // Faz upload da nova imagem para o ImgBB
      const uploadResult = await uploadImage(newImageFile);
      
      updatedData.url = uploadResult.url;
      updatedData.deleteUrl = uploadResult.deleteUrl;
      
      // Remove campos antigos relacionados ao storage
      updatedData.storagePath = deleteField();

      // Log da URL de deleção da imagem antiga (se existir)
      if (item.deleteUrl) {
        console.log(`Imagem antiga pode ser deletada manualmente em: ${item.deleteUrl}`);
      }
    } catch (error) {
      console.error('Erro ao fazer upload da nova imagem:', error);
      throw new Error('Falha ao fazer upload da imagem');
    }
  }

  const itemDocRef = doc(db, "rpg-items", item.id);
  return updateDoc(itemDocRef, updatedData);
}

export async function removeImageFromItem(item) {
  if (!item || !item.id) {
    throw new Error("É necessário um item válido para remover sua imagem.");
  }

  // Log da URL de deleção (ImgBB não permite deleção programática)
  if (item.deleteUrl) {
    console.log(`Imagem pode ser deletada manualmente em: ${item.deleteUrl}`);
  }

  const itemDocRef = doc(db, "rpg-items", item.id);
  await updateDoc(itemDocRef, {
    url: deleteField(),
    deleteUrl: deleteField(),
    storagePath: deleteField(),
  });
}

export async function updateItemsOrder(orderedIds) {
  const { db } = window.firebaseInstances || {};
  console.log("updateItemsOrder called with:", orderedIds);

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
    console.warn(
      "Documento de configurações 'mainSettings' não encontrado. Usando valores padrão."
    );
    return {
      siteTitle: "RPG Painel",
      recommendedTags: ["NPC", "Aliado"],
      filters: [{ label: "PJs", value: "pjs" }],
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