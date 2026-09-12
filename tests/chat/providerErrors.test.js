import { describe, expect, it } from 'vitest';

import { classifyProviderFailure, composeFinalError, redactSecrets } from '../../src/lib/chat/providerErrors';

describe('classifyProviderFailure', () => {
  it('classifies a missing API key', () => {
    const result = classifyProviderFailure({
      provider: 'nvidia',
      missingKey: true,
    });

    expect(result.code).toBe('missing_key');
    expect(result.retryable).toBe(false);
    expect(result.message).toMatch(/NVIDIA_API_KEY/i);
    expect(result.message).toMatch(/tidak|belum/i);
  });

  it('classifies HTTP 401 as an invalid key, not a rate limit', () => {
    const result = classifyProviderFailure({
      provider: 'nvidia',
      status: 401,
      bodyText: 'NVIDIA API Key Error: 401 Unauthorized',
    });

    expect(result.code).toBe('invalid_key');
    expect(result.retryable).toBe(false);
    expect(result.message).toMatch(/401/);
    expect(result.message).not.toMatch(/rate-limited|kuota/i);
    expect(result.message).not.toMatch(/All providers failed/i);
  });

  it('classifies 503 ResourceExhausted as a rate limit, not 401', () => {
    const result = classifyProviderFailure({
      provider: 'nvidia',
      status: 503,
      bodyText: JSON.stringify({ error: 'ResourceExhausted', status: 503 }),
    });

    expect(result.code).toBe('rate_limit');
    expect(result.retryable).toBe(true);
    expect(result.message).toMatch(/503|limit|kuota/i);
    expect(result.message).not.toMatch(/401/);
    expect(result.message).not.toMatch(/Unauthorized/i);
  });

  it('classifies HTTP 429 as retryable rate limit', () => {
    const result = classifyProviderFailure({
      provider: 'nvidia',
      status: 429,
      bodyText: 'Too Many Requests',
    });

    expect(result.code).toBe('rate_limit');
    expect(result.retryable).toBe(true);
  });

  it('classifies abort/timeout separately from auth errors', () => {
    const result = classifyProviderFailure({
      provider: 'nvidia',
      aborted: true,
      error: { name: 'AbortError', message: 'The operation was aborted' },
    });

    expect(result.code).toBe('timeout');
    expect(result.retryable).toBe(true);
    expect(result.message).toMatch(/timeout/i);
  });

  it('classifies network failures without dumping a stack', () => {
    const result = classifyProviderFailure({
      provider: 'nvidia',
      error: new TypeError('fetch failed'),
    });

    expect(result.code).toBe('network');
    expect(result.message).toMatch(/NVIDIA/i);
    expect(result.message.length).toBeLessThan(180);
    expect(result.message).not.toMatch(/fetch failed/i);
  });

  it('does not include raw provider dumps in the user message', () => {
    const result = classifyProviderFailure({
      provider: 'nvidia',
      status: 503,
      bodyText: '{"title":"Resource Exhausted","detail":"worker request limit","status":503}',
    });

    expect(result.message).not.toMatch(/worker request limit/i);
    expect(result.message).not.toMatch(/Resource Exhausted/i);
  });
});

describe('composeFinalError', () => {
  it('explains NVIDIA quota plus missing OpenRouter key instead of a generic dump', () => {
    const nvidia = classifyProviderFailure({
      provider: 'nvidia',
      status: 503,
      bodyText: 'ResourceExhausted',
    });
    const openrouter = classifyProviderFailure({
      provider: 'openrouter',
      missingKey: true,
    });

    const finalError = composeFinalError({ nvidia, openrouter });

    expect(finalError.message).toMatch(/NVIDIA/i);
    expect(finalError.message).toMatch(/OPENROUTER_API_KEY/i);
    expect(finalError.message).not.toMatch(/All providers failed/i);
    expect(finalError.message).not.toMatch(/401/);
    expect(finalError.code).toBe('rate_limit');
  });

  it('mentions both invalid NVIDIA key and missing fallback', () => {
    const nvidia = classifyProviderFailure({
      provider: 'nvidia',
      status: 401,
      bodyText: 'Unauthorized',
    });
    const openrouter = classifyProviderFailure({
      provider: 'openrouter',
      missingKey: true,
    });

    const finalError = composeFinalError({ nvidia, openrouter });

    expect(finalError.message).toMatch(/401/);
    expect(finalError.message).toMatch(/OPENROUTER_API_KEY/i);
  });

  it('covers both keys missing', () => {
    const finalError = composeFinalError({
      nvidia: classifyProviderFailure({ provider: 'nvidia', missingKey: true }),
      openrouter: classifyProviderFailure({
        provider: 'openrouter',
        missingKey: true,
      }),
    });

    expect(finalError.code).toBe('missing_key');
    expect(finalError.message).toMatch(/NVIDIA_API_KEY/);
    expect(finalError.message).toMatch(/OPENROUTER_API_KEY/);
  });
});

describe('redactSecrets', () => {
  it('strips bearer tokens and known key prefixes', () => {
    const redacted = redactSecrets('Authorization: Bearer nvapi-SUPERSECRETKEY value=sk-or-v1-abcdef NVIDIA_API_KEY=abcd');

    expect(redacted).not.toMatch(/SUPERSECRETKEY/);
    expect(redacted).not.toMatch(/sk-or-v1-abcdef/);
    expect(redacted).not.toMatch(/NVIDIA_API_KEY=abcd/);
    expect(redacted).toMatch(/\[redacted\]/i);
  });
});
