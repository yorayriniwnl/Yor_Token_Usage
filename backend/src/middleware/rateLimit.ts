import type { FastifyReply, FastifyRequest } from "fastify";
import { clientIp, hashForLog } from "../lib/security.js";

interface RateLimitOptions {
  scope: string;
  limit: number;
  windowSeconds: number;
  key: (request: FastifyRequest) => string | undefined;
}

const ATOMIC_RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`;

export function rateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const path = request.url.split("?", 1)[0] ?? request.url;
    if (path === "/healthz" || path === "/readyz" || path === "/metrics") return;

    const rawKey = options.key(request) ?? clientIp(request.headers, request.ip) ?? "anonymous";
    const keySource = hashForLog(rawKey) ?? "anonymous";
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSeconds / options.windowSeconds);
    const resetSeconds = Math.max(1, (bucket + 1) * options.windowSeconds - nowSeconds);
    const redisKey = `rl:${options.scope}:${bucket}:${keySource}`;

    let count: number;
    try {
      count = Number(await request.server.redis.eval(
        ATOMIC_RATE_LIMIT_SCRIPT,
        1,
        redisKey,
        String(resetSeconds + 5)
      ));
      if (!Number.isSafeInteger(count) || count < 1) {
        throw new Error("Redis returned an invalid rate-limit counter");
      }
    } catch (error) {
      request.log.error({ error, scope: options.scope }, "rate-limit dependency unavailable");
      reply.code(503).send({
        error: "rate_limit_unavailable",
        message: "Traffic protection is temporarily unavailable. Try again shortly."
      });
      return;
    }

    reply.header("RateLimit-Limit", options.limit);
    reply.header("RateLimit-Remaining", Math.max(0, options.limit - count));
    reply.header("RateLimit-Reset", resetSeconds);

    if (count > options.limit) {
      reply.header("Retry-After", resetSeconds);
      reply.code(429).send({
        error: "rate_limited",
        message: "Too many requests",
        retryAfterSeconds: resetSeconds
      });
    }
  };
}
