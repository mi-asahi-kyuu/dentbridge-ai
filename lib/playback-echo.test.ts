import { describe, expect, it } from "vitest";
import { isLikelyPlaybackEcho, type RecentPlayback } from "./playback-echo";

const now = 20_000;
const recent: RecentPlayback[] = [{
  text: "上の歯の内側から数えて3本目が痛いです。",
  endedAt: now - 1_000,
}];

describe("playback echo guard", () => {
  it("blocks a complete replay of recently spoken Japanese TTS", () => {
    expect(isLikelyPlaybackEcho("上の歯の内側から数えて3本目が痛いです。", recent, now)).toBe(true);
  });

  it("blocks a recognizable CJK fragment of recently spoken TTS", () => {
    expect(isLikelyPlaybackEcho("上の歯。", recent, now)).toBe(true);
  });

  it("does not block unrelated speech or expired playback", () => {
    expect(isLikelyPlaybackEcho("昨日から歯が痛いです。", recent, now)).toBe(false);
    expect(isLikelyPlaybackEcho(recent[0].text, recent, now + 16_000)).toBe(false);
  });

  it("does not suppress very short Latin utterances by containment", () => {
    const english = [{ text: "Yes, the pain started yesterday.", endedAt: now - 500 }];
    expect(isLikelyPlaybackEcho("yes", english, now)).toBe(false);
  });
});
