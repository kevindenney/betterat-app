import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isFeatureAvailable } from '../../../lib/subscriptions/sailorTiers';
import type { AuthContext } from '../server';
import { isResolvedOrgMembershipActive } from '../../../hooks/orgMembershipStatus';

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerBlueprintTools(
  server: McpServer,
  supabase: SupabaseClient,
  auth: AuthContext,
) {
  server.registerTool(
    'list_blueprints',
    {
      description:
        'List published curricula/blueprints. Optionally filter by organization.',
      inputSchema: {
        organization_id: z
          .string()
          .optional()
          .describe('Filter by organization ID'),
      },
    },
    async (args) => {
      let query = supabase
        .from('timeline_blueprints')
        .select('id, slug, title, description, subscriber_count, organization_id, access_level, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (args.organization_id) {
        query = query.eq('organization_id', args.organization_id);
      }

      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message });

      return jsonResponse({ count: data?.length ?? 0, blueprints: data ?? [] });
    },
  );

  server.registerTool(
    'get_blueprint_steps',
    {
      description:
        'Get the ordered learning steps in a blueprint/curriculum.',
      inputSchema: {
        blueprint_id: z.string().describe('Blueprint ID'),
      },
    },
    async (args) => {
      // Get the blueprint to find author + interest
      const { data: blueprint, error: bpError } = await supabase
        .from('timeline_blueprints')
        .select('id, user_id, interest_id, title, slug')
        .eq('id', args.blueprint_id)
        .maybeSingle();

      if (bpError) return jsonResponse({ error: bpError.message });
      if (!blueprint) return jsonResponse({ error: 'Blueprint not found' });

      // Get the author's non-private steps for this interest
      const { data: steps, error: stepsError } = await supabase
        .from('timeline_steps')
        .select('id, title, description, category, status, starts_at, ends_at, sort_order, metadata')
        .eq('user_id', (blueprint as any).user_id)
        .eq('interest_id', (blueprint as any).interest_id)
        .neq('visibility', 'private')
        .order('sort_order', { ascending: true });

      if (stepsError) return jsonResponse({ error: stepsError.message });

      return jsonResponse({
        blueprint: {
          id: (blueprint as any).id,
          title: (blueprint as any).title,
          slug: (blueprint as any).slug,
        },
        count: steps?.length ?? 0,
        steps: steps ?? [],
      });
    },
  );

  server.registerTool(
    'subscribe_to_blueprint',
    {
      description:
        'Subscribe the current user to a blueprint/curriculum.',
      inputSchema: {
        blueprint_id: z.string().describe('Blueprint ID to subscribe to'),
      },
    },
    async (args) => {
      if (!isFeatureAvailable('mcp_write', auth.tier)) {
        return jsonResponse({
          error: 'Subscribing to blueprints via MCP requires a Pro subscription.',
          required_tier: 'pro',
          current_tier: auth.tier,
        });
      }

      // Fetch blueprint to check access
      const { data: blueprint, error: bpError } = await supabase
        .from('timeline_blueprints')
        .select('id, access_level, organization_id, is_published')
        .eq('id', args.blueprint_id)
        .maybeSingle();

      if (bpError) return jsonResponse({ error: bpError.message });
      if (!blueprint) return jsonResponse({ error: 'Blueprint not found' });
      if (!(blueprint as any).is_published) {
        return jsonResponse({ error: 'Blueprint is not published' });
      }

      // Check org access if needed
      if (
        (blueprint as any).access_level === 'org_members' &&
        (blueprint as any).organization_id
      ) {
        const { data: membership } = await supabase
          .from('organization_memberships')
          .select('id,status,membership_status')
          .eq('user_id', auth.userId)
          .eq('organization_id', (blueprint as any).organization_id)
          .maybeSingle();

        if (!membership || !isResolvedOrgMembershipActive(membership)) {
          return jsonResponse({ error: 'You must be a member of the organization to subscribe' });
        }
      }

      // Upsert subscription
      const { data: sub, error: subError } = await supabase
        .from('blueprint_subscriptions')
        .upsert(
          {
            blueprint_id: args.blueprint_id,
            subscriber_id: auth.userId,
            subscribed_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'blueprint_id,subscriber_id' },
        )
        .select('id, blueprint_id, subscribed_at')
        .single();

      if (subError) return jsonResponse({ error: subError.message });

      return jsonResponse({ subscribed: true, subscription: sub });
    },
  );
}
