
// Utilitário para obter o título do site
function getSiteTitle() {
  const settings = window.appSettings || {};
  return settings.siteTitle || 'GameBoard';
}

// Utilitário para saber a página atual
function getCurrentPage() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('sheet-mode')) return 'sheet';
  if (path.includes('index')) return 'grid';
  if (path.includes('text-mode')) return 'notas';
  if (path.includes('drawing-mode')) return 'whiteboard';
  return '';
}

// Renderiza o header unificado
export function renderHeader() {
  const container = document.getElementById('app-header');
  if (!container) return null;

  const isNarrator = localStorage.getItem('isNarrator') === 'true';
  const storedName = localStorage.getItem('rpgboard_user_name') || '';
  const siteTitle = getSiteTitle();
  const currentPage = getCurrentPage();

  // Menu principal
  const menu = [
    { id: 'nav-login', label: isNarrator ? 'Mestre' : (storedName || 'Entrar'), icon: isNarrator ? 'fas fa-user-shield' : (storedName ? 'fas fa-user-edit' : 'fas fa-sign-in-alt'), action: 'login' },
    { id: 'nav-sheet', label: 'Ficha', icon: 'fas fa-file-invoice', href: 'sheet-mode.html', page: 'sheet' },
    { id: 'nav-grid', label: 'Grid', icon: 'fas fa-th', href: 'index.html', page: 'grid' },
    { id: 'nav-notas', label: 'Notas', icon: 'fas fa-edit', href: 'text-mode.html', page: 'notas' },
    { id: 'nav-whiteboard', label: 'Whiteboard', icon: 'fas fa-pencil-ruler', href: 'drawing-mode.html', page: 'whiteboard' }
  ];


  container.innerHTML = `
    <header class="top-bar">
      <div class="container" style="display:flex;align-items:center;justify-content:space-between;gap:2rem;">
        <span class="top-bar-title" id="header-site-title">${siteTitle}</span>
        <nav class="main-nav" style="display:flex;gap:0.5rem;align-items:center;">
          ${menu.map(item => `
            ${item.action === 'login' ?
      `<button id="${item.id}" class="button is-small is-link" style="display:flex;align-items:center;gap:0.3em;">
                <span class="icon"><i class="${item.icon}"></i></span>
                <span id="user-name-label">${item.label}</span>
              </button>`
      :
      `<a id="${item.id}" href="${item.href}" class="button is-small${currentPage === item.page ? ' is-link is-light' : ' is-link'}" style="display:flex;align-items:center;gap:0.3em;">
                <span class="icon"><i class="${item.icon}"></i></span>
                <span>${item.label}</span>
              </a>`
    }
          `).join('')}
        </nav>
      </div>
    </header>
    <div id="login-modal" class="modal">
      <div class="modal-background"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Identificação</p>
          <button class="delete" aria-label="close"></button>
        </header>
        <section class="modal-card-body">
          <form id="login-form">
            <div class="field">
              <label class="label">Seu nome</label>
              <div class="control has-icons-left">
                <input id="login-name" class="input" type="text" placeholder="Digite seu nome" maxlength="32" autocomplete="off" ${isNarrator ? 'disabled' : ''} value="${isNarrator ? 'Mestre' : (storedName || '')}">
                <span class="icon is-small is-left"><i class="fas fa-user"></i></span>
              </div>
            </div>
            <div class="field">
              <label class="checkbox">
                <input type="checkbox" id="narrator-checkbox" ${isNarrator ? 'checked' : ''}> Entrar como Narrador
              </label>
            </div>
            <div class="field narrator-password-field" style="display:none;">
              <label class="label">Senha do Narrador</label>
              <div class="control has-icons-left">
                <input id="narrator-password" class="input" type="password" placeholder="Senha" autocomplete="off">
                <span class="icon is-small is-left"><i class="fas fa-lock"></i></span>
              </div>
            </div>
          </form>
        </section>
        <footer class="modal-card-foot" style="justify-content:space-between;">
          <button id="login-save-btn" class="button is-success">Salvar</button>
          <button id="login-logout-btn" class="button is-danger">Sair</button>
        </footer>
      </div>
    </div>
  `;

  // Lógica de eventos do header
  setTimeout(() => setupHeaderEvents(), 0);
  return container;
}

function setupHeaderEvents() {
  const loginBtn = document.getElementById('nav-login');
  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('login-form');
  const narratorCheckbox = document.getElementById('narrator-checkbox');
  const narratorPasswordField = loginForm.querySelector('.narrator-password-field');
  const narratorPasswordInput = document.getElementById('narrator-password');
  const loginNameInput = document.getElementById('login-name');
  const saveBtn = document.getElementById('login-save-btn');
  const logoutBtn = document.getElementById('login-logout-btn');
  const closeBtn = loginModal.querySelector('.delete');
  const bg = loginModal.querySelector('.modal-background');
  const editUserIcon = document.getElementById('edit-user-icon');

  function openModal() {
    loginModal.classList.add('is-active');
    if (!narratorCheckbox.checked) loginNameInput.focus();
  }
  function closeModal() {
    loginModal.classList.remove('is-active');
    narratorPasswordInput.value = '';
  }

  if (loginBtn) loginBtn.onclick = openModal;
  if (editUserIcon) editUserIcon.onclick = openModal;
  if (closeBtn) closeBtn.onclick = closeModal;
  if (bg) bg.onclick = closeModal;

  // Alternar campo de senha do narrador
  narratorCheckbox.onchange = () => {
    if (narratorCheckbox.checked) {
      narratorPasswordField.style.display = '';
      loginNameInput.value = 'Mestre';
      loginNameInput.disabled = true;
      narratorPasswordInput.focus();
    } else {
      narratorPasswordField.style.display = 'none';
      loginNameInput.disabled = false;
      if (localStorage.getItem('isNarrator') === 'true') loginNameInput.value = '';
      else loginNameInput.value = localStorage.getItem('rpgboard_user_name') || '';
    }
  };

  // Salvar login
  saveBtn.onclick = (e) => {
    e.preventDefault();
    if (narratorCheckbox.checked) {
      // Narrador: validar senha
      const senha = narratorPasswordInput.value.trim();
      // Senhas válidas (de auth.js)
      const validPasswords = ["dimitrinho", "tomatinho"];
      if (!validPasswords.includes(senha)) {
        narratorPasswordInput.classList.add('is-danger');
        narratorPasswordInput.focus();
        return;
      }
      localStorage.setItem('isNarrator', 'true');
      localStorage.setItem('rpgboard_user_name', 'Mestre');
    } else {
      const nome = loginNameInput.value.trim();
      if (!nome) {
        loginNameInput.classList.add('is-danger');
        loginNameInput.focus();
        return;
      }
      localStorage.setItem('isNarrator', 'false');
      localStorage.setItem('rpgboard_user_name', nome);
    }
    closeModal();
    renderHeader();
  };

  // Sair
  logoutBtn.onclick = (e) => {
    e.preventDefault();
    localStorage.removeItem('isNarrator');
    localStorage.removeItem('rpgboard_user_name');
    closeModal();
    renderHeader();
  };
}

export default { renderHeader };