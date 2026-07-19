import type {CSSProperties, ReactNode} from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const palette = {
  background: "#f4f7f7",
  ink: "#17323b",
  muted: "#60777e",
  line: "#cfdddd",
  soft: "#edf4f4",
  blue: "#176077",
  blueLight: "#b9e1e8",
  source: "#3e8ba0",
  green: "#2f7f6a",
  greenDark: "#236c57",
  greenSoft: "#e3f3ed",
  amber: "#c58a20",
  amberDark: "#704b00",
  amberSoft: "#fff7df",
  red: "#a8463c",
  white: "#ffffff",
} as const;

export const fontFamily =
  'Inter, -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Noto Sans JP", Arial, sans-serif';

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const sceneFade = (frame: number, durationInFrames: number, fps: number) =>
  interpolate(
    frame,
    [0, 0.35 * fps, durationInFrames - 0.45 * fps, durationInFrames],
    [0, 1, 1, 0],
    {...clamp, easing: Easing.inOut(Easing.quad)},
  );

export function FadeScene({children}: {readonly children: ReactNode}) {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const opacity = sceneFade(frame, durationInFrames, fps);
  const rise = interpolate(frame, [0, 0.45 * fps], [18, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{opacity, transform: `translateY(${rise}px)`}}>
      {children}
    </AbsoluteFill>
  );
}

export function Spinner({size = 30, color = palette.green}: {readonly size?: number; readonly color?: string}) {
  const frame = useCurrentFrame();
  const rotation = (frame * 11) % 360;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${Math.max(3, Math.round(size / 8))}px solid ${color}2b`,
        borderTopColor: color,
        display: "inline-block",
        transform: `rotate(${rotation}deg)`,
        flexShrink: 0,
      }}
    />
  );
}

export function ListeningDot({size = 23}: {readonly size?: number}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const phase = (frame % (1.3 * fps)) / (1.3 * fps);
  const outer = interpolate(phase, [0, 0.65, 1], [0.2, 1, 0.2], clamp);
  return (
    <span style={{position: "relative", width: size + 20, height: size + 20, display: "inline-flex", alignItems: "center", justifyContent: "center"}}>
      <span
        style={{
          position: "absolute",
          width: size + 18,
          height: size + 18,
          borderRadius: "50%",
          background: palette.green,
          opacity: 0.08 + outer * 0.2,
          transform: `scale(${0.75 + outer * 0.28})`,
        }}
      />
      <span style={{width: size, height: size, borderRadius: "50%", background: palette.green, position: "relative"}} />
    </span>
  );
}

export function Pill({
  children,
  tone = "green",
  style,
}: {
  readonly children: ReactNode;
  readonly tone?: "green" | "amber" | "blue" | "neutral";
  readonly style?: CSSProperties;
}) {
  const colors = {
    green: [palette.greenSoft, "#286a58"],
    amber: ["#fff0d5", "#855500"],
    blue: ["#e4f0f3", palette.blue],
    neutral: ["#edf2f2", "#49656d"],
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "9px 17px",
        background: colors[0],
        color: colors[1],
        fontSize: 20,
        lineHeight: 1,
        fontWeight: 900,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Brand({inverse = false}: {readonly inverse?: boolean}) {
  return (
    <div>
      <div
        style={{
          color: inverse ? palette.blueLight : palette.blue,
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: "0.2em",
        }}
      >
        DENTBRIDGE AI
      </div>
      <div style={{color: inverse ? palette.white : palette.ink, fontSize: 39, fontWeight: 950, marginTop: 4}}>
        日本語 <span style={{fontWeight: 500}}>⇄</span> English
      </div>
    </div>
  );
}

export function AppHeader({elapsed = "00:18"}: {readonly elapsed?: string}) {
  return (
    <div
      style={{
        height: 112,
        borderRadius: 25,
        border: `2px solid ${palette.line}`,
        background: palette.white,
        padding: "19px 31px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Brand />
      <div style={{display: "flex", gap: 14, alignItems: "center"}}>
        <div style={{border: `2px solid ${palette.line}`, borderRadius: 18, padding: "16px 23px", fontSize: 26, fontWeight: 900}}>
          ◷ {elapsed}
        </div>
        <div style={{border: `2px solid #d9837a`, color: palette.red, borderRadius: 18, padding: "16px 23px", fontSize: 24, fontWeight: 900}}>
          会話を終了
        </div>
      </div>
    </div>
  );
}

export type Mode = "conversation" | "gesture" | "treatment";
export type StatusKind = "calibrating" | "listening" | "recording" | "processing" | "verifying" | "speaking" | "ready";

const statusLabels: Record<StatusKind, string> = {
  calibrating: "約2秒間、周囲の音を確認しています",
  listening: "話しかけてください・自動で聞いています",
  recording: "話していることを検出しました",
  processing: "音声を認識して翻訳しています",
  verifying: "重要な内容を安全確認しています",
  speaking: "検査済みの訳文を再生しています",
  ready: "聞き取りを自動で再開しました",
};

export function StatusPanel({mode, status}: {readonly mode: Mode; readonly status: StatusKind}) {
  const isBusy = ["calibrating", "processing", "verifying"].includes(status);
  return (
    <div style={{border: `2px solid ${palette.line}`, borderRadius: 26, background: palette.white, padding: 27, height: "100%", boxSizing: "border-box"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
        <div>
          <div style={{fontSize: 18, color: palette.muted, fontWeight: 900}}>現在のモード</div>
          <div style={{fontSize: 39, fontWeight: 950, color: mode === "conversation" ? palette.blue : palette.amberDark, marginTop: 7}}>
            {mode === "conversation" ? "会話モード" : mode === "gesture" ? "手の合図を確認" : "治療モード"}
          </div>
        </div>
        <Pill tone="green">● 接続中</Pill>
      </div>
      <div style={{background: palette.soft, borderRadius: 19, padding: "22px 20px", marginTop: 26}}>
        <div style={{fontSize: 18, color: palette.muted, fontWeight: 900}}>現在の状態</div>
        <div style={{display: "flex", alignItems: "center", gap: 14, marginTop: 14, minHeight: 44}}>
          {isBusy ? <Spinner size={31} /> : <ListeningDot size={22} />}
          <div style={{fontSize: 27, fontWeight: 950, lineHeight: 1.25}}>{statusLabels[status]}</div>
        </div>
      </div>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 22}}>
        <div style={secondaryButton}>Ⅱ&nbsp; マイクを一時停止</div>
        <div style={{...secondaryButton, color: palette.muted, background: "#f7f9f9"}}>自動リスニング中</div>
      </div>
      <div style={{...secondaryButton, marginTop: 13, justifyContent: "flex-start", paddingLeft: 23}}>⚙&nbsp; 補助機能・手動モード</div>
      <div style={{marginTop: 28, borderTop: `2px solid #dbe4e5`, paddingTop: 22}}>
        <div style={{fontSize: 17, fontWeight: 900, color: palette.muted}}>HANDSFREE PIPELINE</div>
        <div style={{fontSize: 20, fontWeight: 850, lineHeight: 1.55, marginTop: 9}}>
          Local VAD → Speech-to-text →<br />Translation → Safety check → Voice
        </div>
      </div>
    </div>
  );
}

const secondaryButton: CSSProperties = {
  height: 66,
  border: `2px solid ${palette.line}`,
  borderRadius: 17,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  fontWeight: 900,
  background: palette.white,
};

export function TextReveal({text, progress}: {readonly text: string; readonly progress: number}) {
  const count = Math.max(0, Math.min(text.length, Math.ceil(text.length * progress)));
  return <>{text.slice(0, count)}</>;
}

export type TranscriptProps = {
  readonly sourceLanguage: string;
  readonly source: string;
  readonly translatedLanguage: string;
  readonly translated: string;
  readonly status: StatusKind;
  readonly badge?: string;
  readonly fixedPhrase?: boolean;
  readonly critical?: readonly string[];
  readonly sourceProgress?: number;
  readonly translationProgress?: number;
  readonly latency?: string;
};

export function TranscriptPanel({
  sourceLanguage,
  source,
  translatedLanguage,
  translated,
  status,
  badge,
  fixedPhrase = false,
  critical = [],
  sourceProgress = 1,
  translationProgress = 1,
  latency,
}: TranscriptProps) {
  const busy = status === "calibrating" || status === "processing" || status === "verifying";
  return (
    <div style={{border: `3px solid #bcd0d1`, borderRadius: 28, background: palette.white, padding: "28px 34px", height: "100%", boxSizing: "border-box", overflow: "hidden"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
        <div>
          <div style={{fontSize: 18, fontWeight: 900, color: palette.muted}}>いちばん新しい発話</div>
          <div style={{fontSize: 19, fontWeight: 800, color: palette.muted, marginTop: 5}}>Voice detected automatically</div>
          {latency ? <div style={{fontSize: 18, fontWeight: 900, color: palette.green, marginTop: 6}}>Speech end → playback {latency}</div> : null}
        </div>
        {busy ? (
          <Pill tone="neutral"><Spinner size={18} color={palette.blue} /> 処理中</Pill>
        ) : (
          <Pill tone={fixedPhrase ? "amber" : "green"}>✓ {badge ?? (fixedPhrase ? "登録済みフレーズ" : "検査済み")}</Pill>
        )}
      </div>

      <div style={{borderLeft: `7px solid ${palette.source}`, paddingLeft: 25, marginTop: 28}}>
        <div style={{fontSize: 20, color: "#4a6b74", fontWeight: 900}}>原文 · {sourceLanguage}</div>
        <div style={{fontSize: source.length > 55 ? 38 : 46, lineHeight: 1.26, fontWeight: 950, marginTop: 13, minHeight: 75}}>
          <TextReveal text={source} progress={sourceProgress} />
        </div>
      </div>

      <div style={{borderLeft: `7px solid ${palette.green}`, paddingLeft: 25, marginTop: 29}}>
        <div style={{fontSize: 20, color: palette.green, fontWeight: 900}}>🔊 検査後の訳文 · {translatedLanguage}</div>
        <div style={{fontSize: translated.length > 64 ? 37 : 47, lineHeight: 1.28, fontWeight: 950, color: palette.greenDark, marginTop: 13, minHeight: 120}}>
          {busy && translationProgress <= 0 ? (
            <span style={{fontSize: 25, color: palette.muted, display: "flex", alignItems: "center", gap: 14}}>
              <Spinner size={28} /> 訳文を処理しています
            </span>
          ) : (
            <TextReveal text={translated} progress={translationProgress} />
          )}
        </div>
      </div>

      {critical.length > 0 ? (
        <div style={{marginTop: 24, border: `3px solid #d4a02a`, background: palette.amberSoft, color: "#72500b", borderRadius: 18, padding: "16px 20px"}}>
          <div style={{fontSize: 20, fontWeight: 950}}>⚑ 重要内容・双方で再確認</div>
          <div style={{fontSize: 19, fontWeight: 850, marginTop: 8}}>確認項目：{critical.join("・")}</div>
        </div>
      ) : null}
    </div>
  );
}

export function SafetyBar({treatment = false}: {readonly treatment?: boolean}) {
  return (
    <div
      style={{
        borderRadius: 19,
        border: `3px solid ${treatment ? "#b97818" : "#d4a02a"}`,
        background: treatment ? "#fff3df" : palette.amberSoft,
        color: "#72500b",
        padding: "16px 23px",
        fontSize: 20,
        fontWeight: 900,
        lineHeight: 1.35,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{fontSize: 30}}>⚠</span>
      {treatment
        ? "During treatment, use the agreed hand signal for pain or a break. The clinic must keep observing the patient."
        : "AI translation can make mistakes. Reconfirm allergy, medication, anesthesia, side, tooth number, dose and dates."}
    </div>
  );
}

export function AppViewport({
  mode,
  status,
  transcript,
  elapsed,
  banner,
}: {
  readonly mode: Mode;
  readonly status: StatusKind;
  readonly transcript: TranscriptProps;
  readonly elapsed?: string;
  readonly banner?: ReactNode;
}) {
  return (
    <AbsoluteFill style={{background: palette.background, color: palette.ink, fontFamily, padding: "44px 65px"}}>
      {banner ? <div style={{height: 58, marginBottom: 15}}>{banner}</div> : null}
      <AppHeader elapsed={elapsed} />
      <div style={{display: "grid", gridTemplateColumns: "540px 1fr", gap: 18, height: banner ? 676 : 750, marginTop: 18}}>
        <StatusPanel mode={mode} status={status} />
        <TranscriptPanel {...transcript} status={status} />
      </div>
      <div style={{marginTop: 18}}><SafetyBar treatment={mode === "treatment"} /></div>
    </AbsoluteFill>
  );
}

export function ProgressSteps({active}: {readonly active: number}) {
  const steps = ["Local VAD", "Transcribe", "Translate", "Verify", "Speak"];
  return (
    <div style={{display: "flex", alignItems: "center", justifyContent: "center", gap: 13}}>
      {steps.map((step, index) => (
        <div key={step} style={{display: "flex", alignItems: "center", gap: 13}}>
          <div style={{display: "flex", alignItems: "center", gap: 9, borderRadius: 999, padding: "11px 17px", background: index < active ? palette.greenSoft : index === active ? "#e4f0f3" : "#edf2f2", color: index < active ? palette.green : index === active ? palette.blue : palette.muted, fontSize: 18, fontWeight: 900}}>
            <span>{index < active ? "✓" : index + 1}</span>{step}
          </div>
          {index < steps.length - 1 ? <span style={{fontSize: 22, color: "#91a5aa"}}>→</span> : null}
        </div>
      ))}
    </div>
  );
}

export function ScaleIn({children, delayFrames = 0}: {readonly children: ReactNode; readonly delayFrames?: number}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const amount = spring({frame: frame - delayFrames, fps, config: {damping: 200}, durationInFrames: 0.6 * fps});
  return <div style={{opacity: amount, transform: `scale(${0.94 + amount * 0.06})`}}>{children}</div>;
}
