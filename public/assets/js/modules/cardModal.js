/**
 * cardModal.js
 * Módulo standalone para o modal de criação/edição de cards.
 * Importa Tiptap via CDN (ESM). Funciona em qualquer página.
 *
 * API pública:
 *   initializeCardModal(options)  – chame uma vez no DOMContentLoaded
 *   openCardModal(item?)          – abre para criar (sem item) ou editar (com item)
 *   getCardModalData()            – retorna { titulo, conteudo, tags, isVisibleToPlayers, newImageFile }
 */

import { openModal, closeModal } from './modal.js';
import { isNarrator } from './auth.js';
import { getImageDimensions } from './cardRenderer.js';

// ── Estado interno ────────────────────────────────────────────────────────────
let _editor = null;           // instância Tiptap
let _editingItem = null;      // item sendo editado (null = modo criação)
let _newImageFile = null;     // arquivo de imagem novo (se trocado)
let _removeImage = false;     // usuário pediu para remover a imagem
let _onSave = null;           // callback: async (data, newImageFile, editingItem) => void
let _onTagInputInit = null;   // callback para inicializar sugestões de tags

// ── Elementos do DOM (preenchidos em init) ────────────────────────────────────
let _modal, _form, _titleInput, _tagsInput, _visibilityField,
    _visibilityWrap, _imagePreview, _imageEl, _imagePlaceholder,
    _fileInput, _removeBtn, _editorArea, _submitBtn;

// ── Shortcodes disponíveis no toolbar ────────────────────────────────────────
const SHORTCODES = [
    { label: 'HP / Vida', icon: 'fa-heart', preview: '[hp max=10]', template: '[hp max="10" current="10"]' },
    { label: 'Atributo / Stat', icon: 'fa-dice-d20', preview: '[stat nome="FOR"]', template: '[stat nome="FOR" valor="10" posicao="left"]' },
    { label: 'Contador', icon: 'fa-list-ol', preview: '[count max=5]', template: '[count nome="Contador" max="5" current="0"]' },
    { label: 'Dinheiro', icon: 'fa-coins', preview: '[money]', template: '[money moeda="GP" current="0" posicao="bottom"]' },
    { label: 'Nota Recolhível', icon: 'fa-sticky-note', preview: '[nota titulo="..."]', template: '[nota titulo="Nota"]Texto aqui[/nota]' },
    { label: 'Link de Card', icon: 'fa-link', preview: '[link card="Nome"]', template: '[link card="Nome do Card"]' },
    { label: 'Ficha (Sheet)', icon: 'fa-id-card', preview: '[ficha]', template: '[ficha]' },
];

// ── Carrega Tiptap via CDN (ESM) ──────────────────────────────────────────────
async function loadTiptap() {
    if (window.__tiptapLoaded) return window.__tiptapLoaded;

    const [
        { Editor },
        { StarterKit },
        { Placeholder },
        { CodeBlockLowlight },
        { common, createLowlight },
    ] = await Promise.all([
        import('https://esm.sh/@tiptap/core@2.4.0'),
        import('https://esm.sh/@tiptap/starter-kit@2.4.0'),
        import('https://esm.sh/@tiptap/extension-placeholder@2.4.0'),
        import('https://esm.sh/@tiptap/extension-code-block-lowlight@2.4.0'),
        import('https://esm.sh/lowlight@3.1.0'),
    ]).catch(() => {
        // Fallback sem syntax highlighting se lowlight falhar
        return Promise.all([
            import('https://esm.sh/@tiptap/core@2.4.0'),
            import('https://esm.sh/@tiptap/starter-kit@2.4.0'),
            import('https://esm.sh/@tiptap/extension-placeholder@2.4.0'),
            [null], [null],
        ]);
    });

    window.__tiptapLoaded = { Editor, StarterKit, Placeholder, CodeBlockLowlight, common, createLowlight };
    return window.__tiptapLoaded;
}

// ── Cria o editor Tiptap ──────────────────────────────────────────────────────
async function createEditor(content = '') {
    if (_editor) {
        _editor.destroy();
        _editor = null;
    }

    const { Editor, StarterKit, Placeholder } = await loadTiptap();

    _editor = new Editor({
        element: _editorArea,
        extensions: [
            StarterKit.configure({ codeBlock: false }),
            Placeholder.configure({ placeholder: 'Conteúdo do card (suporta shortcodes, markdown, etc.)…' }),
        ],
        content,
        onUpdate: () => { /* pode disparar preview futuro */ },
    });

    // Ao mudar o conteúdo, atualiza estado dos botões do toolbar
    _editor.on('selectionUpdate', updateToolbarState);
    _editor.on('update', updateToolbarState);
}

// ── Atualiza estado visual do toolbar ────────────────────────────────────────
function updateToolbarState() {
    if (!_editor) return;
    document.querySelectorAll('[data-tiptap-action]').forEach(btn => {
        const action = btn.dataset.tiptapAction;
        const arg = btn.dataset.tiptapArg;
        let active = false;

        if (action === 'bold') active = _editor.isActive('bold');
        else if (action === 'italic') active = _editor.isActive('italic');
        else if (action === 'strike') active = _editor.isActive('strike');
        else if (action === 'code') active = _editor.isActive('code');
        else if (action === 'bulletList') active = _editor.isActive('bulletList');
        else if (action === 'orderedList') active = _editor.isActive('orderedList');
        else if (action === 'blockquote') active = _editor.isActive('blockquote');
        else if (action === 'heading' && arg) active = _editor.isActive('heading', { level: parseInt(arg) });
        else if (action === 'codeBlock') active = _editor.isActive('codeBlock');

        btn.classList.toggle('is-active', active);
    });
}

// ── Handlers do toolbar ───────────────────────────────────────────────────────
function handleToolbarClick(e) {
    const btn = e.target.closest('[data-tiptap-action]');
    if (!btn || !_editor) return;
    e.preventDefault();

    const action = btn.dataset.tiptapAction;
    const arg = btn.dataset.tiptapArg;
    const chain = _editor.chain().focus();

    if (action === 'bold') chain.toggleBold().run();
    else if (action === 'italic') chain.toggleItalic().run();
    else if (action === 'strike') chain.toggleStrike().run();
    else if (action === 'code') chain.toggleCode().run();
    else if (action === 'bulletList') chain.toggleBulletList().run();
    else if (action === 'orderedList') chain.toggleOrderedList().run();
    else if (action === 'blockquote') chain.toggleBlockquote().run();
    else if (action === 'hr') chain.setHorizontalRule().run();
    else if (action === 'clearFormat') chain.clearNodes().unsetAllMarks().run();
    else if (action === 'heading' && arg) chain.toggleHeading({ level: parseInt(arg) }).run();
    else if (action === 'undo') chain.undo().run();
    else if (action === 'redo') chain.redo().run();

    updateToolbarState();
}

// ── Preview de imagem ─────────────────────────────────────────────────────────
function setImagePreview(src) {
    if (src) {
        _imageEl.src = src;
        _imageEl.classList.remove('is-empty');
        _imagePreview.classList.add('has-image');
    } else {
        _imageEl.src = '';
        _imageEl.classList.add('is-empty');
        _imagePreview.classList.remove('has-image');
    }
}

function handleFileChange() {
    const file = _fileInput.files[0];
    if (!file) return;
    _newImageFile = file;
    _removeImage = false;
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
}

// ── Reset completo do modal ───────────────────────────────────────────────────
async function resetModal() {
    _editingItem = null;
    _newImageFile = null;
    _removeImage = false;

    _titleInput.value = '';
    _tagsInput.value = '';
    _fileInput.value = '';
    setImagePreview(null);

    if (_visibilityField) _visibilityField.checked = true;

    const modalTitle = _modal.querySelector('.modal-card-title');
    if (modalTitle) modalTitle.textContent = 'Adicionar Novo Card';
    if (_submitBtn) _submitBtn.textContent = 'Adicionar Card';

    if (_editor) {
        _editor.commands.clearContent();
    }

    // Mostra/oculta campo de visibilidade
    if (_visibilityWrap) {
        _visibilityWrap.classList.toggle('is-hidden', !isNarrator());
    }
}

// ── Popula o modal com dados de um item existente ─────────────────────────────
async function populateModal(item) {
    _editingItem = item;

    _titleInput.value = item.titulo || '';
    _tagsInput.value = (item.tags || []).join(', ');

    if (_visibilityField) _visibilityField.checked = item.isVisibleToPlayers !== false;

    if (_visibilityWrap) {
        _visibilityWrap.classList.toggle('is-hidden', !isNarrator());
    }

    setImagePreview(item.url || null);

    const modalTitle = _modal.querySelector('.modal-card-title');
    if (modalTitle) modalTitle.textContent = 'Editar Card';
    if (_submitBtn) _submitBtn.textContent = 'Salvar Alterações';

    if (_editor) {
        _editor.commands.setContent(item.conteudo || '', false);
    }
}

// ── API pública: abre o modal ─────────────────────────────────────────────────
export async function openCardModal(item = null) {
    await resetModal();
    if (item) await populateModal(item);
    openModal(_modal);
    setTimeout(() => _editor && _editor.commands.focus('end'), 100);
}

// ── Retorna os dados do formulário ────────────────────────────────────────────
export function getCardModalData() {
    return {
        titulo: _titleInput.value.trim(),
        conteudo: _editor ? _editor.getText({ blockSeparator: '\n' }) && _editor.getHTML() : '',
        tags: _tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
        isVisibleToPlayers: isNarrator()
            ? (_visibilityField ? _visibilityField.checked : true)
            : true,
        newImageFile: _newImageFile,
        removeImage: _removeImage,
    };
}

// ── Inicialização principal ───────────────────────────────────────────────────
export async function initializeCardModal({ onSave, onTagInputInit } = {}) {
    _onSave = onSave;
    _onTagInputInit = onTagInputInit;

    // Referências
    _modal = document.getElementById('add-card-modal');
    _form = document.getElementById('form-add-card');
    _titleInput = document.getElementById('card-titulo');
    _tagsInput = document.getElementById('card-tags');
    _visibilityField = document.getElementById('card-visibility');
    _visibilityWrap = _modal.querySelector('.card-modal-visibility');
    _imagePreview = document.getElementById('card-modal-image-preview');
    _imageEl = document.getElementById('card-modal-image-el');
    _fileInput = document.getElementById('card-modal-file-input');
    _removeBtn = document.getElementById('card-modal-image-remove');
    _editorArea = document.getElementById('card-modal-editor');
    _submitBtn = _form ? _form.querySelector('button[type="submit"]') : null;

    if (!_modal || !_editorArea) {
        console.warn('cardModal: elementos do DOM não encontrados.');
        return;
    }

    // Cria o editor Tiptap
    await createEditor('');

    // Toolbar clicks
    const toolbar = document.getElementById('card-modal-toolbar');
    if (toolbar) toolbar.addEventListener('mousedown', handleToolbarClick);

    // Shortcodes dropdown
    const scBtn = document.getElementById('tiptap-shortcode-btn');
    const scMenu = document.getElementById('tiptap-shortcode-menu');
    if (scBtn && scMenu) {
        scBtn.addEventListener('mousedown', e => {
            e.preventDefault();
            scMenu.classList.toggle('is-open');
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('#tiptap-shortcode-btn') && !e.target.closest('#tiptap-shortcode-menu')) {
                scMenu.classList.remove('is-open');
            }
        });
        scMenu.querySelectorAll('[data-shortcode]').forEach(item => {
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                const tpl = item.dataset.shortcode;
                if (_editor) {
                    _editor.chain().focus().insertContent(tpl).run();
                }
                scMenu.classList.remove('is-open');
            });
        });
    }

    // Imagem: clique no preview abre file input
    if (_imagePreview) {
        _imagePreview.addEventListener('click', () => _fileInput && _fileInput.click());
    }
    if (_fileInput) {
        _fileInput.addEventListener('change', handleFileChange);
    }
    if (_removeBtn) {
        _removeBtn.addEventListener('click', e => {
            e.stopPropagation();
            _newImageFile = null;
            _removeImage = true;
            setImagePreview(null);
        });
    }

    // Tag suggestions
    if (_tagsInput && _onTagInputInit) {
        _onTagInputInit(_tagsInput);
    }

    // Submit
    if (_form) {
        _form.addEventListener('submit', async e => {
            e.preventDefault();
            if (!_submitBtn) return;
            _submitBtn.classList.add('is-loading');
            try {
                const data = getCardModalData();
                // Extrai texto puro + HTML separados
                data.conteudo = _editor ? _editor.getHTML() : '';
                // Dimensões da imagem nova
                if (data.newImageFile) {
                    const dims = await getImageDimensions(data.newImageFile);
                    data.width = dims.width;
                    data.height = dims.height;
                }
                if (_onSave) {
                    await _onSave(data, data.newImageFile, _editingItem);
                }
                closeModal(_modal);
            } catch (err) {
                console.error('Erro ao salvar card:', err);
                alert('Falha ao salvar o card.');
            } finally {
                _submitBtn.classList.remove('is-loading');
            }
        });
    }

    // Fecha e reseta ao fechar o modal
    _modal.addEventListener('click', e => {
        if (e.target.classList.contains('modal-background') ||
            e.target.classList.contains('delete') ||
            e.target.classList.contains('modal-cancel')) {
            closeModal(_modal);
        }
    });

    // MutationObserver para reset ao fechar
    new MutationObserver(() => {
        if (!_modal.classList.contains('is-active')) {
            resetModal();
        }
    }).observe(_modal, { attributes: true, attributeFilter: ['class'] });
}