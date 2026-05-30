import type {
  AtlasRaceNote,
  AtlasRaceNoteKind,
  AtlasRaceNotePhase,
  AtlasStepData,
  Observation,
  StepMetadata,
  StepReviewData,
  StepReviewSection,
} from '@/types/step-detail';

export const LOCAL_KNOWLEDGE_TEMPLATES: Array<{
  kind: AtlasRaceNoteKind;
  label: string;
  text: string;
}> = [
  { kind: 'favoured_pin', label: 'Favoured pin', text: 'Favoured pin.' },
  { kind: 'bad_air', label: 'Bad air here', text: 'Bad air here.' },
  { kind: 'left_paid', label: 'Left paid', text: 'Left paid.' },
  { kind: 'gate_crowded', label: 'Gate crowded', text: 'Gate too crowded.' },
];

export function getAtlasStepData(
  metadata?: StepMetadata | Record<string, unknown> | null,
): AtlasStepData | undefined {
  const atlas = metadata?.atlas;
  if (!atlas || typeof atlas !== 'object' || Array.isArray(atlas)) {
    return undefined;
  }
  return atlas as AtlasStepData;
}

export function isAtlasRaceCourseStep(
  metadata?: StepMetadata | Record<string, unknown> | null,
): boolean {
  return Boolean(getAtlasStepData(metadata)?.race_course_context);
}

export function buildObservation(text: string): Observation {
  return {
    id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text,
    timestamp: new Date().toISOString(),
    source: 'note',
  };
}

export function appendAtlasRaceNote(
  atlas: AtlasStepData | undefined,
  input: {
    text: string;
    phase: AtlasRaceNotePhase;
    kind?: AtlasRaceNoteKind;
    source: AtlasRaceNote['source'];
    lat?: number;
    lng?: number;
    focus_label?: string;
  },
): AtlasStepData {
  const note: AtlasRaceNote = {
    id: `atlas_note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: input.text,
    created_at: new Date().toISOString(),
    phase: input.phase,
    kind: input.kind ?? 'general',
    source: input.source,
    lat: input.lat,
    lng: input.lng,
    focus_label: input.focus_label,
  };

  return {
    ...(atlas ?? {}),
    local_knowledge_notes: [...(atlas?.local_knowledge_notes ?? []), note],
  };
}

export function appendReviewAnythingElseNote(
  review: StepReviewData | undefined,
  noteText: string,
): StepReviewData {
  const current = review ?? {};
  const existing = Array.isArray(current.sections) ? current.sections : [];
  const prompt = 'anything_else';
  let existingInAppContent = '';
  const retained: StepReviewSection[] = [];

  for (const section of existing) {
    if (section.prompt === prompt && section.source === 'in_app') {
      existingInAppContent = section.content ?? '';
      continue;
    }
    retained.push(section);
  }

  const combined = [existingInAppContent.trim(), noteText.trim()]
    .filter(Boolean)
    .join('\n');
  const capturedAt = new Date().toISOString();

  return {
    ...current,
    sections: combined
      ? [
          ...retained,
          {
            prompt,
            prompt_label: 'Anything else?',
            content: combined,
            source: 'in_app',
            captured_at: capturedAt,
          },
        ]
      : retained,
    composed_via: 'in_app',
    composed_at: current.composed_at ?? capturedAt,
    next_step_notes: combined,
  };
}
