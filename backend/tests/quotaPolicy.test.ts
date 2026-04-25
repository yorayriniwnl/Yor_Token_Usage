import assert from "node:assert/strict";
import test from "node:test";
import { addUtcMonths, resolveQuotaPeriod, startOfUtcMonth } from "../src/services/quotaPolicy.js";

test("resolves active subscription period for monthly quota", () => {
  const start = new Date("2026-03-15T12:00:00.000Z");
  const end = new Date("2026-04-15T12:00:00.000Z");
  const period = resolveQuotaPeriod({ currentPeriodStart: start, currentPeriodEnd: end }, new Date("2026-04-01T00:00:00.000Z"));

  assert.equal(period.source, "subscription");
  assert.equal(period.start.toISOString(), start.toISOString());
  assert.equal(period.end.toISOString(), end.toISOString());
});

test("falls back to UTC calendar month when subscription period is absent", () => {
  const period = resolveQuotaPeriod(null, new Date("2026-04-25T20:30:00.000Z"));

  assert.equal(period.source, "calendar_month");
  assert.equal(period.start.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-05-01T00:00:00.000Z");
});

test("falls back to UTC calendar month when subscription period is stale", () => {
  const period = resolveQuotaPeriod(
    {
      currentPeriodStart: new Date("2026-02-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-03-01T00:00:00.000Z")
    },
    new Date("2026-04-25T00:00:00.000Z")
  );

  assert.equal(period.source, "calendar_month");
  assert.equal(period.start.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-05-01T00:00:00.000Z");
});

test("adds UTC months without overflowing short months", () => {
  assert.equal(startOfUtcMonth(new Date("2026-04-25T20:30:00.000Z")).toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(addUtcMonths(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString(), "2026-02-28T00:00:00.000Z");
});
