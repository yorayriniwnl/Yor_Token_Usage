import { z } from "zod";
import { jsonObjectSchema } from "./common.js";

export const errorReportSchema = z.object({
  source: z.enum(["popup", "content", "background", "dashboard", "settings", "api"]),
  severity: z.enum(["debug", "info", "warning", "error", "fatal"]).default("error"),
  message: z.string().min(1).max(1_000),
  stack: z.string().max(10_000).optional(),
  context: jsonObjectSchema.optional()
});
