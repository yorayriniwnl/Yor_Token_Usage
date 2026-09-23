import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import vm from "node:vm";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const extensionRoot = `chrome-extension://${extensionId}/`;
const listeners = new Map();
const local = new Map();
const sync = new Map();
const session = new Map();
const tabMessages = [];
let notificationCalls = 0;

function storageArea(target) {
  return {
    async get(key) {
      if (typeof key === "string") return { [key]: target.get(key) };
      if (Array.isArray(key)) return Object.fromEntries(key.map((item) => [item, target.get(item)]));
      return Object.fromEntries(target);
    },
    async set(values) { for (const [key, value] of Object.entries(values)) target.set(key, value); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) target.delete(key); }
  };
}

const chrome = {
  storage: { local: storageArea(local), sync: storageArea(sync), session: storageArea(session) },
  runtime: {
    id: extensionId,
    onInstalled: { addListener: (fn) => listeners.set("installed", fn) },
    onStartup: { addListener: (fn) => listeners.set("startup", fn) },
    onMessage: { addListener: (fn) => listeners.set("message", fn) },
    getURL: (path) => `${extensionRoot}${path}`,
    getManifest: () => ({ version: "1.1.1" })
  },
  alarms: { create: async () => {}, onAlarm: { addListener: (fn) => listeners.set("alarm", fn) } },
  commands: { onCommand: { addListener: (fn) => listeners.set("command", fn) } },
  tabs: {
    onRemoved: { addListener: (fn) => listeners.set("tab-removed", fn) },
    query: async () => [{ id: 99, url: "https://chatgpt.com/" }],
    sendMessage: async (tabId, message) => { tabMessages.push({ tabId, message }); return { ok: false }; },
    create: async () => {}
  },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  notifications: { create: async () => { notificationCalls += 1; return "test-notification"; } },
  permissions: { contains: async () => true }
};

const source = await readFile(new URL("../background/service-worker.js", import.meta.url), "utf8");
vm.runInNewContext(source, {
  chrome, AbortController, console, crypto: webcrypto, Date, fetch: async () => new Response("{}"),
  Intl, JSON, Math, Map, Object, Set, TextEncoder, Uint8Array, URL, clearTimeout, setTimeout,
  setInterval, structuredClone
}, { filename: "background/service-worker.js" });

function dispatch(message, sender) {
  return new Promise((resolve, reject) => {
    const listener = listeners.get("message");
    if (!listener) return reject(new Error("service worker has no message listener"));
    try { listener(message, sender, resolve); } catch (error) { reject(error); }
  });
}

const sender = {
  id: extensionId,
  tab: { id: 41, url: "https://chatgpt.com/c/thread-1" },
  url: "https://chatgpt.com/c/thread-1"
};
const response = await dispatch({
  type: "submit-tab-observation",
  site: "chatgpt",
  threadId: "thread-1",
  model: "GPT-4o",
  draftText: "Keep this draft in the active tab",
  draftAnalysis: { inputTokens: 8, sections: [], measurement: { measurementLevel: "approximation" }, largePaste: false },
  contextAccounting: { visibleThreadTokens: 12, visibleMessageCount: 1, estimatedCurrentContextTokens: 20, contextPressureTier: "low" },
  quotaSignal: null
}, sender);

assert.equal(response?.ok, true, `submit-tab-observation must be handled (received ${response?.error ?? "no acknowledgement"})`);
const view = await dispatch({ type: "get-tab-view-state", site: "chatgpt", threadId: "thread-1" }, sender);
assert.equal(view?.session?.tabId, 41, "the tab view must contain the sender tab's live session");
assert.equal(view?.session?.currentDraft, "Keep this draft in the active tab", "the same tab must recover its draft");
assert.equal("usageEvents" in view, false, "the tab view must not include global event history");
for (const message of [{ type: "get-snapshot" }, { type: "get-state" }, { type: "export-data" }]) {
  const result = await dispatch(message, sender);
  assert.equal(result?.ok, false, `${message.type} must be denied to a provider-page sender`);
  assert.equal("state" in result, false, `${message.type} must not return global state to a provider page`);
}
const extensionSnapshot = await dispatch({ type: "get-snapshot" }, { id: extensionId, url: `${extensionRoot}popup/popup.html` });
assert.ok(extensionSnapshot?.state, "extension-owned UI must retain access to its own snapshot");

const privacyEvent = {
  clientEventId: "privacy-test-event",
  site: "chatgpt",
  model: "GPT-4o",
  threadId: "thread-1",
  timestamp: Date.now(),
  promptTokens: 2,
  outputTokens: 1,
  totalTokens: 3,
  promptChars: 8,
  outputChars: 4,
  status: "completed",
  accuracy: "estimated",
  measurement: {
    schemaVersion: 1,
    measurementMethod: "dom-text-heuristic",
    measurementLevel: "approximation",
    confidenceTier: "Rough estimate",
    confidence: 0.5,
    errorMarginPercent: 40,
    provider: "chatgpt",
    model: "GPT-4o",
    tokenizer: "none",
    source: "test fixture",
    notes: "test fixture"
  }
};
const extensionSender = { id: extensionId, url: `${extensionRoot}settings/settings.html` };
const commitResponse = await dispatch({ type: "commit-usage-event", event: privacyEvent }, sender);
assert.equal(commitResponse?.ok, true, "a page content script must still be able to commit token-only usage");
assert.equal("snapshot" in commitResponse, false, "a usage commit must return only an acknowledgement, not global state");
assert.equal("state" in commitResponse, false, "a usage commit must not return global state");

const eventsBeforeRejectedCommits = (await dispatch({ type: "get-state" }, extensionSender)).usageEvents.length;
const mismatchedCommit = await dispatch({
  type: "commit-usage-event",
  event: { ...privacyEvent, clientEventId: "mismatched-site-event", site: "claude" }
}, sender);
assert.equal(mismatchedCommit?.ok, false, "a provider tab must not commit an event labeled as another provider");
const unsupportedCommit = await dispatch(
  { type: "commit-usage-event", event: { ...privacyEvent, clientEventId: "unsupported-site-event" } },
  { ...sender, tab: { id: 49, url: "https://example.invalid/" }, url: "https://example.invalid/" }
);
assert.equal(unsupportedCommit?.ok, false, "unsupported tabs must not commit usage events");
const eventsAfterRejectedCommits = (await dispatch({ type: "get-state" }, extensionSender)).usageEvents.length;
assert.equal(eventsAfterRejectedCommits, eventsBeforeRejectedCommits, "rejected usage events must not enter persistent history");

const settingsBefore = await dispatch({ type: "get-state" }, extensionSender);
const tabMessagesBeforeDeniedActions = tabMessages.length;
const notificationCallsBeforeDeniedActions = notificationCalls;
for (const message of [
  { type: "save-preferences", payload: { showOverlay: false } },
  { type: "import-data", payload: { usageEvents: [] } },
  { type: "capture-session", session: { site: "chatgpt", model: "GPT-4o", threadId: "page-write", currentInput: "secret draft" } },
  { type: "clear-local-history" },
  { type: "cloud-status" },
  { type: "cloud-connect", payload: {} },
  { type: "cloud-sync" },
  { type: "cloud-disconnect" },
  { type: "toggle-overlay" },
  { type: "notify", title: "page-triggered", message: "must not run" }
]) {
  const result = await dispatch(message, sender);
  assert.equal(result?.ok, false, `${message.type} must be denied to a provider-page sender`);
  assert.match(result?.error ?? "", /available only from Yor extension pages/, `${message.type} must explain that extension pages own this action`);
}
const settingsAfter = await dispatch({ type: "get-state" }, extensionSender);
assert.equal(settingsAfter.preferences.showOverlay, settingsBefore.preferences.showOverlay, "denied page writes must not mutate global preferences");
assert.equal(settingsAfter.usageEvents.length, settingsBefore.usageEvents.length, "denied page writes must not mutate usage history");
assert.equal(tabMessages.length, tabMessagesBeforeDeniedActions, "page-origin overlay messages must not affect another tab");
assert.equal(notificationCalls, notificationCallsBeforeDeniedActions, "page-origin messages must not create notifications");
const extensionSavePreferences = await dispatch({
  type: "save-preferences",
  payload: { showOverlay: settingsAfter.preferences.showOverlay }
}, extensionSender);
assert.equal(extensionSavePreferences?.state?.preferences?.showOverlay, settingsAfter.preferences.showOverlay, "extension settings must retain permission to save preferences");

const sender2 = {
  id: extensionId,
  tab: { id: 42, url: "https://chatgpt.com/c/thread-2" },
  url: "https://chatgpt.com/c/thread-2"
};
const secondResponse = await dispatch({
  type: "submit-tab-observation",
  site: "chatgpt",
  threadId: "thread-2",
  model: "GPT-4o",
  draftText: "Keep the second tab separate",
  draftAnalysis: { inputTokens: 6, sections: [], measurement: { measurementLevel: "approximation" }, largePaste: false },
  contextAccounting: { visibleThreadTokens: 0, visibleMessageCount: 0, estimatedCurrentContextTokens: 6, contextPressureTier: "low" },
  quotaSignal: null
}, sender2);
assert.equal(secondResponse?.ok, true, "a second provider tab must be accepted");

const removeTab = listeners.get("tab-removed");
assert.equal(typeof removeTab, "function", "the worker must register tab-close cleanup");
removeTab(41);
const closedTabView = await dispatch({ type: "get-tab-view-state", site: "chatgpt", threadId: "thread-1" }, sender);
const openTabView = await dispatch({ type: "get-tab-view-state", site: "chatgpt", threadId: "thread-2" }, sender2);
assert.equal(closedTabView?.session, undefined, "closing a tab must release its live session");
assert.equal(openTabView?.session?.currentDraft, "Keep the second tab separate", "closing one tab must preserve the other tab's session");

const wrongProvider = await dispatch({
  type: "submit-tab-observation",
  site: "chatgpt",
  threadId: "spoofed",
  model: "GPT-4o",
  draftText: "must not be stored",
  draftAnalysis: {},
  contextAccounting: {},
  quotaSignal: null
}, { ...sender2, url: "https://claude.ai/chat/other", tab: { ...sender2.tab, url: "https://claude.ai/chat/other" } });
assert.equal(wrongProvider?.ok, false, "a mismatched provider sender must be rejected");

const missingTab = await dispatch({ type: "get-tab-view-state", site: "chatgpt" }, { id: extensionId, url: `${extensionRoot}popup/popup.html` });
assert.equal(missingTab?.ok, false, "a sender without a provider tab must be rejected");

const oversized = await dispatch({
  type: "submit-tab-observation",
  site: "chatgpt",
  threadId: "oversized",
  model: "GPT-4o",
  draftText: "x".repeat(250_001),
  draftAnalysis: {},
  contextAccounting: {},
  quotaSignal: null
}, sender2);
assert.equal(oversized?.ok, false, "oversized drafts must be rejected instead of retained in memory");
const intactSecondTab = await dispatch({ type: "get-tab-view-state", site: "chatgpt", threadId: "thread-2" }, sender2);
assert.equal(intactSecondTab?.session?.currentDraft, "Keep the second tab separate", "rejected messages must not corrupt a valid tab session");
const negativeTab = await dispatch({
  type: "submit-tab-observation",
  site: "chatgpt",
  threadId: "invalid-tab",
  model: "GPT-4o",
  draftText: "must not be stored",
  draftAnalysis: {},
  contextAccounting: {},
  quotaSignal: null
}, { ...sender2, tab: { ...sender2.tab, id: -1 } });
assert.equal(negativeTab?.ok, false, "negative sender tab ids must be rejected");

const managerBundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/background/sessionManager.ts", import.meta.url))],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false
});
const managerModule = { exports: {} };
vm.runInNewContext(managerBundle.outputFiles[0].text, { module: managerModule, exports: managerModule.exports });
const manager = new managerModule.exports.SessionManager();
manager.setSession({ tabId: 51, site: "chatgpt", threadId: "chat", model: "GPT-4o", currentDraft: "old host", draftAnalysis: {}, contextAccounting: {}, quotaSignal: null, lastUpdated: 1 });
manager.setSession({ tabId: 51, site: "claude", threadId: "claude-chat", model: "Claude", currentDraft: "current host", draftAnalysis: {}, contextAccounting: {}, quotaSignal: null, lastUpdated: 2 });
assert.equal(manager.getAllSessions().length, 1, "a tab navigation must replace its old provider session");
assert.equal(manager.getSession(51, "chatgpt"), undefined, "an old provider must not retrieve the navigated tab's prior draft");
assert.equal(manager.getSession(51)?.currentDraft, "current host", "a tab-only lookup must return its current provider session");
for (const invalidTabId of [-1, Number.NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(
    () => manager.setSession({ tabId: invalidTabId, site: "chatgpt", threadId: "invalid", model: "GPT-4o", currentDraft: "bad", draftAnalysis: {}, contextAccounting: {}, quotaSignal: null, lastUpdated: 3 }),
    (error) => error?.name === "RangeError",
    `invalid tab id ${String(invalidTabId)} must be rejected`
  );
}
assert.equal(manager.getAllSessions().length, 1, "rejected tab ids must not mutate the session collection");
manager.setSession({ tabId: 52, site: "chatgpt", threadId: "newer", model: "GPT-4o", currentDraft: "newer tab", draftAnalysis: {}, contextAccounting: {}, quotaSignal: null, lastUpdated: 4 });
assert.equal(manager.getAllSessions()[0]?.tabId, 52, "live sessions must be ordered newest first");
manager.removeTab(52);
assert.equal(manager.getAllSessions().length, 1, "removing a tab must leave unrelated sessions intact");
console.log("live-capture-regressions=pass");
