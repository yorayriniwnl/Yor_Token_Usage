import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { hashForLog } from "../lib/security.js";

const jwks = createRemoteJWKSet(new URL(env.AUTH_JWKS_URL));
const AUTH_USER_CACHE_TTL_SECONDS = 15 * 60;
const AUTH_USER_REFRESH_SECONDS = 5 * 60;

interface CachedAuthUser {
  userId: string;
}

function authUserCacheKey(authSubject: string): string {
  return `auth:user:${hashForLog(authSubject)}`;
}

function parseCachedAuthUser(value: string | null): CachedAuthUser | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<CachedAuthUser>;
    return typeof parsed.userId === "string" ? { userId: parsed.userId } : undefined;
  } catch {
    return undefined;
  }
}

async function cacheAuthUser(request: FastifyRequest, cacheKey: string, userId: string): Promise<void> {
  try {
    await request.server.redis.set(cacheKey, JSON.stringify({ userId }), "EX", AUTH_USER_CACHE_TTL_SECONDS);
  } catch (error) {
    request.log.warn({ error }, "auth user cache write failed");
  }
}

function setAuthContext(request: FastifyRequest, userId: string, authSubject: string, email?: string): void {
  request.auth = {
    userId,
    authSubject,
    ...(email ? { email } : {})
  };
}

async function findCachedAuthUser(request: FastifyRequest, cacheKey: string): Promise<CachedAuthUser | undefined> {
  try {
    return parseCachedAuthUser(await request.server.redis.get(cacheKey));
  } catch (error) {
    request.log.warn({ error }, "auth user cache read failed");
    return undefined;
  }
}

async function refreshUserIfDue(
  request: FastifyRequest,
  cacheKey: string,
  userId: string,
  email: string | undefined
): Promise<void> {
  try {
    const refreshKey = `${cacheKey}:refresh`;
    const shouldRefresh = await request.server.redis.set(refreshKey, "1", "EX", AUTH_USER_REFRESH_SECONDS, "NX");
    if (!shouldRefresh) return;
  } catch (error) {
    request.log.warn({ error }, "auth user refresh throttle failed");
    return;
  }

  void request.server.prisma.user.update({
    where: { id: userId },
    data: {
      email: email ?? null,
      lastSeenAt: new Date()
    }
  }).then(() => cacheAuthUser(request, cacheKey, userId)).catch(async (error: unknown) => {
    request.log.warn({ error }, "auth user refresh failed");
    try {
      await request.server.redis.del(cacheKey);
    } catch (redisError) {
      request.log.warn({ error: redisError }, "auth user cache invalidation failed");
    }
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "unauthorized", message: "Missing bearer token" });
    return;
  }

  let payload: JWTPayload;
  try {
    const token = header.slice("Bearer ".length);
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE
    }));
  } catch {
    reply.code(401).send({ error: "unauthorized", message: "Invalid or expired token" });
    return;
  }

  if (!payload.sub) {
    reply.code(401).send({ error: "unauthorized", message: "Invalid token subject" });
    return;
  }

  const authSubject = payload.sub;
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const cacheKey = authUserCacheKey(authSubject);
  const cachedUser = await findCachedAuthUser(request, cacheKey);

  if (cachedUser) {
    setAuthContext(request, cachedUser.userId, authSubject, email);
    void refreshUserIfDue(request, cacheKey, cachedUser.userId, email);
    return;
  }

  const user = await request.server.prisma.user.upsert({
    where: { authSubject },
    create: {
      authSubject,
      email: email ?? null,
      lastSeenAt: new Date()
    },
    update: {
      email: email ?? null,
      lastSeenAt: new Date()
    }
  });

  await cacheAuthUser(request, cacheKey, user.id);
  setAuthContext(request, user.id, authSubject, email);
}
