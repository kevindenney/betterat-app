# Concept Detail iOS Cutover Checklist

## Pre-cutover gates

- [ ] `app/concept-detail-ios.tsx` exists and is visually verified in simulator at `/concept-detail-ios`
- [ ] `app/concept-ios/[slug].tsx` remains the canonical data-wired iOS concept route
- [ ] `FEATURE_FLAGS.CONCEPT_IOS_REGISTER` exists in `lib/featureFlags.ts`
- [ ] `ConceptDetailScreen` is exported from `components/ios-register/index.ts`
- [ ] Data mapping exists from current concept records and reflection trail into `ConceptDetailContent`
- [ ] Concept detail data-layer work from `docs/redesign/CONCEPT_DETAIL_DATA_LAYER_WORK.md` has landed before the render switch:
  proposed migration, backfill/derived read path, hook type updates, and variant-routing helper
- [ ] Current repo-state checks remain clean:
  `npm run typecheck` and targeted ESLint on `app/concept-detail-ios.tsx`, `app/concept-ios/[slug].tsx`, `components/ios-register/ConceptDetailScreen.tsx`, and `lib/featureFlags.ts`

## Cutover sequence

- [ ] Keep the cutover single-surface:
  one flag, one canonical Concept detail route switch
- [ ] Use `FEATURE_FLAGS.CONCEPT_IOS_REGISTER` as the gate
- [ ] Flag ON:
  `app/concept-ios/[slug].tsx` maps real concept data into `ConceptDetailScreen`
- [ ] Flag OFF:
  preserve the current data-wired `app/concept-ios/[slug].tsx` implementation unchanged
- [ ] Keep `app/concept-detail-ios.tsx` as the variant preview route
- [ ] Do not alter concept summary cards, shelves, or list items in this cutover

## Summary-vs-detail boundary

Decision source in `IOS_MIGRATION_PLAN.md`: "level-of-detail surfaces get separate designs, not scaled-down versions of each other. Summary surfaces do navigation; detail surfaces do action."

This cutover is the detail surface only.

In scope:

- `app/concept-ios/[slug].tsx`
- Read-mode concept body/synthesis
- Reflection trail
- Detail-surface actions that already belong on the full-page concept view

Out of scope:

- Playbook concept shelf cards
- Concept summary cards
- Inline card actions on summary surfaces
- Any scaled-down version of `ConceptDetailScreen`

## Follow-up #12/#13 interaction

This cutover does not resolve the open summary-card inline-action question.

Edit, delete, pull-latest, fork, ask, update-from-QA, create-step, and related affordances remain detail-surface concerns in this cutover. Whether any of those actions also need summary-card affordances is a separate decision. Do not use the Concept detail cutover to preempt that answer.

## Variant routing

Current variants:

- `new`
- `dormant`
- `breakthrough`

Data-layer routing proposal:

- `concept.state === "breakthrough"` or clustered breakthrough evidence present → `breakthrough`
- `concept.last_reflection_at` older than the agreed dormancy threshold and concept is otherwise mature/practicing → `dormant`
- `concept.reflection_count <= 1` or state is `forming` → `new`
- `concept.state === "practicing"` with recent activity → mature/read-mode baseline; render the standard practicing branch by using the mature `ConceptDetailScreen` shell without dormant footer or breakthrough offer

Fallback:

- Unknown state should render `new` only when the concept has too little evidence.
- Unknown state with mature content should render the standard read-mode content without breakthrough or dormant chrome.
- Missing concept record should keep the existing plain-language not-found error behavior until a designed iOS-register error state lands.

## Decision 1: Mature non-dormant fallback (resolved)

Choice: default chrome.

A concept with several reflections that is not dormant and not in a breakthrough moment renders as standard practicing Concept detail: full synthesis, reflection trail, practicing state pill, and no dormant footer or breakthrough AI offer. The design treats `new`, `dormant`, and `breakthrough` as exceptional user signals: "not enough evidence yet", "worth revisiting", and "something changed." Folding mature active concepts into `new` would weaken "one reflection in"; folding them into `breakthrough` would turn a moment into a steady state.

Implementation note: no fourth visual variant is required for the first cutover. The route can use the mature `ConceptDetailScreen` branch with `variant="dormant"` only as the structural shell, omit `dormantFooterStamp` and `dormantFooterAsk`, and pass `stateKind="practicing"`.

How to reverse: change the variant-routing helper so mature non-dormant concepts return `new`, `breakthrough`, or a future fourth component variant instead of the standard practicing branch.

## Decision 2: Dormancy threshold (resolved)

Formula: a concept is dormant when `total_linked_reflections >= 3` and `days_since_last_reflection > clamp(4 * median_inter_reflection_interval_days, 30, 120)`.

Concepts with fewer than 3 linked reflections never enter dormant; they remain `new` if evidence is thin or standard practicing once the synthesis is mature. If a concept has at least 3 reflections but fewer than 2 intervals can be computed because of incomplete timestamps, use a 45-day threshold. Dormancy is evaluated from reflections linked to the concept through `step_playbook_links(item_type='concept')` and completed timeline steps.

Reasoning: time-only dormancy is too naive for seasonal practice, and count-only dormancy misses concepts abandoned after a burst. The 4x-median rule adapts to the user's actual cadence, while the 30-day floor prevents weekly concepts from nagging too early and the 120-day ceiling prevents once-a-season concepts from never resurfacing. The `>= 3` gate keeps one-off concepts in the "forming" meaning rather than falsely calling them dormant.

Edge cases handled: brand-new concepts, concepts with one or two reflections, irregular seasonal concepts, and stale mature concepts. Intentionally not handled in v1: explicit per-interest calendars, race-season boundaries, user-snoozed dormancy, and coach-assigned concepts with required review dates.

Post-launch tuning: adjust the floor/ceiling constants first; only add per-interest tuning after observing false-positive dormancy rates by interest.

## Decision 3: Per-user state fields (resolved)

The cutover needs one new per-user state table plus derived read fields from existing `step_playbook_links` and `timeline_steps`.

| Field | Type | Location | Populated by | Consumed by | Net-new? |
|---|---|---|---|---|---|
| `progression_state` | `text` enum-like check: `forming`, `learning`, `practicing`, `breakthrough` | `playbook_concept_user_state` | Default on state-row creation; updated by concept-suggestion acceptance and future breakthrough detector | State pill and first-pass variant routing | yes |
| `breakthrough_detected_at` | `timestamptz null` | `playbook_concept_user_state` | Future clustering job or explicit accepted breakthrough suggestion | Routes to `breakthrough` when present and recent enough to be active | yes |
| `breakthrough_dismissed_at` | `timestamptz null` | `playbook_concept_user_state` | User dismisses the breakthrough offer | Clears breakthrough routing without deleting the evidence | yes |
| `breakthrough_evidence` | `jsonb not null default '[]'` | `playbook_concept_user_state` | Future clustering job; stores source step/reflection ids and short rationale | Breakthrough offer copy and auditability | yes |
| `last_state_computed_at` | `timestamptz null` | `playbook_concept_user_state` | State recompute service or derived-read adapter | Staleness/debugging only; not user-visible | yes |
| `total_linked_reflections` | `integer` | computed in concept detail read query/API from `step_playbook_links` + completed `timeline_steps` | Derived on read; optionally materialized later | `new` vs mature and dormancy gate | derived |
| `first_reflection_at` | `timestamptz null` | computed in concept detail read query/API | Derived on read from linked completed steps | Meta copy and origin tag | derived |
| `last_reflection_at` | `timestamptz null` | computed in concept detail read query/API | Derived on read from linked completed steps | Dormancy calculation and footer stamp | derived |
| `median_inter_reflection_interval_days` | `numeric null` | computed in concept detail read query/API | Derived on read from linked completed-step timestamps | Dormancy threshold formula | derived |
| `is_active_in_current_step` | `boolean` | computed in app/API from open `timeline_steps` linked to the concept | Derived on read from `step_playbook_links` + non-completed steps | Live-dot/pill follow-up; not required for first cutover | derived |

Variant routing:

- `breakthrough_detected_at` present and not dismissed/expired → `breakthrough`
- `total_linked_reflections <= 1` or `progression_state === "forming"` → `new`
- Dormancy formula true and `progression_state` is `practicing` or `learning` → `dormant`
- Otherwise → standard practicing Concept detail branch

State table scope: rows are keyed by `(user_id, playbook_id, concept_id)`, not by concept alone, because baseline concepts are shared and state is user-specific.

## Mounting screen

Confirmed wiring target: `app/concept-ios/[slug].tsx`.

The route is already data-wired: it uses `usePlaybookConceptBySlug`, `useMyTimeline`, and current-interest context, then renders the existing iOS-register read-mode preview shape. The cutover should replace or augment that route's body with `ConceptDetailScreen` behind `CONCEPT_IOS_REGISTER`.

Legacy Playbook concept route also exists at `app/(tabs)/playbook/concepts/[slug].tsx`, which renders `components/playbook/concepts/ConceptDetail`. The resolved scope below leaves that route untouched.

## Mounting screens (resolved)

Resolution: two mounting screens for different purposes.

- `app/concept-ios/[slug].tsx` is the iOS-register Concept detail route. It is the cutover target. It already reads real concept data through `usePlaybookConceptBySlug`, builds a reflection trail from `useMyTimeline`, and is reached from the iOS-register Playbook shelf in `app/playbook-ios.tsx`.
- `app/(tabs)/playbook/concepts/[slug].tsx` is the legacy Playbook stack route. It renders `components/playbook/concepts/ConceptDetail`, which owns legacy edit/fork/pull-latest/Q&A/create-step behavior. It is reached by legacy Playbook concept cards and related-concept links.

The Concept detail iOS cutover wires only `app/concept-ios/[slug].tsx` behind `FEATURE_FLAGS.CONCEPT_IOS_REGISTER`. The legacy `app/(tabs)/playbook/concepts/[slug].tsx` route stays on its current implementation so the Playbook flag-off path and legacy deep links keep their existing behavior.

Route-structure evidence: `app/(tabs)/playbook/_layout.tsx` registers `concepts/[slug]` inside the Playbook tab stack, while `app/concept-ios/[slug].tsx` is a separate top-level Expo Router route. They are not the same route namespace.

## Verification matrix

- [ ] `/concept-detail-ios?variant=new` renders new state
- [ ] `/concept-detail-ios?variant=dormant` renders dormant state
- [ ] `/concept-detail-ios?variant=breakthrough` renders breakthrough state
- [ ] `/concept-ios/[slug]` flag ON renders real concept data through `ConceptDetailScreen`
- [ ] `/concept-ios/[slug]` flag OFF preserves the existing route implementation
- [ ] Existing not-found, missing-slug, and loading states still work
- [ ] Playbook concept shelf cards still navigate as before
- [ ] Concept summary cards are unchanged
- [ ] No preview-only variant selector or close-X chrome leaks into canonical route

## Rollback triggers

- [ ] Roll back immediately if concept detail navigation breaks from Playbook iOS
- [ ] Roll back immediately if a real concept renders sample fixture content
- [ ] Roll back immediately if summary cards change unexpectedly
- [ ] Roll back immediately if edit/delete/fork/pull-latest behavior disappears without an intentional replacement

## Post-cutover documentation updates

- [ ] Update `docs/redesign/IOS_MIGRATION_PLAN.md` to mark Concept detail cutover shipped and reference the render-switch commit
- [ ] Update `docs/redesign/IOS_SURFACE_INVENTORY.json` so `concept-detail-ios` flips from `canonical_status: "staged"` to `canonical_status: "shipped"`
- [ ] Remove or resolve any separate inventory entry that treats Concept variants as a separate surface
- [ ] Capture remaining breakthrough-detector and Work-mode follow-ups if still deferred

## Ship-readiness verdict

Ready after data-layer work lands. The three Concept detail state decisions are resolved in this plan; the executable data-layer work is in `docs/redesign/CONCEPT_DETAIL_DATA_LAYER_WORK.md`.

## Open questions for human review

- Confirm whether the `breakthrough` state expires automatically after a fixed window or only clears when the user dismisses/accepts the offer. First-draft routing treats it as active while `breakthrough_detected_at` is present and not dismissed.
- Confirm whether Work mode stays a placeholder through the render switch or remains hidden until a later Work-mode pass.
