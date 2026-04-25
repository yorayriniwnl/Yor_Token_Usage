import { Redis, type RedisOptions } from "ioredis";
import { env } from "../config/env.js";

export function createRedisClient(options: RedisOptions): Redis {
  return new Redis(env.REDIS_URL, options);
}

export const redis = createRedisClient({
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 2_000,
  commandTimeout: 1_500
});
