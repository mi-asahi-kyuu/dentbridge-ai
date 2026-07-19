import type { LanguageCode } from "./languages";

type Concept = {
  label: string;
  terms: Record<LanguageCode, readonly string[]>;
};

const PROTECTED_CONCEPTS: readonly Concept[] = [
  {
    label: "歯痛 / tooth pain",
    terms: {
      ja: ["歯が痛", "歯の痛", "歯痛", "奥歯が痛"],
      zh: ["牙疼", "牙痛", "牙齿疼", "牙齒疼", "牙齿痛", "牙齒痛"],
      en: ["toothache", "tooth hurts", "tooth has hurt", "tooth pain", "tooth is hurting"],
      ko: ["치통", "이가 아", "치아가 아"],
      vi: ["đau răng", "răng bị đau"],
    },
  },
  {
    label: "歯 / tooth",
    terms: {
      ja: ["歯", "歯牙", "奥歯"],
      zh: ["牙", "牙齿", "牙齒"],
      en: ["tooth", "teeth", "molar"],
      ko: ["치아", "이빨", "어금니"],
      vi: ["răng"],
    },
  },
  {
    label: "腹部 / abdomen",
    terms: {
      ja: ["お腹", "腹部", "胃"],
      zh: ["肚子", "腹部", "胃"],
      en: ["abdomen", "stomach", "belly"],
      ko: ["복부", "배가", "위장"],
      vi: ["bụng", "dạ dày"],
    },
  },
  {
    label: "アレルギー / allergy",
    terms: {
      ja: ["アレルギー"],
      zh: ["过敏", "過敏"],
      en: ["allergy", "allergic"],
      ko: ["알레르기"],
      vi: ["dị ứng"],
    },
  },
  {
    label: "薬 / medication",
    terms: {
      ja: ["薬", "薬剤", "抗凝固", "ペニシリン"],
      zh: ["药", "藥", "药物", "藥物", "抗凝", "青霉素"],
      en: ["medicine", "medication", "drug", "blood thinner", "penicillin"],
      ko: ["약", "약물", "항응고", "페니실린"],
      vi: ["thuốc", "chống đông", "penicillin"],
    },
  },
] as const;

const LATERALITY: Record<"left" | "right", Record<LanguageCode, readonly string[]>> = {
  left: {
    ja: ["左"], zh: ["左"], en: ["left"], ko: ["왼쪽", "좌측"], vi: ["trái"],
  },
  right: {
    ja: ["右"], zh: ["右"], en: ["right"], ko: ["오른쪽", "우측"], vi: ["phải"],
  },
};

const NEGATION: Record<LanguageCode, readonly string[]> = {
  ja: [
    "いいえ",
    "ない",
    "なく",
    "なかった",
    "おらず",
    "ません",
    "ありません",
    "ありませんでした",
    "効いていません",
    "なし",
  ],
  zh: ["没有", "沒有", "没", "不", "未"],
  en: ["not", "no", "never", "cannot", "without", "none", "neither"],
  ko: ["없", "않", "아니", "아니요"],
  vi: ["không", "chưa"],
};

type PoliteEquivalence = "apology" | "reassurance";

/**
 * Some ordinary courtesy phrases contain characters or words that are also
 * used for medical negation (for example Chinese 对不起 and 没关系). They are
 * neutralized only when both sides contain the same courtesy concept. This
 * keeps a real negation in a sentence such as "对不起，我没有过敏" protected.
 */
const POLITE_EQUIVALENTS: Record<
  PoliteEquivalence,
  Record<LanguageCode, readonly string[]>
> = {
  apology: {
    ja: ["ごめんなさい", "すみません", "申し訳ありません", "申し訳ございません"],
    zh: ["对不起", "對不起", "不好意思"],
    en: ["sorry", "excuse me"],
    ko: ["죄송합니다", "미안합니다"],
    vi: ["xin lỗi"],
  },
  reassurance: {
    ja: ["大丈夫ですよ", "大丈夫です", "大丈夫"],
    zh: ["没有关系", "沒有關係", "没关系", "沒關係", "没问题", "沒問題", "没事", "沒事"],
    en: ["no problem", "that's okay", "that is okay", "it's okay", "it is okay", "take your time"],
    ko: ["괜찮습니다", "괜찮아요"],
    vi: ["không sao", "ổn mà"],
  },
};

const NUMBER_TERMS: Record<string, Record<LanguageCode, readonly string[]>> = {
  "1": { ja: ["一", "１"], zh: ["一", "１"], en: ["one", "once", "first"], ko: ["일", "한 번", "첫"], vi: ["một", "lần một"] },
  "2": { ja: ["二", "２"], zh: ["二", "两", "兩", "２"], en: ["two", "twice", "second"], ko: ["이", "두 번", "둘째"], vi: ["hai", "lần hai"] },
  "3": { ja: ["三", "３"], zh: ["三", "３"], en: ["three", "thrice", "third"], ko: ["삼", "세 번", "셋째"], vi: ["ba", "lần ba"] },
  "4": { ja: ["四", "４"], zh: ["四", "４"], en: ["four", "fourth"], ko: ["사", "네 번", "넷째"], vi: ["bốn", "lần bốn"] },
  "5": { ja: ["五", "５"], zh: ["五", "５"], en: ["five", "fifth"], ko: ["오", "다섯"], vi: ["năm", "lần năm"] },
  "6": { ja: ["六", "６"], zh: ["六", "６"], en: ["six", "sixth"], ko: ["육", "여섯"], vi: ["sáu", "lần sáu"] },
  "7": { ja: ["七", "７"], zh: ["七", "７"], en: ["seven", "seventh"], ko: ["칠", "일곱"], vi: ["bảy", "lần bảy"] },
  "8": { ja: ["八", "８"], zh: ["八", "８"], en: ["eight", "eighth"], ko: ["팔", "여덟"], vi: ["tám", "lần tám"] },
  "9": { ja: ["九", "９"], zh: ["九", "９"], en: ["nine", "ninth"], ko: ["구", "아홉"], vi: ["chín", "lần chín"] },
  "10": { ja: ["十", "１０"], zh: ["十", "１０"], en: ["ten", "tenth"], ko: ["십", "열"], vi: ["mười", "lần mười"] },
};

function normalize(text: string) {
  return ` ${text.normalize("NFKC").toLocaleLowerCase()} `;
}

function includesAny(text: string, terms: readonly string[]) {
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(term.toLocaleLowerCase()));
}

function removeTerms(text: string, terms: readonly string[]) {
  let result = text;
  for (const term of [...terms].sort((first, second) => second.length - first.length)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "giu"), " ");
  }
  return result;
}

function neutralizeSharedPoliteness(
  sourceText: string,
  sourceLanguage: LanguageCode,
  translatedText: string,
  targetLanguage: LanguageCode,
) {
  let source = sourceText;
  let target = translatedText;
  for (const category of Object.keys(POLITE_EQUIVALENTS) as PoliteEquivalence[]) {
    const sourceTerms = POLITE_EQUIVALENTS[category][sourceLanguage];
    const targetTerms = POLITE_EQUIVALENTS[category][targetLanguage];
    if (includesAny(source, sourceTerms) && includesAny(target, targetTerms)) {
      source = removeTerms(source, sourceTerms);
      target = removeTerms(target, targetTerms);
    }
  }
  return { source, target };
}

function detectedNegation(text: string, language: LanguageCode) {
  const normalized = normalize(text);
  if (language === "en") {
    // English negation has many productive contractions. The former literal
    // term list missed `cannot`, so a correct Japanese `〜ません` → English
    // `cannot` translation was incorrectly blocked. Word boundaries also
    // avoid treating unrelated words such as `notable` as negation.
    return /\b(?:no|not|never|cannot|can['’]?t|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t|don['’]?t|doesn['’]?t|didn['’]?t|won['’]?t|wouldn['’]?t|couldn['’]?t|shouldn['’]?t|hasn['’]?t|haven['’]?t|hadn['’]?t|without|none|neither)\b/u
      .test(normalized);
  }
  return includesAny(text, NEGATION[language]);
}

function detectedLaterality(text: string, language: LanguageCode) {
  return (["left", "right"] as const).filter((side) => includesAny(text, LATERALITY[side][language]));
}

function detectedNumbers(text: string, language: LanguageCode) {
  let normalized = normalize(text);
  if (language === "ja") {
    // 一番/1番 is frequently a superlative (一番気になる, 一番痛い), which
    // correctly translates to Chinese 最 without a numeric token. Preserve
    // actual tooth ordinals such as 1番の歯 and 一番目の歯.
    normalized = normalized.replace(
      /(?:一|1|１)番(?!\s*(?:の|目|歯|歯牙|牙|番号|号))/gu,
      " ",
    );
  }
  const numbers = new Set<string>();
  for (const match of normalized.matchAll(/\d+(?:[.,]\d+)?/g)) numbers.add(match[0]);
  if (language === "ja" || language === "zh") {
    const cjkNumbers: Record<string, string> = {
      一: "1", 二: "2", 两: "2", 兩: "2", 三: "3", 四: "4",
      五: "5", 六: "6", 七: "7", 八: "8", 九: "9", 十: "10",
    };
    for (const match of normalized.matchAll(
      /([一二两兩三四五六七八九])(?:[、,，~〜～\-至到]?)([一二两兩三四五六七八九])(?=[日天回次颗顆号號番本錠粒片])/gu,
    )) {
      numbers.add(cjkNumbers[match[1]]);
      numbers.add(cjkNumbers[match[2]]);
    }
  }
  for (const [number, terms] of Object.entries(NUMBER_TERMS)) {
    const found = terms[language].some((term) => {
      const escaped = term.toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (language === "en" || language === "vi") {
        return new RegExp(`\\b${escaped}\\b`, "u").test(normalized);
      }
      if (language === "ja" || language === "zh") {
        return new RegExp(`(?:第${escaped}|${escaped}(?=[日天回次颗顆号號番本錠粒片毫升升克]))`, "u").test(normalized);
      }
      return normalized.includes(term.toLocaleLowerCase());
    });
    if (found) numbers.add(number);
  }
  return [...numbers].sort();
}

function isPoliteLookRequest(text: string, language: LanguageCode) {
  const normalized = normalize(text);
  const patterns: Record<LanguageCode, RegExp> = {
    ja: /(?:一回|一度).{0,8}(?:見せて|見て|確認させて)/u,
    zh: /(?:请|請)?(?:让我|讓我)?(?:看|看看|看一下|看一看|给我看|給我看)(?:一下|一看)?/u,
    en: /\b(?:let me (?:see|look|take a look)|show me|take a look)\b/u,
    ko: /(?:한\s*번.{0,8}보여|보여\s*주세요)/u,
    vi: /(?:cho tôi xem|xem một chút)/u,
  };
  return patterns[language].test(normalized);
}

export type TranslationConsistency = {
  mismatch: boolean;
  reasons: string[];
};

export function checkTranslationConsistency(
  sourceText: string,
  sourceLanguage: LanguageCode,
  translatedText: string,
  targetLanguage: LanguageCode,
): TranslationConsistency {
  if (!sourceText.trim() || !translatedText.trim()) {
    return { mismatch: true, reasons: ["原文または訳文が空です"] };
  }

  const reasons: string[] = [];
  const sourceHasTooth = includesAny(sourceText, PROTECTED_CONCEPTS[1].terms[sourceLanguage]);
  const targetHasAbdomen = includesAny(translatedText, PROTECTED_CONCEPTS[2].terms[targetLanguage]);
  if (sourceHasTooth && targetHasAbdomen) {
    reasons.push("身体部位が歯から腹部・胃に変わっています");
  }
  for (const concept of PROTECTED_CONCEPTS) {
    const sourceHas = includesAny(sourceText, concept.terms[sourceLanguage]);
    const targetHas = includesAny(translatedText, concept.terms[targetLanguage]);
    if (sourceHas && !targetHas) reasons.push(`${concept.label} が訳文から欠落しています`);
    if (!sourceHas && targetHas) reasons.push(`${concept.label} が訳文に追加されています`);
  }

  const sourceSides = detectedLaterality(sourceText, sourceLanguage);
  const targetSides = detectedLaterality(translatedText, targetLanguage);
  if (sourceSides.join() !== targetSides.join()) reasons.push("左右方向が原文と一致しません");

  const neutralized = neutralizeSharedPoliteness(
    sourceText,
    sourceLanguage,
    translatedText,
    targetLanguage,
  );
  const sourceNegative = detectedNegation(neutralized.source, sourceLanguage);
  const targetNegative = detectedNegation(neutralized.target, targetLanguage);
  if (sourceNegative !== targetNegative) reasons.push("否定表現が原文と一致しません");

  let sourceNumbers = detectedNumbers(sourceText, sourceLanguage);
  let targetNumbers = detectedNumbers(translatedText, targetLanguage);
  if (
    isPoliteLookRequest(sourceText, sourceLanguage) &&
    isPoliteLookRequest(translatedText, targetLanguage)
  ) {
    sourceNumbers = sourceNumbers.filter((number) => number !== "1");
    targetNumbers = targetNumbers.filter((number) => number !== "1");
  }
  if (sourceNumbers.join() !== targetNumbers.join()) reasons.push("数字・回数・歯の番号が原文と一致しません");

  return { mismatch: reasons.length > 0, reasons: [...new Set(reasons)] };
}
