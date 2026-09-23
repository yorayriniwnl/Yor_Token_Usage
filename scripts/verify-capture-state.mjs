import assert from "node:assert/strict";
import { build } from "esbuild";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

let now = 1_000;
let nextTimerId = 1;
const timers = new Map();
class TestDate extends Date {
  static now() { return now; }
}
function testSetTimeout(callback, delay = 0) {
  const id = nextTimerId++;
  timers.set(id, { callback, dueAt: now + delay });
  return id;
}
function testClearTimeout(id) { timers.delete(id); }
function advance(ms) {
  const target = now + ms;
  while (true) {
    const next = [...timers.entries()].sort((a, b) => a[1].dueAt - b[1].dueAt)[0];
    if (!next || next[1].dueAt > target) break;
    timers.delete(next[0]);
    now = next[1].dueAt;
    next[1].callback();
  }
  now = target;
}

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/capture/stateMachine.ts", import.meta.url))],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false
});
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, {
  module, exports: module.exports, Date: TestDate, crypto: webcrypto, console,
  setTimeout: testSetTimeout, clearTimeout: testClearTimeout
});
const { CaptureStateMachine } = module.exports;

function scenario() {
  let stopPresent = false;
  let visibleMessages = [];
  const commits = [];
  const adapter = {
    site: "chatgpt",
    getConversationId: () => "thread-1",
    findStopControl: () => stopPresent ? {} : null,
    collectVisibleMessages: () => visibleMessages
  };
  const machine = new CaptureStateMachine(adapter, (event) => commits.push(event));
  const update = (text, id = "assistant-1") => {
    visibleMessages = text ? [{ id, role: "assistant", text }] : [];
    machine.onDomUpdate({}, new URL("https://chatgpt.com/c/thread-1"), visibleMessages, null);
  };
  return {
    machine,
    commits,
    update,
    setStop(value) { stopPresent = value; },
    getVisibleMessages: () => visibleMessages
  };
}

const quiet = scenario();
quiet.machine.onUserSubmit("prompt", "GPT-4o", "thread-1", []);
quiet.update("complete answer");
assert.equal(quiet.commits.length, 0, "a response without a stop control must not commit immediately");
advance(999);
assert.equal(quiet.commits.length, 0, "a response must remain pending until the quiet period elapses");
advance(1);
assert.equal(quiet.commits.length, 1, "a stable non-empty response must commit after the quiet period");
advance(2_000);
assert.equal(quiet.commits.length, 1, "a completed response must never be committed twice");

const streaming = scenario();
streaming.machine.onUserSubmit("prompt", "GPT-4o", "thread-1", []);
streaming.update("partial");
advance(500);
streaming.update("finished answer");
advance(999);
assert.equal(streaming.commits.length, 0, "new response text must restart the quiet period");
advance(1);
assert.equal(streaming.commits.length, 1, "the latest stable response text must be committed");
assert.equal(streaming.commits[0].outputChars, "finished answer".length);

const stopped = scenario();
stopped.setStop(true);
stopped.machine.onUserSubmit("prompt", "GPT-4o", "thread-1", []);
stopped.update("finished answer");
advance(1_000);
assert.equal(stopped.commits.length, 0, "a visible stop control means the provider may still be generating");
stopped.setStop(false);
stopped.update("finished answer");
advance(250);
assert.equal(stopped.commits.length, 1, "removing the stop control allows stable completion");

const unanswered = scenario();
unanswered.machine.onUserSubmit("prompt", "GPT-4o", "thread-1", []);
advance(10 * 60_000 + 1);
assert.equal(unanswered.machine.getPending(), null, "a silent request must be abandoned after the hard deadline");
assert.equal(unanswered.machine.getState(), "ABANDONED", "a silent timeout must not look completed");
assert.equal(unanswered.commits.length, 0, "a response timeout must never commit an empty or partial exchange");
assert.equal(timers.size, 0, "completed and abandoned exchanges must clear all timers");

console.log("capture-state-check=pass (quiet completion, stream reset, stop control, hard timeout, timer cleanup)");
