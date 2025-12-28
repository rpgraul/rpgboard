# Pilha de Tecnologia
* **Linguagem:** JavaScript
* **Backend & Database:** Firebase (Firestore para dados e Storage para imagens)* **Framework CSS:** Bulma
* **Ícones:** Font Awesome

# Bibliotecas JavaScript:
* **Muuri:** Para a grade interativa e arrastável.
* **Web Animations API Polyfill:** Dependência do Muuri para animações.

# Estrutura do Projeto
* assets/css/
* assets/js/
* modules/

# Estilo de Código
* **Comentários em HTML:** Usar apenas para delimitar seções principais do layout.
* **Comentários em CSS:** Evitar o uso de comentários.
* **Comentários em JavaScript:** Devem ser concisos e diretos, explicando o propósito de uma função ou de um bloco de código complexo.
* **Exemplo:** // Filtra os itens na grade com base no input de busca e tags selecionadas

# Diretrizes de Desenvolvimento

## Divisão de Tarefas
* **SEMPRE dividir qualquer tarefa em etapas menores e executáveis**
* **Cada etapa deve ser específica e testável**
* **Priorizar implementações incrementais**

## Arquivos de Trabalho
* **SEMPRE trabalhar nos arquivos não minimizados**
* **Evitar uso de arquivos .min.js durante desenvolvimento**
* **Manter código legível e estruturado**
* **Faça edições não destrutivas, nunca remova funções a não ser que seja explicitamente solicitado**

## Arquitetura de Cards
* **Cards unificados:** Um único componente de card que funcione em todos os modos
* **Grid e Board:** Mesma estrutura HTML e JavaScript para ambos os modos
* **Evitar duplicação:** Não repetir funções para diferentes modos de visualização
* **Responsividade:** Cards devem se adaptar automaticamente ao modo atual (grid/board)
* **Funcionalidades integradas:** Drag & drop, edição, e interações devem funcionar em ambos os modos