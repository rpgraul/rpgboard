# Sheet-Mode - Análise Técnica

## 1. Visão Geral

**Arquivo:** `assets/js/sheet-mode.js`  
**Tamanho:** 815 linhas  
**HTML:** `sheet-mode.html` (116 linhas)  
**CSS:** `assets/css/sheet-mode.css` (355 linhas)

### Propósito
Página para gerenciamento de fichas de personagens com:
- Seleção de Personagem
- Editor Tiptap para conteúdo (inline)
- Macros de dados
- Upload de imagem
- Notas do player
- Dados rápidos (dice bar)

---

## 2. Arquitetura Atual

```
DOMContentLoaded
├── initializeLayout()          → Header, FAB, Overlays
├── initializeApp()            → Settings + Firebase
├── injectSheetLayoutHTML()    → Sidebar + Main + Footer (DOM injetado)
├── initializeMainEditor()     → Tiptap com extensões
├── listenToItems()            → Firebase listener
├── setupSheetSpecificListeners()
└── loadMacros()
```

---

## 3. Funcionalidades Atuais

| # | Funcionalidade | Local | Status |
|---|----------------|-------|--------|
| 1 | Seleção de Personagem | `openCharSelection()` | ✅ Funcionando |
| 2 | Carregamento de Personagem | `loadCharacter()` | ✅ Funcionando |
| 3 | Editor Tiptap | `initializeMainEditor()` | ✅ Funcionando |
| 4 | Shortcodes Inline (HP, Stat, Money, Count, XP) | Tiptap Extensions | ✅ Funcionando |
| 5 | Criação de Macros | `saveMacro()` | ✅ Salva, ❌ Não carrega |
| 6 | Upload de Imagem | `handleCharImageUpload()` | ✅ Funcionando |
| 7 | Auto-save | `handleAutoSave()`, `syncToFirebase()` | ✅ Funcionando |
| 8 | Chat Rápido | Sheet input | ✅ Funcionando |
| 9 | Container Editor | sideViewEditor (modal) | ⚠️ Remover (usar inline) |

---

## 4. Plano de Ação Aprovado

### 🔴 ETAPA 1: Limpeza - Remoções (Prioridade Alta)

#### 4.1 Remover referências a visualStatsContainer/visualCountsContainer
- **Linhas:** 217-224
- **Motivo:** Stats visuais não serão mais usados na sidebar (usar inline como text-mode)
- **Ação:** Remover código que渲染 stats na sidebar

#### 4.2 Remover setupInteractiveSheetListeners()
- **Linhas:** 671-811 (inteira)
- **Motivo:** Função dependia dos containers removidos
- **Ação:** Remover função inteira

#### 4.3 Remover renderContainers()
- **Linhas:** 557-623
- **Motivo:** Containers serão editados inline, não mais como botões na sidebar
- **Ação:** Remover função inteira e chamada em loadCharacter()

#### 4.4 Remover updateFichaShortcode()
- **Linha:** 781 (chamada)
- **Motivo:** Função não existe, código quebrado
- **Ação:** Remover chamada e usar syncToFirebase()

#### 4.5 Remover sideViewEditor
- **Motivo:** Usar edição inline como text-mode
- **Ação:** Remover initializeSideViewEditor() e relacionados

#### 4.6 Remover listeners órfãos
- `#edit-sheet-btn` → openSheetEditor() (linhas 257-260)
- `#shortcode-insert-btn` → handleShortcodeGeneration() (linhas 282-285)
- `.shortcode-generator-btn` → openShortcodeGeneratorModal() (linhas 308-324)
- Shortcode generator modal (linhas 314-324)
- **Ação:** Remover todos esses listeners e referências

---

### 🟠 ETAPA 2: Correções (Prioridade Alta)

#### 4.7 Implementar loadMacros()
- **Motivo:** Macros são salvos no Firebase mas não carregam na inicialização
- **Ação:** Criar função que chama renderMacroButtons()

#### 4.8 Simplificar loadCharacter()
- **Motivo:** Remover código de stats visuais e containers
- **Ação:** Manter apenas: imagem, nome, categoria, editor, notes, macros

#### 4.9 Simplificar injectSheetLayoutHTML()
- **Motivo:** Remover elementos que não serão mais usados
- **Ação:** Manter apenas: sidebar (img, nome), main (editor), footer (dice, macros, chat)

---

### 🟡 ETAPA 3: Usabilidade (Prioridade Média)

#### 4.10 Feedback ao criar macro
- **Arquivo:** `saveMacro()` (linhas 475-488)
- **Ação:** Adicionar `showToast("Macro criado!", "is-success")`

#### 4.11 Validar fórmula de macro
- **Arquivo:** `saveMacro()`
- **Ação:** Testar fórmula com processRoll() antes de salvar. Se falhar, mostrar erro.

#### 4.12 Organizar toolbar
- **Arquivo:** `initializeMainEditor()` (linhas 342-380)
- **Ação:** Adicionar separadores visuais entre grupos:
  - Grupo 1: Desfazer/Refazer
  - Grupo 2: Formatação (H1-H3, listas)
  - Grupo 3: Estilo (negrito, itálico, etc)
  - Grupo 4: Alinhamento
  - Grupo 5: Shortcuts RPG (HP, Stat, Money, Count)

#### 4.13 Indicador de salvamento (playerNotes)
- **Arquivo:** `handleAutoSave()` ou listener de notesEditor
- **Ação:** Adicionar texto "Salvando..." / "Salvo ✓" abaixo do campo

---

## 5. Decisões Tomadas

| Item | Decisão | Motivo |
|------|---------|--------|
| Stats visuais | Remover | Usar inline como text-mode |
| Tabs | Remover | Abandono, não usado |
| Container Editor | Remover modal | Usar inline como text-mode |
| #edit-sheet-btn | Remover | Função não implementada |
| #shortcode-insert-btn | Remover | Função não implementada |
| .shortcode-generator-btn | Remover | Função não implementada |
| Toolbar | Reorganizar | Melhor usabilidade |
| Feedback macro | Adicionar toast | Melhora UX |
| Validação macro | Adicionar | Evita erros |

---

## 6. Foco do Modo Ficha

### ✅ Incluído
- Imagem do card (sidebar)
- Editor de conteúdo interativo (inline shortcodes)
- Notas do player (playerNotes)
- Dados rápidos (dice bar)
- Macros (criar, usar, deletar)

### ❌ Removido
- Stats visuais na sidebar (usar inline)
- Tabs
- Container editor separado (usar inline)
- Botões órfãos sem função

---

## 7. Código Relevante

### Variáveis do Módulo
```javascript
let allItems = [];
let currentCharacterId = null;
let currentCharacter = null;
let autoSaveTimeout = null;
let mainEditor = null;
let mainEditorSaveTimeout = null;
let imgEl, nameEl, notesEditor;
let isDataReady = false;
```

### Imports
```javascript
import { listenToItems, updateItem, updateCharacterStat, addChatMessage, uploadImageToImgBB } from './modules/firebaseService.js';
import { initializeApp } from './modules/appInitializer.js';
import { initializeAuth, getCurrentUserName, isNarrator } from './modules/auth.js';
import { showToast } from './modules/ui.js';
import { processRoll } from './modules/diceLogic.js';
```

---

## 8. Checklist de Implementação

### Etapa 1: Limpeza
- [ ] 1.1 - Remover visualStatsContainer/visualCountsContainer de loadCharacter()
- [ ] 1.2 - Remover setupInteractiveSheetListeners()
- [ ] 1.3 - Remover renderContainers()
- [ ] 1.4 - Remover updateFichaShortcode() (linha 781)
- [ ] 1.5 - Remover sideViewEditor e related
- [ ] 1.6 - Remover listeners órfãos

### Etapa 2: Correções
- [ ] 2.1 - Implementar loadMacros()
- [ ] 2.2 - Simplificar loadCharacter()
- [ ] 2.3 - Simplificar injectSheetLayoutHTML()

### Etapa 3: Usabilidade
- [ ] 3.1 - Adicionar toast em saveMacro()
- [ ] 3.2 - Validar fórmula de macro
- [ ] 3.3 - Organizar toolbar com separadores
- [ ] 3.4 - Adicionar indicador em playerNotes

---

## 9. Referências de Linhas (Pré-Refatoração)

| Trecho | Linhas | Ação |
|--------|--------|------|
| injectSheetLayoutHTML | 114-156 | Simplificar |
| loadCharacter | 198-244 | Simplificar |
| initializeMainEditor | 337-464 | Toolbar + cleanup |
| setupInteractiveSheetListeners | 671-811 | **REMOVER** |
| renderContainers | 557-623 | **REMOVER** |
| saveMacro | 475-488 | Adicionar toast + validação |
| setupSheetSpecificListeners | 256-325 | Remover órfãos |

---

*Documento atualizado em 2026-03-27*
*Planejamento aprovado para implementação*
