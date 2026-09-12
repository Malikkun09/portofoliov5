import { describe, expect, it } from 'vitest';

import { DEFAULT_OPENROUTER_MODELS, resolveOpenRouterModels } from '../../src/lib/chat/fallbackModels';

describe('resolveOpenRouterModels', () => {
  it('defaults to a free omnimodal model rather than paid MiMo V2.5', () => {
    expect(DEFAULT_OPENROUTER_MODELS[0]).toBe('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free');
    expect(DEFAULT_OPENROUTER_MODELS.every((id) => id.includes(':free') || id === 'openrouter/free')).toBe(true);
    expect(DEFAULT_OPENROUTER_MODELS).not.toContain('xiaomi/mimo-v2.5');
  });

  it('lets OPENROUTER_MODEL override the first choice (e.g. paid MiMo)', () => {
    const models = resolveOpenRouterModels({
      OPENROUTER_MODEL: 'xiaomi/mimo-v2.5',
    });

    expect(models[0]).toBe('xiaomi/mimo-v2.5');
    expect(models).toContain('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free');
  });

  it('deduplicates comma-separated extra fallbacks', () => {
    const models = resolveOpenRouterModels({
      OPENROUTER_FALLBACK_MODELS: 'google/gemma-4-26b-a4b-it:free, nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    });

    expect(models.filter((id) => id === 'google/gemma-4-26b-a4b-it:free')).toHaveLength(1);
    expect(models.filter((id) => id === 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free')).toHaveLength(1);
  });
});
