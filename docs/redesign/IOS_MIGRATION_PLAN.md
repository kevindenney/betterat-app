# iOS Register Migration Plan

## Context

Kevin handed off the first of 12 iOS register surfaces from Claude Design: `Race Prep - Race 4 - iOS register.html`. The design file declares itself "Pass A — iOS" — an iOS-native register that explicitly *substitutes* away from the editorial register that's been shipped over the last ~14 redesign commits.

**Open question for the user to confirm before any code lands:** Is iOS register *replacing* the editorial register on native, or *coexisting* (e.g. editorial for web, iOS for native app)? The chat transcript captured an earlier locked decision for editorial/literary register, but the existence of 12 iOS-register handoffs strongly implies a register pivot. The phase ordering below assumes **iOS register replaces editorial on the native app surfaces it touches**, while editorial remains the reference register for any web/marketing surfaces. If the user confirms coexist, Phase 0 expands to add a register-switch instead of a token rename.

This document is the plan the user asked me to write to `docs/redesign/IOS_MIGRATION_PLAN.md`. The migration content lives in this plan file because plan mode requires it; on approval, the same content lands at the final path.

---

## Source design — what the iOS register commits to

From `Race Prep - Race 4 - iOS register.html` + the side rail:

**Materials swap (editorial → iOS):**
- Source Serif 4 / Iowan Old Style → SF Pro throughout (no serif, no italic-for-utterance)
- Warm cream ground `#FAFAF7` → iOS system gray 6 `#F2F2F7` + white rounded-rect cards `#FFFFFF` floating on it
- Italic-serif-with-provenance → quote card with 22px circular source-glyph badge (mic / bubble / lightbulb)
- Lilac AI card → coral AI prompt card (`rgba(255,107,107,0.10)` fill, sparkles glyph, ALL-CAPS coral eyebrow)
- Green live dot → 6px coral live dot (same grammar, iOS palette)
- 84px charcoal hero mic → 6-button toolbar composer (44px each, modality-equal)
- Charcoal permission-rule flag pill → coral-left-border (3px) inline callout with flag glyph
- Editorial sub-tab bar → iOS standard nav title with back chevron + search + overflow

**Two accents, two jobs** (the spec's headline commitment):
- iOS blue `#007AFF` — user actions, active states
- iOS coral `#FF6B6B` — AI questions, marked content
- These never blur into one role.

**Atmospheric tint, scoped:**
- `--atm-slate: rgba(120, 145, 175, 0.14)` linear-gradient behind the forecast tile group **only** — not the whole surface

**Preserved across registers:**
- Four-tab floating nav (Race / Playbook / Discover / Reflect)
- Per-interest vocabulary
- AI never speaks as itself
- Raw vs synthesized layer separation
- Component grammars (live dot = concept active in step; rule callout = rule committed to; AI prompt = open-or-not)
- Named absences (no streaks, no progress %, no gamification, no Learn tab)

---

## (1) Editorial tokens that need replacement

Current authoritative tokens live in two files, neither at `src/design-system/tokens.ts` (the user's reference path doesn't exist):

- `lib/design-tokens.ts` — RegattaFlow editorial tokens (`colors`, `fontFamily`, `text` recipes, `tufte`)
- `lib/design-tokens-ios.ts` — Apple HIG iOS tokens (`IOS_COLORS`, `IOS_TYPOGRAPHY`, etc.)
- `lib/step-theme.ts` — editorial step register (`STEP_PALETTE` cream + charcoal, `STEP_COLORS` legacy green/coral)

**Token mapping for iOS register (replacing where it lands, coexisting otherwise):**

| Editorial token | iOS register replacement | Notes |
|---|---|---|
| `STEP_PALETTE.bgPrimary` `#FAFAF7` (warm cream) | `IOS_COLORS.systemGroupedBackground` `#F2F2F7` | Page ground |
| `STEP_PALETTE.bgSecondary` `#F0EEE8` | `IOS_COLORS.secondarySystemGroupedBackground` `#FFFFFF` | Card surface (inverts: editorial used darker for secondary; iOS uses white card on gray ground) |
| `STEP_PALETTE.bgInfo` `#E5E1F0` (lavender) | `--ios-coral-tint` `rgba(255,107,107,0.10)` | AI prompt fill. **This is the headline substitution** — the lilac AI card retires in favor of coral |
| `STEP_PALETTE.textPrimary` `#2A2824` (warm charcoal) | `IOS_COLORS.label` `#000000` | Primary body |
| `STEP_PALETTE.textSecondary` `#58544A` | `IOS_COLORS.secondaryLabel` `rgba(60,60,67,0.62)` | Sub-meta |
| `STEP_PALETTE.textTertiary` `#8A8478` | `IOS_COLORS.tertiaryLabel` `rgba(60,60,67,0.32)` | Eyebrows, timestamps |
| `STEP_PALETTE.textInfo` `#5A4078` (violet) | `IOS_COLORS.systemBlue` `#007AFF` for user actions; coral `#FF6B6B` for marked content | Single "info" token splits into two-accent roles |
| `STEP_PALETTE.borderSecondary` `#C8C2B4` | `IOS_COLORS.separator` `rgba(60,60,67,0.29)` | Note: editorial design has 0.20 separator; current `IOS_COLORS.separator` is 0.29. Audit which to canonize |
| `STEP_PALETTE.borderTertiary` `#DDD8CA` | hairline `rgba(60,60,67,0.20)` (new) | iOS uses 0.5px hairlines |
| `STEP_PALETTE.ctaBg` `#2A2824` (charcoal CTA) | `IOS_COLORS.systemBlue` `#007AFF` | Primary action becomes iOS blue |
| `STEP_PALETTE.ctaText` `#FAFAF7` | `#FFFFFF` | |
| `fontFamily.serif` (Iowan Old Style) | **dropped on register-iOS surfaces** | No serif in iOS register |
| `text.serifTitle` / `serifSubtitle` / `serifBody` / `serifMeta` | `IOS_TYPOGRAPHY.title1` (28/34) / `title2` (22/28) / `body` (17/22) / `subhead` (15/20) | Recipe-level renaming |
| `text.sansEyebrow` (12px, 0.5 letter-spacing) | Keep — already SF Pro 12px upper. Resize to 11px per design |

**New iOS-register tokens to add** (extend `design-tokens-ios.ts` or create a new `IOS_REGISTER` const):

```ts
export const IOS_REGISTER = {
  // Two accents
  accentUserAction: '#007AFF',          // ios blue — already in IOS_COLORS.systemBlue
  accentMarkedContent: '#FF6B6B',       // ios coral — NEW
  accentMarkedContentTint: 'rgba(255, 107, 107, 0.10)',
  accentMarkedContentTintStrong: 'rgba(255, 107, 107, 0.16)',

  // Atmospheric tint (forecast-only)
  atmosphericSlate: 'rgba(120, 145, 175, 0.14)',
  atmosphericSlateFade: 'rgba(120, 145, 175, 0)',

  // Live dot
  liveDotSize: 6,                       // 6px coral dot for "concept active in step"
} as const;
```

**Tokens that stay editorial** (don't touch):
- All marketing/landing tokens in `lib/design-tokens.ts` (`colors.primary` ocean blue, `tufte.*`) — different surface family
- `STEP_COLORS` legacy green/coral — already deprecated, doesn't need re-migration
- `IOS_TYPOGRAPHY` — already SF Pro, no change

---

## (2) Existing components that need re-skinning per the 14 redesign commits

The 14 commits below moved their components to **editorial** register (serif + warm cream + neutral charcoal). Each will need a **second migration** to iOS register if the user confirms the pivot. Listed in commit order with re-skin cost.

| # | Commit | File(s) | Editorial state today | iOS-register re-skin |
|---|---|---|---|---|
| 1 | `94d3df13` redesign 2 — drop Learn tab | `app/(tabs)/_layout.tsx` | Four-tab nav | **No change** — four-tab nav is preserved across registers |
| 2 | `108385aa` redesign 3 — step-detail serif title | `components/step/StepDetailContent.tsx` | 28pt Iowan serif title, `STEP_PALETTE.bgPrimary` page bg | Title → 32pt SF Pro regular `-0.022em` letter-spacing per design `title-block h1`. Bg → `IOS_COLORS.systemGroupedBackground`. Add ALL-CAPS 11px eyebrow above title. |
| 3 | `30bd720d` redesign 4 — step-plan drop AI Coach persona | `components/step/PlanTab.tsx`, `PlanQuestionCard.tsx` | Neutral palette, no "AI Coach" wording | Re-skin to white-card-on-gray; question cards become "beat cards" (white rounded-rect, 22px semibold header, 17px SF body, hairline divider). |
| 4 | `875772d1` redesign 5 — step-review serif prompts | `components/step/ReviewPromptSection.tsx` | Serif prompts + `STEP_PALETTE` | Drop serif → 17px SF body; bg `STEP_PALETTE.bgSecondary` → white card on `secondarySystemGroupedBackground` |
| 5 | `ecf81604` redesign 6 — capture timeline | `components/step/CaptureTimeline.tsx`, `ObservationLog.tsx` | Single chronological feed with neutral row pattern | Re-skin rows to iOS list-row pattern (white card group with 0.5px separators); keep the unified-feed architecture. |
| 6 | `71f57c73` redesign 6b — voice vs note distinction | `CaptureTimeline.tsx`, `ObservationLog.tsx` | "9:32 am · note" vs "9:32 am · voice" prefix | Promote prefix to source-glyph pattern: 22px circular badge with mic / bubble icon at row leading edge. Same disambiguation, iOS grammar. |
| 7 | `b4f09be2` redesign 6c — "From last time" past-context | `components/step/PastContextCard.tsx` | Ambient cream surface | White card on gray ground; eyebrow ALL-CAPS 11px secondary; body 17px SF |
| 8 | `bd0def08` card-title serif treatment | timeline-card titles | Serif step titles | SF Pro `title2` (22pt semibold) on cards |
| 9 | `0fcf2264` lowercase eyebrows on PlanQuestionCard | `components/step/PlanQuestionCard.tsx` | lowercase serif eyebrows | ALL-CAPS 11px secondary per iOS section-eyebrow grammar (note: this **reverses** the lowercase choice — confirm with user) |
| 10 | `ded70a2e` audit 1 — session-list chrome | session list components | Neutral STEP_PALETTE | White-card-list on gray; iOS-grouped-list inset rounded |
| 11 | `ee631e61` audit 2 — Playbook tokens + serif tab headers | `components/ui/TabScreenToolbar.tsx`, `PlaybookHome.tsx`, `ThisWeekFocusCard.tsx` | 30pt serif large title via TabScreenToolbar | **Single highest-leverage revert/replace:** `TabScreenToolbar.largeTitle` → SF Pro Large Title `IOS_TYPOGRAPHY.largeTitle` (34/41, weight 700, +0.37 tracking). This change flips the title face on every tab page at once. |
| 12 | `cda46388` audit 3 — Reflect tokens + bgInfo upgrade banner | `app/(tabs)/reflect.tsx` | Lavender `bgInfo` upgrade banner, neutral chrome | Lavender → coral-tint AI-prompt card pattern? Or stays neutral? **Decision needed** — banner is promo, not AI-prompt; design file doesn't show a Reflect equivalent. Recommend: keep neutral white card; reserve coral strictly for AI-prompt and marked-content semantics. |
| 13 | `1478a03c` audit 3 follow-up — IOSSegmentedControl | `components/ui/IOSSegmentedControl.tsx` | Neutral palette accent | Restore iOS blue accent for active segment per design's "blue = user actions, active state". |
| 14 | `13c9c35d` audit 3 deferred — WeeklyCalendar | `components/calendar/WeeklyCalendar.tsx` | Neutral palette | iOS blue for active day / today marker per same rule |
| 15 | `cd2c1cdd` audit 4 — Activity inbox | activity inbox components | Neutral palette | Row pattern → iOS grouped list; AI-suggested items → coral 22px badge |

**Quick wins** (single-source-of-truth changes that ripple):
- `TabScreenToolbar.tsx` — flips every tab large-title at once
- `IOSPillTabs.tsx` / `IOSSegmentedControl.tsx` — flips every segmented control at once
- `lib/step-theme.ts` STEP_PALETTE values — flips every consumer at once (but inverts contrast direction since iOS uses white-card-on-gray vs editorial cream-on-cream)

---

## (3) Surfaces in the Race Prep file that don't exist in code yet

Mapping the design's component inventory against current components:

| Design component | Closest existing | Status |
|---|---|---|
| Large title block (eyebrow + 32pt title + meta) | `StepDetailContent.tsx` header | **Re-skin existing.** Adapt the title block to add the ALL-CAPS eyebrow + dual-line meta. |
| Forecast tile group (4 tiles on atm-slate tint) | `components/cards/content/modules/ConditionsModule.tsx` | **Largely new.** ConditionsModule exists but uses editorial styling and different tile structure (no atmospheric-tint background, no SF Symbol top-right per-tile, no 4-equal layout). New component: `ForecastTileGroup.tsx`. |
| Working-on pills (system-gray-5 fill rounded pills + live-coral dot) | `components/step/StepFocusConcepts.tsx` (likely closest) | **Re-skin + extend.** Verify if existing focus-concept pills support the live-dot variant and state-suffix. Add 6px coral live dot for "concept active in step" grammar. |
| Quote card with source-glyph badge | none | **New component.** `QuoteCard.tsx` with `SourceGlyph` icon (mic / bubble / lightbulb / book) at 22px circular badge. Provenance row in 13px secondary sans. |
| Beat card (named planning section with body prose + optional embedded photo) | `PlanQuestionCard.tsx` partial | **New component.** `BeatCard.tsx` — white rounded-rect, 22px semibold header with right-meta, hairline divider, 17px body prose, float-right 132×88 embed photo support. PlanQuestionCard is closest but is question-shaped, not beat-shaped. |
| Permission rule callout (3px coral left border + flag glyph + 17px semibold rule) | none | **New component.** `PermissionRuleCallout.tsx`. Inline pattern that sits inside a beat card. Coral-border = "rule you committed to" grammar. |
| Coral AI prompt card | currently lilac/lavender per editorial | **Replaces existing pattern.** Rename or fork the existing "from playbook" AI prompt to iOS-coral variant: `~12%` coral fill, sparkles glyph, ALL-CAPS coral eyebrow, italic-as-quotation, filled iOS button + text button pair. |
| Crew person list (grouped table, 36px avatar, 17px name, 14px role, chevron) | `CollaboratorPicker.tsx` (picker), partial display in `StepCollaborators` flows | **New display component or fork.** CollaboratorPicker is a picker; need a read-only display variant. `CrewList.tsx`. |
| Toolbar composer (6 modality-equal 44px tools in a rounded white card) | current capture surfaces use single hero mic | **New component.** `ToolbarComposer.tsx` with 6 tools: list / camera / photo / audio / location / sparkles. The sparkles button is the coral-tinted AI affordance. **Design principle locked in spec:** composition surfaces get toolbar composers; capture surfaces get hero-mic composers. So the existing hero-mic is right for On-the-Water; this toolbar is right for Race Prep. |
| Floating four-tab nav with backdrop-filter blur | `app/(tabs)/_layout.tsx` likely renders something | **Verify.** Should already render four tabs; needs translucent material treatment + iOS-blue tint on active tab if not present. |
| Top chrome row (back chevron + search + overflow) | iOS native nav header in routes | **Verify.** Likely standard expo-router header; verify the back-chevron+Race label pattern and the search + dots overflow glyphs are wired. |
| Atmospheric forecast background | none | **New utility.** Linear-gradient panel scoped to forecast section only — small `<AtmosphericPanel>` wrapper. |

---

## (4) Suggested phase ordering

The 12 surfaces will land in waves. The first surface drives the foundation; subsequent surfaces should slot in without re-doing tokens.

### Phase 0 — Register decision + token foundation (review-gated)
**Don't write code yet.** First user-confirm:
1. iOS register replaces editorial on native? Or coexists by surface/platform?
2. If replace: do we keep `STEP_PALETTE` as the name and rewrite its values (low-churn) or introduce `IOS_REGISTER` alongside and migrate consumers (high-churn but more reversible)?

Then, in one commit:
- Add `IOS_REGISTER` constants to `lib/design-tokens-ios.ts` (coral, atmospheric tint, live-dot size)
- Add SF-Pro `IOS_TEXT` recipes that mirror the design's `title-block h1`, `sect-head`, `beat-card .head h2`, `body p`, `meta`, `eyebrow`
- If iOS replaces editorial: rewrite `STEP_PALETTE` values inline (single PR, mechanical color/font swap on all consumers)
- Update `text.serifTitle` etc. consumers — either retire them or alias to SF Pro recipes
- Update `tailwind.config.js` font extension if any redesign uses the serif tokens

### Phase 1 — Single-source-of-truth chrome flips (cheap, high-ripple)
One PR per file:
- `TabScreenToolbar.tsx` — serif large title → SF Pro Large Title 34pt. Flips Session, Playbook, Discover, Reflect headers at once. (**Reverses commit `ee631e61`** in title-face only.)
- `IOSSegmentedControl.tsx` — neutral charcoal accent → iOS blue. (Reverses commit `1478a03c`.)
- `IOSPillTabs.tsx` — neutral accent → iOS blue. (Touches commit `108385aa` partially.)
- `WeeklyCalendar.tsx` — neutral active day marker → iOS blue. (Reverses commit `13c9c35d`.)
- Floating tab bar — confirm iOS-material translucent + iOS-blue active tint.

These are reversible if Phase 0 decision changes mid-flight.

### Phase 2 — Build the new iOS-register components (no existing consumers yet)
Each is a standalone new file under `components/ios-register/` (or wherever the codebase prefers):
- `ForecastTileGroup.tsx` + `AtmosphericPanel.tsx`
- `BeatCard.tsx` (with optional `embedPhoto` slot)
- `QuoteCard.tsx` + `SourceGlyph` (mic / bubble / lightbulb / book variants)
- `PermissionRuleCallout.tsx`
- `CoralAIPromptCard.tsx`
- `WorkingOnPill.tsx` (with live-coral-dot variant)
- `ToolbarComposer.tsx`
- `CrewList.tsx`

Each gets a Storybook-style mount in a sandbox route (`app/dev/ios-register-kit.tsx`) so the user can compare against the HTML side-by-side without touching real product surfaces.

### Phase 3 — Wire Race Prep surface (the first of 12)
Stitch the new components into the Race Prep surface (the existing PlanTab / StepDetailContent path). Specifically:
- StepDetailContent header → iOS title-block
- ForecastTileGroup mounts above PlanTab
- WorkingOnPill row replaces existing focus-concept rendering
- QuoteCard renders "From your last race" reflections (data: most recent same-interest debriefs)
- BeatCard renders the 3 named planning sections (data: planData.what / how / contingency mapping TBD — the design's "Start / First beat / Contingency" naming is sailing-specific; we'll need to confirm how per-interest beat naming flows from the existing PlanQuestionCard contract)
- PermissionRuleCallout slots inside the Contingency beat (data: user-authored rule, currently has no first-class model — **new schema work flagged for review**)
- CoralAIPromptCard replaces the existing "From your playbook" AI prompt
- CrewList replaces the existing collaborator display in PlanTab
- ToolbarComposer replaces the existing hero-mic composer on this surface

### Phase 4 — Re-skin pass over the 14 prior commits' surfaces
File-by-file, port the components touched in commits 2–15 above to use new tokens + recipes. Largely mechanical:
- Page bg → `systemGroupedBackground`
- Card bg → `secondarySystemGroupedBackground`
- Font family swap (drop serif)
- Type-size swap to `IOS_TYPOGRAPHY`
- Active states → iOS blue
- Marked content → coral

### Phase 5 — Surfaces 2–12 (handed off over time)
Hold this section open. Each incoming surface gets:
1. A short addendum to this plan listing new components vs reuse vs re-skin.
2. A targeted PR. The token foundation is already in place after Phase 0–2.

### Decisions — resolved by user (2026-05-14)
1. **Register pivot — CONFIRMED.** iOS register is canonical. Editorial register tokens get superseded. No coexist branch. Phase 0 rewrites `STEP_PALETTE` values inline.
2. **Permission rule schema — DEFERRED.** Out of scope for visual pass. `step_rules` goes to a separate data-layer backlog. Visual pass renders the rule via existing content fields with placeholder text.
3. **Per-interest beat naming — re-skin existing plan-questions, no parallel concept.** Don't introduce a new "beats" abstraction. Per-interest vocabulary mapping uses the same system already driving Race Prep / On the Water / Debrief naming:
   - sailing: Start / First beat / Contingency
   - clinical: Briefing / Shift / Debrief
   - drawing: TBD (defer until first drawing user)
   Phase 3 wires `BeatCard.tsx` as the new shell, but the data spine stays the existing PlanQuestionCard contract.
4. **Lowercase eyebrow reversal — CONFIRMED.** Reverse commit `0fcf2264`. iOS register uses ALL-CAPS 11px eyebrows throughout.
5. **Reflect upgrade banner — REMOVE lavender.** Coral stays strictly reserved for AI-prompt and marked-content semantics. The Reflect upgrade banner becomes neutral white card on gray ground.
6. **Quote-card source provenance — mic + bubble only.** Render mic (voice) and bubble (written) per existing data. Defer lightbulb (AI-tagged) until data layer supports it. Don't block visual pass on it.

### Addendum — Phase 5 fresh-build surfaces (user-flagged 2026-05-14)
Three surfaces in the 12-handoff set don't exist in code at all and are NOT re-skins from editorial. They get built fresh against iOS tokens:
- **Get Inspired modal** (Discover)
- **On the Water atmospheric ground** (live-capture surface)
- **Trophy of Becoming** (path-completion synthesis artifact)

These move to Phase 5 with explicit "no editorial precedent" notes so they don't get conflated with re-skin work. Each will get its own component spec when its design lands.

---

## Open architecture follow-ups (surfaced during Phase 3 wire-up)

These are out of scope for the visual pass but should land before cutover. Captured here so they're not lost.

1. **Authoring flow for prose beats.** The current Before tab has explicit `what / how / why / who` input fields. The iOS register renders 3 prose beat cards instead — but never specifies where the user *writes* `what` and `why`. The composer is the most likely answer, with AI helping route input into the right `plan_data` field. **Decision needed before cutover:** does the new register keep all four `plan_data` fields and surface them through a single composer, or does the schema simplify to free-form prose per beat?

2. **Concept "active in this step" schema.** The 6px coral live-dot on the WorkingOnPill signals "concept active in current step" — but no table currently links concepts to steps. Need a `step_concepts` or `step_active_concepts` association. Until it exists, the concept pill stays hardcoded in the preview route.

3. **Weather service integration.** ForecastTileGroup wants wind, sea, tide, sky for the step's location + start time. No weather service is wired today. Likely vendor: OpenWeatherMap (env var already exists: `OPENWEATHER_API_KEY`) or WeatherAPI Pro. The tile labels are sailing-specific (WIND/SEA/TIDE/SKY) — per-interest mapping needed (clinical: VITALS/ACUITY/CENSUS/?).

4. **Prior-debrief quote query.** "From your last race" wants 1–2 quoted phrases from the most recent same-interest Debrief step. Need a `getRecentDebriefQuotes(userId, interestId)` service that pulls `review_data.standout_quotes` (or similar — that field doesn't exist yet) from the last N completed steps. The user has flagged voice/note source disambiguation as in scope (mic + bubble); AI-tagged source defers.

5. **Concept-suggestion service for the AI prompt.** "FROM YOUR PLAYBOOK · You've written about *X* in N reflections — open as a concept?" needs a service that scans the user's recent reflections for repeated phrasings and proposes concept candidates. Substantial AI/NLP work — schedule after the visual pass.

6. **Permission-rule schema (`step_rules`).** A user-authored rule attached to the Contingency beat. Per-step text + label, surfaced inline in the new register. Visual pass uses placeholder text; data layer follows.

7. **Per-interest beat name mapping.** Currently hardcoded sailing-only in `app/race/ios/[stepId].tsx`. Needs to live in a per-interest config (alongside the existing Race Prep / On the Water / Debrief vocabulary system). Clinical mapping (Briefing / Shift / Debrief) is known; drawing defers until the first drawing user.

8. **Active-interest mismatch on competency progress.** `useCompetencyProgress` queries by the *active* interest, not the *step's* interest. When viewing a step from a different interest (sailing step while nursing is active), pill statuses come back empty. Either: (a) introduce a stepId-scoped progress hook, or (b) accept the limitation since cross-interest viewing is rare.

---

## Resolved architecture decision (2026-05-14) — Reflection vs Competency Assessment

**Question that surfaced during Phase 3:** does the iOS register's chronological-stack Debrief replace the existing form-based After tab entirely, or do form fields still survive somewhere? Confirmed by user.

**Decision: split the After-phase into two distinct surfaces.**

| Artifact | Surface | Owner | Shape | Status |
|---|---|---|---|---|
| **Reflection** (the student's narrative replay of what happened) | `/race/ios/debrief/[stepId]` chrono stack | Step user (student / sailor) | Time-ordered raw captures, no prompts | **Built (Phase 3)** |
| **Competency Assessment** (graded rubric mapping captures → competency evidence) | NEW — not yet designed | Path author / preceptor / faculty | Form-based, per-competency rating + evidence basis | **Deferred to a later phase** — flagged for design |

**Why the split:**
- **JHU MSN students** (and any accredited program) require structured competency exposure documentation for CCNE / AACN / Title VIII / VA. Forms aren't optional — they're regulatory artifacts.
- **But the student's reflection is narrative work.** Diekelmann-tradition narrative pedagogy + clinical reasoning models (Tanner) read better as a walked-through replay of captures than as form fields answering "what did you learn."
- **The existing After tab collapses both into one surface,** which is why per-competency prompts repeat (WHAT DIDN'T / WHAT DID YOU LEARN / ANYTHING ELSE × N competencies). Each competency really wants assessment evidence, not its own reflection.
- **Felix doesn't have an accrediting body**, so the collapse mostly worked for sailing. Emily does, so it doesn't.

**What this means for the iOS register cutover:**

- The chrono-stack Debrief surface (already built) is the canonical student-facing reflection. Visual pass complete.
- The form-based competency assessment surface stays a separate Phase 5+ design problem. It's faculty-primary (path author left a note on a specific student's step — per the spec's §8.2 "Direct response to individual reflection" pattern), with the student seeing it as feedback rather than authoring it.
- The data model already supports this: `StepReviewData.competency_assessment` (StepCompetencyAssessment with planned + additional competencies + evidence_basis) is the structured artifact. `review_data.sections` is the prose. Keep both fields; the new register just renders them on different surfaces.
- **New follow-up:** a Competency Assessment surface needs a design from Claude Design when the next institutional handoff happens (Patricia / Linda MSN Capstone view).

---

## Verification plan

This is a planning artifact only. Verification once implementation begins:
- After Phase 0: `npm run typecheck` clean; no consumers of `text.serifTitle` etc. break (or are aliased).
- After Phase 1: visual diff on Session / Playbook / Discover / Reflect tab headers; segmented control on Reflect sub-tabs renders blue.
- After Phase 2: dev-sandbox route `app/dev/ios-register-kit.tsx` renders all 8 new components; pixel-compare against the HTML reference in a browser at viewport 393×852.
- After Phase 3: Race Prep step detail in iOS sim matches the design file's beat structure + composer + crew list; user-authored rule renders inside Contingency.
- After Phase 4: visual regression check that the 14 prior-commit surfaces still read coherently with the new chrome.

## Final action on ExitPlanMode approval

Write this same content to `docs/redesign/IOS_MIGRATION_PLAN.md`. No other code changes in this pass — implementation waits for the user's review of the plan.
