export interface ModelProfile {
  id: string;
  label: string;
  provider: string;
  contextWindow: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  quotaTier: string;
}

export interface CostBreakdown {
  promptCost: number;
  outputCost: number;
  totalCost: number;
  model: ModelProfile;
}

export const MODEL_CATALOG: Record<string, ModelProfile> = {
  // OpenAI
  "gpt-4o": {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "chatgpt",
    contextWindow: 128_000,
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
    quotaTier: "Plus"
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "chatgpt",
    contextWindow: 128_000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    quotaTier: "Free/Plus"
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "chatgpt",
    contextWindow: 1_000_000,
    inputCostPer1M: 2.00,
    outputCostPer1M: 8.00,
    quotaTier: "Plus"
  },
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    provider: "chatgpt",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.40,
    outputCostPer1M: 1.60,
    quotaTier: "Mini"
  },
  "gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    label: "GPT-4.1 nano",
    provider: "chatgpt",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
    quotaTier: "Nano"
  },
  "o3": {
    id: "o3",
    label: "OpenAI o3",
    provider: "chatgpt",
    contextWindow: 200_000,
    inputCostPer1M: 2.00,
    outputCostPer1M: 8.00,
    quotaTier: "Reasoning"
  },
  "o3-mini": {
    id: "o3-mini",
    label: "OpenAI o3 mini",
    provider: "chatgpt",
    contextWindow: 200_000,
    inputCostPer1M: 1.10,
    outputCostPer1M: 4.40,
    quotaTier: "Reasoning mini"
  },
  "o4-mini": {
    id: "o4-mini",
    label: "OpenAI o4 mini",
    provider: "chatgpt",
    contextWindow: 200_000,
    inputCostPer1M: 1.10,
    outputCostPer1M: 4.40,
    quotaTier: "Reasoning mini"
  },

  // Anthropic
  "claude-sonnet": {
    id: "claude-sonnet",
    label: "Claude Sonnet 4",
    provider: "claude",
    contextWindow: 200_000,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    quotaTier: "Pro"
  },
  "claude-sonnet-4.6": {
    id: "claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    provider: "claude",
    contextWindow: 1_000_000,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    quotaTier: "Pro"
  },
  "claude-opus-4.7": {
    id: "claude-opus-4.7",
    label: "Claude Opus 4.7",
    provider: "claude",
    contextWindow: 1_000_000,
    inputCostPer1M: 5.00,
    outputCostPer1M: 25.00,
    quotaTier: "Opus"
  },
  "claude-opus-4.1": {
    id: "claude-opus-4.1",
    label: "Claude Opus 4.1",
    provider: "claude",
    contextWindow: 200_000,
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    quotaTier: "Opus"
  },
  "claude-opus-3": {
    id: "claude-opus-3",
    label: "Claude Opus 3",
    provider: "claude",
    contextWindow: 200_000,
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    quotaTier: "Opus"
  },
  "claude-haiku-4.5": {
    id: "claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    provider: "claude",
    contextWindow: 200_000,
    inputCostPer1M: 1.00,
    outputCostPer1M: 5.00,
    quotaTier: "Haiku"
  },
  "claude-haiku-3.5": {
    id: "claude-haiku-3.5",
    label: "Claude Haiku 3.5",
    provider: "claude",
    contextWindow: 200_000,
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
    quotaTier: "Haiku"
  },

  // Google Gemini
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.30,
    outputCostPer1M: 2.50,
    quotaTier: "Flash"
  },
  "gemini-2.5-flash-lite": {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    provider: "gemini",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
    quotaTier: "Flash-Lite"
  },
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "gemini",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
    quotaTier: "Flash"
  },
  "gemini-2.0-flash-lite": {
    id: "gemini-2.0-flash-lite",
    label: "Gemini 2.0 Flash-Lite",
    provider: "gemini",
    contextWindow: 1_000_000,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    quotaTier: "Flash-Lite"
  },
  "gemini-pro": {
    id: "gemini-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    contextWindow: 1_000_000,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
    quotaTier: "Advanced"
  },

  // Perplexity
  "sonar-pro": {
    id: "sonar-pro",
    label: "Sonar Pro",
    provider: "perplexity",
    contextWindow: 200_000,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    quotaTier: "Pro"
  },

  // xAI Grok
  "grok-3": {
    id: "grok-3",
    label: "Grok 3",
    provider: "grok",
    contextWindow: 128_000,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    quotaTier: "Premium+"
  },
  "grok-3-mini": {
    id: "grok-3-mini",
    label: "Grok 3 mini",
    provider: "grok",
    contextWindow: 131_072,
    inputCostPer1M: 0.30,
    outputCostPer1M: 0.50,
    quotaTier: "Mini"
  },

  // DeepSeek
  "deepseek-chat": {
    id: "deepseek-chat",
    label: "DeepSeek V3",
    provider: "deepseek",
    contextWindow: 64_000,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    quotaTier: "Standard"
  },
  "deepseek-reasoner": {
    id: "deepseek-reasoner",
    label: "DeepSeek R1",
    provider: "deepseek",
    contextWindow: 64_000,
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
    quotaTier: "Reasoner"
  },

  // Generic fallback
  "generic": {
    id: "generic",
    label: "Standard Model",
    provider: "generic",
    contextWindow: 128_000,
    inputCostPer1M: 1.00,
    outputCostPer1M: 3.00,
    quotaTier: "Standard"
  }
};

const MODEL_MATCHERS: Array<[RegExp, string]> = [
  [/^gpt-4o-mini|^gpt-4-o-mini/, "gpt-4o-mini"],
  [/^gpt-4o|^gpt-4-o/, "gpt-4o"],
  [/^gpt-4-1-mini/, "gpt-4.1-mini"],
  [/^gpt-4-1-nano/, "gpt-4.1-nano"],
  [/^gpt-4-1/, "gpt-4.1"],
  [/^o4-mini/, "o4-mini"],
  [/^o3-mini/, "o3-mini"],
  [/^o3/, "o3"],
  [/claude.*opus.*4-(7|6|5)|opus.*4-(7|6|5)/, "claude-opus-4.7"],
  [/claude.*opus.*4-1|opus.*4-1|claude.*opus.*4|opus.*4/, "claude-opus-4.1"],
  [/claude.*opus.*3|opus.*3/, "claude-opus-3"],
  [/claude.*sonnet.*4-6|sonnet.*4-6/, "claude-sonnet-4.6"],
  [/claude.*sonnet|sonnet/, "claude-sonnet"],
  [/claude.*haiku.*4-5|haiku.*4-5/, "claude-haiku-4.5"],
  [/claude.*haiku.*3-5|haiku.*3-5/, "claude-haiku-3.5"],
  [/claude.*haiku|haiku/, "claude-haiku-4.5"],
  [/gemini.*2-5.*flash-lite|gemini-2-5-flash-lite/, "gemini-2.5-flash-lite"],
  [/gemini.*2-5.*flash|gemini-2-5-flash/, "gemini-2.5-flash"],
  [/gemini.*2-0.*flash-lite|gemini-2-0-flash-lite/, "gemini-2.0-flash-lite"],
  [/gemini.*2-0.*flash|gemini-2-0-flash/, "gemini-2.0-flash"],
  [/gemini.*pro|gemini-pro/, "gemini-pro"],
  [/sonar.*pro|perplexity.*pro/, "sonar-pro"],
  [/grok.*3.*mini|grok-3-mini/, "grok-3-mini"],
  [/grok.*3|grok-3/, "grok-3"],
  [/deepseek.*reasoner|deepseek-r1/, "deepseek-reasoner"],
  [/deepseek.*chat|deepseek-v3/, "deepseek-chat"]
];

function normalizeModelKey(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bmodel\b/g, "")
    .replace(/\bnew\b/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveModelProfile(model: string, provider = "generic"): ModelProfile {
  const normalized = normalizeModelKey(model);
  if (MODEL_CATALOG[normalized]) {
    return MODEL_CATALOG[normalized]!;
  }
  for (const [pattern, id] of MODEL_MATCHERS) {
    if (pattern.test(normalized)) {
      return MODEL_CATALOG[id]!;
    }
  }

  // Provider-based fallback
  const providerLower = provider.toLowerCase();
  if (providerLower.includes("chatgpt") || providerLower.includes("openai")) return MODEL_CATALOG["gpt-4o"]!;
  if (providerLower.includes("claude") || providerLower.includes("anthropic")) return MODEL_CATALOG["claude-sonnet"]!;
  if (providerLower.includes("gemini") || providerLower.includes("google")) return MODEL_CATALOG["gemini-2.5-flash"]!;
  if (providerLower.includes("perplexity")) return MODEL_CATALOG["sonar-pro"]!;
  if (providerLower.includes("grok") || providerLower.includes("xai")) return MODEL_CATALOG["grok-3"]!;
  if (providerLower.includes("deepseek")) return MODEL_CATALOG["deepseek-chat"]!;

  return MODEL_CATALOG["generic"]!;
}

export function calculateCost(promptTokens: number, outputTokens: number, model: string, provider = "generic"): CostBreakdown {
  const profile = resolveModelProfile(model, provider);
  const promptCost = (promptTokens / 1_000_000) * profile.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * profile.outputCostPer1M;
  const totalCost = promptCost + outputCost;

  return {
    promptCost: Number(promptCost.toFixed(6)),
    outputCost: Number(outputCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    model: profile
  };
}
