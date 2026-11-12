export const bookmarkKey = 'techtionary.bookmarks';
export function readBookmarks() {
  const saved = JSON.parse(localStorage.getItem(bookmarkKey) || '[]');
  return Array.isArray(saved)
    ? [...new Set(saved.filter((id) => typeof id === 'string' && id))]
    : [];
}
