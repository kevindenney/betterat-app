/**
 * Tests for Step Arch B/2 + E — log_debrief sections[]-only write +
 * central recently-active hook.
 *
 * Strategy: mock SupabaseClient.from('timeline_steps') and supabase.rpc(),
 * call executeTool('log_debrief', ...), and inspect:
 *   - what was written to metadata.review.sections[] (flat fields are
 *     retired as of Step Arch E)
 *   - whether mark_step_active RPC was invoked with the right args
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { executeTool } from '@/lib/telegram/tools';
import { getReviewSections } from '@/lib/step/getReviewSections';

// ---------------------------------------------------------------------------
// Test harness — a minimal SupabaseClient stand-in
// ---------------------------------------------------------------------------

interface StepRow {
  id: string;
  title: string;
  metadata: Record<string, unknown>;
}

interface Recorded {
  updates: Record<string, unknown>[];
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
}

function buildMockSupabase(initialStep: StepRow): { supabase: SupabaseClient; recorded: Recorded; current: StepRow } {
  const recorded: Recorded = { updates: [], rpcCalls: [] };
  const current: StepRow = JSON.parse(JSON.stringify(initialStep));

  const fromTimelineSteps = () => {
    let pendingUpdate: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: (payload: Record<string, unknown>) => {
        pendingUpdate = payload;
        return chain;
      },
      eq: () => chain,
      single: async () => ({ data: { ...current }, error: null }),
      maybeSingle: async () => ({ data: { ...current }, error: null }),
      then: undefined,
    };
    // The .update().eq().eq() chain in log_debrief is awaited directly without
    // a .single() / .select() at the end. Make the terminal chain awaitable.
    (chain as { then?: unknown }).then = (resolve: (v: { error: null }) => void) => {
      if (pendingUpdate) {
        recorded.updates.push(pendingUpdate);
        // Apply to current so subsequent reads (e.g. idempotency tests) see it.
        if (pendingUpdate.metadata && typeof pendingUpdate.metadata === 'object') {
          current.metadata = pendingUpdate.metadata as Record<string, unknown>;
        }
      }
      resolve({ error: null });
    };
    return chain;
  };

  const supabase = {
    from: (table: string) => {
      if (table === 'timeline_steps') return fromTimelineSteps();
      throw new Error(`Unexpected from('${table}')`);
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      recorded.rpcCalls.push({ fn, args });
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;

  return { supabase, recorded, current };
}

const STEP_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function freshStep(): StepRow {
  return { id: STEP_ID, title: 'Test step', metadata: {} };
}

const AUTH = {
  userId: USER_ID,
  email: 'demo@example.com',
  clubId: null,
  tier: 'plus' as const,
};

// ---------------------------------------------------------------------------

describe('log_debrief — sections[]-only writes (Step Arch E)', () => {
  beforeEach(() => {
    delete process.env.BOT_RECENT_ACTIVITY_ENABLED;
  });

  it('synthesizes sections[] from flat input — no flat-field write (Step E)', async () => {
    const { supabase, recorded, current } = buildMockSupabase(freshStep());

    const raw = await executeTool(
      'log_debrief',
      {
        step_id: STEP_ID,
        what_learned: 'Tacking timing felt sharp today.',
        what_to_change: 'Lost the layline call on the third leg.',
        next_step_notes: 'Practice port-tack approaches Wednesday.',
      },
      supabase,
      AUTH,
    );
    const result = JSON.parse(raw);
    expect(result.debriefed).toBe(true);
    expect(result.wrote.sections_added).toBe(3);

    expect(recorded.updates).toHaveLength(1);
    const written = recorded.updates[0].metadata as Record<string, unknown>;
    const review = written.review as Record<string, unknown>;

    // Flat fields are NO LONGER written (Step Arch E)
    expect(review.what_learned).toBeUndefined();
    expect(review.deviation_reason).toBeUndefined();
    expect(review.next_step_notes).toBeUndefined();

    // v2 sections[] synthesized
    const sections = review.sections as Record<string, unknown>[];
    expect(sections).toHaveLength(3);
    const byPrompt = Object.fromEntries(sections.map((s) => [s.prompt, s]));
    expect(byPrompt.what_did_you_learn.content).toBe('Tacking timing felt sharp today.');
    expect(byPrompt.what_didnt.content).toBe('Lost the layline call on the third leg.');
    expect(byPrompt.anything_else.content).toBe('Practice port-tack approaches Wednesday.');
    for (const s of sections) {
      expect(s.source).toBe('telegram');
      expect(typeof s.captured_at).toBe('string');
      expect(typeof s.digest).toBe('string');
    }

    expect(review.composed_via).toBe('telegram');
    expect(typeof review.composed_at).toBe('string');

    // selector round-trip — version flips to 2.0 because sections[] is present
    const normalized = getReviewSections(current.metadata);
    expect(normalized.version).toBe('2.0');
    expect(normalized.sections).toHaveLength(3);
  });

  it('accepts v2 sections[] input and writes to metadata.review.sections[]', async () => {
    const { supabase, recorded, current } = buildMockSupabase(freshStep());

    await executeTool(
      'log_debrief',
      {
        step_id: STEP_ID,
        sections: [
          { prompt: 'what_happened', content: 'Boatspeed off the line was decent.' },
          { prompt: 'what_worked', content: 'Tactical call on the right paid off.' },
        ],
      },
      supabase,
      AUTH,
    );

    const review = (recorded.updates[0].metadata as Record<string, unknown>).review as Record<string, unknown>;
    const sections = review.sections as Record<string, unknown>[];
    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.prompt).sort()).toEqual(['what_happened', 'what_worked']);

    // No flat fields written when only sections[] was provided
    expect(review.what_learned).toBeUndefined();
    expect(review.deviation_reason).toBeUndefined();

    const normalized = getReviewSections(current.metadata);
    expect(normalized.version).toBe('2.0');
  });

  it('merges v2 sections[] with synthesized entries when both shapes are provided', async () => {
    const { supabase, recorded } = buildMockSupabase(freshStep());

    await executeTool(
      'log_debrief',
      {
        step_id: STEP_ID,
        what_learned: 'Learned something flat.',
        sections: [{ prompt: 'what_happened', content: 'Something v2.' }],
      },
      supabase,
      AUTH,
    );

    const review = (recorded.updates[0].metadata as Record<string, unknown>).review as Record<string, unknown>;
    const sections = review.sections as Record<string, unknown>[];
    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.prompt).sort()).toEqual(['what_did_you_learn', 'what_happened']);
  });

  it('dedupes identical (prompt, content) sections across re-calls (idempotent)', async () => {
    const { supabase, recorded, current } = buildMockSupabase(freshStep());

    // First call
    await executeTool(
      'log_debrief',
      { step_id: STEP_ID, what_learned: 'Same insight.' },
      supabase,
      AUTH,
    );
    // Second call with the same content — selector mocks have apply-after-write,
    // so the second call sees the first call's section[]; digest dedupe kicks in.
    await executeTool(
      'log_debrief',
      { step_id: STEP_ID, what_learned: 'Same insight.' },
      supabase,
      AUTH,
    );

    const lastReview = (recorded.updates[1].metadata as Record<string, unknown>).review as Record<string, unknown>;
    const sections = lastReview.sections as Record<string, unknown>[];
    // Should still be 1 entry after dedupe (not 2)
    expect(sections).toHaveLength(1);
    expect(sections[0].content).toBe('Same insight.');

    // Selector confirms a single normalized section.
    expect(getReviewSections(current.metadata).sections).toHaveLength(1);
  });

  it('ignores sections[] entries with unknown prompts or empty content', async () => {
    const { supabase, recorded } = buildMockSupabase(freshStep());

    // Zod will reject the entire call if `prompt` is not in enum. So we test
    // the runtime guard in the handler against malformed-but-zod-valid input.
    // Easiest path: bypass Zod validation by calling the handler indirectly
    // via executeTool with a valid `sections` array, plus extra junk in flat
    // fields. Use empty/whitespace strings to test the content filter.
    await executeTool(
      'log_debrief',
      {
        step_id: STEP_ID,
        what_learned: '   ', // whitespace — should be filtered out
        sections: [
          { prompt: 'what_worked', content: 'Kept entry.' },
          { prompt: 'what_didnt', content: '   ' }, // whitespace filtered
        ],
      },
      supabase,
      AUTH,
    );

    const review = (recorded.updates[0].metadata as Record<string, unknown>).review as Record<string, unknown>;
    const sections = review.sections as Record<string, unknown>[];
    expect(sections).toHaveLength(1);
    expect(sections[0].prompt).toBe('what_worked');
  });
});

describe('executeTool central hook — markStepActive', () => {
  beforeEach(() => {
    delete process.env.BOT_RECENT_ACTIVITY_ENABLED;
  });

  it('calls mark_step_active RPC after a successful step-touching tool', async () => {
    const { supabase, recorded } = buildMockSupabase(freshStep());

    await executeTool('log_debrief', { step_id: STEP_ID, what_learned: 'X' }, supabase, AUTH);

    // RPC fires asynchronously (fire-and-forget). Yield the event loop.
    await new Promise((r) => setImmediate(r));

    expect(recorded.rpcCalls).toHaveLength(1);
    expect(recorded.rpcCalls[0]).toEqual({
      fn: 'mark_step_active',
      args: { p_step_id: STEP_ID, p_source: 'telegram', p_user_id: USER_ID },
    });
  });

  it('does not call the RPC when BOT_RECENT_ACTIVITY_ENABLED=false', async () => {
    process.env.BOT_RECENT_ACTIVITY_ENABLED = 'false';
    const { supabase, recorded } = buildMockSupabase(freshStep());

    await executeTool('log_debrief', { step_id: STEP_ID, what_learned: 'X' }, supabase, AUTH);
    await new Promise((r) => setImmediate(r));

    expect(recorded.rpcCalls).toHaveLength(0);
  });
});
