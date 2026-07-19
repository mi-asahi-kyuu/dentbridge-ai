export const OPENAI_SERVICE_TIERS = ["auto", "default", "priority"] as const;

export type OpenAiServiceTier = (typeof OPENAI_SERVICE_TIERS)[number];

export function getOpenAiServiceTier(
  value = process.env.OPENAI_SERVICE_TIER,
): OpenAiServiceTier {
  const normalized = value?.trim();
  return OPENAI_SERVICE_TIERS.includes(normalized as OpenAiServiceTier)
    ? (normalized as OpenAiServiceTier)
    : "auto";
}
