# BetterAt Redesign — Addendum 2, May 12 2026 (late evening)

Extends `betterat-redesign-spec.md`, `decisions-log.md`, and `addendum-2026-05-12-evening.md` with new design work on profile architecture, interest switching, settings/menu, and messaging.

---

## 1. Interest switching architecture

### The trigger
A chip in the top-right of every screen header (Practice, Playbook, Discover, Reflect) showing current interest with colored dot, name, and chevron. Always visible, always in the same position. The colored dot is a peripheral-vision cue — users learn to recognize their domains by color.

### The switcher sheet
Restructured from category-based to active-vs-paused:

**Active interests** (engaged within the last few months):
- Current interest gets bordered card, check mark, and "Currently here" label
- Other active interests are flat
- Each row shows colored dot, name, and metadata (paths count, last reflection time)

**Paused interests** (no engagement in 4+ months):
- Separate section below active
- Slightly muted styling
- "No activity in N months" subline
- Tap to reactivate via switching to it

**Add a new interest**:
- Dashed-border button at the bottom of the sheet
- Distinct from switching — opens the add flow

**Footer explanation**:
- "Switching changes your timeline, playbook, and what you discover. Each interest stays separate."

### What's removed
- Categories ("Creative Arts," "Healthcare," etc.) — these were onboarding chrome, not switching chrome
- Per-row remove × — destructive action moved to interest detail page
- Alphabetical sorting — active interests sort by recency of engagement

### The transition moment
When the user taps a different interest, ~600ms total beat:
- **0-200ms**: sheet dismisses with overshoot
- **200-400ms**: thin horizontal acknowledgment card slides in from top showing "Drawing · 1 path · 3 capabilities" with destination color dot
- **400-600ms**: card retreats up; content crossfades to new interest's data; chrome (header chip, tab bar) updates

For interests not visited in 4+ weeks, the beat extends to ~1s and includes a single sentence: "Welcome back to drawing. Your last reflection was July 14."

For notification-triggered switches (tapping a notification from another interest), no beat — the notification itself is the context signal.

### Edge cases
- **In-progress voice capture during switch**: saved as draft to the originating interest, recoverable on return
- **Zero active interests**: not allowed; minimum one interest
- **Removing your last interest**: gated; you must replace, not eliminate
- **Notification routing**: tapping a notification switches you to the right interest automatically

---

## 2. Interest detail page

Accessed by tapping any non-current interest row in the switcher (the row of the *current* interest is non-interactive — you're already there). Also accessed from Settings → Interests.

This page is contemplative, not operational. It's the *home* of an interest in your life. Configuration lives below, but the page leads with meaning.

### Structure (top to bottom)

**Header**:
- Large serif title of the interest
- Color dot in interest's color
- One-line relationship ("Active since March 2025" or "Paused since November")

**Vision excerpt**:
- First sentence of your Vision for this interest, in serif
- "See your full Vision →" link

**At a glance**:
- Four numbers in a horizontal row: paths, reflections, sessions, capabilities

**Cohorts you're part of**:
- List of orgs and groups within this interest
- Tappable to org pages

**Your authors**:
- Path authors you're subscribed to within this interest

**Capabilities being tracked**:
- List with current state pills (learning/practicing/breakthrough)

**Configuration** (visually separated from the above):
- Notifications for this interest
- Sharing defaults for this interest
- Active / Paused toggle (with explanation: "Pausing keeps everything but stops notifications and removes this from your active rotation")

**Remove this interest** (red text, requires substantial confirmation):
- Names what's archived (playbook, timeline, capabilities)
- 90-day archive grace period before permanent deletion
- Recoverable during grace period

---

## 3. Adding a new interest — five-step flow

Triggered from the switcher sheet "Add a new interest" button or from Settings → Interests → Add.

**Step 1**: "What do you want to work on?"
- Voice or text input, large field, free-form
- Suggestions populate as user types
- Existing interests in their database match
- "Create a new interest: '[input]'" if no match

**Step 2**: "About this interest"
- "Solo practice or part of a community?" (Solo / Has a community)
- "What would you call it in the app?" (pre-filled, editable, lowercase)
- If "has a community" selected, optional org search

**Step 3**: Color and emoji
- Pick a color (the dot color throughout the product)
- Optional emoji or icon
- Reasonable defaults; changeable later

**Step 4**: First Vision prompt
- "Why are you starting this?"
- Voice or text
- Saved as first Vision draft
- Can be left empty (product prompts again 7-10 days in)

**Step 5**: Land in the new interest
- Transition beat fires
- Empty Practice timeline with gentle invitation to add first step

Total time: 30-90 seconds depending on engagement.

---

## 4. Profile architecture

The current product conflates "profile" with "account settings." This separates them cleanly.

### Two distinct surfaces

**Profile**: public-facing representation of who you are in the practice. A destination. Yours is editable; others' are read-only.

**Settings**: operational account configuration. Not a destination — a tool drawer accessed from the menu.

### What's on a profile

A profile represents a person across interests, but defaults to *the current interest's lens* when viewed. Felix viewing Mihkel from Sail Racing sees Mihkel's sailing self first.

**Header section**:
- Avatar (round)
- Display name
- One-line bio (up to ~120 characters)
- Location (city/region, optional)
- Joined date

**Below header**:
- Mutual context card (only on others' profiles, when applicable): "You're both on Sam North's Worlds preparation path."
- Follow / Message buttons (only on others' profiles)
- Edit profile button (only on your own)

**At-a-glance row**:
- Three numbers depending on whose profile:
- **Your own**: paths, sessions, capabilities
- **Someone else's**: paths authored, concepts, followers

**Sections**:
- **Concepts published** (if any) — playbook concepts made public
- **Paths authored** (if any) — published paths with subscriber count, rating, pricing
- **Paths you're on** (only on your own profile, cohort-visible) — paths subscribed to
- **Orgs** — institutional affiliations with square-avatar treatment
- **Reviews** (deferred to v2) — for path authors, aggregated review sentiment

**Visibility section** (only on your own profile):
- Shows how you appear to others
- "Change visibility" opens edit sheet

### What's NEVER on the profile, regardless of sharing settings
- Reflections (those live in steps and playbook with their own sharing scopes)
- Vision
- Raw inbox
- Anything financial
- Email address (unless user explicitly displays it)

### Sharing controls per element
- Concepts: Public / Cohort / Private
- Paths you're on: Cohort / Private
- Capabilities: Public / Cohort / Path subscribers only / Private
- Orgs: Public / Private
- Defaults: Public on author-related elements, Cohort-only on subscribed paths, Private on capabilities

### Relationship tiers (progressive visibility)
1. **Stranger**: sees public content only
2. **Follower**: sees public content; receives notifications when person publishes
3. **Path subscriber** (you subscribed to their path): sees public content + path-related concepts
4. **Cohort member** (mutual cohort): sees public content + cohort-shared content + mutual context card

### What others can do on your profile
- Follow you
- Message you (if you've enabled it, and only context-appropriate per gates below)
- Read your published concepts
- Subscribe to your authored paths
- See mutual context (if any)

### What others cannot do
- See your reflections
- See your Vision
- See your playbook beyond published concepts
- See your email or contact info beyond what you display
- Send unsolicited messages (gates: same cohort, you're their subscriber, or they've opted in to open messaging)

### Profile editing

"Edit profile" opens edit sheet with two zones:

**Display**:
- Avatar (upload, take photo, or revert to initials)
- Display name
- One-line bio (~120 char limit with live count)
- Location (city/region, optional)

**Visibility**:
- Toggle per section (per the sharing controls above)
- Small explanation under each toggle

**Reach**:
- Open to messages (toggle)
- Mutual-context-only messaging (toggle, default on)

### Per-interest profile variants
- Avatar variants per interest: off by default, available in advanced settings
- Display name variants per interest: same
- Most users use one profile across all interests
- The interest chip on someone's profile lets you view them through a different interest lens (if they've made it visible)

### Verified author indicators
- Small checkmark next to authored path count for path authors meeting platform criteria (5+ subscribers, 4.0+ rating, identity verified)
- Quality signal on authoring, not "verified user" status

### Private profiles
- A user can set their entire profile to private
- They appear only as "Member" with initials in cohorts and forums
- They can still subscribe to paths and reflect
- They don't appear in Discover → People

### Blocking
- Available from "..." menu on someone's profile
- Blocked users can't see your profile, message, or follow
- You don't see their public content
- Cohort interactions become invisible
- Reversible from Settings → Blocked users

---

## 5. Menu and settings restructure

The current menu sheet (Home, Dashboard, My Profile, Creator Dashboard, Settings, Sign Out) is reorganized:

### New menu sheet
- **Profile** → opens your profile
- **Author dashboard** → only appears if you author paths
- **Settings** → opens settings page
- **Sign out** → destructive, visually separated

Home and Dashboard removed from menu (they're tab-bar destinations).

### Settings page structure

Settings is its own page with vertical sections:

**Account**:
- Email
- Sign-in methods (Apple ID, Google, email)
- Password (if email sign-in)
- Two-factor authentication

**Notifications**:
- Per-channel toggles: push, email, in-app
- Per-source toggles: author commentary, scheduled steps, cohort activity, playbook insights
- Quiet hours

**Interests**:
- List of all interests (active and paused)
- Add a new interest
- Tap into each for interest detail page

**Sharing defaults**:
- Default visibility per element type
- Applied to new content; existing content retains its settings

**Voice and accessibility**:
- Voice-first mode toggles
- Larger text
- Reduced motion
- Screen reader optimizations

**Billing**:
- Active subscriptions (paths, premium tiers)
- Payment methods
- Purchase history
- Refund requests

**Data**:
- Export your data (full playbook export, reflections export, etc.)
- Blocked users
- Delete account

**About**:
- Version
- Terms of service
- Privacy policy
- Contact support

### Author dashboard menu item
Only appears for users who've authored at least one path. Routes to the author dashboard described in the spec section 8.3. Distinct from settings — author dashboard is operational work, settings is configuration.

---

## 6. Messaging architecture

Messaging is gated, not open. The product is not a chat app.

### When messaging is available
A user can message another user only if at least one of these is true:
1. **Mutual cohort**: both on the same path (in any role)
2. **Path subscription**: one is the path author, the other is the subscriber
3. **Author premium tier**: the subscriber has paid for premium 1:1 access
4. **Explicit opt-in**: recipient has set "Open to messages" in profile

If none apply, the Message button on the profile is muted with a small label explaining the gate ("Available after subscribing to a path" or "Open messaging is off"). Following is still available.

### Message UI

Conversations live in a dedicated Messages section, accessible from the inbox or via a small icon in the bell area. Each conversation:

**Header**:
- Recipient's avatar and display name
- Mutual context line ("You're both on Sam's path" or "You're Mihkel's subscriber on the Cold-water Dragon racing path")
- Status indicator (active recently / last active N days ago)

**Message thread**:
- Standard messaging UI: bubbles, time-grouping, read receipts (optional, off by default)
- Voice messages supported as a first-class type (not just attachments)
- Image and short video attachments
- No emoji reactions to individual messages — just send a message back

**Compose**:
- Voice-first input as primary
- Text input as secondary
- Attachment options: voice memo, photo, video, link to a step/concept/path

### What messages cannot do
- No group chats. Cohorts use forums; not multi-recipient direct messages.
- No "stories" or ephemeral content.
- No video calls (deferred; could come later for premium 1:1 tier).
- No read receipts by default — opt-in per user.

### Author commentary vs. direct messages
- **Author commentary**: lands inside the relevant step (After tab), not in messages
- **Pattern-level cohort response**: lands in the inbox under "From your path authors"
- **Premium 1:1 message**: lands in messages, opens a conversation thread
- **Peer message** (same cohort): lands in messages

The distinction is structural — author commentary belongs to a *step*, not a *conversation*. A subscriber can re-read commentary in context of the original step's reflection. This is more durable than chat-style messages.

### Notifications for messages
- Push: immediate, with sender's name (no preview by default; user can enable)
- Inbox: a single entry per conversation per day (groups multiple messages from same sender)
- Quiet hours respected

### Blocking and reporting
- Block: from profile or message thread
- Report: from message thread, opens a brief form
- Platform-level moderation reviews reports within 24 hours
- Repeat offenders lose messaging privileges then accounts

### Message retention
- Messages retained as long as both users have accounts
- If a user deletes their account, messages they sent remain visible to the other party but show "Deleted user"
- Users can clear their own conversation history; this removes their view, not the other party's

---

## 7. Smaller resolved decisions

### Profile and identity
- **Display name editing**: free text, max 50 characters. No real-name verification required (privacy-respecting).
- **Bio character limit**: 120 characters, with live count.
- **Activity signal granularity**: two-day precision ("active 2 days ago"). Not "online now."
- **Cross-interest profile lens**: chip on someone's profile lets you switch which interest you view them through (if they've made multiple interests public).
- **The interest chip on your own profile**: changes which lens *your own* profile is shown in. For your own context, not for others.
- **Joining date**: shown publicly on profile.
- **Last active**: shown publicly with two-day granularity.

### Naming consistency
- **"Steps"** is the canonical name for the atomic unit of practice. Not "activities," not "sessions" (though "sessions" is acceptable for practice-mode steps if vocabulary varies by interest).
- **"Timeline"** is one per interest. You don't have multiple timelines per interest; you have one continuous one.
- **"Profile"** in your own menu, not "My profile." When viewing it, header reads "Your profile" with a small label, user's name as H1.

### Menu hierarchy
- Menu sheet items: Profile, Author dashboard (when applicable), Settings, Sign out.
- Home and Dashboard removed — they're tab destinations, not menu items.

### Settings layout
- Long single page with sections, not nested navigation.
- Heavy/destructive actions (delete account, blocked users) clearly separated visually at the bottom.

### Messaging gates
- Default: mutual-context-only.
- "Open to messages" must be explicitly enabled.
- Author commentary is structurally distinct from messages.
- No group chats; cohorts use forums.
- Voice messages as first-class type, not just attachments.

---

## 8. Updated nav and surface inventory

The four-tab nav (Practice / Playbook / Discover / Reflect) is reaffirmed. Profile, Settings, and Messages are not tabs — they're accessed via:
- **Profile**: menu sheet → Profile, or your avatar in any header
- **Settings**: menu sheet → Settings
- **Messages**: from the inbox via Messages section, or notification bell with badge

Inbox structure clarified:
- **Inbox**: "For your attention" framing, with sub-sections (path authors, cohort, playbook)
- **Messages**: distinct destination, accessible via inbox or bell
- These are related but separate surfaces — inbox is *notifications*, messages is *conversations*

---

## 9. New mockups (this session)

- Interest switcher sheet — `betterat_interest_switcher`
- Your own profile (Felix) — `betterat_profile_self_felix`
- Someone else's profile (Mihkel as Felix sees him) — `betterat_profile_other_mihkel`
- Interest detail page (Drawing for Felix) — `betterat_interest_detail_drawing`
- Settings page — `betterat_settings_page`
- Messages list (Felix's threads) — `betterat_messages_list`
- Messages thread (Felix & Mihkel) — `betterat_messages_thread_felix_mihkel`

All described in this addendum but not yet saved as standalone HTML; see conversation transcript for full widget code.

---

## 10. What the new mockups commit to

### Interest detail page
- **Vision excerpt as the second element after the header**: the deepest single thing about an interest leads the page
- **At-a-glance row of four numbers**: paths, sessions, concepts, capabilities
- **Authors, capabilities, and cohorts as middle sections**: relational content
- **Settings cluster visually separated**: notifications, sharing, pause
- **Remove action at the bottom in red**: separated by another visual break, with 90-day archive grace period named in copy

### Settings page
- **Long single page with section headers in small caps**: no nested navigation
- **Sections in order of frequency of access**: Account → Notifications → Interests → Sharing → Voice/Accessibility → Billing → Data → About
- **Each row uses inline styling for status** (toggle states, current value) where applicable
- **Sign out at the bottom in bordered button** (mechanical action, not destructive)
- **Delete account below sign out in red text** (destructive, requires confirmation flow)
- **Manage interests linked to interest list page**: separate from add new interest

### Messages list
- **Mutual context line under each conversation name**: "Both on Sam's path," "Premium 1:1 · Heavy-air helm work," "Both at ABC fleet"
- **Voice note previews as "Voice note · 0:47"**: typed message previews truncated normally
- **Unread indicator as small dot at right** (not badge count)
- **Editorial note at top**: "Conversations with people you share context with. Author commentary on your steps lives in those steps, not here." Explains the architectural distinction.
- **Settings card at bottom**: "Who can message you" with current state and change link

### Messages thread
- **Persistent relationship anchor card at top of thread**: "You're both on Sam North's Worlds preparation path. View path →" — keeps the *reason for the conversation* visible
- **Date dividers as quiet centered labels**: "Yesterday · 4:32 pm"
- **Voice messages rendered as first-class type**: play button, waveform visualization, duration. Not "voice attachment."
- **Send button is microphone-shaped, not arrow-shaped**: voice-first commitment continues. Text input field above gets text when typed; mic remains the primary submit.
- **Plus button on left**: opens attachment options (voice memo, photo, video, link to step/concept/path)
- **No read receipts visible by default**: opt-in per user
- **Time stamps on individual messages quiet (after the bubble)**, not on every message — only when there's a meaningful gap

### Architecture commitments locked by these mockups

- **The mutual context card is structural, not decorative**. It appears in three places: profile (Mihkel's), messages list (as the subtitle), and messages thread (as a persistent anchor). The relationship is always nameable.
- **Author commentary is structurally distinct from messaging**. The editorial note on the messages list says so explicitly. Subscribers find author notes in their step's After tab, not in messages.
- **Voice is the primary submit method in messaging**. The microphone button is the prominent action; text is supported but the visual hierarchy prefers voice.
- **The interest detail page is contemplative**. Vision excerpt and meaningful content lead; configuration is below the meaning; destruction is below configuration with a final visual break.
- **Settings doesn't try to be beautiful**. Functional, dense, predictable. The visual register is closer to iOS Settings than to the rest of the app.

---

## End

The product's social/identity architecture is now complete: profile (public), settings (private operational), messaging (gated, conversation-based), interests (switchable, contemplative detail page). This rounds out the architecture started in the original spec.

What remains for future design work: implementation specifications, AI prompt engineering for the synthesis surfaces, infrastructure work (Stripe, SSO, localization pipeline).
