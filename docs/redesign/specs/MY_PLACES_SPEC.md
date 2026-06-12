# My Places — frequented locations with interior detail

**Status:** Draft for review · 2026-06-12
**Surface:** Atlas + step Where picker · all interests (persona-generic)
**Explicit non-goal:** indoor mapping. We never draw floor plans, room polygons, or
sub-place geometry. Interior detail is a *named list*, not a map.

## 1. Why

A practitioner's activity concentrates at a handful of places, and within each
place at a handful of *spots*:

| Persona | Place | Spots inside it |
| --- | --- | --- |
| Sail racer | Home | office, rooftop, family room |
| Sail racer | RHKYC Kellett Island | sailing office, shipstore, gym, restaurant, boatyard, docks |
| Sail racer | RHKYC Middle Island / Port Shelter | dinghy park, race office, launch ramp |
| Nursing student | Johns Hopkins Hospital | 4 South, sim lab, OR 6, nurses' station |
| Golfer | Home course | range, putting green, holes 1–18, pro shop |
| Rural entrepreneur | Bero haat / own store | vegetable row, storage shed, counter |

Today the map flattens all of this to a single lat/lng. Steps logged "at RHKYC"
lose the boatyard-vs-gym distinction that makes the record meaningful, and the
Where picker makes the user re-find the same place every time.

The map's job stays "where on earth"; **spots make the record and the picker
smarter, not the map deeper.**

## 2. Model

Two-level hierarchy, collected from the user, never synthesized:

- **Place** — a location the user declares as theirs. Either a pointer to an
  existing `atlas_pois` row (RHKYC, JHH — don't duplicate canonical POIs) or a
  free-standing private point (Home).
- **Spot** — a named interior/part of a place. `name` + optional note + optional
  photo. **No geometry whatsoever** — a spot inherits its parent's pin.

### Tables

```sql
CREATE TABLE my_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  poi_id uuid REFERENCES atlas_pois(id),   -- set when place IS a canonical POI
  name text NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  icon text NOT NULL DEFAULT 'pin',        -- 'home' | 'club' | 'water' | 'site' | 'store' | 'course' | 'pin'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, poi_id)
);

CREATE TABLE place_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES my_places(id) ON DELETE CASCADE,
  name text NOT NULL,
  note text,
  photo_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- No `interest_slug` on places: Home serves sailing, drawing, and fitness alike.
  The place list is per-user, not per-interest.
- RLS: owner-only on both tables (`user_id = (SELECT auth.uid())`, spots via
  parent join). **Never** surfaced to peers, Nearby, or org admins. Home
  coordinates are exactly the data the Nearby privacy work fail-closes around.

### Step linkage

`metadata.plan.where_location` (the editable location, per existing convention)
gains two optional ids:

```jsonc
{ "lat": …, "lng": …, "name": "RHKYC Kellett Island", "my_place_id": "…", "spot_id": "…" }
```

Existing readers ignore unknown keys — no migration of old steps. "Steps at this
spot" = count of own steps whose `where_location.spot_id` matches.

## 3. Collection — at the moment of intent, never as a chore

No "set up your places" wizard. Places accrete from real use:

1. **Where picker, after a pick** (`PlanWhereCard` / Atlas picker result): one
   inline affordance — "☆ Save as a place". If the pick lands within ~150m of an
   existing my_place, the affordance becomes "Add a spot at {place}" with a
   single text field. (Inline, not a sheet — per the inline-capture-over-modal
   rule.)
2. **Atlas long-press** (existing drop-pin flow): add "Add to My Places" beside
   the existing actions.
3. **Place sheet** (own-place pin tap): "+ Add a spot" row at the end of the
   spot list.
4. **Smart prompt (later, optional):** third completed step within 150m of the
   same unsaved point → one-time "You're here a lot — save as a place?" line in
   the review flow. Never a popup.

## 4. Surfaces

### Where picker — the biggest win
A "Your places" section ABOVE geocoder results: place rows expand their spots
("RHKYC Kellett Island → boatyard · docks · gym…"). Picking a spot writes
parent lat/lng + both ids + display name "{Place} · {spot}". Two taps to say
"boatyard at Kellett Island" — today that's untypeable.

### Atlas
- One new `AtlasPinSpec` kind `my-place`: small neutral keyline pin with the
  place icon, rendered in **every frame** (places are cross-interest), below
  step pins in z-order. New marker's press handler MUST stamp
  `lastPinTapAtRef` (iOS double-fire rule).
- Tapping opens the **place sheet** (existing BottomSheet plumbing): place name,
  then a card list of spots ranked by own-step count — "Boatyard · 12 steps ·
  last Tue", photo thumbnail if set. This list IS the "visualize the interior"
  answer: ranked evidence of where life actually happens, not a floor plan.
- Spots never render on the map.

### Practice / step detail
Where line renders "{Place} · {spot}" when ids resolve. Tapping it opens Atlas
focused on the place (existing focus path).

## 5. Build order

| Phase | Scope | Verify |
| --- | --- | --- |
| MP.1 | Migration + RLS + `useMyPlaces` / `usePlaceSpots` CRUD hooks (add to mutation invalidation lists) | RLS as two users |
| MP.2 | Where picker: "Your places" section + save-as-place / add-spot affordances + `where_location` ids | sim: two-tap spot pick lands on step |
| MP.3 | Atlas `my-place` pin + place sheet spot list (ranked by step count) + add-spot row | sim: pin tap → sheet; tap-stamp rule |
| MP.4 | Long-press "Add to My Places" | sim |
| MP.5 (later) | Smart save prompt; org-published spots (club declares boatyard/docks for all members — authority-axis, consent-gated); rotation-site integration for nursing | — |

## 6. Open questions

1. **Icon vocabulary** — fixed small set (above) or free emoji? Recommend fixed
   set v1; it keeps pins legible.
2. **Spot photos** — reuse the evidence upload bucket or a dedicated one?
   Recommend reuse with `place-spot/` prefix.
3. **Sharing posture** — places are private forever in v1. The org-published
   variant (MP.5) is the only sharing path; per-place "share with crew" is
   explicitly deferred until someone asks for it.
4. **Precision interplay** — when a step at a my_place is shared, the existing
   'site'-snap privacy machinery applies unchanged (place ≈ site). Confirm no
   new leak path in MP.2 review.
