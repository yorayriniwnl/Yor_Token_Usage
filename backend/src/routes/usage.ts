import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { sha256 } from "../lib/security.js";
import { idempotencyKeySchema } from "../schemas/common.js";
import { usageBatchSchema } from "../schemas/usage.js";
import { upsertDevice } from "../services/devices.js";
import { PlanUnavailableError, resolveEntitlement } from "../services/plans.js";

const usageLimiter = rateLimit({
  scope: "usage-ingest",
  limit: 120,
  windowSeconds: 60,
  key: (request) => request.auth?.userId
});
const USAGE_ROUTE = "/v1/usage/events/batch";

function readIdempotencyKey(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return idempotencyKeySchema.parse(value);
}

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/usage/events/batch", { preHandler: [requireAuth, usageLimiter] }, async (request, reply) => {
    const body = usageBatchSchema.parse(request.body);
    const idempotency = readIdempotencyKey(request.headers["idempotency-key"]);
    const requestHash = sha256(body);
    const now = new Date();
    const idempotencyExpiresAt = new Date(now.getTime() + 24 * 60 * 60_000);
    let idempotencyRecord: { id: string } | undefined;

    if (idempotency) {
      let existing = await app.prisma.idempotencyKey.findUnique({
        where: {
          userId_route_key: {
            userId: request.auth!.userId,
            route: USAGE_ROUTE,
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
        existing = null;
      } else if (existing && existing.requestHash !== requestHash) {
        reply.code(409);
        return { error: "idempotency_conflict", message: "Idempotency key was reused with a different body" };
      } else if (existing?.response !== null && existing?.response !== undefined) {
        if (existing.statusCode === 429) {
          reply.header("Retry-After", String(Math.max(1, Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1_000))));
        }
        reply.code(existing.statusCode ?? 202);
        return existing.response;
      }
    }

    const device = await upsertDevice(request);
    const { plan } = await resolveEntitlement(app.prisma, request.auth!.userId);
    if (!plan) throw new PlanUnavailableError();

    if (idempotency) {
      try {
        idempotencyRecord = await app.prisma.idempotencyKey.create({
          data: {
            userId: request.auth!.userId,
            route: USAGE_ROUTE,
            key: idempotency,
            requestHash,
            expiresAt: idempotencyExpiresAt
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

        const concurrent = await app.prisma.idempotencyKey.findUnique({
          where: {
            userId_route_key: {
              userId: request.auth!.userId,
              route: USAGE_ROUTE,
              key: idempotency
            }
          }
        });
        if (!concurrent || concurrent.requestHash !== requestHash) {
          reply.code(409);
          return { error: "idempotency_conflict", message: "Idempotency key was reused with a different body" };
        }
        if (concurrent.response !== null && concurrent.response !== undefined) {
          if (concurrent.statusCode === 429) {
            reply.header("Retry-After", String(Math.max(1, Math.ceil((concurrent.expiresAt.getTime() - now.getTime()) / 1_000))));
          }
          reply.code(concurrent.statusCode ?? 202);
          return concurrent.response;
        }
        idempotencyRecord = concurrent;
      }
    }

    const enqueueResult = await app.usageQueue.add(
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
          schemaVersion: event.schemaVersion,
          measurementMethod: event.measurementMethod,
          measurementLevel: event.measurementLevel,
          confidence: event.confidence,
          errorMarginPercent: event.errorMarginPercent,
          tokenizer: event.tokenizer,
          source: event.source,
          ...(event.metadata ? { metadata: event.metadata } : {})
        }))
      },
      {
        jobId: `${request.auth!.userId}:${idempotency ?? request.id}`,
        maxEventsPerDay: plan.maxEventsPerDay
      }
    );

    if (enqueueResult.status === "daily_limit_exceeded") {
      const response = {
        error: "daily_event_limit_reached",
        message: "The plan's UTC daily cloud-event limit has been reached",
        accepted: 0,
        queued: false,
        retryAfterSeconds: enqueueResult.retryAfterSeconds,
        requestId: request.id
      };
      if (idempotency) {
        const dailyLimitExpiresAt = new Date(Date.now() + enqueueResult.retryAfterSeconds * 1_000);
        await app.prisma.idempotencyKey.update({
          where: { id: idempotencyRecord!.id },
          data: { response, statusCode: 429, expiresAt: dailyLimitExpiresAt }
        });
      }
      reply.header("Retry-After", String(enqueueResult.retryAfterSeconds));
      reply.code(429);
      return response;
    }

    const response = {
      accepted: body.events.length,
      queued: true,
      requestId: request.id
    };

    if (idempotency) {
      await app.prisma.idempotencyKey.update({
        where: { id: idempotencyRecord!.id },
        data: { response, statusCode: 202, expiresAt: idempotencyExpiresAt }
      });
    }

    reply.code(202);
    return response;
  });
}
