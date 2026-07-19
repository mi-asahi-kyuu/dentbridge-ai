import { NextRequest } from "next/server";
import {
  enforceRateLimit,
  NO_STORE_HEADERS,
  noStoreJson,
  requireApiKey,
  safeUpstreamError,
} from "@/lib/api-security";
import { isAllowedLanguage, type LanguageCode } from "@/lib/languages";
import {
  DENTAL_TRANSCRIPTION_PROMPTS,
  normalizeDentalTranscript,
  selectTranscriptionCandidate,
  transcriptionCandidateLanguages,
  type TranscriptionCandidate,
} from "@/lib/dental-transcription";
import { TRANSCRIPTION_MODEL } from "@/lib/serial-translation";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "video/mp4",
]);

function isSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

async function transcribeCandidate(
  apiKey: string,
  audio: File,
  language: LanguageCode,
): Promise<{ candidate: TranscriptionCandidate | null; status: number | null }> {
  const upstreamForm = new FormData();
  upstreamForm.set("file", audio, audio.name || "recording.webm");
  upstreamForm.set("model", TRANSCRIPTION_MODEL);
  upstreamForm.set("language", language);
  upstreamForm.set("prompt", DENTAL_TRANSCRIPTION_PROMPTS[language]);
  upstreamForm.set("response_format", "json");
  upstreamForm.set("temperature", "0");
  upstreamForm.append("include[]", "logprobs");

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { candidate: null, status: null };
  }
  if (!upstream.ok) return { candidate: null, status: upstream.status };
  const result = (await upstream.json()) as { text?: unknown; logprobs?: unknown };
  if (typeof result.text !== "string" || !result.text.trim()) {
    return { candidate: null, status: 422 };
  }
  const logprobs = Array.isArray(result.logprobs) ? result.logprobs : [];
  return {
    candidate: {
      language,
      text: normalizeDentalTranscript(result.text, language),
      logprobs,
    },
    status: 200,
  };
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const apiKey = requireApiKey();
  if (!apiKey) return noStoreJson({ error: "服务器尚未设置 OpenAI API Key。" }, 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return noStoreJson({ error: "无法读取录音数据，请重新录音。" }, 400);
  }

  const audio = form.get("audio");
  const patientLanguage = form.get("patientLanguage");
  const sessionId = form.get("sessionId");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return noStoreJson({ error: "录音为空或过长，请缩短后重试。" }, 400);
  }
  if (audio.type && !ACCEPTED_AUDIO_TYPES.has(audio.type.split(";")[0])) {
    return noStoreJson({ error: "浏览器录音格式不受支持，请使用最新版 Safari 或 Chrome。" }, 415);
  }
  if (!isAllowedLanguage(patientLanguage) || patientLanguage === "ja" || !isSessionId(sessionId)) {
    return noStoreJson({ error: "语言或会话参数无效。" }, 400);
  }

  const startedAt = performance.now();
  // Both pipelines use two forced-language requests. Supplying the ISO
  // language and a same-language dental prompt improves recognition accuracy;
  // running the pair concurrently keeps the latency close to one request.
  const [japaneseLanguage, patientCandidateLanguage] =
    transcriptionCandidateLanguages(patientLanguage);
  const [japanese, patient] = await Promise.all([
    transcribeCandidate(apiKey, audio, japaneseLanguage),
    transcribeCandidate(apiKey, audio, patientCandidateLanguage),
  ]);
  const selected = selectTranscriptionCandidate(
    [japanese.candidate, patient.candidate].filter(
      (candidate): candidate is TranscriptionCandidate => candidate !== null,
    ),
  );
  if (!selected) {
    const upstreamStatus = [japanese.status, patient.status].find(
      (status) => status !== null && status !== 200 && status !== 422,
    );
    if (upstreamStatus) {
      return noStoreJson({ error: safeUpstreamError(upstreamStatus) }, upstreamStatus);
    }
    return noStoreJson({ error: "没有识别到清晰人声，请靠近麦克风后重试。" }, 422);
  }

  return noStoreJson({
    text: selected.text,
    // Exposed only as a number for local troubleshooting; no audio/text is
    // logged or persisted by the server.
    timings: { transcriptionMs: Math.round(performance.now() - startedAt) },
  }, 200, NO_STORE_HEADERS);
}
