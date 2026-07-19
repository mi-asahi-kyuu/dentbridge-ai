import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {Brand, Pill, fontFamily, palette} from "./DemoUi";

export function CodexScene() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cards = [
    ["01", "Hands-free state machine", "One start tap, then automatic listening, recording, translation, verification, and playback."],
    ["02", "iPad field-test fixes", "VAD hysteresis, echo-loop prevention, native voice selection, and Safari audio recovery."],
    ["03", "Safety and delivery", "Deterministic gates, 119 automated tests, Docker deployment, Apache, and HTTPS."],
  ] as const;

  return (
    <AbsoluteFill
      style={{
        background: palette.background,
        color: palette.ink,
        fontFamily,
        padding: "64px 105px",
      }}
    >
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <Brand />
        <Pill tone="green">OPENAI BUILD WEEK</Pill>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.82fr 1.18fr",
          gap: 52,
          marginTop: 58,
          flex: 1,
        }}
      >
        <div
          style={{
            borderRadius: 34,
            background: palette.blue,
            color: palette.white,
            padding: "55px 50px",
            minHeight: 720,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                letterSpacing: "0.17em",
                fontWeight: 950,
                color: palette.blueLight,
              }}
            >
              HOW WE BUILT IT
            </div>
            <h2 style={{fontSize: 72, lineHeight: 1.02, margin: "28px 0 0", fontWeight: 950}}>
              Built with
              <br />
              Codex
            </h2>
            <p
              style={{
                fontSize: 27,
                lineHeight: 1.55,
                color: "#d6ebee",
                fontWeight: 750,
                marginTop: 36,
              }}
            >
              An engineering collaborator that turned real device observations into tested product behavior.
            </p>
          </div>
          <div
            style={{
              borderTop: "2px solid rgba(255,255,255,0.2)",
              paddingTop: 25,
              fontSize: 21,
              lineHeight: 1.55,
              color: "#bfe0e5",
              fontWeight: 850,
            }}
          >
            Field feedback → Codex implementation → iPad test → repeat
          </div>
        </div>
        <div style={{display: "grid", gap: 20, alignContent: "center"}}>
          {cards.map(([number, title, copy], index) => {
            const show = spring({
              frame: frame - index * Math.round(0.28 * fps),
              fps,
              config: {damping: 190},
              durationInFrames: Math.round(0.7 * fps),
            });
            return (
              <div
                key={number}
                style={{
                  borderRadius: 27,
                  background: palette.white,
                  border: "2px solid " + palette.line,
                  padding: "31px 35px",
                  display: "grid",
                  gridTemplateColumns: "70px 1fr",
                  gap: 25,
                  opacity: show,
                  transform: "translateY(" + (22 - show * 22) + "px)",
                  boxShadow: "0 16px 40px rgba(23,63,72,0.07)",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    background: index === 2 ? palette.green : palette.soft,
                    color: index === 2 ? palette.white : palette.blue,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 22,
                    fontWeight: 950,
                  }}
                >
                  {number}
                </div>
                <div>
                  <div style={{fontSize: 29, fontWeight: 950}}>{title}</div>
                  <div
                    style={{
                      fontSize: 20,
                      lineHeight: 1.5,
                      color: palette.muted,
                      fontWeight: 750,
                      marginTop: 8,
                    }}
                  >
                    {copy}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function GptScene() {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const steps = [
    ["01", "Local VAD", "Single utterance only"],
    ["02", "gpt-4o-transcribe", "Japanese + patient-language candidates"],
    ["03", "GPT-5.6", "Structured translation output"],
    ["04", "Safety gate", "Critical entities compared"],
    ["05", "Approved TTS", "Verified text only"],
  ] as const;

  return (
    <AbsoluteFill
      style={{
        background: palette.blue,
        color: palette.white,
        fontFamily,
        padding: "62px 100px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: palette.green,
          opacity: 0.16,
          right: -230,
          top: -340,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
        }}
      >
        <Brand inverse />
        <Pill tone="green">RUNTIME AI</Pill>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 48,
          marginTop: 50,
          position: "relative",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.16em",
              fontWeight: 950,
              color: palette.blueLight,
            }}
          >
            HOW GPT-5.6 IS USED
          </div>
          <h2 style={{fontSize: 61, lineHeight: 1.05, margin: "21px 0 0", fontWeight: 950}}>
            Structured medical translation,
            <br />
            not a chatbot.
          </h2>
          <div style={{display: "grid", gap: 12, marginTop: 34}}>
            {steps.map(([number, title, copy], index) => {
              const show = spring({
                frame: frame - index * Math.round(0.18 * fps),
                fps,
                config: {damping: 190},
                durationInFrames: Math.round(0.55 * fps),
              });
              return (
                <div
                  key={number}
                  style={{
                    height: 82,
                    borderRadius: 20,
                    background: "rgba(255,255,255,0.09)",
                    border: "2px solid rgba(255,255,255,0.14)",
                    display: "grid",
                    gridTemplateColumns: "58px 245px 1fr",
                    alignItems: "center",
                    gap: 15,
                    padding: "0 24px",
                    opacity: show,
                    transform: "translateX(" + (-18 + show * 18) + "px)",
                  }}
                >
                  <div style={{fontSize: 18, fontWeight: 950, color: "#9ed8c6"}}>{number}</div>
                  <div style={{fontSize: 23, fontWeight: 950}}>{title}</div>
                  <div style={{fontSize: 17, color: "#cfe5e8", fontWeight: 750}}>{copy}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            borderRadius: 31,
            background: "#102f37",
            border: "2px solid rgba(255,255,255,0.15)",
            padding: "38px 37px",
            boxShadow: "0 28px 70px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
            <div style={{fontSize: 20, fontWeight: 950, color: "#9ed8c6"}}>
              GPT-5.6 · STRUCTURED OUTPUT
            </div>
            <span style={{fontSize: 17, fontWeight: 900, color: "#8bd4ba"}}>● verified</span>
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 21,
              lineHeight: 1.72,
              marginTop: 30,
              color: "#dcecef",
            }}
          >
            <div><span style={{color: "#7fcab1"}}>&quot;detectedLanguage&quot;</span>: &quot;en&quot;,</div>
            <div><span style={{color: "#7fcab1"}}>&quot;translatedText&quot;</span>:</div>
            <div style={{paddingLeft: 25, color: "#ffffff"}}>&quot;右下の奥歯が昨日から痛いです。&quot;,</div>
            <div><span style={{color: "#7fcab1"}}>&quot;criticalInformation&quot;</span>: {"{"}</div>
            <div style={{paddingLeft: 25}}>&quot;bodyPart&quot;: &quot;tooth&quot;,</div>
            <div style={{paddingLeft: 25}}>&quot;side&quot;: &quot;lower right&quot;,</div>
            <div style={{paddingLeft: 25}}>&quot;timing&quot;: &quot;since yesterday&quot;</div>
            <div>{"}"},</div>
            <div><span style={{color: "#7fcab1"}}>&quot;confidence&quot;</span>: &quot;high&quot;</div>
          </div>
          <div
            style={{
              marginTop: 30,
              borderRadius: 19,
              background: "#173f37",
              border: "2px solid #3f8d75",
              padding: "20px 23px",
              fontSize: 20,
              lineHeight: 1.45,
              fontWeight: 900,
              color: "#c9f1e3",
            }}
          >
            ✓ Body part · symptom · negation · side · numbers · medication · allergy
          </div>
          <div
            style={{
              marginTop: 17,
              fontSize: 18,
              lineHeight: 1.5,
              color: "#b9d2d6",
              fontWeight: 750,
            }}
          >
            Unsafe or uncertain output is blocked before speech playback.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
