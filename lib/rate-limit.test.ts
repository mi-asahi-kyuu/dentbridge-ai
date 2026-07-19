import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimitBucketsForTests } from "./rate-limit";

describe("rate limiter", () => {
  beforeEach(clearRateLimitBucketsForTests);

  it("blocks requests after the configured limit", () => {
    expect(checkRateLimit("clinic", 1000, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("clinic", 1001, 2, 60_000).allowed).toBe(true);
    const blocked = checkRateLimit("clinic", 1002, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("resets after the time window", () => {
    checkRateLimit("clinic", 1000, 1, 100);
    expect(checkRateLimit("clinic", 1100, 1, 100).allowed).toBe(true);
  });
});
