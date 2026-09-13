import type { ProviderId } from "./models.js";
import type { ProvenanceLevel } from "./tokens.js";

export type MessageRole = "user" | "assistant" | "unknown";

export interface CapturedMessage {
  id: string;
  role: MessageRole;
  text: string;
  index: number;
  source: "semantic" | "heuristic" | "fallback";
  timestamp?: number;
}

export interface ObservedQuotaSignal {
  resetAt?: number;
  rateLimitMessage?: string;
  percentUsed?: number;
  remainingTokens?: number;
  quotaTier?: string;
  source: "dom_alert" | "provider_ui" | "user_configured" | "unknown";
  status?: "limited" | "ok" | "unknown";
  rawText?: string;
}

export interface AttachmentDescriptor {
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  pages?: number;
  dimensions?: { width: number; height: number };
  extractedTextLength?: number;
  estimatedTokens?: number;
  tokenProvenance: ProvenanceLevel;
}

export interface DetectedModelInfo {
  rawName?: string;
  canonicalId?: string;
  label?: string;
  isKnown: boolean;
}

export interface ProviderSiteAdapter {
  readonly site: ProviderId;
  readonly label: string;
  matches(url: URL): boolean;
  detectModel(root?: ParentNode): DetectedModelInfo;
  findComposer(root?: ParentNode): HTMLElement | null;
  readComposerText(composer: HTMLElement): string;
  findSendControl(root?: ParentNode): HTMLElement | null;
  findStopControl(root?: ParentNode): HTMLElement | null;
  collectVisibleMessages(root?: ParentNode): CapturedMessage[];
  getConversationId(url: URL, root?: ParentNode): string;
  getQuotaSignals(root?: ParentNode): ObservedQuotaSignal | null;
  getAttachmentDescriptors(root?: ParentNode): AttachmentDescriptor[];
}
