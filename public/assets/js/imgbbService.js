const IMGBB_API_KEY = window.IMGBB_API_KEY;

export async function uploadImage(file) {
  if (!IMGBB_API_KEY) {
    throw new Error("Chave da API do ImgBB não encontrada.");
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
       // Se a resposta não for OK (ex: erro 400, 500), leia o erro
       const errorData = await response.json();
       console.error('Erro da API do ImgBB:', errorData);
       throw new Error(`Falha no upload para o ImgBB: ${errorData.error.message}`);
    }

    const jsonResponse = await response.json();

    // Verificação crucial para evitar o erro
    if (jsonResponse && jsonResponse.data && jsonResponse.data.url) {
      return {
        url: jsonResponse.data.url,
        // O ImgBB não retorna um storagePath, então retornamos null ou omitimos
        storagePath: null 
      };
    } else {
      // Se a resposta for bem-sucedida mas não tiver a URL
      console.error('Resposta inesperada do ImgBB:', jsonResponse);
      throw new Error('Formato de resposta inesperado do ImgBB.');
    }

  } catch (error) {
    console.error('Erro ao fazer upload da imagem para o ImgBB:', error);
    throw error; // Propaga o erro para ser tratado por quem chamou a função
  }
}