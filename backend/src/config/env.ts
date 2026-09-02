import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default("0.0.0.0"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  AUTH_ISSUER: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),
  AUTH_JWKS_URL: z.string().url(),
  ALLOWED_EXTENSION_ORIGINS: z.string().min(1),
  LOG_HASH_SECRET: z.string().min(32),
  METRICS_BEARER_TOKEN: z.string().min(24).optional(),
  KMS_KEY_ID: z.string().optional()
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") return;

  if (!value.METRICS_BEARER_TOKEN) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["METRICS_BEARER_TOKEN"],
      message: "METRICS_BEARER_TOKEN is required in production"
    });
  }

  if (/replace-with|example\.com|YOUR_EXTENSION_ID/i.test(value.LOG_HASH_SECRET)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["LOG_HASH_SECRET"],
      message: "LOG_HASH_SECRET must be a real production secret"
    });
  }

  if (/replace-with|example\.com|YOUR_EXTENSION_ID/i.test(value.METRICS_BEARER_TOKEN ?? "")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["METRICS_BEARER_TOKEN"],
      message: "METRICS_BEARER_TOKEN must be a real production secret"
    });
  }

  for (const path of ["AUTH_ISSUER", "AUTH_JWKS_URL"] as const) {
    if (new URL(value[path]).protocol !== "https:" || /example\.com|replace-with|YOUR_/i.test(value[path])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: `${path} must be a real HTTPS endpoint in production`
      });
    }
  }

  if (/example\.com|replace-with|YOUR_/i.test(value.AUTH_AUDIENCE)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AUTH_AUDIENCE"],
      message: "AUTH_AUDIENCE must be a real production audience"
    });
  }

  const extensionOrigins = value.ALLOWED_EXTENSION_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
  const hasInvalidExtensionOrigin = extensionOrigins.length === 0 || extensionOrigins.some((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== "chrome-extension:" || !/^[a-p]{32}$/.test(parsed.hostname) || !["", "/"].includes(parsed.pathname) || parsed.search !== "" || parsed.hash !== "";
    } catch {
      return true;
    }
  });
  if (hasInvalidExtensionOrigin || extensionOrigins.some((origin) => /YOUR_EXTENSION_ID|example\.com/i.test(origin))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ALLOWED_EXTENSION_ORIGINS"],
      message: "ALLOWED_EXTENSION_ORIGINS must contain real Chrome extension origins"
    });
  }
});

export const env = envSchema.parse(process.env);

export const allowedExtensionOrigins = env.ALLOWED_EXTENSION_ORIGINS
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
