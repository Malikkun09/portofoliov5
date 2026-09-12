import { describe, expect, it } from 'vitest';

import { readApiKey } from '../../src/lib/chat/keys';

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
