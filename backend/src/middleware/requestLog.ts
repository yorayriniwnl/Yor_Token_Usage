import type { FastifyInstance } from "fastify";
import { clientIp, hashForLog } from "../lib/security.js";

export async function registerRequestLogging(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    request.startedAt = Date.now();
  });

  app.addHook("onResponse", async (request, reply) => {
    if (request.url === "/healthz" || request.url === "/readyz" || request.url === "/metrics") return;
    const latencyMs = Date.now() - (request.startedAt ?? Date.now());
    const status = reply.statusCode === 429 ? "RATE_LIMITED" : reply.statusCode >= 400 ? "ERROR" : "OK";

    void app.prisma.apiRequestLog.create({
      data: {
        ...(request.auth?.userId ? { userId: request.auth.userId } : {}),
        ...(request.auth?.deviceId ? { deviceId: request.auth.deviceId } : {}),
        requestId: request.id,
        method: request.method,
        route: request.routeOptions.url ?? request.url.split("?")[0] ?? request.url,
        statusCode: reply.statusCode,
        status,
        latencyMs,
        ipHash: hashForLog(clientIp(request.headers, request.ip)) ?? null,
        userAgentHash: hashForLog(request.headers["user-agent"]) ?? null
      }
    }).catch((error: unknown) => request.log.warn({ error }, "api request log failed"));
  });
}
