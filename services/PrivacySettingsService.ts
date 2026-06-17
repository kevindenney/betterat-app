/**
 * PrivacySettingsService
 *
 * Data-access layer for user privacy settings stored in:
 *   profiles          - profile_public, default_step_visibility,
 *                       allow_peer_visibility, allow_follower_sharing
 *   user_preferences  - interest_visibility_defaults (JSONB)
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type { TimelineStepVisibility } from '@/types/timeline-steps';
import type { StepLocationPrecision } from '@/types/step-detail';

const logger = createLogger('PrivacySettingsService');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfilePrivacySettings {
  profile_public: boolean;
  default_step_visibility: TimelineStepVisibility;
  allow_peer_visibility: boolean;
  allow_follower_sharing: boolean;
  // NULL means "use exact" via the RPC's COALESCE; stored explicitly only
  // when the user coarsens their default in privacy settings.
  default_location_precision: StepLocationPrecision | null;
  // Per-section public-face visibility. AND-gates on top of per-step
  // visibility — these decide whether a section appears at all.
  show_framing: boolean;
  show_working_on_now: boolean;
  show_capabilities: boolean;
  show_practice_timeline: boolean;
  show_practice_circle: boolean;
  show_orgs: boolean;
  show_published_blueprints: boolean;
  show_events: boolean;
  // Per-interaction permissions — which public-face CTAs others can use.
  allow_follow: boolean;
  allow_message: boolean;
  allow_suggest_step: boolean;
  allow_reflect: boolean;
}

export interface PrivacySettings extends ProfilePrivacySettings {
  interest_visibility_defaults: Record<string, TimelineStepVisibility>;
}

export const DEFAULT_SETTINGS: PrivacySettings = {
  // Public profile visibility is explicit opt-in; missing settings default private.
  profile_public: false,
  default_step_visibility: 'private',
  allow_peer_visibility: true,
  allow_follower_sharing: true,
  default_location_precision: null,
  // Mirror the profiles table-level defaults. The two false defaults
  // (practice circle, orgs) keep second-party / affiliation data opt-in.
  show_framing: true,
  show_working_on_now: true,
  show_capabilities: true,
  show_practice_timeline: true,
  show_practice_circle: false,
  show_orgs: false,
  show_published_blueprints: true,
  show_events: true,
  allow_follow: true,
  allow_message: true,
  allow_suggest_step: true,
  allow_reflect: true,
  interest_visibility_defaults: {},
};

// The section/interaction flag columns, read alongside the legacy privacy
// columns. Boolean NOT NULL with table-level defaults, so `?? DEFAULT` only
// fires for a missing profiles row.
const SECTION_FLAG_KEYS = [
  'show_framing',
  'show_working_on_now',
  'show_capabilities',
  'show_practice_timeline',
  'show_practice_circle',
  'show_orgs',
  'show_published_blueprints',
  'show_events',
  'allow_follow',
  'allow_message',
  'allow_suggest_step',
  'allow_reflect',
] as const;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getPrivacySettings(
  userId: string,
): Promise<PrivacySettings> {
  try {
    const [profileRes, prefsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          `profile_public, default_step_visibility, allow_peer_visibility, allow_follower_sharing, default_location_precision, ${SECTION_FLAG_KEYS.join(', ')}`,
        )
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('user_preferences')
        .select('interest_visibility_defaults')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (profileRes.error) {
      logger.error('Failed to load profile privacy settings', profileRes.error);
    }

    const profile = profileRes.data as Record<string, unknown> | null;
    const prefs = prefsRes.data;

    const flags = {} as Record<(typeof SECTION_FLAG_KEYS)[number], boolean>;
    for (const key of SECTION_FLAG_KEYS) {
      flags[key] = (profile?.[key] as boolean | undefined) ?? DEFAULT_SETTINGS[key];
    }

    return {
      profile_public:
        (profile?.profile_public as boolean | undefined) ?? DEFAULT_SETTINGS.profile_public,
      default_step_visibility:
        (profile?.default_step_visibility as TimelineStepVisibility) ??
        DEFAULT_SETTINGS.default_step_visibility,
      allow_peer_visibility:
        (profile?.allow_peer_visibility as boolean | undefined) ??
        DEFAULT_SETTINGS.allow_peer_visibility,
      allow_follower_sharing:
        (profile?.allow_follower_sharing as boolean | undefined) ??
        DEFAULT_SETTINGS.allow_follower_sharing,
      default_location_precision:
        (profile?.default_location_precision as StepLocationPrecision | null) ??
        DEFAULT_SETTINGS.default_location_precision,
      ...flags,
      interest_visibility_defaults:
        (prefs?.interest_visibility_defaults as Record<string, TimelineStepVisibility>) ??
        DEFAULT_SETTINGS.interest_visibility_defaults,
    };
  } catch (err) {
    logger.error('Failed to get privacy settings', err);
    return { ...DEFAULT_SETTINGS };
  }
}

// ---------------------------------------------------------------------------
// Update profile-level settings
// ---------------------------------------------------------------------------

export async function updateProfilePrivacy(
  userId: string,
  updates: Partial<ProfilePrivacySettings>,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    logger.error('Failed to update profile privacy', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Per-interest visibility defaults
// ---------------------------------------------------------------------------

export async function getInterestDefaults(
  userId: string,
): Promise<Record<string, TimelineStepVisibility>> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('interest_visibility_defaults')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to load interest defaults', error);
    return {};
  }

  return (data?.interest_visibility_defaults as Record<string, TimelineStepVisibility>) ?? {};
}

/**
 * Set (or clear) the default visibility for a specific interest.
 * Pass `null` to remove the override and fall back to the profile default.
 */
export async function setInterestDefault(
  userId: string,
  interestId: string,
  visibility: TimelineStepVisibility | null,
): Promise<void> {
  // Load current defaults
  const current = await getInterestDefaults(userId);

  const updated = { ...current };
  if (visibility === null) {
    delete updated[interestId];
  } else {
    updated[interestId] = visibility;
  }

  // Upsert into user_preferences
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, interest_visibility_defaults: updated },
      { onConflict: 'user_id' },
    );

  if (error) {
    logger.error('Failed to set interest default', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Resolve the effective default visibility for a new step (cascade)
// ---------------------------------------------------------------------------

/**
 * Resolves the default visibility for a new timeline step:
 *   1. Per-interest override (user_preferences.interest_visibility_defaults)
 *   2. Profile-level default (profiles.default_step_visibility)
 *   3. Hardcoded fallback ('private')
 */
export async function resolveDefaultVisibility(
  userId: string,
  interestId: string,
): Promise<TimelineStepVisibility> {
  try {
    const [prefsRes, profileRes] = await Promise.all([
      supabase
        .from('user_preferences')
        .select('interest_visibility_defaults')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('default_step_visibility')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    // 1. Per-interest override
    const interestDefaults = prefsRes.data?.interest_visibility_defaults as Record<
      string,
      string
    > | null;
    if (interestDefaults?.[interestId]) {
      return interestDefaults[interestId] as TimelineStepVisibility;
    }

    // 2. Profile-level default
    if (profileRes.data?.default_step_visibility) {
      return profileRes.data.default_step_visibility as TimelineStepVisibility;
    }

    // 3. Fallback
    return 'private';
  } catch {
    return 'private';
  }
}
