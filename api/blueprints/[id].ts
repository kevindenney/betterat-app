/**
 * GET /api/blueprints/[id]
 *
 * Returns the public-facing preview of a blueprint for the redeem flow:
 * title, author, steps[], capabilities[], subscriberCount.
 *
 * 200 → { id, author, title, steps, capabilities, subscriberCount }
 * 404 → { error: 'not-found' }
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  const id = String(req.query.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'invalid' });
    return;
  }

  const { data: blueprint, error } = await supabase
    .from('timeline_blueprints')
    .select('id, title, duration_months, capability_goals, author_user_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !blueprint) {
    res.status(404).json({ error: 'not-found' });
    return;
  }

  const [{ data: author }, { count: stepCount }, { count: subscriberCount }] = await Promise.all([
    blueprint.author_user_id
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', blueprint.author_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('blueprint_steps')
      .select('id', { count: 'exact', head: true })
      .eq('blueprint_id', id),
    supabase
      .from('blueprint_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('blueprint_id', id),
  ]);

  res.status(200).json({
    id: blueprint.id,
    title: blueprint.title,
    author: {
      id: blueprint.author_user_id,
      name: (author as { full_name?: string | null } | null)?.full_name ?? 'Author',
    },
    capabilities: blueprint.capability_goals ?? [],
    durationMonths: blueprint.duration_months ?? null,
    stepCount: stepCount ?? 0,
    subscriberCount: subscriberCount ?? 0,
  });
}
