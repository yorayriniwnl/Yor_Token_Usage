import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  AUTH_ISSUER: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),
  AUTH_JWKS_URL: z.string().url(),
  ALLOWED_EXTENSION_ORIGINS: z.string().min(1),
  LOG_HASH_SECRET: z.string().min(32),
  METRICS_BEARER_TOKEN: z.string().min(24).optional(),
  KMS_KEY_ID: z.string().optional()
});

export const env = envSchema.parse(process.env);

export const allowedExtensionOrigins = env.ALLOWED_EXTENSION_ORIGINS
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
