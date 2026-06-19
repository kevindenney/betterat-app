/**
 * playbook-weekly-review
 *
 * Invoked from a "Generate weekly review" button (or on Playbook open if
 * >7 days since the last review). Input:
 *   { playbook_id: string, period_start?: string, period_end?: string }
 *
 * If period bounds are omitted, defaults to the last 7 days. Reads the
 * week's debriefs (timeline_steps.metadata.review), new/updated concepts,
 * and new resources, and asks Gemini to compile:
 *   - one weekly_review suggestion (summary_md + updated_pages)
 *   - one focus_suggestion (next week's focus)
 *
 * The actual work lives in `runWeeklyReview` (_shared/playbook-jobs.ts) so the
 * `playbook-scheduled-jobs` cron can reuse it; this wrapper only authenticates
 * the caller and asserts playbook ownership.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  assertPlaybookOwnership,
  authenticate,
  corsHeaders,
  jsonResponse,
} from '../_shared/playbook.ts';
import { runWeeklyReview } from '../_shared/playbook-jobs.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const { playbook_id, period_start, period_end } = await req.json();
    if (!playbook_id) return jsonResponse({ error: 'playbook_id required' }, 400);

    const { interest_id } = await assertPlaybookOwnership(
      supabase,
      userId,
      playbook_id,
    );

    const result = await runWeeklyReview(
      supabase,
      userId,
      playbook_id,
      interest_id,
      period_start,
      period_end,
    );
    return jsonResponse(result);
  } catch (err) {
    console.error('playbook-weekly-review error', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});
