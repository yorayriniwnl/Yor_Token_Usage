import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { upsertDevice } from "../services/devices.js";
import { PlanUnavailableError, resolveEntitlement } from "../services/plans.js";

const authSessionIpLimiter = rateLimit({
  scope: "auth-session-ip",
  limit: 60,
  windowSeconds: 60,
  key: (request) => request.ip
});

const authSessionUserLimiter = rateLimit({
  scope: "auth-session-user",
  limit: 30,
  windowSeconds: 60,
  key: (request) => request.auth?.userId
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/auth/session",
    {
      preHandler: [authSessionIpLimiter, requireAuth, authSessionUserLimiter]
    },
    async (request) => {
      const device = await upsertDevice(request);
      const { plan, subscription } = await resolveEntitlement(app.prisma, request.auth!.userId);
      if (!plan) throw new PlanUnavailableError();

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
        plan,
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd
        } : null,
        serverTime: new Date().toISOString()
      };
    }
  );
}
