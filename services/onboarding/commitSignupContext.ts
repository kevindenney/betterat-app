/**
 * commitSignupContext
 *
 * Single entry point for persisting post-signup nav/data hints across email
 * and OAuth paths. Replaces three near-identical AsyncStorage blocks in
 * `app/(auth)/signup.tsx` (handleSignUp, handleGoogleSignUp, handleAppleSignUp)
 * and the read+commit step in `app/(auth)/callback.tsx`.
 *
 * Source-of-truth rules (per onboarding plan §4 Step 1 + D2):
 * - `onboarding_interest_slug` → DB `user_interests` is the data of record.
 *   AsyncStorage is dual-written for one release while display readers
 *   (trial-activation, privacy-quick-set, org-welcome, etc.) migrate to
 *   `useInterests()`/`user_interests`.
 * - `onboarding_org_slug` and `post_onboarding_return_to` → AsyncStorage only.
 *   These remain transient nav hints; nothing commits them to DB.
 * - `pending_invite_token` → deleted. The audit (d2-asyncstorage-onboarding-
 *   audit.md §2.4) confirmed zero readers. Invite acceptance is driven by
 *   `router.replace('/invite/[token]')` directly from signup.tsx.
 *
 * The DB write is idempotent (`upsert ... on conflict do nothing`) so repeated
 * signup clicks won't double-insert.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import {
  getBlueprintById,
  getBlueprintBySlug,
  subscribe as subscribeToBlueprint,
} from '@/services/BlueprintService';

const logger = createLogger('commitSignupContext');

export const ONBOARDING_INTEREST_SLUG_KEY = 'onboarding_interest_slug';
export const ONBOARDING_ORG_SLUG_KEY = 'onboarding_org_slug';
export const POST_ONBOARDING_RETURN_TO_KEY = 'post_onboarding_return_to';
/**
 * Slug or UUID of a published blueprint shared via deep link
 * (?blueprint=<slug-or-id>). When a userId is also present we create the
 * blueprint_subscriptions row right after auth so the user lands inside the
 * app already subscribed (per onboarding plan §4 Step 3).
 */
export const ONBOARDING_BLUEPRINT_KEY = 'onboarding_blueprint_ref';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SignupContextInput {
  /** If present, the interest is also committed to `user_interests` right now. */
  userId?: string | null;
  interestSlug?: string | null;
  orgSlug?: string | null;
  returnTo?: string | null;
  /** Slug or UUID of a published blueprint to auto-subscribe to post-auth. */
  blueprintRef?: string | null;
}

export interface SignupContextResult {
  /** True when interest write to user_interests succeeded (or no commit attempted). */
  interestCommitted: boolean;
  /** Why the DB commit was skipped or failed. Undefined on success. */
  interestSkipReason?: 'no-user-id' | 'no-slug' | 'unknown-slug' | 'db-error';
  /** True when blueprint subscription was created (or already existed). */
  blueprintCommitted?: boolean;
  /** Why the blueprint subscribe was skipped or failed. Undefined on success. */
  blueprintSkipReason?: 'no-user-id' | 'no-ref' | 'unknown-ref' | 'db-error';
}

function normalizeSlug(slug: string | null | undefined): string {
  return (slug ?? '').trim().toLowerCase();
}

/**
 * Persist signup context to AsyncStorage and (when a userId is known) commit
 * the chosen interest to the DB. Safe to call from email signup, OAuth dispatch
 * (no userId yet), and post-OAuth callback (userId now known).
 */
export async function commitSignupContext(
  input: SignupContextInput,
): Promise<SignupContextResult> {
  const slug = normalizeSlug(input.interestSlug);
  const orgSlug = input.orgSlug?.trim() ?? '';
  const returnTo = input.returnTo?.trim() ?? '';
  const blueprintRef = input.blueprintRef?.trim() ?? '';

  // Dual-write AsyncStorage. Existing display readers still depend on these.
  if (slug) {
    await AsyncStorage.setItem(ONBOARDING_INTEREST_SLUG_KEY, slug);
  }
  if (orgSlug) {
    await AsyncStorage.setItem(ONBOARDING_ORG_SLUG_KEY, orgSlug);
  }
  if (returnTo) {
    await AsyncStorage.setItem(POST_ONBOARDING_RETURN_TO_KEY, returnTo);
  }
  if (blueprintRef) {
    await AsyncStorage.setItem(ONBOARDING_BLUEPRINT_KEY, blueprintRef);
  }

  const interestResult: SignupContextResult = !input.userId
    ? { interestCommitted: false, interestSkipReason: 'no-user-id' }
    : !slug
      ? { interestCommitted: false, interestSkipReason: 'no-slug' }
      : await commitOnboardingInterest(input.userId, slug);

  // Best-effort blueprint subscribe. Failures here must not block signup
  // navigation — the user can resubscribe in-app.
  let blueprintCommitted: boolean | undefined;
  let blueprintSkipReason: SignupContextResult['blueprintSkipReason'];
  if (blueprintRef) {
    if (!input.userId) {
      blueprintCommitted = false;
      blueprintSkipReason = 'no-user-id';
    } else {
      const sub = await commitOnboardingBlueprint(input.userId, blueprintRef);
      blueprintCommitted = sub.blueprintCommitted;
      blueprintSkipReason = sub.blueprintSkipReason;
    }
  }

  return {
    ...interestResult,
    ...(blueprintCommitted !== undefined ? { blueprintCommitted } : {}),
    ...(blueprintSkipReason ? { blueprintSkipReason } : {}),
  };
}

/**
 * Write the chosen interest to `user_interests`. Idempotent.
 *
 * Exposed separately so the OAuth callback (which doesn't have the slug in
 * memory, only in AsyncStorage) can call it directly without redoing the
 * AsyncStorage dual-write.
 */
export async function commitOnboardingInterest(
  userId: string,
  slug: string,
): Promise<SignupContextResult> {
  const normalized = normalizeSlug(slug);
  if (!normalized) {
    return { interestCommitted: false, interestSkipReason: 'no-slug' };
  }

  const { data: interest, error: lookupError } = await supabase
    .from('interests')
    .select('id, slug')
    .eq('slug', normalized)
    .maybeSingle();

  if (lookupError) {
    logger.warn('Failed to look up interest by slug', {
      slug: normalized,
      message: lookupError.message,
    });
    return { interestCommitted: false, interestSkipReason: 'db-error' };
  }

  if (!interest) {
    logger.warn('Interest slug not found in catalog', { slug: normalized });
    return { interestCommitted: false, interestSkipReason: 'unknown-slug' };
  }

  const { error: upsertError } = await supabase
    .from('user_interests')
    .upsert(
      { user_id: userId, interest_id: interest.id },
      { onConflict: 'user_id,interest_id' },
    );

  if (upsertError) {
    logger.warn('Failed to upsert user_interests', {
      userId,
      slug: normalized,
      message: upsertError.message,
    });
    return { interestCommitted: false, interestSkipReason: 'db-error' };
  }

  return { interestCommitted: true };
}

/**
 * Resolve a slug-or-UUID and create the blueprint_subscriptions row.
 * Idempotent (BlueprintService.subscribe upserts on `blueprint_id,subscriber_id`).
 * Reused by the OAuth callback after the session settles.
 */
export async function commitOnboardingBlueprint(
  userId: string,
  ref: string,
): Promise<Pick<SignupContextResult, 'blueprintCommitted' | 'blueprintSkipReason'>> {
  const trimmed = ref.trim();
  if (!trimmed) {
    return { blueprintCommitted: false, blueprintSkipReason: 'no-ref' };
  }

  try {
    let blueprintId: string | null = null;
    if (UUID_RE.test(trimmed)) {
      const found = await getBlueprintById(trimmed);
      blueprintId = found?.id ?? null;
    } else {
      const found = await getBlueprintBySlug(trimmed);
      blueprintId = found?.id ?? null;
    }

    if (!blueprintId) {
      logger.warn('Blueprint ref not found in catalog', { ref: trimmed });
      return { blueprintCommitted: false, blueprintSkipReason: 'unknown-ref' };
    }

    await subscribeToBlueprint(userId, blueprintId);
    return { blueprintCommitted: true };
  } catch (err) {
    logger.warn('Failed to subscribe to blueprint during onboarding', {
      userId,
      ref: trimmed,
      err: (err as Error)?.message,
    });
    return { blueprintCommitted: false, blueprintSkipReason: 'db-error' };
  }
}
