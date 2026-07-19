#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/public/demo/audio"
TEMP_DIR="$ROOT_DIR/.tmp-demo-audio"

mkdir -p "$OUTPUT_DIR" "$TEMP_DIR"

render_voice() {
  local filename="$1"
  local voice="$2"
  local rate="$3"
  local text="$4"
  local aiff="$TEMP_DIR/$filename.aiff"

  say -v "$voice" -r "$rate" -o "$aiff" -- "$text"
  ffmpeg -loglevel error -y -i "$aiff" -ar 48000 -ac 2 "$OUTPUT_DIR/$filename.wav"
}

render_voice "narrator-intro" "Reed (英語（アメリカ）)" 178 \
  "Meet DentBridge A I, a hands-free translation assistant for Japanese dental clinics."

render_voice "narrator-start" "Reed (英語（アメリカ）)" 182 \
  "The clinic selects English once, confirms the privacy notice, and starts the session."

render_voice "patient-pain" "Samantha" 172 \
  "My lower right back tooth has hurt since yesterday."

render_voice "app-ja-pain" "Eddy (日本語（日本）)" 174 \
  "右下の奥歯が昨日から痛いです。"

render_voice "dentist-cold" "Kyoko" 172 \
  "冷たいものがしみますか？"

render_voice "app-en-cold" "Shelley (英語（アメリカ）)" 178 \
  "Are you sensitive to cold?"

render_voice "patient-allergy" "Samantha" 170 \
  "I am not allergic to any medication."

render_voice "app-ja-allergy" "Eddy (日本語（日本）)" 174 \
  "薬のアレルギーはありません。"

render_voice "dentist-start" "Kyoko" 170 \
  "治療を始めます。"

render_voice "app-en-hand-signal" "Shelley (英語（アメリカ）)" 184 \
  "During treatment, if you feel pain, discomfort, or need a break, clearly raise whichever hand is easiest to move. We will stop treatment immediately when we see your hand. To confirm, please raise it once now."

render_voice "dentist-confirm" "Kyoko" 170 \
  "手の合図を確認しました。"

render_voice "app-en-treatment-start" "Shelley (英語（アメリカ）)" 184 \
  "The hand signal to stop has been confirmed. Treatment will now begin."

render_voice "dentist-open" "Kyoko" 170 \
  "口を開けてください。"

render_voice "app-en-open" "Shelley (英語（アメリカ）)" 180 \
  "Please open your mouth."

render_voice "dentist-pain" "Kyoko" 170 \
  "痛みはありますか？"

render_voice "app-en-pain" "Shelley (英語（アメリカ）)" 180 \
  "Are you in pain?"

render_voice "dentist-end" "Kyoko" 170 \
  "治療を終了します。"

render_voice "app-en-end" "Shelley (英語（アメリカ）)" 184 \
  "Treatment is finished. Normal conversation translation has resumed."

render_voice "narrator-codex" "Reed (英語（アメリカ）)" 184 \
  "We built DentBridge A I with Codex as our engineering collaborator. Codex turned repeated iPad field tests into a hands-free state machine, local voice activity detection, safety gates, automated tests, and a production deployment."

render_voice "narrator-gpt" "Reed (英語（アメリカ）)" 184 \
  "At runtime, GPT five point six returns structured medical translations. It must preserve body parts, symptoms, negation, left and right, numbers, tooth positions, medications, and allergies. Deterministic checks block unsafe text before speech playback."

render_voice "narrator-outro" "Reed (英語（アメリカ）)" 184 \
  "DentBridge A I translates only. It does not diagnose or make treatment decisions. Important medical details must always be confirmed by the dentist and patient."

ffmpeg -loglevel error -y \
  -f lavfi -i "sine=frequency=660:duration=0.5" \
  -f lavfi -i "sine=frequency=880:duration=0.45" \
  -filter_complex "[0:a]volume=0.07,afade=t=out:st=0.15:d=0.35[a0];[1:a]adelay=90|90,volume=0.045,afade=t=out:st=0.12:d=0.33[a1];[a0][a1]amix=inputs=2:duration=longest" \
  -ar 48000 -ac 2 "$OUTPUT_DIR/verified-chime.wav"

rm -rf "$TEMP_DIR"

echo "Generated demo audio in $OUTPUT_DIR"
