import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { modelSchema, providerSchema } from "../schemas/common.js";

type SubscriptionPeriod = {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} | null;

const quotaQuerySchema = z.object({
  provider: providerSchema.optional(),
  model: modelSchema.optional()
});

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const next = new Date(date);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);

  const daysInTargetMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, daysInTargetMonth));
  return next;
}

function resolveQuotaPeriod(subscription: SubscriptionPeriod, now: Date): { start: Date; end: Date; source: "subscription" | "calendar_month" } {
  const currentPeriodStart = subscription?.currentPeriodStart;
  const currentPeriodEnd = subscription?.currentPeriodEnd;

  if (currentPeriodStart && currentPeriodEnd && currentPeriodStart <= now && currentPeriodEnd > now) {
    return { start: currentPeriodStart, end: currentPeriodEnd, source: "subscription" };
  }

  const start = startOfUtcMonth(now);
  return { start, end: addUtcMonths(start, 1), source: "calendar_month" };
}

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

      const subscription = await app.prisma.subscription.findFirst({
        where: { userId: request.auth!.userId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
        include: { plan: true },
        orderBy: { createdAt: "desc" }
      });

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
      const tokenCap = subscription?.plan.monthlyTokenCap ?? 100_000;

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
