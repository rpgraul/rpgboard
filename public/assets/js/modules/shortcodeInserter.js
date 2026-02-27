import { isNarrator } from './auth.js';

// --- MENU ITEMS DEFINITION ---
const MENU_ITEMS = [
    { configType: 'hp', icon: 'fa-heart', label: 'HP / Vida', preview: '[hp]' },
    { configType: 'stat', icon: 'fa-dice-d20', label: 'Atributo / Stat', preview: '[stat]' },
    { configType: 'count', icon: 'fa-list-ol', label: 'Contador', preview: '[count]' },
    { configType: 'money', icon: 'fa-coins', label: 'Dinheiro', preview: '[money]' },
    { configType: 'nota', icon: 'fa-sticky-note', label: 'Nota Recolhível', preview: '[nota]' },
    { configType: 'container', icon: 'fa-box', label: 'Container de Itens', preview: '[container]' },
    { configType: 'link', icon: 'fa-link', label: 'Link de Card', preview: '[link]' },
    { shortcode: '[ficha]\n\n[/ficha]', icon: 'fa-id-card', label: 'Ficha (Sheet)', preview: '[ficha]' },
];

export function setupShortcodeMenu(toolbarContainer, editorInstance) {
    const container = typeof toolbarContainer === 'string'
        ? document.getElementById(toolbarContainer)
        : toolbarContainer;

    if (!container) return;

    // Remove menu existente se houver
    const existing = container.querySelector('.tiptap-shortcode-wrap');
    if (existing) existing.remove();

    // --- WRAP ---
    const wrap = document.createElement('div');
    wrap.className = 'tiptap-toolbar-group tiptap-shortcode-wrap';
    wrap.style.cssText = 'position:relative; margin-right:0;';

    // --- BUTTON ---
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tiptap-btn tiptap-btn-text tiptap-shortcode-btn';
    btn.title = 'Inserir shortcode RPG';
    btn.style.cssText = 'width:auto; gap:5px; padding:0 8px;';
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5 5-5 5-5-5 5-5z"/><path d="m7 2 5 5-5 5-5-5 5-5z"/><path d="m22 2-5 5-5-5 5-5z"/><path d="m8 11 5 5-5 5-5-5 5-5z"/></svg>
        <span>Shortcode</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    `;
    wrap.appendChild(btn);

    // --- MENU ---
    const menu = document.createElement('div');
    menu.className = 'tiptap-shortcode-menu';

    MENU_ITEMS.forEach(item => {
        const menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'shortcode-menu-item';
        if (item.configType) menuBtn.dataset.configType = item.configType;
        if (item.shortcode) menuBtn.dataset.shortcode = item.shortcode;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon';
        iconSpan.innerHTML = `<i class="fas ${item.icon}"></i>`;

        const labelSpan = document.createElement('span');
        labelSpan.className = 'sc-label';
        labelSpan.textContent = item.label;

        const previewSpan = document.createElement('span');
        previewSpan.className = 'sc-preview';
        previewSpan.textContent = item.preview;

        menuBtn.append(iconSpan, labelSpan, previewSpan);
        menu.appendChild(menuBtn);
    });

    wrap.appendChild(btn);
    container.appendChild(wrap);

    // Menu renderizado no body (evita overflow:hidden de containers pai)
    menu.style.cssText = 'position:fixed; z-index:99999; display:none; flex-direction:column; gap:2px; padding:6px; min-width:220px; background-color:var(--card-background-color); border:1px solid var(--border-color); border-radius:6px; box-shadow:0 6px 20px rgba(0,0,0,0.4);';
    document.body.appendChild(menu);

    const openMenu = () => {
        const rect = btn.getBoundingClientRect();
        menu.style.top = (rect.bottom + 6) + 'px';
        menu.style.left = rect.left + 'px';
        menu.style.display = 'flex';
    };

    const closeMenu = () => {
        menu.style.display = 'none';
    };

    // --- EVENTS ---
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        menu.style.display === 'flex' ? closeMenu() : openMenu();
    });

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.tiptap-shortcode-wrap') && !menu.contains(e.target)) {
            closeMenu();
        }
    }, true);

    menu.querySelectorAll('.shortcode-menu-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            closeMenu();

            const type = item.dataset.configType;
            if (type) {
                openConfigModal(type, editorInstance);
            } else {
                const sc = item.dataset.shortcode;
                if (sc && editorInstance) {
                    editorInstance.chain().focus().insertContent(sc).run();
                }
            }
        });
    });
}

// --- MODAL DE CONFIGURAÇÃO ---
export function openConfigModal(type, editor, existingNodeInfo = null) {
    const isNarr = isNarrator();

    const getDef = (id, defVal) => {
        if (existingNodeInfo && existingNodeInfo.attrs) {
            const map = {
                'sc_max': 'max', 'sc_current': 'current',
                'sc_hidden': 'isHidden', 'sc_nome': 'label', 'sc_valor': 'value',
                'sc_moeda': 'currency', 'sc_icon': 'icon', 'sc_theme': 'theme',
                'sc_overlay': 'isOverlay', 'sc_card': 'card', 'sc_titulo': 'titulo',
                'sc_conteudo': 'conteudo', 'container_type': 'type', 'container_label': 'label',
                'container_closed': 'isClosed'
            };
            const attrName = map[id];
            if (attrName && existingNodeInfo.attrs[attrName] !== undefined) {
                return existingNodeInfo.attrs[attrName];
            }
        }
        return defVal;
    };

    const naratorOnlyField = (id, label, defaultVal) =>
        isNarr ? [{ id, label, type: 'checkbox', default: getDef(id, defaultVal), narratorOnly: true }] : [];

    const configs = {
        hp: {
            title: existingNodeInfo ? 'Editar: HP / Vida' : 'Configurar: HP / Vida',
            fields: [
                { id: 'sc_max', label: 'HP Máximo', type: 'number', default: getDef('sc_max', '10'), req: true },
                { id: 'sc_current', label: 'HP Atual', type: 'number', default: getDef('sc_current', '10'), req: true },
                ...naratorOnlyField('sc_hidden', 'Oculto para Jogadores', false)
            ],
            build: (data) => {
                let s = `[hp max="${data.sc_max}" current="${data.sc_current}"`;
                if (data.sc_hidden) s += ' #';
                s += ']';
                return { text: s, attrs: { max: data.sc_max, current: data.sc_current, isHidden: data.sc_hidden } };
            }
        },
        stat: {
            title: existingNodeInfo ? 'Editar: Atributo / Stat' : 'Configurar: Atributo / Stat',
            fields: [
                { id: 'sc_nome', label: 'Nome do Atributo', type: 'text', default: getDef('sc_nome', 'FOR'), req: true },
                { id: 'sc_valor', label: 'Valor', type: 'text', default: getDef('sc_valor', '10'), req: true },
                ...naratorOnlyField('sc_hidden', 'Oculto para Jogadores', false)
            ],
            build: (data) => {
                let s = `[stat "${data.sc_nome}" "${data.sc_valor}"`;
                if (data.sc_hidden) s += ' #';
                s += ']';
                return { text: s, attrs: { label: data.sc_nome, value: data.sc_valor, isHidden: data.sc_hidden } };
            }
        },
        money: {
            title: existingNodeInfo ? 'Editar: Dinheiro' : 'Configurar: Dinheiro',
            fields: [
                { id: 'sc_moeda', label: 'Moeda', type: 'text', default: getDef('sc_moeda', window.appSettings?.defaultCurrency || 'gold'), placeholder: 'ex: gold, silver, GP...' },
                { id: 'sc_current', label: 'Quantidade', type: 'number', default: getDef('sc_current', '0'), req: true },
                ...naratorOnlyField('sc_hidden', 'Oculto para Jogadores', false)
            ],
            build: (data) => {
                const currency = data.sc_moeda || window.appSettings?.defaultCurrency || 'gold';
                let s = `[money ${currency} current="${data.sc_current}"`;
                if (data.sc_hidden) s += ' #';
                s += ']';
                return { text: s, attrs: { currency: currency, current: data.sc_current, isHidden: data.sc_hidden } };
            }
        },
        count: {
            title: existingNodeInfo ? 'Editar: Contador' : 'Configurar: Contador',
            fields: [
                { id: 'sc_nome', label: 'Nome', type: 'text', default: getDef('sc_nome', 'Flechas'), req: true },
                { id: 'sc_max', label: 'Máximo', type: 'number', default: getDef('sc_max', '10'), req: true },
                { id: 'sc_current', label: 'Atual', type: 'number', default: getDef('sc_current', '10'), req: true },
                { id: 'sc_icon', label: 'Ícone FA (ex: fa-arrow-up)', type: 'text', default: getDef('sc_icon', ''), placeholder: 'ex: fa-arrow-up' },
                { id: 'sc_theme', label: 'Tema visual', type: 'select', options: ['number', 'checkbox'], default: getDef('sc_theme', 'number') },
                { id: 'sc_overlay', label: 'Flutuante (Overlay)', type: 'checkbox', default: getDef('sc_overlay', false) },
                ...naratorOnlyField('sc_hidden', 'Oculto para Jogadores', false)
            ],
            build: (data) => {
                const t = data.sc_overlay ? '*' : 'count';
                let s = `[${t} "${data.sc_nome}" max=${data.sc_max} current=${data.sc_current}`;
                if (data.sc_theme && data.sc_theme !== 'number') s += ` theme="${data.sc_theme}"`;
                if (data.sc_icon) s += ` icon="${data.sc_icon}"`;
                if (data.sc_hidden) s += ' #';
                s += ']';
                return { text: s, attrs: { label: data.sc_nome, max: data.sc_max, current: data.sc_current, icon: data.sc_icon, theme: data.sc_theme, isOverlay: data.sc_overlay, isHidden: data.sc_hidden } };
            }
        },
        link: {
            title: existingNodeInfo ? 'Editar: Link de Card' : 'Configurar: Link de Card',
            fields: [
                { id: 'sc_card', label: 'Nome exato do Card', type: 'text', default: getDef('sc_card', ''), placeholder: 'Nome do card', req: true }
            ],
            build: (data) => ({ text: `[link card="${data.sc_card}"]`, attrs: { card: data.sc_card } })
        },
        nota: {
            title: existingNodeInfo ? 'Editar: Nota' : 'Configurar: Nota Recolhível',
            fields: [
                { id: 'sc_titulo', label: 'Título da Nota', type: 'text', default: getDef('sc_titulo', 'Nota'), req: true },
                { id: 'sc_conteudo', label: 'Conteúdo inicial', type: 'textarea', default: getDef('sc_conteudo', 'Escreva o texto aqui...') }
            ],
            build: (data) => ({ text: `[nota titulo="${data.sc_titulo}"]\n${data.sc_conteudo}\n[/nota]`, attrs: { titulo: data.sc_titulo, conteudo: data.sc_conteudo } })
        },
        container: {
            title: existingNodeInfo ? 'Editar: Container' : 'Configurar: Container',
            fields: [
                { id: 'container_label', label: 'Rótulo / Título', type: 'text', default: getDef('container_label', 'Mochila'), req: true },
                { id: 'container_type', label: 'Tipo (Ícone/Cor)', type: 'select', options: ['default', 'inventory', 'spells', 'skills'], default: getDef('container_type', 'default') },
                { id: 'container_closed', label: 'Iniciar Fechado', type: 'checkbox', default: getDef('container_closed', false) },
                ...naratorOnlyField('sc_hidden', 'Oculto para Jogadores', false)
            ],
            build: (data) => {
                let tag = `[container label="${data.container_label}" type="${data.container_type}"`;
                if (data.container_closed) tag += ' close';
                if (data.sc_hidden) tag += ' #';
                tag += ']';
                return {
                    text: `${tag}\n\n[/container]`,
                    attrs: { label: data.container_label, type: data.container_type, isClosed: data.container_closed, isHidden: data.sc_hidden }
                };
            }
        }
    };

    const cfg = configs[type];
    if (!cfg) return;

    // --- BUILD MODAL VIA DOM API (safe, sem innerHTML para tags aninhados com variáveis) ---
    const overlay = document.createElement('div');
    overlay.className = 'modal is-active sc-config-modal';
    overlay.style.zIndex = '99999';

    const bg = document.createElement('div');
    bg.className = 'modal-background';

    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '440px';
    card.style.width = '95%';

    // Header
    const hdr = document.createElement('header');
    hdr.className = 'modal-card-head';

    const title = document.createElement('p');
    title.className = 'modal-card-title';
    title.style.fontSize = '1rem';
    title.textContent = cfg.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'delete';
    closeBtn.setAttribute('aria-label', 'close');

    hdr.append(title, closeBtn);

    // Body
    const body = document.createElement('section');
    body.className = 'modal-card-body';

    cfg.fields.forEach(f => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';

        if (f.type === 'checkbox') {
            const ctrl = document.createElement('div');
            ctrl.className = 'control';
            const lbl = document.createElement('label');
            lbl.className = 'checkbox';
            const inp = document.createElement('input');
            inp.type = 'checkbox';
            inp.id = f.id;
            if (f.default) inp.checked = true;
            lbl.append(inp, ' ' + f.label);
            ctrl.appendChild(lbl);
            fieldDiv.appendChild(ctrl);
        } else if (f.type === 'select') {
            const lbl = document.createElement('label');
            lbl.className = 'label is-small';
            lbl.htmlFor = f.id;
            lbl.textContent = f.label;

            const ctrl = document.createElement('div');
            ctrl.className = 'control';
            const selectWrap = document.createElement('div');
            selectWrap.className = 'select is-fullwidth is-small';
            const sel = document.createElement('select');
            sel.id = f.id;
            f.options.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o;
                opt.textContent = o;
                if (o === f.default) opt.selected = true;
                sel.appendChild(opt);
            });
            selectWrap.appendChild(sel);
            ctrl.appendChild(selectWrap);
            fieldDiv.append(lbl, ctrl);
        } else if (f.type === 'textarea') {
            const lbl = document.createElement('label');
            lbl.className = 'label is-small';
            lbl.htmlFor = f.id;
            lbl.textContent = f.label;

            const ctrl = document.createElement('div');
            ctrl.className = 'control';
            const ta = document.createElement('textarea');
            ta.className = 'textarea is-small';
            ta.id = f.id;
            ta.rows = 3;
            ta.placeholder = f.placeholder || '';
            ta.value = f.default || '';
            ctrl.appendChild(ta);
            fieldDiv.append(lbl, ctrl);
        } else {
            // text / number
            const lbl = document.createElement('label');
            lbl.className = 'label is-small';
            lbl.htmlFor = f.id;
            lbl.textContent = f.label;

            const ctrl = document.createElement('div');
            ctrl.className = 'control';
            const inp = document.createElement('input');
            inp.className = 'input is-small';
            inp.type = f.type;
            inp.id = f.id;
            inp.value = f.default ?? '';
            inp.placeholder = f.placeholder || '';
            if (f.req) inp.required = true;
            ctrl.appendChild(inp);
            fieldDiv.append(lbl, ctrl);
        }

        body.appendChild(fieldDiv);
    });

    // Footer
    const ftr = document.createElement('footer');
    ftr.className = 'modal-card-foot';
    ftr.style.justifyContent = 'flex-end';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'button is-small sc-cancel-btn';
    cancelBtn.textContent = 'Cancelar';

    const insertBtn = document.createElement('button');
    insertBtn.className = 'button is-link is-small sc-insert-btn';
    insertBtn.textContent = existingNodeInfo ? 'Salvar Alterações' : 'Inserir Shortcode';

    ftr.append(cancelBtn, insertBtn);

    card.append(hdr, body, ftr);
    overlay.append(bg, card);
    document.body.appendChild(overlay);

    const closeMe = () => {
        overlay.remove();
    };

    bg.addEventListener('click', closeMe);
    closeBtn.addEventListener('click', closeMe);
    cancelBtn.addEventListener('click', closeMe);

    insertBtn.addEventListener('click', () => {
        const data = {};
        let fail = false;

        overlay.querySelectorAll('.is-danger').forEach(el => el.classList.remove('is-danger'));

        cfg.fields.forEach(f => {
            const el = overlay.querySelector('#' + f.id);
            if (!el) return;
            if (f.type === 'checkbox') data[f.id] = el.checked;
            else data[f.id] = el.value.trim();

            if (f.req && !data[f.id] && f.type !== 'checkbox') {
                el.classList.add('is-danger');
                fail = true;
            }
        });

        if (fail) return;

        const built = cfg.build(data);

        if (editor) {
            if (existingNodeInfo && existingNodeInfo.pos !== null && existingNodeInfo.pos !== undefined) {
                const currentNode = editor.view.state.doc.nodeAt(existingNodeInfo.pos);
                if (currentNode) {
                    editor.view.dispatch(
                        editor.view.state.tr.setNodeMarkup(existingNodeInfo.pos, undefined, { ...currentNode.attrs, ...built.attrs })
                    );
                }
            } else {
                editor.chain().focus().insertContent(built.text + ' ').run();
            }
        }

        closeMe();
    });

    // Focus no primeiro input
    setTimeout(() => {
        const first = overlay.querySelector('input:not([type=checkbox]), textarea, select');
        if (first) first.focus();
    }, 50);
}
