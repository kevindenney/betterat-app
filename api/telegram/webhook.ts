/* eslint-disable no-console -- Vercel function: console is the canonical logging path. */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import Anthropic from '@anthropic-ai/sdk';
import { sendMessage, sendChatAction, answerCallbackQuery, downloadFile } from '../../lib/telegram/client';
import { getAnthropicTools, executeTool, getToolResponseKeyboard } from '../../lib/telegram/tools';
import { transcribeVoiceNote } from '../../lib/telegram/transcription';
import type { InlineKeyboardButton } from '../../lib/telegram/formatting';
import {
  createSupabaseClient,
  resolveAuthContext,
  generateLinkCode,
} from '../../services/capture/auth';
import {
  APP_URL,
  MAX_CONVERSATION_MESSAGES,
  MAX_TOOL_ITERATIONS,
  type UserContext,
} from '../../services/capture/types';

// Allow up to 120s for multi-tool chains (debrief flow: 5+ tool calls with AI analysis)
export const maxDuration = 120;

const buildSystemPrompt = (userCtx?: UserContext) => {
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`[telegram DEBUG] buildSystemPrompt: server date = ${new Date().toISOString()}, todayStr = ${todayStr}`);

  // Build user context block if available
  let userContextBlock = '';
  if (userCtx) {
    const parts: string[] = [];
    if (userCtx.fullName) parts.push(`The user's name is ${userCtx.fullName}.`);
    if (userCtx.activeInterest) parts.push(`They are currently working on: ${userCtx.activeInterest}.`);
    if (userCtx.interestDescription) parts.push(`Context: ${userCtx.interestDescription}`);
    if (userCtx.orgName) parts.push(`They are a member of ${userCtx.orgName}.`);
    if (userCtx.location) parts.push(`Their location/region: ${userCtx.location}.`);
    if (parts.length > 0) {
      userContextBlock = `\n\nUSER CONTEXT:\n${parts.join('\n')}\nUse this context to tailor your responses — reference their region, local resources, and domain when relevant. Do NOT assume they are in Hong Kong or any other default location.`;
    }
  }

  return `You are the BetterAt AI assistant, helping users manage their timeline via Telegram.
You help them track progress, create steps, mark tasks done, and plan next activities.
Users may be working on anything — learning goals, professional development, business growth, government scheme applications, certifications, or personal projects. Their steps and blueprints describe what they're working on.
Today's date is ${todayStr}. Use this as the reference for all date-related decisions.${userContextBlock}
Keep responses concise — this is a chat interface, not a document.
Use short paragraphs. Use *bold* for emphasis and _italic_ for secondary info.
Use bullet points with - for lists. Use \`code\` for IDs or technical values.
Avoid markdown headers — Telegram doesn't render them.
When tool results contain lists, summarize the key points rather than dumping raw data.
IMPORTANT: When you don't know the user's context, or they ask about their status, progress, options, eligibility, or what they should do next — ALWAYS call get_student_timeline first to understand what they're working on before responding. Never say "I can't help with that" without checking their timeline first.

CRITICAL RULES — READ CAREFULLY:
1. You MUST call tools to perform ANY action. NEVER pretend you did something without calling a tool.
2. NEVER say "Done" or "I've added" without having ACTUALLY called a tool first.
3. If the user wants to see their timeline, you MUST call get_student_timeline.
4. If the user wants to add evidence/photos to a step, you MUST call attach_step_evidence.
5. If the user wants nutrition logged, you MUST call log_nutrition with a step_id so it appears in the Review tab.
6. If the user wants a new step, you MUST call create_step.
7. Do NOT describe what you would do — actually DO it by calling the tool.
8. Every request that involves data REQUIRES at least one tool call.
9. NEVER fabricate step_ids or sub_step_ids. All IDs are UUIDs that come from tool results. If you need a step_id, call get_student_timeline first.
10. When reporting tool results to the user, ONLY report what the tool ACTUALLY returned. If a tool returned an error, tell the user about the error — do NOT pretend it succeeded.

STEP CREATION:
- When creating a step, ALWAYS populate the structured fields: what_will_you_do, sub_steps, capability_goals, and location_name.
- If the user mentions specific skills or competencies, look up competency IDs with get_competency_gaps first, then pass them as competency_ids.
- Convert conversation details into structured fields — don't just put everything in plan_notes or description.
- For dates: use date_offset_days (integer) instead of starts_at. 0 = today, 1 = tomorrow, 7 = next week, -1 = yesterday. If the user says a time, also pass time_of_day in "HH:MM" 24h format. If no date is mentioned, OMIT date_offset_days entirely — the system defaults to today. NEVER pass starts_at with an ISO date string — always use date_offset_days for relative dates.

SUB-STEP TRACKING:
- When the user mentions completing tasks or sub-steps, call get_step_detail to see their sub-steps, then use bulk_toggle_sub_steps to mark ALL completed ones at once (much more efficient than calling toggle_sub_step one at a time). Report progress (e.g. "3/5 sub-steps done!").
- When the user says they did something differently than planned, use log_sub_step_deviation to record what they actually did.
- When showing step details, highlight incomplete sub-steps so the user knows what's left.
- IMPORTANT: After a debrief, infer which sub-steps the user completed from their narrative and toggle them all with a single bulk_toggle_sub_steps call.

UPDATING STEPS:
- When the user wants to add sub-steps, change the plan, update location, or modify an existing step, call update_step.
- You MUST first call get_step_detail to get the step's current sub-steps, then call update_step with the FULL list (existing + new) since sub_steps replaces the entire list.
- Example: if a step has ["Gather supplies", "Practice technique"] and user says "add Clean up", call update_step with sub_steps: ["Gather supplies", "Practice technique", "Clean up"].
- Supported fields: what_will_you_do, sub_steps, capability_goals, location_name, competency_ids, plan_notes.

LOGGING OBSERVATIONS:
- When the user describes what happened during a step (debrief, recap, reflection), you MUST call log_observation to save their narrative.
- This is CRITICAL — the observation text is visible to faculty on the Act tab and provides qualitative evidence of learning.
- Summarize what the user reported: what they did, how it went, skills demonstrated, challenges encountered, and self-reflections.
- Always log the observation BEFORE calling analyze_step, so the evidence is recorded first.
- Even if the user doesn't explicitly ask to "log" anything, if they describe their experience on a step, log it as an observation.

DEBRIEF FLOW (when user describes what happened on a step):
0. Find the correct step_id:
   - FIRST check conversation history for [Steps: Title (UUID)] — use that UUID directly.
   - If no step_id in history, call get_student_timeline to find the matching step.
   - When multiple similar steps exist, ALWAYS prefer the most recently created one (highest created_at).
   - NEVER guess or fabricate a step_id — you must have a real UUID from a tool result or conversation context.
1. Call log_observation — save the narrative first
2. Call get_step_detail — see the sub-steps and their IDs
3. Call bulk_toggle_sub_steps — mark all completed sub-steps at once (infer from the narrative)
4. If user asks "how did I do?" or for assessment: call analyze_step, then save_competency_assessment
This order ensures all evidence is recorded efficiently within the tool iteration limit.
CRITICAL: The step_id is a UUID like "ee4d729f-7ec6-4277-a2e5-e558ed31174c". If previous assistant messages contain [Steps: ...] with IDs, use those. Otherwise call get_student_timeline to look it up. When multiple steps match, pick the one with the most recent created_at date.

COMPETENCY ASSESSMENT:
- When the user asks how they did, whether they demonstrated a skill, or to review their progress on a step, call analyze_step.
- IMPORTANT: After calling analyze_step and providing your assessment, you MUST also call save_competency_assessment with the structured results for each planned competency. This records their progress.
- When the user asks what competencies they're missing or what to work on next, call get_competency_gaps.
- When the user asks HOW to practice a specific skill, call suggest_next_step_for_competency.
- After suggesting a practice session, ask if the user wants you to create it as a step. If they say yes, call create_step with the structured details from your suggestion (title, sub_steps, capability_goals, competency_ids, location_name).`;
};

const buildPhotoSystemPrompt = (userCtx?: UserContext) => `${buildSystemPrompt(userCtx)}

The user has sent a photo. A photo_url has been uploaded and is available for you to attach to a step.

CRITICAL RULE: ALWAYS call get_student_timeline FIRST (with NO interest filter) to see ALL the user's steps across ALL interests. Then decide what to do based on the results.

CRITICAL RULE FOR FOOD PHOTOS: You must ALWAYS make TWO tool calls for food photos:
1. attach_step_evidence — to save the photo on the Train tab
2. log_nutrition with step_id — to extract and save nutritional data for the Review tab
Do NOT stop after attach_step_evidence. You are NOT done until log_nutrition has also been called.
If you only attach the photo without logging nutrition, the Review tab will have no nutrition data.

Your priority order:
1. If the user's caption mentions a step name or activity (e.g. "my IV insertion practice", "Monday nutrition", "add this to my drawing step"):
   - You ALREADY called get_student_timeline — look through the results for a step whose title matches
   - Use attach_step_evidence with the photo_url to attach it as evidence on the Act tab
   - Do NOT create a new step if one already exists with a matching title
   - If the photo is food/a meal: after attaching, you MUST also call log_nutrition with the step_id
2. If no step is mentioned and the photo appears to be food/a meal:
   - Find a matching nutrition step from get_student_timeline results
   - Call attach_step_evidence with the step_id
   - Call log_nutrition with the step_id to extract and save nutritional data
3. If neither applies, respond helpfully about what you see.

IMPORTANT: Do NOT pass an interest filter to get_student_timeline. The user has steps across many interests (fitness, sailing, nursing, art, etc.) and you must search all of them. Do NOT create a new step unless you searched and confirmed no matching step exists.

The uploaded photo URL is provided in the message as [Photo uploaded: URL]. Use this exact URL when calling attach_step_evidence.`;

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

  // Parse callback data: "done:<step_id>" | "wip:<step_id>" | "skip:<step_id>" | "attach:<step_id>" | "substep_done:<step_id>:<sub_step_id>"
  const colonIdx = data.indexOf(':');
  if (colonIdx < 0) {
    await answerCallbackQuery(queryId, 'Invalid action');
    return;
  }
  const action = data.slice(0, colonIdx);
  const rest = data.slice(colonIdx + 1);
  if (!action || !rest) {
    await answerCallbackQuery(queryId, 'Invalid action');
    return;
  }
  // For substep_done, rest = "<step_id>:<sub_step_id>"; for others, rest = "<step_id>"
  const stepId = action === 'substep_done' ? rest.slice(0, rest.indexOf(':')) : rest;

  // Resolve auth
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

  // Handle photo attachment callback
  if (action === 'attach') {
    // Look up pending photo from conversation
    const { data: convo } = await supabase
      .from('telegram_conversations')
      .select('pending_photo_url')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();

    const photoUrl = convo?.pending_photo_url as string | null;
    if (!photoUrl) {
      await answerCallbackQuery(queryId, 'No photo to attach — send a photo first');
      return;
    }

    // Attach the photo to the step
    const result = await executeTool(
      'attach_step_evidence',
      { step_id: stepId, photo_url: photoUrl, caption: 'Added via Telegram' },
      supabase,
      auth,
    );

    const parsed = JSON.parse(result);
    if (parsed.error) {
      await answerCallbackQuery(queryId, `Error: ${parsed.error}`);
      return;
    }

    // Clear pending photo
    await supabase
      .from('telegram_conversations')
      .update({ pending_photo_url: null })
      .eq('telegram_chat_id', chatId);

    await answerCallbackQuery(queryId, `📎 Photo attached to: ${parsed.step_title ?? 'step'}`);
    if (chatId) {
      await sendMessage(chatId, `📎 Photo attached as evidence to *${parsed.step_title ?? 'step'}*`);
    }
    return;
  }

  // Handle "View Step" detail callback
  if (action === 'detail') {
    const detailResult = await executeTool('get_step_detail', { step_id: stepId }, supabase, auth);
    const detailParsed = JSON.parse(detailResult);
    if (detailParsed.error) {
      await answerCallbackQuery(queryId, `Error: ${detailParsed.error}`);
      return;
    }
    await answerCallbackQuery(queryId);
    if (chatId) {
      const title = detailParsed.title ?? 'Step';
      const subs = (detailParsed.sub_steps ?? []) as { completed: boolean; text: string }[];
      const subList = subs.length
        ? '\n' + subs.map((ss: { completed: boolean; text: string }) => `${ss.completed ? '☑️' : '⬜'} ${ss.text}`).join('\n')
        : '';
      await sendMessage(chatId, `📋 *${title}*${subList}`);
    }
    return;
  }

  // Handle sub-step toggle callback
  if (action === 'substep_done') {
    const subStepId = rest.slice(rest.indexOf(':') + 1);
    if (!stepId || !subStepId) {
      await answerCallbackQuery(queryId, 'Invalid sub-step action');
      return;
    }

    const toggleResult = await executeTool(
      'toggle_sub_step',
      { step_id: stepId, sub_step_id: subStepId, completed: true },
      supabase,
      auth,
    );

    const toggleParsed = JSON.parse(toggleResult);
    if (toggleParsed.error) {
      await answerCallbackQuery(queryId, `Error: ${toggleParsed.error}`);
      return;
    }

    await answerCallbackQuery(queryId, `☑️ ${toggleParsed.sub_step_title ?? 'Sub-step'} done!`);
    if (chatId) {
      await sendMessage(chatId, `☑️ *${toggleParsed.sub_step_title ?? 'Sub-step'}* marked done\\! ${toggleParsed.progress ?? ''}`);
    }
    return;
  }

  // Handle status update callbacks (done/wip/skip)
  const statusMap: Record<string, string> = {
    done: 'completed',
    wip: 'in_progress',
    skip: 'skipped',
  };
  const newStatus = statusMap[action];
  if (!newStatus) {
    await answerCallbackQuery(queryId, 'Unknown action');
    return;
  }

  const result = await executeTool(
    'update_step_status',
    { step_id: stepId, status: newStatus },
    supabase,
    auth,
  );

  const parsed = JSON.parse(result);
  if (parsed.error) {
    await answerCallbackQuery(queryId, `Error: ${parsed.error}`);
    return;
  }

  const label = newStatus === 'completed' ? '✅ Done' : newStatus === 'in_progress' ? '▶️ Started' : '⏭️ Skipped';
  await answerCallbackQuery(queryId, `${label}: ${parsed.step?.title ?? 'step'}`);
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

  // --- Build auth context ---
  const auth = await resolveAuthContext(supabase, userId);

  // --- Fetch user context for system prompt ---
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
    console.error('[telegram] Failed to fetch user context:', e);
  }

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
  let systemPrompt = buildSystemPrompt(userCtx);
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
      systemPrompt = buildPhotoSystemPrompt(userCtx);
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

  const messages: Anthropic.MessageParam[] = [
    ...recentHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userContent },
  ];

  // --- Call Claude ---
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = getAnthropicTools();

  // Mark system prompt and tools for prompt caching — saves ~90% on repeated input tokens
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

  // --- Tool use loop ---
  let iterations = 0;
  let lastKeyboard: InlineKeyboardButton[][] | null = null;
  const mentionedStepIds: { id: string; title: string }[] = []; // Track step IDs for conversation context

  while (response.stop_reason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      console.log(`[telegram] Tool call #${iterations}: ${block.name}`, JSON.stringify(block.input).slice(0, 200));
      // Inject photo_url for attach_step_evidence — Claude often omits this optional param
      let toolInput = block.input;
      if (block.name === 'attach_step_evidence' && uploadedPhotoUrl) {
        toolInput = { ...block.input, photo_url: uploadedPhotoUrl };
      }
      const toolStart = Date.now();
      const result = await executeTool(block.name, toolInput, supabase, auth);
      console.log(`[telegram] Tool result (${Date.now() - toolStart}ms): ${block.name}`, result.slice(0, 300));
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      });
      // Extract step IDs from tool results for conversation context
      try {
        const parsed = JSON.parse(result);
        if (parsed.step?.id && parsed.step?.title) {
          mentionedStepIds.push({ id: parsed.step.id, title: parsed.step.title });
        } else if (parsed.step_id && parsed.step_title) {
          mentionedStepIds.push({ id: parsed.step_id, title: parsed.step_title });
        }
      } catch { /* ignore parse errors */ }
      // Check if this tool result warrants inline buttons
      // When a photo is pending, show "Attach to" buttons instead of Start/Done
      const keyboard = getToolResponseKeyboard(block.name, result, hasPhoto);
      if (keyboard !== null) {
        // Empty array = explicitly clear keyboard (e.g. after successful attachment)
        lastKeyboard = keyboard.length > 0 ? keyboard : null;
      }
    }

    messages.push({ role: 'assistant', content: response.content as Anthropic.ContentBlockParam[] });
    messages.push({ role: 'user', content: toolResults });

    // After 2nd tool call, send a progress message so user knows we're working
    if (iterations === 2) {
      await sendMessage(chatId, '_Processing... this may take a moment._');
    } else {
      await sendChatAction(chatId, 'typing');
    }

    console.log(`[telegram] Calling Claude iteration ${iterations + 1}...`);
    const claudeStart = Date.now();
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [cachedSystem],
      tools: cachedTools,
      messages,
    });
    console.log(`[telegram] Claude response (${Date.now() - claudeStart}ms): stop_reason=${response.stop_reason}`);
  }

  console.log(`[telegram] Tool loop done: ${iterations} iterations, stop_reason=${response.stop_reason}`);

  // --- Extract final text response ---
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  const responseText = textBlocks.map(b => b.text).join('\n\n') || "I processed your request but don't have anything to say.";

  // --- Send to Telegram (with optional inline keyboard) ---
  const sendOptions: {
    replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] };
  } = {};

  if (lastKeyboard) {
    sendOptions.replyMarkup = { inline_keyboard: lastKeyboard };
  }

  console.log(`[telegram] Sending response (${responseText.length} chars), stop_reason=${response.stop_reason}...`);
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
