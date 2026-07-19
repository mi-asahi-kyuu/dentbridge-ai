import { describe, expect, it } from "vitest";
import { issueSpeechApproval, verifySpeechApproval } from "./speech-approval";

const sessionId = "4ce28f48-c749-4c55-80d6-d5199be31dc1";
const text = "昨日から歯が痛み始めました。";

describe("speech approval", () => {
  it("accepts only the reviewed text in the same session before expiry", () => {
    const now = 1_000_000;
    const token = issueSpeechApproval(text, sessionId, now);
    expect(verifySpeechApproval(token, text, sessionId, now + 1_000)).toBe(true);
    expect(verifySpeechApproval(token, "昨日からお腹が痛いです。", sessionId, now + 1_000)).toBe(false);
    expect(
      verifySpeechApproval(token, text, "c1f7a5a2-e71f-4f40-bfb6-d2e8e3769906", now + 1_000),
    ).toBe(false);
    expect(verifySpeechApproval(token, text, sessionId, now + 5 * 60_000 + 1)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifySpeechApproval("invalid", text, sessionId)).toBe(false);
  });
});
