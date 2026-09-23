import type { AttachmentDescriptor } from "../types/adapters.js";
import type { DraftAnalysis, TokenMeasurementMetadata } from "../types/tokens.js";
import type { ProviderId } from "../types/models.js";
import { resolveModelProfile } from "../models/registry.js";
import { estimateSectionTokens, segmentText } from "./estimator.js";
import { countTokensDeterministic, isDeterministicTokenizerAvailable } from "./tokenizer.js";
import { describeAttachmentsToSections } from "./attachments.js";
import { sum } from "../shared/utils.js";

export const MEASUREMENT_SCHEMA_VERSION = 2;

export interface MeasurementOptions {
  provider?: string;
  model?: string;
  source?: string;
  tokenizer?: string;
  isAuthoritative?: boolean;
}

export function createMeasurement(options: MeasurementOptions = {}): TokenMeasurementMetadata {
  const provider = options.provider || "generic";
  const model = options.model || "unknown";
  const tokenizer = options.tokenizer || "none";
  const source = options.source || "visible provider DOM text";

  if (options.isAuthoritative) {
    return {
      schemaVersion: MEASUREMENT_SCHEMA_VERSION,
      measurementMethod: "provider-api-claim",
      measurementLevel: "authoritative",
      confidenceTier: "Provider reported",
      confidence: 1.0,
      errorMarginPercent: 0,
      provider,
      model,
      tokenizer,
      source,
      notes: "Directly reported by provider"
    };
  }

  if (isDeterministicTokenizerAvailable(tokenizer)) {
    return {
      schemaVersion: MEASUREMENT_SCHEMA_VERSION,
      measurementMethod: "deterministic-bpe-tokenizer",
      measurementLevel: "deterministic_local",
      confidenceTier: "High confidence",
      confidence: 0.95,
      errorMarginPercent: 2,
      provider,
      model,
      tokenizer,
      source,
      notes: "Exact BPE count for visible text using the local tokenizer package; hidden provider context is not included."
    };
  }

  const safeAdapterConfidence = Number.isFinite((options as any).adapterConfidence)
    ? Math.min(1, Math.max(0, (options as any).adapterConfidence))
    : 0.5;
  const confidence = Number((0.42 + safeAdapterConfidence * 0.18).toFixed(2));

  return {
    schemaVersion: 1,
    measurementMethod: "dom-text-heuristic",
    measurementLevel: "approximation",
    confidenceTier: "Rough estimate",
    confidence,
    errorMarginPercent: 40,
    provider,
    model,
    tokenizer: "none",
    source,
    notes: "Visible text only; ±40% is calibrated against an OpenAI BPE reference, not provider billing."
  };
}

function getModelMeasurementOptions(provider: ProviderId, model: string, source?: string): MeasurementOptions {
  const profile = resolveModelProfile(model, provider);
  return {
    provider,
    model,
    source,
    tokenizer: profile.provider === provider ? profile.tokenizer : undefined
  };
}

export function createMeasurementForModel(provider: ProviderId, model: string, source?: string): TokenMeasurementMetadata {
  return createMeasurement(getModelMeasurementOptions(provider, model, source));
}

export function estimateTokenBreakdown(
  text: string,
  attachments: AttachmentDescriptor[] = [],
  options: MeasurementOptions = {}
): {
  textTokens: number;
  codeTokens: number;
  urlTokens: number;
  attachmentTokens: number | null;
  total: number | null;
  sections: any[];
  measurement: TokenMeasurementMetadata;
} {
  const safeText = String(text ?? "");

  // Check if Layer A deterministic tokenizer applies to the entire text
  if (options.tokenizer === "o200k_base" || options.tokenizer === "cl100k_base") {
    const deterministic = countTokensDeterministic(safeText, options.tokenizer);
    if (deterministic) {
      const attachmentSections = describeAttachmentsToSections(attachments);
      const attachmentTokensArr = attachmentSections.map((s) => s.tokens);
      const attachmentTokens = attachmentTokensArr.includes(null) ? null : sum(attachmentTokensArr as number[]);
      const total = attachmentTokens === null ? null : (deterministic.tokens + attachmentTokens);
      const measurement = createMeasurement({ ...options, tokenizer: options.tokenizer });
      if (total === null) {
        measurement.measurementLevel = "unknown";
        measurement.confidenceTier = "Unknown";
        measurement.confidence = 0;
        measurement.errorMarginPercent = 100;
        measurement.notes = "Visible text was BPE-tokenized, but at least one attachment token contribution is unknown; total is unavailable.";
      } else if (attachments.length > 0) {
        measurement.measurementMethod = "mixed-local-and-attachment-estimate";
        measurement.measurementLevel = "approximation";
        measurement.confidenceTier = "Rough estimate";
        measurement.confidence = 0.6;
        measurement.errorMarginPercent = 40;
        measurement.notes = "Visible text uses the local BPE tokenizer; attachment contributions are estimates and hidden provider context is not included.";
      }

      return {
        textTokens: deterministic.tokens,
        codeTokens: 0,
        urlTokens: 0,
        attachmentTokens,
        total,
        sections: [
          {
            label: "Deterministic BPE text",
            type: "prose",
            tokens: deterministic.tokens,
            start: 0,
            end: safeText.length,
            confidenceTier: "High confidence"
          },
          ...attachmentSections
        ],
        measurement
      };
    }
  }

  // Layer B: Segmented calibrated breakdown
  const textSections = segmentText(safeText);
  const attachmentSections = describeAttachmentsToSections(attachments);
  const sections = [...textSections, ...attachmentSections];

  const textTokens = sum(
    sections.filter((s) => ["prose", "instruction", "quote"].includes(s.type)).map((s) => s.tokens as number)
  );
  const codeTokens = sum(sections.filter((s) => s.type === "code").map((s) => s.tokens as number));
  const urlTokens = sum(sections.filter((s) => s.type === "url").map((s) => s.tokens as number));
  const attachmentTokensArr = sections.filter((s) => s.type === "attachment").map((s) => s.tokens);
  const attachmentTokens = attachmentTokensArr.includes(null) ? null : sum(attachmentTokensArr as number[]);
  const total = attachmentTokens === null ? null : (textTokens + codeTokens + urlTokens + attachmentTokens);
  // If tokenization was requested but failed, the fallback below is only a heuristic.
  const measurement = createMeasurement({ ...options, tokenizer: undefined });
  if (total === null) {
    measurement.measurementLevel = "unknown";
    measurement.confidenceTier = "Unknown";
    measurement.confidence = 0;
    measurement.errorMarginPercent = 100;
    measurement.notes = "At least one attachment token contribution is unknown; total is unavailable.";
  }
  return {
    textTokens,
    codeTokens,
    urlTokens,
    attachmentTokens,
    total,
    sections,
    measurement
  };
}

export function analyzeDraft(
  text: string,
  attachments: AttachmentDescriptor[] = [],
  options: MeasurementOptions = {}
): DraftAnalysis {
  const breakdown = estimateTokenBreakdown(text, attachments, options);
  return {
    inputTokens: breakdown.total,
    sections: breakdown.sections,
    measurement: breakdown.measurement,
    largePaste: text.length > 5000
  };
}

export function estimateTokenBreakdownForModel(
  text: string,
  attachments: AttachmentDescriptor[] = [],
  provider: ProviderId,
  model: string
) {
  return estimateTokenBreakdown(text, attachments, getModelMeasurementOptions(provider, model));
}

// Attach to globalThis for browser content script compatibility
const engineApi = Object.freeze({
  schemaVersion: MEASUREMENT_SCHEMA_VERSION,
  estimateSectionTokens,
  segmentText,
  estimateTokenBreakdown,
  estimateTokenBreakdownForModel,
  analyzeDraft,
  createMeasurement,
  createMeasurementForModel
});

if (typeof globalThis !== "undefined") {
  (globalThis as any).YorTokenAccuracy = engineApi;
}
