import { describe, expect, it, vi } from "vitest";
import { LocalVadEngine, type LocalVadCallbacks } from "./local-vad";

function callbacks(): LocalVadCallbacks {
  return {
    onCalibrated: vi.fn(),
    onSpeechStart: vi.fn(),
    onSentence: vi.fn(),
    onNoiseIgnored: vi.fn(),
    onError: vi.fn(),
  };
}

describe("LocalVadEngine playback isolation", () => {
  it("pauses detection during TTS without toggling or reopening the input track", async () => {
    const engine = new LocalVadEngine(callbacks());
    const track = { enabled: true, stop: vi.fn() };
    const detector = { pause: vi.fn(), resumeListening: vi.fn() };
    const stream = { getAudioTracks: () => [track] };

    Object.assign(engine, {
      stream,
      context: {},
      detector,
    });

    await engine.suspendCaptureForPlayback();
    expect(detector.pause).toHaveBeenCalledOnce();
    expect(track.enabled).toBe(true);
    expect(track.stop).not.toHaveBeenCalled();

    await engine.resumeCaptureAfterPlayback();
    expect(track.enabled).toBe(true);
    expect(detector.resumeListening).toHaveBeenCalledOnce();
    expect(track.stop).not.toHaveBeenCalled();
  });
});
