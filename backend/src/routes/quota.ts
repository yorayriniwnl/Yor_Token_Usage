import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { modelSchema, providerSchema } from "../schemas/common.js";
import { resolveQuotaPeriod } from "../services/quotaPolicy.js";

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
    async (request, reply) => {
      const query = quotaQuerySchema.parse(request.query);
      const now = new Date();

      const subscription = await app.prisma.subscription.findFirst({
        where: { userId: request.auth!.userId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
        include: { plan: true },
        orderBy: { createdAt: "desc" }
      });
      const plan = subscription?.plan ?? await app.prisma.plan.findFirst({
        where: { tier: "FREE" },
        orderBy: { createdAt: "asc" }
      });

      if (!plan) {
        reply.code(503);
        return {
          error: "plan_unavailable",
          message: "No active subscription or FREE plan is configured for quota checks"
        };
      }

      const period = resolveQuotaPeriod(subscription, now);
      const quotaWhere: Prisma.QuotaWindowWhereInput = {
        userId: request.auth!.userId,
        windowStart: { lt: period.end },
        windowEnd: { gt: period.start },
        ...(query.provider ? { provider: query.provider } : {}),
        ...(query.model ? { model: query.model } : {})
      };

      const [usage, windows] = await Promise.all([
        app.prisma.quotaWindow.aggregate({
          where: quotaWhere,
          _sum: { usedTokens: true }
        }),
        app.prisma.quotaWindow.findMany({
          where: quotaWhere,
          orderBy: [{ windowStart: "desc" }, { usedTokens: "desc" }],
          take: 50
        })
      ]);

      const usedTokens = usage._sum.usedTokens ?? 0;
      const tokenCap = plan.monthlyTokenCap;

      return {
        usedTokens,
        tokenCap,
        remainingTokens: Math.max(0, tokenCap - usedTokens),
        limited: usedTokens >= tokenCap,
        periodStart: period.start,
        periodEnd: period.end,
        periodSource: period.source,
        windows
      };
    }
  );
}
