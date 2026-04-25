import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function sha256(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function hashForLog(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return createHmac("sha256", env.LOG_HASH_SECRET).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function clientIp(headers: Record<string, unknown>, fallbackIp?: string): string | undefined {
  const forwarded = String(headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
  return forwarded || fallbackIp;
}
