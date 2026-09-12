import type { FastifyReply, FastifyRequest } from "fastify";
import { allowedExtensionOrigins } from "../config/env.js";
import { canonicalizeExtensionOrigin } from "../config/origins.js";

export async function validateBrowserOrigin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const path = request.url.split("?", 1)[0] ?? request.url;
  if (path === "/healthz" || path === "/readyz" || path === "/metrics") return;

  const origin = request.headers.origin;
  if (origin === undefined) {
    return;
  }

  if (typeof origin !== "string") {
    request.log.warn({ origin }, "blocked invalid browser origin header");
    reply.code(403).send({ error: "forbidden", message: "Invalid browser origin" });
    return;
  }

  const normalizedOrigin = canonicalizeExtensionOrigin(origin);
  if (!allowedExtensionOrigins.includes(normalizedOrigin)) {
    request.log.warn({ origin, normalizedOrigin }, "blocked browser origin");
    reply.code(403).send({ error: "forbidden", message: "Untrusted browser origin" });
    return;
  }
}
