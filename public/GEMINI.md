## Contexto
Web App Modular (SPA-like) para RPG de mesa (GameBoard). **Prioridade: Single Source of Truth**. Componentes globais (Header, FAB, Modais) existem uma vez e são injetados via JS.

## Regras de Output
- Apenas código, sem comentários ou introduções
- ES6+ modules, arrow functions, destructuring, early returns
- DRY: função usada >1x vai para `assets/js/modules/`
- Forneça apenas funções alteradas, não reescreva arquivos inteiros
- Sem CSS inline: use Bulma ou variáveis de `layout.css`/`theme.css`

## Stack (Strict - não sugira outras libs)
- Core: HTML5, JS (ES6 Modules), CSS3 (Variables)
- CSS: Bulma + Bulmaswatch Cyborg (CDN)
- Backend: Firebase v9 Modular SDK (Firestore, Storage) - NUNCA compat
- Grid: Muuri
- Editor: Tiptap
- Whiteboard: Fabric.js v5.3
- Ícones: FontAwesome 5

## Arquitetura Modular

### Layout (layout.js)
Body contém apenas: `#app-header`, `#app-overlays`, `#app-fab` + container da página.

Toda página inicia com:
```javascript
import { initializeLayout } from './modules/layout.js';
const layout = await initializeLayout({ fabActions: ['chat', 'dice', ...] });
```

### Header (header.js)
Renderiza mesmo HTML para todas as páginas. Detecta `window.location.pathname` para `.is-active`. Título "GameBoard" + Login/Narrador sempre presentes.

### FAB (fab.js)
Dicionário com todos os botões possíveis. Recebe array de chaves `['add-card', 'settings']` e renderiza apenas eles. CSS em `layout.css`.

### CSS Global (layout.css)
Estilos de `.top-bar`, `.fab-container`, `#chat-sidebar`, `.modal`, `#dice-container`. Não crie CSS específico de página para estrutura.

## Módulos (assets/js/modules/)
- `firebaseService.js` - Único ponto Firestore/Storage
- `auth.js` - Narrador/Login
- `chat.js` - Chat e notificações (acoplado ao layout.js)
- `cardManager.js` - Estado/cache dos cards
- `cardRenderer.js` - HTML dos cards (View/Edit)
- `shortcodeParser.js` - Processa `[hp]`, `[stat]`
- `ui.js` - Toasts, Loaders, Confirmações

Scripts de entrada (assets/js/): `script.js`, `sheet-mode.js`, etc.

## Ações Comuns
**Criar Card**: `firebaseService.addItem(data)`
**Rolagem**: `diceLogic.processRoll() → firebaseService.sendDiceRoll() → dice3d.visualizeDiceRoll()`
**Shortcodes**: Parse via `shortcodeParser.js`, render via tiptap-extensions (editor) ou HTML string (grid)
