import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { settingsUpdateSchema } from "../schemas/settings.js";

const userLimiter = rateLimit({
  scope: "settings",
  limit: 120,
  windowSeconds: 60,
  key: (request) => request.auth?.userId
});

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/settings", { preHandler: [requireAuth, userLimiter] }, async (request) => {
    const settings = await app.prisma.userSettings.findUnique({
      where: { userId: request.auth!.userId }
    });

    return {
      settings: settings ? {
        version: settings.version,
        payload: settings.payload,
        updatedAt: settings.updatedAt
      } : null
    };
  });

  app.put("/v1/settings", { preHandler: [requireAuth, userLimiter] }, async (request) => {
    const body = settingsUpdateSchema.parse(request.body);
    const payload = body.payload as Prisma.InputJsonObject;
    const settings = await app.prisma.userSettings.upsert({
      where: { userId: request.auth!.userId },
      create: {
        userId: request.auth!.userId,
        version: body.version,
        payload
      },
      update: {
        version: body.version,
        payload
      }
    });

    await app.prisma.auditLog.create({
      data: {
        userId: request.auth!.userId,
        action: "settings.updated",
        actor: "user",
        metadata: { version: body.version }
      }
    });

    return {
      settings: {
        version: settings.version,
        payload: settings.payload,
        updatedAt: settings.updatedAt
      }
    };
  });
}
