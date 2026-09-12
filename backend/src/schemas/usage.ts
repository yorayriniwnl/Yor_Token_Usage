import { z } from "zod";
import { clientEventIdSchema, jsonObjectSchema, modelSchema, providerSchema } from "./common.js";

const usageEventFields = {
  clientEventId: clientEventIdSchema,
  provider: providerSchema,
  model: modelSchema,
  promptTokens: z.number().int().min(0).max(2_000_000),
  outputTokens: z.number().int().min(0).max(2_000_000),
  totalTokens: z.number().int().min(0).max(4_000_000),
  promptText: z.string().max(10_000_000).optional(),
  responseText: z.string().max(10_000_000).optional(),
  promptHash: z.string().length(64).regex(/^[a-f0-9]+$/i).optional(),
  status: z.enum(["COMPLETED", "RATE_LIMITED", "FAILED"]).default("COMPLETED"),
  // Provider-authoritative counts are not accepted until a verified provider
  // token endpoint is wired. The Prisma enum retains EXACT for legacy rows.
  accuracy: z.enum(["ESTIMATED", "INFERRED"]).default("ESTIMATED"),
  schemaVersion: z.number().int().min(1).max(100).default(1),
  measurementMethod: z.string().min(1).max(80).default("unknown"),
  measurementLevel: z.enum(["authoritative", "deterministic", "calibrated_estimate", "approximation", "unknown"]).default("unknown"),
  confidence: z.number().min(0).max(1).default(0),
  errorMarginPercent: z.number().min(0).max(1000).default(100),
  tokenizer: z.string().min(1).max(80).default("none"),
  source: z.string().min(1).max(160).default("Legacy event without measurement metadata"),
  metadata: jsonObjectSchema.optional()
};

function validateUsageEvent(
  event: {
    occurredAt: Date | string;
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
    measurementLevel: string;
  },
  ctx: z.RefinementCtx
): void {
  const now = Date.now();
  const occurred = event.occurredAt instanceof Date ? event.occurredAt.getTime() : new Date(event.occurredAt).getTime();
  if (occurred > now + 5 * 60_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "occurredAt cannot be more than five minutes in the future" });
  }
  if (occurred < now - 90 * 24 * 60 * 60_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "occurredAt is too old" });
  }
  if (event.totalTokens < event.promptTokens + event.outputTokens) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "totalTokens must be >= promptTokens + outputTokens" });
  }
  if (event.measurementLevel === "authoritative") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["measurementLevel"],
      message: "Provider-authoritative measurement metadata requires a verified provider adapter"
    });
  }
}

const usageEventSchema = z.object({
  ...usageEventFields,
  threadId: z.string().max(256).optional(),
  occurredAt: z.coerce.date()
}).superRefine(validateUsageEvent);

export const usageBatchSchema = z.object({
  events: z.array(usageEventSchema).min(1).max(100)
});

const queuedUsageEventSchema = z.object({
  ...usageEventFields,
  threadId: z.string().max(256).optional(),
  occurredAt: z.string().datetime()
}).superRefine(validateUsageEvent);

export const usageBatchJobSchema = z.object({
  userId: z.string().uuid(),
  deviceId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).max(160).optional(),
  attempts: z.number().int().min(0).max(100).default(0),
  events: z.array(queuedUsageEventSchema).min(1).max(100)
});

export type UsageBatchJob = z.infer<typeof usageBatchJobSchema>;
export type UsageBatchJobInput = z.input<typeof usageBatchJobSchema>;
