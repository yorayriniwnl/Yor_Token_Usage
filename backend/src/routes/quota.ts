import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { modelSchema, providerSchema } from "../schemas/common.js";
import { resolveEntitlement } from "../services/plans.js";
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

      const { plan, subscription } = await resolveEntitlement(app.prisma, request.auth!.userId);

      if (!plan) {
        reply.code(503);
        return {
          error: "plan_unavailable",
          message: "No active subscription or FREE plan is configured for quota checks"
        };
      }

      const period = resolveQuotaPeriod(subscription, now);
      const usageWhere: Prisma.UsageEventWhereInput = {
        userId: request.auth!.userId,
        occurredAt: { gte: period.start, lt: period.end },
        ...(query.provider ? { provider: query.provider } : {}),
        ...(query.model ? { model: query.model } : {})
      };
      const quotaWhere: Prisma.QuotaWindowWhereInput = {
        userId: request.auth!.userId,
        windowStart: { lt: period.end },
        windowEnd: { gt: period.start },
        ...(query.provider ? { provider: query.provider } : {}),
        ...(query.model ? { model: query.model } : {})
      };

      const [usage, windows] = await Promise.all([
        app.prisma.usageEvent.aggregate({
          where: usageWhere,
          _sum: { totalTokens: true }
        }),
        app.prisma.quotaWindow.findMany({
          where: quotaWhere,
          orderBy: [{ windowStart: "desc" }, { usedTokens: "desc" }],
          take: 50,
          select: {
            provider: true,
            model: true,
            windowStart: true,
            windowEnd: true,
            usedTokens: true,
            promptCount: true,
            status: true
          }
        })
      ]);

      const usedTokens = usage._sum.totalTokens ?? 0;
      const tokenCap = Math.max(0, plan.monthlyTokenCap);

      return {
        usedTokens,
        tokenCap,
        remainingTokens: Math.max(0, tokenCap - usedTokens),
        limited: usedTokens >= tokenCap,
        usageAccuracy: "estimated",
        usageBasis: "server-recorded event totals; no provider billing counter is connected",
        periodStart: period.start,
        periodEnd: period.end,
        periodSource: period.source,
        windows
      };
    }
  );
}
