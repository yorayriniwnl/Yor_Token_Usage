import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { modelSchema, providerSchema } from "../schemas/common.js";
import { calculateCost } from "../services/pricing.js";
import { resolveEntitlement } from "../services/plans.js";
import { resolveProviderWindow, resolveQuotaPeriod } from "../services/quotaPolicy.js";

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
      const isFiltered = Boolean(query.provider || query.model);
      const providerName = query.provider ?? "generic";
      const modelName = query.model ?? "generic";

      // Filter to COMPLETED events so failed/rate-limited queries don't inflate usage
      const accountUsageWhere: Prisma.UsageEventWhereInput = {
        userId: request.auth!.userId,
        status: "COMPLETED",
        occurredAt: { gte: period.start, lt: period.end }
      };
      const scopedUsageWhere: Prisma.UsageEventWhereInput = {
        ...accountUsageWhere,
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

      // Provider rolling window (ChatGPT 3h, Claude 5h, Daily)
      const initialWindow = resolveProviderWindow(providerName, now);
      const rollingUsageWhere: Prisma.UsageEventWhereInput = {
        userId: request.auth!.userId,
        status: "COMPLETED",
        occurredAt: { gte: initialWindow.windowStart, lte: now },
        ...(query.provider ? { provider: query.provider } : {}),
        ...(query.model ? { model: query.model } : {})
      };

      const [accountUsage, scopedUsage, windows, rollingUsage, earliestRollingEvent] = await Promise.all([
        app.prisma.usageEvent.aggregate({
          where: accountUsageWhere,
          _sum: { totalTokens: true, promptTokens: true, outputTokens: true }
        }),
        isFiltered
          ? app.prisma.usageEvent.aggregate({
              where: scopedUsageWhere,
              _sum: { totalTokens: true, promptTokens: true, outputTokens: true }
            })
          : Promise.resolve(null),
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
        }),
        app.prisma.usageEvent.aggregate({
          where: rollingUsageWhere,
          _sum: { totalTokens: true, promptTokens: true, outputTokens: true },
          _count: { id: true }
        }),
        app.prisma.usageEvent.findFirst({
          where: rollingUsageWhere,
          orderBy: { occurredAt: "asc" },
          select: { occurredAt: true }
        })
      ]);

      const accountUsedTokens = accountUsage._sum.totalTokens ?? 0;
      const scopedUsedTokens = scopedUsage ? (scopedUsage._sum.totalTokens ?? 0) : accountUsedTokens;
      const tokenCap = Math.max(0, plan.monthlyTokenCap);
      const remainingTokens = Math.max(0, tokenCap - accountUsedTokens);
      const limited = accountUsedTokens >= tokenCap;

      // Real-world pricing & costs — group by model/provider for accurate per-model pricing
      const accountCostGroups = await app.prisma.usageEvent.groupBy({
        by: ['provider', 'model'],
        where: accountUsageWhere,
        _sum: { promptTokens: true, outputTokens: true }
      });
      const accountCost = accountCostGroups.reduce((acc, g) => {
        const c = calculateCost(g._sum.promptTokens ?? 0, g._sum.outputTokens ?? 0, g.model, g.provider);
        return { totalCost: acc.totalCost + c.totalCost, promptCost: acc.promptCost + c.promptCost, outputCost: acc.outputCost + c.outputCost };
      }, { totalCost: 0, promptCost: 0, outputCost: 0 });

      let scopedCost = accountCost;
      if (isFiltered && scopedUsage) {
        const scopedCostGroups = await app.prisma.usageEvent.groupBy({
          by: ['provider', 'model'],
          where: scopedUsageWhere,
          _sum: { promptTokens: true, outputTokens: true }
        });
        scopedCost = scopedCostGroups.reduce((acc, g) => {
          const c = calculateCost(g._sum.promptTokens ?? 0, g._sum.outputTokens ?? 0, g.model, g.provider);
          return { totalCost: acc.totalCost + c.totalCost, promptCost: acc.promptCost + c.promptCost, outputCost: acc.outputCost + c.outputCost };
        }, { totalCost: 0, promptCost: 0, outputCost: 0 });
      }

      const exactProviderWindow = resolveProviderWindow(providerName, now, earliestRollingEvent?.occurredAt);
      const rollingCostGroups = await app.prisma.usageEvent.groupBy({
        by: ['provider', 'model'],
        where: rollingUsageWhere,
        _sum: { promptTokens: true, outputTokens: true }
      });
      const rollingCost = rollingCostGroups.reduce((acc, g) => {
        const c = calculateCost(g._sum.promptTokens ?? 0, g._sum.outputTokens ?? 0, g.model, g.provider);
        return { totalCost: acc.totalCost + c.totalCost, promptCost: acc.promptCost + c.promptCost, outputCost: acc.outputCost + c.outputCost };
      }, { totalCost: 0, promptCost: 0, outputCost: 0 });

      return {
        usedTokens: scopedUsedTokens,
        ...(isFiltered ? { accountUsedTokens } : {}),
        tokenCap,
        remainingTokens,
        limited,
        totalCost: accountCost.totalCost,
        scopedCost: scopedCost.totalCost,
        providerWindow: {
          provider: exactProviderWindow.provider,
          windowType: exactProviderWindow.windowType,
          windowMinutes: exactProviderWindow.windowMinutes,
          windowStart: exactProviderWindow.windowStart,
          windowEnd: exactProviderWindow.windowEnd,
          predictedResetAt: exactProviderWindow.predictedResetAt,
          tokensUsed: rollingUsage._sum.totalTokens ?? 0,
          promptsCount: rollingUsage._count.id ?? 0,
          estimatedCost: rollingCost.totalCost,
          description: exactProviderWindow.description
        },
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
