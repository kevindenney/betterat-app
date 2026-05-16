export type ReflectPromptKind = 'what_worked' | 'what_to_improve';

export type ReflectCompletionState =
  | 'empty'
  | 'needs_worked'
  | 'needs_improve'
  | 'ready'
  | 'complete';

export interface ReflectPromptAnswer {
  id: string;
  kind: ReflectPromptKind;
  prompt: string;
  answer?: string | null;
  capabilityLabel?: string | null;
}

export function hasReflectAnswer(answer: Pick<ReflectPromptAnswer, 'answer'>): boolean {
  return Boolean(answer.answer?.trim());
}

export function deriveReflectState(input: {
  hasDoCapture: boolean;
  answers: ReflectPromptAnswer[];
  completedAt?: string | null;
}): ReflectCompletionState {
  if (input.completedAt) return 'complete';
  if (!input.hasDoCapture) return 'empty';

  const hasWorked = input.answers.some(
    (answer) => answer.kind === 'what_worked' && hasReflectAnswer(answer),
  );
  const hasImprove = input.answers.some(
    (answer) => answer.kind === 'what_to_improve' && hasReflectAnswer(answer),
  );

  if (!hasWorked) return 'needs_worked';
  if (!hasImprove) return 'needs_improve';
  return 'ready';
}
