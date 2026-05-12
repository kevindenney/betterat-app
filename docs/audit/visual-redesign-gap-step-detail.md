# Visual Redesign Gap — Step Detail

**Status**: written gap analysis, no code changes
**Generated**: 2026-05-13
**Source mockups**: `docs/redesign/mockups/01,02,06,11,14,15_*.html`
**Source spec**: `docs/redesign/betterat-redesign-spec.md` (§4, §5, §10.2, §11, §11.6, §18) and `docs/redesign/addendum-2026-05-12-bot-architecture.md` (§2)

This audit focuses on the step detail surface (header, tabs, prompt blocks) and the surrounding chrome that frames it. It does **not** cover landing/marketing, onboarding flows, dashboards, or non-step surfaces — those need their own audits.

---

## 1. Current state

### 1.1 Tab navigation (5 tabs incl. Learn)

`lib/navigation-config.ts:113,148` and the legacy sailor primary list at `lib/navigation-config.ts:174-179` both ship 5 tabs:

```
{ name: 'races', title: <vocab>, icon: 'flag-outline' }
{ name: 'playbook', title: 'Playbook', icon: 'book-outline' }
{ name: 'discover', title: 'Discover', icon: 'compass-outline' }
{ name: 'learn', title: 'Learn', icon: 'school-outline' }     ← target spec drops this
{ name: 'reflect', title: 'Reflect', icon: 'stats-chart-outline' }
```

The Learn slot is wired into:
- `app/(tabs)/_layout.tsx:40-52,546-563` (TAB_SWEEP includes `'learn'`)
- `app/(tabs)/learn.tsx` + `app/(tabs)/learn/` route folder
- `lib/navigation-config.ts:177` (sailor sidebar nav)
- Tour copy at `app/(tabs)/_layout.tsx:70-73`

### 1.2 Step detail header + tabs

`components/step/StepDetailContent.tsx` is the single render path for both card and detail (post Step Arch D/E migration).

- Title input: `fontSize: 24, fontWeight: '700'` in default system sans (`StepDetailContent.tsx:997-1006`).
- Tab control: `IOSPillTabs` from `components/ui/ios/IOSPillTabs.tsx`. Default accent is `IOS_COLORS.systemBlue` (`#007AFF`, dark `#0A84FF` — `IOSPillTabs.tsx:150`, `lib/design-tokens-ios.ts:23,72`). Pill background uses `systemGray6`. Selected pill is filled with system blue.
- Step page background: `STEP_COLORS.pageBg = '#F5F4F1'` (warm cream — already close to target's `#FAFAF7`). Card background is white.
- Accent: `STEP_COLORS.accent = '#3D8A5A'` (forest green). Used on tab selected bg, complete state, badge bg/text, collaborator banner (`step-theme.ts:14-44`, `StepDetailContent.tsx:1045-1054`).
- Default tab labels (post Step Arch D rename): `{ plan: 'Before', act: 'During', review: 'After' }` (`lib/step-category-config.ts:42`).

### 1.3 Step labels by category

`lib/step-category-config.ts` ships 7 category configs plus a default. Status today:

| Category          | tabs.plan | tabs.act | tabs.review | Matches mockup? |
|-------------------|-----------|----------|-------------|-----------------|
| DEFAULT           | Before    | During   | After       | yes             |
| STRENGTH          | Before    | During   | After       | yes             |
| CARDIO            | Before    | During   | After       | yes             |
| HIIT              | Before    | During   | After       | yes             |
| SPORT             | Before    | During   | After       | yes             |
| NUTRITION         | Plan      | Log      | Review      | intentional override |
| RACE_DAY_CHECK    | Prep      | Check    | Debrief     | intentional override |
| READING           | Plan      | Read     | Review      | intentional override |

The reading/nutrition/race-day overrides are domain-specific verbs the mockups don't contradict. Sailing's per-interest vocabulary (`lib/vocabulary.ts:30-47`) renders the tabs as **Race Prep / On the Water / Debrief**, which matches the spec's "voice belongs to the practice" principle.

### 1.4 Typography

- `lib/design-tokens.ts:94-111` defines `typography.fontSize` and `typography.fontWeight` only; **no `fontFamily` field anywhere**. Components rely on platform-default system sans (SF Pro on iOS, Roboto on Android, system-ui on web).
- `grep -r 'fontFamily' components/step/` and `lib/step*` returns zero matches for serif faces.
- Step title (24px, bold sans) vs mockup target: 28–30px serif Lyon Display / Iowan Old Style, weight 500, letter-spacing -0.01 to -0.015em (`mockups 01,02,11`).
- Body prose, reflection, preceptor quotes, "What I take from today" — all rendered as plain sans `<Text>` today. Mockups call for serif 17–20px line-height 1.5–1.55 for any first-person voice.

### 1.5 Color usage on step surfaces

- Forest green accent (`#3D8A5A`) — `STEP_COLORS.accent`, used on the IOSPillTabs selected-tab fill via `accentColor` prop and on completion/badge surfaces.
- iOS system blue (`#007AFF`) — default `IOSPillTabs` accent; also `IOS_COLORS.systemPurple` is used for AI sparkle treatments and lesson/course banners (`StepPlanQuestions.tsx:796,873,908,911,921`).
- Project-wide `colors.primary = '#2563EB'` (Ocean Blue) in `lib/design-tokens.ts:13` — the default action color across dashboards and non-step surfaces.
- Mockup palette is entirely neutral. The only "color" is `#5A4078` (deep violet) used as a single info accent on "You" avatars. No green, no blue, no red anywhere.

### 1.6 Prompt copy + section labels

`lib/step-category-config.ts:43-49` default questions:

```
what:  "What will you do?"
how:   "How will you do it?"
why:   "Why is this next?"
who:   "Who will you do this with?"
where: "Where will you do this?"
```

Mockup 06 ("planning composition") uses **lowercase eyebrow tokens** rendered in tertiary tan (`#8A8478`, letter-spacing 0.04em), with the values themselves rendered in serif 16–17px:

```
What           → "Lead nurse, first thirty minutes…"
Why            → "After Tuesday I want a higher-acuity setting…"
Building toward → competency chips
How            → checklist items
Who / Where    → tiny side-by-side stacks
```

Section labels in StepCritiqueContent (`components/step/StepCritiqueContent.tsx:9-13`):

```
"What went well?"  (green thumbs-up prompt)
"What to improve?" (coral target prompt)
"AI Feedback"      (session analysis card with suggestion pill)
```

Five canonical review prompts already in the selector (Step Arch D shipped) and rendered via `ReviewPromptSection`. The five `REVIEW_PROMPTS` are present, but the **section copy and label tone are not first-person serif yet** — they're third-person headings with iconography.

### 1.7 "AI Coach" framing — where it lives

Step-detail-adjacent:
- `components/step/StepPlanQuestions.tsx:785,867,879,922` — "Chat with AI Coach", "AI Coach", manual fields toggle
- `components/step/ConversationalCapture.tsx:292` — header titled "AI Coach"
- `components/step/StepCritiqueContent.tsx:11` — "AI Feedback — session analysis card with suggestion pill" (header copy)

Broader surfaces (out of step-detail scope but visible to the same user):
- `components/dashboard/AICoachCard.tsx` — entire component branded "AI Coach Analysis"
- `components/races/PrimaryAICoach.tsx` — entire chat surface branded "AI Coach"
- `app/(tabs)/race/timer.tsx:387,549,689,797,810,956,959,1073,1080` — "AI Coach has analyzed your race", "sender: 'AI Coach'", "AI Coach Feedback"
- `app/(tabs)/reflect.tsx:207` — "AI Coaching Insight"
- `app/race-analysis.tsx:83,302` — "AI Coach Analysis" header + tab
- `app/race-timer-pro.tsx:297,643,760,767` — "AI Coach" sender + headers
- `app/onboarding/pricing.tsx:128` — "AI Coaching & Suggestions" pricing line
- `app/coach/client/[id].tsx:283` — "AI Coaching Highlights"
- `constants/designSystem.ts:451,734` — design system documents "Ask AI Coach" patterns

### 1.8 Status filter chips

`components/step/StepFilterBar.tsx:45-50` — already shipped: All / Before / During / Done. Matches target.

---

## 2. Target state (from mockups + spec)

### 2.1 Navigation

Four tabs, in order: **Race** (vocabulary-resolved) · **Playbook** · **Discover** · **Reflect**. Learn is removed entirely — its purpose (browsing tactical courses) folds into Playbook + Discover (spec §4, decision #10 §18).

### 2.2 Step detail header

- Eyebrow ("Today's clinical", "Saturday · yesterday", "Coming up", "In three days · Friday") — sans 12–13px tertiary tan with 0.02–0.04em letter-spacing.
- Page-level meta ("Adult-Gero CNS · week 4") right-aligned in tertiary tan.
- H1 title — serif 28–30px, weight 500, letter-spacing -0.01 to -0.015em, line-height 1.15–1.2.
- Sub-meta ("Mt. Washington · 8 am – 4 pm · 6 observations") — sans 13–14px tertiary tan.
- Tab control — plain text labels with bottom underline on active, no pill fill. Sans 13–14px, weight 500 on active, color shift to primary (`#2A2824`), inactive stays tertiary tan (`#8A8478`).

### 2.3 Step detail body (Before / During / After)

- **Before** (mockup 06): lowercase eyebrows ("What", "Why", "Building toward", "How", "Who", "Where") in tertiary tan; values in serif 16–17px primary; sub-step checklist with `ti ti-square` icons; competency pills with status caption; "from playbook" jump links.
- **During** (mockups 01, 14): large camera/microphone hold-to-speak CTA in a soft-bordered card on warm-white card bg. Timeline of captures below with "10:14 am · photo" tertiary timestamps and serif 14–15px captured text. Past-similar surface inline ("From last time you raced in this …") in info-secondary bg.
- **After** (mockups 02, 11, 15): "What I take from today" / "What I take from yesterday" rendered as **serif 18–20px first-person paragraphs**, weight 400, line-height 1.5–1.55. Preceptor/crew notes in italic 15px serif inside a left-bordered card. Skill progression rows with sparkline svgs, no charts. "From your own past" surface as a small italic-quote card, "From Mihkel" as a small serif 18px reply block.

### 2.4 Color palette (all from mockup `:root`)

| Token                       | Value      | Use                                  |
|-----------------------------|------------|--------------------------------------|
| `--color-background-primary`| `#FAFAF7`  | page + card surfaces                 |
| `--color-background-secondary`| `#F0EEE8`| panel bg, mock card bg               |
| `--color-background-info`   | `#E5E1F0`  | "You" avatar, "from playbook" tile   |
| `--color-text-primary`      | `#2A2824`  | titles, primary text, dark CTA bg    |
| `--color-text-secondary`    | `#58544A`  | sub-meta, status                     |
| `--color-text-tertiary`     | `#8A8478`  | eyebrows, timestamps                 |
| `--color-text-info`         | `#5A4078`  | "You" avatar text, playbook accent   |
| `--color-border-secondary`  | `#C8C2B4`  | button borders, secondary outlines   |
| `--color-border-tertiary`   | `#DDD8CA`  | hairlines, dividers                  |

Notable absences: no blue, no green, no red, no system colors. Primary action = `#2A2824` background, `#FAFAF7` text (mockup 15 "Track it" button, mockup 02 implicit).

### 2.5 Typography

- **Serif (first-person voice)**: `'Lyon Display', 'Iowan Old Style', Georgia, serif` — Iowan Old Style is iOS-bundled, NY/New York is also a viable system-available fallback.
- **Sans (chrome)**: `'Söhne', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif` — SF Pro Text on iOS is the system fallback; on web Söhne is licensed or fall through to system.
- Letter-spacing: titles use slight negative tracking (-0.01 to -0.015em); eyebrows use loose positive tracking (0.04–0.06em).
- No font-weight above 500. Bold is not used.

### 2.6 Tone + AI framing

Spec §10.2 + decisions §18 #14:
- AI never speaks as itself. No bubble, no name, no avatar, no "Hi I'm your AI coach" framing.
- AI emissions appear as **ambient surfaces**: "Pulled from your last voice note. Tap to correct." (mockup 14), "Suggested as a capability worth tracking. You've mentioned mark roundings three times since March." (mockup 15).
- Voice is the primary input on During. Capture button is a microphone hold-to-speak, with camera/note as long-press alternates.

---

## 3. Gap analysis

### 3.1 Typography gap — **largest gap, touches every step view**

No serif fonts anywhere in the codebase. The current step detail renders titles and reflection prose as bold sans, which directly contradicts the redesign's "serif for first-person voice" thesis. This is not a token tweak — it requires:

1. Adding a `fontFamily` axis to `lib/design-tokens.ts` (currently absent).
2. Loading or selecting fonts: Lyon Display is a paid Commercial Type face, so initial migration almost certainly ships Iowan Old Style (iOS bundled) + Georgia (web/Android fallback) for serif, and SF Pro / system-ui for sans.
3. Updating ~40 inline `<Text style={{ fontSize: N, fontWeight: '...' }}>` call sites in `StepDetailContent.tsx`, `StepCritiqueContent.tsx`, `StepPlanQuestions.tsx`, and `PlanTab.tsx` to route through a typed `text.serifTitle / text.serifBody / text.sansEyebrow / text.sansMeta` token set.

Letter-spacing is also not used today. Mockup tracking values are precise enough that they should be tokenized rather than re-derived.

### 3.2 Color gap

The step detail forest green (`#3D8A5A`) and the project-wide ocean blue (`#2563EB`) both need to be removed from primary step surfaces. Concretely:

- `lib/step-theme.ts` — replace `accent`, `accentLight`, `accentMedium`, `tabSelectedBg`, `tabSelectedText`, `badgeBg`, `badgeText` with the warm-charcoal-on-cream tokens. Forest green disappears from the step surface.
- `components/ui/ios/IOSPillTabs.tsx` — call sites that render the Before/During/After picker should pass `accentColor={STEP_COLORS.label}` (or pass an `unstyled` flag and render a plain text-with-underline picker per mockup 01 line 81). System blue does not belong on these tabs.
- AI sparkle treatments using `IOS_COLORS.systemPurple` in `StepPlanQuestions.tsx` lose the purple accent — the new info violet `#5A4078` is for avatars and "from playbook" surfaces, not for AI buttons (because AI no longer brands itself; see §3.4).

`lib/design-tokens.ts` itself defines an "Ocean Blue Theme" rooted in `colors.primary = '#2563EB'`. This is consumed by many surfaces beyond the step view. **Not in scope for this audit**, but flagged: the redesign needs a second pass for dashboards, landing, onboarding.

### 3.3 Copy / tone gap

The current step detail uses imperative or third-person framing:

- "What will you do?" / "Why is this next?" / "How will you do it?"
- "What went well?" / "What to improve?"
- Action labels like "Save Review", "Share with Coach", "Save for later".

Mockups model the user's own first-person serif paragraphs. The tab body should host the user's writing, not interrogate them. Concretely:

- Eyebrow tokens (sans, tertiary, lowercase, letter-spaced 0.04em): `What`, `Why`, `Building toward`, `How`, `Who`, `Where`.
- The serif-rendered field below an eyebrow is the user's *answer*, not a placeholder question.
- Empty-state placeholders should be in the user's voice: "Lead nurse, first thirty minutes. Four-patient sim, rapid prioritization." style.
- Critique section headers: replace "What went well? / What to improve?" with the canonical 5-prompt order already in `lib/step/getReviewSections.ts` (`what_happened`, `what_worked`, `what_didnt`, `what_did_you_learn`, `anything_else`), rendered as serif 19px subheads per addendum §2.

### 3.4 Component framing gap — remove "AI Coach"

The mockups have zero AI persona. Step-detail-adjacent removals:

- `components/step/StepPlanQuestions.tsx:785,867,879,922` — change "Chat with AI Coach or fill in the fields below" to a neutral "Sketch what you want to do" or remove the chat-vs-form split entirely.
- `components/step/ConversationalCapture.tsx:292` — header titled "AI Coach" should disappear. The conversational input is just an input; no badge, no name.
- The AI sparkles button in `StepPlanQuestions.tsx:911-922` titled "AI Coach" inside refinementChat needs to become an ambient surface: "Pulled from your last voice note. Tap to correct." or vanish entirely.

Broader surfaces — flagged but out of scope for the step-detail audit:
- `components/dashboard/AICoachCard.tsx`, `components/races/PrimaryAICoach.tsx`, `app/race-analysis.tsx`, `app/race-timer-pro.tsx`, `app/onboarding/pricing.tsx` — all carry the persona and will need their own removal audit.

### 3.5 Information architecture gap

Drop Learn from the tab bar:

- Remove tab entry in `lib/navigation-config.ts:113,148,177`.
- Remove tab screen registration in `app/(tabs)/_layout.tsx:546-563`.
- Remove the tab-sweep entries at `app/(tabs)/_layout.tsx:40-77` for `'learn'`.
- Decide fate of `app/(tabs)/learn.tsx` + `app/(tabs)/learn/` route folder. Suggest keeping them addressable (deep links from Playbook continue to work) but absent from the tab bar.
- The 4-tab order is **Race · Playbook · Discover · Reflect**, dropping the middle Learn slot.

---

## 4. Proposed migration sequence

Six independently shippable commits, in order. Each leaves the app fully functional.

### Commit 1 — Type tokens + font registration (foundation)

- Add `fontFamily: { serif, sans }` to `lib/design-tokens.ts`.
- Add typed text recipes: `text.serifTitle`, `text.serifBody`, `text.serifMeta`, `text.sansEyebrow`, `text.sansLabel`, `text.sansMeta` — one place to define size + weight + letterSpacing + family.
- Add neutral palette tokens to `lib/step-theme.ts`: `pageBg → #FAFAF7`, `cardBg → #FAFAF7`, `panelBg → #F0EEE8`, `infoBg → #E5E1F0`, `infoText → #5A4078`, `textPrimary → #2A2824`, `textSecondary → #58544A`, `textTertiary → #8A8478`, `borderHairline → #DDD8CA`, `borderSecondary → #C8C2B4`. Keep the old `accent`/`coral` keys deprecated but referenced for one transition release.
- On iOS, set serif default to `Iowan Old Style`. On web, fall through to `Iowan Old Style, Georgia, serif`. On Android, fall through to `Georgia, serif`.
- Zero behavioral change. Visible diff: none.

### Commit 2 — Drop Learn tab

- Remove `learn` from `lib/navigation-config.ts:113,148,174-179`.
- Remove the tab registration + tab-sweep entry in `app/(tabs)/_layout.tsx`.
- Keep `app/(tabs)/learn.tsx` and the `learn/` folder for now (addressable via deep links from Playbook).
- Update WelcomeCard / tour copy that references Learn (`app/(tabs)/_layout.tsx:70-73`).
- Visible diff: 4 tabs instead of 5.

### Commit 3 — Step detail header → serif + neutral palette

- Update `StepDetailContent.tsx:997-1006` titleInput style to use `text.serifTitle` (28px serif, weight 500, letter-spacing -0.01em).
- Update tab control rendering to use plain text + underline pattern per mockups 01/02/06 instead of `IOSPillTabs` filled pills, OR pass neutral `accentColor={textPrimary}` to keep the pill component for now.
- Replace `STEP_COLORS.pageBg` usages with the new `#FAFAF7` token.
- Replace `STEP_COLORS.accent` (forest green) usages — collaborator banner, complete dot, badge — with `textPrimary` (`#2A2824`) for active states and `textSecondary` for hover/secondary.
- Visible diff: step detail header looks like mockup 01/02 — serif title, plain text tabs, warm beige bg, no green.

### Commit 4 — Before tab (PlanTab) eyebrow + serif treatment

- Refactor `PlanTab.tsx` / `PlanQuestionCard.tsx` to render each question as `eyebrow + serif-answer` (mockup 06 pattern).
- Remove "AI Coach" framing in `StepPlanQuestions.tsx:785,867,879,922` and `ConversationalCapture.tsx:292`.
- Replace the conversational capture chat header with the bare input (no persona).
- Replace `IOS_COLORS.systemPurple` AI sparkle treatments with neutral inline ambient surfaces ("From your playbook ‣ Add").
- Visible diff: planning surface looks like mockup 06.

### Commit 5 — After tab (StepCritiqueContent) serif first-person rendering

- Convert the 5 `ReviewPromptSection` rows to:
  - Lowercase eyebrow above each block in tertiary tan.
  - Serif 19px first-person body for user prose; serif 15px italic for captured-from-bot quotes.
  - Drop "What went well? / What to improve?" labels in favor of canonical prompts (`REVIEW_PROMPT_LABELS`).
- Replace stars rating colors (`C.gold = '#D4A64A'`) with a neutral charcoal star scheme, or move rating out of the "After" main canvas into a side meta line.
- Replace `C.accent = '#3D8A5A'` (forest green) usages with neutral tokens.
- Visible diff: After tab looks like mockups 02 + 15.

### Commit 6 — During tab (ActTab) microphone-first capture

- Make the capture entry a single hold-to-speak microphone button (mockup 14) in a soft-bordered card.
- Render "So far today" timeline rows with serif 14px body + tertiary timestamp.
- If `From last time you raced in this` (similar-past-context surface) is feasible from existing data, render it inline as ambient AI (no badge).
- Visible diff: During tab looks like mockup 01 + 14.

After commit 6, the step detail surface matches the mockups. Adjacent surfaces (PrimaryAICoach, AICoachCard, race timer, race analysis, reflect insight, onboarding pricing) remain unchanged and need their own follow-up audit.

---

## 5. Open decisions (need user)

1. **Font licensing**. Lyon Display is paid (Commercial Type). Söhne is paid (Klim Type Foundry). Do we ship with system fallbacks (Iowan Old Style + SF Pro) for the initial migration, or block on licensing both?
2. **Spec/mockup contradictions to surface**:
   - Spec §11.6 says "no bright accents". Mockup 06 uses `#E5E1F0` (info lavender) and `#5A4078` (info violet) on "from playbook" and "You" avatar surfaces. Is that acceptable as "soft accent" or should it also fade?
   - Spec §4 lists tabs as Practice/Playbook/Discover/Reflect but the codebase ships the timeline route as `races` (sailing-era literal). Audit finding E5 already flagged this. Should the route literal rename happen in this redesign migration or stay deferred?
   - Mockup 01 uses `Before` tab default; mockup 06 ("Before" active) shows it as the planning state, but the on-water mockup 14 uses `During`. The sequence is consistent. The question: should we keep the sailing per-interest override "Race Prep / On the Water / Debrief" or move sailing too to Before/During/After? Current code keeps it sailing-specific (per Step Arch D locked decision); mockup 11 uses Before/During/After explicitly. **Spec and mockup disagree with current code on this.**
3. **Removing "AI Coach" persona on race timer / dashboard / pricing**. Is that in scope for this redesign push, or staged later? It will surprise users who currently see and use "AI Coach Feedback" mid-race.
4. **PrimaryAICoach component fate**. It is the main race-day chat surface. Removing the persona means rebranding the whole interaction model, not just a header.
5. **`design-tokens.ts colors.primary = '#2563EB'`**. Many non-step surfaces use this. Do we redefine `primary` to charcoal globally, or scope the redesign to step surfaces only for now?

---

## 6. Risks

- **Bold + ItalicSF Pro variants vs Iowan Old Style on RN**: `fontFamily` switching on `Text` in React Native requires the platform-default face is bundled. Iowan Old Style is iOS-bundled but Android needs Georgia or a downloaded asset. Need to test on Android emulator before commit 3 ships.
- **`IOSPillTabs` is used in many places**, not just step detail. If we pass a different `accentColor` per-call-site it stays compatible; if we replace the component, we touch many surfaces. Commit 3 should pass `accentColor` rather than replace.
- **Per-interest vocabulary still wins over DEFAULT_LABELS**. Sailing users see "Race Prep / On the Water / Debrief" today. The mockups (11) show Before/During/After even for the sailing race past mockup. If we keep the per-interest override, sailing users won't see the rename. Decision required (open decision #2 above).
- **Step Arch D snapshot tests**. `components/step/__tests__/StepCritiqueContent.snapshot.test.tsx` was added during Step D to lock the current rendering. Each redesign commit needs to update the snapshot intentionally; jest review must be thorough to avoid regressing the v2 sections rendering.
- **Removing Learn tab affects deep links and onboarding tour**. Tour step `tab_sweep` requires visiting Learn. Onboarding state in AsyncStorage may key off "learn" tab visit. Commit 2 needs to clean up tour copy and verify no AsyncStorage key references survive.
- **"AI Coach" copy is in pricing surface** (`app/onboarding/pricing.tsx:128`). Changing it midflight could break subscribers' mental model — keep the marketing/pricing copy decision linked with product side, not buried in a UI commit.
- **`constants/designSystem.ts:451,734`** documents "Ask AI Coach" as a sanctioned pattern. The design-system source-of-truth needs to be updated alongside, or new contributors will reintroduce the pattern.

---

## 7. Top 3 things to pay attention to when reviewing this audit

1. **Open decision #2 — sailing tabs**. The mockups show Before/During/After even for sailing (mockup 11), but Step Arch D locked the per-interest override "Race Prep / On the Water / Debrief". One of these decisions has to give. If we keep the override, sailing users — including you — see almost no visible diff from this entire redesign on race steps. If we drop the override, we contradict a locked migration decision and will need to confirm with the people who advocated for sailing-native vocabulary.
2. **The "AI Coach" persona is much bigger than step detail.** The audit's §1.7 and §3.4 enumerate 11 surfaces beyond step detail that brand themselves "AI Coach" — most prominently `PrimaryAICoach.tsx` (the in-race chat) and `AICoachCard.tsx` (the dashboard analysis card). Removing the persona only inside step detail will leave the app feeling schizophrenic. Decide upfront whether this redesign push owns those surfaces too or whether it ships a step-detail-only first slice that visibly contradicts the rest of the app.
3. **Font licensing + Android serif story.** Lyon Display and Söhne are both paid licenses. The audit recommends shipping system fallbacks (Iowan Old Style + SF Pro) for the initial migration — but Iowan Old Style is iOS-only. Android serif will render as Georgia, which is a noticeably different face. Verify whether that's acceptable, or whether we need to bundle a downloaded serif (Source Serif Pro, EB Garamond, or a licensed Lyon/Söhne) before commit 3 lands. This blocks visual sign-off, not engineering.
