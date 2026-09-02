import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

try {
  await app.redis.connect();
  await app.listen({ host: env.HOST, port: env.PORT });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "server shutting down");
    try {
      await app.close();
    } catch (error) {
      app.log.error({ error }, "server shutdown failed");
      process.exitCode = 1;
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
} catch (error) {
  app.log.error({ error }, "server failed to start");
  process.exit(1);
}
