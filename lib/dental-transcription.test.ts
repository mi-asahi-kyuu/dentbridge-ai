import { describe, expect, it } from "vitest";
import {
  assessTranscriptionCandidate,
  DENTAL_TRANSCRIPTION_PROMPTS,
  normalizeDentalTranscript,
  selectTranscriptionCandidate,
  transcriptionCandidateLanguages,
  transcriptionCandidateScore,
} from "./dental-transcription";

describe("dental transcription accuracy", () => {
  it("provides same-language dental vocabulary prompts", () => {
    expect(DENTAL_TRANSCRIPTION_PROMPTS.zh).toContain("没有清晰人声时不输出任何文字");
    expect(DENTAL_TRANSCRIPTION_PROMPTS.zh).toContain("保留轻声说出的句尾症状词");
    expect(DENTAL_TRANSCRIPTION_PROMPTS.ja).toContain("明瞭な人の発話がない場合は何も出力しません");
    expect(DENTAL_TRANSCRIPTION_PROMPTS.en).toContain("no clear human speech");
    expect(DENTAL_TRANSCRIPTION_PROMPTS.en).not.toContain("three times a day");
  });

  it("conservatively fixes the observed Chinese dental homophones", () => {
    expect(normalizeDentalTranscript("上面的呀，从里面数第三棵。", "zh"))
      .toBe("上面的牙，从里面数第三颗。");
  });

  it("does not rewrite ordinary Chinese uses of 呀 or 棵", () => {
    expect(normalizeDentalTranscript("上面的风景好漂亮呀。", "zh"))
      .toBe("上面的风景好漂亮呀。");
    expect(normalizeDentalTranscript("从里面数第三棵树。", "zh"))
      .toBe("从里面数第三棵树。");
  });

  it("selects the candidate with stronger confidence and matching script", () => {
    const chinese = {
      language: "zh" as const,
      text: "上面的牙，从里面数第三颗。",
      logprobs: [{ logprob: -0.02 }, { logprob: -0.03 }],
    };
    const japanese = {
      language: "ja" as const,
      text: "上の歯で、内側から数えて3本目です。",
      logprobs: [{ logprob: -0.8 }, { logprob: -0.7 }],
    };
    expect(transcriptionCandidateScore(chinese)).toBeGreaterThan(transcriptionCandidateScore(japanese));
    expect(selectTranscriptionCandidate([japanese, chinese])).toEqual(chinese);
  });

  it("rejects repeated-kana noise even when the model reports high confidence", () => {
    const repeatedNoise = {
      language: "ja" as const,
      text: "ルルルルル",
      logprobs: [{ token: "ル", logprob: -0.01 }],
    };
    expect(assessTranscriptionCandidate(repeatedNoise)).toMatchObject({
      accepted: false,
      rejectionReason: "mechanical_repetition",
    });
    expect(selectTranscriptionCandidate([repeatedNoise])).toBeNull();
  });

  it("does not reject a legitimate short dental word", () => {
    const toothpaste = {
      language: "ja" as const,
      text: "歯磨き粉",
      logprobs: [
        { token: "歯", logprob: -0.08 },
        { token: "磨き", logprob: -0.12 },
        { token: "粉", logprob: -0.06 },
      ],
    };
    expect(assessTranscriptionCandidate(toothpaste)).toMatchObject({
      accepted: true,
      rejectionReason: null,
    });
    expect(selectTranscriptionCandidate([toothpaste])).toEqual(toothpaste);
  });

  it("does not treat repeated medical numbers as mechanical syllable noise", () => {
    const toothNumber = {
      language: "en" as const,
      text: "Tooth 1111",
      logprobs: [{ token: "Tooth 1111", logprob: -0.09 }],
    };
    expect(assessTranscriptionCandidate(toothNumber).accepted).toBe(true);
  });

  it("rejects candidates without usable confidence or with very low confidence", () => {
    const missingConfidence = {
      language: "ja" as const,
      text: "テスト",
      logprobs: [],
    };
    const lowConfidence = {
      language: "en" as const,
      text: "toothpaste",
      logprobs: [{ token: "toothpaste", logprob: -2.1 }],
    };
    expect(assessTranscriptionCandidate(missingConfidence).rejectionReason)
      .toBe("missing_confidence");
    expect(assessTranscriptionCandidate(lowConfidence).rejectionReason)
      .toBe("low_confidence");
    expect(selectTranscriptionCandidate([missingConfidence, lowConfidence])).toBeNull();
  });

  it("rejects prompt-completion hallucinations with an uncertain first token", () => {
    const promptedHallucination = {
      language: "ja" as const,
      text: "右上の歯が痛いです。",
      logprobs: [
        { token: "右", logprob: -1.55 },
        { token: "上", logprob: -0.04 },
        { token: "の歯が痛いです。", logprob: -0.02 },
      ],
    };
    expect(assessTranscriptionCandidate(promptedHallucination)).toMatchObject({
      accepted: false,
      rejectionReason: "low_confidence",
    });
  });

  it("ignores a rejected noisy candidate when another language is clear", () => {
    const noise = {
      language: "ja" as const,
      text: "ルルルルル",
      logprobs: [{ token: "ル", logprob: -0.01 }],
    };
    const english = {
      language: "en" as const,
      text: "My tooth hurts.",
      logprobs: [{ token: "My tooth hurts.", logprob: -0.08 }],
    };
    expect(selectTranscriptionCandidate([noise, english])).toEqual(english);
  });

  it("rejects a second weak candidate after mechanical-noise detection", () => {
    const noise = {
      language: "ja" as const,
      text: "ルルルルル",
      logprobs: [{ token: "ル", logprob: -0.01 }],
    };
    const weakEnglishHallucination = {
      language: "en" as const,
      text: "toothpaste",
      logprobs: [{ token: "toothpaste", logprob: -0.8 }],
    };
    expect(assessTranscriptionCandidate(weakEnglishHallucination).accepted).toBe(false);
    expect(selectTranscriptionCandidate([noise, weakEnglishHallucination])).toBeNull();
  });

  it("always plans forced Japanese and patient-language candidates", () => {
    expect(transcriptionCandidateLanguages("zh")).toEqual(["ja", "zh"]);
    expect(transcriptionCandidateLanguages("en")).toEqual(["ja", "en"]);
    expect(transcriptionCandidateLanguages("ko")).toEqual(["ja", "ko"]);
    expect(transcriptionCandidateLanguages("vi")).toEqual(["ja", "vi"]);
  });
});
