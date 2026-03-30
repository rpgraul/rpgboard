import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, limit, writeBatch, getDoc, setDoc, getDocs, arrayUnion, deleteField, } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";
import { updateSyncStatus } from "./ui.js";
import { db, storage, IMGBB_API_KEY } from "../firebase-config.js";

let _imgbbApiKey = IMGBB_API_KEY;

export const initFirebaseService = ({ imgbbApiKey } = {}) => {
  if (imgbbApiKey) _imgbbApiKey = imgbbApiKey;
};

async function wrapSync(promise) {
  updateSyncStatus(true);
  try {
    return await promise;
  } catch (err) {
    updateSyncStatus(false, true);
    throw err;
  } finally {
    updateSyncStatus(false);
  }
}

export async function uploadImageToImgBB(file) {
  let apiKey = _imgbbApiKey;
  if (!apiKey) {
    const settings = await getSettings();
    if (settings && settings.imgbbApiKey) {
      apiKey = settings.imgbbApiKey;
      _imgbbApiKey = apiKey;
    }
  }
  if (!apiKey) throw new Error("Chave API ImgBB não configurada.");
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: "POST",
    body: formData,
  });
  const json = await response.json();
  if (json?.data?.url) return { url: json.data.url };
  throw new Error("Erro upload ImgBB");
}

const itemsCollectionRef = collection(db, "rpg-items");
const usersCollectionRef = collection(db, "rpg-users");
const chatCollectionRef = collection(db, "rpg-chat");
const rollsCollectionRef = collection(db, "rpg-rolls");
const whiteboardAssetsCollectionRef = collection(db, "rpg-whiteboard-assets");
const audioPlayerDocRef = doc(db, "audioPlayer", "main");

export const listenToItems = (cb) => onSnapshot(query(itemsCollectionRef, orderBy("order", "asc")), cb);
export const saveUser = (name) => setDoc(doc(usersCollectionRef, name.toLowerCase()), { name, lastSeen: serverTimestamp() }, { merge: true });

export async function addItem(itemData, file = null) {
  return wrapSync((async () => {
    const snapshot = await getDocs(itemsCollectionRef);

    const cleanData = { ...itemData };
    delete cleanData.newImageFile;
    delete cleanData.removeImage;
    delete cleanData.isLoading;
    delete cleanData.isUpdating;
    delete cleanData.category;
    delete cleanData.categoria;

    const newItem = { ...cleanData, createdAt: serverTimestamp(), order: snapshot.size + 1 };

    if (file) {
      const img = await uploadImageToImgBB(file);
      newItem.url = img.url;
    }

    const docRef = await addDoc(itemsCollectionRef, newItem);
    return docRef.id;
  })());
}

export const deleteItem = (item) => wrapSync(deleteDoc(doc(db, "rpg-items", item.id)));
export const deleteItems = async (ids) => {
  return wrapSync((async () => {
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, "rpg-items", id)));
    await batch.commit();
  })());
};

export async function updateItem(item, data, file = null) {
  return wrapSync((async () => {
    const cleanData = { ...data };
    delete cleanData.newImageFile;
    delete cleanData.isLoading;
    delete cleanData.isUpdating;
    delete cleanData.removeImage;
    delete cleanData.category;
    delete cleanData.categoria;

    if (file) {
      const img = await uploadImageToImgBB(file);
      cleanData.url = img.url;
      cleanData.storagePath = deleteField();
    } else if (data.removeImage) {
      cleanData.url = deleteField();
      cleanData.storagePath = deleteField();
    }

    return updateDoc(doc(db, "rpg-items", item.id), cleanData);
  })());
}

export async function updateCharacterStat(characterId, fieldPath, value) {
  return wrapSync((async () => {
    const data = {};
    data[fieldPath] = value;
    return updateDoc(doc(db, "rpg-items", characterId), data);
  })());
}

export const updateItemsVisibility = async (ids, val) => {
  return wrapSync((async () => {
    const batch = writeBatch(db);
    ids.forEach(id => batch.update(doc(db, "rpg-items", id), { isVisibleToPlayers: val }));
    await batch.commit();
  })());
};

export const addTagsToItems = async (ids, tags) => {
  return wrapSync((async () => {
    const batch = writeBatch(db);
    ids.forEach(id => batch.update(doc(db, "rpg-items", id), { tags: arrayUnion(...tags) }));
    await batch.commit();
  })());
};

export const addChatMessage = (text, type = 'user', sender = 'Anônimo') =>
  wrapSync(addDoc(chatCollectionRef, { text, type, sender, createdAt: serverTimestamp() }));

export const listenToChat = (cb) => onSnapshot(query(chatCollectionRef, orderBy('createdAt', 'asc')), cb);

export async function sendDiceRoll(data) {
  const payload = {
    userName: data.userName,
    diceType: data.diceType,
    result: data.total || data.result || 0,
    label: data.label || data.userName,
    hideLabel: data.hideLabel || false,
    hideDie: data.hideDie || false,
    formula: data.formula || null,
    total: data.total || 0,
    individualRolls: data.individualRolls || null,
    createdAt: serverTimestamp(),
  };
  await addDoc(rollsCollectionRef, payload);
}

export function listenToDiceRolls(callback) {
  const q = query(rollsCollectionRef, orderBy('createdAt', 'desc'), limit(10));
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const data = change.doc.data();
        if (!data.createdAt) { 
          callback({ doc: { data: () => data } }); 
          return; 
        }
        const diff = (new Date().getTime() - data.createdAt.toDate().getTime()) / 1000;
        if (diff < 10) {
          callback({ doc: { data: () => data } });
        }
      }
    });
  });
}

export const removeImageFromItem = (item) => updateItem(item, { url: deleteField() });
export const updateItemsOrder = async (ids) => {
  return wrapSync((async () => {
    const batch = writeBatch(db);
    ids.forEach((id, i) => batch.update(doc(db, "rpg-items", id), { order: i }));
    await batch.commit();
  })());
};
const SETTINGS_CACHE_KEY = 'rpgboard_settings_cache';
const SETTINGS_CACHE_TTL = 5 * 60 * 1000;

export const getSettings = async () => {
  const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < SETTINGS_CACHE_TTL) {
      return data;
    }
  }
  const data = (await getDoc(doc(db, "config", "mainSettings"))).data() || {};
  sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  return data;
};
export const saveSettings = (data) => wrapSync(setDoc(doc(db, "config", "mainSettings"), data, { merge: true }));

export const listenToWhiteboardAssets = (cb) => onSnapshot(query(whiteboardAssetsCollectionRef, orderBy("createdAt", "desc")), cb);

export async function addWhiteboardAsset(url, name) {
  return wrapSync(addDoc(whiteboardAssetsCollectionRef, {
    url,
    name,
    createdAt: serverTimestamp()
  }));
}

export const deleteWhiteboardAsset = (id) => wrapSync(deleteDoc(doc(db, "rpg-whiteboard-assets", id)));

const boardsCollectionRef = collection(db, "rpg-boards");

export const listenToBoards = (cb) => onSnapshot(query(boardsCollectionRef, orderBy("updatedAt", "desc")), cb);

export const listenToCurrentBoard = (boardId, cb) => {
  return onSnapshot(doc(db, "rpg-boards", boardId), cb);
};

export const saveBoard = async (boardId, name, json) => {
  return wrapSync((async () => {
    let jsonObj = typeof json === 'string' ? JSON.parse(json) : json;
    let jsonString = JSON.stringify(jsonObj);
    let byteSize = new Blob([jsonString]).size;

    if (byteSize > 1048487) {
      console.warn(`[saveBoard] Tamanho do JSON excede o limite (${byteSize} bytes). Tentando reduzir...`);
      import('./ui.js').then(mod => mod.showToast("O quadro está muito grande. Removendo desenhos para tentar salvar.", "is-warning"));

      if (jsonObj.history) delete jsonObj.history;
      if (jsonObj.objects) {
        jsonObj.objects = jsonObj.objects.filter(obj => obj && obj.type !== 'path');
      }

      jsonString = JSON.stringify(jsonObj);
      byteSize = new Blob([jsonString]).size;

      if (byteSize > 1048487) {
        import('./ui.js').then(mod => mod.showToast("O quadro ainda excede 1MB. Tente reduzir o número de imagens ou elementos.", "is-danger"));
        throw new Error("Board excessivamente grande (>1MB)");
      }
    }

    const data = {
      name,
      json: jsonString,
      updatedAt: serverTimestamp()
    };
    if (boardId) {
      await updateDoc(doc(db, "rpg-boards", boardId), data);
      return boardId;
    } else {
      const docRef = await addDoc(boardsCollectionRef, { ...data, createdAt: serverTimestamp() });
      return docRef.id;
    }
  })());
};

export const deleteBoard = (id) => wrapSync(deleteDoc(doc(db, "rpg-boards", id)));

export const getBoard = async (id) => {
  const snap = await getDoc(doc(db, "rpg-boards", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export async function processImageFromUrl(imageUrl) {
  try {
    const proxyUrl = 'https://corsproxy.io/?';
    const response = await fetch(proxyUrl + encodeURIComponent(imageUrl));
    if (!response.ok) throw new Error(`Falha ao buscar imagem: ${response.statusText}`);

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;

    const dimensions = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(img.src); resolve({ width: img.width, height: img.height }); };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });

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

export async function importCards(cards, onProgress = () => { }) {
  return wrapSync((async () => {
    const batch = writeBatch(db);
    const colRef = collection(db, 'rpg-items');

    for (const card of cards) {
      const newCardRef = doc(colRef);
      const dataToWrite = {
        ...card,
        titulo: card.titulo || 'Card Sem Título',
        conteudo: card.conteudo || '',
        isVisibleToPlayers: card.isVisibleToPlayers ?? true,
        createdAt: serverTimestamp(),
        order: card.order ?? -Date.now()
      };

      if (card.imagem && typeof card.imagem === 'string') {
        onProgress(`Processando imagem para: ${card.titulo}...`, 'is-info');
        const imageData = await processImageFromUrl(card.imagem);
        if (imageData) Object.assign(dataToWrite, imageData);
      }
      delete dataToWrite.imagem;
      batch.set(newCardRef, dataToWrite);
    }

    await batch.commit();
    return cards.length;
  })());
}

// ============================================
// AUDIO PLAYER FIRESTORE FUNCTIONS
// ============================================

export function listenToAudioPlayer(callback) {
  return onSnapshot(audioPlayerDocRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    } else {
      callback(null);
    }
  });
}

export async function issueAudioCommand(commandType, payload = {}) {
  const baseState = {
    commandTime: Date.now(),
    lastUpdated: serverTimestamp()
  };
  
  if (commandType === 'playPause') {
    return wrapSync(updateDoc(audioPlayerDocRef, {
      ...baseState,
      isPlaying: payload.isPlaying,
      seekTime: payload.seekTime || 0
    }));
  }
  
  if (commandType === 'skip') {
    return wrapSync(updateDoc(audioPlayerDocRef, {
      ...baseState,
      currentVideoId: payload.currentVideoId,
      isPlaying: payload.isPlaying,
      seekTime: payload.seekTime || 0
    }));
  }
  
  if (commandType === 'seek') {
    return wrapSync(updateDoc(audioPlayerDocRef, {
      ...baseState,
      seekTime: payload.seekTime,
      isPlaying: true
    }));
  }
  
  if (commandType === 'stop') {
    return wrapSync(updateDoc(audioPlayerDocRef, {
      ...baseState,
      currentVideoId: null,
      isPlaying: false,
      seekTime: 0
    }));
  }
  
  return wrapSync(updateDoc(audioPlayerDocRef, { ...baseState, ...payload }));
}

export async function updateAudioVolume(volume) {
  return wrapSync(updateDoc(audioPlayerDocRef, {
    volume: Math.max(0, Math.min(100, volume)),
    lastUpdated: serverTimestamp()
  }));
}

export async function updateAudioPosition(seekTime) {
  return wrapSync(updateDoc(audioPlayerDocRef, {
    seekTime: seekTime,
    commandTime: Date.now(),
    lastUpdated: serverTimestamp()
  }));
}

export async function initAudioPlayer() {
  const docSnap = await getDoc(audioPlayerDocRef);
  if (!docSnap.exists()) {
    await setDoc(audioPlayerDocRef, {
      currentVideoId: null,
      isPlaying: false,
      seekTime: 0,
      commandTime: 0,
      lastUpdated: serverTimestamp(),
      volume: 50,
      playlist: []
    });
  }
  return docSnap.exists() ? docSnap.data() : null;
}

// ============================================
// AUDIO PLAYER COMMAND FUNCTIONS
// (escrevem com commandTime, disparam listener)
// ============================================

export async function addToAudioPlaylistCommand(videoId, title, addedBy) {
  const docSnap = await getDoc(audioPlayerDocRef);
  const data = docSnap.data() || { playlist: [] };
  const newItem = {
    id: crypto.randomUUID(),
    videoId,
    title,
    addedBy,
    addedAt: Date.now()
  };
  const newPlaylist = [...data.playlist, newItem];
  return wrapSync(updateDoc(audioPlayerDocRef, {
    playlist: newPlaylist,
    commandTime: Date.now(),
    lastUpdated: serverTimestamp()
  }));
}

export async function removeFromAudioPlaylistCommand(itemId) {
  const docSnap = await getDoc(audioPlayerDocRef);
  const data = docSnap.data() || { playlist: [] };
  const newPlaylist = data.playlist.filter(item => item.id !== itemId);
  return wrapSync(updateDoc(audioPlayerDocRef, {
    playlist: newPlaylist,
    commandTime: Date.now(),
    lastUpdated: serverTimestamp()
  }));
}

export async function reorderAudioPlaylistCommand(newOrder) {
  return wrapSync(updateDoc(audioPlayerDocRef, {
    playlist: newOrder,
    commandTime: Date.now(),
    lastUpdated: serverTimestamp()
  }));
}