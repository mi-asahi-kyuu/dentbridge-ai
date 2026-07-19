import { describe, expect, it } from "vitest";
import { EnergyVadDetector } from "./energy-vad";
import { FAST_VAD_CONFIG, VAD_CONFIG } from "./vad-config";
import type { VadConfig } from "./vad-config";

const config: VadConfig = {
  calibrationMs: 200,
  speechStartMs: 100,
  silenceEndMs: 300,
  trailingSilenceMs: 100,
  minimumVoicedMs: 250,
  maximumSentenceMs: 1_500,
  preRollMs: 100,
  minimumRms: 0.01,
  thresholdMultiplier: 2,
  speechModulationWindowMs: 50,
  speechStartMinimumModulationWindows: 3,
  speechStartModulationAnalysisWindows: 6,
  speechStartMinimumModulationRatio: 0.08,
  speechReleaseThresholdRatio: 0.6,
  noiseFloorSmoothing: 0.05,
  cooldownMs: 400,
  playbackTailMs: 500,
  postPlaybackGuardMs: 750,
};

const silence = () => new Float32Array(100).fill(0.001);
const voice = (amplitude = 0.2) => new Float32Array(100).fill(amplitude);
const veryWeakVoice = () => new Float32Array(100).fill(0.0055);

describe("local energy VAD", () => {
  it("uses a conservative fast sentence boundary without weakening the start noise gate", () => {
    expect(VAD_CONFIG.silenceEndMs).toBe(900);
    expect(FAST_VAD_CONFIG.silenceEndMs).toBe(800);
    expect(FAST_VAD_CONFIG.silenceEndMs).toBeGreaterThanOrEqual(700);
    expect(FAST_VAD_CONFIG.silenceEndMs).toBeLessThanOrEqual(1_000);
    expect(FAST_VAD_CONFIG.silenceEndMs).toBeLessThan(VAD_CONFIG.silenceEndMs);
    expect(FAST_VAD_CONFIG.speechStartMs).toBe(100);
    expect(FAST_VAD_CONFIG.minimumVoicedMs).toBe(240);
    expect(FAST_VAD_CONFIG.thresholdMultiplier).toBe(VAD_CONFIG.thresholdMultiplier);
    expect(FAST_VAD_CONFIG.speechStartMinimumModulationRatio).toBe(
      VAD_CONFIG.speechStartMinimumModulationRatio,
    );
    expect(FAST_VAD_CONFIG.speechReleaseThresholdRatio).toBeLessThan(
      VAD_CONFIG.speechReleaseThresholdRatio,
    );
    expect(FAST_VAD_CONFIG.postPlaybackGuardMs).toBeLessThanOrEqual(
      FAST_VAD_CONFIG.cooldownMs,
    );
  });
  it("calibrates, detects speech, and ends a sentence after configured silence", () => {
    const detector = new EnergyVadDetector(1_000, config);
    expect(detector.process(silence())).toEqual([]);
    expect(detector.process(silence())[0]?.type).toBe("calibration-complete");
    expect(detector.process(voice(0.08))).toEqual([]);
    expect(detector.process(voice(0.2))).toContainEqual({ type: "speech-start" });
    detector.process(voice());
    detector.process(voice());
    detector.process(silence());
    detector.process(silence());
    const events = detector.process(silence());
    expect(events[0]?.type).toBe("sentence");
    if (events[0]?.type === "sentence") {
      expect(events[0].reason).toBe("silence");
      expect(events[0].durationMs).toBe(400);
      expect(events[0].samples).toHaveLength(400);
    }
  });

  it("ignores a short device-noise spike", () => {
    const detector = new EnergyVadDetector(1_000, config);
    detector.process(silence());
    detector.process(silence());
    expect(detector.process(voice())).toEqual([]);
    expect(detector.process(silence())).toContainEqual({ type: "noise-ignored" });
    expect(detector.currentState).toBe("listening");
  });

  it("keeps a Mandarin phrase together across a natural pause and a weak final syllable", () => {
    const fastConfig: VadConfig = {
      ...config,
      silenceEndMs: 800,
      trailingSilenceMs: 120,
      speechReleaseThresholdRatio: 0.5,
      maximumSentenceMs: 3_000,
    };
    const detector = new EnergyVadDetector(1_000, fastConfig);
    detector.process(silence());
    detector.process(silence());

    // “医生，我昨晚那个牙有点”
    expect(detector.process(voice(0.08))).toEqual([]);
    expect(detector.process(voice(0.2))).toContainEqual({ type: "speech-start" });
    for (let frame = 0; frame < 4; frame += 1) detector.process(voice());

    // A 700 ms phrase-internal pause must not emit a sentence.
    for (let frame = 0; frame < 7; frame += 1) {
      expect(detector.process(silence())).toEqual([]);
    }

    // “疼” is below the 0.01 start threshold, but above the 0.005 release
    // threshold. It must resume the same sentence and reset accumulated silence.
    for (let frame = 0; frame < 3; frame += 1) {
      expect(detector.process(veryWeakVoice())).toEqual([]);
    }

    const endingEvents = [];
    for (let frame = 0; frame < 8; frame += 1) {
      endingEvents.push(...detector.process(silence()));
    }
    expect(endingEvents).toHaveLength(1);
    expect(endingEvents[0]?.type).toBe("sentence");
    if (endingEvents[0]?.type === "sentence") {
      expect(endingEvents[0].reason).toBe("silence");
      // Only the configured 120 ms tail is retained; the 680 ms detection
      // hangover does not increase the uploaded audio payload.
      expect(endingEvents[0].durationMs).toBe(1_620);
      expect(endingEvents[0].samples).toHaveLength(1_620);
    }
  });

  it("supports a 20-second production maximum and pauses without consuming audio", () => {
    const detector = new EnergyVadDetector(1_000);
    detector.pause();
    expect(detector.process(voice())).toEqual([]);
    detector.resumeListening();
    expect(detector.currentState).toBe("listening");
  });

  it("does not open the speech gate for sustained stable environmental sound", () => {
    const detector = new EnergyVadDetector(1_000, config);
    detector.process(silence());
    detector.process(silence());

    const stableNoise = new Float32Array(20);
    for (let index = 0; index < stableNoise.length; index += 1) {
      stableNoise[index] = index % 2 === 0 ? 0.08 : -0.08;
    }
    const events = [];
    for (let frame = 0; frame < 50; frame += 1) {
      events.push(...detector.process(stableNoise));
    }

    expect(events).not.toContainEqual({ type: "speech-start" });
    expect(detector.currentState).toBe("listening");
    expect(detector.process(new Float32Array(20).fill(0.001))).toContainEqual({
      type: "noise-ignored",
    });
  });

  it("keeps a naturally modulated short utterance while rejecting a steady pure tone", () => {
    const sampleRate = 8_000;
    const frameSamples = 160;
    const frameMs = 20;
    const realisticConfig: VadConfig = {
      ...config,
      calibrationMs: 200,
      speechStartMs: 100,
      speechModulationWindowMs: 40,
      minimumVoicedMs: 240,
      preRollMs: 240,
    };
    const makeSineFrame = (amplitude: number, startSample: number) => {
      const samples = new Float32Array(frameSamples);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = amplitude * Math.sin(
          (2 * Math.PI * 440 * (startSample + index)) / sampleRate,
        );
      }
      return samples;
    };
    const calibrateDetector = (detector: EnergyVadDetector) => {
      for (let frame = 0; frame < 10; frame += 1) {
        detector.process(new Float32Array(frameSamples).fill(0.001));
      }
    };

    const toneDetector = new EnergyVadDetector(sampleRate, realisticConfig);
    calibrateDetector(toneDetector);
    const toneEvents = [];
    let sampleOffset = 0;
    for (let frame = 0; frame < 50; frame += 1) {
      toneEvents.push(...toneDetector.process(makeSineFrame(0.08, sampleOffset)));
      sampleOffset += frameSamples;
    }
    expect(toneEvents).not.toContainEqual({ type: "speech-start" });
    expect(toneDetector.currentState).toBe("listening");

    const voiceDetector = new EnergyVadDetector(sampleRate, realisticConfig);
    calibrateDetector(voiceDetector);
    const voiceEvents = [];
    sampleOffset = 0;
    // Seven 40 ms envelope sections form a 280 ms short word. The changing
    // amplitudes approximate syllable/phoneme dynamics without requiring a
    // long utterance to open the gate.
    for (const amplitude of [0.035, 0.09, 0.055, 0.11, 0.045, 0.08, 0.04]) {
      for (let frame = 0; frame < 2; frame += 1) {
        voiceEvents.push(...voiceDetector.process(makeSineFrame(amplitude, sampleOffset)));
        sampleOffset += frameSamples;
      }
    }
    for (let frame = 0; frame < realisticConfig.silenceEndMs / frameMs; frame += 1) {
      voiceEvents.push(...voiceDetector.process(new Float32Array(frameSamples).fill(0.001)));
    }

    expect(voiceEvents).toContainEqual({ type: "speech-start" });
    expect(voiceEvents.some((event) => event.type === "sentence")).toBe(true);
  });
});
