# DentBridge AI

## OpenAI Build Week submission

- Live demo: [https://dentbridge.mi-asahi.com](https://dentbridge.mi-asahi.com)
- Track: Apps for Your Life
- Runtime AI: `gpt-5.6` and `gpt-4o-transcribe`
- Primary clients: iPad Safari, Android Chrome, and desktop browsers

The public demo requires no account. Use synthetic test phrases only; do not enter real patient information. Microphone audio is segmented into individual utterances in browser memory, sent for transcription, and discarded after processing. The application does not save recordings or conversation content to a database or browser storage.

## How Codex was used

Codex was the primary engineering collaborator during Build Week. It inspected the existing project, implemented and repaired the hands-free browser audio pipeline, added the exclusive state machine and local VAD, built deterministic medical-safety checks, created automated tests, diagnosed iPad Safari audio-session behavior, and prepared the production Docker and Apache deployment.

Field observations drove the decisions rather than generated code alone. In particular, iPad tests revealed premature utterance cuts, environmental-noise triggers, speech-synthesis feedback, unusual native voices, and unsafe translation mismatches. Those observations were fed back into Codex to revise VAD hysteresis, candidate selection, TTS gating, fixed treatment phrases, error recovery, and the bilingual treatment hand-signal confirmation flow. Codex also ran lint, type checking, 119 automated tests, production builds, HTTPS smoke tests, and synthetic end-to-end API checks.

## How GPT-5.6 is used

`gpt-5.6` is part of the runtime product, not a decorative chatbot. After local VAD creates a single-utterance WAV and `gpt-4o-transcribe` produces Japanese and patient-language candidates, `gpt-5.6` selects the supported source language and returns a faithful translation as Structured Output. It is instructed to translate only: it must not answer, diagnose, explain, add facts, or change body parts, symptoms, negation, left/right, numbers, dates, dosage, tooth numbers, medication names, or allergy information.

The `safe` pipeline uses a second independent `gpt-5.6` request to compare critical entities. The low-latency `fast` pipeline uses one `gpt-5.6` Structured Output request followed by deterministic server-side checks. In both modes, an HMAC-bound short-lived playback approval is issued only after the selected safety checks pass, so rejected text cannot reach TTS. Treatment mode does not generate translations for arbitrary background speech; it only plays reviewed fixed phrases.

日本の歯科診療所で iPad、Android タブレット、PC ブラウザを使って現場テストするための、ハンズフリー双方向音声通訳 PWA です。診療所言語は日本語に固定し、患者言語は中文、English、한국어、Tiếng Việt から会話開始前に1回だけ選びます。

このアプリは通訳だけを行います。診断、治療提案、医療判断、知情同意書の自動作成、電子カルテ記入、患者識別、録音保存は行いません。

## 操作フロー

通常の会話中に、歯科医師や患者がボタンを押す必要はありません。

1. 患者言語を選択する
2. 日本語と患者言語のプライバシー・AI翻訳説明を確認する
3. `会話を開始` を1回押す
4. 約2秒間の周囲騒音校正が終わるまで話さない
5. その後は発話、翻訳、検査、再生を自動で繰り返す
6. 最後に `会話を終了` を1回押す

開始後の状態機械は次の順序だけを許可します。

```text
idle
→ calibrating
→ listening
→ recording
→ transcribing
→ translating
→ verifying
→ speaking
→ cooldown
→ listening
```

`マイクを一時停止` は主画面に残しています。騒音で自動検出できない時の手動録音は `補助機能・手動モード` 内にあり、通常画面には Push-to-Talk の大ボタンを表示しません。通信断は3回まで自動再試行し、それでも失敗した時だけ `再接続` を表示します。

## 音声処理と安全ゲート

直接 speech-to-speech の Realtime Translation は使用していません。`TRANSLATION_PIPELINE_MODE` で、完全検査の `safe` と3秒目標の `fast` を切り替えます。

```text
Web Audio API / AudioWorklet によるローカルVAD
→ safe / fast とも単句WAVを日本語・患者言語それぞれの gpt-4o-transcribe へ並列送信
→ 各候補にISO言語指定、同言語の簡潔な診療所context、logprobsを使用し、より確かな文字起こし候補を選択
→ gpt-5.6 Structured Outputs で言語判定と忠実翻訳
→ 別の gpt-5.6 リクエストで重要情報を独立抽出・比較
→ ローカル規則で身体部位、左右、否定、数字、用量、歯番号、薬、アレルギーを比較
→ 全検査合格時だけ短期HMAC再生許可を発行
→ 確定した訳文だけをTTSへ渡す
```

`safe` は上記の全段階を実行します。`fast` は1回目の `gpt-5.6` 自身に最終忠実性チェックを要求した後、2回目の `gpt-5.6` を待たず、サーバー側の決定的規則で原文一致、身体部位、左右、否定、数字、回数、用量、歯番号、薬、アレルギーを確認します。合格時だけ同じ短期HMAC再生許可を発行します。`fast` は画面に常時黄色で表示し、独立した2回目のモデル検査と同等であるとは表示しません。

翻訳指示は回答、診断、説明、要約、補足、推測を禁止し、原文にない情報を加えないよう要求します。身体部位、症状、否定、左右、数字、日付、用量、歯番号、薬名、アレルギーを変えた場合は失敗にします。言語が日本語または選択患者言語に確定できない場合、第三言語の場合、信頼度が high でない場合も訳文を再生しません。

検査失敗時は、誤訳をTTSへ渡さず、失敗理由を黄色で表示し、設定済みの短い「聞き取れません。もう一度話してください」に相当する固定文だけを端末TTSで案内します。固定案内の再生に失敗しても元の安全検査理由を上書きせず、自動でリスニングへ戻ります。マイクは訳文再生中からクールダウン終了までVADを停止するため、端末自身の読み上げを再認識しません。`native` TTSでは開始時の静音WAVを使わず、既存のMediaStreamとAudioContextを再利用します。VAD停止だけで再生中のフレームを破棄し、入力トラックのON/OFFを繰り返さないため、iPadのAEC/AGCが次の発話直前に再安定化する影響を抑えます。開始時はゼロ音量のTTS解放を待ってからマイクを開き、AudioSessionの競合を避けます。Safariが読み上げ完了イベントを返さない場合は端末の再生状態から完了を判定します。

端末TTSは対象localeと一致する通常音声をSafariの列挙順で選び、以前のiPad現場テスト版と同じ`0.92`の速度を使用します。Enhanced/Premiumという名前だけで別の発音モデルへ自動変更しません。Whisper、Bells、Zarvoxなどの演出用音声は除外します。iPad Safariはマイク使用中に出力を通話用AudioSessionへ寄せる場合があり、Webアプリから完全には制御できません。音質優先で毎回マイクを停止・再取得すると音量表示、接続競合、遅延が再発するため、既定経路では行いません。

## ローカルVAD

`lib/vad-config.ts` に全パラメータを集約しています。

- 周囲騒音校正: 2,000ms
- 発話開始判定: `safe` はしきい値超過140ms、`fast` は100ms継続
- 人声形態判定: 40msのRMS包絡を使い、少なくとも3窓で8%以上の自然な音量変化がある場合だけ発話として開始。一定音量の機器音・純音は録音しない
- 発話終了判定: `safe` は静音900ms、`fast` は800ms。中国語・日本語の句中の間を途中終了と誤判定しにくくし、発話中は開始時より低い解除しきい値を使って弱い句尾を保持
- 最短有声音: `safe` は320ms、`fast` は240ms。短い衝撃音を破棄
- 単句最大: 20秒
- プリロール: 240ms
- 処理後クールダウン: `safe` は300ms、`fast` は100ms
- 再生後入力ガード: `safe` は750ms、`fast` は100ms。`fast` は画面がリスニング表示になった直後の語頭を捨てない

AudioWorklet が利用できない場合は Web Audio の ScriptProcessor にフォールバックします。ブラウザ標準の `SpeechRecognition` はコア処理に使用しません。マイク取得時は `echoCancellation`、`noiseSuppression`、`autoGainControl` を有効にします。

文字起こしは、`safe` と `fast` の両方で、選択済みの患者言語と日本語の2候補を並列生成します。各リクエストには対象言語のISO-639-1コードと、その言語だけで書かれた簡潔な診療所contextを指定し、`temperature=0` と `logprobs` を使用して、音声と言語の一致度が高い候補を選びます。無音時にprompt内の語句を補完する現象を防ぐため、具体的な歯科語彙の長い列挙は使用しません。2本は直列ではなく同時に送るため、精度を戻しながら待ち時間の増加を抑えます。信頼度情報がない候補、平均または最初のtoken信頼度が不足する候補、`ルルルルル`のような機械的な反復文字列は採用しません。両候補が不明瞭な場合は環境音として静かに破棄し、固定の「もう一度」音声も再生しません。中文の `牙→呀`、歯の量詞 `颗→棵` などは、文章全体が明確な歯牙位置表現である場合だけ保守的に補正します。一般会話の助詞 `呀` や樹木の `棵` は変更しません。

## 会話モードと治療モード

会話モードは治療前の問診と治療後の説明に使います。日本語と選択患者言語を自動判定して、両方向を自動通訳します。

日本語で `治療を始めます` と話しても、すぐには治療モードへ入りません。まず `手の合図を確認` 画面を表示し、日本語と患者言語で次を固定案内として表示・再生します。

1. 痛い、苦しい、休みたい時は動かしやすい方の手を上げる
2. 歯科医師・助手は手が上がったら直ちに処置を止める
3. 患者が実際に一度手を上げて練習する
4. Appはカメラで手の合図を検出せず、歯科医師・助手が目で確認する
5. 手を上げられない患者とは、治療前に診療所が別の合図を決める

固定案内の再生が完了し、患者の手上げを目視確認した後、歯科医師・助手が `手の合図を確認しました` と話すと治療モードになります。音声認識が難しい時だけ、同じ画面の `手を上げたことを目視確認して治療開始` を押します。説明の再生失敗・中断時、または確認前には治療モードへ移行しません。`治療を終了します` と話すか画面の中止ボタンを使うと、確認を取り消して会話モードへ戻ります。

治療モードでは任意の背景音をAI翻訳せず、`lib/treatment-phrases.ts` に登録済みの次の10フレーズだけを照合し、専門家レビュー対象として固定した訳文を再生します。

- 痛みはありますか？
- 麻酔は効いていますか？
- 少し休みますか？
- 口を開けてください
- うがいをしてください
- 動かないでください
- もう少しで終わります
- 大丈夫ですか？
- 一度止めます
- 深呼吸してください

`治療を終了します` と話すと会話モードへ戻ります。治療中は確認済みの手上げ合図を日本語と患者言語で常時表示します。Appはカメラを使用せず、歯科医師や助手による患者状態の観察を代替しません。手の合図は停止・休憩要求専用であり、同意、薬、アレルギー、費用などの複雑な医療情報の確認には使用しません。

## TTS設定

`.env.local` の `TTS_PROVIDER` で選びます。

```dotenv
TTS_PROVIDER=native
```

- `native`: デフォルト。iPad、Android、PCのブラウザ音声合成を使用し、TTS API呼び出しと遅延を減らす。対象言語・地域に一致する通常音声をSafariの列挙順で選び、Enhanced/Premiumという名前だけでは別音声へ切り替えない。Whisper、Bellsなどの効果音・キャラクター音声は選択しない。以前のiPad現場テスト版と同じ再生速度 `0.92` を使用する
- `openai-hd`: `tts-1-hd` を使用
- `openai-fast`: `tts-1` を使用

旧Deprecated音声モデルはコード、設定、依存関係から削除しました。外部TTSを選んだ場合も、選択中パイプラインの安全ゲートに合格し、会話IDと確定訳文に結び付いた短期許可がないリクエストは403で拒否します。外部TTSに失敗した時は、同じ検査済み文字列を端末TTSで読みます。TTSが再翻訳や書き換えを行うことはありません。

## 応答速度設定

パイプラインは次の環境変数で選択します。

```dotenv
TRANSLATION_PIPELINE_MODE=safe
```

- `safe`: 2回の `gpt-5.6` を直列実行し、独立抽出とローカル規則の両方を通す。医療安全優先。
- `fast`: 1回の `gpt-5.6` Structured Outputとローカル硬検査。日本語・患者言語の並列転写、800msの句末静音、弱い句尾を保持するVADヒステリシス、端末TTSを組み合わせて短句の発話終了から再生開始まで3秒未満を目標にする。

Structured Outputには長い歯科文でもJSONが途中で切れない出力上限を確保し、解析できない場合だけサーバー内で1回補完します。それでも安全に確定できない場合は現在の1文だけを再生せず、自動で聞き取りへ戻ります。内容拒否や無音のHTTP 422は接続断として扱わず、実際のタイムアウト・レート制限・5xxだけを再接続表示の対象にします。

どちらも `reasoning.effort=none`、`store=false`、患者言語別の匿名prompt cache keyを使用します。`fast` の3秒は同一LAN、短い明瞭な発話、対応Projectのpriority処理を前提とする目標で、外部ネットワーク遅延を保証するSLAではありません。画面に各ターンの「発話終了 → 再生開始」実測値を表示します。

Responses APIの処理レーンはサーバー環境変数で選択できます。

```dotenv
OPENAI_SERVICE_TIER=auto
```

- `auto`: デフォルトのProject設定を使用
- `default`: 標準処理
- `priority`: 対応Projectでは待ち時間を短縮できるが、利用料金が高くなる可能性がある

現場テスト機では `priority` を使用できます。未対応Projectや費用優先の環境では `auto` に戻してください。`safe` では第二のモデル検査を維持し、`fast` では第二のモデル検査を省略します。ローカル重要情報照合とTTS許可ゲートは両モードで維持します。

## 主なファイル

- `components/DentalTalkApp.tsx`: 開始画面、免手状態機械、ネットワーク再試行、TTS、Mock、会話・治療UI
- `lib/local-vad.ts`: マイク、AudioWorklet、ScriptProcessorフォールバック
- `lib/energy-vad.ts`: ブラウザ内エネルギーVADと単句WAV生成
- `lib/vad-config.ts`: VADとクールダウンの集中設定
- `lib/hands-free-state.ts`: 排他的な状態遷移
- `lib/serial-translation.ts`: `gpt-5.6` の翻訳・独立検査Structured Outputs
- `lib/fast-translation.ts`: FASTモードの決定的ローカル安全ゲート
- `lib/translation-pipeline.ts`: `safe` / `fast` のサーバー設定allowlist
- `lib/translation-consistency.ts`: 身体部位、左右、否定、数字、薬、アレルギーのローカル照合
- `lib/treatment-phrases.ts`: 治療開始・終了命令と審査対象の固定フレーズ訳文
- `lib/tts-provider.ts`: TTSプロバイダ選択と再生安全ゲート
- `app/api/translation/transcribe/route.ts`: 単句音声を `/v1/audio/transcriptions` へ中継
- `app/api/translation/process/route.ts`: `safe` の翻訳・独立検査、または `fast` の単一翻訳とローカル検査
- `app/api/translation/speech/route.ts`: 検査許可済みの訳文だけを任意のOpenAI TTSへ送信
- `public/audio-worklets/vad-capture.js`: モバイル対応のマイクフレーム取得
- `scripts/setup-local-https.sh`: 局域網IP用のローカルCAとHTTPS証明書生成

## ローカル起動

Node.js 20.9以上が必要です。ポートは5678で、3000は使用しません。

```bash
npm install
cp .env.example .env.local
```

`.env.local` を設定します。

```dotenv
OPENAI_API_KEY=sk-your-server-side-key
SPEECH_APPROVAL_SECRET=replace-with-at-least-32-random-characters
TTS_PROVIDER=native
OPENAI_SERVICE_TIER=auto
TRANSLATION_PIPELINE_MODE=safe
NEXT_PUBLIC_TRANSLATION_MOCK_MODE=false
```

3秒目標の現場デモでは次を使用し、サーバーを再起動します。

```dotenv
TTS_PROVIDER=native
OPENAI_SERVICE_TIER=priority
TRANSLATION_PIPELINE_MODE=fast
```

Keyに `NEXT_PUBLIC_` を付けないでください。ブラウザのJavaScriptやNetworkレスポンスへ正式Keyを返すAPIはありません。`SPEECH_APPROVAL_SECRET` は複数サーバー運用時に全インスタンス共通の32文字以上のランダム値を設定してください。`.env`、`.env.local`、`.env.*.local`、`.certs` は `.gitignore` 対象です。

PC本体だけで試す場合:

```bash
npm run dev
```

`http://localhost:5678` を開きます。localhostはマイク利用可能なセキュアコンテキストとして扱われます。

## Mockモード

OpenAI API KeyなしでUIと免手動作を確認できます。

```dotenv
NEXT_PUBLIC_TRANSLATION_MOCK_MODE=true
TTS_PROVIDER=native
```

サーバーを再起動して `会話を開始` を押すと、操作なしで次を順番に再現します。

- 約2秒校正と自動発話検出
- 5往復の言語判定、翻訳、独立検査、再生完了
- `牙疼 → 腹痛` の検査失敗と再生停止
- `治療を始めます`、固定治療フレーズ、`治療を終了します`
- ネットワーク切断、自動再接続、リスニング復帰

画面上部に `DEMO / Mock Mode` を常時表示します。実診療には使用しないでください。

## iPad局域網HTTPSテスト

iPad Safariのマイクは、LANのHTTP IPアドレスでは利用できません。受信端末で信頼済みのHTTPSが必要です。

1. MacとiPadを同じWi-Fiに接続し、MacのLAN IPを確認します。以下は `192.168.1.14` の例です。
2. IPをSANに含む証明書を生成します。

   ```bash
   npm run cert:setup -- 192.168.1.14
   ```

3. CA配布用の一時HTTPサーバーを起動します。

   ```bash
   npm run cert:serve
   ```

4. iPad Safariで `http://192.168.1.14:5679/dental-talk-local-ca.cer` を開き、プロファイルをダウンロードします。
5. iPadの「設定 → 一般 → VPNとデバイス管理」で `Dental Talk Local Test CA` をインストールします。
6. 「設定 → 一般 → 情報 → 証明書信頼設定」で同CAを完全信頼にします。
7. MacでHTTPS開発サーバーを起動します。

   ```bash
   npm run dev:https
   ```

8. iPad Safariで `https://192.168.1.14:5678` を開き、鍵アイコンが表示されることを確認します。
9. 言語選択と同意後、`会話を開始` を1回押します。マイクを許可し、校正中の約2秒は話しません。
10. 日本語と患者言語を交互に5回以上話します。`safe` は900ms、`fast` は800ms以上の間を空けます。画面に原文・訳文・検査状態と再生開始までの実測秒数が出て、再生後に自動でリスニングへ戻ることを確認します。
11. `治療を始めます` と話し、双方向の手の合図説明が最後まで再生されることを確認します。患者役が実際に手を上げ、歯科医師役が目視した後に `手の合図を確認しました` と話します。表示が `治療モード` に変わってから `口を開けてください`、`治療を終了します` を順に試します。確認前には治療モードへ入らないこと、中止ボタンでも会話モードへ戻れることも確認します。
12. iPadを一度バックグラウンドへ移し、復帰後に自動再接続するか、3回失敗後だけ表示される `再接続` を試します。
13. 最後に `会話を終了` を押し、字幕が消えることを確認します。

MacのIPが変わった場合は、新しいIPで `cert:setup` を再実行し、`dev:https` を再起動してください。正式配備では公開ドメインと公開認証局の証明書を使用し、診療端末にローカルCAを配布しないでください。

## プライバシーとセキュリティ

- VADはブラウザ内で動作し、無音の連続音声をサーバーへ送りません。
- 1句の音声はブラウザメモリだけでWAV化し、転写後に参照を破棄します。サーバーは音声をファイルや一時ディレクトリへ書きません。
- 録音、原文、訳文、患者情報をデータベース、分析基盤、サーバーログへ保存しません。
- 会話はReactのメモリ状態だけに置き、更新または終了時に消去します。`localStorage` には任意のマイクdeviceIdだけを保存し、会話内容は保存しません。
- ランダムUUIDを会話IDに使い、氏名、電話番号、保険番号などをIDに使いません。
- API Keyはサーバー環境変数だけに置きます。
- API Routeは言語allowlist、サイズ制限、基本レート制限、`Cache-Control: no-store` を使用します。
- エラー処理は患者の音声、原文、訳文をログ出力しません。リバースプロキシでもリクエスト本文ログを無効にしてください。
- Responses APIリクエストは `store: false` を指定します。

OpenAI APIデータはデフォルトでモデル学習に使われませんが、デフォルトの滥用監視ログが保持される場合があります。適格な組織向けにModified Abuse MonitoringやZero Data Retentionの選択肢があります。日本国内処理を前提にできないため、正式商用前に診療所が個人情報、要配慮個人情報、医療情報、国外移転、患者告知・同意、委託先管理を確認してください。

参考:

- [OpenAI Data controls](https://platform.openai.com/docs/guides/your-data)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [gpt-4o-transcribe](https://developers.openai.com/api/docs/models/gpt-4o-transcribe)
- [GPT-5.6](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- [TTS-1 HD](https://developers.openai.com/api/docs/models/tts-1-hd)
- [TTS-1](https://developers.openai.com/api/docs/models/tts-1)

## 英日デモ動画

米国人患者と日本の歯科医師による英日ハンズフリー会話、医療情報の安全確認、治療前の手の合図確認、治療モードの登録済みフレーズを再現する16:9デモ動画をRemotionで生成できます。成片は139秒で、最後に英語ナレーションと同期画面を使って、Codexによる実装・iPad現場修正・テスト・配備、およびGPT-5.6のStructured Output・重要情報保持・TTS前安全ゲートを説明します。

```bash
npm run video:audio
npm run video:render
npm run video:thumbnail
```

生成物:

- `output/dentbridge-ai-demo-en-ja.mp4`
- `output/dentbridge-ai-demo-thumbnail.png`

動画は現在のApp UIと固定文言を再現した製品デモです。臨床承認や翻訳精度の保証を示すものではありません。Devpostなどへ掲載する場合はMP4をYouTubeの限定公開またはVimeoへアップロードし、そのURLを動画欄へ入力してください。

## テストとproduction build

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

テストはVADの校正・開始・静音終了・短い騒音破棄、排他的状態遷移、言語ペアStructured Outputs、独立検査、FASTローカル安全ゲート、治療フレーズ、TTS安全ゲートを検証します。歯痛と腹痛、左右、否定、投薬回数、歯番号の危険な変化を失敗させ、指定された日本語・中文・Englishの歯科表現を回帰ケースに含めています。

## 費用の考え方

旧Realtime方式の比較式 `$0.034 × 会話分数 × 翻訳方向数` は、現在の方式にはそのまま適用できません。`safe` と `fast` は各単句を日本語候補と患者言語候補の2回 `gpt-4o-transcribe` に並列送信します。`safe` は2回、`fast` は1回の `gpt-5.6` を使用します。`native` TTSでは外部TTS料金は発生しません。正式試験では専用OpenAI Projectに予算上限と通知を設定し、個人情報を含まない代表会話で実測してください。

## 現在の制限と商用前に必要な作業

- 基礎VADは音量ベースです。歯科用タービン、吸引、器具衝突が発話に似た長さと音量の場合、誤検出し得ます。2秒校正だけでは治療中の変動騒音を完全には分離できません。
- `safe` は翻訳と独立検査を直列処理するため、直接音声翻訳より遅くなります。`fast` は3秒目標ですが、第二の独立モデル検査を省略するため安全性との明確なトレードオフがあります。
- 翻訳モデルと検査モデルが同時に誤る可能性があります。ローカル規則も全医学概念を網羅しません。「検査済み」は医学的正しさの保証ではありません。
- 治療モードの固定訳文は実装上分離されていますが、全言語を歯科医療通訳の有資格者が正式承認してから現場使用してください。
- ブラウザ原生TTSの声質、発音、利用可能な声はiPadOS、Android端末、OS言語設定で変わります。
- iPad Safariのバックグラウンド移行はAudioContextやマイクをOSが停止する場合があります。復帰処理はありますが、端末・OS版ごとの現場確認が必要です。
- 自動再接続中の句は失われる場合があります。重要内容は短く区切って再確認してください。
- ネットワーク障害、OpenAI障害、API利用上限時の専門通訳・紙面・スタッフによる代替手順を診療所で用意してください。
- 正式商用前に、歯科医師、医療通訳、プライバシー・法務、情報セキュリティ担当者による承認、騒音環境テスト、誤り率測定、停止基準、事故対応、端末管理、秘密鍵ローテーション、公開HTTPS配備が必要です。
