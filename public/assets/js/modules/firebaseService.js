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

const { db } = window.firebaseInstances;

// --- IMGBB ---
export async function uploadImageToImgBB(file) {
  const apiKey = window.IMGBB_API_KEY;
  if (!apiKey) throw new Error("Chave API ImgBB não configurada.");
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method: "POST", body: formData });
  const json = await response.json();
  if (json?.data?.url) return { url: json.data.url };
  throw new Error("Erro upload ImgBB");
}

const itemsCollectionRef = collection(db, "rpg-items");
const usersCollectionRef = collection(db, "rpg-users");
const chatCollectionRef = collection(db, "rpg-chat");
const rollsCollectionRef = collection(db, "rpg-rolls");

// --- CRUD ITENS ---
export const listenToItems = (cb) => onSnapshot(query(itemsCollectionRef, orderBy("order", "asc")), cb);
export const saveUser = (name) => setDoc(doc(usersCollectionRef, name.toLowerCase()), { name, lastSeen: serverTimestamp() }, { merge: true });

export async function addItem(itemData, file = null) {
  const snapshot = await getDocs(itemsCollectionRef);
  const newItem = { ...itemData, createdAt: serverTimestamp(), order: snapshot.size + 1 };
  if (file) {
    const img = await uploadImageToImgBB(file);
    newItem.url = img.url;
  }
  const docRef = await addDoc(itemsCollectionRef, newItem);
  return docRef.id;
}

export const deleteItem = (item) => deleteDoc(doc(db, "rpg-items", item.id));
export const deleteItems = async (ids) => {
  const batch = writeBatch(db);
  ids.forEach(id => batch.delete(doc(db, "rpg-items", id)));
  await batch.commit();
};

export async function updateItem(item, data, file = null) {
  if (file) {
    const img = await uploadImageToImgBB(file);
    data.url = img.url;
    data.storagePath = deleteField();
  }
  return updateDoc(doc(db, "rpg-items", item.id), data);
}

export const updateItemsVisibility = async (ids, val) => {
  const batch = writeBatch(db);
  ids.forEach(id => batch.update(doc(db, "rpg-items", id), { isVisibleToPlayers: val }));
  await batch.commit();
};

export const addTagsToItems = async (ids, tags) => {
  const batch = writeBatch(db);
  ids.forEach(id => batch.update(doc(db, "rpg-items", id), { tags: arrayUnion(...tags) }));
  await batch.commit();
};

// --- CHAT ---
export const addChatMessage = (text, type = 'user', sender = 'Anônimo') =>
  addDoc(chatCollectionRef, { text, type, sender, createdAt: serverTimestamp() });

export const listenToChat = (cb) => onSnapshot(query(chatCollectionRef, orderBy('createdAt', 'asc')), cb);

// --- DADOS ---
export async function sendDiceRoll(userName, diceType, result, customLabel = null) {
  await addDoc(rollsCollectionRef, {
    userName,
    diceType,
    result,
    label: customLabel || userName,
    createdAt: serverTimestamp(),
  });
}

export function listenToDiceRolls(callback) {
  const q = query(rollsCollectionRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const data = change.doc.data();
        if (!data.createdAt) { callback(change); return; } // Latência local

        // Ignora rolagens > 10s
        const diff = (new Date().getTime() - data.createdAt.toDate().getTime()) / 1000;
        if (diff < 10) callback(change);
      }
    });
  });
}

// Exports legados para compatibilidade
export const removeImageFromItem = (item) => updateItem(item, { url: deleteField() });
export const updateItemsOrder = async (ids) => {
  const batch = writeBatch(db);
  ids.forEach((id, i) => batch.update(doc(db, "rpg-items", id), { order: i }));
  await batch.commit();
};
export const getSettings = async () => (await getDoc(doc(db, "config", "mainSettings"))).data() || {};
export const saveSettings = (data) => setDoc(doc(db, "config", "mainSettings"), data, { merge: true });


// --- WHITEBOARDS ---
const boardsCollectionRef = collection(db, "rpg-boards");

export const listenToBoards = (cb) => onSnapshot(query(boardsCollectionRef, orderBy("updatedAt", "desc")), cb);

export const listenToCurrentBoard = (boardId, cb) => {
  return onSnapshot(doc(db, "rpg-boards", boardId), cb);
};

export const saveBoard = async (boardId, name, json) => {
  const data = {
    name,
    json: JSON.stringify(json),
    updatedAt: serverTimestamp()
  };
  if (boardId) {
    await updateDoc(doc(db, "rpg-boards", boardId), data);
    return boardId;
  } else {
    const docRef = await addDoc(boardsCollectionRef, { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  }
};

export const deleteBoard = (id) => deleteDoc(doc(db, "rpg-boards", id));

export const getBoard = async (id) => {
  const snap = await getDoc(doc(db, "rpg-boards", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};