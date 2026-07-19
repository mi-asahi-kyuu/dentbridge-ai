"use client";

import {
  CheckCircle,
  CircleNotch,
  HandPalm,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import type { HandsFreeState } from "@/lib/hands-free-state";
import { getLanguage } from "@/lib/languages";
import {
  TREATMENT_GESTURE_GUIDANCE,
  type PatientLanguageCode,
} from "@/lib/treatment-phrases";

type Props = {
  patientLanguage: PatientLanguageCode;
  guidanceReady: boolean;
  machineState: HandsFreeState;
  onConfirm: () => void;
  onCancel: () => void;
};

export function TreatmentGesturePanel({
  patientLanguage,
  guidanceReady,
  machineState,
  onConfirm,
  onCancel,
}: Props) {
  const patient = getLanguage(patientLanguage);
  const patientGuidance = TREATMENT_GESTURE_GUIDANCE.patients[patientLanguage];
  const canAct = machineState === "listening";
  const guidanceInProgress = !guidanceReady && ["transcribing", "speaking", "cooldown"].includes(machineState);

  return (
    <section
      className="rounded-2xl border-2 border-[#c58a20] bg-[#fff8e7] p-5 md:col-span-2 md:row-start-1 sm:p-7"
      role="region"
      aria-labelledby="gesture-confirmation-title"
      aria-describedby="gesture-confirmation-status"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f4dfad] text-[#77500a]">
          <HandPalm size={30} weight="bold" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-black tracking-[0.12em] text-[#82601e]">治療を始める前に必要です</p>
          <h2 id="gesture-confirmation-title" className="mt-1 text-2xl font-black text-[#60420a]">
            {TREATMENT_GESTURE_GUIDANCE.japanese.title}
          </h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#dfc98f] bg-white p-4 sm:p-5" lang="ja">
          <p className="text-xs font-black text-[#745619]">歯科医師・助手と患者への説明</p>
          <p className="mt-2 text-lg font-black leading-8">
            {TREATMENT_GESTURE_GUIDANCE.japanese.instruction}
          </p>
          <p className="mt-3 border-t border-[#eadcb6] pt-3 text-sm font-bold leading-6 text-[#5d5543]">
            {TREATMENT_GESTURE_GUIDANCE.japanese.observation}
          </p>
        </div>
        <div className="rounded-xl border-2 border-[#afcfc4] bg-[#f3faf7] p-4 sm:p-5" lang={patient.locale}>
          <p className="text-base font-black text-[#276c58]">{patientGuidance.title}</p>
          <p className="mt-2 text-xl font-black leading-9 text-[#1f5548]">
            {patientGuidance.instruction}
          </p>
          <p className="mt-3 border-t border-[#cde2db] pt-3 text-sm font-bold leading-6 text-[#3e655b]">
            {patientGuidance.observation}
          </p>
        </div>
      </div>

      <div id="gesture-confirmation-status" className="mt-4 rounded-xl border border-[#d7b761] bg-white px-4 py-3 text-sm font-black leading-6 text-[#624713]" aria-live="polite">
        {guidanceReady ? (
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 shrink-0 text-[#2f7f6a]" size={22} weight="fill" aria-hidden="true" />
            <span>{TREATMENT_GESTURE_GUIDANCE.japanese.staffPrompt}</span>
          </div>
        ) : guidanceInProgress ? (
          <div className="flex items-start gap-2">
            <CircleNotch className="status-spinner mt-0.5 shrink-0" size={22} weight="bold" aria-hidden="true" />
            <span>患者言語で説明を再生しています。再生が完了するまで治療モードには入りません。</span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-[#8a4f16]">
            <Warning className="mt-0.5 shrink-0" size={22} weight="fill" aria-hidden="true" />
            <span>説明の再生が完了していません。「治療を始めます」ともう一度話すか、中止して会話モードへ戻ってください。</span>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1.35fr_0.65fr]">
        <button
          type="button"
          className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-[#2f7f6a] px-4 text-base font-black text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!guidanceReady || !canAct}
          onClick={onConfirm}
        >
          <CheckCircle size={24} weight="fill" aria-hidden="true" />
          {TREATMENT_GESTURE_GUIDANCE.japanese.buttonLabel}
        </button>
        <button
          type="button"
          className="secondary-action min-h-16"
          disabled={!canAct}
          onClick={onCancel}
        >
          <XCircle size={23} weight="bold" aria-hidden="true" />
          中止して会話モードへ戻る
        </button>
      </div>
    </section>
  );
}
