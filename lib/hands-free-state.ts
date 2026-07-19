export type HandsFreeState =
  | "idle"
  | "calibrating"
  | "listening"
  | "recording"
  | "transcribing"
  | "translating"
  | "verifying"
  | "speaking"
  | "cooldown"
  | "paused";

const ALLOWED_TRANSITIONS: Record<HandsFreeState, readonly HandsFreeState[]> = {
  idle: ["calibrating"],
  calibrating: ["listening", "paused", "idle"],
  // `listening -> speaking` is reserved for reviewed fixed prompts started by
  // an explicit clinic action, such as confirming the pre-treatment hand
  // signal. The playback path pauses VAD before emitting audio.
  listening: ["recording", "speaking", "paused", "calibrating", "idle"],
  recording: ["transcribing", "listening", "paused", "idle"],
  transcribing: ["translating", "speaking", "cooldown", "idle"],
  translating: ["verifying", "speaking", "cooldown", "idle"],
  verifying: ["speaking", "cooldown", "idle"],
  speaking: ["cooldown", "idle"],
  cooldown: ["listening", "calibrating", "paused", "idle"],
  paused: ["calibrating", "idle"],
};

export function canTransition(from: HandsFreeState, to: HandsFreeState) {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionState(from: HandsFreeState, to: HandsFreeState) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid hands-free transition: ${from} -> ${to}`);
  }
  return to;
}

export const HANDS_FREE_STATUS: Record<HandsFreeState, string> = {
  idle: "会話は開始されていません",
  calibrating: "約2秒間、周囲の音を確認しています",
  listening: "話しかけてください・自動で聞いています",
  recording: "話していることを検出しました",
  transcribing: "音声を文字にしています",
  translating: "言語を判定して翻訳しています",
  verifying: "重要な医療情報を検査しています",
  speaking: "検査済みの訳文を再生しています",
  cooldown: "マイクの再開を準備しています",
  paused: "マイクを一時停止しています",
};
