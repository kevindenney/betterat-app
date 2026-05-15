# Concept Detail Commit 2 Spec: Read Path

## Discrepancies

No repo contradiction found. The current route `app/concept-ios/[slug].tsx` already reads real concept data with `usePlaybookConceptBySlug` and a broad `useMyTimeline` heuristic. This spec replaces the broad timeline heuristic for Concept detail with a concept-linked read path.

## Hook Location

Service file: `services/PlaybookService.ts`

Hook file: `hooks/usePlaybook.ts`

Current route dependencies:

```ts
const { data: concept, isLoading } = usePlaybookConceptBySlug(
  playbook?.id,
  interestId,
  actualSlug,
);
const { data: timeline } = useMyTimeline(interestId);
```

New hook:

```ts
export function useConceptDetailState(
  playbookId: string | undefined,
  interestId: string | undefined,
  conceptId: string | undefined,
)
```

Do not change `usePlaybookConceptBySlug`. Add the new hook beside it and let `app/concept-ios/[slug].tsx` call it after `concept?.id` is known.

## TypeScript Types

Add to `types/playbook.ts`:

```ts
export type ConceptProgressionState =
  | 'forming'
  | 'learning'
  | 'practicing'
  | 'breakthrough';

export interface PlaybookConceptUserStateRecord {
  id: string;
  user_id: string;
  playbook_id: string;
  concept_id: string;
  progression_state: ConceptProgressionState;
  breakthrough_detected_at: string | null;
  breakthrough_dismissed_at: string | null;
  breakthrough_evidence: ConceptBreakthroughEvidence[];
  last_state_computed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConceptBreakthroughEvidence {
  stepId?: string;
  reflectionId?: string;
  excerpt?: string;
  rationale?: string;
}

export interface ConceptLinkedReflectionStep {
  id: string;
  title: string;
  completed_at: string;
  metadata: Record<string, unknown>;
}

export interface ConceptDetailState {
  stateRow: PlaybookConceptUserStateRecord | null;
  progressionState: ConceptProgressionState;
  breakthroughDetectedAt: string | null;
  breakthroughDismissedAt: string | null;
  breakthroughEvidence: ConceptBreakthroughEvidence[];
  totalLinkedReflections: number;
  firstReflectionAt: string | null;
  lastReflectionAt: string | null;
  medianInterReflectionIntervalDays: number | null;
  linkedReflectionSteps: ConceptLinkedReflectionStep[];
}
```

Add these imports to `hooks/usePlaybook.ts`:

```ts
import type {
  ConceptDetailState,
  // existing imports...
} from '@/types/playbook';
```

## Query Construction

Add to `services/PlaybookService.ts`:

```ts
import type {
  ConceptBreakthroughEvidence,
  ConceptDetailState,
  ConceptLinkedReflectionStep,
  ConceptProgressionState,
  PlaybookConceptUserStateRecord,
} from '@/types/playbook';
```

Add service function:

```ts
export async function getConceptDetailState(
  userId: string,
  playbookId: string,
  interestId: string,
  conceptId: string,
): Promise<ConceptDetailState> {
  try {
    const [stateResult, linkedStepsResult] = await Promise.all([
      supabase
        .from('playbook_concept_user_state')
        .select('*')
        .eq('user_id', userId)
        .eq('playbook_id', playbookId)
        .eq('concept_id', conceptId)
        .maybeSingle(),
      supabase
        .from('step_playbook_links')
        .select(`
          step_id,
          timeline_steps!inner (
            id,
            title,
            completed_at,
            metadata,
            user_id,
            interest_id
          )
        `)
        .eq('item_type', 'concept')
        .eq('item_id', conceptId)
        .eq('timeline_steps.user_id', userId)
        .eq('timeline_steps.interest_id', interestId)
        .not('timeline_steps.completed_at', 'is', null),
    ]);

    if (stateResult.error) throw stateResult.error;
    if (linkedStepsResult.error) throw linkedStepsResult.error;

    const stateRow =
      (stateResult.data as PlaybookConceptUserStateRecord | null) ?? null;

    const linkedReflectionSteps = ((linkedStepsResult.data ?? []) as Array<{
      timeline_steps:
        | {
            id: string;
            title: string;
            completed_at: string | null;
            metadata: Record<string, unknown> | null;
          }
        | {
            id: string;
            title: string;
            completed_at: string | null;
            metadata: Record<string, unknown> | null;
          }[];
        | null;
    }>)
      .flatMap((row) => {
        const step = Array.isArray(row.timeline_steps)
          ? row.timeline_steps[0]
          : row.timeline_steps;
        if (!step?.completed_at) return [];
        return [{
          id: step.id,
          title: step.title,
          completed_at: step.completed_at,
          metadata: (step.metadata ?? {}) as Record<string, unknown>,
        }];
      })
      .sort((a, b) => a.completed_at.localeCompare(b.completed_at));

    const totalLinkedReflections = linkedReflectionSteps.length;
    const firstReflectionAt = linkedReflectionSteps[0]?.completed_at ?? null;
    const lastReflectionAt =
      linkedReflectionSteps[linkedReflectionSteps.length - 1]?.completed_at ?? null;
    const medianInterReflectionIntervalDays =
      computeMedianInterReflectionIntervalDays(linkedReflectionSteps);

    return {
      stateRow,
      progressionState:
        stateRow?.progression_state ??
        deriveDefaultProgressionState(totalLinkedReflections),
      breakthroughDetectedAt: stateRow?.breakthrough_detected_at ?? null,
      breakthroughDismissedAt: stateRow?.breakthrough_dismissed_at ?? null,
      breakthroughEvidence:
        normalizeBreakthroughEvidence(stateRow?.breakthrough_evidence),
      totalLinkedReflections,
      firstReflectionAt,
      lastReflectionAt,
      medianInterReflectionIntervalDays,
      linkedReflectionSteps,
    };
  } catch (err) {
    logger.error('Failed to fetch concept detail state', err);
    throw err;
  }
}

function deriveDefaultProgressionState(
  totalLinkedReflections: number,
): ConceptProgressionState {
  if (totalLinkedReflections <= 1) return 'forming';
  return 'practicing';
}

function normalizeBreakthroughEvidence(
  value: unknown,
): ConceptBreakthroughEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ConceptBreakthroughEvidence => {
    return Boolean(item && typeof item === 'object');
  });
}

function computeMedianInterReflectionIntervalDays(
  steps: ConceptLinkedReflectionStep[],
): number | null {
  const timestamps = steps
    .map((step) => Date.parse(step.completed_at))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  if (timestamps.length < 2) return null;

  const intervals = timestamps.slice(1).map((time, index) => {
    return (time - timestamps[index]) / (1000 * 60 * 60 * 24);
  }).sort((a, b) => a - b);

  const middle = Math.floor(intervals.length / 2);
  if (intervals.length % 2 === 1) return intervals[middle];
  return (intervals[middle - 1] + intervals[middle]) / 2;
}
```

## Hook Construction

Add `getConceptDetailState` to the import list in `hooks/usePlaybook.ts`.

Add query key:

```ts
conceptDetailState: (
  userId: string,
  playbookId: string,
  interestId: string,
  conceptId: string,
) =>
  ['playbook-concept-detail-state', userId, playbookId, interestId, conceptId] as const,
```

Add hook:

```ts
export function useConceptDetailState(
  playbookId: string | undefined,
  interestId: string | undefined,
  conceptId: string | undefined,
) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<ConceptDetailState, Error>({
    queryKey: KEYS.conceptDetailState(
      userId ?? '',
      playbookId ?? '',
      interestId ?? '',
      conceptId ?? '',
    ),
    queryFn: () =>
      getConceptDetailState(userId!, playbookId!, interestId!, conceptId!),
    enabled:
      Boolean(userId) &&
      Boolean(playbookId) &&
      Boolean(interestId) &&
      Boolean(conceptId),
  });
}
```

## Reflection Aggregate Derivation

- `total_linked_reflections`: TypeScript after fetch. Count linked completed steps returned by one Supabase query.
- `last_reflection_at`: TypeScript after fetch. Last `completed_at` after ascending sort.
- `median_inter_reflection_interval_days`: TypeScript after fetch. Computed from sorted timestamps.

Rationale: this avoids adding an RPC for the first data-layer commit and avoids N+1 queries. The linked-step query is one request bounded by a single concept id. If Concept detail starts loading hundreds of linked reflections, convert this to an RPC that computes aggregate fields in SQL and separately pages the reflection list.

## Empty-State Behavior

When no `playbook_concept_user_state` row exists:

```ts
{
  stateRow: null,
  progressionState: totalLinkedReflections <= 1 ? 'forming' : 'practicing',
  breakthroughDetectedAt: null,
  breakthroughDismissedAt: null,
  breakthroughEvidence: [],
  totalLinkedReflections,
  firstReflectionAt,
  lastReflectionAt,
  medianInterReflectionIntervalDays,
  linkedReflectionSteps,
}
```

Do not write a state row in Commit 2. This commit is read-only except for TypeScript code. Lazy row creation can be added later if state needs persistence before a breakthrough detector exists.

## Loading and Error States

The hook uses React Query, matching `usePlaybookConceptBySlug`.

- `isLoading` true while the state query is in flight.
- `error` populated with Supabase or service errors.
- The consumer should keep the existing loading/error behavior until both concept and concept-detail-state queries are ready.
- A missing state row is not an error.

## Performance Note

Query count per Concept detail load after Commit 2:

- Existing playbook query: unchanged.
- Existing concept query: unchanged.
- New concept state query: one Supabase request that runs two queries in `Promise.all`.
- Remove the broad `useMyTimeline(interestId)` from the Concept detail route during Commit 3 wiring; until then, Commit 2 can land unused.

N+1 risk: absent. The linked reflections are fetched in one joined query by concept id. The only future risk is large reflection history; address with pagination or SQL aggregate RPC if a concept exceeds roughly 100 linked completed steps.

## Test Cases

- Brand-new user/concept with no state row and no linked reflections:
  `progressionState: 'forming'`, `totalLinkedReflections: 0`, all date fields `null`, evidence `[]`.
- Concept with 1 linked completed step:
  `progressionState: 'forming'`, `totalLinkedReflections: 1`, first and last reflection equal that step timestamp, median `null`.
- Concept with 3 recent linked completed steps:
  `progressionState: 'practicing'` if no state row, total `3`, median interval computed from timestamps.
- Concept matching dormant threshold:
  hook does not return `dormant`; it returns aggregate fields that make `resolveConceptDetailVariant` return dormant in Commit 3.
- Concept with breakthrough state row:
  `progressionState: 'breakthrough'`, `breakthroughDetectedAt` populated, `breakthroughDismissedAt: null`, evidence normalized to an array.

## Commit Message

```text
feat(playbook): expose Concept detail state read path

Add the Concept detail state service and React Query hook used by the iOS
register route.

- read playbook_concept_user_state by user/playbook/concept
- derive linked reflection counts and dates from step_playbook_links +
  completed timeline_steps
- return deterministic defaults when no state row exists
- keep the read path batched and avoid per-reflection N+1 queries

This prepares /concept-ios/[slug] for variant routing without changing the
render switch yet.
```
