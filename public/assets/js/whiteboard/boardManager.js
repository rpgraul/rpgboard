import * as firebaseService from '../modules/firebaseService.js';
import { canvas } from './canvas.js';
import { resetHistory } from './history.js';

let currentBoardId = null;
let boardList = [];
let unsubscribeCurrentBoard = null;
let isReceivingUpdate = false;

export function initializeBoardManager() {
    const select = document.getElementById('board-select');
    const btnAdd = document.getElementById('btn-add-board');
    const btnDel = document.getElementById('btn-del-board');

    firebaseService.listenToBoards(async (snapshot) => {
        boardList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const prevId = currentBoardId;
        select.innerHTML = '';

        if (boardList.length === 0) {
            const opt = document.createElement('option');
            opt.text = "Criando Main Whiteboard...";
            select.add(opt);
            await createNewBoard("Main Whiteboard");
            return;
        }

        boardList.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            select.appendChild(opt);
        });

        if (prevId && boardList.some(b => b.id === prevId)) {
            select.value = prevId;
        } else if (boardList.length > 0 && !currentBoardId) {
            select.value = boardList[0].id;
            changeBoard(boardList[0].id);
        }
    });

    select.addEventListener('change', () => {
        if (select.value) changeBoard(select.value);
    });

    btnAdd.addEventListener('click', async () => {
        const name = prompt("Nome do novo Board:", "Novo Whiteboard");
        if (name) await createNewBoard(name);
    });

    btnDel.addEventListener('click', async () => {
        if (!currentBoardId) return;
        if (confirm("Deletar este board para todos?")) {
            const idToDelete = currentBoardId;
            const currentIndex = boardList.findIndex(b => b.id === idToDelete);
            let nextId = null;
            if (boardList.length > 1) {
                nextId = (currentIndex > 0) ? boardList[currentIndex - 1].id : boardList[currentIndex + 1].id;
            }
            await firebaseService.deleteBoard(idToDelete);
            if (nextId) changeBoard(nextId);
        }
    });

    const saveEvents = ['object:modified', 'object:added', 'object:removed', 'path:created', 'object:rotated', 'object:scaled'];
    saveEvents.forEach(evt => {
        canvas.on(evt, () => { if (!isReceivingUpdate) saveToFirebase(); });
    });
}

async function createNewBoard(name) {
    canvas.clear();
    canvas.setBackgroundColor('#ffffff', () => canvas.renderAll());
    canvas.setZoom(1);
    const newId = await firebaseService.saveBoard(null, name, canvas.toJSON());
    changeBoard(newId);
}

function changeBoard(id) {
    if (currentBoardId === id && unsubscribeCurrentBoard) return;

    currentBoardId = id;
    document.getElementById('board-select').value = id;

    if (unsubscribeCurrentBoard) unsubscribeCurrentBoard();

    unsubscribeCurrentBoard = firebaseService.listenToCurrentBoard(id, (docSnapshot) => {
        if (!docSnapshot.exists()) return;
        const data = docSnapshot.data();
        const serverJson = data.json;
        const currentJson = JSON.stringify(canvas.toJSON());

        if (serverJson && serverJson !== currentJson) {
            isReceivingUpdate = true;
            canvas.loadFromJSON(serverJson, () => {
                if (!canvas.backgroundColor) canvas.setBackgroundColor('#ffffff');
                canvas.renderAll();
                resetHistory(); // Importante: Resetar o histórico após o carregamento inicial do board
                setTimeout(() => { isReceivingUpdate = false; }, 100);
            });
        }
    });
}

let saveTimeout;
async function sanitizeBase64Images() {
    const objects = canvas.getObjects();
    const promises = [];
    for (const obj of objects) {
        if (obj.type === 'image' && obj._element && obj.getSrc && obj.getSrc().startsWith('data:')) {
            promises.push(
                fetch(obj.getSrc())
                    .then(r => r.blob())
                    .then(blob => firebaseService.uploadImageToImgBB(blob))
                    .then(({ url }) => {
                        obj.setSrc(url, () => canvas.renderAll(), { crossOrigin: 'anonymous' });
                    })
                    .catch(err => console.warn('ImgBB upload failed for object', obj.uid, err))
            );
        }
    }
    if (promises.length > 0) await Promise.all(promises);
}

function saveToFirebase() {
    if (!currentBoardId || isReceivingUpdate) return;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        const select = document.getElementById('board-select');
        const name = select.options[select.selectedIndex]?.text || "Board";
        try {
            await sanitizeBase64Images();
            await firebaseService.saveBoard(currentBoardId, name, canvas.toJSON());
        } catch (e) { console.error(e); }
    }, 1500);
}