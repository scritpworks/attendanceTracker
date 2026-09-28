/**
 * Normalize menu paths from the database for React Router.
 */
export function normalizeMenuPath(path) {
  if (!path || typeof path !== 'string') return '/side';
  const trimmed = path.trim();
  if (!trimmed) return '/side';
  if (trimmed.startsWith('/side')) return trimmed;
  if (trimmed.startsWith('/')) return `/side${trimmed}`;
  return `/side/${trimmed}`;
}
