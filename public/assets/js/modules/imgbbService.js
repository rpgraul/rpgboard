/**
 * Serviço para upload de imagens no ImgBB
 * Substitui o Firebase Storage
 */

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

/**
 * Faz upload de uma imagem para o ImgBB
 * @param {File} file - Arquivo de imagem para fazer upload
 * @returns {Promise<Object>} Objeto com url e deleteUrl da imagem
 */
export async function uploadImage(file) {
  const apiKey = window.IMGBB_API_KEY;
  
  if (!apiKey) {
    throw new Error('ImgBB API Key não configurada');
  }

  // Converte o arquivo para base64
  const base64Image = await fileToBase64(file);
  
  // Remove o prefixo "data:image/...;base64," do base64
  const base64Data = base64Image.split(',')[1];

  // Prepara os dados para envio
  const formData = new FormData();
  formData.append('key', apiKey);
  formData.append('image', base64Data);
  
  try {
    const response = await fetch(IMGBB_API_URL, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Erro ao fazer upload: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Falha no upload da imagem');
    }

    return {
      url: data.data.url,
      deleteUrl: data.data.delete_url,
      displayUrl: data.data.display_url,
      thumb: data.data.thumb.url,
      medium: data.data.medium.url
    };
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    throw error;
  }
}

/**
 * Converte um arquivo para base64
 * @param {File} file - Arquivo para converter
 * @returns {Promise<string>} String base64 da imagem
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    
    reader.readAsDataURL(file);
  });
}

/**
 * Processa uma imagem de uma URL (usado no upload.js)
 * @param {string} imageUrl - URL da imagem
 * @returns {Promise<Object>} Objeto com url da imagem e dimensões
 */
export async function processImageFromUrl(imageUrl) {
  try {
    const proxyUrl = 'https://corsproxy.io/?';
    const response = await fetch(proxyUrl + encodeURIComponent(imageUrl));
    
    if (!response.ok) {
      throw new Error(`Falha ao buscar imagem: ${response.statusText}`);
    }

    const blob = await response.blob();
    
    if (!blob.type.startsWith('image/')) {
      console.warn(`URL não aponta para uma imagem válida: ${imageUrl}`);
      return null;
    }

    // Obtém dimensões da imagem
    const dimensions = await getImageDimensions(blob);
    
    // Converte blob para File
    const file = new File([blob], 'uploaded_image.jpg', { type: blob.type });
    
    // Faz upload para o ImgBB
    const uploadResult = await uploadImage(file);

    return {
      url: uploadResult.url,
      deleteUrl: uploadResult.deleteUrl,
      ...dimensions
    };
  } catch (error) {
    console.error(`Não foi possível processar a imagem da URL ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Obtém as dimensões de uma imagem a partir de um blob
 * @param {Blob} blob - Blob da imagem
 * @returns {Promise<Object>} Objeto com width e height
 */
function getImageDimensions(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}