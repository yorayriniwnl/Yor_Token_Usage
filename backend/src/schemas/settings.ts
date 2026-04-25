import { z } from "zod";
import { jsonObjectSchema, jsonValueSchema } from "./common.js";

export const settingsPayloadSchema = z.object({
  version: z.number().int().min(1).default(1),
  preferences: jsonObjectSchema.default({})
}).catchall(jsonValueSchema);

export const settingsUpdateSchema = z.object({
  version: z.number().int().min(1),
  payload: settingsPayloadSchema
}).superRefine((value, context) => {
  if (value.payload.version !== value.version) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["payload", "version"],
      message: "Payload version must match the top-level settings version"
    });
  }
});
