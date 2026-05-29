# Create-Org Flow Spec

> BetterAt has no in-app way to create an organization today. Discover
> shows existing orgs; admins seed new ones by hand. This spec is the
> design for a self-serve create-org flow that stays honest about the
> trust gradient between *Kevin spinning up the Hong Kong Dragon Fleet
> with three friends* and *RHKYC publishing as a verified institution*
> — without making either feel like a second-class citizen.

## Motivating example

Kevin gets invited to a Dragon practice by Rita. Rita and Eric race
in the Hong Kong Dragon fleet at RHKYC. Kevin wants to capture the
practice in BetterAt and follow Rita and Eric as crew. The fleet
doesn't exist in the system yet, and neither does RHKYC. Kevin
should be able to create *Hong Kong Dragon Racing Fleet* in the
moment, with no friction, no claim queue, no "wait for an admin."

Later — months or years later — RHKYC's actual admin joins BetterAt
through the verified path and finds Kevin's fleet already there with
twelve members and a handful of blueprints. The handoff between
"user-started" and "officially adopted" must be respectful in both
directions: Kevin doesn't get steamrolled, RHKYC doesn't inherit
something they don't recognize as theirs.

## Core principle

**Self-serve from day one. No kind-gating. Consent-based handoff
when a verified parent arrives.**

Anyone can create any org of any kind, immediately. The trust
gradient is expressed through badges, ranking, and adoption — not
through gates on creation.

## Entry points

1. **Discover Orgs empty state.** The natural moment a user notices
   their org is missing: they searched and didn't find it.

   ```
   Search: "Hong Kong Dragon"
   [ no results ]
   → "Don't see your fleet? Add it."
   ```

2. **Settings → Orgs I admin.** Secondary path for users who already
   created one or want to manage existing.

The plus composer is deliberately *not* an entry point. Plus composer
is for personal capture (steps, concepts, ideas). Orgs are
infrastructure. Mixing them dilutes capture.

## The form — three steps, one decision each

### Step 1 · Identity

- **Name** (text, required). Fuzzy-matched against existing orgs on
  blur. Shows *"Did you mean…?"* suggestions to prevent obvious
  duplicates.
- **Kind** (chips): Fleet · Training squad · Study group · Cohort ·
  Chapter · Lab group · Other.
- **"This is part of a larger group"** toggle → reveals a parent-org
  search. Optional. If picked, Step 2 is skipped and the new org
  inherits venue + verification status from the parent.
- **Short description** (1 line, optional).

### Step 2 · Where & what *(skipped if parent picked)*

- **Location**: drop a pin on a mini-Atlas, pick a venue from the
  venue table, or select *"No fixed location"* (for online groups).
- **Primary interest**: defaults to the user's active interest.
- **Vocabulary parent** (collapsed under "Advanced"): defaults to the
  interest's base vocab. Power users — coaches like Rita — can fork
  here to customize the dialect. See *Vocabulary on adoption* below
  for the prototype-chain semantics.

### Step 3 · Membership policy

- **Who can join**: Open · Request to join · Invite only *(default:
  request to join)*.
- **Who can publish blueprints**: Admins only · Any member *(default:
  admins only)*.
- **Discover visibility**: Visible · Hidden *(default: visible)*.

### Submit → post-create sheet

- Atlas pin drops with the kind-appropriate tone. Use the `PIN_TONE`
  guard from `feedback_pin_tone_guard.md` — fall back to a neutral
  tone if the kind has no registered tone.
- **Invite people** sheet pre-populated with the user's favorites and
  recently-followed (for Kevin: Rita and Eric).
- Soft prompt: *"Publish your first blueprint?"* — dismissible, not
  blocking.

## Trust model

Verification status is a property of the org, not a gate on creation.

| Status | What it means | Badge |
|---|---|---|
| `user_created` | Default for self-serve. Real, visible, joinable. | "User-started" |
| `verified` | Org has proven its identity via the verified path. | "Verified" |
| `archived` | Soft-deleted via abandonment cleanup. Hidden from Discover but adoptable. | none (hidden) |

### Verified path — two rungs at launch

1. **Email domain match.** Admin signs up with an address on the
   org's domain (e.g. `@rhkyc.org.hk`). Auto-verifies. Cheap, fast,
   covers institutions with their own domain.
2. **Manual review queue.** Admin submits proof (website link, photo
   of letterhead, intro from existing verified org). Reviewed by ops.
   Slow but covers everyone the domain match misses (small clubs on
   Gmail, study groups, etc.).

Queue lives at `/admin/org-verifications`, backed by an
`org_verification_requests` table:

```sql
create table org_verification_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  requested_by uuid not null references auth.users(id),
  status text not null check (status in (
    'pending', 'approved', 'rejected', 'needs_info'
  )),
  proof jsonb,
  reviewer_id uuid references auth.users(id),
  reviewer_notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
```

Ops handoff later is a permission flip, not a rewrite.

### Third rung — web of trust *(future)*

Once verified anchors exist regionally, *their* admins can vouch for
adjacent orgs (RHKYC vouches for ABC Sailing Club). Scales well after
seed; useless on day zero. Defer until launch+6 months.

## Adoption handoff

When RHKYC arrives via the verified path, the create form fuzzy-
matches existing orgs by name + venue. If it finds a near-match the
verifier sees a prompt:

> "We found a user-created fleet that matches: *Hong Kong Dragon
> Racing Fleet* (12 members, started by Kevin Denney). Adopt it under
> RHKYC, or create a separate official one?"

### Adoption requires consent on both sides

1. RHKYC chooses **Adopt** → system sends an adoption request to the
   user-created org's admin (Kevin).
2. Kevin sees: *"RHKYC has requested to adopt Hong Kong Dragon Fleet
   as their official Dragon fleet. You stay as admin under their
   umbrella."* He accepts or declines.
3. On accept → row update only: `parent_org_id = rhkyc.id`,
   `verification_status = 'verified'`. Memberships, blueprints,
   steps, Atlas pin — all unchanged. Kevin stays admin.
4. On decline → RHKYC must go the separate-fresh route. Both orgs
   coexist.

Consent prevents a verified org from steamrolling a legitimate small
group.

### Notifications

- **Members** of an adopted org get a soft notification: *"Hong Kong
  Dragon Fleet is now official under RHKYC."* No action required.
- **Members of the original** (if RHKYC went separate-fresh) get a
  one-tap *"Join the official fleet"* prompt. The original stays
  unless they leave.

## Squatting

When the names are near-identical and the verified org's adoption
request is *declined*, the user-created org gets a forced rename
suffix: *"Royal Hong Kong Yacht Club (unofficial)"*. Lightest-touch
mitigation — no deletion, no banhammer, just a clarity tax that keeps
Discover honest. Adoption remains the more attractive path.

## Blueprint carryover

Adopted blueprints come along automatically. Don't punish founders
for early work. But the verified parent gets a signal so they can
audit at their own pace.

- `blueprints.adopted_at` timestamp. NULL = born under the verified
  parent. Non-NULL = carried over.
- Tiny **"Carried over"** pill next to title in Discover and on the
  blueprint detail page. Tooltip: *"Authored before RHKYC adopted
  this fleet."*
- Admin UI: *"Review carried over"* filter in the blueprints list
  with a bulk **"Mark as verified"** action that nulls `adopted_at`.
- Editing a carried-over blueprint does **not** auto-clear the flag.
  Editing isn't verification.

## Vocabulary on adoption

The fork stays. RHKYC becomes a grandparent in the prototype chain.

- Terms the fleet overrode → fleet's version wins.
- Terms the fleet didn't override → flow through from RHKYC.
- RHKYC later updates an un-overridden term → fleet picks it up
  automatically.

Most fleets won't have forked. For the ones that did (Rita's
fleet-specific dialect), the work and the language survive adoption.

## Discoverability

Unverified orgs show in Discover from minute one. Verified orgs rank
above unverified within the same query. The verified badge handles
the signaling; the directory stays honest without hiding the small
fleets that need discovery most.

## Abandonment / cleanup

Multi-stage, never destructive. Archived orgs are recoverable;
recoverable orgs become carryover candidates when adoption happens
later.

1. **Inactive admin signal**: admin hasn't opened the app in 90 days
   AND no admin activity (no blueprints published, no membership
   decisions, no settings changes).
2. **Transfer offer**: system pings admin and most-active member —
   *"Transfer admin to [member]?"* Admin has 30 days to respond.
3. **Auto-transfer** to most-active member if no response. They get a
   notification, not a request — declinable within 14 days, which
   falls through to the next-most-active.
4. **No active members for 180 days** → soft-archive
   (`archived_at = now()`). Hidden from Discover.
5. **Adoption unarchives**: a verified parent arriving in year three
   and finding Kevin's dormant 2026 fleet can bring it back with
   history intact.

Edge case: solo-admin, solo-member, zero activity for 90 days →
archive directly, skip the transfer step.

**Never hard-delete.** History is the durable asset.

## Rate limits & dedup

- 2 self-serve org creations per user per week.
- Fuzzy name+venue match at submit shows *"Did you mean …?"* before
  letting the user create a near-duplicate.

## Data model touches

New columns on `organizations`:

```sql
alter table organizations
  add column verification_status text not null default 'user_created'
    check (verification_status in ('user_created', 'verified', 'archived')),
  add column created_by uuid references auth.users(id),
  add column archived_at timestamptz,
  add column adopted_at timestamptz,
  add column parent_org_id uuid references organizations(id),
  add column vocabulary_parent_id uuid references vocabularies(id);

alter table blueprints
  add column adopted_at timestamptz;
```

New table:

```sql
create table org_verification_requests (...);  -- see Trust model section
```

RLS, per repo convention: wrap `auth.uid()` as `(SELECT auth.uid())`
in USING/CHECK clauses — see
`feedback_rls_auth_uid_must_be_wrapped.md`.

## Open questions for build phase

- **Atlas pin tone for new kinds**. Study group, lab group, cohort
  have no registered tone today. Either extend PIN_TONE or fall back
  to neutral. Decide before build.
- **Verification proof storage**. Letterhead photos and screenshots
  in `proof` JSONB vs. Supabase Storage with signed URLs? Lean
  toward Storage so we can apply RLS to the artifacts themselves.
- **Notification surface**. Adoption requests, transfer offers, and
  membership decisions need a unified inbox treatment. Check current
  notification bell behavior before adding a fourth type.
- **Form-field finalization for parent-org search**. Should we
  restrict parent picker to verified orgs only? Probably yes —
  unverified-under-unverified is hard to reason about — but worth
  confirming.

## What this spec deliberately does not cover

- Admin UI for the manual review queue beyond the table shape.
- Blueprint authoring flow (separate spec).
- Cohort lifecycle inside an org (separate spec).
- Migration of existing seeded orgs to the new
  `verification_status` enum (one-time data task; mark all current
  orgs `verified` since they were admin-seeded).
