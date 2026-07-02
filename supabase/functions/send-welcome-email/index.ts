/**
 * Send Welcome Email Edge Function
 * Uses Resend to send welcome emails to new club signups
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'BetterAt <hello@better.at>';

interface WelcomeEmailRequest {
  email: string;
  clubName: string;
  trialEndDate: string;
  userFirstName?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, clubName, trialEndDate, userFirstName }: WelcomeEmailRequest = await req.json();

    if (!email || !clubName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, clubName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured - skipping email send');
      return new Response(
        JSON.stringify({ success: true, message: 'Email skipped (no API key)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trialEndFormatted = new Date(trialEndDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const greeting = userFirstName ? `Hi ${userFirstName}` : 'Welcome aboard';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BetterAt</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #7c3aed 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                🎉 Welcome to BetterAt!
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
                ${clubName} is ready to sail
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                ${greeting}! 👋
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Congratulations on setting up <strong>${clubName}</strong> on BetterAt!
                Your 30-day free trial is now active, giving you full access to all features.
              </p>
              
              <!-- Trial Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-radius: 12px; margin: 30px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="color: #0284c7; font-weight: 600; margin: 0 0 8px; font-size: 14px;">
                      🎁 YOUR FREE TRIAL
                    </p>
                    <p style="color: #374151; margin: 0; font-size: 16px;">
                      Trial ends: <strong>${trialEndFormatted}</strong>
                    </p>
                    <p style="color: #6b7280; margin: 8px 0 0; font-size: 14px;">
                      No credit card required until your trial ends.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- What's Next -->
              <h2 style="color: #111827; font-size: 18px; margin: 30px 0 16px;">
                What's Next?
              </h2>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 32px; vertical-align: top;">
                          <span style="font-size: 20px;">📅</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #374151; margin: 0; font-weight: 500;">Create Your First Event</p>
                          <p style="color: #6b7280; margin: 4px 0 0; font-size: 14px;">Set up a race series or regatta</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 32px; vertical-align: top;">
                          <span style="font-size: 20px;">👥</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #374151; margin: 0; font-weight: 500;">Invite Team Members</p>
                          <p style="color: #6b7280; margin: 4px 0 0; font-size: 14px;">Add race officers and administrators</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 32px; vertical-align: top;">
                          <span style="font-size: 20px;">🏆</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="color: #374151; margin: 0; font-weight: 500;">Configure Scoring</p>
                          <p style="color: #6b7280; margin: 4px 0 0; font-size: 14px;">Set up your preferred scoring system</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://better.at/events"
                       style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Go to Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0;">
                Questions? Reply to this email or check out our 
                <a href="https://better.at/docs" style="color: #0284c7;">documentation</a>.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} BetterAt. All rights reserved.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">
                You're receiving this because you created a club on BetterAt.
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

    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `🎉 Welcome to BetterAt, ${clubName}!`,
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
    console.error('Error sending welcome email:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
