/**
 * playbook-scheduled-jobs
 *
 * Cron orchestrator that keeps every eligible user's Playbook suggestion queue
 * fresh. It is NOT user-JWT authenticated — it is gated by a shared
 * `x-cron-secret` header (set via the CRON_SECRET function secret) and is
 * invoked weekly by a pg_cron job via pg_net (see the accompanying migration).
 * Deploy with `--no-verify-jwt`.
 *
 * For each eligible playbook it runs the same logic as the on-demand
 * `playbook-pattern-detect` / `playbook-weekly-review` functions (via the
 * shared `runPatternDetect` / `runWeeklyReview` helpers, called with a
 * service-role client). It only ENQUEUES `pending` suggestions — it never
 * materializes into `playbook_concepts/_patterns/_reviews`, which stays a
 * user-curated step (acceptSuggestion). So the blast radius is the suggestion
 * queue only.
 *
 * Body: { job?: 'pattern' | 'weekly' | 'both' (default), limit?: number }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders, jsonResponse } from '../_shared/playbook.ts';
import { runPatternDetect, runWeeklyReview } from '../_shared/playbook-jobs.ts';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ELIGIBILITY_LOOKBACK_DAYS = 60;
const MIN_DEBRIEFS = 3;
// Considers every playbook by default — eligibility is a cheap count query per
// row and Gemini only fires for the few with >=MIN_DEBRIEFS. `limit` in the
// request body can cap this for tests. Bump if the playbook count nears this.
const DEFAULT_LIMIT = 1000;

interface PlaybookRow {
  id: string;
  user_id: string;
  interest_id: string;
}

/** Count debriefs (timeline_steps with a `review` in metadata) in the window. */
async function countDebriefs(
  supabase: SupabaseClient,
  userId: string,
  interestId: string,
): Promise<number> {
  const since = new Date(Date.now() - ELIGIBILITY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('timeline_steps')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .gte('starts_at', since)
    .not('metadata->review', 'is', null);
  return count ?? 0;
}

/** True if a pending suggestion of `kind` was created within the last week. */
async function hasRecentPendingSuggestion(
  supabase: SupabaseClient,
  playbookId: string,
  kind: string,
): Promise<boolean> {
  const sinceISO = new Date(Date.now() - WEEK_MS).toISOString();
  const { count } = await supabase
    .from('playbook_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('playbook_id', playbookId)
    .eq('kind', kind)
    .eq('status', 'pending')
    .gte('created_at', sinceISO);
  return (count ?? 0) > 0;
}

/** True if a weekly_review was already materialized within the last week. */
async function hasRecentReview(
  supabase: SupabaseClient,
  playbookId: string,
): Promise<boolean> {
  const sinceISO = new Date(Date.now() - WEEK_MS).toISOString();
  const { data } = await supabase
    .from('playbook_reviews')
    .select('period_end')
    .eq('playbook_id', playbookId)
    .order('period_end', { ascending: false })
    .limit(1);
  const latest = (data ?? [])[0] as { period_end?: string } | undefined;
  return !!latest?.period_end && latest.period_end >= sinceISO;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Shared-secret auth (NOT a user JWT).
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) {
    return jsonResponse({ error: 'CRON_SECRET not configured' }, 500);
  }
  if (req.headers.get('x-cron-secret') !== expected) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Missing Supabase env' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  let job: 'pattern' | 'weekly' | 'both' = 'both';
  let limit = DEFAULT_LIMIT;
  try {
    const body = await req.json();
    if (body?.job === 'pattern' || body?.job === 'weekly' || body?.job === 'both') {
      job = body.job;
    }
    if (typeof body?.limit === 'number' && body.limit > 0) limit = body.limit;
  } catch {
    // Empty body is fine — use defaults.
  }

  const { data: playbooks, error } = await supabase
    .from('playbooks')
    .select('id, user_id, interest_id')
    .limit(limit);
  if (error) {
    return jsonResponse({ error: `Failed to load playbooks: ${error.message}` }, 500);
  }

  const summary = {
    job,
    considered: (playbooks ?? []).length,
    processed: 0,
    skipped_insufficient_data: 0,
    pattern_created: 0,
    weekly_created: 0,
    pattern_skipped_dedupe: 0,
    weekly_skipped_dedupe: 0,
    errors: [] as { playbook_id: string; stage: string; message: string }[],
  };

  // Sequential to stay well under Gemini rate limits — weekly cron, not latency-sensitive.
  for (const pb of (playbooks ?? []) as PlaybookRow[]) {
    try {
      const debriefs = await countDebriefs(supabase, pb.user_id, pb.interest_id);
      if (debriefs < MIN_DEBRIEFS) {
        summary.skipped_insufficient_data += 1;
        continue;
      }
      summary.processed += 1;

      if (job === 'pattern' || job === 'both') {
        try {
          if (await hasRecentPendingSuggestion(supabase, pb.id, 'pattern_detected')) {
            summary.pattern_skipped_dedupe += 1;
          } else {
            const r = await runPatternDetect(supabase, pb.user_id, pb.id, pb.interest_id);
            summary.pattern_created += r.suggestions_created;
          }
        } catch (err) {
          summary.errors.push({
            playbook_id: pb.id,
            stage: 'pattern',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (job === 'weekly' || job === 'both') {
        try {
          const dupe = await hasRecentPendingSuggestion(supabase, pb.id, 'weekly_review');
          const recent = await hasRecentReview(supabase, pb.id);
          if (dupe || recent) {
            summary.weekly_skipped_dedupe += 1;
          } else {
            const r = await runWeeklyReview(supabase, pb.user_id, pb.id, pb.interest_id);
            summary.weekly_created += r.suggestions_created;
          }
        } catch (err) {
          summary.errors.push({
            playbook_id: pb.id,
            stage: 'weekly',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      summary.errors.push({
        playbook_id: pb.id,
        stage: 'eligibility',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // eslint-disable-next-line no-console -- intentional operational log for cron run visibility
  console.log('[playbook-scheduled-jobs] run summary', JSON.stringify(summary));
  return jsonResponse(summary);
});
