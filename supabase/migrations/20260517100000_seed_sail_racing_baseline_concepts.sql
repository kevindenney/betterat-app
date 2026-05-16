-- Seed platform_baseline concepts for the Sail Racing interest so the
-- "Add from Playbook" picker (Concepts tab) has something to show out of
-- the box for any sailor whose personal Playbook is empty.
--
-- Baselines are rows with playbook_id IS NULL + user_id IS NULL and the
-- read query in PlaybookService.getConcepts() picks them up via:
--   WHERE playbook_id = $1 OR (playbook_id IS NULL AND interest_id = $2)
--
-- Idempotent: each insert is gated on NOT EXISTS so the migration can be
-- re-run safely. The (playbook_id, slug) unique constraint does not block
-- duplicate NULL playbook_id rows because NULLs are distinct under UNIQUE.

DO $$
DECLARE
  v_sail_id uuid;
BEGIN
  SELECT id INTO v_sail_id FROM interests WHERE slug = 'sail-racing' LIMIT 1;

  IF v_sail_id IS NULL THEN
    RAISE NOTICE 'sail-racing interest not found, skipping baseline concept seed';
    RETURN;
  END IF;

  -- 1. Layline naming
  INSERT INTO playbook_concepts (playbook_id, user_id, interest_id, origin, slug, title, body_md, tags)
  SELECT NULL, NULL, v_sail_id, 'platform_baseline', 'laylines',
    'Laylines',
    E'## Laylines\n\nThe layline is the straight-line course you can sail on one tack that just fetches the windward (or leeward) mark. Cross it and you have overstood — extra distance for no gain.\n\n### Naming convention\n- **Port layline** is the layline on the **left** side of the course looking upwind. Boats reach it on starboard tack.\n- **Starboard layline** is the layline on the **right** side of the course looking upwind. Boats reach it on port tack.\n\nLaylines are named for the side of the course, not the tack. They sit at roughly 45° to the true wind for a typical upwind boat.\n\n### Rules of thumb\n- Hit the layline as **late as possible**. Early arrival = no leverage and no ability to use shifts.\n- In current, the geometry shifts: aim slightly **above the visual layline** when the current is pushing you away from the mark.\n- The boat on the inside of the layline at the mark has the rights to round inside the zone (Rule 18).',
    '["fundamentals","upwind","tactics"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM playbook_concepts WHERE playbook_id IS NULL AND interest_id = v_sail_id AND slug = 'laylines'
  );

  -- 2. Tack directions
  INSERT INTO playbook_concepts (playbook_id, user_id, interest_id, origin, slug, title, body_md, tags)
  SELECT NULL, NULL, v_sail_id, 'platform_baseline', 'tack-directions',
    'Port Tack vs Starboard Tack',
    E'## Port Tack vs Starboard Tack\n\nThe tack you are on is named for the side the wind is coming **over**, not the side you are heading toward.\n\n### Looking upwind\n- **Port tack**: wind over the port (left) side. The boom is to **starboard**, you are heading toward the **right** side of the course.\n- **Starboard tack**: wind over the starboard (right) side. The boom is to **port**, you are heading toward the **left** side of the course.\n\n### Right of way (Rule 10)\nWhen two boats are on opposite tacks, the **starboard-tack boat has right of way**. Port tack must keep clear — usually by tacking, bearing away to duck, or calling for room if entitled.\n\n### Memory hook\n- Wind on the left → port tack → "port wine is red, red is left."\n- The tack name = the side the wind comes **over**, the side you point **away from**.',
    '["fundamentals","rules","upwind"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM playbook_concepts WHERE playbook_id IS NULL AND interest_id = v_sail_id AND slug = 'tack-directions'
  );

  -- 3. Wind & current direction conventions
  INSERT INTO playbook_concepts (playbook_id, user_id, interest_id, origin, slug, title, body_md, tags)
  SELECT NULL, NULL, v_sail_id, 'platform_baseline', 'wind-current-conventions',
    'Wind & Current Direction Conventions',
    E'## Wind & Current Direction Conventions\n\nThese three are reported with **different reference points** — getting them mixed up is one of the most common cockpit-to-cockpit miscommunications.\n\n| Element | Direction is | Example |\n|---|---|---|\n| Wind | The direction it **comes FROM** | "Wind 270" = wind from the west, blowing toward the east |\n| Current | The direction it **flows TOWARD** | "Current 090" = current setting toward the east |\n| Waves / swell | The direction they **come FROM** | "Swell 180" = swell from the south |\n\n### Why it matters\nWhen translating between forecasts and tactics, **add 180°** to convert wind-from to wind-toward or vice versa. A "northerly" wind is blowing south; a "north-setting" current is flowing north.\n\n### Practical check\nLook at the windward mark. The wind is coming **from the direction the mark sits** (roughly). If you have to mentally flip that to read your forecast, you have a convention mismatch.',
    '["fundamentals","weather","communication"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM playbook_concepts WHERE playbook_id IS NULL AND interest_id = v_sail_id AND slug = 'wind-current-conventions'
  );

  -- 4. Favored side & lifted tack
  INSERT INTO playbook_concepts (playbook_id, user_id, interest_id, origin, slug, title, body_md, tags)
  SELECT NULL, NULL, v_sail_id, 'platform_baseline', 'favored-side-lifted-tack',
    'Playing the Favored Side',
    E'## Playing the Favored Side\n\nUpwind, the side of the course with **more pressure, a persistent lift, or a current advantage** is the favored side. The fleet that sails to the favored side first usually wins the beat.\n\n### Vocabulary\n- **Lifted tack**: the tack on which the wind has shifted in your favor — you can point higher than your normal close-hauled angle. Stay on the lifted tack.\n- **Headed tack**: the opposite — wind shifted against you. Tack onto the lift.\n- **Play the right / play the left**: tactical shorthand for committing to a side, usually because of pressure, geography, or a forecast shift.\n\n### How to read it pre-start\n1. Sail the starting line on each tack and note your compass heading.\n2. Compare to your boat\'s known close-hauled angles in this wind.\n3. The side that gives you the higher heading is the lifted side **right now**.\n4. Note the trend over 5–10 minutes — is the wind oscillating or persistently shifting?\n\n### Pitfalls\n- "The favored side" is not a side of the **course**. It is a side of the **wind**. If the wind clocks 20° during the race, the favored side flips.\n- Boats on the layline cannot react to shifts. Save laylines for the last 1/3 of the beat.',
    '["tactics","upwind","wind"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM playbook_concepts WHERE playbook_id IS NULL AND interest_id = v_sail_id AND slug = 'favored-side-lifted-tack'
  );

  -- 5. Current strategy
  INSERT INTO playbook_concepts (playbook_id, user_id, interest_id, origin, slug, title, body_md, tags)
  SELECT NULL, NULL, v_sail_id, 'platform_baseline', 'current-strategy-upstream-first',
    'Current Strategy: Sail Upstream First',
    E'## Current Strategy: Sail Upstream First\n\nWhen there is significant current on the course, the side that points **toward the source of the current** is favored. Sail to that side first.\n\n### Why\nCurrent does not give you a lift in the wind sense — it does not change the angle the wind makes to your sails. What it changes is your **track over the ground**. Sailing upstream first means:\n- You arrive at the layline with more leverage if the current pushes you toward the mark.\n- If you wait, current sweeps you below the layline and you have to overstand to compensate.\n\n### Practical example\nWindward mark is to the north. Current flows from west to east (setting east). The upstream side is **west**. Sail to the west side of the course first; you will arrive at the windward mark with the current carrying you toward the layline instead of away from it.\n\n### What current does NOT do\n- It does not give you a wind lift or header.\n- It does not change your pointing angle through the water.\n- It only changes your COG (course over ground) and your effective distance to the mark.',
    '["tactics","current","upwind"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM playbook_concepts WHERE playbook_id IS NULL AND interest_id = v_sail_id AND slug = 'current-strategy-upstream-first'
  );

  -- 6. Pre-start sequence
  INSERT INTO playbook_concepts (playbook_id, user_id, interest_id, origin, slug, title, body_md, tags)
  SELECT NULL, NULL, v_sail_id, 'platform_baseline', 'pre-start-sequence',
    'Pre-Start Sequence',
    E'## Pre-Start Sequence\n\nMost dinghy and keelboat fleets use a 5-minute starting sequence. Knowing exactly what happens at each signal lets you plan position, time, and acceleration.\n\n### Standard 5-minute sequence (Rule 26)\n| Time | Flag | Sound | What you do |\n|---|---|---|---|\n| -5:00 | Class flag up | 1 horn | Warning. Sail past the line, check current set, note line bias |\n| -4:00 | P / I / Z / Black up | 1 horn | Preparatory. Penalty flag is now in effect |\n| -1:00 | Preparatory down | 1 long horn | One-minute. Final approach window. Penalty flags get strict |\n| 0:00 | Class flag down | 1 horn | Start. Be at the line, on close-hauled, at full speed |\n\n### Tactical priorities\n1. **Line bias**: head into the wind in the middle of the line. The bow points toward the favored end.\n2. **Time-to-burn**: at 1 minute, set yourself one minute upwind of the line at 1.5x boat lengths/sec.\n3. **Hole defense**: at 30 seconds, hold a gap to leeward by luffing. Burn the gap, then accelerate.\n4. **Penalty flag awareness**: P flag = round-the-ends if OCS. I = one-minute rule. Z = 20% scoring penalty. Black = DSQ, no restart.\n\n### The single biggest mistake\nStarting on time but with **no speed** because you held position too long. Better to be 5 seconds late at full speed than on time stopped.',
    '["start","tactics","rules"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM playbook_concepts WHERE playbook_id IS NULL AND interest_id = v_sail_id AND slug = 'pre-start-sequence'
  );

  -- 7. Mark roundings — wide-in tight-out
  INSERT INTO playbook_concepts (playbook_id, user_id, interest_id, origin, slug, title, body_md, tags)
  SELECT NULL, NULL, v_sail_id, 'platform_baseline', 'mark-roundings-wide-in-tight-out',
    'Mark Roundings: Wide In, Tight Out',
    E'## Mark Roundings: Wide In, Tight Out\n\nThe fastest rounding is rarely the tightest one. "Wide in, tight out" gives you a wider radius, more speed through the turn, and the inside lane on exit.\n\n### Windward mark (port roundings)\n- Approach on starboard layline ~1.5 boat lengths to leeward of a pinch line.\n- As you reach the mark, ease sheets slightly, start the bear-away.\n- Exit the rounding with the mark **just off your hip**, sheets in for the reach/run.\n- You should be sailing the new course at speed within 2 boat lengths of the mark.\n\n### Leeward mark\nThis is where wide-in, tight-out matters most.\n- Approach **wide** — 2-3 boat lengths to windward of the layline to the mark.\n- Carve in so you finish the turn with the mark **inches off your leeward quarter** and the boat already close-hauled.\n- The boat that goes wide-in, tight-out exits with right of way over boats that took the tight-in line and are now pinching to clear the mark.\n\n### Zone rules (Rule 18)\nThe zone is 3 boat lengths from the mark. The inside boat at the zone entry has the right to room. Plan your approach so you arrive at the zone with overlap on the inside.',
    '["tactics","marks","boat-handling"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM playbook_concepts WHERE playbook_id IS NULL AND interest_id = v_sail_id AND slug = 'mark-roundings-wide-in-tight-out'
  );

  -- 8. Oscillating vs persistent shifts
  INSERT INTO playbook_concepts (playbook_id, user_id, interest_id, origin, slug, title, body_md, tags)
  SELECT NULL, NULL, v_sail_id, 'platform_baseline', 'oscillating-vs-persistent-shifts',
    'Oscillating vs Persistent Shifts',
    E'## Oscillating vs Persistent Shifts\n\nWind shifts come in two patterns. The right tactic depends on which one you are in.\n\n### Oscillating shifts\nThe wind swings back and forth around a mean direction, usually on a regular cycle (every 2-8 minutes).\n\n- **Tactic**: tack on the headers, sail the lifts.\n- **Setup**: stay near the middle of the course. Avoid laylines until the last 1/3 of the beat.\n- **Trigger to tack**: your heading drops 5-10° below the average for this leg.\n- **Common cause**: thermal flow, gusty conditions, unstable boundary layer.\n\n### Persistent shifts\nThe wind clocks (or backs) in one direction over the course of a leg, without coming back.\n\n- **Tactic**: get to the side the wind is shifting **toward** as early as possible.\n- **Setup**: commit to the favored side. Sail past the rhumb line.\n- **Trigger to commit**: forecast says the breeze will clock 20° in the next 30 minutes, or you observe the trend over multiple minutes.\n- **Common cause**: frontal passage, sea breeze building or dying, geographic channeling.\n\n### How to tell them apart\n- Log your heading on each tack every 2 minutes for the first 10 minutes of the race.\n- If the numbers oscillate around a mean: oscillating.\n- If the numbers trend in one direction: persistent.\n\n### The trap\nApplying oscillating tactics (tack on headers) inside a persistent shift = you tack onto a header that just keeps getting worse. Read the pattern first.',
    '["tactics","wind","upwind"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM playbook_concepts WHERE playbook_id IS NULL AND interest_id = v_sail_id AND slug = 'oscillating-vs-persistent-shifts'
  );

END $$;
