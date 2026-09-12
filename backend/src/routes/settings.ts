import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { settingsUpdateSchema } from "../schemas/settings.js";
import { verifyDeviceNotRevoked } from "../services/devices.js";

const userLimiter = rateLimit({
  scope: "settings",
  limit: 120,
  windowSeconds: 60,
  key: (request) => request.auth?.userId
});

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/settings", { preHandler: [requireAuth, userLimiter] }, async (request) => {
    await verifyDeviceNotRevoked(request);
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

  app.put("/v1/settings", { preHandler: [requireAuth, userLimiter] }, async (request, reply) => {
    await verifyDeviceNotRevoked(request);
    const body = settingsUpdateSchema.parse(request.body);
    const payload = body.payload as Prisma.InputJsonObject;
    const userId = request.auth!.userId;

    const result = await app.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`);
      const current = await tx.userSettings.findUnique({ where: { userId } });
      const expectedVersion = current ? current.version + 1 : 1;
      if (body.version !== expectedVersion) {
        return { conflict: true as const, current };
      }

      const writeAuditLog = async (version: number, previousVersion: number | null) => {
        await tx.auditLog.create({
          data: {
            userId,
            action: "settings.updated",
            actor: "user",
            metadata: { version, previousVersion }
          }
        });
      };

      const settings = current
        ? await tx.userSettings.update({
          where: { userId },
          data: { version: body.version, payload }
        })
        : await tx.userSettings.create({
          data: { userId, version: body.version, payload }
        });
      await writeAuditLog(body.version, current?.version ?? null);
      return { conflict: false as const, settings };
    });

    if (result.conflict) {
      reply.code(409);
      return {
        error: "settings_version_conflict",
        message: "Settings were updated by another client. Fetch the latest settings and retry.",
        expectedVersion: result.current ? result.current.version + 1 : 1,
        currentSettings: result.current ? {
          version: result.current.version,
          payload: result.current.payload,
          updatedAt: result.current.updatedAt
        } : null
      };
    }

    const settings = result.settings;
    return {
      settings: {
        version: settings.version,
        payload: settings.payload,
        updatedAt: settings.updatedAt
      }
    };
  });
}
