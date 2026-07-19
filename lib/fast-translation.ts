import type { LanguageCode } from "./languages";
import type { AutomaticTranslationOutput } from "./serial-translation";
import { checkTranslationConsistency } from "./translation-consistency";

export type FastTranslationAssessment = {
  passed: boolean;
  issues: string[];
  targetLanguage: LanguageCode | null;
};

export function assessFastTranslation(
  requestedSource: string,
  translation: AutomaticTranslationOutput,
  patientLanguage: LanguageCode,
): FastTranslationAssessment {
  const detected = translation.detectedLanguage;
  const targetLanguage = detected === "ja"
    ? patientLanguage
    : detected === patientLanguage
      ? "ja"
      : null;
  const likelyIncomplete = !translation.translatedText.trim() && translation.needsConfirmation;
  const issues = [
    !targetLanguage ? "日本語または選択した患者言語として判定できませんでした" : "",
    translation.sourceText.trim() !== requestedSource.trim()
      ? "モデルが確認した原文が音声認識結果と一致しません"
      : "",
    likelyIncomplete
      ? "原文が途中で切れた可能性があります。短く区切ってもう一度話してください"
      : !translation.translatedText.trim() ? "訳文が空です" : "",
    translation.needsConfirmation && !likelyIncomplete
      ? "モデルが人による確認を必要と判定しました"
      : "",
    translation.confidence !== "high" && !likelyIncomplete
      ? "言語判定または翻訳の信頼度が不足しています"
      : "",
  ].filter(Boolean);

  if (targetLanguage && translation.translatedText.trim()) {
    issues.push(...checkTranslationConsistency(
      translation.sourceText,
      detected as LanguageCode,
      translation.translatedText,
      targetLanguage,
    ).reasons);
  }

  const uniqueIssues = [...new Set(issues)];
  return {
    passed: uniqueIssues.length === 0,
    issues: uniqueIssues,
    targetLanguage,
  };
}
