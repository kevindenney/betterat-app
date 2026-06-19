/**
 * playbook-pattern-detect
 *
 * On-demand analyzer. Input:
 *   { playbook_id: string, lookback_days?: number }
 *
 * Reads all debriefs for the playbook's interest over the lookback window
 * (default 60 days) and asks Gemini for cross-debrief correlations.
 * Each pattern becomes a `pattern_detected` suggestion.
 *
 * The actual work lives in `runPatternDetect` (_shared/playbook-jobs.ts) so the
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
import { runPatternDetect } from '../_shared/playbook-jobs.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const { playbook_id, lookback_days = 60 } = await req.json();
    if (!playbook_id) return jsonResponse({ error: 'playbook_id required' }, 400);

    const { interest_id } = await assertPlaybookOwnership(
      supabase,
      userId,
      playbook_id,
    );

    const result = await runPatternDetect(
      supabase,
      userId,
      playbook_id,
      interest_id,
      lookback_days,
    );
    return jsonResponse(result);
  } catch (err) {
    console.error('playbook-pattern-detect error', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});
