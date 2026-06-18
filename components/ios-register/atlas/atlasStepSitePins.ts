/**
 * atlasStepSitePins — frame-agnostic predicates over Atlas pins and located
 * steps. (Named distinctly from the AtlasPins.tsx visual-component module so
 * the two don't collide on case-insensitive filesystems.)
 *
 * Pure (no React, no frame state) so both AtlasScreen and the step↔site
 * cross-link hook can share one definition of "is this a my-step pin", "is
 * this a site a step can sit inside", and the fold grain that ties them.
 */

import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';
import type { PickerStep } from '@/hooks/useUserAtlasSteps';

/** The five my-step pin kinds — a tapped one opens the YOUR STEP callout. */
export function isUserStepPin(pin: AtlasPinSpec): boolean {
  return (
    pin.kind === 'my-step-next' ||
    pin.kind === 'my-step-planned' ||
    pin.kind === 'my-step-done-just' ||
    pin.kind === 'my-step-done-recent' ||
    pin.kind === 'my-step-done-old'
  );
}

/** Person-kind POIs aren't "sites" a step can be anchored inside. */
const PERSON_POI_KINDS = new Set<AtlasPinSpec['kind']>([
  'poi-preceptor',
  'poi-mentee',
  'poi-home-anchor',
]);

/** A place pin a step can stand inside (hospital, sim lab, club…). */
export function isSitePoiPin(pin: AtlasPinSpec): boolean {
  return pin.id.startsWith('poi:') && !PERSON_POI_KINDS.has(pin.kind);
}

/** Cheap planar km between two lat/lng points — accurate enough at site scale. */
export function approxKmBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * A step's where-anchor and the site POI it sits at are two pins that read
 * as dead ends without a bridge — the YOUR STEP callout offers "View site"
 * and the site callout lists the viewer's steps there. Both ends fold by the
 * same ~300m grain useAtlasFramePins uses, padded slightly so a coord that
 * drifted off the POI centroid still resolves.
 */
export const STEP_SITE_LINK_KM = 0.4;

/** Picker-step status → the short note StackedStepList renders. */
export function stepStatusNote(status: PickerStep['status']): string {
  return status.startsWith('done') ? 'Done' : 'Planned';
}

/**
 * The viewer's steps anchored at a single site anchor (a racing-area polygon
 * or any POI not rendered as a framePin). A step matches when its where-anchor
 * poi_id equals the anchor's id (exact site identity), or — for coord-only
 * steps — when it sits within the fold grain of the anchor centroid.
 *
 * Unlike the framePin path there's no nearest-of-all-sites guard: the user has
 * explicitly opened THIS site, and racing zones sit far enough apart that a
 * lone proximity test doesn't cross-contaminate the way clustered campus POIs
 * (~150m) do. Returns StackedStepList rows, deduped, in input order.
 */
export function stepsAtSiteAnchor(
  steps: PickerStep[],
  anchor: { id: string; lat: number | null; lng: number | null },
): NonNullable<AtlasPinSpec['stackedSteps']> {
  const seen = new Set<string>();
  const out: NonNullable<AtlasPinSpec['stackedSteps']> = [];
  for (const s of steps) {
    if (seen.has(s.step_id)) continue;
    const matches = s.poi_id
      ? s.poi_id === anchor.id
      : s.lat != null &&
        s.lng != null &&
        anchor.lat != null &&
        anchor.lng != null &&
        approxKmBetween({ lat: s.lat, lng: s.lng }, { lat: anchor.lat, lng: anchor.lng }) <=
          STEP_SITE_LINK_KM;
    if (!matches) continue;
    seen.add(s.step_id);
    out.push({
      stepId: s.step_id,
      title: s.title?.trim() || 'Untitled step',
      statusNote: stepStatusNote(s.status),
    });
  }
  return out;
}
