import type { QuickCapturePayload } from '@/services/QuickCaptureService';
import type { WorkedExampleBeat } from '@/services/ai/WorkedExampleService';
import type { RacePlan, StepLocation } from '@/types/step-detail';
import type { TimelineStepVisibility } from '@/types/timeline-steps';

export type BlankFieldKey = 'why' | 'how' | 'when' | 'where';

export const BLANK_FIELDS: {key: BlankFieldKey; label: string; placeholder: string; multiline?: boolean}[] = [
  {key: 'why', label: 'Why', placeholder: 'Why does this matter right now?', multiline: true},
  {key: 'how', label: 'How', placeholder: 'How will you do it? One step per line.', multiline: true},
  {key: 'when', label: 'When', placeholder: 'When will you do this?'},
  {key: 'where', label: 'Where', placeholder: 'Where will this happen?'},
];

export const BLANK_FIELD_ORDER = BLANK_FIELDS.map((field) => field.key);
export const WORKED_EXAMPLE_FAILURE_MESSAGE = 'Could not build a worked example. Try again.';

export function emptyBlankValues(): Record<BlankFieldKey, string> {
  return {why: '', how: '', when: '', where: ''};
}

export function shouldShowWorkedExampleTrigger({
  whatText,
  workedApplied,
}: {
  whatText: string;
  workedApplied: boolean;
}): boolean {
  return whatText.trim().length > 0 && !workedApplied;
}

export function getWorkedExampleButtonLabel({
  workedGenerating,
}: {
  workedGenerating: boolean;
}): string {
  return workedGenerating ? 'Building a worked example…' : 'Build a worked example';
}

export function buildStepAddPayload({
  trimmed,
  fieldValues,
  whenISO,
  whereLocation,
  showRaceSelector,
  isRace,
  racePlan,
  photoUri,
  viewedSeasonId,
  visibility,
  workedBeats,
}: {
  trimmed: string;
  fieldValues: Record<BlankFieldKey, string>;
  whenISO: string | null;
  whereLocation: StepLocation | undefined;
  showRaceSelector: boolean;
  isRace: boolean;
  racePlan: RacePlan;
  photoUri: string | undefined;
  viewedSeasonId: string | null;
  visibility: TimelineStepVisibility;
  workedBeats: WorkedExampleBeat[];
}): QuickCapturePayload {
  return {
    kind: 'text',
    content: trimmed,
    why: fieldValues.why.trim() || undefined,
    how: fieldValues.how.trim() || undefined,
    scheduledAt: whenISO ?? undefined,
    location: whereLocation,
    isRace: showRaceSelector ? isRace : undefined,
    racePlan: showRaceSelector && isRace ? racePlan : undefined,
    imageUri: photoUri,
    viewedSeasonId,
    visibility,
    runthroughBeats: workedBeats.length > 0 ? workedBeats : undefined,
  };
}
