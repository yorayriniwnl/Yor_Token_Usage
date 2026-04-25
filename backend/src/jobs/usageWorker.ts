import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { processUsageBatch } from "../services/usageIngestion.js";
import type { UsageBatchJob } from "./usageQueue.js";

const STREAM = "usage-events";
const GROUP = "usage-workers";
const DEAD = "usage-events:dead";
const MAX_ATTEMPTS = 5;

const redis = new Redis(env.REDIS_URL, {
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
    await redis.xadd(DEAD, "*", "payload", JSON.stringify(payload), "error", String(error));
  } else {
    await redis.xadd(STREAM, "*", "payload", JSON.stringify({ ...payload, attempts }));
  }
  await redis.xack(STREAM, GROUP, id);
}

async function loop(): Promise<void> {
  const consumer = `worker-${process.pid}`;
  await ensureGroup();

  for (;;) {
    const result = await redis.xreadgroup(
      "GROUP",
      GROUP,
      consumer,
      "COUNT",
      10,
      "BLOCK",
      5_000,
      "STREAMS",
      STREAM,
      ">"
    ) as Array<[string, Array<[string, string[]]>]> | null;

    if (!result) continue;

    for (const [, messages] of result) {
      for (const [id, fields] of messages) {
        const payload = JSON.parse(fieldsToObject(fields).payload ?? "{}") as UsageBatchJob;
        try {
          await processUsageBatch(prisma, payload);
          await redis.xack(STREAM, GROUP, id);
        } catch (error) {
          console.error({ id, error }, "usage ingestion failed");
          await requeueOrDeadLetter(id, payload, error);
        }
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
