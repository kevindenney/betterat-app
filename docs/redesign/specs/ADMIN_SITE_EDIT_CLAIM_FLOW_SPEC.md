# Admin · Site Edit & Claim Flow — Spec

> Status: spec only (not built). Companion to the existing read-only
> `app/admin/[orgId]/sites/index.tsx` + `[poiId].tsx`.

## Why

Today an org admin can **see** their curated sites but cannot **modify** them.
The per-row "**…**" affordance on the Sites list is decorative — it just opens
the read-only detail page. The detail page has no edit control. "Site-level
precision locked" is a *privacy* label (healthcare sites snap to site-level
precision), not an editability state. To change anything an admin must edit
`atlas_pois` directly in the database.

Sites are load-bearing in two places, which is exactly why editing matters:

1. **Atlas** — `atlas_pois` rows render as pins on the map (the "where" lens).
2. **Steps** — a step is located at a site via `step_location.poi_id`; the site
   detail page's whole activity rollup (`admin_site_activity`) is "steps located
   here." A wrong coordinate or name propagates to every located step.

## Data model (today)

`atlas_pois` columns in play: `id, name, kind, lat, lng, source,
is_healthcare_site, interest_slug, metadata (jsonb), claimed_by_org_id,
created_at`. An org "owns" a site through `claimed_by_org_id`. The admin list
filters on `claimed_by_org_id = orgId` (`useAdminOrgSites.ts:49`).

There is **no** write path (no claim RPC, no update mutation, no insert sheet).

## Scope

Three capabilities, smallest-first:

### A. Edit an existing claimed site (primary ask — "how to modify sites?")
- Entry: turn the decorative "…" on each `SiteRow` into a real menu →
  **Edit**, **Move pin**, **Unclaim** (+ **View on Atlas**). On the detail page,
  add an **Edit** action in the `StudioHeader` actions slot (mirrors the
  existing "Back to Sites" ghost button).
- Editable fields: `name`, `kind`, `is_healthcare_site`, the curated
  `metadata` keys actually surfaced today (`city`, `role`/`partner_role`,
  `curated_label`, `curated`), and `lat`/`lng` ("Move pin").
- **Precision rule preserved**: when `is_healthcare_site = true`, the coordinate
  editor is locked to site-level granularity (no exact-coord entry) — this is
  the existing "site-level precision locked" contract, not a bug to remove.
- Guardrail: editing coords mutates where every located step shows on Atlas.
  Show an inline count ("N located steps will move with this pin", from the
  `admin_site_activity` stats already loaded) before confirming a pin move.

### B. Claim an existing unclaimed POI
- The file header already names this as the intended future: a "Claim a new
  site" sheet parallel to `AddPersonSheet`.
- Flow: search `atlas_pois` where `claimed_by_org_id is null` (by name/city/
  kind, near the org's locations) → preview → **Claim** sets
  `claimed_by_org_id = orgId`. Non-destructive; **Unclaim** nulls it back.

### C. Create a brand-new POI (claim-by-create)
- When search finds nothing, "Add a new place": name + kind + drop-a-pin (map)
  + healthcare toggle, inserts an `atlas_pois` row with `claimed_by_org_id =
  orgId`, `source = 'org_admin'`. De-dupe warn on near-coincident existing pins.

## Write layer

All writes go through a **SECURITY DEFINER RPC gated by `is_org_admin_member`**
(the same gate `admin_org_calendar` / `admin_site_activity` already use), because
`atlas_pois` RLS won't let a member mutate a shared curated row:

- `admin_update_site(p_org_id, p_poi_id, p_patch jsonb)` — only mutates a POI
  whose `claimed_by_org_id = p_org_id`; whitelists the editable columns;
  enforces the healthcare precision rule server-side (round coords if
  `is_healthcare_site`).
- `admin_claim_site(p_org_id, p_poi_id)` / `admin_unclaim_site(...)`.
- `admin_create_site(p_org_id, p_name, p_kind, p_lat, p_lng, p_is_healthcare,
  p_metadata)` → returns new `poi_id`.

Client: a `useAdminSiteMutations(orgId)` hook (mirrors the pattern of other
admin hooks) exposing `update / claim / unclaim / create`, each invalidating
`['admin-org-sites', orgId]` and the per-site `admin_site_activity` key.

## UI surfaces to touch

- `app/admin/[orgId]/sites/index.tsx` — real "…" menu + a "Claim a place"
  primary action in `AdminShell.primaryAction` (parallels Calendar's "New
  event").
- `app/admin/[orgId]/sites/[poiId].tsx` — header **Edit** action → `EditSiteSheet`.
- New `components/admin/EditSiteSheet.tsx` and `ClaimSiteSheet.tsx`
  (parallel to `CreateOrgEventSheet.tsx`).

## Out of scope / deferred

- Bulk import of sites.
- Member-proposed sites (a member suggesting a place for an admin to claim).
- Editing POIs the org doesn't own (a global/curated site) — those stay
  read-only; the org can only claim, not rewrite, shared curation.
