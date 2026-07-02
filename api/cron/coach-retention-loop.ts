import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildCoachRetentionDeliveries } from '../../lib/coach/retentionCron';
import {
  hasPendingChannel,
  isCompleteWeeklyRecapPayload,
  isFullyDispatched,
  RetentionDispatchRow,
} from '../../lib/coach/retentionDispatch';

type RetentionDeliveryRecord = {
  id: string;
  user_id: string;
  delivery_type: 'reminders' | 'weekly_recap';
  payload: Record<string, unknown>;
  dispatched_at?: string | null;
  in_app_dispatched_at?: string | null;
  push_dispatched_at?: string | null;
  email_dispatched_at?: string | null;
  dispatch_error?: string | null;
  push_dispatch_error?: string | null;
  email_dispatch_error?: string | null;
};

type DeliveryUpdate = {
  id: string;
  in_app_dispatched_at?: string | null;
  push_dispatched_at?: string | null;
  email_dispatched_at?: string | null;
  dispatched_at?: string | null;
  dispatch_error?: string | null;
  push_dispatch_error?: string | null;
  email_dispatch_error?: string | null;
};

function buildNotificationContent(row: Pick<RetentionDeliveryRecord, 'delivery_type' | 'payload'>): { title: string; body: string } {
  if (row.delivery_type === 'reminders') {
      const reminders = Array.isArray((row.payload as any).reminders)
      ? (row.payload as any).reminders
      : [];
    const label = reminders[0]?.label || 'You have pending coach actions';
    return {
      title: 'Coach reminders',
      body: String(label),
    };
  }

  const completed = Number((row.payload as any).completedActions || 0);
  const pending = Number((row.payload as any).pendingActions || 0);
  return {
    title: 'Weekly coach recap',
    body: `${completed} completed, ${pending} pending this week`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmailViaSendGrid(input: {
  apiKey: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.toEmail }] }],
        from: { email: input.fromEmail, name: 'BetterAt' },
        subject: input.subject,
        content: [
          { type: 'text/plain', value: input.body },
          { type: 'text/html', value: `<p>${escapeHtml(input.body)}</p>` },
        ],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `sendgrid_${response.status}:${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'sendgrid_request_failed' };
  }
}

const handler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const lookback = new Date(now);
    lookback.setUTCDate(lookback.getUTCDate() - 35);

    const { data: assessmentRows, error: assessmentError } = await supabase
      .from('assessment_records')
      .select('organization_id,evaluator_id,status,evidence,assessed_at,created_at')
      .or(`created_at.gte.${lookback.toISOString()},assessed_at.gte.${lookback.toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(12000);
    if (assessmentError) throw assessmentError;

    const deliveries = buildCoachRetentionDeliveries((assessmentRows || []) as any[], now);
    const { error: insertError } = await supabase
      .from('coach_retention_deliveries')
      .upsert(deliveries, {
        onConflict: 'organization_id,user_id,delivery_type,window_start,window_end',
      });
    if (insertError) throw insertError;

    const { data: pendingRows, error: pendingError } = await supabase
      .from('coach_retention_deliveries')
      .select(
        'id,user_id,delivery_type,payload,dispatched_at,in_app_dispatched_at,push_dispatched_at,email_dispatched_at,dispatch_error,push_dispatch_error,email_dispatch_error'
      )
      .is('dispatched_at', null)
      .order('created_at', { ascending: true })
      .limit(500);
    if (pendingError) throw pendingError;

    const rows = (pendingRows || []) as RetentionDeliveryRecord[];
    if (rows.length === 0) {
      return res.status(200).json({
        ok: true,
        inserted: deliveries.length,
        dispatched: 0,
        pushDispatched: 0,
        emailDispatched: 0,
        skipped: true,
        reason: 'No pending retention deliveries to dispatch',
      });
    }

    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    const [{ data: prefsRows, error: prefsError }, { data: userRows, error: usersError }] = await Promise.all([
      supabase
        .from('notification_preferences')
        .select('user_id,push_enabled,email_enabled')
        .in('user_id', userIds),
      supabase
        .from('users')
        .select('id,email')
        .in('id', userIds),
    ]);
    if (prefsError) throw prefsError;
    if (usersError) throw usersError;

    const prefByUserId = new Map<string, { push_enabled?: boolean; email_enabled?: boolean }>();
    for (const row of prefsRows || []) {
      const typed = row as { user_id?: string | null; push_enabled?: boolean; email_enabled?: boolean };
      if (!typed.user_id) continue;
      prefByUserId.set(typed.user_id, typed);
    }

    const emailByUserId = new Map<string, string>();
    for (const row of userRows || []) {
      const typed = row as { id?: string | null; email?: string | null };
      const id = String(typed.id || '').trim();
      const email = String(typed.email || '').trim();
      if (!id || !email) continue;
      emailByUserId.set(id, email);
    }

    const updatesById = new Map<string, DeliveryUpdate>();
    for (const row of rows) {
      updatesById.set(row.id, {
        id: row.id,
        in_app_dispatched_at: row.in_app_dispatched_at || null,
        push_dispatched_at: row.push_dispatched_at || null,
        email_dispatched_at: row.email_dispatched_at || null,
        dispatch_error: row.dispatch_error || null,
        push_dispatch_error: row.push_dispatch_error || null,
        email_dispatch_error: row.email_dispatch_error || null,
        dispatched_at: row.dispatched_at || null,
      });
    }

    const invalidWeeklyRecapRows = rows.filter((row) => {
      if (row.delivery_type !== 'weekly_recap') return false;
      return !isCompleteWeeklyRecapPayload(row.payload || {});
    });
    if (invalidWeeklyRecapRows.length > 0) {
      for (const row of invalidWeeklyRecapRows) {
        const next = updatesById.get(row.id);
        if (!next) continue;
        next.in_app_dispatched_at = nowIso;
        next.push_dispatched_at = nowIso;
        next.email_dispatched_at = nowIso;
        next.dispatched_at = nowIso;
        next.dispatch_error = 'invalid_weekly_recap_payload';
        next.push_dispatch_error = null;
        next.email_dispatch_error = null;
      }
    }

    const invalidWeeklyRecapIds = new Set(invalidWeeklyRecapRows.map((row) => row.id));
    const rowsToDispatch = rows.filter((row) => !invalidWeeklyRecapIds.has(row.id));

    const inAppRows = rowsToDispatch.filter((row) =>
      hasPendingChannel(row as RetentionDispatchRow, 'in_app')
    );
    if (inAppRows.length > 0) {
      const notifications = inAppRows.map((row) => {
        const { title, body } = buildNotificationContent(row);
        return {
          user_id: row.user_id,
          type: 'new_message',
          title,
          body,
          data: {
            source: 'coach_retention_loop',
            delivery_type: row.delivery_type,
            payload: row.payload,
          },
        };
      });

      const { error: inAppError } = await supabase
        .from('social_notifications')
        .insert(notifications);
      if (inAppError) {
        const ids = inAppRows.map((row) => row.id);
        await supabase
          .from('coach_retention_deliveries')
          .update({ dispatch_error: inAppError.message })
          .in('id', ids);
        throw inAppError;
      }
      for (const row of inAppRows) {
        const next = updatesById.get(row.id);
        if (!next) continue;
        next.in_app_dispatched_at = nowIso;
        next.dispatch_error = null;
      }
    }

    const pushRows = rowsToDispatch.filter((row) =>
      hasPendingChannel(row as RetentionDispatchRow, 'push')
    );
    const pushRecipientRows = pushRows.filter((row) => (prefByUserId.get(row.user_id)?.push_enabled ?? true));
    const pushSkippedRows = pushRows.filter((row) => !(prefByUserId.get(row.user_id)?.push_enabled ?? true));

    let pushDispatched = 0;
    if (pushRecipientRows.length > 0) {
      const pushRecipients = pushRecipientRows.map((row) => {
        const { title, body } = buildNotificationContent(row);
        return {
          userId: row.user_id,
          title,
          body,
          data: {
            source: 'coach_retention_loop',
            delivery_type: row.delivery_type,
          },
          category: 'group_messages',
        };
      });

      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipients: pushRecipients }),
      });

      if (pushResponse.ok) {
        pushDispatched = pushRecipientRows.length;
        for (const row of pushRecipientRows) {
          const next = updatesById.get(row.id);
          if (!next) continue;
          next.push_dispatched_at = nowIso;
          next.push_dispatch_error = null;
        }
      } else {
        const pushErrorText = await pushResponse.text();
        const pushError = `push_${pushResponse.status}:${pushErrorText.slice(0, 200)}`;
        for (const row of pushRecipientRows) {
          const next = updatesById.get(row.id);
          if (!next) continue;
          next.push_dispatch_error = pushError;
        }
      }
    }
    for (const row of pushSkippedRows) {
      const next = updatesById.get(row.id);
      if (!next) continue;
      next.push_dispatched_at = nowIso;
      next.push_dispatch_error = null;
    }

    const sendGridApiKey = process.env.SENDGRID_API_KEY || '';
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@better.at';
    const emailRows = rowsToDispatch.filter((row) =>
      hasPendingChannel(row as RetentionDispatchRow, 'email')
    );
    let emailDispatched = 0;
    for (const row of emailRows) {
      const next = updatesById.get(row.id);
      if (!next) continue;
      const emailEnabled = prefByUserId.get(row.user_id)?.email_enabled ?? false;
      const recipientEmail = emailByUserId.get(row.user_id) || '';

      if (!emailEnabled) {
        next.email_dispatched_at = nowIso;
        next.email_dispatch_error = null;
        continue;
      }
      if (!sendGridApiKey) {
        next.email_dispatched_at = nowIso;
        next.email_dispatch_error = 'sendgrid_not_configured';
        continue;
      }
      if (!recipientEmail) {
        next.email_dispatched_at = nowIso;
        next.email_dispatch_error = 'missing_recipient_email';
        continue;
      }

      const { title, body } = buildNotificationContent(row);
      const emailResult = await sendEmailViaSendGrid({
        apiKey: sendGridApiKey,
        fromEmail,
        toEmail: recipientEmail,
        subject: title,
        body,
      });
      if (emailResult.ok) {
        emailDispatched += 1;
        next.email_dispatched_at = nowIso;
        next.email_dispatch_error = null;
      } else {
        next.email_dispatch_error = emailResult.error || 'email_send_failed';
      }
    }

    let dispatched = 0;
    for (const row of updatesById.values()) {
      const channelDone = isFullyDispatched(row);
      if (channelDone) {
        row.dispatched_at = nowIso;
        dispatched += 1;
      }
    }

    await Promise.all(
      Array.from(updatesById.values()).map(async (row) => {
        const { error } = await supabase
          .from('coach_retention_deliveries')
          .update({
            in_app_dispatched_at: row.in_app_dispatched_at ?? null,
            push_dispatched_at: row.push_dispatched_at ?? null,
            email_dispatched_at: row.email_dispatched_at ?? null,
            dispatched_at: row.dispatched_at ?? null,
            dispatch_error: row.dispatch_error ?? null,
            push_dispatch_error: row.push_dispatch_error ?? null,
            email_dispatch_error: row.email_dispatch_error ?? null,
          })
          .eq('id', row.id);
        if (error) throw error;
      })
    );

    const reminders = deliveries.filter((row) => row.delivery_type === 'reminders').length;
    const recaps = deliveries.filter((row) => row.delivery_type === 'weekly_recap').length;

    return res.status(200).json({
      ok: true,
      inserted: deliveries.length,
      dispatched,
      pushDispatched,
      emailDispatched,
      skippedInvalidWeeklyRecaps: invalidWeeklyRecapRows.length,
      reminders,
      weeklyRecaps: recaps,
    });
  } catch (error: any) {
    console.error('coach-retention-loop cron error:', error);
    return res.status(500).json({
      error: 'Failed to process coach retention loop',
      detail: error?.message || 'unknown_error',
    });
  }
};

export default handler;
