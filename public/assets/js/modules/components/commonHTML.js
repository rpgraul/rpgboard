/**
 * Renderiza os elementos de sobreposição (Overlays) comuns a todas as páginas.
 * Inclui: Sidebar do Chat, Container de Dados, Modal de Ajuda, Login e Narrador.
 */
export function renderOverlays() {
  const overlays = document.getElementById("app-overlays") || (() => {
    const d = document.createElement("div");
    d.id = "app-overlays";
    document.body.appendChild(d);
    return d;
  })();

  overlays.innerHTML = `
  <!-- Chat Sidebar -->
  <aside id="chat-sidebar" class="chat-sidebar is-hidden">
    <div class="chat-header">
      <h3>Chat</h3>
      <button id="close-chat-btn" class="button is-small">
        <span class="icon"><i class="fas fa-times"></i></span>
      </button>
    </div>
    <div id="chat-messages" class="chat-messages"></div>
    <form id="chat-input-area" class="chat-form">
      <input id="chat-input" class="input" placeholder="Escreva uma mensagem..." autocomplete="off">
      <button class="button is-primary" type="submit">Enviar</button>
    </form>
  </aside>

  <!-- Container de Dados 3D -->
  <div id="dice-container"></div>

  <!-- Modal de Guia de Ajuda -->
  <div id="help-modal" class="modal">
    <div class="modal-background"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Guia de Ajuda</p>
        <button class="delete" aria-label="close"></button>
      </header>
      <section class="modal-card-body">
        <div class="content">
          <h3>Guia de Shortcodes</h3>
          <p>Shortcodes são códigos para o campo <strong>"Conteúdo Principal"</strong>.</p>
          
          <h4>Status: [stat]</h4>
          <pre><code>[stat "Força" "18"]</code></pre>
          
          <h4>Vida: [hp]</h4>
          <pre><code>[hp max=100 current=75]</code></pre>
          
          <h4>Dinheiro: [money]</h4>
          <pre><code>[money current=500 GP]</code></pre>
          
          <h4>Contadores: [count] e [*count]</h4>
          <p>Use <code>*count</code> para aparecer no card. <code>count</code> apenas nos detalhes.</p>
          <pre><code>[*count "Flechas" max=10 theme=arrow]</code></pre>

          <h4>Texto Oculto: [hide] ou [#]</h4>
          <pre><code>[#]Este texto só o Narrador vê.[/#]</code></pre>

          <hr>
          <h4>Modo Narrador</h4>
          <p>Acesse o botão "Narrador" no topo para gerenciar visibilidade e cards ocultos.</p>
        </div>
      </section>
    </div>
  </div>

  <!-- Modal de Identificação de Usuário -->
  <div id="user-login-modal" class="modal">
    <div class="modal-background"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Identificar Usuário</p>
        <button class="delete" aria-label="close"></button>
      </header>
      <section class="modal-card-body">
        <form id="form-user-login">
          <div class="field">
            <label class="label">Nome do Jogador ou Personagem</label>
            <div class="control">
              <input class="input" id="user-name-input" type="text" placeholder="Digite seu nome..." required>
            </div>
          </div>
        </form>
      </section>
      <footer class="modal-card-foot">
        <button class="button is-info" form="form-user-login" type="submit">Entrar</button>
        <button class="button modal-cancel" type="button">Cancelar</button>
      </footer>
    </div>
  </div>

  <!-- Modal de Acesso do Narrador -->
  <div id="narrator-modal" class="modal">
    <div class="modal-background"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Acesso do Narrador</p>
        <button class="delete" aria-label="close"></button>
      </header>
      <section class="modal-card-body">
        <form id="form-narrator-login">
          <div class="field">
            <label class="label">Senha</label>
            <div class="control">
              <input class="input" id="narrator-password" type="password" placeholder="Digite a senha do mestre..." required>
            </div>
            <p class="help is-danger is-hidden" id="narrator-error-message">Senha incorreta.</p>
          </div>
        </form>
      </section>
      <footer class="modal-card-foot">
        <button class="button is-link" form="form-narrator-login" type="submit">Entrar</button>
        <button class="button modal-cancel" type="button">Cancelar</button>
      </footer>
    </div>
  </div>
  `;

  console.log("Componente CommonHTML: Renderizado com sucesso.");
  return overlays;
}

export default { renderOverlays };