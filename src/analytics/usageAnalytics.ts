import { SITE_LABELS, modelLabelForDisplay, DEFAULT_PREFERENCES } from '../lib/constants.js';
import { calculateCost } from '../models/registry.js';
import { average, median, groupBy, toDateKey, startOfLocalDay, previousLocalDayStart, startOfLocalWeek } from '../lib/utils.js';
import { usageEventIdentity } from '../storage/store.js';

    // @ts-ignore
export function eventCost(event: any, preferences: any) {
  const breakdown = calculateCost(event.promptTokens, event.outputTokens, event.model, event.site);
  return breakdown.totalCost || 0;
}
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
export function fillWindow(start: any, count: any, stepMs: any, values: any) {
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
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
export function aggregateBy(events: any, keyFn: any, preferences: any, labelFn: any) {
  const groups = groupBy(events, keyFn);
  return Object.entries(groups).map(([key, group]) => {
    const entries = group;
    return {
      id: key,
      label: labelFn(key),
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
      tokens: entries.reduce((acc: any, event: any) => acc + event.totalTokens, 0),
    // @ts-ignore
      prompts: entries.length,
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
      cost: entries.reduce((acc: any, event: any) => acc + eventCost(event, preferences), 0)
    };
  }).sort((a, b) => b.tokens - a.tokens);
}
    // @ts-ignore
export function calculateStreak(events: any, now = Date.now()) {
  if (!events.length) return 0;
    // @ts-ignore
  const usedDays = new Set(events.map((event: any) => startOfLocalDay(event.timestamp)));
  let streak = 0;
  const today = startOfLocalDay(now);
  let cursor = usedDays.has(today) ? today : previousLocalDayStart(today);
  while (usedDays.has(cursor)) {
    streak += 1;
    cursor = previousLocalDayStart(cursor);
  }
  return streak;
}
    // @ts-ignore
export function robustTokenBaseline(values: any) {
    // @ts-ignore
  return median(values.filter((value: any) => value > 0));
}
    // @ts-ignore
    // @ts-ignore
export function detectTokenAnomalies(events: any, preferences: any) {
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
    // @ts-ignore
    // @ts-ignore
export function buildAnalytics(events: any, preferences: any, now = Date.now()) {
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
    // @ts-ignore
  const byModel = aggregateBy(sorted, (event: any) => event.model, preferences, modelLabelForDisplay);
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
  const bySite = aggregateBy(sorted, (event: any) => event.site, preferences, (key: any) => SITE_LABELS[key] ?? key);
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
    // @ts-ignore
export var snapshotAnalyticsCache;
    // @ts-ignore
export function analyticsEventKey(event: any) {
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
    // @ts-ignore
export function analyticsPreferencesKey(preferences: any) {
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
    // @ts-ignore
    // @ts-ignore
export function analyticsCacheKey(state: any, now: any) {
  const events = state.usageEvents;
  return [
    toDateKey(now),
    events.length,
    analyticsEventKey(events[0]),
    analyticsEventKey(events[events.length - 1]),
    analyticsPreferencesKey(state.preferences)
  ].join("||");
}
    // @ts-ignore
    // @ts-ignore
export function getSnapshotAnalytics(state: any, now: any) {
  const key = analyticsCacheKey(state, now);
  if (snapshotAnalyticsCache?.key === key) {
    return snapshotAnalyticsCache.analytics;
  }
  const analytics = buildAnalytics(state.usageEvents, state.preferences, now);
  snapshotAnalyticsCache = { key, analytics };
  return analytics;
}
export function invalidateSnapshotAnalytics() {
  snapshotAnalyticsCache = void 0;
}

