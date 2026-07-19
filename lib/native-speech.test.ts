import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NativeSpeechError,
  nativeSpeechMaximumDuration,
  playNativeSpeech,
} from "./native-speech";

type MutableUtterance = SpeechSynthesisUtterance & {
  onstart: ((event: SpeechSynthesisEvent) => void) | null;
  onend: ((event: SpeechSynthesisEvent) => void) | null;
};

function createUtterance(text = "昨日から歯が痛いです。") {
  return {
    text,
    onstart: null,
    onboundary: null,
    onend: null,
    onerror: null,
  } as unknown as MutableUtterance;
}

function createSynthesis() {
  return {
    speaking: false,
    pending: false,
    paused: false,
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onvoiceschanged: null,
  } as unknown as SpeechSynthesis;
}

describe("native speech playback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not cancel immediately before queueing the utterance", async () => {
    vi.useFakeTimers();
    const synthesis = createSynthesis();
    const utterance = createUtterance();
    const playback = playNativeSpeech(synthesis, utterance);

    expect(synthesis.cancel).not.toHaveBeenCalled();
    expect(synthesis.resume).toHaveBeenCalledOnce();
    expect(synthesis.speak).toHaveBeenCalledWith(utterance);
    utterance.onend?.({} as SpeechSynthesisEvent);
    await expect(playback).resolves.toBeUndefined();
  });

  it("resolves from Safari synthesis state when onend is missing", async () => {
    vi.useFakeTimers();
    const synthesis = createSynthesis() as SpeechSynthesis & {
      speaking: boolean;
      pending: boolean;
    };
    const utterance = createUtterance();
    const started = vi.fn();
    const playback = playNativeSpeech(synthesis, utterance, {
      onPlaybackStart: started,
      pollIntervalMs: 50,
    });

    synthesis.speaking = true;
    await vi.advanceTimersByTimeAsync(50);
    synthesis.speaking = false;
    await vi.advanceTimersByTimeAsync(100);

    await expect(playback).resolves.toBeUndefined();
    expect(started).toHaveBeenCalledOnce();
  });

  it("fails quickly when Safari never starts or queues playback", async () => {
    vi.useFakeTimers();
    const synthesis = createSynthesis();
    const playback = playNativeSpeech(synthesis, createUtterance(), {
      startTimeoutMs: 500,
    });

    const rejection = expect(playback).rejects.toMatchObject({
      code: "not-started",
    } satisfies Partial<NativeSpeechError>);
    await vi.advanceTimersByTimeAsync(500);
    await rejection;
  });

  it("uses a bounded watchdog suitable for longer Japanese text", () => {
    expect(nativeSpeechMaximumDuration("短い文")).toBe(10_000);
    expect(nativeSpeechMaximumDuration("歯".repeat(200))).toBe(60_000);
  });

  it("treats an intentional stop as recovery instead of a playback error", async () => {
    vi.useFakeTimers();
    const synthesis = createSynthesis();
    const controller = new AbortController();
    const playback = playNativeSpeech(synthesis, createUtterance(), {
      signal: controller.signal,
    });

    controller.abort();

    await expect(playback).resolves.toBeUndefined();
    expect(synthesis.cancel).toHaveBeenCalledOnce();
  });

  it("ignores Safari's synchronous interrupted error caused by cancel", async () => {
    vi.useFakeTimers();
    const synthesis = createSynthesis();
    const utterance = createUtterance();
    const controller = new AbortController();
    vi.mocked(synthesis.cancel).mockImplementation(() => {
      utterance.onerror?.({ error: "interrupted" } as SpeechSynthesisErrorEvent);
    });
    const playback = playNativeSpeech(synthesis, utterance, {
      signal: controller.signal,
    });

    controller.abort();

    await expect(playback).resolves.toBeUndefined();
  });
});
