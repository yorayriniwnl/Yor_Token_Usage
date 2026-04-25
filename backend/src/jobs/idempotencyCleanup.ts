import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { Redis as RedisClient } from "ioredis";
import type { PrismaClient } from "@prisma/client";

const CLEANUP_LOCK_KEY = "idempotency-cleanup:lock";
const CLEANUP_INTERVAL_MS = 60 * 60_000;
const CLEANUP_LOCK_TTL_SECONDS = 10 * 60;
const CLEANUP_BATCH_SIZE = 1_000;
const CLEANUP_MAX_BATCHES = 25;

export interface IdempotencyCleanupHandle {
  stop: () => void;
}

async function releaseLock(redis: RedisClient, token: string): Promise<void> {
  await redis.eval(
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
    1,
    CLEANUP_LOCK_KEY,
    token
  );
}

export async function deleteExpiredIdempotencyKeys(prisma: PrismaClient, now = new Date()): Promise<number> {
  let deleted = 0;

  for (let batch = 0; batch < CLEANUP_MAX_BATCHES; batch += 1) {
    const expired = await prisma.idempotencyKey.findMany({
      where: { expiresAt: { lt: now } },
      select: { id: true },
      orderBy: { expiresAt: "asc" },
      take: CLEANUP_BATCH_SIZE
    });

    if (!expired.length) break;

    const result = await prisma.idempotencyKey.deleteMany({
      where: { id: { in: expired.map((row) => row.id) } }
    });
    deleted += result.count;

    if (expired.length < CLEANUP_BATCH_SIZE) break;
  }

  return deleted;
}

async function runWithLock(prisma: PrismaClient, redis: RedisClient, logger: FastifyBaseLogger): Promise<void> {
  const token = randomUUID();
  const locked = await redis.set(CLEANUP_LOCK_KEY, token, "EX", CLEANUP_LOCK_TTL_SECONDS, "NX");
  if (!locked) return;

  try {
    const deleted = await deleteExpiredIdempotencyKeys(prisma);
    if (deleted > 0) {
      logger.info({ deleted }, "expired idempotency keys deleted");
    }
  } finally {
    await releaseLock(redis, token);
  }
}

export function startIdempotencyCleanup(
  prisma: PrismaClient,
  redis: RedisClient,
  logger: FastifyBaseLogger
): IdempotencyCleanupHandle {
  const run = async () => {
    try {
      await runWithLock(prisma, redis, logger);
    } catch (error) {
      logger.warn({ error }, "idempotency cleanup failed");
    }
  };

  const startupTimer = setTimeout(() => void run(), 5_000);
  const interval = setInterval(() => void run(), CLEANUP_INTERVAL_MS);
  startupTimer.unref();
  interval.unref();

  return {
    stop: () => {
      clearTimeout(startupTimer);
      clearInterval(interval);
    }
  };
}
