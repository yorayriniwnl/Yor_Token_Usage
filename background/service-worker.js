// src/lib/constants.ts
var STATE_KEY = "yor-token-usage-state";
var PREFERENCES_SYNC_KEY = "yor-token-usage-preferences";
var APP_VERSION = 1;
var HISTORY_LIMIT = 2500;
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
  "gpt-5.5": {
    id: "gpt-5.5",
    label: "GPT-5.5",
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
    label: "Claude Opus 4.7",
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
    label: "Claude Sonnet 4.6",
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
    const timestamp = start + index * stepMs;
    const key = toDateKey(timestamp);
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
  const fourteenDaysAgo = startOfLocalDay(now - 13 * 864e5);
  const eightWeeksAgo = startOfLocalWeek(now - 7 * 7 * 864e5);
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
  const peakDay = [...byDay].sort((a, b) => b.tokens - a.tokens)[0];
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
var stateQueue = Promise.resolve();
function localArea() {
  return chrome?.storage?.local;
}
function syncArea() {
  return chrome?.storage?.sync;
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
    compressionScore: 0
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
function stringOr(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function finiteNumberOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}
function nonNegativeNumberOr(value, fallback = 0) {
  return Math.max(0, finiteNumberOr(value, fallback));
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
  return {
    ...defaults,
    ...partial,
    resetRule: {
      ...defaults.resetRule,
      ...partialResetRule
    }
  };
}
function mergePreferences(partial) {
  const partialPreferences = isPlainObject(partial) ? partial : {};
  const sites = Object.keys(DEFAULT_PREFERENCES.sites).reduce((acc, site) => {
    acc[site] = mergeSiteSettings(site, partialPreferences.sites?.[site]);
    return acc;
  }, {});
  return {
    ...DEFAULT_PREFERENCES,
    ...partialPreferences,
    alerts: {
      ...DEFAULT_PREFERENCES.alerts,
      ...(isPlainObject(partialPreferences.alerts) ? partialPreferences.alerts : {})
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
  return isPlainObject(raw) ? raw : buildUsageEventKeyMap(usageEvents);
}
function hasUsageEventKey(keys, key) {
  return Object.prototype.hasOwnProperty.call(keys, key);
}
function normalizeSession(session) {
  if (!isPlainObject(session)) return void 0;
  const site = normalizeSite(session.site);
  const defaultAnalysis = defaultPromptAnalysis();
  const currentEstimate = isPlainObject(session.currentEstimate) ? session.currentEstimate : defaultPromptAnalysis();
  const currentThread = isPlainObject(session.currentThread) ? session.currentThread : void 0;
  const quota = isPlainObject(session.quota) ? session.quota : defaultQuotaStatus();
  return {
    ...session,
    site,
    model: stringOr(session.model, "generic"),
    threadId: stringOr(session.threadId, "default"),
    currentInput: stringOr(session.currentInput),
    currentEstimate: {
      ...defaultAnalysis,
      ...currentEstimate,
      inputTokens: nonNegativeNumberOr(currentEstimate.inputTokens),
      outputTokensEstimate: nonNegativeNumberOr(currentEstimate.outputTokensEstimate),
      totalTokens: nonNegativeNumberOr(currentEstimate.totalTokens),
      sections: Array.isArray(currentEstimate.sections) ? currentEstimate.sections : [],
      suggestions: Array.isArray(currentEstimate.suggestions) ? currentEstimate.suggestions : [],
      variants: {
        ...defaultAnalysis.variants,
        shorter: stringOr(currentEstimate.variants?.shorter),
        balanced: stringOr(currentEstimate.variants?.balanced),
        maxDetail: stringOr(currentEstimate.variants?.maxDetail)
      },
      repeatedInstructions: Array.isArray(currentEstimate.repeatedInstructions) ? currentEstimate.repeatedInstructions : [],
      redundantSections: Array.isArray(currentEstimate.redundantSections) ? currentEstimate.redundantSections : [],
      largePaste: currentEstimate.largePaste === true,
      compressionScore: clamp(nonNegativeNumberOr(currentEstimate.compressionScore), 0, 100)
    },
    currentThread: currentThread ? {
      ...currentThread,
      threadId: stringOr(currentThread.threadId, stringOr(session.threadId, "default")),
      site,
      model: stringOr(currentThread.model, stringOr(session.model, "generic")),
      messageCount: nonNegativeNumberOr(currentThread.messageCount),
      promptTokens: nonNegativeNumberOr(currentThread.promptTokens),
      outputTokens: nonNegativeNumberOr(currentThread.outputTokens),
      totalTokens: nonNegativeNumberOr(currentThread.totalTokens),
      lastUpdated: Number.isFinite(currentThread.lastUpdated) ? currentThread.lastUpdated : Date.now(),
      contextGrowth: Array.isArray(currentThread.contextGrowth) ? currentThread.contextGrowth.filter(Number.isFinite).map((value) => Math.max(0, value)).slice(-25) : []
    } : void 0,
    quota: {
      ...defaultQuotaStatus(),
      ...quota,
      usedTokens: nonNegativeNumberOr(quota.usedTokens),
      remainingTokens: Number.isFinite(quota.remainingTokens) ? Math.max(0, quota.remainingTokens) : void 0,
      percentUsed: Number.isFinite(quota.percentUsed) ? clamp(quota.percentUsed, 0, 100) : void 0
    },
    lastUpdated: Number.isFinite(session.lastUpdated) ? session.lastUpdated : Date.now(),
    lastSeenUrl: stringOr(session.lastSeenUrl),
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
  const promptTokens = nonNegativeNumberOr(event.promptTokens);
  const outputTokens = nonNegativeNumberOr(event.outputTokens);
  const totalTokens = Math.max(promptTokens + outputTokens, nonNegativeNumberOr(event.totalTokens, promptTokens + outputTokens));
  return {
    ...event,
    site: normalizeSite(event.site),
    model: stringOr(event.model, "generic"),
    threadId: stringOr(event.threadId, "default"),
    id: stringOr(event.id) || void 0,
    timestamp: Number.isFinite(event.timestamp) && event.timestamp > 0 ? event.timestamp : Date.now(),
    promptTokens,
    outputTokens,
    totalTokens,
    promptChars: nonNegativeNumberOr(event.promptChars, stringOr(event.promptPreview).length),
    outputChars: nonNegativeNumberOr(event.outputChars),
    status: event.status === "rate_limited" ? "rate_limited" : "completed",
    promptPreview: stringOr(event.promptPreview),
    optimizerSavings: nonNegativeNumberOr(event.optimizerSavings),
    rateLimitMessage: typeof event.rateLimitMessage === "string" ? event.rateLimitMessage.slice(0, 500) : void 0,
    resetAt: Number.isFinite(event.resetAt) && event.resetAt > 0 ? event.resetAt : void 0
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
      compressionScore: session.currentEstimate?.compressionScore ?? 0
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
function hasStoredThreads(threads) {
  return Boolean(threads && typeof threads === "object" && !Array.isArray(threads) && Object.keys(threads).length > 0);
}
function hydrateState(raw) {
  const preferences = mergePreferences(raw?.preferences);
  const usageEvents = normalizeUsageEvents(raw?.usageEvents);
  return {
    version: APP_VERSION,
    preferences,
    sessions: normalizeSessions(raw?.sessions),
    usageEvents,
    threads: hasStoredThreads(raw?.threads) ? raw.threads : rebuildThreads(usageEvents, {}),
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
    } catch {
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
  const readOperation = stateQueue.catch(() => void 0).then(() => readStateFromStorage());
  stateQueue = readOperation.then(() => void 0, () => void 0);
  return readOperation;
}
async function writeStateToStorage(state) {
  const hydrated = hydrateState(state);
  await storageSet({ [STATE_KEY]: hydrated });
  const sync = syncArea();
  if (sync) {
    if (hydrated.preferences.privacyMode === "sync-preferences") {
      await sync.set({ [PREFERENCES_SYNC_KEY]: hydrated.preferences }).catch(() => void 0);
    } else {
      await sync.remove(PREFERENCES_SYNC_KEY).catch(() => void 0);
    }
  }
  return hydrated;
}
async function saveState(state) {
  const nextWrite = stateQueue.catch(() => void 0).then(() => writeStateToStorage(state));
  stateQueue = nextWrite.catch(() => void 0);
  return nextWrite;
}
async function updateState(mutator) {
  const nextWrite = stateQueue.catch(() => void 0).then(async () => {
    const current = await readStateFromStorage();
    const next = await mutator(structuredClone(current));
    return writeStateToStorage(next);
  });
  stateQueue = nextWrite.catch(() => void 0);
  return nextWrite;
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
      contextGrowth: [...existing.contextGrowth.slice(-24), totalTokens]
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
async function notify(title, message) {
  await chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/icons/icon-128.png",
    title,
    message
  });
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
          await notify(message.title, message.message);
          sendResponse({ ok: true });
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
