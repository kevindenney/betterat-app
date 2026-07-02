/**
 * Send Team Invite Edge Function
 * Sends email invitations to join a subscription team
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SendTeamInviteRequest {
  team_id: string;
  email: string;
  inviter_name?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { team_id, email, inviter_name }: SendTeamInviteRequest = await req.json();

    if (!team_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: team_id, email' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get team details
    const { data: team, error: teamError } = await supabase
      .from('subscription_teams')
      .select(`
        id,
        name,
        invite_code,
        max_seats,
        owner_id,
        owner:profiles!subscription_teams_owner_id_fkey (
          full_name,
          email
        )
      `)
      .eq('id', team_id)
      .single();

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check seat availability
    const { count: memberCount } = await supabase
      .from('subscription_team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team_id);

    if ((memberCount || 0) >= team.max_seats) {
      return new Response(
        JSON.stringify({ error: 'Team is full, no seats available' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if already a member or has pending invite
    const { data: existingMember } = await supabase
      .from('subscription_team_members')
      .select('id, status')
      .eq('team_id', team_id)
      .eq('email', email.toLowerCase())
      .single();

    if (existingMember) {
      if (existingMember.status === 'active') {
        return new Response(
          JSON.stringify({ error: 'User is already a team member' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Re-send invite for pending member
    } else {
      // Create pending team member record
      const { error: memberError } = await supabase
        .from('subscription_team_members')
        .insert({
          team_id: team_id,
          email: email.toLowerCase(),
          role: 'member',
          status: 'pending',
          invited_at: new Date().toISOString(),
        });

      if (memberError) {
        console.error('Failed to create team member:', memberError);
        return new Response(
          JSON.stringify({ error: 'Failed to create invite' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build invite link
    const inviteLink = `https://better.at/team-invite/${team.invite_code}`;
    const ownerName = inviter_name || (team.owner as any)?.full_name || 'A BetterAt user';

    // Send invite email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #007AFF; margin-bottom: 10px;">You're Invited!</h1>
            <p style="font-size: 18px; color: #666;">Join <strong>${team.name}</strong> on BetterAt</p>
          </div>

          <div style="background: #f5f5f7; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p><strong>${ownerName}</strong> has invited you to join their team on BetterAt.</p>
            <p>As a team member, you'll get access to:</p>
            <ul style="color: #666;">
              <li>Unlimited races</li>
              <li>Unlimited AI strategy queries</li>
              <li>Team collaboration features</li>
              <li>Advanced analytics</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" style="display: inline-block; background-color: #007AFF; color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
          </div>

          <div style="border-top: 1px solid #e5e5e5; padding-top: 20px; margin-top: 30px; color: #999; font-size: 14px; text-align: center;">
            <p>Or copy this link: <a href="${inviteLink}" style="color: #007AFF;">${inviteLink}</a></p>
            <p>This invitation was sent by BetterAt on behalf of ${ownerName}.</p>
            <p>If you didn't expect this email, you can safely ignore it.</p>
          </div>
        </body>
      </html>
    `;

    // Call send-email function
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        to: email,
        subject: `${ownerName} invited you to join ${team.name} on BetterAt`,
        html: emailHtml,
      },
    });

    if (emailError) {
      console.error('Failed to send invite email:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send invite email' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${email}`,
        invite_code: team.invite_code,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error sending team invite:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
