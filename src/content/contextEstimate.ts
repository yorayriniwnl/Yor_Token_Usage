export interface VisibleContextEstimate {
  estimatedCurrentContextTokens: number | null;
  contextPressureTier: "unknown";
}

/**
 * Estimates only the visible thread and current draft subtotal. Provider-owned
 * context is not observable from the page, so a pressure tier cannot be inferred.
 */
export function estimateVisibleContext(
  visibleThreadTokens: number,
  draftTokens: number | null
): VisibleContextEstimate {
  return {
    estimatedCurrentContextTokens: draftTokens === null ? null : visibleThreadTokens + draftTokens,
    contextPressureTier: "unknown"
  };
}
