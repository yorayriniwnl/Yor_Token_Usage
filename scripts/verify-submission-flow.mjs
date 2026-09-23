import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

let listenerModule;
try {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("../src/capture/submissionListeners.ts", import.meta.url))],
    bundle: true,
    format: "cjs",
    platform: "node",
    write: false
  });
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, Date });
  listenerModule = module.exports;
} catch (error) {
  assert.fail(`submission listener must be implemented and loadable before event behavior can be checked: ${error.message}`);
}

const registered = new Map();
const root = {
  addEventListener(type, listener) {
    const handlers = registered.get(type) ?? [];
    handlers.push(listener);
    registered.set(type, handlers);
  }
};
let composer;
const form = { contains: (element) => element === composer };
const sendButton = { contains: (element) => element === sendButton || element?.parent === sendButton };
composer = { contains: (element) => element === composer || element?.parent === composer, closest: () => form };

let draft = "first prompt";
const submitted = [];
listenerModule.observeUserSubmissions(root, {
  findComposer: () => composer,
  findSendControl: () => sendButton,
  readComposerText: () => draft,
  getModel: () => "GPT-4o",
  getThreadId: () => "thread-1",
  getVisibleMessages: () => [],
  onSubmit: (text, model, threadId, messages) => submitted.push({ text, model, threadId, messages })
});

function fire(type, event) {
  for (const listener of registered.get(type) ?? []) listener(event);
}

let preventCount = 0;
const keyEvent = (overrides = {}) => ({
  key: "Enter", keyCode: 13, target: composer, shiftKey: false, isComposing: false,
  preventDefault() { preventCount += 1; }, ...overrides
});

fire("keydown", keyEvent({ shiftKey: true }));
fire("keydown", keyEvent({ isComposing: true }));
fire("keydown", keyEvent({ keyCode: 229 }));
fire("keydown", keyEvent({ target: {} }));
assert.equal(submitted.length, 0, "Shift+Enter, IME, and keys outside the composer must not submit");

fire("keydown", keyEvent());
fire("submit", { target: form });
fire("click", { target: { parent: sendButton } });
assert.equal(submitted.length, 1, "Enter followed by form/click signals must produce one submission");
assert.equal(submitted[0].text, "first prompt");

draft = "";
fire("input", { target: composer });
draft = "first prompt";
fire("input", { target: composer });
fire("keydown", keyEvent());
assert.equal(submitted.length, 2, "clearing and retyping the same prompt must allow a new submission");

draft = "form prompt";
fire("submit", { target: form });
assert.equal(submitted.length, 3, "native form submission must be captured");

draft = "click prompt";
fire("click", { target: { parent: sendButton } });
assert.equal(submitted.length, 4, "send-button click must remain supported");

draft = "";
fire("keydown", keyEvent());
assert.equal(submitted.length, 4, "empty composer submissions must be ignored");
assert.equal(preventCount, 0, "capture must not cancel the provider's native send behavior");
console.log("submission-flow-check=pass (4 submissions, duplicate signals deduped, native behavior preserved)");
