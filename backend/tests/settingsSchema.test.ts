import assert from "node:assert/strict";
import test from "node:test";
import { settingsUpdateSchema } from "../src/schemas/settings.js";

const payload = {
  version: 2,
  preferences: {
    theme: "dark"
  }
};

test("settings updates require matching optimistic-concurrency versions", () => {
  const parsed = settingsUpdateSchema.parse({ version: 2, payload });
  assert.equal(parsed.version, 2);
  assert.equal(parsed.payload.version, 2);

  const conflict = settingsUpdateSchema.safeParse({
    version: 3,
    payload
  });
  assert.equal(conflict.success, false);
});

test("settings versions reject unsafe integer-sized inputs", () => {
  const result = settingsUpdateSchema.safeParse({
    version: 1_000_001,
    payload: { version: 1_000_001, preferences: {} }
  });

  assert.equal(result.success, false);
});
