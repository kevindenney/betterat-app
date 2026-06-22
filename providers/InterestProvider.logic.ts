const EXISTING_PROFILE_AGE_THRESHOLD_MS = 5 * 60 * 1000;

function isValidDateValue(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function hasExistingProfileSignal(profile: any): boolean {
  if (!profile || typeof profile !== 'object') return false;

  if (profile.onboarding_completed === true) return true;

  const createdAt = profile.created_at;
  const hasStableProfileData = !!(profile.full_name || profile.avatar_url || profile.bio || profile.club_id);

  if (isValidDateValue(createdAt) && hasStableProfileData) {
    const ageMs = Date.now() - Date.parse(createdAt);
    return ageMs >= EXISTING_PROFILE_AGE_THRESHOLD_MS;
  }

  return false;
}

export function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function selectExplicitInterestFromSignals<T extends {slug: string}>({
  profile,
  metadata,
  interests,
}: {
  profile: unknown;
  metadata: Record<string, unknown>;
  interests: T[];
}): T | null {
  const profileSlugCandidates = [
    normalizeSlug((profile as any)?.active_interest_slug),
    normalizeSlug((profile as any)?.interest_slug),
    normalizeSlug((profile as any)?.primary_interest_slug),
    normalizeSlug((profile as any)?.preferred_interest_slug),
  ].filter((value): value is string => !!value);

  const metadataSlugCandidates = [
    normalizeSlug(metadata.active_interest_slug),
    normalizeSlug(metadata.interest_slug),
  ].filter((value): value is string => !!value);

  return [...profileSlugCandidates, ...metadataSlugCandidates]
    .map((slug) => interests.find((interest) => interest.slug === slug))
    .find((interest): interest is T => !!interest) ?? null;
}

export function selectDefaultInterestForExistingUser<T extends {slug: string}>({
  userInterests,
  interests,
}: {
  userInterests: T[];
  interests: T[];
}): T | null {
  return (
    (userInterests.length > 0 ? userInterests[0] : null) ??
    interests.find((interest) => interest.slug === 'sail-racing') ??
    interests[0] ??
    null
  );
}
