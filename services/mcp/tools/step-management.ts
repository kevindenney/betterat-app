import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isFeatureAvailable } from '../../../lib/subscriptions/sailorTiers';
import type { AuthContext } from '../server';

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/**
 * Resolve an interest by slug or name to its UUID.
 * Falls back to partial name match if exact slug miss.
 */
async function resolveInterestId(
  supabase: SupabaseClient,
  interestRef: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  // Try exact UUID first
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(interestRef)) {
    const { data } = await supabase
      .from('interests')
      .select('id, name, slug')
      .eq('id', interestRef)
      .maybeSingle();
    if (data) return data as { id: string; name: string; slug: string };
  }

  // Try exact slug match
  const { data: bySlug } = await supabase
    .from('interests')
    .select('id, name, slug')
    .eq('slug', interestRef.toLowerCase())
    .maybeSingle();
  if (bySlug) return bySlug as { id: string; name: string; slug: string };

  // Try case-insensitive name match
  const { data: byName } = await supabase
    .from('interests')
    .select('id, name, slug')
    .ilike('name', interestRef)
    .maybeSingle();
  if (byName) return byName as { id: string; name: string; slug: string };

  return null;
}

export function registerStepManagementTools(
  server: McpServer,
  supabase: SupabaseClient,
  auth: AuthContext,
) {
  // -------------------------------------------------------------------------
  // create_step — professors create curriculum steps, students create personal ones
  // -------------------------------------------------------------------------
  server.registerTool(
    'create_step',
    {
      description:
        'Create a new learning step on the authenticated user\'s timeline. ' +
        'Professors use this to build curriculum; students use it to add personal learning goals. ' +
        'The interest can be a slug (e.g. "nursing"), name, or UUID.',
      inputSchema: {
        title: z.string().describe('Step title — what the learner will do'),
        interest: z.string().describe('Interest slug, name, or UUID (e.g. "nursing", "sailing")'),
        description: z.string().optional().describe('Longer description of the step'),
        category: z
          .enum(['general', 'practice', 'race', 'study', 'assessment', 'clinical', 'lab', 'field'])
          .optional()
          .describe('Step category (defaults to "general")'),
        status: z
          .enum(['pending', 'in_progress', 'completed', 'skipped'])
          .optional()
          .describe('Initial status (defaults to "pending")'),
        visibility: z
          .enum(['private', 'crew', 'fleet', 'public'])
          .optional()
          .describe('Who can see this step (defaults to "private")'),
        starts_at: z.string().optional().describe('Start date/time in ISO 8601 format'),
        ends_at: z.string().optional().describe('End date/time in ISO 8601 format'),
        plan_notes: z
          .string()
          .optional()
          .describe('Initial planning notes — what the learner intends to focus on'),
        competency_ids: z
          .array(z.string())
          .optional()
          .describe('Competency IDs to link to this step'),
      },
    },
    async (args) => {
      // Check write access
      if (!isFeatureAvailable('mcp_write', auth.tier)) {
        return jsonResponse({
          error: 'Creating steps via MCP requires a Pro subscription.',
          required_tier: 'pro',
          current_tier: auth.tier,
        });
      }

      // Resolve the interest
      const interest = await resolveInterestId(supabase, args.interest);
      if (!interest) {
        return jsonResponse({
          error: `Could not find interest "${args.interest}". Use list_interests to see available options.`,
        });
      }

      // Build metadata with plan/act/review structure matching app conventions
      const metadata: Record<string, unknown> = {
        plan: {
          notes: args.plan_notes ?? '',
          collaborators: [],
          ...(args.competency_ids?.length
            ? { linked_competencies: args.competency_ids }
            : {}),
        },
        act: {},
        review: {},
      };

      const { data, error } = await supabase
        .from('timeline_steps')
        .insert({
          user_id: auth.userId,
          interest_id: interest.id,
          title: args.title,
          description: args.description ?? null,
          category: args.category ?? 'general',
          status: args.status ?? 'pending',
          visibility: args.visibility ?? 'private',
          starts_at: args.starts_at ?? new Date().toISOString(),
          ends_at: args.ends_at ?? null,
          source_type: 'manual',
          metadata,
        })
        .select('id, title, description, category, status, visibility, starts_at, ends_at, created_at')
        .single();

      if (error) return jsonResponse({ error: error.message });

      return jsonResponse({
        created: true,
        step: data,
        interest: { id: interest.id, name: interest.name, slug: interest.slug },
      });
    },
  );

  // -------------------------------------------------------------------------
  // update_step — edit title, description, plan notes, status, etc.
  // -------------------------------------------------------------------------
  server.registerTool(
    'update_step',
    {
      description:
        'Update an existing learning step. Can change title, description, status, plan notes, and more.',
      inputSchema: {
        step_id: z.string().describe('The timeline step ID to update'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        category: z
          .enum(['general', 'practice', 'race', 'study', 'assessment', 'clinical', 'lab', 'field'])
          .optional()
          .describe('New category'),
        status: z
          .enum(['pending', 'in_progress', 'completed', 'skipped'])
          .optional()
          .describe('New status'),
        visibility: z
          .enum(['private', 'crew', 'fleet', 'public'])
          .optional()
          .describe('New visibility'),
        starts_at: z.string().optional().describe('New start date/time (ISO 8601)'),
        ends_at: z.string().optional().describe('New end date/time (ISO 8601)'),
        plan_notes: z.string().optional().describe('Update the planning notes'),
      },
    },
    async (args) => {
      // Check write access
      if (!isFeatureAvailable('mcp_write', auth.tier)) {
        return jsonResponse({
          error: 'Updating steps via MCP requires a Pro subscription.',
          required_tier: 'pro',
          current_tier: auth.tier,
        });
      }

      // Build the update payload — only include provided fields
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (args.title !== undefined) updates.title = args.title;
      if (args.description !== undefined) updates.description = args.description;
      if (args.category !== undefined) updates.category = args.category;
      if (args.status !== undefined) updates.status = args.status;
      if (args.visibility !== undefined) updates.visibility = args.visibility;
      if (args.starts_at !== undefined) updates.starts_at = args.starts_at;
      if (args.ends_at !== undefined) updates.ends_at = args.ends_at;

      // If plan_notes provided, merge into existing metadata
      if (args.plan_notes !== undefined) {
        const { data: existing } = await supabase
          .from('timeline_steps')
          .select('metadata')
          .eq('id', args.step_id)
          .single();

        const existingMeta = (existing?.metadata as Record<string, unknown>) ?? {};
        const existingPlan = (existingMeta.plan as Record<string, unknown>) ?? {};
        updates.metadata = {
          ...existingMeta,
          plan: { ...existingPlan, notes: args.plan_notes },
        };
      }

      const { data, error } = await supabase
        .from('timeline_steps')
        .update(updates)
        .eq('id', args.step_id)
        .eq('user_id', auth.userId) // RLS safety: only own steps
        .select('id, title, description, category, status, visibility, starts_at, ends_at, updated_at')
        .single();

      if (error) return jsonResponse({ error: error.message });

      return jsonResponse({ updated: true, step: data });
    },
  );

  // -------------------------------------------------------------------------
  // list_interests — discover available interests (needed for create_step)
  // -------------------------------------------------------------------------
  server.registerTool(
    'list_interests',
    {
      description:
        'List available interests/subjects. Use this to find the right interest slug for creating steps.',
      inputSchema: {
        search: z.string().optional().describe('Search by name (partial match)'),
      },
    },
    async (args) => {
      let query = supabase
        .from('interests')
        .select('id, slug, name, description, type, parent_id')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (args.search) {
        query = query.ilike('name', `%${args.search}%`);
      }

      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message });

      return jsonResponse({ count: data?.length ?? 0, interests: data ?? [] });
    },
  );

  // -------------------------------------------------------------------------
  // get_suggested_next_steps — AI-friendly: what should the learner do next?
  // -------------------------------------------------------------------------
  server.registerTool(
    'get_suggested_next_steps',
    {
      description:
        'Get suggested next steps for the learner based on their subscribed blueprints. ' +
        'Returns blueprint steps the user hasn\'t adopted yet, ordered by curriculum sequence.',
      inputSchema: {
        interest: z.string().optional().describe('Filter by interest slug, name, or UUID'),
        limit: z.number().optional().describe('Max suggestions to return (default 5)'),
      },
    },
    async (args) => {
      const maxResults = args.limit ?? 5;

      // Get user's blueprint subscriptions
      const { data: subs, error: subError } = await supabase
        .from('blueprint_subscriptions')
        .select('blueprint_id, timeline_blueprints!inner(id, title, user_id, interest_id)')
        .eq('subscriber_id', auth.userId);

      if (subError) return jsonResponse({ error: subError.message });
      if (!subs?.length) {
        return jsonResponse({
          suggestions: [],
          message: 'No subscribed blueprints. Use list_blueprints and subscribe_to_blueprint first.',
        });
      }

      // Optionally filter by interest
      let filteredSubs = subs;
      if (args.interest) {
        const interest = await resolveInterestId(supabase, args.interest);
        if (interest) {
          filteredSubs = subs.filter(
            (s: any) => s.timeline_blueprints?.interest_id === interest.id,
          );
        }
      }

      // Get user's existing step titles to avoid duplicates
      const { data: existingSteps } = await supabase
        .from('timeline_steps')
        .select('title, source_blueprint_id')
        .eq('user_id', auth.userId);

      const existingTitles = new Set(
        (existingSteps ?? []).map((s: any) => s.title?.toLowerCase()),
      );

      // Gather suggestions from each blueprint
      const suggestions: {
        blueprint_title: string;
        blueprint_id: string;
        step_id: string;
        title: string;
        description: string | null;
        category: string;
        sort_order: number;
      }[] = [];

      for (const sub of filteredSubs) {
        const bp = (sub as any).timeline_blueprints;
        if (!bp) continue;

        const { data: bpSteps } = await supabase
          .from('timeline_steps')
          .select('id, title, description, category, sort_order')
          .eq('user_id', bp.user_id)
          .eq('interest_id', bp.interest_id)
          .neq('visibility', 'private')
          .order('sort_order', { ascending: true });

        for (const step of bpSteps ?? []) {
          if (!existingTitles.has((step as any).title?.toLowerCase())) {
            suggestions.push({
              blueprint_title: bp.title,
              blueprint_id: bp.id,
              step_id: (step as any).id,
              title: (step as any).title,
              description: (step as any).description,
              category: (step as any).category,
              sort_order: (step as any).sort_order,
            });
          }
        }
      }

      // Sort by curriculum order and limit
      suggestions.sort((a, b) => a.sort_order - b.sort_order);

      return jsonResponse({
        count: suggestions.length,
        suggestions: suggestions.slice(0, maxResults),
        message: suggestions.length
          ? 'Use create_step to add any of these to your timeline.'
          : 'You\'ve adopted all available steps from your blueprints!',
      });
    },
  );
}
