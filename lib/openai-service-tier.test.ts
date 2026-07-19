import { describe, expect, it } from "vitest";
import { getOpenAiServiceTier } from "./openai-service-tier";

describe("OpenAI service tier", () => {
  it("allows only documented application settings", () => {
    expect(getOpenAiServiceTier("priority")).toBe("priority");
    expect(getOpenAiServiceTier("default")).toBe("default");
    expect(getOpenAiServiceTier("auto")).toBe("auto");
    expect(getOpenAiServiceTier("flex")).toBe("auto");
    expect(getOpenAiServiceTier("invalid")).toBe("auto");
  });
});
