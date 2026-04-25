import { createRemoteJWKSet, jwtVerify } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

const jwks = createRemoteJWKSet(new URL(env.AUTH_JWKS_URL));

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "unauthorized", message: "Missing bearer token" });
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE
    });

    if (!payload.sub) {
      reply.code(401).send({ error: "unauthorized", message: "Invalid token subject" });
      return;
    }

    const email = typeof payload.email === "string" ? payload.email : undefined;
    const user = await request.server.prisma.user.upsert({
      where: { authSubject: payload.sub },
      create: {
        authSubject: payload.sub,
        email: email ?? null,
        lastSeenAt: new Date()
      },
      update: {
        email: email ?? null,
        lastSeenAt: new Date()
      }
    });

    request.auth = {
      userId: user.id,
      authSubject: payload.sub,
      ...(email ? { email } : {})
    };
  } catch {
    reply.code(401).send({ error: "unauthorized", message: "Invalid or expired token" });
  }
}
