import assert from "node:assert/strict";
import test from "node:test";
import { UsageQueue } from "../src/jobs/usageQueue.js";

function redisStub() {
  const calls = {
    quit: 0,
    xadd: [] as unknown[][],
    set: [] as unknown[][]
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
  }));
  assert.equal(redis.calls.xadd.length, 0);
});
