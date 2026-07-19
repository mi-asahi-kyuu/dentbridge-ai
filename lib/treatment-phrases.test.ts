import { describe, expect, it } from "vitest";
import {
  matchTreatmentCommand,
  matchTreatmentPhrase,
  REPEAT_PROMPTS,
  TREATMENT_GESTURE_GUIDANCE,
  TREATMENT_MODE_MESSAGES,
  TREATMENT_PHRASES,
  transitionTreatmentSessionMode,
} from "./treatment-phrases";

describe("reviewed treatment mode phrases", () => {
  it("matches only explicit reviewed Japanese setup commands", () => {
    expect(matchTreatmentCommand("治療を始めます。" )).toBe("start");
    expect(matchTreatmentCommand("手の合図を確認しました。" )).toBe("confirm");
    expect(matchTreatmentCommand(" 合図を確認しました！" )).toBe("confirm");
    expect(matchTreatmentCommand("治療を終了します" )).toBe("end");
    expect(matchTreatmentCommand("はい" )).toBeNull();
    expect(matchTreatmentCommand("確認します" )).toBeNull();
    expect(matchTreatmentCommand("Start treatment" )).toBeNull();
  });

  it("requires hand-signal confirmation before treatment mode", () => {
    expect(transitionTreatmentSessionMode("conversation", "start")).toBe("gesture-confirmation");
    expect(transitionTreatmentSessionMode("conversation", "confirm")).toBeNull();
    expect(transitionTreatmentSessionMode("gesture-confirmation", "confirm")).toBe("treatment");
    expect(transitionTreatmentSessionMode("gesture-confirmation", "end")).toBe("conversation");
    expect(transitionTreatmentSessionMode("treatment", "end")).toBe("conversation");
  });

  it("provides complete hand-signal guidance for every patient language", () => {
    expect(TREATMENT_GESTURE_GUIDANCE.japanese.instruction).toContain("手をはっきり上げてください");
    expect(TREATMENT_GESTURE_GUIDANCE.japanese.observation).toContain("自動検出しません");
    expect(TREATMENT_GESTURE_GUIDANCE.patients.zh.instruction).toContain("立即停止治疗");
    expect(TREATMENT_GESTURE_GUIDANCE.patients.zh.observation).toContain("不会自动识别");
    expect(TREATMENT_GESTURE_GUIDANCE.patients.en.instruction).toContain("raise whichever hand");
    for (const guidance of Object.values(TREATMENT_GESTURE_GUIDANCE.patients)) {
      expect(guidance.title).toBeTruthy();
      expect(Array.from(guidance.instruction).length).toBeGreaterThan(40);
      expect(guidance.observation).toBeTruthy();
      expect(guidance.reminder).toBeTruthy();
    }
    for (const message of Object.values(TREATMENT_MODE_MESSAGES.start)) {
      expect(message).toBeTruthy();
    }
  });

  it("contains all ten reviewed phrases with every patient language", () => {
    expect(TREATMENT_PHRASES).toHaveLength(10);
    for (const phrase of TREATMENT_PHRASES) {
      expect(phrase.translations.zh).toBeTruthy();
      expect(phrase.translations.en).toBeTruthy();
      expect(phrase.translations.ko).toBeTruthy();
      expect(phrase.translations.vi).toBeTruthy();
    }
  });

  it("does not match arbitrary treatment-room background speech", () => {
    expect(matchTreatmentPhrase("今日は大きな音がします" )).toBeNull();
    expect(matchTreatmentPhrase("口を開けてください" )?.id).toBe("open-mouth");
  });

  it("keeps the automatic repeat prompt short for low-latency native TTS", () => {
    expect(REPEAT_PROMPTS.zh).toBe("没有听清，请再说一遍。");
    for (const prompt of Object.values(REPEAT_PROMPTS)) {
      expect(Array.from(prompt).length).toBeLessThanOrEqual(28);
    }
  });
});
