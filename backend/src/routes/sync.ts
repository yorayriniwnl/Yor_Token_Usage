import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const syncBodySchema = z.object({
  since: z.coerce.date().optional(),
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
    async (request) => {
      const body = syncBodySchema.parse(request.body ?? {});
      const settings = await app.prisma.userSettings.findUnique({
        where: { userId: request.auth!.userId }
      });

      const usageEvents = body.includeUsage
        ? await app.prisma.usageEvent.findMany({
          where: {
            userId: request.auth!.userId,
            ...(body.since ? { occurredAt: { gt: body.since } } : {})
          },
          orderBy: { occurredAt: "desc" },
          take: body.maxEvents
        })
        : [];

      return {
        serverTime: new Date().toISOString(),
        settings: settings ? {
          version: settings.version,
          payload: settings.payload,
          updatedAt: settings.updatedAt
        } : null,
        usageEvents
      };
    }
  );
}
