import { describe, expect, it } from "vitest";
import {
  buildAutomaticReviewRequest,
  buildAutomaticTranslationRequest,
  buildFastAutomaticTranslationRequest,
  compareCriticalInformation,
  extractResponseText,
  parseAutomaticReviewOutput,
  parseAutomaticTranslationOutput,
  type AutomaticTranslationOutput,
} from "./serial-translation";

const criticalInformation = {
  bodyPart: "tooth",
  symptom: "pain",
  timing: "since yesterday",
  toothNumber: null,
  side: null,
  medication: null,
  allergy: null,
  dosage: null,
};

const translation: AutomaticTranslationOutput = {
  detectedLanguage: "zh",
  sourceText: "我从昨天就开始牙疼。",
  translatedText: "昨日から歯が痛いです。",
  criticalInformation,
  needsConfirmation: false,
  confidence: "high",
};

describe("automatic dental translation requests", () => {
  it("uses GPT-5.6 Structured Outputs and automatically constrains the language pair", () => {
    const request = buildAutomaticTranslationRequest(translation.sourceText, "zh");
    expect(request.model).toBe("gpt-5.6");
    expect(request.store).toBe(false);
    expect(request.prompt_cache_key).toBe("dentbridge-translation-v2-zh");
    expect(request.reasoning.effort).toBe("none");
    expect(request.text.verbosity).toBe("low");
    expect(request.max_output_tokens).toBe(480);
    expect(request.instructions).toContain("Chinese 牙/牙齿/牙疼/牙痛");
    expect(request.instructions).toContain("从里面数第三颗");
    expect(request.instructions).toContain("内側から数えて3本目");
    expect(request.instructions).toContain("Chinese 饿了 means hungry");
    expect(request.instructions).toContain("Japanese 一回見せてください");
    expect(request.instructions).toContain("两三天前");
    expect(request.instructions).toContain("2～3日前");
    expect(request.instructions).toContain("酸っぱい");
    expect(request.instructions).toContain("symptom exactly cold sensitivity");
    expect(request.instructions).toContain("timing exactly onset and duration question");
    expect(request.instructions).toContain("ジーンとした感じ=lingering aching sensation");
    expect(request.instructions).toContain("Translate only");
    expect(request.instructions).toContain("final literal self-check");
    expect(request.text.format.strict).toBe(true);
    expect(request.text.format.schema.properties.detectedLanguage.enum).toEqual(["ja", "zh", "unknown"]);
  });

  it("creates a separate literal safety review that names the required failure cases", () => {
    const request = buildAutomaticReviewRequest(translation, "zh");
    expect(request.model).toBe("gpt-5.6");
    expect(request.reasoning.effort).toBe("none");
    expect(request.prompt_cache_key).toBe("dentbridge-review-v2-zh");
    expect(request.text.verbosity).toBe("low");
    expect(request.instructions).toContain("second, independent medical translation safety reviewer");
    expect(request.instructions).toContain("tooth pain changed to abdominal pain");
    expect(request.instructions).toContain("three times changed to once");
    expect(request.instructions).toContain("tooth six changed to tooth nine");
    expect(request.instructions).toContain("里面 must remain inner side/内側");
    expect(request.instructions).toContain("inside and inner side as the same canonical location");
    expect(request.instructions).toContain("Reject お腹が空きました");
    expect(request.instructions).toContain("ordinary viewing request");
    expect(request.instructions).toContain("same approximate range");
    expect(request.instructions).toContain("negative swelling fact");
    expect(request.instructions).toContain("Canonical extraction rule");
  });

  it("keeps the FAST pipeline on GPT-5.6 while skipping the second model review", () => {
    const request = buildFastAutomaticTranslationRequest(translation.sourceText, "zh");
    expect(request.model).toBe("gpt-5.6");
    expect(request.store).toBe(false);
    expect("reasoning" in request).toBe(false);
    expect(request.prompt_cache_key).toBe("dentbridge-fast-translation-v2-zh");
    expect(request.max_output_tokens).toBe(480);
    expect(request.text.verbosity).toBe("low");
    expect(request.instructions).toContain("Determine detectedLanguage independently");
    expect(request.instructions).toContain("Never guess or complete a cut-off sentence");
    expect(request.text.format.strict).toBe(true);
  });

  it("extracts Responses API output text", () => {
    expect(extractResponseText({ output_text: "direct" })).toBe("direct");
    expect(extractResponseText({
      output: [{ content: [{ type: "output_text", text: "nested" }] }],
    })).toBe("nested");
  });

  it("parses strict translation and review results", () => {
    expect(parseAutomaticTranslationOutput(JSON.stringify(translation), "zh")).toEqual(translation);
    expect(parseAutomaticReviewOutput(JSON.stringify({
      passed: true,
      issues: [],
      checkedCriticalInformation: criticalInformation,
    }))).toEqual({ passed: true, issues: [], checkedCriticalInformation: criticalInformation });
  });

  it("rejects malformed or out-of-pair structured output", () => {
    expect(parseAutomaticTranslationOutput("not json", "zh")).toBeNull();
    expect(parseAutomaticTranslationOutput(JSON.stringify({ ...translation, detectedLanguage: "en" }), "zh")).toBeNull();
    expect(parseAutomaticReviewOutput(JSON.stringify({ passed: true }))).toBeNull();
  });

  it("fails when independently extracted critical information changes", () => {
    expect(compareCriticalInformation(
      criticalInformation,
      { ...criticalInformation, bodyPart: "abdomen" },
    )).toContain("身体部位の抽出結果が一致しません");
  });

  it("accepts equivalent canonical wording without weakening medical distinctions", () => {
    const first = {
      ...criticalInformation,
      toothNumber: "third counting from inside",
      side: "upper and inner side",
    };
    const equivalent = {
      ...criticalInformation,
      toothNumber: "third counting from inner side",
      side: "upper, inner side",
    };
    expect(compareCriticalInformation(first, equivalent)).toEqual([]);
    expect(compareCriticalInformation(first, { ...equivalent, side: "upper, outer side" }))
      .toContain("左右・位置の抽出結果が一致しません");
    expect(compareCriticalInformation(first, { ...equivalent, toothNumber: "ninth counting from inner side" }))
      .toContain("歯の番号の抽出結果が一致しません");
  });

  it("canonicalizes an approximate two-to-three-day timing range", () => {
    expect(compareCriticalInformation(
      { ...criticalInformation, timing: "2 or 3 days ago" },
      { ...criticalInformation, timing: "2 to 3 days ago" },
    )).toEqual([]);
  });

  it("accepts equivalent cold-sensitivity and onset-question extractions", () => {
    const first = {
      ...criticalInformation,
      symptom: "sensitivity to cold",
      timing: "asking when it started and how long it has continued",
    };
    const equivalent = {
      ...criticalInformation,
      symptom: "cold-triggered sensitivity or sharp discomfort",
      timing: "onset and duration question",
    };
    expect(compareCriticalInformation(first, equivalent)).toEqual([]);
  });

  it("still rejects changed temperature and concrete timing answers", () => {
    const first = {
      ...criticalInformation,
      symptom: "sensitivity to cold",
      timing: "onset and duration question",
    };
    expect(compareCriticalInformation(first, {
      ...first,
      symptom: "sensitivity to heat",
    })).toContain("症状の抽出結果が一致しません");
    expect(compareCriticalInformation(first, {
      ...first,
      timing: "since yesterday",
    })).toContain("時期の抽出結果が一致しません");
  });

  it("accepts equivalent multi-symptom wording from a dental pain interview", () => {
    const first = {
      ...criticalInformation,
      symptom: "sensitivity; throbbing pain or lingering dull pain; pain waking patient at night",
      timing: "onset and duration question; nighttime",
    };
    const equivalent = {
      ...criticalInformation,
      symptom: "sensitivity; throbbing pain or lingering numb aching sensation; pain waking patient at night",
      timing: "onset and duration question; nighttime",
    };
    expect(compareCriticalInformation(first, equivalent)).toEqual([]);
  });

  it("does not treat a redundant question label as a different symptom", () => {
    const first = {
      ...criticalInformation,
      symptom: "sensitivity question; throbbing pain or lingering aching sensation question; pain waking patient at night question",
    };
    const equivalent = {
      ...criticalInformation,
      symptom: "sensitivity; throbbing pain or lingering aching sensation; pain waking patient at night",
    };
    expect(compareCriticalInformation(first, equivalent)).toEqual([]);
  });

  it("still rejects an omitted symptom from a multi-symptom interview", () => {
    const first = {
      ...criticalInformation,
      symptom: "sensitivity; throbbing pain or lingering aching sensation; pain waking patient at night",
    };
    const missingNightPain = {
      ...criticalInformation,
      symptom: "sensitivity; throbbing pain or lingering aching sensation",
    };
    expect(compareCriticalInformation(first, missingNightPain))
      .toContain("症状の抽出結果が一致しません");
  });
});
