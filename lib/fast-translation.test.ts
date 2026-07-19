import { describe, expect, it } from "vitest";
import type { AutomaticTranslationOutput } from "./serial-translation";
import { assessFastTranslation } from "./fast-translation";

const safe: AutomaticTranslationOutput = {
  detectedLanguage: "zh",
  sourceText: "我从昨天就开始牙疼。",
  translatedText: "昨日から歯が痛いです。",
  criticalInformation: {
    bodyPart: "tooth",
    symptom: "pain",
    timing: "since yesterday",
    toothNumber: null,
    side: null,
    medication: null,
    allergy: null,
    dosage: null,
  },
  needsConfirmation: false,
  confidence: "high",
};

describe("fast translation safety gate", () => {
  it("approves an exact-source translation with preserved protected facts", () => {
    expect(assessFastTranslation(safe.sourceText, safe, "zh")).toEqual({
      passed: true,
      issues: [],
      targetLanguage: "ja",
    });
  });

  it("rejects source rewrites and dangerous medical changes", () => {
    expect(assessFastTranslation("我从昨天就开始牙疼。", {
      ...safe,
      sourceText: "我肚子疼。",
      translatedText: "昨日からお腹が痛いです。",
    }, "zh").passed).toBe(false);

    const dosage = assessFastTranslation("一天服用三次。", {
      ...safe,
      sourceText: "一天服用三次。",
      translatedText: "一日一回服用してください。",
      criticalInformation: { ...safe.criticalInformation, dosage: "three times a day" },
    }, "zh");
    expect(dosage.passed).toBe(false);
    expect(dosage.issues).toContain("数字・回数・歯の番号が原文と一致しません");
  });

  it("rejects uncertain output and third languages", () => {
    expect(assessFastTranslation(safe.sourceText, {
      ...safe,
      detectedLanguage: "unknown",
      confidence: "low",
      needsConfirmation: true,
    }, "zh").passed).toBe(false);
  });

  it("explains a cut-off sentence without inventing a translation", () => {
    const result = assessFastTranslation("医生，我昨晚那个牙有点。", {
      ...safe,
      sourceText: "医生，我昨晚那个牙有点。",
      translatedText: "",
      needsConfirmation: true,
      confidence: "low",
    }, "zh");
    expect(result.passed).toBe(false);
    expect(result.issues).toEqual([
      "原文が途中で切れた可能性があります。短く区切ってもう一度話してください",
    ]);
  });

  it("accepts equivalent Japanese and English negation", () => {
    const sourceText = "いいえ、英語を話せません。";
    expect(assessFastTranslation(sourceText, {
      ...safe,
      detectedLanguage: "ja",
      sourceText,
      translatedText: "No, I cannot speak English.",
      criticalInformation: {
        bodyPart: null,
        symptom: null,
        timing: null,
        toothNumber: null,
        side: null,
        medication: null,
        allergy: null,
        dosage: null,
      },
    }, "en")).toEqual({
      passed: true,
      issues: [],
      targetLanguage: "en",
    });
  });
});
