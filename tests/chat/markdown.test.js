import { describe, expect, it } from 'vitest';

import { isSafeMarkdownUrl, normalizeMarkdownSource } from '@src/lib/chat/markdown';

describe('isSafeMarkdownUrl', () => {
  it('allows http, https, mailto, hash, and relative links', () => {
    expect(isSafeMarkdownUrl('https://example.com')).toBe(true);
    expect(isSafeMarkdownUrl('http://example.com')).toBe(true);
    expect(isSafeMarkdownUrl('mailto:hello@example.com')).toBe(true);
    expect(isSafeMarkdownUrl('#section')).toBe(true);
    expect(isSafeMarkdownUrl('/projects/chatbot')).toBe(true);
  });

  it('blocks javascript and data URLs', () => {
    expect(isSafeMarkdownUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeMarkdownUrl('data:text/html,hello')).toBe(false);
    expect(isSafeMarkdownUrl('//evil.example')).toBe(false);
  });
});

describe('normalizeMarkdownSource', () => {
  it('returns strings unchanged and coerces nullish values', () => {
    expect(normalizeMarkdownSource('## Heading')).toBe('## Heading');
    expect(normalizeMarkdownSource(null)).toBe('');
  });
});
