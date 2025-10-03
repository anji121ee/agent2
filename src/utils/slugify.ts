export function slugify(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!sanitized) {
    return 'test-case';
  }
  return sanitized.substring(0, 60);
}
