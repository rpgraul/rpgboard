import * as shortcodeParser from './shortcodeParser.js';

export function openModal(e) {
  e && e.classList.add("is-active");
}
export function closeModal(e) {
  e && e.classList.remove("is-active");
}
function closeAllModals() {
  (document.querySelectorAll(".modal") || []).forEach(closeModal);
}
export function initializeModals() {
  (
    document.querySelectorAll(
      ".modal-background, .modal-close, .delete, .modal-cancel"
    ) || []
  ).forEach((e) => {
    const o = e.closest(".modal");
    o && e.addEventListener("click", () => closeModal(o));
  }),
    document.addEventListener("keydown", (e) => {
      "Escape" === e.key && closeAllModals();
    });
}

export function showDetailModal(item) {
    if (!item) return;
    
    // Encontra ou cria dinamicamente o modal global
    let modal = document.getElementById('detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'detail-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-background"></div>
            <div class="modal-content"></div>
            <button class="modal-close is-large" aria-label="close"></button>
        `;
        document.getElementById('app-overlays')?.appendChild(modal) || document.body.appendChild(modal);
        
        // Adiciona evento de fechar a este novo modal
        modal.querySelectorAll('.modal-background, .modal-close').forEach(el => {
            el.addEventListener('click', () => closeModal(modal));
        });
    }

    const content = modal.querySelector('.modal-content');
    if (content) {
        content.innerHTML = '';
        const box = document.createElement('div');
        box.className = 'box';
        
        const parsed = shortcodeParser.parseAllShortcodes(item);
        const allShortcodes = (parsed.left || '') + (parsed.right || '') + (parsed.bottom || '') + (parsed.details || '');
        
        box.innerHTML = `
            ${item.url ? `<div class="modal-image-container mb-4"><img src="${item.url}" alt="${item.titulo}" style="max-height: 400px; object-fit: contain;"></div>` : ''}
            <div class="modal-text-container">
                <h2 class="title is-3">${item.titulo || 'Sem Título'}</h2>
                <div class="content">${item.conteudo ? shortcodeParser.parseMainContent(item.conteudo) : ''}</div>
                ${allShortcodes ? `<div class="content modal-shortcodes">${allShortcodes}</div>` : ''}
                ${item.descricao ? `<hr><div class="content is-small"><strong>Descrição:</strong><br>${item.descricao.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
        `;
        content.appendChild(box);
    } else {
        // Fallback for older hardcoded structures like in text-mode.html/sheet-mode.html
        const titleEl = document.getElementById('detail-title');
        const bodyEl = document.getElementById('detail-body');
        if (titleEl) titleEl.textContent = item.titulo || 'Sem Título';
        if (bodyEl) {
            let html = "";
            if (item.url) html += `<figure class="image mb-4"><img src="${item.url}" alt="${item.titulo}" style="max-height: 400px; object-fit: contain;"></figure>`;
            html += `<div class="content">${item.conteudo ? shortcodeParser.parseMainContent(item.conteudo) : ''}</div>`;
            const sc = shortcodeParser.parseAllShortcodes(item);
            if (sc.all.length > 0) {
                html += `<div class="box mt-4 has-background-dark">
                    <div class="columns is-multiline is-mobile">
                        <div class="column is-narrow">${sc.left}</div>
                        <div class="column is-narrow">${sc.right}</div>
                        <div class="column is-12">${sc.bottom}</div>
                    </div>
                </div>`;
            }
            bodyEl.innerHTML = html;
        }
    }
    
    openModal(modal);
}
