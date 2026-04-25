import { z } from "zod";

const usageCursorPayloadSchema = z.object({
  occurredAt: z.string().datetime(),
  id: z.string().uuid()
});

export interface UsageCursor {
  occurredAt: Date;
  id: string;
}

export interface UsageCursorSource {
  occurredAt: Date;
  id: string;
}

export function encodeUsageCursor(source: UsageCursorSource): string {
  return Buffer.from(JSON.stringify({
    occurredAt: source.occurredAt.toISOString(),
    id: source.id
  })).toString("base64url");
}

export function decodeUsageCursor(cursor: string): UsageCursor | undefined {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const payload = usageCursorPayloadSchema.parse(JSON.parse(decoded));
    return {
      occurredAt: new Date(payload.occurredAt),
      id: payload.id
    };
  } catch {
    return undefined;
  }
}
