/**
 * Determines the category ID for a transaction based on its description
 * and the configured keywords for each category.
 * 
 * @param {string} description - The transaction description.
 * @param {Array} categories - The list of categories containing keyword configurations.
 * @returns {string} The matched category ID, or 'cat-uncategorized' if no match.
 */
export function getAutoCategoryId(description, categories) {
  if (!description || !categories || !Array.isArray(categories)) {
    return 'cat-uncategorized';
  }

  const descLower = description.toLowerCase();

  for (const category of categories) {
    const keywords = category.keywords || [];
    for (const keyword of keywords) {
      const trimmed = keyword.trim().toLowerCase();
      if (trimmed && descLower.includes(trimmed)) {
        return category.id;
      }
    }
  }

  return 'cat-uncategorized';
}
