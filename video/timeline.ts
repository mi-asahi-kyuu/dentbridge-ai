export const VIDEO_FPS = 30;
export const VIDEO_DURATION_SECONDS = 139;

export type AudioCue = {
  readonly file: string;
  readonly start: number;
  readonly volume?: number;
};

export const AUDIO_CUES: readonly AudioCue[] = [
  { file: "narrator-intro.wav", start: 0.2, volume: 1 },
  { file: "narrator-start.wav", start: 6.4, volume: 1 },
  { file: "patient-pain.wav", start: 15.1, volume: 1 },
  { file: "app-ja-pain.wav", start: 20, volume: 0.96 },
  { file: "dentist-cold.wav", start: 25.6, volume: 1 },
  { file: "app-en-cold.wav", start: 29.6, volume: 0.96 },
  { file: "patient-allergy.wav", start: 32.4, volume: 1 },
  { file: "app-ja-allergy.wav", start: 36.5, volume: 0.96 },
  { file: "dentist-start.wav", start: 44.8, volume: 1 },
  { file: "app-en-hand-signal.wav", start: 48, volume: 0.98 },
  { file: "dentist-confirm.wav", start: 64, volume: 1 },
  { file: "app-en-treatment-start.wav", start: 66.4, volume: 0.98 },
  { file: "dentist-open.wav", start: 72, volume: 1 },
  { file: "app-en-open.wav", start: 73.8, volume: 0.98 },
  { file: "dentist-pain.wav", start: 76, volume: 1 },
  { file: "app-en-pain.wav", start: 77.5, volume: 0.98 },
  { file: "dentist-end.wav", start: 80, volume: 1 },
  { file: "app-en-end.wav", start: 81.8, volume: 0.98 },
  { file: "narrator-codex.wav", start: 87.7, volume: 1 },
  { file: "narrator-gpt.wav", start: 104.2, volume: 1 },
  { file: "narrator-outro.wav", start: 124.5, volume: 1 },
] as const;

export const CHIME_SECONDS = [21.1, 37.8, 64.8, 67.4, 74.2, 78, 82.4] as const;

export type SceneWindow = {
  readonly from: number;
  readonly to: number;
};

export const SCENES = {
  intro: { from: 0, to: 6.2 },
  setup: { from: 5.9, to: 13.2 },
  calibration: { from: 12.8, to: 15.4 },
  patientPain: { from: 14.8, to: 24.9 },
  dentistCold: { from: 24.5, to: 32.3 },
  allergy: { from: 31.9, to: 43.9 },
  startTreatment: { from: 43.5, to: 47.9 },
  handSignal: { from: 47.5, to: 65.9 },
  treatmentReady: { from: 63.5, to: 71.2 },
  openMouth: { from: 70.8, to: 75.8 },
  painCheck: { from: 75.4, to: 79.9 },
  endTreatment: { from: 79.5, to: 87.6 },
  codex: { from: 87.1, to: 104.2 },
  gpt: { from: 103.8, to: 124.4 },
  outro: { from: 124, to: 139 },
} satisfies Record<string, SceneWindow>;
