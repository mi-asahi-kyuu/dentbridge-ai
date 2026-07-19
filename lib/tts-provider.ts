export const TTS_PROVIDERS = ["native", "openai-hd", "openai-fast"] as const;
export type TtsProvider = (typeof TTS_PROVIDERS)[number];

export function getTtsProvider(value = process.env.TTS_PROVIDER): TtsProvider {
  return TTS_PROVIDERS.includes(value as TtsProvider) ? (value as TtsProvider) : "native";
}

export function getOpenAiTtsModel(provider: TtsProvider) {
  if (provider === "openai-hd") return "tts-1-hd";
  if (provider === "openai-fast") return "tts-1";
  return null;
}

export function canPlayCheckedTranslation(value: {
  reviewPassed: boolean;
  translatedText: string;
  speechToken?: string;
}) {
  return value.reviewPassed && Boolean(value.translatedText.trim()) && Boolean(value.speechToken);
}
