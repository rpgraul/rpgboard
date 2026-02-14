import { canvas } from './canvas.js';

let currentMode = 'select';
let lastActiveMode = 'select'; // Armazena a ferramenta anterior ao "Move" temporário
let currentColor = '#000000';
let currentWidth = 3;

export function initializeTools() {
    const colorPicker = document.getElementById('wb-color');
    const widthPicker = document.getElementById('wb-width');
    const btns = document.querySelectorAll('.tool-btn[data-tool]');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.tool;
            lastActiveMode = mode; // Atualiza a ferramenta base
            setMode(mode);
        });
    });

    if(colorPicker) {
        colorPicker.addEventListener('input', (e) => {
            currentColor = e.target.value;
            updateActiveObjectStyle();
            updateBrush();
        });
    }

    if(widthPicker) {
        widthPicker.addEventListener('input', (e) => {
            currentWidth = parseInt(e.target.value, 10);
            updateBrush();
        });
    }
}

export function setMode(mode, isTemporary = false) {
    currentMode = mode;
    
    // Feedback Visual na Toolbar
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('is-active'));
    const activeBtn = document.querySelector(`.tool-btn[data-tool="${mode}"]`);
    if(activeBtn) activeBtn.classList.add('is-active');

    // Configurações do Fabric
    canvas.isDrawingMode = (mode === 'draw');
    canvas.selection = (mode === 'select');
    
    if (mode === 'move') {
        canvas.forEachObject(o => {
            o.selectable = false;
            o.evented = false; // Garante que não interfira no drag
        });
        canvas.discardActiveObject();
    } else {
        canvas.forEachObject(o => {
            o.selectable = true;
            o.evented = true;
        });
    }

    if (mode === 'draw') updateBrush();
    
    // Força a atualização do cursor no DOM
    updateVisualCursor();
    canvas.requestRenderAll();
}

export function restorePreviousMode() {
    setMode(lastActiveMode);
}

export function updateVisualCursor() {
    if (!canvas || !canvas.upperCanvasEl) return;

    const el = canvas.upperCanvasEl;
    const btnDown = window._isPointerDown;
    
    // Remove todas as classes de cursor anteriores
    el.classList.remove('cursor-grab', 'cursor-grabbing', 'cursor-text', 'cursor-crosshair');

    let cursor = 'default';

    if (currentMode === 'move') {
        if (btnDown) {
            cursor = 'grabbing';
            el.classList.add('cursor-grabbing');
        } else {
            cursor = 'grab';
            el.classList.add('cursor-grab');
        }
    } else if (currentMode === 'text') {
        cursor = 'text';
        el.classList.add('cursor-text');
    } else if (currentMode === 'draw') {
        cursor = 'crosshair';
        el.classList.add('cursor-crosshair');
    }

    // Mantém o Fabric sincronizado internamente também
    canvas.defaultCursor = cursor;
    canvas.setCursor(cursor);
    canvas.requestRenderAll();
}

function updateBrush() {
    if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = currentColor;
    canvas.freeDrawingBrush.width = currentWidth;
}

function updateActiveObjectStyle() {
    const active = canvas.getActiveObject();
    if (active) {
        if (active.type === 'i-text') active.set('fill', currentColor);
        else if (active.set) {
            if (active.stroke) active.set('stroke', currentColor);
            if (active.fill && active.fill !== 'transparent' && active.type !== 'image') active.set('fill', currentColor);
        }
        canvas.requestRenderAll();
    }
}

export function getCurrentState() {
    return { mode: currentMode, color: currentColor, width: currentWidth };
}