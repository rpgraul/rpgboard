# GameBoard v2

Web App modular para RPG de mesa com foco em **Reatividade** e **Performance**.

---

## Stack Atualizada (v2)

| Camada | Tecnologia |
|---|---|
| Framework | Svelte 5 (Runes: `$state`, `$derived`, `$effect`) |
| Bundler | Vite |
| UI & Components | Bits UI (Headless) + Tailwind CSS (Estilo Shadcn/Dark) |
| Icons | Lucide Svelte *(substituindo FontAwesome 5)* |
| Backend | Firebase v11.3.0 (Firestore + Storage + Auth + Hosting) |
| Grid & Layout | Muuri `@0.9.5` *(encapsulado em Svelte Actions)* |
| Editor | Tiptap 2.0+ |
| 3D Dice | `@3d-dice/dice-box` `@1.1.4` |
| Whiteboard | Fabric.js v6.x |
| Áudio | YouTube IFrame API |

---

## Arquitetura de Estado

O projeto migrou de manipulação direta de DOM para **Svelte Runes**.

- **Global State:** Gerenciado em `src/lib/state/game.svelte.js`.
- **Firebase Sync:** O Firestore alimenta as Runes do Svelte, disparando atualizações de UI automaticamente.

---

## Estrutura de Diretórios (SPA)

```text
src/
├── assets/
│   ├── app.css
│   └── asset/
├── components/
│   ├── ui/
│   ├── grid/
│   ├── dice/
│   ├── whiteboard/
│   ├── chat/
│   └── editor/
├── lib/
│   ├── firebase/
│   ├── state/
│   ├── utils/
│   └── actions/
├── routes/
│   ├── Dashboard
│   ├── SheetMode
│   ├── TextMode
│   ├── WhiteboardView
│   ├── ChatView
│   └── UploadView
├── App.svelte
└── main.js
```

---

## Modelo de Dados Firestore

```js
// Coleção: users
users/{uid}: {
  displayName: string,
  email: string,
  role: "narrador" | "jogador"
}

// Coleção: games
games/{gameId}: {
  nome: string,
  criadoEm: timestamp
}

// Sub-coleção: cards
games/{gameId}/cards/{cardId}: {
  titulo: string,
  conteudo: string,
  tags: string[],
  category: string,
  isVisibleToPlayers: boolean,
  imagemUrl: string,
  posicao: object
}

// Sub-coleção: chat
games/{gameId}/chat/{messageId}: {
  uid: string,
  autor: string,
  mensagem: string,
  timestamp: timestamp,
  tipo: string
}

// Sub-coleção: rolls
games/{gameId}/rolls/{rollId}: {
  uid: string,
  autor: string,
  expressao: string,
  resultado: number,
  detalhes: object,
  timestamp: timestamp
}
```

---

## Diretrizes de Implementação

1. **Estilo:** Proibido Bulma. Use **Tailwind CSS** (Tema `Zinc-950`).
2. **UI:** Seguir padrão **Shadcn/UI** (Clean/Dark).
3. **Bits UI:** Consultar [bits-ui.com/docs/llms.txt](https://bits-ui.com/docs/llms.txt).
4. **Reatividade:** Usar Runes (`$state`, `$derived`, `$effect`). **Proibido** `getElementById`.
5. **Firebase:** Limpar listeners (`onSnapshot`) na destruição do componente.

---

## Shortcodes RPG

| Shortcode | Descrição |
|---|---|
| `[hp:atual/max:mod]` | Pontos de vida com modificador |
| `[stat:Nome:valor:mod:save]` | Atributo com valor, modificador e saving throw |
| `[money:100po,50pp]` | Dinheiro em múltiplas moedas |
| `[count:inicial:inc:max]` | Contador configurável |
| `[xp:atual/total:prox]` | Experiência atual, total e próximo nível |
| `[container:tipo]...[/container]` | Container de layout |
| `[card:nome:label]` | Card referenciável |

---

## Comandos

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento
npm run dev

# Build de produção
npm run build

# Deploy para Firebase Hosting
firebase deploy
```
  