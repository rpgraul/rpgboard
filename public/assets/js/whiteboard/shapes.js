import { canvas } from './canvas.js';
import { getCurrentState, setMode } from './tools.js';

let currentShapeType = 'rect';
let isDrawing = false;
let origX = 0, origY = 0;
let activeShape = null;

export function initializeShapes() {
    const shapeBtns = document.querySelectorAll('.shape-option');
    const shapeGroupBtn = document.getElementById('btn-shape-group');
    const iconMap = { 
        'rect': 'fa-square', 'circle': 'fa-circle', 
        'triangle': 'fa-play', 'arrow': 'fa-long-arrow-alt-right' 
    };

    shapeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentShapeType = btn.dataset.shape;
            document.getElementById('current-shape-icon').className = `fas ${iconMap[currentShapeType]}`;
            if(currentShapeType === 'triangle') document.getElementById('current-shape-icon').style.transform = 'rotate(-90deg)';
            else document.getElementById('current-shape-icon').style.transform = '';
            
            setMode('shape'); // Modo "dummy" apenas para UI, logicamente tratamos no canvas event
        });
    });

    shapeGroupBtn.addEventListener('click', () => setMode('shape'));

    // Canvas Events
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
}

function onMouseDown(o) {
    const state = getCurrentState();
    const pointer = canvas.getPointer(o.e);

    // Texto
    if (state.mode === 'text') {
        const text = new fabric.IText('Texto', {
            left: pointer.x, top: pointer.y,
            fill: state.color, fontSize: 24, fontFamily: 'Arial'
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        setMode('select');
        return;
    }

    // Formas
    if (state.mode === 'shape') {
        isDrawing = true;
        origX = pointer.x;
        origY = pointer.y;
        const { color, width } = state;

        if (currentShapeType === 'rect') {
            activeShape = new fabric.Rect({
                left: origX, top: origY, width: 0, height: 0,
                fill: 'transparent', stroke: color, strokeWidth: width
            });
        } else if (currentShapeType === 'circle') {
            activeShape = new fabric.Circle({
                left: origX, top: origY, radius: 0,
                fill: 'transparent', stroke: color, strokeWidth: width,
                originX: 'center', originY: 'center'
            });
        } else if (currentShapeType === 'triangle') {
            activeShape = new fabric.Triangle({
                left: origX, top: origY, width: 0, height: 0,
                fill: 'transparent', stroke: color, strokeWidth: width
            });
        } else if (currentShapeType === 'arrow') {
            activeShape = new fabric.Line([origX, origY, origX, origY], {
                stroke: color, strokeWidth: width, selectable: false, evented: false
            });
        }

        if (activeShape) canvas.add(activeShape);
    }
}

function onMouseMove(o) {
    if (!isDrawing || !activeShape) return;
    const pointer = canvas.getPointer(o.e);

    if (currentShapeType === 'arrow') {
        activeShape.set({ x2: pointer.x, y2: pointer.y });
    } else if (currentShapeType === 'circle') {
        const dist = Math.sqrt(Math.pow(pointer.x - origX, 2) + Math.pow(pointer.y - origY, 2));
        activeShape.set({ radius: dist / 2 });
    } else {
        if(origX > pointer.x) activeShape.set({ left: pointer.x });
        if(origY > pointer.y) activeShape.set({ top: pointer.y });
        activeShape.set({
            width: Math.abs(origX - pointer.x),
            height: Math.abs(origY - pointer.y)
        });
    }
    canvas.renderAll();
}

function onMouseUp() {
    if (isDrawing) {
        isDrawing = false;
        const { color, width } = getCurrentState();

        if (currentShapeType === 'arrow' && activeShape) {
            const line = activeShape;
            canvas.remove(line);
            
            const dx = line.x2 - line.x1;
            const dy = line.y2 - line.y1;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const headLen = 15 + width;

            const arrowHead = new fabric.Triangle({
                left: line.x2, top: line.y2, originX: 'center', originY: 'center',
                angle: angle + 90, width: headLen, height: headLen, fill: color
            });

            const arrowLine = new fabric.Line([line.x1, line.y1, line.x2, line.y2], {
                stroke: color, strokeWidth: width, originX: 'center', originY: 'center'
            });

            const group = new fabric.Group([arrowLine, arrowHead], { selectable: true });
            canvas.add(group);
            canvas.setActiveObject(group);
        } else if (activeShape) {
            activeShape.setCoords();
            canvas.setActiveObject(activeShape);
        }
        activeShape = null;
    }
}