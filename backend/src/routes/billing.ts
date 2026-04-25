import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/billing/status",
    {
      preHandler: [
        requireAuth,
        rateLimit({ scope: "billing-status", limit: 60, windowSeconds: 60, key: (request) => request.auth?.userId })
      ]
    },
    async (request) => {
      const subscription = await app.prisma.subscription.findFirst({
        where: { userId: request.auth!.userId },
        include: { plan: true },
        orderBy: { createdAt: "desc" }
      });

      return {
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
        } : null,
        plan: subscription?.plan ?? null
      };
    }
  );
}
