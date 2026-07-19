import { describe, expect, it } from "vitest";
import { getLanguage, isAllowedLanguage, languagePairLabel } from "./languages";

describe("language configuration", () => {
  it("accepts only configured language codes", () => {
    expect(["ja", "zh", "en", "ko", "vi"].every(isAllowedLanguage)).toBe(true);
    expect(isAllowedLanguage("fr")).toBe(false);
    expect(isAllowedLanguage({ code: "ja" })).toBe(false);
  });

  it("provides native labels and readable direction text", () => {
    expect(getLanguage("vi").nativeName).toBe("Tiếng Việt");
    expect(languagePairLabel("ja", "en")).toBe("日本語 → English");
  });
});
