/**
 * Utility to build page URLs for navigation.
 * createPageUrl("Dashboard") → "/Dashboard"
 */
export function createPageUrl(pageName) {
  if (!pageName) return '/';
  return `/${pageName}`;
}
