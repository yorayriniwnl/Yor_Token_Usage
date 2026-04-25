import type { Redis as RedisClient } from "ioredis";
import { usageBatchJobSchema, type UsageBatchJobInput } from "../schemas/usage.js";

export type { UsageBatchJob, UsageBatchJobInput } from "../schemas/usage.js";

export interface UsageQueueOptions {
  ownsRedisConnection: boolean;
}

export class UsageQueue {
  constructor(
    private readonly redis: RedisClient,
    private readonly options: UsageQueueOptions
  ) {}

  async add(_name: "usage-batch", data: UsageBatchJobInput, options?: { jobId?: string }): Promise<void> {
    const payload = usageBatchJobSchema.parse(data);

    if (options?.jobId) {
      const dedupeKey = `usage-stream:dedupe:${options.jobId}`;
      const inserted = await this.redis.set(dedupeKey, "1", "EX", 24 * 60 * 60, "NX");
      if (!inserted) return;
    }

    await this.redis.xadd(
      "usage-events",
      "*",
      "payload",
      JSON.stringify(payload)
    );
  }

  async close(): Promise<void> {
    if (this.options.ownsRedisConnection) {
      await this.redis.quit();
    }
  }
}

export function createUsageQueue(redis: RedisClient): UsageQueue {
  return new UsageQueue(redis, { ownsRedisConnection: false });
}
