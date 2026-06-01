import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthContext } from '../server';

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerOrganizationTools(
  server: McpServer,
  supabase: SupabaseClient,
  auth: AuthContext,
) {
  server.registerTool(
    'list_cohort_members',
    {
      description:
        'List members of an organization/cohort with profile info.',
      inputSchema: {
        organization_id: z
          .string()
          .optional()
          .describe('Organization ID (defaults to the authenticated user\'s organization)'),
      },
    },
    async (args) => {
      const orgId = args.organization_id || auth.clubId;
      if (!orgId) {
        return jsonResponse({ error: 'No organization context. Provide organization_id or ensure user has an org.' });
      }

      const { data: memberships, error } = await supabase
        .from('organization_memberships')
        .select('user_id, role, status, joined_at')
        .eq('organization_id', orgId)
        .in('status', ['active', 'verified']);

      if (error) return jsonResponse({ error: error.message });
      if (!memberships || memberships.length === 0) {
        return jsonResponse({ organization_id: orgId, count: 0, members: [] });
      }

      // Names live on `profiles`; emoji-avatar styling on `sailor_profiles`.
      const userIds = memberships.map((m: any) => m.user_id);
      const [{ data: profiles }, { data: sailorProfiles }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', userIds),
        supabase
          .from('sailor_profiles')
          .select('user_id, avatar_emoji')
          .in('user_id', userIds),
      ]);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const sailorMap = new Map(
        (sailorProfiles ?? []).map((sp: any) => [sp.user_id, sp]),
      );

      const members = memberships.map((m: any) => {
        const profile = profileMap.get(m.user_id);
        const sailor = sailorMap.get(m.user_id);
        return {
          user_id: m.user_id,
          role: m.role,
          status: m.status,
          joined_at: m.joined_at,
          display_name: profile?.full_name ?? null,
          avatar_emoji: sailor?.avatar_emoji ?? null,
        };
      });

      return jsonResponse({ organization_id: orgId, count: members.length, members });
    },
  );

  server.registerTool(
    'get_cohort_progress_summary',
    {
      description:
        'Get aggregate competency progress across all members of a cohort/organization. Shows status distribution and overall completion.',
      inputSchema: {
        organization_id: z
          .string()
          .optional()
          .describe('Organization ID (defaults to the authenticated user\'s organization)'),
      },
    },
    async (args) => {
      const orgId = args.organization_id || auth.clubId;
      if (!orgId) {
        return jsonResponse({ error: 'No organization context. Provide organization_id or ensure user has an org.' });
      }

      // Get org members
      const { data: memberships, error: memError } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', orgId)
        .in('status', ['active', 'verified']);

      if (memError) return jsonResponse({ error: memError.message });
      if (!memberships || memberships.length === 0) {
        return jsonResponse({ organization_id: orgId, member_count: 0, summary: {} });
      }

      const userIds = memberships.map((m: any) => m.user_id);

      // Get all competency progress for these users
      const { data: progress, error: progError } = await supabase
        .from('competency_progress')
        .select('user_id, competency_id, status')
        .in('user_id', userIds);

      if (progError) return jsonResponse({ error: progError.message });

      // Aggregate by status
      const statusCounts: Record<string, number> = {};
      const perStudent: Record<string, { total: number; byStatus: Record<string, number> }> = {};

      for (const row of (progress ?? []) as any[]) {
        const s = row.status ?? 'not_started';
        statusCounts[s] = (statusCounts[s] ?? 0) + 1;

        if (!perStudent[row.user_id]) {
          perStudent[row.user_id] = { total: 0, byStatus: {} };
        }
        perStudent[row.user_id].total++;
        perStudent[row.user_id].byStatus[s] =
          (perStudent[row.user_id].byStatus[s] ?? 0) + 1;
      }

      // Compute per-student completion rates
      const completionRates = Object.values(perStudent).map(s => {
        const done = (s.byStatus['validated'] ?? 0) + (s.byStatus['competent'] ?? 0);
        return s.total > 0 ? Math.round((done / s.total) * 100) : 0;
      });

      const avgCompletion =
        completionRates.length > 0
          ? Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length)
          : 0;

      return jsonResponse({
        organization_id: orgId,
        member_count: userIds.length,
        total_progress_records: (progress ?? []).length,
        statusCounts,
        avgCompletionPercent: avgCompletion,
        completionDistribution: {
          min: completionRates.length > 0 ? Math.min(...completionRates) : 0,
          max: completionRates.length > 0 ? Math.max(...completionRates) : 0,
          avg: avgCompletion,
        },
      });
    },
  );
}
