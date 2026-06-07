/**
 * Livelihood / micro-enterprise interests (rural-entrepreneur personas).
 *
 * These users live in Telegram and capture their day by voice note, so the
 * core capture loop is intentionally NOT paywalled for them — see the tier
 * gate in `executeTool` (lib/telegram/tools.ts) which honors
 * `AuthContext.captureEntitled`, set by `resolveAuthContext` when the user has
 * an active interest in this set.
 *
 * Single source of truth, mirrored from the "Livelihoods & Enterprise" domain
 * in `lib/landing/sampleData` INTEREST_DOMAINS. Kept dependency-free so the
 * Vercel `api/` tree can import it relatively (no `@/` alias there).
 */
export const LIVELIHOOD_INTEREST_SLUGS = [
  'lac-craft-business',
  'food-processing',
  'textile-weaving',
] as const;

export type LivelihoodInterestSlug = (typeof LIVELIHOOD_INTEREST_SLUGS)[number];

export function isLivelihoodSlug(slug: string | null | undefined): boolean {
  return !!slug && (LIVELIHOOD_INTEREST_SLUGS as readonly string[]).includes(slug);
}
