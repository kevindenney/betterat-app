# Phase 0 · Shared Chrome — Engineering Brief

**Purpose.** Land the iOS-register primitives that every subsequent phase reuses. After this PR is merged behind a flag, **no other UI changes** ship — only the new primitives exist and are wired to nothing yet. Plan/Do/Reflect refreshes happen in Phase 1+.

**Source of truth.** `docs/redesign/ios-register/legacy-reskin-common.css` (read this end-to-end before starting). All numeric tokens, padding values, and radii are defined there.

**Feature flag.** `PRACTICE_STEP_LOOP_IOS_REGISTER` (env: `EXPO_PUBLIC_FF_PRACTICE_STEP_LOOP_IOS_REGISTER`). Off by default. When off: zero visual change anywhere in the app.

---

## Acceptance criteria

A Phase 0 PR is mergeable when:

1. **Design tokens** are exported as a TypeScript module (`lib/design-tokens-step-loop-ios.ts`) covering every `--*` variable in `legacy-reskin-common.css`. Existing `lib/design-tokens-ios.ts` stays untouched.
2. **Five components** are created in `components/step-loop/` and pass storybook/snapshot tests:
   - `<StatePill>` — five variants
   - `<StepStrip>` — flag-icon + em-weighted series + sub-context
   - `<TopHeader>` — interest chip · step counter · right cluster
   - `<PhaseTabs>` — three tabs, ready/pending/live ring states
   - `<StepCard>` — the full-bleed white-card-on-gray shell that wraps the step body
3. **Tabbar rename** — `Race → Practice` across all four interests. Behind the flag.
4. **Zero existing-surface regressions.** PlanTab.tsx, DoTab, ReflectTab continue to render exactly as today when the flag is off. When the flag is on, they still render but inside the new `<StepCard>` shell with `<TopHeader>` above them. Internal contents unchanged.
5. **One smoke screen.** A debug route `/debug/step-loop-primitives` renders every component in every state, hardcoded data, no network. Lets QA verify visual fidelity vs canonicals.

---

## Component APIs

### `<StatePill>`

```tsx
type StatePillVariant =
  | 'planned'      // gray
  | 'current'      // blue
  | 'live'         // coral, pulsing
  | 'complete'     // green, tick
  | 'reflect'      // purple, spark
  | 'settled'      // green
  | 'between';     // amber (hinge state)

interface StatePillProps {
  variant: StatePillVariant;
  label: string;        // "Planned", "Live · capturing", "On shift · capturing", etc.
  // Optional right-aligned stats group (used in Do tab header)
  stats?: { num: string; label: string }[];
}
```

- Anatomy reference: `.state-pill` + variant classes in `legacy-reskin-common.css`
- Pulse animation for `live`: 1.4s ease-out, 8px coral dot
- Tick check for `complete/settled`: 14×14 filled circle, 9px check glyph
- Spark for `reflect`: 14×14 filled circle, 8.5px sparkles glyph

### `<StepStrip>`

```tsx
interface StepStripProps {
  icon?: 'flag-3' | 'trophy' | 'flag';
  // First segment is em-weighted; rest is muted
  primary: string;          // "Light-air starts in shifty breeze"
  secondary?: string;       // "Race 4 · beat 2"
}
```

- Anatomy reference: `.step-strip`
- Height: 33px, background `#FAFAFC`
- Truncates with ellipsis

### `<TopHeader>`

```tsx
interface TopHeaderProps {
  interestName: string;     // "Sail Racing"
  onInterestPress?: () => void;
  stepCounter?: string;     // "Step 4 of 10" (read-only label)
  rightCluster?: React.ReactNode;  // notification, timeline, +, avatar
  // For Reflect/Trophy: back chevron instead of interest dropdown
  backLabel?: string;
  onBackPress?: () => void;
}
```

- Height: 52px including top padding
- Right cluster items: 19px Tabler icons, gap 12px

### `<PhaseTabs>`

```tsx
type PhaseState = 'pending' | 'ready' | 'live';

interface PhaseTabsProps {
  plan: PhaseState;
  do: PhaseState;
  reflect: PhaseState;
  active: 'plan' | 'do' | 'reflect';
  onTabPress: (tab: 'plan' | 'do' | 'reflect') => void;
}
```

- Active tab: ios-blue, 600 weight, 2px underline
- Pending ring: 14×14 dashed gray-3 border
- Ready ring: 14×14 ios-green fill + 6×3 white check rotated -45°
- Live ring: 14×14 ios-coral fill + 4×4 white dot

### `<StepCard>`

```tsx
interface StepCardProps {
  // Header band (state pill + optional ⋮ menu + optional stats)
  pill: React.ReactElement<StatePillProps>;
  onMenuPress?: () => void;
  // Below pill: optional step-strip with context
  stepStrip?: React.ReactElement<StepStripProps>;
  // Title block (optional — Hinge has its own)
  titleBlock?: React.ReactNode;
  // Phase tabs row
  phaseTabs?: React.ReactElement<PhaseTabsProps>;
  // Body content (scrolls)
  children: React.ReactNode;
  // Optional bottom CTA strip (Plan/Reflect have one; Trophy doesn't)
  footer?: React.ReactNode;
}
```

- Position: absolute, `left: 14px right: 14px top: 64px bottom: 84px`
- Border-radius: 22px
- Shadow: `0 1px 2px rgba(0,0,0,0.06), 0 18px 38px -16px rgba(0,0,0,0.20), 0 4px 10px -4px rgba(0,0,0,0.08)`
- Border: `0.5px solid rgba(0, 0, 0, 0.04)`
- Background: `#FFFFFF` on a `gray-6` (`#F2F2F7`) screen ground

---

## Tabbar rename

File: `app/(tabs)/_layout.tsx` (or whichever holds the four-tab definition)

Change the first tab's label:
- `name="race"` → keep route, but tab label `"Race"` → `"Practice"`
- Tab icon stays `ti-flag-3-filled` on iOS / equivalent on Android
- Universal across all interests — no per-interest override

Behind the flag — when off, label reads "Race" as today.

---

## Files to touch in `betterat-app`

| File | What changes |
|---|---|
| `lib/design-tokens-step-loop-ios.ts` (new) | All `--*` tokens from `legacy-reskin-common.css` as named exports |
| `components/step-loop/StatePill.tsx` (new) | Implements `<StatePill>` |
| `components/step-loop/StepStrip.tsx` (new) | Implements `<StepStrip>` |
| `components/step-loop/TopHeader.tsx` (new) | Implements `<TopHeader>` |
| `components/step-loop/PhaseTabs.tsx` (new) | Implements `<PhaseTabs>` |
| `components/step-loop/StepCard.tsx` (new) | Implements `<StepCard>` |
| `components/step-loop/index.ts` (new) | Barrel export |
| `lib/featureFlags.ts` | Add `PRACTICE_STEP_LOOP_IOS_REGISTER` |
| `app/(tabs)/_layout.tsx` | Conditional tab label per flag |
| `app/(tabs)/race/index.tsx` (or current Race screen root) | Wrap render in `<StepCard>` shell when flag on |
| `app/debug/step-loop-primitives.tsx` (new) | Smoke route showing every component state |

---

## Visual fidelity check

Open the canonical alongside the simulator:

- `docs/redesign/ios-register/b10-reflect-home-canonical.html` — left frame shows the white-card-on-gray look the `<StepCard>` should match
- `docs/redesign/ios-register/step-loop-integration-canonical.html` — section 1's target frame shows `<TopHeader>` + `<StatePill>` + `<StepStrip>` + `<PhaseTabs>` together
- The anatomy frame on the right of each canonical's main pair shows pixel values for spacing

Numeric tolerance: ±1pt on padding/margins. Colors: exact hex match from tokens.

---

## What this PR does *not* do

Out of scope (Phase 1+):

- AI Coach demotion (D5) — Plan stays exactly as today inside the new shell
- Quiet timed-or-not row (D2) — still ships in current loud form
- Bottom CTA `Next: Start Doing` (D3) — not yet
- Universal `+` sheet (D6) — Phase 2
- Step-picker retirement (D4) — still works as today
- Capability chips on Plan (D10a) — Phase 1
- Suggestions row · WITH row (D12) — Phase 1
- Anything Do/Reflect/Playbook/Profile

These are explicitly Phase 1+ work. Phase 0 ends with new shell visible, old contents inside.

---

## Suggested Claude Code prompt (paste verbatim)

```
Implement Phase 0 (shared chrome) of the iOS register migration per
docs/redesign/ios-register/phase-0-shared-chrome.md.

Source of truth for design tokens, padding, radii, colors, and component
anatomy: docs/redesign/ios-register/legacy-reskin-common.css. Read it
end-to-end before writing code.

Acceptance criteria are listed in the brief. Specifically:
  1. Token module at lib/design-tokens-step-loop-ios.ts
  2. Five components in components/step-loop/: StatePill, StepStrip,
     TopHeader, PhaseTabs, StepCard
  3. Tabbar rename Race → Practice behind PRACTICE_STEP_LOOP_IOS_REGISTER
  4. Wrap existing PlanTab/DoTab/ReflectTab render in <StepCard> shell
     when flag is on. Internal contents unchanged.
  5. Debug route /debug/step-loop-primitives showing every component state

Out of scope: anything past Phase 0. Do not touch AI Coach card, timed
toggle, FAB, step picker, or any Plan/Do/Reflect content. Those are
Phase 1+ work tracked in step-loop-integration-canonical.html (D5–D9)
and becoming-loop-canonical.html (D10–D12).

Reference canonicals for visual fidelity:
  - b10-reflect-home-canonical.html (StepCard shell)
  - step-loop-integration-canonical.html §1 (TopHeader + StatePill +
    StepStrip + PhaseTabs together)

When done: open a PR with the brief's checklist filled in. Include
before/after screenshots of the Race tab with the flag off and on,
plus the debug route.
```

---

## After Phase 0 ships

Run a verification pass with the flag on:

1. **Race tab** — visually matches the new register's chrome (white card on gray, state pill, step strip, phase tabs); contents inside the card render as today's PlanTab/DoTab/ReflectTab. No FAB regression. Tab bar reads `Practice / Playbook / Discover / Profile`.
2. **Debug route** — all five components render in all states. State pill shows all 7 variants. Phase tabs show pending/ready/live rings.
3. **Flag off** — identical to current production build.

Once green: merge, leave the flag off in production, hand Phase 1 to a fresh Claude Code session.
