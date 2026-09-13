import type { ProviderSiteAdapter } from "../types/adapters.js";
import { ChatGPTAdapter } from "./chatgpt.js";
import { ClaudeAdapter } from "./claude.js";
import { GeminiAdapter } from "./gemini.js";
import { PerplexityAdapter } from "./perplexity.js";
import { GrokAdapter } from "./grok.js";

export const ADAPTERS: ProviderSiteAdapter[] = [
  new ChatGPTAdapter(),
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new PerplexityAdapter(),
  new GrokAdapter()
];

export function getAdapterForUrl(url: URL): ProviderSiteAdapter | null {
  for (const adapter of ADAPTERS) {
    if (adapter.matches(url)) {
      return adapter;
    }
  }
  return null;
}

export * from "./base.js";
export * from "./chatgpt.js";
export * from "./claude.js";
export * from "./gemini.js";
export * from "./perplexity.js";
export * from "./grok.js";
