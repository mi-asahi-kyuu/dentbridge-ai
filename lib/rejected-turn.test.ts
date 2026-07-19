import { describe, expect, it, vi } from "vitest";
import { recoverRejectedTurn } from "./rejected-turn";

describe("rejected translation recovery", () => {
  it("returns to listening even when the fixed repeat prompt cannot play", async () => {
    const playbackError = new Error("iPad native speech did not start");
    const finishTurn = vi.fn(async () => undefined);
    const onPromptFailure = vi.fn();

    await expect(recoverRejectedTurn({
      playPrompt: async () => { throw playbackError; },
      finishTurn,
      onPromptFailure,
    })).resolves.toBeUndefined();

    expect(onPromptFailure).toHaveBeenCalledWith(playbackError);
    expect(finishTurn).toHaveBeenCalledOnce();
  });

  it("waits for a successful repeat prompt before returning to listening", async () => {
    const order: string[] = [];
    await recoverRejectedTurn({
      playPrompt: async () => { order.push("prompt"); },
      finishTurn: async () => { order.push("listening"); },
    });
    expect(order).toEqual(["prompt", "listening"]);
  });
});
