import type { CapturedMessage, ObservedQuotaSignal, ProviderSiteAdapter } from "../types/adapters.js";
import type { TokenMeasurementMetadata } from "../types/tokens.js";
import { compactWhitespace, uid } from "../shared/utils.js";

const RESPONSE_QUIET_PERIOD_MS = 1_000;
const COMPLETION_RECHECK_INTERVAL_MS = 250;
const PENDING_TIMEOUT_MS = 10 * 60_000;

function approximateMeasurement(provider: string, model: string, source: string): TokenMeasurementMetadata {
  return {
    schemaVersion: 1,
    measurementMethod: "dom-text-heuristic",
    measurementLevel: "approximation",
    confidenceTier: "Rough estimate",
    confidence: 0.51,
    errorMarginPercent: 40,
    provider,
    model,
    tokenizer: "none",
    source,
    notes: "Visible text only; heuristic count used because deterministic tokenization was unavailable or failed."
  };
}

function estimateTokens(text: string, provider: string, model: string, source: string): { tokens: number; measurement: TokenMeasurementMetadata } {
  const engine = (globalThis as any).YorTokenAccuracy;
  if (engine?.estimateTokenBreakdownForModel) {
    const breakdown = engine.estimateTokenBreakdownForModel(text, [], provider, model);
    if (typeof breakdown?.total === "number" && breakdown.measurement) {
      return { tokens: breakdown.total, measurement: breakdown.measurement };
    }
  }
  return {
    tokens: Math.ceil((text?.length || 0) / 4),
    measurement: approximateMeasurement(provider, model, source)
  };
}

function combineTextMeasurements(
  prompt: TokenMeasurementMetadata,
  response: TokenMeasurementMetadata,
  provider: string,
  model: string
): TokenMeasurementMetadata {
  if (
    prompt.measurementLevel === "deterministic_local" &&
    response.measurementLevel === "deterministic_local" &&
    prompt.tokenizer === response.tokenizer
  ) {
    return { ...response, source: "visible provider prompt and response text" };
  }
  return approximateMeasurement(provider, model, "visible provider prompt and response text");
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
  promptMeasurement: TokenMeasurementMetadata;
  promptChars: number;
  startedAt: number;
  lastStreamingAt?: number;
  lastAssistantId?: string;
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
  private completionTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
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

    this.clearCompletionTimer();
    this.clearPendingTimeoutTimer();

    const promptEstimate = estimateTokens(trimmed, this.adapter.site, model, "visible provider prompt text");
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
      promptTokens: promptEstimate.tokens,
      promptMeasurement: promptEstimate.measurement,
      promptChars: trimmed.length,
      startedAt: Date.now(),
      awaitingThreadAssignment: threadId.endsWith(":new") || threadId.endsWith(":root"),
      knownAssistantIds
    };

    this.state = "SUBMITTED";
    this.schedulePendingTimeout(this.pending.id);
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
      this.clearCompletionTimer();
      this.clearPendingTimeoutTimer();
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
          this.abandonPending();
          return;
        }
      } else {
        // Navigated away to a different chat: discard pending prompt to prevent cross-chat contamination
        this.abandonPending();
        return;
      }
    }

    // Check if provider hit a rate limit
    if (quotaSignal && quotaSignal.status === "limited") {
      this.transitionToRateLimited(quotaSignal.rateLimitMessage);
      return;
    }

    if (now - this.pending.startedAt >= PENDING_TIMEOUT_MS) {
      this.abandonPending();
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
      if (latestAssistant?.text && (
        latestAssistant.text !== this.pending.lastAssistantText ||
        latestAssistant.id !== this.pending.lastAssistantId
      )) {
        this.clearCompletionTimer();
        this.pending.lastStreamingAt = now;
        this.pending.lastAssistantId = latestAssistant.id;
        this.pending.lastAssistantText = latestAssistant.text;
      }
    }

    if (this.state === "STREAMING" && this.pending.lastAssistantText && this.pending.lastAssistantId) {
      this.scheduleCompletionCheck(root, this.pending.id);
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
      this.clearCompletionTimer();
      this.clearPendingTimeoutTimer();
      this.pending = null;
    }
  }

  private transitionToCompleted(assistantText: string): void {
    if (!this.pending) return;

    this.clearCompletionTimer();
    this.clearPendingTimeoutTimer();

    const responseEstimate = estimateTokens(assistantText, this.adapter.site, this.pending.model, "visible provider response text");
    const outputTokens = responseEstimate.tokens;
    const measurement = combineTextMeasurements(
      this.pending.promptMeasurement,
      responseEstimate.measurement,
      this.adapter.site,
      this.pending.model
    );

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

    this.clearCompletionTimer();
    this.clearPendingTimeoutTimer();

    const measurement = this.pending.promptMeasurement;

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

  private scheduleCompletionCheck(root: ParentNode, pendingId: string, delayMs = RESPONSE_QUIET_PERIOD_MS): void {
    if (this.completionTimer !== null) return;
    this.completionTimer = setTimeout(() => {
      this.completionTimer = null;
      const pending = this.pending;
      if (!pending || pending.id !== pendingId || !pending.lastAssistantId || !pending.lastAssistantText) return;

      const now = Date.now();
      if (now - pending.startedAt >= PENDING_TIMEOUT_MS) {
        this.abandonPending();
        return;
      }
      if (this.adapter.findStopControl(root)) {
        this.scheduleCompletionCheck(root, pendingId, COMPLETION_RECHECK_INTERVAL_MS);
        return;
      }

      const latestAssistant = this.adapter.collectVisibleMessages(root)
        .filter((message) => message.role === "assistant" && !pending.knownAssistantIds.has(message.id))
        .at(-1);
      if (
        !latestAssistant ||
        latestAssistant.id !== pending.lastAssistantId ||
        latestAssistant.text !== pending.lastAssistantText
      ) {
        return;
      }

      const quietFor = now - (pending.lastStreamingAt ?? now);
      if (quietFor < RESPONSE_QUIET_PERIOD_MS) {
        this.scheduleCompletionCheck(root, pendingId, RESPONSE_QUIET_PERIOD_MS - quietFor);
        return;
      }
      this.transitionToCompleted(pending.lastAssistantText);
    }, Math.max(0, delayMs));
  }

  private clearCompletionTimer(): void {
    if (this.completionTimer !== null) {
      clearTimeout(this.completionTimer);
      this.completionTimer = null;
    }
  }

  private schedulePendingTimeout(pendingId: string): void {
    this.pendingTimeoutTimer = setTimeout(() => {
      this.pendingTimeoutTimer = null;
      if (this.pending?.id === pendingId) this.abandonPending();
    }, PENDING_TIMEOUT_MS);
  }

  private clearPendingTimeoutTimer(): void {
    if (this.pendingTimeoutTimer !== null) {
      clearTimeout(this.pendingTimeoutTimer);
      this.pendingTimeoutTimer = null;
    }
  }

  private abandonPending(): void {
    this.clearCompletionTimer();
    this.clearPendingTimeoutTimer();
    this.state = "ABANDONED";
    this.pending = null;
  }
}
