export type RejectedTurnRecoveryOptions = {
  playPrompt: () => Promise<void>;
  finishTurn: () => Promise<void>;
  onPromptFailure?: (error: unknown) => void;
};

/**
 * A fixed "please repeat" prompt is helpful, but it is not part of the
 * translation safety decision. If device TTS fails, always return the state
 * machine to listening and keep the original rejection reason intact.
 */
export async function recoverRejectedTurn({
  playPrompt,
  finishTurn,
  onPromptFailure,
}: RejectedTurnRecoveryOptions) {
  try {
    await playPrompt();
  } catch (error) {
    onPromptFailure?.(error);
  }
  await finishTurn();
}
