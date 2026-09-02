import type { FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hashForLog } from "../lib/security.js";
import { PlanUnavailableError, resolveEntitlement } from "./plans.js";

export class DeviceRevokedError extends Error {
  readonly statusCode = 403;
  readonly code = "device_revoked";

  constructor() {
    super("This extension install has been revoked");
    this.name = "DeviceRevokedError";
  }
}

export class DeviceLimitError extends Error {
  readonly statusCode = 409;
  readonly code = "device_limit_reached";

  constructor() {
    super("The device limit for this plan has been reached");
    this.name = "DeviceLimitError";
  }
}

export class DeviceOriginMismatchError extends Error {
  readonly statusCode = 400;
  readonly code = "device_origin_mismatch";

  constructor() {
    super("The extension identity does not match the browser origin");
    this.name = "DeviceOriginMismatchError";
  }
}

const deviceHeadersSchema = z.object({
  installId: z.string().min(8).max(128),
  extensionId: z.string().min(8).max(128),
  extensionVersion: z.string().max(64).optional(),
  browser: z.string().max(64).optional(),
  platform: z.string().max(64).optional(),
  deviceName: z.string().max(120).optional()
});

export function readDeviceHeaders(request: FastifyRequest) {
  return deviceHeadersSchema.parse({
    installId: request.headers["x-install-id"],
    extensionId: request.headers["x-extension-id"],
    extensionVersion: request.headers["x-extension-version"],
    browser: request.headers["x-browser"],
    platform: request.headers["x-platform"],
    deviceName: request.headers["x-device-name"]
  });
}

export async function upsertDevice(request: FastifyRequest) {
  if (!request.auth) throw new Error("missing auth");
  const headers = readDeviceHeaders(request);
  const fingerprintHash = hashForLog(`${headers.extensionId}:${headers.browser ?? ""}:${headers.platform ?? ""}`);

  const origin = request.headers.origin;
  if (typeof origin === "string") {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol === "chrome-extension:" && parsedOrigin.hostname !== headers.extensionId) {
        throw new DeviceOriginMismatchError();
      }
    } catch (error) {
      if (error instanceof DeviceOriginMismatchError) throw error;
    }
  }

  const device = await request.server.prisma.$transaction(async (tx) => {
    // Serialize new-install checks per user so concurrent requests cannot bypass maxDevices.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${request.auth!.userId}::uuid FOR UPDATE`);
    const existing = await tx.extensionInstall.findUnique({
      where: {
        userId_installId: {
          userId: request.auth!.userId,
          installId: headers.installId
        }
      }
    });

    if (existing?.status === "REVOKED") throw new DeviceRevokedError();

    if (!existing) {
      const { plan } = await resolveEntitlement(tx, request.auth!.userId);
      if (!plan) throw new PlanUnavailableError();
      const activeDevices = await tx.extensionInstall.count({
        where: { userId: request.auth!.userId, status: "ACTIVE" }
      });
      if (activeDevices >= plan.maxDevices) throw new DeviceLimitError();
    }

    return tx.extensionInstall.upsert({
      where: {
        userId_installId: {
          userId: request.auth!.userId,
          installId: headers.installId
        }
      },
      create: {
        userId: request.auth!.userId,
        installId: headers.installId,
        extensionId: headers.extensionId,
        extensionVer: headers.extensionVersion ?? null,
        browser: headers.browser ?? null,
        platform: headers.platform ?? null,
        deviceName: headers.deviceName ?? null,
        fingerprintHash: fingerprintHash ?? null,
        lastSeenAt: new Date()
      },
      update: {
        extensionId: headers.extensionId,
        extensionVer: headers.extensionVersion ?? null,
        browser: headers.browser ?? null,
        platform: headers.platform ?? null,
        deviceName: headers.deviceName ?? null,
        fingerprintHash: fingerprintHash ?? null,
        lastSeenAt: new Date()
      }
    });
  });

  request.auth.deviceId = device.id;
  request.auth.installId = device.installId;
  return device;
}
