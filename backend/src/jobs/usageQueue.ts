import type { Redis as RedisClient } from "ioredis";
import { createHash } from "node:crypto";
import { usageBatchJobSchema, type UsageBatchJobInput } from "../schemas/usage.js";

export type { UsageBatchJob, UsageBatchJobInput } from "../schemas/usage.js";

export interface UsageQueueOptions {
  ownsRedisConnection: boolean;
}

export interface UsageQueueAddOptions {
  jobId: string;
  maxEventsPerDay: number;
}

export type UsageQueueAddResult =
  | { status: "queued" | "duplicate" }
  | { status: "daily_limit_exceeded"; retryAfterSeconds: number };

const USAGE_STREAM = "usage-events";
const DEDUPE_TTL_SECONDS = 24 * 60 * 60;
const ATOMIC_ENQUEUE_SCRIPT = `
local existing = redis.call("GET", KEYS[1])
if existing then return 0 end
local current_count = tonumber(redis.call("GET", KEYS[3]) or "0")
local event_count = tonumber(ARGV[3])
local daily_limit = tonumber(ARGV[4])
if current_count + event_count > daily_limit then return -1 end
local stream_id = redis.call("XADD", KEYS[2], "*", "payload", ARGV[1])
redis.call("SET", KEYS[1], stream_id, "EX", ARGV[2])
redis.call("INCRBY", KEYS[3], event_count)
redis.call("EXPIRE", KEYS[3], ARGV[5])
return 1
`;

function dedupeKeyForJob(jobId: string): string {
  return createHash("sha256").update(jobId).digest("hex");
}

function dailyQuotaWindow(userId: string, now: Date): { key: string; retryAfterSeconds: number } {
  const day = now.toISOString().slice(0, 10);
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const retryAfterSeconds = Math.max(1, Math.ceil((tomorrow.getTime() - now.getTime()) / 1_000));
  return {
    key: `usage-stream:daily:${userId}:${day}`,
    retryAfterSeconds
  };
}

export class UsageQueue {
  constructor(
    private readonly redis: RedisClient,
    private readonly options: UsageQueueOptions
  ) {}

  async add(
    _name: "usage-batch",
    data: UsageBatchJobInput,
    options: UsageQueueAddOptions
  ): Promise<UsageQueueAddResult> {
    const payload = usageBatchJobSchema.parse(data);
    if (!options.jobId) throw new TypeError("usage queue jobId is required");
    if (!Number.isSafeInteger(options.maxEventsPerDay) || options.maxEventsPerDay < 1) {
      throw new TypeError("maxEventsPerDay must be a positive safe integer");
    }

    const dedupeKey = `usage-stream:dedupe:${dedupeKeyForJob(options.jobId)}`;
    const quota = dailyQuotaWindow(payload.userId, new Date());
    const inserted = Number(await this.redis.eval(
      ATOMIC_ENQUEUE_SCRIPT,
      3,
      dedupeKey,
      USAGE_STREAM,
      quota.key,
      JSON.stringify(payload),
      String(DEDUPE_TTL_SECONDS),
      String(payload.events.length),
      String(options.maxEventsPerDay),
      String(quota.retryAfterSeconds)
    ));

    if (inserted === 1) return { status: "queued" };
    if (inserted === 0) return { status: "duplicate" };
    if (inserted === -1) {
      return {
        status: "daily_limit_exceeded",
        retryAfterSeconds: quota.retryAfterSeconds
      };
    }
    throw new Error(`Redis returned an invalid usage enqueue result: ${inserted}`);
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
