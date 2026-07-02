/**
 * OG Meta Tags for Shared Steps
 * Returns an HTML page with Open Graph meta tags for social link previews
 * (WhatsApp, iMessage, Slack, etc.)
 *
 * GET /api/public/steps/[token]/og
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing share token' });
  }

  // Canonical URL for this step
  const baseUrl = process.env.EXPO_PUBLIC_SITE_URL || 'https://better.at';
  const canonicalUrl = `${baseUrl}/p/step/${token}`;

  try {
    const { data: step, error } = await supabase
      .from('timeline_steps')
      .select('title, status, metadata, user_id, interest_id, share_enabled')
      .eq('share_token', token)
      .eq('share_enabled', true)
      .single();

    if (error || !step) {
      // Redirect to the SPA — it will show the "not found" state
      return res.redirect(302, canonicalUrl);
    }

    // Fetch creator name
    let creatorName = '';
    if (step.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, display_name')
        .eq('id', step.user_id)
        .single();
      if (profile) {
        creatorName = profile.display_name || profile.full_name || '';
      }
    }

    // Fetch interest name
    let interestName = '';
    if (step.interest_id) {
      const { data: interest } = await supabase
        .from('interests')
        .select('name')
        .eq('id', step.interest_id)
        .single();
      if (interest) {
        interestName = interest.name;
      }
    }

    const metadata = (step.metadata || {}) as Record<string, any>;
    const planData = metadata.plan || {};

    // Build description from plan data
    const parts: string[] = [];
    if (planData.what_will_you_do) {
      parts.push(planData.what_will_you_do);
    }
    const subStepCount = (planData.how_sub_steps || []).length;
    if (subStepCount > 0) {
      parts.push(`${subStepCount} step${subStepCount === 1 ? '' : 's'} planned`);
    }
    const collaborators = planData.collaborators || [];
    const collabNames = collaborators.map((c: any) => c.display_name).filter(Boolean);
    if (collabNames.length > 0) {
      parts.push(`With ${collabNames.join(', ')}`);
    }

    const ogTitle = escapeHtml(step.title);
    const ogDescription = escapeHtml(
      parts.join(' · ') || 'A practice step shared on BetterAt'
    );

    // Build the attribution line
    const byLine = [creatorName, interestName].filter(Boolean).join(' · ');
    const ogSiteName = byLine ? `BetterAt · ${escapeHtml(byLine)}` : 'BetterAt';

    // Respond with HTML containing OG tags, then redirect to SPA
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${ogTitle} — BetterAt</title>

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:site_name" content="${ogSiteName}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />

  <!-- Redirect browsers to the SPA -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(canonicalUrl)}">${ogTitle}</a>...</p>
</body>
</html>`;

    return res.status(200).send(html);
  } catch (err) {
    console.error('OG meta handler error:', err);
    return res.redirect(302, canonicalUrl);
  }
}
