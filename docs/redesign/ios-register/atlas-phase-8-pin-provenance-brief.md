# Atlas Phase 8 — Pin Provenance & Visibility

> Status: brief / proposal — not yet code.
> Sibling docs: `atlas-tab-brief.md` (overall Atlas vision)
> Authors: Kevin + Claude, 2026-05-25
> Frame coverage: F1 sailing (Felix · RHKYC), F4 nursing (Emily · JHU), F7 entrepreneur (Lakshmi · Khunti)

---

## The question this brief answers

When Lakshmi opens her Atlas tab and sees a pin for "Murhu supplier village," she should be able to answer four questions without leaving the map:

1. **Who put this here?** (me / someone I trust / an institution I subscribe to / the wider system)
2. **Why is it on my map?** (do I have a relationship to it, or is it suggested?)
3. **Can I hide it?** (yes — by source, by interest, by trust tier)
4. **Can I add my own?** (yes — and decide who else sees it)

Today we conflate all four. Every POI is rendered the same regardless of source; every peer-step appears at flat opacity regardless of relationship; there's no per-source filter. This brief proposes a four-source provenance model with explicit UI affordances.

---

## The four-source pin model

Every pin on the Atlas — POI or step — has exactly one `source_tier`:

| Tier | Glyph hint | Examples | Trust signal |
|---|---|---|---|
| **A · Mine** | Solid, brand-blue ring | Suppliers Lakshmi added · Felix's home club · Emily's logged shifts | "I put this here" |
| **B · Network** | Solid, brand-green ring | Asha's pinned mentee post · Felix's crewmate's regatta · Emily's cohort's clinical | "Someone I trust put this here" |
| **C · Institution** | Dashed gold ring | NGO blueprint POIs (KVIC suppliers) · JHU's clinical schedule · RHKYC's race calendar | "An org I subscribe to put this here" |
| **D · System** | Dotted gray ring | Government scheme markets · OpenStreetMap-imported anchors · community-validated pins | "The wider system put this here" |

Glyph + tone stays the same (a supplier square is always a square, a haat diamond is always a diamond). The **ring** carries source. This keeps shape grammar from Phase 1 intact while adding a parallel channel for provenance.

---

## Data model sketch

### `atlas_pois` — add columns

```sql
ALTER TABLE public.atlas_pois
  ADD COLUMN source_tier text NOT NULL DEFAULT 'system'
    CHECK (source_tier IN ('mine','network','institution','system')),
  ADD COLUMN owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN owner_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','followers','cohort','public')),
  ADD COLUMN derived_from_poi_id uuid REFERENCES public.atlas_pois(id) ON DELETE SET NULL;

-- partial index: most reads filter by tier + interest_slug
CREATE INDEX idx_atlas_pois_tier_interest
  ON public.atlas_pois (source_tier, interest_slug)
  WHERE deleted_at IS NULL;
```

Rules:
- `source_tier='mine'` → `owner_user_id` required, `owner_org_id` null
- `source_tier='network'` → `owner_user_id` of the network member who pinned it
- `source_tier='institution'` → `owner_org_id` required, `owner_user_id` null
- `source_tier='system'` → both null
- `derived_from_poi_id` lets us track "Lakshmi copied this from KVIC's blueprint to her own pins" without losing the trail back

### `atlas_pin_visibility` — derived view

A SECURITY DEFINER function that, given a viewing user, returns the pins they can see. The visibility rules:

| `source_tier` | Who sees it (by default) |
|---|---|
| `mine` | Owner only, unless `visibility=followers` (owner's followers) or `visibility=public` |
| `network` | The owner + the owner's followers (transitively, the viewer if they follow the owner) |
| `institution` | Members of the org, plus anyone subscribed to a blueprint that includes it |
| `system` | Everyone, scoped to interest_slug |

The peer-step RPC `atlas_peer_steps_near` should pull `source_tier` from the step's owner relationship to the viewer:
- step's `user_id = viewer` → tier `mine`
- step's `user_id` in viewer's `following_user_ids` → tier `network`
- step belongs to a cohort viewer is in → tier `institution`
- step is `visibility=public` and viewer has the matching interest → tier `system`

---

## UI affordances

### 1. Layers sheet — restructured by tier

Today the Layers sheet groups by *kind* (Haat / Suppliers / Mentees / Network). The proposal: two axes — **what** (kind) **and** **who** (tier). Default = all on except System.

```
LAYERS

What
  ☐ Haat              [green diamond]
  ☐ Suppliers         [white square]
  ☐ Mentees           [green dot]
  ☐ Network steps     [tinted dot]

Who
  ☐ Mine              [blue ring]
  ☐ Network           [green ring]
  ☐ NGOs I follow     [gold ring]   ← lists subscribed blueprint sources
    ↳ ☐ SEWA Bharat
    ↳ ☐ KVIC
  ☐ Wider system      [gray ring, default off]
```

### 2. Pin detail sheet — source line

Every pin sheet gets a one-line source attribution under the title:

```
SUPPLIER VILLAGE
Murhu supplier village                  [Bamboo · 14 km]
Added by Asha (network · last contact 12 days ago)
─────────────────────────────────────────
[ + Plan a sourcing run ]               [ Save to my pins ]
```

Behavior:
- **Mine** → "Your pin · added 4 weeks ago" + edit/delete icons
- **Network** → "Added by {name} ({relationship})" + tap to open their profile
- **Institution** → "From {org_name} · blueprint" + tap to open the blueprint detail
- **System** → "Community pin · {validation_count} confirmations"

### 3. Save-to-my-pins flow

Tier-promotion: tap "Save" on a network/institution/system pin → copies the POI into `atlas_pois` with `source_tier=mine` and `derived_from_poi_id` set. Now Lakshmi's pin survives even if Asha unpins hers or KVIC retires the blueprint.

### 4. Add-a-pin flow

Long-press the map (or use the FAB) → "Add a pin here" → modal:

```
ADD A PIN

Kind                  [Supplier ▾] [Haat] [Custom]
Name                  [______________________]
Visible to:           ○ Only me
                      ● My followers      (default)
                      ○ Cohort members
                      ○ Public

[ Cancel ]                                  [ Add pin ]
```

Default visibility = followers (mirrors how Instagram/WhatsApp norms feel — your pins are social-by-default but discoverable).

### 5. Network-step rendering at POI

When a follower (Asha) plans or completes a step at Murhu supplier village, render a small green-ringed satellite dot *attached to* the Murhu square pin, not as a free-floating peer pin. UX:

```
        ▢  ← Murhu (supplier, kind unchanged)
       /
      ●  ← Asha, planned Mon · tap to see
```

Tap the satellite → mini-sheet "Asha · planned sourcing run · Monday 9am · tap to see her step." This is what makes "people I follow are doing things near me" legible without polluting the base layer.

---

## Specific question answers (per F7 walkthrough 2026-05-25)

- **"Who put Murhu supplier village on the map?"** Today: seed. After Phase 8: source_tier=mine if Lakshmi added it, network if Asha did, institution if KVIC's blueprint did, system if validated by community.
- **"Where would Murhu detail come from?"** From the pin metadata blob (`craft`, `distance_km`, `last_contact_at`) + the source-attribution line. If `source_tier=network`, also link to the owner's profile and their last step at this POI.
- **"What is a mentee, why useful?"** A junior craftsperson Lakshmi mentors. The mentee pin is just a placement marker for *their most recent step*; tap → mini-step view + Route button. Useful because routing through their village on a sourcing run lets her drop materials + advise in-person.
- **"Would Asha's planned sourcing run to Murhu show on Lakshmi's atlas?"** Yes (Phase 8) — as a small green-ringed satellite dot on the Murhu square pin. Today, no (the RPC returns it as a generic following dot somewhere near the supplier, not glued to it).
- **"Would NGO blueprint pins show?"** Yes (Phase 8) — gold-ringed pins of the same shape grammar, toggled by which blueprints she subscribes to. Sibling system to how she follows people.

---

## Rollout order

1. **Phase 8.0 — DB groundwork** (1 migration)
   - Add `source_tier`, `owner_user_id`, `owner_org_id`, `visibility`, `derived_from_poi_id` columns
   - Backfill all existing rows: seeded → `system`, demo Lakshmi rows that match her user → `mine`
   - Add RLS policy on `atlas_pois` so users only see what their tier allows

2. **Phase 8.1 — render the source ring**
   - Update `AtlasPinSpec` to include `sourceTier`
   - Update marker components to render the colored ring
   - Update `useAtlasFramePins` to pass `source_tier` through

3. **Phase 8.2 — Layers sheet two-axis**
   - Add a Who section to the sheet
   - Default state per frame (F7: Mine + Network on; Institution = Lakshmi's followed NGOs auto-on; System off)
   - Wire toggles to pin filter

4. **Phase 8.3 — pin detail source line + Save**
   - Add attribution line to BottomSheet
   - Wire "Save to my pins" → POI copy with `derived_from_poi_id`

5. **Phase 8.4 — Add-a-pin flow**
   - Long-press → modal → insert with chosen visibility

6. **Phase 8.5 — Network-step satellites**
   - Update `atlas_peer_steps_near` to optionally cluster peer steps near POIs within 500m
   - Render satellite dots attached to parent POI

---

## What this brief is *not*

- Not a redesign of the four-source social model (Interest/Org/Program/People stays the canonical primitive).
- Not a step-status pass (planned/done/old timing — that's Phase A, separate brief).
- Not a re-skin of marker glyphs — kind glyphs stay, ring is additive.
- Not a moderation system — community-validated `system` pins need a separate trust/abuse model that's out of scope here.

---

## Open questions

- **Anti-spam for `system` tier:** if anyone can promote a pin to system, who validates? Probably needs a min-confirmations threshold + reputation score. Defer.
- **Cross-interest provenance:** if Lakshmi pins a market that's also relevant to Asha's separate "millet farming" interest, does it follow Asha's interest filter? Probably yes, with a `share_to_interests text[]` field — but defer until we have actual cross-interest demand.
- **Org blueprint POI lifecycle:** what happens to derived-from-blueprint pins when KVIC unpublishes the source? Keep with "archived source" badge, or auto-remove? Probably keep, with a small "no longer maintained" disclaimer.
