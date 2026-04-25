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

      let usageEvents: Awaited<ReturnType<typeof app.prisma.usageEvent.findMany>> = [];
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
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take: body.maxEvents + 1
        });

        hasMore = rows.length > body.maxEvents;
        usageEvents = rows.slice(0, body.maxEvents);
        const lastEvent = usageEvents.at(-1);
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
