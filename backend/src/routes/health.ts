import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async () => ({ ok: true }));

  app.get("/readyz", async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      await app.redis.ping();
      return { ok: true };
    } catch {
      reply.code(503);
      return { ok: false };
    }
  });
}
