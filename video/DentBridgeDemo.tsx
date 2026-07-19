import type {CSSProperties, ReactNode} from "react";
import {Audio} from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  AUDIO_CUES,
  CHIME_SECONDS,
  SCENES,
  VIDEO_FPS,
} from "./timeline";
import {
  AppHeader,
  AppViewport,
  Brand,
  FadeScene,
  ListeningDot,
  Pill,
  ProgressSteps,
  SafetyBar,
  Spinner,
  fontFamily,
  palette,
} from "./components/DemoUi";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const sec = (seconds: number) => Math.round(seconds * VIDEO_FPS);

function Scene({window, children}: {readonly window: {from: number; to: number}; readonly children: ReactNode}) {
  return (
    <Sequence
      from={sec(window.from)}
      durationInFrames={sec(window.to - window.from)}
      premountFor={VIDEO_FPS}
    >
      <FadeScene>{children}</FadeScene>
    </Sequence>
  );
}

function AudioTimeline() {
  return (
    <>
      {AUDIO_CUES.map((cue) => (
        <Sequence key={`${cue.file}-${cue.start}`} from={sec(cue.start)} premountFor={VIDEO_FPS}>
          <Audio src={staticFile(`demo/audio/${cue.file}`)} volume={cue.volume ?? 1} />
        </Sequence>
      ))}
      {CHIME_SECONDS.map((start) => (
        <Sequence key={`chime-${start}`} from={sec(start)} premountFor={VIDEO_FPS}>
          <Audio src={staticFile("demo/audio/verified-chime.wav")} volume={0.65} />
        </Sequence>
      ))}
    </>
  );
}

function IntroScene() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const iconScale = spring({frame, fps, config: {damping: 170}, durationInFrames: sec(0.8)});
  const line = interpolate(frame, [sec(0.8), sec(1.6)], [0, 1], clamp);

  return (
    <AbsoluteFill style={{background: palette.blue, color: palette.white, fontFamily, overflow: "hidden"}}>
      <div style={{position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "radial-gradient(circle at 20% 20%, #ffffff 0 2px, transparent 3px)", backgroundSize: "54px 54px"}} />
      <div style={{position: "absolute", width: 720, height: 720, borderRadius: "50%", background: "#2f7f6a", opacity: 0.45, right: -170, top: -260}} />
      <div style={{display: "grid", gridTemplateColumns: "1fr 440px", alignItems: "center", height: "100%", padding: "118px 160px"}}>
        <div>
          <div style={{fontSize: 25, fontWeight: 900, letterSpacing: "0.22em", color: palette.blueLight}}>DENTBRIDGE AI</div>
          <h1 style={{fontSize: 82, lineHeight: 1.04, margin: "26px 0 0", fontWeight: 950, letterSpacing: "-0.04em"}}>
            Japanese dental care,<br />understood.
          </h1>
          <div style={{height: 5, width: 560 * line, borderRadius: 99, background: "#9ed8c6", marginTop: 36}} />
          <div style={{display: "flex", gap: 17, alignItems: "center", marginTop: 33, fontSize: 36, fontWeight: 900}}>
            日本語 <span style={{fontWeight: 500, opacity: 0.75}}>⇄</span> English
          </div>
          <div style={{marginTop: 30, fontSize: 28, color: "#d9eff2", fontWeight: 750}}>Hands-free translation for Japanese dental clinics</div>
        </div>
        <div style={{display: "flex", justifyContent: "center"}}>
          <div style={{width: 330, height: 330, borderRadius: 82, background: "rgba(255,255,255,0.12)", padding: 34, transform: `scale(${0.88 + iconScale * 0.12})`, boxShadow: "0 32px 90px rgba(0,0,0,0.2)"}}>
            <Img src={staticFile("icon-512.png")} style={{width: "100%", height: "100%", borderRadius: 58}} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SetupScene() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const click = spring({frame: frame - sec(4.6), fps, config: {damping: 12, stiffness: 180}});
  const buttonScale = 1 - click * 0.035;
  return (
    <AbsoluteFill style={{background: palette.background, color: palette.ink, fontFamily, padding: "54px 105px"}}>
      <div style={{display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 44, height: "100%"}}>
        <div style={{background: palette.blue, borderRadius: 34, padding: "58px 52px", color: palette.white, display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
          <Brand inverse />
          <div>
            <Pill tone="green" style={{background: "#d9f2e8"}}>ONE TAP TO START</Pill>
            <h2 style={{fontSize: 52, lineHeight: 1.12, margin: "27px 0 0", fontWeight: 950}}>ハンズフリー<br />歯科通訳</h2>
            <p style={{fontSize: 25, lineHeight: 1.6, color: "#d8edf1", fontWeight: 700, marginTop: 25}}>
              一度開始すると、発話の開始と終了、言語、翻訳方向を自動で判定します。
            </p>
          </div>
        </div>
        <div style={{background: palette.white, border: `2px solid ${palette.line}`, borderRadius: 34, padding: "45px 50px"}}>
          <div style={{fontSize: 19, fontWeight: 900, color: palette.muted}}>患者の言語 / PATIENT LANGUAGE</div>
          <div style={{border: `3px solid ${palette.blue}`, background: "#f7fbfc", borderRadius: 20, padding: "22px 26px", fontSize: 31, fontWeight: 950, marginTop: 15, display: "flex", justifyContent: "space-between"}}>
            <span>English <span style={{fontSize: 23, color: palette.muted}}>／ 英語</span></span><span>⌄</span>
          </div>
          <div style={{border: `2px solid #e1c06f`, background: palette.amberSoft, borderRadius: 21, padding: "24px 28px", marginTop: 24}}>
            <div style={{fontSize: 21, fontWeight: 950, color: palette.amberDark}}>AI translation & privacy notice</div>
            <ul style={{fontSize: 20, lineHeight: 1.55, fontWeight: 750, margin: "13px 0 0", paddingLeft: 27}}>
              <li>AI translation may contain errors.</li>
              <li>Important medical details must be reconfirmed.</li>
              <li>No diagnosis or treatment decisions.</li>
              <li>Test version saves no recordings or conversation.</li>
            </ul>
          </div>
          <div style={{display: "flex", gap: 13, alignItems: "center", marginTop: 22, fontSize: 19, fontWeight: 900}}>
            <span style={{width: 28, height: 28, borderRadius: 7, background: palette.green, color: "white", display: "grid", placeItems: "center"}}>✓</span>
            Consent confirmed with both sides
          </div>
          <div style={{marginTop: 22, height: 74, borderRadius: 20, background: palette.green, color: palette.white, fontSize: 27, fontWeight: 950, display: "grid", placeItems: "center", transform: `scale(${buttonScale})`, boxShadow: "0 13px 28px rgba(47,127,106,0.18)"}}>
            高速会話を開始 / Start session
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function CalibrationScene() {
  return (
    <AppViewport
      mode="conversation"
      status="calibrating"
      elapsed="00:02"
      banner={<div style={fastBanner}>FAST / 3-second target — on-device hard safety checks</div>}
      transcript={{
        sourceLanguage: "English",
        source: "—",
        translatedLanguage: "日本語",
        translated: "—",
        status: "calibrating",
      }}
    />
  );
}

const fastBanner: CSSProperties = {
  height: "100%",
  borderRadius: 16,
  border: `2px solid ${palette.amber}`,
  background: "#fff1c8",
  color: palette.amberDark,
  display: "grid",
  placeItems: "center",
  fontSize: 20,
  fontWeight: 950,
};

function PatientPainScene() {
  const frame = useCurrentFrame();
  const status = frame < sec(3) ? "recording" : frame < sec(4.6) ? "processing" : frame < sec(5.2) ? "verifying" : frame < sec(8.6) ? "speaking" : "ready";
  const sourceProgress = interpolate(frame, [sec(0.2), sec(2.6)], [0, 1], clamp);
  const translationProgress = interpolate(frame, [sec(5.1), sec(7.1)], [0, 1], clamp);
  return (
    <AppViewport
      mode="conversation"
      status={status}
      elapsed="00:18"
      banner={<ProgressSteps active={status === "recording" ? 0 : status === "processing" ? 2 : status === "verifying" ? 3 : 5} />}
      transcript={{
        sourceLanguage: "English",
        source: "My lower right back tooth has hurt since yesterday.",
        translatedLanguage: "日本語",
        translated: "右下の奥歯が昨日から痛いです。",
        status,
        badge: "高速検査済み",
        critical: frame > sec(7.2) ? ["身体部位", "症状", "時期", "左右・位置"] : [],
        sourceProgress,
        translationProgress: status === "processing" || status === "verifying" ? 0 : translationProgress,
        latency: frame > sec(5.1) ? "2.84 sec" : undefined,
      }}
    />
  );
}

function DentistColdScene() {
  const frame = useCurrentFrame();
  const status = frame < sec(2.4) ? "recording" : frame < sec(4.2) ? "processing" : frame < sec(4.9) ? "verifying" : "speaking";
  const sourceProgress = interpolate(frame, [sec(0.2), sec(2)], [0, 1], clamp);
  const translationProgress = interpolate(frame, [sec(5.1), sec(6.8)], [0, 1], clamp);
  return (
    <AppViewport
      mode="conversation"
      status={status}
      elapsed="00:29"
      transcript={{
        sourceLanguage: "日本語",
        source: "冷たいものがしみますか？",
        translatedLanguage: "English",
        translated: "Are you sensitive to cold?",
        status,
        badge: "高速検査済み",
        critical: frame > sec(6.2) ? ["症状"] : [],
        sourceProgress,
        translationProgress: status === "processing" || status === "verifying" ? 0 : translationProgress,
        latency: frame > sec(5) ? "2.31 sec" : undefined,
      }}
    />
  );
}

function AllergyScene() {
  const frame = useCurrentFrame();
  const status = frame < sec(2.6) ? "recording" : frame < sec(4.4) ? "processing" : frame < sec(5.1) ? "verifying" : frame < sec(8.2) ? "speaking" : "ready";
  const sourceProgress = interpolate(frame, [sec(0.2), sec(2.2)], [0, 1], clamp);
  const translationProgress = interpolate(frame, [sec(5.2), sec(7.2)], [0, 1], clamp);
  return (
    <AppViewport
      mode="conversation"
      status={status}
      elapsed="00:39"
      transcript={{
        sourceLanguage: "English",
        source: "I am not allergic to any medication.",
        translatedLanguage: "日本語",
        translated: "薬のアレルギーはありません。",
        status,
        badge: "高速検査済み",
        critical: frame > sec(7.2) ? ["アレルギー", "薬", "否定表現"] : [],
        sourceProgress,
        translationProgress: status === "processing" || status === "verifying" ? 0 : translationProgress,
        latency: frame > sec(5.2) ? "2.47 sec" : undefined,
      }}
    />
  );
}

function StartTreatmentScene() {
  const frame = useCurrentFrame();
  const status = frame < sec(1.8) ? "recording" : frame < sec(3.2) ? "processing" : "ready";
  return (
    <AppViewport
      mode="gesture"
      status={status}
      elapsed="00:47"
      transcript={{
        sourceLanguage: "日本語",
        source: "治療を始めます。",
        translatedLanguage: "English",
        translated: "Preparing the stop-signal confirmation before treatment.",
        status,
        badge: "音声コマンド",
        sourceProgress: interpolate(frame, [0, sec(1.3)], [0, 1], clamp),
        translationProgress: interpolate(frame, [sec(2.4), sec(3.7)], [0, 1], clamp),
      }}
    />
  );
}

function HandSignalScene() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const handRaise = spring({frame: frame - sec(14.8), fps, config: {damping: 11, stiffness: 105}, durationInFrames: sec(1.2)});
  const ready = frame > sec(15.7);
  return (
    <AbsoluteFill style={{background: palette.background, color: palette.ink, fontFamily, padding: "38px 62px"}}>
      <AppHeader elapsed="00:58" />
      <div style={{marginTop: 18, border: `3px solid ${palette.amber}`, background: "#fff8e7", borderRadius: 28, padding: "28px 34px", height: 760, display: "grid", gridTemplateRows: "auto 1fr auto", gap: 18}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <div>
            <div style={{fontSize: 18, fontWeight: 900, color: "#82601e", letterSpacing: "0.1em"}}>治療を始める前に必要です</div>
            <div style={{fontSize: 40, fontWeight: 950, color: "#60420a", marginTop: 5}}>治療前の手の合図確認</div>
          </div>
          <Pill tone={ready ? "green" : "amber"}>{ready ? "✓ 目視確認" : <><Spinner size={19} color={palette.amber} /> Patient instruction</>}</Pill>
        </div>
        <div style={{display: "grid", gridTemplateColumns: "0.8fr 1.2fr 280px", gap: 18}}>
          <div style={gestureCard}>
            <div style={{fontSize: 19, fontWeight: 950, color: "#745619"}}>歯科医師・助手への説明</div>
            <div style={{fontSize: 25, fontWeight: 900, lineHeight: 1.55, marginTop: 16}}>
              痛い、苦しい、休みたい時は、動かしやすい方の手を上げてください。手が上がったら、すぐに治療を止めます。
            </div>
            <div style={{borderTop: "2px solid #eadcb6", paddingTop: 17, marginTop: 19, fontSize: 19, lineHeight: 1.5, fontWeight: 800, color: "#5d5543"}}>
              Appは手の合図を自動検出しません。歯科医師・助手が目で確認します。
            </div>
          </div>
          <div style={{...gestureCard, border: "3px solid #afcfc4", background: "#f3faf7"}}>
            <div style={{fontSize: 24, fontWeight: 950, color: palette.greenDark}}>Confirm the stop signal before treatment</div>
            <div style={{fontSize: 28, fontWeight: 900, lineHeight: 1.45, marginTop: 16, color: "#1f5548"}}>
              During treatment, if you feel pain, discomfort, or need a break, clearly raise whichever hand is easiest to move. We will stop treatment immediately when we see your hand. To confirm, please raise it once now.
            </div>
            <div style={{borderTop: "2px solid #cde2db", paddingTop: 15, marginTop: 18, fontSize: 19, lineHeight: 1.45, fontWeight: 850, color: "#3e655b"}}>
              No camera detection. The dentist or assistant must watch the patient.
            </div>
          </div>
          <div style={{borderRadius: 24, background: palette.blue, color: palette.white, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative"}}>
            <div style={{fontSize: 102, transform: `translateY(${62 - handRaise * 82}px) rotate(${-13 + handRaise * 13}deg)`, transformOrigin: "bottom center"}}>✋</div>
            <div style={{fontSize: 21, fontWeight: 950, marginTop: 25, textAlign: "center", padding: "0 20px"}}>{ready ? "Patient raised a hand" : "Practice the stop signal"}</div>
            <div style={{marginTop: 12, fontSize: 16, fontWeight: 800, color: "#cce8ed", textAlign: "center"}}>Observed by clinic staff</div>
          </div>
        </div>
        <div style={{height: 66, borderRadius: 17, background: ready ? palette.green : palette.white, border: `2px solid ${ready ? palette.green : "#d7b761"}`, color: ready ? palette.white : "#624713", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 21, fontWeight: 950}}>
          {ready ? "✓ 手の合図を確認しました — Treatment may begin" : <><Spinner size={23} /> Patient-language guidance is playing</>}
        </div>
      </div>
    </AbsoluteFill>
  );
}

const gestureCard: CSSProperties = {
  borderRadius: 22,
  border: "2px solid #dfc98f",
  background: palette.white,
  padding: "24px 25px",
};

function TreatmentReadyScene() {
  const frame = useCurrentFrame();
  const status = frame < sec(1.7) ? "recording" : "speaking";
  return (
    <AppViewport
      mode="treatment"
      status={status}
      elapsed="01:08"
      transcript={{
        sourceLanguage: "日本語",
        source: "手の合図を確認しました。",
        translatedLanguage: "English",
        translated: "The hand signal to stop has been confirmed. Treatment will now begin.",
        status,
        badge: "確認済み",
        sourceProgress: interpolate(frame, [0, sec(1.7)], [0, 1], clamp),
        translationProgress: interpolate(frame, [sec(2.4), sec(6.3)], [0, 1], clamp),
      }}
    />
  );
}

function FixedPhraseScene({kind}: {readonly kind: "open" | "pain"}) {
  const frame = useCurrentFrame();
  const open = kind === "open";
  const status = frame < sec(1.65) ? "recording" : "speaking";
  return (
    <AppViewport
      mode="treatment"
      status={status}
      elapsed={open ? "01:13" : "01:17"}
      transcript={{
        sourceLanguage: "日本語",
        source: open ? "口を開けてください。" : "痛みはありますか？",
        translatedLanguage: "English",
        translated: open ? "Please open your mouth." : "Are you in pain?",
        status,
        badge: "登録済みフレーズ",
        fixedPhrase: true,
        sourceProgress: interpolate(frame, [0, sec(1.35)], [0, 1], clamp),
        translationProgress: interpolate(frame, [sec(1.7), sec(3.2)], [0, 1], clamp),
      }}
    />
  );
}

function EndTreatmentScene() {
  const frame = useCurrentFrame();
  const status = frame < sec(1.8) ? "recording" : frame < sec(2.3) ? "processing" : "speaking";
  const conversation = frame > sec(3.4);
  return (
    <AppViewport
      mode={conversation ? "conversation" : "treatment"}
      status={status}
      elapsed="01:24"
      transcript={{
        sourceLanguage: "日本語",
        source: "治療を終了します。",
        translatedLanguage: "English",
        translated: "Treatment is finished. Normal conversation translation has resumed.",
        status,
        badge: conversation ? "会話モードへ復帰" : "音声コマンド",
        sourceProgress: interpolate(frame, [0, sec(1.5)], [0, 1], clamp),
        translationProgress: interpolate(frame, [sec(2.2), sec(6.6)], [0, 1], clamp),
      }}
    />
  );
}

function OutroScene() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: palette.blue, color: palette.white, fontFamily, padding: "86px 128px"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
        <Brand inverse />
        <Pill tone="green" style={{fontSize: 19}}>FIELD-TEST MVP</Pill>
      </div>
      <h2 style={{fontSize: 67, margin: "75px 0 0", lineHeight: 1.08, fontWeight: 950}}>Translation that knows<br />where it must stop.</h2>
      <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22, marginTop: 58}}>
        {[
          ["⇄", "Translation only", "It never answers or diagnoses."],
          ["✓", "Safety before playback", "Unverified translations are not spoken."],
          ["◌", "No recordings stored", "Session content stays in memory only."],
        ].map(([icon, title, copy], index) => {
          const show = spring({frame: frame - index * sec(0.16), fps, config: {damping: 180}, durationInFrames: sec(0.65)});
          return (
            <div key={title} style={{borderRadius: 25, background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.18)", padding: "30px 31px", opacity: show, transform: `translateY(${18 - show * 18}px)`}}>
              <div style={{fontSize: 40, color: "#a4dfcd"}}>{icon}</div>
              <div style={{fontSize: 27, fontWeight: 950, marginTop: 19}}>{title}</div>
              <div style={{fontSize: 19, lineHeight: 1.5, color: "#d4e9ec", fontWeight: 700, marginTop: 10}}>{copy}</div>
            </div>
          );
        })}
      </div>
      <div style={{marginTop: 48, borderTop: "2px solid rgba(255,255,255,0.2)", paddingTop: 25, display: "flex", justifyContent: "space-between", fontSize: 19, fontWeight: 750, color: "#cde3e7"}}>
        <span>Not a substitute for clinical judgment or professional interpretation.</span>
        <span>Japanese dental clinics · iPad · Android · Web</span>
      </div>
    </AbsoluteFill>
  );
}

export function DentBridgeDemo() {
  return (
    <AbsoluteFill style={{background: palette.background}}>
      <AudioTimeline />
      <Scene window={SCENES.intro}><IntroScene /></Scene>
      <Scene window={SCENES.setup}><SetupScene /></Scene>
      <Scene window={SCENES.calibration}><CalibrationScene /></Scene>
      <Scene window={SCENES.patientPain}><PatientPainScene /></Scene>
      <Scene window={SCENES.dentistCold}><DentistColdScene /></Scene>
      <Scene window={SCENES.allergy}><AllergyScene /></Scene>
      <Scene window={SCENES.startTreatment}><StartTreatmentScene /></Scene>
      <Scene window={SCENES.handSignal}><HandSignalScene /></Scene>
      <Scene window={SCENES.treatmentReady}><TreatmentReadyScene /></Scene>
      <Scene window={SCENES.openMouth}><FixedPhraseScene kind="open" /></Scene>
      <Scene window={SCENES.painCheck}><FixedPhraseScene kind="pain" /></Scene>
      <Scene window={SCENES.endTreatment}><EndTreatmentScene /></Scene>
      <Scene window={SCENES.outro}><OutroScene /></Scene>
    </AbsoluteFill>
  );
}

export function DentBridgeThumbnail() {
  return (
    <AbsoluteFill style={{background: palette.blue, color: palette.white, fontFamily, padding: "90px 130px", display: "grid", gridTemplateColumns: "1fr 540px", alignItems: "center"}}>
      <div>
        <div style={{fontSize: 28, letterSpacing: "0.2em", fontWeight: 950, color: palette.blueLight}}>DENTBRIDGE AI</div>
        <div style={{fontSize: 80, fontWeight: 950, lineHeight: 1.04, marginTop: 30}}>Hands-free dental<br />translation</div>
        <div style={{display: "flex", gap: 18, marginTop: 43, alignItems: "center", fontSize: 37, fontWeight: 900}}>日本語 <span style={{opacity: 0.7}}>⇄</span> English</div>
        <div style={{marginTop: 35, fontSize: 25, color: "#d4e9ec", fontWeight: 750}}>American patient × Japanese dentist · Product demo</div>
      </div>
      <div style={{borderRadius: 48, background: palette.white, padding: 32, boxShadow: "0 30px 80px rgba(0,0,0,0.22)"}}>
        <div style={{background: palette.soft, borderRadius: 25, padding: "34px 32px"}}>
          <div style={{display: "flex", alignItems: "center", gap: 14}}><ListeningDot size={25} /><span style={{fontSize: 28, fontWeight: 950, color: palette.ink}}>Listening automatically</span></div>
          <div style={{marginTop: 34, borderLeft: `7px solid ${palette.source}`, paddingLeft: 22, fontSize: 27, color: palette.ink, fontWeight: 900}}>My lower right back tooth hurts.</div>
          <div style={{marginTop: 28, borderLeft: `7px solid ${palette.green}`, paddingLeft: 22, fontSize: 31, color: palette.greenDark, fontWeight: 950}}>右下の奥歯が痛いです。</div>
          <div style={{marginTop: 30}}><SafetyBar /></div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
