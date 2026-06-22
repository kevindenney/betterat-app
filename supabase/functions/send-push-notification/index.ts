/**
 * Send Push Notification Edge Function
 *
 * Accepts one or more notification recipients, looks up their push tokens,
 * checks notification preferences, and sends via Expo Push API.
 * Handles stale token cleanup when Expo returns DeviceNotRegistered.
 *
 * Request body:
 * {
 *   recipients: [
 *     { userId, title, body, data?, category? }
 *   ]
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface Recipient {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  category?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: 'default';
  priority: 'high';
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { recipients } = (await req.json()) as { recipients: Recipient[] };

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No recipients provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      sent: 0,
      skipped: 0,
      failed: 0,
      staleTokensRemoved: 0,
    };

    // Collect all Expo push messages to send in a single batch
    const pushMessages: ExpoPushMessage[] = [];
    // Track which token belongs to which message index for stale token cleanup
    const tokenMap: { token: string; userId: string }[] = [];

    for (const recipient of recipients) {
      // Check notification preference if a category is specified
      if (recipient.category) {
        const { data: prefEnabled } = await supabase.rpc('check_notification_preference', {
          p_user_id: recipient.userId,
          p_category: recipient.category,
        });

        if (prefEnabled === false) {
          results.skipped++;
          continue;
        }
      }

      // Look up push tokens for this user
      const { data: tokens, error: tokenError } = await supabase.rpc('get_user_push_tokens', {
        p_user_id: recipient.userId,
      });

      if (tokenError || !tokens || tokens.length === 0) {
        results.skipped++;
        continue;
      }

      // Create a push message per device token
      for (const tokenRow of tokens) {
        pushMessages.push({
          to: tokenRow.token,
          title: recipient.title,
          body: recipient.body,
          data: recipient.data,
          sound: 'default',
          priority: 'high',
          channelId: 'messages',
        });
        tokenMap.push({ token: tokenRow.token, userId: recipient.userId });
      }
    }

    if (pushMessages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, ...results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Send batch to Expo Push API (max 100 per request)
    for (let chunkStart = 0; chunkStart < pushMessages.length; chunkStart += 100) {
      const chunk = pushMessages.slice(chunkStart, chunkStart + 100);
      const chunkTokenMap = tokenMap.slice(chunkStart, chunkStart + 100);
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          console.error(`Expo Push API error: ${response.status} ${response.statusText}`);
          results.failed += chunk.length;
          continue;
        }

        const responseData = await response.json();
        const tickets: ExpoPushTicket[] = responseData.data || [];

        // Process each ticket
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const tokenInfo = chunkTokenMap[i];

          if (ticket.status === 'ok') {
            results.sent++;
          } else if (ticket.details?.error === 'DeviceNotRegistered') {
            // Token is stale — remove it from the database
            results.staleTokensRemoved++;
            results.failed++;
            if (tokenInfo) {
              await supabase
                .from('push_tokens')
                .delete()
                .eq('token', tokenInfo.token)
                .eq('user_id', tokenInfo.userId);
            }
          } else {
            results.failed++;
            console.error(`[Push] Ticket error: ${ticket.message || ticket.details?.error}`);
          }
        }
      } catch (fetchError) {
        console.error('[Push] Fetch error:', fetchError);
        results.failed += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[Push] Edge function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
