import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { sendText, sendInteractive, markRead, downloadMedia } from '../../lib/whatsapp/client';
import { buildButtonPayload } from '../../lib/whatsapp/formatting';
import { getAnthropicTools, executeTool } from '../../lib/telegram/tools';
import { transcribeVoiceNote } from '../../lib/telegram/transcription';
import { normalizeTier } from '../../lib/subscriptions/sailorTiers';
import type { AuthContext } from '../../services/mcp/server';

// Bigger raw bodies for media-heavy webhooks; allow up to 120s for tool chains.
export const maxDuration = 120;

// Disable body parsing — we need the raw bytes for HMAC verification.
export const config = {
  api: { bodyParser: false },
};

const MAX_TOOL_ITERATIONS = 8;
const MAX_CONVERSATION_MESSAGES = 10;
const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://better.at';

// ---------------------------------------------------------------------------
// System prompt — same intent as the Telegram webhook, channel-light. Kept
// inline rather than imported because the Telegram prompt baked in some
// Telegram-specific formatting rules ("avoid markdown headers — Telegram
// doesn't render them") that also apply to WhatsApp.
// ---------------------------------------------------------------------------

interface UserContext {
  fullName?: string;
  activeInterest?: string;
  interestDescription?: string;
  orgName?: string;
  location?: string;
}

const buildSystemPrompt = (userCtx?: UserContext) => {
  const todayStr = new Date().toISOString().split('T')[0];

  let userContextBlock = '';
  if (userCtx) {
    const parts: string[] = [];
    if (userCtx.fullName) parts.push(`The user's name is ${userCtx.fullName}.`);
    if (userCtx.activeInterest) parts.push(`They are currently working on: ${userCtx.activeInterest}.`);
    if (userCtx.interestDescription) parts.push(`Context: ${userCtx.interestDescription}`);
    if (userCtx.orgName) parts.push(`They are a member of ${userCtx.orgName}.`);
    if (userCtx.location) parts.push(`Their location/region: ${userCtx.location}.`);
    if (parts.length > 0) {
      userContextBlock = `\n\nUSER CONTEXT:\n${parts.join('\n')}\nUse this context to tailor responses — reference their region, local resources, and domain when relevant.`;
    }
  }

  return `You are the BetterAt AI assistant, helping users manage their timeline via WhatsApp.
You help them track progress, create steps, mark tasks done, and plan next activities.
Today's date is ${todayStr}. Use this as the reference for all date-related decisions.${userContextBlock}
Keep responses concise — this is a chat interface, not a document.
Use short paragraphs. Use *bold* for emphasis and _italic_ for secondary info.
Use bullet points with - for lists. Use \`code\` for IDs or technical values.
Avoid markdown headers — WhatsApp renders them literally.

CRITICAL RULES:
1. You MUST call tools to perform ANY action. NEVER pretend you did something without calling a tool.
2. NEVER say "Done" without having actually called a tool.
3. If the user wants to see their timeline, call get_student_timeline.
4. If the user wants to add evidence/photos to a step, call attach_step_evidence.
5. If the user wants nutrition logged, call log_nutrition with a step_id.
6. If the user wants a new step, call create_step.
7. NEVER fabricate step_ids. All IDs are UUIDs that come from tool results.
8. When reporting tool results, ONLY report what the tool actually returned.

STEP CREATION:
- ALWAYS populate structured fields: what_will_you_do, sub_steps, capability_goals, location_name.
- For dates: use date_offset_days (integer, 0=today, 1=tomorrow, -1=yesterday). NEVER pass starts_at with an ISO date string.

DEBRIEF FLOW (when user describes what happened on a step):
1. Find the correct step_id (check conversation history for [Steps: Title (UUID)], else call get_student_timeline).
2. Call log_debrief for end-of-session retrospectives (split into what_learned / what_to_change / next_step_notes), or log_observation for short single-moment notes.
3. Call get_step_detail — see the sub-steps.
4. Call bulk_toggle_sub_steps — mark all completed sub-steps at once.
5. If user asks for assessment: call analyze_step then save_competency_assessment.`;
};

const buildPhotoSystemPrompt = (userCtx?: UserContext) => `${buildSystemPrompt(userCtx)}

The user has sent a photo. A photo_url has been uploaded and is available for you to attach to a step.

CRITICAL: ALWAYS call get_student_timeline FIRST (with no interest filter) to see ALL the user's steps before deciding what to do.

For food photos you must make TWO tool calls:
1. attach_step_evidence — saves the photo on the Train tab
2. log_nutrition with step_id — extracts nutritional data for the Review tab

The uploaded photo URL is provided in the message as [Photo uploaded: URL]. Use this exact URL when calling attach_step_evidence.`;

// ---------------------------------------------------------------------------
// Auth helpers (mirrored from api/telegram/webhook.ts)
// ---------------------------------------------------------------------------

async function resolveClubId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const selects = [
    'active_organization_id, organization_id, club_id',
    'organization_id, club_id',
    'club_id',
  ];

  for (const fields of selects) {
    const { data, error } = await supabase
      .from('users')
      .select(fields)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      const code = String(error?.code ?? '');
      const msg = String(error?.message ?? '').toLowerCase();
      if (['42703', 'PGRST204', 'PGRST205'].includes(code) || msg.includes('column')) continue;
      break;
    }

    const row = (data || {}) as Record<string, unknown>;
    const candidate = row.active_organization_id ?? row.organization_id ?? row.club_id ?? null;
    if (candidate && typeof candidate === 'string') return candidate;
  }

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .in('status', ['active', 'verified'])
    .limit(1)
    .maybeSingle();

  return membership?.organization_id ?? null;
}

function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveAuthContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<AuthContext> {
  const clubId = await resolveClubId(supabase, userId);
  const { data: userRow } = await supabase
    .from('users')
    .select('subscription_tier, email')
    .eq('id', userId)
    .maybeSingle();

  return {
    userId,
    email: userRow?.email ?? null,
    clubId,
    tier: normalizeTier(userRow?.subscription_tier),
  };
}

// ---------------------------------------------------------------------------
// Raw body + HMAC verification
// ---------------------------------------------------------------------------

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function verifySignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = Buffer.from(signatureHeader.slice('sha256='.length), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

// ---------------------------------------------------------------------------
// WhatsApp envelope types (subset we need)
// ---------------------------------------------------------------------------

interface WAMedia {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  voice?: boolean;
}

interface WAMessage {
  from: string;            // phone E.164 sans '+'
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'voice' | 'interactive' | 'button' | 'document' | 'video' | 'sticker' | 'location';
  text?: { body: string };
  image?: WAMedia;
  audio?: WAMedia;
  voice?: WAMedia;
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { payload?: string; text: string };
  context?: { from?: string; id?: string };
}

interface WAEnvelope {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: WAMessage[];
        statuses?: unknown[];
      };
    }[];
  }[];
}

// ---------------------------------------------------------------------------
// Interactive (button) reply handler — mirrors Telegram callback_query
// ---------------------------------------------------------------------------

async function handleButtonReply(
  phone: string,
  buttonId: string,
): Promise<void> {
  const supabase = createSupabaseClient();
  if (!supabase) {
    await sendText(phone, 'Sorry, the service is not configured yet.');
    return;
  }

  const colonIdx = buttonId.indexOf(':');
  if (colonIdx < 0) return;
  const action = buttonId.slice(0, colonIdx);
  const rest = buttonId.slice(colonIdx + 1);
  if (!action || !rest) return;
  const stepId = action === 'substep_done' ? rest.slice(0, rest.indexOf(':')) : rest;

  const { data: link } = await supabase
    .from('whatsapp_links')
    .select('user_id, linked_at')
    .eq('whatsapp_phone', phone)
    .eq('is_active', true)
    .maybeSingle();

  if (!link?.user_id || !link.linked_at) {
    await sendText(phone, 'Account not linked.');
    return;
  }

  const auth = await resolveAuthContext(supabase, link.user_id);

  // Photo attach
  if (action === 'attach') {
    const { data: convo } = await supabase
      .from('whatsapp_conversations')
      .select('pending_photo_url')
      .eq('whatsapp_phone', phone)
      .maybeSingle();

    const photoUrl = convo?.pending_photo_url as string | null;
    if (!photoUrl) {
      await sendText(phone, 'No photo to attach — send a photo first.');
      return;
    }

    const result = await executeTool(
      'attach_step_evidence',
      { step_id: stepId, photo_url: photoUrl, caption: 'Added via WhatsApp' },
      supabase,
      auth,
    );

    const parsed = JSON.parse(result);
    if (parsed.error) {
      await sendText(phone, `Error: ${parsed.error}`);
      return;
    }

    await supabase
      .from('whatsapp_conversations')
      .update({ pending_photo_url: null })
      .eq('whatsapp_phone', phone);

    await sendText(phone, `📎 Photo attached as evidence to *${parsed.step_title ?? 'step'}*`);
    return;
  }

  // Detail
  if (action === 'detail') {
    const detailResult = await executeTool('get_step_detail', { step_id: stepId }, supabase, auth);
    const detailParsed = JSON.parse(detailResult);
    if (detailParsed.error) {
      await sendText(phone, `Error: ${detailParsed.error}`);
      return;
    }
    const title = detailParsed.title ?? 'Step';
    const subs = (detailParsed.sub_steps ?? []) as { completed: boolean; text: string }[];
    const subList = subs.length
      ? '\n' + subs.map(ss => `${ss.completed ? '☑️' : '⬜'} ${ss.text}`).join('\n')
      : '';
    await sendText(phone, `📋 *${title}*${subList}`);
    return;
  }

  // Sub-step toggle
  if (action === 'substep_done') {
    const subStepId = rest.slice(rest.indexOf(':') + 1);
    if (!stepId || !subStepId) return;
    const result = await executeTool(
      'toggle_sub_step',
      { step_id: stepId, sub_step_id: subStepId, completed: true },
      supabase,
      auth,
    );
    const parsed = JSON.parse(result);
    if (parsed.error) {
      await sendText(phone, `Error: ${parsed.error}`);
      return;
    }
    await sendText(phone, `☑️ *${parsed.sub_step_title ?? 'Sub-step'}* marked done. ${parsed.progress ?? ''}`);
    return;
  }

  // Status update (done/wip/skip)
  const statusMap: Record<string, string> = {
    done: 'completed',
    wip: 'in_progress',
    skip: 'skipped',
  };
  const newStatus = statusMap[action];
  if (!newStatus) return;

  const result = await executeTool(
    'update_step_status',
    { step_id: stepId, status: newStatus },
    supabase,
    auth,
  );
  const parsed = JSON.parse(result);
  if (parsed.error) {
    await sendText(phone, `Error: ${parsed.error}`);
    return;
  }
  const label = newStatus === 'completed' ? '✅ Done' : newStatus === 'in_progress' ? '▶️ Started' : '⏭️ Skipped';
  await sendText(phone, `${label}: ${parsed.step?.title ?? 'step'}`);
}

// ---------------------------------------------------------------------------
// Message handler (text, image, voice)
// ---------------------------------------------------------------------------

async function handleMessage(
  message: WAMessage,
  profileName: string | null,
): Promise<void> {
  const phone = message.from;
  if (!phone) return;

  const supabase = createSupabaseClient();
  if (!supabase) {
    await sendText(phone, 'Sorry, the service is not configured yet. Please try again later.');
    return;
  }

  // Mark inbound as read so the user gets the typing indicator.
  if (message.id) {
    await markRead(message.id).catch(() => {});
  }

  // Interactive button reply → its own handler
  if (message.type === 'interactive') {
    const buttonId = message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id;
    if (buttonId) await handleButtonReply(phone, buttonId);
    return;
  }

  // Slash-style commands (typed in plain text)
  const text = message.type === 'text' ? message.text?.body?.trim() ?? '' : '';

  if (text === '/reset') {
    await supabase
      .from('whatsapp_conversations')
      .update({ messages: [] })
      .eq('whatsapp_phone', phone);
    await sendText(phone, '🔄 Conversation history cleared. Start fresh!');
    return;
  }

  // Resolve phone → BetterAt user
  const { data: link } = await supabase
    .from('whatsapp_links')
    .select('user_id, linked_at')
    .eq('whatsapp_phone', phone)
    .eq('is_active', true)
    .maybeSingle();

  if (!link?.user_id || !link.linked_at) {
    // Pairing flow: reuse an unexpired code if one exists, else mint a new one.
    const { data: existing } = await supabase
      .from('whatsapp_links')
      .select('link_code, link_code_expires_at')
      .eq('whatsapp_phone', phone)
      .gt('link_code_expires_at', new Date().toISOString())
      .is('linked_at', null)
      .maybeSingle();

    if (existing?.link_code) {
      await sendText(
        phone,
        `You already have a pending link code.\n\nOpen this URL while logged into BetterAt:\n${APP_URL}/settings/whatsapp?code=${existing.link_code}\n\nSend me another message after linking.`,
      );
      return;
    }

    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('whatsapp_links')
      .insert({
        whatsapp_phone: phone,
        whatsapp_profile_name: profileName,
        link_code: code,
        link_code_expires_at: expiresAt,
        last_inbound_at: new Date().toISOString(),
        is_active: true,
      });

    if (insertError) {
      const { error: updateError } = await supabase
        .from('whatsapp_links')
        .update({
          link_code: code,
          link_code_expires_at: expiresAt,
          whatsapp_profile_name: profileName,
          last_inbound_at: new Date().toISOString(),
          linked_at: null,
          is_active: true,
        })
        .eq('whatsapp_phone', phone);

      if (updateError) {
        console.error('WhatsApp link update error:', updateError.message);
        await sendText(phone, 'Sorry, something went wrong setting up your link. Please try again.');
        return;
      }
    }

    await sendText(
      phone,
      `Welcome to BetterAt! 👋\n\nLet's link your account. Open this URL while logged into BetterAt:\n${APP_URL}/settings/whatsapp?code=${code}\n\nThis link expires in 15 minutes. Send me another message after linking.`,
    );
    return;
  }

  const userId = link.user_id;

  // Update last_inbound_at for the 24-hour window tracker
  await supabase
    .from('whatsapp_links')
    .update({ last_inbound_at: new Date().toISOString() })
    .eq('whatsapp_phone', phone);

  // Auth context
  const auth = await resolveAuthContext(supabase, userId);

  // User context for system prompt
  let userCtx: UserContext | undefined;
  try {
    const [profileRes, interestRes, orgRes] = await Promise.all([
      supabase.from('profiles').select('full_name, bio').eq('id', userId).maybeSingle(),
      supabase
        .from('user_interests')
        .select('interest_id, interests!inner(name, description)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      auth.clubId
        ? supabase.from('organizations').select('name').eq('id', auth.clubId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const interest = interestRes.data as any;
    userCtx = {
      fullName: profileRes.data?.full_name ?? undefined,
      activeInterest: interest?.interests?.name ?? undefined,
      interestDescription: interest?.interests?.description ?? undefined,
      orgName: orgRes.data?.name ?? undefined,
      location: profileRes.data?.bio ?? undefined,
    };
  } catch (e) {
    console.error('[whatsapp] Failed to fetch user context:', e);
  }

  // Voice transcription
  let userText = text;
  let historyPrefix = '';
  const isVoice = message.type === 'audio' || message.type === 'voice';
  const voiceMedia = message.voice ?? message.audio;

  if (isVoice && voiceMedia?.id) {
    const audioBuffer = await downloadMedia(voiceMedia.id);
    if (!audioBuffer) {
      await sendText(phone, "Sorry, I couldn't download your voice note. Please try again.");
      return;
    }
    const transcription = await transcribeVoiceNote(
      audioBuffer,
      voiceMedia.mime_type || 'audio/ogg',
    );
    if (!transcription) {
      await sendText(phone, "Sorry, I couldn't transcribe your voice note. Please try typing instead.");
      return;
    }
    userText = transcription;
    historyPrefix = '[Voice note]: ';
  }

  // Conversation history
  let { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .select('id, messages')
    .eq('whatsapp_phone', phone)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from('whatsapp_conversations')
      .insert({ whatsapp_phone: phone, user_id: userId, messages: [] })
      .select('id, messages')
      .single();
    conversation = created;
  }

  const history = (conversation?.messages as { role: string; content: string }[]) ?? [];
  const recentHistory = history.slice(-MAX_CONVERSATION_MESSAGES);

  // Build user content (text or photo+caption)
  let userContent: Anthropic.ContentBlockParam[] | string;
  let systemPrompt = buildSystemPrompt(userCtx);
  let historyEntry = `${historyPrefix}${userText}`;
  let uploadedPhotoUrl = '';

  const hasPhoto = message.type === 'image' && !!message.image?.id;

  if (hasPhoto && message.image) {
    const photoBuffer = await downloadMedia(message.image.id);
    if (photoBuffer) {
      const fileId = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const storagePath = `${userId}/whatsapp/${fileId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('step-media')
        .upload(storagePath, photoBuffer, {
          contentType: message.image.mime_type || 'image/jpeg',
          upsert: false,
        });

      let photoUrl = '';
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('step-media').getPublicUrl(storagePath);
        photoUrl = urlData.publicUrl;
        uploadedPhotoUrl = photoUrl;
      } else {
        console.error('Photo upload error:', uploadError.message);
      }

      const base64 = photoBuffer.toString('base64');
      const captionText = message.image.caption || "What is this? If it's food, analyze and log the nutrition.";
      const photoUrlNote = photoUrl ? `\n\n[Photo uploaded: ${photoUrl}]` : '';

      userContent = [
        {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 },
        },
        { type: 'text' as const, text: `${captionText}${photoUrlNote}` },
      ];
      systemPrompt = buildPhotoSystemPrompt(userCtx);
      historyEntry = `[Sent a photo${message.image.caption ? `: ${message.image.caption}` : ''}]${photoUrl ? ` [url: ${photoUrl}]` : ''}`;

      if (photoUrl && conversation?.id) {
        await supabase
          .from('whatsapp_conversations')
          .update({ pending_photo_url: photoUrl })
          .eq('id', conversation.id);
      }
    } else {
      await sendText(phone, "Sorry, I couldn't download your photo. Please try again.");
      return;
    }
  } else {
    userContent = userText;
    if (conversation?.id) {
      await supabase
        .from('whatsapp_conversations')
        .update({ pending_photo_url: null })
        .eq('id', conversation.id);
    }
  }

  const messages: Anthropic.MessageParam[] = [
    ...recentHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userContent },
  ];

  // Call Claude with cached system + tools (same as Telegram)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = getAnthropicTools();

  const cachedSystem: Anthropic.TextBlockParam = {
    type: 'text',
    text: systemPrompt,
    cache_control: { type: 'ephemeral' },
  };
  const cachedTools = tools.map((tool, i) =>
    i === tools.length - 1
      ? { ...tool, cache_control: { type: 'ephemeral' as const } }
      : tool,
  );

  let response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: [cachedSystem],
    tools: cachedTools,
    messages,
  });

  // Tool loop
  let iterations = 0;
  const mentionedStepIds: { id: string; title: string }[] = [];

  while (response.stop_reason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      console.warn(`[whatsapp] Tool call #${iterations}: ${block.name}`, JSON.stringify(block.input).slice(0, 200));
      let toolInput = block.input;
      if (block.name === 'attach_step_evidence' && uploadedPhotoUrl) {
        toolInput = { ...block.input, photo_url: uploadedPhotoUrl };
      }
      const result = await executeTool(block.name, toolInput, supabase, auth);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      });
      try {
        const parsed = JSON.parse(result);
        if (parsed.step?.id && parsed.step?.title) {
          mentionedStepIds.push({ id: parsed.step.id, title: parsed.step.title });
        } else if (parsed.step_id && parsed.step_title) {
          mentionedStepIds.push({ id: parsed.step_id, title: parsed.step_title });
        }
      } catch { /* ignore */ }
    }

    messages.push({ role: 'assistant', content: response.content as Anthropic.ContentBlockParam[] });
    messages.push({ role: 'user', content: toolResults });

    if (iterations === 2) {
      await sendText(phone, '_Processing... this may take a moment._');
    }

    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [cachedSystem],
      tools: cachedTools,
      messages,
    });
  }

  // Extract final text
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  const responseText = textBlocks.map(b => b.text).join('\n\n') || "I processed your request but don't have anything to say.";

  // For now: text-only responses. Interactive button mapping (Done/Start/Attach)
  // can be added by porting getToolResponseKeyboard to a WhatsApp-flavored
  // helper that emits sendInteractive payloads (max 3 buttons).
  await sendText(phone, responseText);

  // Save conversation (same shape as Telegram)
  const stepContext = mentionedStepIds.length > 0
    ? ` [Steps: ${mentionedStepIds.map(s => `${s.title} (${s.id})`).join(', ')}]`
    : '';
  const savedAssistantContent = iterations > 0
    ? `[Used ${iterations} tool(s)]${stepContext} ${responseText.slice(0, 120)}`
    : responseText;

  const updatedHistory = [
    ...recentHistory,
    { role: 'user', content: historyEntry },
    { role: 'assistant', content: savedAssistantContent },
  ];

  await supabase
    .from('whatsapp_conversations')
    .update({
      messages: updatedHistory,
      last_active_at: new Date().toISOString(),
      user_id: userId,
    })
    .eq('id', conversation?.id);

  // Silence unused import warning when buttons are wired up later
  void buildButtonPayload;
  void sendInteractive;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET = Meta webhook verification handshake
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken && typeof challenge === 'string') {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // HMAC signature verification (raw body required)
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('whatsapp readRawBody failed:', err);
    res.status(400).json({ error: 'Invalid body' });
    return;
  }

  if (appSecret) {
    const sigHeader = req.headers['x-hub-signature-256'];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!verifySignature(rawBody, sig, appSecret)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  // Acknowledge fast — Meta retries aggressively otherwise.
  res.status(200).json({ ok: true });

  let envelope: WAEnvelope;
  try {
    envelope = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return;
  }

  const processUpdate = async () => {
    try {
      for (const entry of envelope.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== 'messages') continue;
          const value = change.value ?? {};
          const messages = value.messages ?? [];
          const contacts = value.contacts ?? [];

          for (const msg of messages) {
            const profileName = contacts.find(c => c.wa_id === msg.from)?.profile?.name ?? null;
            await handleMessage(msg, profileName);
          }
        }
      }
    } catch (error: any) {
      console.error('WhatsApp webhook error:', error?.message || error, error?.stack);
    }
  };

  waitUntil(processUpdate());
}
