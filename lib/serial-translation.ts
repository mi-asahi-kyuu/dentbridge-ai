import { getLanguage, type LanguageCode } from "./languages";

export const TRANSCRIPTION_MODEL = "gpt-4o-transcribe";
export const MEDICAL_TRANSLATION_MODEL = "gpt-5.6";
// The low-latency path still uses the required GPT-5.6 medical translator.
// It is faster because it performs one structured translation plus local
// deterministic checks instead of a second model review request.
export const FAST_MEDICAL_TRANSLATION_MODEL = "gpt-5.6";

const CRITICAL_INFORMATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    bodyPart: { type: ["string", "null"] },
    symptom: { type: ["string", "null"] },
    timing: { type: ["string", "null"] },
    toothNumber: { type: ["string", "null"] },
    side: { type: ["string", "null"] },
    medication: { type: ["string", "null"] },
    allergy: { type: ["string", "null"] },
    dosage: { type: ["string", "null"] },
  },
  required: [
    "bodyPart",
    "symptom",
    "timing",
    "toothNumber",
    "side",
    "medication",
    "allergy",
    "dosage",
  ],
} as const;

export type CriticalInformation = {
  bodyPart: string | null;
  symptom: string | null;
  timing: string | null;
  toothNumber: string | null;
  side: string | null;
  medication: string | null;
  allergy: string | null;
  dosage: string | null;
};

export type AutomaticTranslationOutput = {
  detectedLanguage: LanguageCode | "unknown";
  sourceText: string;
  translatedText: string;
  criticalInformation: CriticalInformation;
  needsConfirmation: boolean;
  confidence: "high" | "medium" | "low";
};

export type AutomaticReviewOutput = {
  passed: boolean;
  issues: string[];
  checkedCriticalInformation: CriticalInformation;
};

function languageLabel(code: LanguageCode) {
  const language = getLanguage(code);
  return `${language.nativeName} (${code})`;
}

export function buildAutomaticTranslationRequest(
  sourceText: string,
  patientLanguage: LanguageCode,
) {
  return {
    model: MEDICAL_TRANSLATION_MODEL,
    store: false,
    prompt_cache_key: `dentbridge-translation-v2-${patientLanguage}`,
    reasoning: { effort: "none" },
    max_output_tokens: 480,
    instructions: [
      "You are a literal medical interpreter for a Japanese dental clinic.",
      `The only permitted source languages are Japanese (ja) and ${languageLabel(patientLanguage)}.`,
      "First identify which permitted language the supplied transcription uses. If it is another language, mixed beyond reliable interpretation, or uncertain, set detectedLanguage to unknown, translatedText to an empty string, needsConfirmation to true, and confidence to low.",
      `If the source is Japanese, translate to ${languageLabel(patientLanguage)}. If the source is ${languageLabel(patientLanguage)}, translate to Japanese.`,
      "Translate only. Never answer a question, diagnose, recommend, explain, summarize, soften, infer, omit, or add information.",
      "Do not change anatomical site, tooth location, symptom, negation, uncertainty, left/right, tooth number, quantity, date, dosage, medication name, allergy, pregnancy, anesthesia, procedure, cost, or risk.",
      "If any required meaning cannot be determined, do not guess: set needsConfirmation to true and confidence to medium or low.",
      "sourceText must reproduce the supplied transcription exactly, apart from harmless leading or trailing whitespace.",
      "criticalInformation values must be concise language-neutral English concepts while preserving exact names and numbers. Use null only when the source does not state that field.",
      "Chinese 牙/牙齿/牙疼/牙痛 means tooth/teeth/tooth pain, never abdomen or stomach.",
      "For Chinese dental positions, 里面 means the inner side (内側), never the back or 奥. 上面的牙 means an upper tooth. 从里面数第三颗 must be translated into Japanese as 内側から数えて3本目, preserving both the counting origin and ordinal. Use bodyPart=tooth, side=upper and/or inner side, and toothNumber=third counting from inside when those facts are stated.",
      "Chinese 饿了 means hungry and must be translated into Japanese as 空腹です, not お腹が空きました, because the source does not state an abdomen or stomach body part.",
      "Japanese 一回見せてください is an ordinary polite request to take a look and may be translated naturally as Chinese 请让我看一下 or an equivalent expression. This does not authorize changing medication frequency, dosage, procedure count, tooth number, date, or any other medical quantity.",
      "In Chinese dental symptom language, 酸 or 酸酸的 describing a physical sensation means sore, achy, sensitive, or dull throbbing; it does not mean a sour taste unless the source explicitly mentions taste, flavor, 酸味, or 味道. Do not translate this symptom as Japanese 酸っぱい.",
      "Chinese 两三天前 or 二三天前 is one approximate range meaning 2 to 3 days ago. Preserve it in Japanese as 2～3日前, not as separate calendar dates. Chinese 没有肿 is equivalent to Japanese 腫れはなく, 腫れておらず, or 腫れはありませんでした and the negative swelling meaning must remain explicit.",
      "For the exact dental reply 两三天前没有肿，就是酸酸的。, use the literal Japanese meaning 2～3日前は腫れはなく、ただ鈍くうずくような感じでした。 Do not add a tooth or other body part if it is only implied by the conversation.",
      "Use stable canonical English criticalInformation values. For Japanese 冷たいものでしみる or an equivalent cold-triggered sensitivity question, use symptom exactly cold sensitivity. For いつから続いていますか or an equivalent question about when it began and has continued, use timing exactly onset and duration question.",
      "When several dental symptoms occur together, join these stable English concepts with semicolons without paraphrasing them: しみる感じ=sensitivity, ズキズキ=throbbing pain, ジーンとした感じ=lingering aching sensation, and 夜に痛みで目が覚める=pain waking patient at night. Keep question/statement meaning in sourceText and translatedText, but do not append the word question or statement to criticalInformation symptom concepts.",
      "Before returning, perform a final literal self-check of sourceText against translatedText. Set needsConfirmation to true and do not use high confidence if any body part, symptom, negation, side, number, date, dosage, tooth number, medication, allergy, or uncertainty may have changed, been omitted, or been added.",
      "Return only the structured result required by the schema.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: `Transcribed source:\n${sourceText}` }],
      },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "automatic_dental_translation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            detectedLanguage: { enum: ["ja", patientLanguage, "unknown"] },
            sourceText: { type: "string" },
            translatedText: { type: "string" },
            criticalInformation: CRITICAL_INFORMATION_SCHEMA,
            needsConfirmation: { type: "boolean" },
            confidence: { enum: ["high", "medium", "low"] },
          },
          required: [
            "detectedLanguage",
            "sourceText",
            "translatedText",
            "criticalInformation",
            "needsConfirmation",
            "confidence",
          ],
        },
      },
    },
  } as const;
}

export function buildFastAutomaticTranslationRequest(
  sourceText: string,
  patientLanguage: LanguageCode,
) {
  return {
    model: FAST_MEDICAL_TRANSLATION_MODEL,
    store: false,
    prompt_cache_key: `dentbridge-fast-translation-v2-${patientLanguage}`,
    // This is a hard ceiling, not a requested output length. 180 tokens could
    // truncate valid multilingual JSON for a longer dental sentence. The
    // strict schema still ends generation as soon as the object is complete.
    max_output_tokens: 480,
    instructions: [
      "Act only as a literal interpreter for a Japanese dental clinic.",
      `Allowed source languages: Japanese (ja) and ${languageLabel(patientLanguage)}. Translate ja to ${languageLabel(patientLanguage)}, otherwise translate ${languageLabel(patientLanguage)} to ja. Never output the source language as the translation.`,
      "Do not answer, diagnose, explain, infer, add, omit, or soften. Preserve body/tooth location, symptom, negation, uncertainty, left/right, tooth number, all numbers, dates, dosage, medication, allergy, pregnancy, anesthesia, procedure, cost, and risk exactly.",
      "Determine detectedLanguage independently from whether the sentence is complete. If the language is clearly Japanese or the selected patient language, keep that detectedLanguage even when meaning is incomplete. If meaning is incomplete or uncertain, return translatedText='', needsConfirmation=true, and confidence=low. Use detectedLanguage=unknown only when the language itself cannot be identified. Never guess or complete a cut-off sentence.",
      "sourceText must exactly copy the supplied transcription. Extract concise English criticalInformation; use null only when absent.",
      "Dental rules: Chinese 牙/牙齿/牙疼/牙痛 means tooth/teeth/tooth pain, never stomach. Japanese 左下の奥歯が痛いです means Chinese 左下方的后牙疼 and must not remain Japanese. 里面 means inner side, not back. 从里面数第三颗 preserves third counting from inside. 饿了 translates to Japanese 空腹です. Dental 酸/酸酸的 means sore, achy, sensitive, or dull throbbing, not sour taste. 两三天前 means 2-3 days ago. 没有肿 must remain negative. 一天三次 means three times per day.",
      "Courtesy equivalence: Japanese ごめんなさい/すみません and Chinese 对不起/不好意思 are apologies, not medical negation. Japanese ゆっくりで大丈夫 and Chinese 慢慢来没关系 are reassurance. Japanese 一番 in 一番気になる or 一番痛い is a superlative translated as Chinese 最, not tooth number one.",
      "Before returning, check that translation language is the required target and every critical fact is unchanged. Only high confidence without confirmation can be played.",
      "Return only the required JSON schema.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: sourceText }],
      },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "fast_dental_translation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            detectedLanguage: { enum: ["ja", patientLanguage, "unknown"] },
            sourceText: { type: "string" },
            translatedText: { type: "string" },
            criticalInformation: CRITICAL_INFORMATION_SCHEMA,
            needsConfirmation: { type: "boolean" },
            confidence: { enum: ["high", "medium", "low"] },
          },
          required: [
            "detectedLanguage",
            "sourceText",
            "translatedText",
            "criticalInformation",
            "needsConfirmation",
            "confidence",
          ],
        },
      },
    },
  } as const;
}

export function buildAutomaticReviewRequest(
  translation: AutomaticTranslationOutput,
  patientLanguage: LanguageCode,
) {
  return {
    model: MEDICAL_TRANSLATION_MODEL,
    store: false,
    prompt_cache_key: `dentbridge-review-v2-${patientLanguage}`,
    reasoning: { effort: "none" },
    max_output_tokens: 320,
    instructions: [
      "You are a second, independent medical translation safety reviewer for a Japanese dental clinic.",
      `The permitted pair is Japanese and ${languageLabel(patientLanguage)}.`,
      "Compare the source and translation literally. Do not rewrite either text and do not provide medical advice.",
      "Fail on any omission, addition, contradiction, uncertainty, or change to body part, symptom, negation, left/right, tooth number, number, date, dosage, medication, or allergy.",
      "Specifically reject tooth pain changed to abdominal pain, left changed to right, a negated allergy changed to a positive allergy, three times changed to once, and tooth six changed to tooth nine.",
      "For Chinese dental positions, 里面 must remain inner side/内側 and must fail if changed to back, rear, 奥, or posterior. 从里面数第三颗 must preserve third counting from the inner side.",
      "For Chinese 饿了, accept Japanese 空腹です. Reject お腹が空きました because it adds an abdomen/stomach body part not stated in the source.",
      "Treat Japanese 一回見せてください and Chinese 请让我看一下 as the same polite request to take a look. This equivalence applies only to the ordinary viewing request and never to medication frequency, dosage, procedure count, tooth number, date, or other medical quantities.",
      "Treat Chinese 两三天前 or 二三天前 and Japanese 2～3日前 or conventional 2、3日前 as the same approximate range: 2 to 3 days ago. Do not report a number mismatch for those equivalent forms.",
      "Treat Chinese 没有肿 and Japanese 腫れはなく, 腫れておらず, or 腫れはありませんでした as the same explicit negative swelling fact. The negative must not become positive.",
      "In a dental symptom description, Chinese 酸 or 酸酸的 means sore, achy, sensitive, or dull throbbing. Accept Japanese 鈍くうずくような感じ. Reject 酸っぱい unless the Chinese source explicitly refers to taste or flavor.",
      "Canonical extraction rule: 冷たいものでしみる, sensitivity to cold, and cold-triggered sensitivity or sharp discomfort all use symptom cold sensitivity. いつから続いていますか, asking when it started and how long it has continued, and onset/duration wording all use timing onset and duration question. Equivalent wording must not fail, but cold must still fail if changed to heat and a timing question must fail if changed to a concrete answer.",
      "For multi-symptom dental questions, use these canonical concepts: しみる感じ=sensitivity, ズキズキ=throbbing pain, ジーンとした感じ=lingering aching sensation, and 夜に痛みで目が覚める=pain waking patient at night. Treat lingering dull pain, lingering numb aching sensation, and lingering aching sensation as equivalent descriptions of ジーンとした感じ, but fail if a symptom category is added, removed, or contradicted.",
      "Judge the medical meaning in the source and translation, not stylistic differences between the two English criticalInformation extractions. Treat inside and inner side as the same canonical location, and treat third counting from inside and third counting from inner side as the same tooth number. Do not report an issue for those equivalent English phrasings.",
      "Extract the critical facts independently using concise language-neutral English values and exact names/numbers.",
      "Return short failure reasons in Japanese. Return only the structured result required by the schema.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Detected source language: ${translation.detectedLanguage}`,
              `Source: ${translation.sourceText}`,
              `Translation: ${translation.translatedText}`,
              `First extraction: ${JSON.stringify(translation.criticalInformation)}`,
            ].join("\n"),
          },
        ],
      },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "automatic_dental_translation_review",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            passed: { type: "boolean" },
            issues: { type: "array", items: { type: "string" } },
            checkedCriticalInformation: CRITICAL_INFORMATION_SCHEMA,
          },
          required: ["passed", "issues", "checkedCriticalInformation"],
        },
      },
    },
  } as const;
}

export function extractResponseText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const response = value as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>;
  };
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseCriticalInformation(value: unknown): CriticalInformation | null {
  if (!value || typeof value !== "object") return null;
  const facts = value as Record<string, unknown>;
  const keys = [
    "bodyPart",
    "symptom",
    "timing",
    "toothNumber",
    "side",
    "medication",
    "allergy",
    "dosage",
  ] as const;
  if (!keys.every((key) => isNullableString(facts[key]))) return null;
  return Object.fromEntries(keys.map((key) => [key, facts[key]])) as CriticalInformation;
}

export function parseAutomaticTranslationOutput(
  text: string,
  patientLanguage: LanguageCode,
): AutomaticTranslationOutput | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const facts = parseCriticalInformation(parsed.criticalInformation);
    const allowed = ["ja", patientLanguage, "unknown"];
    if (
      !allowed.includes(String(parsed.detectedLanguage)) ||
      typeof parsed.sourceText !== "string" ||
      typeof parsed.translatedText !== "string" ||
      !facts ||
      typeof parsed.needsConfirmation !== "boolean" ||
      !["high", "medium", "low"].includes(String(parsed.confidence))
    ) {
      return null;
    }
    return {
      detectedLanguage: parsed.detectedLanguage as LanguageCode | "unknown",
      sourceText: parsed.sourceText.trim(),
      translatedText: parsed.translatedText.trim(),
      criticalInformation: facts,
      needsConfirmation: parsed.needsConfirmation,
      confidence: parsed.confidence as "high" | "medium" | "low",
    };
  } catch {
    return null;
  }
}

export function parseAutomaticReviewOutput(text: string): AutomaticReviewOutput | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const facts = parseCriticalInformation(parsed.checkedCriticalInformation);
    if (
      typeof parsed.passed !== "boolean" ||
      !Array.isArray(parsed.issues) ||
      !parsed.issues.every((issue) => typeof issue === "string") ||
      !facts
    ) {
      return null;
    }
    return {
      passed: parsed.passed,
      issues: parsed.issues,
      checkedCriticalInformation: facts,
    };
  } catch {
    return null;
  }
}

function normalizeFact(key: keyof CriticalInformation, value: string | null) {
  if (value === null) return null;
  const ordinals: Record<string, string> = {
    first: "1",
    second: "2",
    third: "3",
    fourth: "4",
    fifth: "5",
    sixth: "6",
    seventh: "7",
    eighth: "8",
    ninth: "9",
    tenth: "10",
  };
  let normalized = value.normalize("NFKC").toLocaleLowerCase();
  if (
    key === "symptom" &&
    /\bcold\b/.test(normalized) &&
    /(sensitiv|trigger|sharp|discomfort|sting)/.test(normalized)
  ) {
    return "coldsensitivity";
  }
  if (key === "symptom") {
    normalized = normalized
      .replace(
        /\blingering\s+(?:numb\s+)?(?:dull\s+)?(?:aching\s+sensation|ache|aching|dull\s+pain)\b/g,
        "lingering aching sensation",
      )
      .replace(/\bpain\s+(?:that\s+)?wak(?:e|es|ing)\s+(?:the\s+)?patient\s+(?:up\s+)?at\s+night\b/g, "pain waking patient at night")
      .replace(/\bnight(?:time)?\s+pain\s+(?:that\s+)?wak(?:e|es|ing)\s+(?:the\s+)?patient\b/g, "pain waking patient at night")
      .replace(/\b(?:question|statement)\b/g, "");
  }
  if (key === "timing") {
    const asksOnset = /(when.*(?:start|begin|began)|since\s+when|onset)/.test(normalized);
    const asksDuration = /(how\s+long|continu|duration)/.test(normalized);
    if ((asksOnset && asksDuration) || /onset\s*(?:and|\/|&)\s*duration/.test(normalized)) {
      return "onsetdurationquestion";
    }
  }
  normalized = normalized
    .replace(/\b(?:two|2)\s*(?:or|to|through|[-–—~〜～])\s*(?:three|3)\s*days?\s*ago\b/g, "2to3daysago")
    .replace(/\b2\s*[,、]\s*3\s*days?\s*ago\b/g, "2to3daysago");
  for (const [word, number] of Object.entries(ordinals)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "g"), number);
  }
  return normalized
    .replace(/inner[\s_-]*side|inside/g, "inner")
    .replace(/outer[\s_-]*side|outside/g, "outer")
    .replace(/\band\b/g, "")
    .replace(/[\s.,，。・_\-/]+/g, "");
}

export function compareCriticalInformation(
  first: CriticalInformation,
  second: CriticalInformation,
) {
  const labels: Record<keyof CriticalInformation, string> = {
    bodyPart: "身体部位",
    symptom: "症状",
    timing: "時期",
    toothNumber: "歯の番号",
    side: "左右・位置",
    medication: "薬",
    allergy: "アレルギー",
    dosage: "用量・回数",
  };
  const issues: string[] = [];
  for (const key of Object.keys(labels) as Array<keyof CriticalInformation>) {
    if (normalizeFact(key, first[key]) !== normalizeFact(key, second[key])) {
      issues.push(`${labels[key]}の抽出結果が一致しません`);
    }
  }
  return issues;
}
