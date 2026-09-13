import type { CapturedMessage, ObservedQuotaSignal, ProviderSiteAdapter } from "../types/adapters.js";
import { compactWhitespace, uid } from "../shared/utils.js";

function estimateTokens(text: string): number {
  const engine = (globalThis as any).YorTokenAccuracy;
  if (engine?.estimateTokenBreakdown) {
    return engine.estimateTokenBreakdown(text).total;
  }
  return Math.ceil((text?.length || 0) / 4);
}

function makeMeasurement(provider: string, model: string, source: string) {
  const engine = (globalThis as any).YorTokenAccuracy;
  if (engine?.createMeasurement) {
    return engine.createMeasurement({ provider, model, source });
  }
  return {
    measurementLevel: "approximation" as const,
    tokenizer: "none" as const,
    confidence: "estimated" as const,
    errorMarginPercent: 40
  };
}

export type CaptureState =
  | "IDLE"
  | "DRAFTING"
  | "SUBMITTED"
  | "AWAITING_RESPONSE"
  | "STREAMING"
  | "COMPLETED"
  | "RATE_LIMITED"
  | "FAILED"
  | "ABANDONED";

export interface PendingExchange {
  id: string;
  clientEventId: string;
  threadId: string;
  model: string;
  promptText: string;
  promptTokens: number;
  promptChars: number;
  startedAt: number;
  lastStreamingAt?: number;
  lastAssistantText?: string;
  awaitingThreadAssignment?: boolean;
  knownAssistantIds: Set<string>;
}

export interface CommittedExchange {
  id: string;
  clientEventId: string;
  site: string;
  model: string;
  threadId: string;
  timestamp: number;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  promptChars: number;
  outputChars: number;
  status: "completed" | "rate_limited" | "failed";
  accuracy: "exact" | "calibrated" | "estimated" | "unknown";
  measurement: any;
}

export class CaptureStateMachine {
  private state: CaptureState = "IDLE";
  private pending: PendingExchange | null = null;
  private adapter: ProviderSiteAdapter;
  private onCommit: (event: CommittedExchange) => void;

  constructor(adapter: ProviderSiteAdapter, onCommit: (event: CommittedExchange) => void) {
    this.adapter = adapter;
    this.onCommit = onCommit;
  }

  getState(): CaptureState {
    return this.state;
  }

  getPending(): Readonly<PendingExchange> | null {
    return this.pending;
  }

  /**
   * Called when the user types in composer.
   */
  onUserTyping(text: string): void {
    if (this.state === "IDLE" || this.state === "DRAFTING") {
      this.state = text.trim().length > 0 ? "DRAFTING" : "IDLE";
    }
  }

  /**
   * Called when user clicks send or presses Enter.
   */
  onUserSubmit(promptText: string, model: string, threadId: string, visibleMessages: CapturedMessage[]): boolean {
    const trimmed = promptText.trim();
    if (!trimmed) return false;

    const promptTokens = estimateTokens(trimmed);
    const knownAssistantIds = new Set<string>();
    visibleMessages
      .filter((m) => m.role === "assistant")
      .forEach((m) => knownAssistantIds.add(m.id));

    this.pending = {
      id: uid("exch"),
      clientEventId: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uid("cli"),
      threadId,
      model,
      promptText: trimmed,
      promptTokens,
      promptChars: trimmed.length,
      startedAt: Date.now(),
      awaitingThreadAssignment: threadId.endsWith(":new") || threadId.endsWith(":root"),
      knownAssistantIds
    };

    this.state = "SUBMITTED";
    return true;
  }

  /**
   * Evaluates DOM updates to progress state:
   * Checks stop controls, new assistant messages, error banners, rate limits.
   */
  onDomUpdate(
    root: ParentNode,
    currentUrl: URL,
    visibleMessages: CapturedMessage[],
    quotaSignal: ObservedQuotaSignal | null
  ): void {
    if (!this.pending) {
      if (this.state !== "IDLE" && this.state !== "DRAFTING") {
        this.state = "IDLE";
      }
      return;
    }

    const now = Date.now();

    // Check thread assignment if url changed from /new to /chat/id
    const currentThreadId = this.adapter.getConversationId(currentUrl, root);
    if (currentThreadId !== this.pending.threadId) {
      if (this.pending.awaitingThreadAssignment) {
        const userMatches = visibleMessages.some(
          (m) => m.role === "user" && compactWhitespace(m.text) === compactWhitespace(this.pending!.promptText)
        );
        if (userMatches) {
          this.pending.threadId = currentThreadId;
          this.pending.awaitingThreadAssignment = false;
        } else {
          this.state = "ABANDONED";
          this.pending = null;
          return;
        }
      } else {
        // Navigated away to a different chat: discard pending prompt to prevent cross-chat contamination
        this.state = "ABANDONED";
        this.pending = null;
        return;
      }
    }

    // Check if provider hit a rate limit
    if (quotaSignal && quotaSignal.status === "limited") {
      this.transitionToRateLimited(quotaSignal.rateLimitMessage);
      return;
    }

    // Check generation indicator (e.g. stop button present)
    const isGenerating = Boolean(this.adapter.findStopControl(root));

    // Look for new assistant response that wasn't previously known
    const assistantMessages = visibleMessages.filter(
      (m) => m.role === "assistant" && !this.pending!.knownAssistantIds.has(m.id)
    );
    const latestAssistant = assistantMessages.at(-1);

    if (this.state === "SUBMITTED") {
      this.state = "AWAITING_RESPONSE";
    }

    if (isGenerating || (latestAssistant && latestAssistant.text.length > 0)) {
      this.state = "STREAMING";
      this.pending.lastStreamingAt = now;
      if (latestAssistant) {
        this.pending.lastAssistantText = latestAssistant.text;
      }
    }

    // Completion condition:
    // Was streaming or awaiting response, stop button is gone, and we have a non-empty assistant response.
    if (!isGenerating && this.state === "STREAMING" && this.pending.lastAssistantText) {
      this.transitionToCompleted(this.pending.lastAssistantText);
      return;
    }

    // Timeout / Abandoned safeguard (10 minutes)
    if (now - this.pending.startedAt > 10 * 60_000) {
      this.state = "ABANDONED";
      this.pending = null;
    }
  }

  /**
   * Explicitly handles user stopping or interrupting generation.
   */
  onUserCancel(): void {
    if (this.pending && this.pending.lastAssistantText) {
      // Partial completion is committed with actual tokens observed so far!
      this.transitionToCompleted(this.pending.lastAssistantText);
    } else {
      this.state = "ABANDONED";
      this.pending = null;
    }
  }

  private transitionToCompleted(assistantText: string): void {
    if (!this.pending) return;

    const outputTokens = estimateTokens(assistantText);
    const measurement = makeMeasurement(this.adapter.site, this.pending.model, "visible provider DOM response");

    const committed: CommittedExchange = {
      id: this.pending.id,
      clientEventId: this.pending.clientEventId,
      site: this.adapter.site,
      model: this.pending.model,
      threadId: this.pending.threadId,
      timestamp: Date.now(),
      promptTokens: this.pending.promptTokens,
      outputTokens,
      totalTokens: this.pending.promptTokens + outputTokens,
      promptChars: this.pending.promptChars,
      outputChars: assistantText.length,
      status: "completed",
      accuracy: measurement.measurementLevel === "deterministic_local" ? "exact" : "calibrated",
      measurement
    };

    this.state = "COMPLETED";
    this.pending = null;
    this.onCommit(committed);
    this.state = "IDLE";
  }

  private transitionToRateLimited(_message?: string): void {
    if (!this.pending) return;

    const measurement = makeMeasurement(this.adapter.site, this.pending.model, "provider rate limit signal");

    const committed: CommittedExchange = {
      id: this.pending.id,
      clientEventId: this.pending.clientEventId,
      site: this.adapter.site,
      model: this.pending.model,
      threadId: this.pending.threadId,
      timestamp: Date.now(),
      promptTokens: this.pending.promptTokens,
      outputTokens: 0,
      totalTokens: this.pending.promptTokens,
      promptChars: this.pending.promptChars,
      outputChars: 0,
      status: "rate_limited",
      accuracy: "estimated",
      measurement
    };

    this.state = "RATE_LIMITED";
    this.pending = null;
    this.onCommit(committed);
    this.state = "IDLE";
  }
}
