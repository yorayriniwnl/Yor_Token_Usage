import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { upsertDevice } from "../services/devices.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/auth/session",
    {
      preHandler: [
        rateLimit({
          scope: "auth-session",
          limit: 30,
          windowSeconds: 60,
          key: (request) => request.headers.authorization
        }),
        requireAuth
      ]
    },
    async (request) => {
      const device = await upsertDevice(request);
      const subscription = await app.prisma.subscription.findFirst({
        where: {
          userId: request.auth!.userId,
          status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] }
        },
        include: { plan: true },
        orderBy: { createdAt: "desc" }
      });

      return {
        user: {
          id: request.auth!.userId,
          email: request.auth!.email
        },
        device: {
          id: device.id,
          installId: device.installId,
          status: device.status
        },
        plan: subscription?.plan ?? null,
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd
        } : null,
        serverTime: new Date().toISOString()
      };
    }
  );
}
