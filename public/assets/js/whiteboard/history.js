import { canvas } from './canvas.js';

let history = [];
let historyIndex = -1;
let isLocked = false;

export function initializeHistory() {
    // Captura o estado inicial do canvas
    saveState();

    const events = ['object:modified', 'object:added', 'object:removed', 'path:created', 'object:rotated', 'object:scaled'];
    events.forEach(evt => {
        canvas.on(evt, () => {
            if (!isLocked) saveState();
        });
    });

    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');

    if (btnUndo) btnUndo.onclick = (e) => { e.preventDefault(); undo(); };
    if (btnRedo) btnRedo.onclick = (e) => { e.preventDefault(); redo(); };
    
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            }
            if (e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }
        }
    });
}

export function saveState() {
    if (isLocked || !canvas) return;

    const json = JSON.stringify(canvas.toJSON());
    
    // Evita duplicados idênticos no topo da pilha
    if (historyIndex >= 0 && json === history[historyIndex]) return;

    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }

    history.push(json);
    historyIndex = history.length - 1;
    
    // Limita o histórico a 50 passos para performance
    if (history.length > 50) {
        history.shift();
        historyIndex--;
    }

    updateButtons();
}

export function undo() {
    if (isLocked || historyIndex <= 0) return;
    
    isLocked = true;
    historyIndex--;
    loadState();
}

export function redo() {
    if (isLocked || historyIndex >= history.length - 1) return;
    
    isLocked = true;
    historyIndex++;
    loadState();
}

function loadState() {
    const json = history[historyIndex];
    canvas.loadFromJSON(json, () => {
        if (!canvas.backgroundColor) {
            canvas.setBackgroundColor('#ffffff');
        }
        canvas.renderAll();
        
        // Avisa outros módulos (como o Firebase) que o canvas mudou
        canvas.fire('object:modified'); 
        
        setTimeout(() => {
            isLocked = false;
            updateButtons();
        }, 100);
    });
}

function updateButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = (historyIndex <= 0);
    if (btnRedo) btnRedo.disabled = (historyIndex >= history.length - 1);
}

export function resetHistory() {
    history = [];
    historyIndex = -1;
    // Captura o estado atual do board carregado como ponto zero
    setTimeout(() => {
        saveState();
    }, 200);
}