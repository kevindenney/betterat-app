# Org Calendar → Member Discovery & Adoption — Spec

> Status: spec only (not built). Closes the gap documented in
> `project_org_calendar_events_no_member_surface`.

## Problem

An org admin creates calendar events via `admin_create_org_event`
(`components/admin/CreateOrgEventSheet.tsx`). Each event is a `timeline_steps`
row stamped with the *admin's* `user_id`, the `organization_id`, a `place_name`
(no lat/lng), optional `is_race`, and `starts_at`/`ends_at`. Admins see them via
the `admin_org_calendar` SECURITY DEFINER RPC.

**No member ever sees these.** A member's practice timeline
(`TimelineStepService.getUserTimeline`) filters strictly on their own `user_id`.
Steps reach a member only through:
- blueprint subscription (`source_type:'blueprint'`), or
- explicit adoption (`adoptStep` → `source_type:'copied'`, `copied_from_user_id`).

An org-wide scheduled event fits neither path. The member org page
(`app/discover/org/[slug].tsx`) shows a **static** `metadata.up_next` JSON blob,
not live event rows. So org events are admin-only artifacts with nowhere to land
for the people meant to show up to them.

## Goal

A member of an org can **discover** that org's upcoming events and **add one to
their own timeline** in one tap, reusing the existing adoption plumbing. The
admin-authored row stays the canonical "source" event; the member gets their own
adopted copy they can plan around, complete, and reflect on.

## Data layer

### Read — `org_calendar_for_member(p_org_id)` (new, SECURITY DEFINER)
Member-facing sibling of `admin_org_calendar`, gated by org **membership**
(`is_org_member` / `organization_memberships.status = 'active'`) instead of
admin role. Returns upcoming org events (`organization_id = p_org_id`,
`is_org_event`/owner-is-admin, `starts_at >= now()` first) with: `id, title,
starts_at, ends_at, place_name, is_race, owner_name, already_adopted` (bool —
whether the calling member already has a copy, see below).

A cross-org variant `org_calendar_for_my_orgs()` returns the same shape across
every org the member belongs to, for the Inbox feed.

### Distinguish org events from personal steps
`admin_create_org_event` should set an explicit marker so the member read RPC and
the adopted-copy de-dupe are unambiguous. Add `is_org_event boolean default
false` to `timeline_steps` (or reuse an existing org-scope flag if one lands
first) and set it true on creation. Without this, "org event" is inferred only
from `organization_id is not null AND owner is an org admin`, which is brittle.

### Adopt — reuse `adoptStep`
Adoption already exists (`useAdoptStep`, `hooks/useTimelineSteps.ts:311` →
`TimelineStepService.adoptStep`). Adopting an org event writes a member-owned
`timeline_steps` row with `source_type:'copied'`, `copied_from_user_id = <admin>`,
and carries over `title`, `starts_at`/`ends_at`, `place_name`, `is_race`. Add
`source_org_event_id = <original step id>` so:
- `already_adopted` can be computed (member has a copy whose
  `source_org_event_id` = this event), preventing double-add, and
- if the admin edits/cancels the source event later, adopted copies can be
  reconciled (out of scope for v1, but the link makes it possible).

## Surfaces

### Primary — Inbox item (capture-first, fits existing model)
Per `BETTERAT_INBOX_SPEC`, the Inbox is the capture-and-triage surface. An
upcoming org event for an org the member belongs to arrives as a triageable
Inbox card: "**{Org} · {event title}** — {date} at {place}." Triage actions:
- **Add to my timeline** → `adoptStep` (the graduate-to-step path the Inbox
  already defines), then the card resolves.
- **Dismiss** → no copy; card resolves without adoption.
- **Open** → event detail (`/step/[id]` read view).

This reuses the Inbox's existing "graduate a captured thing into a step" verb;
an org event is just a pre-filled capture the member didn't have to type.

### Secondary — Org page "Upcoming" section
On `app/discover/org/[slug].tsx`, replace the static `metadata.up_next` block
with a live section driven by `org_calendar_for_member(orgId)`: the next N events,
each a row with date/place/race badge and an inline **Add to my timeline** button
(disabled + "Added" when `already_adopted`). This is the "what's happening here"
home for a member already on the org page.

> Lead with Inbox (adoption plumbing + capture model already exist); the org-page
> section is a thin read of the same RPC and can ship alongside or right after.

## Hooks / client

- `useOrgCalendarForMember(orgId)` → wraps `org_calendar_for_member`; invalidated
  by adopt mutations and by admin event create/edit.
- `useMyOrgEventsInbox()` → wraps `org_calendar_for_my_orgs` for the Inbox feed.
- Reuse `useAdoptStep`; on success invalidate `['org-calendar-for-member', orgId]`
  and the member timeline keys so the adopted copy + `already_adopted` both
  refresh.

## Notifications (optional, v1.1)
When an admin publishes an event, fan out a bell/Inbox notification to active org
members (mirror the `step_suggestions` trigger pattern noted in
`project_send_suggested_step_architecture`). Not required for v1 — the Inbox feed
pulls on open — but it's the natural "your club added a race" nudge.

## Out of scope (v1)
- Reconciling adopted copies when the admin edits/cancels the source event.
- RSVP / attendance tracking on the event.
- Auto-adopt (events landing in timelines without member consent) — adoption
  stays consent-based, consistent with the blueprint-adoption model.
