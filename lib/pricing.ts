/**
 * Localized subscription price points.
 *
 * These are region-specific price *tiers* (the way App Store / Play tiers work),
 * not live FX conversions of the USD price — purchasing power differs by market,
 * so each region gets its own round number. Resolved from the device region.
 */

import * as Localization from 'expo-localization';

export interface PlanPricing {
  /** Monthly Plus price, formatted with its currency symbol (e.g. "$9", "₹299"). */
  plus: string;
  /** Monthly Pro price, formatted with its currency symbol (e.g. "$10", "₹799"). */
  pro: string;
}

const DEFAULT_PRICING: PlanPricing = { plus: '$9', pro: '$10' };

/** Region code (ISO 3166-1 alpha-2) → price tier. */
const PRICING_BY_REGION: Record<string, PlanPricing> = {
  IN: { plus: '₹299', pro: '₹799' },
};

/**
 * Best-effort device region. expo-localization exposes `regionCode` on the
 * primary locale; fall back to a Hindi language hint for India when the region
 * is absent (common on emulators / web).
 */
function getDeviceRegion(): string | null {
  try {
    const locales = Localization.getLocales();
    const primary = locales?.[0];
    if (primary?.regionCode) return primary.regionCode.toUpperCase();
    if (primary?.languageCode?.toLowerCase() === 'hi') return 'IN';
  } catch {
    // Fall through to default pricing.
  }
  return null;
}

/** Localized Plus/Pro monthly price points for the current device region. */
export function getLocalizedPricing(): PlanPricing {
  const region = getDeviceRegion();
  return (region && PRICING_BY_REGION[region]) || DEFAULT_PRICING;
}
