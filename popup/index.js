// src/lib/constants.ts
var SITE_LABELS = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
  generic: "Other"
};
function makeResetRule(kind, description, intervalMinutes) {
  return {
    kind,
    intervalMinutes,
    inferred: true,
    description
  };
}
function makeSiteSettings(site) {
  const defaults = {
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
var DEFAULT_PREFERENCES = {
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
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function round(value, digits = 0) {
  const precision = 10 ** digits;
  return Math.round(value * precision) / precision;
}

// src/lib/format.ts
function formatTokens(tokens) {
  if (tokens === void 0 || Number.isNaN(tokens)) return "\u2014";
  if (tokens >= 1e6) return `${round(tokens / 1e6, 2)}M`;
  if (tokens >= 1e3) return `${round(tokens / 1e3, 1)}K`;
  return `${Math.round(tokens)}`;
}
function formatPercent(value) {
  if (value === void 0 || Number.isNaN(value)) return "\u2014";
  return `${round(clamp(value, 0, 100), value > 10 ? 0 : 1)}%`;
}
function formatCurrency(value) {
  if (value === void 0 || Number.isNaN(value)) return "\u2014";
  return new Intl.NumberFormat(void 0, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: value < 1 ? 2 : 0
  }).format(value);
}
function formatClock(timestamp) {
  if (!timestamp) return "Unknown";
  return new Intl.DateTimeFormat(void 0, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// src/lib/runtime.ts
async function sendRuntimeMessage(message) {
  return chrome.runtime.sendMessage(message);
}
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function getActiveUrl() {
  const tab = await getActiveTab();
  return tab?.url;
}
async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) return void 0;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return void 0;
  }
}

// src/ui/charts.ts
function renderSparkline(container, values, labels = []) {
  if (!values.length) {
    container.innerHTML = '<div class="empty-chart">No usage data yet.</div>';
    return;
  }
  const width = 320;
  const height = 120;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => {
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
      ${values.map((value, index) => {
    const [x, y] = points[index].split(",");
    const label = labels[index] ?? `${index + 1}`;
    return `<circle cx="${x}" cy="${y}" r="3.4" fill="rgba(255,255,255,0.96)"><title>${escapeHtml(label)}: ${formatTokens(value)} tokens</title></circle>`;
  }).join("")}
    </svg>
  `;
}
function renderBarList(container, items, formatter = formatTokens) {
  if (!items.length) {
    container.innerHTML = '<div class="empty-chart">Nothing captured yet.</div>';
    return;
  }
  const max = Math.max(...items.map((item) => Number.isFinite(item.value) ? item.value : 0), 1);
  container.innerHTML = items.map(
    (item) => {
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
var usageCard = document.querySelector("#usage-card");
var trendChart = document.querySelector("#trend-chart");
var modelBreakdown = document.querySelector("#model-breakdown");
var suggestions = document.querySelector("#suggestions");
var changeSummary = document.querySelector("#change-summary");
async function runButtonAction(button, task, doneLabel = "Done") {
  const originalLabel = button.textContent;
  button.classList.add("is-busy");
  try {
    await task();
    button.classList.remove("is-busy");
    button.classList.add("is-confirmed");
    button.textContent = doneLabel;
  } catch {
    button.classList.remove("is-busy");
    button.textContent = "Failed";
  } finally {
    setTimeout(() => {
      button.classList.remove("is-confirmed", "is-busy");
      button.textContent = originalLabel;
    }, 900);
  }
}
function renderLoading() {
  usageCard.innerHTML = `
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
  trendChart.innerHTML = '<div class="skeleton-chart"></div>';
  modelBreakdown.innerHTML = '<div class="skeleton-chart short"></div>';
  suggestions.innerHTML = '<div class="skeleton-chart short"></div>';
  changeSummary.innerHTML = '<span class="skeleton-line w-lg"></span>';
}
function renderError(message) {
  usageCard.innerHTML = `
    <div class="hero-copy">
      <div>
        <h2>Could not load usage</h2>
        <p>${escapeHtml(message)}</p>
      </div>
      <span class="status-chip">Offline</span>
    </div>
  `;
  trendChart.innerHTML = '<div class="empty-chart">Refresh the active AI tab, then reopen this popup.</div>';
  modelBreakdown.innerHTML = '<div class="empty-chart">No model data available.</div>';
  suggestions.innerHTML = '<div class="empty-chart">No prompt suggestions available.</div>';
  changeSummary.textContent = "The extension runtime did not return a snapshot.";
}
function buildSessionSummary(session, snapshot) {
  if (!session || !snapshot) {
    return "Open ChatGPT, Claude, Gemini, Perplexity, or Grok to start capturing live token usage.";
  }
  const previous = snapshot.analytics.timeline[1];
  if (!previous) {
    return `Watching ${SITE_LABELS[session.site]} with ${session.model}. Your first captured exchange will appear here.`;
  }
  const delta = session.currentEstimate.inputTokens - previous.promptTokens;
  const direction = delta >= 0 ? "larger" : "smaller";
  return `The active prompt is ${formatTokens(Math.abs(delta))} tokens ${direction} than the previous captured exchange, and the current thread is around ${formatTokens(session.currentThread?.totalTokens)} tokens.`;
}
function accuracyBadge(session) {
  if (!session) return "";
  const acc = session.accuracy ?? "estimated";
  const cls = acc === "exact" ? "badge-exact" : acc === "inferred" ? "badge-inferred" : "badge-est";
  const label = acc === "exact" ? "Exact" : acc === "inferred" ? "Inferred" : "Est.";
  return `<span class="accuracy-badge ${cls}">${escapeHtml(label)}</span>`;
}
function formatCacheSavings(session) {
  if (!session?.cacheReadTokens) return null;
  const rate = 0.00025; // conservative cross-model cache read saving per 1k tokens
  const saved = session.cacheReadTokens / 1e3 * rate;
  if (saved < 0.0001) return null;
  return formatCurrency(saved);
}
function renderHero(snapshot) {
  const session = snapshot.currentSession;
  const percent = Number.isFinite(session?.quota.percentUsed) ? session.quota.percentUsed : 0;
  const quotaAcc = session?.quota?.accuracy === "exact" ? "Exact quota" : "Est. quota";
  const cacheSaved = formatCacheSavings(session);
  const costToday = formatCurrency(snapshot.summary.costToday ?? snapshot.analytics.byDay.at(-1)?.cost ?? 0);
  const costWeek = formatCurrency(snapshot.summary.costThisWeek);
  usageCard.innerHTML = `
    <div class="hero-copy">
      <div>
        <h2>${escapeHtml(session ? `${SITE_LABELS[session.site]} \u00b7 ${session.model || "Unknown model"}` : "No active AI tab")}</h2>
        <p>${escapeHtml(session
          ? `Reset ${session.quota.nextReset?.localLabel ?? "unknown"} \u00b7 updated ${formatClock(session.lastUpdated)}`
          : "Open Claude, ChatGPT, Gemini, Perplexity, or Grok to start.")}</p>
      </div>
      <div class="chip-row">
        ${accuracyBadge(session)}
        <span class="status-chip">${escapeHtml(
          session?.quota.status === "limited" ? "Limit reached"
          : session?.quota.status === "warning" ? "Near limit" : "Active")}</span>
      </div>
    </div>
    <div class="metric-grid">
      <div class="metric primary"><strong>${costToday}</strong><span>cost today</span></div>
      <div class="metric primary"><strong>${costWeek}</strong><span>cost 7 days</span></div>
      <div class="metric"><strong>${session ? formatTokens(session.currentEstimate.inputTokens) : "\u2014"}</strong><span>prompt tokens</span></div>
      <div class="metric">${cacheSaved
        ? `<strong class="cache-win">${escapeHtml(cacheSaved)} saved</strong><span>from cache</span>`
        : `<strong>${formatTokens(snapshot.summary.tokensToday)}</strong><span>tokens today</span>`}</div>
    </div>
    <div class="meter-track" title="${escapeHtml(quotaAcc)}"><span style="width:${Math.max(2, Math.min(percent, 100))}%"></span></div>
    <div class="metric-grid secondary">
      <div class="metric"><strong>${session ? formatPercent(session.quota.percentUsed) : "\u2014"}</strong><span>quota used</span></div>
      <div class="metric"><strong>${session ? formatTokens(session.quota.remainingTokens) : "\u2014"}</strong><span>remaining</span></div>
      <div class="metric"><strong>${session ? formatTokens(session.currentThread?.totalTokens) : "\u2014"}</strong><span>context size</span></div>
      <div class="metric"><strong>${session ? `${session.currentEstimate.compressionScore ?? 0}%` : "\u2014"}</strong><span>save potential</span></div>
    </div>
  `;
}
async function render() {
  let snapshot;
  try {
    const activeUrl = await getActiveUrl();
    snapshot = await sendRuntimeMessage({ type: "get-snapshot", activeUrl });
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
    return;
  }
  if (!snapshot?.analytics || !snapshot?.summary) {
    renderError("Snapshot data was missing or incomplete.");
    return;
  }
  renderHero(snapshot);
  renderSparkline(
    trendChart,
    snapshot.analytics.byDay.map((day) => day.tokens),
    snapshot.analytics.byDay.map((day) => day.date)
  );
  renderBarList(
    modelBreakdown,
    snapshot.analytics.byModel.slice(0, 4).map((item) => ({ label: item.label, value: item.tokens, meta: `${formatTokens(item.tokens)} \u2022 ${item.prompts} prompts` }))
  );
  const currentSuggestions = snapshot.currentSession?.currentEstimate.suggestions ?? [];
  suggestions.innerHTML = currentSuggestions.length ? currentSuggestions.slice(0, 3).map(
    (item) => `
            <div class="suggestion-card">
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.description)} Save about ${formatTokens(item.estimatedSavings)} tokens.</p>
            </div>
          `
  ).join("") : '<div class="empty-chart">No optimization warnings right now.</div>';
  changeSummary.textContent = buildSessionSummary(snapshot.currentSession, snapshot);
  document.querySelector("#copy-summary-btn").onclick = async (event) => {
    const session = snapshot.currentSession;
    await runButtonAction(event.currentTarget, async () => {
      const summary = session ? `${SITE_LABELS[session.site]} \u2022 ${session.model}
Current prompt: ${formatTokens(session.currentEstimate.inputTokens)}
Thread total: ${formatTokens(session.currentThread?.totalTokens)}
Quota used: ${formatPercent(session.quota.percentUsed)}
Reset: ${session.quota.nextReset?.localLabel ?? "unknown"}` : "No active AI session yet.";
      await navigator.clipboard.writeText(summary);
    }, "Copied");
  };
  document.querySelector("#copy-shorter-btn").onclick = async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      const shorter = snapshot.currentSession?.currentEstimate.variants.shorter;
      await navigator.clipboard.writeText(shorter || snapshot.currentSession?.currentInput || "");
    }, "Copied");
  };
  document.querySelector("#dashboard-btn").onclick = async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    }, "Opened");
  };
  document.querySelector("#settings-btn").onclick = async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      await chrome.runtime.openOptionsPage();
    }, "Opened");
  };
  document.querySelector("#toggle-overlay-btn").onclick = async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      await sendToActiveTab({ type: "toggle-overlay" });
    }, "Toggled");
  };
  document.querySelector("#refresh-btn").onclick = async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      await sendToActiveTab({ type: "refresh-session" });
      await render();
    }, "Updated");
  };
}
renderLoading();
void render();
