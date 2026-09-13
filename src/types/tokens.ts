export type ProvenanceLevel =
  | "authoritative"
  | "provider_observed"
  | "deterministic_local"
  | "calibrated_estimate"
  | "rough_estimate"
  | "unknown"
  | "approximation";

export type ConfidenceTier =
  | "High confidence"
  | "Moderate confidence"
  | "Rough estimate"
  | "Provider reported"
  | "Unknown";

export interface TokenMeasurementMetadata {
  schemaVersion: number;
  measurementMethod: string;
  measurementLevel: ProvenanceLevel;
  confidenceTier: ConfidenceTier;
  confidence: number;
  errorMarginPercent: number;
  provider: string;
  model: string;
  tokenizer: string;
  source: string;
  calibratedAt?: string;
  notes?: string;
}

export interface TurnTokenAccounting {
  /** Tokens in the submitted user prompt text */
  estimatedRequestInputTokens: number;
  /** Tokens in the generated assistant completion text */
  estimatedGeneratedOutputTokens: number;
  /** Total tokens observed in this turn (input + output) */
  observedExchangeTokens: number;
  /** Character count of prompt */
  promptChars: number;
  /** Character count of output */
  outputChars: number;
  /** Provenance metadata for this turn */
  measurement: TokenMeasurementMetadata;
}

export interface ThreadContextAccounting {
  /** Sum of tokens across currently rendered visible messages in DOM */
  visibleThreadTokens: number;
  /** Number of visible messages captured */
  visibleMessageCount: number;
  /** Best estimate of active model context window occupancy */
  estimatedCurrentContextTokens: number;
  /** Context window capacity of model if known, or undefined */
  contextWindowCapacity?: number;
  /** Context window occupancy percentage if capacity is known */
  contextOccupancyPercent?: number;
  /** Qualitative context pressure label */
  contextPressureTier: "low" | "moderate" | "high" | "critical" | "unknown";
  /** Provenance for context calculation */
  measurement: TokenMeasurementMetadata;
}

export interface SectionTokenEstimate {
  label: string;
  type: "prose" | "code" | "instruction" | "quote" | "url" | "attachment" | "unknown";
  tokens: number | null;
  start: number;
  end: number;
  confidenceTier: ConfidenceTier;
}

export interface DraftAnalysis {
  inputTokens: number | null;
  sections: SectionTokenEstimate[];
  measurement: TokenMeasurementMetadata;
  largePaste: boolean;
}
