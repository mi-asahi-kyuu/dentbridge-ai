import { describe, expect, it } from "vitest";
import { getTranslationPipelineMode } from "./translation-pipeline";

describe("translation pipeline mode", () => {
  it("keeps the full safety pipeline as the fallback", () => {
    expect(getTranslationPipelineMode(undefined)).toBe("safe");
    expect(getTranslationPipelineMode("safe")).toBe("safe");
    expect(getTranslationPipelineMode("fast")).toBe("fast");
    expect(getTranslationPipelineMode("unknown")).toBe("safe");
  });
});
