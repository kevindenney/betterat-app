/**
 * Public Step API
 * Returns step data for public viewing - NO AUTH REQUIRED
 *
 * GET /api/public/steps/[token]
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getReviewSections, getReviewSectionContent } from '../../../../lib/step/getReviewSections';
import type { StepMetadata } from '../../../../types/step-detail';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface PublicStepInfo {
  title: string;
  status: string;
  category: string;
  starts_at: string | null;
  ends_at: string | null;
  creator: { display_name: string } | null;
  interest: { name: string } | null;
  plan: {
    what: string | null;
    how_sub_steps: { text: string; completed: boolean }[];
    why: string | null;
    capability_goals: string[];
    collaborator_names: string[];
  };
  act: {
    notes: string | null;
    media_uploads: { uri: string; type: string; caption?: string }[];
    media_links: { url: string; platform: string; caption?: string }[];
    sub_step_progress: Record<string, boolean>;
  };
  review: {
    overall_rating: number | null;
    what_learned: string | null;
    capability_progress: Record<string, number>;
  };
  created_at: string;
  shared_at: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS + cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing share token' });
  }

  try {
    // Fetch step by share token (only if sharing is enabled)
    const { data: step, error: stepError } = await supabase
      .from('timeline_steps')
      .select('*')
      .eq('share_token', token)
      .eq('share_enabled', true)
      .single();

    if (stepError || !step) {
      return res.status(404).json({ error: 'Step not found or sharing is disabled' });
    }

    // Fetch creator display name
    let creator: { display_name: string } | null = null;
    if (step.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, display_name')
        .eq('id', step.user_id)
        .single();

      if (profile) {
        creator = {
          display_name: profile.display_name || profile.full_name || 'Anonymous',
        };
      }
    }

    // Fetch interest name
    let interest: { name: string } | null = null;
    if (step.interest_id) {
      const { data: interestData } = await supabase
        .from('interests')
        .select('name')
        .eq('id', step.interest_id)
        .single();

      if (interestData) {
        interest = { name: interestData.name };
      }
    }

    // Extract metadata
    const metadata = (step.metadata || {}) as Record<string, any>;
    const planData = metadata.plan || {};
    const actData = metadata.act || {};
    const reviewData = metadata.review || {};
    const normalizedReview = getReviewSections(
      metadata as StepMetadata,
      step.completed_at ?? null,
    );
    const learnedFromSections = getReviewSectionContent(
      normalizedReview.sections,
      'what_did_you_learn',
    );

    // Build collaborator display names (no user_ids)
    const collaborators: { display_name?: string }[] = planData.collaborators || [];
    const legacyNames: string[] = planData.who_collaborators || [];
    const collaboratorNames = collaborators.length > 0
      ? collaborators.map((c: any) => c.display_name || 'Someone').filter(Boolean)
      : legacyNames;

    // Sanitize sub-steps (text only, no IDs leaked)
    const subSteps: { text: string; completed: boolean }[] = (planData.how_sub_steps || []).map(
      (ss: any) => ({
        text: ss.text || '',
        completed: !!ss.completed,
      })
    );

    // Sanitize media uploads (URIs only, no internal IDs)
    const mediaUploads: { uri: string; type: string; caption?: string }[] = (
      actData.media_uploads || []
    ).map((m: any) => ({
      uri: m.uri || '',
      type: m.type || 'photo',
      ...(m.caption ? { caption: m.caption } : {}),
    }));

    // Media links
    const mediaLinks: { url: string; platform: string; caption?: string }[] = (
      actData.media_links || []
    ).map((m: any) => ({
      url: m.url || '',
      platform: m.platform || 'other',
      ...(m.caption ? { caption: m.caption } : {}),
    }));

    const response: PublicStepInfo = {
      title: step.title,
      status: step.status,
      category: step.category,
      starts_at: step.starts_at,
      ends_at: step.ends_at,
      creator,
      interest,
      plan: {
        what: planData.what_will_you_do || null,
        how_sub_steps: subSteps,
        why: planData.why_reasoning || null,
        capability_goals: planData.capability_goals || [],
        collaborator_names: collaboratorNames,
      },
      act: {
        notes: actData.notes || null,
        media_uploads: mediaUploads,
        media_links: mediaLinks,
        sub_step_progress: actData.sub_step_progress || {},
      },
      review: {
        overall_rating: reviewData.overall_rating ?? null,
        what_learned: learnedFromSections || reviewData.what_learned || null,
        capability_progress: reviewData.capability_progress || {},
      },
      created_at: step.created_at,
      shared_at: step.public_shared_at,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Public step API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
