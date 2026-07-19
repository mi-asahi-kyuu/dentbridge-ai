import type { LanguageCode } from "./languages";

export const DENTAL_TRANSCRIPTION_PROMPTS: Record<LanguageCode, string> = {
  // A vocabulary list caused silence and machine noise to be completed with
  // words copied from that list (for example a pure tone became a dosage).
  // Keep the same-language clinical context, but never seed literal phrases
  // that the decoder can regurgitate when no person spoke.
  ja: "日本の歯科診療所で実際に明瞭に話された日本語だけを、そのまま正確に文字起こしします。明瞭な人の発話がない場合は何も出力しません。歯科用語、身体部位、左右、否定、数字、薬名を変えません。",
  zh: "只准确转写日本牙科诊所中实际清楚说出的中文。没有清晰人声时不输出任何文字。保持牙科术语、身体部位、左右、否定、数字和药名不变，保留轻声说出的句尾症状词。",
  en: "Accurately transcribe only clearly spoken English in a Japanese dental clinic. Output nothing when there is no clear human speech. Preserve dental terminology, body parts, laterality, negation, numbers, dosage, and medication names exactly.",
  ko: "일본 치과 진료소에서 실제로 명확하게 말한 한국어만 정확히 받아씁니다. 명확한 사람의 말이 없으면 아무것도 출력하지 않습니다. 치과 용어, 신체 부위, 좌우, 부정, 숫자, 용량과 약 이름을 그대로 유지합니다.",
  vi: "Chỉ ghi lại chính xác tiếng Việt thực sự được nói rõ trong phòng khám nha khoa Nhật Bản. Không xuất nội dung khi không có giọng người rõ ràng. Giữ nguyên thuật ngữ nha khoa, bộ phận cơ thể, bên trái hoặc phải, phủ định, số, liều lượng và tên thuốc.",
};

export type TranscriptionTokenLogprob = {
  token?: unknown;
  logprob?: unknown;
};

export type TranscriptionCandidate = {
  language: LanguageCode;
  text: string;
  logprobs: TranscriptionTokenLogprob[];
};

export const TRANSCRIPTION_CANDIDATE_GATE = {
  // Synthetic field checks gave approximately -0.86 to -1.00 for phrases
  // hallucinated from pink noise / a pure tone, versus about -0.00 to -0.11
  // for clear short speech. Use a conservative separation for medical audio.
  minimumAverageLogprob: -0.75,
  // Prompt-completion hallucinations can have a deceptively strong average
  // after an uncertain first token. Clear speech should establish its first
  // decoded token without this large uncertainty.
  minimumFirstTokenLogprob: -0.9,
  // Mechanical noise is often hallucinated as a single kana repeated several
  // times (for example, "ルルルルル"). Four consecutive copies are
  // rejected, while ordinary short dental words such as "歯磨き粉" remain valid.
  minimumRepeatedCharacterRun: 4,
  // If one forced-language transcript looks like mechanical noise, accept the
  // other language only when its token confidence is especially strong. This
  // preserves clear bilingual speech without promoting a second weak noise
  // hallucination merely because it did not repeat the same character.
  minimumAlternativeLogprobAfterRepetition: -0.35,
} as const;

export type TranscriptionCandidateRejectionReason =
  | "empty"
  | "missing_confidence"
  | "low_confidence"
  | "mechanical_repetition";

export type TranscriptionCandidateAssessment = {
  accepted: boolean;
  averageLogprob: number | null;
  rejectionReason: TranscriptionCandidateRejectionReason | null;
};

/**
 * Recognition is deliberately constrained to the clinic language and the
 * selected patient language. Both candidates are requested in parallel by the
 * API route, including in FAST mode; GPT-5.6 still makes the final language
 * decision after the strongest transcript has been selected.
 */
export function transcriptionCandidateLanguages(
  patientLanguage: LanguageCode,
): readonly ["ja", LanguageCode] {
  return ["ja", patientLanguage];
}

function numericLogprobs(logprobs: readonly TranscriptionTokenLogprob[]) {
  return logprobs
    .map((item) => item.logprob)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function averageLogprob(logprobs: readonly TranscriptionTokenLogprob[]) {
  const values = numericLogprobs(logprobs);
  if (values.length === 0) return -8;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compactTranscriptCharacters(text: string) {
  return [...text.normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "")];
}

function hasMechanicalCharacterRepetition(text: string) {
  const characters = compactTranscriptCharacters(text);
  let runLength = 1;
  for (let index = 1; index < characters.length; index += 1) {
    if (characters[index] === characters[index - 1]) {
      runLength += 1;
      if (
        runLength >= TRANSCRIPTION_CANDIDATE_GATE.minimumRepeatedCharacterRun &&
        /[\p{L}\p{M}]/u.test(characters[index])
      ) return true;
    } else {
      runLength = 1;
    }
  }
  return false;
}

export function assessTranscriptionCandidate(
  candidate: TranscriptionCandidate,
): TranscriptionCandidateAssessment {
  if (compactTranscriptCharacters(candidate.text).length === 0) {
    return { accepted: false, averageLogprob: null, rejectionReason: "empty" };
  }
  if (hasMechanicalCharacterRepetition(candidate.text)) {
    return {
      accepted: false,
      averageLogprob: null,
      rejectionReason: "mechanical_repetition",
    };
  }

  const confidenceValues = numericLogprobs(candidate.logprobs);
  if (confidenceValues.length === 0) {
    return {
      accepted: false,
      averageLogprob: null,
      rejectionReason: "missing_confidence",
    };
  }
  const candidateAverageLogprob =
    confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
  if (
    candidateAverageLogprob < TRANSCRIPTION_CANDIDATE_GATE.minimumAverageLogprob ||
    confidenceValues[0] < TRANSCRIPTION_CANDIDATE_GATE.minimumFirstTokenLogprob
  ) {
    return {
      accepted: false,
      averageLogprob: candidateAverageLogprob,
      rejectionReason: "low_confidence",
    };
  }
  return {
    accepted: true,
    averageLogprob: candidateAverageLogprob,
    rejectionReason: null,
  };
}

function scriptAffinity(text: string, language: LanguageCode) {
  const compact = text.replace(/[\s\p{P}\p{N}]/gu, "");
  if (!compact) return -2;
  const characters = [...compact];
  const ratio = (pattern: RegExp) =>
    characters.filter((character) => pattern.test(character)).length / characters.length;
  if (language === "ja") {
    const kanaRatio = ratio(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
    return kanaRatio > 0.08 ? 0.45 : -0.25;
  }
  if (language === "zh") {
    const hanRatio = ratio(/\p{Script=Han}/u);
    const hasKana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
    return hanRatio > 0.35 && !hasKana ? 0.35 : -0.3;
  }
  if (language === "ko") return ratio(/\p{Script=Hangul}/u) > 0.25 ? 0.45 : -0.4;
  const latinRatio = ratio(/\p{Script=Latin}/u);
  if (language === "vi") {
    const hasVietnameseMarks = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/iu.test(text);
    return latinRatio > 0.65 ? (hasVietnameseMarks ? 0.5 : 0.1) : -0.4;
  }
  return latinRatio > 0.65 ? 0.3 : -0.4;
}

export function transcriptionCandidateScore(candidate: TranscriptionCandidate) {
  return averageLogprob(candidate.logprobs) + scriptAffinity(candidate.text, candidate.language);
}

export function selectTranscriptionCandidate(candidates: readonly TranscriptionCandidate[]) {
  const assessedCandidates = candidates.map((candidate) => ({
    candidate,
    assessment: assessTranscriptionCandidate(candidate),
  }));
  const containsMechanicalRepetition = assessedCandidates.some(
    ({ assessment }) => assessment.rejectionReason === "mechanical_repetition",
  );
  const acceptedCandidates = assessedCandidates
    .filter(({ assessment }) =>
      assessment.accepted &&
      (!containsMechanicalRepetition ||
        (assessment.averageLogprob ?? Number.NEGATIVE_INFINITY) >=
          TRANSCRIPTION_CANDIDATE_GATE.minimumAlternativeLogprobAfterRepetition),
    )
    .map(({ candidate }) => candidate);
  if (acceptedCandidates.length === 0) return null;
  return acceptedCandidates.sort((left, right) =>
    transcriptionCandidateScore(right) - transcriptionCandidateScore(left),
  )[0];
}

export function normalizeDentalTranscript(text: string, language: LanguageCode) {
  const trimmed = text.trim();
  if (language !== "zh") return trimmed;

  const alreadyDental = /牙|齿|齒|口腔|牙龈|牙齦|牙疼|牙痛|麻醉|过敏|過敏|拔牙|补牙|補牙/.test(trimmed);
  const dentalLocationPattern = /(?:上|下|左|右|内|里|外)面的呀[，,、\s]*(?:从|從)?(?:里|内|內|外)面数第[一二三四五六七八九十两兩\d]+棵/;
  if (!alreadyDental && !dentalLocationPattern.test(trimmed)) return trimmed;

  return trimmed
    .replace(/((?:上|下|左|右|内|里|外)面的)呀/g, "$1牙")
    .replace(/((?:这|這|那)颗)呀/g, "$1牙")
    .replace(/第([一二三四五六七八九十两兩\d]+)棵(?=[，,。.!！？?、\s]|$)/g, "第$1颗");
}
