export const NVIDIA_KEY_NAMES = ['NVIDIA_API_KEY', 'NVAPI_KEY'];
export const OPENROUTER_KEY_NAMES = ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEYS'];

function normalizeKeyPart(raw) {
  return String(raw || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
}

function splitKeyList(raw) {
  return String(raw || '')
    .split(/[\s,]+/)
    .map(normalizeKeyPart)
    .filter(Boolean);
}

export function readApiKeys(names, env = process.env) {
  const keys = [];
  const seen = new Set();

  (Array.isArray(names) ? names : [names]).forEach((name) => {
    const raw = env?.[name];
    if (typeof raw !== 'string') return;

    splitKeyList(raw).forEach((value) => {
      if (seen.has(value)) return;
      seen.add(value);
      keys.push(value);
    });
  });

  return keys;
}

export function readApiKey(names, env = process.env) {
  return readApiKeys(names, env)[0] || '';
}

export function readOpenRouterKeys(env = process.env) {
  const fromSingle = readApiKeys(['OPENROUTER_API_KEY'], env);
  const fromList = readApiKeys(['OPENROUTER_API_KEYS'], env);
  const keys = [];
  const seen = new Set();

  [...fromSingle, ...fromList].forEach((value) => {
    if (seen.has(value)) return;
    seen.add(value);
    keys.push(value);
  });

  return keys;
}

export function shouldRotateOpenRouterKey(result) {
  if (!result || result.ok || result.hasOutput) return false;

  const status = Number(result.status) || 0;
  if (status === 401 || status === 403 || status === 429 || status === 503 || status === 529 || status === 402) {
    return true;
  }

  return result.code === 'invalid_key' || result.code === 'rate_limit';
}
