import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { errorReportSchema } from "../schemas/diagnostics.js";
import { upsertDevice } from "../services/devices.js";

export async function diagnosticsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/diagnostics/errors",
    {
      preHandler: [
        requireAuth,
        rateLimit({ scope: "diagnostics", limit: 30, windowSeconds: 60, key: (request) => request.auth?.userId })
      ]
    },
    async (request, reply) => {
      const body = errorReportSchema.parse(request.body);
      const device = await upsertDevice(request);
      const stackHash = body.stack
        ? createHash("sha256").update(body.stack).digest("hex")
        : undefined;

      await app.prisma.errorLog.create({
        data: {
          userId: request.auth!.userId,
          deviceId: device.id,
          source: body.source,
          severity: body.severity,
          message: body.message,
          stackHash: stackHash ?? null,
          ...(body.context ? { context: body.context as Prisma.InputJsonObject } : {})
        }
      });

      reply.code(202);
      return { accepted: true };
    }
  );
}
