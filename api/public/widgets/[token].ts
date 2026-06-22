/**
 * Widget API - Configuration and Impression Tracking
 *
 * GET  /api/public/widgets/[token] - Returns widget configuration
 * POST /api/public/widgets/[token] - Records impression for analytics
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing widget token' });
  }

  if (req.method === 'GET') {
    return handleGetWidget(req, res, token);
  }

  if (req.method === 'POST') {
    return handleTrackImpression(req, res, token);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// GET - Return widget configuration
async function handleGetWidget(req: VercelRequest, res: VercelResponse, token: string) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  try {
    // Fetch widget configuration
    const { data: widget, error: widgetError } = await supabase
      .from('club_widgets')
      .select(`
        id,
        club_id,
        regatta_id,
        widget_type,
        name,
        theme,
        accent_color,
        width,
        height,
        border_radius,
        show_branding,
        custom_css,
        filters,
        allowed_domains,
        active,
        embed_count,
        clubs (
          id,
          club_name,
          logo_url
        ),
        regattas (
          id,
          name,
          start_date,
          end_date,
          venue
        )
      `)
      .eq('embed_token', token)
      .single();

    if (widgetError || !widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    if (!widget.active) {
      return res.status(403).json({ error: 'Widget is disabled' });
    }

    // Check domain whitelist if configured
    const origin = req.headers.origin;
    if (widget.allowed_domains && widget.allowed_domains.length > 0 && origin) {
      try {
        const domain = new URL(origin).hostname;
        const allowed = widget.allowed_domains.some((d: string) =>
          d === domain || domain.endsWith(`.${d}`)
        );

        if (!allowed) {
          return res.status(403).json({ error: 'Domain not allowed for this widget' });
        }
      } catch {
        // Invalid origin URL, skip check
      }
    }

    // Increment embed count
    await supabase
      .from('club_widgets')
      .update({
        embed_count: (widget.embed_count || 0) + 1,
        last_embedded_at: new Date().toISOString(),
      })
      .eq('id', widget.id);

    // Return widget configuration
    return res.status(200).json({
      type: widget.widget_type,
      name: widget.name,
      config: {
        theme: widget.theme,
        accentColor: widget.accent_color,
        width: widget.width,
        height: widget.height,
        borderRadius: widget.border_radius,
        showBranding: widget.show_branding,
        customCSS: widget.custom_css,
        filters: widget.filters,
      },
      club: widget.clubs
        ? {
            id: (widget.clubs as any).id,
            name: (widget.clubs as any).club_name,
            logo: (widget.clubs as any).logo_url,
          }
        : null,
      regatta: widget.regattas
        ? {
            id: (widget.regattas as any).id,
            name: (widget.regattas as any).name,
            startDate: (widget.regattas as any).start_date,
            endDate: (widget.regattas as any).end_date,
            venue: (widget.regattas as any).venue,
          }
        : null,
    });
  } catch (error) {
    console.error('Widget API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST - Track impression
async function handleTrackImpression(req: VercelRequest, res: VercelResponse, token: string) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { clubId, regattaId, domain } = body;

    // Get IP and user agent
    const ipHeader = req.headers['x-forwarded-for'];
    const ip = typeof ipHeader === 'string' ? ipHeader.split(',')[0].trim() : null;
    const userAgent = req.headers['user-agent'] || null;
    const referrer = req.headers['referer'] || null;

    // Log the impression
    await supabase.from('public_access_log').insert({
      resource_type: 'widget',
      resource_id: token,
      regatta_id: regattaId || null,
      club_id: clubId || null,
      ip_address: ip,
      user_agent: userAgent,
      referrer: referrer,
      widget_token: token,
      embedding_domain: domain,
    });

    // Increment the impression count
    await supabase.rpc('increment_widget_impressions', {
      widget_token_param: token,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Widget impression tracking error:', error);
    // Don't fail the request - impressions are non-critical
    return res.status(200).json({ success: true });
  }
}
