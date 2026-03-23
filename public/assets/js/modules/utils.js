/**
 * Módulo Utils
 * Coleção de funções utilitárias globais
 */

/**
 * Normaliza uma string removendo acentos e convertendo para minúsculas.
 * Útil para comparações de busca (search) consistentes.
 * 
 * @param {string} str - String a ser normalizada
 * @returns {string} String normalizada (lowercase, sem diacríticos)
 */
export function normalizeString(str) {
    if (!str) return '';
    return str.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
