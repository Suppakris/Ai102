import { env } from "@/env";
import { Redis } from "ioredis";

let connection: Redis | null | undefined;

// Lazily creates the shared ioredis connection used by BullMQ. Returns null
// when REDIS_URL isn't configured so callers can fall back to running jobs
// inline (see runJob in image-generation.ts) — matches this app's existing
// pattern of optional integrations degrading gracefully instead of throwing.
export function getRedisConnection(): Redis | null {
  if (connection !== undefined) return connection;

  if (!env.REDIS_URL) {
    connection = null;
    return connection;
  }

  // BullMQ requires maxRetriesPerRequest: null on the connection it's given.
  connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}
