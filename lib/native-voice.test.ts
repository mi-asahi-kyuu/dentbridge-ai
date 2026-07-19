import { describe, expect, it } from "vitest";
import {
  isNoveltyNativeVoice,
  NATIVE_SPEECH_RATE,
  scoreNativeVoice,
  selectNativeVoice,
} from "./native-voice";

type TestVoice = Pick<
  SpeechSynthesisVoice,
  "default" | "lang" | "localService" | "name" | "voiceURI"
>;

function voice(overrides: Partial<TestVoice> = {}): TestVoice {
  return {
    default: false,
    lang: "ja-JP",
    localService: true,
    name: "Kyoko",
    voiceURI: "com.apple.voice.compact.ja-JP.Kyoko",
    ...overrides,
  };
}

describe("native voice selection", () => {
  it("never selects the device default from the wrong language", () => {
    const japaneseDefault = voice({ default: true });
    const chinese = voice({
      lang: "zh-CN",
      name: "Ting-Ting",
      voiceURI: "com.apple.voice.compact.zh-CN.Ting-Ting",
    });

    expect(selectNativeVoice([japaneseDefault, chinese], "zh-CN")).toBe(chinese);
    expect(scoreNativeVoice(japaneseDefault, "zh-CN")).toBe(Number.NEGATIVE_INFINITY);
  });

  it("normalizes Safari locale underscores", () => {
    const chinese = voice({ lang: "zh_CN", name: "Ting-Ting" });

    expect(selectNativeVoice([chinese], "zh-CN")).toBe(chinese);
  });

  it("keeps Safari's first exact-locale voice instead of switching pronunciation models", () => {
    const compact = voice();
    const enhanced = voice({
      name: "Kyoko (Enhanced)",
      voiceURI: "com.apple.voice.enhanced.ja-JP.Kyoko",
    });

    expect(selectNativeVoice([compact, enhanced], "ja-JP")).toBe(compact);
  });

  it("keeps stable browser order for otherwise equal voices", () => {
    const remote = voice({ localService: false, name: "Remote" });
    const local = voice({ name: "Local" });
    const systemDefault = voice({ default: true, localService: false, name: "Default" });

    expect(selectNativeVoice([remote, local], "ja-JP")).toBe(remote);
    expect(selectNativeVoice([local, systemDefault], "ja-JP")).toBe(local);
  });

  it("avoids novelty voices even when one is the exact default", () => {
    const whisper = voice({
      default: true,
      name: "Whisper",
      voiceURI: "com.apple.speech.synthesis.voice.Whisper",
    });
    const normalRegionalFallback = voice({
      lang: "ja",
      name: "Otoya",
      voiceURI: "com.apple.voice.compact.ja-JP.Otoya",
    });

    expect(isNoveltyNativeVoice(whisper)).toBe(true);
    expect(selectNativeVoice([whisper, normalRegionalFallback], "ja-JP"))
      .toBe(normalRegionalFallback);
    expect(selectNativeVoice([whisper], "ja-JP")).toBeUndefined();
  });

  it("keeps the previously field-tested speech rate", () => {
    expect(NATIVE_SPEECH_RATE).toBe(0.92);
  });
});
