# Cross-Cutting UX/QA Audit — BetterAt

> Scope: the shared "spine" flows every persona uses. Audit-only (no code changes).
> Environments: native iOS sim (denneyke `d67f765e`, depth) + web (multi-persona, breadth).
> Date started: 2026-06-14. Author: Claude (Opus) walkthrough.
> Screenshots: `docs/audit/screens/`. Severity: **P0** blocks flow/data loss/crash · **P1** real friction most users hit · **P2** polish/visual.

---

## Executive summary

Eight shared-spine flows were walked end-to-end: native iOS at depth (sailor account), web for persona breadth (entrepreneur). **The spine is fundamentally sound** — the public face is the best surface in the app and realizes the BetterAt thesis (evidence-first, every capability backed by a quote + provenance + lifecycle badge). The recurring failure mode is **sailing-first assumptions leaking into a multi-persona product** (hardcoded sailing fields/labels degrade — sometimes gracefully by omission, sometimes as visible wrong vocab — for everyone who isn't a sailor), plus one true native rendering bug. The other recurring theme: **the app under-celebrates its own payoff** — the delight infra (TrophyScreen, useStepCompleteCelebration, haptics) is built but unsurfaced, so the moments that should feel rewarding are silent status flips.

**Top 5 fixes**
1. **P0 — Library "Add to Library" chooser renders no text on native iOS** (§5). The primary Library entry point is unusable; web proves it's a native Fabric layout collapse, so the fix is layout-only.
2. **P1 — Native first-open is a login wall** (§1). New users hit "Welcome back" instead of the good guest-first `/welcome`; the worst-placed first impression in the funnel.
3. **P1 — Public-face identity layer is sailing-hardcoded** (§7/§8). Non-sailors silently lose the descriptor + "where" block instead of getting an interest-native equivalent.
4. **P1 — Sailing vocab leaks into the entrepreneur Atlas** ("NEXT RACE · Khunti haat", §8) and into edit-profile / connected-devices (§6) — one missed binding on otherwise-localized surfaces.
5. **P1 — Follow relationship dials (favorite/notify/mute) have no surface** (§4) — the columns exist on `user_follows` but are unreachable from the profile.

**Top 5 signature-moment bets**
1. **Capability crosses into "Settled"** (§7) — *highest, infra-exists.* The core payoff; wire the existing Trophy + celebration infra to the evidence that settled it.
2. **Step completion beat** (§7) — ✅ *resolved.* The wired-but-dead blueprint trophy now fires (gate was checking `'completed'`; completion produces `'settled'`), every completion gets a success haptic, the celebration is now a transient moment (not a sticky view), and non-blueprint steps get a `variant='solo'` trophy.
3. **Resource capture → "your Librarian will surface this"** (§5) — *medium, infra-exists.* Closes the loop on the AI-recall promise the rotating prompt already makes.
4. **First sign-in → "what do you want to get better at?"** (§1) — *medium, net-new.* Turns a form-submit into the start of the practice loop.
5. **Auto-follow on blueprint adopt made visible** (§3/§4) — *low-medium, infra-exists.* Surface the connection forming at the moment it's earned.

**Coverage note:** native depth = sailor only; persona breadth = web entrepreneur only (demo personas have no native sign-in, `project_demo_persona_no_native_signin`). Nurse/student personas and native persona parity remain **unverified**. Out-of-scope unbuilt flows are in the Gaps appendix.

---

## 1. Auth (welcome / guest / signup / signin)
_status: **done (web guest-first + native first-open)** — 2026-06-14. Web `/welcome` observed live (screenshot not retained in repo — Chrome capture path not surfaced this session). Native first-open behavior per `project_native_ftue_login_wall`._

**Works?** — Functional on both platforms, but **the two platforms show different front doors**, and the better one only renders on web.

- **Web `/welcome` (guest-first, good):** animated "b" logo, "Skip intro", then the value proposition: **"BetterAt / Get better at the things you care about / A daily practice for the stuff you actually want to improve at."** A prominent blue **"Get started →"** CTA, the reassurance **"No account needed to start"**, and a secondary **"Have an account? Log in · Create an account"**. This is on-model: it leads with the promise and lets a visitor in without a wall.
- **Native first open (login wall, worse):** a fresh native install routes straight to `/(auth)/login` ("Welcome back") — the guest-first `/welcome` flow is effectively orphaned on native (`project_native_ftue_login_wall`; a fix prototype exists at `app/dev/ftue-mockup.tsx`). A brand-new user's first impression on the most "premium" surface (the app) is a sign-in form for an account they don't have yet.

**What's good (keep):**
- The web welcome copy is tight and benefit-led — "the things you care about", "the stuff you actually want to improve at" speaks to the user's goal, not the product's features.
- "No account needed to start" is exactly the right friction-remover for a daily-practice product.

**Findings:**

| Sev | Issue | Recommendation |
| --- | --- | --- |
| P1 | **Native first-open is a login wall, not the guest-first welcome.** The good `/welcome` intro (value prop + "no account needed") only renders on web; native sends a never-seen-before user to a "Welcome back" sign-in screen. This is the highest-stakes first impression in the funnel and it's inverted on the platform users perceive as the real product. | Route native first-open through `/welcome` (the prototype at `app/dev/ftue-mockup.tsx` is a starting point). At minimum, make the first native screen lead with the value prop + a guest/"get started" path, with "Log in" secondary. |
| P2 | **Demo personas have no native sign-in** (`project_demo_persona_no_native_signin`) — `/demo` magic-links eject to mobile web even on native. Not a bug for real users, but it blocks native persona walkthroughs and means any "try a persona" path is web-only. | Logged as a known constraint; relevant to QA/demo, not end-user funnel. No fix required for launch. |

**Signature-moment opportunity:**
- **First successful sign-in / account creation is an unmarked transition.** The moment someone commits to the product is a natural place for a small welcome beat ("Welcome to BetterAt — what do you want to get better at?") that flows directly into interest selection, turning a form-submit into the start of the practice loop. *Net-new* (no celebration infra wired here today), low cost. **Rank: medium / net-new.**

## 2. Interests (add / drop / switch)
_status: **done (native, denneyke)** — 2026-06-14. Screens: `screens/02_interests_*.png`_

**Works?** — Functional, end-to-end. Verified add → drop → fallback live in sim.
- **Add**: Discover tab → card `+ Add interest` adds instantly. ✅
- **Drop**: Yours tab → expanded card → `Remove` → confirm dialog → removed, count 12→11. ✅
- **Switch**: adding auto-switched active to the new interest; removing the active one auto-fell-back to another. ✅ (explicit `Set active` pill on JUMP BACK IN cards present but not tap-confirmable via AX-less tooling — **unverified**, not a known bug.)

**What's good (keep):**
- Destructive-action pattern is exemplary. Remove confirm reads _"Remove Health & Fitness from your interests? Your steps stay, but it leaves this list."_ — names the consequence and pre-empts data-loss anxiety. This phrasing should be the template for other destructive confirms in the app.
- Empty-state copy on a fresh interest card is warm and directive: _"No organizations or blueprints here yet — this interest is yours to build."_
- Yours/Discover split is the right mental model; counts (`11 added · 1 active`) are honest and live.

**Findings:**

| Sev | Issue | Recommendation |
| --- | --- | --- |
| P1 | **`EQUIPMENT` section is fixed vocab on every interest**, incl. "College & Career Planning" where "equipment" is semantically wrong. Violates interest-vernacular principle (`project_interest_vernacular_personas`). | Make the section label interest-aware (sailing→Equipment, college→Materials/Tools or hide; fitness→Gear). Hide entirely for interests with no equipment concept. |
| P1 | **Adding an interest silently auto-switches the active interest** to the just-added one. If a user is batch-adding from Discover, every add yanks their active context. No undo, no toast. | Decouple add from activate. Add should keep current active; offer an inline "Switch to it?" affordance. At minimum, confirm/toast the switch. |
| P2 | **`ORGANIZATIONS · YOU` header is misleading** — lists Brown/Dartmouth/Cornell as "Request to join" (suggested, not joined). The "· YOU" reads as orgs you belong to. | Rename to `ORGANIZATIONS · SUGGESTED` or `· NEARBY`; reserve "YOU" for joined orgs. |
| P2 | **Discover "grouped by domain" but everything is one "Other" group** — the grouping label promises structure it doesn't deliver. | Either populate real domain groups (Movement, Craft, Academic…) or drop the "grouped by domain" caption until groups exist. |
| P2 | **Double-negative empty copy** on Discover cards: "no organizations yet / no orgs joined yet" stacked. | Collapse to one line ("No organizations yet"). |

**Signature-moment opportunity:**
- **Adding an interest is a commitment beat rendered as a no-op.** A new interest = a person declaring "I want to get better at X" — the highest-intent moment in this flow, and it's silent. *Infra exists* (`lib/haptics.ts`, `hooks/useCardAnimations.ts`, Trophy variants). A brief card-flip + haptic + one-line "Welcome to your <interest> practice" would mark it. **Rank: high / infra-exists.**

## 3. Blueprints (adopt / drop)
_status: **done (native, denneyke)** — 2026-06-14. Screens: `screens/03_blueprint_*.png`_

**Works?** — Adopt functional; drop affordance present. Two real bugs found.
- **Adopt**: free blueprint → `Start this plan` → "You're subscribed" + incremental `Add Step 1` CTA. ✅ (Auto-add-interest-on-adopt is coded in `app/blueprint/[slug].tsx` but **unverified at runtime** here — denneyke already had the `lac-craft-business` interest, so the interest count didn't change.)
- **Drop**: paid blueprint shows an `Unsubscribe` text link; free post-adopt screen surfaces no unsubscribe in the first viewport (see P2 below). Affordance exists, full drop loop **partially verified**.

**What's good (keep):**
- `PLAN / DO / REVIEW / DISCUSS` phase band on the cover — matches the confirmed preference (`feedback_blueprint_phase_band_wanted`). Keep it.
- Free-blueprint adopt copy is excellent and honest: _"Steps land on your own timeline — adopt them one at a time, reorder, or skip. Nothing is locked. The blueprint author can see your progress on these steps."_ Sets the menu-not-calendar expectation (`feedback_plan_is_menu_not_calendar`) **and** discloses author visibility in one breath.
- `Demo data` badge on the author chip (PRADAN — Khunti Unit) is a nice honesty touch.
- Free vs paid CTA vocab is well differentiated: free = "Start this plan"; paid = price + "Subscribed/Unsubscribe".
- Entrepreneur-persona step content is genuinely strong: WHY callouts ("An acknowledgement receipt is your only leverage if the bank loses your file"), concrete sub-steps. This is real value for the Indian-women-entrepreneur goal, not filler.

**Findings:**

| Sev | Issue | Recommendation |
| --- | --- | --- |
| **P1** | **Post-adopt progress shows "7/7 steps completed" with a full bar** the instant you subscribe — and every preview step renders a green "✓ Done" badge — while the screen simultaneously shows an `Add Step 1` CTA (steps not even on the timeline yet). The preview is rendering the **author's/template completion state as the new subscriber's progress**. Deeply misleading: the whole point is to *do* these steps. | Subscriber view must compute progress from the subscriber's own adopted-step status (0/7 on fresh adopt). Preview steps should read as "not started" / "preview", never "Done", until the subscriber completes them. |
| **P1** | **Two blueprint tables, only one wired.** Detail page (`app/blueprint/[slug].tsx` → `useBlueprint` → `getBlueprintBySlug`) reads `timeline_blueprints`. A separate `blueprints` table holds 21 "live" `seed-*` rows (one per persona interest: design, fitness, knitting, golf, etc.) that the detail page **cannot resolve** → deep-linking any `seed-*` slug 404s "Blueprint not found." Matches `project_wrong_table_binding_bugs` / `project_phase11_phase6_table_overlap`. | Decide the source of truth. If `timeline_blueprints` is canonical, migrate/retire the `blueprints` seed rows or stop seeding them; otherwise wire discovery to whichever table the detail page reads. Today the seed catalog is dead data. |
| P2 | **"Blueprints you follow" (Library) is a blank dead-end when empty** — `PLAYBOOK` eyebrow + title + subtitle, then nothing. No empty-state copy, no "discover blueprints" CTA. Contrast the warm Interests empty states. | Add an empty state with a Discover-blueprints CTA. |
| P2 | **Mixed terminology on the follow/adopt surfaces**: "Blueprints you **follow**" (title) + "**Subscribed** timelines you can **add**" (subtitle) + "**Start this plan**" / "**Unsubscribe**" (detail). Four verbs for one action. Terminology is load-bearing (`feedback_interest_terminology`). | Pick one verb pair for blueprints (recommend **adopt / drop** to match Interests, or **subscribe / unsubscribe** consistently) and use it everywhere. |
| P2 | **`PLAYBOOK` eyebrow inside the Library tab** — stale naming from the pending playbook→library rename (`project_playbook_to_library_rename`). | Fold into the rename pass. |
| P2 | **Paid blueprint shows "$49 · Buy once, yours forever" prominently even when already Subscribed.** Price block doesn't collapse to "Purchased". | Once subscribed/purchased, replace the price block with an owned state. |
| P2 | Paid blueprint shows two near-duplicate author chips: "MarkDemo Kiss · 9 steps" and "Mark Demo Kiss · Verified". Possible author/verifier dup or data dup. | Confirm intent; de-dup if it's one person. |

**Signature-moment opportunity:**
- **Adopt is the "I'm committing to this path" beat** and currently lands as a green inline banner. *Infra exists.* A blueprint adopt (especially a high-stakes one like a govt-loan pathway) deserves a brief celebratory confirm — "Your MUDRA loan plan is on your timeline. First step: check if you qualify." with haptic + the first step teed up. The data is already there (`Add Step 1` knows the first step). **Rank: medium-high / infra-exists.**

## 4. Follow / unfollow
_status: **done (native, denneyke)** — 2026-06-14. Screens: `screens/04_*.png`. Verified full loop live + DB._

**Works?** — Functional, full loop. Follow → "✓ Following" → Unfollow confirm → "+ Follow". DB writes/clears correctly (`user_follows`).

**What's good (keep):**
- Visual hierarchy is right: **Follow = blue primary CTA; Following = small grey secondary pill.** Done state correctly recedes.
- Unfollow confirm copy is reassuring: _"Unfollow Maya Patel? You can follow them again anytime."_ — removes the stakes from a reversible action.
- Action asymmetry is correct: Follow is one-tap (low stakes); Unfollow gates behind a confirm. Right call.

**Findings:**

| Sev | Issue | Recommendation |
| --- | --- | --- |
| P1 ✅ RESOLVED | **`is_favorite` / `notifications_enabled` / `is_muted` exist on `user_follows` but have NO surface on the person profile.** After following, there's no way to favorite, mute, or toggle notifications for that person from their profile. The relationship dials are unreachable here. | **Done:** the "Following" pill now opens an `IOSActionSheet` (favorite / notifications / mute / unfollow). Wired to the toggles `useSailorFullProfile` already exposed. |
| P2 ✅ RESOLVED | **No optimistic UI on follow** — tap shows a spinner for the full network round-trip (~2s observed) before flipping to "Following". | **Done:** follow/unfollow mutations now flip `isFollowing` in the cache via `onMutate` (revert on error). The pill switches instantly. |
| P2 ✅ RESOLVED | **Person profile is thin for a follow decision** — avatar (initials, no photo), name, Follow, and a 3-row "RECENT TRAJECTORY". No bio, interests, location, or mutual context. The trajectory rows also mix interests (nursing + drawing + golf for one person) with no interest labels. | **Done:** bio + primary interest already surfaced (#3 interests fallback). This pass adds follower-count + step-count meta pellets to the hero (`profile.followerCount` was already fetched; `stepCount` is a new visible-step count query) and labels each trajectory row with its interest name (steps query now embeds `interests(name, slug)` → row `sub`). *Code-verified; on-device unverified — idb couldn't drive the Max sim and demo peers are purged (sparse trajectory data).* |

**Signature-moment opportunity:**
- Follow is low-ceremony by design and that's fine. The richer beat is **auto-follow-on-blueprint-adopt** (§3): when adopting surfaces "now following <author>", that connection forming is the moment — surface it explicitly rather than silently. **Rank: low-medium / infra-exists.**

## 5. Library (link / document / concept)
_status: **done (native, denneyke)** — 2026-06-14. Screens: `screens/05_library_*.png`. Tested on the "College & Career Planning" interest._

**Works?** — Mostly functional, but the **entry chooser is visually broken** (P0). Downstream sheets (concept, resource) render correctly once reached. Link OG-autofill is present in UI but **runtime-unverified** (tooling: `idb text` triggered the dev menu instead of typing a URL).
- **Add chooser**: top-bar `+` opens an "Add to Library" modal with 4 routes (New step / New concept / Capture resource / Find a plan) — but **every row renders icon + chevron only, no title/subtitle text**, collapsed below their `minHeight`. See P0 below.
- **Add concept**: chooser → New concept sheet works (TITLE / BODY markdown / Cancel / Save render fine). ✅
- **Capture resource**: the resource `CaptureSheet` ("Add to your Library") is the strongest surface in this flow — Link/Upload/Photo/Paste modes, autofill NAME, interest-aware RELEVANT FOR chips, ATTACH TO Standalone/Concept/Step. ✅
- **Add link autofill**: URL field with `youtube.com, nejm.org, …` placeholder + "We'll fill this in" NAME promise present; **OG/oEmbed autofill not runtime-verified.**

**What's good (keep):**
- **Landing empty-state copy is excellent and directive** — each section explains itself: PLANS _"Follow a coach-bundled Plan from the stacks below to see it here."_; CONCEPTS _"Capture an insight from the universal + to start a concept."_; RESOURCES _"Articles, videos, drills you've saved to come back to."_ Warm, concrete, no dead blank zones. Template for other empty states.
- **The resource `CaptureSheet` is a model surface.** `RELEVANT FOR` renders real interest chips (College & Career Planning, Design, Drawing, Fitness, Global Health, Golf, Knitting, Lac Craft Business, Nursing, Sail Racing, Self-Mastery) with "Tagged for 1 interest." — genuinely interest-aware, the opposite of the sailing-hardcoded concept placeholder below. `ATTACH TO` (Standalone/Concept/Step) with _"It'll be added to your library either way — attaching links it as a starting source."_ discloses behavior in one line. Keep this pattern.
- **Yours / The stacks** split mirrors the Interests Yours/Discover model — consistent mental model across tabs.
- **Librarian prompt rotates** (`What keeps coming up in my notes?` → `Which idea haven't I tested?` → `What did my coach flag last time?`) — a live, inviting AI affordance rather than a static button.

**Findings:**

| Sev | Issue | Recommendation |
| --- | --- | --- |
| **P0 (native-only)** | **"Add to Library" chooser renders no text on native iOS** — all 4 routes show only an icon + chevron, rows collapsed below `minHeight: 68`. The single most important entry point to the whole Library flow is unusable by a sighted user who doesn't already know the row order. **Cross-platform cross-check: the identical chooser renders PERFECTLY on web** (all 4 rows show full title + subtitle — "New step / Plan something to do next.", "New concept / Capture a pattern, rule, or thing to remember.", "Capture resource / Save an article, video, note, or file.", "Find a plan / Follow a published blueprint."). So this is **not a data/logic bug and not a copy gap** — it's a **native Fabric text-layout collapse**: the `addChoiceText` child renders zero-height on native while web lays it out fine. Styles in `components/library/LibraryLanding.tsx` (`addChoiceTitle` color `IOS_COLORS.label`, `addChoiceText { flex: 1, minWidth: 0 }`) read as correct cross-platform, consistent with `feedback_fabric_multiline_input_fixed_height` / `feedback_flex0_zero_width_rnw`-class behavior diverging on native. | Reproduce in sim, inspect the native `addChoiceText` node height. Likely fix: give the text column an explicit `flexShrink: 1` (not `flex:1`) and/or an intrinsic min height so the row doesn't collapse on Fabric. Web confirms the fix is layout-only. P0 because it blocks the primary Library entry point on the flagship platform. |
| P2 | **New-concept TITLE placeholder is sailing vocab** — `e.g. Downwind trim in heavy air` shown while the active interest is "College & Career Planning." Violates interest-vernacular (`project_interest_vernacular_personas`). | Make the placeholder interest-aware (or generic: "e.g. a pattern, rule, or thing to remember"). The resource sheet already proves interest-aware chips are achievable here. |
| P2 | **Dev-only network LogBoxes during load** — `getSuggestedNextSteps` and `getMyFleetInvites` threw `TypeError: Network request failed` in the LogBox overlay, both handled gracefully (caught, return `[]`), no user-facing toast. Not a production bug, but noise that masks real errors during QA. | No user-facing action. Note for QA: these are transient/RLS-context network failures swallowed by service catches; confirm they don't silently empty real data in production. |

**Signature-moment opportunity:**
- **Capturing a resource is a "this is worth keeping" beat** and currently ends in a flat list insert. *Infra exists* (`lib/haptics.ts`, the Librarian). A brief "Saved — your Librarian will surface this when it's relevant" confirm with a haptic, tying the save to the AI recall promise the rotating prompt already makes, would close the loop between capture and payoff. **Rank: medium / infra-exists.**

## 6. Settings (9 sub-screens)
_status: **done (native, denneyke)** — 2026-06-14. Screens: `screens/06_settings_*.png`. Active interest during walkthrough: "College & Career Planning" (non-sailing) — surfaces the vocab issues below._

**Works?** — Split outcome. **6 of 9 screens are well-built and persona-neutral** (notifications, privacy, change-password, delete-account, telegram, and units' core). **3 carry real issues**: `organization-access` is visually broken (unstyled, no SafeArea, dev controls exposed), `connected-devices` is a sailing-only stub, and `edit-profile` hardcodes a SAILING PROFILE section. Form *submission* (change-password, save-profile) was intentionally **not executed** to avoid mutating denneyke — UIs verified, persistence unverified.

**What's good (keep):**
- **Notifications is comprehensive and well-organized** — grouped iOS toggles with colored icon tiles across DELIVERY CHANNELS / EVENT UPDATES / SOCIAL / MESSAGES / COACHING & LEARNING / QUIET HOURS, each group with a plain-language caption. QUIET HOURS even reassures _"Critical safety alerts will still come through."_ This is the bar the other screens should meet.
- **Privacy is genuinely interest-aware** — beyond Public Profile / Share Activity / Show Progress to Peers, it has **PER-INTEREST DEFAULTS** (each interest gets its own "Profile Default" visibility row) and uses the interest-aware tier label ("Default Step Visibility: Collaborators", not "Crew"). This respects both the interest model and `project_visibility_tier_vocab_deferred`. Keep.
- **Delete Account is best-in-class destructive design** — red "This Cannot Be Undone" header, itemized WHAT WILL BE DELETED list, a "Consider These Alternatives" callout (downgrade / adjust privacy / export data), then a **type-DELETE + password double-gate** with a disabled CTA. Pair this with the Interests Remove confirm (§2) — the app has a strong, consistent destructive-action language; make it the documented standard.
- **Change Password** — requirements callout, three fields with show/hide eye toggles, "Forgot your current password?" escape hatch. Complete.
- **Telegram** — clean connected-account card with honest behavior copy (_"Messages you send to the BetterAt bot… are logged to your timeline and replied to automatically."_) + red Disconnect.

**Findings:**

| Sev | Issue | Recommendation |
| --- | --- | --- |
| **P1** | **`organization-access` renders completely unstyled** — no SafeArea (the "Organization Access" title overlaps the status-bar clock), no card chrome, raw left-aligned text stacked together. **Root cause (code-confirmed):** this screen is built entirely with NativeWind `className` Tailwind utilities (`mx-4 mt-4 bg-white rounded-2xl p-4 border`, `text-xs font-semibold text-gray-500`), whereas every other settings screen uses `StyleSheet` + `IOS_COLORS`. The classNames are not being applied on native here, so the whole screen collapses to unstyled text. Secondary: a "Dev Diagnostics / Show debug" panel is visible — it *is* gated (`showDevDebugPanel = __DEV__ || process.env.NODE_ENV !== 'production'`, `app/settings/organization-access.tsx:74`), so it's dev-only, but the `NODE_ENV !== 'production'` half is a loose gate that can leak into mis-configured release builds. Empty-state copy itself is fine. | Rebuild the screen on the StyleSheet/`IOS_COLORS` scaffold the other settings screens use (incl. `SafeAreaView`), or fix why NativeWind classes don't resolve in this file. Tighten the debug gate to `__DEV__` only. Most broken screen in Settings — visually P0, scoped P1 because the account still works personally. |
| **P1** | **`edit-profile` hardcodes a "SAILING PROFILE" section** — Position (Helm), Class (Dragon), Location, Club (e.g. RHKYC), Seasons Active ("Shown as 'N seasons' on your public profile") — shown to a College & Career Planning user. There are **no interest-aware profile fields**, only sailing ones. A nurse/entrepreneur editing their profile is asked for their helm position and yacht class. Violates `project_interest_vernacular_personas`. | Make the profile's domain section interest-aware (drive fields from the active interest), or hide the sailing block for non-sailing interests. The Privacy screen's per-interest model and the resource CaptureSheet's interest chips (§5) prove this is achievable. |
| **P1** | **`connected-devices` is a sailing-only stub shown to every persona** — header _"enhance your sailing data… record race data"_, and every row is "Planned" (GPS Devices, Speed Sensors "Boat speed and VMG", Wind Instruments "masthead sensors", Heart Rate, Smart Watches, AIS Transponders). Nothing is functional and the whole screen is sailing vernacular. (Known stub per plan.) | Until device integrations ship, hide the screen for non-sailing interests or replace with an interest-neutral "Connected devices — coming soon" state. Don't show "Boat speed and VMG" to a nurse. |
| P2 | **`units` info note is sailing-framed** — _"affects how distances and speeds are displayed… including race data, weather forecasts, and venue information."_ on an otherwise persona-neutral Metric/Imperial screen. | Generalize the note (drop "race data… venue information") or make it interest-aware. |
| P2 ✅ RESOLVED | **Inconsistent back-nav treatment across settings screens** — some use a `‹ Settings` text back-button (Notifications, Privacy, Telegram), others a bare `←` arrow with no label (Units, Connected Devices, Change Password, Delete Account, Edit Profile). | **Done:** all of Units / Connected Devices / Change Password / Delete Account / Edit Profile now use the native `Stack.Screen` header with a chevron-back "Settings" affordance (`66e864e9` + edit-profile this pass). |

**Signature-moment opportunity:**
- Settings is correctly utilitarian — no delight needed here. The one latent beat is **completing your profile**: the bio field already says "shown on your public profile" and there's a "View public face" link, so saving a richer profile could surface a "Your public face just got stronger" nudge tying edits to how others see you. **Rank: low / infra-exists.** (Don't over-celebrate settings.)

## 7. Profile + public face
_status: **done (native denneyke + web cross-persona)** — 2026-06-14. Screens: own-edit `screens/06_settings_edit_profile_*.png`; public face `screens/07_publicface_*.png` (denneyke/sailor). Entrepreneur public face (Savitri) observed live on web — screenshot not retained in repo. Route: `/sailor/[userId]` via "View public face" in edit-profile._

**Works?** — **Public face is the single best surface in the app** — fully functional, real data, on-model. Own-side edit-profile is functional but sailing-hardcoded (covered as a finding in §6). All public-face sections rendered with real content for denneyke (a sailor with seed data).

**What's good (keep) — this is the showcase:**
- **The public face realizes the BetterAt thesis better than anywhere else.** It's evidence-first, not vanity-metric-first. Every capability carries a quote + provenance + lifecycle badge; every reflection links back to the step that produced it.
- **Header** — avatar, name, "Dragon Helm · Hong Kong", a stat line (`RHKYC · Middle Island · 1 season · 82 steps logged`), and a self-view `This is you · Edit profile` pill. Honest, scannable.
- **Editorial serif bio quote** — _"Building a repeatable Dragon racing program… a first-beat decision system for shifty Hong Kong waters."_ with _"Written when joining BetterAt"_ — the serif register (`project_serif_register_kept`) used exactly where it belongs (first-person reflection voice).
- **WORKING ON NOW** — current concept with week count, _"6 steps practised against · 2 debriefs"_, and a "Followed: 3 concepts settled before this one" lineage. Shows momentum and history in one block.
- **PRACTICE TIMELINE** — steps with `settled` status, evidence sub-lines ("12 sessions → one-page tuning matrix for B-18 kt"; "Held the front row 4 of 5 starts in the spring series"), dates. Real trajectory.
- **CAPABILITIES AT HAND** — each capability has an evidence **quote**, provenance ("From a two-boat testing debrief · May 2026"), and a **lifecycle badge** (Settled / Working / Emerging). This is `competency tied to evidence` made visible — exactly the domain primitive from CLAUDE.md, realized in UI.
- **PRACTICE CIRCLE** — people with relationship labels (Wei Lun Cheung — "Two-boat testing partner · Dragon helm · Mutual"; Marta Reyes — "Coach"; James Tse — "Crew · bow, since March"). Relationship-typed, not a flat follower list.
- **PUBLISHED** — reflections ("The fleet is a rumor. The compass is a fact.") + discussion threads with reply counts ("7 replies", "12 replies"). 
- **WHERE … PRACTISES** + **EVENTS** — home waters/club/class/racing-area, and an events list with results (`Spring Series · Race 5 — 4th of 18 · best of season`; `Race 3 — 11th of 19 · OCS recovered`). **Note:** events were previously flagged as the one non-real section (`project_public_face_real_data_status`); here they render with specific results — either resolved since that note or seeded for this RHKYC-admin account. Rendering confirmed; data provenance not re-audited.

**Findings:**

| Sev | Issue | Recommendation |
| --- | --- | --- |
| P1 | **The identity layer is sailing-hardcoded, but degrades by omission — not mislabeling — for non-sailors.** Verified on web with the entrepreneur persona (Savitri Devi Munda, `/sailor/f160779d…`). The descriptor + "WHERE … PRACTISES" block are built only from sailing fields (`sailingClass`/`sailingPosition`/`sailingLocation` and the hardcoded "Home waters/Club/Class/Position/Seasons active" rows in `PublicFaceScreen.tsx`). For a non-sailor those fields are empty, so the whole block is **absent** — Savitri's page showed no mislabeled "Home waters: —", it simply omitted the identity section and rendered bio + PRACTICE TIMELINE (real entrepreneur steps: MUDRA loan, Mukhyamantri scheme, stitching, seedlings). So the failure mode is graceful, not broken. **The real gap:** non-sailing personas get a thinner public face — they lose the descriptor and the "where" section entirely rather than getting an interest-native equivalent ("Where Savitri works", trade/region rows). The evidence layer (bio/timeline/capabilities/circle/published) is interest-agnostic and carries the page; the identity layer is sailing-only and silently drops out. | Make the identity layer interest-aware so non-sailors get an equivalent descriptor + "where" block from their own vocab, instead of an omitted section. Sized small-to-medium: add a persona branch alongside the existing sailing one in `enrichment.ts` / `PublicFaceScreen.tsx` `realWhereRows`. Until then, the omission is acceptable (better than wrong labels). |
| P2 | **The public-profile route is `/sailor/[userId]`** — a sailing-named route for a universal profile surface. Cosmetic/technical-debt, but it's the kind of sailing-first naming the platform is trying to generalize (`project_sailing_namespace_consolidation`). | Fold into the sailing-namespace pass; rename to `/person/[userId]` or `/profile/[userId]` when that work happens. Not urgent. |
| P2 ✅ RESOLVED | **Public-face cold-load shows a bare full-screen spinner** (~3s observed) with no skeleton or branding. For the app's flagship surface, the first impression is an empty grey screen. | **Done:** `isLoading` now renders a hero-matching skeleton (avatar circle + name/descriptor/meta bars + section cards) in the shared `PublicFaceScreen.tsx`. |

**Signature-moment opportunity:**
- **A capability crossing into "Settled" is the platform's core payoff** — proof that practice produced mastery, backed by evidence. Right now the badge just flips. *Infra exists* (`TrophyScreen.tsx` 5 variants, `useStepCompleteCelebration.ts` wired-but-unsurfaced, `lib/haptics.ts`). When a capability settles, mark it: a brief Trophy-of-Becoming moment ("Rig tuning to conditions — Settled. 12 sessions of evidence behind it.") tied to the evidence that settled it. This is the highest-leverage signature beat in the whole audit because it celebrates the exact thing BetterAt exists to produce. **Rank: highest / infra-exists.**

---

## 8. Web persona-breadth pass (vocab adaptation + persona empty-states)
_status: **done (web, multi-persona)** — 2026-06-14. Signed in as the Lac Craft Business / Jharkhand entrepreneur persona (Savitri Devi Munda, `f160779d…`). All findings observed live on web; screenshots not retained in repo (Chrome capture path not surfaced this session)._

The native pass ran on a sailor; this web pass exists to catch where the app speaks sailing to a non-sailor, and where a persona's surfaces are empty vs adapted. Two big findings, one strongly positive.

**What's good (keep) — the entrepreneur Atlas is far more built than the Gaps appendix assumed:**
- Contrary to the rollout note (`project_atlas_persona_tab_system_rollout`) treating the entrepreneur Atlas as a subtitle string, the **web Atlas is substantially persona-adapted**: a Jharkhand/Khunti map with **Haat / Suppliers / Mentees** filters (not fleets/venues), **bilingual हिं/EN** UI with Hindi labels, govt/NGO resource framing, and an **offline-sync** affordance appropriate to rural low-connectivity use. This is exactly the persona-as-data thesis (`project_phase_d_persona_ladder`) realized on a real surface — keep and lean into it.
- **Savitri's public face renders real entrepreneur content** — bio + PRACTICE TIMELINE with genuine steps (MUDRA loan, Mukhyamantri scheme application, stitching production, seedling cultivation). The evidence layer is interest-agnostic and carries a non-sailing persona well (see §7).
- **The Library `CaptureSheet` RELEVANT-FOR chips** showed the full real interest set including Lac Craft Business — interest-awareness works where it's been built.

**Findings:**

| Sev | Issue | Recommendation |
| --- | --- | --- |
| P1 | **Sailing vocab leaks into the entrepreneur Atlas.** The persona-adapted Jharkhand Atlas still showed a **"NEXT RACE · Khunti haat"** label — a sailing-register string (`NEXT RACE`) bleeding onto an entrepreneur's market-day surface. The surrounding UI is correctly localized (Haat/Suppliers/Mentees, Hindi), which makes the one un-adapted string read as a bug, not a stub. Violates `project_interest_vernacular_personas`. | Route the upcoming-event label through the same per-interest vocab map the rest of this Atlas already uses — entrepreneur should read "Next market day" / persona-native, sailing keeps "Next race". The infra is clearly present (everything else adapted); this is one missed binding. |
| P1 | **Public face identity layer omits for non-sailors** (cross-referenced from §7) — Savitri loses the descriptor + "where" block entirely because they're sailing-field-only. Graceful (omission, not mislabel) but leaves non-sailing personas with a thinner page. | Make the identity layer interest-aware (detail in §7). |
| P2 ✅ RESOLVED | **Public-face cold-load bare spinner also reproduces on web** (~3s) — confirms §7 P2 is cross-platform, not a sim artifact. | **Done with §7:** the skeleton lives in the shared component, so the web cold-load gets it too. |

**Note on method:** demo personas have no native sign-in (`project_demo_persona_no_native_signin`), so all persona-breadth was necessarily web-only. The entrepreneur Atlas above was observed on web; its native parity is **unverified**.

---

## Prioritized backlog

Consolidated across all flows. P0 = blocks a flow / data loss / crash. P1 = real friction most users hit. P2 = polish/visual.

> **Status sweep (2026-06-14):** re-verified the backlog against current code + sim. Several items already shipped since the audit was written; marked **✅ RESOLVED** below. The remaining open code-items all live in files under active WIP (`enrichment.ts`, `AtlasScreen.tsx`, `edit-profile.tsx`, `LibraryLanding.tsx`) — blocked on committing that WIP before they can be touched without entangling it.

**P0**
1. ✅ **RESOLVED** (`6cad47d5`, sim-verified) — **Library "Add to Library" chooser renders no text on native iOS** (§5). All 4 rows now render full title + subtitle on native.

**P1**
2. ✅ **RESOLVED** (`de7844d6` + `fca77bdc`) — **Native first-open is a login wall**. `app/index.tsx` signed-out cold-open now branches: fresh install → `/welcome`, returning user → `/(auth)/login`.
3. ✅ **RESOLVED** (`405a2ae2`, sim-verified 2026-06-14) — **Public-face identity layer is sailing-hardcoded** (§7, §8). Non-sailing personas now fall back to their interests + location: hero descriptor = primary interest, "Where X practises" gains a Focuses row. Interests surfaced via the SECURITY DEFINER `get_person_public_face` RPC (RLS blocks a direct peer read of `user_interests`); only active/public interests, primary-first. Verified: denneyke → Savitri shows "Lac Craft Business" + Focuses list. (Demo-persona `enrichment.ts` overrides remain the richer hand-authored path; this is the real-data fallback for everyone else.)
4. ✅ **RESOLVED** (code-verified; unverified on-device — see note) — **Sailing vocab leaks into the entrepreneur Atlas** ("NEXT RACE · Khunti haat") (§8). Added `getAtlasNextEventLabel(slug)` to `lib/vocabulary.ts` (NEXT RACE / NEXT MARKET / NEXT SHIFT / NEXT ROUND / generic NEXT UP), following the established slug-keyed helper pattern. The resolver (`useAtlasNextEvent.ts`) now stamps the persona eyebrow on every event; the SVG/native NEXT-tag fallback (`AtlasScreen.tsx`) consumed a hardcoded "NEXT RACE" and now reads `next.eyebrow ?? getAtlasNextEventLabel(currentInterest?.slug)`. (The MapLibre canvas path + the nursing/haat frame memos already honored `eyebrow`; this closes the last hardcoded fallback.) *Not on-device verified: the entrepreneur Atlas needs the lac-craft demo persona, which can't sign in on the native sim (demo magic-link ejects to web). Logic mirrors the already-correct nursing/haat eyebrow path; typecheck + lint green.*
5. ✅ **RESOLVED** (`dc04f73c` hid the block; this pass broadened the gate) — **edit-profile is sailing-hardcoded** ("SAILING PROFILE" section, sailing fields) for every persona (§6). The Sailing Profile section (Position/Class/Location/Club/Seasons) is now gated by the canonical `isSailingInterest(slug)` helper instead of a bare `=== 'sail-racing'` check — so non-sailors no longer see it (a nurse is never asked for a helm position) **and** the two other sailing-family interests (`offshore-yacht-racing`, `team-racing`) correctly keep their descriptor editor, which the narrow check wrongly dropped. Non-sailing personas get the interest-agnostic Basic Information block (name/email/bio); their public-face identity layer is now carried by the #3 interests-fallback. *Deeper interest-native domain fields (e.g. trade/region for an entrepreneur) remain a separate design item — there are no per-domain profile columns, so it needs schema design, not a vocab swap.*
6. ✅ **RESOLVED** (sim-verified 2026-06-14) — **organization-access screen renders unstyled**. Screen is now built on `StyleSheet` + `SafeAreaView` (not NativeWind `className`); renders fully styled. Debug gate already tightened to `showDevDebugPanel = __DEV__`.
7. ✅ **RESOLVED** (code-verified) — **connected-devices is a sailing stub**. Now interest-aware: `isSailing` branch shows sailing instruments only for sail-racing; non-sailors get a neutral hero + universal devices (GPS/HR/smartwatch) only. *(Note: support mailto still points at `regattaflow.com` — folds into the deferred rebrand pass, not this item.)*
8. ✅ **RESOLVED** (code-verified; on-device unverified — see note) — **Follow relationship dials (favorite/notify/mute) have no surface** on the person profile (§4). Tapping the "Following" pill now opens an `IOSActionSheet` with Add/remove favorite, Turn notifications on/off, Mute/unmute, and a destructive Unfollow (which keeps its existing confirm). Labels reflect current `user_follows` state and flip via the toggles the `useSailorFullProfile` hook already exposed (`toggleFavorite`/`toggleNotifications`/`toggleMute`, each with optimistic update). Pure UI surfacing — service + hook + optimistic layers were already wired; only the affordance was missing. *Not on-device verified: relaunching the sim to load the new bundle dropped denneyke's Supabase session (invalid refresh token) and a re-sign-in is required, plus dev-build `betterat://` deep links route to the Expo launcher rather than the running app. Typecheck + lint green; logic reuses the proven action-sheet component.*

**P2**
9. ✅ **RESOLVED** (code-verified) — New-concept TITLE placeholder sailing vocab. "Downwind trim in heavy air" placeholder no longer present.
10. ✅ **RESOLVED** (code-verified; on-device unverified — sim logged out) — Public-face cold-load shows a bare spinner, no skeleton (§7, §8 — cross-platform). The `isLoading` branch in `PublicFaceScreen.tsx` now renders a hero-matching skeleton (80px avatar circle + name/descriptor/meta bars + two section card placeholders) instead of a centered `ActivityIndicator`, so the flagship surface opens on a structured placeholder rather than a void. Lives in the shared (non-`.native`/`.web`) component, so it applies on both platforms.
11. ✅ **RESOLVED** (code-verified; on-device unverified — see note) — *Optimistic UI on follow*: the follow/unfollow mutations in `useSailorFullProfile` now carry `onMutate`/`onError`/`onSettled` (matching the favorite/notify/mute toggles), flipping `isFollowing` in the cache synchronously so the pill switches to "Following" on tap and reverts on failure — no more ~2s spinner. *Thin person profile for a follow decision*: bio + primary interest were already surfaced by #3; this pass adds follower-count + step-count meta pellets to the hero and labels each trajectory row with its interest (`usePersonPublicSections` now embeds `interests(name, slug)` per step + counts total visible steps; `PublicFaceScreen` renders both). *Note: idb couldn't drive the Max sim for a live eyeball and demo peers are purged, so trajectory/follower data is sparse — the rendering is code-verified, not screenshot-verified.*
12. ✅ **RESOLVED** (`e5e9cf04`, sim-verified) — `/sailor/[userId]` sailing-named route for a universal profile (§7). Route folder renamed `app/sailor/[userId]` → `app/profile/[userId]`; all `router.push` calls, the deep-link allowlist, and `suppressRoutes`/`publicSegments` repointed. `scan-qr` parser still accepts the legacy `sailor` prefix for previously shared URLs. Both `/profile/{id}` and `/profile/{id}/followers` verified on the native sim.
13. ✅ **RESOLVED** — Inconsistent settings back-nav standardized to native `‹ Settings` header on Units/Connected Devices/Change Password/Delete Account (`66e864e9`); units info-note already generic (no race/venue framing). edit-profile now matches: its custom serif-title header was replaced with the same native `Stack.Screen` header (chevron-back "Settings" on the left, Save moved into `headerRight`). *Code-verified (typecheck + lint green); on-device unverified — sim logged out.*
14. Dev-only network LogBoxes during Library load (§5) — QA noise, not a prod bug. **No action.**

## Signature-moment opportunities
Ranked by leverage. Tagged **infra-exists** (delight primitives already wired) vs **net-new**.

1. **Capability crosses into "Settled"** (§7) — **highest / infra-exists.** The platform's core payoff: proof that practice produced mastery, backed by evidence. Today the lifecycle badge just flips. Wire `TrophyScreen.tsx` + `useStepCompleteCelebration.ts` (both built, unsurfaced) + `lib/haptics.ts` into a brief Trophy-of-Becoming beat tied to the evidence that settled it. Celebrates the exact thing BetterAt exists to produce.
2. **Step completion** (`project_critique_completion_aha`) — ✅ **RESOLVED.** Root cause found: `StepCompleteCelebration` *was* fully built and wired in `StepDetailContent.tsx`, but its render gate (`showCelebration`) tested `status === 'completed'` while the Done action only ever produces `'settled'` — so the trophy was dead code. Fixes: (a) added `hapticSuccess()` to `handleToggleDone` so **every** completion delivers a tactile beat; (b) converted `showCelebration` from a status-derived flag to **transient local state** set by the act of completing (re-opening a settled step now shows its tabs, not a permanent trophy — the prior gate would have made it sticky); (c) extended `StepCompleteCelebration` with a `variant='solo'` for non-blueprint steps (trophy + italic-quoted "…— done." + a Done dismiss, no fleet/continue rows) plus a "Back to step" dismiss on the blueprint variant. *Code-verified (typecheck + lint clean); on-device-partially-verified* — relaunched the signed-in sim on the fresh bundle and drove to the Mark-done control, but the trophy render couldn't be observed: the ReflectTab gate (`saveEnabled` needs ≥1 typed reflect field) plus idb's unreliable text-input/popover-tap blocked tripping completion. The render path itself is reviewed and sound.
3. **Capture a resource → "your Librarian will surface this"** (§5) — **medium / infra-exists.** Close the loop between the save and the AI-recall promise the rotating Librarian prompt already makes; haptic + one-line confirm.
4. **First sign-in / account creation → "what do you want to get better at?"** (§1) — **medium / net-new.** Turn a form-submit into the start of the practice loop, flowing into interest selection.
5. ✅ **RESOLVED** (`4b3f3e73`, sim-verified) — **Auto-follow on blueprint adopt** (§3, §4). The adopt success banner now shows a second line "Now following <author>" with a person-add icon (gated on author ≠ self), making the silent auto-follow visible at the moment it's earned. Verified by adopting Suman Tirkey's blueprint on the native sim.

## Gaps appendix (out of scope, not tested)
- Join/leave group — service partial, no UI.
- Leave org — no leave API found (join is wired).
- Mentorship request/grant — coaching sessions exist; no peer request→grant flow.
- Send-suggested-step UI — `shared_steps` table + service exist, no send UI.
- Atlas fleet/blueprint step layers — only in Watch, not on map.
- Race-time weather — RaceTimeBar is UI shell; not bound to `step.starts_at`.
- Regular→race step conversion — no UI/API.
- Nursing Atlas site surfaces — mostly hardcoded mock data.
- ~~Entrepreneur Atlas — subtitle string only~~ **CORRECTED (§8):** the web entrepreneur Atlas is substantially built (Haat/Suppliers/Mentees filters, Jharkhand map, bilingual हिं/EN, offline-sync). Remaining gap is a vocab leak ("NEXT RACE") not absence; native parity unverified. Moved out of "unbuilt."
