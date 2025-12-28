  // Importa as funções necessárias do Firebase
  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
  import { getStorage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

  // Suas chaves de configuração do Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyCjS2V6xGDoMtNjqwiUe1njK5MaEQWEth4",
    authDomain: "boardonepiecerpg.firebaseapp.com",
    projectId: "boardonepiecerpg",
    storageBucket: "boardonepiecerpg.firebasestorage.app",
    messagingSenderId: "135162194357",
    appId: "1:135162194357:web:808a93b49c2c55729891fc"
  };

  // Inicializa o Firebase
  const app = initializeApp(firebaseConfig);

  // Anexa as instâncias do DB e do Storage ao objeto 'window' para que fiquem globalmente acessíveis
  window.firebaseInstances = {
    db: getFirestore(app),
    storage: getStorage(app)
  };
