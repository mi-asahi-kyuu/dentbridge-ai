import { NextRequest } from "next/server";
import {
  enforceRateLimit,
  noStoreJson,
  requireApiKey,
  safeUpstreamError,
} from "@/lib/api-security";
import { isAllowedLanguage, type LanguageCode } from "@/lib/languages";
import { getOpenAiServiceTier } from "@/lib/openai-service-tier";
import { assessFastTranslation } from "@/lib/fast-translation";
import {
  buildAutomaticReviewRequest,
  buildAutomaticTranslationRequest,
  buildFastAutomaticTranslationRequest,
  compareCriticalInformation,
  extractResponseText,
  parseAutomaticReviewOutput,
  parseAutomaticTranslationOutput,
  type AutomaticTranslationOutput,
} from "@/lib/serial-translation";
import { issueSpeechApproval } from "@/lib/speech-approval";
import { checkTranslationConsistency } from "@/lib/translation-consistency";

export const dynamic = "force-dynamic";

type ProcessBody = {
  phase?: unknown;
  sourceText?: unknown;
  patientLanguage?: unknown;
  sessionId?: unknown;
  translation?: unknown;
};

function isSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function isPatientLanguage(value: unknown): value is LanguageCode {
  return isAllowedLanguage(value) && value !== "ja";
}

async function callResponses(apiKey: string, body: object) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, service_tier: getOpenAiServiceTier() }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
}

async function parseTranslationResponse(
  response: Response,
  patientLanguage: LanguageCode,
) {
  try {
    const outputText = extractResponseText(await response.json());
    return outputText
      ? parseAutomaticTranslationOutput(outputText, patientLanguage)
      : null;
  } catch {
    return null;
  }
}

async function translate(
  apiKey: string,
  sourceText: string,
  patientLanguage: LanguageCode,
) {
  let upstream: Response;
  try {
    upstream = await callResponses(
      apiKey,
      buildAutomaticTranslationRequest(sourceText, patientLanguage),
    );
  } catch {
    return noStoreJson({ error: "医疗翻译服务连接超时，请重新尝试。" }, 504);
  }
  if (!upstream.ok) {
    return noStoreJson({ error: safeUpstreamError(upstream.status) }, upstream.status);
  }
  const output = await parseTranslationResponse(upstream, patientLanguage);
  if (!output) return noStoreJson({ error: "医疗翻译结果格式异常，请重新尝试。" }, 502);
  return noStoreJson({ translation: output }, 200);
}

async function fastTranslate(
  apiKey: string,
  sourceText: string,
  patientLanguage: LanguageCode,
  sessionId: string,
) {
  const startedAt = performance.now();
  const requestBody = buildFastAutomaticTranslationRequest(sourceText, patientLanguage);
  let upstream: Response;
  try {
    upstream = await callResponses(
      apiKey,
      requestBody,
    );
  } catch {
    return noStoreJson({ error: "低延迟医疗翻译服务连接超时，请重新尝试。" }, 504);
  }
  if (!upstream.ok) {
    return noStoreJson({ error: safeUpstreamError(upstream.status) }, upstream.status);
  }
  let translation = await parseTranslationResponse(upstream, patientLanguage);
  // A completed HTTP 200 can still contain an incomplete structured object if
  // the upstream generation hit a limit. Repair once inside this API request
  // with extra headroom instead of making the tablet repeat the entire turn
  // three times. No source or translation content is written to logs.
  if (!translation) {
    try {
      upstream = await callResponses(apiKey, {
        ...requestBody,
        max_output_tokens: 640,
      });
    } catch {
      return noStoreJson({ error: "低遅延翻訳サービスへの接続がタイムアウトしました。" }, 504);
    }
    if (!upstream.ok) {
      return noStoreJson({ error: safeUpstreamError(upstream.status) }, upstream.status);
    }
    translation = await parseTranslationResponse(upstream, patientLanguage);
  }
  if (!translation) {
    return noStoreJson(
      { error: "翻訳結果を安全に確認できませんでした。もう一度話してください。" },
      422,
    );
  }

  const assessment = assessFastTranslation(sourceText, translation, patientLanguage);
  const speechToken = assessment.passed
    ? issueSpeechApproval(translation.translatedText, sessionId)
    : undefined;
  return noStoreJson({
    pipelineMode: "fast",
    translation,
    review: {
      passed: assessment.passed,
      issues: assessment.issues,
      checkedCriticalInformation: translation.criticalInformation,
    },
    speechToken,
    targetLanguage: assessment.targetLanguage,
    timings: { translationMs: Math.round(performance.now() - startedAt) },
  }, 200);
}

async function verify(
  apiKey: string,
  translation: AutomaticTranslationOutput,
  patientLanguage: LanguageCode,
  sessionId: string,
) {
  const detected = translation.detectedLanguage;
  const allowedLanguage = detected === "ja" || detected === patientLanguage;
  const sourceMatches = Boolean(translation.sourceText.trim());
  if (
    !allowedLanguage ||
    !sourceMatches ||
    !translation.translatedText.trim() ||
    translation.needsConfirmation ||
    translation.confidence !== "high"
  ) {
    const issues = [
      !allowedLanguage ? "日本語または選択した患者言語として判定できませんでした" : "",
      !sourceMatches ? "原文が空です" : "",
      !translation.translatedText.trim() ? "訳文が空です" : "",
      translation.needsConfirmation ? "モデルが人による確認を必要と判定しました" : "",
      translation.confidence !== "high" ? "言語判定または翻訳の信頼度が不足しています" : "",
    ].filter(Boolean);
    return noStoreJson({ review: { passed: false, issues } }, 200);
  }

  let upstream: Response;
  try {
    upstream = await callResponses(
      apiKey,
      buildAutomaticReviewRequest(translation, patientLanguage),
    );
  } catch {
    return noStoreJson({ error: "独立安全检查连接超时，译文不会播放。" }, 504);
  }
  if (!upstream.ok) {
    return noStoreJson(
      { error: `${safeUpstreamError(upstream.status)} 译文不会播放。` },
      upstream.status,
    );
  }

  const outputText = extractResponseText(await upstream.json());
  const review = outputText ? parseAutomaticReviewOutput(outputText) : null;
  if (!review) return noStoreJson({ error: "独立安全检查结果异常，译文不会播放。" }, 502);

  const targetLanguage = detected === "ja" ? patientLanguage : "ja";
  const localCheck = checkTranslationConsistency(
    translation.sourceText,
    detected,
    translation.translatedText,
    targetLanguage,
  );
  const extractionIssues = compareCriticalInformation(
    translation.criticalInformation,
    review.checkedCriticalInformation,
  );
  const issues = [...new Set([...review.issues, ...localCheck.reasons, ...extractionIssues])];
  const passed = review.passed && !localCheck.mismatch && extractionIssues.length === 0;
  const speechToken = passed
    ? issueSpeechApproval(translation.translatedText, sessionId)
    : undefined;

  return noStoreJson(
    {
      review: {
        passed,
        issues,
        checkedCriticalInformation: review.checkedCriticalInformation,
      },
      speechToken,
      targetLanguage,
    },
    200,
  );
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;
  const apiKey = requireApiKey();
  if (!apiKey) return noStoreJson({ error: "服务器尚未设置 OpenAI API Key。" }, 503);

  let body: ProcessBody;
  try {
    body = (await request.json()) as ProcessBody;
  } catch {
    return noStoreJson({ error: "请求格式无效。" }, 400);
  }
  if (!isPatientLanguage(body.patientLanguage) || !isSessionId(body.sessionId)) {
    return noStoreJson({ error: "患者语言或会话参数无效。" }, 400);
  }

  if (body.phase === "translate") {
    if (
      typeof body.sourceText !== "string" ||
      !body.sourceText.trim() ||
      body.sourceText.length > 2_000
    ) {
      return noStoreJson({ error: "原文参数无效。" }, 400);
    }
    return translate(apiKey, body.sourceText.trim(), body.patientLanguage);
  }

  if (body.phase === "fast") {
    if (
      typeof body.sourceText !== "string" ||
      !body.sourceText.trim() ||
      body.sourceText.length > 2_000
    ) {
      return noStoreJson({ error: "原文参数无效。" }, 400);
    }
    return fastTranslate(
      apiKey,
      body.sourceText.trim(),
      body.patientLanguage,
      body.sessionId,
    );
  }

  if (body.phase === "verify") {
    const translation = parseAutomaticTranslationOutput(
      JSON.stringify(body.translation ?? null),
      body.patientLanguage,
    );
    if (translation) return verify(apiKey, translation, body.patientLanguage, body.sessionId);
  }
  return noStoreJson({ error: "处理阶段或翻译参数无效。" }, 400);
}
