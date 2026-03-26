# Plano de Atualização do Fabric.js 7.0

## Visão Geral

| Item | Detalhe |
|------|---------|
| **Versão Atual** | 5.3.0 |
| **Versão Target** | 7.x (mais recente) |
| **Motivo** | Código legado (monkey-patch) + suporte moderno |
| **Escopo** | drawing-mode.html + 5 módulos JS |

---

## Breaking Changes do Fabric.js 7.0

### Mudanças que Afetam o Projeto

| Breaking Change | Descrição | Impacto |
|-----------------|-----------|---------|
| **originX/originY = 'center'** (novo padrão) | Objetos posicionados pelo centro | **Alto** - precisa adicionar `originX: 'left', originY: 'top'` explicitamente |
| **fireMiddleClick, fireRightClick, stopContextMenu = true** | Clicks não-esquerdo disparam eventos | **Médio** - reverter para false |
| **getPointer() removido** | Substituído por `getScenePoint()` e `getViewportPoint()` | **Alto** - alterar chamadas |
| **setWidth/setHeight removidos** | Usar `setDimensions({ width, height })` | **Baixo** - verificar uso |
| **loadFromJSON agora Promise** | Callback → Promise | **Médio** - alterar boardManager.js |
| **Gradient opacity removido** | Não afeta nosso uso | Nenhum |

---

## Arquivos Afetados

| Arquivo | Uso do Fabric.js | Complexidade |
|---------|------------------|--------------|
| `drawing-mode.html:17` | CDN | Baixa |
| `whiteboard/canvas.js` | Canvas, Object.customProperties, Text._renderBackground | Alta |
| `whiteboard/shapes.js` | IText, Rect, Circle, Triangle, Line, Group, getPointer | Alta |
| `whiteboard/tools.js` | PencilBrush, Color, getPointer | Média |
| `whiteboard/assets.js` | Image.fromURL, IText, Group | Média |
| `whiteboard/boardManager.js` | loadFromJSON (Promise) | Média |

---

## Análise Detalhada - shape.js

### getPointer - Linhas 40 e 108
```javascript
// ANTES (5.x)
const pointer = canvas.getPointer(o.e);

// DEPOIS (7.x)
// Opção 1: getScenePoint (coordenada do objeto no canvas)
const pointer = canvas.getScenePoint(o.e);

// Opção 2: getViewportPoint (coordenada da viewport)
const pointer = canvas.getViewportPoint(o.e);
```

### originX/originY - Linhas 78, 84, 91, 145, 149
```javascript
// ANTES - Sem origem explícita (usava padrão 'left')
new fabric.Rect({ left: origX, top: origY, ... });

// DEPOIS - Com origem explícita para manter comportamento
new fabric.Rect({ left: origX, top: origY, originX: 'left', originY: 'top', ... });
```

---

## Análise Detalhada - tools.js

### getPointer - Linhas ?
Procurar todas as ocorrências de `canvas.getPointer` e atualizar.

---

## Análise Detalhada - assets.js

### originX/originY - Linhas 66, 80, 260, 280
```javascript
// ANTES
img.set({ left: 0, top: 0, originX: 'center', originY: 'center' });

// DEPOIS
img.set({ left: 0, top: 0, originX: 'left', originY: 'top' });
// ou manter 'center' se for intencional
```

### fabric.Image.fromURL
Ainda suporta callbacks na v7, mas pode migrar para Promise:
```javascript
// ANTES
fabric.Image.fromURL(url, callback, { crossOrigin: 'anonymous' });

// DEPOIS (Promise)
const img = await fabric.Image.fromURL(url, { crossOrigin: 'anonymous' });
```

---

## Análise Detalhada - canvas.js

### Inicialização do Canvas (linhas 15-24)
```javascript
// ANTES
canvas = new fabric.Canvas(canvasId, {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: '#ffffff',
    isDrawingMode: false,
    selection: true,
    preserveObjectStacking: true,
    fireMiddleClick: true,        // era false em 5.3
    stopContextMenu: true          // era false em 5.3
});

// DEPOIS - Para manter comportamento antigo:
canvas = new fabric.Canvas(canvasId, {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: '#ffffff',
    isDrawingMode: false,
    selection: true,
    preserveObjectStacking: true,
    fireMiddleClick: false,        // reverter para false
    fireRightClick: false,        // NOVO - reverter para false
    stopContextMenu: false         // reverter para false
});
```

### Monkey-patch → customProperties (linhas 27-31)
```javascript
// ANTES
fabric.Object.prototype.toObject = (function (toObject) {
    return function (propertiesToInclude) {
        return toObject.call(this, ['uid', 'cardId'].concat(propertiesToInclude || []));
    };
})(fabric.Object.prototype.toObject);

// DEPOIS
fabric.Object.customProperties = ['uid', 'cardId'];
```

---

## Análise Detalhada - boardManager.js

### loadFromJSON (callback → Promise)
```javascript
// ANTES
canvas.loadFromJSON(json, () => {
    canvas.renderAll();
});

// DEPOIS
await canvas.loadFromJSON(json);
canvas.renderAll();
// ou
canvas.loadFromJSON(json).then(() => {
    canvas.renderAll();
});
```

---

## Plano de Execução

### Etapa 1: Atualizar CDN ✅ CONCLUÍDO
- [x] `drawing-mode.html:17` → `https://unpkg.com/fabric@7.x/dist/fabric.min.js`

### Etapa 2: canvas.js ✅ CONCLUÍDO
- [x] Atualizar opções do Canvas (fireMiddleClick, fireRightClick, stopContextMenu)
- [x] Substituir monkey-patch por `customProperties`
- [x] Testar inicialização

### Etapa 3: shapes.js ✅ CONCLUÍDO
- [x] Substituir `canvas.getPointer(o.e)` por `canvas.getScenePoint(o.e)`
- [x] Adicionar `originX: 'left', originY: 'top'` em todos os objetos
- [x] Testar criação de formas

### Etapa 4: tools.js ✅ CONCLUÍDO (sem alterações necessárias)
- [x] Verificar e atualizar chamadas de getPointer (não há uso)
- [x] Testar ferramentas de desenho

### Etapa 5: assets.js ✅ CORRIGIDO
- [x] Verificar origens em Image, IText, Group (já tinham origens explícitas center - intencional)
- [x] Atualizar fabric.Image.fromURL para Promise (3 ocorrências)
- [ ] Testar arrastar cards para o canvas

### Etapa 6: boardManager.js ✅ CONCLUÍDO
- [x] Converter loadFromJSON para Promise
- [x] Testar salvar/carregar board

### Etapa 7: history.js ✅ CORRIGIDO
- [x] Converter loadFromJSON para Promise
- [ ] Testar Ctrl+Z (desfazer)

### Etapa 8: Correções Fabric 7.x
- [x] CDN: usar script loader com jsdelivr
- [x] history.js: loadFromJSON callback → Promise
- [x] assets.js: todas as 3 ocorrências de fabric.Image.fromURL atualizadas para Promise

### Etapa 7: Testes Gerais ⏳ PENDENTE
- [ ] Todos os testes de forma individual
- [ ] Teste de serialização (toJSON/toObject)
- [ ] Teste de deserialização (loadFromJSON)
- [ ] Teste com objetos complexos (groups)

---

## Verificações Pós-Atualização

### API deprecated/removida - Verificar uso no código:

| API | Substituição | Arquivo(s) |
|-----|-------------|------------|
| `canvas.getPointer()` | `canvas.getScenePoint()` ou `canvas.getViewportPoint()` | shapes.js, tools.js |
| `canvas.setWidth()` | `canvas.setDimensions({ width })` | Verificar |
| `canvas.setHeight()` | `canvas.setDimensions({ height })` | Verificar |

---

## Referências

- [Upgrading to Fabric.js 7.0](https://fabricjs.com/docs/upgrading/upgrading-to-fabric-70)
- [Fabric.js 6.0 Breaking Changes](https://github.com/fabricjs/fabric.js/issues/8299)
- [Documentação oficial](https://fabricjs.com/docs/)