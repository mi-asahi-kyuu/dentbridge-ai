import { describe, expect, it } from "vitest";
import { shouldRetryHttpStatus } from "./http-retry-policy";

describe("HTTP retry policy", () => {
  it("retries only temporary transport or service failures", () => {
    expect(shouldRetryHttpStatus(408)).toBe(true);
    expect(shouldRetryHttpStatus(429)).toBe(true);
    expect(shouldRetryHttpStatus(502)).toBe(true);
    expect(shouldRetryHttpStatus(504)).toBe(true);
  });

  it("keeps the connection online for content and validation rejection", () => {
    expect(shouldRetryHttpStatus(400)).toBe(false);
    expect(shouldRetryHttpStatus(422)).toBe(false);
  });
});
