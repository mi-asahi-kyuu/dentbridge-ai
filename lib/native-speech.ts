export type NativeSpeechOptions = {
  onPlaybackStart?: () => void;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  startTimeoutMs?: number;
  maximumDurationMs?: number;
};

export class NativeSpeechError extends Error {
  constructor(
    message: string,
    readonly code: "not-started" | "playback-error",
  ) {
    super(message);
    this.name = "NativeSpeechError";
  }
}

export function nativeSpeechMaximumDuration(text: string) {
  const characterCount = Array.from(text).length;
  return Math.min(60_000, Math.max(10_000, characterCount * 600 + 5_000));
}

/**
 * Safari sometimes omits SpeechSynthesisUtterance.onend even though playback
 * completed. Observe the synthesis state as a second completion signal, while
 * keeping a hard upper bound for a genuinely wedged iOS speech queue.
 */
export function playNativeSpeech(
  synthesis: SpeechSynthesis,
  utterance: SpeechSynthesisUtterance,
  options: NativeSpeechOptions = {},
) {
  const {
    onPlaybackStart,
    signal,
    pollIntervalMs = 100,
    startTimeoutMs = 2_500,
    maximumDurationMs = nativeSpeechMaximumDuration(utterance.text),
  } = options;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let playbackStarted = false;
    let idlePolls = 0;
    let pollTimer = 0;
    let startTimer = 0;
    let watchdog = 0;

    const cleanup = () => {
      window.clearTimeout(pollTimer);
      window.clearTimeout(startTimer);
      window.clearTimeout(watchdog);
      utterance.onstart = null;
      utterance.onboundary = null;
      utterance.onend = null;
      utterance.onerror = null;
      signal?.removeEventListener("abort", abortPlayback);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const markPlaybackStarted = () => {
      if (playbackStarted) return;
      playbackStarted = true;
      onPlaybackStart?.();
    };

    const abortPlayback = () => {
      // Resolve and detach WebKit handlers before cancel(). Safari may emit a
      // synchronous `interrupted` error from cancel; it must not turn a user
      // requested stop into a playback failure.
      finish();
      synthesis.cancel();
    };

    const poll = () => {
      if (settled) return;
      if (synthesis.speaking) {
        markPlaybackStarted();
        idlePolls = 0;
      } else if (synthesis.pending) {
        idlePolls = 0;
      } else if (playbackStarted) {
        // Requiring two idle observations avoids treating the short gap
        // between queueing and actual playback as a completed utterance.
        idlePolls += 1;
        if (idlePolls >= 2) {
          finish();
          return;
        }
      }
      pollTimer = window.setTimeout(poll, pollIntervalMs);
    };

    utterance.onstart = markPlaybackStarted;
    utterance.onboundary = markPlaybackStarted;
    utterance.onend = () => finish();
    utterance.onerror = () => finish(new NativeSpeechError(
      "端末の音声読み上げを開始できませんでした。",
      "playback-error",
    ));

    signal?.addEventListener("abort", abortPlayback, { once: true });
    if (signal?.aborted) {
      abortPlayback();
      return;
    }

    startTimer = window.setTimeout(() => {
      if (!playbackStarted && !synthesis.speaking && !synthesis.pending) {
        finish(new NativeSpeechError(
          "端末の音声読み上げを開始できませんでした。",
          "not-started",
        ));
      }
    }, startTimeoutMs);

    watchdog = window.setTimeout(() => {
      if (playbackStarted) {
        // iOS can leave `speaking` stuck after audible playback. Once start
        // was observed, recover to listening without showing a false failure.
        finish();
      } else {
        finish(new NativeSpeechError(
          "端末の音声読み上げを開始できませんでした。",
          "not-started",
        ));
      }
      synthesis.cancel();
    }, maximumDurationMs);

    try {
      synthesis.resume();
      synthesis.speak(utterance);
      pollTimer = window.setTimeout(poll, pollIntervalMs);
    } catch (error) {
      finish(error instanceof Error
        ? error
        : new NativeSpeechError("端末の音声読み上げを開始できませんでした。", "playback-error"));
    }
  });
}
