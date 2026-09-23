type Encoder = (text: string) => number[];
type SupportedTokenizer = "o200k_base" | "cl100k_base";

function getEncoder(modelTokenizer?: string): Encoder | null {
  if (modelTokenizer !== "o200k_base" && modelTokenizer !== "cl100k_base") return null;
  const encoders = (globalThis as any).YorTokenizers;
  const encoder = encoders?.[modelTokenizer];
  return typeof encoder === "function" ? encoder as Encoder : null;
}

export interface DeterministicTokenizerResult {
  tokens: number;
  tokenizer: string;
  isDeterministic: boolean;
}

export function isDeterministicTokenizerAvailable(modelTokenizer?: string): boolean {
  return getEncoder(modelTokenizer) !== null;
}

/**
 * Layer A: Deterministic local tokenization.
 * Applies where a known tokenizer runs locally and matches the model family.
 */
export function countTokensDeterministic(
  text: string,
  modelTokenizer?: string
): DeterministicTokenizerResult | null {
  // Only apply OpenAI BPE tokenizer to OpenAI / o200k_base models.
  // Never pretend OpenAI tokenizer applies to Claude or Gemini!
  if (modelTokenizer === "o200k_base" || modelTokenizer === "cl100k_base") {
    try {
      const encodeFn = getEncoder(modelTokenizer as SupportedTokenizer);
      if (!encodeFn) return null;
      const tokens = encodeFn(text).length;
      return {
        tokens,
        tokenizer: `gpt-tokenizer@4.0.0 / ${modelTokenizer}`,
        isDeterministic: true
      };
    } catch {
      return null;
    }
  }

  return null;
}
