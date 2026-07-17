import { getRedisConnection } from "@/backend/queue/redis";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

// Fixed-window rate limiter backed by Redis (INCR + PEXPIRE), keyed per
// caller per route. Guards the LLM/image-generation routes, which call
// paid, externally rate-limited providers, from being hammered by one
// user or a runaway client retry loop.
//
// Without REDIS_URL configured this no-ops (allowed: true) — matches this
// app's convention of optional infra degrading gracefully rather than
// breaking local dev.
export async function checkRateLimit(
  key: string,
  { max, windowSeconds }: { max: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const redis = getRedisConnection();
  if (!redis) return { allowed: true };

  const redisKey = `ratelimit:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.pexpire(redisKey, windowSeconds * 1000);
  }

  if (count <= max) return { allowed: true };

  const ttlMs = await redis.pttl(redisKey);
  return {
    allowed: false,
    retryAfterSeconds: ttlMs > 0 ? Math.ceil(ttlMs / 1000) : windowSeconds,
  };
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
