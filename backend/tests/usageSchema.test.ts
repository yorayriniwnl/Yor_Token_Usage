import assert from "node:assert/strict";
import test from "node:test";
import { usageBatchJobSchema } from "../src/schemas/usage.js";

const baseJob = {
  userId: "11111111-1111-4111-8111-111111111111",
  deviceId: "22222222-2222-4222-8222-222222222222",
  events: [
    {
      clientEventId: "event-123456",
      provider: "openai",
      model: "gpt-4.1",
      occurredAt: new Date().toISOString(),
      promptTokens: 10,
      outputTokens: 15,
      totalTokens: 25,
      status: "COMPLETED",
      accuracy: "ESTIMATED"
    }
  ]
};

test("queued usage jobs parse and default attempts", () => {
  const parsed = usageBatchJobSchema.parse(baseJob);

  assert.equal(parsed.attempts, 0);
  assert.equal(parsed.events[0]?.totalTokens, 25);
  assert.equal(parsed.events[0]?.measurementLevel, "unknown");
  assert.equal(parsed.events[0]?.confidence, 0);
});

test("queued usage jobs preserve bounded measurement provenance", () => {
  const parsed = usageBatchJobSchema.parse({
    ...baseJob,
    events: [{
      ...baseJob.events[0],
      schemaVersion: 1,
      measurementMethod: "dom-text-heuristic",
      measurementLevel: "approximation",
      confidence: 0.51,
      errorMarginPercent: 40,
      tokenizer: "none",
      source: "visible provider DOM text"
    }]
  });

  assert.equal(parsed.events[0]?.measurementMethod, "dom-text-heuristic");
  assert.equal(parsed.events[0]?.measurementLevel, "approximation");
  assert.equal(parsed.events[0]?.confidence, 0.51);
  assert.equal(parsed.events[0]?.errorMarginPercent, 40);
});

test("queued usage jobs reject out-of-range measurement confidence", () => {
  const result = usageBatchJobSchema.safeParse({
    ...baseJob,
    events: [{ ...baseJob.events[0], confidence: 1.01 }]
  });

  assert.equal(result.success, false);
});

test("queued usage jobs reject unsupported provider-authoritative accuracy claims", () => {
  const result = usageBatchJobSchema.safeParse({
    ...baseJob,
    events: [{ ...baseJob.events[0], accuracy: "EXACT" }]
  });

  assert.equal(result.success, false);
});

test("queued usage jobs reject unverified provider-authoritative measurement levels", () => {
  const result = usageBatchJobSchema.safeParse({
    ...baseJob,
    events: [{ ...baseJob.events[0], measurementLevel: "authoritative" }]
  });

  assert.equal(result.success, false);
});

test("queued usage jobs reject token totals below prompt plus output", () => {
  const result = usageBatchJobSchema.safeParse({
    ...baseJob,
    events: [{ ...baseJob.events[0], totalTokens: 20 }]
  });

  assert.equal(result.success, false);
});

test("queued usage jobs reject stale events", () => {
  const result = usageBatchJobSchema.safeParse({
    ...baseJob,
    events: [{ ...baseJob.events[0], occurredAt: new Date(Date.now() - 91 * 24 * 60 * 60_000).toISOString() }]
  });

  assert.equal(result.success, false);
});

test("queued usage jobs reject future events outside clock skew", () => {
  const result = usageBatchJobSchema.safeParse({
    ...baseJob,
    events: [{ ...baseJob.events[0], occurredAt: new Date(Date.now() + 6 * 60_000).toISOString() }]
  });

  assert.equal(result.success, false);
});

test("queued usage jobs reject malformed prompt hashes", () => {
  const result = usageBatchJobSchema.safeParse({
    ...baseJob,
    events: [{ ...baseJob.events[0], promptHash: "not-a-sha256" }]
  });

  assert.equal(result.success, false);
});
