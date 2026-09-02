import type { FastifyReply, FastifyRequest } from "fastify";
import { allowedExtensionOrigins } from "../config/env.js";

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

  if (!allowedExtensionOrigins.includes(origin)) {
    request.log.warn({ origin }, "blocked browser origin");
    reply.code(403).send({ error: "forbidden", message: "Untrusted browser origin" });
    return;
  }
}
