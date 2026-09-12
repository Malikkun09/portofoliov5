export const NVIDIA_KEY_NAMES = ['NVIDIA_API_KEY', 'NVAPI_KEY'];
export const OPENROUTER_KEY_NAMES = ['OPENROUTER_API_KEY'];

export function readApiKey(names, env = process.env) {
  const keys = Array.isArray(names) ? names : [names];

  const normalized = keys
    .map((name) => env?.[name])
    .filter((raw) => typeof raw === 'string')
    .map((raw) =>
      raw
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .trim(),
    )
    .find((value) => value);

  return normalized || '';
}
