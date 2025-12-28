document.addEventListener('DOMContentLoaded', () => {
    // 1. Obter referências aos elementos da página
    const textInput = document.getElementById('text-input');
    const jsonOutput = document.getElementById('json-output');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const gotoUploadBtn = document.getElementById('goto-upload-btn');
    const notificationArea = document.getElementById('notification-area');
    const showPromptBtn = document.getElementById('show-prompt-btn');
    const aiPromptModal = document.getElementById('ai-prompt-modal');

    /**
     * Exibe uma notificação para o usuário.
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - O tipo de notificação (ex: 'is-success', 'is-danger').
     */
    function showNotification(message, type = 'is-success') {
        notificationArea.innerHTML = `
            <div class="notification ${type}">
                <button class="delete"></button>
                ${message}
            </div>
        `;
        notificationArea.querySelector('.delete')?.addEventListener('click', () => {
            notificationArea.innerHTML = '';
        });
    }

    /**
     * Processa o texto de entrada e o converte para um array de objetos.
     */
    function handleConversion() {
        const rawText = textInput.value.trim();
        if (!rawText) {
            showNotification('O campo de texto não pode estar vazio.', 'is-warning');
            return;
        }

        // Limpa notificações e resultados antigos
        notificationArea.innerHTML = '';
        jsonOutput.value = '';
        copyBtn.classList.add('is-hidden');
        gotoUploadBtn.classList.add('is-hidden');

        // Separa o texto em blocos de cards usando '---' como delimitador
        const cardBlocks = rawText.split(/^\s*---\s*$/m);
        const cardsArray = [];
        let errorOccurred = false;

        cardBlocks.forEach((block, index) => {
            const trimmedBlock = block.trim();
            if (!trimmedBlock) return;

            const cardObject = {};
            const lines = trimmedBlock.split('\n');

            lines.forEach(line => {
                const match = line.match(/^([^:]+):\s*(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim();
                    cardObject[key] = value;
                }
            });

            // Validação: Título é obrigatório
            if (!cardObject.titulo) {
                showNotification(`Erro no Card #${index + 1}: O campo 'titulo' é obrigatório.`, 'is-danger');
                errorOccurred = true;
                return;
            }

            // Processamento de tipos de dados específicos
            if (cardObject.tags) {
                cardObject.tags = cardObject.tags.split(',').map(tag => tag.trim()).filter(Boolean);
            }
            if (cardObject.hasOwnProperty('isVisibleToPlayers')) {
                // Converte a string 'false' para o booleano false. Qualquer outra coisa não será 'false'.
                cardObject.isVisibleToPlayers = cardObject.isVisibleToPlayers.toLowerCase() !== 'false';
            }

            cardsArray.push(cardObject);
        });

        if (errorOccurred) {
            return; // Interrompe se um erro de validação foi encontrado
        }

        if (cardsArray.length > 0) {
            // Formata o JSON com indentação para facilitar a leitura
            jsonOutput.value = JSON.stringify(cardsArray, null, 2);
            copyBtn.classList.remove('is-hidden');
            gotoUploadBtn.classList.remove('is-hidden');
            showNotification(`${cardsArray.length} card(s) convertido(s) com sucesso!`, 'is-success');
        } else {
            showNotification('Nenhum card válido foi encontrado no texto.', 'is-warning');
        }
    }

    /**
     * Copia o conteúdo do campo de saída para a área de transferência.
     */
    async function handleCopy() {
        if (!jsonOutput.value) return;

        try {
            await navigator.clipboard.writeText(jsonOutput.value);
            copyBtn.textContent = 'Copiado!';
            copyBtn.classList.remove('is-success');
            copyBtn.classList.add('is-info');

            setTimeout(() => {
                copyBtn.innerHTML = '<span class="icon"><i class="fas fa-copy"></i></span><span>Copiar JSON</span>';
                copyBtn.classList.remove('is-info');
                copyBtn.classList.add('is-success');
            }, 2000);
        } catch (err) {
            showNotification('Falha ao copiar o texto.', 'is-danger');
            console.error('Erro ao copiar:', err);
        }
    }

    /**
     * Controla a abertura e fechamento do modal de prompt da IA.
     */
    function initializePromptModal() {
        if (!showPromptBtn || !aiPromptModal) return;

        const closeElements = aiPromptModal.querySelectorAll('.modal-background, .delete');

        showPromptBtn.addEventListener('click', () => {
            aiPromptModal.classList.add('is-active');
        });

        closeElements.forEach(el => {
            el.addEventListener('click', () => {
                aiPromptModal.classList.remove('is-active');
            });
        });
    }

    /**
     * Creates a temporary visual feedback element near the cursor.
     * @param {MouseEvent} event - The click event.
     * @param {string} text - The text to display.
     */
    function createClickFeedback(event, text = 'Copiado!') {
        const feedbackEl = document.createElement('div');
        feedbackEl.textContent = text;
        feedbackEl.className = 'click-feedback';
        document.body.appendChild(feedbackEl);

        // Position near the cursor
        feedbackEl.style.left = `${event.pageX + 15}px`;
        feedbackEl.style.top = `${event.pageY}px`;

        // Animate out and remove
        setTimeout(() => {
            feedbackEl.style.opacity = '0';
            setTimeout(() => {
                feedbackEl.remove();
            }, 500);
        }, 700);
    }

    // 2. Adicionar os listeners de eventos aos botões
    convertBtn.addEventListener('click', handleConversion);
    copyBtn.addEventListener('click', handleCopy);
    initializePromptModal();

    // 3. Listener global para copiar conteúdo de tags <code>
    document.body.addEventListener('click', async (event) => {
        const codeBlock = event.target.closest('pre > code');
        if (codeBlock) {
            await navigator.clipboard.writeText(codeBlock.textContent);
            createClickFeedback(event);
        }
    });
});
