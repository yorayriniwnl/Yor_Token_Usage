import { z } from "zod";
import { clientEventIdSchema, jsonObjectSchema, modelSchema, providerSchema } from "./common.js";

const usageEventSchema = z.object({
  clientEventId: clientEventIdSchema,
  provider: providerSchema,
  model: modelSchema,
  threadId: z.string().max(256).optional(),
  occurredAt: z.coerce.date(),
  promptTokens: z.number().int().min(0).max(2_000_000),
  outputTokens: z.number().int().min(0).max(2_000_000),
  totalTokens: z.number().int().min(0).max(4_000_000),
  promptHash: z.string().length(64).optional(),
  status: z.enum(["COMPLETED", "RATE_LIMITED", "FAILED"]).default("COMPLETED"),
  accuracy: z.enum(["ESTIMATED", "EXACT", "INFERRED"]).default("ESTIMATED"),
  metadata: jsonObjectSchema.optional()
}).superRefine((event, ctx) => {
  const now = Date.now();
  const occurred = event.occurredAt.getTime();
  if (occurred > now + 5 * 60_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "occurredAt cannot be more than five minutes in the future" });
  }
  if (occurred < now - 90 * 24 * 60 * 60_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "occurredAt is too old" });
  }
  if (event.totalTokens < event.promptTokens + event.outputTokens) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "totalTokens must be >= promptTokens + outputTokens" });
  }
});

export const usageBatchSchema = z.object({
  events: z.array(usageEventSchema).min(1).max(100)
});
