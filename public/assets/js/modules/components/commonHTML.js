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

  // Preservar iframe de áudio persistente
  const existingAudioFrame = document.getElementById('audio-player-frame');
  const existingDiceContainer = document.getElementById('dice-container');

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

  <!-- Audio Player Sidebar -->
  <aside id="audio-sidebar" class="audio-sidebar is-hidden">
    <div class="audio-header">
      <h3><i class="fas fa-music"></i> Player</h3>
      <button id="close-audio-btn" class="audio-close-btn">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="audio-content">
      <div class="audio-now-playing">
        <div class="audio-now-playing-title is-hidden">Nenhuma música</div>
      </div>
      
      <!-- Progress Bar -->
      <div class="audio-progress-container">
        <div class="audio-progress-time">
          <span id="audio-current-time">0:00</span>
          <span id="audio-duration">0:00</span>
        </div>
        <div id="audio-progress-bar" class="audio-progress-bar">
          <div id="audio-progress-fill" class="audio-progress-fill" style="width: 0%"></div>
          <div id="audio-progress-thumb" class="audio-progress-thumb" style="left: 0%"></div>
        </div>
      </div>
      
      <!-- Controls -->
      <div class="audio-controls">
        <button id="audio-btn-shuffle" class="audio-btn-shuffle" title="Aleatório">
          <i class="fas fa-random"></i>
        </button>
        <button id="audio-btn-prev" class="audio-btn-prev" title="Anterior">
          <i class="fas fa-step-backward"></i>
        </button>
        <button id="audio-btn-play" class="audio-btn-play" title="Play/Pause">
          <i class="fas fa-play"></i>
        </button>
        <button id="audio-btn-next" class="audio-btn-next" title="Próxima">
          <i class="fas fa-step-forward"></i>
        </button>
        <button id="audio-btn-repeat" class="audio-btn-repeat" title="Repetir">
          <i class="fas fa-redo"></i>
        </button>
      </div>
      
      <!-- Volume -->
      <div class="audio-volume">
        <button id="audio-btn-mute" class="audio-volume-btn" title="Mute">
          <i class="fas fa-volume-up"></i>
        </button>
        <input type="range" id="audio-volume" class="audio-volume-slider" min="0" max="100" value="25">
      </div>
      
      <!-- Playlist Header -->
      <div class="audio-playlist-header">
        <span>FILA (<span id="audio-playlist-count">0</span>)</span>
      </div>
      <div id="audio-playlist-items" class="audio-playlist-items"></div>
      
      <!-- Add Form -->
      <div class="audio-add-form">
        <p>Adicionar música</p>
        <div class="field">
          <input type="text" id="audio-url-input" placeholder="Cole link do YouTube...">
          <button id="audio-add-btn">+</button>
        </div>
      </div>
    </div>
  </aside>

  <!-- Audio Player Iframe (persistent) -->
  <iframe id="audio-player-frame" 
    src="audio-player.html" 
    style="position:fixed;bottom:-1000px;left:-1000px;width:1px;height:1px;border:none;pointer-events:none;"
    allow="autoplay; fullscreen"
    loading="eager">
  </iframe>

  <!-- Container de Dados 3D -->
  <div id="dice-container" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998;"></div>

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
 
   <!-- Modal de Configurações Globais -->
   <div id="settings-modal" class="modal">
     <div class="modal-background"></div>
     <div class="modal-card">
       <header class="modal-card-head">
         <p class="modal-card-title">Configurações Globais</p>
         <button class="delete" aria-label="close"></button>
       </header>
       <section class="modal-card-body">
         <form id="form-settings">
           <div class="field">
             <label class="label">Título do Site</label>
             <div class="control">
               <input class="input" id="settings-title" type="text" placeholder="Ex: GameBoard RPG">
             </div>
           </div>
           <div class="field">
             <label class="label">Tags Recomendadas (Separadas por vírgula)</label>
             <div class="control">
               <input class="input" id="settings-recommended-tags" type="text" placeholder="Ex: PJ, Inimigo, Item">
             </div>
           </div>
           <div class="field">
             <label class="label">Moeda Padrão</label>
             <div class="control">
               <input class="input" id="settings-default-currency" type="text" placeholder="Ex: GP, Silver">
             </div>
           </div>
           <div class="field">
             <label class="label">ImgBB API Key</label>
             <div class="control">
               <input class="input" id="settings-imgbb-api-key" type="password" placeholder="Sua API Key do ImgBB">
             </div>
             <p class="help">Necessária para salvar imagens no Whiteboard sem ultrapassar o limite do Firebase.</p>
           </div>
           <div class="field">
             <label class="label">Filtros Customizados (JSON Array)</label>
             <div class="control">
               <textarea class="textarea" id="settings-filters" placeholder='[{"label": "PJs", "value": "pj"}]'></textarea>
             </div>
           </div>
         </form>
       </section>
       <footer class="modal-card-foot">
         <button class="button is-success" form="form-settings" type="submit">Salvar</button>
         <button class="button modal-cancel" type="button">Cancelar</button>
       </footer>
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
  
  <!-- Modal de Detalhes do Card (Global) -->
  <div id="detail-modal" class="modal">
    <div class="modal-background"></div>
    <div class="modal-card" style="width: 90%; max-width: 800px;">
      <header class="modal-card-head">
        <p id="detail-title" class="modal-card-title"></p>
        <button class="delete modal-cancel" aria-label="close"></button>
      </header>
      <section id="detail-body" class="modal-card-body">
        <!-- Conteúdo preenchido via JS -->
      </section>
      <footer class="modal-card-foot">
        <button class="button modal-cancel">Fechar</button>
      </footer>
    </div>
  </div>

  <!-- Modal de Criação / Edição de Card (Global) -->
  <div id="add-card-modal" class="modal">
    <div class="modal-background"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Card</p>
        <button class="delete" aria-label="close"></button>
      </header>
      <section class="modal-card-body">
        <form id="form-add-card" autocomplete="off">
          <div class="card-modal-layout">
            <aside class="card-modal-sidebar">
              <div id="card-modal-image-preview" class="card-modal-image-preview">
                <img id="card-modal-image-el" src="" alt="Preview" class="is-empty">
                <div class="card-modal-image-placeholder">
                  <i class="fas fa-image"></i>
                  <span>Clique para adicionar imagem</span>
                </div>
                <div class="card-modal-image-overlay">
                  <i class="fas fa-camera" style="font-size:1.5rem"></i>
                  <span>Trocar imagem</span>
                </div>
                <button type="button" id="card-modal-image-remove" class="card-modal-image-remove" title="Remover imagem">
                  <i class="fas fa-times"></i>
                </button>
                <input type="file" id="card-modal-file-input" class="is-hidden" accept="image/*">
              </div>
              <div class="card-modal-meta">
                <div class="field">
                  <label class="label">Categoria</label>
                  <div class="control">
                    <div class="select is-small is-fullwidth">
                      <select id="card-category">
                        <option value="pj">Personagem</option>
                        <option value="monstro">Monstro</option>
                        <option value="npc">NPC</option>
                        <option value="item">Item</option>
                        <option value="anotacao">Anotação</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div class="field">
                  <label class="label">Tags</label>
                  <div class="control">
                    <input class="input is-small" id="card-tags" placeholder="rpg, personagem, item…" autocomplete="off">
                  </div>
                </div>
                <div class="card-modal-visibility narrator-only is-hidden">
                  <label class="checkbox narrator-control">
                    <input type="checkbox" id="card-visibility" checked>
                    <span class="switch-track"></span>
                    <span class="switch-label-text">Visível para jogadores</span>
                  </label>
                </div>
              </div>
            </aside>
            <div class="card-modal-main">
              <div class="field card-modal-title-field">
                <label class="label">Título</label>
                <div class="control">
                  <input class="input" id="card-titulo" placeholder="Nome do card" required autocomplete="off">
                </div>
              </div>
              <div class="field" style="flex:1; display:flex; flex-direction:column; min-height:0;">
                <label class="label">Conteúdo</label>
                <div class="card-modal-editor-wrap">
                  <div id="card-modal-toolbar" class="tiptap-toolbar">
                    <div class="tiptap-toolbar-group">
                      <button type="button" class="tiptap-btn" data-tiptap-action="undo" title="Desfazer"><i class="fas fa-undo"></i></button>
                      <button type="button" class="tiptap-btn" data-tiptap-action="redo" title="Refazer"><i class="fas fa-redo"></i></button>
                    </div>
                    <div class="tiptap-toolbar-divider"></div>
                    <div class="tiptap-toolbar-group">
                      <button type="button" class="tiptap-btn tiptap-btn-text" data-tiptap-action="heading" data-tiptap-arg="1">H1</button>
                      <button type="button" class="tiptap-btn tiptap-btn-text" data-tiptap-action="heading" data-tiptap-arg="2">H2</button>
                      <button type="button" class="tiptap-btn tiptap-btn-text" data-tiptap-action="heading" data-tiptap-arg="3">H3</button>
                    </div>
                    <div class="tiptap-toolbar-divider"></div>
                    <div class="tiptap-toolbar-group">
                      <button type="button" class="tiptap-btn" data-tiptap-action="bold"><i class="fas fa-bold"></i></button>
                      <button type="button" class="tiptap-btn" data-tiptap-action="italic"><i class="fas fa-italic"></i></button>
                    </div>
                    <div class="tiptap-toolbar-divider"></div>
                    <div class="tiptap-toolbar-group" id="card-modal-shortcode-container"></div>
                  </div>
                  <div id="card-modal-editor" class="tiptap-editor-area"></div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </section>
      <footer class="modal-card-foot">
        <button class="button modal-cancel">Cancelar</button>
        <button class="button is-link" form="form-add-card" type="submit">Salvar</button>
      </footer>
    </div>
  </div>
  `;

  // Restaurar elementos persistentes
  if (existingAudioFrame && !document.getElementById('audio-player-frame')) {
    document.body.appendChild(existingAudioFrame);
  }
  if (existingDiceContainer && !document.getElementById('dice-container')) {
    document.body.appendChild(existingDiceContainer);
  }

  console.log("Componente CommonHTML: Renderizado com sucesso.");
  return overlays;
}

export default { renderOverlays };