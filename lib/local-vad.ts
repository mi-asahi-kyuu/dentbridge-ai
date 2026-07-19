import { EnergyVadDetector, encodeMonoWav, type VadEvent } from "./energy-vad";
import { VAD_CONFIG, type VadConfig } from "./vad-config";

type AudioWorkletMessage = { samples?: Float32Array };

export type LocalVadCallbacks = {
  onCalibrated: (metrics: { noiseFloor: number; threshold: number }) => void;
  onSpeechStart: () => void;
  onSentence: (audio: Blob, metrics: { durationMs: number; reason: string }) => void;
  onNoiseIgnored: () => void;
  onError: (message: string) => void;
};

type LegacyAudioContext = typeof AudioContext & {
  new (): AudioContext;
};

export class LocalVadEngine {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private detector: EnergyVadDetector | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private playbackSource: AudioBufferSourceNode | null = null;
  private finishPlayback: (() => void) | null = null;
  private selectedDeviceId: string | undefined;
  private detectorSampleRate = 0;
  private ignoreInputUntil = 0;

  constructor(
    private readonly callbacks: LocalVadCallbacks,
    private readonly config: Readonly<VadConfig> = VAD_CONFIG,
  ) {}

  get isRunning() {
    return Boolean(this.stream && this.context);
  }

  async start(deviceId?: string) {
    await this.stop();
    this.selectedDeviceId = deviceId;
    await this.openCapture(false);
  }

  async suspendCaptureForPlayback() {
    // Keep the MediaStream and AudioContext alive while TTS is playing. The
    // detector is paused, so no microphone frames are uploaded, and keeping
    // the graph avoids iPad Safari's AudioSession category race plus the
    // costly close/reopen cycle on every sentence.
    this.detector?.pause();
    // Do not toggle MediaStreamTrack.enabled here. The paused detector already
    // discards every frame, while toggling an iPad input track can make its
    // echo cancellation and automatic gain control settle again immediately
    // before the next speaker starts.
  }

  async resumeCaptureAfterPlayback() {
    if (this.isRunning) {
      this.ignoreInputUntil = performance.now() + this.config.postPlaybackGuardMs;
      this.detector?.resumeListening();
      return;
    }
    await this.openCapture(true);
    this.detector?.resumeListening();
    this.ignoreInputUntil = performance.now() + this.config.postPlaybackGuardMs;
  }

  private async openCapture(preserveDetector: boolean) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("このブラウザではマイクを利用できません。HTTPSで開いてください。");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        ...(this.selectedDeviceId ? { deviceId: { exact: this.selectedDeviceId } } : {}),
      },
      video: false,
    });
    const AudioContextConstructor = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: LegacyAudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("このブラウザはWeb Audio APIに対応していません。");
    }

    const context = new AudioContextConstructor();
    await context.resume();
    this.stream = stream;
    this.context = context;
    if (!preserveDetector || !this.detector || this.detectorSampleRate !== context.sampleRate) {
      this.detector = new EnergyVadDetector(context.sampleRate, this.config);
      this.detectorSampleRate = context.sampleRate;
    }
    this.source = context.createMediaStreamSource(stream);
    this.sink = context.createGain();
    this.sink.gain.value = 0;

    try {
      if (context.audioWorklet && "AudioWorkletNode" in window) {
        await context.audioWorklet.addModule("/audio-worklets/vad-capture.js");
        const worklet = new AudioWorkletNode(context, "vad-capture-processor");
        worklet.port.onmessage = (event: MessageEvent<AudioWorkletMessage>) => {
          if (event.data.samples) this.handleSamples(event.data.samples);
        };
        this.processor = worklet;
      } else {
        const processor = context.createScriptProcessor(2_048, 1, 1);
        processor.onaudioprocess = (event) => {
          this.handleSamples(event.inputBuffer.getChannelData(0).slice());
        };
        this.processor = processor;
      }
      this.source.connect(this.processor);
      this.processor.connect(this.sink);
      this.sink.connect(context.destination);
    } catch (error) {
      await this.releaseCapture();
      throw error;
    }
  }

  pause() {
    this.detector?.pause();
  }

  recalibrate() {
    this.detector?.calibrate();
  }

  resumeListening() {
    this.detector?.resumeListening();
  }

  async playAudio(encodedAudio: ArrayBuffer) {
    const context = this.context;
    if (!context || context.state === "closed") {
      throw new Error("音声出力を初期化できませんでした。");
    }
    this.stopPlayback();
    if (context.state === "suspended") await context.resume();
    const decoded = await context.decodeAudioData(encodedAudio.slice(0));
    await new Promise<void>((resolve, reject) => {
      const source = context.createBufferSource();
      const output = context.createGain();
      source.buffer = decoded;
      source.connect(output);
      output.connect(context.destination);
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        source.onended = null;
        try {
          source.disconnect();
          output.disconnect();
        } catch {
          // Safari may already have disconnected a completed source.
        }
        if (this.playbackSource === source) {
          this.playbackSource = null;
          this.finishPlayback = null;
        }
        if (error) reject(error);
        else resolve();
      };
      const watchdog = window.setTimeout(() => {
        try {
          source.stop();
        } catch {
          // The source may already have ended while the timeout was queued.
        }
        finish(new Error("音声ファイルの再生が完了しませんでした。"));
      }, Math.min(45_000, Math.max(8_000, decoded.duration * 1_000 + 5_000)));
      this.playbackSource = source;
      this.finishPlayback = () => finish();
      source.onended = () => finish();
      try {
        source.start();
      } catch (error) {
        finish(error instanceof Error ? error : new Error("音声ファイルを再生できませんでした。"));
      }
    });
  }

  stopPlayback() {
    const source = this.playbackSource;
    const finish = this.finishPlayback;
    if (source) {
      try {
        source.stop();
      } catch {
        // A completed AudioBufferSourceNode cannot be stopped twice.
      }
    }
    finish?.();
  }

  forceStart() {
    const started = this.detector?.forceStart() ?? false;
    if (started) this.callbacks.onSpeechStart();
    return started;
  }

  forceEnd() {
    for (const event of this.detector?.forceEnd() ?? []) this.handleEvent(event);
  }

  async stop() {
    this.stopPlayback();
    await this.releaseCapture();
    this.detector = null;
    this.detectorSampleRate = 0;
    this.ignoreInputUntil = 0;
    this.selectedDeviceId = undefined;
  }

  private async releaseCapture() {
    if (this.processor && "onaudioprocess" in this.processor) this.processor.onaudioprocess = null;
    if (this.processor && "port" in this.processor) this.processor.port.onmessage = null;
    this.processor?.disconnect();
    this.source?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed") await this.context.close();
    this.stream = null;
    this.context = null;
    this.source = null;
    this.processor = null;
    this.sink = null;
  }

  private handleSamples(samples: Float32Array) {
    if (performance.now() < this.ignoreInputUntil) return;
    try {
      for (const event of this.detector?.process(samples) ?? []) this.handleEvent(event);
    } catch {
      this.callbacks.onError("ローカル音声検出でエラーが発生しました。再接続してください。");
    }
  }

  private handleEvent(event: VadEvent) {
    if (event.type === "calibration-complete") {
      this.callbacks.onCalibrated({ noiseFloor: event.noiseFloor, threshold: event.threshold });
    } else if (event.type === "speech-start") {
      this.callbacks.onSpeechStart();
    } else if (event.type === "noise-ignored") {
      this.callbacks.onNoiseIgnored();
    } else {
      this.detector?.pause();
      this.callbacks.onSentence(encodeMonoWav(event.samples, event.sampleRate), {
        durationMs: event.durationMs,
        reason: event.reason,
      });
    }
  }
}
