import type { ProviderId } from "./models.js";
import type { DraftAnalysis, ThreadContextAccounting, TokenMeasurementMetadata } from "./tokens.js";
import type { ObservedQuotaSignal } from "./adapters.js";

export interface ResetRule {
  kind: "rolling" | "hourly" | "daily" | "weekly" | "custom" | "unknown";
  intervalMinutes?: number;
  anchorLocalTime?: string;
  dayOfWeek?: number;
  inferred: boolean;
  description?: string;
}

export interface SitePreference {
  enabled: boolean;
  tokenBudget?: number;
  contextWindow?: number;
  quotaTierLabel?: string;
  costInputPer1k?: number;
  costOutputPer1k?: number;
  resetRule: ResetRule;
}

export interface AlertsPreferences {
  quotaWarningPercent: number;
  largePromptTokens: number;
  anomalyMultiplier: number;
  desktopNotifications: boolean;
  badgeMode: "percent" | "remaining" | "off";
}

export interface UserPreferences {
  theme: "dark" | "light" | "system";
  compactMode?: boolean;
  privacyMode: "local-only" | "sync-preferences";
  dataMode?: "device-only" | "cloud-sync";
  sites: Record<ProviderId, SitePreference>;
  showOverlay: boolean;
  alerts: AlertsPreferences;
  budgetAlertThreshold?: number;
  expectedOutputSizeDefault?: number;
  anchorPosition?: "below-composer" | "above-composer" | "viewport-bottom";
}

export interface LiveTabSession {
  tabId: number;
  site: ProviderId;
  threadId: string;
  model: string;
  currentDraft: string;
  draftAnalysis: DraftAnalysis;
  contextAccounting: ThreadContextAccounting;
  quotaSignal: ObservedQuotaSignal | null;
  lastUpdated: number;
}

export interface UsageEventRecord {
  id: string;
  clientEventId: string;
  site: ProviderId;
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
  measurement: TokenMeasurementMetadata;
}

export interface ThreadAggregate {
  id: string;
  site: ProviderId;
  model: string;
  messageCount: number;
  totalTokens: number;
  lastUpdated: number;
}

export interface CloudQuotaState {
  usedTokens?: number;
  tokenCap?: number;
  remainingTokens?: number;
  limited?: boolean;
  periodEnd?: string;
}

export interface CloudConnectionConfig {
  apiBaseUrl: string;
  installId: string;
  deviceName: string;
  lastSyncedAt?: number;
  lastError?: string;
  lastSyncCursor?: string | null;
  quota?: CloudQuotaState;
  syncedEventKeys: Record<string, boolean>;
  syncedClientEventIds: Record<string, boolean>;
}

export interface StoredAppState {
  version: number;
  preferences: UserPreferences;
  usageEvents: UsageEventRecord[];
  threads: Record<string, ThreadAggregate>;
}
