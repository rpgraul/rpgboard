import { writeBatch, collection, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { processImageFromUrl } from './modules/imgbbService.js';

const { db } = window.firebaseInstances;

document.addEventListener('DOMContentLoaded', () => {
  const jsonInput = document.getElementById('json-input');
  const importBtn = document.getElementById('import-btn');
  const notificationArea = document.getElementById('notification-area');

  function showNotification(message, type = 'is-success') {
    notificationArea.innerHTML = `
      <div class="notification ${type}">
        <button class="delete"></button>
        ${message}
      </div>
    `;

    const deleteButton = notificationArea.querySelector('.delete');
    deleteButton.addEventListener('click', () => {
      notificationArea.innerHTML = '';
    });
  }

  importBtn.addEventListener('click', async () => {
    const jsonText = jsonInput.value.trim();

    if (!jsonText) {
      showNotification('O campo de JSON não pode estar vazio.', 'is-danger');
      return;
    }

    let cards;
    try {
      cards = JSON.parse(jsonText);
    } catch (error) {
      showNotification(`Erro de sintaxe no JSON: ${error.message}`, 'is-danger');
      return;
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      showNotification('O JSON deve ser um array de cards e não pode estar vazio.', 'is-danger');
      return;
    }

    importBtn.classList.add('is-loading');
    notificationArea.innerHTML = '';

    try {
      const batch = writeBatch(db);
      const itemsCollectionRef = collection(db, 'rpg-items');

      for (const card of cards) {
        const newCardRef = doc(itemsCollectionRef);

        const dataToWrite = {
          ...card,
          titulo: card.titulo || 'Card Sem Título',
          conteudo: card.conteudo || '',
          descricao: card.descricao || '',
          tags: card.tags || [],
          isVisibleToPlayers: card.isVisibleToPlayers ?? true,
          createdAt: serverTimestamp(),
          order: card.order ?? -Date.now()
        };

        // Processa imagem se fornecida
        if (card.imagem && typeof card.imagem === 'string') {
          showNotification(`Processando imagem para: ${card.titulo}...`, 'is-info');
          
          const imageData = await processImageFromUrl(card.imagem);
          
          if (imageData) {
            Object.assign(dataToWrite, {
              url: imageData.url,
              deleteUrl: imageData.deleteUrl,
              width: imageData.width,
              height: imageData.height
            });
          }
        }

        // Remove o campo 'imagem' original
        delete dataToWrite.imagem;
        // Remove campos antigos do Firebase Storage se existirem
        delete dataToWrite.storagePath;

        batch.set(newCardRef, dataToWrite);
      }

      await batch.commit();

      showNotification(`${cards.length} card(s) importado(s) com sucesso!`, 'is-success');
      jsonInput.value = '';
    } catch (error) {
      console.error("Erro ao importar cards:", error);
      showNotification(`Ocorreu um erro durante a importação: ${error.message}`, 'is-danger');
    } finally {
      importBtn.classList.remove('is-loading');
    }
  });
});