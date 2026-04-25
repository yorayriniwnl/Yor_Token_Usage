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
function round(value, digits = 0) {
  const precision = 10 ** digits;
  return Math.round(value * precision) / precision;
}
function truncate(text, limit = 120) {
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}\u2026`;
}

// src/lib/format.ts
function formatTokens(tokens) {
  if (tokens === void 0 || Number.isNaN(tokens)) return "\u2014";
  if (tokens >= 1e6) return `${round(tokens / 1e6, 2)}M`;
  if (tokens >= 1e3) return `${round(tokens / 1e3, 1)}K`;
  return `${Math.round(tokens)}`;
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
function formatDateTime(timestamp) {
  if (!timestamp) return "Unknown";
  return new Intl.DateTimeFormat(void 0, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
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
function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

// src/lib/runtime.ts
async function sendRuntimeMessage(message) {
  return chrome.runtime.sendMessage(message);
}

// src/ui/charts.ts
function renderSparkline(container, values, labels = []) {
  const safeValues = values.map((value) => Math.max(0, safeNumber(value)));
  if (!safeValues.length) {
    container.innerHTML = '<div class="empty-chart">No usage data yet.</div>';
    return;
  }
  const width = 320;
  const height = 120;
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(1, max - min);
  const points = safeValues.map((value, index) => {
    const x = index / Math.max(1, safeValues.length - 1) * width;
    const y = height - (value - min) / range * (height - 14) - 7;
    return `${x},${y}`;
  });
  const last = safeValues.at(-1) ?? 0;
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
      ${safeValues.map((value, index) => {
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
  const max = Math.max(...items.map((item) => safeNumber(item.value)), 1);
  container.innerHTML = items.map(
    (item) => {
      const value = safeNumber(item.value);
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

// src/dashboard/index.ts
var metrics = document.querySelector("#metrics");
var dailyChart = document.querySelector("#daily-chart");
var weeklyChart = document.querySelector("#weekly-chart");
var siteBreakdown = document.querySelector("#site-breakdown");
var modelBreakdown = document.querySelector("#model-breakdown");
var recentThreads = document.querySelector("#recent-threads");
var timeline = document.querySelector("#timeline");
var anomalies = document.querySelector("#anomalies");
var changeCard = document.querySelector("#change-card");
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
  metrics.innerHTML = Array.from({ length: 10 }, () => '<article class="metric-card skeleton-metric"><span></span><strong></strong></article>').join("");
  dailyChart.innerHTML = '<div class="skeleton-chart"></div>';
  weeklyChart.innerHTML = '<div class="skeleton-chart short"></div>';
  siteBreakdown.innerHTML = '<div class="skeleton-chart short"></div>';
  modelBreakdown.innerHTML = '<div class="skeleton-chart short"></div>';
  recentThreads.innerHTML = '<div class="skeleton-chart short"></div>';
  timeline.innerHTML = '<div class="skeleton-chart"></div>';
  anomalies.innerHTML = '<div class="skeleton-chart short"></div>';
  changeCard.innerHTML = '<div class="skeleton-chart short"></div>';
}
function renderError(message) {
  metrics.innerHTML = '<article class="metric-card"><span>Status</span><strong>Offline</strong></article>';
  dailyChart.innerHTML = `<div class="empty-chart">${escapeHtml(message)}</div>`;
  weeklyChart.innerHTML = '<div class="empty-chart">No weekly data loaded.</div>';
  siteBreakdown.innerHTML = '<div class="empty-chart">No site data loaded.</div>';
  modelBreakdown.innerHTML = '<div class="empty-chart">No model data loaded.</div>';
  recentThreads.innerHTML = '<div class="empty-chart">No thread data loaded.</div>';
  timeline.innerHTML = '<div class="empty-chart">No timeline data loaded.</div>';
  anomalies.innerHTML = '<div class="empty-chart">No anomaly data loaded.</div>';
  changeCard.innerHTML = '<div class="empty-chart">Refresh the extension or reopen this dashboard.</div>';
}
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function renderMetrics(snapshot) {
  const peakDay = snapshot.analytics.peakDay;
  const recentThreadCount = Array.isArray(snapshot.recentThreads) ? snapshot.recentThreads.length : 0;
  metrics.innerHTML = [
    { label: "Today", value: formatTokens(snapshot.summary.tokensToday) },
    { label: "7-day tokens", value: formatTokens(snapshot.summary.tokensThisWeek) },
    { label: "7-day cost", value: formatCurrency(snapshot.summary.costThisWeek) },
    { label: "Burn rate / day", value: formatTokens(snapshot.analytics.burnRate) },
    { label: "Streak", value: `${snapshot.analytics.streakDays} days` },
    { label: "Average prompt", value: formatTokens(snapshot.analytics.averagePromptTokens) },
    { label: "Peak day", value: peakDay ? `${formatTokens(peakDay.tokens)} \u2022 ${peakDay.date}` : "\u2014" },
    { label: "Active sites", value: `${snapshot.summary.activeSites}` },
    { label: "Prompts today", value: `${snapshot.summary.promptsToday}` },
    { label: "Recent threads", value: `${recentThreadCount}` }
  ].map(
    (item) => `
        <article class="metric-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </article>
      `
  ).join("");
}
function renderChangeSummary(snapshot) {
  const [latest, previous] = Array.isArray(snapshot.analytics.timeline) ? snapshot.analytics.timeline : [];
  if (!latest) {
    changeCard.innerHTML = '<div class="empty-chart">No session history yet. Send a few prompts on a supported AI site to populate the dashboard.</div>';
    return;
  }
  const delta = previous ? latest.totalTokens - previous.totalTokens : latest.totalTokens;
  const direction = delta >= 0 ? "more" : "fewer";
  changeCard.innerHTML = `
    <div class="copy-card">
      <strong>${escapeHtml(`${SITE_LABELS[latest.site] ?? latest.site} \u2022 ${latest.model}`)}</strong>
      <p>The most recent exchange used ${formatTokens(latest.totalTokens)} tokens, which is ${formatTokens(Math.abs(delta))} ${direction} than the one before it.</p>
    </div>
    <div class="copy-card">
      <strong>Current risk</strong>
      <p>${escapeHtml(snapshot.currentSession?.quota.status === "warning" || snapshot.currentSession?.quota.status === "limited" ? `The active session is approaching its limit, with reset ${snapshot.currentSession.quota.nextReset?.localLabel ?? "unknown"}.` : "No immediate quota pressure detected on the active session.")}</p>
    </div>
    <div class="copy-card">
      <strong>Optimization signal</strong>
      <p>${escapeHtml(snapshot.currentSession?.currentEstimate.suggestions[0]?.description ?? "Prompts look healthy. Keep an eye on long pasted context and code blocks.")}</p>
    </div>
  `;
}
async function render() {
  let snapshot;
  try {
    snapshot = await sendRuntimeMessage({ type: "get-snapshot" });
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
    return;
  }
  if (!snapshot?.analytics || !snapshot?.summary) {
    renderError("Snapshot data was missing or incomplete.");
    return;
  }
  renderMetrics(snapshot);
  renderSparkline(
    dailyChart,
    (Array.isArray(snapshot.analytics.byDay) ? snapshot.analytics.byDay : []).map((day) => day.tokens),
    (Array.isArray(snapshot.analytics.byDay) ? snapshot.analytics.byDay : []).map((day) => day.date)
  );
  renderBarList(
    weeklyChart,
    (Array.isArray(snapshot.analytics.byWeek) ? snapshot.analytics.byWeek : []).map((week) => ({ label: week.date, value: week.tokens, meta: `${safeNumber(week.prompts)} prompts \u2022 ${formatCurrency(safeNumber(week.cost))}` }))
  );
  renderBarList(
    siteBreakdown,
    (Array.isArray(snapshot.analytics.bySite) ? snapshot.analytics.bySite : []).map((site) => ({ label: site.label, value: site.tokens, meta: `${safeNumber(site.prompts)} prompts \u2022 ${formatCurrency(safeNumber(site.cost))}` }))
  );
  renderBarList(
    modelBreakdown,
    (Array.isArray(snapshot.analytics.byModel) ? snapshot.analytics.byModel : []).map((model) => ({ label: model.label, value: model.tokens, meta: `${safeNumber(model.prompts)} prompts \u2022 ${formatCurrency(safeNumber(model.cost))}` }))
  );
  const recentThreadItems = Array.isArray(snapshot.recentThreads) ? snapshot.recentThreads : [];
  recentThreads.innerHTML = recentThreadItems.length ? recentThreadItems.map(
    (thread) => `
            <div class="copy-card">
              <strong>${escapeHtml(`${SITE_LABELS[thread.site] ?? thread.site} \u2022 ${thread.model}`)}</strong>
              <p>${formatTokens(thread.totalTokens)} tokens across ${thread.messageCount} messages. Updated ${formatClock(thread.lastUpdated)}.</p>
            </div>
          `
  ).join("") : '<div class="empty-chart">No tracked threads yet.</div>';
  const timelineItems = Array.isArray(snapshot.analytics.timeline) ? snapshot.analytics.timeline : [];
  timeline.innerHTML = timelineItems.length ? timelineItems.map(
    (event) => `
            <div class="timeline-item">
              <strong>${escapeHtml(`${SITE_LABELS[event.site] ?? event.site} \u2022 ${event.model}`)}</strong>
              <p>${escapeHtml(truncate(event.promptPreview, 180))}</p>
              <small>${escapeHtml(`${formatDateTime(event.timestamp)} \u2022 ${formatTokens(event.totalTokens)} tokens \u2022 ${event.status}`)}</small>
            </div>
          `
  ).join("") : '<div class="empty-chart">No timeline yet.</div>';
  const anomalyItems = Array.isArray(snapshot.analytics.anomalies) ? snapshot.analytics.anomalies : [];
  anomalies.innerHTML = anomalyItems.length ? anomalyItems.map(
    (event) => `
            <div class="copy-card">
              <strong>${escapeHtml(`${SITE_LABELS[event.site] ?? event.site} spike \u2022 ${formatTokens(event.totalTokens)}`)}</strong>
              <p>${escapeHtml(truncate(event.promptPreview, 180))}</p>
            </div>
          `
  ).join("") : '<div class="empty-chart">No anomalies detected.</div>';
  renderChangeSummary(snapshot);
  document.querySelector("#export-json-btn").onclick = async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      const payload = await sendRuntimeMessage({ type: "export-data" });
      download("yor-token-usage-export.json", JSON.stringify(payload, null, 2), "application/json");
    }, "Exported");
  };
  document.querySelector("#export-csv-btn").onclick = async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      const dayRows = Array.isArray(snapshot.analytics.byDay) ? snapshot.analytics.byDay : [];
      const rows = ["date,tokens,prompts,cost", ...dayRows.map((day) => `${day.date},${safeNumber(day.tokens)},${safeNumber(day.prompts)},${safeNumber(day.cost).toFixed(4)}`)];
      download("yor-token-usage-daily.csv", rows.join("\n"), "text/csv");
    }, "Exported");
  };
  document.querySelector("#settings-btn").onclick = async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      await chrome.runtime.openOptionsPage();
    }, "Opened");
  };
}
renderLoading();
void render();
