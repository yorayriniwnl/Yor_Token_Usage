import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { sha256 } from "../lib/security.js";
import { usageBatchSchema } from "../schemas/usage.js";
import { upsertDevice } from "../services/devices.js";

const usageLimiter = rateLimit({
  scope: "usage-ingest",
  limit: 120,
  windowSeconds: 60,
  key: (request) => request.auth?.userId
});

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/usage/events/batch", { preHandler: [requireAuth, usageLimiter] }, async (request, reply) => {
    const device = await upsertDevice(request);
    const body = usageBatchSchema.parse(request.body);
    const idempotencyKey = request.headers["idempotency-key"];
    const idempotency = typeof idempotencyKey === "string" ? idempotencyKey.slice(0, 160) : undefined;
    const requestHash = sha256(body);
    const now = new Date();
    const idempotencyExpiresAt = new Date(now.getTime() + 24 * 60 * 60_000);

    if (idempotency) {
      const existing = await app.prisma.idempotencyKey.findUnique({
        where: {
          userId_route_key: {
            userId: request.auth!.userId,
            route: "/v1/usage/events/batch",
            key: idempotency
          }
        }
      });

      if (existing && existing.expiresAt <= now) {
        await app.prisma.idempotencyKey.deleteMany({
          where: {
            id: existing.id,
            expiresAt: { lte: now }
          }
        });
      } else if (existing?.response && existing.requestHash === requestHash) {
        reply.code(existing.statusCode ?? 202);
        return existing.response;
      } else if (existing && existing.requestHash !== requestHash) {
        reply.code(409);
        return { error: "idempotency_conflict", message: "Idempotency key was reused with a different body" };
      }
    }

    const response = {
      accepted: body.events.length,
      queued: true,
      requestId: request.id
    };

    await app.usageQueue.add(
      "usage-batch",
      {
        userId: request.auth!.userId,
        deviceId: device.id,
        ...(idempotency ? { idempotencyKey: idempotency } : {}),
        events: body.events.map((event) => ({
          clientEventId: event.clientEventId,
          provider: event.provider,
          model: event.model,
          ...(event.threadId ? { threadId: event.threadId } : {}),
          occurredAt: event.occurredAt.toISOString(),
          promptTokens: event.promptTokens,
          outputTokens: event.outputTokens,
          totalTokens: event.totalTokens,
          ...(event.promptHash ? { promptHash: event.promptHash } : {}),
          status: event.status,
          accuracy: event.accuracy,
          ...(event.metadata ? { metadata: event.metadata } : {})
        }))
      },
      idempotency ? { jobId: `${request.auth!.userId}:${idempotency}` } : undefined
    );

    if (idempotency) {
      await app.prisma.idempotencyKey.upsert({
        where: {
          userId_route_key: {
            userId: request.auth!.userId,
            route: "/v1/usage/events/batch",
            key: idempotency
          }
        },
        create: {
          userId: request.auth!.userId,
          route: "/v1/usage/events/batch",
          key: idempotency,
          requestHash,
          response,
          statusCode: 202,
          expiresAt: idempotencyExpiresAt
        },
        update: {
          requestHash,
          response,
          statusCode: 202,
          expiresAt: idempotencyExpiresAt
        }
      });
    }

    reply.code(202);
    return response;
  });
}
