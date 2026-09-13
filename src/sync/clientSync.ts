import type { CloudConnectionConfig, UsageEventRecord } from "../types/state.js";
import { buildAllowedCloudUsageEvent } from "../privacy/allowlist.js";
import { appendUsageEvent, getUsageEvents } from "../storage/domains.js";

const MAX_BATCH_EVENTS = 100;
const MAX_BATCH_BYTES = 256 * 1024; // 256 KB safety bound
const MAX_PAGES_PER_SYNC = 10;

export async function runCloudSync(
  config: CloudConnectionConfig,
  saveConfig: (updated: CloudConnectionConfig) => Promise<void>
): Promise<{ syncedEvents: number; quota?: any }> {
  if (!config.apiBaseUrl || !config.installId) {
    throw new Error("Cloud connection is not configured");
  }

  const events = await getUsageEvents();
  const unSynced = events.filter((e) => !config.syncedClientEventIds[e.clientEventId]);

  let totalUploaded = 0;

  // 1. Upload unsynced events in byte-bounded and count-bounded batches
  if (unSynced.length > 0) {
    let currentBatch: any[] = [];
    let currentBatchBytes = 0;

    for (const event of unSynced) {
      const allowedPayload = buildAllowedCloudUsageEvent(event);
      const serialized = JSON.stringify(allowedPayload);
      const byteSize = new TextEncoder().encode(serialized).length;

      if (
        currentBatch.length >= MAX_BATCH_EVENTS ||
        currentBatchBytes + byteSize > MAX_BATCH_BYTES
      ) {
        await uploadBatch(config, currentBatch);
        totalUploaded += currentBatch.length;
        for (const item of currentBatch) {
          config.syncedClientEventIds[item.clientEventId] = true;
        }
        currentBatch = [];
        currentBatchBytes = 0;
      }

      currentBatch.push(allowedPayload);
      currentBatchBytes += byteSize;
    }

    if (currentBatch.length > 0) {
      await uploadBatch(config, currentBatch);
      totalUploaded += currentBatch.length;
      for (const item of currentBatch) {
        config.syncedClientEventIds[item.clientEventId] = true;
      }
    }
  }

  // 2. Fetch remote state with cursor pagination loop (NEVER stuck on page 1!)
  let cursor = config.lastSyncCursor || undefined;
  let pagesFetched = 0;
  let hasMore = true;

  while (hasMore && pagesFetched < MAX_PAGES_PER_SYNC) {
    pagesFetched += 1;
    const response: any = await cloudApiRequest(config, "/v1/sync/state", {
      method: "POST",
      body: JSON.stringify({
        includeUsage: true,
        maxEvents: 100,
        cursor
      })
    });

    if (response?.usageEvents && Array.isArray(response.usageEvents)) {
      for (const remoteEvent of response.usageEvents) {
        if (!config.syncedClientEventIds[remoteEvent.clientEventId]) {
          config.syncedClientEventIds[remoteEvent.clientEventId] = true;
          await appendUsageEvent(normalizeRemoteUsageEvent(remoteEvent));
        }
      }
    }

    hasMore = Boolean(response?.usagePage?.hasMore);
    cursor = response?.usagePage?.nextCursor || undefined;
    config.lastSyncCursor = cursor ?? null;
  }

  // 3. Fetch current account Yor quota
  const quotaResponse: any = await cloudApiRequest(config, "/v1/quota/check", {
    method: "GET"
  });

  config.quota = {
    usedTokens: quotaResponse?.usedTokens,
    tokenCap: quotaResponse?.tokenCap,
    remainingTokens: quotaResponse?.remainingTokens,
    limited: quotaResponse?.limited,
    periodEnd: quotaResponse?.periodEnd
  };
  config.lastSyncedAt = Date.now();
  config.lastError = undefined;

  await saveConfig(config);
  return { syncedEvents: totalUploaded, quota: config.quota };
}

async function uploadBatch(config: CloudConnectionConfig, events: any[]): Promise<void> {
  await cloudApiRequest(config, "/v1/usage/events/batch", {
    method: "POST",
    body: JSON.stringify({ events })
  });
}

async function cloudApiRequest(config: CloudConnectionConfig, path: string, options: RequestInit): Promise<any> {
  const url = `${config.apiBaseUrl.replace(/\/+$/, "")}${path}`;
  const headers = new Headers(options.headers || {});
  headers.set("content-type", "application/json");
  headers.set("x-install-id", config.installId);
  headers.set("x-extension-id", typeof chrome !== "undefined" && chrome.runtime?.id ? chrome.runtime.id : "local-extension");
  if (config.deviceName) {
    headers.set("x-device-name", config.deviceName);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloud API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

function normalizeRemoteUsageEvent(raw: any): UsageEventRecord {
  return {
    id: raw.id || raw.clientEventId,
    clientEventId: raw.clientEventId,
    site: raw.provider,
    model: raw.model,
    threadId: raw.threadId || "",
    timestamp: new Date(raw.occurredAt).getTime(),
    promptTokens: raw.promptTokens,
    outputTokens: raw.outputTokens,
    totalTokens: raw.totalTokens,
    promptChars: 0,
    outputChars: 0,
    status: raw.status?.toLowerCase() || "completed",
    accuracy: raw.accuracy?.toLowerCase() || "estimated",
    measurement: {
      schemaVersion: raw.schemaVersion || 2,
      measurementMethod: raw.measurementMethod || "cloud-sync",
      measurementLevel: raw.measurementLevel || "calibrated_estimate",
      confidenceTier: "Moderate confidence",
      confidence: raw.confidence ?? 0.7,
      errorMarginPercent: raw.errorMarginPercent ?? 20,
      provider: raw.provider,
      model: raw.model,
      tokenizer: raw.tokenizer || "none",
      source: raw.source || "server-synced event"
    }
  };
}
