/**
 * Terms that require explicit human confirmation. Keep this file independent
 * from UI code so clinics can review and extend it before field use.
 */
export const MEDICAL_CONFIRMATION_TERMS = {
  ja: [
    "アレルギー",
    "薬",
    "薬剤",
    "抗凝固薬",
    "血液さらさら",
    "妊娠",
    "麻酔",
    "用量",
    "投与量",
    "抜歯",
    "手術",
    "インプラント",
    "費用",
    "料金",
    "リスク",
    "危険",
    "右",
    "左",
    "歯式",
    "歯番号",
    "歯の番号",
    "歯痛",
    "歯が痛",
  ],
  zh: [
    "过敏",
    "藥物",
    "药物",
    "抗凝血药",
    "抗凝血藥",
    "怀孕",
    "懷孕",
    "麻醉",
    "剂量",
    "劑量",
    "拔牙",
    "手术",
    "手術",
    "种植牙",
    "植牙",
    "费用",
    "費用",
    "风险",
    "風險",
    "左边",
    "右边",
    "左右",
    "牙齿编号",
    "牙齒編號",
    "牙疼",
    "牙痛",
  ],
  en: [
    "allergy",
    "allergic",
    "medicine",
    "medication",
    "drug",
    "anticoagulant",
    "blood thinner",
    "pregnant",
    "pregnancy",
    "anesthesia",
    "anaesthesia",
    "dose",
    "dosage",
    "extraction",
    "surgery",
    "operation",
    "implant",
    "cost",
    "fee",
    "risk",
    "left",
    "right",
    "tooth number",
    "toothache",
    "tooth hurts",
  ],
} as const;

const NUMBER_PATTERN = /(?:^|[^\p{L}])\d+(?:[.,]\d+)?(?:[^\p{L}]|$)/u;
const DATE_PATTERN = /(?:\d{1,4}[\s/.-](?:\d{1,2})[\s/.-](?:\d{1,4})|\d{1,2}\s*(?:月|日|年)|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2})/iu;

export type SafetyMatch = {
  requiresConfirmation: boolean;
  matches: string[];
};

export function findSafetyTerms(text: string): SafetyMatch {
  const normalized = text.toLocaleLowerCase();
  const matches: string[] = Object.values(MEDICAL_CONFIRMATION_TERMS)
    .flat()
    .filter((term) => normalized.includes(term.toLocaleLowerCase()));

  if (NUMBER_PATTERN.test(text)) matches.push("数字 / number");
  if (DATE_PATTERN.test(text)) matches.push("日期 / date");

  return {
    requiresConfirmation: matches.length > 0,
    matches: [...new Set(matches)],
  };
}
