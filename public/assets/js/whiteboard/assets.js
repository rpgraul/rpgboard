import { canvas } from './canvas.js';
import { setMode } from './tools.js';
import { uploadImageToImgBB } from '../modules/firebaseService.js';
import { showToast } from '../modules/ui.js';

export function initializeAssets() {
    const scrollArea = document.getElementById('wb-scroll-area');
    const fileInput = document.getElementById('file-upload-input');
    const btnUpload = document.getElementById('btn-image-upload');
    const btnAssets = document.getElementById('btn-assets-toggle');
    const assetsDrawer = document.getElementById('assets-drawer');
    const assetsList = document.getElementById('assets-list');

    // Populate gallery from /assets/asset/
    const defaultAssets = ['asset1.jpg', 'asset2.jpg'];
    if (assetsList) {
        assetsList.innerHTML = '';
        defaultAssets.forEach(name => {
            const img = document.createElement('img');
            img.src = `assets/asset/${name}`;
            img.className = 'asset-item';
            img.draggable = true;
            img.title = name;
            img.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('imgUrl', img.src);
            });
            assetsList.appendChild(img);
        });
    }

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
            const isOpen = assetsDrawer.classList.toggle('is-open');
            btnAssets.classList.toggle('is-active');

            if (isOpen) {
                setMode('select');
                // Close other panels (Visual only, tools.js handles selection logic)
                document.querySelectorAll('.wb-options-panel').forEach(p => p.style.display = 'none');
            }
        });
    }

    // Drag Over (Canvas)
    scrollArea.addEventListener('dragover', (e) => e.preventDefault());

    // Drop (Canvas)
    scrollArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const imgUrl = e.dataTransfer.getData('imgUrl');

        const rect = canvas.upperCanvasEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (imgUrl) {
            fabric.Image.fromURL(imgUrl, (img) => {
                img.set({
                    left: x, top: y, originX: 'center', originY: 'center',
                    uid: window.generateUid()
                });
                if (img.width > 300) img.scaleToWidth(300);
                canvas.add(img);
                canvas.setActiveObject(img);
                setMode('select');
            });
        } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                handleImageFile(file, x, y);
            }
        }
    });

    // Paste (Ctrl+V) handler for external images
    window.addEventListener('paste', (e) => {
        // Only handle if not typing in input
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

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

async function handleImageFile(file, left, top) {
    try {
        showToast("Subindo imagem...", "is-info");
        const { url } = await uploadImageToImgBB(file);

        fabric.Image.fromURL(url, (img) => {
            const finalLeft = left !== undefined ? left : canvas.width / 2;
            const finalTop = top !== undefined ? top : canvas.height / 2;

            let targetL = finalLeft;
            let targetT = finalTop;

            if (left === undefined) {
                const vpt = canvas.viewportTransform;
                targetL = (canvas.getWidth() / 2 - vpt[4]) / vpt[0];
                targetT = (canvas.getHeight() / 2 - vpt[5]) / vpt[3];
            }

            img.set({
                left: targetL, top: targetT,
                originX: 'center', originY: 'center',
                uid: window.generateUid()
            });

            if (img.width > 500) img.scaleToWidth(500);
            canvas.add(img);
            canvas.setActiveObject(img);
            setMode('select');
            showToast("Imagem adicionada!", "is-success");
        }, { crossOrigin: 'anonymous' }); // Critical for cloning/exporting
    } catch (e) {
        console.error(e);
        showToast("Erro ao subir imagem", "is-danger");
    }
}