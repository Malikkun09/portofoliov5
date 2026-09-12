import { resolveOpenRouterModels } from '@src/lib/chat/fallbackModels';
import { NVIDIA_KEY_NAMES, readApiKey, readOpenRouterKeys, shouldRotateOpenRouterKey } from '@src/lib/chat/keys';
import { classifyProviderFailure, composeFinalError } from '@src/lib/chat/providerErrors';
import { retryOnce } from '@src/lib/chat/retry';
import { createThinkingSplitter } from '@src/lib/chat/thinking';

export const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
export const NVIDIA_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const REQUEST_TIMEOUT_MS = 120000;
const NVIDIA_RETRY_DELAY_MS = 800;
const OPENROUTER_MAX_TOKENS = 16384;

function messageHasVideoOrAudio(messages) {
  return messages.some((message) => {
    if (!Array.isArray(message.content)) return false;
    return message.content.some((part) => part.type === 'video_url' || part.type === 'audio_url');
  });
}

export function buildNvidiaPayload(messages, enableThinking) {
  const hasVideoOrAudio = messageHasVideoOrAudio(messages);
  const thinkingEnabled = enableThinking && !hasVideoOrAudio;

  return {
    model: NVIDIA_MODEL,
    messages,
    max_tokens: 65536,
    temperature: 0.6,
    top_p: 0.95,
    stream: true,
    chat_template_kwargs: {
      enable_thinking: thinkingEnabled,
      reasoning_budget: 16384,
    },
    mm_processor_kwargs: {
      use_audio_in_video: false,
    },
  };
}

export function buildOpenRouterPayload(messages, enableThinking, env = process.env) {
  const hasVideoOrAudio = messageHasVideoOrAudio(messages);
  const thinkingEnabled = enableThinking && !hasVideoOrAudio;
  const models = resolveOpenRouterModels(env);

  const payload = {
    model: models[0],
    messages,
    max_tokens: OPENROUTER_MAX_TOKENS,
    temperature: 0.6,
    top_p: 0.95,
    stream: true,
  };

  if (models.length > 1) {
    payload.models = models.slice(1);
  }

  if (thinkingEnabled) {
    payload.reasoning = { enabled: true };
  }

  return payload;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractDeltaFields(parsed) {
  const choice = parsed?.choices?.[0];
  const delta = choice?.delta || {};
  const reasoning =
    delta.reasoning ?? delta.reasoning_content ?? (Array.isArray(delta.reasoning_details) ? delta.reasoning_details.map((detail) => detail.text || detail.content || '').join('') : null);
  const content = delta.content ?? null;

  return {
    reasoning: reasoning || null,
    content: content || null,
    finishReason: choice?.finish_reason || null,
  };
}

async function pipeProviderStream({ response, onEvent, provider }) {
  if (!response.body) {
    throw new Error(`${provider} returned an empty stream`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hasOutput = false;
  let streamError = null;

  onEvent({ type: 'meta', provider });
  const thinkingSplitter = createThinkingSplitter();

  const consumeLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;

    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;

    try {
      const parsed = JSON.parse(data);

      if (parsed?.error) {
        streamError = parsed.error?.message || 'Provider stream error';
        return;
      }

      const { reasoning, content, finishReason } = extractDeltaFields(parsed);

      if (reasoning || content) {
        const events = thinkingSplitter.ingest({
          reasoning: reasoning || '',
          content: content || '',
        });
        if (events.length > 0) {
          hasOutput = true;
          events.forEach((event) => onEvent(event));
        } else if (reasoning || content) {
          hasOutput = true;
        }
      }
      if (finishReason) {
        onEvent({ type: 'finish', reason: finishReason });
      }
    } catch {
      // Ignore malformed chunks from upstream providers.
    }
  };

  // Readable streams must be pulled in a loop.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(consumeLine);
  }

  if (hasOutput && !streamError) {
    onEvent({ type: 'done' });
  }

  return {
    hasOutput,
    streamError,
  };
}

function failureFromResponse(provider, response, bodyText) {
  return classifyProviderFailure({
    provider,
    status: response?.status || 0,
    bodyText,
  });
}

async function tryNvidiaStream({ messages, enableThinking, env, fetchImpl, onEvent }) {
  const apiKey = readApiKey(NVIDIA_KEY_NAMES, env);
  if (!apiKey) {
    return classifyProviderFailure({ provider: 'nvidia', missingKey: true });
  }

  try {
    const response = await fetchWithTimeout(fetchImpl, NVIDIA_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(buildNvidiaPayload(messages, enableThinking)),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      return failureFromResponse('nvidia', response, bodyText);
    }

    const streamResult = await pipeProviderStream({
      response,
      onEvent,
      provider: 'nvidia',
    });
    if (streamResult.streamError) {
      const classified = classifyProviderFailure({
        provider: 'nvidia',
        bodyText: streamResult.streamError,
        status: streamResult.hasOutput ? 0 : 502,
      });
      return {
        ...classified,
        hasOutput: streamResult.hasOutput,
        retryable: streamResult.hasOutput ? false : classified.retryable,
      };
    }
    if (!streamResult.hasOutput) {
      return {
        ...classifyProviderFailure({
          provider: 'nvidia',
          bodyText: 'empty stream',
          status: 502,
        }),
        hasOutput: false,
      };
    }
    return { ok: true, provider: 'nvidia' };
  } catch (error) {
    return classifyProviderFailure({
      provider: 'nvidia',
      error,
      aborted: error?.name === 'AbortError',
    });
  }
}

async function tryOpenRouterStreamWithKey({ apiKey, messages, enableThinking, env, fetchImpl, onEvent }) {
  try {
    const response = await fetchWithTimeout(fetchImpl, OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'HTTP-Referer': env.OPENROUTER_SITE_URL || 'https://malikfajar.me',
        'X-Title': env.OPENROUTER_APP_NAME || 'Malik Fajar Portfolio Chatbot',
      },
      body: JSON.stringify(buildOpenRouterPayload(messages, enableThinking, env)),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      return failureFromResponse('openrouter', response, bodyText);
    }

    const streamResult = await pipeProviderStream({
      response,
      onEvent,
      provider: 'openrouter',
    });
    if (streamResult.streamError) {
      const classified = classifyProviderFailure({
        provider: 'openrouter',
        bodyText: streamResult.streamError,
        status: streamResult.hasOutput ? 0 : 502,
      });
      return {
        ...classified,
        hasOutput: streamResult.hasOutput,
        retryable: false,
      };
    }
    if (!streamResult.hasOutput) {
      return {
        ...classifyProviderFailure({
          provider: 'openrouter',
          bodyText: 'empty stream',
          status: 502,
        }),
        hasOutput: false,
      };
    }
    return { ok: true, provider: 'openrouter' };
  } catch (error) {
    return classifyProviderFailure({
      provider: 'openrouter',
      error,
      aborted: error?.name === 'AbortError',
    });
  }
}

async function tryOpenRouterStream({ messages, enableThinking, env, fetchImpl, onEvent }) {
  const keys = readOpenRouterKeys(env);
  if (keys.length === 0) {
    return classifyProviderFailure({
      provider: 'openrouter',
      missingKey: true,
    });
  }

  let lastFailure = classifyProviderFailure({
    provider: 'openrouter',
    missingKey: true,
  });

  for (let index = 0; index < keys.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await tryOpenRouterStreamWithKey({
      apiKey: keys[index],
      messages,
      enableThinking,
      env,
      fetchImpl,
      onEvent,
    });

    if (result.ok) return result;

    lastFailure = result;
    if (result.hasOutput) return result;

    const hasNextKey = index < keys.length - 1;
    if (!hasNextKey || !shouldRotateOpenRouterKey(result)) {
      return result;
    }
  }

  return lastFailure;
}

export async function runChatCompletions({ messages, enableThinking = true, env = process.env, fetchImpl = fetch, onEvent = () => {}, sleepFn }) {
  const nvidiaKey = readApiKey(NVIDIA_KEY_NAMES, env);
  const openRouterKeys = readOpenRouterKeys(env);
  const openRouterKey = openRouterKeys[0] || '';

  if (!nvidiaKey && !openRouterKey) {
    const nvidia = classifyProviderFailure({
      provider: 'nvidia',
      missingKey: true,
    });
    const openrouter = classifyProviderFailure({
      provider: 'openrouter',
      missingKey: true,
    });
    const finalError = composeFinalError({ nvidia, openrouter });
    onEvent({
      type: 'error',
      message: finalError.message,
      code: finalError.code,
    });
    return { ok: false, ...finalError };
  }

  let nvidiaResult = classifyProviderFailure({
    provider: 'nvidia',
    missingKey: true,
  });

  if (nvidiaKey) {
    nvidiaResult = await retryOnce(() => tryNvidiaStream({ messages, enableThinking, env, fetchImpl, onEvent }), {
      delayMs: NVIDIA_RETRY_DELAY_MS,
      sleepFn,
      shouldRetry: (result) => Boolean(result?.retryable && (result?.code === 'rate_limit' || result?.status === 429 || result?.status === 503)),
    });

    if (nvidiaResult.ok) {
      return nvidiaResult;
    }

    if (nvidiaResult.hasOutput) {
      onEvent({
        type: 'error',
        message: nvidiaResult.message || 'NVIDIA gagal merespons. / NVIDIA request failed.',
        code: nvidiaResult.code,
      });
      return { ok: false, ...nvidiaResult };
    }
  }

  if (openRouterKey) {
    if (nvidiaKey) {
      onEvent({
        type: 'fallback',
        message: nvidiaResult.message || 'Primary NVIDIA provider unavailable. Trying free OpenRouter fallback…',
        code: nvidiaResult.code,
      });
    }

    const openRouterResult = await tryOpenRouterStream({
      messages,
      enableThinking,
      env,
      fetchImpl,
      onEvent,
    });
    if (openRouterResult.ok) {
      return openRouterResult;
    }

    if (openRouterResult.hasOutput) {
      onEvent({
        type: 'error',
        message: openRouterResult.message,
        code: openRouterResult.code,
      });
      return { ok: false, ...openRouterResult };
    }

    const finalError = composeFinalError({
      nvidia: nvidiaResult,
      openrouter: openRouterResult,
    });
    onEvent({
      type: 'error',
      message: finalError.message,
      code: finalError.code,
    });
    return { ok: false, ...finalError };
  }

  const openrouter = classifyProviderFailure({
    provider: 'openrouter',
    missingKey: true,
  });
  const finalError = composeFinalError({ nvidia: nvidiaResult, openrouter });
  onEvent({
    type: 'error',
    message: finalError.message,
    code: finalError.code,
  });
  return { ok: false, ...finalError };
}
