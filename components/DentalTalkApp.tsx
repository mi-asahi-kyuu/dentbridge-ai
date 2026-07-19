"use client";

import {
  ArrowCounterClockwise,
  CheckCircle,
  CircleNotch,
  Clock,
  Flag,
  Gear,
  HandPalm,
  Microphone,
  Pause,
  Play,
  SpeakerHigh,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TreatmentGesturePanel } from "@/components/TreatmentGesturePanel";
import {
  HANDS_FREE_STATUS,
  transitionState,
  type HandsFreeState,
} from "@/lib/hands-free-state";
import { encodeMonoWav } from "@/lib/energy-vad";
import { getCriticalConfirmationContent } from "@/lib/critical-confirmation";
import { shouldRetryHttpStatus } from "@/lib/http-retry-policy";
import {
  DEFAULT_PATIENT_LANGUAGE,
  getLanguage,
  JA_CONSENT,
  PATIENT_LANGUAGES,
  type LanguageCode,
} from "@/lib/languages";
import { LocalVadEngine } from "@/lib/local-vad";
import { playNativeSpeech } from "@/lib/native-speech";
import { NATIVE_SPEECH_RATE, selectNativeVoice } from "@/lib/native-voice";
import {
  isLikelyPlaybackEcho,
  PLAYBACK_ECHO_WINDOW_MS,
  type RecentPlayback,
} from "@/lib/playback-echo";
import { createRandomId } from "@/lib/random-id";
import { recoverRejectedTurn } from "@/lib/rejected-turn";
import type {
  AutomaticTranslationOutput,
  CriticalInformation,
} from "@/lib/serial-translation";
import {
  matchTreatmentCommand,
  matchTreatmentPhrase,
  REPEAT_PROMPTS,
  TREATMENT_GESTURE_GUIDANCE,
  TREATMENT_MODE_MESSAGES,
  type PatientLanguageCode,
  type TreatmentSessionMode,
  transitionTreatmentSessionMode,
} from "@/lib/treatment-phrases";
import { canPlayCheckedTranslation, type TtsProvider } from "@/lib/tts-provider";
import type { TranslationPipelineMode } from "@/lib/translation-pipeline";
import { FAST_VAD_CONFIG, VAD_CONFIG } from "@/lib/vad-config";

const IS_MOCK_MODE = process.env.NEXT_PUBLIC_TRANSLATION_MOCK_MODE === "true";
const MICROPHONE_STORAGE_KEY = "dentbridge.microphoneDeviceId";

type Screen = "start" | "session";
type NetworkState = "online" | "reconnecting" | "offline" | "failed";
type RecordStatus = "processing" | "approved" | "rejected" | "fixed";

const PROCESSING_STATES: ReadonlySet<HandsFreeState> = new Set([
  "calibrating",
  "transcribing",
  "translating",
  "verifying",
  "cooldown",
]);

type TranslationRecord = {
  id: string;
  createdAt: number;
  detectedLanguage: LanguageCode | "unknown";
  targetLanguage: LanguageCode | null;
  sourceText: string;
  translatedText: string;
  status: RecordStatus;
  issues: string[];
  criticalInformation?: CriticalInformation;
};

type Props = {
  pipelineMode: TranslationPipelineMode;
  ttsProvider: TtsProvider;
};

type TranslateResponse = {
  translation?: AutomaticTranslationOutput;
  error?: string;
};

type VerifyResponse = {
  pipelineMode?: TranslationPipelineMode;
  translation?: AutomaticTranslationOutput;
  review?: { passed?: boolean; issues?: string[] };
  speechToken?: string;
  targetLanguage?: LanguageCode;
  timings?: { translationMs?: number };
  error?: string;
};

class NoSpeechDetectedError extends Error {
  constructor() {
    super("No clear human speech was detected.");
    this.name = "NoSpeechDetectedError";
  }
}

const MOCK_TURNS: Record<PatientLanguageCode, Array<{
  detected: LanguageCode;
  source: string;
  translation: string;
}>> = {
  zh: [
    { detected: "zh", source: "我从昨天就开始牙疼。", translation: "昨日から歯が痛いです。" },
    { detected: "ja", source: "左下の奥歯が痛いですか？", translation: "左下方的后牙疼吗？" },
    { detected: "zh", source: "我没有药物过敏。", translation: "薬のアレルギーはありません。" },
    { detected: "ja", source: "麻酔をしてから治療します。", translation: "麻醉后再进行治疗。" },
    { detected: "zh", source: "一天服用三次。", translation: "一日三回服用します。" },
  ],
  en: [
    { detected: "en", source: "My tooth has hurt since yesterday.", translation: "昨日から歯が痛いです。" },
    { detected: "ja", source: "左下の奥歯が痛いですか？", translation: "Does the lower-left back tooth hurt?" },
    { detected: "en", source: "I am not allergic to any medication.", translation: "薬のアレルギーはありません。" },
    { detected: "ja", source: "麻酔をしてから治療します。", translation: "We will treat the tooth after administering anesthesia." },
    { detected: "en", source: "Take it three times a day.", translation: "一日三回服用してください。" },
  ],
  ko: [
    { detected: "ko", source: "어제부터 치아가 아파요.", translation: "昨日から歯が痛いです。" },
    { detected: "ja", source: "左下の奥歯が痛いですか？", translation: "왼쪽 아래 어금니가 아픈가요?" },
    { detected: "ko", source: "약물 알레르기는 없습니다.", translation: "薬のアレルギーはありません。" },
    { detected: "ja", source: "麻酔をしてから治療します。", translation: "마취 후 치료하겠습니다." },
    { detected: "ko", source: "하루에 세 번 복용합니다.", translation: "一日三回服用します。" },
  ],
  vi: [
    { detected: "vi", source: "Tôi bị đau răng từ hôm qua.", translation: "昨日から歯が痛いです。" },
    { detected: "ja", source: "左下の奥歯が痛いですか？", translation: "Răng hàm dưới bên trái có đau không?" },
    { detected: "vi", source: "Tôi không bị dị ứng thuốc.", translation: "薬のアレルギーはありません。" },
    { detected: "ja", source: "麻酔をしてから治療します。", translation: "Chúng tôi sẽ điều trị sau khi gây tê." },
    { detected: "vi", source: "Uống ba lần một ngày.", translation: "一日三回服用します。" },
  ],
};

const EMPTY_CRITICAL: CriticalInformation = {
  bodyPart: null,
  symptom: null,
  timing: null,
  toothNumber: null,
  side: null,
  medication: null,
  allergy: null,
  dosage: null,
};

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function microphoneErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "マイクを開始できませんでした。権限とHTTPS接続を確認してください。";
  }
  if (error.message.includes("AudioSession category")) {
    return "iPadの音声モードをマイク用に切り替えられませんでした。ページを再読み込みしてください。";
  }
  if (error.name === "NotAllowedError") {
    return "マイクの利用が許可されていません。Safariのサイト設定でマイクを許可してください。";
  }
  return error.message;
}

export function DentalTalkApp({ pipelineMode, ttsProvider }: Props) {
  const [screen, setScreen] = useState<Screen>("start");
  const [patientLanguage, setPatientLanguage] = useState<PatientLanguageCode>(DEFAULT_PATIENT_LANGUAGE);
  const [consented, setConsented] = useState(false);
  const [machineState, setMachineState] = useState<HandsFreeState>("idle");
  const [mode, setMode] = useState<TreatmentSessionMode>("conversation");
  const [gestureGuidanceReady, setGestureGuidanceReady] = useState(false);
  const [records, setRecords] = useState<TranslationRecord[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [networkState, setNetworkState] = useState<NetworkState>(() =>
    typeof navigator === "undefined" || navigator.onLine ? "online" : "offline",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem(MICROPHONE_STORAGE_KEY) ?? "",
  );
  const [manualRecording, setManualRecording] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const activeRef = useRef(false);
  const startedAtRef = useRef(0);
  const sessionIdRef = useRef("");
  const patientLanguageRef = useRef<PatientLanguageCode>(patientLanguage);
  const modeRef = useRef<TreatmentSessionMode>("conversation");
  const gestureGuidanceReadyRef = useRef(false);
  const machineRef = useRef<HandsFreeState>("idle");
  const engineRef = useRef<LocalVadEngine | null>(null);
  const processingRef = useRef(false);
  const pauseRequestedRef = useRef(false);
  const sentenceHandlerRef = useRef<(audio: Blob) => void>(() => undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nativeSpeechAbortRef = useRef<AbortController | null>(null);
  const audioUrlsRef = useRef(new Set<string>());
  const reconnectAttemptsRef = useRef(0);
  const reconnectInFlightRef = useRef(false);
  const reconnectHandlerRef = useRef<() => void>(() => undefined);
  const recentPlaybackRef = useRef<RecentPlayback[]>([]);
  const mockRunRef = useRef(0);
  const historyEndRef = useRef<HTMLDivElement | null>(null);
  const voiceEndedAtRef = useRef(0);

  const vadConfig = pipelineMode === "fast" ? FAST_VAD_CONFIG : VAD_CONFIG;

  const patient = getLanguage(patientLanguage);
  const patientGestureGuidance = TREATMENT_GESTURE_GUIDANCE.patients[patientLanguage];
  const latest = records.at(-1) ?? null;
  const criticalConfirmation = getCriticalConfirmationContent(
    latest?.status === "approved" ? latest.criticalInformation : undefined,
    patientLanguage,
  );

  const move = useCallback((next: HandsFreeState) => {
    const transitioned = transitionState(machineRef.current, next);
    machineRef.current = transitioned;
    setMachineState(transitioned);
  }, []);

  const setTreatmentModeState = useCallback((
    nextMode: TreatmentSessionMode,
    guidanceReady = false,
  ) => {
    modeRef.current = nextMode;
    setMode(nextMode);
    gestureGuidanceReadyRef.current = nextMode === "gesture-confirmation" && guidanceReady;
    setGestureGuidanceReady(nextMode === "gesture-confirmation" && guidanceReady);
  }, []);

  const addRecord = useCallback((record: Omit<TranslationRecord, "id" | "createdAt">) => {
    const id = createRandomId();
    setRecords((current) => [...current, { ...record, id, createdAt: Date.now() }]);
    return id;
  }, []);

  const updateRecord = useCallback((id: string, update: Partial<TranslationRecord>) => {
    setRecords((current) => current.map((record) => (
      record.id === id ? { ...record, ...update } : record
    )));
  }, []);

  const refreshMicrophones = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const available = devices.filter((device) => device.kind === "audioinput");
    setMicrophones(available);
    if (
      selectedMicrophone &&
      !available.some((device) => device.deviceId === selectedMicrophone)
    ) {
      setSelectedMicrophone("");
      window.localStorage.removeItem(MICROPHONE_STORAGE_KEY);
    }
  }, [selectedMicrophone]);

  const unlockAudio = useCallback(async () => {
    // Queue the native speech unlock synchronously inside the Start button's
    // user gesture. Awaiting HTMLMediaElement.play() first consumes Safari's
    // transient activation and leaves later hands-free speech blocked.
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(".");
      utterance.volume = 0;
      utterance.rate = 10;
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          utterance.onend = null;
          utterance.onerror = null;
          resolve();
        };
        // iPad Safari can omit `onend` for a zero-volume utterance. The short
        // watchdog still gives its TTS queue time to release before opening
        // getUserMedia, avoiding an AudioSession category race at startup.
        window.setTimeout(finish, 350);
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      });
      await delay(75);
    }

    // Native TTS does not use HTMLAudioElement. Playing a silent WAV here
    // needlessly switches the iPad media audio category and shows its volume
    // overlay at the start of every session.
    if (ttsProvider === "native") return;

    const audio = audioRef.current ?? new Audio();
    audio.setAttribute("playsinline", "true");
    audioRef.current = audio;
    const silentUrl = URL.createObjectURL(encodeMonoWav(new Float32Array(800), 8_000));
    try {
      audio.src = silentUrl;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // The real playback path retains native speech as a fallback.
    } finally {
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(silentUrl);
    }
  }, [ttsProvider]);

  const speakNative = useCallback((
    text: string,
    language: LanguageCode,
    onPlaybackStart?: () => void,
  ) => {
    if (!("speechSynthesis" in window)) {
      return Promise.reject(new Error("この端末では音声読み上げを利用できません。"));
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const languageDefinition = getLanguage(language);
    utterance.lang = languageDefinition.locale;
    const voice = selectNativeVoice(
      window.speechSynthesis.getVoices(),
      languageDefinition.locale,
    );
    if (voice) utterance.voice = voice;
    // Preserve the cadence used by the previously field-tested iPad build.
    // Voice selection already follows Safari's stable exact-locale order.
    utterance.rate = NATIVE_SPEECH_RATE;
    const controller = new AbortController();
    nativeSpeechAbortRef.current = controller;

    // Do not call cancel() immediately before speak(). WebKit can apply that
    // cancellation to the newly queued utterance as well. The helper also
    // recovers when iOS omits onend after audible playback.
    return playNativeSpeech(window.speechSynthesis, utterance, {
      onPlaybackStart,
      signal: controller.signal,
    }).finally(() => {
      if (nativeSpeechAbortRef.current === controller) {
        nativeSpeechAbortRef.current = null;
      }
    });
  }, []);

  const fetchWithRetry = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (!activeRef.current) throw new Error("会話は終了しました。");
      try {
        const response = await fetch(input, init);
        const retryable = shouldRetryHttpStatus(response.status);
        if (!retryable || attempt === 3) {
          const serviceUnavailable = !response.ok && retryable;
          reconnectAttemptsRef.current = serviceUnavailable ? attempt : 0;
          setNetworkState(serviceUnavailable ? "failed" : "online");
          return response;
        }
        lastError = new Error("翻訳サービスが一時的に応答していません。");
      } catch {
        lastError = new Error("ネットワークに接続できません。");
      }
      if (attempt < 3) {
        reconnectAttemptsRef.current = attempt;
        setNetworkState("reconnecting");
        await delay(350 * attempt);
      }
    }
    setNetworkState("failed");
    throw lastError ?? new Error("通信に失敗しました。");
  }, []);

  const playApprovedText = useCallback(async (
    text: string,
    targetLanguage: LanguageCode,
    speechToken?: string,
    fixedPhrase = false,
  ) => {
    move("speaking");
    const captureEngine = engineRef.current;
    captureEngine?.pause();
    let captureSuspended = false;
    let playbackReady = false;
    let playbackCompleted = false;
    let playbackStartRecorded = false;
    const recordPlaybackStart = () => {
      if (playbackStartRecorded || voiceEndedAtRef.current <= 0) return;
      playbackStartRecorded = true;
      setLastLatencyMs(Math.max(0, Math.round(performance.now() - voiceEndedAtRef.current)));
    };
    const ensurePlaybackReady = async () => {
      if (playbackReady) return;
      if (captureEngine?.isRunning) {
        captureSuspended = true;
        await captureEngine.suspendCaptureForPlayback();
      }
      // The capture graph is paused in-place (no AudioContext close/reopen),
      // so a short settle is sufficient. Keep the conservative delay for the
      // safe profile while FAST avoids an extra turn of iPad audio latency.
      await delay(pipelineMode === "fast" ? 20 : 80);
      playbackReady = true;
    };
    try {
      if (ttsProvider === "native" || fixedPhrase) {
        await ensurePlaybackReady();
        await speakNative(text, targetLanguage, recordPlaybackStart);
        playbackCompleted = true;
        return;
      }
      if (!speechToken) throw new Error("安全検査トークンがありません。");
      const response = await fetchWithRetry("/api/translation/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          text,
          targetLanguage,
          sessionId: sessionIdRef.current,
          speechToken,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "音声を再生できませんでした。"));
      const audioBytes = await response.arrayBuffer();
      await ensurePlaybackReady();
      const audioUrl = URL.createObjectURL(new Blob([audioBytes], {
        type: response.headers.get("content-type") ?? "audio/mpeg",
      }));
      audioUrlsRef.current.add(audioUrl);
      const audio = audioRef.current;
      if (!audio) throw new Error("音声出力を初期化できませんでした。");
      audio.setAttribute("src", audioUrl);
      audio.preload = "auto";
      audio.currentTime = 0;
      audio.load();
      try {
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const cleanup = () => {
            window.clearTimeout(watchdog);
            audio.removeEventListener("ended", completed);
            audio.removeEventListener("error", failed);
            audio.removeEventListener("playing", recordPlaybackStart);
          };
          const completed = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
          };
          const failed = () => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error("音声ファイルを再生できませんでした。"));
          };
          const watchdog = window.setTimeout(() => {
            audio.pause();
            failed();
          }, Math.min(30_000, Math.max(12_000, text.length * 650)));
          audio.addEventListener("ended", completed, { once: true });
          audio.addEventListener("error", failed, { once: true });
          audio.addEventListener("playing", recordPlaybackStart, { once: true });
          void audio.play().catch(failed);
        });
        playbackCompleted = true;
      } finally {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        URL.revokeObjectURL(audioUrl);
        audioUrlsRef.current.delete(audioUrl);
      }
    } catch (error) {
      if (ttsProvider !== "native" && !fixedPhrase) {
        await ensurePlaybackReady();
        await speakNative(text, targetLanguage, recordPlaybackStart);
        playbackCompleted = true;
      } else {
        throw error;
      }
    } finally {
      if (playbackCompleted) {
        const endedAt = Date.now();
        recentPlaybackRef.current = [
          ...recentPlaybackRef.current.filter(
            (played) => endedAt - played.endedAt <= PLAYBACK_ECHO_WINDOW_MS,
          ),
          { text, endedAt },
        ].slice(-4);
      }
      if (captureSuspended && activeRef.current) {
        await delay(vadConfig.playbackTailMs);
        await captureEngine?.resumeCaptureAfterPlayback();
      }
    }
  }, [fetchWithRetry, move, pipelineMode, speakNative, ttsProvider, vadConfig]);

  const finishTurn = useCallback(async () => {
    const currentState = machineRef.current;
    if (currentState === "listening" || currentState === "paused" || currentState === "idle") {
      processingRef.current = false;
      return;
    }
    if (currentState !== "cooldown") move("cooldown");
    await delay(vadConfig.cooldownMs);
    if (!activeRef.current) return;
    processingRef.current = false;
    if (pauseRequestedRef.current) {
      pauseRequestedRef.current = false;
      move("paused");
      return;
    }
    engineRef.current?.resumeListening();
    move("listening");
  }, [move, vadConfig.cooldownMs]);

  const playRepeatPrompt = useCallback(async (language: LanguageCode | "unknown") => {
    const promptLanguage = language === "unknown" ? patientLanguageRef.current : language;
    await playApprovedText(REPEAT_PROMPTS[promptLanguage], promptLanguage, undefined, true);
  }, [playApprovedText]);

  const recoverFromRejectedTranslation = useCallback(async (
    language: LanguageCode | "unknown",
  ) => {
    await recoverRejectedTurn({
      playPrompt: () => playRepeatPrompt(language),
      finishTurn,
      onPromptFailure: () => {
        setErrorMessage(
          "固定音声案内を再生できませんでした。画面の案内を確認してください。聞き取りは自動で再開します。",
        );
      },
    });
  }, [finishTurn, playRepeatPrompt]);

  const explainTreatmentGesture = useCallback(async (
    recordId: string,
    language: PatientLanguageCode,
  ) => {
    setTreatmentModeState("gesture-confirmation", false);
    const guidance = TREATMENT_GESTURE_GUIDANCE.patients[language];
    const translatedText = `${guidance.instruction} ${guidance.observation}`;
    updateRecord(recordId, {
      detectedLanguage: "ja",
      targetLanguage: language,
      translatedText,
      status: "fixed",
    });
    await playApprovedText(translatedText, language, undefined, true);
    if (activeRef.current && modeRef.current === "gesture-confirmation") {
      setTreatmentModeState("gesture-confirmation", true);
    }
  }, [playApprovedText, setTreatmentModeState, updateRecord]);

  const confirmTreatmentGesture = useCallback(async (
    recordId: string,
    language: PatientLanguageCode,
  ) => {
    if (
      modeRef.current !== "gesture-confirmation" ||
      !gestureGuidanceReadyRef.current
    ) {
      throw new Error("患者への手の合図の説明と実演確認が完了していません。");
    }
    const translatedText = TREATMENT_MODE_MESSAGES.start[language];
    updateRecord(recordId, {
      detectedLanguage: "ja",
      targetLanguage: language,
      translatedText,
      status: "fixed",
    });
    // Do not enter treatment mode until the patient-language confirmation has
    // played successfully. A blocked or interrupted TTS must fail safe in the
    // hand-signal confirmation stage.
    await playApprovedText(translatedText, language, undefined, true);
    if (activeRef.current && modeRef.current === "gesture-confirmation") {
      setTreatmentModeState("treatment");
    }
  }, [playApprovedText, setTreatmentModeState, updateRecord]);

  const confirmTreatmentGestureByButton = useCallback(async () => {
    if (
      !activeRef.current ||
      modeRef.current !== "gesture-confirmation" ||
      !gestureGuidanceReadyRef.current ||
      machineRef.current !== "listening" ||
      processingRef.current
    ) return;
    processingRef.current = true;
    setErrorMessage(null);
    const language = patientLanguageRef.current;
    const recordId = addRecord({
      detectedLanguage: "ja",
      targetLanguage: language,
      sourceText: "手の合図を確認しました（目視確認）",
      translatedText: "",
      status: "processing",
      issues: [],
    });
    try {
      await confirmTreatmentGesture(recordId, language);
      await finishTurn();
    } catch (error) {
      const message = error instanceof Error ? error.message : "治療前の手の合図を確認できませんでした。";
      updateRecord(recordId, { status: "rejected", issues: [message] });
      setErrorMessage(message);
      if (activeRef.current) await finishTurn();
    } finally {
      processingRef.current = false;
    }
  }, [addRecord, confirmTreatmentGesture, finishTurn, updateRecord]);

  const cancelTreatmentGestureByButton = useCallback(async () => {
    if (
      !activeRef.current ||
      modeRef.current !== "gesture-confirmation" ||
      machineRef.current !== "listening" ||
      processingRef.current
    ) return;
    processingRef.current = true;
    setErrorMessage(null);
    const language = patientLanguageRef.current;
    const translatedText = TREATMENT_MODE_MESSAGES.cancel[language];
    const recordId = addRecord({
      detectedLanguage: "ja",
      targetLanguage: language,
      sourceText: "治療準備を中止しました（手動操作）",
      translatedText,
      status: "fixed",
      issues: [],
    });
    setTreatmentModeState("conversation");
    try {
      await playApprovedText(translatedText, language, undefined, true);
      await finishTurn();
    } catch (error) {
      const message = error instanceof Error ? error.message : "会話モードへ戻りましたが、案内を再生できませんでした。";
      updateRecord(recordId, { status: "rejected", issues: [message] });
      setErrorMessage(message);
      if (activeRef.current) await finishTurn();
    } finally {
      processingRef.current = false;
    }
  }, [addRecord, finishTurn, playApprovedText, setTreatmentModeState, updateRecord]);

  const transcribeAudio = useCallback(async (audio: Blob, language: PatientLanguageCode) => {
    const form = new FormData();
    form.set("audio", new File([audio], "sentence.wav", { type: "audio/wav" }));
    form.set("patientLanguage", language);
    form.set("sessionId", sessionIdRef.current);
    // Both profiles compare Japanese and the selected patient language. The
    // two forced-language transcription requests run in parallel, so FAST
    // regains short dental-phrase accuracy without serializing the wait.
    const response = await fetchWithRetry("/api/translation/transcribe", {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    // Low-confidence/noise-only candidates are an expected outcome in a
    // hands-free room. Ignore them silently instead of speaking the fixed
    // "please repeat" prompt, which would make the app appear to act by itself
    // and could itself create another acoustic trigger.
    if (response.status === 422) throw new NoSpeechDetectedError();
    if (!response.ok) {
      throw new Error(await responseError(response, "音声を文字にできませんでした。"));
    }
    const result = (await response.json()) as { text?: unknown };
    if (typeof result.text !== "string" || !result.text.trim()) {
      throw new Error("はっきりした音声を認識できませんでした。");
    }
    return result.text.trim();
  }, [fetchWithRetry]);

  const processSentence = useCallback(async (audio: Blob) => {
    if (!activeRef.current || processingRef.current) return;
    processingRef.current = true;
    setErrorMessage(null);
    const language = patientLanguageRef.current;
    let recordId: string | null = null;
    let detectedForPrompt: LanguageCode | "unknown" = "unknown";
    let rejectionCommitted = false;
    try {
      move("transcribing");
      const sourceText = await transcribeAudio(audio, language);
      audio = new Blob();
      if (isLikelyPlaybackEcho(sourceText, recentPlaybackRef.current)) {
        await finishTurn();
        return;
      }
      recordId = addRecord({
        detectedLanguage: "unknown",
        targetLanguage: null,
        sourceText,
        translatedText: "",
        status: "processing",
        issues: [],
      });

      const command = matchTreatmentCommand(sourceText);
      const currentMode = modeRef.current;
      const nextMode = command
        ? transitionTreatmentSessionMode(currentMode, command)
        : null;
      if (command === "start" && nextMode === "gesture-confirmation") {
        await explainTreatmentGesture(recordId, language);
        await finishTurn();
        return;
      }
      if (command === "confirm" && nextMode === "treatment") {
        if (!gestureGuidanceReadyRef.current) {
          rejectionCommitted = true;
          updateRecord(recordId, {
            detectedLanguage: "ja",
            status: "rejected",
            issues: ["患者言語の説明再生と手上げの目視確認が完了していません"],
          });
          await finishTurn();
          return;
        }
        await confirmTreatmentGesture(recordId, language);
        await finishTurn();
        return;
      }
      if (command === "end" && nextMode === "conversation") {
        const translatedText = currentMode === "treatment"
          ? TREATMENT_MODE_MESSAGES.end[language]
          : TREATMENT_MODE_MESSAGES.cancel[language];
        setTreatmentModeState("conversation");
        updateRecord(recordId, {
          detectedLanguage: "ja",
          targetLanguage: language,
          translatedText,
          status: "fixed",
        });
        await playApprovedText(translatedText, language, undefined, true);
        await finishTurn();
        return;
      }

      if (modeRef.current === "gesture-confirmation") {
        rejectionCommitted = true;
        updateRecord(recordId, {
          detectedLanguage: "unknown",
          status: "rejected",
          issues: ["手の合図を確認中です。患者の手上げを目視確認後、「手の合図を確認しました」と話してください"],
        });
        await finishTurn();
        return;
      }

      if (modeRef.current === "treatment") {
        const fixed = matchTreatmentPhrase(sourceText);
        if (!fixed) {
          rejectionCommitted = true;
          updateRecord(recordId, {
            detectedLanguage: "unknown",
            status: "rejected",
            issues: ["治療モードでは登録済みの日本語フレーズ以外を再生しません"],
          });
          await finishTurn();
          return;
        }
        const translatedText = fixed.translations[language];
        updateRecord(recordId, {
          detectedLanguage: "ja",
          targetLanguage: language,
          translatedText,
          status: "fixed",
        });
        await playApprovedText(translatedText, language, undefined, true);
        await finishTurn();
        return;
      }

      move("translating");
      if (pipelineMode === "fast") {
        const fastResponse = await fetchWithRetry("/api/translation/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            phase: "fast",
            sourceText,
            patientLanguage: language,
            sessionId: sessionIdRef.current,
          }),
        });
        if (!fastResponse.ok) {
          throw new Error(await responseError(fastResponse, "低遅延医療翻訳を完了できませんでした。"));
        }
        const fast = (await fastResponse.json()) as VerifyResponse;
        const translation = fast.translation;
        if (!translation) throw new Error(fast.error ?? "低遅延翻訳結果を確認できませんでした。");
        detectedForPrompt = translation.detectedLanguage;
        move("verifying");
        updateRecord(recordId, {
          detectedLanguage: translation.detectedLanguage,
          targetLanguage: fast.targetLanguage ?? null,
          sourceText: translation.sourceText,
          translatedText: translation.translatedText,
          criticalInformation: translation.criticalInformation,
        });
        const issues = fast.review?.issues?.filter((issue) => typeof issue === "string") ?? [];
        const mayPlay = canPlayCheckedTranslation({
          reviewPassed: fast.review?.passed === true,
          translatedText: translation.translatedText,
          speechToken: fast.speechToken,
        });
        if (!mayPlay || !fast.targetLanguage) {
          rejectionCommitted = true;
          updateRecord(recordId, {
            status: "rejected",
            issues: issues.length ? issues : ["高速安全検査に合格しなかったため、訳文を再生しません"],
          });
          await recoverFromRejectedTranslation(translation.detectedLanguage);
          return;
        }
        updateRecord(recordId, { status: "approved", issues: [] });
        await playApprovedText(
          translation.translatedText,
          fast.targetLanguage,
          fast.speechToken,
        );
        await finishTurn();
        return;
      }

      const translationResponse = await fetchWithRetry("/api/translation/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          phase: "translate",
          sourceText,
          patientLanguage: language,
          sessionId: sessionIdRef.current,
        }),
      });
      if (!translationResponse.ok) {
        throw new Error(await responseError(translationResponse, "医療翻訳を完了できませんでした。"));
      }
      const translated = (await translationResponse.json()) as TranslateResponse;
      if (!translated.translation) throw new Error(translated.error ?? "翻訳結果を確認できませんでした。");
      const translation = translated.translation;
      detectedForPrompt = translation.detectedLanguage;
      const targetLanguage = translation.detectedLanguage === "ja"
        ? language
        : translation.detectedLanguage === language
          ? "ja"
          : null;
      updateRecord(recordId, {
        detectedLanguage: translation.detectedLanguage,
        targetLanguage,
        sourceText: translation.sourceText,
        translatedText: translation.translatedText,
        criticalInformation: translation.criticalInformation,
      });

      if (
        !targetLanguage ||
        translation.needsConfirmation ||
        translation.confidence !== "high" ||
        !translation.translatedText.trim()
      ) {
        rejectionCommitted = true;
        updateRecord(recordId, {
          status: "rejected",
          issues: ["言語または内容を安全に確定できなかったため、訳文を再生しません"],
        });
        await recoverFromRejectedTranslation(translation.detectedLanguage);
        return;
      }

      move("verifying");
      const verificationResponse = await fetchWithRetry("/api/translation/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          phase: "verify",
          translation,
          patientLanguage: language,
          sessionId: sessionIdRef.current,
        }),
      });
      if (!verificationResponse.ok) {
        throw new Error(await responseError(verificationResponse, "独立安全検査を完了できませんでした。"));
      }
      const verification = (await verificationResponse.json()) as VerifyResponse;
      const passed = verification.review?.passed === true;
      const issues = verification.review?.issues?.filter((issue) => typeof issue === "string") ?? [];
      const mayPlay = canPlayCheckedTranslation({
        reviewPassed: passed,
        translatedText: translation.translatedText,
        speechToken: verification.speechToken,
      });
      if (!mayPlay || verification.targetLanguage !== targetLanguage) {
        rejectionCommitted = true;
        updateRecord(recordId, {
          status: "rejected",
          issues: issues.length ? issues : ["重要情報の検査に合格しなかったため、訳文を再生しません"],
        });
        await recoverFromRejectedTranslation(translation.detectedLanguage);
        return;
      }

      updateRecord(recordId, { status: "approved", issues: [] });
      await playApprovedText(
        translation.translatedText,
        targetLanguage,
        verification.speechToken,
      );
      await finishTurn();
    } catch (error) {
      if (error instanceof NoSpeechDetectedError) {
        setErrorMessage(null);
        if (activeRef.current) await finishTurn();
        return;
      }
      const message = error instanceof Error ? error.message : "音声処理に失敗しました。";
      if (activeRef.current) {
        setErrorMessage(message);
        if (recordId && !rejectionCommitted) {
          updateRecord(recordId, { status: "rejected", issues: [message] });
        }
        try {
          if (["transcribing", "translating", "verifying"].includes(machineRef.current)) {
            await playRepeatPrompt(detectedForPrompt);
          }
        } catch {
          setErrorMessage(`${message} 端末の固定音声案内も再生できませんでした。`);
        }
        if (activeRef.current && machineRef.current !== "cooldown") await finishTurn();
      }
    } finally {
      audio = new Blob();
      processingRef.current = false;
    }
  }, [
    addRecord,
    confirmTreatmentGesture,
    explainTreatmentGesture,
    fetchWithRetry,
    finishTurn,
    move,
    pipelineMode,
    playApprovedText,
    playRepeatPrompt,
    recoverFromRejectedTranslation,
    setTreatmentModeState,
    transcribeAudio,
    updateRecord,
  ]);

  useEffect(() => {
    sentenceHandlerRef.current = (audio) => {
      void processSentence(audio);
    };
  }, [processSentence]);

  const createEngine = useCallback(() => new LocalVadEngine({
    onCalibrated: () => {
      if (activeRef.current && machineRef.current === "calibrating") move("listening");
    },
    onSpeechStart: () => {
      if (activeRef.current && machineRef.current === "listening") move("recording");
    },
    onSentence: (audio, metrics) => {
      voiceEndedAtRef.current = performance.now() - (
        metrics.reason === "silence" ? vadConfig.silenceEndMs : 0
      );
      sentenceHandlerRef.current(audio);
    },
    onNoiseIgnored: () => {
      if (activeRef.current && machineRef.current === "recording") move("listening");
      setManualRecording(false);
    },
    onError: (message) => {
      setErrorMessage(message);
      setNetworkState("reconnecting");
      window.setTimeout(() => {
        if (activeRef.current) reconnectHandlerRef.current();
      }, 250);
    },
  }, vadConfig), [move, vadConfig]);

  const reconnectMicrophone = useCallback(async () => {
    if (!activeRef.current || IS_MOCK_MODE || reconnectInFlightRef.current) return;
    reconnectInFlightRef.current = true;
    setErrorMessage(null);
    setNetworkState("reconnecting");
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await engineRef.current?.stop();
        if (machineRef.current !== "idle") move("idle");
        move("calibrating");
        const engine = createEngine();
        engineRef.current = engine;
        try {
          await engine.start(selectedMicrophone || undefined);
        } catch (error) {
          if (!selectedMicrophone) throw error;
          setSelectedMicrophone("");
          window.localStorage.removeItem(MICROPHONE_STORAGE_KEY);
          await engine.start();
        }
        reconnectAttemptsRef.current = 0;
        reconnectInFlightRef.current = false;
        setNetworkState("online");
        await refreshMicrophones();
        return;
      } catch (error) {
        lastError = error;
        reconnectAttemptsRef.current = attempt;
        if (machineRef.current !== "idle") move("idle");
        if (attempt < 3) await delay(350 * attempt);
      }
    }
    reconnectInFlightRef.current = false;
    setNetworkState("failed");
    setErrorMessage(microphoneErrorMessage(lastError));
  }, [createEngine, move, refreshMicrophones, selectedMicrophone]);

  useEffect(() => {
    reconnectHandlerRef.current = () => {
      void reconnectMicrophone();
    };
  }, [reconnectMicrophone]);

  const mockTurn = useCallback(async (
    turn: { detected: LanguageCode; source: string; translation: string },
    approved = true,
  ) => {
    if (!activeRef.current) return;
    move("recording");
    await delay(220);
    if (!activeRef.current) return;
    move("transcribing");
    const target = turn.detected === "ja" ? patientLanguageRef.current : "ja";
    const id = addRecord({
      detectedLanguage: turn.detected,
      targetLanguage: target,
      sourceText: turn.source,
      translatedText: "",
      status: "processing",
      issues: [],
    });
    await delay(260);
    if (!activeRef.current) return;
    move("translating");
    updateRecord(id, { translatedText: turn.translation, criticalInformation: EMPTY_CRITICAL });
    await delay(260);
    if (!activeRef.current) return;
    move("verifying");
    await delay(260);
    if (!activeRef.current) return;
    if (!approved) {
      updateRecord(id, {
        status: "rejected",
        issues: ["DEMO: 身体部位が一致しないため再生を停止しました"],
      });
      move("speaking");
    } else {
      updateRecord(id, { status: "approved" });
      move("speaking");
    }
    await delay(350);
    if (!activeRef.current) return;
    move("cooldown");
    await delay(180);
    if (activeRef.current) move("listening");
  }, [addRecord, move, updateRecord]);

  const runMockScenario = useCallback(async (runId: number) => {
    await delay(700);
    if (!activeRef.current || mockRunRef.current !== runId) return;
    move("listening");
    for (const turn of MOCK_TURNS[patientLanguageRef.current]) {
      await delay(500);
      if (!activeRef.current || mockRunRef.current !== runId) return;
      await mockTurn(turn);
    }
    await delay(500);
    if (!activeRef.current || mockRunRef.current !== runId) return;
    await mockTurn({
      detected: "zh",
      source: "我从昨天就开始牙疼。",
      translation: "昨日からお腹が痛いです。",
    }, false);
    if (!activeRef.current || mockRunRef.current !== runId) return;

    await delay(500);
    move("recording");
    await delay(180);
    move("transcribing");
    setTreatmentModeState("gesture-confirmation", false);
    const mockGuidance = TREATMENT_GESTURE_GUIDANCE.patients[patientLanguageRef.current];
    const gestureText = `${mockGuidance.instruction} ${mockGuidance.observation}`;
    addRecord({
      detectedLanguage: "ja",
      targetLanguage: patientLanguageRef.current,
      sourceText: "治療を始めます",
      translatedText: gestureText,
      status: "fixed",
      issues: [],
    });
    move("speaking");
    await delay(350);
    setTreatmentModeState("gesture-confirmation", true);
    move("cooldown");
    await delay(180);
    move("listening");

    await delay(500);
    move("recording");
    await delay(180);
    move("transcribing");
    const startText = TREATMENT_MODE_MESSAGES.start[patientLanguageRef.current];
    addRecord({
      detectedLanguage: "ja",
      targetLanguage: patientLanguageRef.current,
      sourceText: "手の合図を確認しました",
      translatedText: startText,
      status: "fixed",
      issues: [],
    });
    move("speaking");
    await delay(350);
    setTreatmentModeState("treatment");
    move("cooldown");
    await delay(180);
    move("listening");

    await delay(500);
    move("recording");
    await delay(180);
    move("transcribing");
    const phrase = matchTreatmentPhrase("口を開けてください");
    addRecord({
      detectedLanguage: "ja",
      targetLanguage: patientLanguageRef.current,
      sourceText: phrase?.japanese ?? "口を開けてください",
      translatedText: phrase?.translations[patientLanguageRef.current] ?? "",
      status: "fixed",
      issues: [],
    });
    move("speaking");
    await delay(350);
    move("cooldown");
    await delay(180);
    move("listening");

    await delay(500);
    move("recording");
    await delay(180);
    move("transcribing");
    setTreatmentModeState("conversation");
    addRecord({
      detectedLanguage: "ja",
      targetLanguage: patientLanguageRef.current,
      sourceText: "治療を終了します",
      translatedText: TREATMENT_MODE_MESSAGES.end[patientLanguageRef.current],
      status: "fixed",
      issues: [],
    });
    move("speaking");
    await delay(350);
    move("cooldown");
    await delay(180);
    move("listening");

    await delay(500);
    setNetworkState("offline");
    move("paused");
    await delay(500);
    setNetworkState("reconnecting");
    move("calibrating");
    await delay(600);
    setNetworkState("online");
    if (activeRef.current && mockRunRef.current === runId) move("listening");
  }, [addRecord, mockTurn, move, setTreatmentModeState]);

  const startSession = useCallback(async () => {
    if (!consented || activeRef.current) return;
    setErrorMessage(null);
    setRecords([]);
    setElapsed(0);
    setLastLatencyMs(null);
    setNetworkState("online");
    setTreatmentModeState("conversation");
    recentPlaybackRef.current = [];
    patientLanguageRef.current = patientLanguage;
    sessionIdRef.current = crypto.randomUUID();
    startedAtRef.current = Date.now();
    activeRef.current = true;
    pauseRequestedRef.current = false;
    processingRef.current = false;
    voiceEndedAtRef.current = 0;
    setScreen("session");
    move("calibrating");
    await unlockAudio();
    if (IS_MOCK_MODE) {
      const runId = mockRunRef.current + 1;
      mockRunRef.current = runId;
      void runMockScenario(runId);
      return;
    }
    const engine = createEngine();
    engineRef.current = engine;
    try {
      await engine.start(selectedMicrophone || undefined);
      await refreshMicrophones();
    } catch (error) {
      if (machineRef.current !== "idle") move("idle");
      setNetworkState("failed");
      setErrorMessage(microphoneErrorMessage(error));
    }
  }, [
    consented,
    createEngine,
    move,
    patientLanguage,
    refreshMicrophones,
    runMockScenario,
    selectedMicrophone,
    setTreatmentModeState,
    unlockAudio,
  ]);

  const endSession = useCallback(async () => {
    activeRef.current = false;
    mockRunRef.current += 1;
    processingRef.current = false;
    pauseRequestedRef.current = false;
    recentPlaybackRef.current = [];
    nativeSpeechAbortRef.current?.abort();
    nativeSpeechAbortRef.current = null;
    window.speechSynthesis?.cancel();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    await engineRef.current?.stop();
    engineRef.current = null;
    audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    audioUrlsRef.current.clear();
    machineRef.current = "idle";
    setMachineState("idle");
    setRecords([]);
    setTreatmentModeState("conversation");
    setElapsed(0);
    setLastLatencyMs(null);
    setErrorMessage(null);
    setManualRecording(false);
    sessionIdRef.current = "";
    setScreen("start");
  }, [setTreatmentModeState]);

  const togglePause = useCallback(() => {
    if (machineRef.current === "paused") {
      pauseRequestedRef.current = false;
      move("calibrating");
      if (IS_MOCK_MODE) {
        window.setTimeout(() => {
          if (activeRef.current && machineRef.current === "calibrating") move("listening");
        }, 650);
      } else {
        engineRef.current?.recalibrate();
      }
      return;
    }
    if (["listening", "calibrating"].includes(machineRef.current)) {
      engineRef.current?.pause();
      move("paused");
      return;
    }
    pauseRequestedRef.current = true;
  }, [move]);

  const stopPlaybackAndResume = useCallback(() => {
    nativeSpeechAbortRef.current?.abort();
    nativeSpeechAbortRef.current = null;
    window.speechSynthesis?.cancel();
    engineRef.current?.stopPlayback();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.dispatchEvent(new Event("ended"));
      audio.removeAttribute("src");
      audio.load();
    }
    setErrorMessage(null);
    if (machineRef.current === "speaking" || machineRef.current === "cooldown") {
      void finishTurn();
    }
  }, [finishTurn]);

  const toggleManualRecording = useCallback(() => {
    if (IS_MOCK_MODE || machineRef.current === "paused") return;
    if (!manualRecording) {
      if (engineRef.current?.forceStart()) {
        setManualRecording(true);
      }
    } else {
      engineRef.current?.forceEnd();
      setManualRecording(false);
    }
  }, [manualRecording]);

  useEffect(() => {
    patientLanguageRef.current = patientLanguage;
  }, [patientLanguage]);

  useEffect(() => {
    if (screen !== "session") return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [records]);

  useEffect(() => {
    const handleOffline = () => {
      setNetworkState("offline");
      if (!activeRef.current) return;
      if (["listening", "calibrating", "recording"].includes(machineRef.current)) {
        engineRef.current?.pause();
        move("paused");
      } else {
        pauseRequestedRef.current = true;
      }
    };
    const handleOnline = () => {
      setNetworkState("reconnecting");
      if (!activeRef.current) {
        setNetworkState("online");
        return;
      }
      if (machineRef.current === "paused") void reconnectMicrophone();
      else setNetworkState("online");
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [move, reconnectMicrophone]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!activeRef.current) return;
      if (document.visibilityState === "hidden") {
        if (["listening", "calibrating", "recording"].includes(machineRef.current)) {
          engineRef.current?.pause();
          move("paused");
        } else {
          pauseRequestedRef.current = true;
        }
        return;
      }
      if (document.visibilityState === "visible" && machineRef.current === "paused") {
        setNetworkState("reconnecting");
        if (IS_MOCK_MODE) {
          move("calibrating");
          window.setTimeout(() => {
            if (activeRef.current && machineRef.current === "calibrating") {
              setNetworkState("online");
              move("listening");
            }
          }, 650);
        } else {
          void reconnectMicrophone();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [move, reconnectMicrophone]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    const handler = () => void refreshMicrophones();
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handler);
  }, [refreshMicrophones]);

  useEffect(() => () => {
    activeRef.current = false;
    void engineRef.current?.stop();
    nativeSpeechAbortRef.current?.abort();
    window.speechSynthesis?.cancel();
    audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const networkLabel = useMemo(() => ({
    online: "接続中",
    reconnecting: "自動再接続中",
    offline: "ネットワーク切断",
    failed: "自動再接続に失敗",
  }[networkState]), [networkState]);

  if (screen === "start") {
    return (
      <main className="min-h-screen bg-[#f4f7f7] px-4 py-6 text-[#17323b] sm:px-8 lg:py-10">
        {IS_MOCK_MODE && (
          <div className="mx-auto mb-4 max-w-5xl rounded-xl border-2 border-[#b77700] bg-[#fff4c9] px-5 py-3 text-center font-black text-[#704b00]">
            DEMO / Mock Mode — 実際の診療には使用しないでください
          </div>
        )}
        {pipelineMode === "fast" && (
          <div className="mx-auto mb-4 max-w-5xl rounded-xl border-2 border-[#b77700] bg-[#fff4c9] px-5 py-3 text-center font-black text-[#704b00]">
            FAST / 3秒目標 — 単一GPT翻訳＋端末内ハード検査の試験モード
          </div>
        )}
        <section className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-[#cfdddd] bg-white">
          <div className="border-b border-[#d6e1e2] bg-[#176077] px-6 py-7 text-white sm:px-10">
            <p className="text-sm font-black tracking-[0.22em] text-[#b9e1e8]">DENTBRIDGE AI</p>
            <h1 className="mt-2 text-4xl font-black sm:text-5xl">ハンズフリー歯科通訳</h1>
            <p className="mt-3 max-w-3xl text-base font-bold leading-7 text-[#e6f4f6]">
              一度開始すると、発話の開始と終了、言語、翻訳方向を自動で判定します。
            </p>
          </div>

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <label className="text-sm font-black text-[#46636b]" htmlFor="patient-language">
                患者の言語
              </label>
              <select
                id="patient-language"
                className="mt-2 min-h-16 w-full rounded-xl border-2 border-[#bfd0d2] bg-white px-4 text-xl font-black"
                value={patientLanguage}
                onChange={(event) => setPatientLanguage(event.target.value as PatientLanguageCode)}
              >
                {PATIENT_LANGUAGES.filter((language) => language.code !== "ja").map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.nativeName} / {language.japaneseName}
                  </option>
                ))}
              </select>

              <div className="mt-5 rounded-xl bg-[#edf5f4] p-4 text-sm font-bold leading-6">
                <div className="flex items-center gap-2 font-black">
                  <Microphone size={22} weight="bold" /> マイクについて
                </div>
                <p className="mt-2">開始後に約2秒間、周囲の騒音を測定します。その間は話さないでください。</p>
              </div>

              <details className="mt-4 rounded-xl border border-[#cbd9da] bg-white p-4">
                <summary className="flex cursor-pointer items-center gap-2 font-black">
                  <Gear size={21} weight="bold" /> マイク設定
                </summary>
                <label className="mt-4 block text-sm font-bold" htmlFor="start-microphone">使用するマイク</label>
                <select
                  id="start-microphone"
                  className="mt-2 min-h-12 w-full rounded-lg border border-[#bdcdcf] px-3 font-bold"
                  value={selectedMicrophone}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedMicrophone(value);
                    if (value) window.localStorage.setItem(MICROPHONE_STORAGE_KEY, value);
                    else window.localStorage.removeItem(MICROPHONE_STORAGE_KEY);
                  }}
                >
                  <option value="">端末の標準マイク</option>
                  {microphones.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `マイク ${index + 1}`}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-bold text-[#60777e]">マイクの選択だけを端末内に保存します。会話は保存しません。</p>
              </details>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[#d3dfe0] p-5">
                <h2 className="font-black">歯科医院向けの確認</h2>
                <ul className="mt-3 space-y-2 text-sm font-bold leading-6">
                  {JA_CONSENT.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-[#d3dfe0] p-5" lang={patient.locale}>
                <h2 className="font-black">{patient.consentTitle}</h2>
                <ul className="mt-3 space-y-2 text-sm font-bold leading-6">
                  {patient.consentItems.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#a9c6c2] bg-[#eef8f5] p-4 font-black">
                <input
                  type="checkbox"
                  className="mt-1 h-6 w-6 accent-[#2e806b]"
                  checked={consented}
                  onChange={(event) => setConsented(event.target.checked)}
                />
                上記を双方に説明し、同意を確認しました
              </label>
              <button
                type="button"
                className="min-h-20 w-full rounded-2xl bg-[#176077] px-6 text-2xl font-black text-white shadow-[0_7px_0_#0e4658] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!consented}
                onClick={() => void startSession()}
              >
                {pipelineMode === "fast" ? "高速会話を開始" : "会話を開始"}
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7f7] px-3 py-3 text-[#17323b] sm:px-6 sm:py-5">
      {IS_MOCK_MODE && (
        <div className="mx-auto mb-3 max-w-6xl rounded-lg border-2 border-[#b77700] bg-[#fff4c9] px-4 py-2 text-center text-sm font-black text-[#704b00]">
          DEMO / Mock Mode — 自動会話・検査失敗・治療モード・再接続を順番に実演します
        </div>
      )}
      {pipelineMode === "fast" && (
        <div className="mx-auto mb-3 max-w-6xl rounded-lg border-2 border-[#b77700] bg-[#fff4c9] px-4 py-2 text-center text-sm font-black text-[#704b00]">
          FAST / 3秒目標 — 独立した2回目のGPT検査は省略し、端末内ハード検査を使用中
        </div>
      )}
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#cfdddd] bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-black tracking-[0.2em] text-[#176077]">DENTBRIDGE AI</p>
            <h1 className="text-2xl font-black">日本語 ⇄ {patient.nativeName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[#cbd9da] px-3 font-black">
              <Clock size={22} weight="bold" /> {formatElapsed(elapsed)}
            </div>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-[#c55f55] bg-white px-4 font-black text-[#a8463c]"
              onClick={() => void endSession()}
            >
              会話を終了
            </button>
          </div>
        </header>

        <section className="mt-3 grid gap-3 md:grid-cols-[0.7fr_1.3fr]">
          <div className={`rounded-2xl border border-[#cbd9da] bg-white p-4 sm:p-5 ${mode === "gesture-confirmation" ? "md:row-start-2" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[#627a81]">現在のモード</p>
                <p className={`mt-1 text-2xl font-black ${mode === "conversation" ? "text-[#176077]" : "text-[#9b5f00]"}`}>
                  {mode === "treatment"
                    ? "治療モード"
                    : mode === "gesture-confirmation"
                      ? "手の合図を確認"
                      : "会話モード"}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${
                networkState === "online"
                  ? "bg-[#e3f3ed] text-[#286a58]"
                  : "bg-[#fff0ed] text-[#a2493f]"
              }`}>
                {networkLabel}
              </span>
            </div>
            <div
              className="mt-5 rounded-xl bg-[#edf4f4] p-4"
              aria-live="polite"
              aria-busy={PROCESSING_STATES.has(machineState)}
            >
              <p className="text-xs font-black text-[#627a81]">現在の状態</p>
              <div className="mt-2 flex items-center gap-3">
                {PROCESSING_STATES.has(machineState) ? (
                  <CircleNotch
                    className="status-spinner shrink-0"
                    size={24}
                    weight="bold"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className={machineState === "listening" ? "status-pulse" : "h-4 w-4 shrink-0 rounded-full bg-[#3b806c]"}
                    aria-hidden="true"
                  />
                )}
                <p className="text-lg font-black">{HANDS_FREE_STATUS[machineState]}</p>
              </div>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl border-2 border-[#dc8d82] bg-[#fff1ef] p-3 text-sm font-black text-[#8f3e35]" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="secondary-action" onClick={togglePause}>
                {machineState === "paused" ? <Play size={23} weight="fill" /> : <Pause size={23} weight="fill" />}
                {machineState === "paused" ? "マイクを再開" : "マイクを一時停止"}
              </button>
              {machineState === "speaking" || machineState === "cooldown" ? (
                <button type="button" className="secondary-action" onClick={stopPlaybackAndResume}>
                  <XCircle size={23} weight="bold" /> 再生を停止して聞き取り再開
                </button>
              ) : (networkState === "failed" || machineState === "idle") ? (
                <button type="button" className="secondary-action" onClick={() => void reconnectMicrophone()}>
                  <ArrowCounterClockwise size={23} weight="bold" /> 再接続
                </button>
              ) : (
                <div className="flex min-h-13 items-center justify-center rounded-xl border border-[#d3dfe0] bg-[#f7f9f9] px-3 text-center text-xs font-black text-[#657b82]">
                  自動リスニング中
                </div>
              )}
            </div>

            <details className="mt-3 rounded-xl border border-[#cbd9da] bg-white p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-black">
                <Gear size={20} weight="bold" /> 補助機能・手動モード
              </summary>
              <p className="mt-3 text-xs font-bold leading-5 text-[#60777e]">
                通常は使用しません。騒音で自動検出できない場合だけ、開始と終了を1回ずつ押します。
              </p>
              <button
                type="button"
                className="secondary-action mt-3 w-full"
                disabled={IS_MOCK_MODE || !["listening", "recording"].includes(machineState)}
                onClick={toggleManualRecording}
              >
                <Microphone size={22} weight="bold" />
                {manualRecording ? "手動録音を終了" : "手動録音を開始"}
              </button>
              <label className="mt-4 block text-xs font-black" htmlFor="session-microphone">使用するマイク</label>
              <select
                id="session-microphone"
                className="mt-2 min-h-11 w-full rounded-lg border border-[#bdcdcf] px-3 text-sm font-bold"
                value={selectedMicrophone}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedMicrophone(value);
                  if (value) window.localStorage.setItem(MICROPHONE_STORAGE_KEY, value);
                  else window.localStorage.removeItem(MICROPHONE_STORAGE_KEY);
                }}
              >
                <option value="">端末の標準マイク</option>
                {microphones.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || `マイク ${index + 1}`}</option>
                ))}
              </select>
              <button type="button" className="secondary-action mt-2 w-full" onClick={() => void reconnectMicrophone()}>
                選択したマイクを適用
              </button>
            </details>
          </div>

          {mode === "gesture-confirmation" && (
            <TreatmentGesturePanel
              patientLanguage={patientLanguage}
              guidanceReady={gestureGuidanceReady}
              machineState={machineState}
              onConfirm={() => void confirmTreatmentGestureByButton()}
              onCancel={() => void cancelTreatmentGestureByButton()}
            />
          )}

          <div
            className="rounded-2xl border-2 border-[#bcd0d1] bg-white p-5 sm:p-7"
            aria-live="polite"
            aria-busy={latest?.status === "processing"}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[#627a81]">いちばん新しい発話</p>
                <p className="mt-1 text-sm font-bold text-[#60777e]">
                  {latest ? formatTime(latest.createdAt) : "話しかけると自動で表示します"}
                </p>
                {lastLatencyMs !== null && (
                  <p className={`mt-1 text-sm font-black ${lastLatencyMs < 3_000 ? "text-[#26735d]" : "text-[#a05b00]"}`}>
                    発話終了 → 再生開始 {(lastLatencyMs / 1_000).toFixed(2)}秒
                  </p>
                )}
              </div>
              {latest && (
                <span
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                    latest.status === "approved" || latest.status === "fixed"
                      ? "bg-[#e1f3eb] text-[#256b57]"
                      : latest.status === "rejected"
                        ? "bg-[#fff0d5] text-[#855500]"
                        : "bg-[#e7eff1] text-[#49656d]"
                  }`}
                >
                  {latest.status === "approved" || latest.status === "fixed"
                    ? <CheckCircle size={17} weight="fill" />
                    : latest.status === "rejected"
                      ? <Warning size={17} weight="fill" />
                      : <CircleNotch className="status-spinner shrink-0" size={17} weight="bold" aria-hidden="true" />}
                  {latest.status === "approved"
                    ? pipelineMode === "fast" ? "高速検査済み" : "検査済み"
                    : latest.status === "fixed" ? "登録済みフレーズ" : latest.status === "rejected" ? "再生停止" : "処理中"}
                </span>
              )}
            </div>

            <div className="mt-5 border-l-4 border-[#3e8ba0] pl-4">
              <p className="text-xs font-black text-[#4a6b74]">原文</p>
              <p className="mt-2 min-h-14 text-2xl font-black leading-snug sm:text-3xl">
                {latest?.sourceText || "—"}
              </p>
            </div>
            <div className="mt-6 border-l-4 border-[#3d9075] pl-4">
              <p className="flex items-center gap-2 text-xs font-black text-[#34745f]">
                <SpeakerHigh size={19} weight="fill" /> {pipelineMode === "fast" ? "高速検査後の訳文" : "検査後の訳文"}
              </p>
              <p className="mt-2 min-h-16 text-3xl font-black leading-snug text-[#236c57] sm:text-4xl">
                {latest?.translatedText || (latest?.status === "processing" ? (
                  <span className="inline-flex items-center gap-3 text-lg text-[#547078] sm:text-xl">
                    <CircleNotch className="status-spinner shrink-0" size={30} weight="bold" aria-hidden="true" />
                    訳文を処理しています
                  </span>
                ) : "—")}
              </p>
            </div>

            {latest?.status === "rejected" && (
              <div className="mt-5 rounded-xl border-2 border-[#d4a02a] bg-[#fff7df] p-4 text-sm font-black text-[#72500b]">
                <div className="flex items-center gap-2"><XCircle size={22} weight="fill" /> この訳文は再生していません</div>
                <ul className="mt-2 space-y-1">
                  {latest.issues.map((issue) => <li key={issue}>• {issue}</li>)}
                </ul>
              </div>
            )}
            {criticalConfirmation.keys.length > 0 && (
              <div className="mt-5 rounded-xl border-2 border-[#d4a02a] bg-[#fff7df] p-4 text-sm font-black text-[#72500b]">
                <div className="flex items-center gap-2"><Flag size={22} weight="fill" /> 重要内容・双方で再確認</div>
                <p className="mt-2">確認項目：{criticalConfirmation.japaneseLabels.join("・")}</p>
                <p className="mt-1" lang={patient.locale}>
                  {criticalConfirmation.patientLabels.join("・")}
                </p>
                <p className="mt-2 leading-6" lang={patient.locale}>
                  {criticalConfirmation.patientInstruction}
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="mt-3 rounded-2xl border-2 border-[#d4a02a] bg-[#fff7df] px-4 py-3 text-sm font-black leading-6 text-[#72500b] sm:px-5">
          <div className="flex items-start gap-3">
            <Warning className="mt-0.5 shrink-0" size={24} weight="fill" />
            <p>AI翻訳は誤る場合があります。アレルギー、薬、麻酔、手術、費用、リスク、左右、歯の番号、数字は必ず双方で再確認してください。</p>
          </div>
        </div>

        {mode === "treatment" && (
          <div className="mt-3 grid gap-3 rounded-2xl border-2 border-[#b97818] bg-[#fff3df] px-5 py-4 font-bold leading-7 text-[#704706] md:grid-cols-2">
            <div className="flex items-start gap-3" lang="ja">
              <HandPalm className="mt-0.5 shrink-0" size={26} weight="bold" aria-hidden="true" />
              <p>{TREATMENT_GESTURE_GUIDANCE.japanese.reminder}</p>
            </div>
            <div className="border-t border-[#dfbf7e] pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0" lang={patient.locale}>
              <p>{patientGestureGuidance.reminder}</p>
            </div>
          </div>
        )}

        <section className="mt-3 rounded-2xl border border-[#cfdddd] bg-white">
          <div className="flex items-center justify-between border-b border-[#d7e1e2] px-5 py-4">
            <div>
              <h2 className="text-lg font-black">会話記録</h2>
              <p className="text-xs font-bold text-[#617980]">この会話を終了すると端末メモリから消去されます</p>
            </div>
            <span className="rounded-full bg-[#edf2f2] px-3 py-1 text-sm font-black">{records.length}件</span>
          </div>
          <div className="max-h-[32rem] space-y-3 overflow-y-auto p-4 sm:p-5">
            {records.length === 0 ? (
              <div className="py-10 text-center font-bold text-[#71868c]">会話を自動で待っています</div>
            ) : records.map((record) => (
              <article key={record.id} className={`rounded-xl border p-4 ${record.status === "rejected" ? "border-[#d8aa42] bg-[#fffaf0]" : "border-[#d4e0e1]"}`}>
                <div className="flex items-center justify-between gap-3 text-xs font-black text-[#627a81]">
                  <span>{record.detectedLanguage === "unknown" ? "言語不明" : getLanguage(record.detectedLanguage).nativeName}</span>
                  <time>{formatTime(record.createdAt)}</time>
                </div>
                <p className="mt-3 border-l-4 border-[#4b96aa] pl-3 text-lg font-black">{record.sourceText}</p>
                {record.translatedText && (
                  <p className="mt-3 border-l-4 border-[#4a967c] pl-3 text-xl font-black text-[#276c58]">{record.translatedText}</p>
                )}
                {record.issues.length > 0 && <p className="mt-3 text-sm font-black text-[#8a5a00]">{record.issues.join(" / ")}</p>}
              </article>
            ))}
            <div ref={historyEndRef} />
          </div>
        </section>
      </div>
    </main>
  );
}
