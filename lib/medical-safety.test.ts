import { describe, expect, it } from "vitest";
import { findSafetyTerms } from "./medical-safety";

describe("medical confirmation detection", () => {
  it.each([
    "右上の歯に麻酔をします",
    "我对这种药物过敏",
    "I take an anticoagulant every day",
  ])("flags safety-sensitive multilingual text: %s", (text) => {
    expect(findSafetyTerms(text).requiresConfirmation).toBe(true);
  });

  it("flags numbers and dates", () => {
    expect(findSafetyTerms("歯の番号は16です").requiresConfirmation).toBe(true);
    expect(findSafetyTerms("Next visit is March 12").matches).toContain("日期 / date");
  });

  it("flags explicit tooth pain for human confirmation", () => {
    expect(findSafetyTerms("我从昨天就开始牙疼").matches).toContain("牙疼");
    expect(findSafetyTerms("My tooth hurts").matches).toContain("tooth hurts");
  });

  it("does not flag ordinary low-risk text", () => {
    expect(findSafetyTerms("口をゆっくり開けてください")).toEqual({
      requiresConfirmation: false,
      matches: [],
    });
  });
});
