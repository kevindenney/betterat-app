/**
 * useFeatureGate Hook
 *
 * Central hook for checking tier access and managing feature gates.
 * Used throughout the app to:
 * - Check if a feature is available for the user's tier
 * - Track race usage limits
 * - Trigger upgrade prompts at strategic moments
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import {
  GatedFeature,
  SailorTier,
  isFeatureAvailable,
  getTierLimits,
  hasReachedRaceLimit,
  getRemainingRaces,
  getRequiredTier,
  SAILOR_TIERS,
} from '@/lib/subscriptions/sailorTiers';

export interface FeatureGateResult {
  /** Whether the feature is available */
  isAvailable: boolean;
  /** Whether the user is a guest (not signed in) */
  isGuest: boolean;
  /** User's current tier */
  tier: SailorTier;
  /** Tier required to access this feature */
  requiredTier: SailorTier;
  /** Human-readable name of required tier */
  requiredTierName: string;
  /** Function to trigger upgrade prompt */
  promptUpgrade: () => void;
}

export interface RaceLimitResult {
  /** Whether user has reached their race limit */
  hasReachedLimit: boolean;
  /** Current race count */
  currentCount: number;
  /** Maximum allowed races (null if unlimited) */
  maxRaces: number | null;
  /** Remaining races (null if unlimited) */
  remaining: number | null;
  /** User's current tier */
  tier: SailorTier;
  /** Whether user is a guest */
  isGuest: boolean;
  /** Function to trigger upgrade prompt */
  promptUpgrade: () => void;
}

export type TierSource = 'self' | 'organization' | 'trial';

export interface UseFeatureGateReturn {
  /** Check if a specific feature is available */
  checkFeature: (feature: GatedFeature) => FeatureGateResult;
  /** Check race limit status */
  checkRaceLimit: (raceCount: number) => RaceLimitResult;
  /** User's current tier */
  tier: SailorTier;
  /** Where the tier comes from: self-paid, organization, or trial */
  tierSource: TierSource;
  /** Whether user is a guest */
  isGuest: boolean;
  /** Whether user is on free tier */
  isFree: boolean;
  /** Whether user is on basic tier */
  isBasic: boolean;
  /** Whether user has pro tier */
  isPro: boolean;
  /** Whether user is currently in a reverse trial */
  isTrialing: boolean;
  /** Whether tier is provided by an organization */
  isOrgSponsored: boolean;
  /** Tier display name */
  tierName: string;
  /** Trigger upgrade prompt */
  promptUpgrade: (feature?: GatedFeature, context?: string) => void;
  /** Trigger sign-up prompt for guests */
  promptSignUp: (context?: string) => void;
}

/**
 * Hook for managing feature gates and tier checking
 */
export function useFeatureGate(): UseFeatureGateReturn {
  const { user, isGuest, userProfile } = useAuth();

  // Determine user's tier
  // Priority: active trial → subscription_tier from profile → 'free'
  // During an active trial (subscription_status = 'trialing' and trial_ends_at > now),
  // the user has 'individual' tier access regardless of subscription_tier.
  const tier: SailorTier = useMemo(() => {
    if (isGuest) return 'free';
    if (!user) return 'free';

    const profile = userProfile as any;
    const subscriptionStatus = profile?.subscription_status;
    const trialEndsAt = profile?.trial_ends_at;

    // Reverse trial: a 'trialing' status means subscription_tier holds the trial
    // grant ('individual'), not a purchased entitlement. Honor it only while the
    // trial is live. Once trial_ends_at has passed (or is missing), the trial
    // confers nothing — return 'free' WITHOUT falling through to the raw tier,
    // which would otherwise leave every expired trial on 'individual' forever.
    // The server-side cron (expire_due_reverse_trials) downgrades the row too;
    // this guards the window before it runs and any malformed trialing rows.
    if (subscriptionStatus === 'trialing') {
      if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
        return 'individual';
      }
      return 'free';
    }

    // Check user profile for subscription tier
    const subscriptionTier = profile?.subscription_tier;
    if (subscriptionTier && ['free', 'individual', 'pro'].includes(subscriptionTier)) {
      return subscriptionTier as SailorTier;
    }
    // Legacy tier names
    if (subscriptionTier === 'basic') return 'individual';
    if (subscriptionTier === 'team' || subscriptionTier === 'championship') return 'pro';

    return 'free';
  }, [user, isGuest, userProfile]);

  // Whether user is currently in a trial
  const isTrialing = useMemo(() => {
    const profile = userProfile as any;
    if (!profile?.subscription_status || profile.subscription_status !== 'trialing') return false;
    if (!profile.trial_ends_at) return false;
    return new Date(profile.trial_ends_at) > new Date();
  }, [userProfile]);

  // Determine tier source
  const tierSource: TierSource = useMemo(() => {
    if (isGuest) return 'self';
    const profile = userProfile as any;
    return profile?.tier_source || 'self';
  }, [isGuest, userProfile]);

  const tierName = SAILOR_TIERS[tier].name;
  const isFree = tier === 'free';
  const isBasic = tier === 'basic';
  const isPro = tier === 'pro';
  const isOrgSponsored = tierSource === 'organization';

  /**
   * Trigger upgrade prompt
   * Can be customized based on feature and context
   */
  const promptUpgrade = useCallback((feature?: GatedFeature, context?: string) => {
    // No-op for org-sponsored users — their org provides the tier
    if (tierSource === 'organization') return;

    // This will be connected to the UpgradePrompt modal
    // For now, we'll dispatch an event that components can listen to
    const event = new CustomEvent('regattaflow:upgrade-prompt', {
      detail: { feature, context, currentTier: tier },
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }, [tier, tierSource]);

  /**
   * Trigger sign-up prompt for guests
   */
  const promptSignUp = useCallback((context?: string) => {
    const event = new CustomEvent('regattaflow:signup-prompt', {
      detail: { context, isGuest: true },
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }, []);

  /**
   * Check if a specific feature is available
   */
  const checkFeature = useCallback((feature: GatedFeature): FeatureGateResult => {
    const available = isFeatureAvailable(feature, tier);
    const requiredTier = getRequiredTier(feature);

    return {
      isAvailable: available,
      isGuest,
      tier,
      requiredTier,
      requiredTierName: SAILOR_TIERS[requiredTier].name,
      promptUpgrade: () => promptUpgrade(feature),
    };
  }, [tier, isGuest, promptUpgrade]);

  /**
   * Check race limit status
   */
  const checkRaceLimit = useCallback((raceCount: number): RaceLimitResult => {
    const limits = getTierLimits(tier);
    const reachedLimit = hasReachedRaceLimit(raceCount, tier);
    const remaining = getRemainingRaces(raceCount, tier);

    return {
      hasReachedLimit: reachedLimit,
      currentCount: raceCount,
      maxRaces: limits.maxRaces === Infinity ? null : limits.maxRaces,
      remaining,
      tier,
      isGuest,
      promptUpgrade: () => promptUpgrade('unlimited_races', 'race_limit'),
    };
  }, [tier, isGuest, promptUpgrade]);

  return {
    checkFeature,
    checkRaceLimit,
    tier,
    tierSource,
    isGuest,
    isFree,
    isBasic,
    isPro,
    isTrialing,
    isOrgSponsored,
    tierName,
    promptUpgrade,
    promptSignUp,
  };
}

/**
 * Convenience hook for checking a single feature
 */
export function useFeatureCheck(feature: GatedFeature): FeatureGateResult {
  const { checkFeature } = useFeatureGate();
  return checkFeature(feature);
}

/**
 * Convenience hook for checking race limits
 */
export function useRaceLimitCheck(raceCount: number): RaceLimitResult {
  const { checkRaceLimit } = useFeatureGate();
  return checkRaceLimit(raceCount);
}

export default useFeatureGate;
