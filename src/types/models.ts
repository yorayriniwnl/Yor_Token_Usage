export interface ModelProfile {
  id: string;
  label: string;
  provider: string;
  contextWindow: number | null;
  inputCostPer1M: number | null;
  outputCostPer1M: number | null;
  quotaTier: string;
  pricingEffectiveDate?: string;
  pricingVerifiedDate?: string;
  pricingSource?: string;
  tokenizer?: string;
  isDeprecated?: boolean;
}

export interface CostBreakdown {
  promptCost: number | null;
  outputCost: number | null;
  totalCost: number | null;
  currency: string;
  isApiEquivalent: boolean;
  model: ModelProfile;
}

export type ProviderId = "chatgpt" | "claude" | "gemini" | "perplexity" | "grok" | "generic";
