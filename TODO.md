# TODO - Correções do Site

## Problemas Identificados

---

### 1. FAB fica travado ao trocar de modos ✅ CORRIGIDO

**Sintoma:** Ao navegar entre páginas (grid → notas → whiteboard), o FAB não atualiza.

**Solução:** 
- Modificado `renderFab()` para aceitar `currentPath` como parâmetro
- Modificado `router.js` para chamar `renderFab(pathname)` após cada navegação

**Arquivos modificados:**
- `public/assets/js/modules/components/fab.js`
- `public/assets/js/router.js`
- `public/assets/js/modules/layout.js`

---

### 2. Whiteboard não carrega o canvas ✅ CORRIGIDO

**Sintoma:** Erro `ReferenceError: fabric is not defined`.

**Solução:** 
- Modificado `initWhiteboard()` para async
- Adicionado `await window.__loadFabric()` antes de usar fabric

**Arquivos modificados:**
- `public/assets/js/whiteboard/index.js`

---

### 3. Dice 3D não funciona - API antiga ✅ CORRIGIDO

**Sintoma:** Erro `You are using the old API`.

**Solução:** 
- Modificado construtor para nova API: `new DiceBox({ id: 'container', ...config })`

**Arquivos modificados:**
- `public/assets/js/modules/dice3d-box.js`

---

### 4. Dice 3D não funciona - Assets não carregam 🔄 EM TESTE

**Sintoma:** Erro `Ammo file '.../dice-boxammo/ammo.wasm.wasm' not found`.

**Solução aplicada:**
- Adicionado `/` no final do assetPath
- Adicionado `origin` à configuração

**Arquivos modificados:**
- `public/assets/js/modules/dice3d-box.js`

**Nota:** Se ainda não funcionar, pode ser necessário usar fallback para dados sem simulação 3D.

---

### 5. Música não funciona ✅ CORRIGIDO

**Sintoma:** Música para ao trocar de página.

**Solução:**
- Modificado `renderOverlays()` para preservar o iframe de áudio entre navegações
- O iframe agora é salvo antes do innerHTML e restaurado após

**Arquivos modificados:**
- `public/assets/js/modules/components/commonHTML.js`

---

## Resumo das Correções

| # | Problema | Status |
|---|----------|--------|
| 1 | FAB Stuck | ✅ Corrigido |
| 2 | Whiteboard Fabric | ✅ Corrigido |
| 3 | Dice API | ✅ Corrigido |
| 4 | Dice Assets | 🔄 Em teste |
| 5 | Música | ✅ Corrigido |

---

## Próximos Passos

1. Testar o site para verificar se as correções funcionam
2. Se os dados 3D ainda não funcionarem, implementar fallback para dados simples
3. Atualizar documentação/gemini.md com as mudanças
