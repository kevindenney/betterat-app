# Step Architecture Migration Plan

**Status**: Audit + migration plan, no code yet.
**Audited**: 2026-05-12 against `docs/redesign/betterat-redesign-spec.md`, the bot-architecture addendum, and the late-12 addendum.
**Scope**: Step data model, Critique tab implementation, bot's `log_debrief` tool, `metadata.review` shape, Before/During/After tabs.

---

## 1. Current state

### 1.1 Data model

**Step row** (`types/timeline-steps.ts`):
- `timeline_steps` row carries `id`, `user_id`, `interest_id`, `organization_id`, `program_session_id`, `source_type` (`manual`/`template`/`copied`/`program_session`/`blueprint`), `status`, `starts_at`/`ends_at`, `visibility` (`private`/`followers`/`coaches`/`organization`), and a free-form `metadata` JSONB.
- Schema migrations: `supabase/migrations/20260314120000_create_timeline_steps.sql` (table + RLS for own/followed/coach reads, follower-completion notification trigger, plus `timeline_step_templates` for org templates). Source-type set later expanded to include `'blueprint'` in `20260322140000_create_blueprint_subscriptions.sql`.

**Metadata schema** (`types/step-detail.ts`):
- `metadata.plan` → `StepPlanData` (objectives, the-question/the-answer pattern, prep checklist, capability_targets).
- `metadata.act` → `StepActData` (notes, photos, voice memos, brain dumps).
- `metadata.review` → `StepReviewData` (flat fields: `overall_rating`, `worked_to_plan`, `deviation_reason`, `what_learned`, `capability_progress`, `instructor_assessment`, `competency_assessment`, `next_step_notes`).
- `metadata.brain_dump` for in-step capture.

This is the current **Plan / Act / Review (PAR)** model. It maps 1:1 to the spec's **Before / During / After**, just with different verbs.

### 1.2 Surfaces

- **Critique tab**: `components/step/StepCritiqueContent.tsx` (1,378 LOC). Sections rendered: star rating → skill progress dots → your-work thumbs → what-went-well → what-to-improve → "Analyze My Progress" AI button → competency assessment → instructor review status → next-session notes.
- **Card-rendering path** (per `feedback_card_rendering_path.md`): timeline cards use `RaceSummaryCard → StepPlanQuestions / StepDrawContent`, *not* `StepDetailContent → PlanTab`. Two parallel render trees exist for the same step model.
- **Step detail tabs**: confirmed there are already `Plan` / `Act` / `Critique` tabs in the detail surface, not literally "Before/During/After".

### 1.3 Bot ingest

- Actual file path: **`lib/telegram/tools.ts`** — the audit ask referenced `api/telegram/tools.ts`, but that directory only contains `link.ts` and `webhook.ts`. **Spec/codebase mismatch #1.**
- `log_debrief` schema accepts flat fields: `step_id`, `what_learned`, `what_to_change`, `next_step_notes`, `overall_rating` (1–5).
- The tool implementation calls `appendField()` which writes plain strings into `review.what_learned`, `review.deviation_reason`, and `review.next_step_notes`, stamped with `[YYYY-MM-DD via Telegram]`.
- WhatsApp adapter already exists at `api/whatsapp/webhook.ts` — the addendum frames WhatsApp as a "next" build, so it's partially built. **Spec/codebase mismatch #2.**

### 1.4 What the spec wants (target)

From `addendum-2026-05-12-bot-architecture.md`:

**`metadata.review` v2.0** — replace flat fields with a `sections[]` array, each entry shaped:
```
{
  prompt: 'what_happened' | 'what_worked' | 'what_didnt'
        | 'what_did_you_learn' | 'anything_else',
  prompt_label: string,         // human-readable, frozen at capture time
  content: string,
  source: 'telegram' | 'whatsapp' | 'voice' | 'in_app' | 'web' | 'sms',
  duration_seconds?: number,    // if voice
  captured_at: timestamptz,
  ai_summary?: string,          // optional
}
```
Plus a shared `CaptureEnvelope` / `ResponseEnvelope` interface so Telegram, WhatsApp, in-app voice, and SMS all hit one ingest pipeline. Plus a `recently_active_step` signal table so bot DMs without explicit step IDs can be routed; fallback drops to "most-recently-created step" rather than the current most-recently-completed heuristic.

From the main spec: rename Plan / Act / Critique → **Before / During / After** at the surface layer, with the After tab presenting prompt-keyed sections (not the current flat fields) plus delta/arc tiles (already partially shipped per `project_completion_sheet_v2.md`).

---

## 2. Redesign target — concise

| Layer | Current | Target |
|---|---|---|
| Tab names | Plan / Act / Critique | Before / During / After (display-only rename) |
| `metadata.review` | Flat fields (strings) | `sections[]` array, prompt-keyed, source-tagged, append-only |
| Bot ingest | Flat-field writes, one adapter per channel | Shared `CaptureEnvelope`, all channels normalize to `sections[]` |
| Step routing | Most-recently-completed fallback | `recently_active_step` signal + most-recently-created fallback |
| Render path | Two parallel trees (card vs detail) | One step-detail composition; cards subscribe to the same store |
| WhatsApp | Adapter started, not wired to shared envelope | Wired through shared envelope, parity with Telegram |

---

## 3. Delta analysis

### 3.1 Schema

- **No new table needed for the rename** — `metadata.review` is JSONB. Migration writes a single SQL transform that lifts `what_learned`/`deviation_reason`/`next_step_notes`/`overall_rating` into `sections[]` entries with `source: 'legacy'` and `captured_at = step.completed_at ?? step.updated_at`.
- **New table needed**: `step_recent_activity` (or similar) keyed on `(user_id, step_id, last_active_at, source)` to back the recently-active-step signal. Spec doesn't fix the name.
- **Constraint sweep**: `source_type` constraint was widened once already in the blueprint migration; a third widening (if we add new source types) follows the same pattern.

### 3.2 Bot tools

- `log_debrief` needs to accept *either* the legacy flat fields (for back-compat during rollout) *or* a `sections` array. New shape: one tool call per prompt-keyed section, OR one call with a `sections[]` payload. Recommend the latter so the model can group related thoughts in a single turn.
- Need a new tool: `mark_step_active(step_id)` and/or implicit update on any tool call that names a step — writes `step_recent_activity`.
- WhatsApp webhook (`api/whatsapp/webhook.ts`) currently doesn't share the Telegram tool definitions; it has its own handler. Pull both onto a shared `services/capture/CaptureService.ts` that takes `CaptureEnvelope` and returns `ResponseEnvelope`.

### 3.3 Surfaces

- `StepCritiqueContent.tsx` is the heaviest delta. Today: hard-coded section order with single-string fields. Target: drive section render from `metadata.review.sections[]`, grouped by prompt key, with per-section source badge + `captured_at`. Keep AI summary, capability progress, instructor review, competency assessment as separate panels — they aren't part of the prompt-keyed sections.
- Two render trees (`StepPlanQuestions/StepDrawContent` for cards, `StepDetailContent/PlanTab` for detail) must converge. Cards can keep their compact summary, but both must read the same selector so updates flow through.
- Rename: trivial string change, but search/replace through props, prop types, analytics events, and tests. Recommend keeping internal symbols as `plan/act/review` (data) and using `Before/During/After` only at display/copy layer to avoid touching ~150 call sites.

### 3.4 Spec/codebase mismatches to surface

1. Spec references `api/telegram/tools.ts`; actual path is `lib/telegram/tools.ts`.
2. Spec frames WhatsApp as "next 3–4 weeks of work"; webhook already exists at `api/whatsapp/webhook.ts`.
3. Spec mentions a `step_recent_activity` table and a `recentlyActiveStep` signal; no such table currently exists. Naming is unfixed.
4. Decisions log doesn't define what happens to the legacy `next_step_notes` field after migration — does it remain its own panel (it's not in the 5 canonical prompts), or get folded into `anything_else`?

---

## 4. Migration sequence (5 incremental steps)

### Step A — Read-side compatibility (1–2 days, no behavior change)

Add a `getReviewSections(step)` selector that:
- Returns existing `sections[]` if present.
- Otherwise synthesizes a `sections[]` array from legacy flat fields, tagging `source: 'legacy'`.

Drop into `StepCritiqueContent.tsx` and any AI-summary path. Ship behind a feature flag, dark-launch. **Exit criteria**: Critique tab renders identically for legacy steps, no schema change.

### Step B — Write-side dual-write from bot (2–3 days)

- Extend `log_debrief` schema to accept an optional `sections` array.
- When `sections` is provided, write into `metadata.review.sections[]`; when flat fields are provided (back-compat), write to both flat fields AND a synthesized `sections[]` entry.
- Update Gemini system prompt for the bot to prefer `sections` shape.
- Add `recently_active_step` table + writes from any bot tool that names a step.

**Exit criteria**: New Telegram debriefs populate `sections[]` on production rows; legacy steps still readable; recently-active fallback live.

### Step C — Capture service unification (3–4 days)

- Extract Telegram + WhatsApp into a shared `services/capture/CaptureService.ts` consuming `CaptureEnvelope` and producing `ResponseEnvelope`.
- Migrate both webhooks to call it. Telegram-specific shaping stays in the adapter layer (markdown, voice file handling).
- Add an in-app voice capture path that posts to the same service.

**Exit criteria**: Telegram and WhatsApp produce identical `sections[]` writes for equivalent input. Tests cover all five canonical prompts.

### Step D — Surface rename + render convergence (3–5 days)

- Rename display strings: Plan → Before, Act → During, Critique → After. Internal symbols stay.
- Refactor `StepCritiqueContent.tsx` to render `sections[]` grouped by prompt key with source/captured-at metadata. AI summary, capability progress, instructor review, competency assessment stay as separate panels below the sections.
- Converge card render path: change `StepPlanQuestions/StepDrawContent` to read the same selector that the detail view uses for prompt sections (cards summarize, detail expands).

**Exit criteria**: One render path. Section sources visible. After tab shows prompt-keyed structure. No regression on completion-sheet v2 tiles.

### Step E — Backfill + retire legacy fields (1 day migration + monitoring)

- Run idempotent SQL backfill: for any `metadata.review` lacking `sections[]` but with legacy fields, synthesize sections.
- Stop dual-writing flat fields. Keep flat-field *reads* in the selector for two release cycles, then remove.
- Drop `next_step_notes` legacy panel into `anything_else` UNLESS Decision D-resolution comes back saying otherwise (see open decisions).

**Exit criteria**: All review reads go through `sections[]`. Bot tools only emit new shape. Flat fields no longer written.

---

## 5. Open decisions

| # | Decision | Why it blocks |
|---|---|---|
| 1 | `next_step_notes` — keep as its own panel or fold into `anything_else`? | Affects Step E. The five canonical prompts don't include it; spec is silent on retention. |
| 2 | Name of the recent-activity table (`step_recent_activity`, `recently_active_step`, etc.) and TTL semantics. | Blocks Step B writes. Suggest 7-day TTL via partial index, name `step_recent_activity`. |
| 3 | Display rename — full rename everywhere (incl. analytics, deep links) or display-only? | Affects Step D blast radius. Recommend display-only. |
| 4 | Card render convergence — keep card-specific compact components or render the same composition with a `compact` prop? | Affects Step D approach. Recommend compact prop. |
| 5 | Instructor assessment and competency assessment — keep separate from `sections[]` or absorb? | Affects Critique refactor in Step D. Recommend keep separate; they have different write paths (instructor, not user/bot). |
| 6 | Legacy `[YYYY-MM-DD via Telegram]` stamp inside string fields — strip during backfill or preserve as `captured_at`? | Affects Step E backfill SQL. Recommend parse-and-strip. |

---

## 6. Risks

- **Two-tree render drift**: card path and detail path have already diverged. Step D risks regressing one while fixing the other. Mitigation: snapshot tests on both before refactor; ship Step D behind a flag.
- **Bot prompt regression**: changing the tool schema may cause Gemini to skip the tool (see `feedback_haiku_tool_hallucination.md`). Mitigation: keep flat fields valid in the schema during transition; only flip required fields after telemetry confirms the model uses `sections`.
- **Backfill on production data**: ~unknown row count, JSONB transforms in production are slow if `metadata` is large. Mitigation: chunked update with a `WHERE metadata->'review'->'sections' IS NULL` predicate; run in pages of 1k.
- **Recently-active table contention**: every bot turn writes. Mitigation: write through SECURITY DEFINER function (avoid RLS recursion per `feedback_rls_cross_table_recursion.md`); partial index on `last_active_at > now() - interval '7 days'`.
- **Completion-sheet v2 coupling**: the celebration sheet just shipped against the flat shape. Step A must keep it working; Step D must port its data sourcing to the selector. Mitigation: include sheet in Step A regression test.
- **Mismatch #2** (WhatsApp already started) means there's pre-existing code that may have its own contract; check before Step C that the existing webhook hasn't shipped to real users with the old shape.

---
