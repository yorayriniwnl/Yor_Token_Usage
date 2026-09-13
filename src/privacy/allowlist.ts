import type { UsageEventRecord } from "../types/state.js";

export interface CloudUsageEventPayload {
  clientEventId: string;
  provider: string;
  model: string;
  threadId?: string;
  occurredAt: string;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  status: "COMPLETED" | "RATE_LIMITED" | "FAILED";
  accuracy: "ESTIMATED" | "EXACT" | "INFERRED";
  schemaVersion: number;
  measurementMethod: string;
  measurementLevel: string;
  confidence: number;
  errorMarginPercent: number;
  tokenizer: string;
  source: string;
  metadata?: Record<string, unknown>;
}

const FORBIDDEN_KEYS = new Set([
  "promptText",
  "responseText",
  "prompt_text",
  "response_text",
  "prompt",
  "response",
  "preview",
  "promptPreview",
  "draft",
  "draftText",
  "body",
  "text",
  "content"
]);

/**
 * Strict allowlist transformation:
 * Constructs the cloud payload using ONLY approved metric/provenance fields.
 * Explicitly asserts that no raw text fields leaked into the event.
 */
export function buildAllowedCloudUsageEvent(event: UsageEventRecord): CloudUsageEventPayload {
  // Defensive check: if anyone ever tried to attach text, throw immediately!
  for (const key of Object.keys(event)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Privacy Boundary Violation: Prohibited field '${key}' in usage event telemetry`);
    }
  }

  const measurement = event.measurement;
  const statusUpper =
    event.status === "rate_limited" ? "RATE_LIMITED" : event.status === "failed" ? "FAILED" : "COMPLETED";
  const accuracyUpper = event.accuracy === "exact" ? "EXACT" : "ESTIMATED";

  const payload: CloudUsageEventPayload = {
    clientEventId: String(event.clientEventId || event.id),
    provider: String(event.site),
    model: String(event.model),
    threadId: event.threadId ? String(event.threadId) : undefined,
    occurredAt: new Date(event.timestamp).toISOString(),
    promptTokens: Number(event.promptTokens),
    outputTokens: Number(event.outputTokens),
    totalTokens: Number(event.totalTokens),
    status: statusUpper,
    accuracy: accuracyUpper,
    schemaVersion: measurement?.schemaVersion ?? 2,
    measurementMethod: measurement?.measurementMethod ?? "dom-text-heuristic",
    measurementLevel: (measurement?.measurementLevel ?? "calibrated_estimate").toUpperCase(),
    confidence: measurement?.confidence ?? 0.7,
    errorMarginPercent: measurement?.errorMarginPercent ?? 20,
    tokenizer: measurement?.tokenizer ?? "none",
    source: measurement?.source ?? "visible provider DOM text"
  };

  return Object.freeze(payload);
}
