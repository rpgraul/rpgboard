
export function initializeContextMenu(canvas) {
    const menu = document.getElementById('wb-context-menu');
    const btnFront = menu.querySelector('[data-action="front"]');
    const btnBack = menu.querySelector('[data-action="back"]');
    const btnLock = menu.querySelector('[data-action="lock"]');
    const btnDelete = menu.querySelector('[data-action="delete"]');

    let activeObject = null;

    // Show Menu
    canvas.upperCanvasEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // Find target
        const pointer = canvas.getPointer(e);
        const objects = canvas.getObjects();
        // Simple hit test for top-most object if not active
        // Fabric's findTarget is better
        const target = canvas.findTarget(e, false);

        if (target) {
            canvas.setActiveObject(target);
            activeObject = target;
        } else {
            activeObject = canvas.getActiveObject();
        }

        if (activeObject) {
            menu.style.display = 'flex';
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
        } else {
            menu.style.display = 'none';
        }
    });

    // Hide Menu on click anywhere
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });

    // Actions
    btnFront.onclick = () => {
        if (activeObject) {
            activeObject.bringToFront();
            canvas.discardActiveObject();
            canvas.renderAll();
            saveHistory();
        }
        menu.style.display = 'none';
    };

    btnBack.onclick = () => {
        if (activeObject) {
            activeObject.sendToBack();
            canvas.discardActiveObject();
            canvas.renderAll();
            saveHistory();
        }
        menu.style.display = 'none';
    };

    btnLock.onclick = () => {
        if (activeObject) {
            const isLocked = activeObject.lockMovementX;
            const newVal = !isLocked;

            activeObject.set({
                lockMovementX: newVal,
                lockMovementY: newVal,
                lockRotation: newVal,
                lockScalingX: newVal,
                lockScalingY: newVal
            });

            // Visual feedback (optional selection color change)
            activeObject.set('borderColor', newVal ? 'red' : 'blue');

            canvas.renderAll();
            saveHistory();
        }
        menu.style.display = 'none';
    };

    btnDelete.onclick = () => {
        if (activeObject) {
            canvas.remove(activeObject);
            canvas.discardActiveObject();
            canvas.renderAll();
            canvas.fire('object:removed'); // Triggers history save in listener
        }
        menu.style.display = 'none';
    };

    function saveHistory() {
        // Fire event to trigger history.js listener
        canvas.fire('object:modified');
    }
}
