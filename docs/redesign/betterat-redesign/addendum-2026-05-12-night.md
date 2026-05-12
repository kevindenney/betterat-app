# BetterAt Redesign — Addendum 3, May 12 2026 (night)

Extends the prior addenda with WhatsApp/Telegram integration decisions and four deep composition surfaces: WhatsApp capture, Vision composition, Review composition, and the Trophy of Becoming.

---

## 1. WhatsApp and Telegram integration — scope decision

### Five integration types considered

1. **Notification routing** — push notifications via WhatsApp/Telegram instead of native push
2. **Voice capture via WhatsApp** — voice notes to a BetterAt bot ingest into Raw Inbox
3. **Messaging bridge** — peer-to-peer messages delivered via WhatsApp
4. **Cohort group chats** — replace forums with WhatsApp groups
5. **Author broadcast channels** — replace authorial commentary with Telegram broadcasts

### Decisions

| Type | Decision |
|---|---|
| Notification routing | **Optional toggle** in Settings. Default off; default on for development-context users where WhatsApp is the primary digital surface. |
| Voice capture to Raw Inbox | **Yes**, as a WhatsApp bot. Primary capture mode for development-context users; optional convenience for everyone else. |
| Messaging bridge | **No**. The in-app messaging architecture (mutual context anchors, voice-first composition, link attachments) has too much structural value to degrade. |
| Cohort group chats | **No bridge**. Acknowledge that cohorts will form WhatsApp groups informally; don't compete. Forums handle structured cohort conversation; WhatsApp groups handle casual exchange. |
| Author broadcast channels | **In-app broadcast affordance** for path authors. Optional Telegram channel mirroring for power users. Author commentary on individual subscribers' work stays in-app (lands in the relevant step's After tab). |

### Architecture summary

The product has *narrow*, *purpose-specific* integrations with WhatsApp and Telegram — not a generalized bridge. Three specific integrations:

1. **WhatsApp bot for Raw Inbox capture** (high value, especially for development context)
2. **WhatsApp/Telegram notification routing** (low cost, optional)
3. **In-app broadcast affordance for authors** with optional Telegram channel mirroring

This preserves what's structurally distinctive (context-anchored messaging, structured forums, in-step author commentary) while accepting friction-reduction help where users genuinely live.

### WhatsApp capture flow

User-facing setup happens in Settings → Voice capture → "Capture by WhatsApp":
- BetterAt provides a phone number (likely Twilio-backed)
- User saves it as a WhatsApp contact
- User taps "Open WhatsApp to verify" — links to a pre-composed welcome message
- Once verified, voice notes and text sent to that number land in user's Raw Inbox

**What lands in Raw Inbox**:
- Voice notes transcribed automatically
- Text messages preserved verbatim
- Timestamp of capture
- Tagged to current active interest, OR to interest explicitly named in the message ("this is about sail racing — ...")

**What it doesn't do**:
- Auto-attach to a step
- Auto-feed a concept
- Auto-link to a path

The user processes Raw Inbox into proper reflections, concepts, or questions when they open the app. This preserves the context-anchoring discipline that's structural to the product.

---

## 2. Vision composition

The deepest single act of self-articulation in the product. Triggered 7-10 days after a new user joins.

### Trigger
The product holds back until the user has some practice to draw on. After ~10 days of activity, the next time the user opens the app, a single full-screen surface appears asking them to write their Vision.

If they decline ("Not ready · ask me later"), the product holds for another 2 weeks before asking again. After three declines, the prompt becomes a quiet notification rather than a surface, and the user can find it from the Reflect tab.

### Surface design

**Header**:
- Small label "Vision · [interest name]"
- Close icon (×) at top left — declining is acceptable

**Big question** in serif, 36px, two lines: "Why are you doing this?"

**Editorial framing** in serif body:
- "You've been sailing for ten days in this product. Long enough to know it's worth asking."
- "Not a goal. Not a measurable target. The reason underneath the reason — what's making you spend your weekends on cold water."

The framing specifies what *isn't* wanted (goals, targets) which is as important as what is.

**Capture surface**:
- Large microphone button as primary input
- "Hold to speak" label
- "Or write instead" as secondary affordance
- 200+ pixels of vertical space for the surface — generous, contemplative

**"If it helps to know" disclosure**:
- Small bordered card below the capture surface
- Explains what the Vision does ("shapes how the product responds to you")
- Explains who sees it ("only you and the system; path authors don't, cohort doesn't")
- Explains revision frequency ("rarely; a few times a year")

**"Not ready" escape**:
- Quiet button at the bottom
- Dismisses without writing

### Tone commitments
- The page treats the user's silence as acceptable
- No urgency, no pressure
- The biggest typography in the product is reserved for this question
- The user can close it; the product asks again later

### After submission
- The Vision is saved as the first draft for this interest
- Provenance recorded: timestamp, source (initial composition vs. revision)
- Vision appears in playbook and at the top of Reflect tab
- AI begins reading it to shape suggestions

---

## 3. Review composition (annual / path-completion)

Long-form retrospective writing. Triggered:
- By user, from Reflect tab → "Begin a review"
- Auto-suggested at major milestones (annual, path completion, half-Vision-arc)

### Surface design

**Header**:
- Small label "Reflect · Annual review"
- Save button (top right) — work is preserved as draft as user writes
- Date range subtitle ("Sail racing · March 2025 – May 2026")

**Title in serif**, 30px: "A year on the water" (AI-generated suggestion, user can edit)

**Opening note in serif**:
- "A look back at fourteen months. There's no right length. Take it as far as it goes."

**Three prompts**, each in serif at 22px:

1. **What have you actually been doing?**
   - Subtitle: "Not what you set out to do. What occupied the time."
2. **What's the shift you can name now that you couldn't six months ago?**
   - Subtitle: "One thing. One sentence is plenty."
3. **What's still open?**
   - Subtitle: "The questions you haven't answered. The things you don't yet know how to know."

Each prompt has:
- Capture surface (text input or voice)
- "From your timeline · if it helps" scaffolding card (AI-surfaced relevant content from the period)

### AI scaffolding

The composition surface differs from a step's After tab by providing AI-surfaced material at each prompt:
- **Prompt 1 (what you've been doing)**: surfaces high-signal reflections from the period; recent capability state changes; total session count
- **Prompt 2 (the shift)**: surfaces the "where your thinking has shifted" long-arc synthesis; concept evolution trails
- **Prompt 3 (what's still open)**: surfaces open questions from the playbook with frequency counts

The user can read the surfaced material as scaffolding *or* ignore it and write fresh. The scaffolding doesn't fill the answer — it provides handles.

### Persistence
- Auto-saved as user writes (every 30 seconds)
- "Saved automatically as you write" copy below the save button
- Can be returned to later from Reflect → "Drafts"
- Completed reviews stored in Reflect tab and accessible from Vision evolution timeline

### Voice composition
- Bottom of the page has a persistent voice composition bar
- "Hold to speak" mic button is large and primary
- "Or tap any prompt to type" as secondary affordance
- Voice composition can answer one prompt or multiple in sequence

---

## 4. Trophy of becoming

Auto-generated artifact when a major path completes (Felix finishes Stuart's 6-week intensive, Emily finishes her MSN, Mei finishes Stuart's coaching engagement). Combines Vision, path framing, key reflections, capability progressions, mentor commentary, concepts formed. Single navigable artifact.

### When it's generated
- 24-48 hours after path's final step is reflected on (allows time for last reflections to land)
- User receives a notification: "Stuart's path has wrapped. We've put together what you took from it."
- Tapping the notification opens the artifact

### Surface design

**Header**:
- Subtitle: date range ("Six weeks · March 24 – May 5, 2026")
- Title in serif, 32px: "What you took from Heavy-air helm work"
- Author block with avatar and credentials

**"When you started, you wrote"**:
- The Vision (or relevant excerpt) from the start of the path
- Or the user's "why" from week 1 of the path
- In serif italic, quoted

**"What changed"** in serif body:
- 2-3 paragraphs of AI-synthesized arc
- Reads in user's voice, drawn from their reflections
- Highest-stakes AI writing in the product — same register as "where your thinking has shifted"

**Capability arc visualization**:
- Single capability's progression across the path's duration
- Line drawing style matching Reflect tab

**"Moments along the way"**:
- 2-3 selected reflections with editorial framing
- Date and one-line context label per moment
- Quoted excerpts in serif

**"Stuart wrote"** (author commentary section):
- The most consequential authorial commentary the user received during the path
- Original date and reflection context preserved
- In bordered card with author avatar

**"Concepts that took shape"**:
- Pill list of concepts that formed or deepened during the path
- "All four now live in your playbook"

**"Where you ended"**:
- The user's final reflection (or excerpt) from the path's last step
- Quoted, in serif italic
- Provenance: "From your week 6 reflection"

**"What's next"**:
- One paragraph in serif
- Connects this path to the user's ongoing arc
- Names the next milestone if known (the Worlds, graduation)

**Actions**:
- Share this (creates read-only public link)
- Review Stuart's path (opens path rating/review surface)

### Sharing model
- Read-only link generated on share
- Recipient sees the artifact in a web view (no login required)
- User can revoke link anytime
- Multiple links per artifact supported (one for coach, one for parents, one for resume)
- User chooses what's included in the share (full artifact, or selected sections)

### Privacy commitments
- Author commentary included only with author's implicit consent (terms of service includes this)
- Author commentary can be redacted by author on request
- User can edit/redact their own reflections in the artifact before sharing
- Original timeline data not affected by edits to the artifact

### Use cases
- Felix shares with his coach back home as evidence of progress
- Emily shares with grad school admissions as evidence of clinical thinking development
- Mei shares with employer as professional development documentation
- David shares with his foursome as boast/journal hybrid
- Sunita shares with her SHG anchor woman as evidence of livelihood capability growth

---

## 5. New mockups added (this session)

- WhatsApp capture setup — `betterat_whatsapp_capture_setup`
- Vision composition — `betterat_vision_composition`
- Annual review composition — `betterat_review_composition_annual`
- Trophy of becoming (Stuart's path completion) — `betterat_trophy_of_becoming_stuart_path`

All described in this addendum but not yet saved as standalone HTML; see conversation transcript for full widget code.

---

## 6. What these mockups commit to

### WhatsApp capture
- The capture goes to Raw Inbox, not to a step or concept — preserves discipline
- User can mention interest in the message to tag it ("this is about sail racing — ...")
- Default routing is to the user's currently-active interest
- Text and voice both supported
- WhatsApp's end-to-end encryption respected in transit
- Once in BetterAt, the user's normal privacy settings apply

### Vision composition
- The biggest typography in the product (36px serif) is reserved for "Why are you doing this?"
- The framing specifies what isn't wanted (goals, targets) as much as what is
- "Not ready · ask me later" is acceptable — silence is honored
- The disclosure card explains what Vision does *and* who sees it (no one but the system)
- Voice is the primary input; text is secondary

### Review composition
- Three prompts, not one — the work is structured but not exhaustive
- Each prompt has AI scaffolding ("From your timeline · if it helps") that the user can use or ignore
- Auto-save every 30 seconds; drafts persist in Reflect
- Voice composition bar persistent at the bottom
- Title is AI-suggested but user-editable

### Trophy of becoming
- The structure mirrors a literary essay: opening intention → what changed → moments along the way → external voice → concepts formed → closing reflection → forward look
- AI synthesis appears in two places (the "what changed" paragraphs and any longer-arc framing)
- Author commentary is preserved verbatim with provenance
- Sharing creates a read-only link; user controls inclusion
- The artifact is navigable, not just readable — capability arc, moment cards, concept pills all tappable

---

## 7. Open work still remaining

Most of the architecture is now designed. Remaining surfaces:
- Concept detail page (full editing affordances)
- Resource detail in playbook
- Search results surface
- Forum design (cohort conversations)
- Year view of timeline
- Long-press context menus
- Faculty onboarding flow (Phase 3 of institutional onboarding)
- Student onboarding flow
- Author broadcast composition (the affordance for path authors to send a general message to their cohort)

Most of these are smaller surfaces — they don't have the architectural weight of Vision, Trophy, or messaging. They can be designed as a batch in a future session.

---

## End

The product's first-person composition architecture is now complete: step capture (Before/During/After), playbook ingestion, Vision composition, Review composition, and the Trophy of Becoming. Together these handle the full arc — from a single moment of practice to the long retrospective on a year of becoming.
