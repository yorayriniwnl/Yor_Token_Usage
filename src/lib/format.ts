import { clamp, round } from './utils.js';

    // @ts-ignore
export function formatTokens(tokens: any) {
  if (tokens === void 0 || Number.isNaN(tokens)) return "\u2014";
  if (tokens >= 1e6) return `${round(tokens / 1e6, 2)}M`;
  if (tokens >= 1e3) return `${round(tokens / 1e3, 1)}K`;
  return `${Math.round(tokens)}`;
}
    // @ts-ignore
export function formatPercent(value: any) {
  if (value === void 0 || Number.isNaN(value)) return "\u2014";
  return `${round(clamp(value, 0, 100), value > 10 ? 0 : 1)}%`;
}

