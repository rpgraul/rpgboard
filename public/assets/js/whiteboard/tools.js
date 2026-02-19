import { canvas } from './canvas.js';

let currentMode = 'select';
let lastActiveMode = 'select'; // Armazena a ferramenta anterior ao "Move" temporário
let currentColor = '#000000';
let currentWidth = 3;
let currentFont = 'Arial';
let textBgActive = false;
let brushOpacity = 1;
let brushStyle = 'solid'; // 'solid', 'dashed'
let shapeFillType = 'border'; // 'border', 'solid'

export function initializeTools() {
    const colorPickers = document.querySelectorAll('.color-picker');
    const widthSliders = document.querySelectorAll('.slider');
    const btns = document.querySelectorAll('.tool-btn[data-tool]');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.tool;
            lastActiveMode = mode; // Atualiza a ferramenta base
            setMode(mode);
        });
    });

    colorPickers.forEach(picker => {
        picker.addEventListener('input', (e) => {
            currentColor = e.target.value;
            // Sincronizar todos os seletores de cor
            colorPickers.forEach(p => p.value = currentColor);
            updateActiveObjectStyle();
            updateBrush();
        });
    });

    widthSliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            currentWidth = parseInt(e.target.value, 10);
            // Sincronizar todos os sliders de largura
            widthSliders.forEach(s => s.value = currentWidth);
            updateActiveObjectStyle();
            updateBrush();
        });
    });

    // New Text Tools
    const fontSelect = document.getElementById('wb-font-family');
    const bgBtn = document.getElementById('btn-text-bg');

    if (fontSelect) {
        fontSelect.addEventListener('change', (e) => {
            currentFont = e.target.value;
            updateActiveObjectStyle();
        });
    }

    if (bgBtn) {
        bgBtn.addEventListener('click', () => {
            textBgActive = !textBgActive;
            bgBtn.dataset.active = textBgActive;
            if (textBgActive) {
                bgBtn.classList.remove('is-light');
                bgBtn.classList.add('is-info');
            } else {
                bgBtn.classList.add('is-light');
                bgBtn.classList.remove('is-info');
            }
            updateActiveObjectStyle();
        });
    }

    // New Shape Tools (Fill Type)
    const shapeFillBtns = document.querySelectorAll('.shape-fill-btn');
    shapeFillBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            shapeFillBtns.forEach(b => {
                b.classList.remove('is-info', 'is-selected');
                b.classList.add('is-light');
            });
            btn.classList.add('is-info', 'is-selected');
            btn.classList.remove('is-light');
            shapeFillType = btn.dataset.fill;
            updateActiveObjectStyle();
        });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        const activeTags = ['INPUT', 'TEXTAREA'];
        if (activeTags.includes(document.activeElement.tagName)) return;
        if (canvas.getActiveObject() && canvas.getActiveObject().isEditing) return;

        switch (e.key.toLowerCase()) {
            case 'v': setMode('select'); break;
            case 'p': setMode('draw'); break;
            case 't': setMode('text'); break;
            case 's': setMode('shape'); break;
        }
    });

    // New Brush Tools
    const opacitySlider = document.getElementById('wb-opacity-draw');
    const styleBtns = document.querySelectorAll('.style-btn');

    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            brushOpacity = parseFloat(e.target.value);
            updateBrush();
        });
    }

    styleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            styleBtns.forEach(b => {
                b.classList.remove('is-info', 'is-selected');
                b.classList.add('is-light');
            });
            btn.classList.add('is-info', 'is-selected');
            btn.classList.remove('is-light');
            brushStyle = btn.dataset.style;
            updateBrush();
        });
    });
}

export function setMode(mode, isTemporary = false) {
    currentMode = mode;

    // Feedback Visual na Sidebar
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('is-active'));
    const activeBtn = document.querySelector(`.tool-btn[data-tool="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('is-active');

    // Show/Hide Floating Panels
    updatePanels(mode);

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

    // Hex to RGBA for opacity
    const color = new fabric.Color(currentColor);
    color.setAlpha(brushOpacity);
    canvas.freeDrawingBrush.color = color.toRgba();

    canvas.freeDrawingBrush.width = currentWidth;

    // Dashed line support
    if (brushStyle === 'dashed') {
        canvas.freeDrawingBrush.strokeDashArray = [currentWidth * 3, currentWidth * 3];
    } else {
        canvas.freeDrawingBrush.strokeDashArray = null;
    }
}

function updatePanels(mode) {
    document.querySelectorAll('.wb-options-panel').forEach(p => p.style.display = 'none');

    if (mode === 'draw') {
        const p = document.getElementById('options-panel-draw');
        if (p) p.style.display = 'flex';
    } else if (mode === 'text') {
        const p = document.getElementById('options-panel-text');
        if (p) p.style.display = 'flex';
    } else if (mode === 'shape') {
        const p = document.getElementById('options-panel-shape');
        if (p) p.style.display = 'flex';
    }
}

function updateActiveObjectStyle() {
    const active = canvas.getActiveObject();
    if (active) {
        if (active.type === 'i-text') {
            active.set('fill', currentColor);
            active.set('fontFamily', currentFont);
            active.set('backgroundColor', textBgActive ? '#f1c40f' : '');
        } else if (active.set) {
            if (active.stroke) active.set('stroke', currentColor);
            if (active.fill && active.fill !== 'transparent' && active.type !== 'image') active.set('fill', currentColor);
        }
        canvas.requestRenderAll();
    }
}

export function getCurrentState() {
    return {
        mode: currentMode,
        color: currentColor,
        width: currentWidth,
        font: currentFont,
        textBg: textBgActive,
        opacity: brushOpacity,
        style: brushStyle,
        shapeFill: shapeFillType
    };
}