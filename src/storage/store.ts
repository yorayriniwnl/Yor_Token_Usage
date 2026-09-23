import { STATE_KEY, PREFERENCES_SYNC_KEY, APP_VERSION, HISTORY_LIMIT, DEFAULT_PREFERENCES } from '../lib/constants.js';
import { clamp, round } from '../lib/utils.js';
import { getSnapshotAnalytics, invalidateSnapshotAnalytics } from '../analytics/usageAnalytics.js';
import type { ProviderId } from '../types/models.js';
import type { UserPreferences } from '../types/state.js';

export var memoryStorage = /* @__PURE__ */ new Map();
export var memorySessionStorage = /* @__PURE__ */ new Map();
export var stateQueue = Promise.resolve();
    // @ts-ignore
export function logStateOperationError(error: any) {
  console.error("Yor Token Usage state operation failed", error);
}
    // @ts-ignore
export function enqueueStateOperation<T>(operation: () => T | Promise<T>): Promise<Awaited<T>> {
  const queuedOperation = stateQueue.then(operation);
  stateQueue = queuedOperation.then(() => void 0, (error) => {
    logStateOperationError(error);
  });
  return queuedOperation as Promise<Awaited<T>>;
}
export function localArea() {
  return typeof chrome !== "undefined" ? chrome.storage?.local : void 0;
}
export function syncArea() {
  return typeof chrome !== "undefined" ? chrome.storage?.sync : void 0;
}
export function sessionArea() {
  return typeof chrome !== "undefined" ? chrome.storage?.session : void 0;
}
    // @ts-ignore
export async function storageGet(key: any) {
  const area = localArea();
  if (area) {
    const result = await area.get(key);
    return result[key];
  }
  return memoryStorage.get(key);
}
    // @ts-ignore
export async function storageSet(value: any) {
  const area = localArea();
  if (area) {
    await area.set(value);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    memoryStorage.set(key, entry);
  }
}
    // @ts-ignore
export async function sessionStorageGet(key: any) {
  const area = sessionArea();
  if (area) {
    const result = await area.get(key);
    return result[key];
  }
  return memorySessionStorage.get(key);
}
    // @ts-ignore
export async function sessionStorageSet(value: any) {
  const area = sessionArea();
  if (area) {
    await area.set(value);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    memorySessionStorage.set(key, entry);
  }
}
    // @ts-ignore
export async function sessionStorageRemove(key: any) {
  const area = sessionArea();
  if (area) {
    await area.remove(key);
    return;
  }
  memorySessionStorage.delete(key);
}
export function defaultPromptAnalysis() {
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
export function defaultQuotaStatus() {
  return {
    usedTokens: 0,
    status: "unknown",
    accuracy: "inferred"
  };
}
    // @ts-ignore
export function isPlainObject(value: any) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
    // @ts-ignore
export function isKnownSite(site: any) {
  return typeof site === "string" && Object.prototype.hasOwnProperty.call(DEFAULT_PREFERENCES.sites, site);
}
    // @ts-ignore
export function normalizeSite(site: any) {
  return isKnownSite(site) ? site : "generic";
}
    // @ts-ignore
export function finiteNumberOr(value: any, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}
    // @ts-ignore
export function nonNegativeNumberOr(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}
    // @ts-ignore
    // @ts-ignore
export function boundedNonNegativeNumberOr(value: any, max: any, fallback = 0) {
  return Math.min(max, nonNegativeNumberOr(value, fallback));
}
    // @ts-ignore
    // @ts-ignore
export function boundedString(value: any, maxLength: any, fallback = "") {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}
    // @ts-ignore
    // @ts-ignore
export function boundedNonEmptyString(value: any, maxLength: any, fallback = "") {
  const normalized = boundedString(value, maxLength);
  return normalized || fallback;
}
export function defaultMeasurement(provider = "generic", model = "unknown") {
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
    // @ts-ignore
export function normalizeMeasurement(value: any, fallback = {}) {
    // @ts-ignore
    // @ts-ignore
  const base = defaultMeasurement(fallback.provider, fallback.model);
  const raw = isPlainObject(value) ? value : {};
  const levels = ["authoritative", "deterministic", "calibrated_estimate", "approximation", "unknown"];
  const rawLevel = typeof raw.measurementLevel === "string" ? raw.measurementLevel.toLowerCase() : "";
  const unverifiedAuthoritativeClaim = rawLevel === "authoritative";
  return {
    ...base,
    schemaVersion: clamp(Math.floor(finiteNumberOr(raw.schemaVersion, base.schemaVersion)), 1, 100),
    // @ts-ignore
    measurementMethod: boundedNonEmptyString(raw.measurementMethod, 80, fallback.measurementMethod ?? base.measurementMethod),
    // @ts-ignore
    measurementLevel: unverifiedAuthoritativeClaim ? "unknown" : levels.includes(rawLevel) ? rawLevel : fallback.measurementLevel ?? base.measurementLevel,
    // @ts-ignore
    confidence: unverifiedAuthoritativeClaim ? 0 : clamp(finiteNumberOr(raw.confidence, fallback.confidence ?? base.confidence), 0, 1),
    // @ts-ignore
    errorMarginPercent: unverifiedAuthoritativeClaim ? 100 : clamp(nonNegativeNumberOr(raw.errorMarginPercent, fallback.errorMarginPercent ?? base.errorMarginPercent), 0, 1000),
    // @ts-ignore
    provider: boundedNonEmptyString(raw.provider, 64, fallback.provider ?? base.provider),
    // @ts-ignore
    model: boundedNonEmptyString(raw.model, 120, fallback.model ?? base.model),
    tokenizer: boundedNonEmptyString(raw.tokenizer, 80, base.tokenizer),
    // @ts-ignore
    source: boundedNonEmptyString(raw.source, 160, fallback.source ?? base.source),
    note: unverifiedAuthoritativeClaim ? "Provider-authoritative metadata was downgraded until a verified adapter is connected." : boundedNonEmptyString(raw.note, 240, base.note)
  };
}
    // @ts-ignore
export function normalizePromptSections(value: any) {
  const sectionTypes = ["prose", "instruction", "quote", "code", "url", "attachment"];
  return Array.isArray(value) ? value.slice(0, 50).filter(isPlainObject).map((section) => ({
    label: boundedNonEmptyString(section.label, 160, "section"),
    type: sectionTypes.includes(section.type) ? section.type : "prose",
    tokens: boundedNonNegativeNumberOr(section.tokens, 4_000_000)
  })) : [];
}
    // @ts-ignore
export function normalizePromptSuggestions(value: any) {
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
    // @ts-ignore
export function normalizePromptTextList(value: any, maxItems = 6, maxLength = 2_000) {
  return Array.isArray(value) ? value.slice(0, maxItems).filter((item) => typeof item === "string").map((item) => boundedString(item, maxLength)).filter(Boolean) : [];
}
    // @ts-ignore
export function normalizePromptVariants(value: any) {
  const variants = isPlainObject(value) ? value : {};
  return {
    shorter: boundedString(variants.shorter, 250_000),
    balanced: boundedString(variants.balanced, 250_000),
    maxDetail: boundedString(variants.maxDetail, 250_000)
  };
}
    // @ts-ignore
export function boundedFutureTimestamp(value: any, maxFutureDays = 366) {
  if (!Number.isFinite(value) || value <= 0) return void 0;
  return Math.min(value, Date.now() + maxFutureDays * 864e5);
}
    // @ts-ignore
export function normalizeSessionResetRule(value: any) {
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
    // @ts-ignore
export function normalizeResetPrediction(value: any) {
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
    // @ts-ignore
export function normalizeSessionQuota(value: any) {
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
    // @ts-ignore
export function timestampOr(value: any, fallback = Date.now()) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, Date.now() + 5 * 60_000);
}
export function createEmptySessions(): Record<ProviderId, ReturnType<typeof normalizeSession> | undefined> {
  return {
    chatgpt: void 0,
    claude: void 0,
    gemini: void 0,
    perplexity: void 0,
    grok: void 0,
    generic: void 0
  };
}
    // @ts-ignore
    // @ts-ignore
export function mergeSiteSettings(site: any, partialSite: any) {
    // @ts-ignore
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
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
export function optionalNumberInRange(value: any, min: any, max: any) {
  return Number.isFinite(value) ? clamp(value, min, max) : void 0;
}
    // @ts-ignore
export function mergePreferences(partial: any): UserPreferences {
  const partialPreferences = isPlainObject(partial) ? partial : {};
  const partialAlerts = isPlainObject(partialPreferences.alerts) ? partialPreferences.alerts : {};
  const sites = Object.fromEntries(Object.keys(DEFAULT_PREFERENCES.sites).map((site) => [
    site,
    mergeSiteSettings(site, partialPreferences.sites?.[site])
  ])) as UserPreferences["sites"];
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
    // @ts-ignore
export function normalizeNotificationTimestamps(raw: any) {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([, timestamp]) => Number.isFinite(timestamp)));
}
    // @ts-ignore
export function buildUsageEventKeyMap(events: any) {
  const keys = {};
  for (const event of events) {
    // @ts-ignore
    keys[usageEventIdentity(event)] = true;
  }
  return keys;
}
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
export function normalizeUsageEventKeys(raw: any, usageEvents: any) {
  return buildUsageEventKeyMap(usageEvents);
}
    // @ts-ignore
    // @ts-ignore
export function hasUsageEventKey(keys: any, key: any) {
  return Object.prototype.hasOwnProperty.call(keys, key);
}
    // @ts-ignore
export function normalizeSession(session: any) {
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
    // @ts-ignore
      contextGrowth: Array.isArray(currentThread.contextGrowth) ? currentThread.contextGrowth.slice(-25).filter(Number.isFinite).map((value: any) => boundedNonNegativeNumberOr(value, 16_000_000)) : []
    } : void 0,
    quota: normalizeSessionQuota(quota),
    lastUpdated: timestampOr(session.lastUpdated),
    lastSeenUrl: boundedString(session.lastSeenUrl, 2_048),
    adapterConfidence: clamp(finiteNumberOr(session.adapterConfidence, 0), 0, 1)
  };
}
    // @ts-ignore
export function normalizeSessions(rawSessions: any): ReturnType<typeof createEmptySessions> {
  const sessions = createEmptySessions();
  for (const site of Object.keys(sessions)) {
    // @ts-ignore
    sessions[site] = normalizeSession(rawSessions?.[site]);
  }
  return sessions;
}
    // @ts-ignore
export function usageEventIdentity(event: any) {
  return event?.id ? `id:${event.id}` : `legacy:${event?.site ?? "unknown"}:${event?.threadId ?? "default"}:${event?.timestamp ?? 0}:${event?.promptPreview ?? ""}`;
}
    // @ts-ignore
export function normalizeUsageEvent(event: any) {
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
    // @ts-ignore
export function normalizeUsageEvents(rawEvents: any): Array<NonNullable<ReturnType<typeof normalizeUsageEvent>>> {
  const seen = /* @__PURE__ */ new Set();
  return (Array.isArray(rawEvents) ? rawEvents : []).map(normalizeUsageEvent).filter((event): event is NonNullable<ReturnType<typeof normalizeUsageEvent>> => event !== undefined).filter((event) => {
    const key = usageEventIdentity(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
    // @ts-ignore
    // @ts-ignore
  }).sort((a, b) => a.timestamp - b.timestamp).slice(-HISTORY_LIMIT);
}
    // @ts-ignore
    // @ts-ignore
export function appendUsageEvent(events: any, event: any) {
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
    // @ts-ignore
    // @ts-ignore
export function isTrackingEnabled(preferences: any, site: any) {
  return isKnownSite(site) && preferences.sites?.[site]?.enabled === true;
}
    // @ts-ignore
export function sessionFingerprint(session: any) {
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
    // @ts-ignore
export function rebuildThreads(events: any, fallbackThreads = {}) {
  if (!events.length) return fallbackThreads ?? {};
  let threads = {};
  for (const event of events) {
    threads = upsertThread(threads, event);
  }
  return threads;
}
    // @ts-ignore
export function hydrateState(raw: any) {
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
export async function readStateFromStorage() {
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
export async function getState(): Promise<ReturnType<typeof hydrateState>> {
  return enqueueStateOperation(() => readStateFromStorage());
}
export var _lastSyncedPreferencesJson = "";
    // @ts-ignore
export async function writeStateToStorage(state: any) {
  const hydrated = hydrateState(state);
  await storageSet({ [STATE_KEY]: hydrated });
  const sync = syncArea();
  if (sync) {
    if (hydrated.preferences.privacyMode === "sync-preferences") {
      const prefJson = JSON.stringify(hydrated.preferences);
      if (prefJson !== _lastSyncedPreferencesJson) {
        await sync.set({ [PREFERENCES_SYNC_KEY]: hydrated.preferences });
        _lastSyncedPreferencesJson = prefJson;
      }
    } else {
      await sync.remove(PREFERENCES_SYNC_KEY);
      _lastSyncedPreferencesJson = "";
    }
  }
  return hydrated;
}
    // @ts-ignore
export async function saveState(state: any) {
  return enqueueStateOperation(() => writeStateToStorage(state));
}
    // @ts-ignore
export async function updateState(mutator: any) {
  return enqueueStateOperation(async () => {
    const current = await readStateFromStorage();
    const next = await mutator(structuredClone(current));
    return writeStateToStorage(next);
  });
}
    // @ts-ignore
export async function savePreferences(preferences: any) {
    // @ts-ignore
  return updateState(async (state: any) => {
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
    // @ts-ignore
export async function saveSession(session: any) {
  let savedSession;
    // @ts-ignore
  const state = await updateState(async (state2: any) => {
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
    // @ts-ignore
    // @ts-ignore
export function threadKey(site: any, threadId: any) {
  return `${site}:${threadId || "default"}`;
}
    // @ts-ignore
    // @ts-ignore
export function upsertThread(threads: any, event: any) {
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
    // @ts-ignore
export async function recordUsageEvent(event: any) {
  let recorded = false;
  let savedEvent;
    // @ts-ignore
  const state = await updateState(async (state2: any) => {
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
    // @ts-ignore
    // @ts-ignore
export function sessionMatchesUrl(session: any, activeUrl: any) {
  if (!session?.lastSeenUrl || !activeUrl) return false;
  try {
    return new URL(session.lastSeenUrl).hostname === new URL(activeUrl).hostname;
  } catch {
    return false;
  }
}
    // @ts-ignore
    // @ts-ignore
export function buildSnapshot(state: any, activeUrl: any) {
  const generatedAt = Date.now();
  const analytics = getSnapshotAnalytics(state, generatedAt);
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
  const sessions = Object.values(state.sessions).filter((session) => session && isTrackingEnabled(state.preferences, session.site)).sort((a, b) => b.lastUpdated - a.lastUpdated);
  const currentSession = (() => {
    if (!activeUrl) return sessions[0];
    return sessions.find((session) => sessionMatchesUrl(session, activeUrl)) ?? sessions[0];
  })();
  const today = analytics.byDay.at(-1);
    // @ts-ignore
    // @ts-ignore
  const tokensThisWeek = analytics.byDay.slice(-7).reduce((acc: any, day: any) => acc + day.tokens, 0);
    // @ts-ignore
    // @ts-ignore
  const costThisWeek = analytics.byDay.slice(-7).reduce((acc: any, day: any) => acc + day.cost, 0);
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
    // @ts-ignore
    // @ts-ignore
    recentThreads: Object.values(state.threads).sort((a, b) => b.lastUpdated - a.lastUpdated).slice(0, 10),
    generatedAt
  };
}
export async function exportState() {
  return getState();
}
    // @ts-ignore
export async function importState(state: any) {
  invalidateSnapshotAnalytics();
  return saveState(hydrateState(state));
}
export async function clearLocalHistory() {
  invalidateSnapshotAnalytics();
    // @ts-ignore
  return updateState(async (state: any) => ({
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

