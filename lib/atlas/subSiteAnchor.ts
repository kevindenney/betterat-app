/**
 * Sub-site ("place within a place") anchoring — the data layer for binding a
 * step to a specific feature *inside* its site: a golf hole, a market stall,
 * the floor/ward of a hospital. See docs/redesign/specs/ATLAS_HOLE_ANCHORING_SPEC.md.
 *
 * We deliberately reuse the existing StepLocation.level_label / level_index
 * primitive (authored for hospital wards but never wired) rather than inventing
 * a parallel sub_site field. A sub-site anchor is therefore additive metadata
 * on the step's existing where_location — the site poi_id / coords are
 * untouched, so every reader that resolves a step to its site keeps working.
 */

import type { StepLocation } from '@/types/step-detail';

export type SubSiteMode = 'numeric' | 'text';

export interface SubSiteConfig {
  /** Singular noun for one unit inside the site — "Hole", "Stall". */
  unit: string;
  /** numeric → a fixed grid of N choices; text → a free-text label. */
  mode: SubSiteMode;
  /** For numeric mode: how many units the site has (golf course = 18). */
  count?: number;
  /** Sheet/section prompt, e.g. "Which hole?". */
  prompt: string;
  /** Label for the "no specific unit / whole site" choice. */
  wholeSiteLabel: string;
}

/**
 * Which interests expose a sub-site dimension, and how it's picked. Returns
 * null for interests where a step anchors to the site as a whole (the pin is
 * already the right granularity) — those show no sub-site UI at all.
 */
export function subSiteConfigForInterest(slug?: string | null): SubSiteConfig | null {
  const s = (slug ?? '').toLowerCase();
  if (!s) return null;
  if (s.includes('golf')) {
    return {
      unit: 'Hole',
      mode: 'numeric',
      count: 18,
      prompt: 'Which hole?',
      wholeSiteLabel: 'Whole course',
    };
  }
  if (s.includes('entrepreneur') || s.includes('business') || s.includes('market')) {
    return {
      unit: 'Stall',
      mode: 'text',
      prompt: 'Which stall or block?',
      wholeSiteLabel: 'Whole market',
    };
  }
  return null;
}

export interface SubSiteAnchor {
  /** Human label stored on the location — "Hole 7", "Block C". */
  label: string;
  /** Numeric index when the unit is numbered (golf hole). */
  index?: number;
}

/** Read the sub-site anchor off a location, or null when none is set. */
export function readSubSiteAnchor(location?: StepLocation | null): SubSiteAnchor | null {
  const label = location?.level_label?.trim();
  if (!label) return null;
  return { label, index: location?.level_index };
}

/**
 * Apply (or clear) a sub-site anchor on a location, returning a new location.
 * Passing null clears it. The site identity (name/coords/poi_id) is preserved.
 */
export function withSubSiteAnchor(
  location: StepLocation,
  anchor: SubSiteAnchor | null,
): StepLocation {
  if (!anchor) {
    const { level_label: _l, level_index: _i, ...rest } = location;
    return rest;
  }
  return { ...location, level_label: anchor.label, level_index: anchor.index };
}

/** Build a numbered anchor for numeric configs, e.g. (golf, 7) → "Hole 7". */
export function numericSubSiteAnchor(config: SubSiteConfig, index: number): SubSiteAnchor {
  return { label: `${config.unit} ${index}`, index };
}
