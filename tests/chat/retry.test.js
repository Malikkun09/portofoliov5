import { describe, expect, it, vi } from 'vitest';

import { retryOnce } from '../../src/lib/chat/retry';

describe('retryOnce', () => {
  it('retries a 503/429 NVIDIA failure once after a short backoff', async () => {
    const sleepFn = vi.fn(async () => {});
    let attempts = 0;

    const result = await retryOnce(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          return {
            ok: false,
            retryable: true,
            status: 503,
            code: 'rate_limit',
          };
        }
        return { ok: true, status: 200 };
      },
      { delayMs: 800, sleepFn },
    );

    expect(attempts).toBe(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).toHaveBeenCalledWith(800);
    expect(result).toEqual({ ok: true, status: 200 });
  });

  it('does not retry invalid API keys', async () => {
    const sleepFn = vi.fn(async () => {});
    let attempts = 0;

    const result = await retryOnce(
      async () => {
        attempts += 1;
        return {
          ok: false,
          retryable: false,
          status: 401,
          code: 'invalid_key',
        };
      },
      { delayMs: 800, sleepFn },
    );

    expect(attempts).toBe(1);
    expect(sleepFn).not.toHaveBeenCalled();
    expect(result.code).toBe('invalid_key');
  });
});
