import assert from "node:assert/strict";
import test from "node:test";
import { decodeUsageCursor, encodeUsageCursor } from "../src/services/syncPagination.js";

test("usage sync cursors round-trip occurredAt and id", () => {
  const source = {
    occurredAt: new Date("2026-04-25T12:30:00.000Z"),
    id: "33333333-3333-4333-8333-333333333333"
  };

  const decoded = decodeUsageCursor(encodeUsageCursor(source));

  assert.equal(decoded?.occurredAt.toISOString(), source.occurredAt.toISOString());
  assert.equal(decoded?.id, source.id);
});

test("usage sync cursors reject malformed values", () => {
  assert.equal(decodeUsageCursor("not-a-cursor"), undefined);
});
