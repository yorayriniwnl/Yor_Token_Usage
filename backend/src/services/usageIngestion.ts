import { Prisma, type PrismaClient } from "@prisma/client";
import type { UsageBatchJob } from "../jobs/usageQueue.js";

type InsertedUsageRow = {
  provider: string;
  model: string;
  occurred_at: Date;
  total_tokens: number;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function processUsageBatch(prisma: PrismaClient, job: UsageBatchJob): Promise<{ accepted: number }> {
  const rows = job.events.map((event) => ({
    userId: job.userId,
    deviceId: job.deviceId,
    clientEventId: event.clientEventId,
    provider: event.provider,
    model: event.model,
    threadId: event.threadId,
    occurredAt: new Date(event.occurredAt),
    promptTokens: event.promptTokens,
    outputTokens: event.outputTokens,
    totalTokens: event.totalTokens,
    promptHash: event.promptHash,
    status: event.status,
    accuracy: event.accuracy,
    metadata: event.metadata
  }));

  if (!rows.length) return { accepted: 0 };

  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<InsertedUsageRow[]>(Prisma.sql`
      INSERT INTO usage_events (
        user_id,
        device_id,
        client_event_id,
        provider,
        model,
        thread_id,
        occurred_at,
        prompt_tokens,
        output_tokens,
        total_tokens,
        prompt_hash,
        status,
        accuracy,
        metadata
      )
      VALUES ${Prisma.join(rows.map((row) => Prisma.sql`(
        ${row.userId}::uuid,
        ${row.deviceId ?? null}::uuid,
        ${row.clientEventId},
        ${row.provider},
        ${row.model},
        ${row.threadId ?? null},
        ${row.occurredAt},
        ${row.promptTokens},
        ${row.outputTokens},
        ${row.totalTokens},
        ${row.promptHash ?? null},
        ${row.status}::"UsageEventStatus",
        ${row.accuracy}::"Accuracy",
        ${row.metadata ? JSON.stringify(row.metadata) : null}::jsonb
      )`))}
      ON CONFLICT (user_id, client_event_id) DO NOTHING
      RETURNING provider, model, occurred_at, total_tokens
    `);

    const groups = new Map<string, { provider: string; model: string; windowStart: Date; tokens: number; count: number }>();
    for (const row of inserted) {
      const windowStart = startOfUtcDay(row.occurred_at);
      const key = `${row.provider}:${row.model}:${windowStart.toISOString()}`;
      const existing = groups.get(key) ?? {
        provider: row.provider,
        model: row.model,
        windowStart,
        tokens: 0,
        count: 0
      };
      existing.tokens += row.total_tokens;
      existing.count += 1;
      groups.set(key, existing);
    }

    for (const group of groups.values()) {
      await tx.quotaWindow.upsert({
        where: {
          userId_provider_model_windowStart: {
            userId: job.userId,
            provider: group.provider,
            model: group.model,
            windowStart: group.windowStart
          }
        },
        create: {
          userId: job.userId,
          provider: group.provider,
          model: group.model,
          windowStart: group.windowStart,
          windowEnd: addDays(group.windowStart, 1),
          usedTokens: group.tokens,
          promptCount: group.count
        },
        update: {
          usedTokens: { increment: group.tokens },
          promptCount: { increment: group.count }
        }
      });
    }

    return { accepted: inserted.length };
  });
}
