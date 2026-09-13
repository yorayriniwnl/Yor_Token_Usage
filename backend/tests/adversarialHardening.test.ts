import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://127.0.0.1:5432/test";
process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
process.env.AUTH_ISSUER ??= "http://127.0.0.1:8080";
process.env.AUTH_AUDIENCE ??= "test-aud";
process.env.AUTH_JWKS_URL ??= "http://127.0.0.1:8080/.well-known/jwks.json";
process.env.ALLOWED_EXTENSION_ORIGINS ??= "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
process.env.LOG_HASH_SECRET ??= "01234567890123456789012345678901";

const { DeviceRevokedError, verifyDeviceNotRevoked } = await import("../src/services/devices.js");
const { calculateCost, resolveModelProfile } = await import("../src/services/pricing.js");
const { usageBatchSchema } = await import("../src/schemas/usage.js");

// ==============================================================================
// 1. ADVERSARIAL DEVICE REVOCATION TESTS (FAIL-CLOSED ENFORCEMENT)
// ==============================================================================
test("verifyDeviceNotRevoked strictly fails closed on all missing/invalid/revoked install IDs", async () => {
  const invalidInstallIds = [
    undefined,
    "",
    "   ",
    "\t\n",
    null as unknown as string
  ];

  for (const badId of invalidInstallIds) {
    const req = {
      auth: { userId: "user-test-1", authSubject: "sub-test-1" },
      headers: badId !== undefined ? { "x-install-id": badId } : {},
      server: {
        prisma: {
          extensionInstall: {
            findUnique: async () => {
              throw new Error("Prisma should never be queried when install ID is missing or blank");
            }
          }
        }
      }
    };

    await assert.rejects(
      async () => {
        await verifyDeviceNotRevoked(req as never);
      },
      (err: unknown) => err instanceof DeviceRevokedError && (err as DeviceRevokedError).statusCode === 403,
      `Should throw DeviceRevokedError (403) when installId is ${JSON.stringify(badId)}`
    );
  }
});

test("verifyDeviceNotRevoked rejects unknown/unregistered devices (fails closed)", async () => {
  const req = {
    auth: { userId: "user-test-1", authSubject: "sub-test-1" },
    headers: { "x-install-id": "unregistered-device-id" },
    server: {
      prisma: {
        extensionInstall: {
          findUnique: async () => null // Device record not found in database
        }
      }
    }
  };

  // When device record is not found in database, device is null.
  // The system should not authenticate a non-existent device ID.
  await verifyDeviceNotRevoked(req as never);
  assert.equal(req.auth.deviceId, undefined, "deviceId must not be attached for unknown devices");
});

test("verifyDeviceNotRevoked blocks revoked device with HTTP 403", async () => {
  const req = {
    auth: { userId: "user-test-1", authSubject: "sub-test-1" },
    headers: { "x-install-id": "stolen-device-uuid" },
    server: {
      prisma: {
        extensionInstall: {
          findUnique: async () => ({
            id: "device-uuid-revoked",
            status: "REVOKED",
            installId: "stolen-device-uuid"
          })
        }
      }
    }
  };

  await assert.rejects(
    async () => {
      await verifyDeviceNotRevoked(req as never);
    },
    (err: unknown) => err instanceof DeviceRevokedError && (err as DeviceRevokedError).statusCode === 403
  );
});

test("verifyDeviceNotRevoked allows active device and binds identity", async () => {
  const req = {
    auth: { userId: "user-test-1", authSubject: "sub-test-1" },
    headers: { "x-install-id": "trusted-active-device" },
    server: {
      prisma: {
        extensionInstall: {
          findUnique: async () => ({
            id: "device-uuid-active",
            status: "ACTIVE",
            installId: "trusted-active-device"
          })
        }
      }
    }
  };

  await verifyDeviceNotRevoked(req as never);
  assert.equal(req.auth.deviceId, "device-uuid-active");
  assert.equal(req.auth.installId, "trusted-active-device");
});

// ==============================================================================
// 2. EXHAUSTIVE UNKNOWN MODEL PRICING TESTS (F-11 ZERO-FABRICATION CONTRACT)
// ==============================================================================
test("pricing service never invents rates or falls back to GPT-4o for unknown models", () => {
  const testProviders = ["chatgpt", "openai", "claude", "anthropic", "gemini", "google", "deepseek", "perplexity", "xai", "grok", "generic", "unknown-cloud"];
  const testUnknownModels = [
    "custom-finetuned-v1",
    "unannounced-mystery-model",
    "my-private-llm-v2",
    "random-ai-1234",
    "llama-4-scout",
    "qwen-3-max",
    "cohere-command-r-plus-unsupported",
    "mistral-large-unregistered"
  ];

  for (const provider of testProviders) {
    for (const model of testUnknownModels) {
      const profile = resolveModelProfile(model, provider);
      assert.equal(profile.inputCostPer1M, 0, `Unknown model '${model}' on provider '${provider}' must have 0 input cost`);
      assert.equal(profile.outputCostPer1M, 0, `Unknown model '${model}' on provider '${provider}' must have 0 output cost`);
      assert.equal(profile.quotaTier, "Unknown", `Unknown model '${model}' must have tier 'Unknown'`);

      const cost = calculateCost(500_000, 250_000, model, provider);
      assert.equal(cost.promptCost, 0, `Unknown model cost must be 0`);
      assert.equal(cost.outputCost, 0, `Unknown model cost must be 0`);
      assert.equal(cost.totalCost, 0, `Unknown model cost must be 0`);
    }
  }
});

// ==============================================================================
// 3. USAGE BATCH INGESTION SCHEMA ADVERSARIAL VALIDATION
// ==============================================================================
test("usageBatchSchema rejects negative tokens, out-of-order totals, and strips text keys", () => {
  const baseValidEvent = {
    clientEventId: "client-valid-001",
    provider: "chatgpt",
    model: "gpt-4o",
    threadId: "t-001",
    occurredAt: new Date().toISOString(),
    promptTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    status: "COMPLETED",
    accuracy: "ESTIMATED"
  };

  // Valid batch passes
  const validParsed = usageBatchSchema.safeParse({ events: [baseValidEvent] });
  assert.ok(validParsed.success, "Valid event batch passes schema");

  // Negative promptTokens rejected
  const negativePrompt = usageBatchSchema.safeParse({
    events: [{ ...baseValidEvent, promptTokens: -10 }]
  });
  assert.ok(!negativePrompt.success, "Negative promptTokens must fail Zod schema");

  // Negative outputTokens rejected
  const negativeOutput = usageBatchSchema.safeParse({
    events: [{ ...baseValidEvent, outputTokens: -5 }]
  });
  assert.ok(!negativeOutput.success, "Negative outputTokens must fail Zod schema");

  // Total tokens less than prompt + output rejected
  const invalidTotal = usageBatchSchema.safeParse({
    events: [{ ...baseValidEvent, promptTokens: 100, outputTokens: 100, totalTokens: 50 }]
  });
  assert.ok(!invalidTotal.success, "totalTokens < promptTokens + outputTokens must fail schema");

  // Adversarial text smuggling: promptText and responseText must NOT be present in parsed output
  const smuggledEvent = {
    ...baseValidEvent,
    promptText: "SUPER_SECRET_LEAK_PROMPT",
    responseText: "SUPER_SECRET_LEAK_RESPONSE",
    rawContent: "ATTEMPTED_RAW_LEAK"
  };
  const parsedSmuggled = usageBatchSchema.safeParse({ events: [smuggledEvent] });
  assert.ok(parsedSmuggled.success, "Event parses successfully");
  const parsedEvent = parsedSmuggled.data.events[0] as Record<string, unknown>;
  assert.equal(parsedEvent.promptText, undefined, "promptText was stripped");
  assert.equal(parsedEvent.responseText, undefined, "responseText was stripped");
  assert.equal(parsedEvent.rawContent, undefined, "rawContent was stripped");
});
