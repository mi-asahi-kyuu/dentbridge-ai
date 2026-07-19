import { NextRequest } from "next/server";
import {
  enforceRateLimit,
  NO_STORE_HEADERS,
  noStoreJson,
  requireApiKey,
  safeUpstreamError,
} from "@/lib/api-security";
import { isAllowedLanguage } from "@/lib/languages";
import { verifySpeechApproval } from "@/lib/speech-approval";
import { getOpenAiTtsModel, getTtsProvider } from "@/lib/tts-provider";

export const dynamic = "force-dynamic";

type SpeechBody = {
  text?: unknown;
  targetLanguage?: unknown;
  sessionId?: unknown;
  speechToken?: unknown;
};

function isSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const provider = getTtsProvider();
  const speechModel = getOpenAiTtsModel(provider);
  if (!speechModel) {
    return noStoreJson({ error: "当前配置使用设备原生语音，不调用外部 TTS。" }, 409);
  }
  const apiKey = requireApiKey();
  if (!apiKey) return noStoreJson({ error: "服务器尚未设置 OpenAI API Key。" }, 503);

  let body: SpeechBody;
  try {
    body = (await request.json()) as SpeechBody;
  } catch {
    return noStoreJson({ error: "请求格式无效。" }, 400);
  }

  const { text, targetLanguage, sessionId, speechToken } = body;
  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 2_000 ||
    !isAllowedLanguage(targetLanguage) ||
    !isSessionId(sessionId) ||
    typeof speechToken !== "string" ||
    !verifySpeechApproval(speechToken, text.trim(), sessionId)
  ) {
    return noStoreJson({ error: "译文尚未通过独立检查，不能播放语音。" }, 403);
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: speechModel,
        voice: "alloy",
        input: text.trim(),
        response_format: "mp3",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return noStoreJson({ error: "语音播放服务连接超时，请稍后重试。" }, 504);
  }

  if (!upstream.ok) {
    return noStoreJson({ error: safeUpstreamError(upstream.status) }, upstream.status);
  }

  const audio = await upstream.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
    },
  });
}
