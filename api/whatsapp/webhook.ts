/* eslint-disable no-console -- Vercel function: console is the canonical logging path. */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import crypto from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { sendText, sendInteractive, markRead, downloadMedia } from '../../lib/whatsapp/client';
import { buildButtonPayload } from '../../lib/whatsapp/formatting';
import { transcribeVoiceNote } from '../../lib/telegram/transcription';
import {
  createSupabaseClient,
  resolveAuthContext,
  generateLinkCode,
  loadUserContext,
} from '../../services/capture/auth';
import {
  buildSystemPrompt,
  buildPhotoSystemPrompt,
} from '../../services/capture/systemPrompt';
import {
  APP_URL,
  MAX_CONVERSATION_MESSAGES,
} from '../../services/capture/types';
import {
  parseButtonPayload,
  runButtonAction,
  statusLabel,
} from '../../services/capture/actions';
import { runConversationTurn } from '../../services/capture/conversation';

// Bigger raw bodies for media-heavy webhooks; allow up to 120s for tool chains.
export const maxDuration = 120;

// Disable body parsing — we need the raw bytes for HMAC verification.
export const config = {
  api: { bodyParser: false },
};

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

  const action = parseButtonPayload(buttonId);
  if (action.kind === 'invalid') return;

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

  // For attach actions, pre-fetch the pending photo URL from the WhatsApp
  // conversations table (channel-specific key shape).
  let pendingPhotoUrl: string | null = null;
  if (action.kind === 'attach') {
    const { data: convo } = await supabase
      .from('whatsapp_conversations')
      .select('pending_photo_url')
      .eq('whatsapp_phone', phone)
      .maybeSingle();
    pendingPhotoUrl = (convo?.pending_photo_url as string | null) ?? null;

    if (!pendingPhotoUrl) {
      await sendText(phone, 'No photo to attach — send a photo first.');
      return;
    }
  }

  const result = await runButtonAction(action, {
    supabase,
    auth,
    channel: 'whatsapp',
    pendingPhotoUrl,
  });

  if (!result.ok) {
    await sendText(phone, `Error: ${result.error}`);
    return;
  }

  if (result.kind === 'attach') {
    await supabase
      .from('whatsapp_conversations')
      .update({ pending_photo_url: null })
      .eq('whatsapp_phone', phone);

    await sendText(phone, `📎 Photo attached as evidence to *${result.stepTitle ?? 'step'}*`);
    return;
  }

  if (result.kind === 'detail') {
    const title = result.title ?? 'Step';
    const subList = result.subSteps.length
      ? '\n' + result.subSteps.map(ss => `${ss.completed ? '☑️' : '⬜'} ${ss.text}`).join('\n')
      : '';
    await sendText(phone, `📋 *${title}*${subList}`);
    return;
  }

  if (result.kind === 'substep_done') {
    await sendText(phone, `☑️ *${result.subStepTitle ?? 'Sub-step'}* marked done. ${result.progress ?? ''}`);
    return;
  }

  // result.kind === 'status'
  await sendText(phone, `${statusLabel(result.newStatus)}: ${result.stepTitle ?? 'step'}`);
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

  // Auth context + user context for system prompt
  const auth = await resolveAuthContext(supabase, userId);
  const userCtx = await loadUserContext(supabase, userId, auth.clubId);

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
  let systemPrompt = buildSystemPrompt(userCtx, 'whatsapp');
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
      systemPrompt = buildPhotoSystemPrompt(userCtx, 'whatsapp');
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

  const initialMessages: Anthropic.MessageParam[] = [
    ...recentHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userContent },
  ];

  // Run Claude tool-use loop via shared CaptureService
  const { responseText, iterations, mentionedStepIds } = await runConversationTurn({
    systemPrompt,
    messages: initialMessages,
    supabase,
    auth,
    channel: 'whatsapp',
    uploadedPhotoUrl: uploadedPhotoUrl || undefined,
    onProgress: async (iteration) => {
      if (iteration === 2) {
        await sendText(phone, '_Processing... this may take a moment._');
      }
    },
  });

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

    if (verifyToken && mode === 'subscribe' && token === verifyToken && typeof challenge === 'string') {
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
