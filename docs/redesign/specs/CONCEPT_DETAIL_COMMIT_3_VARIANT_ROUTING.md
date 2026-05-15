# Concept Detail Commit 3 Spec: Variant Routing

## Discrepancies

No repo contradiction found. `ConceptDetailScreen` currently accepts `variant: 'new' | 'dormant' | 'breakthrough'`; it has no explicit `default` variant. Default practicing chrome is therefore represented by the mature shell (`variant: 'dormant'`) with dormant footer fields omitted.

## Function Location

Create:

- `lib/concept-detail/variantRouting.ts`
- `lib/concept-detail/__tests__/variantRouting.test.ts`

Placement rationale: the function is domain routing logic, not React UI and not a Supabase service. `lib/` already houses reusable non-React logic and Jest tests under adjacent `__tests__` folders.

## Function Signature

```ts
export type ConceptDetailScreenVariant = 'new' | 'dormant' | 'breakthrough';

export type ConceptDetailStateKind =
  | 'forming'
  | 'learning'
  | 'practicing'
  | 'breakthrough';

export type ConceptDetailRouteBranch =
  | 'new'
  | 'dormant'
  | 'breakthrough'
  | 'default';

export interface ConceptDetailVariantInput {
  progressionState: ConceptDetailStateKind;
  breakthroughDetectedAt: string | null;
  breakthroughDismissedAt: string | null;
  totalLinkedReflections: number;
  lastReflectionAt: string | null;
  medianInterReflectionIntervalDays: number | null;
  now: Date;
}

export interface ConceptDetailVariantDecision {
  branch: ConceptDetailRouteBranch;
  screenVariant: ConceptDetailScreenVariant;
  stateKind: ConceptDetailStateKind;
  isDormant: boolean;
}

export function resolveConceptDetailVariant(
  input: ConceptDetailVariantInput,
): ConceptDetailVariantDecision
```

## Full Function Body

```ts
export type ConceptDetailScreenVariant = 'new' | 'dormant' | 'breakthrough';

export type ConceptDetailStateKind =
  | 'forming'
  | 'learning'
  | 'practicing'
  | 'breakthrough';

export type ConceptDetailRouteBranch =
  | 'new'
  | 'dormant'
  | 'breakthrough'
  | 'default';

export interface ConceptDetailVariantInput {
  progressionState: ConceptDetailStateKind;
  breakthroughDetectedAt: string | null;
  breakthroughDismissedAt: string | null;
  totalLinkedReflections: number;
  lastReflectionAt: string | null;
  medianInterReflectionIntervalDays: number | null;
  now: Date;
}

export interface ConceptDetailVariantDecision {
  branch: ConceptDetailRouteBranch;
  screenVariant: ConceptDetailScreenVariant;
  stateKind: ConceptDetailStateKind;
  isDormant: boolean;
}

const DORMANCY_MULTIPLIER = 4;
const DORMANCY_FLOOR_DAYS = 30;
const DORMANCY_CEILING_DAYS = 120;
const FALLBACK_MEDIAN_INTERVAL_DAYS = 45 / DORMANCY_MULTIPLIER;

export function resolveConceptDetailVariant(
  input: ConceptDetailVariantInput,
): ConceptDetailVariantDecision {
  // Decision 3: an active breakthrough signal is the strongest user-facing
  // state. It wins over dormancy because "something changed" should not be
  // hidden behind "worth revisiting."
  if (input.breakthroughDetectedAt && !input.breakthroughDismissedAt) {
    return {
      branch: 'breakthrough',
      screenVariant: 'breakthrough',
      stateKind: 'breakthrough',
      isDormant: false,
    };
  }

  // Decision 1: "new" means not enough evidence yet, not merely active.
  if (
    input.totalLinkedReflections <= 1 ||
    input.progressionState === 'forming'
  ) {
    return {
      branch: 'new',
      screenVariant: 'new',
      stateKind: 'forming',
      isDormant: false,
    };
  }

  // Decision 2: dormancy is cadence-aware, with a floor and ceiling.
  if (isConceptDormant(input)) {
    return {
      branch: 'dormant',
      screenVariant: 'dormant',
      stateKind: 'practicing',
      isDormant: true,
    };
  }

  // Decision 1: mature non-dormant concepts use default practicing chrome.
  // ConceptDetailScreen has no explicit default variant, so the caller uses
  // the mature shell and omits dormant footer props.
  return {
    branch: 'default',
    screenVariant: 'dormant',
    stateKind: input.progressionState === 'learning' ? 'learning' : 'practicing',
    isDormant: false,
  };
}

export function isConceptDormant(input: {
  totalLinkedReflections: number;
  lastReflectionAt: string | null;
  medianInterReflectionIntervalDays: number | null;
  now: Date;
}): boolean {
  if (input.totalLinkedReflections < 3 || !input.lastReflectionAt) {
    return false;
  }

  const last = Date.parse(input.lastReflectionAt);
  if (!Number.isFinite(last)) return false;

  const daysSinceLast = Math.floor(
    (input.now.getTime() - last) / (1000 * 60 * 60 * 24),
  );

  const median =
    input.medianInterReflectionIntervalDays ?? FALLBACK_MEDIAN_INTERVAL_DAYS;
  const threshold = clamp(
    DORMANCY_MULTIPLIER * median,
    DORMANCY_FLOOR_DAYS,
    DORMANCY_CEILING_DAYS,
  );

  return daysSinceLast > threshold;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
```

## Variant Decision Order

1. Breakthrough wins if `breakthroughDetectedAt` is present and not dismissed.
2. New/forming applies if there is one or zero linked reflections, or explicit `progressionState === 'forming'`.
3. Dormant applies if the cadence-aware threshold is exceeded.
4. Default practicing chrome applies otherwise.

Reasoning: breakthrough is an active system observation that the user should see even if the concept is also old. Dormancy is a resurfacing affordance; it should not suppress a stronger "something changed" moment.

## Default Branch

Return:

```ts
{
  branch: 'default',
  screenVariant: 'dormant',
  stateKind: 'practicing' | 'learning',
  isDormant: false,
}
```

The parent route passes `variant={decision.screenVariant}` to `ConceptDetailScreen`, but only passes dormant footer props when `decision.isDormant === true`. That yields full mature synthesis and reflection trail with no dormant footer.

## Wiring

Commit 3 should add the route-level adapter but still not wire the feature flag render switch. The render switch remains Commit 4.

Patch shape for `app/concept-ios/[slug].tsx`:

```diff
 import { ReflectionCard } from '@/components/ios-register';
+import {
+  ConceptDetailScreen,
+  type ConceptDetailContent,
+} from '@/components/ios-register';
 import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
+import { resolveConceptDetailVariant } from '@/lib/concept-detail/variantRouting';
 import {
   IOS_COLORS,
   IOS_REGISTER,
   IOS_REGISTER_TEXT,
 } from '@/lib/design-tokens-ios';
 import { useInterest } from '@/providers/InterestProvider';
-import { usePlaybook, usePlaybookConceptBySlug } from '@/hooks/usePlaybook';
-import { useMyTimeline } from '@/hooks/useTimelineSteps';
+import {
+  useConceptDetailState,
+  usePlaybook,
+  usePlaybookConceptBySlug,
+} from '@/hooks/usePlaybook';
```

```diff
   const { data: concept, isLoading } = usePlaybookConceptBySlug(
     playbook?.id,
     interestId,
     actualSlug,
   );
-  const { data: timeline } = useMyTimeline(interestId);
-
-  const reflections = useMemo(
-    () => buildConceptReflections(timeline ?? []),
-    [timeline],
-  );
+  const {
+    data: conceptDetailState,
+    isLoading: isStateLoading,
+  } = useConceptDetailState(playbook?.id, interestId, concept?.id);
```

```diff
-  if (isLoading) {
+  if (isLoading || isStateLoading) {
     return (
       <SafeAreaView style={styles.loading}>
         <Stack.Screen options={{ headerShown: false }} />
         <ActivityIndicator color={IOS_REGISTER.accentUserAction} />
       </SafeAreaView>
     );
   }
 
-  if (!concept) {
+  if (!concept || !conceptDetailState) {
     return <ErrorState message="Concept not found in this playbook." />;
   }
 
-  const updatedRelative = formatDistanceToNowStrict(
-    parseISO(concept.updated_at),
-    { addSuffix: true },
-  );
+  const decision = resolveConceptDetailVariant({
+    progressionState: conceptDetailState.progressionState,
+    breakthroughDetectedAt: conceptDetailState.breakthroughDetectedAt,
+    breakthroughDismissedAt: conceptDetailState.breakthroughDismissedAt,
+    totalLinkedReflections: conceptDetailState.totalLinkedReflections,
+    lastReflectionAt: conceptDetailState.lastReflectionAt,
+    medianInterReflectionIntervalDays:
+      conceptDetailState.medianInterReflectionIntervalDays,
+    now: new Date(),
+  });
+  const content = buildConceptDetailContent(concept, conceptDetailState, decision);
```

The first render-switch commit can then use this adapter under `FEATURE_FLAGS.CONCEPT_IOS_REGISTER`.

Required helper shape in `app/concept-ios/[slug].tsx`:

```ts
function buildConceptDetailContent(
  concept: PlaybookConceptRecord,
  state: ConceptDetailState,
  decision: ConceptDetailVariantDecision,
): ConceptDetailContent {
  const updatedRelative = formatDistanceToNowStrict(
    parseISO(concept.updated_at),
    { addSuffix: true },
  );

  return {
    title: concept.title,
    stateKind: decision.stateKind,
    metaSpans: buildMetaSpans(concept, state),
    synthesisParagraphs: buildSynthesisParagraphs(concept, decision),
    synthesisStamp: updatedRelative,
    suggestNextCopy:
      decision.branch === 'new'
        ? 'Note how this comes up the next time you practice. The pattern needs two or three angles before it can be a claim.'
        : undefined,
    aiOfferLabel:
      decision.branch === 'breakthrough' ? 'We noticed a shift' : undefined,
    aiOfferBody:
      decision.branch === 'breakthrough'
        ? buildBreakthroughOfferBody(state)
        : undefined,
    dormantFooterStamp:
      decision.isDormant && state.lastReflectionAt
        ? `Last reflection ${formatDistanceToNowStrict(parseISO(state.lastReflectionAt), { addSuffix: true })}`
        : undefined,
    dormantFooterAsk: decision.isDormant ? 'Worth revisiting?' : undefined,
    reflections: buildConceptReflectionsFromLinkedSteps(state.linkedReflectionSteps),
    totalReflections: state.totalLinkedReflections,
  };
}
```

## Test Cases

Create `lib/concept-detail/__tests__/variantRouting.test.ts`:

```ts
import {
  isConceptDormant,
  resolveConceptDetailVariant,
  type ConceptDetailVariantInput,
} from '../variantRouting';

const NOW = new Date('2026-05-15T12:00:00.000Z');

function input(
  overrides: Partial<ConceptDetailVariantInput> = {},
): ConceptDetailVariantInput {
  return {
    progressionState: 'practicing',
    breakthroughDetectedAt: null,
    breakthroughDismissedAt: null,
    totalLinkedReflections: 3,
    lastReflectionAt: '2026-05-01T12:00:00.000Z',
    medianInterReflectionIntervalDays: 7,
    now: NOW,
    ...overrides,
  };
}

describe('resolveConceptDetailVariant', () => {
  it('routes empty state to new/forming', () => {
    expect(resolveConceptDetailVariant(input({
      totalLinkedReflections: 0,
      lastReflectionAt: null,
      medianInterReflectionIntervalDays: null,
    }))).toEqual({
      branch: 'new',
      screenVariant: 'new',
      stateKind: 'forming',
      isDormant: false,
    });
  });

  it('routes one-reflection concept to new/forming', () => {
    expect(resolveConceptDetailVariant(input({
      totalLinkedReflections: 1,
      progressionState: 'practicing',
    })).branch).toBe('new');
  });

  it('routes mature active concept to default practicing chrome', () => {
    expect(resolveConceptDetailVariant(input({
      totalLinkedReflections: 5,
      lastReflectionAt: '2026-05-05T12:00:00.000Z',
      medianInterReflectionIntervalDays: 14,
    }))).toEqual({
      branch: 'default',
      screenVariant: 'dormant',
      stateKind: 'practicing',
      isDormant: false,
    });
  });

  it('routes dormant concept when cadence threshold is exceeded', () => {
    expect(resolveConceptDetailVariant(input({
      totalLinkedReflections: 5,
      lastReflectionAt: '2026-02-14T12:00:00.000Z',
      medianInterReflectionIntervalDays: 14,
    }))).toEqual({
      branch: 'dormant',
      screenVariant: 'dormant',
      stateKind: 'practicing',
      isDormant: true,
    });
  });

  it('routes breakthrough before dormancy', () => {
    expect(resolveConceptDetailVariant(input({
      breakthroughDetectedAt: '2026-05-10T12:00:00.000Z',
      lastReflectionAt: '2026-01-01T12:00:00.000Z',
      medianInterReflectionIntervalDays: 7,
    }))).toEqual({
      branch: 'breakthrough',
      screenVariant: 'breakthrough',
      stateKind: 'breakthrough',
      isDormant: false,
    });
  });

  it('ignores dismissed breakthrough and evaluates normal routing', () => {
    expect(resolveConceptDetailVariant(input({
      breakthroughDetectedAt: '2026-05-10T12:00:00.000Z',
      breakthroughDismissedAt: '2026-05-11T12:00:00.000Z',
      lastReflectionAt: '2026-05-05T12:00:00.000Z',
      medianInterReflectionIntervalDays: 14,
    })).branch).toBe('default');
  });
});

describe('isConceptDormant', () => {
  it('uses the 30-day floor when median cadence is short', () => {
    expect(isConceptDormant(input({
      lastReflectionAt: '2026-04-14T12:00:00.000Z',
      medianInterReflectionIntervalDays: 3,
    }))).toBe(true);
  });

  it('uses the 120-day ceiling when median cadence is long', () => {
    expect(isConceptDormant(input({
      lastReflectionAt: '2026-01-14T12:00:00.000Z',
      medianInterReflectionIntervalDays: 90,
    }))).toBe(true);
  });

  it('does not mark fewer than three reflections dormant', () => {
    expect(isConceptDormant(input({
      totalLinkedReflections: 2,
      lastReflectionAt: '2026-01-01T12:00:00.000Z',
      medianInterReflectionIntervalDays: 7,
    }))).toBe(false);
  });
});
```

Run:

```sh
npx jest lib/concept-detail/__tests__/variantRouting.test.ts --runInBand
```

## Commit Message

```text
feat(playbook): add Concept detail variant routing

Add the pure routing helper for Concept detail iOS state variants.

- route breakthrough before dormant when an active breakthrough signal exists
- apply the cadence-aware dormancy threshold from the cutover decision
- route one-reflection/forming concepts to new
- keep mature active concepts on default practicing chrome
- cover floor, ceiling, dismissed-breakthrough, and low-evidence cases

This prepares the canonical Concept detail route for the render-switch commit
without changing the flag gate yet.
```
