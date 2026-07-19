export type VadConfig = {
  calibrationMs: number;
  speechStartMs: number;
  silenceEndMs: number;
  trailingSilenceMs: number;
  minimumVoicedMs: number;
  maximumSentenceMs: number;
  preRollMs: number;
  minimumRms: number;
  thresholdMultiplier: number;
  /**
   * Smooth frame RMS values into envelope windows before deciding that an
   * above-threshold sound is speech. A steady appliance hum or pure tone can
   * be loud, but its windowed envelope changes much less than natural speech.
   */
  speechModulationWindowMs: number;
  speechStartMinimumModulationWindows: number;
  speechStartModulationAnalysisWindows: number;
  speechStartMinimumModulationRatio: number;
  /**
   * Once speech has started, keep treating quieter audio as speech down to
   * this fraction of the start threshold. Mobile AGC commonly lowers the
   * final syllable of a phrase, so start and release thresholds must differ.
   */
  speechReleaseThresholdRatio: number;
  noiseFloorSmoothing: number;
  cooldownMs: number;
  playbackTailMs: number;
  postPlaybackGuardMs: number;
};

/**
 * Browser-side energy VAD settings. Clinics should tune these values with the
 * actual tablet, microphone, drill and suction equipment before field use.
 */
export const VAD_CONFIG: Readonly<VadConfig> = {
  calibrationMs: 2_000,
  speechStartMs: 140,
  silenceEndMs: 900,
  trailingSilenceMs: 120,
  minimumVoicedMs: 320,
  maximumSentenceMs: 20_000,
  preRollMs: 240,
  minimumRms: 0.012,
  thresholdMultiplier: 2.8,
  speechModulationWindowMs: 40,
  speechStartMinimumModulationWindows: 3,
  speechStartModulationAnalysisWindows: 8,
  speechStartMinimumModulationRatio: 0.08,
  speechReleaseThresholdRatio: 0.6,
  noiseFloorSmoothing: 0.035,
  cooldownMs: 300,
  playbackTailMs: 500,
  postPlaybackGuardMs: 750,
};

/**
 * Demo-oriented latency profile. It keeps calibration and noise thresholding
 * unchanged while shortening sentence boundaries and turn cooldowns.
 */
export const FAST_VAD_CONFIG: Readonly<VadConfig> = {
  ...VAD_CONFIG,
  // Mandarin and Japanese speakers often pause for 500-700 ms inside one
  // thought. The previous 480 ms endpoint emitted the sentence before the
  // speaker continued. 800 ms is still within the product's requested
  // 700-1,000 ms range, while remaining slightly faster than safe mode.
  silenceEndMs: 800,
  // Retain enough low-energy tail for the transcriber even when iPad AGC makes
  // the last syllable look like silence.
  trailingSilenceMs: 120,
  speechStartMs: 100,
  minimumVoicedMs: 240,
  speechReleaseThresholdRatio: 0.5,
  cooldownMs: 100,
  playbackTailMs: 250,
  // Playback has already ended and waited playbackTailMs before capture is
  // resumed. Keep this aligned with the UI cooldown so a user who speaks as
  // soon as "listening" appears does not lose the first 300 ms of the phrase.
  postPlaybackGuardMs: 100,
};
