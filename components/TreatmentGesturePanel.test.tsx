import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TreatmentGesturePanel } from "./TreatmentGesturePanel";

describe("TreatmentGesturePanel", () => {
  it("shows bilingual guidance and blocks confirmation until playback is complete", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <TreatmentGesturePanel
        patientLanguage="zh"
        guidanceReady={false}
        machineState="speaking"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("heading", { name: "治療前の手の合図確認" })).toBeInTheDocument();
    expect(screen.getByText("治疗前确认手势").closest("[lang]")).toHaveAttribute("lang", "zh-CN");
    expect(screen.getByText(/本App不会自动识别手势/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /目視確認して治療開始/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /中止して会話モードへ戻る/ })).toBeDisabled();

    rerender(
      <TreatmentGesturePanel
        patientLanguage="zh"
        guidanceReady
        machineState="listening"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /目視確認して治療開始/ }));
    fireEvent.click(screen.getByRole("button", { name: /中止して会話モードへ戻る/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses the selected patient language instead of a Japanese-only notice", () => {
    render(
      <TreatmentGesturePanel
        patientLanguage="en"
        guidanceReady
        machineState="listening"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByText("Confirm the stop signal before treatment").closest("[lang]"))
      .toHaveAttribute("lang", "en-US");
    expect(screen.getByText(/This app does not detect the signal/)).toBeInTheDocument();
  });
});
