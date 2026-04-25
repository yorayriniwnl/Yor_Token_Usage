import type { FastifyReply, FastifyRequest } from "fastify";
import { clientIp, hashForLog } from "../lib/security.js";

interface RateLimitOptions {
  scope: string;
  limit: number;
  windowSeconds: number;
  key: (request: FastifyRequest) => string | undefined;
}

export function rateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (request.url === "/healthz" || request.url === "/readyz" || request.url === "/metrics") return;

    const rawKey = options.key(request) ?? clientIp(request.headers, request.ip) ?? "anonymous";
    const keySource = hashForLog(rawKey) ?? "anonymous";
    const bucket = Math.floor(Date.now() / 1000 / options.windowSeconds);
    const redisKey = `rl:${options.scope}:${bucket}:${keySource}`;

    const count = await request.server.redis.incr(redisKey);
    if (count === 1) {
      await request.server.redis.expire(redisKey, options.windowSeconds + 5);
    }

    reply.header("RateLimit-Limit", options.limit);
    reply.header("RateLimit-Remaining", Math.max(0, options.limit - count));
    reply.header("RateLimit-Reset", options.windowSeconds);

    if (count > options.limit) {
      reply.code(429).send({
        error: "rate_limited",
        message: "Too many requests",
        retryAfterSeconds: options.windowSeconds
      });
    }
  };
}
