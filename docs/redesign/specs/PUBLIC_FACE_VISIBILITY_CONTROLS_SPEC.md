# Public Face — Section & Interaction Visibility Controls Spec

## Goal

Give a practitioner per-**section** and per-**interaction** control over their public face, layered on top of the existing per-step and account-level privacy model. Today the only privacy levers are account-wide (`profile_public`) and per-step (`private/crew/fleet/public`). That is too coarse: a user cannot say "show my capabilities but hide my practice circle," or "let people follow me but not suggest steps." This spec adds that granularity without replacing the existing per-step system — section toggles decide whether a section *appears at all*; per-step visibility continues to decide *which rows* fill a visible section.

This is a product/model spec to lock before touching the RPC. Implementation is split into commits at the end.

## Source

Written 2026-06-17 while auditing the public face with Kevin. Kevin's concern: "people would not want to make all of this public — maybe orgs/groups, maybe published blueprints, maybe concepts, maybe follow/suggest/discuss/reflect." This spec captures that as a concrete model.

### Verified current state (traced this pass)

- **Public face screen**: `components/sailor/public-face/PublicFaceScreen.tsx`, routed at `app/profile/[userId]/index.tsx`. Eight sections: hero, framing/bio, working-on-now concept, practice timeline, capabilities, practice circle, published reflections, "where X practises." Sparse data = section absent (never an empty placeholder).
- **Data RPC**: `get_person_public_face(target_user_id uuid)` (`SECURITY DEFINER`, latest def added in `supabase/migrations/20260616120000_capability_evidence_quote.sql`). Returns `{ concept, capabilities, circle }`.
  - `concept` and `capabilities` are **already gated** — both require `v_is_self OR person_step_visible_to(viewer, step)` on the backing step(s).
  - `circle` (mutuals + crew) is returned with **NO visibility gate** — always shown to anyone who can load the profile. *This is the most surprising leak.*
- **Existing privacy columns** on `profiles`: `profile_public` (bool, default **false** = opt-in), `default_step_visibility`, `allow_peer_visibility`, `allow_follower_sharing`, `default_location_precision`. Plus `user_preferences.interest_visibility_defaults` (per-interest step-visibility map). Service: `services/PrivacySettingsService.ts`; UI: `app/settings/privacy.tsx` (sections PROFILE / PROGRAMS / DEFAULTS / PER-INTEREST DEFAULTS).
- **No section-level toggles exist.** No "show concepts / show circle / show orgs / show blueprints" flags anywhere.
- **Two profile routes** (see "Related: route consolidation" below): `app/profile/[userId]` (native canonical public face) and `app/person/[userId]` (landing/web discovery page with orgs, blueprints, subscriber stats). The `/person/` page surfaces orgs + published blueprints that the native public face does not, and has its own (un-spec'd) gating.

## The model

Two new groups of controls, both stored on `profiles` (alongside the existing privacy columns) and both honored by the read path.

### A. Section visibility (what appears)

Each is a boolean; default chosen to be conservative-but-useful. A section is rendered only if `profile_public = true` AND its section flag is true AND it has data the viewer is allowed to see.

| Flag | Controls | Default |
|---|---|---|
| `show_framing` | Bio / framing line | true |
| `show_working_on_now` | Working-on-now concept + concept history | true |
| `show_capabilities` | Capability map + evidence | true |
| `show_practice_timeline` | Settled/in-progress step timeline | true |
| `show_practice_circle` | Crew + mutual follows | **false** |
| `show_orgs` | Orgs & groups membership (on `/person/`) | **false** |
| `show_published_blueprints` | Authored/published blueprints (on `/person/`) | true |
| `show_events` | Race/event results (currently demo-only) | true |

Hero (name, avatar, primary descriptor) is always shown when `profile_public = true` — it is the identity layer and is not independently toggleable in v1.

Rationale for the two `false` defaults: the **practice circle** exposes *other people's* identities (your crew/mutuals) — that's second-party data and should be opt-in. **Orgs/groups** can be sensitive affiliation (employer/school/club) and should be opt-in.

### B. Interaction permissions (what others can do)

| Flag | Controls | Default |
|---|---|---|
| `allow_follow` | "Follow" button | true |
| `allow_message` | Message/DM icon in hero (`onMessage` → direct crew thread) | true |
| `allow_suggest_step` | "Suggest a step" composer | true |
| `allow_reflect` | "Reflect" peer-reflection CTA (currently a stub) | true |

Note `allow_follower_sharing` and `allow_peer_visibility` already exist and govern *step* sharing to followers/peers — keep them; the new `allow_*` flags govern the *public-face CTAs* specifically and are orthogonal.

### Interaction with per-step visibility (do NOT break this)

Per-step visibility stays authoritative for *row-level* content. Example: `show_practice_timeline = true` but a given step is `private` → that step still doesn't appear. The section flag is an AND gate on top, never an override. The RPC's existing `person_step_visible_to` checks remain in place; section flags are checked *before* assembling each section.

## Data model changes

Add to `profiles` (one migration, all `DEFAULT` as above, `NOT NULL`):

```
show_framing, show_working_on_now, show_capabilities, show_practice_timeline,
show_practice_circle, show_orgs, show_published_blueprints, show_events,
allow_follow, allow_message, allow_suggest_step, allow_reflect  -- all boolean
```

RLS: these are read inside the `SECURITY DEFINER` RPC, so no new SELECT policy is needed for the read path; the owner updates them via the existing profile-update policy. Wrap any `auth.uid()` as `(SELECT auth.uid())` per repo convention.

## Read-path changes

### `get_person_public_face` RPC (new migration)

1. Load the new flags into locals at the top (single `SELECT ... INTO` from `profiles`).
2. Gate each block: skip building `concept` if `NOT show_working_on_now`, `capabilities` if `NOT show_capabilities`, etc. **Self-view (`v_is_self`) bypasses section flags** so the owner always previews their full face.
3. **Fix the circle leak**: wrap the `circle` block in `v_is_self OR show_practice_circle`.
4. Return interaction flags in the payload so the client can hide CTAs: add an `interactions` key `{ allowFollow, allowMessage, allowSuggestStep, allowReflect }`.

### `PublicFaceScreen.tsx`

- Read the new `interactions` from `usePersonPublicSections`; conditionally render the Follow pill, Message icon (`MessageIconButton`), "Suggest a step", and "Reflect" CTAs.
- Sections already render conditionally on data presence; with the RPC gating, hidden sections simply arrive empty/null and disappear — minimal client change beyond the CTA gating.

### `/person/[userId]` (orgs + blueprints)

Honor `show_orgs` and `show_published_blueprints` here, since those sections live on this route, not the native face. Until route consolidation (below), this is a second read site to keep in sync.

## Settings UI changes

Extend `app/settings/privacy.tsx` and `PrivacySettingsService`:

- New `ProfilePrivacySettings` fields for all flags above; add to the `select` list and the `DEFAULT_SETTINGS`.
- New settings sections:
  - **"On my public face"** — the 8 section toggles, each disabled (greyed) when `profile_public = false`, with a one-line subtitle each.
  - **"Who can interact"** — the 4 interaction toggles.
- Add a **"Preview as public"** button that opens `/profile/{me}` in a viewer-context (not self) so the user sees exactly what a stranger sees. This is the single most important affordance — it replaces having to reason about 12 switches.

## Defaults & migration posture

- New columns ship with the table-level defaults above, so **existing users** inherit them immediately. The two `false` defaults (`show_practice_circle`, `show_orgs`) mean we are *tightening* visibility for existing public profiles — acceptable and desirable (closes the circle leak), but call it out in any release note.
- No backfill needed; defaults apply to all rows.
- `profile_public` default stays `false` (per `PHASE_N_PROFILE_PUBLIC_DEFAULT_FIX_SPEC.md`); section flags are moot while a profile is private.

## Related: Discuss / Reflect / Message disambiguation (fold into commit 3)

Three distinct comms concepts currently share two chat-bubble icons — fix the naming/iconography while we're in this surface:

| Concept | Wiring | Scope | Status |
|---|---|---|---|
| **Message** (hero icon) | `onMessage` → `CrewThreadService.getOrCreateDirectThread` → `/crew-thread/{id}` | Private 1:1 DM with the person | Live |
| **Reflect** (secondary CTA, `chatbubble-outline`) | stub: `showAlert('Peer reflections are coming soon')` | A peer note/endorsement on *their practice* | **Stub** |
| **Discuss** (Plan/Do/Review/**Discuss** band; "Published" thread rows) | `/practice/step/{id}/discussion` | Threaded discussion on a *specific step* | Live |

Fixes: give Reflect a distinct icon (not the same bubble as Message); ensure copy makes the object clear ("Message Kevin" vs "Reflect on Kevin's practice" vs "Discuss this step"). Gate Message behind `allow_message`, Reflect behind `allow_reflect`.

## Related: `/person` vs `/profile` route consolidation (deferred, not this spec)

`app/person/[userId]` (landing/web discovery, orgs + blueprints + subscriber stats, sample-data for slugs) and `app/profile/[userId]` (native canonical public face) both render "working on now" from *different data paths* — drift risk. The intentional split is "web shareable discovery page" vs "native credential surface," but the duplicated content should converge on one source of truth. **Recommendation (separate spec):** `/person/` becomes a thin web shell that renders the same `get_person_public_face` data (plus its catalog/marketing chrome), so section/interaction flags are honored in exactly one place. Out of scope here; flagged so the second read site in "Read-path changes" is understood as temporary.

## Commits

1. **Migration** — add the 12 boolean columns to `profiles` with defaults.
2. **RPC + service** — gate sections in `get_person_public_face` (incl. circle-leak fix), return `interactions`; extend `PrivacySettingsService` types/read/defaults.
3. **Client** — `PublicFaceScreen` CTA gating + Discuss/Reflect/Message disambiguation; `/person/` orgs/blueprints gating.
4. **Settings UI** — new toggle sections + "Preview as public" button.

## Open questions

- Should `show_practice_circle` expose a *count* even when hidden (e.g. "trains with a crew") for social proof without naming people? (Lean: no in v1.)
- Per-interest section visibility (e.g. show capabilities for Sailing but not Drawing)? The per-interest step-default infra exists (`interest_visibility_defaults`) but section-by-interest is a bigger model change — defer.
- Does `allow_message` apply to existing threads (already-connected crew) or only new ones? (Lean: gate only *new* thread creation from the public face; existing crew threads are unaffected.)
