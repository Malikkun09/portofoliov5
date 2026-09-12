export const DEFAULT_OPENROUTER_MODELS = ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'google/gemma-4-26b-a4b-it:free', 'openrouter/free'];

export function resolveOpenRouterModels(env = process.env) {
  const override = typeof env.OPENROUTER_MODEL === 'string' ? env.OPENROUTER_MODEL.trim() : '';
  const extras =
    typeof env.OPENROUTER_FALLBACK_MODELS === 'string'
      ? env.OPENROUTER_FALLBACK_MODELS.split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

  const models = [];
  if (override) models.push(override);
  extras.forEach((id) => models.push(id));
  DEFAULT_OPENROUTER_MODELS.forEach((id) => models.push(id));

  return [...new Set(models)];
}
