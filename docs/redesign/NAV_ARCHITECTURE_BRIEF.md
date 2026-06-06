# Navigation Architecture Brief — context-vs-device nav split

> **Status: PARKED / plan-first.** Do NOT start building this. Captured now so the
> reasoning survives. This is its own plan-first session, to run AFTER the Option A
> register cutover lands. See "Dependencies / sequencing" below.

## Problem

The navigation model is inconsistent **by context on the same device**. On phone:

- **Personal** context uses a **bottom tab bar** (Practice / Library / Watch / Atlas).
- **Admin/studio** context uses a **hamburger drawer**.

Switching orgs (personal → admin) on the same phone flips the navigation model with no
device change to explain it. It reads as a jarring seam, not as adaptation. Confirmed by
screenshot on iPhone 17 Pro.

## Root cause

This violates the standard Apple navigation convention, which splits **by device**
(phone → bottom tabs; iPad/desktop → persistent sidebar; e.g. Apple Music, Mail), and
**never by context on the same device**. BetterAt is currently doing a context-split that
the device-split convention is specifically designed to avoid.

The hamburger drawer is the artifact — it is neither the phone pattern (tabs) nor the
iPad pattern (the existing StudioShell sidebar rail). It was bolted on when the
desktop-only gate was reversed for phone parity.

## Proposed direction (NOT final — to be validated in the session)

Make **bottom tabs the consistent spine on phone for both contexts**:

- **Personal** shows Practice / Library / Watch / Atlas.
- **Admin** shows an admin tab set — e.g. Overview / People / Fleets / Insights — plus a
  **"More" overflow** for the long tail: Payouts, Earnings, Programs, Blueprints, SSO, etc.

Same navigation model across contexts, different contents.

On **iPad/desktop**, keep the existing StudioShell two-pane sidebar rail (already
responsive).

Net result is the correct Apple pattern on the correct axis: **tabs on phone (both
contexts), sidebar on iPad (both contexts), drawer eliminated** or demoted to admin's
"More" overflow.

## Open question that gates whether this is worth doing

**How often do users actually switch contexts on phone?**

- Heavy multi-context user (admin of one org, faculty at another, plus personal): the seam
  is a frequent papercut worth fixing.
- Typical user living in one context: the seam is an infrequent cost that may not justify
  re-architecting nav.

**Resolve this from usage data before committing to the build.**

## Dependencies / sequencing

- This touches **StudioShell** — the same shell currently mid-Option-A cutover. **Do NOT
  interleave.**
- This is its own plan-first session **AFTER the register cutover lands**:
  1. Inventory the destination sets per context.
  2. Decide the admin tab structure (which 4–5 become tabs, what goes to "More").
  3. Mock the personal → admin transition to confirm the seam closes.
  4. Build behind a flag.
