export type RecentPlayback = {
  text: string;
  endedAt: number;
};

export const PLAYBACK_ECHO_WINDOW_MS = 15_000;

function normalizeSpeech(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function isLikelyPlaybackEcho(
  sourceText: string,
  recentPlayback: readonly RecentPlayback[],
  now = Date.now(),
) {
  const source = normalizeSpeech(sourceText);
  const containsCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(source);
  const minimumLength = containsCjk ? 3 : 8;
  if (source.length < minimumLength) return false;

  return recentPlayback.some((played) => {
    const age = now - played.endedAt;
    if (age < 0 || age > PLAYBACK_ECHO_WINDOW_MS) return false;
    const candidate = normalizeSpeech(played.text);
    if (candidate.length < minimumLength) return false;
    return candidate.includes(source) || source.includes(candidate);
  });
}
