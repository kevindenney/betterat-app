# Phase D11 Spec: Headline Metric (per-persona North Star)

> The L3/L4 practice surface currently *leads* with the capability-mix
> chart. That chart answers **"what did I work on?"** — a supporting
> detail. None of our personas open the app to answer that. They open
> it to answer **"am I winning / passing / earning / scoring?"** Their
> North-Star metric is either buried below the fold (sailor, nurse,
> golfer) or, for the entrepreneur, already promoted to first-class by
> the D7 money lane. D11 gives every persona's success currency the
> same first-class billing the entrepreneur already has, and demotes
> the capability mix to *the why behind the number*.

## Goal

Add a per-interest **headline metric** slot that renders at the top of
the L3 (season) and L4 (lifetime) views, above the capability mix.
The metric is the persona's North Star, computed in their native
currency, and resolved from a per-interest registry keyed off the
resolved vocab id — the exact pattern `interestMoney.ts` and
`interestVocab.ts` already use.

This is **not** a new chart. It is one strong figure + a one-line
caption + an optional trend delta, sitting where the eye lands first.

Concrete acceptance test, per persona — the *first thing* each reads
on the arc/all-time surface:

- **Dragon sailor** — *"2nd of 12 · best finish this series ▲"* (season)
  / *"Worlds-qualified 3 of last 4 years"* (lifetime).
- **MSN student** — *"6 of 8 rotation competencies signed"* (season) /
  *"32% through MSN · 14 months to NCLEX"* (lifetime).
- **Jharkhand entrepreneur** — *"₹18,400 net this cycle"* (season) /
  *"₹2.1L lifetime · Kishore active, 60% to Tarun"* (lifetime). This is
  the D7 money figure, promoted to the headline slot.
- **Avid golfer** — *"14.2 handicap ▼ from 16.1"* (season) /
  *"18.2 → 12.4 over 3 seasons"* (lifetime).

If the headline slot reads as a generic stat counter rather than the
one number the persona actually cares about, the bet has not landed.

## Why this is its own bet, not part of D5

D5 (chapter ledger) already specs a **trajectory readout** — an
interest-tuned summary line in the lifetime view. D11 *promotes* that
idea in two ways:

1. It becomes **always-on and top-of-surface**, not a readout buried
   in the L4 ledger.
2. It gains a **season scope** (L3), not just lifetime (L4). The
   sailor wants "how's this series going" mid-arc, not only the
   career summary.

D5's trajectory readout becomes the lifetime *expansion* of the same
metric. D7's money lane becomes the entrepreneur's headline source +
its detailed breakdown. D11 is the connective tissue that says "every
persona gets what the entrepreneur already has."

## The registry contract

A code-level registry (chrome-first, matching D7's `interestMoney.ts`)
keyed off the resolved vocab id. Absence = no headline slot for that
persona (silent, same render-when-present contract as the money lane).

```ts
// interestHeadline.ts (new)

export interface HeadlineMetricValue {
  /** Primary figure, pre-formatted: "2nd of 12", "32%", "₹18,400", "14.2". */
  value: string;
  /** One-line context under the figure: "best finish this series". */
  caption: string;
  /** Optional trend vs the prior comparable window. */
  delta?: { direction: 'up' | 'down' | 'flat'; text: string };
  /** Drives tint: positive (green), neutral (ink), caution (amber). */
  tone?: 'positive' | 'neutral' | 'caution';
}

export interface HeadlineMetricConfig {
  /** Eyebrow, persona-native: "FORM" / "PROGRAM" / "EARNINGS" / "HANDICAP". */
  label: string;
  /** Season scope (L3). null → no headline at L3 for this season. */
  resolveSeason: (season: TimelineSeason) => HeadlineMetricValue | null;
  /** Lifetime scope (L4). null → no headline at L4. */
  resolveLifetime: (dataset: TimelineDataset) => HeadlineMetricValue | null;
}

export function resolveHeadlineMetric(vocabId: string): HeadlineMetricConfig | null;
export function hasHeadlineMetric(vocabId: string): boolean;
```

Note: `delta.direction` semantics are metric-aware — for golf a *down*
handicap is `tone: 'positive'`, for sailing a *down* finish position
is also positive. The resolver, not the renderer, decides tone, so the
chrome stays dumb.

## Per-persona definition

| Persona (vocab id) | `label` | Season figure (L3) | Lifetime figure (L4) | Source data |
|---|---|---|---|---|
| **sailing** | `FORM` | best + avg finish across the series' races | podium/qualification record across campaigns | race finishes (new typed data; see scope) |
| **nursing** | `PROGRAM` | competencies signed this rotation (`N of M`) | % through program · competencies attested · runway to NCLEX | competency attestations + program metadata |
| **entrepreneur** | `EARNINGS` | net ₹ this cycle + working capital | lifetime ₹ + loan-tier progress | **D7 `SeasonFinance` / `LifetimeFinance` — already built** |
| **golf** | `HANDICAP` | scoring avg / handicap across the season's rounds | handicap progression across seasons | round scores (new typed data; see scope) |

Personas without a registered config (drawing, knitting, default) show
**no** headline slot and keep capability mix as the lead — exactly
today's behavior. The slot is opt-in, never a generic counter.

## Render placement

`L3SeasonView.tsx` and `L4YearsView.tsx`, immediately **above** the
`capabilityHeader` eyebrow + `CapabilityMix` chart:

```
[ persona headline metric ]   ← NEW, big figure + caption + delta
CAPABILITY MIX                 ← existing, now "the why behind the number"
[ CapabilityMix chart ]
…
```

The capability mix keeps its eyebrow and chart unchanged. The headline
sits in its own card-like block (no chart — type only), styled like the
D7 money readout's total line but promoted to the top and larger.

Render guard mirrors D7 exactly:

```tsx
{hasHeadlineMetric(interestVocab.id) ? (() => {
  const cfg = resolveHeadlineMetric(interestVocab.id)!;
  const v = cfg.resolveSeason(season); // resolveLifetime(dataset) on L4
  return v ? <HeadlineMetric label={cfg.label} value={v} /> : null;
})() : null}
```

## Data scope — what's real vs what's authored for the demo

Following the D7 chrome-first decision (see
`project_phase_d_persona_ladder.md`): build the registry + the
`HeadlineMetric` render block + resolvers, and make it demonstrable via
the existing sample personas without touching `realDataAdapter` or the
DB.

- **Entrepreneur** — fully real already. Resolver reads `season.finance`
  / `dataset.lifetimeFinance` (D7). No new data.
- **Nursing / sailing / golf** — the figures (finishes, attestations,
  handicap) are **typed data the dataset does not carry yet**. For v1:
  - Resolvers return `null` for real accounts (slot hidden — no
    regression, identical to pre-D11).
  - The sample personas (`sampleData.ts`, `sampleDataEntrepreneur.ts`,
    + a golf sample if/when added) author the figures inline, the way
    D7 authored sample finance, so the slot is demonstrable.
  - Real wiring (a `season.headline` / `dataset.lifetimeHeadline`
    field populated by the adapter from finishes/attestations/scores)
    is a follow-up per metric, not part of D11's chrome bet.

This keeps D11 a pure additive chrome change: zero shared-state risk,
zero migration, nothing renders for a persona until its data exists.

## Acceptance

- Entrepreneur sample shows `EARNINGS` headline above the money lane on
  both L3 and L4, reading from D7 finance (no double-counting — the
  lane stays as the breakdown).
- Each sample persona with a registered config shows its North-Star
  figure first; capability mix sits below it.
- A persona with no config (e.g. drawing) is visually unchanged.
- A real account with no headline data shows no slot — current behavior
  preserved.
- `npm run typecheck` + `npm run lint` clean (max-warnings 0).

## Open Questions

- **Delta comparison window.** Season delta vs the prior season, or vs
  arc start? Lean: prior comparable window (prior series, prior
  rotation, prior season's handicap) — most legible.
- **Headline vs money lane overlap for the entrepreneur.** Proposed:
  headline = the single net figure + loan tier; money lane = the
  weekly in/out breakdown. Confirm we don't want to collapse them into
  one block.
- **Sailing/golf real data.** Finishes live near `race_results`;
  golf has no scores table yet. Which metric gets real wiring first
  after the chrome lands? (Entrepreneur is already real.)
- **Should the headline ever replace the capability mix** for a
  metric-first persona, rather than sit above it? Default: above, never
  replace — the mix is the explanation.

## File References

- L3 view: [components/ios-register/timeline-zoom/L3SeasonView.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/L3SeasonView.tsx)
- L4 view: [components/ios-register/timeline-zoom/L4YearsView.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/L4YearsView.tsx)
- Registry pattern to mirror: [components/ios-register/timeline-zoom/interestMoney.ts](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/interestMoney.ts)
- Vocab registry (where `capabilityHeader` lives): [components/ios-register/timeline-zoom/interestVocab.ts](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/interestVocab.ts)
- Dataset/season types: [components/ios-register/timeline-zoom/types.ts](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/types.ts)
- Master spec: [docs/redesign/specs/PHASE_D_PERSONA_AWARE_PRACTICE_LADDER_SPEC.md](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/specs/PHASE_D_PERSONA_AWARE_PRACTICE_LADDER_SPEC.md)

## Memory Hooks

- `project_phase_d_persona_ladder.md` — D11 follows the same chrome-first
  + sample-persona pattern established by D6/D7 (registry keyed off
  vocab id; render-when-data-present; `realDataAdapter` untouched).
- `project_interest_vernacular_personas.md` — the headline `label`
  must be persona-native (`FORM`, not "SCORE"); a generic counter
  reads as tracker-app.

## End of Phase D11 Spec

D11 is the connective tissue of the persona ladder: it says every
persona gets, at a glance, the one number that proves their practice is
adding up — the dignity surface the entrepreneur already got from D7,
extended to the sailor, the nurse, and the golfer.
