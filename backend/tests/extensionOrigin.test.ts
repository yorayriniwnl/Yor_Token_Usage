import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeExtensionOrigin } from "../src/config/origins.js";

test("extension origin canonicalization matches browser Origin headers", () => {
  assert.equal(
    canonicalizeExtensionOrigin("chrome-extension://abcdefghijklmnopabcdefghijklmnop/"),
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
  );
  assert.equal(
    canonicalizeExtensionOrigin(" chrome-extension://abcdefghijklmnopabcdefghijklmnop "),
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
  );
});
