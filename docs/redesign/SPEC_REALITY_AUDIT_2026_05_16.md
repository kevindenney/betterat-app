# Spec-vs-Reality Audit — 2026-05-16

Audits the four currently-unshipped phase specs against existing repo code, looking for the kind of gap that surfaced today in the Plan-tab investigation: a spec that assumes from-scratch construction when usable scaffolding already exists, or a spec that conflicts with what's already there.

Method per spec: read Goal + Files-to-change + Pre-Execution Reality Check, identify proposed new files / modified files / dependencies, then grep the repo to confirm each claim. Classification follows the four buckets the audit brief defined.

Audited:
- `specs/PHASE_C_TIMELINE_WITH_PEEK.md`
- `specs/PHASE_C5_ZOOMED_OUT_VIEW_SPEC.md`
- `specs/PHASE_F1_JHU_ADMIN_ONBOARDING_CARD_SPEC.md`
- `specs/PHASE_G1_BLUEPRINT_CREATOR_DASHBOARD_MAIN_SPEC.md`

Skipped per brief: A.8 (shipped), A.9 (shipped), B.5 (already audited `d6ba4921`), B.6 (shipped).

---

## Phase C — Timeline-with-peek shell

**Target files (new):**
- `components/practice-timeline/types.ts`
- `components/practice-timeline/index.ts`
- `components/practice-timeline/PracticeTimelineShell.tsx`
- `components/practice-timeline/usePracticeTimelinePhaseMemory.ts`
- Test files under `components/practice-timeline/__tests__/`
- New flag `PRACTICE_TIMELINE_PEEK` in `lib/featureFlags.ts`

**Target files (modified):**
- `app/(tabs)/races.tsx` — add flag branch before `RACE_PREP_IOS_REGISTER`
- `components/cards/types.ts` — add `activePhase` / `onActivePhaseChange` to `CardContentProps`
- `components/cards/content/RaceSummaryCard.tsx` — accept controlled phase props

**Existing code referenced (spec calls out by name):**
- `components/cards/CardGrid.native.tsx` + `CardGrid.web.tsx` — confirmed present.
- `components/cards/content/RaceSummaryCard.tsx` — phase-memory localStorage key `step_tab:${race.id}` at lines 527, 536; `selectedPhase` state at 525; effect resetting `selectedPhase` from `currentPhase` at 1161-1162 — all match the spec's claims exactly.
- `app/(tabs)/races.tsx` data flow — `baseCardGridRaces`, `filteredCardGridRaces`, `selectedRaceId`, `nextActionItem`, `renderCardGridContent` — used as adapter sources per spec.
- `react-native-gesture-handler` + `react-native-reanimated` already in package.json — spec correctly avoids adding `react-native-pager-view`.
- `RACE_PREP_IOS_REGISTER` flag context — preserved as the fallback branch.

**Spec's reality check finds the right things:** It explicitly says "Phase C should reuse that data flow. Do not introduce a new query layer." It also flags the existing reset-effect at 1161-1162 as a known control-flow hazard to manage rather than break.

**Classification:** **anticipated**.

**Recommendation:** Safe to execute as written. No spec changes needed.

---

## Phase C.5 — Zoomed-Out Timeline View

**Target files (new):**
- `components/practice-timeline/zoomed-out/types.ts`
- `components/practice-timeline/zoomed-out/sectionAdapter.ts`
- `components/practice-timeline/zoomed-out/ZoomedOutTimelineView.tsx`
- `components/practice-timeline/zoomed-out/ZoomedOutTimelineRow.tsx`
- `components/practice-timeline/zoomed-out/ZoomedOutRowMenu.tsx`
- `components/practice-timeline/zoomed-out/usePracticeZoomMode.ts`
- `components/practice-timeline/zoomed-out/zoomedOutStyles.ts`
- Test files under `__tests__/`
- New flag `PRACTICE_ZOOMED_OUT_TIMELINE`

**Target files (modified):**
- `components/practice-timeline/PracticeTimelineShell.tsx` (created by Phase C — see Dependencies)
- `app/(tabs)/races.tsx`

**Existing code referenced:**
- `components/cards/TimelineGridView.tsx` — confirmed present. Spec explicitly tags it as "legacy zoom-out" and instructs keeping it as the flag-off fallback.
- `isGridView`, `handleToggleGridView`, `pendingNewStepIdRef`, `onReorderRaces` — confirmed at `app/(tabs)/races.tsx` lines 338, 580, 1424, etc.
- "tap-to-reorder is used on all platforms" — confirmed at `TimelineGridView.tsx:385` as a verbatim comment. Spec quotes this phrase and adjusts its plan (no drag-and-drop library in v1) accordingly.
- Spec adds A.10 label guard: "the first bottom tab's identity is the Practice engine, but its visible label is interest-specific". This is up-to-date with the May 16 backlog convention.

**Dependency:** Spec explicitly stops execution if `components/practice-timeline/PracticeTimelineShell.tsx` (Phase C output) does not exist. This is the right gate.

**Classification:** **anticipated**.

**Recommendation:** Safe to execute as written once Phase C ships. No spec changes needed.

---

## Phase F.1 — JHU Admin Onboarding Card

**Target files (new):**
- `components/organizations/OrgAdminOnboardingCard.tsx`
- `components/organizations/__tests__/OrgAdminOnboardingCard.test.tsx`
- `hooks/useOrgAdminOnboardingCard.ts`
- `hooks/__tests__/useOrgAdminOnboardingCard.test.ts`
- New flag `JHU_ADMIN_DASHBOARD_IOS`

**Target files (modified):**
- `app/organization/cohort-dashboard.tsx`

**Existing code referenced:**
- `app/organization/cohort-dashboard.tsx` — present.
- `components/organizations/OrgAdminHeader.tsx` — present.
- `components/organization/FacultyCohortDashboard.tsx` — present. (Note the singular vs plural namespace divergence; spec spells both correctly.)
- `lib/organizations/adminGate.ts` — present. Helpers `resolveActiveOrgId`, `getActiveMembership`, `isActiveMembership`, `isOrgAdminRole` are imported into `cohort-dashboard.tsx` at line 1 exactly as the spec claims.
- No existing onboarding-card scaffolding, no existing "Welcome to Org Admin" string anywhere in repo. Clean greenfield surface on top of existing infrastructure.

**Risks the spec already raises explicitly:**
- Tour route is missing — spec instructs routing to `/organization/members` as a safe no-op rather than fake completion.
- "JHU-only vs generic org admin" is flagged as a pre-execution product decision.

**Classification:** **anticipated/accurate** — proposed new files don't exist; predecessor infrastructure exists exactly as referenced.

**Recommendation:** Safe to execute as written. No spec changes needed. Product question (JHU-specific vs generic) should be resolved before kickoff but doesn't block writing the component.

---

## Phase G.1 — Blueprint Creator Dashboard main view

**Target files (new):**
- `components/creator-dashboard/types.ts`
- `components/creator-dashboard/creatorDashboardAdapters.ts`
- `components/creator-dashboard/CreatorDashboardScreen.tsx`
- `components/creator-dashboard/CreatorDashboardTabs.tsx`
- `components/creator-dashboard/BlueprintsTab.tsx`
- `components/creator-dashboard/BlueprintCard.tsx`
- `components/creator-dashboard/SubscribersTab.tsx`
- `components/creator-dashboard/SubscriberRow.tsx`
- Optional `hooks/useCreatorDashboardSubscribers.ts`
- Tests for adapters
- New flag `BLUEPRINT_CREATOR_DASHBOARD_IOS`

**Target files (modified):**
- `app/creator/index.tsx`
- `lib/featureFlags.ts`

**Existing code referenced (verified against repo):**
- `app/creator/index.tsx` — present. `type Segment = 'blueprints' | 'earnings'` at line 59 (exactly as claimed). `useUserBlueprints` imported at line 24 (exactly as claimed).
- `app/creator/[id].tsx` — present.
- `hooks/useBlueprint.ts` — `useUserBlueprints` at line 112, `useBlueprintSubscriberProgress` at line 276 (both confirmed).
- `types/blueprint.ts` — `BlueprintRecord` at 12, `SubscriberStepProgress` at 138, `SubscriberProgress` at 149 (exact names).
- `services/BlueprintService.ts` — present.
- `components/creator-dashboard/` — does not exist. Clean greenfield.

**Risks the spec already raises:**
- Sparkline requires 30-day subscriber history that doesn't exist — spec uses deterministic placeholders and defers to follow-up.
- AI Coach scaffold explicitly out of scope; `+ New Blueprint` made presentational/disabled with copy if no existing route handler is found.
- Earnings preserved (Stripe Connect not stranded).

**Classification:** **anticipated/accurate** — every named hook, type, and field matches the repo. Adapter shape is honest about what's available vs deferred.

**Recommendation:** Safe to execute as written. No spec changes needed.

---

## Summary

| Phase | Classification | Spec change needed? |
|---|---|---|
| C | anticipated | no |
| C.5 | anticipated | no |
| F.1 | anticipated/accurate | no |
| G.1 | anticipated/accurate | no |

**Phases needing spec updates:** 0.
**Phases safe to execute as-written:** 4.
**Highest-priority gaps:** none.

**Cross-cutting observations:**

1. Every audited spec includes a Pre-Execution Reality Check section that names specific files, identifiers, and import lines. Each one I spot-checked landed in the repo at exactly the line / shape the spec claimed. This is the discipline that prevented the Plan-tab false alarm (the B.5 spec did the same and was correct, per `d6ba4921`).
2. Two specs (C and C.5) form a chain — C.5 reality-checks for `components/practice-timeline/PracticeTimelineShell.tsx` and refuses to execute if it's missing. That's the right interlock.
3. Phase F.1 and G.1 are both greenfield-on-top-of-existing-infrastructure: the proposed component directories don't exist, but every helper, hook, and type they need to plug into does exist with the exact names the spec uses.
4. No surprises in feature-flag naming. None of the four flags (`PRACTICE_TIMELINE_PEEK`, `PRACTICE_ZOOMED_OUT_TIMELINE`, `JHU_ADMIN_DASHBOARD_IOS`, `BLUEPRINT_CREATOR_DASHBOARD_IOS`) exist yet in `lib/featureFlags.ts`, matching the specs' claims.

**Recommendation:** Close this audit. The post-Plan-tab-investigation discipline (every spec must reference existing code by line / identifier and the spec writer must do the grep first) is being followed consistently across the four remaining unshipped specs. No corrective action required before kicking off execution.
