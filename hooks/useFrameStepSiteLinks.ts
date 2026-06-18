/**
 * useFrameStepSiteLinks — the step↔site cross-link for any Atlas frame.
 *
 * A step's where-anchor pin and the site POI it sits inside read as dead ends
 * on their own. This hook bridges them, frame-agnostically:
 *   - siteForSelectedStep   — the site the selected step sits at (for a
 *                             "View <site>" jump on the YOUR STEP callout)
 *   - myStepsAtSelectedPoi  — the viewer's steps anchored at the selected
 *                             site (for the site callout's "steps here" list)
 *   - openStepById          — focus + select a step by id (drives that list)
 *
 * Matching is by the step's anchored poi_id first (exact site identity), with
 * a nearest-POI proximity fallback for legacy coord-only steps. poi_id beats
 * geometry because adjacent campus POIs can sit within ~100m of each other.
 *
 * Nursing (FrameF4) is the first consumer; sailing/entrepreneur frames adopt
 * it by passing their own pins + located steps. Nothing here is nursing-aware.
 */

import { useCallback, useMemo } from 'react';

import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';
import {
  approxKmBetween,
  isSitePoiPin,
  isUserStepPin,
  STEP_SITE_LINK_KM,
  stepStatusNote,
} from '@/components/ios-register/atlas/atlasPins';
import type { PickerStep } from '@/hooks/useUserAtlasSteps';

interface UseFrameStepSiteLinksArgs {
  /** All pins on the frame's map (own steps, peers, site POIs). */
  framePins: AtlasPinSpec[];
  /**
   * The frame's full located step set (picker + archive). Drawn from here
   * rather than the arc-scoped map pins so older work still resolves.
   */
  steps: PickerStep[];
  /** The currently selected pin, or null. */
  selectedPin: AtlasPinSpec | null;
  /** Select a pin (opens its callout). */
  setSelectedPin: (pin: AtlasPinSpec) => void;
  /** Fly the map to a coordinate. */
  onFocusLocation: (loc: { lat: number; lng: number }) => void;
  /** Last-resort when a step has no pin and no coords — open its detail. */
  onStepPress?: (stepId: string) => void;
}

export function useFrameStepSiteLinks({
  framePins,
  steps,
  selectedPin,
  setSelectedPin,
  onFocusLocation,
  onStepPress,
}: UseFrameStepSiteLinksArgs) {
  // Open a step's YOUR STEP callout by id — prefers the real frame pin, falls
  // back to a synthesized pin from the located-step coords, and last-resorts
  // to the live step screen. Drives the site callout's "steps here" list.
  const openStepById = useCallback(
    (stepId: string) => {
      const real = framePins.find(
        (p) => p.stepId === stepId && isUserStepPin(p) && !p.stackedSteps,
      );
      if (real) {
        onFocusLocation({ lat: real.lat, lng: real.lng });
        setSelectedPin(real);
        return;
      }
      const step = steps.find((s) => s.step_id === stepId);
      if (step && step.lat != null && step.lng != null) {
        onFocusLocation({ lat: step.lat, lng: step.lng });
        setSelectedPin({
          id: `step-picker:${step.step_id}`,
          kind: 'my-step-planned',
          stepId: step.step_id,
          label: step.title,
          subtitle: step.location_name ?? undefined,
          lat: step.lat,
          lng: step.lng,
        });
        return;
      }
      onStepPress?.(stepId);
    },
    [framePins, steps, setSelectedPin, onFocusLocation, onStepPress],
  );

  // CROSS-LINK A — the site POI the selected step sits inside, so the YOUR
  // STEP callout can offer a "View site" jump. Matches by the step's anchored
  // poi_id first (exact site identity); only steps with no poi_id fall back to
  // the nearest place pin within the fold grain.
  const siteForSelectedStep = useMemo<AtlasPinSpec | null>(() => {
    if (!selectedPin || !isUserStepPin(selectedPin)) return null;
    const step = steps.find((s) => s.step_id === selectedPin.stepId);
    if (step?.poi_id) {
      return framePins.find((p) => isSitePoiPin(p) && p.id === `poi:${step.poi_id}`) ?? null;
    }
    let best: { pin: AtlasPinSpec; d: number } | null = null;
    for (const p of framePins) {
      if (!isSitePoiPin(p)) continue;
      const d = approxKmBetween(selectedPin, p);
      if (d <= STEP_SITE_LINK_KM && (!best || d < best.d)) best = { pin: p, d };
    }
    return best?.pin ?? null;
  }, [selectedPin, framePins, steps]);

  // CROSS-LINK B — the viewer's steps anchored at the selected site POI, so the
  // site callout lists them ("3 of your steps · NG tube, Cardiac, H2T"). A step
  // with a poi_id only counts here when it points at THIS site; poi_id-less
  // steps fall back to proximity (nearest-POI, mirroring useAtlasFramePins).
  const myStepsAtSelectedPoi = useMemo<NonNullable<AtlasPinSpec['stackedSteps']>>(() => {
    if (!selectedPin || !isSitePoiPin(selectedPin)) return [];
    const targetPoiId = selectedPin.id.slice('poi:'.length);
    const sitePins = framePins.filter(isSitePoiPin);
    // For a poi_id-less step, claim it only when THIS site is its nearest
    // place pin — otherwise clustered campus POIs (~150m apart) each list the
    // same coord-only step.
    const nearestSiteIsSelected = (s: { lat: number; lng: number }): boolean => {
      let best: { id: string; d: number } | null = null;
      for (const p of sitePins) {
        const d = approxKmBetween(s, p);
        if (!best || d < best.d) best = { id: p.id, d };
      }
      return best != null && best.id === selectedPin.id && best.d <= STEP_SITE_LINK_KM;
    };
    const seen = new Set<string>();
    const out: NonNullable<AtlasPinSpec['stackedSteps']> = [];
    for (const s of steps) {
      if (seen.has(s.step_id)) continue;
      const matches = s.poi_id
        ? s.poi_id === targetPoiId
        : s.lat != null && s.lng != null && nearestSiteIsSelected({ lat: s.lat, lng: s.lng });
      if (!matches) continue;
      seen.add(s.step_id);
      out.push({
        stepId: s.step_id,
        title: s.title?.trim() || 'Untitled step',
        statusNote: stepStatusNote(s.status),
      });
    }
    return out;
  }, [selectedPin, framePins, steps]);

  return { openStepById, siteForSelectedStep, myStepsAtSelectedPoi };
}
