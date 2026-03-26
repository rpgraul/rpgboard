# Task List: Audio Player (Toca-Fitas)

## Resumo da Feature
Player de música similar a bots do Discord - YouTube via links, sincronizado entre todos os jogadores.

## Especificações Decididas
| Item | Decisão |
|------|---------|
| Plataforma | YouTube (apenas colar links) |
| Controle | Qualquer jogador pode controlar |
| Sidebar | Painel dedicado na esquerda |
| Sync | Timestamp no Firebase |
| Notificações | Não |
| Playlist | Global (persiste no Firebase) |
| Limite | Sem limite |
| Visual | Lista simples |
| Escopo | Global (mesma playlist para todos) |

---

## Passo 1: Preparar Firebase ✅ CONCLUÍDO

### 1.1 Criar estrutura do Firestore
**Coleção:** `audioPlayer`

```
audioPlayer/
├── currentVideoId: string ("dQw4w9WgXcQ")
├── isPlaying: boolean (true/false)
├── currentTime: number (float, segundos)
├── lastUpdated: timestamp (para calcular drift)
├── volume: number (0-100, individual - só guarda default)
└── playlist: array [
    {
      id: string (uuid),
      videoId: string (YouTube ID),
      title: string (nome amigável),
      addedBy: string (nome do jogador),
      addedAt: timestamp
    }
  ]
```

### 1.2 Regras de Firestore
- Leitura: qualquer usuário autenticado
- Escrita: qualquer usuário autenticado (para permitir controle por todos)

**Nota:** Estrutura criada via código em firebaseService.js (linha 51). As regras de segurança devem ser configuradas no Console do Firebase.

---

## Passo 2: Criar Módulo Principal

### 2.1 Novo arquivo: `assets/js/modules/audio.js`
**Responsabilidades:**
- Conectar com Firebase
- Controlar YouTube IFrame API
- Gerenciar playlist local
- Sincronizar estado com Firebase

**Funções Exportadas:**
```javascript
export function initializeAudio()
export function toggleAudio()
export function addToPlaylist(videoId, title)
export function removeFromPlaylist(id)
export function reorderPlaylist(fromIndex, toIndex)
export function skipTo(index)
export function setVolume(level)
export function getVolume()
```

---

## Passo 3: Interface (Sidebar)

### 3.1 Renderizar Sidebar
**Adicionar em:** `assets/js/modules/components/commonHTML.js` ou novo arquivo

**Estrutura:**
```
┌─────────────────────────────┐
│ 🎵 Audio Player        [X] │
├─────────────────────────────┤
│ ┌───────────────────────┐  │
│ │   [YouTube Player]    │  │
│ │   (oculto ou 0x0)     │  │
│ └───────────────────────┘  │
│                             │
│ 🎛️ Now Playing:            │
│ [Nome da Música]            │
│ ────────────────────────    │
│ [⏮️] [⏯️] [⏭️] [🔇] 100%   │
│ ────────────────────────    │
│ 📋 Playlist (3)            │
│ ┌─────────────────────┐    │
│ │ 1. ▶ Música 1  [🗑️]│    │
│ │ 2.   Música 2  [🗑️]│    │
│ │ 3.   Música 3  [🗑️]│    │
│ └─────────────────────┘    │
│                             │
│ [+ Adicionar Música]        │
│ ┌───────────────────────┐  │
│ │ Colar link do YouTube │  │
│ └───────────────────────┘  │
└─────────────────────────────┘
```

### 3.2 CSS
**Novo arquivo:** `assets/css/audio.css`

**Estilos necessários:**
- `.audio-sidebar` (position: fixed, left, z-index alto)
- `.audio-player` (oculto mas funcional)
- `.audio-controls` (botões)
- `.audio-playlist` (lista)
- `.audio-now-playing` (info da música atual)

---

## Passo 4: YouTube IFrame API

### 4.1 Carregamento
```javascript
// Em audio.js ou commonHTML.js
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);
```

### 4.2 Integração
- Player criado em div oculta
- Controlado via API JavaScript
- Estado sincronizado com Firebase
- Poll interval para checar drift de sync (~1s)

---

## Passo 5: Integrar com FAB

### 5.1 Adicionar botão no FAB
**Arquivo:** `assets/js/modules/components/fab.js`

Adicionar `'audio'` no `buttonOrder` de cada modo:
```javascript
buttonOrder = ['audio', 'dice', 'chat', ...];
```

### 5.2 Template do botão FAB
```javascript
FAB_BUTTONS['audio'] = `
  <button id="toggle-audio-btn" class="button is-warning is-rounded fab-button" title="Audio">
    <span class="icon"><i class="fas fa-music"></i></span>
  </button>
`;
```

---

## Passo 6: Sincronização

### 6.1 Firebase Listeners
```javascript
// Ouvir mudanças no Firestore
onSnapshot(doc('audioPlayer'), (doc) => {
  const data = doc.data();
  if (data) syncPlayerState(data);
});
```

### 6.2 Sync Logic
```
Quando receber atualização do Firebase:
1. Se videoId mudou → carregar novo vídeo
2. Se isPlaying mudou → play/pause
3. Se currentTime mudou → calcular drift
4. Se playlist mudou → atualizar UI
```

### 6.3 Debounce para evitar loops
- Ao controlar localmente, atualizar Firebase
- Com delay para não responder à própria mudança

---

## Passo 7: Extrair YouTube ID de URL

### 7.1 Função utilitária
```javascript
function extractYouTubeId(url) {
  // Suportar:
  // - https://www.youtube.com/watch?v=ID
  // - https://youtu.be/ID
  // - https://www.youtube.com/embed/ID
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
```

---

## Passo 8: Testes ✅ IMPLEMENTADO

### Audio Player - Redesign Visual
- ✅ Layout leve e limpo com cores do tema
- ✅ Progress bar (só quando tocando)
- ✅ Controles: Shuffle, Prev, Play/Pause, Next, Repeat
- ✅ Volume com mute (fa-volume-mute)
- ✅ Playlist com drag & drop
- ✅ Indicador visual de música ativa (borda verde)
- ✅ Input adicionar música minimalista

### 8.2 Edge cases
- [ ] Link inválido
- [ ] Vídeo removido do YouTube
- [ ] Perda de conexão com Firebase
- [ ] Conflito de controle simultâneo

---

## Arquivos a Criar/Modificar

### Novos
| Arquivo | Descrição |
|---------|-----------|
| `assets/js/modules/audio.js` | Módulo principal do player |
| `assets/css/audio.css` | Estilos do player |

### Modificar
| Arquivo | Mudança |
|---------|---------|
| `assets/js/modules/components/fab.js` | Adicionar botão 'audio' |
| `assets/js/modules/firebaseService.js` | Adicionar funções do audio |
| `assets/js/modules/components/commonHTML.js` | Adicionar sidebar do audio |

---

## Ordem de Implementação Sugerida

1. ✅ **PASSO 1** Firebase (estrutura + regras) - CONCLUÍDO
2. ✅ **PASSO 2** Módulo audio.js (lógica principal) - CONCLUÍDO
3. ✅ **PASSO 3** YouTube IFrame API integration - CONCLUÍDO
4. ✅ **PASSO 4** Extrair YouTube ID de URL - CONCLUÍDO
5. ✅ **PASSO 5** Sidebar HTML/CSS - CONCLUÍDO
6. ✅ **PASSO 6** Integrar com FAB - CONCLUÍDO
7. ✅ **PASSO 7** Sync logic - CONCLUÍDO (integrado no módulo)
8. 🔄 **PASSO 8** Testes - AGUARDANDO TESTE

---

## Tempo Estimado
- **Desenvolvimento:** 4-6 horas
- **Testes:** 2 horas
- **Total:** ~6-8 horas
