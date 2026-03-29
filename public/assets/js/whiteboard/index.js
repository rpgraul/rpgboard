import { initializeCanvas, clearCanvas, canvas } from './canvas.js';
import { initializeTools } from './tools.js';
import { initializeShapes } from './shapes.js';
import { initializeAssets } from './assets.js';
import { initializeBoardManager } from './boardManager.js';
import { initializeExport } from './export.js';
import { initializeHistory } from './history.js';
import { initializeContextMenu } from './contextMenu.js';

export async function initWhiteboard() {
    console.log("Inicializando Whiteboard Modular...");

    // Aguardar carregar fabric.js antes de inicializar o canvas
    if (window.__loadFabric) {
        console.log("[Whiteboard] Carregando Fabric.js...");
        await window.__loadFabric();
        console.log("[Whiteboard] Fabric.js carregado!");
    }

    // A ordem importa: Canvas -> Tools/Shapes -> History -> BoardManager
    initializeCanvas('c', 'wb-scroll-area');
    initializeTools();
    initializeShapes();
    initializeAssets();
    initializeHistory();
    initializeBoardManager();
    initializeExport();
    initializeContextMenu(canvas);

    document.getElementById('btn-clear').addEventListener('click', clearCanvas);

    // Delete Key Listener
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Avoid deleting if user is typing in an input or text object
            const activeElement = document.activeElement;
            const isInput = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
            const isEditingText = canvas.getActiveObject() && canvas.getActiveObject().isEditing;

            if (!isInput && !isEditingText) {
                e.preventDefault();
                const activeObjects = canvas.getActiveObjects();
                if (activeObjects.length) {
                    canvas.discardActiveObject();
                    activeObjects.forEach((obj) => {
                        canvas.remove(obj);
                    });
                    // Force history save
                    canvas.fire('object:removed');
                }
            }
        }
    });
}