export function getSuggestionItems(items, query) {
    const cleanQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return items
        .filter(c => {
            const cleanTitle = (c.titulo || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return cleanTitle.includes(cleanQuery);
        })
        .map(c => ({ id: c.titulo, title: c.titulo }))
        .slice(0, 10);
}