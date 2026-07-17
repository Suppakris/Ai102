import { beforeEach, describe, expect, it, vi } from "vitest";

const incr = vi.fn();
const pexpire = vi.fn();
const pttl = vi.fn();
const getRedisConnection = vi.fn();

vi.mock("@/server/queue/redis", () => ({
  getRedisConnection: () => getRedisConnection(),
}));

const { checkRateLimit } = await import("@/server/rate-limit");

beforeEach(() => {
  incr.mockReset();
  pexpire.mockReset();
  pttl.mockReset();
  getRedisConnection.mockReset();
  getRedisConnection.mockReturnValue({ incr, pexpire, pttl });
});

describe("checkRateLimit", () => {
  it("allows the first request in a window and starts the TTL", async () => {
    incr.mockResolvedValue(1);

    const result = await checkRateLimit("user:1:route", { max: 5, windowSeconds: 60 });

    expect(result.allowed).toBe(true);
    expect(pexpire).toHaveBeenCalledWith("ratelimit:user:1:route", 60_000);
  });

  it("allows requests at or under the limit without resetting the TTL", async () => {
    incr.mockResolvedValue(5);

    const result = await checkRateLimit("user:1:route", { max: 5, windowSeconds: 60 });

    expect(result.allowed).toBe(true);
    expect(pexpire).not.toHaveBeenCalled();
  });

  it("blocks requests over the limit and reports retry-after from the TTL", async () => {
    incr.mockResolvedValue(6);
    pttl.mockResolvedValue(15_000);

    const result = await checkRateLimit("user:1:route", { max: 5, windowSeconds: 60 });

    expect(result.allowed).toBe(false);
    expect(result).toMatchObject({ allowed: false, retryAfterSeconds: 15 });
  });

  it("falls back to the window length if the TTL read comes back stale", async () => {
    incr.mockResolvedValue(6);
    pttl.mockResolvedValue(-1);

    const result = await checkRateLimit("user:1:route", { max: 5, windowSeconds: 60 });

    expect(result).toMatchObject({ allowed: false, retryAfterSeconds: 60 });
  });

  it("degrades to allow-everything when Redis isn't configured", async () => {
    getRedisConnection.mockReturnValue(null);

    const result = await checkRateLimit("user:1:route", { max: 1, windowSeconds: 60 });

    expect(result).toEqual({ allowed: true });
    expect(incr).not.toHaveBeenCalled();
  });
});
