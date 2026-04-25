import type { FastifyReply, FastifyRequest } from "fastify";
import { allowedExtensionOrigins, env } from "../config/env.js";

export async function validateExtensionOrigin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.url === "/healthz" || request.url === "/readyz" || request.url === "/metrics") return;

  const origin = request.headers.origin;
  if (typeof origin !== "string") {
    reply.code(403).send({ error: "forbidden", message: "Missing extension origin" });
    return;
  }

  if (!allowedExtensionOrigins.includes(origin)) {
    request.log.warn({ origin, env: env.NODE_ENV }, "blocked extension origin");
    reply.code(403).send({ error: "forbidden", message: "Untrusted extension origin" });
  }
}
