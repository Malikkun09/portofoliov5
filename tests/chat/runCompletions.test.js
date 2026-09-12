import { describe, expect, it, vi } from 'vitest';

import { runChatCompletions } from '../../src/lib/chat/runCompletions';

function jsonErrorResponse(status, body) {
  return {
    ok: false,
    status,
    body: null,
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
  };
}

function streamResponse(content = 'Halo') {
  const payload = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
  const encoded = new TextEncoder().encode(payload);
  let read = false;

  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            if (read) return { done: true, value: undefined };
            read = true;
            return { done: false, value: encoded };
          },
        };
      },
    },
    async text() {
      return payload;
    },
  };
}

describe('runChatCompletions', () => {
  it('retries NVIDIA once on 503 before succeeding', async () => {
    const events = [];
    let nvidiaCalls = 0;
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('nvidia.com')) {
        nvidiaCalls += 1;
        if (nvidiaCalls === 1) {
          return jsonErrorResponse(503, { error: 'ResourceExhausted' });
        }
        return streamResponse('ok');
      }
      throw new Error('OpenRouter should not be called');
    });

    const result = await runChatCompletions({
      messages: [{ role: 'user', content: 'hi' }],
      env: {
        NVIDIA_API_KEY: ' nvapi-test ',
        OPENROUTER_API_KEY: 'sk-or-v1-test',
      },
      fetchImpl,
      onEvent: (event) => events.push(event),
      sleepFn: async () => {},
    });

    expect(result.ok).toBe(true);
    expect(nvidiaCalls).toBe(2);
    expect(events.some((event) => event.type === 'meta' && event.provider === 'nvidia')).toBe(true);
    expect(events.some((event) => event.type === 'error')).toBe(false);
  });

  it('does not retry NVIDIA 401 and falls back to OpenRouter', async () => {
    const events = [];
    let nvidiaCalls = 0;
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('nvidia.com')) {
        nvidiaCalls += 1;
        return jsonErrorResponse(401, 'NVIDIA API Key Error: 401 Unauthorized');
      }
      return streamResponse('fallback-ok');
    });

    const result = await runChatCompletions({
      messages: [{ role: 'user', content: 'hi' }],
      env: { NVIDIA_API_KEY: 'nvapi-bad', OPENROUTER_API_KEY: 'sk-or-v1-ok' },
      fetchImpl,
      onEvent: (event) => events.push(event),
      sleepFn: async () => {},
    });

    expect(nvidiaCalls).toBe(1);
    expect(result.ok).toBe(true);
    expect(events.some((event) => event.type === 'fallback')).toBe(true);
    expect(events.some((event) => event.type === 'meta' && event.provider === 'openrouter')).toBe(true);
  });

  it('explains NVIDIA quota plus missing OpenRouter key without a 401 dump', async () => {
    const events = [];
    const fetchImpl = vi.fn(async () => jsonErrorResponse(503, { error: 'ResourceExhausted' }));

    const result = await runChatCompletions({
      messages: [{ role: 'user', content: 'hi' }],
      env: { NVIDIA_API_KEY: 'nvapi-test' },
      fetchImpl,
      onEvent: (event) => events.push(event),
      sleepFn: async () => {},
    });

    expect(result.ok).toBe(false);
    const errorEvent = events.find((event) => event.type === 'error');
    expect(errorEvent.message).toMatch(/OPENROUTER_API_KEY/);
    expect(errorEvent.message).toMatch(/NVIDIA/i);
    expect(errorEvent.message).not.toMatch(/401/);
    expect(errorEvent.message).not.toMatch(/ResourceExhausted/);
    expect(JSON.stringify(events)).not.toMatch(/nvapi-test/);
  });

  it('trims NVIDIA keys in the Authorization header', async () => {
    const fetchImpl = vi.fn(async () => jsonErrorResponse(401, 'Unauthorized'));

    await runChatCompletions({
      messages: [{ role: 'user', content: 'hi' }],
      env: { NVIDIA_API_KEY: '  nvapi-clean \n' },
      fetchImpl,
      onEvent: () => {},
      sleepFn: async () => {},
    });

    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer nvapi-clean');
  });

  it('does not retry or fall back after NVIDIA already streamed tokens', async () => {
    const events = [];
    let nvidiaCalls = 0;
    const contentChunk = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Halo' } }] })}\n\n`;
    const errorChunk = `data: ${JSON.stringify({ error: { message: 'ResourceExhausted' } })}\n\n`;
    const encoded = new TextEncoder().encode(`${contentChunk}${errorChunk}`);

    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('nvidia.com')) {
        nvidiaCalls += 1;
        let read = false;
        return {
          ok: true,
          status: 200,
          body: {
            getReader() {
              return {
                async read() {
                  if (read) return { done: true, value: undefined };
                  read = true;
                  return { done: false, value: encoded };
                },
              };
            },
          },
          async text() {
            return `${contentChunk}${errorChunk}`;
          },
        };
      }
      throw new Error('OpenRouter should not be called after partial NVIDIA output');
    });

    const result = await runChatCompletions({
      messages: [{ role: 'user', content: 'hi' }],
      env: { NVIDIA_API_KEY: 'nvapi-test', OPENROUTER_API_KEY: 'sk-or-v1-ok' },
      fetchImpl,
      onEvent: (event) => events.push(event),
      sleepFn: async () => {},
    });

    expect(nvidiaCalls).toBe(1);
    expect(result.ok).toBe(false);
    expect(events.some((event) => event.type === 'content' && event.text === 'Halo')).toBe(true);
    expect(events.some((event) => event.type === 'fallback')).toBe(false);
    expect(events.some((event) => event.type === 'meta' && event.provider === 'openrouter')).toBe(false);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(0);
    expect(events.some((event) => event.type === 'error')).toBe(true);
  });

  it('strips leaked thinking tags from streamed NVIDIA content', async () => {
    const events = [];
    const fetchImpl = vi.fn(async () => streamResponse('{thinking}Halo dari zoom.'));

    const result = await runChatCompletions({
      messages: [{ role: 'user', content: 'hi' }],
      env: { NVIDIA_API_KEY: 'nvapi-test' },
      fetchImpl,
      onEvent: (event) => events.push(event),
      sleepFn: async () => {},
    });

    expect(result.ok).toBe(true);
    const content = events
      .filter((event) => event.type === 'content')
      .map((event) => event.text)
      .join('');
    expect(content).toBe('Halo dari zoom.');
    expect(JSON.stringify(events)).not.toMatch(/\{thinking\}/);
  });

  it('rotates to the next OpenRouter key on 401 then succeeds', async () => {
    const events = [];
    const usedKeys = [];
    const fetchImpl = vi.fn(async (url, options) => {
      if (String(url).includes('nvidia.com')) {
        return jsonErrorResponse(503, { error: 'ResourceExhausted' });
      }
      usedKeys.push(options.headers.Authorization);
      if (options.headers.Authorization === 'Bearer sk-or-v1-bad') {
        return jsonErrorResponse(401, 'Unauthorized');
      }
      if (options.headers.Authorization === 'Bearer sk-or-v1-good') {
        return streamResponse('ok-from-pool');
      }
      throw new Error('unexpected OpenRouter key');
    });

    const result = await runChatCompletions({
      messages: [{ role: 'user', content: 'hi' }],
      env: {
        NVIDIA_API_KEY: 'nvapi-test',
        OPENROUTER_API_KEY: 'sk-or-v1-bad',
        OPENROUTER_API_KEYS: 'sk-or-v1-good,sk-or-v1-spare',
      },
      fetchImpl,
      onEvent: (event) => events.push(event),
      sleepFn: async () => {},
    });

    expect(result.ok).toBe(true);
    expect(usedKeys).toEqual(['Bearer sk-or-v1-bad', 'Bearer sk-or-v1-good']);
    expect(events.some((event) => event.type === 'meta' && event.provider === 'openrouter')).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/sk-or-v1/);
  });

  it('rotates OpenRouter keys on 429 quota errors', async () => {
    const usedKeys = [];
    const fetchImpl = vi.fn(async (url, options) => {
      if (String(url).includes('nvidia.com')) {
        return jsonErrorResponse(401, 'Unauthorized');
      }
      usedKeys.push(options.headers.Authorization);
      if (usedKeys.length === 1) {
        return jsonErrorResponse(429, { error: { message: 'quota exceeded' } });
      }
      return streamResponse('rotated');
    });

    const result = await runChatCompletions({
      messages: [{ role: 'user', content: 'hi' }],
      env: {
        NVIDIA_API_KEY: 'nvapi-bad',
        OPENROUTER_API_KEYS: 'sk-or-v1-one\nsk-or-v1-two',
      },
      fetchImpl,
      onEvent: () => {},
      sleepFn: async () => {},
    });

    expect(result.ok).toBe(true);
    expect(usedKeys).toEqual(['Bearer sk-or-v1-one', 'Bearer sk-or-v1-two']);
  });
});
