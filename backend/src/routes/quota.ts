import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { modelSchema, providerSchema } from "../schemas/common.js";

const quotaQuerySchema = z.object({
  provider: providerSchema.optional(),
  model: modelSchema.optional()
});

export async function quotaRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/quota/check",
    {
      preHandler: [
        requireAuth,
        rateLimit({ scope: "quota-check", limit: 180, windowSeconds: 60, key: (request) => request.auth?.userId })
      ]
    },
    async (request) => {
      const query = quotaQuerySchema.parse(request.query);
      const now = new Date();
      const windows = await app.prisma.quotaWindow.findMany({
        where: {
          userId: request.auth!.userId,
          windowStart: { lte: now },
          windowEnd: { gt: now },
          ...(query.provider ? { provider: query.provider } : {}),
          ...(query.model ? { model: query.model } : {})
        },
        orderBy: { usedTokens: "desc" },
        take: 50
      });

      const subscription = await app.prisma.subscription.findFirst({
        where: { userId: request.auth!.userId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
        include: { plan: true },
        orderBy: { createdAt: "desc" }
      });

      const usedTokens = windows.reduce((sum, window) => sum + window.usedTokens, 0);
      const tokenCap = subscription?.plan.monthlyTokenCap ?? 100_000;

      return {
        usedTokens,
        tokenCap,
        remainingTokens: Math.max(0, tokenCap - usedTokens),
        limited: usedTokens >= tokenCap,
        windows
      };
    }
  );
}
