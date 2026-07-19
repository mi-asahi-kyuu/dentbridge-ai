import { VAD_CONFIG, type VadConfig } from "./vad-config";

export type VadDetectorState = "calibrating" | "listening" | "recording" | "paused";

export type VadEvent =
  | { type: "calibration-complete"; noiseFloor: number; threshold: number }
  | { type: "speech-start" }
  | {
      type: "sentence";
      samples: Float32Array;
      sampleRate: number;
      durationMs: number;
      reason: "silence" | "maximum" | "manual";
    }
  | { type: "noise-ignored" };

function rms(samples: Float32Array) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index];
  }
  return Math.sqrt(sum / samples.length);
}

function flatten(chunks: readonly Float32Array[]) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Float32Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export class EnergyVadDetector {
  private state: VadDetectorState = "calibrating";
  private calibrationEnergy = 0;
  private calibrationFrames = 0;
  private calibrationDurationMs = 0;
  private noiseFloor = 0.004;
  private threshold = VAD_CONFIG.minimumRms;
  private speechCandidateMs = 0;
  private speechEnvelopeEnergyMs = 0;
  private speechEnvelopeDurationMs = 0;
  private speechEnvelopes: number[] = [];
  private silenceMs = 0;
  private voicedMs = 0;
  private sentenceMs = 0;
  private preRollMs = 0;
  private preRoll: Float32Array[] = [];
  private sentence: Float32Array[] = [];

  constructor(
    private readonly sampleRate: number,
    private readonly config: Readonly<VadConfig> = VAD_CONFIG,
  ) {}

  get currentState() {
    return this.state;
  }

  get currentThreshold() {
    return this.threshold;
  }

  pause() {
    this.state = "paused";
    this.resetSentence();
    this.preRoll = [];
    this.preRollMs = 0;
  }

  resumeListening() {
    this.state = "listening";
    this.resetSentence();
    this.preRoll = [];
    this.preRollMs = 0;
  }

  calibrate() {
    this.state = "calibrating";
    this.calibrationEnergy = 0;
    this.calibrationFrames = 0;
    this.calibrationDurationMs = 0;
    this.resetSentence();
    this.preRoll = [];
    this.preRollMs = 0;
  }

  forceStart() {
    if (this.state !== "listening") return false;
    this.state = "recording";
    this.sentence = [...this.preRoll];
    this.sentenceMs = this.preRollMs;
    this.voicedMs = 0;
    this.silenceMs = 0;
    this.resetSpeechCandidate();
    return true;
  }

  forceEnd(): VadEvent[] {
    if (this.state !== "recording") return [];
    return this.finish("manual", true);
  }

  process(samples: Float32Array): VadEvent[] {
    if (this.state === "paused" || samples.length === 0) return [];
    const frameMs = (samples.length / this.sampleRate) * 1_000;
    const energy = rms(samples);

    if (this.state === "calibrating") {
      this.calibrationEnergy += energy;
      this.calibrationFrames += 1;
      this.calibrationDurationMs += frameMs;
      if (this.calibrationDurationMs < this.config.calibrationMs) return [];
      this.noiseFloor = Math.max(0.001, this.calibrationEnergy / this.calibrationFrames);
      this.threshold = Math.max(
        this.config.minimumRms,
        this.noiseFloor * this.config.thresholdMultiplier,
      );
      this.state = "listening";
      this.preRoll = [];
      this.preRollMs = 0;
      return [{ type: "calibration-complete", noiseFloor: this.noiseFloor, threshold: this.threshold }];
    }

    if (this.state === "listening") {
      this.pushPreRoll(samples.slice(), frameMs);
      // After an onset has crossed the start threshold, use the lower release
      // threshold while collecting its envelope. This preserves naturally
      // modulated short words whose quieter phonemes briefly dip below the
      // opening threshold.
      const candidateThreshold = this.speechCandidateMs > 0
        ? this.threshold * this.config.speechReleaseThresholdRatio
        : this.threshold;
      if (energy <= candidateThreshold) {
        const ignoredStableSound = this.speechCandidateMs >= this.config.speechStartMs;
        this.resetSpeechCandidate();
        this.noiseFloor =
          this.noiseFloor * (1 - this.config.noiseFloorSmoothing) +
          energy * this.config.noiseFloorSmoothing;
        this.threshold = Math.max(
          this.config.minimumRms,
          this.noiseFloor * this.config.thresholdMultiplier,
        );
        return ignoredStableSound ? [{ type: "noise-ignored" }] : [];
      }

      this.speechCandidateMs += frameMs;
      this.pushSpeechEnvelope(energy, frameMs);
      if (this.speechCandidateMs < this.config.speechStartMs) return [];
      if (!this.hasSpeechModulation()) return [];
      this.state = "recording";
      this.sentence = [...this.preRoll];
      this.sentenceMs = this.preRollMs;
      this.voicedMs = this.speechCandidateMs;
      this.silenceMs = 0;
      this.resetSpeechCandidate();
      return [{ type: "speech-start" }];
    }

    this.sentence.push(samples.slice());
    this.sentenceMs += frameMs;
    // Use hysteresis after speech starts. iPad/Android automatic gain control
    // can make a final syllable substantially quieter than the energy that
    // originally opened the gate. Requiring the start threshold here caused
    // weak endings (for example Chinese “疼”) to be counted as silence and
    // truncated. This release threshold still follows the calibrated ambient
    // threshold, but is deliberately lower than the start threshold.
    const releaseThreshold = this.threshold * this.config.speechReleaseThresholdRatio;
    if (energy > releaseThreshold) {
      this.voicedMs += frameMs;
      this.silenceMs = 0;
    } else {
      this.silenceMs += frameMs;
    }

    if (this.sentenceMs >= this.config.maximumSentenceMs) {
      return this.finish("maximum");
    }
    if (this.silenceMs >= this.config.silenceEndMs) {
      return this.finish("silence");
    }
    return [];
  }

  private pushPreRoll(samples: Float32Array, frameMs: number) {
    this.preRoll.push(samples);
    this.preRollMs += frameMs;
    while (this.preRoll.length > 1 && this.preRollMs > this.config.preRollMs) {
      const removed = this.preRoll.shift();
      if (removed) this.preRollMs -= (removed.length / this.sampleRate) * 1_000;
    }
  }

  private pushSpeechEnvelope(energy: number, frameMs: number) {
    let remainingMs = frameMs;
    while (remainingMs > 0) {
      const availableMs = this.config.speechModulationWindowMs - this.speechEnvelopeDurationMs;
      const consumedMs = Math.min(remainingMs, availableMs);
      this.speechEnvelopeEnergyMs += energy * energy * consumedMs;
      this.speechEnvelopeDurationMs += consumedMs;
      remainingMs -= consumedMs;

      if (this.speechEnvelopeDurationMs + Number.EPSILON < this.config.speechModulationWindowMs) {
        continue;
      }

      this.speechEnvelopes.push(
        Math.sqrt(this.speechEnvelopeEnergyMs / this.speechEnvelopeDurationMs),
      );
      while (this.speechEnvelopes.length > this.config.speechStartModulationAnalysisWindows) {
        this.speechEnvelopes.shift();
      }
      this.speechEnvelopeEnergyMs = 0;
      this.speechEnvelopeDurationMs = 0;
    }
  }

  private hasSpeechModulation() {
    if (this.speechEnvelopes.length < this.config.speechStartMinimumModulationWindows) {
      return false;
    }
    const mean = this.speechEnvelopes.reduce((total, energy) => total + energy, 0) /
      this.speechEnvelopes.length;
    if (mean <= 0) return false;
    let totalChange = 0;
    for (let index = 1; index < this.speechEnvelopes.length; index += 1) {
      totalChange += Math.abs(this.speechEnvelopes[index] - this.speechEnvelopes[index - 1]);
    }
    const averageChange = totalChange / (this.speechEnvelopes.length - 1);
    return averageChange / mean >= this.config.speechStartMinimumModulationRatio;
  }

  private resetSpeechCandidate() {
    this.speechCandidateMs = 0;
    this.speechEnvelopeEnergyMs = 0;
    this.speechEnvelopeDurationMs = 0;
    this.speechEnvelopes = [];
  }

  private finish(reason: "silence" | "maximum" | "manual", manual = false): VadEvent[] {
    const accepted = manual
      ? this.sentenceMs >= Math.min(180, this.config.minimumVoicedMs)
      : this.voicedMs >= this.config.minimumVoicedMs;
    let output = accepted ? flatten(this.sentence) : null;
    let durationMs = this.sentenceMs;
    if (
      output &&
      reason === "silence" &&
      this.silenceMs > this.config.trailingSilenceMs
    ) {
      const removableSilenceMs = this.silenceMs - this.config.trailingSilenceMs;
      const removableSamples = Math.min(
        output.length,
        Math.floor((removableSilenceMs / 1_000) * this.sampleRate),
      );
      output = output.slice(0, output.length - removableSamples);
      durationMs -= (removableSamples / this.sampleRate) * 1_000;
    }
    this.state = "listening";
    this.preRoll = [];
    this.preRollMs = 0;
    this.resetSentence();
    return output
      ? [{ type: "sentence", samples: output, sampleRate: this.sampleRate, durationMs, reason }]
      : [{ type: "noise-ignored" }];
  }

  private resetSentence() {
    this.sentence = [];
    this.sentenceMs = 0;
    this.voicedMs = 0;
    this.silenceMs = 0;
    this.resetSpeechCandidate();
  }
}

export function encodeMonoWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
