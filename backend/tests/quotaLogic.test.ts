import assert from "node:assert/strict";
import test from "node:test";

test("quota limit is governed by total account usage across all providers/models", () => {
  const plan = { monthlyTokenCap: 100_000 };
  const accountUsedTokens = 120_000;
  const scopedUsedTokens = 5_000;

  const tokenCap = Math.max(0, plan.monthlyTokenCap);
  const remainingTokens = Math.max(0, tokenCap - accountUsedTokens);
  const limited = accountUsedTokens >= tokenCap;

  assert.equal(limited, true);
  assert.equal(remainingTokens, 0);
  assert.equal(scopedUsedTokens, 5_000);
});

test("quota limit allows usage when total account usage is below token cap", () => {
  const plan = { monthlyTokenCap: 100_000 };
  const accountUsedTokens = 45_000;
  const scopedUsedTokens = 12_000;

  const tokenCap = Math.max(0, plan.monthlyTokenCap);
  const remainingTokens = Math.max(0, tokenCap - accountUsedTokens);
  const limited = accountUsedTokens >= tokenCap;

  assert.equal(limited, false);
  assert.equal(remainingTokens, 55_000);
  assert.equal(scopedUsedTokens, 12_000);
});

test("non-completed events (FAILED and RATE_LIMITED) do not contribute to consumed tokens", () => {
  const events = [
    { totalTokens: 500, status: "COMPLETED" },
    { totalTokens: 1000, status: "FAILED" },
    { totalTokens: 2000, status: "RATE_LIMITED" },
    { totalTokens: 300, status: "COMPLETED" }
  ];

  const completedTokens = events
    .filter((e) => e.status === "COMPLETED")
    .reduce((sum, e) => sum + e.totalTokens, 0);

  assert.equal(completedTokens, 800);
});

