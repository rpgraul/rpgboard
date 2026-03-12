import { canvas } from './canvas.js';
import * as clipboard from './clipboard.js';

let currentMode = 'select';
let lastActiveMode = 'select'; // Armazena a ferramenta anterior ao "Move" temporário
let currentColor = '#000000';
let currentWidth = 3;
let currentFont = 'Arial';
let textBgActive = false;
let textBgColor = '#f1c40f';
let brushOpacity = 1;
let brushStyle = 'solid'; // 'solid', 'dashed'
let shapeFillType = 'border'; // 'border', 'solid'

const DEFAULT_PRESETS = ['#000000', '#ffffff', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
let colorPresets = [];

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
            syncColors();
        });
    });

    loadColorPresets();

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
    const bgToggle = document.getElementById('wb-text-bg-toggle');
    const bgColorInput = document.getElementById('wb-color-text-bg');

    if (fontSelect) {
        fontSelect.addEventListener('change', (e) => {
            currentFont = e.target.value;
            updateActiveObjectStyle();
        });
    }

    if (bgToggle) {
        bgToggle.addEventListener('click', (e) => {
            textBgActive = !textBgActive;
            bgToggle.classList.toggle('is-info', textBgActive);
            updateActiveObjectStyle();
        });
    }

    if (bgColorInput) {
        bgColorInput.addEventListener('input', (e) => {
            textBgColor = e.target.value;
            if (textBgActive) updateActiveObjectStyle();
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
            case 't': if (!e.shiftKey) setMode('text'); break;
            case 's': if (!e.shiftKey) setMode('shape'); break;
        }

        // Shortcuts for size and style (only if specific tools are active or something is selected)
        if (['draw', 'shape', 'text'].includes(currentMode) || canvas.getActiveObject()) {
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                currentWidth = Math.min(50, currentWidth + 1);
                document.querySelectorAll('.slider').forEach(s => s.value = currentWidth);
                updateActiveObjectStyle();
                updateBrush();
            } else if (e.key === '-') {
                e.preventDefault();
                currentWidth = Math.max(1, currentWidth - 1);
                document.querySelectorAll('.slider').forEach(s => s.value = currentWidth);
                updateActiveObjectStyle();
                updateBrush();
            }
        }

        // Toggles for Solid / Dashed / Fill (Shift+S, Shift+T)
        if (e.key === 'S' || (e.shiftKey && e.key.toLowerCase() === 's')) {
            e.preventDefault();
            if (currentMode === 'draw' || (canvas.getActiveObject() && canvas.getActiveObject().type === 'path')) {
                brushStyle = 'solid';
                document.querySelectorAll('.style-btn').forEach(b => {
                    if (b.dataset.style === 'solid') b.classList.add('is-info', 'is-selected'), b.classList.remove('is-light');
                    else b.classList.remove('is-info', 'is-selected'), b.classList.add('is-light');
                });
                updateBrush();
            } else if (currentMode === 'shape' || (canvas.getActiveObject() && ['rect', 'circle', 'triangle'].includes(canvas.getActiveObject().type))) {
                shapeFillType = 'solid';
                document.querySelectorAll('.shape-fill-btn').forEach(b => {
                    if (b.dataset.fill === 'solid') b.classList.add('is-info', 'is-selected'), b.classList.remove('is-light');
                    else b.classList.remove('is-info', 'is-selected'), b.classList.add('is-light');
                });
                updateActiveObjectStyle();
            }
        }

        if (e.key === 'T' || (e.shiftKey && e.key.toLowerCase() === 't')) {
            e.preventDefault();
            if (currentMode === 'draw' || (canvas.getActiveObject() && canvas.getActiveObject().type === 'path')) {
                brushStyle = 'dashed';
                document.querySelectorAll('.style-btn').forEach(b => {
                    if (b.dataset.style === 'dashed') b.classList.add('is-info', 'is-selected'), b.classList.remove('is-light');
                    else b.classList.remove('is-info', 'is-selected'), b.classList.add('is-light');
                });
                updateBrush();
            } else if (currentMode === 'shape' || (canvas.getActiveObject() && ['rect', 'circle', 'triangle'].includes(canvas.getActiveObject().type))) {
                shapeFillType = 'border';
                document.querySelectorAll('.shape-fill-btn').forEach(b => {
                    if (b.dataset.fill === 'border') b.classList.add('is-info', 'is-selected'), b.classList.remove('is-light');
                    else b.classList.remove('is-info', 'is-selected'), b.classList.add('is-light');
                });
                updateActiveObjectStyle();
            }
        }

        // Clipboard
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'c') clipboard.copy();
            if (e.key === 'v') clipboard.paste();
            if (e.key === 'd') {
                e.preventDefault();
                clipboard.duplicate();
            }
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
            active.set('backgroundColor', textBgActive ? textBgColor : '');
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
        textBgColor: textBgColor,
        opacity: brushOpacity,
        style: brushStyle,
        shapeFill: shapeFillType
    };
}

function syncColors() {
    document.querySelectorAll('.color-picker').forEach(p => p.value = currentColor);
    updateActiveObjectStyle();
    updateBrush();
}

function loadColorPresets() {
    try {
        const saved = localStorage.getItem('wb_color_presets');
        if (saved) colorPresets = JSON.parse(saved);
        else colorPresets = [...DEFAULT_PRESETS];
    } catch {
        colorPresets = [...DEFAULT_PRESETS];
    }
    renderAllColorPresets();
}

function saveColorPresets() {
    localStorage.setItem('wb_color_presets', JSON.stringify(colorPresets));
}

function renderAllColorPresets() {
    ['draw', 'text', 'shape', 'text-bg'].forEach(type => {
        const container = document.getElementById(`presets-${type}`);
        if (!container) return;
        
        container.innerHTML = '';
        
        colorPresets.forEach((color, index) => {
            const btn = document.createElement('button');
            btn.className = 'color-preset-btn';
            btn.style.backgroundColor = color;
            btn.title = 'Clique para usar. Botão direito para remover.';
            
            btn.onclick = () => {
                if (type === 'text-bg') {
                    textBgColor = color;
                    document.getElementById('wb-color-text-bg').value = textBgColor;
                    if (textBgActive) updateActiveObjectStyle();
                } else {
                    currentColor = color;
                    syncColors();
                }
            };
            
            btn.oncontextmenu = (e) => {
                e.preventDefault();
                colorPresets.splice(index, 1);
                saveColorPresets();
                renderAllColorPresets();
            };
            
            container.appendChild(btn);
        });
        
        const addBtn = document.createElement('button');
        addBtn.className = 'color-preset-add';
        addBtn.innerHTML = '<i class="fas fa-plus"></i>';
        addBtn.title = 'Adicionar cor atual aos presets';
        addBtn.onclick = () => {
            const colorToAdd = (type === 'text-bg') ? textBgColor : currentColor;
            if (!colorPresets.includes(colorToAdd)) {
                colorPresets.push(colorToAdd);
                saveColorPresets();
                renderAllColorPresets();
            }
        };
        
        container.appendChild(addBtn);
    });
}