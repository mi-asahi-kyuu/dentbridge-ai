export const LANGUAGE_CODES = ["ja", "zh", "en", "ko", "vi"] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export type LanguageDefinition = {
  code: LanguageCode;
  nativeName: string;
  japaneseName: string;
  locale: string;
  consentTitle: string;
  consentItems: readonly string[];
};

const JA_CONSENT = [
  "AI翻訳には誤りが生じる可能性があります。",
  "重要な医療情報は、歯科医師と患者の双方で必ず再確認してください。",
  "このアプリは診断や治療の決定を行いません。",
  "音声は処理のため外部AIサービスに送信されます。",
  "テスト版では録音や会話内容を保存しません。",
] as const;

export const LANGUAGES: readonly LanguageDefinition[] = [
  {
    code: "ja",
    nativeName: "日本語",
    japaneseName: "日本語",
    locale: "ja-JP",
    consentTitle: "患者向けの確認",
    consentItems: JA_CONSENT,
  },
  {
    code: "zh",
    nativeName: "中文",
    japaneseName: "中国語",
    locale: "zh-CN",
    consentTitle: "患者须知",
    consentItems: [
      "AI翻译可能出现错误。",
      "重要医疗信息必须由牙医和患者双方再次确认。",
      "本应用不进行诊断或治疗决定。",
      "语音会发送给外部AI服务进行处理。",
      "测试版不保存录音和会话内容。",
    ],
  },
  {
    code: "en",
    nativeName: "English",
    japaneseName: "英語",
    locale: "en-US",
    consentTitle: "Patient notice",
    consentItems: [
      "AI translation may contain errors.",
      "The dentist and patient must confirm important medical information again.",
      "This app does not make diagnoses or treatment decisions.",
      "Audio is sent to an external AI service for processing.",
      "The test version does not save recordings or conversation content.",
    ],
  },
  {
    code: "ko",
    nativeName: "한국어",
    japaneseName: "韓国語",
    locale: "ko-KR",
    consentTitle: "환자 안내",
    consentItems: [
      "AI 번역에는 오류가 있을 수 있습니다.",
      "중요한 의료 정보는 치과의사와 환자가 반드시 다시 확인해야 합니다.",
      "이 앱은 진단이나 치료 결정을 하지 않습니다.",
      "음성은 처리를 위해 외부 AI 서비스로 전송됩니다.",
      "테스트 버전은 녹음이나 대화 내용을 저장하지 않습니다.",
    ],
  },
  {
    code: "vi",
    nativeName: "Tiếng Việt",
    japaneseName: "ベトナム語",
    locale: "vi-VN",
    consentTitle: "Thông báo cho bệnh nhân",
    consentItems: [
      "Bản dịch AI có thể có sai sót.",
      "Nha sĩ và bệnh nhân phải xác nhận lại các thông tin y tế quan trọng.",
      "Ứng dụng này không chẩn đoán hoặc đưa ra quyết định điều trị.",
      "Âm thanh được gửi đến dịch vụ AI bên ngoài để xử lý.",
      "Bản thử nghiệm không lưu bản ghi âm hoặc nội dung cuộc trò chuyện.",
    ],
  },
] as const;

export const PATIENT_LANGUAGES = LANGUAGES;

export function isAllowedLanguage(value: unknown): value is LanguageCode {
  return typeof value === "string" && (LANGUAGE_CODES as readonly string[]).includes(value);
}

export function getLanguage(code: LanguageCode): LanguageDefinition {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}

export function languagePairLabel(source: LanguageCode, target: LanguageCode): string {
  return `${getLanguage(source).nativeName} → ${getLanguage(target).nativeName}`;
}

export { JA_CONSENT };
