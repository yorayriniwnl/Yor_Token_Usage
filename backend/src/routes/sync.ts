import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { decodeUsageCursor, encodeUsageCursor } from "../services/syncPagination.js";

const syncBodySchema = z.object({
  since: z.coerce.date().optional(),
  cursor: z.string().min(1).max(512).optional(),
  includeUsage: z.boolean().default(true),
  maxEvents: z.number().int().min(1).max(500).default(100)
});

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/sync/state",
    {
      preHandler: [
        requireAuth,
        rateLimit({ scope: "sync-state", limit: 60, windowSeconds: 60, key: (request) => request.auth?.userId })
      ]
    },
    async (request, reply) => {
      const body = syncBodySchema.parse(request.body ?? {});
      const settings = await app.prisma.userSettings.findUnique({
        where: { userId: request.auth!.userId }
      });

      let usageEvents: Array<{
        id: string;
        clientEventId: string;
        provider: string;
        model: string;
        threadId: string | null;
        occurredAt: Date;
        promptTokens: number;
        outputTokens: number;
        totalTokens: number;
        promptHash: string | null;
        status: "COMPLETED" | "RATE_LIMITED" | "FAILED";
        accuracy: "ESTIMATED" | "EXACT" | "INFERRED";
        schemaVersion: number;
        measurementMethod: string;
        measurementLevel: string;
        confidence: number;
        errorMarginPercent: number;
        tokenizer: string;
        source: string;
        metadata: unknown;
      }> = [];
      let hasMore = false;
      let nextCursor: string | null = null;

      if (body.includeUsage) {
        const cursor = body.cursor ? decodeUsageCursor(body.cursor) : undefined;
        if (body.cursor && !cursor) {
          reply.code(400);
          return { error: "invalid_sync_cursor", message: "Sync cursor is invalid or malformed" };
        }

        const filters: Prisma.UsageEventWhereInput[] = [];
        if (body.since) {
          filters.push({ occurredAt: { gt: body.since } });
        }
        if (cursor) {
          filters.push({
            OR: [
              { occurredAt: { lt: cursor.occurredAt } },
              { occurredAt: cursor.occurredAt, id: { lt: cursor.id } }
            ]
          });
        }

        const rows = await app.prisma.usageEvent.findMany({
          where: {
            userId: request.auth!.userId,
            ...(filters.length ? { AND: filters } : {})
          },
          select: {
            id: true,
            clientEventId: true,
            provider: true,
            model: true,
            threadId: true,
            occurredAt: true,
            promptTokens: true,
            outputTokens: true,
            totalTokens: true,
            promptHash: true,
            status: true,
            accuracy: true,
            schemaVersion: true,
            measurementMethod: true,
            measurementLevel: true,
            confidence: true,
            errorMarginPercent: true,
            tokenizer: true,
            source: true,
            metadata: true
          },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take: body.maxEvents + 1
        });

        hasMore = rows.length > body.maxEvents;
        const selectedRows = rows.slice(0, body.maxEvents);
        const lastEvent = selectedRows.at(-1);
        usageEvents = selectedRows.map((row) => ({
          ...row,
          measurementLevel: row.measurementLevel.toLowerCase()
        }));
        nextCursor = hasMore && lastEvent ? encodeUsageCursor(lastEvent) : null;
      }

      return {
        serverTime: new Date().toISOString(),
        settings: settings ? {
          version: settings.version,
          payload: settings.payload,
          updatedAt: settings.updatedAt
        } : null,
        usageEvents,
        usagePage: {
          hasMore,
          nextCursor
        }
      };
    }
  );
}
