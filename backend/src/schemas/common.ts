import { z } from "zod";

export const providerSchema = z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/i);
export const modelSchema = z.string().min(1).max(120);
export const clientEventIdSchema = z.string().min(8).max(128);

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema)
  ])
);

export const jsonObjectSchema = z.record(jsonValueSchema);

export const paginationSchema = z.object({
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100)
});
