const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_FALLBACK_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

const REQUEST_TIMEOUT_MS = 120000;

function getNvidiaApiKey() {
  return process.env.NVIDIA_API_KEY || process.env.NVAPI_KEY || '';
}

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY || '';
}

function messageHasVideoOrAudio(messages) {
  return messages.some((message) => {
    if (!Array.isArray(message.content)) return false;
    return message.content.some((part) => part.type === 'video_url' || part.type === 'audio_url');
  });
}

function buildNvidiaPayload(messages, enableThinking) {
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

function buildOpenRouterPayload(messages, enableThinking) {
  const hasVideoOrAudio = messageHasVideoOrAudio(messages);
  const thinkingEnabled = enableThinking && !hasVideoOrAudio;

  const payload = {
    model: OPENROUTER_FALLBACK_MODEL,
    messages,
    max_tokens: 65536,
    temperature: 0.6,
    top_p: 0.95,
    stream: true,
  };

  if (thinkingEnabled) {
    payload.reasoning = { enabled: true };
  }

  return payload;
}

async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function writeSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function extractDeltaFields(parsed) {
  const choice = parsed?.choices?.[0];
  const delta = choice?.delta || {};
  const reasoning =
    delta.reasoning ??
    delta.reasoning_content ??
    (Array.isArray(delta.reasoning_details)
      ? delta.reasoning_details.map((detail) => detail.text || detail.content || '').join('')
      : null);
  const content = delta.content ?? null;

  return {
    reasoning: reasoning || null,
    content: content || null,
    finishReason: choice?.finish_reason || null,
  };
}

async function pipeProviderStream({ response, res, provider }) {
  if (!response.body) {
    throw new Error(`${provider} returned an empty stream`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hasOutput = false;
  let streamError = null;

  writeSseEvent(res, { type: 'meta', provider });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;

      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);

        if (parsed?.error) {
          streamError = parsed.error?.message || JSON.stringify(parsed.error);
          return;
        }

        const { reasoning, content, finishReason } = extractDeltaFields(parsed);

        if (reasoning) {
          hasOutput = true;
          writeSseEvent(res, { type: 'reasoning', text: reasoning });
        }
        if (content) {
          hasOutput = true;
          writeSseEvent(res, { type: 'content', text: content });
        }
        if (finishReason) {
          writeSseEvent(res, { type: 'finish', reason: finishReason });
        }
      } catch {
        // Ignore malformed chunks from upstream providers.
      }
    });
  }

  if (hasOutput) {
    writeSseEvent(res, { type: 'done' });
  }

  return {
    hasOutput,
    streamError,
  };
}

async function tryNvidiaStream(messages, enableThinking, res) {
  const apiKey = getNvidiaApiKey();
  if (!apiKey) {
    return { ok: false, error: 'NVIDIA API key is not configured' };
  }

  const payload = buildNvidiaPayload(messages, enableThinking);

  const response = await fetchWithTimeout(NVIDIA_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      error: `NVIDIA request failed (${response.status}): ${errorText.slice(0, 500)}`,
    };
  }

  const streamResult = await pipeProviderStream({ response, res, provider: 'nvidia' });
  if (streamResult.streamError) {
    return { ok: false, error: streamResult.streamError };
  }
  if (!streamResult.hasOutput) {
    return { ok: false, error: 'NVIDIA returned an empty stream' };
  }
  return { ok: true };
}

async function tryOpenRouterStream(messages, enableThinking, res) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return { ok: false, error: 'OpenRouter fallback key is not configured' };
  }

  const payload = buildOpenRouterPayload(messages, enableThinking);

  const response = await fetchWithTimeout(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://malikfajar.me',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Malik Fajar Portfolio Chatbot',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      error: `OpenRouter request failed (${response.status}): ${errorText.slice(0, 500)}`,
    };
  }

  const streamResult = await pipeProviderStream({ response, res, provider: 'openrouter' });
  if (streamResult.streamError) {
    return { ok: false, error: streamResult.streamError };
  }
  if (!streamResult.hasOutput) {
    return { ok: false, error: 'OpenRouter returned an empty stream' };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, enableThinking = true } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const nvidiaResult = await tryNvidiaStream(messages, enableThinking, res);
    if (nvidiaResult.ok) {
      return res.end();
    }

    writeSseEvent(res, {
      type: 'fallback',
      message: 'Primary NVIDIA provider unavailable. Trying free OpenRouter fallback…',
      detail: nvidiaResult.error,
    });

    const openRouterResult = await tryOpenRouterStream(messages, enableThinking, res);
    if (openRouterResult.ok) {
      return res.end();
    }

    writeSseEvent(res, {
      type: 'error',
      message:
        'All providers failed. Set NVIDIA_API_KEY on Vercel (primary) and optionally OPENROUTER_API_KEY for the free Nemotron Omni fallback.',
      detail: openRouterResult.error,
    });
    return res.end();
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    writeSseEvent(res, {
      type: 'error',
      message: isAbort ? 'Request timed out. Please retry.' : 'Unexpected server error while streaming.',
      detail: error?.message || 'Unknown error',
    });
    return res.end();
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
    responseLimit: false,
  },
};
