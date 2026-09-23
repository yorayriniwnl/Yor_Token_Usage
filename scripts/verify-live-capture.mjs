import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const extensionRoot = `chrome-extension://${extensionId}/`;
const listeners = new Map();
const local = new Map();
const sync = new Map();
const session = new Map();

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
    query: async () => [],
    sendMessage: async () => ({ ok: false }),
    create: async () => {}
  },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  notifications: { create: async () => "test-notification" },
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
console.log("live-capture-cycle-1=pass");
