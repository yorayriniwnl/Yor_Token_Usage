import type { UserPreferences, SitePreference, ResetRule, } from '../types/state.js';
import type { ProviderId } from '../types/models.js';
import { getCopyShorterCandidate } from '../optimizer/safeOptimizer.js';
import { writeTextToClipboard } from '../shared/clipboard.js';

// src/lib/constants.ts
var SITE_LABELS: Record<ProviderId | "generic", string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
  generic: "Other"
};
function makeResetRule(kind: any, description: string, intervalMinutes: number | undefined): ResetRule {
  return {
    kind,
    intervalMinutes,
    inferred: true,
    description
  };
}
function makeSiteSettings(site: ProviderId | "generic"): SitePreference {
  const defaults: Record<string, any> = {
    chatgpt: {
      enabled: true,
      resetRule: makeResetRule("rolling", "Inferred rolling window. Adjust in settings if your plan differs.", 180),
      quotaTierLabel: "Auto-detect"
    },
    claude: {
      enabled: true,
      resetRule: {
        kind: "daily",
        anchorLocalTime: "00:00",
        inferred: true,
        description: "Inferred daily reset. Adjust if needed."
      },
      quotaTierLabel: "Auto-detect"
    },
    gemini: {
      enabled: true,
      resetRule: {
        kind: "daily",
        anchorLocalTime: "00:00",
        inferred: true,
        description: "Inferred daily reset. Adjust if needed."
      },
      quotaTierLabel: "Auto-detect"
    },
    perplexity: {
      enabled: true,
      resetRule: {
        kind: "daily",
        anchorLocalTime: "00:00",
        inferred: true,
        description: "Inferred daily reset. Adjust if needed."
      },
      quotaTierLabel: "Auto-detect"
    },
    grok: {
      enabled: true,
      resetRule: {
        kind: "daily",
        anchorLocalTime: "00:00",
        inferred: true,
        description: "Inferred daily reset. Adjust if needed."
      },
      quotaTierLabel: "Auto-detect"
    },
    generic: {
      enabled: false,
      resetRule: {
        kind: "unknown",
        inferred: true,
        description: "Set a custom reset rule once you know the platform limits."
      },
      quotaTierLabel: "Custom"
    }
  };
  return structuredClone(defaults[site]);
}
var DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  compactMode: false,
  showOverlay: true,
  privacyMode: "local-only",
  alerts: {
    quotaWarningPercent: 85,
    largePromptTokens: 1800,
    anomalyMultiplier: 2.1,
    desktopNotifications: true,
    badgeMode: "percent"
  },
  sites: {
    chatgpt: makeSiteSettings("chatgpt"),
    claude: makeSiteSettings("claude"),
    gemini: makeSiteSettings("gemini"),
    perplexity: makeSiteSettings("perplexity"),
    grok: makeSiteSettings("grok"),
    generic: makeSiteSettings("generic")
  }
};

// src/lib/utils.ts
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function round(value: number, digits: number = 0): number {
  const precision = 10 ** digits;
  return Math.round(value * precision) / precision;
}

// src/lib/format.ts
function formatTokens(tokens: number | undefined): string {
  if (tokens === void 0 || Number.isNaN(tokens)) return "\u2014";
  const rounded = Math.round(tokens);
  if (rounded >= 999500) return `${round(tokens / 1e6, 2)}M`;
  if (rounded >= 995) return `${round(tokens / 1e3, 1)}K`;
  return `${Math.round(tokens)}`;
}
function formatPercent(value: number | undefined): string {
  if (value === void 0 || Number.isNaN(value)) return "\u2014";
  const clamped = clamp(value, 0, 100);
  if (clamped > 99 && clamped < 100) return "99.9%";
  return `${round(clamped, clamped > 10 ? 0 : 1)}%`;
}
function formatCurrency(value: number | undefined): string {
  if (value === void 0 || Number.isNaN(value)) return "\u2014";
  return new Intl.NumberFormat(void 0, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2
  }).format(value);
}
function formatClock(timestamp: number | undefined): string {
  if (!timestamp) return "Unknown";
  return new Intl.DateTimeFormat(void 0, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}
function escapeHtml(value: any): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"} as Record<string, string>)[char] as string);
}

// src/lib/runtime.ts
async function sendRuntimeMessage<T = any>(message: any): Promise<T> {
  return chrome.runtime.sendMessage(message);
}
async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function getActiveUrl(): Promise<string | undefined> {
  const tab = await getActiveTab();
  return tab?.url;
}
async function sendToActiveTab<T = any>(message: any): Promise<T | undefined> {
  const tab = await getActiveTab();
  if (!tab?.id) return void 0;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return void 0;
  }
}

// src/ui/charts.ts
function renderSparkline(container: HTMLElement, values: number[], labels: string[] = []): void {
  if (!values.length) {
    container.innerHTML = '<div class="empty-chart">No usage data yet.</div>';
    return;
  }
  const width = 320;
  const height = 120;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const points = values.map((value: number, index: number) => {
    const x = index / Math.max(1, values.length - 1) * width;
    const y = height - (value - min) / range * (height - 14) - 7;
    return `${x},${y}`;
  });
  const last = values.at(-1) ?? 0;
  container.innerHTML = `
    <div class="chart-meta"><strong>${formatTokens(last)}</strong><span>latest</span></div>
    <svg viewBox="0 0 ${width} ${height}" class="sparkline" role="img" aria-label="Usage sparkline">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(143, 220, 196, 0.30)"></stop>
          <stop offset="100%" stop-color="rgba(143, 220, 196, 0)"></stop>
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="rgba(143,220,196,0.95)" stroke-width="3" points="${points.join(" ")}"></polyline>
      <polygon fill="url(#spark-fill)" points="0,${height} ${points.join(" ")} ${width},${height}"></polygon>
      ${values.map((value: number, index: number) => {
    const [x, y] = points[index].split(",");
    const label = labels[index] ?? `${index + 1}`;
    return `<circle cx="${x}" cy="${y}" r="3.4" fill="rgba(255,255,255,0.96)"><title>${escapeHtml(label)}: ${formatTokens(value)} tokens</title></circle>`;
  }).join("")}
    </svg>
  `;
}
function renderBarList(container: HTMLElement, items: { label: string; value: number; meta?: string }[], formatter: (v: number) => string = formatTokens): void {
  if (!items.length) {
    container.innerHTML = '<div class="empty-chart">Nothing captured yet.</div>';
    return;
  }
  const max = Math.max(...items.map((item: any) => Number.isFinite(item.value) ? item.value : 0), 1);
  container.innerHTML = items.map(
    (item: any) => {
      const value = Number.isFinite(item.value) ? item.value : 0;
      const width = Math.max(5, value / max * 100);
      return `
        <div class="bar-row">
          <div class="bar-copy">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.meta ?? formatter(value))}</span>
          </div>
          <div class="bar-track"><span style="width:${width}%"></span></div>
        </div>
      `;
    }
  ).join("");
}

// src/popup/index.ts
var usageCard = document.querySelector("#usage-card") as HTMLElement;
var trendChart = document.querySelector("#trend-chart") as HTMLElement;
var modelBreakdown = document.querySelector("#model-breakdown") as HTMLElement;
var suggestions = document.querySelector("#suggestions") as HTMLElement;
var changeSummary = document.querySelector("#change-summary") as HTMLElement;
function applyPresentation(preferences: any) {
  const theme = preferences.theme === "system" ? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark") : preferences.theme;
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
  document.documentElement.classList.toggle("compact", preferences.compactMode === true);
}
async function runButtonAction(button: HTMLElement, task: () => Promise<void>, doneLabel: string = "Done", failureLabel: string = "Failed") {
  const originalLabel = button.textContent;
  button.classList.add("is-busy");
  try {
    await task();
    button.classList.remove("is-busy");
    button.classList.add("is-confirmed");
    button.textContent = doneLabel;
  } catch {
    button.classList.remove("is-busy");
    button.textContent = failureLabel;
  } finally {
    setTimeout(() => {
      button.classList.remove("is-confirmed", "is-busy");
      button.textContent = originalLabel;
    }, 900);
  }
}
function renderLoading() {
  usageCard!.innerHTML = `
    <div class="hero-copy">
      <div class="skeleton-stack">
        <span class="skeleton-line w-lg"></span>
        <span class="skeleton-line w-md"></span>
      </div>
      <span class="skeleton-pill"></span>
    </div>
    <div class="metric-grid">
      ${Array.from({ length: 4 }, () => '<div class="metric"><span class="skeleton-line w-sm"></span><strong class="skeleton-line w-md"></strong></div>').join("")}
    </div>
  `;
  trendChart!.innerHTML = '<div class="skeleton-chart"></div>';
  modelBreakdown!.innerHTML = '<div class="skeleton-chart short"></div>';
  suggestions!.innerHTML = '<div class="skeleton-chart short"></div>';
  changeSummary!.innerHTML = '<span class="skeleton-line w-lg"></span>';
}
function describeRuntimeError(error: any): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/chrome|sendMessage|extension context|cannot read properties of undefined|is not a function/i.test(message)) {
    return "The extension background service is unavailable. Reload Yor and reopen this view.";
  }
  return message.slice(0, 240) || "The extension could not load this view.";
}
function renderError(message: string) {
  usageCard!.innerHTML = `
    <div class="hero-copy">
      <div>
        <h2>Could not load usage</h2>
        <p>${escapeHtml(message)}</p>
      </div>
      <span class="status-chip">Offline</span>
    </div>
  `;
  trendChart!.innerHTML = '<div class="empty-chart">Refresh the active AI tab, then reopen this popup.</div>';
  modelBreakdown!.innerHTML = '<div class="empty-chart">No model data available.</div>';
  suggestions!.innerHTML = '<div class="empty-chart">No prompt suggestions available.</div>';
  changeSummary!.textContent = "The extension runtime did not return a snapshot.";
}
function buildSessionSummary(session: any, snapshot: any): string {
  if (!session || !snapshot) {
    return "Open ChatGPT, Claude, Gemini, Perplexity, or Grok to start capturing live token usage.";
  }
  const previous = snapshot.analytics.timeline[0];
  if (!previous) {
    return `Watching ${SITE_LABELS[session.site as ProviderId]} with ${session.model}. Your first captured exchange will appear here.`;
  }
  const delta = session.draftAnalysis?.inputTokens - (previous.promptTokens ?? previous.totalTokens ?? 0);
  const direction = delta >= 0 ? "larger" : "smaller";
  return `The active prompt is ${formatTokens(Math.abs(delta))} tokens ${direction} than the previous captured exchange, and the current thread is around ${formatTokens(session.contextAccounting?.visibleThreadTokens)} tokens.`;
}
function renderHero(snapshot: any) {
  const session = snapshot.currentSession;
  const percent = Number.isFinite(session?.quotaSignal?.percentUsed) ? session.quotaSignal.percentUsed : 0;
  const statusLabel = session?.quotaSignal?.status === "limited" ? "Limit reached" : session?.quotaSignal?.status === "warning" ? "Near limit" : session?.quotaSignal?.source === "provider_ui" ? "Provider signal" : "Estimated";
  const measurement = session?.draftAnalysis?.measurement;
  const measurementLabel = measurement?.measurementLevel === "approximation" ? "Approximate" : measurement?.measurementLevel === "calibrated_estimate" ? "Calibrated estimate" : "Unknown";
  const measurementConfidence = Number.isFinite(measurement?.confidence) ? `${Math.round(measurement.confidence * 100)}% confidence` : "confidence unknown";
  const measurementMargin = Number.isFinite(measurement?.errorMarginPercent) ? `±${Math.round(measurement.errorMarginPercent)}% bound` : "no error bound";
  usageCard!.innerHTML = `
    <div class="hero-copy">
      <div>
        <h2>${escapeHtml(session ? `${SITE_LABELS[session.site as ProviderId]} \u2022 ${session.model}` : "No active AI tab")}</h2>
        <p>${escapeHtml(session ? `Reset ${session.quotaSignal?.resetAt ? formatClock(session.quotaSignal.resetAt) : "unknown"} \u2022 last update ${formatClock(session.lastUpdated)}` : "Pin the popup while you work to monitor usage in real time.")}</p>
        ${session ? `<p class="measurement-note" title="${escapeHtml(measurement?.notes ?? "Token provenance is unavailable.")}">${escapeHtml(`${measurementLabel} \u2022 ${measurementConfidence} \u2022 ${measurementMargin}`)}</p>` : ""}
      </div>
      <span class="status-chip">${escapeHtml(statusLabel)}</span>
    </div>
    <div class="metric-grid">
      <div class="metric"><strong>${formatTokens(snapshot.summary.tokensToday)}</strong><span>today</span></div>
      <div class="metric"><strong>${formatTokens(snapshot.summary.tokensThisWeek)}</strong><span>7-day total</span></div>
      <div class="metric"><strong>${session ? formatTokens(session.draftAnalysis?.inputTokens) : "\u2014"}</strong><span>current prompt</span></div>
      <div class="metric"><strong>${formatCurrency(snapshot.summary.costThisWeek)}</strong><span>est. cost</span></div>
    </div>
    <div class="meter-track"><span style="width:${Math.max(4, Math.min(percent, 100))}%"></span></div>
    <div class="metric-grid secondary">
      <div class="metric"><strong>${session ? formatPercent(session.quotaSignal?.percentUsed) : "\u2014"}</strong><span>quota used</span></div>
      <div class="metric"><strong>${session ? formatTokens(session.quotaSignal?.remainingTokens) : "\u2014"}</strong><span>remaining</span></div>
      <div class="metric"><strong>${session ? formatTokens(session.contextAccounting?.visibleThreadTokens) : "\u2014"}</strong><span>thread total</span></div>
      <div class="metric"><strong>\u2014</strong><span>save potential</span></div>
    </div>
  `;
}
async function render() {
  let snapshot: any;
  try {
    const activeUrl = await getActiveUrl();
    snapshot = await sendRuntimeMessage({ type: "get-snapshot", activeUrl });
  } catch (error) {
    renderError(describeRuntimeError(error));
    return;
  }
  if (!snapshot?.analytics || !snapshot?.summary) {
    renderError("Snapshot data was missing or incomplete.");
    return;
  }
  applyPresentation(snapshot.state?.preferences ?? DEFAULT_PREFERENCES);
  renderHero(snapshot);
  renderSparkline(
    trendChart,
    (snapshot.analytics.byDay || []).map((day: any) => day.tokens),
    (snapshot.analytics.byDay || []).map((day: any) => day.date)
  );
  renderBarList(
    modelBreakdown,
    (snapshot.analytics.byModel || []).slice(0, 4).map((item: any) => ({ label: item.label, value: item.tokens, meta: `${formatTokens(item.tokens)} \u2022 ${item.prompts} prompts` }))
  );
  const currentSuggestions: any[] = [];
  suggestions!.innerHTML = currentSuggestions.length ? currentSuggestions.slice(0, 3).map(
    (item: any) => `
            <div class="suggestion-card">
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.description)} Save about ${formatTokens(item.estimatedSavings)} tokens.</p>
            </div>
          `
  ).join("") : '<div class="empty-chart">No optimization warnings right now.</div>';
  changeSummary!.textContent = buildSessionSummary(snapshot.currentSession, snapshot);
  (document.querySelector("#copy-summary-btn") as HTMLElement)!.onclick = async (event: Event) => {
    const session = snapshot.currentSession;
    await runButtonAction(event.currentTarget as HTMLElement, async () => {
      const summary = session ? `${SITE_LABELS[session.site as ProviderId]} \u2022 ${session.model}
Current prompt: ${formatTokens(session.draftAnalysis?.inputTokens)}
Thread total: ${formatTokens(session.contextAccounting?.visibleThreadTokens)}
Quota used: ${session.quotaSignal?.percentUsed != null ? formatPercent(session.quotaSignal.percentUsed) : "unknown"}
Reset: ${session.quotaSignal?.resetAt ? formatClock(session.quotaSignal.resetAt) : "unknown"}` : "No active AI session yet.";
      await navigator.clipboard.writeText(summary);
    }, "Copied");
  };
  (document.querySelector("#copy-shorter-btn") as HTMLElement)!.onclick = async (event: Event) => {
    const button = event.currentTarget as HTMLElement;
    const shorter = getCopyShorterCandidate(snapshot.currentSession?.currentDraft ?? "");
    if (!shorter) {
      const originalLabel = button.textContent;
      button.textContent = "No shorter version";
      setTimeout(() => { button.textContent = originalLabel; }, 900);
      return;
    }
    await runButtonAction(button, async () => {
      await writeTextToClipboard(shorter);
    }, "Copied shorter", "Copy failed");
  };
  (document.querySelector("#dashboard-btn") as HTMLElement)!.onclick = async (event: Event) => {
    await runButtonAction(event.currentTarget as HTMLElement, async () => {
      await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    }, "Opened");
  };
  (document.querySelector("#settings-btn") as HTMLElement)!.onclick = async (event: Event) => {
    await runButtonAction(event.currentTarget as HTMLElement, async () => {
      await chrome.runtime.openOptionsPage();
    }, "Opened");
  };
  (document.querySelector("#toggle-overlay-btn") as HTMLElement)!.onclick = async (event: Event) => {
    await runButtonAction(event.currentTarget as HTMLElement, async () => {
      const response = await sendToActiveTab({ type: "toggle-overlay" });
      if (!response?.ok) throw new Error("No supported AI tab is available.");
    }, "Toggled");
  };
  (document.querySelector("#refresh-btn") as HTMLElement)!.onclick = async (event: Event) => {
    await runButtonAction(event.currentTarget as HTMLElement, async () => {
      const response = await sendToActiveTab({ type: "refresh-session" });
      if (!response?.ok) throw new Error("No supported AI tab is available.");
      await render();
    }, "Updated");
  };
}
renderLoading();
void render();

export {};
