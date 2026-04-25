import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { hashForLog } from "../lib/security.js";

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

  const device = await request.server.prisma.extensionInstall.upsert({
    where: {
      userId_installId: {
        userId: request.auth.userId,
        installId: headers.installId
      }
    },
    create: {
      userId: request.auth.userId,
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

  request.auth.deviceId = device.id;
  request.auth.installId = device.installId;
  return device;
}
