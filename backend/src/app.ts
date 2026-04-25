import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { env, allowedExtensionOrigins } from "./config/env.js";
import { createUsageQueue } from "./jobs/usageQueue.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { registerErrorHandler } from "./middleware/errors.js";
import { validateExtensionOrigin } from "./middleware/extensionOrigin.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { registerRequestLogging } from "./middleware/requestLog.js";
import { authRoutes } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
import { diagnosticsRoutes } from "./routes/diagnostics.js";
import { healthRoutes } from "./routes/health.js";
import { metricsRoutes } from "./routes/metrics.js";
import { quotaRoutes } from "./routes/quota.js";
import { settingsRoutes } from "./routes/settings.js";
import { syncRoutes } from "./routes/sync.js";
import { usageRoutes } from "./routes/usage.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: ["req.headers.authorization", "req.headers.cookie"]
    },
    requestIdHeader: "x-request-id",
    bodyLimit: 512 * 1024,
    trustProxy: true
  });

  app.decorate("prisma", prisma);
  app.decorate("redis", redis);
  app.decorate("usageQueue", createUsageQueue(redis));

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false
  });
  await app.register(sensible);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, false);
        return;
      }
      callback(null, allowedExtensionOrigins.includes(origin));
    },
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: [
      "authorization",
      "content-type",
      "idempotency-key",
      "x-install-id",
      "x-extension-id",
      "x-extension-version",
      "x-browser",
      "x-platform",
      "x-device-name",
      "x-request-id"
    ],
    maxAge: 600
  });

  app.addHook("preHandler", validateExtensionOrigin);
  app.addHook("preHandler", rateLimit({
    scope: "ip-global",
    limit: 600,
    windowSeconds: 60,
    key: (request) => request.ip
  }));

  await registerRequestLogging(app);
  await registerErrorHandler(app);

  await app.register(healthRoutes);
  await app.register(metricsRoutes);
  await app.register(authRoutes);
  await app.register(settingsRoutes);
  await app.register(usageRoutes);
  await app.register(quotaRoutes);
  await app.register(billingRoutes);
  await app.register(syncRoutes);
  await app.register(diagnosticsRoutes);

  app.addHook("onClose", async () => {
    await app.usageQueue.close();
    await redis.quit();
    await prisma.$disconnect();
  });

  return app;
}
