import { CLOUD_CONFIG_KEY, CLOUD_SESSION_KEY, HISTORY_LIMIT, CLOUD_MAX_BATCHES_PER_SYNC, CLOUD_EVENT_MAX_AGE_MS } from '../lib/constants.js';
import { isPlainObject, boundedNonNegativeNumberOr, boundedString, normalizeMeasurement, hasUsageEventKey, usageEventIdentity, normalizeUsageEvent, appendUsageEvent, upsertThread, storageGet, storageSet, sessionStorageGet, sessionStorageSet, sessionStorageRemove, getState, updateState } from '../storage/store.js';

    // @ts-ignore
export function normalizeCloudBaseUrl(value: any) {
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
    // @ts-ignore
export function normalizeCloudKeyMap(value: any) {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, status]) => {
    return typeof key === "string" && key.length <= 512 && (status === true || status === "expired");
  }).slice(-HISTORY_LIMIT * 2));
}
    // @ts-ignore
export function normalizeCloudConfig(raw: any) {
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
export async function readCloudConfig() {
  return normalizeCloudConfig(await storageGet(CLOUD_CONFIG_KEY));
}
    // @ts-ignore
export async function writeCloudConfig(config: any) {
  const normalized = normalizeCloudConfig(config);
  await storageSet({ [CLOUD_CONFIG_KEY]: normalized });
  return normalized;
}
export async function readCloudAccessToken() {
  const session = await sessionStorageGet(CLOUD_SESSION_KEY);
  return isPlainObject(session) && typeof session.accessToken === "string" ? session.accessToken : "";
}
    // @ts-ignore
export function normalizeCloudAccessToken(accessToken: any) {
  const token = boundedString(accessToken, 8192).trim();
  if (token.length < 20 || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new Error("Enter a valid short-lived OIDC access token.");
  }
  return token;
}
    // @ts-ignore
export async function writeCloudAccessToken(accessToken: any) {
  const token = normalizeCloudAccessToken(accessToken);
  await sessionStorageSet({ [CLOUD_SESSION_KEY]: { accessToken: token } });
}
export function createCloudInstallId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `install-${crypto.randomUUID()}`;
  }
  return `install-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
export function createCloudConnectionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `session-${crypto.randomUUID()}`;
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}
    // @ts-ignore
export function assertInternalExtensionSender(sender: any) {
  const senderUrl = sender?.url ?? sender?.tab?.url;
  const extensionRoot = chrome.runtime.getURL("");
  if (typeof senderUrl !== "string" || !senderUrl.startsWith(extensionRoot)) {
    throw new Error("Cloud account controls are available only from Yor settings.");
  }
}
    // @ts-ignore
export function cloudDeviceHeaders(config: any) {
  const manifest = chrome.runtime.getManifest?.() ?? {};
  const runtimeNavigator = typeof navigator !== "undefined" ? navigator : {};
  return {
    "x-install-id": config.installId,
    "x-extension-id": chrome.runtime.id,
    "x-extension-version": boundedString(manifest.version, 64, "unknown"),
    "x-browser": "chromium",
    // @ts-ignore
    // @ts-ignore
    "x-platform": boundedString(runtimeNavigator.userAgentData?.platform ?? runtimeNavigator.platform, 64, "unknown")
  };
}
export class CloudRequestError extends Error {
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
  constructor(message: any, statusCode: any, code: any) {
    super(message);
    this.name = "CloudRequestError";
    // @ts-ignore
    this.statusCode = statusCode;
    // @ts-ignore
    this.code = code;
  }
}
export var cloudConnectionGeneration = 0;
export var activeCloudControllers = /* @__PURE__ */ new Set();
export function cancelActiveCloudRequests() {
    // @ts-ignore
  for (const controller of activeCloudControllers) controller.abort();
  activeCloudControllers.clear();
}
export function cloudOperationCancelled() {
  return new CloudRequestError("Cloud operation was cancelled because the account connection changed.", 409, "cloud_operation_cancelled");
}
    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
export async function writeCloudConfigForConnection(config: any, connectionId: any, generation: any) {
  if (generation !== cloudConnectionGeneration) throw cloudOperationCancelled();
  const current = await readCloudConfig();
  if (generation !== cloudConnectionGeneration || !current.enabled || current.connectionId !== connectionId) {
    throw cloudOperationCancelled();
  }
  return writeCloudConfig({ ...config, enabled: true, connectionId });
}
    // @ts-ignore
    // @ts-ignore
export async function cloudRequest(config: any, path: any, options = {}) {
  const accessToken = await readCloudAccessToken();
  if (!accessToken) throw new CloudRequestError("Cloud session expired. Connect again with a fresh access token.", 401, "cloud_session_missing");
  const controller = new AbortController();
  activeCloudControllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
    // @ts-ignore
      method: options.method ?? "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        ...cloudDeviceHeaders(config),
    // @ts-ignore
        ...(options.body !== void 0 ? { "content-type": "application/json" } : {}),
    // @ts-ignore
        ...(options.headers ?? {})
      },
    // @ts-ignore
    // @ts-ignore
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
    // @ts-ignore
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
    // @ts-ignore
export async function sha256HexString(value: any) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
    // @ts-ignore
export async function toCloudUsageEvent(event: any) {
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
    // @ts-ignore
export function fromCloudUsageEvent(remoteEvent: any) {
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
    // @ts-ignore
    // @ts-ignore
export async function mergeCloudUsageEvents(remoteEvents: any, config: any) {
  const candidates = (Array.isArray(remoteEvents) ? remoteEvents : []).map(fromCloudUsageEvent).filter(Boolean).filter((entry) => {
    // @ts-ignore
    return !Object.prototype.hasOwnProperty.call(config.syncedClientEventIds, entry.clientEventId);
  });
  if (!candidates.length) return config;
  const imported = [];
    // @ts-ignore
  await updateState(async (state: any) => {
    const usageEventKeys = state.meta.usageEventKeys ?? {};
    for (const entry of candidates) {
    // @ts-ignore
      const eventKey = usageEventIdentity(entry.event);
    // @ts-ignore
      config.syncedClientEventIds[entry.clientEventId] = true;
      if (hasUsageEventKey(usageEventKeys, eventKey)) continue;
    // @ts-ignore
      const appendResult = appendUsageEvent(state.usageEvents, entry.event);
      if (!appendResult.retained) continue;
      usageEventKeys[eventKey] = true;
      for (const evictedEvent of appendResult.evictedEvents) {
        delete usageEventKeys[usageEventIdentity(evictedEvent)];
      }
    // @ts-ignore
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
export async function getCloudStatus() {
  const [config, accessToken, state] = await Promise.all([readCloudConfig(), readCloudAccessToken(), getState()]);
    // @ts-ignore
    // @ts-ignore
  const pendingEvents = config.enabled ? state.usageEvents.filter((event: any) => {
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
    // @ts-ignore
    // @ts-ignore
export async function connectCloudSession(apiBaseUrl: any, accessToken: any) {
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
    // @ts-ignore
      await writeCloudConfig({ ...current, lastError: boundedString(error?.message, 240) });
    }
    throw error;
  }
}
export async function disconnectCloudSession() {
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
    // @ts-ignore
export async function recordCloudSyncFailure(error: any) {
  const config = await readCloudConfig();
  if (!config.enabled || error?.code === "cloud_operation_cancelled") return;
  if (error?.cloudConnectionId && error.cloudConnectionId !== config.connectionId) return;
  await writeCloudConfig({ ...config, lastError: boundedString(error?.message, 240, "Cloud sync failed.") });
}
export var cloudSyncQueue = Promise.resolve();
    // @ts-ignore
export async function runCloudSync(generation: any) {
  let config = await readCloudConfig();
  const accessToken = await readCloudAccessToken();
  if (!config.enabled || !accessToken) return getCloudStatus();
  const connectionId = config.connectionId;
  try {
    if (generation !== cloudConnectionGeneration) throw cloudOperationCancelled();
    const state = await getState();
    const cutoff = Date.now() - CLOUD_EVENT_MAX_AGE_MS + 60_000;
    const eligible = [];
    // @ts-ignore
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

    var CLOUD_SYNC_MAX_PAGES = 10;
    // @ts-ignore
    var allRemoteEvents = [];
    var syncCursor = void 0;
    for (var syncPage = 0; syncPage < CLOUD_SYNC_MAX_PAGES; syncPage++) {
      var syncBody = { includeUsage: true, maxEvents: 500 };
    // @ts-ignore
      if (syncCursor) syncBody.cursor = syncCursor;
      var remoteState = await cloudRequest(config, "/v1/sync/state", {
        method: "POST",
        body: syncBody
      });
      if (generation !== cloudConnectionGeneration) throw cloudOperationCancelled();
      if (Array.isArray(remoteState?.usageEvents)) {
    // @ts-ignore
        allRemoteEvents = allRemoteEvents.concat(remoteState.usageEvents);
      }
      if (!remoteState?.usagePage?.hasMore || !remoteState?.usagePage?.nextCursor) break;
      syncCursor = remoteState.usagePage.nextCursor;
    }
    config = await mergeCloudUsageEvents(allRemoteEvents, config);
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
    // @ts-ignore
    if (error && typeof error === "object") error.cloudConnectionId = connectionId;
    throw error;
  }
}
export function syncCloudState() {
  const generation = cloudConnectionGeneration;
  const operation = cloudSyncQueue.then(() => runCloudSync(generation));
  cloudSyncQueue = operation.then(() => void 0, () => void 0);
  return operation;
}

