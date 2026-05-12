# BetterAt Redesign — Addendum 5, May 13 2026 (early morning)

Designs for the deferred items surfaced in Addendum 4: groups, invites, equipment, venue progression, per-step visibility, mid-rotation switching, conversational home surface, and passive WhatsApp group listening.

---

## 1. Groups (new architectural unit)

### The gap
Architecture has "self" and "cohort" but nothing between. Mikkel's crew is 3-4 people. Emily's clinical pod is 2-3 students. Felix tuning with Henrik is 2. These intimate practice groups have their own knowledge accumulation.

### The unit
A **group** is a small, persistent collection of users (2-8 typically) who practice together. Lives within an interest. Has its own shared layer.

Properties:
- Named by participants
- Within one interest
- Has its own playbook layer (group-shared concepts, observations, place knowledge)
- Steps can be group-shared
- Activity surfaces within the group
- Private by default; not discoverable
- Members invite others

### How groups differ from cohorts
- Cohorts are path-defined (subscribers to a path)
- Groups are user-defined
- Cohorts can be large; groups are small
- Cohorts dissolve when path ends; groups persist
- Cohort membership has structural privacy gates; group membership is explicit

### How groups appear
- **Step**: tagged with one or more groups; members see in their timeline
- **Playbook**: "Group knowledge" sub-section
- **Discover**: not present (intentional)
- **Profile**: visible only to fellow group members
- **Notifications**: routed under "From your group"

### Creating a group
From menu sheet → "Create a group" or from a step's share dialog. Flow:
1. Name (e.g., "Moonraker crew")
2. Interest
3. Members (with invite for non-users)
4. Optional description

~90 seconds.

---

## 2. Inviter affordance for non-users

### The problem
Currently, sharing requires the recipient to be a BetterAt user. This stalls the social graph.

### Three invitation tiers

**Tier 1 — Email/phone invite (read-only without signup)**:
- Inviter types email or phone
- Recipient gets an email/SMS with link
- Tapping opens a read-only surface showing what the inviter has shared with them
- Can read indefinitely without signing up
- Can choose to join (becomes full member with own reflections)

This is the consequential tier. It means the graph extends before commitment.

**Tier 2 — Link invite**:
- Generate a join link from the group
- Share via WhatsApp, iMessage, etc.
- Anyone with link can join (N uses, expires after N days)

**Tier 3 — QR invite**:
- At in-person events
- Show QR code; others scan to join

### What invited non-users see (Tier 1)
- Header: "Reading without an account" badge; "Join" button
- "Mikkel has been sharing race notes with you"
- The actual shared content (steps, observations, debriefs) — fully readable
- Quoted snippets in serif; structural language preserved
- Footer: "If you want to do this too" with sign-up affordance
- Optional personal note from inviter

### Privacy commitments for invited non-users
- Inviter controls what's shared (per-step decision)
- Inviter can revoke access anytime
- Non-user data is not collected beyond email/phone for delivery
- If non-user converts to full user, their account is linked to the prior read-only access

---

## 3. Equipment tracking (opt-in module)

### Architectural decision
Equipment is an opt-in module per interest, not universal. Some interests need it (sailing, golf, cycling, photography, knitting); some don't (nursing, drawing-from-life, language learning).

### When activated for an interest
Equipment becomes available as:
- Field on steps ("Equipment used today")
- Concept-node-equivalent in playbook
- Capability lens (performance with this equipment vs. another)

### Equipment item properties
- Name and type
- Acquisition date
- User-defined specs
- Maintenance log (timestamped)
- Performance correlations (AI-surfaced)
- Photos
- Notes

### Visual treatment
Equipment lives in playbook as a sub-section. Same visual register as concepts. Equipment detail page mirrors concept detail page.

### Sharing
Equipment can be private, group-shared (Mikkel's crew shares Moonraker's gear), or rarely published. Most equipment is private or group-shared.

### AI synthesis
Works on equipment same as concepts: "your performance with the North 3Di main has been stronger in 12+ knots; consider it for the Worlds heavy-air races."

---

## 4. Year-over-year venue comparison

### Extension of local knowledge maps
Place detail pages get a **temporal view toggle**:
- Default: "What you've learned here" — accumulated across all time
- Alternative: progression across years

### Temporal view shows
- Sessions per year at this place (bar chart)
- Reflections written per year
- Capability progression at this place specifically (different from overall)
- Year-over-year AI synthesis: "In 2024 you wrote about the left shift as confusing. In 2025 as a pattern. In 2026 as something to plan for."

### Implementation requirements
- Every step must be reliably place-tagged
- Place detail aggregates roll up reliably across years
- AI synthesis scopes to place-specific reflections

### Visual treatment
Tab/toggle within place detail. Same visual register as Reflect tab arcs (line drawings, generous whitespace, serif prose).

---

## 5. Per-step visibility controls

### The gap
Path-author read access is currently a default per subscription. Too coarse. Emily wants Patricia to read some reflections, not others.

### Architectural change
**Each step has its own visibility setting** that defaults from path-level but can be overridden per step.

### Visibility options on a step
- Inherit from path (default)
- Just me (private override)
- Just me and [author name] (default scope made explicit)
- Cohort + author (broader sharing)
- Public (rare; typically published work)

### UI affordance
Small lock/share icon in step header. Always shows current state. Tap to change.

### Constraint
One step, one visibility setting. Before/During/After all share the step's visibility. Can't split tabs.

---

## 6. Mid-rotation switching (Emily)

### The use case
Emily does med-surg in morning (7am-2pm), peds in afternoon (3pm-9pm). Two different rotations, two different steps. Currently manual switching required.

### Solution: time + location inference
App maintains "current rotation" inference:
- Schedule integration (path steps have time windows)
- Optional location signal (opt-in GPS)
- Inference rule: at time T, active rotation = scheduled rotation if T within window AND location matches expected site
- Fallback: most recent activity, then ask

### Signal, not declaration
User can always override. Default routing is correct most of the time.

### Privacy
Location data used only for inference; not stored in step metadata. Opt-in per user.

### Applicability
Most useful for users with scheduled multi-site rotations (clinical students, traveling consultants). Less needed for sailors (one site per session) but architecture works the same.

---

## 7. In-app conversational interface (opt-in home)

### Decision
Ship as opt-in alternative home surface, not default. Setting in Display → "Home surface":
- **Timeline** (default)
- **Conversation**
- **Today** (third option: structured "what's next" view)

### When user picks Conversation
- Home tab opens to chat-style interface
- System prompts based on context: "What would you like to capture?" or "Want to debrief Saturday's race?" or pending items
- User responds with voice or text
- System does the work via shared service (same as bot)

### Four tabs still exist
Accessible via small grid button at top, or via quick links at bottom of conversation. Conversation is primary surface; tabs are structured drilldown.

### Visual treatment
- Larger serif typography (greeting in 26px serif)
- Pending items as quiet cards with two-button decisions
- Voice and text input clearly available
- Tab grid at bottom labeled with one-line descriptions ("Clinical · your timeline", "Playbook · your thinking", "Discover · paths and people", "Reflect · the long view")

### Who picks this
- Emily would love it
- Mikkel would tolerate it
- Power users who prefer conversation
- Users with vision impairments (voice-first by design)

### Architectural commitment
Same shared service powers conversation home and bot. Same context resolution, same response composer. Different transport.

---

## 8. Passive WhatsApp group listening — restricted to explicit invocation

### The request
Mikkel wants the bot in his crew's WhatsApp group, surfacing content to BetterAt.

### Why "passive listening" is the wrong design
- Surveillance creep: members feel watched
- Misclassification: bot decides what's "tactical" when it's social
- Consent: Mikkel adds the bot but Henrik didn't agree
- Cross-purposes: WhatsApp group serves social bonding, not just practice

### Correct design: explicit invocation only
Bot is a member of the group but silent by default. To engage, someone @-mentions it.

### Four commands

**`@BetterAt save`** (or "save this," "remember this"):
- Bot reads recent messages (last ~10 minutes)
- Offers to save as evidence, observations, or playbook content
- Originating user gets private DM with proposal
- User confirms or adjusts

**`@BetterAt debrief`**:
- Bot reads recent debrief-shaped conversation
- Structures into prompt-keyed sections
- Offers to attach to relevant step
- Private DM to confirm

**`@BetterAt remind us about [X]`**:
- Bot retrieves relevant playbook content
- Posts summary into the group
- Helpful contribution mode

**`@BetterAt help`**:
- Bot responds with what it can do

That's it. No passive surveillance. No surfacing without invocation.

### Consent architecture
When bot is added to a group, first message:
> "Hi — Mikkel added me. I'm BetterAt's helper. I don't read or save anything unless someone @-mentions me. Here's what I can do: [list]. Anyone uncomfortable with me being here, just remove me."

- Transparent consent
- Everyone sees what bot does
- Anyone can remove the bot

### Saving others' words
When `@BetterAt save` is invoked and the content includes other users' messages:
- Those users get a notification
- They can review what was saved
- They can remove it from BetterAt
- Original WhatsApp message is never modified

### Open design questions (deferred to separate pass with privacy/legal)
- Consent UI for adding bot to group
- Bot behavior when added by non-BetterAt users
- Rate limits on `@BetterAt save` to prevent abuse
- Preventing weaponization of saved content

---

## 9. Decisions locked

- **Groups** are added as a unit between self and cohort. User-defined, persistent, small (2-8 people), interest-scoped.
- **Non-user invites** are supported with read-only-without-signup as the primary mode.
- **Equipment** is an opt-in module per interest, sharing concept-node architecture.
- **Year-over-year venue comparison** is a temporal view toggle on place detail pages.
- **Per-step visibility** is the canonical level of sharing control. Path-level is the default; step-level can override.
- **Mid-rotation switching** uses time + optional location inference. User can override.
- **In-app conversational interface** is opt-in via Settings, not default. Tab-based UI remains primary for most users.
- **Passive WhatsApp listening is rejected**. Bot in a group operates by explicit invocation only.

---

## 10. New mockups added (this session)

- Group creation flow (Mikkel's crew) — `betterat_group_creation_mikkel_crew`
- Invited non-user read-only view (Henrik) — `betterat_invited_nonuser_view_henrik`
- Conversational home surface (Emily) — `betterat_conversational_home_emily`

---

## 11. What's still open

Most of the architecture is now designed. Remaining work is implementation, not design. A few smaller items deferred:
- Privacy/legal design pass for WhatsApp bot group consent
- Equipment-specific UI for each domain (sailing rigging diagrams vs. golf bag layouts)
- AI prompt engineering for cross-year venue synthesis
- Visual treatment for the "Today" home surface option (third alternative after Timeline and Conversation)

These are tactical, not architectural. They can be designed as needed.

---

## End

The deferred items are now resolved. The product has:

- A coherent unit hierarchy (self → group → cohort → public)
- Lightweight social graph extension via non-user invites
- Domain-flexible equipment tracking
- Temporal place knowledge that grows year over year
- Granular per-step visibility
- Time + location-aware context inference for multi-site users
- Optional conversational home for users who prefer it
- A WhatsApp bot architecture that respects group privacy

This rounds out the architecture. The next work is engineering planning — sprint breakdown, shared service refactor, WhatsApp adapter build, iOS app integration. The design is sufficient for engineering to plan against.
