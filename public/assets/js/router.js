/**
 * router.js — Soft Navigation Router para o GameBoard Shell.
 * 
 * Intercepta cliques em <a> de navegação interna e usa fetch() para trocar
 * apenas o conteúdo do #page-content, sem destruir o DOM global (header,
 * overlays, iframe do YouTube).
 * 
 * Cada rota define:
 *   - contentPath: arquivo HTML de onde extrair o conteúdo da página
 *   - css: arquivo CSS específico da página (opcional)
 *   - module: função async que retorna o módulo JS da página (com init/destroy)
 */

const PAGE_CONTENT_ID = 'page-content';
const PAGE_CSS_ID = 'page-css';

// Mapa de rotas: pathname → config
const ROUTES = {
  '/':                  { contentPath: '/index.html',        css: null,                              module: () => import('./script.js') },
  '/index.html':        { contentPath: '/index.html',        css: null,                              module: () => import('./script.js') },
  '/text-mode.html':    { contentPath: '/text-mode.html',    css: 'assets/css/text-mode.css',       module: () => import('./text-mode.js') },
  '/sheet-mode.html':   { contentPath: '/sheet-mode.html',   css: 'assets/css/sheet-mode.css',      module: () => import('./sheet-mode.js') },
  '/drawing-mode.html': { contentPath: '/drawing-mode.html', css: 'assets/css/drawing-mode.css',    module: () => import('./drawing-mode.js') },
};

// Módulo atualmente ativo (para chamar destroy() antes de trocar)
let activeModule = null;

/**
 * Resolve a rota para o pathname atual.
 * Retorna a config da rota ou null se não encontrada.
 */
function resolveRoute(pathname) {
  return ROUTES[pathname] || ROUTES['/'];
}

/**
 * Busca o HTML de uma URL e extrai apenas o conteúdo relevante da página.
 * Retorna o innerHTML do #page-content ou, fallback, do <body>.
 */
async function fetchPageContent(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[Router] Falha ao carregar ${url}: ${res.status}`);
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Extrai o #page-content do documento remoto (páginas fragmentos)
  const content = doc.getElementById(PAGE_CONTENT_ID);
  if (content) return content.innerHTML;

  // Fallback: extrai o body inteiro excluindo os divs do shell
  const body = doc.body;
  ['app-header', 'app-overlays', 'app-fab'].forEach(id => {
    const el = body.querySelector(`#${id}`);
    if (el) el.remove();
  });
  // Remove scripts (não serão executados assim mesmo, mas limpa o HTML)
  body.querySelectorAll('script').forEach(s => s.remove());
  return body.innerHTML;
}

/**
 * Navega para uma rota sem recarregar a página.
 * @param {string} pathname — ex: '/text-mode.html'
 * @param {boolean} pushState — se deve atualizar o histórico do browser
 */
async function navigateTo(pathname, pushState = true) {
  const route = resolveRoute(pathname);
  if (!route) {
    console.warn('[Router] Rota não encontrada:', pathname);
    return;
  }

  // 1. Destruir módulo ativo anterior
  if (activeModule?.destroy) {
    try { await activeModule.destroy(); } catch (e) { console.warn('[Router] Erro no destroy:', e); }
  }
  activeModule = null;

  // 2. Trocar CSS específico da página
  const pageCssEl = document.getElementById(PAGE_CSS_ID);
  if (pageCssEl) {
    pageCssEl.href = route.css || '';
    pageCssEl.disabled = !route.css;
  }

  // 3. Injetar conteúdo HTML da nova rota
  const pageContent = document.getElementById(PAGE_CONTENT_ID);
  try {
    pageContent.innerHTML = '<div style="padding:2rem;text-align:center;opacity:0.5"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    const html = await fetchPageContent(route.contentPath);
    pageContent.innerHTML = html;
  } catch (e) {
    console.error('[Router] Erro ao carregar conteúdo:', e);
    pageContent.innerHTML = `<div class="notification is-danger">Erro ao carregar página.</div>`;
    return;
  }

  // 4. Atualizar histórico do browser
  if (pushState) {
    history.pushState({ pathname }, '', pathname);
  }

  // 5. Atualizar active no header (re-detectar baseado no pathname)
  updateHeaderActiveLink(pathname);

  // 6. Inicializar módulo JS da nova página
  try {
    const mod = await route.module();
    activeModule = mod;
    if (mod.init) await mod.init();
  } catch (e) {
    console.error('[Router] Erro ao inicializar módulo da rota:', e);
  }
}

/**
 * Atualiza o link ativo no header baseado no pathname atual.
 */
function updateHeaderActiveLink(pathname) {
  document.querySelectorAll('#app-header a[data-route]').forEach(a => {
    const route = a.getAttribute('data-route');
    a.classList.toggle('is-active', route === pathname || (pathname === '/' && route === '/index.html'));
  });
}

/**
 * Inicializa o router: configura delegação de eventos e carrega a rota atual.
 */
export async function initRouter() {
  // Delegação de cliques: intercepta apenas links de navegação interna com data-route
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-route]');
    if (!link) return;
    e.preventDefault();
    const pathname = link.getAttribute('data-route') || link.getAttribute('href');
    if (pathname && !pathname.startsWith('http')) {
      navigateTo(pathname);
    }
  });

  // Back/Forward do browser
  window.addEventListener('popstate', (e) => {
    const pathname = e.state?.pathname || window.location.pathname;
    navigateTo(pathname, false);
  });

  // Carregar a rota inicial baseada na URL atual
  // Se o usuário entrou diretamente em /text-mode.html, navegar para essa rota
  const initialPath = window.location.pathname;
  await navigateTo(initialPath, false);
}

export default { initRouter, navigateTo };
