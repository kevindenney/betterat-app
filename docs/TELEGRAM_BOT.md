# BetterAt Telegram Bot

The BetterAt Telegram bot lets users manage their learning timeline through chat. Users send text, voice notes, and photos — the bot uses Claude Haiku to understand intent and execute actions (create steps, log observations, track sub-steps, assess competencies, extract nutrition from food photos).

## Architecture

```
User sends message on Telegram
    ↓
Telegram Bot API forwards to webhook
    ↓
POST /api/telegram/webhook (Vercel serverless, 120s timeout)
    ↓
Resolve Telegram user → BetterAt user (via telegram_links table)
    ↓
Load conversation history (last 10 messages)
    ↓
Call Claude Haiku 4.5 with tools
    ↓ (up to 8 tool iterations)
Execute tools against Supabase (create step, log observation, etc.)
    ↓
Send response via Telegram (MarkdownV2 with inline buttons)
```

Everything runs on Vercel — no separate server. The bot is a webhook endpoint, not a long-running process.

---

## Quick Reference

| What | Where |
|------|-------|
| Webhook handler | `api/telegram/webhook.ts` |
| Account linking API | `api/telegram/link.ts` |
| Digest cron | `api/cron/telegram-digest.ts` |
| Telegram API client | `lib/telegram/client.ts` |
| Tool definitions | `lib/telegram/tools.ts` |
| Message formatting | `lib/telegram/formatting.ts` |
| Voice transcription | `lib/telegram/transcription.ts` |
| Digest builders | `lib/telegram/digest.ts` |
| In-app settings UI | `app/settings/telegram.tsx` |
| DB migrations | `supabase/migrations/20260329120000_telegram_integration.sql` |
| | `supabase/migrations/20260330120000_telegram_digest_preferences.sql` |
| | `supabase/migrations/20260330140000_telegram_pending_photo.sql` |

---

## Setup (from scratch)

### 1. Create a Telegram bot

1. Open Telegram, message `@BotFather`
2. Send `/newbot`
3. Choose a display name (e.g. "BetterAt Assistant")
4. Choose a username (e.g. `betterat_bot`) — must end in `bot`
5. BotFather replies with a token like `7123456789:AAH...` — save this

### 2. Set environment variables

Add to Vercel (Dashboard → Settings → Environment Variables) or `.env.local`:

```
TELEGRAM_BOT_TOKEN=7123456789:AAHxxxxxxxxx    # From BotFather
TELEGRAM_WEBHOOK_SECRET=<random string>        # Generate: openssl rand -hex 32
EXPO_PUBLIC_TELEGRAM_BOT_USERNAME=betterat_bot
```

These are also needed (should already be set):
```
ANTHROPIC_API_KEY=...          # Claude API for the AI
GOOGLE_AI_API_KEY=...          # Gemini for voice transcription
EXPO_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...                # For digest cron authentication
EXPO_PUBLIC_APP_URL=...        # e.g. https://better.at
```

### 3. Deploy

Push to trigger a Vercel deployment (or `vercel deploy`). The webhook endpoint goes live at:
```
https://<your-domain>/api/telegram/webhook
```

### 4. Register the webhook with Telegram

Tell Telegram where to send messages:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?\
url=https://<your-vercel-domain>/api/telegram/webhook&\
secret_token=<WEBHOOK_SECRET>&\
allowed_updates=[\"message\",\"callback_query\"]"
```

You should get `{"ok":true,"result":true}`.

Or use the helper in code:
```typescript
import { setWebhook } from '@/lib/telegram/client';
await setWebhook('https://your-domain/api/telegram/webhook', 'your-secret');
```

### 5. Test it

Message your bot on Telegram. First message triggers the account linking flow:
1. Bot generates a 6-character code (e.g. `A3K9F2`)
2. Bot sends a link: `https://better.at/settings/telegram?code=A3K9F2`
3. Open the link while logged into BetterAt
4. App confirms the link
5. Now messages go through to your BetterAt account

---

## Account Linking Flow

```
User messages bot for first time
    ↓
Bot creates telegram_links row with:
  - telegram_user_id (from Telegram)
  - link_code: random 6-char [A-Z2-9]
  - link_code_expires_at: 15 minutes from now
    ↓
Bot sends: "Click this link to connect: https://better.at/settings/telegram?code=A3K9F2"
    ↓
User opens link in browser (must be logged into BetterAt)
    ↓
App POSTs to /api/telegram/link with Bearer JWT + code
    ↓
API validates JWT, looks up code, updates telegram_links:
  - user_id = authenticated user
  - linked_at = now
  - link_code = null (consumed)
    ↓
Done — future messages resolve Telegram user → BetterAt user
```

**Unlinking:** Settings → Telegram → Disconnect (sets `is_active = false`).

---

## What the Bot Can Do

### Message Types
- **Text** — parsed by Claude, routed to appropriate tools
- **Voice notes** — transcribed via Google Gemini 2.0 Flash, then processed as text
- **Photos** — downloaded, uploaded to Supabase Storage, analyzed by Claude (multimodal)
- **Inline button presses** — mark steps done, attach photos, toggle sub-steps

### Tools Available to Claude

| Tool | What it does |
|------|-------------|
| `get_student_timeline` | List user's steps (filter by status, interest) |
| `get_step_detail` | Full step with sub-steps, evidence, progress |
| `create_step` | New step with structured Plan (what/how/why/who) |
| `update_step` | Modify title, description, sub-steps, dates |
| `update_step_status` | Mark completed/in_progress/skipped |
| `toggle_sub_step` | Mark one sub-step done/undone |
| `bulk_toggle_sub_steps` | Mark multiple sub-steps at once (efficient) |
| `log_observation` | Save narrative debrief text |
| `log_sub_step_deviation` | Record what actually happened vs. planned |
| `attach_step_evidence` | Attach photo to step |
| `log_nutrition` | Extract nutrition data from food photo |
| `analyze_step` | Get competency analysis data |
| `save_competency_assessment` | Record structured skill assessment |
| `get_competency_gaps` | Show skills needing work |
| `suggest_next_step_for_competency` | Get practice suggestions |
| `list_interests` | Show user's active interests |
| `get_suggested_next_steps` | New blueprint steps to adopt |

### Common Flows

**Create a step:**
> User: "I want to practice IV insertion tomorrow at the sim lab"
> Bot: Creates step with title, date, location, sub-steps → shows Start/View buttons

**Debrief a session:**
> User: "Just finished my clinical rotation. Got the IV on first stick but forgot to document in EHR"
> Bot: Logs observation → finds matching step → toggles completed sub-steps → shows progress

**Photo evidence:**
> User: sends photo of simulation
> Bot: "I see your photo. Which step should I attach this to?" → shows Attach buttons

**Food tracking:**
> User: sends photo of lunch
> Bot: Attaches to active step + extracts nutrition data (calories, protein, etc.)

**Check progress:**
> User: "What do I have coming up?"
> Bot: Lists pending/in-progress steps with dates

---

## Inline Buttons

The bot sends clickable buttons below messages:

| Button | Callback Data | Action |
|--------|--------------|--------|
| ▶️ Start now | `wip:<step_id>` | Mark step in_progress |
| ✅ Done | `done:<step_id>` | Mark step completed |
| ⏭ Skip | `skip:<step_id>` | Mark step skipped |
| 📋 View Step | `detail:<step_id>` | Show step details |
| 📎 Attach to: Step | `attach:<step_id>` | Attach pending photo |
| ☑️ Done: Sub-step | `substep_done:<step_id>:<sub_step_id>` | Toggle sub-step |

---

## Daily Digests

Automated morning and evening summaries sent to linked users.

**Cron schedule** (in `vercel.json`):
```json
{ "path": "/api/cron/telegram-digest?type=morning", "schedule": "0 8 * * *" }
{ "path": "/api/cron/telegram-digest?type=evening", "schedule": "0 20 * * *" }
```

**Morning (8:00 UTC):** Today's steps + in-progress items
**Evening (20:00 UTC):** Completed today + still in-progress + motivational note

Users can disable digests in their telegram_links record (`digest_enabled = false`).

---

## Database Tables

### telegram_links
Maps Telegram accounts to BetterAt users.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → auth.users |
| telegram_user_id | BIGINT | Telegram's numeric ID |
| telegram_username | TEXT | Display name |
| telegram_chat_id | BIGINT | Chat ID for sending messages |
| link_code | TEXT | Temporary 6-char linking code |
| link_code_expires_at | TIMESTAMPTZ | Code expiry (15 min) |
| linked_at | TIMESTAMPTZ | When linked (null = not yet) |
| is_active | BOOLEAN | Soft delete flag |
| digest_enabled | BOOLEAN | Default true |
| digest_timezone | TEXT | Default 'UTC' |
| created_at | TIMESTAMPTZ | |

**Unique constraints:**
- One active link per Telegram user (`telegram_user_id` WHERE `is_active = true`)
- One active link code (`link_code` WHERE `link_code IS NOT NULL`)

**RLS:** Users can read/update their own links only.

### telegram_conversations
Stores conversation history for Claude context.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| telegram_chat_id | BIGINT | Telegram chat ID |
| user_id | UUID | FK → auth.users |
| messages | JSONB | Array of `{role, content}` turns |
| pending_photo_url | TEXT | Temp URL when photo awaiting attachment |
| last_active_at | TIMESTAMPTZ | Last interaction |
| created_at | TIMESTAMPTZ | |

**RLS:** Users can read their own conversations only.

---

## Troubleshooting

### Bot doesn't respond to messages

1. **Check webhook is registered:**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```
   Should show your Vercel URL, `pending_update_count`, and no errors.

2. **Check Vercel function logs:**
   ```bash
   vercel logs --filter /api/telegram/webhook
   ```
   Or check Vercel Dashboard → Deployments → Functions tab.

3. **Check env vars are set:**
   - `TELEGRAM_BOT_TOKEN` — must match the bot you're messaging
   - `TELEGRAM_WEBHOOK_SECRET` — must match what you passed to `setWebhook`
   - `ANTHROPIC_API_KEY` — Claude API key must be valid

4. **Check the webhook secret matches:**
   The secret passed to `setWebhook` must exactly match `TELEGRAM_WEBHOOK_SECRET` in Vercel env. If they differ, every request returns 401.

### Bot responds but can't find user's steps

- User's Telegram account may not be linked. Check `telegram_links` table:
  ```sql
  SELECT * FROM telegram_links WHERE telegram_user_id = <id> AND is_active = true;
  ```
- If `linked_at` is null, the linking flow wasn't completed.
- If `user_id` is null, same issue — user needs to click the link while logged in.

### Bot gives wrong steps / wrong interest

- Check which interest the user has active. The bot uses the user's active interest context.
- Conversation history (last 10 messages) may reference old steps. User can say "start fresh" or send `/new`.

### Voice notes not transcribed

- Needs `GOOGLE_AI_API_KEY` env var (uses Gemini 2.0 Flash)
- Check Vercel logs for transcription errors
- Telegram sends voice as `.oga` (Ogg Opus) — ensure Gemini accepts this format

### Photos not attaching

- Photo flow: download from Telegram → upload to Supabase Storage → store URL in `pending_photo_url`
- If Supabase Storage isn't configured, upload fails silently
- Check `step-media` bucket exists in Supabase Storage

### MarkdownV2 formatting errors

The bot tries MarkdownV2 first, falls back to plaintext, then strips all special chars. If messages look weird:
- Check Vercel logs for "MarkdownV2 failed, retrying as plaintext"
- This is usually self-healing — the fallback chain handles it

### Linking code expired

Codes expire after 15 minutes. If expired:
1. User sends another message to the bot
2. Bot generates a new code
3. User clicks the new link

### Digests not sending

1. Check cron is configured in `vercel.json`
2. Check `CRON_SECRET` env var is set
3. Check user has `digest_enabled = true` and `telegram_chat_id` is not null in `telegram_links`
4. Check Vercel cron logs: Dashboard → Crons tab

---

## Configuration Reference

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot API authentication (from @BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | Validates incoming webhooks |
| `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` | Yes | Bot username (without @) for deep links |
| `ANTHROPIC_API_KEY` | Yes | Claude Haiku API |
| `GOOGLE_AI_API_KEY` | Yes | Gemini voice transcription |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Database |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Privileged DB access |
| `CRON_SECRET` | Yes | Digest cron authentication |
| `EXPO_PUBLIC_APP_URL` | No | App URL for links (default: `https://better.at`) |

### Key Constants (in code)

| Constant | Value | Location |
|----------|-------|----------|
| `MAX_TOOL_ITERATIONS` | 8 | `api/telegram/webhook.ts` |
| `MAX_CONVERSATION_MESSAGES` | 10 | `api/telegram/webhook.ts` |
| `MAX_MESSAGE_LENGTH` | 4096 | `lib/telegram/client.ts` |
| `maxDuration` | 120s | `api/telegram/webhook.ts` |
| Link code expiry | 15 min | `api/telegram/webhook.ts` |
| Link code format | 6 chars `[A-Z2-9]` | `api/telegram/webhook.ts` |

### Claude Model

- **Model:** `claude-haiku-4-5-20251001`
- **Max tokens:** 1024 per response
- **Prompt caching:** Enabled (system prompt + tools cached with ephemeral TTL)

---

## Known Gotchas

1. **Date hallucination** — Haiku invents dates. Step creation uses `date_offset_days` (integer: 0=today, 1=tomorrow) instead of ISO strings. Server-side validation rejects dates >365 days off.

2. **Photo URL injection** — Claude sometimes omits the `photo_url` parameter when calling `attach_step_evidence`. The webhook auto-injects it from the uploaded URL.

3. **Pending photo lifecycle** — A pending photo URL is cleared when the user sends their next text message. Photos must be attached (via button or Claude) before the next message.

4. **Session caching** — Conversation history is in `telegram_conversations.messages`. If it gets corrupted, delete the row — it'll be recreated on next message.

5. **MarkdownV2 strictness** — Telegram's MarkdownV2 rejects messages with unescaped special characters. The bot has a 3-level fallback: MarkdownV2 → plaintext → stripped. If formatting looks wrong, it's this fallback working correctly.

6. **Tool iteration limit** — Max 8 tool calls per message. Complex debrief flows (log → detail → toggle → analyze → assess) use 5-6 iterations. If the bot seems to stop mid-flow, this limit may have been hit.

7. **Webhook secret mismatch** — If you rotate `TELEGRAM_WEBHOOK_SECRET`, you must re-register the webhook with Telegram. The old secret in Telegram's config won't match the new env var.

---

## Updating the Bot

### Adding a new tool

1. Add tool definition in `lib/telegram/tools.ts` (Zod schema + handler)
2. Add instructions to the system prompt in `api/telegram/webhook.ts`
3. Deploy to Vercel
4. Test via Telegram — no webhook re-registration needed

### Changing the AI model

Edit `api/telegram/webhook.ts`:
```typescript
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001', // ← change this
  ...
});
```

### Changing digest schedule

Edit `vercel.json` crons array and redeploy.

### Switching to a different bot

1. Create new bot with @BotFather
2. Update `TELEGRAM_BOT_TOKEN` and `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` in Vercel
3. Re-register webhook with new bot token
4. Users will need to re-link (old links still reference old bot's user IDs — Telegram user IDs are the same across bots, so existing links actually still work)
