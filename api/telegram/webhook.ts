/* eslint-disable no-console -- Vercel function: console is the canonical logging path. */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import type Anthropic from '@anthropic-ai/sdk';
import { sendMessage, sendChatAction, answerCallbackQuery, downloadFile } from '../../lib/telegram/client';
import { getToolResponseKeyboard } from '../../lib/telegram/tools';
import { transcribeVoiceNote } from '../../lib/telegram/transcription';
import type { InlineKeyboardButton } from '../../lib/telegram/formatting';
import {
  createSupabaseClient,
  resolveAuthContext,
  generateLinkCode,
  loadUserContext,
} from '../../services/capture/auth';
import { provisionUserFromInvite } from '../../services/capture/telegramInvite';
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

// Allow up to 120s for multi-tool chains (debrief flow: 5+ tool calls with AI analysis)
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Telegram types (subset we need)
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: TelegramUser;
    chat: { id: number; type: string };
    date: number;
    text?: string;
    photo?: { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }[];
    voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
    caption?: string;
  };
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
}

// ---------------------------------------------------------------------------
// Callback query handler (inline keyboard button presses)
// ---------------------------------------------------------------------------

async function handleCallbackQuery(
  callbackQuery: NonNullable<TelegramUpdate['callback_query']>,
): Promise<void> {
  const { id: queryId, from, data, message: cbMessage } = callbackQuery;
  if (!data || !cbMessage) {
    await answerCallbackQuery(queryId, 'Invalid action');
    return;
  }

  const supabase = createSupabaseClient();
  if (!supabase) {
    await answerCallbackQuery(queryId, 'Service not configured');
    return;
  }

  const action = parseButtonPayload(data);
  if (action.kind === 'invalid') {
    await answerCallbackQuery(queryId, 'Invalid action');
    return;
  }

  // Resolve auth (Telegram-specific link table)
  const { data: link } = await supabase
    .from('telegram_links')
    .select('user_id, linked_at')
    .eq('telegram_user_id', from.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!link?.user_id || !link.linked_at) {
    await answerCallbackQuery(queryId, 'Account not linked');
    return;
  }

  const auth = await resolveAuthContext(supabase, link.user_id);
  const chatId = cbMessage.chat?.id;

  // For attach actions, pre-fetch the pending photo URL from the Telegram
  // conversations table (channel-specific key shape).
  let pendingPhotoUrl: string | null = null;
  if (action.kind === 'attach') {
    const { data: convo } = await supabase
      .from('telegram_conversations')
      .select('pending_photo_url')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();
    pendingPhotoUrl = (convo?.pending_photo_url as string | null) ?? null;

    if (!pendingPhotoUrl) {
      await answerCallbackQuery(queryId, 'No photo to attach — send a photo first');
      return;
    }
  }

  const result = await runButtonAction(action, {
    supabase,
    auth,
    channel: 'telegram',
    pendingPhotoUrl,
  });

  if (!result.ok) {
    await answerCallbackQuery(queryId, `Error: ${result.error}`);
    return;
  }

  if (result.kind === 'attach') {
    // Clear pending photo
    await supabase
      .from('telegram_conversations')
      .update({ pending_photo_url: null })
      .eq('telegram_chat_id', chatId);

    await answerCallbackQuery(queryId, `📎 Photo attached to: ${result.stepTitle ?? 'step'}`);
    if (chatId) {
      await sendMessage(chatId, `📎 Photo attached as evidence to *${result.stepTitle ?? 'step'}*`);
    }
    return;
  }

  if (result.kind === 'detail') {
    await answerCallbackQuery(queryId);
    if (chatId) {
      const title = result.title ?? 'Step';
      const subList = result.subSteps.length
        ? '\n' + result.subSteps.map(ss => `${ss.completed ? '☑️' : '⬜'} ${ss.text}`).join('\n')
        : '';
      await sendMessage(chatId, `📋 *${title}*${subList}`);
    }
    return;
  }

  if (result.kind === 'substep_done') {
    await answerCallbackQuery(queryId, `☑️ ${result.subStepTitle ?? 'Sub-step'} done!`);
    if (chatId) {
      // MarkdownV2: escape '!' as '\!'.
      await sendMessage(chatId, `☑️ *${result.subStepTitle ?? 'Sub-step'}* marked done\\! ${result.progress ?? ''}`);
    }
    return;
  }

  // result.kind === 'status'
  await answerCallbackQuery(queryId, `${statusLabel(result.newStatus)}: ${result.stepTitle ?? 'step'}`);
}

// ---------------------------------------------------------------------------
// Message handler (text, photo, voice)
// ---------------------------------------------------------------------------

async function handleMessage(
  message: NonNullable<TelegramUpdate['message']>,
): Promise<void> {
  const telegramUserId = message.from?.id;
  const chatId = message.chat.id;
  const username = message.from?.username ?? null;

  if (!telegramUserId || !message.from) return;

  // Determine message type and content
  const hasText = !!message.text;
  const hasPhoto = !!(message.photo && message.photo.length > 0);
  const hasVoice = !!message.voice;

  // Skip if no usable content
  if (!hasText && !hasPhoto && !hasVoice) return;

  const text = message.text?.trim() ?? '';

  // --- Supabase ---
  const supabase = createSupabaseClient();
  if (!supabase) {
    await sendMessage(chatId, 'Sorry, the service is not configured yet. Please try again later.');
    return;
  }

  // --- Handle /reset command — clear conversation history ---
  if (hasText && text === '/reset') {
    await supabase
      .from('telegram_conversations')
      .update({ messages: [] })
      .eq('telegram_chat_id', chatId);
    await sendMessage(chatId, '🔄 Conversation history cleared. Start fresh!');
    return;
  }

  // --- Handle /start command ---
  if (hasText && text.startsWith('/start')) {
    const payload = text.split(' ')[1];
    if (payload?.startsWith('invite_')) {
      // Telegram-first onboarding: a facilitator-shared invite auto-provisions
      // and links a brand-new BetterAt account — no app round-trip, no form.
      const { data: alreadyLinked } = await supabase
        .from('telegram_links')
        .select('user_id, linked_at')
        .eq('telegram_user_id', telegramUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (alreadyLinked?.user_id && alreadyLinked.linked_at) {
        await sendMessage(chatId, "You're already connected to BetterAt. Send me a message or voice note to capture your day.");
        return;
      }

      const result = await provisionUserFromInvite(supabase, payload.replace('invite_', ''), {
        telegramUserId,
        username,
        firstName: message.from?.first_name ?? null,
        lastName: message.from?.last_name ?? null,
      });

      if (!result.ok || !result.userId) {
        const reasonCopy =
          result.reason === 'expired'
            ? 'That invite link has expired. Ask whoever shared it for a fresh one.'
            : result.reason === 'used'
              ? 'That invite link has already been used. Ask for a fresh one.'
              : 'Sorry, I couldn\'t use that invite link. Ask whoever shared it for a fresh one.';
        await sendMessage(chatId, reasonCopy);
        return;
      }

      // Link this Telegram identity to the freshly-provisioned account.
      // telegram_links has no unique constraint on telegram_user_id, so update
      // an existing (e.g. stale pending) row if present, otherwise insert.
      const linkRow = {
        telegram_username: username,
        telegram_chat_id: chatId,
        user_id: result.userId,
        linked_at: new Date().toISOString(),
        link_code: null,
        link_code_expires_at: null,
        is_active: true,
      };
      const { data: existingLink } = await supabase
        .from('telegram_links')
        .select('id')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();

      const { error: linkErr } = existingLink?.id
        ? await supabase.from('telegram_links').update(linkRow).eq('id', existingLink.id)
        : await supabase
            .from('telegram_links')
            .insert({ ...linkRow, telegram_user_id: telegramUserId });

      if (linkErr) {
        console.error('Telegram invite link error:', linkErr.message);
        await sendMessage(chatId, 'Almost there — something went wrong linking your account. Please try the link again.');
        return;
      }

      const firstName = (result.fullName ?? '').split(' ')[0] || 'there';
      await sendMessage(
        chatId,
        `✅ You're all set, ${firstName}! Your BetterAt is ready.\n\n` +
          'Just send me a voice note or a message about what you did today — an order, a supplier run, a batch you finished — and it lands on your timeline.',
      );
      return;
    }
    if (payload?.startsWith('link_')) {
      await sendMessage(
        chatId,
        `To link your account, open this URL while logged into BetterAt:\n\n${APP_URL}/settings/telegram?code=${payload.replace('link_', '')}`,
      );
    } else {
      await sendMessage(
        chatId,
        "Welcome to BetterAt! 👋\n\nI'm your AI learning assistant. I can help you:\n\n" +
          '- Check your timeline and progress\n' +
          '- Create new learning steps\n' +
          '- Mark tasks as done\n' +
          '- Get suggestions for what to do next\n' +
          '- Analyze meal photos for nutrition tracking\n' +
          '- Process voice notes\n\n' +
          "Send me any message to get started. If this is your first time, I'll help you link your account.",
      );
    }
    return;
  }

  // --- Resolve Telegram user → BetterAt user ---
  const { data: link } = await supabase
    .from('telegram_links')
    .select('user_id, linked_at')
    .eq('telegram_user_id', telegramUserId)
    .eq('is_active', true)
    .maybeSingle();

  if (!link?.user_id || !link.linked_at) {
    // Rate-limit: if an unexpired code already exists, don't generate a new one
    const { data: existing } = await supabase
      .from('telegram_links')
      .select('link_code, link_code_expires_at')
      .eq('telegram_user_id', telegramUserId)
      .gt('link_code_expires_at', new Date().toISOString())
      .is('linked_at', null)
      .maybeSingle();

    if (existing?.link_code) {
      await sendMessage(
        chatId,
        `You already have a pending link code.\n\nOpen this URL while logged into BetterAt:\n${APP_URL}/settings/telegram?code=${existing.link_code}\n\nSend me another message after linking.`,
      );
      return;
    }

    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('telegram_links')
      .insert({
        telegram_user_id: telegramUserId,
        telegram_username: username,
        link_code: code,
        link_code_expires_at: expiresAt,
        is_active: true,
      });

    if (insertError) {
      const { error: updateError } = await supabase
        .from('telegram_links')
        .update({
          link_code: code,
          link_code_expires_at: expiresAt,
          telegram_username: username,
          linked_at: null,
          is_active: true,
        })
        .eq('telegram_user_id', telegramUserId);

      if (updateError) {
        console.error('Telegram link update error:', updateError.message);
        await sendMessage(chatId, 'Sorry, something went wrong setting up your link. Please try again.');
        return;
      }
    }

    // Also store chat_id for digest cron
    await supabase
      .from('telegram_links')
      .update({ telegram_chat_id: chatId })
      .eq('telegram_user_id', telegramUserId);

    await sendMessage(
      chatId,
      `I don't recognize your account yet. Let's link it!\n\nOpen this URL while logged into BetterAt:\n${APP_URL}/settings/telegram?code=${code}\n\nThis link expires in 15 minutes. Send me another message after linking.`,
    );
    return;
  }

  const userId = link.user_id;

  // Ensure chat_id is stored for digest cron
  await supabase
    .from('telegram_links')
    .update({ telegram_chat_id: chatId })
    .eq('telegram_user_id', telegramUserId);

  // --- Build auth context + user context for system prompt ---
  const auth = await resolveAuthContext(supabase, userId);
  const userCtx = await loadUserContext(supabase, userId, auth.clubId);

  // --- Send typing indicator ---
  await sendChatAction(chatId, 'typing');

  // --- Handle voice notes: transcribe → treat as text ---
  let userText = text;
  let historyPrefix = '';

  if (hasVoice && message.voice) {
    const audioBuffer = await downloadFile(message.voice.file_id);
    if (!audioBuffer) {
      await sendMessage(chatId, "Sorry, I couldn't download your voice note. Please try again.");
      return;
    }

    const transcription = await transcribeVoiceNote(
      audioBuffer,
      message.voice.mime_type || 'audio/ogg',
    );

    if (!transcription) {
      await sendMessage(chatId, "Sorry, I couldn't transcribe your voice note. Please try typing your message instead.");
      return;
    }

    userText = transcription;
    historyPrefix = '[Voice note]: ';
  }

  // Record the inbound modality so logged observations distinguish spoken
  // voice notes from typed messages.
  auth.inputSource = hasVoice && message.voice ? 'voice' : 'text';

  // --- Build Claude messages ---
  let { data: conversation } = await supabase
    .from('telegram_conversations')
    .select('id, messages')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from('telegram_conversations')
      .insert({ telegram_chat_id: chatId, user_id: userId, messages: [] })
      .select('id, messages')
      .single();
    conversation = created;
  }

  const history = (conversation?.messages as { role: string; content: string }[]) ?? [];
  const recentHistory = history.slice(-MAX_CONVERSATION_MESSAGES);

  // Build user content — text or photo+caption
  let userContent: Anthropic.ContentBlockParam[] | string;
  let systemPrompt = buildSystemPrompt(userCtx, 'telegram');
  let historyEntry = `${historyPrefix}${userText}`;
  let uploadedPhotoUrl = ''; // Hoisted so we can inject it into tool calls

  if (hasPhoto && message.photo) {
    // Use the largest photo (last in array)
    const largestPhoto = message.photo[message.photo.length - 1];
    const photoBuffer = await downloadFile(largestPhoto.file_id);

    if (photoBuffer) {
      // Upload to Supabase Storage so it's permanently available
      const fileId = `tg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const storagePath = `${userId}/telegram/${fileId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('step-media')
        .upload(storagePath, photoBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      let photoUrl = '';
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('step-media')
          .getPublicUrl(storagePath);
        photoUrl = urlData.publicUrl;
        uploadedPhotoUrl = photoUrl; // Make available to tool loop
      } else {
        console.error('Photo upload error:', uploadError.message);
      }

      const base64 = photoBuffer.toString('base64');
      const captionText = message.caption || 'What is this? If it\'s food, analyze and log the nutrition.';
      const photoUrlNote = photoUrl ? `\n\n[Photo uploaded: ${photoUrl}]` : '';

      userContent = [
        {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 },
        },
        {
          type: 'text' as const,
          text: `${captionText}${photoUrlNote}`,
        },
      ];
      systemPrompt = buildPhotoSystemPrompt(userCtx, 'telegram');
      historyEntry = `[Sent a photo${message.caption ? `: ${message.caption}` : ''}]${photoUrl ? ` [url: ${photoUrl}]` : ''}`;

      // Store pending photo URL so callback buttons can attach it
      if (photoUrl && conversation?.id) {
        await supabase
          .from('telegram_conversations')
          .update({ pending_photo_url: photoUrl })
          .eq('id', conversation.id);
      }
    } else {
      await sendMessage(chatId, "Sorry, I couldn't download your photo. Please try again.");
      return;
    }
  } else {
    userContent = userText;

    // Clear any pending photo when the user sends a text message (no longer relevant)
    if (conversation?.id) {
      await supabase
        .from('telegram_conversations')
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

  // --- Run Claude tool-use loop via shared CaptureService ---
  let lastKeyboard: InlineKeyboardButton[][] | null = null;

  const { responseText, iterations, mentionedStepIds } = await runConversationTurn({
    systemPrompt,
    messages: initialMessages,
    supabase,
    auth,
    channel: 'telegram',
    uploadedPhotoUrl: uploadedPhotoUrl || undefined,
    onToolResult: (toolName, rawResult) => {
      // Telegram-only: inline-keyboard hints. When a photo is pending, show
      // "Attach to" buttons instead of Start/Done.
      const keyboard = getToolResponseKeyboard(toolName, rawResult, hasPhoto);
      if (keyboard !== null) {
        // Empty array = explicitly clear keyboard (e.g. after successful attachment)
        lastKeyboard = keyboard.length > 0 ? keyboard : null;
      }
    },
    onProgress: async (iteration) => {
      // After 2nd tool call, send a progress message so user knows we're working
      if (iteration === 2) {
        await sendMessage(chatId, '_Processing... this may take a moment._');
      } else {
        await sendChatAction(chatId, 'typing');
      }
    },
  });

  // --- Send to Telegram (with optional inline keyboard) ---
  const sendOptions: {
    replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] };
  } = {};

  if (lastKeyboard) {
    sendOptions.replyMarkup = { inline_keyboard: lastKeyboard };
  }

  console.log(`[telegram] Sending response (${responseText.length} chars, ${iterations} iterations)...`);
  let sendResult = await sendMessage(chatId, responseText, sendOptions);
  if (!sendResult.ok) {
    console.error(`[telegram] sendMessage FAILED (MarkdownV2+fallback): ${sendResult.description}`);
    // Last resort: strip ALL formatting and send raw text
    try {
      const stripped = responseText.replace(/[*_`~\[\]()>#+=|{}.!\\-]/g, '');
      sendResult = await sendMessage(chatId, stripped || 'Done! Check your timeline in the app.', {
        ...sendOptions,
        parseMode: undefined as any,
      });
      if (!sendResult.ok) {
        console.error(`[telegram] sendMessage FAILED (stripped): ${sendResult.description}`);
      }
    } catch (e) {
      console.error(`[telegram] sendMessage stripped fallback error:`, e);
    }
  } else {
    console.log(`[telegram] Response sent OK`);
  }

  // --- Save conversation ---
  // Save only a short summary when tools were used. This prevents Haiku from
  // learning to mimic verbose "Created!" responses without calling tools.
  // When no tools were used, save the full response (it's just conversation).
  // IMPORTANT: Include step IDs so follow-up messages (debrief, assessment) can reference them.
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
    .from('telegram_conversations')
    .update({
      messages: updatedHistory,
      last_active_at: new Date().toISOString(),
      user_id: userId,
    })
    .eq('id', conversation?.id);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Validate webhook secret
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
    if (secretHeader !== webhookSecret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  // Respond 200 to Telegram IMMEDIATELY to prevent retries.
  // Use waitUntil to keep the function alive for background processing.
  res.status(200).json({ ok: true });

  const update = req.body as TelegramUpdate;

  const processUpdate = async () => {
    try {
      // Handle inline keyboard button presses
      if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
        return;
      }

      // Handle messages (text, photo, voice)
      if (update.message?.from) {
        await handleMessage(update.message);
      }
    } catch (error: any) {
      console.error('Telegram webhook error:', error?.message || error, error?.stack);

      try {
        const chatId = update?.message?.chat?.id;
        if (chatId) {
          const errMsg = error?.message?.slice(0, 200) || 'Unknown error';
          await sendMessage(chatId, `Sorry, something went wrong. Please try again.\n\nDebug: ${errMsg}`);
        }
      } catch {
        // Ignore - best effort
      }
    }
  };

  waitUntil(processUpdate());
}
