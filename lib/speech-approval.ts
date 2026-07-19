import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const configuredSecret = process.env.SPEECH_APPROVAL_SECRET?.trim();
const runtimeSecret = configuredSecret && configuredSecret.length >= 32
  ? Buffer.from(configuredSecret)
  : randomBytes(32);

function textHash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function signature(payload: string) {
  return createHmac("sha256", runtimeSecret).update(payload).digest("base64url");
}

export function issueSpeechApproval(text: string, sessionId: string, now = Date.now()) {
  const expiresAt = now + 5 * 60_000;
  const payload = `${sessionId}.${expiresAt}.${textHash(text)}`;
  return `${Buffer.from(payload).toString("base64url")}.${signature(payload)}`;
}

export function verifySpeechApproval(
  token: string,
  text: string,
  sessionId: string,
  now = Date.now(),
) {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  try {
    const payload = Buffer.from(parts[0], "base64url").toString("utf8");
    const [tokenSessionId, expiresAtRaw, tokenHash] = payload.split(".");
    const expiresAt = Number(expiresAtRaw);
    if (
      tokenSessionId !== sessionId ||
      !Number.isFinite(expiresAt) ||
      expiresAt < now ||
      tokenHash !== textHash(text)
    ) {
      return false;
    }
    const expected = Buffer.from(signature(payload));
    const supplied = Buffer.from(parts[1]);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}
