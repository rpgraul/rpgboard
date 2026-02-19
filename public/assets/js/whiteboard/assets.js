import { canvas } from './canvas.js';
import { setMode } from './tools.js';

export function initializeAssets() {
    const scrollArea = document.getElementById('wb-scroll-area');
    const fileInput = document.getElementById('file-upload-input');
    const btnUpload = document.getElementById('btn-image-upload');
    const btnAssets = document.getElementById('btn-assets-toggle');
    const assetsDrawer = document.getElementById('assets-drawer');

    // Button trigger
    if (btnUpload && fileInput) {
        btnUpload.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleImageFile(file);
            fileInput.value = ''; // Reset
        });
    }

    if (btnAssets && assetsDrawer) {
        btnAssets.addEventListener('click', () => {
            assetsDrawer.classList.toggle('is-open');
            btnAssets.classList.toggle('is-active');
        });
    }

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
            // Drag da Sidebar (URL)
            fabric.Image.fromURL(imgUrl, (img) => {
                img.set({
                    left: x, top: y, originX: 'center', originY: 'center'
                });
                if (img.width > 300) img.scaleToWidth(300);
                canvas.add(img);
                canvas.setActiveObject(img);
                setMode('select');
            });
        } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // Drag do Desktop (File)
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                handleImageFile(file, x, y);
            }
        }
    });

    // Paste (Ctrl+V)
    window.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.includes('image/')) {
                const blob = item.getAsFile();
                handleImageFile(blob);
            }
        }
    });
}

function handleImageFile(file, left, top) {
    const reader = new FileReader();
    reader.onload = (event) => {
        fabric.Image.fromURL(event.target.result, (img) => {
            // Se não passar posição, centraliza
            const finalLeft = left !== undefined ? left : canvas.width / 2;
            const finalTop = top !== undefined ? top : canvas.height / 2;

            // Ajustar para coordenadas do viewport se estivermos sem posição específica (ex: upload botão)
            // Mas aqui left/top já vem ajustados do drop ou undefined.
            // Para o botão, usamos o centro da view atual.

            let targetL = finalLeft;
            let targetT = finalTop;

            if (left === undefined) {
                const vpt = canvas.viewportTransform;
                // Centro da tela visível (aproximado)
                targetL = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
                targetT = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];
            }

            img.set({
                left: targetL, top: targetT,
                originX: 'center', originY: 'center'
            });

            if (img.width > 500) img.scaleToWidth(500);
            canvas.add(img);
            canvas.setActiveObject(img);
            setMode('select');
        });
    };
    reader.readAsDataURL(file);
}