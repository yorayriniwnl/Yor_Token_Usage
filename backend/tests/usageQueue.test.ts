import assert from "node:assert/strict";
import test from "node:test";
import { UsageQueue } from "../src/jobs/usageQueue.js";

function redisStub(evalResults: number[] = [1, 0]) {
  const calls = {
    quit: 0,
    xadd: [] as unknown[][],
    set: [] as unknown[][],
    eval: [] as unknown[][]
  };

  return {
    calls,
    client: {
      async quit() {
        calls.quit += 1;
      },
      async xadd(...args: unknown[]) {
        calls.xadd.push(args);
      },
      async set(...args: unknown[]) {
        calls.set.push(args);
        return "OK";
      },
      async eval(...args: unknown[]) {
        calls.eval.push(args);
        return evalResults[calls.eval.length - 1] ?? evalResults.at(-1) ?? 1;
      }
    }
  };
}

test("usage queue closes only owned Redis connections", async () => {
  const shared = redisStub();
  await new UsageQueue(shared.client as never, { ownsRedisConnection: false }).close();
  assert.equal(shared.calls.quit, 0);

  const owned = redisStub();
  await new UsageQueue(owned.client as never, { ownsRedisConnection: true }).close();
  assert.equal(owned.calls.quit, 1);
});

test("usage queue validates payloads before enqueue", async () => {
  const redis = redisStub();
  const queue = new UsageQueue(redis.client as never, { ownsRedisConnection: false });

  await assert.rejects(() => queue.add("usage-batch", {
    userId: "not-a-uuid",
    events: []
  }, { jobId: "invalid-payload", maxEventsPerDay: 1_000 }));
  assert.equal(redis.calls.xadd.length, 0);
});

test("idempotent usage enqueue uses one atomic Redis operation", async () => {
  const redis = redisStub();
  const queue = new UsageQueue(redis.client as never, { ownsRedisConnection: false });

  const inserted = await queue.add("usage-batch", {
    userId: "11111111-1111-4111-8111-111111111111",
    events: [{
      clientEventId: "event-123456",
      provider: "openai",
      model: "gpt-4.1",
      occurredAt: new Date().toISOString(),
      promptTokens: 10,
      outputTokens: 15,
      totalTokens: 25
    }]
  }, { jobId: "user-idempotency-key", maxEventsPerDay: 1_000 });

  assert.deepEqual(inserted, { status: "queued" });
  const duplicate = await queue.add("usage-batch", {
    userId: "11111111-1111-4111-8111-111111111111",
    events: [{
      clientEventId: "event-123456",
      provider: "openai",
      model: "gpt-4.1",
      occurredAt: new Date().toISOString(),
      promptTokens: 10,
      outputTokens: 15,
      totalTokens: 25
    }]
  }, { jobId: "user-idempotency-key", maxEventsPerDay: 1_000 });

  assert.deepEqual(duplicate, { status: "duplicate" });
  assert.equal(redis.calls.eval.length, 2);
  assert.equal(redis.calls.xadd.length, 0);
  assert.equal(redis.calls.eval[0]![1], 3);
  assert.match(String(redis.calls.eval[0]![4]), /^usage-stream:daily:11111111-1111-4111-8111-111111111111:\d{4}-\d{2}-\d{2}$/);
  assert.equal(redis.calls.eval[0]![7], "1");
  assert.equal(redis.calls.eval[0]![8], "1000");
});

test("usage queue rejects a batch atomically when the UTC daily event cap is exhausted", async () => {
  const redis = redisStub([-1]);
  const queue = new UsageQueue(redis.client as never, { ownsRedisConnection: false });

  const result = await queue.add("usage-batch", {
    userId: "11111111-1111-4111-8111-111111111111",
    events: [{
      clientEventId: "event-daily-limit",
      provider: "openai",
      model: "gpt-4.1",
      occurredAt: new Date().toISOString(),
      promptTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    }]
  }, { jobId: "daily-limit-request", maxEventsPerDay: 1 });

  assert.equal(result.status, "daily_limit_exceeded");
  if (result.status !== "daily_limit_exceeded") return;
  assert.ok(result.retryAfterSeconds >= 1 && result.retryAfterSeconds <= 86_400);
  assert.equal(redis.calls.eval.length, 1);
  assert.equal(redis.calls.xadd.length, 0);
});

test("usage queue rejects unsafe plan limits before calling Redis", async () => {
  const redis = redisStub();
  const queue = new UsageQueue(redis.client as never, { ownsRedisConnection: false });

  await assert.rejects(() => queue.add("usage-batch", {
    userId: "11111111-1111-4111-8111-111111111111",
    events: [{
      clientEventId: "event-invalid-limit",
      provider: "openai",
      model: "gpt-4.1",
      occurredAt: new Date().toISOString(),
      promptTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    }]
  }, { jobId: "invalid-limit-request", maxEventsPerDay: 0 }), /positive safe integer/);
  assert.equal(redis.calls.eval.length, 0);
});
