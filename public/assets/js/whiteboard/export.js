import { canvas } from './canvas.js';

export function initializeExport() {
    document.getElementById('btn-export').addEventListener('click', () => {
        canvas.discardActiveObject(); 
        canvas.renderAll();
        
        const objs = canvas.getObjects();
        if(!objs.length) return alert("Board vazio.");

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        objs.forEach(o => {
            const b = o.getBoundingRect();
            if(b.left < minX) minX = b.left;
            if(b.top < minY) minY = b.top;
            if(b.left+b.width > maxX) maxX = b.left+b.width;
            if(b.top+b.height > maxY) maxY = b.top+b.height;
        });

        const pad = 50;
        const dataURL = canvas.toDataURL({
            format: 'jpeg', quality: 0.9, 
            left: Math.max(0, minX - pad), top: Math.max(0, minY - pad),
            width: (maxX - minX) + (pad * 2), height: (maxY - minY) + (pad * 2),
            enableRetinaScaling: true
        });

        const link = document.createElement('a');
        link.download = `whiteboard-export-${Date.now()}.jpg`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}