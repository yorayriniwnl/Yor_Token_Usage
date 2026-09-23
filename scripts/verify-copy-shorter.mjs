import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import vm from "node:vm";

const optimizerBundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/optimizer/safeOptimizer.ts", import.meta.url))],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false
});
const optimizerModule = { exports: {} };
vm.runInNewContext(optimizerBundle.outputFiles[0].text, { module: optimizerModule, exports: optimizerModule.exports });
const { getCopyShorterCandidate } = optimizerModule.exports;
assert.equal(typeof getCopyShorterCandidate, "function", "the optimizer must expose a copy-ready shorter candidate");

const fencedCode = "```python\n  print('same')\n  print('same')\n```";
const draft = `Summarize this carefully.\n\n\n\n${fencedCode}\n\n\n\n`;
const candidate = getCopyShorterCandidate(draft);
assert.ok(candidate && candidate.length < draft.length, "the candidate must be shorter than the draft");
assert.ok(candidate.includes(fencedCode), "copying a shorter prompt must preserve code blocks byte-for-byte");
assert.equal(getCopyShorterCandidate("Keep the first line.  \nKeep the second line."), null, "the candidate must not erase Markdown hard-line breaks");
assert.equal(getCopyShorterCandidate("Use this for the purpose of data retention."), null, "the candidate must not make speculative wording changes");
const fencedCrLf = "```python\r\n  \r\n    print('same')\r\n```";
const fencedCrLfDraft = `Intro.\n\n\n\n${fencedCrLf}\n\n\n\nOutro.`;
const fencedCrLfCandidate = getCopyShorterCandidate(fencedCrLfDraft);
assert.ok(fencedCrLfCandidate?.includes(fencedCrLf), "line-ending cleanup must preserve fenced code bytes, including CRLF");
const quotedFence = "> ```python\r\n>     print('for the purpose of')\r\n>     print('for the purpose of')\r\n> ```";
const quotedDraft = `Intro.\n\n\n\n${quotedFence}\n\n\n\nOutro.`;
const quotedCandidate = getCopyShorterCandidate(quotedDraft);
assert.ok(quotedCandidate?.includes(quotedFence), "cleanup must preserve blockquoted fenced code bytes");
assert.equal(optimizerModule.exports.deduplicateLines(quotedFence).result, quotedFence, "deduplication must preserve blockquoted source lines");
assert.equal(optimizerModule.exports.generateSafeSuggestions(quotedFence).length, 0, "wording suggestions must not rewrite blockquoted source code");

const indentedCode = "    const value = 'for the purpose of';\n    const value = 'for the purpose of';";
const indentedDraft = `Intro.\n\n\n\n${indentedCode}\n\n\n\nOutro.`;
const indentedCandidate = getCopyShorterCandidate(indentedDraft);
assert.ok(indentedCandidate?.includes(indentedCode), "copy cleanup must preserve indented Markdown code blocks");
assert.equal(optimizerModule.exports.deduplicateLines(indentedCode).result, indentedCode, "deduplication must preserve indented code");
assert.equal(optimizerModule.exports.generateSafeSuggestions(indentedCode).length, 0, "wording suggestions must not rewrite indented code");

const hardBreakDraft = "Keep the first line.  \r\nKeep the second line.\n\n\n";
const hardBreakCandidate = getCopyShorterCandidate(hardBreakDraft);
assert.ok(hardBreakCandidate?.includes("Keep the first line.  \nKeep the second line."), "line-ending normalization must preserve Markdown hard-break spaces");
assert.equal(typeof optimizerModule.exports.deduplicateLines, "function");
const codeDedup = optimizerModule.exports.deduplicateLines(fencedCode);
assert.equal(codeDedup.removedCount, 0, "deduplication must not remove repeated source lines inside a code fence");
assert.equal(codeDedup.result, fencedCode);
const dedupSuggestion = optimizerModule.exports.generateSafeSuggestions("Keep this rule.\nKeep this rule.")
  .find((suggestion) => suggestion.kind === "exact_deduplication");
assert.ok(dedupSuggestion?.requiresUserApproval, "line deduplication must require review");
assert.equal(dedupSuggestion.preservesSemantics, false, "line deduplication must not claim guaranteed semantic preservation");
const wordingSuggestion = optimizerModule.exports.generateSafeSuggestions("Explain this for the purpose of comparison.")
  .find((suggestion) => suggestion.kind === "semantic_reduction");
assert.ok(wordingSuggestion?.requiresUserApproval, "wording changes must require review");
assert.equal(wordingSuggestion.preservesSemantics, false, "wording changes must not claim guaranteed semantic preservation");

const contentSource = await readFile(new URL("../src/content/index.ts", import.meta.url), "utf8");
assert.ok(/getCopyShorterCandidate\(/.test(contentSource), "the overlay must generate a shorter candidate from its current composer");
assert.ok(!/composer\.(?:value|textContent)\s*=/.test(contentSource), "the overlay copy action must not edit the source composer");
assert.ok(/writeTextToClipboard\(shorter\)/.test(contentSource), "the overlay button must copy the generated candidate");
const popupSource = await readFile(new URL("../src/popup/index.ts", import.meta.url), "utf8");
assert.ok(/getCopyShorterCandidate\(/.test(popupSource), "the popup button must optimize the active draft before copying");
assert.ok(!/writeText\(shorter\s*\|\|\s*""\)/.test(popupSource), "the popup must not label the unchanged draft as shorter");

const clipboardBundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/shared/clipboard.ts", import.meta.url))],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false
});
const clipboardModule = { exports: {} };
vm.runInNewContext(clipboardBundle.outputFiles[0].text, { module: clipboardModule, exports: clipboardModule.exports });
assert.equal(typeof clipboardModule.exports.writeTextToClipboard, "function", "both UIs must use the shared clipboard helper");

let clipboardValue = "";
const clipboardSuccessContext = vm.createContext({
  module: { exports: {} },
  exports: {},
  navigator: { clipboard: { writeText: async (text) => { clipboardValue = text; } } }
});
vm.runInContext(clipboardBundle.outputFiles[0].text, clipboardSuccessContext);
await clipboardSuccessContext.module.exports.writeTextToClipboard("candidate");
assert.equal(clipboardValue, "candidate", "the Clipboard API path must write the candidate");

let fallbackCopied = "";
const fallbackElement = {
  value: "",
  style: {},
  setAttribute() {},
  select() { fallbackCopied = this.value; },
  remove() {}
};
const clipboardFallbackContext = vm.createContext({
  module: { exports: {} },
  exports: {},
  navigator: { clipboard: { writeText: async () => { throw new Error("permission denied"); } } },
  document: {
    body: { appendChild() {} },
    createElement: () => fallbackElement,
    execCommand: () => true
  }
});
vm.runInContext(clipboardBundle.outputFiles[0].text, clipboardFallbackContext);
await clipboardFallbackContext.module.exports.writeTextToClipboard("fallback candidate");
assert.equal(fallbackCopied, "fallback candidate", "a rejected Clipboard API write must use the document fallback");

const clipboardFailureContext = vm.createContext({
  module: { exports: {} },
  exports: {},
  navigator: { clipboard: { writeText: async () => { throw new Error("permission denied"); } } },
  document: {
    body: { appendChild() {} },
    createElement: () => ({ ...fallbackElement }),
    execCommand: () => false
  }
});
vm.runInContext(clipboardBundle.outputFiles[0].text, clipboardFailureContext);
await assert.rejects(clipboardFailureContext.module.exports.writeTextToClipboard("candidate"), /copy/i);

assert.ok(/writeTextToClipboard\(shorter\)/.test(contentSource), "the overlay must use the shared clipboard helper");
assert.ok(/writeTextToClipboard\(shorter\)/.test(popupSource), "the popup must use the shared clipboard helper");

console.log("copy-shorter-check=pass");
