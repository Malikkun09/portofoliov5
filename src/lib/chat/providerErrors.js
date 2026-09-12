const RATE_LIMIT_STATUSES = new Set([429, 503, 529]);
const AUTH_STATUSES = new Set([401, 403]);

const NVIDIA_MESSAGES = {
  missing_key: 'NVIDIA_API_KEY belum disetel di Vercel. / NVIDIA_API_KEY is not set.',
  invalid_key: 'Kunci NVIDIA tidak valid (401). Perbarui NVIDIA_API_KEY di Vercel. / NVIDIA API key unauthorized.',
  rate_limit: 'NVIDIA sedang penuh/kuota habis (429/503). / NVIDIA is rate-limited.',
  network: 'Tidak bisa terhubung ke NVIDIA. Coba lagi. / Could not reach NVIDIA.',
  timeout: 'NVIDIA timeout. Coba lagi. / NVIDIA request timed out.',
  empty: 'NVIDIA tidak mengirim jawaban. / NVIDIA returned an empty stream.',
  unknown: 'NVIDIA gagal merespons. / NVIDIA request failed.',
};

const OPENROUTER_MESSAGES = {
  missing_key: 'OPENROUTER_API_KEY belum disetel (gratis di openrouter.ai). / OpenRouter key not set.',
  invalid_key: 'Kunci OpenRouter tidak valid. / OpenRouter API key unauthorized.',
  rate_limit: 'OpenRouter sedang limit. Coba sebentar lagi. / OpenRouter is rate-limited.',
  network: 'Tidak bisa terhubung ke OpenRouter. / Could not reach OpenRouter.',
  timeout: 'OpenRouter timeout. Coba lagi. / OpenRouter request timed out.',
  empty: 'OpenRouter tidak mengirim jawaban. / OpenRouter returned an empty stream.',
  unknown: 'OpenRouter gagal merespons. / OpenRouter request failed.',
};

function messageBook(provider) {
  return provider === 'openrouter' ? OPENROUTER_MESSAGES : NVIDIA_MESSAGES;
}

export function redactSecrets(text) {
  if (!text) return '';

  return String(text)
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\b(nvapi-[A-Za-z0-9_-]+)/gi, '[redacted]')
    .replace(/\b(sk-or-v1-[A-Za-z0-9_-]+)/gi, '[redacted]')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})/gi, '[redacted]')
    .replace(/\b(NVIDIA_API_KEY|NVAPI_KEY|OPENROUTER_API_KEY)\s*=\s*\S+/gi, '$1=[redacted]');
}

function bodyHaystack(bodyText) {
  return String(bodyText || '').toLowerCase();
}

function looksLikeRateLimit(status, bodyText) {
  if (RATE_LIMIT_STATUSES.has(status)) return true;
  const haystack = bodyHaystack(bodyText);
  return (
    haystack.includes('resourceexhausted') ||
    haystack.includes('resource exhausted') ||
    haystack.includes('rate limit') ||
    haystack.includes('too many requests') ||
    haystack.includes('quota') ||
    haystack.includes('worker request limit')
  );
}

function looksLikeInvalidKey(status, bodyText) {
  if (AUTH_STATUSES.has(status)) return true;
  const haystack = bodyHaystack(bodyText);
  return haystack.includes('unauthorized') || haystack.includes('invalid api key') || haystack.includes('invalid key');
}

export function classifyProviderFailure({ provider = 'nvidia', status = 0, bodyText = '', error = null, missingKey = false, aborted = false } = {}) {
  const book = messageBook(provider);

  if (missingKey) {
    return {
      provider,
      code: 'missing_key',
      retryable: false,
      status: status || 0,
      message: book.missing_key,
    };
  }

  if (aborted || error?.name === 'AbortError') {
    return {
      provider,
      code: 'timeout',
      retryable: true,
      status: status || 0,
      message: book.timeout,
    };
  }

  if (looksLikeInvalidKey(status, bodyText) && !RATE_LIMIT_STATUSES.has(status)) {
    return {
      provider,
      code: 'invalid_key',
      retryable: false,
      status: status || 401,
      message: book.invalid_key,
    };
  }

  if (looksLikeRateLimit(status, bodyText)) {
    return {
      provider,
      code: 'rate_limit',
      retryable: true,
      status: status || 503,
      message: book.rate_limit,
    };
  }

  if (error && !status) {
    return {
      provider,
      code: 'network',
      retryable: true,
      status: 0,
      message: book.network,
    };
  }

  if (
    String(bodyText || '')
      .toLowerCase()
      .includes('empty stream')
  ) {
    return {
      provider,
      code: 'empty',
      retryable: true,
      status: status || 0,
      message: book.empty,
    };
  }

  return {
    provider,
    code: 'unknown',
    retryable: Boolean(status >= 500),
    status: status || 0,
    message: book.unknown,
  };
}

export function composeFinalError({ nvidia, openrouter } = {}) {
  const nvidiaCode = nvidia?.code;
  const openrouterCode = openrouter?.code;

  if (nvidiaCode === 'missing_key' && openrouterCode === 'missing_key') {
    return {
      code: 'missing_key',
      message: 'NVIDIA_API_KEY dan OPENROUTER_API_KEY belum disetel di Vercel. / Both API keys are missing.',
    };
  }

  if (nvidiaCode === 'rate_limit' && openrouterCode === 'missing_key') {
    return {
      code: 'rate_limit',
      message: 'NVIDIA kuota/limit (429/503). Tambahkan OPENROUTER_API_KEY untuk fallback gratis. / NVIDIA is rate-limited; OpenRouter key not set.',
    };
  }

  if (nvidiaCode === 'invalid_key' && openrouterCode === 'missing_key') {
    return {
      code: 'invalid_key',
      message: 'Kunci NVIDIA tidak valid (401). Tambahkan OPENROUTER_API_KEY untuk fallback. / NVIDIA 401; OpenRouter key not set.',
    };
  }

  const parts = [nvidia?.message, openrouter?.message].filter(Boolean);
  return {
    code: nvidiaCode || openrouterCode || 'unknown',
    message: parts.join(' ') || 'Semua provider gagal. / All providers failed.',
  };
}
