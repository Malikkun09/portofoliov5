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
});
