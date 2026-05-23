/**
 * send-org-invite
 *
 * Dispatches branded BetterAt org-invite emails via Resend. Called from
 * the Org Admin · Add Person sheet right after the organization_invites
 * rows land. Idempotent per row — re-running for an already-sent invite
 * resends the email but the row's sent_at marker still wins for analytics.
 *
 * Input:  { invite_ids: string[] }
 * Output: { results: Array<{ invite_id, email, ok, error? }> }
 *
 * Auth: caller passes their JWT in Authorization (Supabase invoke does
 * this automatically). We use the service role to load the row + render
 * the email so the function can see org/inviter info regardless of RLS.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'BetterAt <invites@betterat.app>';
const ACCEPT_BASE_URL = Deno.env.get('INVITE_ACCEPT_BASE_URL') || 'https://betterat.app';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  invite_ids: string[];
}

interface ResultRow {
  invite_id: string;
  email: string | null;
  ok: boolean;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { invite_ids }: RequestBody = await req.json();
    if (!Array.isArray(invite_ids) || invite_ids.length === 0) {
      return jsonError('invite_ids array required', 400);
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonError('Supabase env not configured', 500);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: rows, error: loadErr } = await sb
      .from('organization_invites')
      .select(`
        id,
        invitee_email,
        invitee_name,
        role_label,
        invite_token,
        invited_by,
        metadata,
        organization_id,
        organizations:organization_id ( name )
      `)
      .in('id', invite_ids);
    if (loadErr) return jsonError(`load invites: ${loadErr.message}`, 500);

    // Inviter display names (one query, not N)
    const inviterIds = Array.from(
      new Set(((rows ?? []) as InviteRow[]).map((r) => r.invited_by).filter(Boolean)),
    );
    const inviterById = new Map<string, { name: string; email: string }>();
    if (inviterIds.length > 0) {
      const { data: users } = await sb
        .from('users')
        .select('id, full_name, email')
        .in('id', inviterIds);
      for (const u of (users ?? []) as { id: string; full_name: string | null; email: string }[]) {
        inviterById.set(u.id, {
          name: u.full_name?.trim() || u.email,
          email: u.email,
        });
      }
    }

    const results: ResultRow[] = [];

    for (const row of (rows ?? []) as InviteRow[]) {
      const email = row.invitee_email;
      if (!email) {
        results.push({ invite_id: row.id, email: null, ok: false, error: 'no email on row' });
        continue;
      }

      if (!RESEND_API_KEY) {
        // Dev convenience: mark as sent so the UI doesn't loop, log clearly.
        console.warn('[send-org-invite] RESEND_API_KEY missing — skipping real send for', email);
        await sb.from('organization_invites').update({ sent_at: new Date().toISOString() }).eq('id', row.id);
        results.push({ invite_id: row.id, email, ok: true, error: 'skipped (no api key)' });
        continue;
      }

      const orgName = row.organizations?.name ?? 'BetterAt';
      const inviter = inviterById.get(row.invited_by ?? '') ?? null;
      const cohortLabel =
        (typeof row.metadata?.cohort_label === 'string' && row.metadata.cohort_label) || null;
      const acceptUrl = `${ACCEPT_BASE_URL}/org-invite?token=${encodeURIComponent(row.invite_token)}`;

      const { subject, html, text } = renderInviteEmail({
        orgName,
        roleLabel: row.role_label,
        cohortLabel,
        inviterName: inviter?.name ?? null,
        inviterEmail: inviter?.email ?? null,
        acceptUrl,
      });

      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [email],
            subject,
            html,
            text,
            reply_to: inviter?.email ?? undefined,
          }),
        });
        if (!resp.ok) {
          const detail = await resp.text();
          results.push({ invite_id: row.id, email, ok: false, error: `resend ${resp.status}: ${detail}` });
          continue;
        }
        await sb.from('organization_invites').update({ sent_at: new Date().toISOString() }).eq('id', row.id);
        results.push({ invite_id: row.id, email, ok: true });
      } catch (err) {
        results.push({
          invite_id: row.id,
          email,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'unknown', 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface InviteRow {
  id: string;
  invitee_email: string | null;
  invitee_name: string | null;
  role_label: string;
  invite_token: string;
  invited_by: string | null;
  metadata: Record<string, unknown>;
  organization_id: string;
  organizations: { name: string | null } | null;
}

function renderInviteEmail(args: {
  orgName: string;
  roleLabel: string;
  cohortLabel: string | null;
  inviterName: string | null;
  inviterEmail: string | null;
  acceptUrl: string;
}): { subject: string; html: string; text: string } {
  const { orgName, roleLabel, cohortLabel, inviterName, acceptUrl } = args;
  const inviterLine = inviterName ? `${inviterName} invited you` : 'You have been invited';
  const cohortLine = cohortLabel ? ` for the ${escapeHtml(cohortLabel)} cohort` : '';
  const roleLine = `as a ${escapeHtml(roleLabel)}`;

  const subject = `${orgName} invited you to BetterAt`;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F5F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1C1E;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F5F4EE;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="520" style="max-width:520px;background:#FFFFFF;border-radius:16px;border:0.5px solid rgba(0,0,0,0.06);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <div style="display:inline-block;padding:4px 10px;background:rgba(40,64,107,0.10);border-radius:999px;font-size:11px;font-weight:700;color:#28406B;letter-spacing:0.5px;text-transform:uppercase;">BetterAt</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0 32px;">
                <h1 style="margin:0;font-size:24px;font-weight:700;color:#1C1C1E;letter-spacing:-0.4px;line-height:1.25;">
                  ${escapeHtml(inviterLine)} to join <span style="color:#28406B;">${escapeHtml(orgName)}</span> on BetterAt.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 32px 0 32px;">
                <p style="margin:0;font-size:14px;color:rgba(60,60,67,0.85);line-height:1.5;">
                  You'll join ${escapeHtml(roleLine)}${cohortLine}. BetterAt is the practice and learning platform where ${escapeHtml(orgName)} tracks your steps, competencies, and evidence as you go.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 32px 8px 32px;">
                <a href="${acceptUrl}" style="display:inline-block;padding:12px 22px;background:#28406B;color:#FFFFFF;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:-0.1px;">
                  Accept invite →
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;">
                <p style="margin:0;font-size:11.5px;color:rgba(60,60,67,0.6);line-height:1.5;text-align:center;">
                  Or paste this link into your browser:<br>
                  <a href="${acceptUrl}" style="color:#28406B;word-break:break-all;">${escapeHtml(acceptUrl)}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;border-top:0.5px solid rgba(0,0,0,0.06);">
                <p style="margin:18px 0 0 0;font-size:11px;color:rgba(60,60,67,0.6);line-height:1.5;">
                  This invite was sent through BetterAt. If you weren't expecting it, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${inviterLine} to join ${orgName} on BetterAt.`,
    '',
    `Role: ${roleLabel}${cohortLabel ? ` · Cohort: ${cohortLabel}` : ''}`,
    '',
    `Accept your invite: ${acceptUrl}`,
    '',
    `If you weren't expecting this, you can ignore this email.`,
  ].join('\n');

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
