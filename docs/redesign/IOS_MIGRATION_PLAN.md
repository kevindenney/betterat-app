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

7. ~~**Per-interest beat name mapping.**~~ ✅ **Resolved 2026-05-15** in `lib/per-interest-beats.ts`. Sibling to `lib/vocabulary.ts`, follows the same per-interest-with-generic-fallback pattern. Sailing → `Start / First beat / Contingency`. Nursing → `Briefing / Shift / Debrief`. Unmapped interests → `Beat 1 / Beat 2 / Beat 3` generic fallback. Lookup follows the step's interest (not the viewer's active interest), same precedent as `useVocabulary(overrideInterestId)`.

8. **Active-interest mismatch on competency progress.** `useCompetencyProgress` queries by the *active* interest, not the *step's* interest. When viewing a step from a different interest (sailing step while nursing is active), pill statuses come back empty. Either: (a) introduce a stepId-scoped progress hook, or (b) accept the limitation since cross-interest viewing is rare.

9. **Competency Assessment "0 captures" empty-state copy.** Designed surface only specified the populated state; rendering "0 captures across this step" on a step with no observations or media_uploads reads as awkward chrome. Either soften the copy ("No captures yet — open the step to log voice notes or photos") or hide the captures-context card entirely when count is zero. Not blocking; visual polish.

10. **Post-cutover cleanup pass on Playbook home.** After `PLAYBOOK_IOS_REGISTER` flag has been observed to hold (one week minimum), delete the live-but-unmounted components and hook: `ThisWeekFocusCard`, `AskYourPlaybook`, `SuggestionsBar`, `RecentDebriefs`, `WeeklyReviewsPreview`, `sidebar/QueuedSuggestionsPreview`, `SectionTabs`, and `usePlaybookRecentDebriefs` (consumer audit deferred from the cutover commit — confirm no other consumers before deleting the hook). The wand-and-stars "Preview iOS register" toolbar entry on `PlaybookHome.tsx` can also retire. The flag itself can be removed once we're confident the cutover is permanent.

11. **`/step/[id]` vs `/race/ios/[stepId]` detail-surface split.** Today there are two different detail surfaces for the same underlying step:

   - **`/step/[id]`** — the deep-edit surface with the full feature set: comments, sharing, collaborators, AI extraction, and other legacy step-management affordances. It is still reachable from older entry points.
   - **`/race/ios/[stepId]`** — the iOS register Race Prep detail surface. After the Race Prep cards cutover, this becomes the new canonical tap target from cards. It is intentionally lighter and more composed than `/step/[id]`.

   **Question:** do these surfaces merge, diverge, or coexist?

   - **Merge** — `/step/[id]` also flips to an iOS register full-surface and somehow absorbs the full feature set. This requires designing iOS-register treatments for comments, sharing, collaborators, AI extraction, and any other deep-edit affordances that currently live only on the legacy surface.
   - **Diverge** — `/step/[id]` stays legacy as a power-user or management surface, while `/race/ios/[stepId]` is the canonical user-facing detail surface for new Race Prep entry points. Two surfaces, two jobs.
   - **Coexist for now** — defer the decision, accept the split, and revisit after production usage shows whether people actually discover and depend on `/step/[id]` through non-card entry points.

   **Why this matters:**

   - Architecture decision #4 answered the summary-vs-detail question. This is a different architecture question: when there are **two detail surfaces** with different feature density, what is the rule?
   - User-visible behavior can get confusing: a card tap goes to the lighter iOS detail surface, while another menu path may still open the deeper legacy detail surface.
   - Feature parity stays unresolved. If `/step/[id]` remains editorial/legacy while Race Prep detail goes iOS-native, the register is only partially applied across the Race tab.

   **When to revisit:** after the Race Prep cards cutover has been live in production long enough to observe whether users find and use `/step/[id]` from non-card entry points, and whether those entry points still matter enough to justify a second full-surface migration.

12. **Inline-action affordances on iOS-register summary cards.** The legacy `<CardGrid />` passed Edit / Delete / Hide / MarkDone / MarkNotDone / Upload-document / Race-complete / Open-post-race-interview / Dismiss-sample / Bulk-update-status / Bulk-delete / Reorder handlers down to each card. Cards exposed those affordances inline (overflow menus, swipe actions, long-press, header glyphs). `<RaceCardsScreen />` after the 2026-05-15 cutover exposes only **tap-through to `/race/ios/[stepId]`** — the card is now a pure summary surface in the Apple Books library register.

   **Question:** which of those inline actions are still load-bearing on the summary surface, and how do they re-surface in the iOS register?

   - **Tap-only purist option** — the summary is for orientation ("where am I in the season?"); every mutating action lives on the detail surface. Edit / Delete / MarkDone all migrate to `/race/ios/[stepId]`'s overflow chrome. Bulk operations move to a dedicated edit-mode (or are dropped if telemetry shows nobody used them).
   - **Long-press / context-menu re-introduction** — keep the surface visually clean, but add an iOS-native long-press → context menu that lifts the most-used actions (Delete / MarkDone) without permanent card chrome. Matches the iOS Books long-press pattern.
   - **Selective re-skin** — re-introduce a small set of actions per status: Open prep (current), View debrief (debriefed), Skip / Reschedule (planned). Status-specific affordances rather than the legacy bulk set.

   **Why this matters:**

   - The cutover ships with the tap-only contract. If users hit dead-ends ("how do I delete a step now?"), the register-level decision has to be revisited fast.
   - Bulk operations (`onBulkUpdateStatus`, `onBulkDeleteRaces`, `onReorderRaces`) currently live behind the `hasTimelineSteps && !isSailingInterest` branch — they're already absent on the sailing path. Telemetry should confirm whether non-sailing personas still need them on the summary surface.
   - The earned-exception principle says the current-card has an "Open prep →" CTA, but every other card is tap-the-whole-card. Adding inline actions would dilute that grammar.

   **When to revisit:** after the cutover has been live long enough to observe whether users discover Edit / Delete / MarkDone on the detail surface, and whether support requests or telemetry suggest a missing affordance on the summary surface.

---

## Cross-cutting principles

Surface-agnostic rules that apply across every iOS-register screen, not scoped to a single cutover.

### Loading-state narration

Anywhere the system does AI work or multi-step processing that takes more than ~2 seconds, the surface **narrates in plain language** with messages that scroll or replace as steps complete. No `"Loading..."` spinners. No indeterminate progress wheels with no context.

**Reference pattern:** OpenAI ChatGPT's plan-ready flow — short status lines that swap as the pipeline advances:
- "Getting your plan ready"
- "Warming up the image generators"
- "Stitching it together"

**Voice:** present-continuous, system-as-narrator, no exclamation marks, no progress percentages. The user reads the line, knows what the system is doing, knows roughly how much further it has to go. The line tells them: *the system is alive, here, working on this specific thing.*

**First surface to design against this principle:** the Get Inspired modal's running state — the third state alongside empty (CTA disabled) and filled (CTA enabled). Today the modal has no running state; tapping the CTA in production will go from filled → result with no narration. That gap needs a designed sequence (fetching the URL, identifying the skill, building the plan, surfacing the result) and the narration vocabulary to render it.

**Where else this applies (non-exhaustive):** AI synthesis on Concept detail's resynthesize action, AI clustering on Debrief's "A pattern in your captures" offer, weather-fetch on Race Prep's forecast tiles, prior-debrief query on Race Prep's "From your last race" stack, concept-suggestion service on Race Prep's "From your playbook" coral card, Competency Assessment's AI capture surfacing.

### Error-state principle

Every error surfaces in **plain language with a next action**. No error codes. No `"Something went wrong"` dead-ends. No technical jargon (no `"Failed to fetch"`, no HTTP status numbers, no stack traces).

**Pattern:** state what happened in human terms + offer the next thing the user can do.

**Examples of the pattern (illustrative, not specified copy):**
- ❌ "Error 503: Service Unavailable"
- ✅ "The weather service isn't responding right now. Skip the forecast and come back later, or check in a few minutes."

- ❌ "Failed to load concept"
- ✅ "This concept isn't in your Sail Racing playbook. Switch to the playbook it belongs to, or open a different one."

- ❌ "Something went wrong"
- ✅ "Couldn't save your reflection just now — we kept what you wrote. Try saving again, or take a screenshot as backup."

The next action is non-negotiable. "Try again" counts when it's actually likely to help; it doesn't count when the failure is structural (auth missing, wrong account, network down for hours). When "try again" wouldn't fix it, the next action has to be specific — switch interest, open a different step, contact support, restart the app.

**Visual treatment:** errors use the iOS register's coral-tint marked-content card chrome by default (same component family as the AI prompt card, since errors are *system-surfaced content requiring attention*). Severity scaling can be a follow-up if/when an error needs blocking treatment.

**Where this applies:** any failure path — auth, network, data validation, AI service errors, payment, share/invite flows, anywhere a request can fail or return empty. Audit existing error surfaces against this principle as a separate pass; new surfaces are designed to it from the start.

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

## Resolved register decision (2026-05-15) — Summary vs detail surfaces

**Rule:** level-of-detail surfaces get separate designs, not scaled-down versions of each other. Summary surfaces do navigation; detail surfaces do action. Cards, list items, and shelf entries are summaries. Open-step views, modal sheets, and full-page surfaces are details. These are different jobs and deserve different designs.

**Where this came from:** the Race Prep cutover question. The iOS register Race Prep design is a 393pt-wide full-screen surface (beat cards, forecast tiles, composer, crew list). The existing `RaceSummaryCard.tsx` renders the same step's content *inline inside a timeline grid card* at ~200pt width. Three options were considered:

1. **Scale the iOS register down into cards** — would break the design's intent (composer + crew list + forecast tiles don't scale down).
2. **Cards stay legacy, detail cuts over** — leaves a register seam between the same step's summary and detail views.
3. **Redesign the cards view as its own iOS register surface** — *picked*. The cards view is a summary surface and deserves a summary design, not a miniaturized detail.

**Practical implication for the rest of the migration:**
- Race Prep cutover is parked until the cards-view iOS design lands. When it does, both surfaces cut over together: `StepDetailContent` → iOS register full-surface; `RaceSummaryCard` → new card-summary iOS variant.
- Future register decisions follow the same rule. If a list item or shelf entry needs an iOS register treatment, it gets its own design — never a shrunk version of the full-screen surface it links to.

**The principle generalized:** "show less, with intent" is design work. "Show the same thing smaller" is engineering work. Summary surfaces are show-less-with-intent. Don't engineer-shrink them.

---

## Claude Design handoff backlog (2026-05-15)

Surfaces blocked on these design handoffs before their cutover can resume:

| Handoff needed | Blocks |
|---|---|
| Race Log iOS | Reflect home cutover (option 2 — full tab replacement without functionality regression) |
| Profile iOS | Reflect home cutover |
| Discover-Orgs iOS | Discover tab cutover |
| Discover-People iOS | Discover tab cutover |
| Discover-Forums iOS | Discover tab cutover |
| ~~Race Prep cards iOS / timeline-grid summary iOS~~ | ~~Race Prep cutover (StepDetailContent + RaceSummaryCard together)~~ ✅ **Shipped 2026-05-15** — Race Prep cards iOS handoff landed; cards-grid cutover live behind `RACE_PREP_IOS_REGISTER` |

Five design handoffs still outstanding. The Race Prep cards handoff arrived 2026-05-15 and the cards-grid cutover shipped that day (see follow-up #11 for the remaining `/step/[id]` vs `/race/ios/[stepId]` detail-surface question, and follow-up #12 for inline-action affordances on the new summary surface). All other blocked-cutover surfaces remain reachable via their preview routes (`/reflect-ios`, `/discover-ios`) for review and testing; cutover commits resume once their respective design handoffs arrive.

---

## Resolved register decisions (2026-05-15) — Faculty surfaces

The 12th iOS surface (Competency Assessment, faculty-facing) baked in two register-level decisions that apply across any future faculty/preceptor/coach UI work.

### Decision A — Faculty-surface density calibration

Faculty surfaces and practitioner surfaces share the iOS register (same gray 6 ground, white 16px cards, SF Pro, two accents) but **information density is calibrated differently per user role**.

| Treatment | Practitioner surface | Faculty surface |
|---|---|---|
| Card-stack gap | 24px (room to think) | **12px** (throughput) |
| Section eyebrow padding | `32px 20px 12px` | **`4px 20px 12px`** (tighter) |
| Meta lines | wrapped across multiple rows | **inline** with separator dots |
| Title-block bottom padding | 24–32px | **22px** (compressed) |
| Title size | 32pt regular | **28pt regular** (one notch down) |

**Why:** practitioners are *composing* (Race Prep, Debrief, Concept detail, Playbook) — breathing room serves the act. Faculty are *grading* — working through a rubric, completing one step's review in one sitting, then moving to the next student's step. They need throughput. The calibration is the surface designer's call, not a token-level switch — same `IOS_REGISTER` tokens, different layout choices.

**When to apply:** any surface whose primary user is a path author, preceptor, coach, or institutional reviewer rather than the practitioner whose step it is. Competency Assessment is the first; future faculty surfaces (cohort overview, author dashboard, preceptor sign-off, rotation summary) inherit the same density rule.

### Decision B — Earned register exception: the rating segmented control

The four-state segmented control on the Competency Assessment card is **44px tall with semibold active label**, vs the iOS-default 32px regular used everywhere else in the kit. This is the only iOS register surface that violates the segmented-control default.

**Why earned:** the segmented control carries the grading decision — the single most consequential interaction on the surface, and the artifact's payload. A 32px control is the right size for switching views (Read/Work on Concept iOS) or filtering (Reflect three-tab). A 44px control with semibold active text is the right size for *deciding*. The active state needs to read as a commitment, not a selection.

**The rule for future exceptions:** size up the segmented control only when (a) the action it carries is irreversible-or-near-irreversible without re-entry, AND (b) the surface's primary purpose IS that decision. Don't size up to draw attention; size up to acknowledge stakes. Most segmented controls remain 32px regular.

This is the only exception in the kit. New surfaces should not add others without a comparable case.

---

## Resolved architecture decision (2026-05-14) — Playbook home scope

**Question that surfaced during Phase 5a:** the existing Playbook home has eight first-order sections (This Week's Focus / Vision / Ask your Playbook / Concepts-Resources-Patterns-Reviews-Q&A counters / Recent sessions / Suggestions queue / Raw Inbox / Shared with / Inherited from). The Claude Design's iOS register version simplifies to four (Vision / Concept shelf / Recent reflections / title block). Do the missing six survive the cutover by moving deeper, or do they stay at home?

**Decision: match the design. The existing Playbook home over-stuffs the surface, and the iOS register strips it back to the Apple Books library treatment.**

| Section in existing Playbook home | Status in iOS register |
|---|---|
| Title block (Playbook · Sail Racing) | Kept — Books "Library" treatment |
| Vision card | Kept — frontispiece |
| Working-on-this-season concept shelf | Kept — Books-spine horizontal scroll |
| Recent reflections (3 entries) | Kept — capture-card grammar |
| THIS WEEK'S FOCUS card | **Moved** to a deeper Reviews/Focus surface |
| Ask your Playbook | **Moved** to a search/query affordance on the deeper search screen |
| Concepts / Resources / Patterns / Reviews / Q&A counter tabs | **Moved** to a deeper section-navigator (the shelf IS the concepts; the others live one tap away) |
| Recent sessions feed | **Folded into** Recent reflections; the iOS register doesn't separate "session that fed playbook" from "reflection that came out of it" |
| Suggestions queue (Weekly Review / Focus) | **Moved** to a deeper inbox or surfaces inline (TBD) |
| Raw Inbox | **Moved** to a deeper inbox screen — explicitly named in the spec as a private, processable area |
| Shared with | **Moved** to a settings/sharing screen |
| Inherited from | **Moved** to a path-relationship screen |

**Why the simplification:**
- The Books anchor only works if the home reads as a library, not a control panel. Eight sections at home defeats the reference.
- "Where his playbook is moving" should be visible without scrolling. The breakthrough coral wash on the concept shelf does that work in three cards; the counters + suggestions + inbox dilute that signal.
- The missing six sections aren't deleted — they're load-bearing, just relocated. Each gets its own screen (or its own tap-target) at the next layer of depth.

**Implication for engineering:** at cutover, the existing PlaybookHome.tsx loses ~80% of its rendered surface. The components that disappear from home (ThisWeekFocusCard, AskYourPlaybook, SuggestionsBar, sidebar QueuedSuggestionsPreview, WeeklyReviewsPreview, RecentDebriefs, SectionTabs) either retire or move into deeper screens. Worth a deletion audit before the cutover commit.

---

## Verification plan

This is a planning artifact only. Verification once implementation begins:
- After Phase 0: `npm run typecheck` clean; no consumers of `text.serifTitle` etc. break (or are aliased).
- After Phase 1: visual diff on Session / Playbook / Discover / Reflect tab headers; segmented control on Reflect sub-tabs renders blue.
- After Phase 2: dev-sandbox route `app/dev/ios-register-kit.tsx` renders all 8 new components; pixel-compare against the HTML reference in a browser at viewport 393×852.
- After Phase 3: Race Prep step detail in iOS sim matches the design file's beat structure + composer + crew list; user-authored rule renders inside Contingency.
- After Phase 4: visual regression check that the 14 prior-commit surfaces still read coherently with the new chrome.

---

## Surface inventory — 12 iOS register previews shipped (Phases 0–5)

All twelve Claude Design handoff surfaces have a preview route built and reachable. The index at `/dev/ios-previews` lists every surface with template paths.

| # | Surface | Route | Type | User | Wire-up |
|---|---|---|---|---|---|
| 1 | Race Prep — detail | `/race/ios/[stepId]` | re-skin existing | practitioner | step + plan_data + collaborators + competencies + prior debrief quotes |
| 1b | Race Prep — cards (summary) | renders in `app/(tabs)/races.tsx` behind `RACE_PREP_IOS_REGISTER` | fresh-build summary surface | practitioner | **cutover shipped 2026-05-15** — `filteredCardGridRaces` adapted into `RaceCardItem[]`, tap-through to `/race/ios/[stepId]` |
| 2 | On the Water | `/race/ios/water/[stepId]` | fresh-build | practitioner | observations + media_uploads (reverse chronological) |
| 3 | Debrief | `/race/ios/debrief/[stepId]` | re-skin (architectural shift to chrono stack) | practitioner | observations + media_uploads (chronological) |
| 4 | Playbook home | `/playbook-ios` | re-skin (simplified per decision) | practitioner | manifesto + concepts + recent reflections + inbox count badge |
| 5 | Concept detail (Read mode) | `/concept-ios/[slug]` | re-skin existing | practitioner | concept body_md + reflection trail (oldest tagged as "first written") |
| 6 | Reflect home | `/reflect-ios` | re-skin existing | practitioner | moments returned to wired; arc + thinking-shifted placeholder |
| 7 | Discover Paths | `/discover-ios` | re-skin existing | practitioner | placeholder catalog content (real catalog API not wired) |
| 8 | Get Inspired modal | `/get-inspired-ios` | fresh-build | practitioner | visual-only (analyze/build-plan pipeline deferred) |
| 9 | Trophy of Becoming | `/trophy-ios` | fresh-build | practitioner | placeholder (path-completion synthesis service deferred) |
| 10 | Step transition hinge | `/hinge-ios` | fresh-build | practitioner | placeholder tiles (adjacent-step detection deferred) |
| 11 | Auth Welcome | `/auth-welcome-ios` | fresh-build (pre-auth) | n/a | static (no auth wiring — visual only) |
| 12 | **Competency Assessment** | `/competency-assessment-ios/[stepId]` | **fresh-build (faculty)** | **faculty** | step.title + completed_at + capture count; competency list, AI capture surfacing, submit flow deferred |

### Entry points
- Step surfaces: ⋮ overflow menu on any timeline-step card (Preview iOS · Race Prep / On the Water / Debrief)
- Playbook home: toolbar capsule top-right on Playbook tab (✦ wand-and-stars)
- Reflect home: toolbar capsule top-right on Reflect tab (✦ wand-and-stars)
- Discover Paths: toolbar capsule top-right on Discover tab (✦ wand-and-stars)
- Concept detail: tap any concept card on Playbook iOS shelf
- Index (all 11): `/dev/ios-previews` — direct deep link

### Component kit summary

`components/ios-register/` houses 15 presentational components used across the 12 previews + the Race Prep cards canonical summary:

| Component | Used by |
|---|---|
| `BeatCard` + `BeatBody` | Race Prep |
| `CoralAIPromptCard` (blue / coral accent variants) | Race Prep, Debrief |
| `CrewList` | Race Prep |
| `ForecastTileGroup` | Race Prep |
| `PermissionRuleCallout` (inline / pinned variants) | Race Prep, On the Water |
| `QuoteCard` | Race Prep |
| `SourceGlyph` (voice / note / ai variants) | Race Prep, Debrief, Playbook, Concept, Reflect |
| `ToolbarComposer` | Race Prep |
| `WorkingOnPill` | Race Prep |
| `CaptureCard` | Debrief |
| `AtmosphericBackground` | On the Water |
| `LogEntry` | On the Water |
| `HeroMicComposer` | On the Water |
| `ConceptCard` | Playbook |
| `ReflectionCard` (origin tag variant) | Playbook, Concept, Reflect |
| `StepCard` (4 status variants + earned-exception current) | Race Prep cards |
| `RaceCardsScreen` (title block + arc bar + horizontal scroller + across-the-arc summary) | Race Prep cards |

All components consume `IOS_REGISTER` colors and `IOS_REGISTER_TEXT` recipes from `lib/design-tokens-ios.ts` (Phase 0 foundation).

---

## What's left before cutover

The visual pass is done. Eight follow-ups (listed earlier) are real data-layer + architectural work that the visual pass intentionally deferred. In priority order for cutover:

1. **Competency Assessment surface** — the form-based artifact that splits from Debrief. Faculty-facing primary. Highest-priority because the existing After tab's form-based prompts can't retire until this lands.
2. **Per-user concept state schema** — `practicing / learning / breakthrough` per concept per user. Powers ConceptCard state pills, Concept detail state pill, Race Prep WorkingOnPill state.
3. **Concept ↔ step association** — surfaces the live-dot signal ("concept active in current step") and powers the per-concept reflection trail on Concept detail.
4. **Weather service integration** — wires real conditions into ForecastTileGroup. Sailing-specific labels; per-interest mapping for clinical / drawing.
5. **Prior-debrief quote query** — first-class field (`review_data.standout_quotes`) so the "From your last race" stack stops relying on text-shortening heuristics.
6. **Concept-suggestion service** — powers the inline "FROM YOUR PLAYBOOK" coral AI prompt on Race Prep.
7. **`step_rules` schema** — the user-authored Contingency rule needs a real data model. Currently placeholder text on Race Prep + On the Water.
8. **Per-interest beat name mapping** — clinical (Briefing / Shift / Debrief) and other interest vocabularies. Currently sailing-only hardcoded.
9. **Authoring flow for prose beats** — the open architectural question. Where does the user *write* `what` / `why` in the new register? Likely the bottom toolbar composer + AI placement, but needs a design.
10. **Reflection-usage tracking** — powers Reflect home's "moments returned to" return-count badges with real data instead of placeholder counts.

At cutover, the existing PlaybookHome.tsx loses ~80% of its rendered surface (decision documented above). Components that disappear from home: ThisWeekFocusCard, AskYourPlaybook, SuggestionsBar, QueuedSuggestionsPreview, WeeklyReviewsPreview, RecentDebriefs, SectionTabs. Run a deletion audit before the cutover commit.

The existing form-shaped After tab retires when the chrono-stack Debrief becomes canonical (decision documented above). The Competency Assessment surface (#1 above) is the prerequisite.

---

## Final action on ExitPlanMode approval

Write this same content to `docs/redesign/IOS_MIGRATION_PLAN.md`. No other code changes in this pass — implementation waits for the user's review of the plan.
