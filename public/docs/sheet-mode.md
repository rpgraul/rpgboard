# Sheet-Mode - Documentação

## 1. Visão Geral

**Arquivo principal:** `assets/js/sheet-mode.js`  
**Tamanho:** 536 linhas  
**HTML:** `sheet-mode.html`  
**CSS:** `assets/css/sheet-mode.css`

### Propósito
Página para gerenciamento de fichas de personagens (modo ficha do RPG). Permite criar/editars fichas de personagens com editor rico, macros de dados, upload de imagem e notas do player.

---

## 2. Arquitetura do Sistema

### 2.1 Fluxo de Inicialização

```
DOMContentLoaded
├── initializeLayout()         → Header, FAB, Overlays (layout.js)
├── initializeApp()          → Settings + Firebase (appInitializer.js)
├── initializeAuth()         → Autenticação (auth.js)
├── initializeModals()       → Modais globais (modal.js)
├── chat.initializeChat()    → Chat (chat.js)
├── initializeDice()         → Dados (diceLogic.js)
├── injectSheetLayoutHTML() → DOM da ficha (injetado)
├── initializeMainEditor()  → Editor Tiptap
├── listenToItems()         → Firebase listener
├── setupSheetSpecificListeners()
└── loadMacros()
```

### 2.2 Estrutura do DOM (sheet-layout)

```html
<div class="sheet-layout">
    <aside class="sheet-sidebar">     <!-- Coluna 1 -->
        <!-- Imagem do personagem -->
        <div id="char-image-container">
            <img id="char-image">
            <label>Upload</label>
        </div>
        
        <!-- Nome e categoria -->
        <span id="char-category-label">PERSONAGEM</span>
        <h2 id="char-name"></h2>
    </aside>
    
    <main class="sheet-main">        <!-- Coluna 2 -->
        <!-- Editor Tiptap (2/3) -->
        <div id="editor-column">
            <div id="tiptap-container">
                <div class="tiptap-toolbar">...</div>
                <div id="editor"></div>
            </div>
            <p class="help">Alterações são salvas automaticamente.</p>
        </div>
        
        <!-- Notas do Player (1/3) -->
        <div id="notes-column">
            <label>Notas do Player</label>
            <textarea id="player-notes-editor"></textarea>
            <span id="player-notes-status"></span>
        </div>
    </main>
    
    <footer class="sheet-footer">    <!-- Coluna 3 -->
        <!-- Dice Bar -->
        <div class="dice-bar">
            <button data-dice="d4">D4</button>
            ...
        </div>
        
        <!-- Chat Input -->
        <input id="sheet-chat-input">
    </footer>
</div>
```

> **Nota:** Macros agora ficam na sidebar (abaixo do nome do personagem)

### 2.3 Variáveis Globais

```javascript
let allItems = [];              // Todos os cards do Firebase
let currentCharacterId = null;  // ID do personagem atual
let currentCharacter = null;    // Objeto do personagem atual
let autoSaveTimeout = null;     // Timer auto-save
let mainEditor = null;          // Instância Tiptap
let mainEditorSaveTimeout = null;
let imgEl, nameEl, notesEditor; // Elementos DOM
let isDataReady = false;         // Flag para bloquear saves prematuros
let isDataLoading = false;
```

---

## 3. Funcionalidades Implementadas

| # | Funcionalidade | Local | Status |
|---|----------------|-------|--------|
| 1 | Seleção de Personagem | `openCharSelection()` | ✅ Funcionando |
| 2 | Carregamento de Personagem | `loadCharacter()` | ✅ Funcionando |
| 3 | Editor Tiptap | `initializeMainEditor()` | ✅ Funcionando |
| 4 | Shortcodes Inline (HP, Stat, Money, Count) | Tiptap Extensions | ✅ Funcionando |
| 5 | Criação de Macros | `saveMacro()` | ✅ Funcionando + validado |
| 6 | Upload de Imagem | `handleCharImageUpload()` | ✅ Funcionando |
| 7 | Auto-save (editor) | `syncToFirebase()` | ✅ Funcionando |
| 8 | Auto-save (playerNotes) | `handleAutoSave()` | ✅ Funcionando + indicador |
| 9 | Chat Rápido | Sheet input + processRoll() | ✅ Funcionando |
| 10 | CardLinks (@menções) | click listener | ✅ Funcionando |
| 11 | Notas do Player | `playerNotes` | ✅ Na coluna 3 (abaixo do editor) |

---

## 4. Descrição das Funções

### 4.1 Inicialização

| Função | Descrição |
|--------|-----------|
| `injectSheetLayoutHTML()` | Injeta HTML do layout na `.sheet-layout` |
| `initializeMainEditor()` | Cria editor Tiptap com extensões |
| `setupSheetSpecificListeners()` | Configura listeners de eventos |
| `loadMacros()` | Carrega botões de macro do personagem |

### 4.2 Personagem

| Função | Descrição |
|--------|-----------|
| `openCharSelection()` | Abre modal para selecionar personagem PJ |
| `loadCharacter(id)` | Carrega dados do personagem no editor |
| `checkUrlAndLoad()` | Verifica URL ou localStorage para carregar personagem |

### 4.3 Editor

| Função | Descrição |
|--------|-----------|
| `syncToFirebase()` | Salva conteúdo do editor no Firebase |
| `handleAutoSave()` | Auto-save genérico com indicador visual |

### 4.4 Macros

| Função | Descrição |
|--------|-----------|
| `saveMacro()` | Cria novo macro com validação de fórmula |
| `testMacro()` | Testa fórmula sem salvar (mostra resultado) |
| `renderMacroButtons()` | Renderiza botões de macro na sidebar |

### 4.5 Utilitários

| Função | Descrição |
|--------|-----------|
| `handleCharImageUpload()` | Upload de imagem via ImgBB |
| `htmlToRaw()` | Converte HTML para texto puro |

---

## 5. Tarefas Pendentes (TODO)

### Alta Prioridade

- [x] **Corrigir erro `isDataReady is not defined** - Variável agora declarada
- [x] **Mover Notas do Player para coluna 3** - Agora está ao lado do editor
- [x] **Mover Macros para sidebar** - Agora estão abaixo do nome do personagem

### Média Prioridade

- [ ] Adicionar indicator visual de salvamento no editor (não apenas no playerNotes)
- [ ] Adicionar botão de mudança de personagem no FAB

### Baixa Prioridade

- [ ] Implementar sistema de abas (Attributes | Inventory | Spells)
- [ ] Adicionar preview de personagem

---

## 6. Histórico de Mudanças

### 2026-03-27 - Correções de Bugs

- **Corrigido:** `isDataReady is not defined` - Variável agora declarada
- **Corrigido:** Notas do Player movidas para coluna 3 (abaixo do editor)
- **Corrigido:** Macros movidos para sidebar (abaixo do nome)
- **Corrigido:** Salvar macros (processRoll agora retorna resultado)
- **Adicionado:** `let isDataReady = false;` nas variáveis globais
- **Adicionado:** Botão "Testar Fórmula" no modal de macro
- **Adicionado:** Documentação completa no modal de macros
- **Melhorado:** CSS dos macros (hover, tooltip, delete button)

### 2026-03-27 - Refatoração Grande

- **Removido:** Stats visuais na sidebar (visualStatsContainer, visualCountsContainer)
- **Removido:** setupInteractiveSheetListeners() - código quebrado
- **Removido:** renderContainers() - funcionalidade abandonada
- **Removido:** sideViewEditor - não usado
- **Removido:** Todos os listeners órfãos (edit-sheet-btn, shortcode-insert-btn, etc.)
- **Adicionado:** loadMacros() - macros agora carregam
- **Adicionado:** Toast e validação em saveMacro()
- **Adicionado:** Indicador de salvamento em playerNotes
- **Resultado:** 815 → 536 linhas (-34%)

---

## 7. Problemas Conhecidos

| # | Problema | Severidade | Status |
|---|----------|------------|--------|
| 1 | `isDataReady is not defined` | 🔴 Crítico | ✅ Corrigido |
| 2 | Notas na sidebar | 🟠 Alto | ✅ Corrigido (movido para coluna 3) |
| 3 | Tiptap warning: Duplicate extension names | 🟡 Baixo | Known issue |

---

## 8. Extensões Tiptap Utilizadas

```javascript
StarterKit       // Basics (heading, paragraph, list, etc.)
Highlight        // Highlight text
Underline        // Underline text
Link             // Links (openOnClick: false)
TextAlign        // Text alignment
CardLink         // @menções para cards
StatNode         // [stat "Força" "18"]
HpNode           // [hp max="20" current="15"]
MoneyNode        // [money gold current="100"]
CountNode        // [count "Flechas" max=20]
ContainerShortcode  // [container]
FichaShortcode   // [ficha]
```

---

## 9. Integrações com Outros Módulos

| Módulo | Funções Usadas |
|--------|---------------|
| firebaseService.js | `listenToItems`, `updateItem`, `uploadImageToImgBB`, `addChatMessage` |
| appInitializer.js | `initializeApp` |
| auth.js | `initializeAuth`, `getCurrentUserName`, `isNarrator` |
| layout.js | `initializeLayout` |
| modal.js | `openModal`, `closeModal`, `initializeModals`, `showDetailModal` |
| chat.js | `initializeChat` |
| diceLogic.js | `processRoll`, `initializeDice` |
| editorUtils.js | `preParseShortcodesForEditor`, `convertEditorHtmlToShortcodes`, `handleToolbarAction` |
| suggestionItems.js | `getSuggestionItems` |
| shortcodeInserter.js | `setupShortcodeMenu`, `openConfigModal` |
| ui.js | `showToast` |

---

*Documento atualizado em 2026-03-27*
*Manter atualizado a cada interação no código*
