/**
 * Send Trial Reminder Email Edge Function
 * Sends reminders as trial approaches expiration
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'BetterAt <hello@better.at>';

interface TrialReminderRequest {
  email: string;
  clubName: string;
  daysRemaining: number;
  trialEndDate: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, clubName, daysRemaining, trialEndDate }: TrialReminderRequest = await req.json();

    if (!email || !clubName || daysRemaining === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: true, message: 'Email skipped (no API key)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trialEndFormatted = new Date(trialEndDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    // Different messaging based on days remaining
    let urgencyColor = '#0284c7'; // blue
    let urgencyText = `${daysRemaining} days`;
    let subject = `⏰ ${daysRemaining} days left in your BetterAt trial`;

    if (daysRemaining <= 3) {
      urgencyColor = '#dc2626'; // red
      urgencyText = daysRemaining === 1 ? 'Tomorrow!' : `Only ${daysRemaining} days`;
      subject = `🚨 Your BetterAt trial ends ${daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`}!`;
    } else if (daysRemaining <= 7) {
      urgencyColor = '#d97706'; // amber
      subject = `⚠️ ${daysRemaining} days left - Don't lose your ${clubName} data`;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden;">
          <!-- Urgency Banner -->
          <tr>
            <td style="background-color: ${urgencyColor}; padding: 20px; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
                ⏰ ${urgencyText} left in your trial
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hi there! 👋
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Your free trial for <strong>${clubName}</strong> ends on <strong>${trialEndFormatted}</strong>.
              </p>
              
              ${daysRemaining <= 3 ? `
              <!-- Urgent Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #dc2626; font-weight: 600; margin: 0 0 8px;">
                      ⚠️ What happens when your trial ends:
                    </p>
                    <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
                      <li>You'll lose access to event management</li>
                      <li>Live race tracking will be disabled</li>
                      <li>Your data will be preserved for 30 days</li>
                    </ul>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <!-- Benefits Reminder -->
              <h2 style="color: #111827; font-size: 18px; margin: 30px 0 16px;">
                Keep the momentum going with BetterAt:
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0;">✅ Unlimited events & regattas</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">✅ Live race tracking</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">✅ Online entry management</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">✅ Automated results & scoring</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">✅ Priority support</td>
                </tr>
              </table>
              
              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://better.at/subscription"
                       style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Upgrade Now →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; text-align: center;">
                Questions? Just reply to this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} BetterAt
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html: htmlContent,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
