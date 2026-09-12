import assert from "node:assert/strict";
import test from "node:test";
import { calculateCost, resolveModelProfile } from "../src/services/pricing.js";

test("resolves model profile by exact id, matcher, and provider fallback", () => {
  const gpt4o = resolveModelProfile("gpt-4o");
  assert.equal(gpt4o.id, "gpt-4o");
  assert.equal(gpt4o.inputCostPer1M, 2.50);
  assert.equal(gpt4o.outputCostPer1M, 10.00);

  const claude = resolveModelProfile("claude-3-7-sonnet");
  assert.equal(claude.id, "claude-sonnet");
  assert.equal(claude.inputCostPer1M, 3.00);

  const deepseek = resolveModelProfile("deepseek-chat");
  assert.equal(deepseek.id, "deepseek-chat");
  assert.equal(deepseek.inputCostPer1M, 0.14);
  assert.equal(deepseek.outputCostPer1M, 0.28);

  const unknownChatgpt = resolveModelProfile("custom-unknown-model", "chatgpt");
  assert.equal(unknownChatgpt.id, "gpt-4o");
});

test("calculates accurate USD costs for prompt and output tokens", () => {
  // 10,000 prompt tokens and 2,000 output tokens on GPT-4o
  // Prompt: 10,000 / 1,000,000 * 2.50 = $0.025
  // Output: 2,000 / 1,000,000 * 10.00 = $0.020
  // Total: $0.045
  const cost = calculateCost(10_000, 2_000, "gpt-4o");
  assert.equal(cost.promptCost, 0.025);
  assert.equal(cost.outputCost, 0.02);
  assert.equal(cost.totalCost, 0.045);
  assert.equal(cost.model.id, "gpt-4o");
});

test("calculates ultra-low costs for DeepSeek and mini models", () => {
  // 1,000,000 tokens on DeepSeek V3 ($0.14 prompt + $0.28 output)
  const cost = calculateCost(1_000_000, 1_000_000, "deepseek-chat");
  assert.equal(cost.promptCost, 0.14);
  assert.equal(cost.outputCost, 0.28);
  assert.equal(cost.totalCost, 0.42);
});
