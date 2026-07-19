export const TRANSLATION_PIPELINE_MODES = ["safe", "fast"] as const;

export type TranslationPipelineMode = (typeof TRANSLATION_PIPELINE_MODES)[number];

export function getTranslationPipelineMode(
  value = process.env.TRANSLATION_PIPELINE_MODE,
): TranslationPipelineMode {
  return TRANSLATION_PIPELINE_MODES.includes(value as TranslationPipelineMode)
    ? (value as TranslationPipelineMode)
    : "safe";
}
