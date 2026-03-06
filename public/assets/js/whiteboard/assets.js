import { canvas } from './canvas.js';
import { setMode } from './tools.js';
import { uploadImageToImgBB, listenToItems, listenToWhiteboardAssets, addWhiteboardAsset, deleteWhiteboardAsset } from '../modules/firebaseService.js';
import { showToast } from '../modules/ui.js';

export function initializeAssets() {
    const scrollArea = document.getElementById('wb-scroll-area');
    const fileInput = document.getElementById('file-upload-input');
    const btnUpload = document.getElementById('btn-image-upload');
    const btnAssets = document.getElementById('btn-assets-toggle');
    const assetsDrawer = document.getElementById('assets-drawer');

    // Tab Elements
    const tabs = assetsDrawer ? assetsDrawer.querySelectorAll('.tabs li') : [];
    const tabContents = assetsDrawer ? assetsDrawer.querySelectorAll('.content-tab') : [];
    const cardsList = document.getElementById('assets-cards-list');
    const searchInput = document.getElementById('assets-card-search');
    const resourcesList = document.getElementById('assets-resources-list');
    const btnResourceUpload = document.getElementById('btn-assets-resource-upload');

    // Tab Switching Logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('is-active'));
            tab.classList.add('is-active');
            const target = tab.dataset.tab;
            tabContents.forEach(content => {
                if (content.id === `tab-${target}`) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
        });
    });

    // Handle Cards Tab
    let allCards = [];
    let prevCardUrls = {}; // cardId -> url cache for diff

    listenToItems((snapshot) => {
        const updated = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sync canvas images if any card URL changed
        updated.forEach(card => {
            if (card.url && prevCardUrls[card.id] && prevCardUrls[card.id] !== card.url) {
                canvas.getObjects().filter(o => o.type === 'group' && o.cardId === card.id).forEach(group => {
                    const textObj = (group._objects || []).find(o => o.type === 'i-text');
                    const titleText = textObj ? textObj.text : '';

                    // Save current transform
                    const left = group.left;
                    const top = group.top;
                    const angle = group.angle;
                    const scaleX = group.scaleX;
                    const scaleY = group.scaleY;
                    const cardId = group.cardId;
                    const uid = group.uid;

                    canvas.remove(group);

                    fabric.Image.fromURL(card.url, (img) => {
                        if (img.width > 300) img.scaleToWidth(300);

                        // Center image at origin so Fabric group math works
                        img.set({ left: 0, top: 0, originX: 'center', originY: 'center' });

                        const text = new fabric.IText(titleText, {
                            left: 0,
                            top: (img.getScaledHeight() / 2) + 5,
                            originX: 'center',
                            originY: 'top',
                            fontSize: 18,
                            fontFamily: 'Roboto',
                            fill: '#000000',
                            fontWeight: 'normal',
                            editable: true
                        });

                        const newGroup = new fabric.Group([img, text], {
                            left, top, angle, scaleX, scaleY,
                            originX: 'center', originY: 'center',
                            cardId, uid: uid || window.generateUid()
                        });

                        canvas.add(newGroup);
                        canvas.requestRenderAll();
                    }, { crossOrigin: 'anonymous' });
                });
            }
            prevCardUrls[card.id] = card.url || null;
        });

        allCards = updated;
        renderCards(allCards);
    });

    const renderCards = (cards) => {
        if (!cardsList) return;
        cardsList.innerHTML = '';
        if (cards.length === 0) {
            cardsList.innerHTML = '<div class="has-text-centered p-2 has-text-grey"><small>Nenhum card encontrado.</small></div>';
            return;
        }
        cards.forEach(card => {
            if (!card.url) return; // Only show cards with images
            const container = document.createElement('div');
            container.className = 'assets-item-container';
            container.style.cssText = 'width: 80px; text-align: center; cursor: grab;';
            container.draggable = true;

            const img = document.createElement('img');
            img.src = card.url;
            img.title = card.titulo || 'Card';
            img.style.cssText = 'width: 100%; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #333; pointer-events: none;';

            const title = document.createElement('div');
            title.textContent = card.titulo || 'Card';
            title.style.cssText = 'font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; opacity: 0.8;';

            container.appendChild(img);
            container.appendChild(title);

            container.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('imgUrl', card.url);
                e.dataTransfer.setData('cardTitle', card.titulo || 'Card');
                e.dataTransfer.setData('cardId', card.id);
            });

            cardsList.appendChild(container);
        });
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allCards.filter(c => (c.titulo || '').toLowerCase().includes(term));
            renderCards(filtered);
        });
    }

    // Handle Resources Tab
    listenToWhiteboardAssets((snapshot) => {
        if (!resourcesList) return;
        resourcesList.innerHTML = '';
        if (snapshot.docs.length === 0) {
            resourcesList.innerHTML = '<div class="has-text-centered p-2 has-text-grey"><small>Nenhum recurso.</small></div>';
            return;
        }

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const resContainer = document.createElement('div');
            resContainer.style.cssText = 'position: relative; width: 60px; height: 60px; margin: 2px;';

            const img = document.createElement('img');
            img.src = data.url;
            img.className = 'asset-item';
            img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; cursor: grab; padding: 2px;';
            img.draggable = true;
            img.title = data.name || 'Recurso';

            img.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('imgUrl', data.url);
                // No cardTitle means it drops as isolated image resource
            });

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<i class="fas fa-times"></i>';
            delBtn.style.cssText = 'position: absolute; top: 0; right: 0; background: rgba(255,50,50,0.8); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: none; padding: 0; display: flex; align-items: center; justify-content: center;';

            resContainer.addEventListener('mouseenter', () => delBtn.style.display = 'flex');
            resContainer.addEventListener('mouseleave', () => delBtn.style.display = 'none');

            delBtn.addEventListener('click', () => {
                if (confirm('Excluir este recurso permanentemente?')) {
                    deleteWhiteboardAsset(doc.id);
                }
            });

            resContainer.appendChild(img);
            resContainer.appendChild(delBtn);
            resourcesList.appendChild(resContainer);
        });
    });

    // Upload resource button
    if (btnResourceUpload && fileInput) {
        btnResourceUpload.addEventListener('click', () => {
            const oldHandler = fileInput.onchange;
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        showToast("Subindo recurso...", "is-info");
                        const { url } = await uploadImageToImgBB(file);
                        await addWhiteboardAsset(url, file.name || 'recurso');
                        showToast("Recurso salvo!", "is-success");
                    } catch (err) {
                        console.error(err);
                        showToast("Erro ao subir recurso.", "is-danger");
                    }
                }
                fileInput.value = '';
                // Restore original handler for main toolbar image upload
                fileInput.onchange = oldHandler ? oldHandler : (evt) => {
                    const f = evt.target.files[0];
                    if (f) handleImageFile(f);
                    fileInput.value = '';
                };
            };
            fileInput.click();
        });
    }

    // Main toolbar Image Add button
    if (btnUpload && fileInput) {
        btnUpload.addEventListener('click', () => {
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) handleImageFile(file);
                fileInput.value = '';
            };
            fileInput.click();
        });
    }

    // Drawer Toggle
    if (btnAssets && assetsDrawer) {
        btnAssets.addEventListener('click', () => {
            const isOpen = assetsDrawer.classList.toggle('is-open');
            btnAssets.classList.toggle('is-active');

            if (isOpen) {
                setMode('select');
                document.querySelectorAll('.wb-options-panel').forEach(p => p.style.display = 'none');
            }
        });
    }

    // Drag Over (Canvas)
    if (scrollArea) {
        scrollArea.addEventListener('dragover', (e) => e.preventDefault());

        // Drop (Canvas)
        scrollArea.addEventListener('drop', (e) => {
            e.preventDefault();
            const imgUrl = e.dataTransfer.getData('imgUrl');
            const cardTitle = e.dataTransfer.getData('cardTitle');
            const cardId = e.dataTransfer.getData('cardId');

            const rect = canvas.upperCanvasEl.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (imgUrl) {
                fabric.Image.fromURL(imgUrl, (img) => {
                    // Set origin directly when dropping so x,y are accurate
                    img.set({
                        left: x, top: y, originX: 'center', originY: 'center',
                        uid: window.generateUid()
                    });
                    if (img.width > 300) img.scaleToWidth(300);

                    if (cardTitle) {
                        // Create text underneath
                        const text = new fabric.IText(cardTitle, {
                            left: x,
                            top: y + (img.getScaledHeight() / 2) + 5,
                            originX: 'center',
                            originY: 'top',
                            fontSize: 18,
                            fontFamily: 'Roboto',
                            fill: '#000000',
                            fontWeight: 'normal',
                            uid: window.generateUid(),
                            editable: true
                        });

                        const group = new fabric.Group([img, text], {
                            uid: window.generateUid(),
                            cardId: cardId // custom property to link with Firebase card
                        });

                        canvas.add(group);
                        canvas.setActiveObject(group);
                    } else {
                        canvas.add(img);
                        canvas.setActiveObject(img);
                    }

                    setMode('select');
                }, { crossOrigin: 'anonymous' });
            } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    handleImageFile(file, x, y);
                }
            }
        });
    }

    // Double-click to open card edit modal
    canvas.on('mouse:dblclick', async (e) => {
        const target = e.target;
        if (!target || target.type !== 'group' || !target.cardId) return;

        const card = allCards.find(c => c.id === target.cardId);
        if (!card) {
            console.warn('[Whiteboard] cardId não encontrado em allCards:', target.cardId);
            return;
        }

        const { openCardModal } = await import('../modules/cardModal.js');
        openCardModal(card);
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