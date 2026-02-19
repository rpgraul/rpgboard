import { getCurrentState, setMode, restorePreviousMode, updateVisualCursor } from './tools.js';

export let canvas = null;
const BOARD_SIZE = 4000;

let isDragging = false;
let lastPosX = 0;
let lastPosY = 0;
window._isPointerDown = false; // Flag global para o cursor saber se está clicado

export function initializeCanvas(canvasId, scrollContainerId) {
    const el = document.getElementById(canvasId);
    el.oncontextmenu = () => false;

    canvas = new fabric.Canvas(canvasId, {
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        backgroundColor: '#ffffff',
        isDrawingMode: false,
        selection: true,
        preserveObjectStacking: true,
        fireMiddleClick: true,
        stopContextMenu: true
    });

    // Ensure UID is saved in JSON for all objects
    fabric.Object.prototype.toObject = (function (toObject) {
        return function (propertiesToInclude) {
            return toObject.call(this, ['uid'].concat(propertiesToInclude));
        };
    })(fabric.Object.prototype.toObject);

    // Helper to generate Unique IDs
    window.generateUid = () => {
        return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    };

    const scrollArea = document.getElementById(scrollContainerId);

    // --- ESPAÇO (PAN TEMPORÁRIO) ---
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            const state = getCurrentState();
            if (state.mode !== 'move') {
                setMode('move', true);
            }
        }
    }, { capture: true });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            restorePreviousMode();
        }
    });

    // --- MOUSE EVENTS ---
    canvas.on('mouse:down', function (opt) {
        const evt = opt.e;
        window._isPointerDown = true;
        const state = getCurrentState();

        // Se for Botão do Meio (button 1), ativa move temporário
        if (evt.button === 1) {
            evt.preventDefault();
            setMode('move', true);
            startDragging(evt);
        } else if (state.mode === 'move') {
            startDragging(evt);
        }
    });

    canvas.on('mouse:move', function (opt) {
        if (isDragging && scrollArea) {
            const evt = opt.e;
            scrollArea.scrollLeft -= (evt.clientX - lastPosX);
            scrollArea.scrollTop -= (evt.clientY - lastPosY);
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
        }
        updateVisualCursor(); // Mantém o cursor atualizado durante o movimento
    });

    canvas.on('mouse:up', function (opt) {
        window._isPointerDown = false;
        isDragging = false;

        // Se foi um clique do meio, restaura a ferramenta anterior
        if (opt.e.button === 1) {
            restorePreviousMode();
        }
        updateVisualCursor();
    });

    // Centralizar Scroll
    if (scrollArea) {
        setTimeout(() => {
            scrollArea.scrollTo({
                top: (BOARD_SIZE - scrollArea.clientHeight) / 2,
                left: (BOARD_SIZE - scrollArea.clientWidth) / 2,
                behavior: 'instant'
            });
        }, 100);
    }

    initializeZoomControls();
    return canvas;
}

function startDragging(evt) {
    isDragging = true;
    lastPosX = evt.clientX;
    lastPosY = evt.clientY;
    updateVisualCursor();
}

function initializeZoomControls() {
    const btnIn = document.getElementById('btn-zoom-in');
    const btnOut = document.getElementById('btn-zoom-out');
    const btnReset = document.getElementById('btn-zoom-reset');

    const updateDisplay = () => {
        if (btnReset) btnReset.textContent = Math.round(canvas.getZoom() * 100) + '%';
    };

    canvas.on('mouse:wheel', function (opt) {
        if (!opt.e.ctrlKey) return;
        opt.e.preventDefault();
        opt.e.stopPropagation();
        let zoom = canvas.getZoom() * (0.999 ** opt.e.deltaY);
        if (zoom > 5) zoom = 5;
        if (zoom < 0.1) zoom = 0.1;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        updateDisplay();
    });

    if (btnIn) btnIn.onclick = () => { canvas.setZoom(Math.min(5, canvas.getZoom() * 1.2)); updateDisplay(); };
    if (btnOut) btnOut.onclick = () => { canvas.setZoom(Math.max(0.1, canvas.getZoom() * 0.8)); updateDisplay(); };
    if (btnReset) btnReset.onclick = () => { canvas.setZoom(1); updateDisplay(); };
}

export function clearCanvas() {
    if (confirm('Limpar tudo?')) {
        canvas.clear();
        canvas.setBackgroundColor('#ffffff', () => {
            canvas.renderAll();
            canvas.fire('object:modified');
        });
        canvas.setZoom(1);
    }
}