import { describe, expect, it } from "vitest";
import { transitionState, type HandsFreeState } from "./hands-free-state";

describe("hands-free session state machine", () => {
  it("completes five consecutive conversation rounds without an input state", () => {
    let state: HandsFreeState = "idle";
    state = transitionState(state, "calibrating");
    state = transitionState(state, "listening");
    for (let turn = 0; turn < 5; turn += 1) {
      state = transitionState(state, "recording");
      state = transitionState(state, "transcribing");
      state = transitionState(state, "translating");
      state = transitionState(state, "verifying");
      state = transitionState(state, "speaking");
      state = transitionState(state, "cooldown");
      state = transitionState(state, "listening");
    }
    expect(state).toBe("listening");
  });

  it("rejects simultaneous or out-of-order processing states", () => {
    expect(() => transitionState("listening", "translating")).toThrow(/Invalid hands-free transition/);
    expect(() => transitionState("speaking", "recording")).toThrow(/Invalid hands-free transition/);
  });

  it("can pause and recalibrate before resuming", () => {
    expect(transitionState("listening", "paused")).toBe("paused");
    expect(transitionState("paused", "calibrating")).toBe("calibrating");
  });

  it("allows a reviewed fixed prompt from listening and returns through cooldown", () => {
    expect(transitionState("listening", "speaking")).toBe("speaking");
    expect(transitionState("speaking", "cooldown")).toBe("cooldown");
    expect(transitionState("cooldown", "listening")).toBe("listening");
  });
});
