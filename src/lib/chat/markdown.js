const UNSAFE_PROTOCOL = /^(javascript|vbscript|data):/i;

export function isSafeMarkdownUrl(href) {
  if (!href) return false;
  const value = String(href).trim();
  if (!value) return false;
  if (value.startsWith('#')) return true;
  if (value.startsWith('/')) return !value.startsWith('//');
  if (UNSAFE_PROTOCOL.test(value)) return false;

  try {
    const url = new URL(value, 'https://example.com');
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

export function normalizeMarkdownSource(source) {
  return String(source || '');
}
