import { initializeCanvas, clearCanvas } from './canvas.js';
import { initializeTools } from './tools.js';
import { initializeShapes } from './shapes.js';
import { initializeAssets } from './assets.js';
import { initializeBoardManager } from './boardManager.js';
import { initializeExport } from './export.js';
import { initializeHistory } from './history.js';

export function initWhiteboard() {
    console.log("Inicializando Whiteboard Modular...");
    
    // A ordem importa: Canvas -> Tools/Shapes -> History -> BoardManager
    initializeCanvas('c', 'wb-scroll-area');
    initializeTools();
    initializeShapes();
    initializeAssets();
    initializeHistory(); 
    initializeBoardManager();
    initializeExport();

    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
}