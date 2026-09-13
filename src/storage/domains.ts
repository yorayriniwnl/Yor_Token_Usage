import type { ThreadAggregate, UsageEventRecord, UserPreferences } from "../types/state.js";

export const PREFERENCES_KEY = "yor_preferences";
export const USAGE_EVENTS_KEY = "yor_usage_events";
export const THREADS_KEY = "yor_threads";
export const CLOUD_CONFIG_KEY = "yor_cloud_config";
export const SYNC_PREFERENCES_KEY = "yor_sync_preferences";
export const MAX_USAGE_EVENTS = 2500;

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  compactMode: false,
  privacyMode: "local-only",
  dataMode: "device-only",
  showOverlay: true,
  alerts: {
    quotaWarningPercent: 80,
    largePromptTokens: 2500,
    anomalyMultiplier: 2.5,
    desktopNotifications: true,
    badgeMode: "percent"
  },
  sites: {
    chatgpt: {
      enabled: true,
      resetRule: { kind: "rolling", intervalMinutes: 180, inferred: true, description: "Inferred rolling window." }
    },
    claude: {
      enabled: true,
      resetRule: { kind: "rolling", intervalMinutes: 300, inferred: true, description: "Inferred rolling window." }
    },
    gemini: {
      enabled: true,
      resetRule: { kind: "daily", anchorLocalTime: "00:00", inferred: true, description: "Inferred daily reset." }
    },
    perplexity: {
      enabled: true,
      resetRule: { kind: "rolling", intervalMinutes: 240, inferred: true, description: "Inferred rolling window." }
    },
    grok: {
      enabled: true,
      resetRule: { kind: "rolling", intervalMinutes: 120, inferred: true, description: "Inferred rolling window." }
    },
    generic: {
      enabled: true,
      resetRule: { kind: "rolling", intervalMinutes: 180, inferred: true, description: "Generic rolling window." }
    }
  },
  budgetAlertThreshold: 80,
  expectedOutputSizeDefault: 500,
  anchorPosition: "below-composer"
};

// In-memory cache for fast, non-blocking synchronous reads
let cachedPreferences: UserPreferences | null = null;
let lastSyncedPreferencesJson = "";

function getStorageArea(area: "local" | "sync" | "session"): chrome.storage.StorageArea | null {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage[area]) {
    return chrome.storage[area];
  }
  return null;
}

/**
 * Reads preferences with in-memory caching and sync fallback.
 */
export async function getPreferences(): Promise<UserPreferences> {
  if (cachedPreferences) return { ...cachedPreferences };

  const local = getStorageArea("local");
  let prefs: UserPreferences = { ...DEFAULT_PREFERENCES };

  if (local) {
    const res = await local.get(PREFERENCES_KEY);
    if (res[PREFERENCES_KEY]) {
      prefs = { ...prefs, ...res[PREFERENCES_KEY] };
    }
  }

  // If sync preferences mode is enabled, check chrome.storage.sync
  if (prefs.privacyMode === "sync-preferences") {
    const sync = getStorageArea("sync");
    if (sync) {
      try {
        const syncRes = await sync.get(SYNC_PREFERENCES_KEY);
        if (syncRes[SYNC_PREFERENCES_KEY]) {
          prefs = { ...prefs, ...syncRes[SYNC_PREFERENCES_KEY] };
          lastSyncedPreferencesJson = JSON.stringify(prefs);
        }
      } catch (err) {
        console.warn("Could not load from chrome.storage.sync:", err);
      }
    }
  }

  cachedPreferences = prefs;
  return { ...prefs };
}

/**
 * Saves preferences with strict DIRTY CHECKING:
 * Only writes to chrome.storage.sync when the preferences actually changed!
 * Never called on typing or turn capture!
 */
export async function savePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
  const current = await getPreferences();
  const next: UserPreferences = {
    ...current,
    ...updates,
    sites: { ...current.sites, ...(updates.sites || {}) }
  };
  cachedPreferences = next;

  const local = getStorageArea("local");
  if (local) {
    await local.set({ [PREFERENCES_KEY]: next });
  }

  // Dirty checking for chrome.storage.sync
  const nextJson = JSON.stringify(next);
  if (next.privacyMode === "sync-preferences") {
    if (nextJson !== lastSyncedPreferencesJson) {
      const sync = getStorageArea("sync");
      if (sync) {
        try {
          await sync.set({ [SYNC_PREFERENCES_KEY]: next });
          lastSyncedPreferencesJson = nextJson;
        } catch (err) {
          console.warn("Failed to write to chrome.storage.sync quota:", err);
        }
      }
    }
  } else if (lastSyncedPreferencesJson) {
    // If switched off sync mode, remove once
    const sync = getStorageArea("sync");
    if (sync) {
      try {
        await sync.remove(SYNC_PREFERENCES_KEY);
        lastSyncedPreferencesJson = "";
      } catch {
        // ignore
      }
    }
  }

  return { ...next };
}

/**
 * Incremental Usage Event Appending:
 * Only persists the new event. Bounded at 2,500 items max.
 * NEVER rewrites on typing.
 */
export async function appendUsageEvent(event: UsageEventRecord): Promise<void> {
  const local = getStorageArea("local");
  if (!local) return;

  const res = await local.get(USAGE_EVENTS_KEY);
  const existing: UsageEventRecord[] = Array.isArray(res[USAGE_EVENTS_KEY]) ? res[USAGE_EVENTS_KEY] : [];
  existing.push(event);

  // Maintain sliding window limit of 2,500 items
  const trimmed = existing.length > MAX_USAGE_EVENTS ? existing.slice(-MAX_USAGE_EVENTS) : existing;
  await local.set({ [USAGE_EVENTS_KEY]: trimmed });

  // Update thread aggregate incrementally
  if (event.threadId) {
    await updateThreadAggregate(event.threadId, event.site, event.model, event.totalTokens);
  }
}

export async function getUsageEvents(): Promise<UsageEventRecord[]> {
  const local = getStorageArea("local");
  if (!local) return [];
  const res = await local.get(USAGE_EVENTS_KEY);
  return Array.isArray(res[USAGE_EVENTS_KEY]) ? res[USAGE_EVENTS_KEY] : [];
}

export async function clearUsageEvents(): Promise<void> {
  const local = getStorageArea("local");
  if (local) {
    await local.set({ [USAGE_EVENTS_KEY]: [], [THREADS_KEY]: {} });
  }
}

async function updateThreadAggregate(
  threadId: string,
  site: string,
  model: string,
  turnTokens: number
): Promise<void> {
  const local = getStorageArea("local");
  if (!local) return;

  const res = await local.get(THREADS_KEY);
  const threads: Record<string, ThreadAggregate> = (res[THREADS_KEY] as Record<string, ThreadAggregate>) || {};
  const current = threads[threadId] || {
    id: threadId,
    site: site as any,
    model,
    messageCount: 0,
    totalTokens: 0,
    lastUpdated: Date.now()
  };

  threads[threadId] = {
    ...current,
    model,
    messageCount: current.messageCount + 1,
    totalTokens: current.totalTokens + turnTokens,
    lastUpdated: Date.now()
  };

  await local.set({ [THREADS_KEY]: threads });
}

export async function getThreadAggregates(): Promise<Record<string, ThreadAggregate>> {
  const local = getStorageArea("local");
  if (!local) return {};
  const res = await local.get(THREADS_KEY);
  return (res[THREADS_KEY] as Record<string, ThreadAggregate>) || {};
}
