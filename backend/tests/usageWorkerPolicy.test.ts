import assert from "node:assert/strict";
import test from "node:test";
import { shouldDeadLetterDelivery, shouldPauseFreshReads } from "../src/jobs/usageWorkerPolicy.js";

test("dead-letters only after Redis delivery attempts exceed max attempts", () => {
  assert.equal(shouldDeadLetterDelivery(undefined, 5), false);
  assert.equal(shouldDeadLetterDelivery(5, 5), false);
  assert.equal(shouldDeadLetterDelivery(6, 5), true);
});

test("pauses fresh reads while pending messages are at or above threshold", () => {
  assert.equal(shouldPauseFreshReads(999, 1_000), false);
  assert.equal(shouldPauseFreshReads(1_000, 1_000), true);
  assert.equal(shouldPauseFreshReads(1_001, 1_000), true);
});
