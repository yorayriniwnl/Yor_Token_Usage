import type { Redis as RedisClient } from "ioredis";

export interface UsageBatchJob {
  userId: string;
  deviceId?: string;
  idempotencyKey?: string;
  attempts?: number;
  events: Array<{
    clientEventId: string;
    provider: string;
    model: string;
    threadId?: string;
    occurredAt: string;
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
    promptHash?: string;
    status: "COMPLETED" | "RATE_LIMITED" | "FAILED";
    accuracy: "ESTIMATED" | "EXACT" | "INFERRED";
    metadata?: Record<string, unknown>;
  }>;
}

export class UsageQueue {
  constructor(private readonly redis: RedisClient) {}

  async add(_name: "usage-batch", data: UsageBatchJob, options?: { jobId?: string }): Promise<void> {
    if (options?.jobId) {
      const dedupeKey = `usage-stream:dedupe:${options.jobId}`;
      const inserted = await this.redis.set(dedupeKey, "1", "EX", 24 * 60 * 60, "NX");
      if (!inserted) return;
    }

    await this.redis.xadd(
      "usage-events",
      "*",
      "payload",
      JSON.stringify({ ...data, attempts: data.attempts ?? 0 })
    );
  }

  async close(): Promise<void> {
    // The shared Redis connection is owned by app.redis.
  }
}

export function createUsageQueue(redis: RedisClient): UsageQueue {
  return new UsageQueue(redis);
}
