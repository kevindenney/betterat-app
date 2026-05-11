# Pass 3 — Step component

Read-only audit of the step screen — the full-screen detail view at
`app/step/[id].tsx` and the embedded card view rendered from the Race tab
timeline. All citations are `path:line`. No code changes proposed.

---

## TL;DR

The "step" concept has two parallel renderers and at least five overlapping
labeling sources:

1. **Full-screen view** — `app/step/[id].tsx` → `StepDetailContent` →
   `PlanTab` / `ActTab` / `ReviewTab` pill tabs.
2. **Inline card view** — used inside `RaceSummaryCard` on the Race timeline,
   built from `StepPlanQuestions` and `StepDrawContent` directly (not
   `StepDetailContent`). The two paths render slightly different question
   sets, button copy, and tab layouts.

Labels that show up on a step come from any of:
- `lib/vocabulary.ts` (`useVocabulary()` → `vocab('Learning Event')`,
  `vocab('Plan Phase')`, `vocab('Do Phase')`, `vocab('Review Phase')`)
- `lib/step-category-config.ts` (`getStepCategoryLabels(stepCategory)`) —
  per-category tab and question text (e.g. nutrition vs strength).
- `configs/{interest}.ts` — used elsewhere on Race/Reflect screens.
- Hard-coded English literals inside the tab components.
- `currentInterest?.slug.includes('sail')` string matches — for sailing-only
  date enrichment and boat lookups.

The result: the step screen partially adapts to the user's interest, but
multiple high-traffic strings (header badge, due-date prompt, "Mark Done",
the four "Who/Where" question titles, "Instructor Feedback") are frozen in
sailing-era English. Two functions (`window.prompt` for dates) are
unconditionally web-only.

---

## 1. Route wrapper and entry surface

`app/step/[id].tsx` (99 lines):

- Reads `id` and `readOnly` from `useLocalSearchParams` and renders
  `<StepDetailContent stepId={actualId} readOnly={isReadOnly} />` inside a
  `SafeAreaView` (`app/step/[id].tsx:17-65`).
- Title comes from `vocab('Learning Event')` (`app/step/[id].tsx:26, 45`) —
  the only interest-aware part of the wrapper.
- `headerBackTitle: 'Back'` is hard-coded English (`app/step/[id].tsx:47`).
- Both back-fallbacks point at `/(tabs)/races`
  (`app/step/[id].tsx:32, 53`) — sailing-tab leak when the user opens a
  step from a deep link (e.g. via share) and there is no router stack to
  pop. Non-sailing users land on the sailing tab.
- Web-only `headerLeft` override renders a literal `← Back` text button
  (`app/step/[id].tsx:50-57`).

---

## 2. `StepDetailContent` — full-screen view

File: `components/step/StepDetailContent.tsx` (1014 lines).

### 2.1 Header label sources

| Element | Source | Citation |
|---|---|---|
| `SESSION` badge | literal `'SESSION'` | `StepDetailContent.tsx:650` |
| Title placeholder | `\`${vocab('Learning Event')} title...\`` | `:693` |
| Title empty fallback | `vocab('Learning Event')` | `:698` |
| `Mark Done` / `Done` button | literals | `:675` |
| `Add date` chip | literal | `:728` |
| `Overdue ·` / `Due ` prefix | literals | `:743` |
| Collaborator banner ("Shared by …" / "Shared with you") | literals | `:766` |
| `<StepProvenanceBanner>` "Copied from blueprint …" etc. | (see Pass 4) | `:774-780` |

The `SESSION` badge is the most visible: for any nursing user it should read
something like `SHIFT` or `CLINICAL`. There is no vocabulary key driving it.

### 2.2 Tabs — a four-layer label resolver

`components/step/StepDetailContent.tsx:462-466`:

```text
{ value: 'plan',   label: categoryLabels.tabs.plan   !== 'Prep'   ? categoryLabels.tabs.plan   : vocab('Plan Phase'),   completed: isPlanComplete   }
{ value: 'act',    label: categoryLabels.tabs.act    !== 'Train'  ? categoryLabels.tabs.act    : vocab('Do Phase'),     completed: isActComplete    }
{ value: 'review', label: categoryLabels.tabs.review !== 'Review' ? categoryLabels.tabs.review : vocab('Review Phase'), completed: isReviewComplete }
```

Issues:
1. **String equality** to detect "default" category labels (`!== 'Prep'`,
   `!== 'Train'`, `!== 'Review'`). If `getStepCategoryLabels` ever returns a
   localized version of these defaults, the fallback to vocabulary will not
   fire.
2. **Two label systems in one expression** — category first, vocabulary
   second. The intent ("category beats vocabulary") is not documented and is
   easy to break.
3. The check at index `[2]` compares against `'Review'` even though
   `vocab('Review Phase')` for nursing is also `'Debrief'`, so a step with
   no category override on a nursing user already gets `'Debrief'`. Pass 8
   will need to confirm with screenshots.

`getStepCategoryLabels` lives in `lib/step-category-config.ts` (Pass 1 noted
it; not re-read here) and returns
`{ tabs: { plan, act, review }, questions: { what, how, why },
placeholders: { what, why } }`.

### 2.3 `window.prompt` for date editing

`components/step/StepDetailContent.tsx:492` and `:519`:

```text
const input = window.prompt('Set date (YYYY-MM-DD):', existing);
const input = window.prompt('Set due date (YYYY-MM-DD):', existing);
```

`window.prompt` is **undefined on iOS and Android**. Tapping the date chip on
native will throw `ReferenceError: window is not defined` or hang silently
(depending on RN version). This is the same class of cross-platform problem
as `Alert.alert` (called out in `CLAUDE.md` → `WEB_COMPATIBILITY.md`).

The `useCallback` wrappers (`handlePromptStepDate`, `handlePromptDueDate`)
do not platform-gate. The codebase has `showAlert`/`showConfirm` helpers in
`@/lib/utils/crossPlatformAlert` per CLAUDE.md, but no equivalent
`showPrompt` was found — the right fix likely needs a native modal
date picker. Carry to synthesis.

### 2.4 Ellipsis menu navigates to `/library`

`components/step/StepDetailContent.tsx:679-684`:

```text
<Pressable style={styles.menuButton} onPress={() => router.push('/library')}>
  <Ionicons name="ellipsis-vertical" ... />
</Pressable>
```

A three-dots/ellipsis affordance that just navigates away to the global
library, rather than opening a contextual menu, is a UX surprise. Visual
audit pass already flagged this; the code confirms there is no menu at all
— the icon is literally a navigation shortcut.

### 2.5 Sailing-specific date enrichment

`components/step/StepDetailContent.tsx:197-222`:

```text
const isSailing = currentInterest?.slug?.includes('sail')
  || currentInterest?.name?.toLowerCase().includes('sail');
if (isSailing && resolution.firstDateIso && resolution.resolvedLocationCoords) {
  ...
  userBoats = await sailorBoatService.listBoatsForSailor(user.id);
  ...
  const enrichment = await enrichDateForSailing({...});
}
```

- String-includes detection of sailing — any future interest whose slug
  happens to contain "sail" (`"sailing-yoga"`, `"para-sailing"`, …) will
  trigger boat lookups.
- Imports `sailorBoatService`, `equipmentService`, `enrichDateForSailing`
  unconditionally (`StepDetailContent.tsx:32-34`). These pull in
  sailing-only modules even for nursing users.
- `try { } catch {}` swallows the boat-lookup failure (line 209) — silent
  fallback to no boats.

For non-sailing interests, the step still saves with no `date_enrichment`,
which propagates into `ActTab` where the conditions card is hidden
(`ActTab.tsx:27`).

### 2.6 Comment data path

`components/step/StepDetailContent.tsx:582-625`:

- `useStepComments`, `useAddStepComment`, `useDeleteStepComment` —
  step-scoped, not interest-aware. CommentsSection renders the legacy
  social comment UI, which uses non-step terminology
  (likes, replies — see Pass 5 for the social path).

---

## 3. `PlanTab` — full-screen plan path

File: `components/step/PlanTab.tsx` (901 lines).

### 3.1 Question count mismatch

- File comment line 2: "**4 guided planning questions** for a step."
- Actual renderers (`PlanQuestionCard`): five base questions plus an
  optional Competencies card:
  - Q1 What will you do? (`:257-336`) — category-aware title (`catLabels.questions.what`).
  - Q2 How will you do it? (`:339-350`) — category-aware (`catLabels.questions.how`).
  - Q3 Why is this next? (`:353-368`) — category-aware (`catLabels.questions.why`).
  - Q4 Who will you do this with? (`:371-426`) — **hard-coded English**.
  - Q5 Where will you do this? (`:429-485`) — **hard-coded English**.
  - Optional "Competencies" (`:488-…`) — **hard-coded English**.

So the planning flow asks 5–6 questions, three of which adapt to step
category, two of which never adapt to anything, and one that only appears
when the active interest has competencies.

### 3.2 Embedded brain dump + conversational capture

`PlanTab.tsx:205-254`:

- `ConversationalCapture` is preferred when `useConversationalCapture` is
  true and there is no plan content yet.
- Falls back to the legacy `BrainDumpEntry` (collapsible "Quick Capture"
  section) for editing existing brain dumps.

Both modes coexist in the file; the choice of which appears is determined
by `useConversationalCapture` and `hasPlanContent`. There is no UI signal
to the user that two capture modes exist — they only see whichever the
parent enabled.

### 3.3 Linked-resource interaction

- Cross-interest suggestions are imported (`PlanTab.tsx:19`) but the
  component is **not rendered** anywhere in this file. Likely orphaned —
  carry to dead-code list in Pass 8 alongside Pass 1's smells.
- "Add from Playbook" uses `PlaybookPicker` with a dual-write back-compat
  shim (`:115-147`): writes both `linked_resource_ids` (legacy column) and
  `step_playbook_links` (new join table). Comment line 116 explicitly
  describes this as "one-release migration safety" — already due to be
  retired but still live.

---

## 4. `StepPlanQuestions` — inline card variant

File: `components/step/StepPlanQuestions.tsx` (1981 lines).

This is the larger of the two plan renderers and is what the timeline cards
on the Race tab actually use (per the saved feedback memory: timeline cards
render `RaceSummaryCard → StepPlanQuestions/StepDrawContent`, NOT
`StepDetailContent → PlanTab`).

### 4.1 Divergent question set vs `PlanTab`

- Q1 (`:1066-1103`) — uses category labels for the title and adds an
  "AI suggest why" button on hover (only in this variant).
- Q2 (`:?`) — sub-step editor (same as PlanTab).
- Q3 Why — category label + AI regenerate-why button.
- Q4 Who (`:1105-1179`) — adds a **Connection Space** free-text input
  (`"Where will you connect? (Discord, Zoom, in person...)"`,
  `:1175`) that does NOT exist in `PlanTab`. So a user who opens a step
  full-screen loses the connection-space field they filled in on the
  timeline card.
- Q5 Where (`:1191-1280`) — adds **org-defined location quick picks**
  (`:1216-1245`) for org-scoped venues. Also not in `PlanTab`.
- Q6 (`:1300-1304`) — "What skills are you developing?" (hard-coded
  English title), distinct from PlanTab's "Competencies" Q.

### 4.2 Hard-coded slug equality for nursing

`components/step/StepPlanQuestions.tsx:149-150`:

```text
const normalizedSlug = String(interestSlug || currentInterest?.slug || '').toLowerCase();
const isOrgLocationInterest = normalizedSlug === 'nursing';
```

Strict equality with `'nursing'`. Drawing/fitness/design institutions that
have org-defined venues never get the quick-pick UI. New nursing-slug
variants (e.g. `nursing-grad`) silently disable the picker.

### 4.3 Category-based fitness detection

`components/step/StepPlanQuestions.tsx:682-683`:

```text
const isFitness = ['strength', 'cardio', 'flexibility', 'workout', 'training', 'exercise'].includes(category);
if (isFitness) { ... }
```

Hard-coded category allowlist for AI plan generation. A nursing "skills lab"
step with category `'skills_lab'` falls through to the default branch.
This list is duplicated at `:1058-1059` for the sub-step pluralizer
(`'tasks' | 'meals' | 'exercises' | 'sub-steps'`).

### 4.4 Local-state sync with debounced save

`components/step/StepPlanQuestions.tsx:94-146`:

A long block reseeds local input state from server data on mount and on
"external updates" (when the server has content but local is empty — e.g.
ConversationalCapture finished). The comment at `:117-118` flags the
heuristic: *"local 'what' is empty but server now has content → external
update happened"*. False negatives are possible (the user could legitimately
have cleared the field), and would silently overwrite their edit.

---

## 5. `ActTab` and `StepDrawContent`

- `components/step/ActTab.tsx:61`: CTA button literal `'Save & Reflect'` —
  not vocabulary-aware. Nursing should read "Save & Debrief".
- `components/step/StepDrawContent.tsx:32-93`: media-link platform detection
  is hard-coded (Google Photos, Apple Photos, Instagram, YouTube, TikTok).
  No interest-specific media handling, which is fine. But it imports
  `expo-image-picker` and uses a web-only `resizeImageOnWeb` (`:53-79`) +
  a native fallback — the file has IS_NATIVE / IS_WEB conditional logic at
  `:24-25` that is honest about the platform split.
- The `conditionsContainer` in `ActTab` (`:37-50`) only renders when
  `dateEnrichment` is present. Non-sailing users see "Weather data not
  available for this date" (`:48`) regardless of whether weather is even
  conceptually relevant to their step — a nursing user reviewing a clinical
  shift gets a passive-aggressive weather notice.

---

## 6. `ReviewTab` and `StepCritiqueContent`

- `components/step/ReviewTab.tsx:51-104`: `InstructorFeedbackCard` reads
  `metadata.review.instructor_review_status`,
  `instructor_review_note`, `instructor_suggested_next`. The header reads
  `"Instructor Feedback"` (`:70`). Status pills say `"Approved"` /
  `"Revision Requested"` (`:85`). The "Suggested next" label (`:98`) is
  literal English.
  - Nursing equivalent should be "Preceptor Feedback" / "Sign-off pending"
    — none of these strings consult vocabulary.
  - The schema fields are named `instructor_*` in the JSON metadata, which
    bakes the sailing/teaching mental model into the data layer. (Carry
    to synthesis: data-model rename or alias.)
- `components/step/StepCritiqueContent.tsx:278-290`: passes `interestSlug`
  into `extractMeasurements`, so the AI side of the critique pipeline is
  partially interest-aware.

---

## 7. Sailing-named modules used across interests

`components/step/SuggestStepSheet.tsx:24` and
`components/step/CollaboratorPicker.tsx:25, 116, 265`:

```text
import { SailorProfileService } from '@/services/SailorProfileService';
const { users } = await SailorProfileService.getFollowing(user.id, user.id, { limit: 50, offset: 0 });
```

The "following" graph that drives the collaborator picker for nursing,
drawing, fitness users is fetched via a class named `SailorProfileService`.
This is a Pass 1 rebrand-leftover symptom but also a step-component
finding because it appears in the collaborator-picker flow.

---

## 8. RaceSummaryCard ↔ inline step paths

(Not re-read this pass — see saved feedback memory and Pass 4 for blueprint
provenance.) The inline card path in `RaceSummaryCard` mounts
`StepPlanQuestions` for plan + `StepDrawContent` for act, which means:

- The header/SESSION badge from `StepDetailContent` is NOT shown inline —
  only when a user enters the full-screen view.
- The hard-coded `window.prompt` for due dates does NOT execute inline
  because the date chips live in `StepDetailContent`, not the inline
  variant. Native users can still open the full-screen step via deep link
  and crash there.
- `StepProvenanceBanner` (`StepDetailContent.tsx:774-780`) only renders
  on the full-screen view. Per the saved memory, the inline path covers
  blueprint/copied/template provenance but not course-context, follow-up
  chain, cross-interest pins, or AI-extraction provenance.

---

## 9. Step status / completion flow

`components/step/StepDetailContent.tsx:529-538`:

```text
const handleToggleDone = useCallback(() => {
  if (!step || !isOwner) return;
  const nextStatus: TimelineStepStatus = step.status === 'completed' ? 'pending' : 'completed';
  ...optimistic update + updateStep.mutate(...)
}, [...]);
```

- No "aha-moment" sheet shown on completion (saved memory
  `project_critique_completion_aha.md` flags this; saved memory
  `project_completion_sheet_v2.md` indicates v2 has shipped — verify in
  synthesis pass whether v2 is mounted from this path).
- Toggling between completed and pending is purely binary; there is no
  intermediate "in-progress" affordance in the header, even though
  `TimelineStepStatus` defines one (see line 41).

---

## 10. Provenance and pinning

- `<StepPinInterests stepId={stepId} stepInterestId={step.interest_id} />`
  is rendered in the header for owners
  (`StepDetailContent.tsx:755`). This is the cross-interest-pin UI.
- `<StepProvenanceBanner sourceBlueprintId={step.source_blueprint_id}
  sourceType={step.source_type} copiedFromUserId={step.copied_from_user_id}
  variant="full" />` (`:774-780`). Three of the four
  `source_type` values are handled (blueprint/copied/template); per saved
  memory `project_step_provenance_gaps.md`, course context, follow-up
  chains, cross-interest pins (the very thing right above it!), and
  AI-extraction provenance are not covered.

---

## Summary of citations (file:line)

- `app/step/[id].tsx:17-65` route wrapper
- `app/step/[id].tsx:32, 53` sailing tab fallback for back navigation
- `components/step/StepDetailContent.tsx:32-34` sailing-only imports
- `components/step/StepDetailContent.tsx:197-222` sailing-detection by
  string-include, sailing boat lookups
- `components/step/StepDetailContent.tsx:462-466` four-layer tab label
  resolver with string equality
- `components/step/StepDetailContent.tsx:492, 519` `window.prompt` crash
  on native
- `components/step/StepDetailContent.tsx:529-538` binary done toggle
- `components/step/StepDetailContent.tsx:650, 675, 693, 698, 728, 743, 766`
  hard-coded English in header
- `components/step/StepDetailContent.tsx:679-684` ellipsis menu navigates
  to `/library`
- `components/step/StepDetailContent.tsx:755` `StepPinInterests`
- `components/step/StepDetailContent.tsx:774-780` `StepProvenanceBanner`
- `components/step/PlanTab.tsx:2` doc says 4 questions, code renders 5–6
- `components/step/PlanTab.tsx:373, 431, 491` hard-coded Q4/Q5/Competencies
- `components/step/PlanTab.tsx:259, 267` category-aware Q1
- `components/step/PlanTab.tsx:19` orphan `CrossInterestSuggestions`
  import
- `components/step/PlanTab.tsx:115-147` dual-write back-compat shim
- `components/step/StepPlanQuestions.tsx:149-150` `=== 'nursing'` slug
  equality for org-location picker
- `components/step/StepPlanQuestions.tsx:682-683, 1058-1059`
  category-allowlist duplication
- `components/step/StepPlanQuestions.tsx:1108, 1175, 1194, 1303` hard-coded
  English question titles
- `components/step/ActTab.tsx:61` `'Save & Reflect'` literal
- `components/step/ActTab.tsx:48` weather-unavailable notice for
  non-sailing
- `components/step/ReviewTab.tsx:70, 85, 98` Instructor Feedback labels
- `components/step/ReviewTab.tsx:51-104` `instructor_review_*` schema
  fields
- `components/step/SuggestStepSheet.tsx:24`,
  `components/step/CollaboratorPicker.tsx:25, 116, 265`
  `SailorProfileService` used universally

---

## Carry to synthesis (Pass 8)

1. `window.prompt` for due-date editing on native → **demo blocker** for
   any nursing-on-iPad demo flow that includes editing a step date.
2. Header `SESSION` badge, `Mark Done`/`Done`, `Save & Reflect`,
   `Instructor Feedback`, all four hard-coded Q4/Q5/Competencies titles —
   single biggest visual gap between sailing and nursing/drawing.
3. `categoryLabels.tabs.X !== 'Prep'` string-equality resolver is fragile;
   recommend explicit `categoryLabels.tabs.usingDefault` flag.
4. Two parallel plan renderers (`PlanTab` and `StepPlanQuestions`) with
   divergent question sets and divergent button copy. Connection Space and
   org-location quick picks live only in the inline variant. Unify or
   document.
5. Sailing string-include detection in `StepDetailContent.tsx:197` and the
   unconditional sailing module imports — for cleanup, dynamic import the
   sailing services once a future "domain registry" exists.
6. `instructor_review_status` / `instructor_review_note` /
   `instructor_suggested_next` are sailing/teaching-flavored field names
   stored in metadata JSON. Renaming is cheap (JSON keys), but every
   reader must be updated together.
7. Ellipsis menu in step header navigates to `/library` — replace with a
   real contextual menu (share / delete / report / pin).
8. `app/step/[id].tsx:32, 53` back-fallback to `/(tabs)/races` is the
   step-screen instance of the sailing-tab leak called out in Pass 2.
9. `SuggestStepSheet` and `CollaboratorPicker` use `SailorProfileService`
   to fetch the "following" graph for nursing/drawing/fitness users —
   service rename will need to follow the rebrand thread.
