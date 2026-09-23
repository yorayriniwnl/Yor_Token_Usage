import { getAdapterForUrl } from "../adapters/index.js";
import { CaptureStateMachine, type CommittedExchange } from "../capture/stateMachine.js";
import { observeUserSubmissions } from "../capture/submissionListeners.js";
import { applyOverlayPosition } from "../overlay/overlay-position.js";
import { isOverlayInitiallyVisible } from "./overlayVisibility.js";
import { estimateVisibleContext } from "./contextEstimate.js";
import { getCopyShorterCandidate } from "../optimizer/safeOptimizer.js";
import { writeTextToClipboard } from "../shared/clipboard.js";
import { parseQuotaHintsFromText } from "../adapters/base.js";
import { debounce } from "../shared/utils.js";
import type { TabViewStateResponse, UsageEventCommitResponse } from "../types/messages.js";

function getDraftTokenBreakdown(text: string, attachments: any[] = [], provider: string, model: string) {
  const engine = (globalThis as any).YorTokenAccuracy;
  if (engine?.estimateTokenBreakdownForModel) {
    return engine.estimateTokenBreakdownForModel(text, attachments, provider, model);
  }
  const total = Math.ceil((text?.length || 0) / 4);
  return {
    total,
    sections: [{ name: "composer", tokens: total }],
    measurement: {
      measurementLevel: "approximation" as const,
      tokenizer: "none" as const,
      confidence: "estimated" as const,
      errorMarginPercent: 40
    }
  };
}

function getContextMeasurement(provider: string, model: string) {
  const engine = (globalThis as any).YorTokenAccuracy;
  if (engine?.createMeasurement) {
    return engine.createMeasurement({
      provider,
      model,
      source: "visible conversation text plus character-based context estimate"
    });
  }
  return {
    measurementLevel: "approximation" as const,
    tokenizer: "none" as const,
    confidence: "estimated" as const,
    errorMarginPercent: 40
  };
}

function formatRemainingDuration(targetMs: number, now: number): string {
  const diffMs = Math.max(0, targetMs - now);
  const totalMins = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0 && mins > 0) {
    return `~${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `~${hours}h`;
  }
  if (mins > 0) {
    return `~${mins}m`;
  }
  return "<1m";
}

// Design contract requirement: UTC reset window logic
export function parseAnchor(timeStr?: string): { hours: number; minutes: number } {
  if (!timeStr) return { hours: 0, minutes: 0 };
  const [h, m] = timeStr.split(":").map((v) => Number.parseInt(v, 10) || 0);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

export function getUtcDailyWindowBounds(rule: any, now: number): { start: number; end: number } {
  const { hours, minutes } = parseAnchor(rule?.anchorLocalTime);
  const current = new Date(now);
  const anchor = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), hours, minutes, 0, 0);
  const start = anchor > now ? anchor - 864e5 : anchor;
  return { start, end: start + 864e5 };
}

export function getUtcWeeklyWindowBounds(rule: any, now: number): { start: number; end: number } {
  const targetDay = rule?.dayOfWeek ?? 1;
  const { hours, minutes } = parseAnchor(rule?.anchorLocalTime);
  const current = new Date(now);
  const anchorToday = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), hours, minutes, 0, 0);
  const delta = (current.getUTCDay() - targetDay + 7) % 7;
  let start = anchorToday - delta * 864e5;
  if (start > now) start -= 7 * 864e5;
  return { start, end: start + 7 * 864e5 };
}

export function getCurrentWindowBounds(rule: any, now: number = Date.now()): { start: number; end: number } {
  return getUtcWeeklyWindowBounds(rule, now);
}

export function predictReset(options: { now: number; rule?: any; explicitResetAt?: number }): {
  resetAt?: number;
  confidence: string;
} {
  const { now, rule, explicitResetAt } = options;
  if (explicitResetAt && explicitResetAt > now) {
    return { resetAt: explicitResetAt, confidence: "provider_reported" };
  }
  if (!rule || rule.inferred) {
    return { resetAt: undefined, confidence: "unknown" };
  }
  if (rule.kind === "weekly") {
    const bounds = getUtcWeeklyWindowBounds(rule, now);
    return { resetAt: bounds.end, confidence: "estimated" };
  }
  if (rule.kind === "daily") {
    const bounds = getUtcDailyWindowBounds(rule, now);
    return { resetAt: bounds.end, confidence: "estimated" };
  }
  return { resetAt: undefined, confidence: "unknown" };
}

export function computeQuotaStatus(options: {
  now: number;
  events: any[];
  explicitResetAt?: number;
  rule?: any;
}): {
  status: string;
  accuracy: string;
  resetAt?: number;
} {
  const { now, explicitResetAt, rule } = options;
  const resetInfo = predictReset({ now, rule, explicitResetAt });
  return {
    status: explicitResetAt && explicitResetAt > now ? "limited" : "ok",
    accuracy: explicitResetAt ? "provider_reported" : "estimated",
    resetAt: resetInfo.resetAt
  };
}

export class SelectorSiteAdapter {
  constructor(public config: any) {}
}

export function getAdapterForCurrentSite() {
  if (typeof window !== "undefined" && window.location) {
    return getAdapterForUrl(new URL(window.location.href));
  }
  return null;
}
export var adapter = getAdapterForCurrentSite();

// Global hook for script-based regression checks (verify-quota-evidence.mjs)
(globalThis as any).parseQuotaHintsFromText = parseQuotaHintsFromText;
(globalThis as any).predictReset = predictReset;
(globalThis as any).computeQuotaStatus = computeQuotaStatus;
(globalThis as any).SelectorSiteAdapter = SelectorSiteAdapter;

async function init() {
  const url = new URL(window.location.href);
  const siteAdapter = getAdapterForUrl(url);
  if (!siteAdapter) return;
  const activeAdapter: import("../types/adapters.js").ProviderSiteAdapter = siteAdapter;

  let sitePreferences: any = null;
  let overlayVisible = true;
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      const tabView = await chrome.runtime.sendMessage<any, TabViewStateResponse>({
        type: "get-tab-view-state",
        site: activeAdapter.site,
        threadId: activeAdapter.getConversationId(url)
      });
      if (tabView?.ok) {
        sitePreferences = tabView.sitePreference;
        overlayVisible = isOverlayInitiallyVisible(tabView);
      }
    }
  } catch {
    // ignore
  }

  let collapsed = true;

  const onCommitExchange = (event: CommittedExchange) => {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage<any, UsageEventCommitResponse>({
          type: "commit-usage-event",
          event
        }).catch(() => void 0);
      }
    } catch {
      // Ignore extension context invalidated
    }
  };

  const stateMachine = new CaptureStateMachine(activeAdapter, onCommitExchange);

  // Create overlay container and Shadow DOM
  const container = document.createElement("div");
  container.className = "yor-token-usage-root";
  container.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483647;
    pointer-events: none;
    overflow: visible;
  `;
  const shadow = container.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483647;
      pointer-events: none;
      overflow: visible;
    }
    * { box-sizing: border-box; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    }
    .yor-usage-window {
      position: fixed;
      pointer-events: auto;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      color: #dedbd4;
      background: #171719;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 8px 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 12px;
      user-select: none;
      cursor: pointer;
      line-height: 1.3;
    }
    .yor-usage-window:focus-visible, .yor-card button:focus-visible {
      outline: 2px solid #8fdcc4;
      outline-offset: 2px;
    }
    .yor-meter-stat {
      display: flex;
      flex-direction: column;
    }
    .yor-meter-stat span {
      font-size: 10px;
      text-transform: uppercase;
      color: #888;
    }
    .yor-meter-stat strong {
      color: #8fdcc4;
    }
    .yor-card {
      position: fixed;
      pointer-events: auto;
      background: #171719;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 16px;
      width: min(320px, calc(100vw - 24px));
      max-width: calc(100vw - 24px);
      overflow-y: auto;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      color: #dedbd4;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      display: none;
      flex-direction: column;
      gap: 12px;
    }
    .yor-card.yor-open {
      display: flex;
    }
    .yor-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .yor-card button {
      background: #242426;
      color: #dedbd4;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
    }
    .yor-card button.primary {
      background: #8fdcc4;
      color: #101011;
      font-weight: 600;
    }
  `;
  shadow.append(style);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <button class="yor-usage-window" data-action="toggle" data-ref="pageMeter" title="Open Yor Token Usage details">
      <span class="yor-meter-stat">
        <span>Quota</span>
        <strong data-ref="meterPercent">Unknown</strong>
      </span>
      <span class="yor-meter-stat">
        <span>Tokens</span>
        <strong data-ref="meterTokens">Not detected</strong>
      </span>
      <span class="yor-meter-stat">
        <span>Reset</span>
        <strong data-ref="meterReset">Unknown</strong>
      </span>
    </button>
    <div class="yor-card" data-ref="card">
      <div class="yor-card-head">
        <strong>Yor Token Usage</strong>
        <button data-action="toggle" data-ref="toggleButton">Close</button>
      </div>
      <div>
        <span data-ref="quickCost">Cost proxy unavailable</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button data-ref="copyShorterButton">Copy shorter</button>
      </div>
      <span data-ref="copyShorterStatus" aria-live="polite"></span>
    </div>
  `;
  shadow.append(wrapper);
  document.documentElement.appendChild(container);
  container.style.display = overlayVisible ? "" : "none";

  const pageMeter = shadow.querySelector('[data-ref="pageMeter"]') as HTMLElement;
  const card = shadow.querySelector('[data-ref="card"]') as HTMLElement;
  const meterTokens = shadow.querySelector('[data-ref="meterTokens"]') as HTMLElement;
  const meterPercent = shadow.querySelector('[data-ref="meterPercent"]') as HTMLElement;
  const meterReset = shadow.querySelector('[data-ref="meterReset"]') as HTMLElement;
  const copyShorterStatus = shadow.querySelector('[data-ref="copyShorterStatus"]') as HTMLElement;

  function positionOverlay() {
    if (!overlayVisible) return;
    const composer = activeAdapter.findComposer();
    if (!composer) return;
    const anchor = composer.closest("form") || composer;
    const anchorRect = anchor.getBoundingClientRect();
    const viewportRect = { width: window.innerWidth, height: window.innerHeight };
    const maxWidth = Math.max(0, window.innerWidth - 24);
    const availableHeight = Math.max(anchorRect.top - 20, window.innerHeight - anchorRect.bottom - 20);

    if (collapsed) {
      pageMeter.style.display = "flex";
      card.classList.remove("yor-open");
      pageMeter.style.maxWidth = `${maxWidth}px`;
      const meterRect = pageMeter.getBoundingClientRect();
      applyOverlayPosition(pageMeter, anchorRect, viewportRect, {
        width: meterRect.width || 250,
        height: meterRect.height || 44
      });
    } else {
      pageMeter.style.display = "none";
      card.classList.add("yor-open");
      card.style.maxWidth = `${maxWidth}px`;
      card.style.width = `${Math.min(320, maxWidth)}px`;
      card.style.maxHeight = `${Math.max(120, availableHeight)}px`;
      const cardRect = card.getBoundingClientRect();
      applyOverlayPosition(card, anchorRect, viewportRect, {
        width: cardRect.width || Math.min(320, maxWidth),
        height: cardRect.height || 140
      });
    }
  }

  shadow.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-ref="copyShorterButton"]')) {
      const composer = activeAdapter.findComposer();
      const draft = composer ? activeAdapter.readComposerText(composer) : "";
      const shorter = getCopyShorterCandidate(draft);
      try {
        if (!shorter) throw new Error("No shorter version is available.");
        await writeTextToClipboard(shorter);
        copyShorterStatus.textContent = "Shorter prompt copied; original unchanged.";
      } catch {
        copyShorterStatus.textContent = shorter ? "Could not copy shorter prompt." : "No shorter version available.";
      }
      return;
    }
    const toggleBtn = target?.closest('[data-action="toggle"]');
    if (toggleBtn) {
      collapsed = !collapsed;
      positionOverlay();
      return;
    }
  });

  function doUpdateObservation() {
    const composer = activeAdapter.findComposer();
    const draftText = composer ? activeAdapter.readComposerText(composer) : "";
    const attachments = activeAdapter.getAttachmentDescriptors();
    const visibleMessages = activeAdapter.collectVisibleMessages();
    let quota = activeAdapter.getQuotaSignals();
    const modelInfo = activeAdapter.detectModel();
    const threadId = activeAdapter.getConversationId(new URL(window.location.href));

    // Also check DOM alerts for quota hints
    const alertEl = document.querySelector('[role="alert"], .alert, [data-testid="rate-limit-banner"]');
    if (alertEl && alertEl.textContent) {
      const alertQuota = parseQuotaHintsFromText(alertEl.textContent);
      if (alertQuota.status === "limited" || alertQuota.resetAt) {
        quota = { ...quota, ...alertQuota };
      }
    }

    const hasContent = draftText.trim().length > 0 || visibleMessages.length > 0 || attachments.length > 0;
    const draftBreakdown = getDraftTokenBreakdown(draftText, attachments, activeAdapter.site, modelInfo.label || "unknown");
    const visibleTokens = visibleMessages.reduce((sum, m) => sum + Math.ceil(m.text.length / 4), 0);
    const visibleEstimate = estimateVisibleContext(visibleTokens, draftBreakdown.total);

    if (!hasContent) {
      meterTokens.textContent = "Not detected";
      meterReset.textContent = "Unknown";
      meterPercent.textContent = "Unknown";
    } else {
      meterTokens.textContent = visibleEstimate.estimatedCurrentContextTokens === null
        ? "Unknown"
        : `${visibleEstimate.estimatedCurrentContextTokens}`;
      meterPercent.textContent = quota?.percentUsed !== undefined ? `${quota.percentUsed}%` : "Unknown";

      // Reset estimate logic
      if (quota?.resetAt && quota.resetAt > Date.now()) {
        meterReset.textContent = formatRemainingDuration(quota.resetAt, Date.now());
      } else if (sitePreferences?.resetRule && !sitePreferences.resetRule.inferred) {
        const pred = predictReset({ now: Date.now(), rule: sitePreferences.resetRule });
        if (pred.resetAt && pred.resetAt > Date.now()) {
          meterReset.textContent = formatRemainingDuration(pred.resetAt, Date.now());
        } else {
          meterReset.textContent = "Unknown";
        }
      } else {
        meterReset.textContent = "Unknown";
      }
    }

    positionOverlay();

    // Context accounting
    const draftAnalysis = {
      inputTokens: draftBreakdown.total,
      sections: draftBreakdown.sections,
      measurement: draftBreakdown.measurement,
      largePaste: draftText.length > 5000
    };
    const contextAccounting = {
      visibleThreadTokens: visibleTokens,
      visibleMessageCount: visibleMessages.length,
      estimatedCurrentContextTokens: visibleEstimate.estimatedCurrentContextTokens,
      contextPressureTier: visibleEstimate.contextPressureTier,
      measurement: getContextMeasurement(activeAdapter.site, modelInfo.label || "unknown")
    };

    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: "submit-tab-observation",
          site: activeAdapter.site,
          threadId,
          model: modelInfo.label || "unknown",
          draftText,
          draftAnalysis,
          contextAccounting,
          quotaSignal: quota
        }).catch(() => void 0);
      }
    } catch {
      // Ignore extension context invalidated
    }
  }

  const updateObservation = debounce(doUpdateObservation, 100);

  doUpdateObservation();

  // Attach input listener on composer
  document.addEventListener("input", (event) => {
    const composer = activeAdapter.findComposer();
    if (composer && (composer === event.target || composer.contains(event.target as Node))) {
      const text = activeAdapter.readComposerText(composer);
      stateMachine.onUserTyping(text);
      updateObservation();
    }
  });

  observeUserSubmissions(document, {
    findComposer: () => activeAdapter.findComposer(),
    findSendControl: () => activeAdapter.findSendControl(),
    readComposerText: (composer) => activeAdapter.readComposerText(composer),
    getModel: () => activeAdapter.detectModel().label || "unknown",
    getThreadId: () => activeAdapter.getConversationId(new URL(window.location.href)),
    getVisibleMessages: () => activeAdapter.collectVisibleMessages(),
    onSubmit: (text, model, threadId, messages) => {
      stateMachine.onUserSubmit(text, model, threadId, messages);
      updateObservation();
    }
  });

  // MutationObserver for DOM changes
  const observer = new MutationObserver(() => {
    const visibleMessages = activeAdapter.collectVisibleMessages();
    const quota = activeAdapter.getQuotaSignals();
    stateMachine.onDomUpdate(document.body, new URL(window.location.href), visibleMessages, quota);
    updateObservation();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("resize", () => positionOverlay());
  window.addEventListener("scroll", () => positionOverlay(), true);

  // Background message listener (e.g. toggle-overlay)
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "toggle-overlay") {
        overlayVisible = msg.value !== undefined ? msg.value : !overlayVisible;
        container.style.display = overlayVisible ? "" : "none";
        sendResponse({ ok: true, visible: overlayVisible });
      }
    });
  }

  updateObservation();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
}
