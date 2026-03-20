# GameBoard - Documentação

Web App modular para RPG de mesa com foco em **Single Source of Truth**.

## Stack

- **Frontend**: HTML5, JavaScript (ES6 Modules), CSS3 (Bulma + Bulmaswatch Cyborg)
- **Backend**: Firebase v9 (Firestore + Storage)
- **Grid**: Muuri
- **Editor**: Tiptap
- **Whiteboard**: Fabric.js v5.3
- **Ícones**: FontAwesome 5
- **Deploy**: Firebase Hosting + Netlify

## Modelo de Dados Firestore

```
users/{uid}
├── displayName: string
├── email: string
└── role: "narrador" | "jogador"

games/{gameId}
├── nome: string
├── criadoEm: timestamp
└── cards/{cardId}
    ├── titulo: string
    ├── conteudo: string (HTML com shortcodes)
    ├── tags: string[]
    ├── category: "pj" | "monstro" | "npc" | "item" | "anotacao"
    ├── isVisibleToPlayers: boolean
    ├── imagemUrl?: stringdesempenho geral
• Integração nativa com OpenCode
    ├── posicao?: { x: number, y: number }
    ├── criadoEm: timestamp
    └── atualizadoEm: timestamp

games/{gameId}
└── chat/{messageId}
    ├── uid: string
    ├── autor: string
    ├── mensagem: string
    ├── timestamp: timestamp
    └── tipo: "mensagem" | "rolagem" | "sistema"

games/{gameId}
└── rolls/{rollId}
    ├── uid: string
    ├── autor: string
    ├── expressao: string (ex: "2d20+5")
    ├── resultado: number
    ├── detalhes: string
    └── timestamp: timestamp

games/{gameId}
└── board/{boardId}
    ├── objetos: Fabric.js JSON
    └── atualizadoEm: timestamp

games/{gameId}
└── settings/{settingsId}
    ├── nome: string
    └── configuracoes: object
```

## Firebase Storage

```
gs://{project}.appspot.com/
├── images/{uid}/{filename}
└── boards/{gameId}/{filename}
```

## Estrutura de Diretórios

```
public/
├── index.html              # Grid principal com cards
├── sheet-mode.html         # Narrativa + Ficha de personagem
├── text-mode.html         # Editor de texto rico
├── drawing-mode.html      # Whiteboard
├── upload.html            # Upload de imagens
├── converter.html         # Conversor de dados
├── chat.html              # Chat em tempo real
├── assets/
│   ├── css/
│   │   ├── global.css      # Estilos globais
│   │   ├── variables.css   # Variáveis CSS (tema)
│   │   ├── cards.css       # Estilos dos cards
│   │   ├── components.css  # Componentes reutilizáveis
│   │   ├── editor.css      # Editor de texto
│   │   ├── sheet-mode.css  # Estilos da ficha
│   │   ├── text-mode.css   # Estilos do modo texto
│   │   ├── drawing-mode.css# Estilos do whiteboard
│   │   └── shortcodes.css  # Estilos dos shortcodes RPG
│   ├── js/
│   │   ├── firebase-config.js
│   │   ├── script.js       # Script principal
│   │   ├── modules/
│   │   │   ├── auth.js         # Autenticação
│   │   │   ├── firebaseService.js # CRUD Firestore
│   │   │   ├── chat.js         # Chat e notificações
│   │   │   ├── cardManager.js  # Estado e cache
│   │   │   ├── cardRenderer.js  # Renderização HTML
│   │   │   ├── cardModal.js     # Modal de criação/edição
│   │   │   ├── shortcodeParser.js # Processa shortcodes
│   │   │   ├── shortcodeInserter.js # Insere shortcodes
│   │   │   ├── parserUtils.js   # Utilitários do parser
│   │   │   ├── diceLogic.js     # Lógica de dados
│   │   │   ├── dice3d.js        # Visualização 3D
│   │   │   ├── ui.js            # Toasts, loaders
│   │   │   ├── layout.js        # Inicialização global
│   │   │   ├── grid.js          # Grid Muuri
│   │   │   ├── board.js         # Whiteboard
│   │   │   ├── modal.js         # Sistema de modais
│   │   │   ├── settings.js      desempenho geral
• Integração nativa com OpenCode# Configurações
│   │   │   ├── playerMode.js    # Modo jogador
│   │   │   ├── narrator.js      # Ferramentas do narrador
│   │   │   ├── syncUtils.js     # Utilitários de sincronização
│   │   │   ├── editorUtils.js   # Utilitários do editor
│   │   │   ├── bulkEdit.js      # Edição em massa
│   │   │   └── components/
│   │   │       ├── header.js    # Cabeçalho
│   │   │       └── fab.js       # Botões de ação
│   │   ├── tiptap-extensions/
│   │   │   ├── HpNode.js        # Nó HP
│   │   │   ├── StatNode.js      desempenho geral
• Integração nativa com OpenCode# Nó atributo
│   │   │   ├── MoneyNode.js      # Nó dinheiro
│   │   │   ├── CountNode.js      # Nó contador
│   │   │   ├── XpNode.js         # Nó experiência
│   │   │   ├── cardLink.js       # Link para cards
│   │   │   ├── fichaShortcode.js # Shortcodes de ficha
│   │   │   └── containerShortcode.js # Containers
│   │   ├── whiteboard/
│   │   │   ├── canvas.js        # Canvas principal
│   │   │   ├── tools.js         # Ferramentas de desenho
│   │   │   ├── shapes.js        # Gerenciamento de formas
│   │   │   ├── boardManager.js  # Estado do tabuleiro
│   │   │   ├── history.js       # Histórico de ações
│   │   │   ├── clipboard.js     # Área de transferência
│   │   │   ├── contextMenu.js   # Menu de contexto
│   │   │   ├── assets.js        # Gerenciamento de assets
│   │   │   ├── export.js        # Exportar/importar
│   │   │   └── index.js         # Entry point
│   │   ├── sheet-mode.js
│   │   ├── text-mode.js
│   │   ├── drawing-mode.js
│   │   ├── upload.js
│   │   └── converter.js
│   └── asset/                   # Imagens estáticas
├── dist/                       # Build de produção
├── package.json
└── vite.config.js
```

## Configuração de Ambiente

### 1. Firebase Setup

Crie um projeto no [Firebase Console](https://console.firebase.google.com) e configure:

```javascript
// assets/js/firebase-config.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "ID_REMETENTE",
  appId: "ID_APP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
```

### 2. Regras do Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /games/{gameId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
      
      match /cards/{cardId} {
        allow read: if request.auth != null 
          && (resource.data.isVisibleToPlayers || isNarrator());
        allow write: if isNarrator();
      }
      
      match /chat/{messageId} {
        allow read, write: if request.auth != null;
      }
      
      match /rolls/{rollId} {
        allow read, write: if request.auth != null;
      }
    }
    
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
  }
  
  function isNarrator() {
    return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'narrador';
  }
}
```

### 3. Variáveis de Ambiente

```bash
# .env (não commitar!)
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=id_remetente
VITE_FIREBASE_APP_ID=id_app
```

### 4. Deploy Firebase Hosting

```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

```bash
firebase init hosting
firebase deploy
```

## Estrutura de Páginas

| Página | Descrição |
|--------|-----------|
| `index.html` | Grid principal com cards de personagens, monstros, NPCs, itens e anotações |
| `sheet-mode.html` | Abas para narrativa e ficha de personagem |
| `text-mode.html` | Editor de texto rico |
| `drawing-mode.html` | Whiteboard com ferramentas de desenho |
| `upload.html` | Upload de imagens |
| `converter.html` | Conversor de dados |
| `chat.html` | Chat em tempo real |

## Arquitetura Modular

### Componentes Globais (injetados via JS)
- **Header**: Navegação e autenticação
- **FAB**: Botões de ação rápida
- **Modais**: Detalhes, criação/edição de cards
- **Chat Sidebar**: Notificações e mensagens

### Módulos Principais (`assets/js/modules/`)

| Módulo | Função |
|--------|--------|
| `firebaseService.js` | CRUD no Firestore/Storage |
| `auth.js` | Autenticação (narrador/login) |
| `chat.js` | Chat e notificações |
| `cardManager.js` | Estado e cache dos cards |
| `cardRenderer.js` | Renderização HTML dos cards |
| `cardModal.js` | Modal de criação/edição |
| `shortcodeParser.js` | Processa `[hp]`, `[stat]`, `[money]`, `[count]`, `[xp]` |
| `diceLogic.js` | Lógica de rolagem de dados |
| `dice3d.js` | Visualização 3D dos dados |
| `ui.js` | Toasts, loaders, confirmações |
| `layout.js` | Inicialização do layout global |
| `board.js` | Gerenciamento do whiteboard |
| `grid.js` | Grid responsivo com Muuri |

### Whiteboard (`assets/js/whiteboard/`)
- `canvas.js` - Canvas principal
- `tools.js` - Ferramentas de desenho
- `shapes.js` - Gerenciamento de formas
- `boardManager.js` - Estado do tabuleiro
- `history.js` - Histórico de ações
- `clipboard.js` - Área de transferência

## Categorias de Cards

- `pj` - Personagem
- `monstro` - Monstro
- `npc` - NPC
- `item` - Item
- `anotacao` - Anotação

## Shortcodes RPG

Shortcodes permitem criar elementos interativos nos cards. Use-os no conteúdo HTML dos cards.

### Sintaxe Base

```
[tag:valor]
[tag:label:valor]
[tag:label:valor:opções]
```

### Shortcodes Disponíveis

#### HP (Vida)

```
[hp:100]                    # HP máximo
[hp:current/max]            # Com valor atual e máximo
[hp:85/100:modificador]     # Com modificador (ex: -5 de envenenamento)
```

**Exemplo:**
```
[hp:85/100:-5] → ████████░░ 85/100 (-5)
```

#### Atributos (Stat)

```
[stat:Nome:valor]
[stat:Nome:valor:modificador]
[stat:Nome:valor:modificador:save]  # Com teste de resistência
```

**Exemplo:**
```
[stat:Força:16]
[stat:Destreza:14:+2]
[stat:Constituição:15:+2:save] → CON 15 (+2) TS: +5
```

#### Dinheiro

```
[money:valormoeda]
[money:valor1moeda1,valor2moeda2]
```

**Moedas:** `po` (ouro), `pp` (prata), `pc` (cobre), `pe` (eletrum), `pl` (platina)

**Exemplo:**
```
[money:100po,50pp,200pc] → 💰 100 po | 50 pp | 200 pc
```

#### Contador

```
[count:valor_inicial]
[count:valor_inicial:incremento]
[count:valor_inicial:incremento:máximo]
```

**Exemplo:**
```
[count:0:1:10]     # Contador de 0 a 10, +1 por clique
[count:3]          # Contador simples
```

#### XP (Experiência)

```
[xp:valor_atual/total]
[xp:valor_atual/total:próximo_nível]
```

**Exemplo:**
```
[xp:2500/5000:7000] → ✨ 2500/5000 XP (próx: 7000)
```

### Containers

Agrupam elementos visuais:

```
[container:tipo]
  ... conteúdo ...
[/container]
```

**Tipos:**
- `hbox` - Layout horizontal
- `vbox` - Layout vertical
- `panel:título` - Painel com título

### Links para Cards

```
[card:nome_do_card]
[card:nome_do_card:texto_exibido]
```

**Exemplo:**
```
[card:Goblin]
[card:Goblin:Ver Goblin]
```

### Uso no Editor

1. Selecione texto no editor Tiptap
2. Use o painel de inserção de shortcodes
3. Ou digite manualmente: `[hp:50]` e pressione Enter

### Parser API

```javascript
import { parseShortcodes } from './modules/shortcodeParser.js';

const html = parseShortcodes(card.conteudo);
// Substitui [hp:10] por <span class="rpg-hp" data-max="10">...</span>
```

## Roles

- **Narrador**: Acesso completo (criar, editar, ocultar cards)
- **Jogador**: Acesso apenas a cards visíveis

## Comandos

```javascript
// Inicializar layout
import { initializeLayout } from './modules/layout.js';
const layout = await initializeLayout({ fabActions: ['chat', 'dice'] });

// Criar card
firebaseService.addItem({ titulo, conteudo, tags, category, isVisibleToPlayers });

// Rolagem
diceLogic.processRoll() → firebaseService.sendDiceRoll() → dice3d.visualizeDiceRoll();
```

## Build

```bash
# Development
npm run dev

# Production (minificado)
npm run build
```

Arquivos de saída minificados:
- `*.min.js`
- `*.min.html`
