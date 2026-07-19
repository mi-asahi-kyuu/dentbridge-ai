type NativeVoiceLike = Pick<
  SpeechSynthesisVoice,
  "default" | "lang" | "localService" | "name" | "voiceURI"
>;

// Apple ships a small set of effect/character voices alongside its normal
// system voices. They are useful for accessibility and entertainment, but a
// dental translation must never sound like a whisper, robot, musical effect,
// or cartoon character.
const NOVELTY_VOICE_NAMES = new Set([
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "deranged",
  "good news",
  "hysterical",
  "jester",
  "organ",
  "pipe organ",
  "princess",
  "superstar",
  "trinoids",
  "whisper",
  "wobble",
  "zarvox",
]);

// Keep the cadence used by the previously field-tested iPad build. Selecting
// a different voice and changing its rate at the same time made the newest
// build sound unfamiliar even when the translated text was correct.
export const NATIVE_SPEECH_RATE = 0.92;

function normalizeLocale(locale: string) {
  return locale.trim().replaceAll("_", "-").toLocaleLowerCase();
}

function languageOf(locale: string) {
  return normalizeLocale(locale).split("-")[0] ?? "";
}

function normalizedVoiceIdentity(voice: NativeVoiceLike) {
  return `${voice.name} ${voice.voiceURI}`.trim().toLocaleLowerCase();
}

export function isNoveltyNativeVoice(voice: NativeVoiceLike) {
  const name = voice.name.trim().toLocaleLowerCase();
  if (NOVELTY_VOICE_NAMES.has(name)) return true;

  // Voice URIs on WebKit commonly prefix the display name. Check whole words
  // so a legitimate name that merely contains (for example) "organ" is not
  // rejected accidentally.
  const identity = normalizedVoiceIdentity(voice);
  return [...NOVELTY_VOICE_NAMES].some((candidate) => (
    new RegExp(`(?:^|[^a-z])${candidate.replaceAll(" ", "[ _-]+")}(?:$|[^a-z])`, "i")
      .test(identity)
  ));
}

/**
 * Score a browser voice for a requested BCP-47 locale.
 *
 * Match the old, field-tested browser behaviour: use the first normal voice
 * for the exact locale, then the first normal voice for the same language.
 * Do not override Safari's stable list order with "Enhanced" or "Premium"
 * name heuristics because those can select a different pronunciation model.
 */
export function scoreNativeVoice(voice: NativeVoiceLike, requestedLocale: string) {
  const requested = normalizeLocale(requestedLocale);
  const requestedLanguage = languageOf(requested);
  const candidate = normalizeLocale(voice.lang);
  const candidateLanguage = languageOf(candidate);

  if (!requestedLanguage || candidateLanguage !== requestedLanguage) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = candidate === requested ? 10_000 : 5_000;
  if (isNoveltyNativeVoice(voice)) score -= 20_000;

  return score;
}

export function selectNativeVoice<T extends NativeVoiceLike>(
  voices: readonly T[],
  requestedLocale: string,
): T | undefined {
  return voices
    .map((voice, index) => ({
      index,
      score: scoreNativeVoice(voice, requestedLocale),
      voice,
    }))
    // A negative score means the only matching item is a known character or
    // effect voice. Leave `utterance.voice` unset in that case so WebKit can
    // resolve the normal language default instead of explicitly forcing it.
    .filter((candidate) => Number.isFinite(candidate.score) && candidate.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .at(0)?.voice;
}
