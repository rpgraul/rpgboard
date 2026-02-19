import { canvas } from './canvas.js';
import { setMode } from './tools.js';

let _clipboard = null;

export function copy() {
    canvas.getActiveObject()?.clone((cloned) => {
        _clipboard = cloned;
    }, ['uid']); // Preserve original UID for reference (though we change it on paste)
}

export function paste() {
    if (!_clipboard) return;

    _clipboard.clone((clonedObj) => {
        canvas.discardActiveObject();
        clonedObj.set({
            left: clonedObj.left + 20,
            top: clonedObj.top + 20,
            evented: true,
            uid: window.generateUid() // NEW UNIQUE ID
        });

        if (clonedObj.type === 'activeSelection') {
            // active selection needs a fixed canvas ref
            clonedObj.canvas = canvas;
            clonedObj.forEachObject((obj) => {
                obj.set('uid', window.generateUid());
                canvas.add(obj);
            });
            clonedObj.setCoords();
        } else {
            canvas.add(clonedObj);
        }

        _clipboard.top += 20;
        _clipboard.left += 20;
        canvas.setActiveObject(clonedObj);
        canvas.requestRenderAll();
        canvas.fire('object:added');
        setMode('select');
    }, ['uid']);
}

export function duplicate() {
    const active = canvas.getActiveObject();
    if (!active) return;

    active.clone((cloned) => {
        canvas.discardActiveObject();
        cloned.set({
            left: cloned.left + 20,
            top: cloned.top + 20,
            evented: true,
            uid: window.generateUid()
        });

        if (cloned.type === 'activeSelection') {
            cloned.canvas = canvas;
            cloned.forEachObject((obj) => {
                obj.set('uid', window.generateUid());
                canvas.add(obj);
            });
            cloned.setCoords();
        } else {
            canvas.add(cloned);
        }

        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
        canvas.fire('object:added');
        setMode('select');
    }, ['uid']);
}
