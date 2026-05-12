# BetterAt Redesign — Addendum 4, May 12 2026 (late night)

Extends the prior addenda with: revised bot architecture, shared service spec for unified ingestion, and user-research-informed strategic priorities.

This addendum reflects discovery that a Telegram bot is already built and doing sophisticated work (context inference, photo classification, voice transcription, debrief composition writing to `steps.metadata.review`).

---

## 1. Bot architecture — what's already working, what to refine

### Confirmed working
The existing Telegram bot (`api/telegram/webhook.ts`) does:
- Pure context inference — no `/setstep` command, no persistent pointer
- Recent conversation history scanning for `[Steps: Title (UUID)]` tags
- Photo classifier pre-routing food vs. non-food before tool loop
- Voice transcription via Gemini 2.0 Flash, transcript injected as `userText` upstream
- Inline keyboards with `callback_data` for in-bot conversation continuation
- `log_debrief` tool writes to `steps.metadata.review`, read by in-app Critique tab
- Cross-interest awareness without filtering — Claude reads full timeline, asks when ambiguous
- System prompt explicitly instructs Claude to ask for clarification rather than guess

### Refinements recommended

**Refinement 1: Drop the most-recently-created-step fallback.**

Current behavior: if nothing in history or mentions, falls back to most recently created step. This is a guess that can misfile content.

Proposed behavior: when confidence is below threshold, always ask. Use inline keyboards with 2-3 plausible destinations. Asking is honest; guessing is risky.

**Refinement 2: Add `recentlyActiveStep` as a context signal.**

Cross-surface continuity. When the user opens a step in the app, that creates a signal. The bot reads this signal and uses it for resolution. The user doesn't have to declare context that the system already has.

Implementation: a new table `user_active_context` tracking the last step a user interacted with, with timestamps. Read by the context-resolution layer when handling bot messages. Decays: high confidence for 15 minutes, medium for 1 hour, low for 4 hours, expired after 8 hours.

**Refinement 3: Always ask with specific options, never open-ended questions.**

When clarification is needed, populate `clarificationOptions` with the 2-3 most plausible destinations. Render as inline keyboards. Example: "About Saturday's race? About Wednesday's practice? Something else?" — never "Which step does this go on?"

**Refinement 4: Surface an "active step" indicator in-app.**

When the user is in a step view, a small ambient indicator at the top says "Active here — anything you capture in the next 15 min routes here by default." Tappable to extend, dismissable to clear. Makes the `recentlyActiveStep` signal legible and trustable.

**Refinement 5: Bring the bot's caliber of confirmation into the in-app evidence attachment flow.**

The bot says "5 pieces of evidence on your Moonraker step — photos from on the water and your key maintenance lesson about the outhaul strop geometry. Ready to debrief?" This is structurally aware, content-aware, forward-prompting.

The in-app version of evidence attachment should say the same. Same prose, same dignity. Run the bot's response composer for in-app capture too.

---

## 2. Bot debrief → Critique tab flow (design)

### The problem
Bot debrief composition is conversational (multiple messages, voice notes interspersed, inline keyboards). App Critique tab is a structured view. The translation between them must preserve fidelity without dumping a chat transcript into a form.

### The solution: conversational presentation, structured data

The bot conducts debrief as a conversation, but **internally tags every piece of user content with the prompt it answered**. Conversation flows naturally. Data is structured.

### Five canonical prompts

The bot adapts which prompts to ask based on user responses. If the user covers multiple in one answer, skip the redundant prompts. If the user is brief, prompt for depth.

1. **What happened?** — Factual recall
2. **What worked?** — Specific moments of execution
3. **What didn't?** — Honest accounting
4. **What did you learn?** — Forward signal
5. **Anything else worth noting?** — Open-ended catch-all

### Data structure

`steps.metadata.review` stores structured content:

```json
{
  "version": "2.0",
  "composed_via": "telegram_bot",
  "composed_at": "2026-05-12T09:14:00Z",
  "sections": [
    {
      "prompt": "what_happened",
      "prompt_label": "What happened?",
      "content": "We had decent boatspeed off the line...",
      "source": "voice_transcript",
      "duration_seconds": 47,
      "captured_at": "2026-05-12T09:14:23Z"
    },
    ...
  ],
  "summary": null
}
```

- `composed_via`: where this came from (telegram_bot, whatsapp_bot, in_app, watch)
- `prompt`: canonical name (consistent across versions)
- `prompt_label`: human-readable
- `source`: voice_transcript vs. text (affects rendering)

### What the Critique tab renders

When the user opens the Critique tab on a step that had bot-composed debrief:

- Header with step name + "Your debrief"
- Composition meta in small text: "Captured via Telegram, May 12 at 9:14 am · 4 min voice and text"
- "Your plan vs. what happened" comparison card (AI-generated from Before tab + sections)
- Five section blocks, each with:
  - Prompt as 19px serif subhead
  - Small mic icon if source was voice_transcript
  - User's content as 15px serif body
  - "Edit" affordance for refinement
- "Carry forward" section at bottom with AI-extracted forward intentions
- "Share" section showing which path author can read

Skipped prompts don't render. The composition shows only what's there.

### What the bot says at end of debrief

> Done! Your debrief is on Saturday's race — what happened, what worked, what didn't, and what you learned. Stuart can read it now. View it in the app, or here's a summary:
>
> _[2-3 sentence AI synthesis]_

The summary is the user's confirmation that the system got it right. Disagreement → edit or send correction.

---

## 3. Shared service architecture (spec)

### Principle
Extract everything from `webhook.ts` that isn't transport-specific into a standalone service. Telegram, WhatsApp, in-app voice capture, future Apple Watch capture — all call the same service.

### Service boundaries

**Transport adapters (thin):**
- `telegram-adapter`
- `whatsapp-adapter`
- `in-app-adapter`
- `watch-adapter` (future)

Each adapter:
- Receives transport-specific input (webhook, in-app event)
- Downloads media if remote
- Builds `CaptureEnvelope`
- Calls `capture-service.handleCapture()`
- Receives `ResponseEnvelope`
- Renders for its transport (inline keyboards / quick replies / in-app UI)
- Sends response via transport-specific API

**Capture service (thick, transport-agnostic):**
- `capture-service` (orchestrator)
- `context-resolution-service` (intelligence layer)
- `photo-classifier`
- `transcription` (Gemini wrapper)
- `tool-execution-service`
- `response-composer`

### The capture envelope

```typescript
interface CaptureEnvelope {
  userId: string;
  capturedAt: ISODateString;
  transport: "telegram" | "whatsapp" | "in_app" | "watch";
  transportMessageId: string;

  content: {
    text?: string;
    voiceTranscript?: {
      original: string;
      durationSeconds: number;
      transcribedBy: "gemini" | "whisper";
    };
    media?: Array<MediaAttachment>;
  };

  context: {
    recentMessages: Array<ConversationMessage>;
    activeInterest?: InterestId;
    recentlyActiveStep?: {
      stepId: string;
      lastInteractionAt: ISODateString;
      confidence: "high" | "medium" | "low";
    };
    explicitStepMention?: string;
    explicitInterestMention?: string;
  };

  capabilities: {
    supportsInlineKeyboard: boolean;
    supportsQuickReplies: boolean;
    supportsRichCards: boolean;
    supportsVoiceReply: boolean;
    maxMessageLength: number;
  };
}
```

### The response envelope

```typescript
interface ResponseEnvelope {
  primaryMessage: {
    text: string;
    formatting?: "markdown" | "html" | "plain";
  };
  followUpMessages?: Array<{text: string; delaySeconds?: number}>;
  actions?: Array<{
    label: string;
    callbackId: string;
    callbackPayload: any;
  }>;
  attachments?: Array<{type: string; data: any}>;
  toolResults: {
    stepId?: string;
    evidenceAdded?: number;
    conceptsUpdated?: string[];
    requiresClarification?: boolean;
    clarificationOptions?: Array<{label: string; payload: any}>;
  };
}
```

### Service flow

1. Transport adapter receives input
2. Adapter builds `CaptureEnvelope`
3. `capture-service.handleCapture(envelope)` called
4. `context-resolution-service.resolve(envelope)` returns destination or clarification request
5. If clarification needed: `response-composer.composeClarification()` returns envelope; adapter renders as keyboard/picker
6. If high confidence: `photo-classifier.classify()` for photos, then `tool-execution-service.run()` for the action, then `response-composer.composeSuccess()`
7. Adapter renders `ResponseEnvelope` for its transport and sends

### File / module structure

```
services/
  capture-service/
  context-resolution/
  photo-classifier/
  transcription/
  tool-execution/
    tools/
      attach-step-evidence/
      log-nutrition/
      log-debrief/
      ...
  response-composer/
    structural-language/ # generates "5 pieces of evidence..." prose

adapters/
  telegram/
  whatsapp/
  in-app/
```

### Migration plan

1. **Refactor first.** Extract logic from `webhook.ts` into service modules. Telegram bot now calls the service. Behavior identical to today.

2. **Add `recentlyActiveStep` signal.** New table, in-app instrumentation. Telegram bot uses it for resolution.

3. **Replace fallback with clarification.** Inline keyboard clarification when ambiguous. Behavior change: more questions, better accuracy.

4. **Build WhatsApp adapter.** Twilio or Cloud API. Same service underneath.

5. **Upgrade in-app capture.** Voice and photo capture in step During tab routes through service. Same caliber of confirmation as bot.

6. **Apple Watch (future).** Same service, watch adapter.

### Time estimates

- Steps 1-3: ~2 weeks for one engineer
- Step 4: ~3-4 weeks
- Step 5: ~2 weeks
- **Total: 7-9 weeks for full unification**

Telegram bot keeps working throughout. No pause in user-facing functionality.

---

## 4. User research — Emily and Mikkel

### Emily, 24, JHU MSN student

**Where she lives digitally**: iMessage, Discord (incl. JHU MSN cohort chat), Instagram, TikTok, WhatsApp (international family), Slack (nursing communities), email.

**Her practice context**: Clinical rotations scheduled by program. Reflections happen post-shift — bus home, before sleep, in the car between sites. Phone is primary device. Liminal moments dominate.

**What she wants from capture**:
- Speed (capture in <10 seconds or it doesn't happen)
- Voice-first (thumbs tired from charting)
- Forgiveness (easy editing, obvious undo)
- Group context > individual mentor (cohort chat is daily)
- Async (capture briefly, return later)
- Privacy paranoia (HIPAA-trained)

**Telegram bot reaction**: skeptical (Telegram reads as "tech bro" or "sketchy" to her peers). Would resist.

**WhatsApp bot reaction**: comfortable (family already uses it). Would adopt.

**In-app conversational interface reaction**: would love it if it works. Would bounce immediately if it feels like AI performance ("Tell me about your day!").

**Gaps in current design for her**:
- Switching between rotations within a day (med-surg morning, peds afternoon)
- Flagging uncertain content for later review ("did I make a med rec mistake?")
- Less pressure around Vision question (might not be ready for 16 weeks)
- Per-step visibility controls (sometimes she wants Patricia to read, sometimes not)

### Mikkel, 50, Danish Dragon sailor

**Where he lives digitally**: WhatsApp constantly (family, crew, fleet, business). Email professionally. Strava. Marine weather apps. Kindle. Desktop for serious work. iPhone as tool, not constant companion.

**His practice context**: Races weekends, midweek practice. Owns boat. Regular crew. Race is event; practice is preparation. Crew dinners as informal debriefs. Reads sailing books.

**What he wants from capture**:
- Depth over speed (will spend 20 minutes)
- Long-form voice notes (5-min recordings)
- Crew integration (reflection is partly theirs)
- Author relationship (would pay for Stuart's premium 1:1)
- Moderate privacy (tactical secrets, not technique reflections)
- The artifact matters (Trophy of Becoming after Worlds)

**Telegram bot reaction**: comfortable. Telegram normal for European 50-year-olds.

**WhatsApp bot reaction**: very comfortable. Wants WhatsApp listening on crew group chat (big request).

**In-app conversational interface reaction**: indifferent. Would judge by usefulness, not novelty. Prefers structured form that's fast over chat that asks questions.

**Gaps in current design for him**:
- Crew-shared playbook (smaller than cohort, larger than self) — currently architecture doesn't have a "crew" unit
- Equipment tracking (sails, rigging, instruments as first-class entities)
- Year-over-year comparison at same venue
- Inviter affordance (add crewman Erik without full onboarding)

### Universal needs (both users)

- Low capture friction
- Obvious, trustworthy privacy controls
- No performance (no cheerful AI persona, no gamification, no streak language)
- The trophy artifact > daily streak
- Real author relationships > AI commentary

### Strategic priorities (informed by users)

**1. WhatsApp > Telegram for the user base.** Keep Telegram, build WhatsApp on shared service. WhatsApp is required, not optional.

**2. Crew/small-group sharing is a real architectural gap.** Mikkel's crew, Emily's clinical pod. Between "you" and "cohort." Worth adding as explicit unit. Probably called "group" or "crew" depending on domain vocabulary.

**3. In-app conversational interface is secondary.** Emily would love it; Mikkel would tolerate it. Tab-based UI is foundation. Conversational mode could be opt-in via settings — a different "home" surface for users who want it.

**4. Equipment tracking is a real ask for sailors.** And golfers, climbers, photographers, woodworkers. Worth designing as optional layer for relevant interests.

**5. Trophy of Becoming is the most consequential feature.** Both users care. Justifies retention. Invest in synthesis quality.

**6. Passive listening on cohort group chats** (Mikkel's WhatsApp request): big idea, separate design pass. Privacy and trust implications significant. Probably next-major-feature.

**7. Inviter affordance is critical.** Without lightweight invites, the social graph stalls. Mikkel can't share crew context with Erik; Felix can't share with Henrik.

---

## 5. Decisions locked by this session

- **Telegram and WhatsApp are equally supported** transport adapters on a shared capture service
- **Telegram is "advanced" channel**; WhatsApp is "default for everyone"
- **The shared service is the right architecture** — extract first, build WhatsApp on it second
- **Debrief data structure is prompt-keyed sections**, not chat transcripts
- **Bot conversation is presentation; data structure is canonical**
- **In-app capture should match bot capability** — same confirmations, same context inference
- **`recentlyActiveStep` is the cross-surface continuity signal** that makes routing trustworthy
- **Clarification asks with specific options**, never open-ended
- **Most-recently-created-step fallback is dropped** in favor of asking
- **Crew/small-group as a unit** between self and cohort is added to the architecture (deferred design)
- **Equipment tracking** is a real ask for relevant interests (deferred design)
- **Inviter affordance** for adding non-users to shared contexts is added (deferred design)
- **Passive WhatsApp group listening** is a future feature, separate design pass (deferred)

---

## 6. New mockups added (this session)

- Critique tab rendering bot-composed debrief — `betterat_critique_tab_from_bot_debrief`

---

## 7. What's still open

- Crew/group unit design (between self and cohort)
- Equipment tracking layer
- Inviter affordance for non-users
- Passive cohort-group-chat listening (WhatsApp)
- In-app conversational interface as optional home surface
- Year-over-year venue comparison
- Per-step visibility controls (more granular than current cohort/private toggle)
- Mid-rotation switching (Emily's morning med-surg → afternoon peds)

These are next-phase design surfaces.

---

## End

The bot architecture is now properly understood and the shared service is specced. The product has a coherent capture story across Telegram (existing), WhatsApp (next), in-app (upgrade), and future surfaces. User research grounds the priorities — WhatsApp matters more than Telegram for the user base, crew-level sharing is a real gap, and the trophy artifact justifies long-term retention.
