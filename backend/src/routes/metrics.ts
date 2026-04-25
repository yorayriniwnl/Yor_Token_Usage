import type { FastifyInstance } from "fastify";
import client from "prom-client";
import { env } from "../config/env.js";
import { safeEqual } from "../lib/security.js";

client.collectDefaultMetrics({ prefix: "yor_backend_" });

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/metrics", async (request, reply) => {
    if (env.METRICS_BEARER_TOKEN) {
      const token = String(request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (!safeEqual(token, env.METRICS_BEARER_TOKEN)) {
        reply.code(401);
        return "unauthorized";
      }
    }

    reply.header("Content-Type", client.register.contentType);
    return client.register.metrics();
  });
}
