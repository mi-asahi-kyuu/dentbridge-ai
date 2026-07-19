import { describe, expect, it } from "vitest";
import { getCriticalConfirmationContent } from "./critical-confirmation";
import type { CriticalInformation } from "./serial-translation";

const information: CriticalInformation = {
  bodyPart: null,
  symptom: "no swelling; dull aching sensation",
  timing: "2 to 3 days ago",
  toothNumber: null,
  side: null,
  medication: null,
  allergy: null,
  dosage: null,
};

describe("critical confirmation display", () => {
  it("shows bilingual field names without exposing internal English values", () => {
    const content = getCriticalConfirmationContent(information, "zh");
    expect(content.japaneseLabels).toEqual(["症状", "時期"]);
    expect(content.patientLabels).toEqual(["症状", "时间"]);
    expect(JSON.stringify(content)).not.toContain("no swelling");
    expect(JSON.stringify(content)).not.toContain("2 to 3 days ago");
  });

  it("uses the selected patient language", () => {
    expect(getCriticalConfirmationContent(information, "ko").patientLabels)
      .toEqual(["증상", "시기"]);
    expect(getCriticalConfirmationContent(information, "vi").patientLabels)
      .toEqual(["Triệu chứng", "Thời điểm"]);
  });
});
