import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "./rate-limit";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export function noStoreJson(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
) {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

function anonymousRequestKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(address).digest("hex");
}

export function enforceRateLimit(request: NextRequest, limit = 60) {
  const rate = checkRateLimit(
    `${anonymousRequestKey(request)}:${request.nextUrl.pathname}`,
    Date.now(),
    limit,
  );
  if (rate.allowed) return null;
  return noStoreJson(
    { error: "请求过于频繁。请稍候再试。" },
    429,
    { "Retry-After": String(rate.retryAfterSeconds) },
  );
}

export function requireApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey?.trim() || null;
}

export function safeUpstreamError(status: number) {
  if (status === 400) return "AI 服务无法处理这段内容。请确认原文后再试。";
  if (status === 401) return "OpenAI API Key 无效或无权使用所需模型。";
  if (status === 429) return "翻译服务当前繁忙或已达到使用限制，请稍候重试。";
  return "外部 AI 服务暂时无法完成处理，请重新尝试。";
}
