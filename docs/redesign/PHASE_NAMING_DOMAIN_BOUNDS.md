# Phase naming: domain bounds

## Summary

The middle phase of preparation is labeled "On the Water" for sailing. The user observed that many sail racing activities aren't on the water — land briefings, weight training, equipment prep, theory sessions, tactical study — and the label forces those activities to either be mis-labeled or excluded. This is a naming/ontology problem, not a layout problem. The three-phase structure (prep / execute / reflect) is probably right; the labels are too domain-literal.

## Current phase names

Phase **keys** are hardcoded as a TypeScript union at `components/cards/types.ts:72`:

```ts
export type RacePhase = 'days_before' | 'on_water' | 'after_race';
```

Those three keys are sailing-literal at the schema level. Every consumer in the codebase references them (`RaceSummaryCard.tsx`, `useInterestEventConfig`, phase-tab segments, debrief mappers, capture-step mappers, etc.). They appear as identifiers in code; they are not user-visible.

Phase **labels** are per-interest-config at `phaseLabels: Record<RacePhase, { full, short }>` (`types/interestEventConfig.ts:221`). Each interest provides its own user-visible naming for the three phases. All 13 interest configs follow the same shape (sample of definitions):

| Interest | `days_before` | `on_water` | `after_race` |
|---|---|---|---|
| sailing | "Days Before" / "Before" | **"On Water" / "Racing"** | "After Race" / "Review" |
| nursing | "Pre-Clinical" / "Prep" | "On Shift" / "Clinical" | "Debrief" / "Debrief" |
| fitness | "Pre-Workout" / "Prep" | "Working Out" / "Train" | "Post-Workout" / "Review" |
| drawing | "Planning" / "Plan" | "In Session" / "Draw" | "After Session" / "Critique" |
| global-health | "Planning" / "Plan" | "On Mission" / "Mission" | "Post-Mission" / "Debrief" |
| generic | "Preparation" / "Prep" | "In Progress" / "Active" | "Review" / "Review" |

(Full list: `configs/{sailing,nursing,fitness,drawing,fiber-arts,knitting,painting-printing,design,global-health,lifelong-learning,regenerative-agriculture,self-mastery,generic}.ts`, each `phaseLabels:` block.)

## What nursing uses

Nursing has the parallel three-phase structure. Labels: `Pre-Clinical / On Shift / Debrief` (full) and `Prep / Clinical / Debrief` (short). The short labels are more universal (`Prep` / `Clinical` / `Debrief`); the full labels are domain-literal ("On Shift" mirrors "On Water"). Both are clinical-shift-literal in the same way "On the Water" is water-literal: a pre-shift simulation lab session or a post-shift theory review would face the same naming mismatch.

## The naming gap

Sailing activities that don't fit "On the Water" as a label for the middle (execute) phase:

1. **Land-based race-day briefings** — coach huddles, weather briefings, course walks. Execution-phase activities, but not water-based.
2. **Weight training / fitness work** — race-day strength conditioning, dryland warm-ups. Execution prep that happens between Days Before and On Water but is shaped like "doing the thing," not "preparing for the thing."
3. **Equipment prep** — rigging, sail setup, instrument calibration. Happens immediately before launch; the user could argue it's `days_before` but it's structurally execution-adjacent.
4. **Theory sessions / tactical study** — pre-race tactics meetings, simulator work, video review of past races. Execution-shaped (focused practice on a specific skill) but not on the water.
5. **Club debriefs (mid-event)** — between races at a regatta, debriefing the previous race and prepping for the next. Sits between `on_water` and `after_race` and doesn't fit either cleanly.

Same problem exists in nursing (sim-lab is not "on shift"), fitness (recovery sessions aren't "working out"), and drawing (sketch journaling is not "in session"). The pattern is universal: any domain-literal label for the execute phase will exclude execution-adjacent activities that aren't the canonical core activity.

## Generalization options

Four naming alternatives, each implies different tradeoffs:

1. **Generic verbs — `Prep / Execute / Reflect`.** Universal across domains. Clear shape, no exclusion. Loses the warmth of domain-specific framing ("On the Water" evokes the activity; "Execute" evokes a process). Same labels in every config; no per-interest customization on the verb axis.

2. **Activity-anchored — `Race Prep / The Race / Debrief`.** Keeps the central activity name as the anchor but drops the location framing. Inclusive of all activities "around" the race day. Sailing-specific; doesn't generalize across domains without per-domain variants.

3. **Position-based — `Before / During / After`.** Most universal, most neutral. Could read as too abstract — loses the texture of what's actually happening in each phase.

4. **Two-layer hybrid — universal default + per-domain warm label.** Schema keys + labels stay as today, but each interest gets a **second** label tier (e.g. `phaseLabels.execute.warm` for the domain-specific framing, `phaseLabels.execute.universal` for the generic). UI picks based on context. Most flexible; most schema churn.

## Architectural implication

The question is whether BetterAt's three-phase model is a **universal cross-domain abstraction** or a **domain-customizable shape**:

- **Universal one-name-set:** All domains use the same labels. Pro: consistency, easier cross-domain UI, easier onboarding ("This works the same for sailing and nursing"). Con: loses domain warmth; "Execute" reads sterile in a deliberate-practice product.
- **Per-domain labels (current):** Each interest defines its own labels. Pro: warm, domain-native naming. Con: hits the "On the Water" problem when activities don't fit the domain-literal label; cross-domain UI has to translate.
- **Layered (universal default, per-domain override):** The model becomes a contract: every domain provides a label-tier mapping. UI components pick the appropriate tier for the context. Pro: keeps domain warmth where it works AND has a fallback when it doesn't. Con: more schema, more code paths to maintain.

A separate question hides inside this: are the **schema keys** themselves (`days_before / on_water / after_race`) wrong? They're sailing-literal identifiers that appear in code, configs, debrief mappers, and the `RacePhase` type. If the answer to the user-visible-labels question is "rename them in sailing only," that's a config edit. If the answer is "the underlying model needs different keys" (e.g. `prep / execute / reflect`), that's a much larger schema refactor touching every consumer of `RacePhase`.

## Recommendation

**Surface as a product decision, not an immediate fix.** The naming choice affects every domain's UI tone, the structural contract for adding new domains, and (depending on the choice) potentially the schema keys themselves. The right next step is a product conversation about whether BetterAt's voice across domains should be:

- One language ("Prep / Execute / Reflect" everywhere), or
- Domain-native voice with a fallback for edge cases ("On the Water" in sailing 90% of the time, "Prep" or similar for the 10% of activities that don't fit), or
- Domain-native voice everywhere, accepting that some activities won't fit the dominant label.

Specifically — and this is the question for the user — **is the goal that every sailing activity should fit cleanly into one of these phases, or is it acceptable that some sailing activities sit outside the dominant phase label and are tagged as such?**

The schema keys (`on_water`, `after_race`) are a separate refactor question that only matters if the answer to the user-visible-labels question implies a schema change. Most likely it doesn't — the labels can be updated in `configs/sailing.ts` (and other config files) without touching the schema.

Not a Get Inspired Commit 4 blocker. Not blocking any current work. Worth a 15-minute product conversation when convenient.
