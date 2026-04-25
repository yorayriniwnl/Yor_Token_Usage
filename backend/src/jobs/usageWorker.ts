import { prisma } from "../lib/prisma.js";
import { createRedisClient } from "../lib/redis.js";
import { usageBatchJobSchema } from "../schemas/usage.js";
import { processUsageBatch } from "../services/usageIngestion.js";
import type { UsageBatchJob } from "./usageQueue.js";

const STREAM = "usage-events";
const GROUP = "usage-workers";
const DEAD = "usage-events:dead";
const MAX_ATTEMPTS = 5;
const READ_COUNT = 10;
const BLOCK_MS = 5_000;
const STALE_PENDING_IDLE_MS = 60_000;
const MAX_RECLAIM_BATCHES = 5;
const MAX_GROUP_PENDING_MESSAGES = 1_000;

type RedisStreamMessage = [string, string[]];
type RedisStreamReadResult = Array<[string, RedisStreamMessage[]]> | null;
type RedisAutoClaimResult = [string, RedisStreamMessage[], string[]?];
type RedisPendingDetail = [string, string, number | string, number | string];
type RedisPendingSummary = [number | string, string | null, string | null, Array<[string, string]>];

const redis = createRedisClient({
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

async function ensureGroup(): Promise<void> {
  try {
    await redis.xgroup("CREATE", STREAM, GROUP, "0", "MKSTREAM");
  } catch (error) {
    if (!String(error).includes("BUSYGROUP")) throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fieldsToObject(fields: string[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (let index = 0; index < fields.length; index += 2) {
    output[fields[index]!] = fields[index + 1]!;
  }
  return output;
}

async function requeueOrDeadLetter(id: string, payload: UsageBatchJob, error: unknown): Promise<void> {
  const attempts = (payload.attempts ?? 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await deadLetter(id, payload, error);
  } else {
    await redis.xadd(STREAM, "*", "payload", JSON.stringify({ ...payload, attempts }));
    await redis.xack(STREAM, GROUP, id);
  }
}

async function deadLetter(id: string, payload: UsageBatchJob, error: unknown): Promise<void> {
  await redis.xadd(DEAD, "*", "payload", JSON.stringify(payload), "error", String(error));
  await redis.xack(STREAM, GROUP, id);
}

async function deadLetterRaw(id: string, fields: string[], error: unknown): Promise<void> {
  await redis.xadd(DEAD, "*", "payload", fieldsToObject(fields).payload ?? "{}", "error", String(error));
  await redis.xack(STREAM, GROUP, id);
}

async function getDeliveryCount(id: string): Promise<number | undefined> {
  const pending = await redis.xpending(STREAM, GROUP, id, id, 1) as RedisPendingDetail[];
  const deliveryCount = pending[0]?.[3];
  return deliveryCount === undefined ? undefined : Number(deliveryCount);
}

async function getGroupPendingCount(): Promise<number> {
  const pending = await redis.xpending(STREAM, GROUP) as RedisPendingSummary;
  return Number(pending[0] ?? 0);
}

async function handleMessage(id: string, fields: string[], deliveryCount?: number): Promise<void> {
  let payload: UsageBatchJob;
  try {
    payload = usageBatchJobSchema.parse(JSON.parse(fieldsToObject(fields).payload ?? "{}"));
  } catch (error) {
    console.error({ id, error }, "usage ingestion payload was invalid");
    await deadLetterRaw(id, fields, error);
    return;
  }

  if (deliveryCount !== undefined && deliveryCount > MAX_ATTEMPTS) {
    await deadLetter(id, payload, `message exceeded ${MAX_ATTEMPTS} Redis deliveries without acknowledgement`);
    return;
  }

  try {
    await processUsageBatch(prisma, payload);
    await redis.xack(STREAM, GROUP, id);
  } catch (error) {
    console.error({ id, error }, "usage ingestion failed");
    await requeueOrDeadLetter(id, payload, error);
  }
}

async function reclaimStalePending(consumer: string): Promise<void> {
  let cursor = "0-0";

  for (let batch = 0; batch < MAX_RECLAIM_BATCHES; batch += 1) {
    const result = await redis.xautoclaim(
      STREAM,
      GROUP,
      consumer,
      STALE_PENDING_IDLE_MS,
      cursor,
      "COUNT",
      READ_COUNT
    ) as RedisAutoClaimResult;

    const [nextCursor, messages] = result;
    for (const [id, fields] of messages) {
      await handleMessage(id, fields, await getDeliveryCount(id));
    }

    cursor = nextCursor;
    if (cursor === "0-0") break;
  }
}

async function loop(): Promise<void> {
  const consumer = `worker-${process.pid}`;
  await ensureGroup();

  for (;;) {
    await reclaimStalePending(consumer);
    const pendingCount = await getGroupPendingCount();
    if (pendingCount >= MAX_GROUP_PENDING_MESSAGES) {
      console.warn({ pendingCount }, "usage worker pausing fresh reads while pending messages drain");
      await sleep(BLOCK_MS);
      continue;
    }

    const result = await redis.xreadgroup(
      "GROUP",
      GROUP,
      consumer,
      "COUNT",
      READ_COUNT,
      "BLOCK",
      BLOCK_MS,
      "STREAMS",
      STREAM,
      ">"
    ) as RedisStreamReadResult;

    if (!result) continue;

    for (const [, messages] of result) {
      for (const [id, fields] of messages) {
        await handleMessage(id, fields);
      }
    }
  }
}

process.on("SIGTERM", async () => {
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});

void loop();
