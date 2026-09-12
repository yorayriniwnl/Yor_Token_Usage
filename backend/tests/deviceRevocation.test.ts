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

test("verifyDeviceNotRevoked does nothing when installId header is omitted", async () => {
  const req = {
    auth: { userId: "user-123", authSubject: "sub-123" },
    headers: {},
    server: {
      prisma: {
        extensionInstall: {
          findUnique: async () => {
            throw new Error("should not be called");
          }
        }
      }
    }
  };

  await assert.doesNotReject(async () => {
    await verifyDeviceNotRevoked(req as never);
  });
  assert.equal(req.auth.deviceId, undefined);
});

test("verifyDeviceNotRevoked throws DeviceRevokedError for revoked installs", async () => {
  const req = {
    auth: { userId: "user-123", authSubject: "sub-123" },
    headers: { "x-install-id": "install-revoked" },
    server: {
      prisma: {
        extensionInstall: {
          findUnique: async () => ({
            id: "device-uuid-revoked",
            status: "REVOKED",
            installId: "install-revoked"
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

test("verifyDeviceNotRevoked attaches deviceId for active installs", async () => {
  const req = {
    auth: { userId: "user-123", authSubject: "sub-123" },
    headers: { "x-install-id": "install-active" },
    server: {
      prisma: {
        extensionInstall: {
          findUnique: async () => ({
            id: "device-uuid-active",
            status: "ACTIVE",
            installId: "install-active"
          })
        }
      }
    }
  };

  await verifyDeviceNotRevoked(req as never);
  assert.equal(req.auth.deviceId, "device-uuid-active");
  assert.equal(req.auth.installId, "install-active");
});
