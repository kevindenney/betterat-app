# Pass 5 — Mentoring loop

Read-only audit of the four-corner mentor↔mentee loop:
**Subscribe → Adopt → Review → Suggest next**. Branch:
`audit/codebase-recon`. All citations are `path:line`. No code changes
proposed here — only findings.

---

## TL;DR

- The mentoring loop is **fully implemented** end-to-end but spread across
  three independent surfaces (Creator dashboard, public blueprint landing,
  step Review tab) with **no shared component**. Each surface re-implements
  status badges, status colors, and labels.
- The mentor writes feedback into a **nested
  `metadata.review.*` JSON blob** on the *adopted step copy*, gated by an
  RLS policy that uses a SECURITY DEFINER helper
  (`get_blueprint_author_adopted_step_ids`). The schema is loose: every
  field is read-as-`any` (see `components/step/ReviewTab.tsx:53, 57-59`).
- "Suggest a step" sends a `step_suggested` social notification rather
  than creating a row in a `step_suggestions` table. Adopt/dismiss is
  reflected by setting the notification's `is_read` flag locally — there
  is **no acknowledgement table**, so the mentor sees "Seen" only after
  the mentee taps Adopt/Dismiss.
- The mentor view (`SuggestStepSheet`, `CollaboratorPicker`) and the mentee
  view (`SuggestedStepsBar`) handle the `'custom'` source-step case with
  divergent fallbacks — the mentor sends `sourceStepId: 'custom'` and the
  mentee calls a different code path (`createStep` instead of `adoptStep`).
  This is the only place we found in the codebase where a magic string is
  used as a sentinel ID.
- The "step_reviewed" notification was added later (migration
  `20260416000000`) and adds a SELECT RLS so mentors can see *their own*
  sent notifications. That gives the "Suggestions Sent" panel its data
  source. The actor-side read uses
  `eq('type', 'step_suggested').eq('actor_id', actorId)`, so the
  notification table is doubling as a suggestion-history table.
- **Sailing default leak**: `useSuggestStepToSubscriber` falls back to
  `actorName: 'Your coach'` (`hooks/useBlueprint.ts:514`). On the mentee
  side, `SuggestedStepsBar` falls back to `'Your mentor'`
  (`components/blueprint/SuggestedStepsBar.tsx:158`). The two surfaces
  *disagree* on the default voice; neither runs through vocabulary.
- The Creator's Suggest sheet uses `SailorProfileService.getFollowing` to
  drive a "My Steps" tab — confirmed cross-interest leak from Pass 3
  (`components/step/CollaboratorPicker.tsx:116, 265`).

---

## 1. Surfaces in the mentoring loop

There are five files driving the loop. Three are mentor-facing, two are
mentee-facing:

| Side | Surface | File | Lines |
| --- | --- | --- | --- |
| Mentor | Creator subscriber list (per-blueprint roll-up) | `app/creator/[id].tsx` | 651 |
| Mentor | Subscriber detail w/ adopted-step list + Suggest CTA | `app/creator/subscriber/[subscriberId].tsx` | 827 |
| Mentor | Mentoring feedback panel (review status, suggested next) | `components/creator/CreatorMentoringPanel.tsx` | 664 |
| Mentor | Public blueprint landing → "Subscriber progress" embedded | `components/blueprint/StudentProgressSection.tsx` | 350+ |
| Mentor | Suggest-a-step modal | `components/creator/SuggestStepSheet.tsx` | 567 |
| Mentee | Step Review tab → InstructorFeedback card | `components/step/ReviewTab.tsx:51-104` | 170 |
| Mentee | Timeline (Races tab) → SuggestedStepsBar | `components/blueprint/SuggestedStepsBar.tsx` | 309 |

Each surface re-implements its own:
- Status color palette (`C.green/orange/gray` constants duplicated in every file).
- Status label strings (`Approved`, `Needs Revision`, `Revision Requested`).
- Status badge JSX.

---

## 2. The four corners

### 2.1 Subscribe — covered in Pass 4

Pass 4 documented `subscribe()` (`services/BlueprintService.ts:475-549`).
Relevant to the mentoring loop:

- Subscribe **auto-follows** the blueprint author via `user_follows`
  upsert (`:509-522`) — comment: "Auto-follow the blueprint author".
  Failure is non-fatal.
- Subscribe **auto-adopts only step 1** (`:524-542`).

### 2.2 Adopt — `useAdoptBlueprintStep`

`hooks/useBlueprint.ts:438-464`:

```
const adopted = await adoptStep(user.id, sourceStepId, interestId, blueprintId);
await markStepAction(subscriptionId, sourceStepId, 'adopted', adopted.id);
return adopted;
```

Two writes per adopt: one to `timeline_steps` (the clone), one to
`blueprint_step_actions` (the tracking row).

`onSuccess` (`:458-462`) invalidates three caches:
- `['timeline-steps']`
- `['blueprint-new-steps']`
- `['blueprint-suggested-next']`

But not the mentor's `['blueprint-subscriber-progress', …]`. The mentor's
view goes stale until a refetch.

### 2.3 Review — `CreatorMentoringPanel`

Mentor writes `metadata.review.*` into the **adopted step copy**, not the
blueprint's source step. The RLS policy:

```sql
-- supabase/migrations/20260414100000_creator_mentoring_adopted_step_update.sql
CREATE POLICY "Blueprint authors can update adopted step metadata"
  ON timeline_steps
  FOR UPDATE
  USING (id IN (SELECT get_blueprint_author_adopted_step_ids(auth.uid())))
  WITH CHECK (id IN (SELECT get_blueprint_author_adopted_step_ids(auth.uid())));
```

`get_blueprint_author_adopted_step_ids` is a SECURITY DEFINER function
that joins `timeline_blueprints → blueprint_subscriptions →
blueprint_step_actions` to enumerate every adopted step copy whose source
blueprint the author owns. Standard cross-table RLS via helper to avoid
recursion — same pattern flagged by the
`feedback_rls_cross_table_recursion.md` memory.

The panel writes through `useUpdateStepMetadata(stepId)`:

```ts
// CreatorMentoringPanel.tsx:176-199
await updateMetadata.mutateAsync({
  review: {
    instructor_review_status: selectedStatus,
    instructor_review_note: reviewNote.trim() || undefined,
    instructor_review_at: new Date().toISOString(),
  },
} as Record<string, unknown>);
```

Issues:

1. **The schema is implicit.** Every field is `any`. The TypeScript
   interface `ReviewMetadata` in `CreatorMentoringPanel.tsx:29-37` exists
   only for that file; `ReviewTab.tsx:53` re-derives it inline as
   `(step?.metadata as any)?.review`.
2. **The cast `as Record<string, unknown>`** at `:184` is doing real work
   — `useUpdateStepMetadata` presumably performs a `metadata = {
   ...metadata, ...patch }` merge somewhere, but the cast hides the merge
   shape. Two mentors editing the same step in the same minute would
   last-writer-win at the metadata blob level.
3. **The "Save Suggestion" save** at `:201-208` writes only
   `instructor_suggested_next` and **omits** the other review fields.
   `useUpdateStepMetadata` will need to do a deep merge for this to not
   blow away the `instructor_review_status`.
4. **Notification on save** at `:189-198`: fires
   `notifyStepReviewed` only when `step.user_id !== user.id`. Best-effort
   `.catch(() => {})`.

### 2.4 Suggest a step — `SuggestStepSheet` + `notifyStepSuggested`

Three tabs in the sheet (`SuggestStepSheet.tsx:151-171`):

1. **Blueprint** — curated steps from this blueprint
   (`useBlueprintSteps(blueprintId)`).
2. **My Steps** — *all* of the mentor's own timeline steps via
   `useMyTimeline(null)` (`:61`). Comment: "all interests". This is the
   cross-interest leak — a nursing mentor sees their sailing steps in the
   picker.
3. **Create New** — bare title + optional description.

Send handler (`:85-118`):

- For "create": `sourceStepId: 'custom'` (`:91`) — magic-string sentinel.
- For blueprint/my-steps: passes the real `sourceStepId`.
- Both branches call `suggestMutation.mutateAsync(...)` which calls
  `NotificationService.notifyStepSuggested`
  (`services/NotificationService.ts:889-910`).

`notifyStepSuggested` writes a `social_notifications` row of type
`'step_suggested'` with `actor_id` = mentor, `user_id` = mentee, and a
`data` JSON column containing `source_step_id, step_title,
step_description, interest_id`.

There is **no row in a `step_suggestions` table** — the notification table
*is* the suggestion table.

### 2.5 Adopt the suggestion — `SuggestedStepsBar`

`components/blueprint/SuggestedStepsBar.tsx:87-128`:

- Queries `social_notifications` where `type = 'step_suggested'` and
  `is_read = false` (`:60-73`).
- Filters out locally dismissed/adopted IDs (`:76-85`).
- On Adopt:
  - If `source_step_id !== 'custom'` → `adoptStep(...)` (`:99-101`).
  - Else → `createStep({title, description, interest_id})` (`:102-110`).
- Marks the notification as read.
- Invalidates `['timeline-steps', 'mine']` and `['step-suggestions']`.

Issues:

1. **No backflow to the mentor.** Marking the notification as read on the
   mentee side is what the mentor's "Suggestions Sent" panel uses to show
   "Seen" status. That works for a binary seen/unseen, but the mentor has
   no way to tell "adopted vs dismissed" — both set `is_read = true`.
2. **The `'custom'` magic string** is also handled here (`:99`). Both
   sides need to keep this string in sync; a typo would silently send a
   `createStep` payload through `adoptStep` with `sourceStepId: 'custom'`,
   which would fail at the DB FK check.

### 2.6 Mentee sees feedback — `ReviewTab`'s InstructorFeedbackCard

`components/step/ReviewTab.tsx:51-104`:

- Reads `step.metadata.review` as `any` (`:53`).
- Renders only if `status || suggestedNext` (`:61`).
- "Approved" / "Revision Requested" badge (`:84-86`). Note: the **mentor
  panel says "Needs Revision" but the mentee sees "Revision Requested"**.
  Same field (`instructor_review_status === 'needs_revision'`),
  different label.
- Suggested-next box is plain text (`:96-100`) — no Adopt CTA. To act on
  the suggestion the mentee has to manually create a step.

---

## 3. Notification-as-table pattern

The mentor's "Suggestions Sent" panel
(`app/creator/subscriber/[subscriberId].tsx:151-158, 448-494`) does:

```ts
useQuery({
  queryKey: ['sent-suggestions', user?.id, subscriberId],
  queryFn: () => NotificationService.getSentSuggestions(user!.id, subscriberId!),
  enabled: !!user?.id && !!subscriberId,
})
```

`getSentSuggestions` (`services/NotificationService.ts:943-970`):

```ts
.from('social_notifications')
.select('id, data, is_read, created_at')
.eq('type', 'step_suggested')
.eq('actor_id', actorId)
.eq('user_id', targetUserId)
.order('created_at', { ascending: false });
```

Powered by an RLS policy in
`supabase/migrations/20260416000000_step_reviewed_notification_and_sent_suggestions_rls.sql:9-12`:

```sql
CREATE POLICY "Actors can view their own sent notifications"
  ON social_notifications FOR SELECT
  USING (actor_id = auth.uid());
```

This is the standard "notification table is the activity log" pattern,
fine for the volume expected. Two caveats:

1. **Deletion of a notification** (e.g. mentee swipes-to-delete) would
   wipe the mentor's history. There's no telemetry on whether the mentee
   UI permits this.
2. **No retry/redelivery.** If `notifyStepSuggested` fails (network,
   RLS), the mentor's "Suggestions Sent" panel never shows it and the
   mentee never sees it. The mutation throws (`useSuggestStepToSubscriber`
   has no `onError` retry), the sheet shows a `showAlert('Error', …)`
   (`SuggestStepSheet.tsx:99, 116`).

---

## 4. Hardcoded mentor-voice strings

| Place | Default voice | Citation |
| --- | --- | --- |
| Suggest mutation | `'Your coach'` | `hooks/useBlueprint.ts:514` |
| Mentor save review | `'Your instructor'` | `components/creator/CreatorMentoringPanel.tsx:193` |
| Mentee suggested bar | `'Your mentor'` | `components/blueprint/SuggestedStepsBar.tsx:158` |
| Mentee review tab | "Instructor Feedback" | `components/step/ReviewTab.tsx:70` |
| Mentor panel header | "Mentoring Feedback" | `components/creator/CreatorMentoringPanel.tsx:221` |
| Section title in subscriber detail | "Suggestions Sent" | `app/creator/subscriber/[subscriberId].tsx:453` |
| Sheet header | "Suggest a Step" / "Recommend a step to {name}" | `components/creator/SuggestStepSheet.tsx:145-148` |
| Default tab labels | "Blueprint" / "My Steps" / "Create New" | `components/creator/SuggestStepSheet.tsx:154-170` |

The vocabulary system has `Coach` as a universal key
(`lib/vocabulary.ts:30-46`), but none of these strings consult it. A
nursing user sees "Mentoring Feedback" / "Your coach" / "Instructor
Feedback" on the same loop.

---

## 5. Status label divergence

Same enum (`instructor_review_status`), four different label sets:

| File | `'approved'` label | `'needs_revision'` label |
| --- | --- | --- |
| `CreatorMentoringPanel.tsx:125-126` | "Approved" | "Needs Revision" |
| `ReviewTab.tsx:84-86` (mentee) | "Approved" | "Revision Requested" |
| `app/creator/subscriber/[subscriberId].tsx:405, 427` | "Approved" | "Needs Revision" |
| `CreatorMentoringPanel.tsx:276, 309` (action buttons) | "Approve" | "Request Revision" |

For status colors:

- Approved: `#16A34A` (green) everywhere except `StudentProgressSection.tsx:36`
  uses `#3D8A5A` (a different green).
- Revision: `#EA580C` (orange) — consistent.

---

## 6. Status taxonomy bloat

The "adopted step" can have **eight observed states** across the codebase
just for the mentor view:

| State | Where surfaced |
| --- | --- |
| `not_adopted` | `StudentProgressSection.tsx:44` |
| `pending` | `StudentProgressSection.tsx:45` ; `app/blueprint/[slug].tsx:62` |
| `in_progress` | every surface |
| `completed` / `done` | both treated as completed; `getStatusPill` collapses them (`app/creator/subscriber/[subscriberId].tsx:90`) |
| `skipped` | `StudentProgressSection.tsx:48` ; `app/blueprint/[slug].tsx:65` |
| `dismissed` | `StudentProgressSection.tsx:49` ; via `blueprint_step_actions.action === 'dismissed'` |
| `adopted` (no `status`) | `app/creator/subscriber/[subscriberId].tsx:94` |
| `seen` | `app/creator/subscriber/[subscriberId].tsx:96` ; from `blueprint_step_actions.action === 'seen'` |

The fan-out happens because each surface joins
`timeline_steps.status` (`pending|in_progress|completed|skipped`) with
`blueprint_step_actions.action` (`adopted|dismissed|seen`) on its own
terms. There's no shared resolver — `getStatusPill` is defined in *both*
`app/creator/[id].tsx:53-61` and
`app/creator/subscriber/[subscriberId].tsx:87-97` with subtly different
outputs (the former has no `'Adopted'` pill, the latter does).

A `needs_review` synthetic state is introduced in
`isNeedsReview()` at `app/creator/subscriber/[subscriberId].tsx:99-104`:

```ts
return (
  step.step.status === 'completed' &&
  !step.step.metadata?.review?.instructor_review_status
);
```

— "completed but mentor hasn't approved/rejected yet". This is a filter
key, not a stored field.

---

## 7. The `'custom'` sentinel ID

`SuggestStepSheet.tsx:91` sets `sourceStepId: 'custom'` for the
Create-New tab. Two consumers:

- `SuggestedStepsBar.tsx:99-110` — branches on `sourceStepId !== 'custom'`.
- `notifyStepSuggested` body — writes the literal `'custom'` into
  `data.source_step_id`.

There's no constant. A typo or rename would silently break the loop on
*one* side and produce a confused error on the other (the adopt branch
would try to find a `timeline_steps` row with `id = 'custom'`).

This is also the only place in the audited surfaces where a string
sentinel substitutes for `null | string`. The notification's `data` is
already a JSON column — `source_step_id` being optional/null is the
shape the data wants.

---

## 8. Cross-references with prior passes

### From Pass 3 (step component)

- `StepDetailContent` is rendered `readOnly` on the mentor's subscriber-
  step view (`app/creator/subscriber-step/[stepId].tsx:40`). Pass 3 found
  that the tab labels resolver does NOT branch on `readOnly`, so the
  mentor sees full edit affordances styled as read-only.
- The `instructor_review_*` fields baked into the schema (Pass 3 finding)
  are the same fields the mentoring panel writes here.

### From Pass 4 (blueprints)

- `getBlueprintSubscriberProgress` is the upstream query for both the
  Creator dashboard subscriber list (`app/creator/[id].tsx:86`) and the
  blueprint landing's `StudentProgressSection`
  (`components/blueprint/StudentProgressSection.tsx:59`). Two surfaces
  reading the same query — neither invalidates the other on mentor write.

### From Pass 2 (interest-aware nav)

- The mentor voice strings (Section 4 above) are not routed through
  vocabulary. Same architectural gap as the tab labels: vocabulary is
  read by *one* slot (the Learning Event tab) and ignored everywhere
  else.

---

## 9. Findings summary (for synthesis pass)

1. **Mentor voice strings ("Your coach" / "Your mentor" / "Instructor
   Feedback") are hardcoded English** and disagree across surfaces.
2. **`instructor_review_status` labels disagree** ("Needs Revision" on
   mentor side vs "Revision Requested" on mentee side).
3. **`metadata.review.*` is unschema'd** — `as any` everywhere, blob-
   merge semantics depend on `useUpdateStepMetadata` internals not
   audited in this pass.
4. **`'custom'` magic-string sentinel** in `SuggestStepSheet` / `SuggestedStepsBar`.
5. **Notification-as-suggestion-table** — no separate suggestion model,
   no adopt/dismiss back-signal beyond `is_read`.
6. **Adopt-on-mentee does not invalidate mentor caches** (see §2.2).
7. **`getStatusPill` duplicated** in two creator screens with subtly
   different output.
8. **Cross-interest leak** in Suggest sheet's "My Steps" tab via
   `useMyTimeline(null)` and `SailorProfileService.getFollowing`
   (cross-ref Pass 3).
9. **No retry / dead-letter** on `notifyStepSuggested` failure — silent
   to both sides.

Effort sizing deferred to Pass 8.
