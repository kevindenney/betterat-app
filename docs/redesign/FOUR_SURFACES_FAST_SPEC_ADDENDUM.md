# Four Surfaces — Fast Spec Addendum

**Status:** Written under 20-minute constraint, 2026-05-15, May 20 ship deadline context
**Scope:** Interest switcher, profile/settings dropdown, share dialog, Suggest bar
**Relates to:** All prior canonicals and addenda

Three of these are small mechanical surfaces specced by iOS convention. The fourth — the Suggest bar — is a substantial new product concept specced at skeleton level with deeper design deferred.

---

## Surface A: Interest Switcher

### What this is

The mechanism for switching between the user's interests (Sail Racing, Nursing, etc.) in the Practice tab. Multi-interest users need to swap which interest's timeline they're viewing.

### Current state

A "Sail Racing ▼" chip in the top header of the Practice tab. Tap opens the switcher.

### Design

**Tap behavior:** opens an iOS-native action sheet from the bottom of the screen.

**Action sheet content:**

```
┌─────────────────────────────────────┐
│        Switch interest               │
├─────────────────────────────────────┤
│  ⛵ Sail Racing            ✓ (active)│
│      Step 6 of 11 · Active           │
│                                       │
│  🩺 Nursing                          │
│      Step 12 of 14 · Active          │
│                                       │
│  📐 Design                            │
│      Idle 12 days                    │
│                                       │
│  🎯 Self-Mastery                     │
│      3 steps this week               │
├─────────────────────────────────────┤
│  + Add a new interest                │
│  ⚙ Manage interests                  │
├─────────────────────────────────────┤
│             Cancel                    │
└─────────────────────────────────────┘
```

**Per-interest row:** icon + name + brief activity indicator (current step / activity level / idle status). Checkmark on the active interest.

**Behavior on switch:**
- Action sheet dismisses
- Practice tab content transitions to the new interest (subtle cross-fade or slide)
- Interest chip in the header updates
- All timeline content scopes to the new interest (steps, blueprints, peers, Suggest bar)
- Bottom tab destinations stay the same; the first tab's visible label re-resolves through the active interest vocabulary (for example, `Race` for Sail Racing, `Practice`/`Shift` for Nursing depending on config).

**"Manage interests":** opens a settings surface where the user can reorder interests (drag), hide an interest from the switcher, or archive an interest.

**Multi-interest unified view:** out of scope for this surface. If user wants all interests interleaved, that's a separate "All interests" toggle at the top of the action sheet — deferred to v2.

---

## Surface B: Profile / Settings Dropdown

### What this is

The menu that opens when the user taps their avatar (top-right corner of most screens). Per the primary canonical, the avatar is for account/settings — NOT for the Profile-as-credential surface, which lives as a bottom tab.

### Design

**Tap behavior:** opens an iOS-native action sheet from the top-right of the screen (anchored to the avatar), OR a popover on iPad / desktop.

**Action sheet content:**

```
┌─────────────────────────────────────┐
│  [Avatar]                            │
│  Kevin Denney                        │
│  @kdenney · kevin@example.com        │
├─────────────────────────────────────┤
│  👤 Account                          │
│  ⚙  Settings                         │
│  🎨 Appearance                       │
│  🔔 Notifications                    │
│  🔒 Privacy                          │
│  💳 Subscription                     │
├─────────────────────────────────────┤
│  📖 Help & Support                  │
│  📋 Send feedback                   │
│  ℹ  About BetterAt                   │
├─────────────────────────────────────┤
│  Sign out                            │
└─────────────────────────────────────┘
```

**Sections, top to bottom:**

1. **Identity header:** avatar, name, handle, email. Tapping this opens the full Account screen.
2. **Account & Settings group:** standard preference surfaces.
3. **Help group:** support, feedback, about.
4. **Sign out:** destructive action, separated, red text.

**Settings sub-surfaces (each their own screen accessed from here):**

- **Account:** edit name, handle, email, password change, connected accounts (Apple, Google), delete account
- **Appearance:** light/dark/system, font size, accent color
- **Notifications:** push toggles per category (mentions, blueprint updates, step reminders, follower activity)
- **Privacy:** default visibility for new steps, profile public link control, blocked users
- **Subscription:** current plan, billing history, upgrade/downgrade

**Doesn't include:**
- Profile-the-credential (that's the bottom tab)
- Interest management (that's in the interest switcher)

---

## Surface C: Share Dialog

### What this is

The dialog that appears when the user shares something from BetterAt — a step, a blueprint, their profile, a capability evidence record.

### Design

**Trigger:** "Share" affordance appearing in:
- Step ellipsis menu ("Share step")
- Blueprint detail screen ("Share blueprint")
- Profile screen ("Share profile")
- Capability evidence detail ("Share this evidence")

**Tap behavior:** opens iOS-native share sheet (UIActivityViewController equivalent) with BetterAt-specific options layered in.

**Share sheet content:**

```
┌─────────────────────────────────────┐
│  Share Light-air starts in           │
│  shifty breeze                       │
├─────────────────────────────────────┤
│  [Avatar row of recent contacts]     │
│  Tomás · Jamie · Bram · Bence · +   │
├─────────────────────────────────────┤
│  📱 Messages                         │
│  💬 WhatsApp                         │
│  📧 Mail                             │
│  🐦 X / Twitter                      │
│  💼 LinkedIn                         │
│  📋 Copy link                        │
│  🔗 Get shareable link               │
├─────────────────────────────────────┤
│  BetterAt options:                   │
│  👥 Send to follower                 │
│  📘 Suggest as step (Surface D)      │
│  ➕ Save to my Playbook              │
├─────────────────────────────────────┤
│  Visibility:                         │
│  ○ Public (anyone with link)         │
│  ● Followers only (default)          │
│  ○ Private (just me)                 │
├─────────────────────────────────────┤
│             Cancel                    │
└─────────────────────────────────────┘
```

**Three sections:**

1. **Standard iOS share:** recent contacts, system apps, copy link, generate shareable link
2. **BetterAt-specific:** send to a follower (in-app), suggest as a step (links to Suggest bar — Surface D), save to your own Playbook
3. **Visibility selector:** what the recipient can see when they open the link. Defaults to "Followers only" per privacy spec in earlier addendum.

**Shareable link behavior:**
- `betterat.app/step/[id]` or `betterat.app/u/[handle]/step/[id]` for steps
- `betterat.app/blueprint/[id]` for blueprints
- `betterat.app/u/[handle]` for profile
- Link respects visibility setting: if "Followers only," anyone clicking sees a "Sign in to view" prompt and must be approved as a follower

---

## Surface D: Suggest Bar

### What this is

A new product surface you just surfaced. The Suggest bar shows steps that others have suggested to the user — from mentors, from peers on the same blueprint, from people they follow, from creators. The user can accept a suggestion (it becomes a step in their timeline), dismiss it, or save it for later.

This is the **mentoring action loop**: a creator/mentor/peer sees something in the user's progress and says "you should try this." The suggestion arrives at the Suggest bar.

### Where it lives

Per Kevin's note: **below the zoomed-out timeline**. So in zoomed-out view, the user sees:

1. Their own timeline (top, primary)
2. Following section (people, blueprints, peers — already specified in prior addendum)
3. **Suggest bar (new):** suggestions from others

In zoomed-in view, the Suggest bar can surface in a different way (deferred — possibly as a chip/badge that opens the full bar on tap).

### Anatomy

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUGGESTED FOR YOU                  (4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭──────────────────────────────────────╮
│ 📘 Rules drill: protests             │
│ From Bram · 2 hours ago              │
│ "Saw your debrief on the Step 8     │
│  protest — try this drill before     │
│  the next race."                     │
│ [ Add to my timeline ] [ Dismiss ]   │
╰──────────────────────────────────────╯

╭──────────────────────────────────────╮
│ 📘 Heavy-air spinnaker handling      │
│ From Tomás (peer on Dragon Worlds)   │
│ "Just did this one. Helped me a lot."│
│ [ Add to my timeline ] [ Dismiss ]   │
╰──────────────────────────────────────╯

╭──────────────────────────────────────╮
│ 📘 Pre-race mental routine           │
│ From Bill Gladstone (following)      │
│ "From my latest North U session."    │
│ [ Add to my timeline ] [ Dismiss ]   │
╰──────────────────────────────────────╯

╭──────────────────────────────────────╮
│ 📘 Pediatric assessment basics       │
│ From Dr. Patricia Morrinson (JHU)    │
│ "Required prep for next rotation."   │
│ [ Add to my timeline ] [ Dismiss ]   │
╰──────────────────────────────────────╯

[ See all suggestions ▾ ]
```

### Per-suggestion card

- **Step icon + step title** (the thing being suggested)
- **Source:** "From [Name]" with context — peer / follower / mentor / creator / org admin
- **Optional note** from the suggester (1-2 sentences explaining why)
- **Primary action:** "Add to my timeline" — copies the suggested step into the user's timeline (using the same flow as "Add this to my timeline" from someone else's step view, specified in the social layer addendum)
- **Secondary action:** "Dismiss" — removes from Suggest bar
- **Tertiary action (in card menu / long-press):** "Save for later" — moves to a saved list visible later, "Mute suggestions from this person," "Tell me why" (asks the suggester for more context)

### Who can suggest

The user receives suggestions from:

1. **Mentors:** creators of blueprints the user is subscribed to (e.g. Bram suggests because user is on his Dragon Worlds Prep blueprint)
2. **Peers:** other people on the same blueprint as the user (with mutual consent — peers can't spam each other; must be opted into peer-suggestions per blueprint)
3. **People the user follows:** if A follows B, B can suggest steps to A
4. **Org admins:** at institutions (JHU professor suggesting to enrolled student)
5. **Self:** the user can save items from elsewhere (other people's steps, Discover) as "self-suggestions" — these appear here as a personal to-try list

The user has fine-grained control: per source type, can disable suggestions ("Stop accepting suggestions from peers" / "Only mentor suggestions"). Default is all sources enabled except generic "people you follow" (which is opt-in).

### Suggestion rate-limiting

To prevent spam: any one suggester can have at most N pending suggestions to a given user (suggested default: 3). Beyond that, new suggestions queue and the suggester sees "[User] has 3 pending from you — they'll see this when they've acted on the others."

### Notifications

A new suggestion triggers a notification (per the user's notification settings). The notification preview shows source + step title. Tapping it opens the Suggest bar with that card pre-scrolled.

### Empty state

If the Suggest bar is empty (no pending suggestions):

```
╭──────────────────────────────────────╮
│ No suggestions right now              │
│                                       │
│ Suggestions from your mentors,       │
│ peers, and people you follow will    │
│ appear here.                          │
│                                       │
│ → Find people to follow              │
╰──────────────────────────────────────╯
```

Link to Discover for follower-finding.

### What's deferred

This is a skeleton spec. Things to design properly tomorrow:

1. **Suggest authoring flow** — how does Bram actually create a suggestion to Tomás? Probably from the Mentoring screens (Surface 5 in prior addendum), with a "Suggest a step" affordance in the subscriber detail view.
2. **Algorithmic vs. human-only suggestions** — does BetterAt's AI also surface suggestions ("Other people who stalled at Step 6 found this helpful")? If yes, how are AI suggestions visually distinguished from human ones?
3. **Suggestion → blueprint pipeline** — if multiple mentors suggest the same step to many users, does it become a candidate for a blueprint? Possibly a creator-tier insight.
4. **Cross-interest suggestions** — a sailing mentor suggesting a nursing step? Probably not meaningful, but the data model needs to handle interest scoping.
5. **The "Save for later" surface** — where do saved suggestions live? Probably in Playbook as a "Saved" section.

### Implementation phasing

- **Phase L (after current cutover work):** Suggest bar in zoomed-out view, accepting suggestions from mentors and peers, basic dismiss/accept actions.
- **Phase L.5:** Suggestion authoring from Mentoring screens.
- **Phase L.6:** Notifications integration.
- **Phase L.7:** Algorithmic suggestions (if/when AI-suggestion strategy is decided).

---

## Combined status

All four surfaces specced. Three are mechanical (Interest Switcher, Profile Dropdown, Share Dialog) and can be implemented quickly. The fourth (Suggest bar) is a real product surface with 5 deferred design questions.

---

## What's still NOT designed (honest inventory)

For Kevin tomorrow:

- Do tab interior (only Plan was locked tonight)
- Reflect tab interior (only Plan was locked tonight)
- Profile screen full content (Phase D capability map)
- AI Coach conversational flow
- Discover tab top-level view
- Playbook tab
- Blueprint detail view (subscriber-facing)
- Step copy/import flow detail
- Follower request/approval flow
- Notifications surface
- Onboarding for new users
- Sign-in / sign-up screens
- Empty states across all surfaces
- Search functionality (cited in multiple specs, never designed)
- The "Magic button" reconciliation (was it AI Coach? something else?)
- 15+ `[NEEDS DECISION]` items from the Five Surfaces doc

This is honest scope. May 20 ship cannot include all of this. Tomorrow's first task: pick the May 20 critical path.

---

## Status

Fast spec written under time constraint. Four surfaces have enough shape to begin implementation. The Suggest bar will need a proper design session tomorrow to fill in the deferred questions.

When implementation reveals tensions, this document is updated, not silently deviated from.
