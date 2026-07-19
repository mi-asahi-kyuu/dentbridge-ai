import type { LanguageCode } from "./languages";

export type PatientLanguageCode = Exclude<LanguageCode, "ja">;
export type TreatmentSessionMode = "conversation" | "gesture-confirmation" | "treatment";
export type TreatmentCommand = "start" | "confirm" | "end";

type TreatmentPhrase = {
  id: string;
  japanese: string;
  aliases: readonly string[];
  translations: Record<PatientLanguageCode, string>;
};

export const TREATMENT_COMMANDS = {
  start: ["治療を始めます", "治療を開始します"],
  confirm: [
    "手の合図を確認しました",
    "合図を確認しました",
    "手の合図を確認できました",
  ],
  end: ["治療を終了します", "治療を終わります"],
} as const;

export const TREATMENT_GESTURE_GUIDANCE: {
  japanese: { title: string; instruction: string; observation: string; reminder: string; staffPrompt: string; buttonLabel: string };
  patients: Record<PatientLanguageCode, { title: string; instruction: string; observation: string; reminder: string }>;
} = {
  japanese: {
    title: "治療前の手の合図確認",
    instruction: "治療中に痛い、苦しい、または休みたい時は、動かしやすい方の手をはっきり上げてください。手が上がったら、すぐに治療を止めます。確認のため、今一度手を上げてください。",
    observation: "このAppは手の合図を自動検出しません。歯科医師・助手が目で確認します。手を上げられない場合は、治療前に別の合図を決めてください。",
    reminder: "停止の合図：動かしやすい方の手を上げる。Appは検出しません。歯科医師・助手が患者を確認してください。",
    staffPrompt: "患者が実際に手を上げたことを目で確認してください。確認できたら「手の合図を確認しました」と話してください。",
    buttonLabel: "手を上げたことを目視確認して治療開始",
  },
  patients: {
    zh: {
      title: "治疗前确认手势",
      instruction: "治疗中如果感到疼痛、不舒服或希望暂停，请清楚地举起一只方便活动的手。看到您举手后，我们会立即停止治疗。为了确认，请现在试着举一次手。",
      observation: "本App不会自动识别手势，牙医或助手会亲自观察。如果无法举手，请在治疗前约定其他信号。",
      reminder: "停止手势：举起一只方便活动的手。本App不会自动识别，牙医或助手必须观察患者。",
    },
    en: {
      title: "Confirm the stop signal before treatment",
      instruction: "During treatment, if you feel pain, discomfort, or need a break, clearly raise whichever hand is easiest to move. We will stop treatment immediately when we see your hand. To confirm, please raise it once now.",
      observation: "This app does not detect the signal. The dentist or assistant must watch for it. If you cannot raise a hand, agree on another signal before treatment.",
      reminder: "Stop signal: raise whichever hand is easiest to move. The app does not detect it; the dentist or assistant must watch the patient.",
    },
    ko: {
      title: "치료 전 손 신호 확인",
      instruction: "치료 중 통증이 있거나 불편하거나 쉬고 싶을 때는 움직이기 편한 손을 분명하게 들어 주세요. 손을 드는 것이 보이면 즉시 치료를 멈추겠습니다. 확인을 위해 지금 한 번 손을 들어 주세요.",
      observation: "이 앱은 손 신호를 자동으로 감지하지 않습니다. 치과의사나 보조자가 직접 확인합니다. 손을 들 수 없다면 치료 전에 다른 신호를 정해 주세요.",
      reminder: "중단 신호: 움직이기 편한 손을 들어 주세요. 앱은 신호를 감지하지 않으므로 치과의사나 보조자가 환자를 직접 확인해야 합니다.",
    },
    vi: {
      title: "Xác nhận tín hiệu tay trước khi điều trị",
      instruction: "Trong khi điều trị, nếu bạn thấy đau, khó chịu hoặc muốn nghỉ, hãy giơ rõ một bàn tay thuận tiện cử động. Khi thấy bạn giơ tay, chúng tôi sẽ dừng điều trị ngay. Để xác nhận, xin hãy giơ tay một lần ngay bây giờ.",
      observation: "Ứng dụng không tự phát hiện tín hiệu này. Nha sĩ hoặc trợ lý phải trực tiếp quan sát. Nếu không thể giơ tay, hãy thống nhất một tín hiệu khác trước khi điều trị.",
      reminder: "Tín hiệu dừng: giơ bàn tay thuận tiện cử động. Ứng dụng không tự phát hiện; nha sĩ hoặc trợ lý phải quan sát bệnh nhân.",
    },
  },
};

export const TREATMENT_MODE_MESSAGES: Record<"start" | "end" | "cancel", Record<PatientLanguageCode, string>> = {
  start: {
    zh: "已经确认举手停止的手势。现在开始治疗。",
    en: "The hand signal to stop has been confirmed. Treatment will now begin.",
    ko: "치료를 멈추는 손 신호를 확인했습니다. 지금부터 치료를 시작합니다.",
    vi: "Đã xác nhận tín hiệu giơ tay để dừng. Bây giờ sẽ bắt đầu điều trị.",
  },
  end: {
    zh: "治疗结束，现在恢复普通会话翻译。",
    en: "Treatment is finished. Normal conversation translation has resumed.",
    ko: "치료가 끝났습니다. 일반 대화 번역을 다시 시작합니다.",
    vi: "Điều trị đã kết thúc. Chế độ dịch hội thoại thông thường đã được khôi phục.",
  },
  cancel: {
    zh: "尚未开始治疗。现在返回普通会话翻译。",
    en: "Treatment has not started. Normal conversation translation has resumed.",
    ko: "치료를 시작하지 않았습니다. 일반 대화 번역으로 돌아갑니다.",
    vi: "Chưa bắt đầu điều trị. Đã quay lại chế độ dịch hội thoại thông thường.",
  },
};

export const REPEAT_PROMPTS: Record<LanguageCode, string> = {
  ja: "聞き取れません。もう一度話してください。",
  zh: "没有听清，请再说一遍。",
  en: "Please say that again.",
  ko: "다시 말씀해 주세요.",
  vi: "Vui lòng nói lại.",
};

export const TREATMENT_PHRASES: readonly TreatmentPhrase[] = [
  {
    id: "pain",
    japanese: "痛みはありますか？",
    aliases: ["痛みはありますか", "痛いですか"],
    translations: { zh: "疼吗？", en: "Are you in pain?", ko: "통증이 있나요?", vi: "Bạn có đau không?" },
  },
  {
    id: "anesthesia",
    japanese: "麻酔は効いていますか？",
    aliases: ["麻酔は効いていますか", "麻酔が効いていますか"],
    translations: { zh: "麻醉起效了吗？", en: "Is the anesthesia working?", ko: "마취가 잘 듣고 있나요?", vi: "Thuốc tê đã có tác dụng chưa?" },
  },
  {
    id: "rest",
    japanese: "少し休みますか？",
    aliases: ["少し休みますか", "少し休みましょうか"],
    translations: { zh: "要稍微休息一下吗？", en: "Would you like a short break?", ko: "잠깐 쉴까요?", vi: "Bạn có muốn nghỉ một chút không?" },
  },
  {
    id: "open-mouth",
    japanese: "口を開けてください",
    aliases: ["口を開けてください", "お口を開けてください"],
    translations: { zh: "请张开嘴。", en: "Please open your mouth.", ko: "입을 벌려 주세요.", vi: "Vui lòng há miệng." },
  },
  {
    id: "rinse",
    japanese: "うがいをしてください",
    aliases: ["うがいをしてください", "うがいしてください"],
    translations: { zh: "请漱口。", en: "Please rinse your mouth.", ko: "입을 헹궈 주세요.", vi: "Vui lòng súc miệng." },
  },
  {
    id: "stay-still",
    japanese: "動かないでください",
    aliases: ["動かないでください"],
    translations: { zh: "请不要动。", en: "Please keep still.", ko: "움직이지 말아 주세요.", vi: "Vui lòng không cử động." },
  },
  {
    id: "almost-finished",
    japanese: "もう少しで終わります",
    aliases: ["もう少しで終わります", "もうすぐ終わります"],
    translations: { zh: "马上就结束了。", en: "We are almost finished.", ko: "이제 곧 끝납니다.", vi: "Sắp xong rồi." },
  },
  {
    id: "okay",
    japanese: "大丈夫ですか？",
    aliases: ["大丈夫ですか"],
    translations: { zh: "还好吗？", en: "Are you okay?", ko: "괜찮으세요?", vi: "Bạn có ổn không?" },
  },
  {
    id: "stop",
    japanese: "一度止めます",
    aliases: ["一度止めます", "いったん止めます"],
    translations: { zh: "我先停一下。", en: "I will stop for a moment.", ko: "잠시 멈추겠습니다.", vi: "Tôi sẽ dừng lại một chút." },
  },
  {
    id: "breathe",
    japanese: "深呼吸してください",
    aliases: ["深呼吸してください"],
    translations: { zh: "请深呼吸。", en: "Please take a deep breath.", ko: "깊게 숨을 쉬어 주세요.", vi: "Vui lòng hít thở sâu." },
  },
] as const;

function normalizeJapanese(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s。、！？!?.,]/g, "");
}

export function matchTreatmentCommand(text: string): TreatmentCommand | null {
  const normalized = normalizeJapanese(text);
  for (const command of TREATMENT_COMMANDS.start) {
    if (normalized === normalizeJapanese(command)) return "start";
  }
  for (const command of TREATMENT_COMMANDS.confirm) {
    if (normalized === normalizeJapanese(command)) return "confirm";
  }
  for (const command of TREATMENT_COMMANDS.end) {
    if (normalized === normalizeJapanese(command)) return "end";
  }
  return null;
}

export function transitionTreatmentSessionMode(
  mode: TreatmentSessionMode,
  command: TreatmentCommand,
): TreatmentSessionMode | null {
  if (mode === "conversation" && command === "start") return "gesture-confirmation";
  if (mode === "gesture-confirmation" && command === "start") return "gesture-confirmation";
  if (mode === "gesture-confirmation" && command === "confirm") return "treatment";
  if (mode !== "conversation" && command === "end") return "conversation";
  return null;
}

export function matchTreatmentPhrase(text: string) {
  const normalized = normalizeJapanese(text);
  return TREATMENT_PHRASES.find((phrase) =>
    phrase.aliases.some((alias) => normalized === normalizeJapanese(alias)),
  ) ?? null;
}
