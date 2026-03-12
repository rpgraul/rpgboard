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
import { setupShortcodeMenu } from './shortcodeInserter.js';
import MoneyNode from '../tiptap-extensions/MoneyNode.js';
import HpNode from '../tiptap-extensions/HpNode.js';
import XPNode from '../tiptap-extensions/XPNode.js';
import StatNode from '../tiptap-extensions/StatNode.js';
import CountNode from '../tiptap-extensions/CountNode.js';
import ContainerShortcode from '../tiptap-extensions/containerShortcode.js';
import FichaShortcode from '../tiptap-extensions/fichaShortcode.js';
import CardLink from '../tiptap-extensions/cardLink.js';

let _editor = null;
let _editingItem = null;
let _newImageFile = null;
let _removeImage = false;
let _onSave = null;
let _onTagInputInit = null;
let _saveTimeout = null;

let _modal, _form, _titleInput, _tagsInput, _visibilityField,
    _visibilityWrap, _imagePreview, _imageEl, _imagePlaceholder,
    _fileInput, _removeBtn, _editorArea, _submitBtn;

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
            MoneyNode,
            HpNode,
            XPNode,
            StatNode,
            CountNode,
            ContainerShortcode,
            FichaShortcode,
            CardLink.configure({
                suggestion: {
                    items: ({ query }) => {
                        if (typeof window.getSuggestionItems === 'function') {
                            return window.getSuggestionItems(query);
                        }
                        return [];
                    },
                },
            })
        ],
        content,
        onUpdate: () => {
            if (!_editingItem) return;
            clearTimeout(_saveTimeout);
            _saveTimeout = setTimeout(triggerAutoSave, 3000);
        },
    });

    _editor.on('blur', () => {
        if (!_editingItem) return;
        clearTimeout(_saveTimeout);
        triggerAutoSave();
    });

    _editor.on('selectionUpdate', updateToolbarState);
    _editor.on('update', updateToolbarState);
}

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

    if (_visibilityWrap) {
        _visibilityWrap.classList.toggle('is-hidden', !isNarrator());
    }
}

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

export async function openCardModal(item = null) {
    await resetModal();
    if (item) await populateModal(item);
    openModal(_modal);
    setTimeout(() => _editor && _editor.commands.focus('end'), 100);
}

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

async function triggerAutoSave() {
    if (!_editingItem || !_onSave) return;
    const data = getCardModalData();
    await _onSave(data, null, _editingItem);
}

export async function initializeCardModal({ onSave, onTagInputInit } = {}) {
    _onSave = onSave;
    _onTagInputInit = onTagInputInit;

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
    _submitBtn = _modal ? _modal.querySelector('button[type="submit"][form="form-add-card"]') : null;

    if (!_modal || !_editorArea) {
        console.warn('cardModal: elementos do DOM não encontrados.');
        return;
    }

    await createEditor('');

    const toolbar = document.getElementById('card-modal-toolbar');
    if (toolbar) toolbar.addEventListener('mousedown', handleToolbarClick);

    const scContainer = document.getElementById('card-modal-shortcode-container');
    if (scContainer) {
        setupShortcodeMenu(scContainer, _editor);
    }

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

    if (_tagsInput && _onTagInputInit) {
        _onTagInputInit(_tagsInput);
    }

    if (_form) {
        _form.addEventListener('submit', async e => {
            e.preventDefault();
            if (_submitBtn) _submitBtn.classList.add('is-loading');
            try {
                const data = getCardModalData();
                data.conteudo = _editor ? _editor.getHTML() : '';
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
                if (_submitBtn) _submitBtn.classList.remove('is-loading');
            }
        });
    }

    _modal.addEventListener('click', e => {
        if (e.target.classList.contains('modal-background') ||
            e.target.classList.contains('delete') ||
            e.target.classList.contains('modal-cancel')) {
            closeModal(_modal);
        }
    });

    new MutationObserver(() => {
        if (!_modal.classList.contains('is-active')) {
            resetModal();
        }
    }).observe(_modal, { attributes: true, attributeFilter: ['class'] });
}