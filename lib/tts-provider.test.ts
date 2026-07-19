import { describe, expect, it } from "vitest";
import { canPlayCheckedTranslation, getOpenAiTtsModel, getTtsProvider } from "./tts-provider";

describe("checked TTS gate", () => {
  it("uses native speech by default and maps only supported optional providers", () => {
    expect(getTtsProvider(undefined)).toBe("native");
    expect(getTtsProvider("unsupported")).toBe("native");
    expect(getOpenAiTtsModel("openai-hd")).toBe("tts-1-hd");
    expect(getOpenAiTtsModel("openai-fast")).toBe("tts-1");
    expect(getOpenAiTtsModel("native")).toBeNull();
  });

  it("allows TTS only after an independent pass with an approval token", () => {
    expect(canPlayCheckedTranslation({ reviewPassed: true, translatedText: "検査済み", speechToken: "signed" })).toBe(true);
    expect(canPlayCheckedTranslation({ reviewPassed: false, translatedText: "誤訳", speechToken: "signed" })).toBe(false);
    expect(canPlayCheckedTranslation({ reviewPassed: true, translatedText: "誤訳" })).toBe(false);
    expect(canPlayCheckedTranslation({ reviewPassed: true, translatedText: "", speechToken: "signed" })).toBe(false);
  });
});
