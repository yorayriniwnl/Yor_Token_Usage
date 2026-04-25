import type { PrismaClient } from "@prisma/client";
import type { Redis as RedisClient } from "ioredis";
import type { UsageQueue } from "../jobs/usageQueue.js";

export interface AuthContext {
  userId: string;
  authSubject: string;
  email?: string;
  deviceId?: string;
  installId?: string;
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: RedisClient;
    usageQueue: UsageQueue;
  }

  interface FastifyRequest {
    auth?: AuthContext;
    startedAt?: number;
  }
}
