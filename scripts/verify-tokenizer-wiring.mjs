import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { encode as encodeO200k } from "gpt-tokenizer";
import { encode as encodeCl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { webcrypto } from "node:crypto";
import { build } from "esbuild";
import vm from "node:vm";

const accuracyBundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/measurement/accuracy-engine.ts", import.meta.url))],
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false
});
const tokenizerBundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/measurement/gpt-tokenizer.ts", import.meta.url))],
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false
});

function createContext() {
  return vm.createContext({
    console,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    ArrayBuffer,
    DataView,
    atob,
    URL,
    crypto: webcrypto,
    setTimeout,
    clearTimeout
  });
}

const unavailableContext = createContext();
vm.runInContext(accuracyBundle.outputFiles[0].text, unavailableContext);
const withoutEncoder = unavailableContext.YorTokenAccuracy.estimateTokenBreakdownForModel("A model-aware count", [], "chatgpt", "GPT-4o");
assert.equal(withoutEncoder.measurement.measurementLevel, "approximation", "an unavailable encoder must not be labeled deterministic");
assert.equal(withoutEncoder.measurement.tokenizer, "none", "fallback counts must identify that no tokenizer ran");
assert.equal(unavailableContext.YorTokenAccuracy.estimateTokenBreakdownForModel("unknown", [], "chatgpt", "Future GPT-99").measurement.measurementLevel, "approximation", "unknown OpenAI models must not inherit an encoder");
assert.equal(unavailableContext.YorTokenAccuracy.estimateTokenBreakdownForModel("unknown", [], "claude", "Claude 3.5 Sonnet").measurement.measurementLevel, "approximation", "non-OpenAI providers must not be tokenized with OpenAI BPE");

const loadedContext = createContext();
vm.runInContext(tokenizerBundle.outputFiles[0].text, loadedContext);
vm.runInContext(accuracyBundle.outputFiles[0].text, loadedContext);
const text = "JSON: {\"café\": [true, false, null]} — 東京 — antidisestablishmentarianism";
const o200kCount = loadedContext.YorTokenAccuracy.estimateTokenBreakdownForModel(text, [], "chatgpt", "GPT-4o");
assert.equal(o200kCount.total, encodeO200k(text).length, "o200k results must match the installed encoding");
assert.equal(o200kCount.measurement.measurementLevel, "deterministic_local");
assert.doesNotMatch(o200kCount.measurement.notes, /official BPE encoder/i, "measurement notes must not imply the third-party tokenizer package is an official OpenAI implementation");
assert.match(o200kCount.measurement.notes, /visible text/i, "deterministic metadata must be scoped to visible text rather than hidden provider context");
assert.equal(loadedContext.YorTokenAccuracy.createMeasurement({ provider: "chatgpt", model: "GPT-4o" }).measurementLevel, "approximation", "context estimates without actual token counts must not claim deterministic metadata");

const cl100kCount = loadedContext.YorTokenAccuracy.estimateTokenBreakdown(
  text,
  [],
  { provider: "chatgpt", model: "legacy GPT-4", tokenizer: "cl100k_base" }
);
assert.equal(cl100kCount.total, encodeCl100k(text).length, "cl100k models must use the cl100k encoder, not the default o200k encoder");

const unknownAttachment = loadedContext.YorTokenAccuracy.estimateTokenBreakdownForModel(
  text,
  [{ name: "diagram.png", tokenProvenance: "unknown" }],
  "chatgpt",
  "GPT-4o"
);
assert.equal(unknownAttachment.total, null, "an attachment with unknown token contribution must not be counted as zero");
assert.equal(unknownAttachment.measurement.measurementLevel, "unknown", "an incomplete total must not retain deterministic metadata");
const estimatedAttachment = loadedContext.YorTokenAccuracy.estimateTokenBreakdownForModel(
  text,
  [{ name: "manual.pdf", pages: 2, tokenProvenance: "rough_estimate" }],
  "chatgpt",
  "GPT-4o"
);
assert.equal(estimatedAttachment.measurement.measurementLevel, "approximation", "a deterministic text count plus estimated attachment tokens is an approximation overall");

const throwingContext = createContext();
throwingContext.YorTokenizers = Object.freeze({
  o200k_base: () => { throw new Error("encoder unavailable"); },
  cl100k_base: () => { throw new Error("encoder unavailable"); }
});
vm.runInContext(accuracyBundle.outputFiles[0].text, throwingContext);
const encoderFailure = throwingContext.YorTokenAccuracy.estimateTokenBreakdownForModel(text, [], "chatgpt", "GPT-4o");
assert.equal(encoderFailure.measurement.measurementLevel, "approximation", "an encoder exception must not leave deterministic metadata on the fallback");

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const tokenizerScript = manifest.content_scripts.find((entry) => entry.js.includes("content/gpt-tokenizer.js"));
const accuracyScript = manifest.content_scripts.find((entry) => entry.js.includes("content/accuracy-engine.js"));
assert.ok(tokenizerScript && accuracyScript, "manifest must load both the encoder and accuracy engine");
assert.equal(tokenizerScript.run_at, "document_start", "the encoder must exist before the document-idle accuracy engine runs");
assert.deepEqual(tokenizerScript.matches, ["https://chatgpt.com/*", "https://chat.openai.com/*"], "the 5.3 MB tokenizer bundle must load only on OpenAI chat pages");
assert.equal(tokenizerScript.world, "ISOLATED");
assert.equal(accuracyScript.run_at, "document_idle");
assert.equal(accuracyScript.world, "ISOLATED", "encoder and estimator must share the extension's isolated world");
assert.equal(JSON.stringify(manifest.web_accessible_resources).includes("content/gpt-tokenizer.js"), false, "the page must not be able to import the tokenizer bundle");

const contentSource = await readFile(new URL("../src/content/index.ts", import.meta.url), "utf8");
const stateMachineSource = await readFile(new URL("../src/capture/stateMachine.ts", import.meta.url), "utf8");
assert.match(contentSource, /estimateTokenBreakdownForModel\(/, "draft analysis must resolve the active provider/model tokenizer");
assert.match(contentSource, /getDraftTokenBreakdown\(draftText, attachments, activeAdapter\.site, modelInfo\.label/, "live composer estimates must pass provider and model to the resolver");
assert.match(contentSource, /measurement: getContextMeasurement\(activeAdapter\.site, modelInfo\.label/, "mixed heuristic context totals must stay approximate");
assert.match(stateMachineSource, /estimateTokenBreakdownForModel\(/, "committed prompt/response counts must use the active provider/model tokenizer");

const stateMachineBundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/capture/stateMachine.ts", import.meta.url))],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false
});
const stateMachineModule = { exports: {} };
loadedContext.module = stateMachineModule;
loadedContext.exports = stateMachineModule.exports;
vm.runInContext(stateMachineBundle.outputFiles[0].text, loadedContext);
const { CaptureStateMachine } = stateMachineModule.exports;
const commits = [];
const messages = [];
const adapter = {
  site: "chatgpt",
  getConversationId: () => "thread-1",
  findStopControl: () => null,
  collectVisibleMessages: () => messages
};
const machine = new CaptureStateMachine(adapter, (event) => commits.push(event));
const prompt = "Prompt with emoji 🤖";
const response = "Response with 東京 and emoji 🌍";
assert.equal(machine.onUserSubmit(prompt, "GPT-4o", "thread-1", []), true);
assert.equal(machine.getPending().promptTokens, encodeO200k(prompt).length, "the submitted prompt must use the detected model's tokenizer");
messages.push({ id: "assistant-1", role: "assistant", text: response });
machine.onDomUpdate({}, new URL("https://chatgpt.com/c/thread-1"), messages, null);
await new Promise((resolve) => setTimeout(resolve, 1_100));
assert.equal(commits.length, 1, "the modeled capture must commit a stable response");
assert.equal(commits[0].outputTokens, encodeO200k(response).length, "the response count must use the detected model's tokenizer");
assert.equal(commits[0].measurement.measurementLevel, "deterministic_local");

const throwingMachineModule = { exports: {} };
throwingContext.module = throwingMachineModule;
throwingContext.exports = throwingMachineModule.exports;
vm.runInContext(stateMachineBundle.outputFiles[0].text, throwingContext);
const throwingCommits = [];
const throwingMessages = [];
const throwingMachine = new throwingMachineModule.exports.CaptureStateMachine({
  site: "chatgpt",
  getConversationId: () => "thread-1",
  findStopControl: () => null,
  collectVisibleMessages: () => throwingMessages
}, (event) => throwingCommits.push(event));
assert.equal(throwingMachine.onUserSubmit(prompt, "GPT-4o", "thread-1", []), true);
throwingMessages.push({ id: "assistant-2", role: "assistant", text: response });
throwingMachine.onDomUpdate({}, new URL("https://chatgpt.com/c/thread-1"), throwingMessages, null);
await new Promise((resolve) => setTimeout(resolve, 1_100));
assert.equal(throwingCommits.length, 1);
assert.equal(throwingCommits[0].measurement.measurementLevel, "approximation", "committed measurements must reflect tokenizer exceptions on either message");
assert.equal(throwingCommits[0].measurement.tokenizer, "none");

console.log("tokenizer-wiring-check=pass");
