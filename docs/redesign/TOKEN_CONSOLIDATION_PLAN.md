# Token Consolidation Plan (P-6)

**Status:** W1 DONE (commit `16c26065`, 2026-06-01) — `design-tokens.ts` retired,
serif/editorial recipes rehomed to `design-tokens-editorial.ts`, 9 imports
repointed, typecheck/lint clean. **W2 is no longer a standalone stream** — it is
folded into the per-surface register cutover (see §4 / §5 below).
**Goal:** Make `lib/design-tokens-ios.ts` the canonical spacing/visual scale,
retire `lib/design-tokens.ts` (✅ done), and normalize hardcoded off-grid values
to the 8pt grid (now part of the register cutover, not its own pass).

---

## TL;DR — the premise changed after measuring

The work item assumed retiring `design-tokens.ts` is risky because the two files
conflict (`spacing.md = 16` vs `IOS_SPACING.md = 12`) and repointing imports
would **shift some components by 4pt**. **That risk does not exist.** Census
result:

- Only **9 files** import `lib/design-tokens.ts` at all.
- All 9 import **only `text` and/or `fontFamily`** (the editorial serif/sans
  recipes). See table in §1.
- **Zero files** import the conflicting legacy `spacing` scale — nor `colors`,
  `borderRadius`, `shadows`, `typography`, `sailingTerms`, `touchTarget`, or
  `tufte`. Those exports are **dead code**.
- The `md:16 vs md:12` conflict is therefore **latent, not active** — nothing
  consumes the 16pt scale, so retiring the file shifts nothing.

This splits the work into two cleanly separable workstreams with very different
risk profiles:

| Workstream | What | Risk | Visual change |
| --- | --- | --- | --- |
| **W1 — Retire the file** ✅ DONE | Rehome `text`+`fontFamily`, delete dead exports, repoint 9 imports, delete `design-tokens.ts` | **Near-zero** | None (same recipe objects, new path) |
| **W2 — Normalize off-grid values** (now folded into register cutover) | Snap hardcoded 6/7/9/10/14/17/18/22 spacing+radius to the 8pt grid | **Real — needs eyes** | Yes, by design |

W1 is complete (commit `16c26065`). **W2 is no longer run as its own stream.**
The register cutover already goes surface-by-surface with eyes on every screen,
and snapping off-grid spacing to the 8pt grid is the same motion on the same
surfaces — so off-grid normalization is done *as part of* each surface's register
pass, not as a separate sweep. The mid-grid values (`6`/`10`/`14`) still need
per-surface before/after screenshots, **not** a codemod (see §4). The parked L1
`PhaseTabs` check folds into that cutover too. Font-size / type-scale
consolidation (`10.5`/`11`/`13.5`) remains a **separate future item** — out of
scope for both W1 and the register cutover.

---

## §1 — Importer census of `lib/design-tokens.ts`

Grep: `from '…/lib/design-tokens'` (closing quote excludes `-ios`). Both quote
styles, named + namespace imports checked. **9 importers, all editorial-only:**

| File | Imports |
| --- | --- |
| `app/social-notifications.tsx` | `fontFamily` |
| `components/cards/content/RaceSummaryCard.tsx` | `text` |
| `components/playbook/ThisWeekFocusCard.tsx` | `fontFamily` |
| `components/step/CaptureTimeline.tsx` | `fontFamily, text` |
| `components/step/ObservationLog.tsx` | `fontFamily` |
| `components/step/PastContextCard.tsx` | `fontFamily, text` |
| `components/step/PlanQuestionCard.tsx` | `text` |
| `components/step/ReviewPromptSection.tsx` | `text` |
| `components/step/StepDetailContent.tsx` | `text` |

**Symbols that move 4pt if repointed (the original worry):** none — no consumer.

**Dead exports in `design-tokens.ts` (zero importers → delete):**
`colors`, `spacing`, `borderRadius`, `shadows`, `typography`, `sailingTerms`,
`touchTarget`, `tufte`. (Verified: `import {spacing…}`=0, `import * as …`=0, and
all 52 `tufte` hits in the app resolve to the unrelated `@/lib/tufte` chart
module / `components/practice/tufte/*`, not this export.)

**Live exports to preserve:** `text`, `fontFamily` only.

Note: `design-tokens.ts:11` is `export * from './design-tokens-ios'`. No one
relies on getting `IOS_*` tokens *through* the old path (all 9 importers take
only `text`/`fontFamily`; the 528 `IOS_*` consumers import `-ios` directly), so
removing the re-export breaks nothing.

---

## §2 — Migration approach for W1 (retire the file)

`text` and `fontFamily` are **serif/editorial** recipes (Iowan Old Style serif +
Manrope sans, "first-person voice" per redesign spec §11). They deliberately
contradict the `-ios` doctrine ("SF Pro throughout — no serif"), so they should
**not** be folded into `design-tokens-ios.ts`. Two viable destinations:

- **(Recommended) New file `lib/design-tokens-editorial.ts`** holding `text` +
  `fontFamily` (and `fontFamily`'s `Platform.select`). Honest name, keeps the
  serif register as an explicit, separate concern from the canonical iOS scale.
  Repoint the 9 imports there. Delete `design-tokens.ts`. **Zero value change.**
- (Alt) Strip `design-tokens.ts` down to just `text`+`fontFamily`, delete the
  dead scales. Lowest churn (0 import edits) but leaves a misleadingly-named
  file and an `export *` re-export around — doesn't actually "retire" it. Not
  recommended; defeats the goal.

### One product decision to surface (does not block W1)
Is the serif "first-person voice" register still endorsed, or slated for
removal under the depersonification / SF-Pro direction? 
- If **kept**: rehome as above (zero risk). ← assume this unless told otherwise.
- If **being retired**: the 9 step/card surfaces should migrate from serif
  `text`/`fontFamily` to `IOS_REGISTER_TEXT` (SF Pro) — but that **is** a visual
  change needing eyes, and is a separate redesign task, not file-retirement
  plumbing. Keep it out of W1 either way.

---

## §3 — Surfaces that visibly shift when repointed (W1)

**None.** W1 changes import paths only; the `text`/`fontFamily` objects are
byte-identical at the new path. The 9 step/card surfaces render pixel-identical.
Verification is therefore typecheck + lint + a single confirming sim glance at
one serif surface (e.g. StepDetailContent), not a full visual sweep.

(The "4pt shift" surfaces the premise feared would live here — but there are
none, because the 16pt `spacing` scale has no consumers.)

---

## §4 — Off-grid normalization inventory (W2) — the eyes-on half

Canonical grids: `IOS_SPACING {4,8,12,16,20,24,32,40}`, `IOS_RADIUS
{4,8,12,16,20,24}`. Two dense offenders found so far (Practice timeline + Library
AllZone); a full repo inventory is part of W2 step 1.

### Practice — `components/ios-register/timeline-zoom/` (counts = occurrences)
| Value | Kind | Count | Nearest grid | Verdict |
| --- | --- | --- | --- | --- |
| `6` | gap / marginBottom / paddingV / paddingH | ~45 | 4 **or** 8 | ⚠️ FLAG — exactly mid-grid, most common value; up vs down changes density visibly |
| `10` | gap / paddingV / paddingB / marginT | ~40 | 8 **or** 12 | ⚠️ FLAG — mid-grid, pervasive |
| `14` | paddingH/V / marginB | ~30 | 12 **or** 16 | ⚠️ FLAG — card-ish padding, mid-grid |
| `18` | paddingHorizontal | ~11 | 16 **or** 20 | ⚠️ FLAG |
| `22` | padding | few | 20 **or** 24 | ⚠️ FLAG |
| `borderRadius:14` | radius | ~12 | 12 **or** 16 | ⚠️ FLAG |
| `7` | paddingH / gap | ~5 | 8 | ✅ snap up |
| `9` | — | few | 8 | ✅ snap |
| `5` | gap / paddingV | ~12 | 4 | ✅ snap down |
| `2` / `3` | marginT / paddingV / radius | many | keep (sub-grid micro) or →4 | hairline accents — likely keep |
| `borderRadius:999` | pill | ~20 | n/a | ✅ KEEP (intentional pill) |
| `borderRadius:2/3` | hairline | ~20 | n/a | likely KEEP |

### Library — `components/library/zones/AllZone.tsx`
| Value | Kind | Nearest grid | Verdict |
| --- | --- | --- | --- |
| `paddingHorizontal:14` | card pad | 12 / 16 | ⚠️ FLAG |
| `borderRadius:14` / `17` | card radius | 12 or 16 / 16 | ⚠️ FLAG (17→16 safe; 14 mid) |
| `gap:7` | — | 8 | ✅ snap |
| `gap:10` | — | 8 / 12 | ⚠️ FLAG |
| `gap:2/3`, `paddingVertical:3/4` | micro | keep / →4 | likely KEEP |
| `fontSize:11` | label | — | type scale, not spacing — out of scope for W2 (use `IOS_REGISTER_TEXT`/`IOS_TYPOGRAPHY` separately) |
| `PlansZone`/`PeopleZone` `borderRadius:16` | already on grid | ✅ | fine |

**Key W2 risk:** `6`, `10`, and `14` are the most common off-grid values and all
sit *mid-grid* — there is no "correct" snap; choosing up vs down is a density
decision per surface. These are exactly the cases that need a screenshot
before/after, not a blind codemod. Font sizes (`10.5/11/13.5`) are a **separate
type-scale concern** and should NOT be lumped into the spacing pass.

---

## §5 — Build order (lowest blast radius first)

**W1 — retire the file ✅ DONE (commit `16c26065`, 2026-06-01)**
1. **W1a** — created `lib/design-tokens-editorial.ts` exporting `text` +
   `fontFamily`; repointed the 9 imports (§1 table) to it. No visual change.
2. **W1b** — deleted `design-tokens.ts` entirely (all exports dead once the 9
   were repointed; nothing relied on the `export *` re-export). The `md:16`
   latent conflict is gone.
   - *Note:* the `git rm` of the old file was already staged when W1a was
     committed, so W1a + W1b landed as **one atomic commit** (`16c26065`) rather
     than two. Functionally clean — no broken intermediate state.
   - typecheck + lint clean.

**Off-grid normalization (formerly "W2") — folded into the register cutover**
No longer a standalone stream. The register cutover already walks every surface
with eyes on the screen; snapping off-grid spacing to the 8pt grid is the same
motion on the same surface, so do it *there*, per surface, in the same commit as
that surface's register pass. Guidance carried forward:
- **Mid-grid `6`/`10`/`14`** (the most common off-grid values) sit between grid
  steps — no "correct" snap; up vs down is a per-surface density call needing a
  **before/after screenshot, not a codemod** (see §4).
- **Clear snaps** (`7`→8, `9`→8, `5`→4, `17`→16) can go inline with the surface
  pass; hairline `2`/`3` and `borderRadius:999` pills are intentional — keep.
- **L1 `PhaseTabs` check folds in**: if any `IOS_SPACING`-fed value in the
  embedded L1 step-detail changes during a `timeline-zoom/` surface pass, verify
  the L1 row then (needs an account with a granular step).
- **Type scale** (`10.5`/`11`/`13.5` font sizes) stays a **separate future
  item** — not part of the register cutover or the spacing snap.

**Verification standard:** typecheck + lint on every commit; for any surface that
changes spacing, observed-over-reasoned (before/after sim screenshots), per
`feedback_observed_over_reasoned_ui.md`. Stage by explicit path; never `git add -u`.

---

## Open questions for review
1. **Serif register** (§2): keep `text`/`fontFamily` (rehome, zero risk) or
   retire serif → SF Pro (separate visual task)? Plan assumes **keep**.
2. **Mid-grid snaps** (§4): for the pervasive `6`/`10`/`14`, do you want a global
   convention (e.g. "round to nearest, ties up") or genuinely per-surface
   judgment? Affects whether W2 can be partly codemod-assisted.
3. **W2 scope**: do all surfaces now, or just the two swept tabs (Practice +
   Library) and leave the rest until their sweep? (Argues for W1 now, W2
   incremental.)
