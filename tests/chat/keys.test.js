import { describe, expect, it } from 'vitest';

import { OPENROUTER_MAX_KEY_ATTEMPTS, readApiKey, readOpenRouterKeys, selectOpenRouterKeysToTry, shouldRotateOpenRouterKey } from '../../src/lib/chat/keys';

describe('readApiKey', () => {
  it('trims whitespace and surrounding quotes from NVIDIA_API_KEY', () => {
    const key = readApiKey(['NVIDIA_API_KEY', 'NVAPI_KEY'], {
      NVIDIA_API_KEY: '  "nvapi-demo-key" \n',
    });

    expect(key).toBe('nvapi-demo-key');
  });

  it('falls back to NVAPI_KEY when NVIDIA_API_KEY is empty', () => {
    const key = readApiKey(['NVIDIA_API_KEY', 'NVAPI_KEY'], {
      NVIDIA_API_KEY: '   ',
      NVAPI_KEY: ' nvapi-from-alias ',
    });

    expect(key).toBe('nvapi-from-alias');
  });

  it('returns an empty string when no key is configured', () => {
    expect(readApiKey(['NVIDIA_API_KEY', 'NVAPI_KEY'], {})).toBe('');
  });
});

describe('readOpenRouterKeys', () => {
  it('keeps a single OPENROUTER_API_KEY and appends extras from OPENROUTER_API_KEYS', () => {
    expect(
      readOpenRouterKeys({
        OPENROUTER_API_KEY: ' sk-or-v1-primary ',
        OPENROUTER_API_KEYS: 'sk-or-v1-two, sk-or-v1-three\nsk-or-v1-primary',
      }),
    ).toEqual(['sk-or-v1-primary', 'sk-or-v1-two', 'sk-or-v1-three']);
  });

  it('parses OPENROUTER_API_KEYS alone when the single key is missing', () => {
    expect(
      readOpenRouterKeys({
        OPENROUTER_API_KEYS: '"sk-or-v1-a"\n"sk-or-v1-b"',
      }),
    ).toEqual(['sk-or-v1-a', 'sk-or-v1-b']);
  });
});

describe('shouldRotateOpenRouterKey', () => {
  it('rotates on 401/403/429/503 without partial output', () => {
    expect(shouldRotateOpenRouterKey({ ok: false, status: 401, code: 'invalid_key' })).toBe(true);
    expect(shouldRotateOpenRouterKey({ ok: false, status: 403, code: 'invalid_key' })).toBe(true);
    expect(shouldRotateOpenRouterKey({ ok: false, status: 429, code: 'rate_limit' })).toBe(true);
    expect(shouldRotateOpenRouterKey({ ok: false, status: 503, code: 'rate_limit' })).toBe(true);
    expect(shouldRotateOpenRouterKey({ ok: false, status: 402, code: 'rate_limit' })).toBe(true);
  });

  it('does not rotate after a partial stream or success', () => {
    expect(shouldRotateOpenRouterKey({ ok: false, status: 503, code: 'rate_limit', hasOutput: true })).toBe(false);
    expect(shouldRotateOpenRouterKey({ ok: true, provider: 'openrouter' })).toBe(false);
    expect(shouldRotateOpenRouterKey({ ok: false, status: 500, code: 'unknown' })).toBe(false);
  });
});

describe('selectOpenRouterKeysToTry', () => {
  it('caps the pool at three random unique keys', () => {
    const pool = Array.from({ length: 10 }, (_, index) => `sk-or-v1-${index}`);
    const picked = selectOpenRouterKeysToTry(pool);

    expect(picked).toHaveLength(OPENROUTER_MAX_KEY_ATTEMPTS);
    expect(new Set(picked).size).toBe(OPENROUTER_MAX_KEY_ATTEMPTS);
    picked.forEach((key) => expect(pool).toContain(key));
  });

  it('uses the injected random function to shuffle', () => {
    const pool = ['sk-or-v1-a', 'sk-or-v1-b', 'sk-or-v1-c'];
    const picked = selectOpenRouterKeysToTry(pool, { random: () => 0 });

    expect(picked).toEqual(['sk-or-v1-b', 'sk-or-v1-c', 'sk-or-v1-a']);
  });
});
