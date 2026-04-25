import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export async function registerErrorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error, requestId: request.id }, "request failed");

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

    reply.code(500).send({
      error: "internal_error",
      message: "Something went wrong"
    });
  });
}
