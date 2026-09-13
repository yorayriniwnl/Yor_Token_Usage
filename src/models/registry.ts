import type { CostBreakdown, ModelProfile, ProviderId } from "../types/models.js";

export const MODEL_CATALOG_VERSION = "2026-09-13";

export const MODEL_CATALOG: Record<string, ModelProfile> = {
  // OpenAI / ChatGPT models
  "gpt-4o": {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "chatgpt",
    contextWindow: 128_000,
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    quotaTier: "Plus",
    pricingEffectiveDate: "2024-05-13",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "o200k_base"
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "chatgpt",
    contextWindow: 128_000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    quotaTier: "Free/Plus",
    pricingEffectiveDate: "2024-07-18",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "o200k_base"
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "chatgpt",
    contextWindow: 1_000_000,
    inputCostPer1M: 2.0,
    outputCostPer1M: 8.0,
    quotaTier: "Plus",
    pricingEffectiveDate: "2025-02-01",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "o200k_base"
  },
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    provider: "chatgpt",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.4,
    outputCostPer1M: 1.6,
    quotaTier: "Mini",
    pricingEffectiveDate: "2025-02-01",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "o200k_base"
  },
  "gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    label: "GPT-4.1 nano",
    provider: "chatgpt",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    quotaTier: "Nano",
    pricingEffectiveDate: "2025-02-01",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "o200k_base"
  },
  "o1": {
    id: "o1",
    label: "o1",
    provider: "chatgpt",
    contextWindow: 200_000,
    inputCostPer1M: 15.0,
    outputCostPer1M: 60.0,
    quotaTier: "Pro/Plus",
    pricingEffectiveDate: "2024-12-05",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "o200k_base"
  },
  "o1-mini": {
    id: "o1-mini",
    label: "o1-mini",
    provider: "chatgpt",
    contextWindow: 128_000,
    inputCostPer1M: 1.1,
    outputCostPer1M: 4.4,
    quotaTier: "Plus",
    pricingEffectiveDate: "2024-09-12",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "o200k_base"
  },
  "o3-mini": {
    id: "o3-mini",
    label: "o3-mini",
    provider: "chatgpt",
    contextWindow: 200_000,
    inputCostPer1M: 1.1,
    outputCostPer1M: 4.4,
    quotaTier: "Plus",
    pricingEffectiveDate: "2025-01-31",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "o200k_base"
  },

  // Anthropic / Claude models
  "claude-3-5-sonnet": {
    id: "claude-3-5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "claude",
    contextWindow: 200_000,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    quotaTier: "Pro",
    pricingEffectiveDate: "2024-06-20",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "claude"
  },
  "claude-3-5-haiku": {
    id: "claude-3-5-haiku",
    label: "Claude 3.5 Haiku",
    provider: "claude",
    contextWindow: 200_000,
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
    quotaTier: "Free/Pro",
    pricingEffectiveDate: "2024-10-22",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "claude"
  },
  "claude-3-opus": {
    id: "claude-3-opus",
    label: "Claude 3 Opus",
    provider: "claude",
    contextWindow: 200_000,
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    quotaTier: "Pro",
    pricingEffectiveDate: "2024-03-04",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "claude"
  },

  // Google / Gemini models
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "gemini",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    quotaTier: "Free",
    pricingEffectiveDate: "2024-12-11",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "gemini"
  },
  "gemini-1.5-pro": {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    provider: "gemini",
    contextWindow: 2_000_000,
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.0,
    quotaTier: "Advanced",
    pricingEffectiveDate: "2024-05-14",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "gemini"
  },
  "gemini-1.5-flash": {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    provider: "gemini",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
    quotaTier: "Free",
    pricingEffectiveDate: "2024-05-14",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "gemini"
  },

  // Perplexity models
  "sonar": {
    id: "sonar",
    label: "Sonar",
    provider: "perplexity",
    contextWindow: 127_072,
    inputCostPer1M: 1.0,
    outputCostPer1M: 1.0,
    quotaTier: "Free",
    pricingEffectiveDate: "2024-10-01",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "sonar"
  },
  "sonar-pro": {
    id: "sonar-pro",
    label: "Sonar Pro",
    provider: "perplexity",
    contextWindow: 200_000,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    quotaTier: "Pro",
    pricingEffectiveDate: "2024-10-01",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "sonar"
  },

  // xAI / Grok models
  "grok-2": {
    id: "grok-2",
    label: "Grok 2",
    provider: "grok",
    contextWindow: 131_072,
    inputCostPer1M: 2.0,
    outputCostPer1M: 10.0,
    quotaTier: "Premium",
    pricingEffectiveDate: "2024-08-15",
    pricingVerifiedDate: "2026-09-01",
    tokenizer: "grok"
  }
};

export const MODEL_MATCHERS: Array<[RegExp, string]> = [
  [/^gpt-4o-mini\b/, "gpt-4o-mini"],
  [/^gpt-4o\b/, "gpt-4o"],
  [/^gpt-4\.1-nano\b/, "gpt-4.1-nano"],
  [/^gpt-4\.1-mini\b/, "gpt-4.1-mini"],
  [/^gpt-4\.1\b/, "gpt-4.1"],
  [/^o3-mini\b/, "o3-mini"],
  [/^o1-mini\b/, "o1-mini"],
  [/^o1\b/, "o1"],
  [/^claude-3-5-sonnet\b|claude\s*3\.5\s*sonnet/i, "claude-3-5-sonnet"],
  [/^claude-3-5-haiku\b|claude\s*3\.5\s*haiku/i, "claude-3-5-haiku"],
  [/^claude-3-opus\b|claude\s*3\s*opus/i, "claude-3-opus"],
  [/^gemini-2\.0-flash\b|gemini\s*2\.0\s*flash/i, "gemini-2.0-flash"],
  [/^gemini-1\.5-pro\b|gemini\s*1\.5\s*pro/i, "gemini-1.5-pro"],
  [/^gemini-1\.5-flash\b|gemini\s*1\.5\s*flash/i, "gemini-1.5-flash"],
  [/^sonar-pro\b/i, "sonar-pro"],
  [/^sonar\b/i, "sonar"],
  [/^grok-2\b/i, "grok-2"]
];

export function normalizeModelKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\bmodel\b/g, "")
    .replace(/\bnew\b/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolves a model profile with zero fabrication.
 * If the model is not identified, returns a profile with pricing: null, contextWindow: null.
 * NEVER silently substitutes GPT-4o or Sonnet for unknown models.
 */
export function resolveModelProfile(rawModelName: string, provider: ProviderId = "generic"): ModelProfile {
  const normalized = normalizeModelKey(rawModelName);
  if (MODEL_CATALOG[normalized]) {
    return MODEL_CATALOG[normalized]!;
  }
  for (const [pattern, id] of MODEL_MATCHERS) {
    if (pattern.test(normalized) || pattern.test(rawModelName)) {
      return MODEL_CATALOG[id]!;
    }
  }

  // Truthful unknown profile - NO INVENTED COSTS!
  return {
    id: normalized || "unknown",
    label: rawModelName || "Unknown model",
    provider,
    contextWindow: null,
    inputCostPer1M: null,
    outputCostPer1M: null,
    quotaTier: "Unknown",
    pricingSource: "Unverified model; pricing is unknown"
  };
}

export function calculateCost(
  promptTokens: number,
  outputTokens: number,
  modelName: string,
  provider: ProviderId = "generic"
): CostBreakdown {
  const profile = resolveModelProfile(modelName, provider);

  if (profile.inputCostPer1M === null || profile.outputCostPer1M === null) {
    return {
      promptCost: null,
      outputCost: null,
      totalCost: null,
      currency: "USD",
      isApiEquivalent: true,
      model: profile
    };
  }

  const promptCost = Number(((promptTokens / 1_000_000) * profile.inputCostPer1M).toFixed(6));
  const outputCost = Number(((outputTokens / 1_000_000) * profile.outputCostPer1M).toFixed(6));
  const totalCost = Number((promptCost + outputCost).toFixed(6));

  return {
    promptCost,
    outputCost,
    totalCost,
    currency: "USD",
    isApiEquivalent: true,
    model: profile
  };
}
