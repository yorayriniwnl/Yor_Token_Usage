let encodeFn: ((text: string) => number[]) | null = null;

if (typeof document !== 'undefined' && typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/gpt-tokenizer.js');
    script.onload = () => {
      encodeFn = (globalThis as any).GptTokenizer_encode || null;
    };
    (document.head || document.documentElement).appendChild(script);
  } catch {}
} else if (typeof globalThis !== 'undefined' && (globalThis as any).GptTokenizer_encode) {
  encodeFn = (globalThis as any).GptTokenizer_encode;
}

export interface DeterministicTokenizerResult {
  tokens: number;
  tokenizer: string;
  isDeterministic: boolean;
}

/**
 * Layer A: Deterministic local tokenization.
 * Applies where a known tokenizer runs locally and matches the model family.
 */
export function countTokensDeterministic(
  text: string,
  modelTokenizer?: string
): DeterministicTokenizerResult | null {
  if (!text) {
    return { tokens: 0, tokenizer: modelTokenizer || "o200k_base", isDeterministic: true };
  }

  // Only apply OpenAI BPE tokenizer to OpenAI / o200k_base models.
  // Never pretend OpenAI tokenizer applies to Claude or Gemini!
  if (modelTokenizer === "o200k_base" || modelTokenizer === "cl100k_base") {
    try {
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
