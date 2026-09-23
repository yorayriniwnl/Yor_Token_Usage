import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const source = await readFile(new URL("../background/service-worker.js", import.meta.url), "utf8");
const listeners = new Map();
const storage = new Map();
const sessionStorage = new Map();
const cloudRequests = [];
let delayNextAuthRequest = false;
let signalDelayedAuthStarted;
const event = (name) => ({
  addListener(listener) {
    listeners.set(name, listener);
  }
});
const createStorageArea = (entries) => ({
  async get(key) {
    return { [key]: entries.get(key) };
  },
  async set(values) {
    for (const [key, value] of Object.entries(values)) entries.set(key, value);
  },
  async remove(key) {
    entries.delete(key);
  }
});
const storageArea = createStorageArea(storage);
const sessionStorageArea = createStorageArea(sessionStorage);
const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const extensionRoot = `chrome-extension://${extensionId}/`;
const internalSender = { url: `${extensionRoot}settings/settings.html` };

async function fakeFetch(input, init = {}) {
  const url = String(input);
  const body = init.body ? JSON.parse(init.body) : undefined;
  cloudRequests.push({ url, init, body });
  const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
  if (url.endsWith("/v1/auth/session")) {
    if (delayNextAuthRequest) {
      delayNextAuthRequest = false;
      signalDelayedAuthStarted?.();
      return new Promise((_resolve, reject) => {
        const abort = () => {
          const error = new Error("delayed authentication request aborted");
          error.name = "AbortError";
          reject(error);
        };
        init.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return json({
      user: { id: "00000000-0000-4000-8000-000000000001", email: "runtime@example.com" },
      device: { id: "00000000-0000-4000-8000-000000000002", installId: init.headers["x-install-id"], status: "ACTIVE" }
    });
  }
  if (url.endsWith("/v1/usage/events/batch")) {
    return json({ accepted: body.events.length, queued: true, requestId: "runtime-request" }, 202);
  }
  if (url.endsWith("/v1/sync/state")) {
    return json({ serverTime: new Date().toISOString(), settings: null, usageEvents: [], usagePage: { hasMore: false, nextCursor: null } });
  }
  if (url.endsWith("/v1/quota/check")) {
    return json({ usedTokens: 125, tokenCap: 100000, remainingTokens: 99875, limited: false, periodEnd: new Date(Date.now() + 86400000).toISOString() });
  }
  return json({ error: "not_found", message: "Not found" }, 404);
}

const chrome = {
  storage: { local: storageArea, sync: storageArea, session: sessionStorageArea },
  runtime: {
    id: extensionId,
    onInstalled: event("installed"),
    onStartup: event("startup"),
    onMessage: event("message"),
    getURL: (path) => `${extensionRoot}${path}`,
    getManifest: () => ({ version: "1.1.1" })
  },
  alarms: { create: async () => {}, onAlarm: event("alarm") },
  commands: { onCommand: event("command") },
  action: {
    setBadgeText: async () => {},
    setBadgeBackgroundColor: async () => {}
  },
  notifications: { create: async () => "test-notification" },
  permissions: { contains: async () => true, request: async () => true },
  tabs: {
    onRemoved: event("tab-removed"),
    query: async () => [],
    sendMessage: async () => ({ ok: false }),
    create: async () => {}
  }
};

vm.runInNewContext(source, {
  chrome,
  AbortController,
  console,
  crypto: webcrypto,
  Date,
  fetch: fakeFetch,
  Intl,
  JSON,
  Math,
  Map,
  Object,
  Set,
  TextEncoder,
  Uint8Array,
  URL,
  clearTimeout,
  setTimeout,
  setInterval,
  structuredClone
}, { filename: "background/service-worker.js" });

function dispatch(message, sender = internalSender) {
  return new Promise((resolve, reject) => {
    const listener = listeners.get("message");
    if (!listener) {
      reject(new Error("background message listener was not registered"));
      return;
    }
    try {
      listener(message, sender, (response) => resolve(response));
    } catch (error) {
      reject(error);
    }
  });
}

const now = Date.now();
const importedEvents = Array.from({ length: 2_505 }, (_, index) => ({
  id: `event-${index}`,
  site: "chatgpt",
  model: "gpt-4.1",
  threadId: "thread-1",
  timestamp: now - (2_505 - index) * 1_000,
  promptTokens: index === 2_504 ? Number.MAX_VALUE : 10,
  outputTokens: index === 2_504 ? Number.MAX_VALUE : 15,
  totalTokens: index === 2_504 ? Number.MAX_VALUE : 25,
  promptPreview: "<script>alert('xss')</script>".repeat(100),
  ...([5, 6, 2_504].includes(index) ? {
    measurement: {
      schemaVersion: 1,
      measurementMethod: index === 6 ? "provider-api-claim" : "dom-text-heuristic",
      measurementLevel: index === 6 ? "authoritative" : "approximation",
      confidence: index === 6 ? 0.99 : 0.51,
      errorMarginPercent: index === 6 ? 0 : 40,
      tokenizer: "none",
      source: "visible provider DOM text"
    }
  } : {}),
  evil: "must-not-persist"
})).reverse();

const imported = await dispatch({
  type: "import-data",
  payload: {
    usageEvents: importedEvents,
    sessions: {
      chatgpt: {
        site: "chatgpt",
        model: "gpt-4.1",
        threadId: "thread-1",
        currentInput: "normal prompt",
        currentEstimate: {
          inputTokens: 42,
          outputTokensEstimate: 18,
          totalTokens: 60,
          sections: Array.from({ length: 60 }, (_, index) => ({ type: "not-a-real-section", label: `<script>${index}</script>`, tokens: Number.MAX_VALUE, evil: true })),
          suggestions: Array.from({ length: 10 }, (_, index) => ({ id: `suggestion-${index}`, title: `<img src=x onerror=alert(1)>`, description: "x".repeat(500), estimatedSavings: Number.MAX_VALUE, severity: "not-a-severity", applyVariant: "not-a-variant", evil: true })),
          variants: { shorter: "x".repeat(251_000), balanced: "balanced", maxDetail: "detail" },
          repeatedInstructions: Array.from({ length: 10 }, () => "repeated instruction"),
          redundantSections: Array.from({ length: 10 }, () => "redundant section"),
          evil: "must-not-persist"
        },
        currentThread: {
          contextGrowth: Array.from({ length: 100 }, (_, index) => index),
          evil: "must-not-persist"
        },
        quota: {
          status: "not-a-status",
          accuracy: "not-an-accuracy",
          nextReset: {
            localLabel: "<script>alert(1)</script>".repeat(100),
            kind: "not-a-kind",
            confidence: "not-a-confidence",
            explanation: "x".repeat(500),
            evil: true
          },
          evil: "must-not-persist"
        },
        evil: "must-not-persist"
      }
    },
    threads: {
      evil: {
        site: "chatgpt",
        model: "<img src=x onerror=alert(1)>",
        messageCount: "<script>alert(1)</script>"
      }
    }
  }
});
if (!imported?.state || imported.state.usageEvents.length !== 2_500) {
  throw new Error("imported = " + JSON.stringify(imported).slice(0, 1000));
}

const events = imported.state.usageEvents;
if (events[0].timestamp >= events.at(-1).timestamp) {
  throw new Error("import normalization did not restore chronological order");
}
if (events.at(-1).totalTokens > 4_000_000 || events.at(-1).promptPreview.length > 140 || "evil" in events.at(-1)) {
  throw new Error("import normalization failed to bound or strip hostile event data");
}
if (events.at(-1).measurement?.measurementLevel !== "approximation" || events.at(-1).measurement?.confidence !== 0.51 || events.at(-1).measurement?.errorMarginPercent !== 40) {
  throw new Error("import normalization did not preserve bounded measurement provenance");
}
if (Object.prototype.hasOwnProperty.call(imported.state.threads, "evil") || !imported.state.threads["chatgpt:thread-1"]) {
  throw new Error("thread aggregates trusted imported fields instead of being rebuilt from normalized events");
}
const importedSession = imported.state.sessions.chatgpt;
if (!importedSession || Object.prototype.hasOwnProperty.call(importedSession, "evil") || Object.prototype.hasOwnProperty.call(importedSession.currentEstimate, "evil") || Object.prototype.hasOwnProperty.call(importedSession.currentThread, "evil") || Object.prototype.hasOwnProperty.call(importedSession.quota, "evil")) {
  throw new Error("session normalization persisted unknown imported fields");
}
if (importedSession.currentEstimate.sections.length !== 50 || importedSession.currentEstimate.suggestions.length !== 6 || importedSession.currentEstimate.repeatedInstructions.length !== 6 || importedSession.currentEstimate.redundantSections.length !== 5 || importedSession.currentThread.contextGrowth.length !== 25 || importedSession.currentEstimate.variants.shorter.length !== 250_000) {
  throw new Error("session normalization did not bound nested analysis data");
}
if (importedSession.currentEstimate.sections.some((section) => section.type !== "prose" || section.tokens !== 4_000_000) || importedSession.currentEstimate.suggestions.some((suggestion) => suggestion.severity !== "low" || suggestion.applyVariant !== "balanced" || suggestion.estimatedSavings !== 4_000_000) || importedSession.quota.status !== "unknown" || importedSession.quota.accuracy !== "inferred" || importedSession.quota.nextReset.kind !== "unknown" || importedSession.quota.nextReset.confidence !== "inferred" || importedSession.quota.nextReset.localLabel.length > 160 || importedSession.quota.nextReset.explanation.length > 240) {
  throw new Error("session normalization did not constrain nested imported values");
}
const downgradedAuthority = events.find((event) => event.id === "event-6")?.measurement;
if (downgradedAuthority?.measurementLevel !== "unknown" || downgradedAuthority.confidence !== 0 || downgradedAuthority.errorMarginPercent !== 100) {
  throw new Error("unverified provider-authoritative metadata was not downgraded");
}

const snapshot = await dispatch({ type: "get-snapshot" });
if (snapshot.state.threads["chatgpt:thread-1"]?.totalTokens > 16_000_000) {
  throw new Error("thread totals exceeded the normalized bound");
}

const externalCloudAttempt = await dispatch({ type: "cloud-status" }, { url: "https://malicious.example/" });
if (externalCloudAttempt?.ok !== false) {
  throw new Error("cloud account controls accepted a non-extension sender");
}

const connected = await dispatch({
  type: "cloud-connect",
  payload: {
    apiBaseUrl: "https://api.example.test",
    accessToken: "runtime-integration-access-token-0001"
  }
}, internalSender);
if (!connected?.ok || !connected.status?.connected) {
  throw new Error("cloud session did not connect through the backend contract");
}

const synced = await dispatch({ type: "cloud-sync" }, internalSender);
if (!synced?.ok || synced.status?.pendingEvents !== 2000) {
  throw new Error("cloud sync did not upload a bounded five-batch window");
}
const uploadedRequests = cloudRequests.filter((request) => request.url.endsWith("/v1/usage/events/batch"));
if (uploadedRequests.length !== 5 || uploadedRequests.some((request) => request.body.events.length !== 100)) {
  throw new Error("cloud usage upload batching was not bounded to 100 events");
}
if (uploadedRequests.some((request) => request.body.events.some((usageEvent) => "promptPreview" in usageEvent || "promptHash" in usageEvent || "metadata" in usageEvent))) {
  throw new Error("cloud usage upload leaked local prompt data");
}
if (!uploadedRequests.some((request) => request.body.events.some((usageEvent) => usageEvent.measurementLevel === "approximation" && usageEvent.confidence === 0.51 && usageEvent.errorMarginPercent === 40))) {
  throw new Error("cloud usage upload dropped measurement provenance");
}
if (uploadedRequests.some((request) => request.body.events.some((usageEvent) => usageEvent.measurementLevel === "authoritative"))) {
  throw new Error("cloud usage upload preserved an unverified authoritative measurement claim");
}
if (cloudRequests.some((request) => request.init.headers.authorization !== "Bearer runtime-integration-access-token-0001")) {
  throw new Error("cloud requests did not consistently use the in-session bearer token");
}

const exported = await dispatch({ type: "export-data" });
if (JSON.stringify(exported).includes("runtime-integration-access-token-0001") || JSON.stringify(exported).includes("api.example.test")) {
  throw new Error("local export included cloud credentials or connection metadata");
}

const disconnected = await dispatch({ type: "cloud-disconnect" }, internalSender);
if (!disconnected?.ok || disconnected.status?.connected || sessionStorage.has("yor-token-usage-cloud-session")) {
  throw new Error("cloud disconnect did not clear the in-session credential");
}

const invalidReconnect = await dispatch({
  type: "cloud-connect",
  payload: { apiBaseUrl: "https://api.example.test", accessToken: "too-short" }
}, internalSender);
const statusAfterInvalidReconnect = await dispatch({ type: "cloud-status" }, internalSender);
if (invalidReconnect?.ok !== false || statusAfterInvalidReconnect.status?.enabled || sessionStorage.has("yor-token-usage-cloud-session")) {
  throw new Error("invalid cloud credentials changed the disconnected state");
}

const delayedAuthStarted = new Promise((resolve) => { signalDelayedAuthStarted = resolve; });
delayNextAuthRequest = true;
const reconnectInFlight = dispatch({
  type: "cloud-connect",
  payload: {
    apiBaseUrl: "https://api.example.test",
    accessToken: "runtime-integration-access-token-race-0002"
  }
}, internalSender);
await delayedAuthStarted;
const disconnectedDuringConnect = await dispatch({ type: "cloud-disconnect" }, internalSender);
const cancelledReconnect = await reconnectInFlight;
const statusAfterRace = await dispatch({ type: "cloud-status" }, internalSender);
if (!disconnectedDuringConnect?.ok || cancelledReconnect?.ok !== false || statusAfterRace.status?.enabled || statusAfterRace.status?.connected || sessionStorage.has("yor-token-usage-cloud-session")) {
  throw new Error("disconnect racing an in-flight connection resurrected the cloud session");
}

const cleared = await dispatch({ type: "clear-local-history" }, internalSender);
if (!cleared?.state || cleared.state.usageEvents.length !== 0 || Object.values(cleared.state.sessions).some(Boolean) || Object.keys(cleared.state.threads).length !== 0 || !cleared.state.preferences || cleared.analytics?.peakDay !== void 0) {
  throw new Error("local history clear did not remove usage state while preserving preferences");
}

console.log("extension-runtime-check=pass");
