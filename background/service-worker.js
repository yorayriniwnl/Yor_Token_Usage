// src/lib/constants.ts
var STATE_KEY = "yor-token-usage-state";
var PREFERENCES_SYNC_KEY = "yor-token-usage-preferences";
var CLOUD_CONFIG_KEY = "yor-token-usage-cloud-config";
var CLOUD_SESSION_KEY = "yor-token-usage-cloud-session";
var APP_VERSION = 1;
var HISTORY_LIMIT = 2500;
var CLOUD_MAX_BATCHES_PER_SYNC = 5;
var CLOUD_EVENT_MAX_AGE_MS = 90 * 24 * 60 * 60_000;
var SITE_LABELS = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
  generic: "Other"
};
var MODEL_CATALOG = {
  generic: {
    id: "generic",
    label: "Generic model",
    contextWindow: 128e3
  },
  /* NOTE: gpt-5.5, gpt-5.4*, claude-opus-4.7, claude-sonnet-4.6 are forward-looking placeholders with unverified pricing. */
  "gpt-5.5": {
    id: "gpt-5.5",
    label: "GPT-5.5 (Unverified)",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 5e-3,
    estimatedOutputCostPer1k: 0.03,
    quotaTier: "Premium"
  },
  "gpt-5.4": {
    id: "gpt-5.4",
    label: "GPT-5.4",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 25e-4,
    estimatedOutputCostPer1k: 0.015,
    quotaTier: "Premium"
  },
  "gpt-5.4-mini": {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    contextWindow: 128e3,
    estimatedInputCostPer1k: 75e-5,
    estimatedOutputCostPer1k: 45e-4,
    quotaTier: "Mini"
  },
  "gpt-5.4-nano": {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    contextWindow: 128e3,
    estimatedInputCostPer1k: 2e-4,
    estimatedOutputCostPer1k: 125e-5,
    quotaTier: "Nano"
  },
  "gpt-4o": {
    id: "gpt-4o",
    label: "GPT-4o",
    contextWindow: 128e3,
    estimatedInputCostPer1k: 25e-4,
    estimatedOutputCostPer1k: 0.01,
    quotaTier: "Premium"
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    contextWindow: 128e3,
    estimatedInputCostPer1k: 15e-5,
    estimatedOutputCostPer1k: 6e-4,
    quotaTier: "Mini"
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    label: "GPT-4.1",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 2e-3,
    estimatedOutputCostPer1k: 8e-3,
    quotaTier: "Premium"
  },
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 4e-4,
    estimatedOutputCostPer1k: 16e-4,
    quotaTier: "Mini"
  },
  "gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    label: "GPT-4.1 nano",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 1e-4,
    estimatedOutputCostPer1k: 4e-4,
    quotaTier: "Nano"
  },
  o3: {
    id: "o3",
    label: "OpenAI o3",
    contextWindow: 2e5,
    estimatedInputCostPer1k: 2e-3,
    estimatedOutputCostPer1k: 8e-3,
    quotaTier: "Reasoning"
  },
  "o3-mini": {
    id: "o3-mini",
    label: "OpenAI o3 mini",
    contextWindow: 2e5,
    estimatedInputCostPer1k: 11e-4,
    estimatedOutputCostPer1k: 44e-4,
    quotaTier: "Reasoning mini"
  },
  "o4-mini": {
    id: "o4-mini",
    label: "OpenAI o4 mini",
    contextWindow: 2e5,
    estimatedInputCostPer1k: 11e-4,
    estimatedOutputCostPer1k: 44e-4,
    quotaTier: "Reasoning mini"
  },
  "claude-opus-4.7": {
    id: "claude-opus-4.7",
    label: "Claude Opus 4.7 (Unverified)",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 5e-3,
    estimatedOutputCostPer1k: 0.025,
    quotaTier: "Opus"
  },
  "claude-opus-4.1": {
    id: "claude-opus-4.1",
    label: "Claude Opus 4.1",
    contextWindow: 2e5,
    estimatedInputCostPer1k: 0.015,
    estimatedOutputCostPer1k: 0.075,
    quotaTier: "Opus"
  },
  "claude-opus-3": {
    id: "claude-opus-3",
    label: "Claude Opus 3",
    contextWindow: 2e5,
    estimatedInputCostPer1k: 0.015,
    estimatedOutputCostPer1k: 0.075,
    quotaTier: "Opus"
  },
  "claude-sonnet": {
    id: "claude-sonnet",
    label: "Claude Sonnet 4",
    contextWindow: 2e5,
    estimatedInputCostPer1k: 3e-3,
    estimatedOutputCostPer1k: 0.015,
    quotaTier: "Pro"
  },
  "claude-sonnet-4.6": {
    id: "claude-sonnet-4.6",
    label: "Claude Sonnet 4.6 (Unverified)",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 3e-3,
    estimatedOutputCostPer1k: 0.015,
    quotaTier: "Pro"
  },
  "claude-haiku-4.5": {
    id: "claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    contextWindow: 2e5,
    estimatedInputCostPer1k: 1e-3,
    estimatedOutputCostPer1k: 5e-3,
    quotaTier: "Haiku"
  },
  "claude-haiku-3.5": {
    id: "claude-haiku-3.5",
    label: "Claude Haiku 3.5",
    contextWindow: 2e5,
    estimatedInputCostPer1k: 8e-4,
    estimatedOutputCostPer1k: 4e-3,
    quotaTier: "Haiku"
  },
  "gemini-pro": {
    id: "gemini-pro",
    label: "Gemini 2.5 Pro",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 125e-5,
    estimatedOutputCostPer1k: 0.01,
    quotaTier: "Advanced"
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 3e-4,
    estimatedOutputCostPer1k: 25e-4,
    quotaTier: "Flash"
  },
  "gemini-2.5-flash-lite": {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 1e-4,
    estimatedOutputCostPer1k: 4e-4,
    quotaTier: "Flash-Lite"
  },
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 1e-4,
    estimatedOutputCostPer1k: 4e-4,
    quotaTier: "Flash"
  },
  "gemini-2.0-flash-lite": {
    id: "gemini-2.0-flash-lite",
    label: "Gemini 2.0 Flash-Lite",
    contextWindow: 1e6,
    estimatedInputCostPer1k: 75e-6,
    estimatedOutputCostPer1k: 3e-4,
    quotaTier: "Flash-Lite"
  },
  "sonar-pro": {
    id: "sonar-pro",
    label: "Sonar Pro",
    contextWindow: 2e5,
    estimatedInputCostPer1k: 3e-3,
    estimatedOutputCostPer1k: 0.015,
    quotaTier: "Pro"
  },
  "grok-3": {
    id: "grok-3",
    label: "Grok 3",
    contextWindow: 128e3,
    estimatedInputCostPer1k: 3e-3,
    estimatedOutputCostPer1k: 0.015,
    quotaTier: "Premium+"
  },
  "grok-3-mini": {
    id: "grok-3-mini",
    label: "Grok 3 mini",
    contextWindow: 131072,
    estimatedInputCostPer1k: 3e-4,
    estimatedOutputCostPer1k: 5e-4,
    quotaTier: "Mini"
  }
};
function normalizeModelKey(value) {
  return String(value ?? "").toLowerCase().replace(/\bmodel\b/g, "").replace(/\bnew\b/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var MODEL_LOOKUP = Object.fromEntries(Object.keys(MODEL_CATALOG).map((id) => [normalizeModelKey(id), id]));
var MODEL_MATCHERS = [
  [/^gpt-5-5/, "gpt-5.5"],
  [/^gpt-5-4-mini/, "gpt-5.4-mini"],
  [/^gpt-5-4-nano/, "gpt-5.4-nano"],
  [/^gpt-5-4/, "gpt-5.4"],
  [/^gpt-4o-mini|^gpt-4-o-mini/, "gpt-4o-mini"],
  [/^gpt-4o|^gpt-4-o/, "gpt-4o"],
  [/^gpt-4-1-mini/, "gpt-4.1-mini"],
  [/^gpt-4-1-nano/, "gpt-4.1-nano"],
  [/^gpt-4-1/, "gpt-4.1"],
  [/^o4-mini/, "o4-mini"],
  [/^o3-mini/, "o3-mini"],
  [/^o3/, "o3"],
  [/claude.*opus.*4-(7|6|5)|opus.*4-(7|6|5)/, "claude-opus-4.7"],
  [/claude.*opus.*4-1|opus.*4-1|claude.*opus.*4|opus.*4/, "claude-opus-4.1"],
  [/claude.*opus.*3|opus.*3/, "claude-opus-3"],
  [/claude.*sonnet.*4-6|sonnet.*4-6/, "claude-sonnet-4.6"],
  [/claude.*sonnet|sonnet/, "claude-sonnet"],
  [/claude.*haiku.*4-5|haiku.*4-5/, "claude-haiku-4.5"],
  [/claude.*haiku.*3-5|haiku.*3-5/, "claude-haiku-3.5"],
  [/claude.*haiku|haiku/, "claude-haiku-4.5"],
  [/gemini.*2-5.*flash-lite|gemini-2-5-flash-lite/, "gemini-2.5-flash-lite"],
  [/gemini.*2-5.*flash|gemini-2-5-flash/, "gemini-2.5-flash"],
  [/gemini.*2-0.*flash-lite|gemini-2-0-flash-lite/, "gemini-2.0-flash-lite"],
  [/gemini.*2-0.*flash|gemini-2-0-flash/, "gemini-2.0-flash"],
  [/gemini.*pro|gemini-pro/, "gemini-pro"],
  [/gemini.*flash-lite|flash-lite/, "gemini-2.5-flash-lite"],
  [/gemini.*flash|flash/, "gemini-2.5-flash"],
  [/sonar.*pro|perplexity.*pro/, "sonar-pro"],
  [/grok.*3.*mini|grok-3-mini/, "grok-3-mini"],
  [/grok.*3|grok-3/, "grok-3"]
];
var SITE_MODEL_FALLBACKS = {
  chatgpt: "gpt-4o",
  claude: "claude-sonnet",
  gemini: "gemini-2.5-flash",
  perplexity: "sonar-pro",
  grok: "grok-3",
  generic: "generic"
};
function findKnownModelProfile(model) {
  const key = normalizeModelKey(model);
  const exactId = MODEL_LOOKUP[key];
  if (exactId) return MODEL_CATALOG[exactId];
  for (const [pattern, id] of MODEL_MATCHERS) {
    if (pattern.test(key)) return MODEL_CATALOG[id];
  }
  return void 0;
}
function resolveModelProfile(model, site = "generic") {
  const knownProfile = findKnownModelProfile(model);
  if (knownProfile) return knownProfile;
  return MODEL_CATALOG[SITE_MODEL_FALLBACKS[site] ?? "generic"] ?? MODEL_CATALOG.generic;
}
function modelLabelForDisplay(model) {
  return findKnownModelProfile(model)?.label ?? model;
}
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
function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}
function average(values) {
  return values.length ? sum(values) / values.length : 0;
}
function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}
function round(value, digits = 0) {
  const precision = 10 ** digits;
  return Math.round(value * precision) / precision;
}
function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}
function toDateKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function startOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function previousLocalDayStart(timestamp) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() - 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function startOfLocalWeek(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDay();
  const delta = (day + 6) % 7;
  date.setDate(date.getDate() - delta);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
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

// src/analytics/usageAnalytics.ts
function eventCost(event, preferences) {
  const siteSettings = preferences.sites[event.site] ?? DEFAULT_PREFERENCES.sites.generic;
  const modelProfile = resolveModelProfile(event.model, event.site);
  const inputRate = nonNegativeNumberOr(siteSettings.costInputPer1k, modelProfile.estimatedInputCostPer1k ?? 0);
  const outputRate = nonNegativeNumberOr(siteSettings.costOutputPer1k, modelProfile.estimatedOutputCostPer1k ?? 0);
  return event.promptTokens / 1e3 * inputRate + event.outputTokens / 1e3 * outputRate;
}
function fillWindow(start, count, stepMs, values) {
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(start);
    if (stepMs === 864e5) {
      d.setDate(d.getDate() + index);
    } else if (stepMs === 7 * 864e5) {
      d.setDate(d.getDate() + index * 7);
    } else {
      d.setTime(start + index * stepMs);
    }
    const key = toDateKey(d.getTime());
    return values.get(key) ?? { date: key, tokens: 0, prompts: 0, cost: 0 };
  });
}
function aggregateBy(events, keyFn, preferences, labelFn) {
  const groups = groupBy(events, keyFn);
  return Object.entries(groups).map(([key, group]) => {
    const entries = group;
    return {
      id: key,
      label: labelFn(key),
      tokens: entries.reduce((acc, event) => acc + event.totalTokens, 0),
      prompts: entries.length,
      cost: entries.reduce((acc, event) => acc + eventCost(event, preferences), 0)
    };
  }).sort((a, b) => b.tokens - a.tokens);
}
function calculateStreak(events, now = Date.now()) {
  if (!events.length) return 0;
  const usedDays = new Set(events.map((event) => startOfLocalDay(event.timestamp)));
  let streak = 0;
  const today = startOfLocalDay(now);
  let cursor = usedDays.has(today) ? today : previousLocalDayStart(today);
  while (usedDays.has(cursor)) {
    streak += 1;
    cursor = previousLocalDayStart(cursor);
  }
  return streak;
}
function robustTokenBaseline(values) {
  return median(values.filter((value) => value > 0));
}
function detectTokenAnomalies(events, preferences) {
  const normalTotals = [];
  const anomalies = [];
  const largePromptThreshold = Math.max(0, preferences.alerts.largePromptTokens);
  const anomalyMultiplier = Math.max(1, preferences.alerts.anomalyMultiplier);
  for (const event of events) {
    const baseline = robustTokenBaseline(normalTotals);
    const threshold = Math.max(largePromptThreshold, baseline > 0 ? baseline * anomalyMultiplier : 0);
    if (event.totalTokens >= threshold) {
      anomalies.push(event);
      continue;
    }
    normalTotals.push(event.totalTokens);
  }
  return anomalies.slice(-25).reverse();
}
function buildAnalytics(events, preferences, now = Date.now()) {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const dDay = new Date(now);
  dDay.setDate(dDay.getDate() - 13);
  const fourteenDaysAgo = startOfLocalDay(dDay.getTime());
  const dWeek = new Date(now);
  dWeek.setDate(dWeek.getDate() - 7 * 7);
  const eightWeeksAgo = startOfLocalWeek(dWeek.getTime());
  const dayMap = /* @__PURE__ */ new Map();
  const weekMap = /* @__PURE__ */ new Map();
  for (const event of sorted) {
    const dayKey = toDateKey(event.timestamp);
    const dayMetric = dayMap.get(dayKey) ?? { date: dayKey, tokens: 0, prompts: 0, cost: 0 };
    dayMetric.tokens += event.totalTokens;
    dayMetric.prompts += 1;
    dayMetric.cost += eventCost(event, preferences);
    dayMap.set(dayKey, dayMetric);
    const weekStart = startOfLocalWeek(event.timestamp);
    const weekKey = toDateKey(weekStart);
    const weekMetric = weekMap.get(weekKey) ?? { date: weekKey, tokens: 0, prompts: 0, cost: 0 };
    weekMetric.tokens += event.totalTokens;
    weekMetric.prompts += 1;
    weekMetric.cost += eventCost(event, preferences);
    weekMap.set(weekKey, weekMetric);
  }
  const byDay = fillWindow(fourteenDaysAgo, 14, 864e5, dayMap);
  const byWeek = fillWindow(eightWeeksAgo, 8, 7 * 864e5, weekMap);
  const byModel = aggregateBy(sorted, (event) => event.model, preferences, modelLabelForDisplay);
  const bySite = aggregateBy(sorted, (event) => event.site, preferences, (key) => SITE_LABELS[key] ?? key);
  const peakDay = byDay.some((day) => day.prompts > 0 || day.tokens > 0)
    ? [...byDay].sort((a, b) => b.tokens - a.tokens)[0]
    : void 0;
  const averagePromptTokens = average(sorted.map((event) => event.promptTokens));
  const activeDays = byDay.slice(-7).filter((day) => day.prompts > 0 || day.tokens > 0);
  const burnRate = average(activeDays.map((day) => day.tokens));
  const anomalies = detectTokenAnomalies(sorted, preferences);
  return {
    byDay,
    byWeek,
    byModel,
    bySite,
    burnRate,
    averagePromptTokens,
    peakDay,
    streakDays: calculateStreak(sorted, now),
    anomalies,
    timeline: sorted.slice(-60).reverse()
  };
}
var snapshotAnalyticsCache;
function analyticsEventKey(event) {
  if (!event) return "";
  return [
    usageEventIdentity(event),
    event.timestamp,
    event.promptTokens,
    event.outputTokens,
    event.totalTokens,
    event.status ?? "",
    event.resetAt ?? ""
  ].join(":");
}
function analyticsPreferencesKey(preferences) {
  const alertKey = [
    preferences.alerts.largePromptTokens,
    preferences.alerts.anomalyMultiplier
  ].join(":");
  const siteCostKey = Object.keys(DEFAULT_PREFERENCES.sites).sort().map((site) => {
    const settings = preferences.sites?.[site] ?? {};
    const inputCost = Number.isFinite(settings.costInputPer1k) ? settings.costInputPer1k : "";
    const outputCost = Number.isFinite(settings.costOutputPer1k) ? settings.costOutputPer1k : "";
    return `${site}:${inputCost}:${outputCost}`;
  }).join("|");
  return `${alertKey}|${siteCostKey}`;
}
function analyticsCacheKey(state, now) {
  const events = state.usageEvents;
  return [
    toDateKey(now),
    events.length,
    analyticsEventKey(events[0]),
    analyticsEventKey(events[events.length - 1]),
    analyticsPreferencesKey(state.preferences)
  ].join("||");
}
function getSnapshotAnalytics(state, now) {
  const key = analyticsCacheKey(state, now);
  if (snapshotAnalyticsCache?.key === key) {
    return snapshotAnalyticsCache.analytics;
  }
  const analytics = buildAnalytics(state.usageEvents, state.preferences, now);
  snapshotAnalyticsCache = { key, analytics };
  return analytics;
}
function invalidateSnapshotAnalytics() {
  snapshotAnalyticsCache = void 0;
}

// src/storage/store.ts
var memoryStorage = /* @__PURE__ */ new Map();
var memorySessionStorage = /* @__PURE__ */ new Map();
var stateQueue = Promise.resolve();
function logStateOperationError(error) {
  console.error("Yor Token Usage state operation failed", error);
}
function enqueueStateOperation(operation) {
  const queuedOperation = stateQueue.then(operation);
  stateQueue = queuedOperation.then(() => void 0, (error) => {
    logStateOperationError(error);
  });
  return queuedOperation;
}
function localArea() {
  return typeof chrome !== "undefined" ? chrome.storage?.local : void 0;
}
function syncArea() {
  return typeof chrome !== "undefined" ? chrome.storage?.sync : void 0;
}
function sessionArea() {
  return typeof chrome !== "undefined" ? chrome.storage?.session : void 0;
}
async function storageGet(key) {
  const area = localArea();
  if (area) {
    const result = await area.get(key);
    return result[key];
  }
  return memoryStorage.get(key);
}
async function storageSet(value) {
  const area = localArea();
  if (area) {
    await area.set(value);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    memoryStorage.set(key, entry);
  }
}
async function sessionStorageGet(key) {
  const area = sessionArea();
  if (area) {
    const result = await area.get(key);
    return result[key];
  }
  return memorySessionStorage.get(key);
}
async function sessionStorageSet(value) {
  const area = sessionArea();
  if (area) {
    await area.set(value);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    memorySessionStorage.set(key, entry);
  }
}
async function sessionStorageRemove(key) {
  const area = sessionArea();
  if (area) {
    await area.remove(key);
    return;
  }
  memorySessionStorage.delete(key);
}
function defaultPromptAnalysis() {
  return {
    inputTokens: 0,
    outputTokensEstimate: 0,
    totalTokens: 0,
    sections: [],
    suggestions: [],
    variants: {
      shorter: "",
      balanced: "",
      maxDetail: ""
    },
    repeatedInstructions: [],
    redundantSections: [],
    largePaste: false,
    compressionScore: 0,
    measurement: defaultMeasurement()
  };
}
function defaultQuotaStatus() {
  return {
    usedTokens: 0,
    status: "unknown",
    accuracy: "inferred"
  };
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isKnownSite(site) {
  return typeof site === "string" && Object.prototype.hasOwnProperty.call(DEFAULT_PREFERENCES.sites, site);
}
function normalizeSite(site) {
  return isKnownSite(site) ? site : "generic";
}
function finiteNumberOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}
function nonNegativeNumberOr(value, fallback = 0) {
  return Math.max(0, finiteNumberOr(value, fallback));
}
function boundedNonNegativeNumberOr(value, max, fallback = 0) {
  return Math.min(max, nonNegativeNumberOr(value, fallback));
}
function boundedString(value, maxLength, fallback = "") {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}
function boundedNonEmptyString(value, maxLength, fallback = "") {
  const normalized = boundedString(value, maxLength);
  return normalized || fallback;
}
function defaultMeasurement(provider = "generic", model = "unknown") {
  return {
    schemaVersion: 1,
    measurementMethod: "unknown",
    measurementLevel: "unknown",
    confidence: 0,
    errorMarginPercent: 100,
    provider: boundedString(provider, 64, "generic"),
    model: boundedString(model, 120, "unknown"),
    tokenizer: "none",
    source: "Legacy event without measurement metadata",
    note: "Token provenance was not recorded; treat this value as unknown."
  };
}
function normalizeMeasurement(value, fallback = {}) {
  const base = defaultMeasurement(fallback.provider, fallback.model);
  const raw = isPlainObject(value) ? value : {};
  const levels = ["authoritative", "deterministic", "calibrated_estimate", "approximation", "unknown"];
  const rawLevel = typeof raw.measurementLevel === "string" ? raw.measurementLevel.toLowerCase() : "";
  const unverifiedAuthoritativeClaim = rawLevel === "authoritative";
  return {
    ...base,
    schemaVersion: clamp(Math.floor(finiteNumberOr(raw.schemaVersion, base.schemaVersion)), 1, 100),
    measurementMethod: boundedNonEmptyString(raw.measurementMethod, 80, fallback.measurementMethod ?? base.measurementMethod),
    measurementLevel: unverifiedAuthoritativeClaim ? "unknown" : levels.includes(rawLevel) ? rawLevel : fallback.measurementLevel ?? base.measurementLevel,
    confidence: unverifiedAuthoritativeClaim ? 0 : clamp(finiteNumberOr(raw.confidence, fallback.confidence ?? base.confidence), 0, 1),
    errorMarginPercent: unverifiedAuthoritativeClaim ? 100 : clamp(nonNegativeNumberOr(raw.errorMarginPercent, fallback.errorMarginPercent ?? base.errorMarginPercent), 0, 1000),
    provider: boundedNonEmptyString(raw.provider, 64, fallback.provider ?? base.provider),
    model: boundedNonEmptyString(raw.model, 120, fallback.model ?? base.model),
    tokenizer: boundedNonEmptyString(raw.tokenizer, 80, base.tokenizer),
    source: boundedNonEmptyString(raw.source, 160, fallback.source ?? base.source),
    note: unverifiedAuthoritativeClaim ? "Provider-authoritative metadata was downgraded until a verified adapter is connected." : boundedNonEmptyString(raw.note, 240, base.note)
  };
}
function normalizePromptSections(value) {
  const sectionTypes = ["prose", "instruction", "quote", "code", "url", "attachment"];
  return Array.isArray(value) ? value.slice(0, 50).filter(isPlainObject).map((section) => ({
    label: boundedNonEmptyString(section.label, 160, "section"),
    type: sectionTypes.includes(section.type) ? section.type : "prose",
    tokens: boundedNonNegativeNumberOr(section.tokens, 4_000_000)
  })) : [];
}
function normalizePromptSuggestions(value) {
  const severities = ["low", "medium", "high"];
  const variants = ["shorter", "balanced", "maxDetail"];
  return Array.isArray(value) ? value.slice(0, 6).filter(isPlainObject).map((suggestion, index) => ({
    id: boundedNonEmptyString(suggestion.id, 64, `suggestion-${index + 1}`),
    title: boundedNonEmptyString(suggestion.title, 160, "Suggestion"),
    description: boundedString(suggestion.description, 240),
    estimatedSavings: boundedNonNegativeNumberOr(suggestion.estimatedSavings, 4_000_000),
    severity: severities.includes(suggestion.severity) ? suggestion.severity : "low",
    applyVariant: variants.includes(suggestion.applyVariant) ? suggestion.applyVariant : "balanced"
  })) : [];
}
function normalizePromptTextList(value, maxItems = 6, maxLength = 2_000) {
  return Array.isArray(value) ? value.slice(0, maxItems).filter((item) => typeof item === "string").map((item) => boundedString(item, maxLength)).filter(Boolean) : [];
}
function normalizePromptVariants(value) {
  const variants = isPlainObject(value) ? value : {};
  return {
    shorter: boundedString(variants.shorter, 250_000),
    balanced: boundedString(variants.balanced, 250_000),
    maxDetail: boundedString(variants.maxDetail, 250_000)
  };
}
function boundedFutureTimestamp(value, maxFutureDays = 366) {
  if (!Number.isFinite(value) || value <= 0) return void 0;
  return Math.min(value, Date.now() + maxFutureDays * 864e5);
}
function normalizeSessionResetRule(value) {
  const raw = isPlainObject(value) ? value : {};
  const resetKinds = ["rolling", "hourly", "daily", "weekly", "custom", "unknown"];
  const intervalMinutes = optionalNumberInRange(raw.intervalMinutes, 1, 525600);
  const dayOfWeek = optionalNumberInRange(raw.dayOfWeek, 0, 6);
  const anchorLocalTime = typeof raw.anchorLocalTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.anchorLocalTime) ? raw.anchorLocalTime : void 0;
  return {
    kind: resetKinds.includes(raw.kind) ? raw.kind : "unknown",
    ...(intervalMinutes !== void 0 ? { intervalMinutes } : {}),
    ...(anchorLocalTime ? { anchorLocalTime } : {}),
    ...(dayOfWeek !== void 0 ? { dayOfWeek } : {}),
    inferred: raw.inferred === true,
    description: boundedString(raw.description, 240)
  };
}
function normalizeResetPrediction(value) {
  if (!isPlainObject(value)) return void 0;
  const kinds = ["rolling", "hourly", "daily", "weekly", "custom", "unknown"];
  const confidences = ["exact", "estimated", "inferred"];
  const resetAt = boundedFutureTimestamp(value.resetAt);
  const windowStart = boundedFutureTimestamp(value.windowStart);
  const windowEnd = boundedFutureTimestamp(value.windowEnd);
  const remainingMs = Number.isFinite(value.remainingMs) ? clamp(value.remainingMs, 0, 366 * 864e5) : void 0;
  return {
    ...(resetAt !== void 0 ? { resetAt } : {}),
    ...(windowStart !== void 0 ? { windowStart } : {}),
    ...(windowEnd !== void 0 ? { windowEnd } : {}),
    ...(remainingMs !== void 0 ? { remainingMs } : {}),
    localLabel: boundedString(value.localLabel, 160, "Unknown"),
    kind: kinds.includes(value.kind) ? value.kind : "unknown",
    confidence: confidences.includes(value.confidence) ? value.confidence : "inferred",
    explanation: boundedString(value.explanation, 240)
  };
}
function normalizeSessionQuota(value) {
  const quota = isPlainObject(value) ? value : {};
  const statuses = ["unknown", "ok", "warning", "limited"];
  const accuracies = ["exact", "estimated", "inferred"];
  const nextReset = normalizeResetPrediction(quota.nextReset);
  const explicitResetAt = boundedFutureTimestamp(quota.explicitResetAt);
  return {
    usedTokens: boundedNonNegativeNumberOr(quota.usedTokens, 4_000_000_000),
    remainingTokens: Number.isFinite(quota.remainingTokens) ? Math.min(4_000_000_000, Math.max(0, quota.remainingTokens)) : void 0,
    percentUsed: Number.isFinite(quota.percentUsed) ? clamp(quota.percentUsed, 0, 100) : void 0,
    status: statuses.includes(quota.status) ? quota.status : "unknown",
    accuracy: accuracies.includes(quota.accuracy) ? quota.accuracy : "inferred",
    ...(typeof quota.quotaTier === "string" ? { quotaTier: boundedString(quota.quotaTier, 80) } : {}),
    ...(isPlainObject(quota.resetRule) ? { resetRule: normalizeSessionResetRule(quota.resetRule) } : {}),
    ...(explicitResetAt !== void 0 ? { explicitResetAt } : {}),
    ...(nextReset ? { nextReset } : {})
  };
}
function timestampOr(value, fallback = Date.now()) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, Date.now() + 5 * 60_000);
}
function createEmptySessions() {
  return {
    chatgpt: void 0,
    claude: void 0,
    gemini: void 0,
    perplexity: void 0,
    grok: void 0,
    generic: void 0
  };
}
function mergeSiteSettings(site, partialSite) {
  const defaults = DEFAULT_PREFERENCES.sites[site];
  const partial = isPlainObject(partialSite) ? partialSite : {};
  const partialResetRule = isPlainObject(partial.resetRule) ? partial.resetRule : {};
  const resetKinds = ["rolling", "hourly", "daily", "weekly", "custom", "unknown"];
  const resetKind = resetKinds.includes(partialResetRule.kind) ? partialResetRule.kind : defaults.resetRule.kind;
  const intervalMinutes = optionalNumberInRange(partialResetRule.intervalMinutes, 1, 525600);
  const dayOfWeek = optionalNumberInRange(partialResetRule.dayOfWeek, 0, 6);
  const anchorLocalTime = typeof partialResetRule.anchorLocalTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(partialResetRule.anchorLocalTime) ? partialResetRule.anchorLocalTime : defaults.resetRule.anchorLocalTime;
  return {
    ...defaults,
    enabled: typeof partial.enabled === "boolean" ? partial.enabled : defaults.enabled,
    tokenBudget: optionalNumberInRange(partial.tokenBudget, 0, 4_000_000_000),
    contextWindow: optionalNumberInRange(partial.contextWindow, 1, 10_000_000),
    quotaTierLabel: typeof partial.quotaTierLabel === "string" ? partial.quotaTierLabel.slice(0, 80) : defaults.quotaTierLabel,
    costInputPer1k: optionalNumberInRange(partial.costInputPer1k, 0, 1000),
    costOutputPer1k: optionalNumberInRange(partial.costOutputPer1k, 0, 1000),
    resetRule: {
      ...defaults.resetRule,
      kind: resetKind,
      ...(intervalMinutes !== void 0 ? { intervalMinutes } : {}),
      ...(anchorLocalTime ? { anchorLocalTime } : {}),
      ...(dayOfWeek !== void 0 ? { dayOfWeek } : {}),
      inferred: partialResetRule.inferred !== false,
      description: typeof partialResetRule.description === "string" ? partialResetRule.description.slice(0, 240) : defaults.resetRule.description
    }
  };
}
function optionalNumberInRange(value, min, max) {
  return Number.isFinite(value) ? clamp(value, min, max) : void 0;
}
function mergePreferences(partial) {
  const partialPreferences = isPlainObject(partial) ? partial : {};
  const partialAlerts = isPlainObject(partialPreferences.alerts) ? partialPreferences.alerts : {};
  const sites = Object.keys(DEFAULT_PREFERENCES.sites).reduce((acc, site) => {
    acc[site] = mergeSiteSettings(site, partialPreferences.sites?.[site]);
    return acc;
  }, {});
  return {
    theme: ["system", "dark", "light"].includes(partialPreferences.theme) ? partialPreferences.theme : DEFAULT_PREFERENCES.theme,
    compactMode: partialPreferences.compactMode === true,
    showOverlay: partialPreferences.showOverlay !== false,
    privacyMode: ["local-only", "sync-preferences"].includes(partialPreferences.privacyMode) ? partialPreferences.privacyMode : DEFAULT_PREFERENCES.privacyMode,
    alerts: {
      ...DEFAULT_PREFERENCES.alerts,
      quotaWarningPercent: clamp(finiteNumberOr(partialAlerts.quotaWarningPercent, DEFAULT_PREFERENCES.alerts.quotaWarningPercent), 1, 100),
      largePromptTokens: clamp(finiteNumberOr(partialAlerts.largePromptTokens, DEFAULT_PREFERENCES.alerts.largePromptTokens), 100, 2_000_000),
      anomalyMultiplier: clamp(finiteNumberOr(partialAlerts.anomalyMultiplier, DEFAULT_PREFERENCES.alerts.anomalyMultiplier), 1, 10),
      desktopNotifications: partialAlerts.desktopNotifications !== false,
      badgeMode: ["percent", "remaining", "off"].includes(partialAlerts.badgeMode) ? partialAlerts.badgeMode : DEFAULT_PREFERENCES.alerts.badgeMode
    },
    sites
  };
}
function normalizeNotificationTimestamps(raw) {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([, timestamp]) => Number.isFinite(timestamp)));
}
function buildUsageEventKeyMap(events) {
  const keys = {};
  for (const event of events) {
    keys[usageEventIdentity(event)] = true;
  }
  return keys;
}
function normalizeUsageEventKeys(raw, usageEvents) {
  return buildUsageEventKeyMap(usageEvents);
}
function hasUsageEventKey(keys, key) {
  return Object.prototype.hasOwnProperty.call(keys, key);
}
function normalizeSession(session) {
  if (!isPlainObject(session)) return void 0;
  const site = normalizeSite(session.site);
  const model = boundedString(session.model, 120, "generic");
  const currentEstimate = isPlainObject(session.currentEstimate) ? session.currentEstimate : defaultPromptAnalysis();
  const currentThread = isPlainObject(session.currentThread) ? session.currentThread : void 0;
  const quota = isPlainObject(session.quota) ? session.quota : defaultQuotaStatus();
  return {
    site,
    model,
    threadId: boundedString(session.threadId, 256, "default"),
    currentInput: boundedString(session.currentInput, 250_000),
    currentEstimate: {
      inputTokens: boundedNonNegativeNumberOr(currentEstimate.inputTokens, 2_000_000),
      outputTokensEstimate: boundedNonNegativeNumberOr(currentEstimate.outputTokensEstimate, 2_000_000),
      totalTokens: boundedNonNegativeNumberOr(currentEstimate.totalTokens, 4_000_000),
      sections: normalizePromptSections(currentEstimate.sections),
      suggestions: normalizePromptSuggestions(currentEstimate.suggestions),
      variants: normalizePromptVariants(currentEstimate.variants),
      repeatedInstructions: normalizePromptTextList(currentEstimate.repeatedInstructions),
      redundantSections: normalizePromptTextList(currentEstimate.redundantSections, 5),
      largePaste: currentEstimate.largePaste === true,
      compressionScore: clamp(nonNegativeNumberOr(currentEstimate.compressionScore), 0, 100),
      measurement: normalizeMeasurement(currentEstimate.measurement, { provider: site, model })
    },
    currentThread: currentThread ? {
      threadId: boundedString(currentThread.threadId, 256, boundedString(session.threadId, 256, "default")),
      site,
      model: boundedString(currentThread.model, 120, boundedString(session.model, 120, "generic")),
      messageCount: boundedNonNegativeNumberOr(currentThread.messageCount, 10_000),
      promptTokens: boundedNonNegativeNumberOr(currentThread.promptTokens, 8_000_000),
      outputTokens: boundedNonNegativeNumberOr(currentThread.outputTokens, 8_000_000),
      totalTokens: boundedNonNegativeNumberOr(currentThread.totalTokens, 16_000_000),
      lastUpdated: timestampOr(currentThread.lastUpdated),
      contextGrowth: Array.isArray(currentThread.contextGrowth) ? currentThread.contextGrowth.slice(-25).filter(Number.isFinite).map((value) => boundedNonNegativeNumberOr(value, 16_000_000)) : []
    } : void 0,
    quota: normalizeSessionQuota(quota),
    lastUpdated: timestampOr(session.lastUpdated),
    lastSeenUrl: boundedString(session.lastSeenUrl, 2_048),
    adapterConfidence: clamp(finiteNumberOr(session.adapterConfidence, 0), 0, 1)
  };
}
function normalizeSessions(rawSessions) {
  const sessions = createEmptySessions();
  for (const site of Object.keys(sessions)) {
    sessions[site] = normalizeSession(rawSessions?.[site]);
  }
  return sessions;
}
function usageEventIdentity(event) {
  return event?.id ? `id:${event.id}` : `legacy:${event?.site ?? "unknown"}:${event?.threadId ?? "default"}:${event?.timestamp ?? 0}:${event?.promptPreview ?? ""}`;
}
function normalizeUsageEvent(event) {
  if (!isPlainObject(event)) return void 0;
  const site = normalizeSite(event.site);
  const model = boundedString(event.model, 120, "generic");
  const promptTokens = boundedNonNegativeNumberOr(event.promptTokens, 2_000_000);
  const outputTokens = boundedNonNegativeNumberOr(event.outputTokens, 2_000_000);
  const totalTokens = Math.min(4_000_000, Math.max(promptTokens + outputTokens, boundedNonNegativeNumberOr(event.totalTokens, 4_000_000, promptTokens + outputTokens)));
  return {
    site,
    model,
    threadId: boundedString(event.threadId, 256, "default"),
    id: boundedString(event.id, 128) || void 0,
    timestamp: timestampOr(event.timestamp),
    promptTokens,
    outputTokens,
    totalTokens,
    promptChars: boundedNonNegativeNumberOr(event.promptChars, 10_000_000, boundedString(event.promptPreview, 140).length),
    outputChars: boundedNonNegativeNumberOr(event.outputChars, 10_000_000),
    status: ["completed", "rate_limited", "failed"].includes(event.status) ? event.status : "completed",
    promptPreview: boundedString(event.promptPreview, 140),
    optimizerSavings: boundedNonNegativeNumberOr(event.optimizerSavings, 4_000_000),
    rateLimitMessage: boundedString(event.rateLimitMessage, 500) || void 0,
    resetAt: Number.isFinite(event.resetAt) && event.resetAt > 0 ? timestampOr(event.resetAt) : void 0,
    measurement: normalizeMeasurement(event.measurement, { provider: site, model })
  };
}
function normalizeUsageEvents(rawEvents) {
  const seen = /* @__PURE__ */ new Set();
  return (Array.isArray(rawEvents) ? rawEvents : []).map(normalizeUsageEvent).filter(Boolean).filter((event) => {
    const key = usageEventIdentity(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.timestamp - b.timestamp).slice(-HISTORY_LIMIT);
}
function appendUsageEvent(events, event) {
  if (events.length >= HISTORY_LIMIT && event.timestamp <= events[0].timestamp) {
    return { events, evictedEvents: [], retained: false };
  }
  const evictedEvents = [];
  if (!events.length || event.timestamp >= events[events.length - 1].timestamp) {
    events.push(event);
  } else {
    let low = 0;
    let high = events.length;
    while (low < high) {
      const midpoint = Math.floor((low + high) / 2);
      if (events[midpoint].timestamp <= event.timestamp) {
        low = midpoint + 1;
      } else {
        high = midpoint;
      }
    }
    events.splice(low, 0, event);
  }
  while (events.length > HISTORY_LIMIT) {
    const evicted = events.shift();
    if (evicted) evictedEvents.push(evicted);
  }
  return { events, evictedEvents, retained: true };
}
function isTrackingEnabled(preferences, site) {
  return isKnownSite(site) && preferences.sites?.[site]?.enabled === true;
}
function sessionFingerprint(session) {
  if (!session) return "";
  return JSON.stringify({
    site: session.site,
    model: session.model,
    threadId: session.threadId,
    currentInput: session.currentInput,
    lastSeenUrl: session.lastSeenUrl,
    adapterConfidence: round(session.adapterConfidence ?? 0, 2),
    currentEstimate: {
      inputTokens: session.currentEstimate?.inputTokens ?? 0,
      totalTokens: session.currentEstimate?.totalTokens ?? 0,
      compressionScore: session.currentEstimate?.compressionScore ?? 0,
      measurement: {
        method: session.currentEstimate?.measurement?.measurementMethod ?? "unknown",
        level: session.currentEstimate?.measurement?.measurementLevel ?? "unknown",
        confidence: session.currentEstimate?.measurement?.confidence ?? 0,
        errorMarginPercent: session.currentEstimate?.measurement?.errorMarginPercent ?? 100
      }
    },
    currentThread: {
      messageCount: session.currentThread?.messageCount ?? 0,
      totalTokens: session.currentThread?.totalTokens ?? 0
    },
    quota: {
      usedTokens: session.quota?.usedTokens ?? 0,
      remainingTokens: session.quota?.remainingTokens,
      percentUsed: session.quota?.percentUsed,
      status: session.quota?.status,
      resetAt: session.quota?.nextReset?.resetAt ?? session.quota?.explicitResetAt
    }
  });
}
function rebuildThreads(events, fallbackThreads = {}) {
  if (!events.length) return fallbackThreads ?? {};
  let threads = {};
  for (const event of events) {
    threads = upsertThread(threads, event);
  }
  return threads;
}
function hydrateState(raw) {
  const preferences = mergePreferences(raw?.preferences);
  const usageEvents = normalizeUsageEvents(raw?.usageEvents);
  return {
    version: APP_VERSION,
    preferences,
    sessions: normalizeSessions(raw?.sessions),
    usageEvents,
    threads: rebuildThreads(usageEvents),
    meta: {
      notificationTimestamps: normalizeNotificationTimestamps(raw?.meta?.notificationTimestamps),
      usageEventKeys: normalizeUsageEventKeys(raw?.meta?.usageEventKeys, usageEvents)
    }
  };
}
async function readStateFromStorage() {
  const rawState = await storageGet(STATE_KEY);
  let state = hydrateState(rawState);
  let syncedPreferences;
  const sync = syncArea();
  if (sync) {
    try {
      const result = await sync.get(PREFERENCES_SYNC_KEY);
      syncedPreferences = result[PREFERENCES_SYNC_KEY];
    } catch (error) {
      console.warn("Yor Token Usage could not read synced preferences", error);
      syncedPreferences = void 0;
    }
  }
  if (syncedPreferences && state.preferences.privacyMode === "sync-preferences") {
    state = {
      ...state,
      preferences: mergePreferences(syncedPreferences)
    };
  }
  return state;
}
async function getState() {
  return enqueueStateOperation(() => readStateFromStorage());
}
async function writeStateToStorage(state) {
  const hydrated = hydrateState(state);
  await storageSet({ [STATE_KEY]: hydrated });
  const sync = syncArea();
  if (sync) {
    if (hydrated.preferences.privacyMode === "sync-preferences") {
      await sync.set({ [PREFERENCES_SYNC_KEY]: hydrated.preferences });
    } else {
      await sync.remove(PREFERENCES_SYNC_KEY);
    }
  }
  return hydrated;
}
async function saveState(state) {
  return enqueueStateOperation(() => writeStateToStorage(state));
}
async function updateState(mutator) {
  return enqueueStateOperation(async () => {
    const current = await readStateFromStorage();
    const next = await mutator(structuredClone(current));
    return writeStateToStorage(next);
  });
}
async function savePreferences(preferences) {
  return updateState(async (state) => {
    const mergedPreferences = mergePreferences(preferences);
    const sessions = { ...state.sessions };
    for (const site of Object.keys(mergedPreferences.sites)) {
      if (!isTrackingEnabled(mergedPreferences, site)) {
        sessions[site] = void 0;
      }
    }
    return {
      ...state,
      preferences: mergedPreferences,
      sessions
    };
  });
}
async function saveSession(session) {
  let savedSession;
  const state = await updateState(async (state2) => {
    const normalizedSession = normalizeSession(session);
    if (!normalizedSession) return state2;
    if (!isTrackingEnabled(state2.preferences, normalizedSession.site)) {
      return {
        ...state2,
        sessions: {
          ...state2.sessions,
          [normalizedSession.site]: void 0
        }
      };
    }
    if (sessionFingerprint(state2.sessions[normalizedSession.site]) === sessionFingerprint(normalizedSession)) {
      return state2;
    }
    savedSession = normalizedSession;
    return {
      ...state2,
      sessions: {
        ...state2.sessions,
        [normalizedSession.site]: normalizedSession
      }
    };
  });
  return { state, session: savedSession };
}
function threadKey(site, threadId) {
  return `${site}:${threadId || "default"}`;
}
function upsertThread(threads, event) {
  const key = threadKey(event.site, event.threadId);
  const existing = threads[key] ?? {
    threadId: event.threadId,
    site: event.site,
    model: event.model,
    messageCount: 0,
    promptTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    lastUpdated: event.timestamp,
    contextGrowth: []
  };
  const totalTokens = existing.totalTokens + event.totalTokens;
  const isLatestEvent = event.timestamp >= existing.lastUpdated;
  return {
    ...threads,
    [key]: {
      ...existing,
      model: isLatestEvent ? event.model : existing.model,
      messageCount: existing.messageCount + (event.outputTokens > 0 ? 2 : 1),
      promptTokens: existing.promptTokens + event.promptTokens,
      outputTokens: existing.outputTokens + event.outputTokens,
      totalTokens,
      lastUpdated: Math.max(existing.lastUpdated, event.timestamp),
      contextGrowth: [...existing.contextGrowth.slice(-24), event.totalTokens]
    }
  };
}
async function recordUsageEvent(event) {
  let recorded = false;
  let savedEvent;
  const state = await updateState(async (state2) => {
    const normalizedEvent = normalizeUsageEvent(event);
    if (!normalizedEvent) return state2;
    if (!isTrackingEnabled(state2.preferences, normalizedEvent.site)) {
      return state2;
    }
    const eventKey = usageEventIdentity(normalizedEvent);
    const usageEventKeys = state2.meta.usageEventKeys ?? {};
    if (hasUsageEventKey(usageEventKeys, eventKey)) {
      return state2;
    }
    const appendResult = appendUsageEvent(state2.usageEvents, normalizedEvent);
    if (!appendResult.retained) {
      return state2;
    }
    usageEventKeys[eventKey] = true;
    for (const evictedEvent of appendResult.evictedEvents) {
      delete usageEventKeys[usageEventIdentity(evictedEvent)];
    }
    recorded = true;
    savedEvent = normalizedEvent;
    return {
      ...state2,
      usageEvents: appendResult.events,
      threads: upsertThread(state2.threads, normalizedEvent),
      meta: {
        ...state2.meta,
        usageEventKeys
      }
    };
  });
  return { state, recorded, event: savedEvent };
}
function sessionMatchesUrl(session, activeUrl) {
  if (!session?.lastSeenUrl || !activeUrl) return false;
  try {
    return new URL(session.lastSeenUrl).hostname === new URL(activeUrl).hostname;
  } catch {
    return false;
  }
}
function buildSnapshot(state, activeUrl) {
  const generatedAt = Date.now();
  const analytics = getSnapshotAnalytics(state, generatedAt);
  const sessions = Object.values(state.sessions).filter((session) => session && isTrackingEnabled(state.preferences, session.site)).sort((a, b) => b.lastUpdated - a.lastUpdated);
  const currentSession = (() => {
    if (!activeUrl) return sessions[0];
    return sessions.find((session) => sessionMatchesUrl(session, activeUrl)) ?? sessions[0];
  })();
  const today = analytics.byDay.at(-1);
  const tokensThisWeek = analytics.byDay.slice(-7).reduce((acc, day) => acc + day.tokens, 0);
  const costThisWeek = analytics.byDay.slice(-7).reduce((acc, day) => acc + day.cost, 0);
  return {
    state,
    analytics,
    summary: {
      tokensToday: today?.tokens ?? 0,
      tokensThisWeek,
      costThisWeek,
      activeSites: analytics.bySite.length,
      promptsToday: today?.prompts ?? 0
    },
    currentSession,
    sessions,
    recentThreads: Object.values(state.threads).sort((a, b) => b.lastUpdated - a.lastUpdated).slice(0, 10),
    generatedAt
  };
}
async function exportState() {
  return getState();
}
async function importState(state) {
  invalidateSnapshotAnalytics();
  return saveState(hydrateState(state));
}
async function clearLocalHistory() {
  invalidateSnapshotAnalytics();
  return updateState(async (state) => ({
    ...state,
    sessions: {},
    usageEvents: [],
    threads: {},
    meta: {
      notificationTimestamps: {},
      usageEventKeys: {}
    }
  }));
}

// src/cloud/cloudSync.ts
function normalizeCloudBaseUrl(value) {
  const raw = boundedString(value, 2048).trim();
  if (!raw) throw new Error("Enter the HTTPS URL for the Yor backend.");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("The backend URL is not valid.");
  }
  const isLocalHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error("Cloud sync requires HTTPS. Plain HTTP is allowed only for localhost development.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("The backend URL cannot contain credentials, a query, or a fragment.");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}
function normalizeCloudKeyMap(value) {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, status]) => {
    return typeof key === "string" && key.length <= 512 && (status === true || status === "expired");
  }).slice(-HISTORY_LIMIT * 2));
}
function normalizeCloudConfig(raw) {
  const source = isPlainObject(raw) ? raw : {};
  let apiBaseUrl = "";
  if (source.apiBaseUrl) {
    try {
      apiBaseUrl = normalizeCloudBaseUrl(source.apiBaseUrl);
    } catch {
      apiBaseUrl = "";
    }
  }
  const installId = typeof source.installId === "string" && /^[a-z0-9._:-]{8,128}$/i.test(source.installId) ? source.installId : "";
  const connectionId = typeof source.connectionId === "string" && /^[a-z0-9._:-]{8,128}$/i.test(source.connectionId) ? source.connectionId : "";
  const account = isPlainObject(source.account) ? {
    userId: boundedString(source.account.userId, 128),
    email: boundedString(source.account.email, 320),
    deviceId: boundedString(source.account.deviceId, 128)
  } : void 0;
  const quota = isPlainObject(source.quota) ? {
    usedTokens: boundedNonNegativeNumberOr(source.quota.usedTokens, 4_000_000_000),
    tokenCap: boundedNonNegativeNumberOr(source.quota.tokenCap, 4_000_000_000),
    remainingTokens: boundedNonNegativeNumberOr(source.quota.remainingTokens, 4_000_000_000),
    limited: source.quota.limited === true,
    periodEnd: boundedString(source.quota.periodEnd, 64)
  } : void 0;
  return {
    enabled: source.enabled === true && Boolean(apiBaseUrl && installId && connectionId),
    apiBaseUrl,
    installId,
    connectionId,
    account,
    quota,
    syncedEventKeys: normalizeCloudKeyMap(source.syncedEventKeys),
    syncedClientEventIds: normalizeCloudKeyMap(source.syncedClientEventIds),
    skippedExpiredEvents: boundedNonNegativeNumberOr(source.skippedExpiredEvents, HISTORY_LIMIT),
    lastSyncedAt: Number.isFinite(source.lastSyncedAt) ? source.lastSyncedAt : void 0,
    lastError: boundedString(source.lastError, 240)
  };
}
async function readCloudConfig() {
  return normalizeCloudConfig(await storageGet(CLOUD_CONFIG_KEY));
}
async function writeCloudConfig(config) {
  const normalized = normalizeCloudConfig(config);
  await storageSet({ [CLOUD_CONFIG_KEY]: normalized });
  return normalized;
}
async function readCloudAccessToken() {
  const session = await sessionStorageGet(CLOUD_SESSION_KEY);
  return isPlainObject(session) && typeof session.accessToken === "string" ? session.accessToken : "";
}
function normalizeCloudAccessToken(accessToken) {
  const token = boundedString(accessToken, 8192).trim();
  if (token.length < 20 || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new Error("Enter a valid short-lived OIDC access token.");
  }
  return token;
}
async function writeCloudAccessToken(accessToken) {
  const token = normalizeCloudAccessToken(accessToken);
  await sessionStorageSet({ [CLOUD_SESSION_KEY]: { accessToken: token } });
}
function createCloudInstallId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `install-${crypto.randomUUID()}`;
  }
  return `install-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
function createCloudConnectionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `session-${crypto.randomUUID()}`;
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
function assertInternalExtensionSender(sender) {
  const senderUrl = sender?.url ?? sender?.tab?.url;
  const extensionRoot = chrome.runtime.getURL("");
  if (typeof senderUrl !== "string" || !senderUrl.startsWith(extensionRoot)) {
    throw new Error("Cloud account controls are available only from Yor settings.");
  }
}
function cloudDeviceHeaders(config) {
  const manifest = chrome.runtime.getManifest?.() ?? {};
  const runtimeNavigator = typeof navigator !== "undefined" ? navigator : {};
  return {
    "x-install-id": config.installId,
    "x-extension-id": chrome.runtime.id,
    "x-extension-version": boundedString(manifest.version, 64, "unknown"),
    "x-browser": "chromium",
    "x-platform": boundedString(runtimeNavigator.userAgentData?.platform ?? runtimeNavigator.platform, 64, "unknown")
  };
}
class CloudRequestError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "CloudRequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
var cloudConnectionGeneration = 0;
var activeCloudControllers = /* @__PURE__ */ new Set();
function cancelActiveCloudRequests() {
  for (const controller of activeCloudControllers) controller.abort();
  activeCloudControllers.clear();
}
function cloudOperationCancelled() {
  return new CloudRequestError("Cloud operation was cancelled because the account connection changed.", 409, "cloud_operation_cancelled");
}
async function writeCloudConfigForConnection(config, connectionId, generation) {
  if (generation !== cloudConnectionGeneration) throw cloudOperationCancelled();
  const current = await readCloudConfig();
  if (generation !== cloudConnectionGeneration || !current.enabled || current.connectionId !== connectionId) {
    throw cloudOperationCancelled();
  }
  return writeCloudConfig({ ...config, enabled: true, connectionId });
}
async function cloudRequest(config, path, options = {}) {
  const accessToken = await readCloudAccessToken();
  if (!accessToken) throw new CloudRequestError("Cloud session expired. Connect again with a fresh access token.", 401, "cloud_session_missing");
  const controller = new AbortController();
  activeCloudControllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        ...cloudDeviceHeaders(config),
        ...(options.body !== void 0 ? { "content-type": "application/json" } : {}),
        ...(options.headers ?? {})
      },
      ...(options.body !== void 0 ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal
    });
    const responseText = await response.text();
    let payload;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const serverMessage = isPlainObject(payload) ? boundedString(payload.message, 240) : "";
      const code = isPlainObject(payload) ? boundedString(payload.error, 80) : "";
      throw new CloudRequestError(serverMessage || `Cloud request failed with status ${response.status}.`, response.status, code || "cloud_request_failed");
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new CloudRequestError("Cloud request timed out. Local tracking is still active.", 504, "cloud_timeout");
    }
    if (error instanceof CloudRequestError) throw error;
    throw new CloudRequestError("Could not reach the Yor backend. Local tracking is still active.", 503, "cloud_unreachable");
  } finally {
    activeCloudControllers.delete(controller);
    clearTimeout(timeout);
  }
}
async function sha256HexString(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function toCloudUsageEvent(event) {
  const clientEventId = `evt_${(await sha256HexString(usageEventIdentity(event))).slice(0, 48)}`;
  const measurement = normalizeMeasurement(event.measurement, { provider: event.site, model: event.model });
  return {
    key: usageEventIdentity(event),
    clientEventId,
    payload: {
      clientEventId,
      provider: event.site,
      model: event.model,
      threadId: event.threadId,
      occurredAt: new Date(event.timestamp).toISOString(),
      promptTokens: event.promptTokens,
      outputTokens: event.outputTokens,
      totalTokens: event.totalTokens,
      promptText: event.promptText,
      responseText: event.responseText,
      status: event.status === "rate_limited" ? "RATE_LIMITED" : event.status === "failed" ? "FAILED" : "COMPLETED",
      accuracy: "ESTIMATED",
      schemaVersion: measurement.schemaVersion,
      measurementMethod: measurement.measurementMethod,
      measurementLevel: measurement.measurementLevel,
      confidence: measurement.confidence,
      errorMarginPercent: measurement.errorMarginPercent,
      tokenizer: measurement.tokenizer,
      source: measurement.source
    }
  };
}
function fromCloudUsageEvent(remoteEvent) {
  if (!isPlainObject(remoteEvent)) return void 0;
  const timestamp = Date.parse(remoteEvent.occurredAt);
  if (!Number.isFinite(timestamp)) return void 0;
  const clientEventId = boundedString(remoteEvent.clientEventId, 128);
  if (!clientEventId) return void 0;
  const status = remoteEvent.status === "RATE_LIMITED" ? "rate_limited" : remoteEvent.status === "FAILED" ? "failed" : "completed";
  const event = normalizeUsageEvent({
    id: `cloud-${clientEventId}`,
    site: remoteEvent.provider,
    model: remoteEvent.model,
    threadId: remoteEvent.threadId,
    timestamp,
    promptTokens: remoteEvent.promptTokens,
    outputTokens: remoteEvent.outputTokens,
    totalTokens: remoteEvent.totalTokens,
    status,
    promptPreview: "",
    measurement: {
      schemaVersion: remoteEvent.schemaVersion,
      measurementMethod: remoteEvent.measurementMethod,
      measurementLevel: remoteEvent.measurementLevel,
      confidence: remoteEvent.confidence,
      errorMarginPercent: remoteEvent.errorMarginPercent,
      provider: remoteEvent.provider,
      model: remoteEvent.model,
      tokenizer: remoteEvent.tokenizer,
      source: remoteEvent.source
    }
  });
  return event ? { clientEventId, event } : void 0;
}
async function mergeCloudUsageEvents(remoteEvents, config) {
  const candidates = (Array.isArray(remoteEvents) ? remoteEvents : []).map(fromCloudUsageEvent).filter(Boolean).filter((entry) => {
    return !Object.prototype.hasOwnProperty.call(config.syncedClientEventIds, entry.clientEventId);
  });
  if (!candidates.length) return config;
  const imported = [];
  await updateState(async (state) => {
    const usageEventKeys = state.meta.usageEventKeys ?? {};
    for (const entry of candidates) {
      const eventKey = usageEventIdentity(entry.event);
      config.syncedClientEventIds[entry.clientEventId] = true;
      if (hasUsageEventKey(usageEventKeys, eventKey)) continue;
      const appendResult = appendUsageEvent(state.usageEvents, entry.event);
      if (!appendResult.retained) continue;
      usageEventKeys[eventKey] = true;
      for (const evictedEvent of appendResult.evictedEvents) {
        delete usageEventKeys[usageEventIdentity(evictedEvent)];
      }
      state.threads = upsertThread(state.threads, entry.event);
      config.syncedEventKeys[eventKey] = true;
      imported.push(eventKey);
    }
    state.meta.usageEventKeys = usageEventKeys;
    return state;
  });
  config.syncedEventKeys = normalizeCloudKeyMap(config.syncedEventKeys);
  config.syncedClientEventIds = normalizeCloudKeyMap(config.syncedClientEventIds);
  return config;
}
async function getCloudStatus() {
  const [config, accessToken, state] = await Promise.all([readCloudConfig(), readCloudAccessToken(), getState()]);
  const pendingEvents = config.enabled ? state.usageEvents.filter((event) => {
    return !Object.prototype.hasOwnProperty.call(config.syncedEventKeys, usageEventIdentity(event));
  }).length : 0;
  return {
    configured: Boolean(config.apiBaseUrl),
    enabled: config.enabled,
    connected: Boolean(config.enabled && accessToken),
    apiBaseUrl: config.apiBaseUrl,
    account: config.account,
    quota: config.quota,
    pendingEvents,
    skippedExpiredEvents: config.skippedExpiredEvents,
    lastSyncedAt: config.lastSyncedAt,
    lastError: config.lastError
  };
}
async function connectCloudSession(apiBaseUrl, accessToken) {
  const normalizedApiBaseUrl = normalizeCloudBaseUrl(apiBaseUrl);
  const normalizedAccessToken = normalizeCloudAccessToken(accessToken);
  const generation = ++cloudConnectionGeneration;
  cancelActiveCloudRequests();
  const connectionId = createCloudConnectionId();
  let config = await readCloudConfig();
  if (generation !== cloudConnectionGeneration) throw cloudOperationCancelled();
  config = await writeCloudConfig({
    ...config,
    enabled: true,
    apiBaseUrl: normalizedApiBaseUrl,
    installId: config.installId || createCloudInstallId(),
    connectionId,
    syncedEventKeys: {},
    syncedClientEventIds: {},
    skippedExpiredEvents: 0,
    account: void 0,
    quota: void 0,
    lastSyncedAt: void 0,
    lastError: ""
  });
  try {
    if (generation !== cloudConnectionGeneration) throw cloudOperationCancelled();
    await writeCloudAccessToken(normalizedAccessToken);
    const session = await cloudRequest(config, "/v1/auth/session");
    config = await writeCloudConfigForConnection({
      ...config,
      account: {
        userId: session?.user?.id,
        email: session?.user?.email,
        deviceId: session?.device?.id
      },
      lastError: ""
    }, connectionId, generation);
    return getCloudStatus();
  } catch (error) {
    const current = await readCloudConfig();
    if (generation === cloudConnectionGeneration && current.connectionId === connectionId) {
      await sessionStorageRemove(CLOUD_SESSION_KEY);
      await writeCloudConfig({ ...current, lastError: boundedString(error?.message, 240) });
    }
    throw error;
  }
}
async function disconnectCloudSession() {
  ++cloudConnectionGeneration;
  cancelActiveCloudRequests();
  const config = await readCloudConfig();
  await sessionStorageRemove(CLOUD_SESSION_KEY);
  await writeCloudConfig({
    ...config,
    enabled: false,
    connectionId: "",
    account: void 0,
    quota: void 0,
    syncedEventKeys: {},
    syncedClientEventIds: {},
    skippedExpiredEvents: 0,
    lastSyncedAt: void 0,
    lastError: ""
  });
  return getCloudStatus();
}
async function recordCloudSyncFailure(error) {
  const config = await readCloudConfig();
  if (!config.enabled || error?.code === "cloud_operation_cancelled") return;
  if (error?.cloudConnectionId && error.cloudConnectionId !== config.connectionId) return;
  await writeCloudConfig({ ...config, lastError: boundedString(error?.message, 240, "Cloud sync failed.") });
}
var cloudSyncQueue = Promise.resolve();
async function runCloudSync(generation) {
  let config = await readCloudConfig();
  const accessToken = await readCloudAccessToken();
  if (!config.enabled || !accessToken) return getCloudStatus();
  const connectionId = config.connectionId;
  try {
    if (generation !== cloudConnectionGeneration) throw cloudOperationCancelled();
    const state = await getState();
    const cutoff = Date.now() - CLOUD_EVENT_MAX_AGE_MS + 60_000;
    const eligible = [];
    for (const event of state.usageEvents) {
      const eventKey = usageEventIdentity(event);
      if (Object.prototype.hasOwnProperty.call(config.syncedEventKeys, eventKey)) continue;
      if (event.timestamp < cutoff) {
        config.syncedEventKeys[eventKey] = "expired";
        config.skippedExpiredEvents += 1;
        continue;
      }
      eligible.push(event);
    }
    config.syncedEventKeys = normalizeCloudKeyMap(config.syncedEventKeys);
    config.skippedExpiredEvents = Math.min(HISTORY_LIMIT, config.skippedExpiredEvents);
    config = await writeCloudConfigForConnection(config, connectionId, generation);

    const maxEvents = CLOUD_MAX_BATCHES_PER_SYNC * 100;
    const eventsToUpload = eligible.slice(0, maxEvents);
    for (let offset = 0; offset < eventsToUpload.length; offset += 100) {
      const localBatch = eventsToUpload.slice(offset, offset + 100);
      const cloudBatch = await Promise.all(localBatch.map(toCloudUsageEvent));
      const idempotencyHash = await sha256HexString(cloudBatch.map((entry) => entry.clientEventId).join(":"));
      await cloudRequest(config, "/v1/usage/events/batch", {
        method: "POST",
        headers: { "idempotency-key": `yor-${idempotencyHash}` },
        body: { events: cloudBatch.map((entry) => entry.payload) }
      });
      for (const entry of cloudBatch) {
        config.syncedEventKeys[entry.key] = true;
        config.syncedClientEventIds[entry.clientEventId] = true;
      }
      config.syncedEventKeys = normalizeCloudKeyMap(config.syncedEventKeys);
      config.syncedClientEventIds = normalizeCloudKeyMap(config.syncedClientEventIds);
      config = await writeCloudConfigForConnection(config, connectionId, generation);
    }

    const remoteState = await cloudRequest(config, "/v1/sync/state", {
      method: "POST",
      body: { includeUsage: true, maxEvents: 500 }
    });
    if (generation !== cloudConnectionGeneration) throw cloudOperationCancelled();
    config = await mergeCloudUsageEvents(remoteState?.usageEvents, config);
    const quota = await cloudRequest(config, "/v1/quota/check");
    config = await writeCloudConfigForConnection({
      ...config,
      quota: {
        usedTokens: quota?.usedTokens,
        tokenCap: quota?.tokenCap,
        remainingTokens: quota?.remainingTokens,
        limited: quota?.limited,
        periodEnd: quota?.periodEnd
      },
      lastSyncedAt: Date.now(),
      lastError: ""
    }, connectionId, generation);
    return getCloudStatus();
  } catch (error) {
    if (error && typeof error === "object") error.cloudConnectionId = connectionId;
    throw error;
  }
}
function syncCloudState() {
  const generation = cloudConnectionGeneration;
  const operation = cloudSyncQueue.then(() => runCloudSync(generation));
  cloudSyncQueue = operation.then(() => void 0, () => void 0);
  return operation;
}

// src/background/service-worker.ts
var ALARM_NAME = "yor-token-usage-refresh";
async function ensureState() {
  return updateState(async (state) => state);
}
async function withNotificationBudget(key, ttlMs, task) {
  let reserved = false;
  await updateState(async (state) => {
    const now = Date.now();
    const lastSent = state.meta.notificationTimestamps[key] ?? 0;
    if (now - lastSent < ttlMs) return state;
    reserved = true;
    return {
      ...state,
      meta: {
        ...state.meta,
        notificationTimestamps: {
          ...state.meta.notificationTimestamps,
          [key]: now
        }
      }
    };
  });
  if (reserved) {
    await task();
  }
}
async function hasNotificationPermission() {
  if (!chrome.notifications?.create) return false;
  if (!chrome.permissions?.contains) return true;
  return chrome.permissions.contains({ permissions: ["notifications"] }).catch(() => false);
}
async function notify(title, message) {
  if (!await hasNotificationPermission()) {
    return {
      ok: false,
      error: "Notification permission is not available. Re-enable notifications for the extension in your browser settings."
    };
  }
  const id = await chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/icons/icon-128.png",
    title,
    message
  });
  return { ok: true, id };
}
async function updateBadge(session) {
  const state = await getState();
  const target = session && isTrackingEnabled(state.preferences, session.site) ? session : Object.values(state.sessions).filter((entry) => entry && isTrackingEnabled(state.preferences, entry.site)).sort((a, b) => (b?.lastUpdated ?? 0) - (a?.lastUpdated ?? 0))[0];
  if (!target || state.preferences.alerts.badgeMode === "off") {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  const badgeText = state.preferences.alerts.badgeMode === "remaining" ? formatTokens(target.quota.remainingTokens).replace(/\.0K$/, "K") : formatPercent(target.quota.percentUsed).replace("%", "");
  await chrome.action.setBadgeText({ text: badgeText === "\u2014" ? "" : badgeText.slice(0, 4) });
  await chrome.action.setBadgeBackgroundColor({
    color: target.quota.status === "limited" ? "#ff5f6d" : target.quota.status === "warning" ? "#ffb84d" : "#6d8dff"
  });
}
async function notifyIfNeededFromSession(session) {
  const preferences = (await getState()).preferences;
  if (!preferences.alerts.desktopNotifications) return;
  const threshold = preferences.alerts.quotaWarningPercent;
  if (session.quota.percentUsed !== void 0 && session.quota.percentUsed >= threshold) {
    await withNotificationBudget(`quota:${session.site}:${session.model}`, 45 * 6e4, async () => {
      await notify(
        `${SITE_LABELS[session.site]} quota warning`,
        `${session.model} is at ${formatPercent(session.quota.percentUsed)}. Reset ${session.quota.nextReset?.localLabel ?? "unknown"}.`
      );
    });
  }
}
async function notifyIfNeededFromEvent(event) {
  const state = await getState();
  if (!state.preferences.alerts.desktopNotifications) return;
  if (event.totalTokens >= state.preferences.alerts.largePromptTokens) {
    await withNotificationBudget(`event:${event.id ?? usageEventIdentity(event)}`, 12 * 6e4, async () => {
      await notify("Large prompt detected", `That exchange used about ${formatTokens(event.totalTokens)} tokens.`);
    });
  }
  if (event.status === "rate_limited") {
    await withNotificationBudget(`limit:${event.site}:${event.resetAt ?? "unknown"}`, 30 * 6e4, async () => {
      await notify(
        `${SITE_LABELS[event.site]} limit reached`,
        event.rateLimitMessage ?? `The site signaled a usage limit. Reset ${event.resetAt ? "around " + new Date(event.resetAt).toLocaleTimeString() : "time is not known yet"}.`
      );
    });
  }
}
chrome.runtime.onInstalled.addListener(async () => {
  await ensureState();
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
  await updateBadge();
});
chrome.runtime.onStartup.addListener(async () => {
  await ensureState();
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
  await updateBadge();
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const state = await getState();
  const sessions = Object.values(state.sessions).filter((session) => session && isTrackingEnabled(state.preferences, session.site));
  for (const session of sessions) {
    await notifyIfNeededFromSession(session);
  }
  await updateBadge();
  await syncCloudState().catch(recordCloudSyncFailure);
});
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-dashboard") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    return;
  }
  if (command === "toggle-overlay") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "toggle-overlay" }).catch(() => void 0);
    }
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    try {
      switch (message?.type) {
        case "capture-session": {
          const { state, session } = await saveSession(message.payload);
          await updateBadge(session);
          if (session) {
            await notifyIfNeededFromSession(session);
          }
          sendResponse({ ok: true, snapshot: buildSnapshot(state) });
          break;
        }
        case "commit-usage-event": {
          const { state, recorded, event } = await recordUsageEvent(message.payload);
          await updateBadge();
          if (recorded && event) {
            await notifyIfNeededFromEvent(event);
            void syncCloudState().catch(recordCloudSyncFailure);
          }
          sendResponse({ ok: true, snapshot: buildSnapshot(state) });
          break;
        }
        case "get-snapshot": {
          const state = await getState();
          sendResponse(buildSnapshot(state, message.activeUrl));
          break;
        }
        case "get-state": {
          sendResponse(await getState());
          break;
        }
        case "save-preferences": {
          const state = await savePreferences(message.payload);
          await updateBadge();
          sendResponse(buildSnapshot(state));
          break;
        }
        case "export-data": {
          sendResponse(await exportState());
          break;
        }
        case "import-data": {
          const state = await importState(message.payload);
          await updateBadge();
          sendResponse(buildSnapshot(state));
          break;
        }
        case "clear-local-history": {
          assertInternalExtensionSender(sender);
          const state = await clearLocalHistory();
          await updateBadge();
          sendResponse(buildSnapshot(state));
          break;
        }
        case "toggle-overlay": {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            const result = await chrome.tabs.sendMessage(tab.id, { type: "toggle-overlay", value: message.value }).catch(() => void 0);
            sendResponse(result ?? { ok: false });
          } else {
            sendResponse({ ok: false });
          }
          break;
        }
        case "notify": {
          sendResponse(await notify(message.title, message.message));
          break;
        }
        case "cloud-status": {
          assertInternalExtensionSender(sender);
          sendResponse({ ok: true, status: await getCloudStatus() });
          break;
        }
        case "cloud-connect": {
          assertInternalExtensionSender(sender);
          sendResponse({ ok: true, status: await connectCloudSession(message.payload?.apiBaseUrl, message.payload?.accessToken) });
          break;
        }
        case "cloud-sync": {
          assertInternalExtensionSender(sender);
          sendResponse({ ok: true, status: await syncCloudState() });
          break;
        }
        case "cloud-disconnect": {
          assertInternalExtensionSender(sender);
          sendResponse({ ok: true, status: await disconnectCloudSession() });
          break;
        }
        default:
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();
  return true;
});
