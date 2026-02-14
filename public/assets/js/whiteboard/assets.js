import { canvas } from './canvas.js';
import { setMode } from './tools.js';

export function initializeAssets() {
    const scrollArea = document.getElementById('wb-scroll-area');
    
    // Drag Start (Sidebar)
    document.querySelectorAll('.asset-item').forEach(img => {
        img.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('imgUrl', img.src);
        });
    });

    // Drag Over (Canvas)
    scrollArea.addEventListener('dragover', (e) => e.preventDefault());

    // Drop (Canvas)
    scrollArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const imgUrl = e.dataTransfer.getData('imgUrl');
        
        // Calcular posição relativa ao canvas
        // O fabric usa 'upperCanvasEl' para eventos do mouse, usamos ele para offset
        const rect = canvas.upperCanvasEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (imgUrl) {
            fabric.Image.fromURL(imgUrl, (img) => {
                img.set({
                    left: x, top: y, originX: 'center', originY: 'center'
                });
                if (img.width > 300) img.scaleToWidth(300);
                canvas.add(img);
                canvas.setActiveObject(img);
                setMode('select');
            });
        }
    });

    // Paste (Ctrl+V)
    window.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.includes('image/')) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    fabric.Image.fromURL(event.target.result, (img) => {
                        img.set({
                            left: canvas.width / 2, top: canvas.height / 2,
                            originX: 'center', originY: 'center'
                        });
                        if (img.width > 500) img.scaleToWidth(500);
                        canvas.add(img);
                        canvas.setActiveObject(img);
                    });
                };
                reader.readAsDataURL(blob);
            }
        }
    });
}