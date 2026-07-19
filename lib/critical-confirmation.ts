import type { LanguageCode } from "./languages";
import type { CriticalInformation } from "./serial-translation";

type CriticalKey = keyof CriticalInformation;
type PatientLanguageCode = Exclude<LanguageCode, "ja">;

const CRITICAL_KEYS: readonly CriticalKey[] = [
  "bodyPart",
  "symptom",
  "timing",
  "toothNumber",
  "side",
  "medication",
  "allergy",
  "dosage",
];

const JAPANESE_LABELS: Record<CriticalKey, string> = {
  bodyPart: "身体部位",
  symptom: "症状",
  timing: "時期",
  toothNumber: "歯の番号",
  side: "左右・位置",
  medication: "薬",
  allergy: "アレルギー",
  dosage: "用量・回数",
};

const PATIENT_LABELS: Record<PatientLanguageCode, Record<CriticalKey, string>> = {
  zh: {
    bodyPart: "身体部位",
    symptom: "症状",
    timing: "时间",
    toothNumber: "牙齿编号",
    side: "左右位置",
    medication: "药物",
    allergy: "过敏",
    dosage: "剂量・次数",
  },
  en: {
    bodyPart: "Body part",
    symptom: "Symptom",
    timing: "Timing",
    toothNumber: "Tooth number",
    side: "Side and position",
    medication: "Medication",
    allergy: "Allergy",
    dosage: "Dosage and frequency",
  },
  ko: {
    bodyPart: "신체 부위",
    symptom: "증상",
    timing: "시기",
    toothNumber: "치아 번호",
    side: "좌우 위치",
    medication: "약",
    allergy: "알레르기",
    dosage: "용량・횟수",
  },
  vi: {
    bodyPart: "Bộ phận cơ thể",
    symptom: "Triệu chứng",
    timing: "Thời điểm",
    toothNumber: "Số răng",
    side: "Bên và vị trí",
    medication: "Thuốc",
    allergy: "Dị ứng",
    dosage: "Liều lượng và số lần",
  },
};

const PATIENT_INSTRUCTIONS: Record<PatientLanguageCode, string> = {
  zh: "请牙医和患者对照上方的原文与译文，再次确认这些内容。",
  en: "The dentist and patient must compare the source and translation above and confirm these details again.",
  ko: "치과의사와 환자가 위의 원문과 번역문을 대조하여 이 내용을 다시 확인해 주세요.",
  vi: "Nha sĩ và bệnh nhân hãy đối chiếu nguyên văn và bản dịch ở trên, rồi xác nhận lại các nội dung này.",
};

export function getCriticalConfirmationContent(
  information: CriticalInformation | undefined,
  patientLanguage: PatientLanguageCode,
) {
  const keys = information
    ? CRITICAL_KEYS.filter((key) => information[key] !== null)
    : [];
  return {
    keys,
    japaneseLabels: keys.map((key) => JAPANESE_LABELS[key]),
    patientLabels: keys.map((key) => PATIENT_LABELS[patientLanguage][key]),
    patientInstruction: PATIENT_INSTRUCTIONS[patientLanguage],
  };
}
