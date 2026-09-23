import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const verbose = process.env.YOR_STRESS_VERBOSE === "1";
if (verbose) {
  console.log("================================================================================");
  console.log("      YOR TOKEN USAGE: ADVERSARIAL STRESS & SECURITY VERIFICATION SUITE");
  console.log("================================================================================");
}

const source = await readFile(new URL("../background/service-worker.js", import.meta.url), "utf8");

let syncSetCallCount = 0;
let syncRemoveCallCount = 0;
const storage = new Map();
const sessionStorage = new Map();
const syncStorage = new Map();
const listeners = new Map();
const cloudRequests = [];

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const extensionRoot = `chrome-extension://${extensionId}/`;

const fakeLocalStorage = {
  async get(key) {
    if (typeof key === "string") return { [key]: storage.get(key) };
    if (Array.isArray(key)) {
      const res = {};
      for (const k of key) res[k] = storage.get(k);
      return res;
    }
    const res = {};
    for (const [k, v] of storage) res[k] = v;
    return res;
  },
  async set(values) {
    for (const [k, v] of Object.entries(values)) storage.set(k, v);
  },
  async remove(key) {
    if (Array.isArray(key)) for (const k of key) storage.delete(k);
    else storage.delete(key);
  }
};

const fakeSyncStorage = {
  async get(key) {
    if (typeof key === "string") return { [key]: syncStorage.get(key) };
    const res = {};
    for (const [k, v] of syncStorage) res[k] = v;
    return res;
  },
  async set(values) {
    syncSetCallCount += 1;
    for (const [k, v] of Object.entries(values)) syncStorage.set(k, v);
  },
  async remove(key) {
    syncRemoveCallCount += 1;
    syncStorage.delete(key);
  }
};

const fakeSessionStorage = {
  async get(key) {
    return { [key]: sessionStorage.get(key) };
  },
  async set(values) {
    for (const [k, v] of Object.entries(values)) sessionStorage.set(k, v);
  },
  async remove(key) {
    sessionStorage.delete(key);
  }
};

// Configurable fakeFetch for pagination & API stress
let remotePagesToServe = 0;
let servedPagesCount = 0;

async function fakeFetch(input, init = {}) {
  const url = String(input);
  const body = init.body ? JSON.parse(init.body) : undefined;
  cloudRequests.push({ url, init, body });

  const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });

  if (url.endsWith("/v1/auth/session")) {
    return json({
      user: { id: "00000000-0000-4000-8000-000000000001", email: "stress@example.com" },
      device: { id: "00000000-0000-4000-8000-000000000002", installId: init.headers["x-install-id"], status: "ACTIVE" }
    });
  }
  if (url.endsWith("/v1/usage/events/batch")) {
    return json({ accepted: body.events.length, queued: true, requestId: `stress-req-${cloudRequests.length}` }, 202);
  }
  if (url.endsWith("/v1/sync/state")) {
    servedPagesCount += 1;
    const hasMore = servedPagesCount < remotePagesToServe;
    const nextCursor = hasMore ? `cursor-page-${servedPagesCount + 1}` : null;
    const batchEvents = Array.from({ length: 50 }, (_, i) => ({
      id: `remote-event-p${servedPagesCount}-${i}`,
      clientEventId: `remote-client-p${servedPagesCount}-${i}`,
      site: "chatgpt",
      model: "gpt-4o",
      threadId: "remote-thread-1",
      timestamp: Date.now() - (servedPagesCount * 100 + i) * 1000,
      promptTokens: 50,
      outputTokens: 25,
      totalTokens: 75,
      promptCost: 0.0001,
      outputCost: 0.0002
    }));
    return json({
      serverTime: new Date().toISOString(),
      settings: null,
      usageEvents: batchEvents,
      usagePage: { hasMore, nextCursor }
    });
  }
  if (url.endsWith("/v1/quota/check")) {
    return json({ usedTokens: 500, tokenCap: 100000, remainingTokens: 99500, limited: false, periodEnd: new Date(Date.now() + 86400000).toISOString() });
  }
  return json({ error: "not_found" }, 404);
}

const chrome = {
  storage: { local: fakeLocalStorage, sync: fakeSyncStorage, session: fakeSessionStorage },
  runtime: {
    id: extensionId,
    onInstalled: { addListener: (fn) => listeners.set("installed", fn) },
    onStartup: { addListener: (fn) => listeners.set("startup", fn) },
    onMessage: { addListener: (fn) => listeners.set("message", fn) },
    getURL: (path) => `${extensionRoot}${path}`,
    getManifest: () => ({ version: "1.1.1" })
  },
  alarms: { create: async () => {}, onAlarm: { addListener: () => {} } },
  commands: { onCommand: { addListener: () => {} } },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  notifications: { create: async () => "stress-notification" },
  permissions: { contains: async () => true, request: async () => true },
  tabs: {
    onRemoved: { addListener: () => {} },
    query: async () => [],
    sendMessage: async () => ({ ok: false }),
    create: async () => {}
  }
};

const sandbox = {
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
};

vm.runInNewContext(source, sandbox, { filename: "background/service-worker.js" });

function dispatch(message, sender = { url: `${extensionRoot}popup/popup.html` }) {
  return new Promise((resolve, reject) => {
    const listener = listeners.get("message");
    if (!listener) return reject(new Error("No message listener registered"));
    try {
      listener(message, sender, (res) => resolve(res));
    } catch (err) {
      reject(err);
    }
  });
}

let testsPassed = 0;
let testsFailed = 0;
let testCasesRun = 0;

function assert(condition, message) {
  if (!condition) {
    testsFailed++;
    console.error(`  FAIL: ${message}`);
    throw new Error(message);
  }
  testsPassed++;
  if (verbose) console.log(`  PASS: ${message}`);
}

async function runTest(name, fn) {
  testCasesRun++;
  if (verbose) console.log(`\n[TEST] ${name}`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ERROR in test "${name}":`, err.message);
    process.exitCode = 1;
  }
}

// ==============================================================================
// TEST 1: Prototype Pollution & Hostile Property Injection Defense
// ==============================================================================
await runTest("Prototype Pollution & Hostile Property Injection Defense", async () => {
  const hostilePayload = JSON.parse(`{
    "__proto__": { "polluted": "yes" },
    "constructor": { "prototype": { "polluted": "yes" } },
    "usageEvents": [
      {
        "id": "event-proto-1",
        "site": "chatgpt",
        "model": "gpt-4o",
        "threadId": "t1",
        "timestamp": ${Date.now()},
        "promptTokens": 10,
        "outputTokens": 20,
        "totalTokens": 30,
        "__proto__": { "polluted": "yes" }
      }
    ],
    "preferences": {
      "__proto__": { "polluted": "yes" },
      "privacyMode": "sync-preferences"
    }
  }`);

  await dispatch({ type: "import-data", payload: hostilePayload });

  assert({}.polluted === undefined, "Object.prototype was not polluted via import-data");
  assert(Object.prototype.polluted === undefined, "Global prototype has no 'polluted' property");

  const snapshot = await dispatch({ type: "get-snapshot" });
  assert(!Object.prototype.hasOwnProperty.call(snapshot.state, "__proto__"), "State has no own __proto__ property");
});

// ==============================================================================
// TEST 2: High-Volume Fuzzing & Boundary Values on State Normalization
// ==============================================================================
await runTest("Fuzzing & Boundary Values on Normalization (2,500 Malformed Events)", async () => {
  const degenerateValues = [
    NaN, Infinity, -Infinity, -9999, 1e35, null, undefined, "", " ",
    "\u0000\u0001\u0002", "<script>alert('xss')</script>", "🚀".repeat(200),
    { nested: "object" }, [1, 2, 3]
  ];

  const fuzzedEvents = Array.from({ length: 2500 }, (_, i) => ({
    id: `fuzz-${i}`,
    site: degenerateValues[i % degenerateValues.length],
    model: degenerateValues[(i + 1) % degenerateValues.length],
    threadId: degenerateValues[(i + 2) % degenerateValues.length],
    timestamp: i % 2 === 0 ? Date.now() - i * 1000 : "invalid-timestamp",
    promptTokens: degenerateValues[i % degenerateValues.length],
    outputTokens: degenerateValues[(i + 3) % degenerateValues.length],
    totalTokens: degenerateValues[(i + 4) % degenerateValues.length],
    promptPreview: degenerateValues[i % degenerateValues.length],
    measurement: {
      schemaVersion: "invalid",
      confidence: degenerateValues[i % degenerateValues.length],
      errorMarginPercent: degenerateValues[i % degenerateValues.length]
    }
  }));

  const res = await dispatch({ type: "import-data", payload: { usageEvents: fuzzedEvents } });
  assert(res && res.state && Array.isArray(res.state.usageEvents), "Import completed without crashing on fuzzed input");
  assert(res.state.usageEvents.length <= 2500, "History limit strictly respected (<= 2500)");

  // Verify all entries are sanitized and bounded
  for (const ev of res.state.usageEvents) {
    assert(Number.isFinite(ev.totalTokens) && ev.totalTokens >= 0 && ev.totalTokens <= 4000000, "Tokens are finite, non-negative, and bounded <= 4,000,000");
    assert(Number.isFinite(ev.timestamp) && ev.timestamp > 0, "Timestamp is finite non-negative number");
    assert(typeof ev.site === "string", "Site is sanitized to string");
    assert(typeof ev.model === "string", "Model is sanitized to string");
  }
});

// ==============================================================================
// TEST 3: Chrome Storage Sync Write Storm Suppression (F-05 Stress Test)
// ==============================================================================
await runTest("F-05 Stress: 250 Rapid Composer Keystrokes Produce 0 Sync Writes", async () => {
  // Ensure we are in sync-preferences mode
  await dispatch({
    type: "save-preferences",
    payload: { privacyMode: "sync-preferences", compactMode: false }
  });

  const baselineSyncSets = syncSetCallCount;

  // Simulate 250 typing keystroke session events (dispatched on every keystroke)
  for (let i = 0; i < 250; i++) {
    await dispatch({
      type: "capture-session",
      session: {
        site: "chatgpt",
        model: "gpt-4o",
        threadId: "typing-thread",
        currentInput: `typing keystroke ${i}`,
        currentEstimate: { inputTokens: i, outputTokensEstimate: 10, totalTokens: i + 10 }
      }
    });
  }

  const syncSetsAfterTyping = syncSetCallCount - baselineSyncSets;
  assert(syncSetsAfterTyping === 0, `Zero sync.set calls during typing session updates (actual: ${syncSetsAfterTyping})`);

  // Now change a preference explicitly -> must trigger exactly 1 sync.set
  await dispatch({
    type: "save-preferences",
    payload: { privacyMode: "sync-preferences", compactMode: true }
  });
  assert(syncSetCallCount - baselineSyncSets === 1, "Exactly 1 sync.set triggered when preferences genuinely mutate");

  // Save the same preferences again -> dirty checking must suppress the write
  await dispatch({
    type: "save-preferences",
    payload: { privacyMode: "sync-preferences", compactMode: true }
  });
  assert(syncSetCallCount - baselineSyncSets === 1, "0 additional sync.set calls when saving identical preferences (dirty check passed)");
});

// ==============================================================================
// TEST 4: Cloud Sync Cursor Pagination Loop & Termination (F-07 Stress Test)
// ==============================================================================
await runTest("F-07 Stress: Cloud Sync Cursor Pagination fetches up to safe ceiling without infinite loop", async () => {
  // Connect cloud account
  await dispatch({
    type: "cloud-connect",
    payload: {
      apiBaseUrl: "https://api.stress.test",
      accessToken: "stress-token-pagination"
    }
  }, { url: `${extensionRoot}settings/settings.html` });

  // Simulate remote having 15 pages (more than CLOUD_SYNC_MAX_PAGES = 10)
  remotePagesToServe = 15;
  servedPagesCount = 0;

  const syncResult = await dispatch({ type: "cloud-sync" }, { url: `${extensionRoot}settings/settings.html` });
  assert(syncResult?.status?.connected === true, "Cloud sync completed while connected");

  // Bounded loop must have executed exactly 10 pages, never entering an infinite loop
  assert(servedPagesCount === 10, `Pagination loop bounded safely at 10 pages (served: ${servedPagesCount})`);

  // Disconnect cleanly
  await dispatch({ type: "cloud-disconnect" }, { url: `${extensionRoot}settings/settings.html` });
});

// ==============================================================================
// TEST 5: Honest Unknown Model Pricing & Zero Fabrication (F-11 Verification)
// ==============================================================================
await runTest("F-11 Verification: Unknown models return $0.00 cost, never fabricate GPT-4o pricing", async () => {
  const unknownModelsTestEvents = [
    { site: "chatgpt", model: "unannounced-chatgpt-model", prompt: 100000, output: 50000 },
    { site: "claude", model: "claude-4-preview", prompt: 100000, output: 50000 },
    { site: "gemini", model: "gemini-3.0-ultra", prompt: 100000, output: 50000 },
    { site: "perplexity", model: "custom-sonar-x", prompt: 100000, output: 50000 },
    { site: "grok", model: "grok-4-secret", prompt: 100000, output: 50000 },
    { site: "generic", model: "unknown-any", prompt: 100000, output: 50000 }
  ];

  for (const testCase of unknownModelsTestEvents) {
    const eventId = `test-cost-${testCase.site}-${testCase.model}`;
    await dispatch({
      type: "commit-usage-event",
      event: {
        id: eventId,
        clientEventId: eventId,
        site: testCase.site,
        model: testCase.model,
        threadId: "cost-thread",
        timestamp: Date.now(),
        promptTokens: testCase.prompt,
        outputTokens: testCase.output,
        totalTokens: testCase.prompt + testCase.output,
        promptChars: testCase.prompt * 4,
        outputChars: testCase.output * 4,
        status: "COMPLETED",
        accuracy: "estimated",
        measurement: {
          schemaVersion: 1,
          measurementMethod: "dom-text-heuristic",
          measurementLevel: "approximation",
          confidence: 0.51,
          errorMarginPercent: 40,
          tokenizer: "none",
          source: "visible provider DOM text"
        }
      }
    });
  }

  const snapshot = await dispatch({ type: "get-snapshot" });
  assert(snapshot?.analytics !== undefined, "Analytics computed on snapshot");

  // Check model breakdown
  const byModel = snapshot.analytics.byModel ?? [];
  for (const testCase of unknownModelsTestEvents) {
    const modelMetric = byModel.find((m) => m.id.includes(testCase.model) || m.label.includes(testCase.model));
    if (modelMetric) {
      assert(modelMetric.cost === 0, `Model '${testCase.model}' on ${testCase.site} costs $0.00 (not GPT-4o fallback: actual ${modelMetric.cost})`);
    }
  }
});

// ==============================================================================
// TEST 6: Zero Prompt Privacy Leakage Across All Payloads and Storage
// ==============================================================================
await runTest("Privacy Zero-Leakage: No promptText/responseText in sync, cloud payloads, or storage", async () => {
  const secretPromptMarker = "SUPER_CONFIDENTIAL_USER_PROMPT_SECRET_TOKEN_99999";
  const secretResponseMarker = "CONFIDENTIAL_LLM_ASSISTANT_RESPONSE_DATA_88888";

  // Simulate a commit exchange containing text in unexpected keys
  await dispatch({
    type: "commit-usage-event",
    event: {
      id: "privacy-leak-test-event",
      clientEventId: "client-privacy-leak-test",
      site: "chatgpt",
      model: "gpt-4o",
      threadId: "privacy-thread",
      timestamp: Date.now(),
      promptTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      promptChars: 400,
      outputChars: 200,
      status: "COMPLETED",
      accuracy: "estimated",
      promptText: secretPromptMarker,
      responseText: secretResponseMarker,
      secretPayload: secretPromptMarker
    }
  });

  // Verify in storage
  const serializedStorage = JSON.stringify(Array.from(storage.entries()));
  assert(!serializedStorage.includes(secretPromptMarker), "secretPromptMarker was stripped from local storage");
  assert(!serializedStorage.includes(secretResponseMarker), "secretResponseMarker was stripped from local storage");
  assert(!serializedStorage.includes("promptText"), "Key 'promptText' does not exist in local storage");
  assert(!serializedStorage.includes("responseText"), "Key 'responseText' does not exist in local storage");

  // Verify in sync storage
  const serializedSync = JSON.stringify(Array.from(syncStorage.entries()));
  assert(!serializedSync.includes(secretPromptMarker), "secretPromptMarker was not leaked to sync storage");
  assert(!serializedSync.includes(secretResponseMarker), "secretResponseMarker was not leaked to sync storage");

  // Verify in cloud payloads
  const serializedCloud = JSON.stringify(cloudRequests);
  assert(!serializedCloud.includes(secretPromptMarker), "secretPromptMarker was not leaked to cloud requests");
  assert(!serializedCloud.includes(secretResponseMarker), "secretResponseMarker was not leaked to cloud requests");
});

// ==============================================================================
// TEST 7: Concurrent State Race Condition & Mutex Integrity
// ==============================================================================
await runTest("Concurrency: 50 Mixed Concurrent Operations Complete Without Corruption", async () => {
  const operations = [];
  for (let i = 0; i < 50; i++) {
    if (i % 4 === 0) {
      operations.push(dispatch({ type: "save-preferences", payload: { overlayPosition: { x: i, y: i } } }));
    } else if (i % 4 === 1) {
      operations.push(dispatch({ type: "get-snapshot" }));
    } else if (i % 4 === 2) {
      operations.push(dispatch({
        type: "commit-usage-event",
        event: {
          id: `concurrent-ev-${i}`,
          clientEventId: `concurrent-client-${i}`,
          site: "claude",
          model: "claude-3-7-sonnet",
          threadId: "concurrent-thread",
          timestamp: Date.now() - i * 100,
          promptTokens: 10,
          outputTokens: 10,
          totalTokens: 20,
          promptChars: 40,
          outputChars: 40,
          status: "COMPLETED",
          accuracy: "estimated"
        }
      }));
    } else {
      operations.push(dispatch({ type: "cloud-status" }));
    }
  }

  const results = await Promise.all(operations);
  assert(results.length === 50, "All 50 concurrent operations resolved successfully");

  const finalSnapshot = await dispatch({ type: "get-snapshot" });
  assert(finalSnapshot?.state?.usageEvents !== undefined, "Final state is valid and accessible");
});

if (verbose) {
  console.log("\n================================================================================");
  console.log(`STRESS & SECURITY VERIFICATION COMPLETE: ${testsPassed} assertions passed, ${testsFailed} failed across ${testCasesRun} scenarios`);
  console.log("================================================================================");
} else {
  console.log(`stress-check=${testsFailed === 0 ? "pass" : "fail"}; scenarios=${testCasesRun}; assertions_passed=${testsPassed}; assertion_failures=${testsFailed}`);
}

if (testsFailed > 0) {
  process.exit(1);
}
