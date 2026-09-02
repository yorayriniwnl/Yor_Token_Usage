import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

const safeMessages: Record<string, { error: string; message: string }> = {
  device_revoked: {
    error: "device_revoked",
    message: "This extension install has been revoked"
  },
  device_limit_reached: {
    error: "device_limit_reached",
    message: "The device limit for this plan has been reached"
  },
  device_origin_mismatch: {
    error: "device_origin_mismatch",
    message: "The extension identity does not match the browser origin"
  },
  plan_unavailable: {
    error: "plan_unavailable",
    message: "The service is not configured with a default plan yet"
  }
};

export async function registerErrorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error, requestId: request.id }, "request failed");
    reply.header("x-request-id", request.id);

    if (reply.sent) return;

    if (error instanceof ZodError) {
      reply.code(400).send({
        error: "validation_error",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        reply.code(409).send({ error: "conflict", message: "The request conflicts with existing data" });
        return;
      }
      if (error.code === "P2025") {
        reply.code(404).send({ error: "not_found", message: "The requested resource was not found" });
        return;
      }
    }

    const errorDetails = error as { statusCode?: unknown; code?: unknown };
    const statusCode = typeof errorDetails.statusCode === "number" ? errorDetails.statusCode : 500;
    const knownResponse = typeof errorDetails.code === "string" ? safeMessages[errorDetails.code] : undefined;
    if (knownResponse) {
      reply.code(statusCode).send(knownResponse);
      return;
    }
    if (statusCode >= 400 && statusCode < 500) {
      reply.code(statusCode).send({
        error: "request_error",
        message: "The request could not be completed"
      });
      return;
    }

    reply.code(500).send({
      error: "internal_error",
      message: "Something went wrong"
    });
  });
}
