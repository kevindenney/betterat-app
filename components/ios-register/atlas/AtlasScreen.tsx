/**
 * AtlasScreen — canonical Atlas tab surface with six frame variants.
 *
 * Atlas is BetterAt's fifth lens: "where." The unit is a locatable step
 * and the people doing them; the surface is one shell with a registered
 * layer system that lets each interest opt into bespoke layers (race
 * marks for sailing, healthcare POIs for nursing, curated sites for
 * partner institutions).
 *
 * This screen renders the six canonical frames from the design handoff:
 *   F1 — Felix · first-run · Causeway Bay overview (sailing template)
 *   F2 — Felix · race-marks at zoom 14+
 *   F3 — Felix · world Dragon (class-lens cross-fleet)
 *   F4 — Emily · Baltimore cold (nursing template, no JHU curation)
 *   F5 — Emily · JHU curated (institution.curated_sites layer live)
 *   F6 — commit-mode (opened from Plan tab's Where field)
 *
 * Wire-up status:
 *   Sample data drawn directly from the design handoff. The actual
 *   MapLibre canvas, atlas_pois schema, peer-steps RPC, healthcare
 *   content lint, and Cohort materialized view are Phase A1
 *   foundation work — see docs/redesign/ios-register/atlas-tab-brief.md.
 *
 * Architectural commitments (from the brief's side rail):
 *   - Universal empty-state formula across all interests (5 lines)
 *   - Pins are steps; venues/marks/sites are decorative layers
 *   - Privacy is per-interest, with hard healthcare floor at site level
 *   - No real-time presence; no patient-identifiable text
 *   - Cross-interest is a chip on the filter row, not a profile setting
 *   - Next-event glow is the only Atlas accent that uses amber
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, LayoutChangeEvent, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useAuth } from '@/providers/AuthProvider';
import { SIDEBAR_PIN_BREAKPOINT, useWebDrawer } from '@/providers/WebDrawerProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  HongKongOverviewMap,
  RaceMarksZoomMap,
  WorldDragonMap,
  JhuCuratedMap,
  CommitHarbourMap,
} from './AtlasMaps';
import {
  AtlasMapLibreCanvas,
  type AtlasBasemap,
  type AtlasPinSpec,
  type AtlasPeerMember,
  type AtlasRacingAreaPressTarget,
} from './AtlasMapLibreCanvas';
import { CreateRacingAreaSheet } from './CreateRacingAreaSheet';
import { PlaceKnowledgeSection } from '@/components/venue/PlaceKnowledgeSection';
import type { CurrentConditions } from '@/types/community-feed';
import { CreateRaceCourseSheet } from './CreateRaceCourseSheet';
import { CourseStrategyCard, strategyHeadline } from './CourseStrategyCard';
import { RaceTimeBar } from './RaceTimeBar';
import { compassFromDegrees } from './VenueMasterySheet';
import { deriveCourseStrategy, type CourseStrategy } from '@/lib/courseStrategy';
import { useShoreSide } from '@/hooks/useShoreSide';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';
import { AtlasSearchSheet, type AtlasSearchResult } from './AtlasSearchSheet';
import { supabase } from '@/services/supabase';
import { OpenStepPicker, type ClinicalSiteItem } from './OpenStepPicker';
import { useNursingLoggedSites } from '@/hooks/useNursingLoggedSites';
import { useAtlasPois } from '@/hooks/useAtlasPois';
import { ManageRacingAreasSheet, type ManageAreasEditTarget } from './ManageRacingAreasSheet';
import type { EditingRacingArea } from './CreateRacingAreaSheet';
import { RepositionAreaBanner } from './RepositionAreaBanner';
import { RetraceAreaBanner } from './RetraceAreaBanner';
import { ReshapeAreaBanner } from './ReshapeAreaBanner';
import { useUpdateRacingArea } from '@/hooks/useUpdateRacingArea';
import { useUpdateStepLocation } from '@/hooks/useUpdateStepLocation';
import { useStepLocationSuggestions } from '@/hooks/useStepLocationSuggestions';
import { useMyRacingAreas } from '@/hooks/useMyRacingAreas';
import { circlePolygon } from '@/hooks/useAtlasRacingAreas';
import { useSavedVenues } from '@/hooks/useSavedVenues';
import {
  SavedJumpSheet,
  type ArcStepGroup,
  type ArcStepEntry,
  type SavedPlaceItem,
  type RelationshipStepItem,
  type PeerRelationship,
  type AnchorRect,
} from './SavedJumpSheet';
import { shapeToPolygon } from '@/lib/atlas-racing-area-shape';
import type { ArchivePickerStep, PickerStep } from '@/hooks/useUserAtlasSteps';
import { isUserStepPin, stepsAtSiteAnchor } from '@/components/ios-register/atlas/atlasStepSitePins';
import { useFrameStepSiteLinks } from '@/hooks/useFrameStepSiteLinks';
import { useUserSeasons, useCurrentSeason } from '@/hooks/useSeason';
import { compareSeasonsByStartDate } from '@/components/ios-register/timeline-zoom/realDataAdapter';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useInterest } from '@/providers/InterestProvider';
import { getAtlasNextEventLabel, getVisibilityLabels } from '@/lib/vocabulary';
import { InterestSwitcher, openInterestSwitcher } from '@/components/InterestSwitcher';
import { useUniversalPlus } from '@/components/capture';
import { useUserAffinityGroups, affinityGroupTone, type UserAffinityGroup } from '@/hooks/useUserAffinityGroups';
import { useAffinityGroupMembers } from '@/hooks/useAffinityGroupMembers';
import { useAtlasFramePins } from '@/hooks/useAtlasFramePins';
import { useAtlasSeriesRaces } from '@/hooks/useAtlasSeriesRaces';
import { useAtlasCockpitStep, type AtlasCockpitStep, type CockpitBeat, type CockpitSubStep } from '@/hooks/useAtlasCockpitStep';
import {
  parseLivelihoodSaleText,
  useLivelihoodAtlas,
  useLogLivelihoodLedgerEntry,
  type HaatCalendar,
  type LivelihoodHealth,
  type LivelihoodLedgerEntry,
  type LogLivelihoodEntryInput,
} from '@/hooks/useLivelihoodAtlas';
import {
  useLivelihoodMentorAtlas,
  type MentorCohortSummary,
  type MentorDidi,
  type MentorDidiStatus,
} from '@/hooks/useLivelihoodMentorAtlas';
import { useNearestPlace, formatNearLabel } from '@/hooks/useNearestPlace';
import { useMarineSnapshot, useMarineTrendWindow, conditionsLineFor, type MarineTrendPoint } from '@/hooks/useMarineSnapshot';
import { useVenueRaceWindow, detectTideFlip } from '@/hooks/useVenueRaceWindow';
import { useFleetVenueStats } from '@/hooks/useFleetVenueStats';
import { useVenueRecord } from '@/hooks/useVenueRecord';
import { useHKOObservations, isInHongKong } from '@/hooks/useHKOObservations';
import { useWindOverlay } from '@/hooks/useWindOverlay';
import { useTideOverlay } from '@/hooks/useTideOverlay';
import { useWaveOverlay } from '@/hooks/useWaveOverlay';
import { useNextRaceMarks } from '@/hooks/useNextRaceMarks';
import { NursingSitesSurface } from '@/components/ios-register/atlas/NursingSitesSurface';
import { NursingCoverageSurface } from '@/components/ios-register/atlas/NursingCoverageSurface';
import { InterestSitesSurface } from '@/components/ios-register/atlas/InterestSitesSurface';
import { CapabilitiesSurface } from '@/components/ios-register/atlas/CapabilitiesSurface';
import { NursingMapSurface } from '@/components/ios-register/atlas/NursingMapSurface';
import {
  NursingSiteDetailSurface,
  type NursingSiteDetailTarget,
} from '@/components/ios-register/atlas/NursingSiteDetailSurface';
import { LogShiftSheet, type LogShiftSite } from '@/components/ios-register/atlas/LogShiftSheet';
import { VenueMasterySheet } from '@/components/ios-register/atlas/VenueMasterySheet';
import {
  YACHT_CLUB_DEMO_LOCATION,
  YACHT_CLUB_DEMO_NAME,
  isYachtClubDemoSlug,
} from '@/services/YachtClubDemoService';
import {
  AtlasPin,
  ClusterTag,
  GhostStampOverlay,
  NextEventTag,
  RacingAreaTag,
} from './AtlasPins';
import { GolfAtlasSurface } from './GolfAtlasSurface';

export type AtlasFrameId = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' | 'f9';

/** Phase N.4 — royal blue for the "Races" filter dot, matching the ⛵ pin. */
const RACE_FILTER_DOT = '#0E7490';
const STEP_FILTER_DOT = '#2563EB';
// Last-viewed f1 camera ({lat, lng, zoom}) — Atlas reopens here instead of
// flying to the next step, matching maps-app spatial stability.
const ATLAS_F1_LAST_CAMERA_KEY = 'atlas:f1:last-camera';
// Last explicit Atlas step selection. Used only to restore a user's previous
// Atlas context; Atlas should not auto-open the generic NEXT step on cold load.
const ATLAS_F1_LAST_STEP_KEY = 'atlas:f1:last-step-id';

/**
 * Stub for unwired CTAs. Tells the user what the action WILL do once
 * built, rather than silently bouncing them to the wrong tab. Honest
 * placeholder until the real surface (profile page, reach-out sheet,
 * step detail navigator) lands.
 */
function comingSoonAlert(action: string, futureBlurb: string): void {
  showAlert(`${action} · Coming soon`, futureBlurb);
}

function logAtlasDebug(scope: string, payload: Record<string, unknown>) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[AtlasDebug:${scope}]`, JSON.stringify(payload));
}

function openOrganizationPin(
  pin: AtlasPinSpec,
  onOrgPress?: (orgSlug: string) => void,
): void {
  if (pin.orgSlug && onOrgPress) {
    onOrgPress(pin.orgSlug);
    return;
  }
  comingSoonAlert(
    'Open organization',
    'This place is not linked to a claimed BetterAt organization yet. Once claimed, this pin will open the club or institution page.',
  );
}

function openClubLens(
  pin: AtlasPinSpec,
  onOrgLensPress?: (orgSlug: string) => void,
): void {
  if (pin.orgSlug && onOrgLensPress) {
    onOrgLensPress(pin.orgSlug);
    return;
  }
  comingSoonAlert(
    'Club lens',
    'This will recenter Atlas around the club and filter to that organization’s events, fleets, sailors, and public steps. Fleet-specific lenses, like RHKYC · Dragon, sit one level below this.',
  );
}

export interface AtlasNextEvent {
  /** Display label, e.g. "Race 4" or "Easter Regatta". */
  label: string;
  /** Time/date snippet, e.g. "Sat 10am". */
  when?: string;
  /** Eyebrow prefix for the amber map NEXT tag, in the persona's vocab
   *  ("NEXT RACE" for sailing, "NEXT MARKET" for entrepreneur). Defaults to
   *  "NEXT RACE" in the marker when unset. */
  eyebrow?: string;
  /** Venue/area snippet, e.g. "Victoria Harbour, favoured end".
   *  Used in the bottom-sheet body — verbose is fine here. */
  where?: string;
  /** Short wind/tide snippet for the amber map tag, e.g. "12kn ESE · ebb 0.4kn".
   *  Kept terse to fit the small overlay; if absent the tag shows only
   *  the eyebrow line. */
  conditions?: string;
  /**
   * Raw ISO start timestamp from the source row. `when` is the
   * pre-formatted display snippet; this is the machine-readable form that
   * feeds race-time forecasting (V.1 race window, tide-flip detection).
   */
  starts_at?: string;
  /**
   * atlas_pois.id (kind='racing_area') from the race step's
   * race_plan.area_id — anchors venue-mastery surfaces (record, fleet
   * stats, local knowledge) to the racing area this race runs in.
   */
  area_poi_id?: string;
  /**
   * Polymorphic event reference — when set, downstream surfaces can
   * auto-link a new Step to this Event (target_event_kind/id). The
   * Atlas amber NEXT tag also uses the source row's venue coords for
   * geographic anchoring.
   */
  event_kind?: 'regatta' | 'race_event' | 'race_step' | 'tournament' | 'competition' | 'market_day' | 'pitch';
  event_id?: string;
  /**
   * venue_race_courses.id of the course this race uses, when the source row
   * names one (sourced from the race step's race_plan.course_id). When set,
   * the Atlas NEXT marker locks to that exact course's committee boat rather
   * than guessing the nearest course by proximity.
   */
  course_id?: string;
  /**
   * seasons.id of the series this race belongs to (sourced from the race
   * step's season_id). Lets the map group sibling races sharing a course +
   * season into a "N races in {Season}" badge (Series-on-map, Commit 3).
   */
  season_id?: string;
  /**
   * Series-on-map (Commit 3): count of race steps sharing this race's
   * (course_id, season_id) and the series' display label. Set only when the
   * count is > 1, so the NEXT chip can show "N races · {Season}". The course
   * geometry is drawn once; the siblings live in the L2 timeline / Jump-to.
   */
  series_count?: number;
  series_label?: string;
  /** Venue coords from the source row when available. */
  lat?: number;
  lng?: number;
  /**
   * True when the viewing user already has a planned step tied to this
   * event (e.g. she added a "Wednesday market" step at the Khunti haat
   * POI). When true, frames flip the NEXT bottom-sheet CTA from "Plan a
   * step here" → "Open Wednesday step" so we don't suggest duplicating
   * an existing plan. Defaults to false.
   */
  has_user_step?: boolean;
  /**
   * Human-readable provenance for the bottom sheet ("From: MSN Acute
   * Care cohort · Week 6"). Rendered as a small italic line so the user
   * can trace where the NEXT pill came from — their own timeline, a
   * blueprint, the org schedule, etc. Defaults to a generic fixture
   * label when omitted (the demo case).
   */
  source_label?: string;
}

export interface AtlasFrameHandlers {
  /**
   * Bottom-sheet primary CTA — "Plan a step" / "Anchor · pick site" / in
   * commit-mode "Plan a step here". When the user is in compose-at-
   * location mode with a dropped pin, F1 forwards the candidate coords
   * so the caller can thread them into the add-step flow.
   */
  onPrimaryAction?: (pin?: {
    lat: number;
    lng: number;
    place?: string;
    suggestedTitle?: string;
    suggestedCategory?: string;
    suggestedInterestSlug?: string;
    /** Racing-area atlas_pois.id when planning prep for a venue (V.2). */
    areaPoiId?: string;
    /** ISO start of the race this prep targets — a hint, not the step's own starts_at. */
    startsAtHint?: string;
    metadata?: Record<string, unknown>;
  }) => void;
  /**
   * Capabilities segment — plan a NEW step pre-attached to a capability area as
   * its "why". Unlike onPrimaryAction this needs no map pin: the step is
   * location-less and seeded with the area's competency ids so it actually
   * evidences that capability when worked.
   */
  onPlanCapability?: (input: { category: string; competencyIds: string[] }) => void;
  /** Bottom-sheet secondary CTA — "Open <next event>" / "Skip" etc. */
  onSecondaryAction?: () => void;
  /** Open an existing timeline step surfaced as a my-step-* atlas pin. */
  onStepPress?: (stepId: string) => void;
  /**
   * Open the on-water course/marks/conditions screen for a race step — the
   * primary action on a race-pin callout (Phase N.4). Falls back to the plain
   * step surface when absent.
   */
  onOpenRaceCourse?: (stepId: string) => void;
  /** TopChrome avatar tap — routes to Profile in the live tab. */
  onAvatarPress?: () => void;
  /** Club pin tap — opens the corresponding organization page. */
  onOrgPress?: (orgSlug: string) => void;
  /** Club pin secondary action — opens the org-scoped Atlas lens. */
  onOrgLensPress?: (orgSlug: string) => void;
  /** Optional org slug for org-scoped Atlas entry. */
  focusOrgSlug?: string | null;
  /**
   * When true, FrameF1 starts already in commit-mode (drop-pin FAB active,
   * banner showing "Tap the map to drop a pin"). Atlas live tab sets this
   * when arrived via PlanWhereCard with ?fromPlan=1 so the user doesn't
   * have to tap + to enter pick-mode.
   */
  initialCommitMode?: boolean;
  /**
   * When true, FrameF1 starts with the user-defined racing-area create sheet
   * open, seeded from initialFocus when available.
   */
  initialCreateRacingArea?: boolean;
  /** Per-frame override of the top subtitle line, e.g. "Sailing · RHKYC · Hong Kong". */
  subtitleOverride?: string;
  /**
   * Real next-event data from the next_event_resolver. When provided, F1's
   * bottom sheet pre-stages composition for it ("Plan a step for <label>"
   * + "Open <label>"); when null/undefined, F1 falls back to honest
   * generic copy and hides the secondary CTA so we don't reference a
   * race that doesn't exist.
   */
  nextEvent?: AtlasNextEvent | null;
  /**
   * When provided, the MapLibre canvas flies its camera to this point on
   * mount. Used when a Plan-tab Where card pushes the user to Atlas to
   * inspect the venue ("see what's nearby"), or when an external link
   * deep-links to a specific lat/lng.
   */
  initialFocus?: { lat: number; lng: number } | null;
  /**
   * Human label for `initialFocus` (e.g. the race area name "Port shelter").
   * F6 uses it to seed the candidate pin's place + the "within … area" copy
   * so arriving from a step's race map reads as that step's area instead of
   * the hardcoded demo race.
   */
  initialFocusLabel?: string | null;
  /**
   * Viewer-owned step id to select after focusing. Used by step Plan cards so
   * Atlas opens on that race step, not the generic next-step cockpit.
   */
  initialFocusStepId?: string | null;
  /**
   * When a Nearby-list tap carries peer identity, F1 breaks that one peer out
   * of the privacy cluster: it flies to the (jittered) point, drops a single
   * highlighted pin, and opens the peer callout — so the tap lands on
   * something visible instead of the merged "+N" badge.
   */
  initialPeerFocus?: AtlasPeerMember | null;
  /** Optional initial segment inside frames that support Sites/Coverage/Map. */
  initialView?: 'map';
  /**
   * Opens the "people & sites nearby" overlay. F4 nursing passes this so
   * Nearby surfaces as a quiet TopChrome action; sailing frames keep the
   * wrapper-level floating pill and don't pass it.
   */
  onNearbyPress?: () => void;
  /**
   * True while the wrapper's full-bleed Nearby list overlay covers the map.
   * F1 watches this to drop any in-progress reposition/retrace mode — the
   * editing banner has no map to tap and no reachable Cancel once the list
   * is on top, so it would otherwise leak onto a surface it can't act on.
   */
  nearbyOverlayOpen?: boolean;
  avatarInitial?: string;
  useMapLibre?: boolean;
  bottomSheetOffset?: number;
}

interface AtlasScreenProps extends Omit<AtlasFrameHandlers, 'initialCommitMode'> {
  frame: AtlasFrameId;
  /** Forwarded to FrameF1 — see AtlasFrameHandlers.initialCommitMode. */
  initialCommitMode?: boolean;
  /**
   * When true (default false), the mock iOS status bar and mock 5-tab bar
   * are suppressed. Used when AtlasScreen renders inside the real tab
   * navigator at /(tabs)/atlas — the OS provides the status bar and the
   * FloatingTabBar provides the tab bar.
   */
  embedded?: boolean;
  /**
   * Single-letter avatar shown in the top-right of the frame. When
   * omitted, each frame keeps its canonical persona initial ("F" for
   * Felix-sailing frames, "E" for Emily-nursing). Live tab passes the
   * signed-in user's initial.
   */
  avatarInitial?: string;
  /**
   * When true, render the real MapLibre tile canvas instead of the
   * static SVG illustration. Pins and overlays still come from the SAME
   * absolute-positioned components, layered ABOVE the tile canvas — the
   * SVG geography moves to the tile layer but the pin grammar is shared.
   * The /atlas-ios preview keeps this false so the canonical handoff
   * stays pixel-for-pixel.
   */
  useMapLibre?: boolean;
  /**
   * Distance in pixels to lift the absolute-positioned BottomSheet so it
   * clears the FloatingTabBar at the device bottom. Passed in by the live
   * /(tabs)/atlas route; preview routes default to 0 (sheet sits at the
   * very bottom of the frame).
   */
  bottomSheetOffset?: number;
}

export function AtlasScreen({
  frame,
  embedded = false,
  onPrimaryAction,
  onPlanCapability,
  onSecondaryAction,
  onStepPress,
  onOpenRaceCourse,
  onAvatarPress,
  onOrgPress,
  onOrgLensPress,
  focusOrgSlug,
  subtitleOverride,
  nextEvent,
  avatarInitial,
  initialFocus,
  initialFocusLabel,
  initialFocusStepId,
  initialPeerFocus,
  initialView,
  onNearbyPress,
  nearbyOverlayOpen,
  useMapLibre = false,
  initialCommitMode = false,
  initialCreateRacingArea = false,
  bottomSheetOffset = 0,
}: AtlasScreenProps) {
  const handlers: AtlasFrameHandlers & {
    avatarInitial?: string;
    useMapLibre?: boolean;
    bottomSheetOffset?: number;
  } = {
    onPrimaryAction,
    onPlanCapability,
    onSecondaryAction,
    onStepPress,
    onOpenRaceCourse,
    onAvatarPress,
    onOrgPress,
    onOrgLensPress,
    focusOrgSlug,
    subtitleOverride,
    nextEvent,
    avatarInitial,
    initialFocus,
    initialFocusLabel,
    initialFocusStepId,
    initialPeerFocus,
    initialView,
    onNearbyPress,
    nearbyOverlayOpen,
    useMapLibre,
    initialCommitMode,
    initialCreateRacingArea,
    bottomSheetOffset,
  };
  switch (frame) {
    case 'f1':
      return <FrameF1 embedded={embedded} handlers={handlers} />;
    case 'f2':
      return <FrameF2 embedded={embedded} handlers={handlers} />;
    case 'f3':
      return <FrameF3 embedded={embedded} handlers={handlers} />;
    case 'f4':
      return <FrameF4 embedded={embedded} handlers={handlers} />;
    case 'f5':
      return <FrameF5 embedded={embedded} handlers={handlers} />;
    case 'f6':
      return <FrameF6 embedded={embedded} handlers={handlers} />;
    case 'f7':
      return <FrameF7 embedded={embedded} handlers={handlers} />;
    case 'f8':
      return <FrameF8 embedded={embedded} handlers={handlers} />;
    case 'f9':
      return (
        <GolfAtlasSurface
          embedded={embedded}
          subtitle={subtitleOverride}
          bottomSheetOffset={bottomSheetOffset}
          onPrimaryAction={onPrimaryAction}
          onStepPress={onStepPress}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Shared shell: top chrome, filter chips, layers FAB, mock tab bar
// ---------------------------------------------------------------------------
function StatusBar() {
  return (
    <View style={shellStyles.statusBar}>
      <Text style={shellStyles.statusBarTime}>10:08</Text>
      <View style={shellStyles.statusBarNotch} />
      <View style={shellStyles.statusBarRight}>
        <Ionicons name="cellular" size={11} color="#000" />
        <Ionicons name="wifi" size={11} color="#000" />
        <Ionicons name="battery-full" size={13} color="#000" />
      </View>
    </View>
  );
}

function TopChrome({
  title,
  subtitle,
  interestOverride,
  stepSwitcher,
  onLayersPress,
  onSearchPress,
  onNearbyPress,
}: {
  title: string;
  /**
   * Optional context line shown beneath the title (e.g. "Nursing · JHSON ·
   * Baltimore"). Hidden on F1 sailing per earlier user feedback; restored
   * on F4 nursing and F7 entrepreneur where the line is genuinely useful
   * map context (interest · program · region).
   */
  subtitle?: string;
  /** Unused — kept for callsite compat; avatar now lives in ProfileDropdown. */
  avatarInitial?: string;
  interestOverride?: {
    name: string;
    accentColor: string;
  };
  stepSwitcher?: {
    label: string;
    onPress: () => void;
  } | null;
  onLayersPress?: () => void;
  /**
   * Optional search glyph — restored for F7 per design. Off on F1 by
   * default. Frames opt in by passing a handler.
   */
  onSearchPress?: () => void;
  /**
   * Optional "Nearby" glyph (list icon) — opens the people-&-sites-nearby
   * overlay. F4 nursing passes this so Nearby lives as a quiet header action
   * instead of a floating pill covering the map. Frames opt in.
   */
  onNearbyPress?: () => void;
  /** Unused — kept for callsite compat; ProfileDropdown owns its own tap. */
  onAvatarPress?: () => void;
}) {
  const { isDrawerOpen, openDrawer } = useWebDrawer();
  const { width: windowWidth } = useWindowDimensions();
  // Only offer the toggle where a sidebar can actually render — below the
  // breakpoint it's a dead control sitting next to the floating tab bar.
  const showWebSidebarToggle =
    Platform.OS === 'web'
    && FEATURE_FLAGS.USE_WEB_SIDEBAR_LAYOUT
    && windowWidth >= SIDEBAR_PIN_BREAKPOINT
    && !isDrawerOpen;
  const { currentInterest } = useInterest();
  const universalPlus = useUniversalPlus();
  const displayInterest = interestOverride
    ? { name: interestOverride.name, accent_color: interestOverride.accentColor }
    : currentInterest;
  // The override sets the *displayed* lens (e.g. a persona demo frame), but the
  // pill must still open the interest switcher — locking the tap left users with
  // a dead dropdown on the Atlas tab.
  const interestIsSwitchable = true;

  return (
    <>
      <View style={shellStyles.topCapsuleRow}>
        {showWebSidebarToggle && (
          <Pressable
            onPress={openDrawer}
            style={({ pressed, hovered }) => [
              shellStyles.sidebarToggle,
              (hovered as boolean) && shellStyles.sidebarToggleHover,
              pressed && shellStyles.sidebarTogglePressed,
            ]}
            accessibilityLabel="Show sidebar"
            accessibilityRole="button"
          >
            <View style={shellStyles.sidebarIcon}>
              <View style={shellStyles.sidebarIconLeft} />
              <View style={shellStyles.sidebarIconRight} />
            </View>
          </Pressable>
        )}
        <View style={shellStyles.topCapsule}>
          {displayInterest ? (
            <Pressable
              style={shellStyles.capsuleInterest}
              onPress={interestIsSwitchable ? () => openInterestSwitcher() : undefined}
              hitSlop={4}
              accessibilityLabel={
                interestIsSwitchable
                  ? `Current interest: ${displayInterest.name}. Tap to switch.`
                  : `Current lens: ${displayInterest.name}.`
              }
            >
              <View
                style={[
                  shellStyles.capsuleInterestDot,
                  { backgroundColor: displayInterest.accent_color },
                ]}
              />
              <Text style={shellStyles.capsuleInterestText} numberOfLines={1}>
                {displayInterest.name}
              </Text>
              {interestIsSwitchable ? (
                <Ionicons
                  name="chevron-down"
                  size={11}
                  color="rgba(60, 60, 67, 0.62)"
                  style={shellStyles.capsuleInterestChevron}
                />
              ) : null}
            </Pressable>
          ) : null}
          {stepSwitcher ? (
            <Pressable
              style={shellStyles.capsuleStepSwitcher}
              onPress={stepSwitcher.onPress}
              hitSlop={4}
              accessibilityLabel={`${stepSwitcher.label}. Jump to another step`}
            >
              <View style={shellStyles.capsuleStepDot} />
              <Text style={shellStyles.capsuleStepText} numberOfLines={1}>
                {stepSwitcher.label}
              </Text>
              <Ionicons
                name="chevron-down"
                size={11}
                color="rgba(60, 60, 67, 0.62)"
              />
            </Pressable>
          ) : null}
          <View style={shellStyles.topCapsuleTextSlot}>
            <Text style={shellStyles.topCapsuleTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={shellStyles.topCapsuleSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {onNearbyPress ? (
            <Pressable
              style={shellStyles.capsuleAction}
              hitSlop={6}
              onPress={onNearbyPress}
              accessibilityLabel="People and sites nearby"
            >
              <Ionicons name="list" size={16} color="rgba(60, 60, 67, 0.85)" />
            </Pressable>
          ) : null}
          {onSearchPress ? (
            <Pressable
              style={shellStyles.capsuleAction}
              hitSlop={6}
              onPress={onSearchPress}
              accessibilityLabel="Search"
            >
              <Ionicons name="search" size={16} color="rgba(60, 60, 67, 0.85)" />
            </Pressable>
          ) : null}
          {onLayersPress ? (
            <Pressable
              style={shellStyles.capsuleAction}
              hitSlop={6}
              onPress={onLayersPress}
              accessibilityLabel="Map layers"
            >
              <Ionicons name="layers-outline" size={16} color="rgba(60, 60, 67, 0.85)" />
            </Pressable>
          ) : null}
          {universalPlus.isAvailable ? (
            <Pressable
              style={[
                shellStyles.capsuleAddButton,
                { backgroundColor: displayInterest?.accent_color ?? '#007AFF' },
              ]}
              hitSlop={6}
              onPress={universalPlus.open}
              accessibilityLabel="Add"
            >
              <Ionicons name="add" size={19} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <ProfileDropdown size={30} variant="light" menuAlign="right" />
        </View>
      </View>
      {/* Headless InterestSwitcher hosts the modal so the pill's
          openInterestSwitcher() call can pop the sheet on F2–F7. F1
          mounts its own headless inside the inline capsule render. */}
      <InterestSwitcher headless />
    </>
  );
}

interface FilterChipItem {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  tone?: 'you' | 'crew' | 'fleet' | 'following' | 'cohort' | 'sim';
  /**
   * Explicit dot color, used by the step-kind filter row where the dot is
   * a kind tint (race/boat work/practice/…) rather than one of the fixed
   * peer tones. Takes precedence over `tone`.
   */
  dotColor?: string;
  dim?: boolean;
  /**
   * Cross-interest chip — renders a small compound-glyph swatch (three
   * overlapping interest accents) in place of a single tone dot. Per the
   * brief: "Show all my interests sits at the end of the chip row with a
   * soft compound-glyph swatch." Discoverability is the point.
   */
  crossInterest?: boolean;
}

function FilterChipsRow({
  chips,
  onActiveIdsChange,
  rightInset = 148,
  compact = false,
  debugScope,
  onDebugMetrics,
}: {
  chips: FilterChipItem[];
  /**
   * Optional callback fired whenever the active-chip set changes. Lets
   * the parent frame (e.g. FrameF1) read Wind/Tide chip state to gate
   * the corresponding overlay layers.
   */
  onActiveIdsChange?: (activeIds: string[]) => void;
  /**
   * Reserve horizontal clearance for top-right controls that sit over the
   * same floating chrome row. Different Atlas frames have different chrome.
   */
  rightInset?: number;
  compact?: boolean;
  debugScope?: string;
  onDebugMetrics?: (metrics: { scrollHeight?: number; contentHeight?: number }) => void;
}) {
  // Local toggle state — chips are interactive even though the underlying
  // query layer is not wired yet. Initial active chip is whichever item
  // shipped active=true. Multi-select on data peer chips (You/Crew/Fleet
  // etc.), single-select on the leading "All" / sticky chip.
  const initialActive = chips.filter((c) => c.active).map((c) => c.id);
  const [activeIds, setActiveIds] = useState<string[]>(
    initialActive.length > 0 ? initialActive : [chips[0]?.id].filter(Boolean) as string[],
  );
  const chipScrollHeightRef = useRef<number | null>(null);
  const chipContentHeightRef = useRef<number | null>(null);
  const onActiveIdsChangeRef = useRef(onActiveIdsChange);

  React.useEffect(() => {
    onActiveIdsChangeRef.current = onActiveIdsChange;
  }, [onActiveIdsChange]);

  React.useEffect(() => {
    onActiveIdsChangeRef.current?.(activeIds);
  }, [activeIds]);

  const isAllChip = (id: string) =>
    id === 'all' || id === 'marks' || id === 'class' || id === 'cohort';

  const handlePress = (chipId: string) => {
    setActiveIds((prev) => {
      // The leading "All / Race marks / Dragon class / Cohort" chip is a
      // single-select anchor; tapping it clears the others.
      if (isAllChip(chipId)) {
        return prev.includes(chipId) ? prev : [chipId];
      }
      // Other chips toggle multi-select; tapping any clears the anchor.
      const withoutAnchor = prev.filter((id) => !isAllChip(id));
      return withoutAnchor.includes(chipId)
        ? withoutAnchor.filter((id) => id !== chipId)
        : [...withoutAnchor, chipId];
    });
  };

  const handleScrollLayout = useCallback((event: LayoutChangeEvent) => {
    if (!debugScope) return;
    const height = Math.round(event.nativeEvent.layout.height);
    if (chipScrollHeightRef.current === height) return;
    chipScrollHeightRef.current = height;
    onDebugMetrics?.({ scrollHeight: height, contentHeight: chipContentHeightRef.current ?? undefined });
    logAtlasDebug(`${debugScope}:chip-scroll`, {
      height,
      rightInset,
      compact,
      chips: chips.map((chip) => chip.id),
    });
  }, [chips, compact, debugScope, onDebugMetrics, rightInset]);

  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    if (!debugScope) return;
    const height = Math.round(event.nativeEvent.layout.height);
    if (chipContentHeightRef.current === height) return;
    chipContentHeightRef.current = height;
    onDebugMetrics?.({ scrollHeight: chipScrollHeightRef.current ?? undefined, contentHeight: height });
    logAtlasDebug(`${debugScope}:chip-content`, {
      height,
      rightInset,
      compact,
      activeIds,
    });
  }, [activeIds, compact, debugScope, onDebugMetrics, rightInset]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={handleScrollLayout}
      onContentSizeChange={(_, height) => {
        if (!debugScope) return;
        const rounded = Math.round(height);
        if (chipContentHeightRef.current === rounded) return;
        chipContentHeightRef.current = rounded;
        onDebugMetrics?.({ scrollHeight: chipScrollHeightRef.current ?? undefined, contentHeight: rounded });
        logAtlasDebug(`${debugScope}:chip-content`, {
          height: rounded,
          rightInset,
          compact,
          activeIds,
        });
      }}
      contentContainerStyle={[shellStyles.chipsContainer, { paddingRight: rightInset }]}
      style={shellStyles.chipsScroll}
    >
      <View onLayout={handleContentLayout} style={shellStyles.chipsInnerRow}>
        {chips.map((chip) => (
          <FilterChip
            key={chip.id}
            {...chip}
            active={activeIds.includes(chip.id)}
            compact={compact}
            onPress={() => handlePress(chip.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function FilterChip({
  label,
  icon,
  active,
  tone,
  dotColor,
  dim,
  crossInterest,
  compact,
  onPress,
}: FilterChipItem & { compact?: boolean; onPress?: () => void }) {
  const toneDot: Record<string, string> = {
    // Own steps render as the blue my-step pins — the key must match them,
    // not the red peer tone (own steps no longer surface via the peer feed).
    you: '#007AFF',
    crew: '#FF3B30',
    fleet: 'rgba(40, 50, 70, 0.78)',
    following: 'rgba(60, 70, 90, 0.45)',
    cohort: '#5856D6',
    sim: '#AF52DE',
  };
  return (
    <Pressable
      onPress={onPress}
      style={[
        shellStyles.chip,
        compact && shellStyles.chipCompact,
        active && shellStyles.chipActive,
        dim && shellStyles.chipDim,
      ]}
    >
      {crossInterest ? <CrossInterestGlyph active={active} /> : null}
      {icon && !crossInterest ? (
        <Ionicons
          name={icon}
          size={compact ? 10 : 11}
          color={active ? '#FFFFFF' : 'rgba(60, 60, 67, 0.72)'}
          style={{ marginRight: compact ? 3 : 4 }}
        />
      ) : null}
      {(dotColor || tone) && !crossInterest ? (
        <View
          style={[
            shellStyles.chipDot,
            compact && shellStyles.chipDotCompact,
            { backgroundColor: dotColor ?? (tone ? toneDot[tone] : 'transparent') },
          ]}
        />
      ) : null}
      <Text
        style={[
          shellStyles.chipText,
          compact && shellStyles.chipTextCompact,
          active && shellStyles.chipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Three overlapping coloured discs — sailing red, nursing purple, drawing
 * teal. The order mirrors the rough chronological order interests landed
 * in BetterAt's roadmap; the visual job is "this chip means cross-interest"
 * rather than literal interest enumeration.
 */
function CrossInterestGlyph({ active }: { active?: boolean }) {
  const opacity = active ? 1 : 0.78;
  return (
    <View style={shellStyles.crossInterestGlyph}>
      <View style={[shellStyles.crossInterestDot, { backgroundColor: '#FF3B30', opacity, marginLeft: 0 }]} />
      <View style={[shellStyles.crossInterestDot, { backgroundColor: '#5856D6', opacity, marginLeft: -3 }]} />
      <View style={[shellStyles.crossInterestDot, { backgroundColor: '#00C7BE', opacity, marginLeft: -3 }]} />
    </View>
  );
}

/**
 * Sub-chip rendered under the primary social-tier chip row when the
 * user belongs to affinity groups (class-fleets, cohorts, crew pods,
 * practice groups). Each chip carries a small dot in the tone that
 * matches the relationship label `atlas_peer_steps_near` would emit
 * for a member of that group, so the chip's color matches the pin
 * color on the map.
 */
const GROUP_TONE_DOT: Record<string, string> = {
  you: '#FF3B30',
  crew: '#FF3B30',
  fleet: 'rgba(40, 50, 70, 0.78)',
  cohort: '#5856D6',
};

// Phase N.2/N.3 — relationship tone + label for peer-step rows. Mirrors the
// PIN_TONE the map uses so the drill-down dots match the pins they expand.
const PEER_RELATIONSHIP_TONE: Record<string, string> = {
  self: '#FF3B30',
  crew: '#FF3B30',
  cohort: '#5856D6',
  fleet: 'rgba(40, 50, 70, 0.78)',
  following: 'rgba(60, 70, 90, 0.55)',
  public: 'rgba(120, 120, 130, 0.6)',
};

function peerRelationshipLabel(rel: string): string {
  switch (rel) {
    case 'self': return 'You';
    case 'crew': return 'Crew';
    case 'cohort': return 'Cohort';
    case 'fleet': return 'Fleet';
    case 'following': return 'Following';
    default: return 'Public';
  }
}

/** "2026-06-01T…" → "2d ago". Null/invalid input returns null (line hides). */
function relativeSetAt(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function readablePeerPlaceName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (/^dropped pin\b/i.test(trimmed)) return null;
  if (/^\(?\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)?$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function peerStepTitle(peer: AtlasPeerMember): string {
  return (
    peer.stepTitle?.trim() ||
    readablePeerPlaceName(peer.placeName) ||
    (peer.name ? `${peer.name}'s step` : 'Peer step')
  );
}

/**
 * Map a peer relationship to the pin kind used when one peer is broken out of
 * a cluster (focused from a list row). Mirrors mapPeerToPinKind in the frame-
 * pins hook so the de-clustered pin reads the same tone as it would in a thin
 * (<5) cluster.
 */
function relationshipToPeerKind(rel: string): AtlasPinSpec['kind'] {
  switch (rel) {
    case 'self': return 'you';
    case 'crew': return 'crew';
    case 'fleet': return 'fleet';
    default: return 'following';
  }
}

/**
 * Phase N.2 — the privacy-safe member list behind a "+N" peer cluster badge.
 * Most-recent first, capped so a dense cluster doesn't produce a giant sheet;
 * the tail collapses to "+N more nearby". Names may be approximate or hidden
 * (server-jittered), so a missing name falls back to "Someone nearby".
 */
function PeerMemberList({
  members,
  onSelectMember,
}: {
  members: AtlasPeerMember[];
  onSelectMember?: (member: AtlasPeerMember) => void;
}) {
  const CAP = 8;
  const sorted = [...members].sort((a, b) =>
    (b.setAt ?? '').localeCompare(a.setAt ?? ''),
  );
  const shown = sorted.slice(0, CAP);
  const extra = sorted.length - shown.length;
  return (
    <View style={shellStyles.peerListWrap}>
      {shown.map((m, i) => {
        const when = relativeSetAt(m.setAt);
        return (
          <Pressable
            key={`${m.stepId}-${i}`}
            style={shellStyles.peerListRow}
            onPress={onSelectMember ? () => onSelectMember(m) : undefined}
            disabled={!onSelectMember}
            hitSlop={4}
          >
            <View
              style={[
                shellStyles.peerListDot,
                {
                  backgroundColor:
                    PEER_RELATIONSHIP_TONE[m.relationship] ??
                    PEER_RELATIONSHIP_TONE.public,
                },
              ]}
            />
            <Text style={shellStyles.peerListName} numberOfLines={1}>
              {peerStepTitle(m)}
            </Text>
            <Text style={shellStyles.peerListMeta} numberOfLines={1}>
              {[
                m.name?.trim() || null,
                peerRelationshipLabel(m.relationship),
                when,
              ].filter(Boolean).join(' · ')}
            </Text>
            {onSelectMember ? (
              <Ionicons
                name="chevron-forward"
                size={14}
                color="rgba(60, 60, 67, 0.3)"
                style={shellStyles.peerListChevron}
              />
            ) : null}
          </Pressable>
        );
      })}
      {extra > 0 ? (
        <Text style={shellStyles.peerListMore}>+{extra} more nearby</Text>
      ) : null}
    </View>
  );
}

function StackedStepList({
  steps,
  onOpenStep,
}: {
  steps: NonNullable<AtlasPinSpec['stackedSteps']>;
  onOpenStep: (stepId: string) => void;
}) {
  return (
    <View style={shellStyles.peerListWrap}>
      {steps.map((s) => (
        <Pressable
          key={s.stepId}
          style={shellStyles.peerListRow}
          onPress={() => onOpenStep(s.stepId)}
          hitSlop={4}
        >
          <View
            style={[
              shellStyles.peerListDot,
              {
                backgroundColor:
                  s.statusNote === 'Planned' ? '#007AFF' : '#8E8E93',
              },
            ]}
          />
          <Text style={shellStyles.peerListName} numberOfLines={1}>
            {s.isRace ? '⛵ ' : ''}
            {s.title}
          </Text>
          <Text style={shellStyles.peerListMeta} numberOfLines={1}>
            {s.statusNote}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color="rgba(60, 60, 67, 0.3)"
            style={shellStyles.peerListChevron}
          />
        </Pressable>
      ))}
    </View>
  );
}

function GroupSubchip({
  group,
  active,
  onPress,
}: {
  group: UserAffinityGroup;
  active: boolean;
  onPress: () => void;
}) {
  const tone = affinityGroupTone(group.kind);
  return (
    <Pressable
      onPress={onPress}
      style={[shellStyles.groupSubchip, active && shellStyles.groupSubchipActive]}
      hitSlop={4}
    >
      <View
        style={[
          shellStyles.groupSubchipDot,
          { backgroundColor: GROUP_TONE_DOT[tone] ?? GROUP_TONE_DOT.fleet },
        ]}
      />
      <Text
        style={[
          shellStyles.groupSubchipText,
          active && shellStyles.groupSubchipTextActive,
        ]}
        numberOfLines={1}
      >
        {group.short_name ?? group.name}
      </Text>
    </Pressable>
  );
}

function LayersFab({
  onLayersPress,
  onDropPinPress,
  onCapturePress,
  onLocatePress,
  commitMode,
  bottomOffset = 0,
  showLocate = true,
}: {
  onLayersPress?: () => void;
  onDropPinPress?: () => void;
  /** Universal capture (+) as a prominent FAB. Mockup #39 lifts capture out
   *  of the top bar so the lens strip is the bar's focus. Rendered as the
   *  bottom-most, solid-blue button when provided. */
  onCapturePress?: () => void;
  /** Optional handler for the locate glyph — when omitted, tapping the
   *  glyph is a no-op (legacy behavior for frames that haven't wired it). */
  onLocatePress?: () => void;
  commitMode?: boolean;
  /** Lift the FAB column above the floating bottom sheet + tab bar. */
  bottomOffset?: number;
  /** When false, omit the locate glyph (F1 moves it into the top-right cluster). */
  showLocate?: boolean;
}) {
  // When the sheet floats above the tab bar, the FAB column must sit
  // ABOVE the sheet — otherwise the layers/locate/+ buttons get covered.
  // Default atlas sheets are often taller than the nominal MID state,
  // so we clear a bit more headroom to keep the + button visible.
  const dynamicBottom = bottomOffset > 0 ? bottomOffset + 176 : 96;
  return (
    <View
      style={[shellStyles.fabColumn, { bottom: dynamicBottom }]}
      pointerEvents="box-none"
    >
      {onLayersPress ? (
        <Pressable style={shellStyles.fab} onPress={onLayersPress} hitSlop={6}>
          <Ionicons name="layers-outline" size={16} color="rgba(60, 60, 67, 0.78)" />
        </Pressable>
      ) : null}
      {showLocate ? (
        <Pressable
          style={shellStyles.fab}
          onPress={onLocatePress}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Recenter map"
        >
          <Ionicons name="locate-outline" size={16} color="rgba(60, 60, 67, 0.78)" />
        </Pressable>
      ) : null}
      {onDropPinPress ? (
        <Pressable
          style={[shellStyles.fabDropPin, commitMode && shellStyles.fabActive]}
          onPress={onDropPinPress}
          hitSlop={8}
        >
          <Ionicons
            name={commitMode ? 'close' : 'add'}
            size={22}
            color={commitMode ? '#FFFFFF' : '#FFFFFF'}
          />
        </Pressable>
      ) : null}
      {onCapturePress ? (
        <Pressable
          style={shellStyles.fabDropPin}
          onPress={onCapturePress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add"
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Per the brief's "Layer registry, locked v1":
 *   core.peer_steps · core.own_steps · core.healthcare_pois ·
 *   sailing.race_marks · institution.curated_sites
 *
 * Plus a couple of overlay toggles per persona (wind/tide for sailing,
 * competency for nursing). Universal layers (own_steps, peer_steps) are
 * locked on — the brief specifies own_steps is "always visible."
 */
export type AtlasLayerKey =
  | 'sailing.race_marks'
  | 'sailing.race_areas'
  | 'sailing.course'
  | 'sailing.wind'
  | 'sailing.tide'
  | 'sailing.waves'
  | 'sailing.marinas'
  | 'sailing.sail_services'
  | 'core.peer_steps'
  | 'core.own_steps'
  | 'core.healthcare_pois'
  | 'nursing.cohort'
  | 'nursing.competency'
  | 'entrepreneur.markets'
  | 'entrepreneur.suppliers'
  | 'entrepreneur.mentees'
  | 'entrepreneur.offline'
  | 'mentor.shg_clusters'
  | 'mentor.visit_queue'
  | 'mentor.scheme_uptake'
  | 'institution.curated_sites';

interface LayerItem {
  key: AtlasLayerKey;
  label: string;
  sub?: string;
  defaultOn: boolean;
  locked?: boolean;
}

function isSailingInterestSlug(slug: string | null): boolean {
  const s = (slug ?? '').toLowerCase();
  return s === 'sailing' || s === 'sail-racing' || s === 'sail';
}

function getLayersForFrame(frame: AtlasFrameId, sailingChrome = true): LayerItem[] {
  const peerSteps: LayerItem = {
    key: 'core.peer_steps',
    label: 'Peer steps',
    sub: 'Color-coded by relationship',
    defaultOn: true,
  };
  const ownSteps: LayerItem = {
    key: 'core.own_steps',
    label: 'My steps',
    sub: 'Always visible',
    defaultOn: true,
    locked: true,
  };

  if (frame === 'f1' || frame === 'f6') {
    // Off the sailing frame (golf / entrepreneur / drawing / fitness on F1),
    // the sailing environment + course + infrastructure layers are meaningless.
    // Fall back to the universal step layers so the Layers sheet stays honest.
    if (!sailingChrome) {
      return [peerSteps, ownSteps];
    }
    // Sailing-specific F1/F6 layer set. Chips own the social filter
    // (You/Crew/Fleet) so peer-steps and own-steps no longer appear here
    // as toggle rows — they're not in the same mental model. What
    // belongs in layers is environment + context the sailor wants to
    // see / hide: conditions (wind, tide), course geometry (race
    // areas, race marks), and infrastructure (clubs, marinas, sail
    // services). Race marks stays gated at z ≥ 14 — a layer that
    // can't render at the current zoom is honest about it via the
    // sub-label rather than silently no-op'ing.
    return [
      { key: 'sailing.wind', label: 'Wind forecast', sub: 'Direction + speed for next race day', defaultOn: false },
      { key: 'sailing.tide', label: 'Tidal current', sub: 'Set + drift around the course', defaultOn: false },
      { key: 'sailing.waves', label: 'Swell', sub: 'Wave direction + height', defaultOn: false },
      { key: 'sailing.race_areas', label: 'Race areas', sub: 'Highlighted racing zones', defaultOn: true },
      { key: 'sailing.course', label: 'Race course', sub: 'Marks, laylines, start box · zoom ≥ 13', defaultOn: true },
      { key: 'sailing.race_marks', label: 'Race marks', sub: 'Visible at zoom ≥ 14', defaultOn: false },
      { key: 'sailing.marinas', label: 'Marinas & clubs', sub: 'Sailing venues nearby', defaultOn: false },
      { key: 'sailing.sail_services', label: 'Sail services', sub: 'Lofts, chandlers, repair · zoom ≥ 13', defaultOn: false },
    ];
  }

  if (frame === 'f2') {
    return [
      { key: 'sailing.race_marks', label: 'Race marks', sub: 'Renders at zoom ≥ 14', defaultOn: true },
      { key: 'sailing.course', label: 'Race course', sub: 'Marks, laylines, start box · zoom ≥ 13', defaultOn: true },
      { key: 'sailing.wind', label: 'Wind forecast', sub: 'Direction + speed', defaultOn: true },
      { key: 'sailing.tide', label: 'Tidal current', sub: 'Set + drift', defaultOn: true },
      peerSteps,
      ownSteps,
    ];
  }

  if (frame === 'f3') {
    return [
      { key: 'core.peer_steps', label: 'Class lens · Dragon', sub: 'Fleets worldwide', defaultOn: true },
      peerSteps,
      ownSteps,
    ];
  }

  if (frame === 'f7') {
    return [
      { key: 'entrepreneur.markets', label: 'Haat · markets', sub: 'Day-of-week badges', defaultOn: true },
      { key: 'entrepreneur.suppliers', label: 'Suppliers', sub: 'Source villages', defaultOn: true },
      { key: 'entrepreneur.mentees', label: 'Mentees', sub: 'Glow when nearby', defaultOn: true },
      { key: 'entrepreneur.offline', label: 'Offline tile cache', sub: 'Synced 4 hours ago', defaultOn: true, locked: true },
      ownSteps,
    ];
  }

  if (frame === 'f8') {
    return [
      { key: 'mentor.shg_clusters', label: 'SHG clusters', sub: 'Status dots from didi evidence', defaultOn: true, locked: true },
      { key: 'mentor.visit_queue', label: 'Visit queue', sub: 'Needs-help didis first', defaultOn: true },
      { key: 'mentor.scheme_uptake', label: 'Scheme uptake', sub: 'PMFME · Mudra · UPI · FSSAI', defaultOn: true },
      { key: 'entrepreneur.offline', label: 'Offline tile cache', sub: 'Shared-phone field mode', defaultOn: true, locked: true },
    ];
  }

  // f5 — JHU curated
  return [
    { key: 'institution.curated_sites', label: 'JHU partner sites', sub: 'Hopkins / Bayview / Suburban / Howard', defaultOn: true },
    { key: 'nursing.competency', label: 'Competency overlay', sub: 'IV insertion · supervised', defaultOn: true },
    { key: 'nursing.cohort', label: 'Cohort pins', sub: 'Site-level fuzz · per-viewer stable', defaultOn: true },
    ownSteps,
  ];
}

function LayersSheet({
  frame,
  onClose,
  controlledActiveKeys,
  onToggle,
  basemap,
  onBasemapChange,
  onOpenManageAreas,
  sailingChrome = true,
  bottomOffset = 0,
}: {
  frame: AtlasFrameId;
  onClose: () => void;
  /**
   * Layer keys the parent wants to keep in sync with map state (race-marks,
   * wind, tide). When provided, the sheet renders these keys as on/off from
   * the parent's value; other keys still use internal state.
   */
  controlledActiveKeys?: Set<string>;
  /**
   * Fires for every toggle, including controlled keys. Parent uses this to
   * drive map filters (e.g. hide race-marks when sailing.race_marks is off).
   */
  onToggle?: (key: string, on: boolean) => void;
  basemap?: AtlasBasemap;
  onBasemapChange?: (basemap: AtlasBasemap) => void;
  /**
   * Opens the Manage Racing Areas sheet — a list of user-defined areas
   * with delete buttons. Only F1 (sailing) supplies this prop.
   */
  onOpenManageAreas?: () => void;
  /**
   * When false (golf / entrepreneur / other non-sailing interests on F1), the
   * sailing environment + course + infrastructure layers are dropped in favor
   * of the universal step layers.
   */
  sailingChrome?: boolean;
  /**
   * Lift the sheet above the floating tab bar so the last layer row + the
   * attribution footer aren't hidden under it. Same pattern as the
   * BottomSheet's bottomOffset prop.
   */
  bottomOffset?: number;
}) {
  const layers = getLayersForFrame(frame, sailingChrome);
  const showBasemapControl = Boolean(
    basemap &&
      onBasemapChange &&
      (frame === 'f1' || frame === 'f2' || frame === 'f6'),
  );
  const [internalKeys, setInternalKeys] = useState<Set<string>>(
    () => new Set(layers.filter((l) => l.defaultOn).map((l) => l.key)),
  );
  // Merge controlled + internal — controlled keys win when both define.
  const activeKeys = useMemo(() => {
    if (!controlledActiveKeys) return internalKeys;
    const out = new Set(internalKeys);
    // The parent mirrors every sailing overlay into controlledActiveKeys, so
    // clear ALL of them before reapplying the parent's on-set — otherwise a
    // defaultOn key (race areas, course) re-reads as ON from internal state
    // every time the sheet remounts, the toggle lies, and the next tap flips
    // the parent the wrong way. Uncontrolled layers like "Peer steps" and
    // "My steps" keep their own internal state instead of being dimmed just
    // because they're absent from controlledActiveKeys.
    for (const key of [
      'sailing.race_marks',
      'sailing.marinas',
      'sailing.sail_services',
      'sailing.wind',
      'sailing.tide',
      'sailing.waves',
      'sailing.race_areas',
      'sailing.course',
    ] as const) {
      out.delete(key);
    }
    for (const key of controlledActiveKeys) {
      out.add(key as AtlasLayerKey);
    }
    return out;
  }, [internalKeys, controlledActiveKeys]);

  const toggle = (item: LayerItem) => {
    if (item.locked) return;
    const willBeOn = !activeKeys.has(item.key);
    setInternalKeys((prev) => {
      const next = new Set(prev);
      if (willBeOn) next.add(item.key);
      else next.delete(item.key);
      return next;
    });
    onToggle?.(item.key, willBeOn);
  };

  return (
    <>
      <Pressable style={shellStyles.layersBackdrop} onPress={onClose} />
      <View
        style={[
          shellStyles.layersSheet,
          bottomOffset > 0 && { bottom: bottomOffset },
        ]}
      >
        <View style={shellStyles.layersHandle} />
        <View style={shellStyles.layersHeader}>
          <Text style={shellStyles.layersTitle}>Layers</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={18} color={IOS_REGISTER.label} />
          </Pressable>
        </View>
        {showBasemapControl ? (
          <View style={shellStyles.basemapSection}>
            <Text style={shellStyles.basemapLabel}>Basemap</Text>
            <View style={shellStyles.basemapSegmented}>
              {(sailingChrome
                ? ([
                    ['map', 'Map'],
                    ['satellite', 'Satellite'],
                    ['nautical', 'Nautical'],
                  ] as const)
                : ([
                    ['map', 'Map'],
                    ['satellite', 'Satellite'],
                    ['detailed', 'Detailed'],
                  ] as const)
              ).map(([value, label]) => {
                const selected = basemap === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => onBasemapChange?.(value)}
                    style={[
                      shellStyles.basemapSegment,
                      selected && shellStyles.basemapSegmentActive,
                    ]}
                  >
                    <Text
                      style={[
                        shellStyles.basemapSegmentText,
                        selected && shellStyles.basemapSegmentTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {layers.map((layer) => {
          const on = activeKeys.has(layer.key);
          return (
            <Pressable
              key={layer.key}
              style={shellStyles.layerRow}
              onPress={() => toggle(layer)}
              disabled={layer.locked}
            >
              <View style={{ flex: 1 }}>
                <View style={shellStyles.layerLabelRow}>
                  <Text style={shellStyles.layerLabel}>{layer.label}</Text>
                  {layer.locked ? (
                    <View style={shellStyles.layerLockPill}>
                      <Ionicons name="lock-closed" size={9} color="rgba(60, 60, 67, 0.55)" />
                      <Text style={shellStyles.layerLockText}>locked</Text>
                    </View>
                  ) : null}
                </View>
                {layer.sub ? <Text style={shellStyles.layerSub}>{layer.sub}</Text> : null}
              </View>
              <View
                style={[
                  shellStyles.layerToggle,
                  on && shellStyles.layerToggleOn,
                  layer.locked && shellStyles.layerToggleLocked,
                ]}
              >
                <View
                  style={[
                    shellStyles.layerToggleKnob,
                    on && shellStyles.layerToggleKnobOn,
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
        {onOpenManageAreas ? (
          <Pressable
            onPress={onOpenManageAreas}
            hitSlop={6}
            style={({ pressed }) => [
              shellStyles.manageAreasBtn,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Your racing areas"
          >
            <Ionicons name="create-outline" size={14} color={IOS_REGISTER.accentUserAction} />
            <Text style={shellStyles.manageAreasText}>Your racing areas</Text>
          </Pressable>
        ) : null}
        {/* Attribution required by OpenFreeMap / OpenMapTiles / OSM
            licenses. Lives at the bottom of the Layers sheet so the
            (i) chrome button stays off the map canvas. */}
        <Text style={shellStyles.layersAttribution}>
          Basemaps · OpenFreeMap · © OpenMapTiles · © OpenStreetMap · Esri · OpenSeaMap
        </Text>
      </View>
    </>
  );
}

function MockTabBar({ activeTab = 'atlas' }: { activeTab?: 'practice' | 'library' | 'atlas' | 'discover' | 'profile' }) {
  const items = [
    { id: 'practice', label: 'Practice', icon: 'flag-outline' as const, focused: 'flag' as const },
    { id: 'library', label: 'Library', icon: 'library-outline' as const, focused: 'library' as const },
    { id: 'atlas', label: 'Atlas', icon: 'compass-outline' as const, focused: 'compass' as const },
    { id: 'discover', label: 'Discover', icon: 'people-outline' as const, focused: 'people' as const },
    { id: 'profile', label: 'Profile', icon: 'person-circle-outline' as const, focused: 'person-circle' as const },
  ];
  return (
    <View style={shellStyles.tabBar}>
      {items.map((item) => {
        const isActive = item.id === activeTab;
        return (
          <View key={item.id} style={shellStyles.tabItem}>
            <Ionicons
              name={isActive ? item.focused : item.icon}
              size={20}
              color={isActive ? IOS_REGISTER.accentUserAction : 'rgba(60, 60, 67, 0.55)'}
            />
            <Text
              style={[
                shellStyles.tabLabel,
                isActive && { color: IOS_REGISTER.accentUserAction, fontWeight: '600' },
              ]}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Eyebrow copy for a tapped pin's detail sheet. Race marks read as
 * "RACE MARK", institution POIs read as their grammar (CLUB / SITE /
 * RACING AREA), peer pins surface as the relationship label.
 */
/** Parse a "degrees|knots" conditions line into numbers, or null if absent. */
function parseConditionsLine(line: string | null | undefined): { deg: number; kn: number } | null {
  if (!line) return null;
  const [degStr, knStr] = line.split('|');
  const deg = Number(degStr);
  const kn = Number(knStr);
  if (!Number.isFinite(deg) || !Number.isFinite(kn)) return null;
  return { deg, kn };
}

function offsetPointByBearing(
  point: { lat: number; lng: number },
  bearingDeg: number,
  distanceKm: number,
): { lat: number; lng: number } {
  const rad = (bearingDeg * Math.PI) / 180;
  const northKm = Math.cos(rad) * distanceKm;
  const eastKm = Math.sin(rad) * distanceKm;
  return {
    lat: point.lat + northKm / 111,
    lng: point.lng + eastKm / (111 * Math.cos((point.lat * Math.PI) / 180)),
  };
}

function eyebrowForPin(pin: AtlasPinSpec): string {
  if (pin.kind === 'race-mark') return 'RACE MARK';
  if (pin.kind === 'poi-club' || pin.kind === 'poi-club-anchor') return 'CLUB';
  if (pin.kind === 'poi-racing-area') return 'RACING AREA';
  if (pin.kind === 'poi-hospital') return 'HOSPITAL';
  if (pin.kind === 'poi-sim-lab') return 'SIM LAB';
  if (pin.kind === 'poi-sim-anchor') return 'SIM · YOUR BASE';
  if (pin.kind === 'poi-preceptor') return 'PRECEPTOR';
  if (pin.kind === 'poi-haat') return 'HAAT · WEEKLY MARKET';
  if (pin.kind === 'poi-supplier') return 'SUPPLIER VILLAGE';
  if (pin.kind === 'poi-mentee') return 'MENTEE';
  if (pin.kind === 'poi-home-anchor') return 'HOME · YOUR WORKSHOP';
  if (pin.kind === 'you') return 'YOU';
  if (pin.kind === 'crew') return 'CREW';
  if (pin.kind === 'fleet') return 'FLEET';
  if (pin.kind === 'following') return 'FOLLOWING';
  return 'PIN';
}

/**
 * Resolve a pin to an atlas_pois id it can anchor local knowledge on.
 * Knowledge attaches to PLACES — person-kind POIs (preceptor, mentee,
 * home workshop) never anchor venue_discussions. Racing-area point pins are
 * excluded too: their knowledge anchors through the polygon label tap, and a
 * second pin-keyed thread would split the same water in two.
 */
const KNOWLEDGE_POI_EXCLUDED_KINDS = new Set<AtlasPinSpec['kind']>([
  'poi-preceptor',
  'poi-mentee',
  'poi-home-anchor',
  'poi-racing-area',
]);

function knowledgePoiIdForPin(pin: AtlasPinSpec): string | null {
  if (KNOWLEDGE_POI_EXCLUDED_KINDS.has(pin.kind)) return null;
  return pin.id.startsWith('poi:') ? pin.id.slice('poi:'.length) : null;
}

/**
 * Fallback body for pin detail sheets when the pin has no explicit
 * subtitle — a terse coord readout keeps the sheet non-empty so the
 * primary CTA reads as related-to-something.
 */
function bodyForPin(pin: AtlasPinSpec): string {
  return `${pin.lat.toFixed(4)} N · ${pin.lng.toFixed(4)} E`;
}

function detailBodyForPin(pin: AtlasPinSpec, extra: (string | undefined | null)[] = []): string {
  return [
    pin.subtitle,
    pin.provenance,
    ...extra,
    bodyForPin(pin),
  ]
    .filter(Boolean)
    .join('\n');
}

function atlasPinContextNote(pin: AtlasPinSpec): string | undefined {
  if (pin.kind !== 'poi-haat') return undefined;
  const day = (pin.label ?? '').split('|')[1]?.trim();
  if (!day) return undefined;
  return `Day badge: ${day.toUpperCase()} marks this market's weekly haat day.`;
}

function titleForPin(pin: AtlasPinSpec): string {
  if (pin.label?.trim()) return pin.label.trim();
  if (pin.kind === 'fleet') return 'Fleet boat';
  if (pin.kind === 'crew') return 'Crew boat';
  if (pin.kind === 'you') return 'Your boat';
  if (pin.kind === 'wind-arrow') return 'Wind';
  if (pin.kind === 'tide-arrow') return 'Tide';
  return 'Pin';
}

function titleForUserStepPin(pin: AtlasPinSpec): string {
  return (pin.label ?? 'Step').split('|')[0]?.trim() || 'Step';
}

/** A tapped my-step pin that's flagged a race — gets the ⛵ course callout. */
function isRaceStepPin(pin: AtlasPinSpec): boolean {
  return isUserStepPin(pin) && pin.isRace === true;
}

function titleForRaceStepPin(pin: AtlasPinSpec): string {
  return titleForUserStepPin(pin);
}

function sourceForRaceStepPin(pin: AtlasPinSpec): string | undefined {
  return [
    pin.raceContext?.areaName?.trim() || null,
    pin.raceContext?.courseLabel?.trim() || null,
    pin.subtitle || null,
  ]
    .filter(Boolean)
    .join(' · ') || undefined;
}

/**
 * Body for a race-pin callout — course label ("Windward–Leeward · 3 laps")
 * over a one-line nudge that tapping opens the on-water cockpit.
 */
function bodyForRaceStepPin(pin: AtlasPinSpec): string {
  return [
    pin.raceContext?.courseLabel?.trim() || null,
    'Open the course for geometry, marks, and the live wind/tide scrubber.',
  ]
    .filter(Boolean)
    .join('\n');
}

function isTriangleRaceStepPin(pin: AtlasPinSpec | null): boolean {
  if (!pin || !isRaceStepPin(pin)) return false;
  return (pin.raceContext?.courseLabel ?? '').toLowerCase().includes('triangle');
}

function trianglePreviewAroundPin(
  pin: AtlasPinSpec,
  windDirectionDeg: number,
): GeoJSON.FeatureCollection {
  const anchor = { lat: pin.lat, lng: pin.lng };
  const start = offsetPointByBearing(anchor, windDirectionDeg + 180, 0.46);
  const pinEnd = offsetPointByBearing(start, windDirectionDeg - 90, 0.075);
  const committee = offsetPointByBearing(start, windDirectionDeg + 90, 0.075);
  const windward = offsetPointByBearing(start, windDirectionDeg, 0.93);
  const wingAxis = offsetPointByBearing(start, windDirectionDeg, 0.46);
  const wing = offsetPointByBearing(wingAxis, windDirectionDeg + 90, 0.8);
  const point = (
    id: string,
    c: { lat: number; lng: number },
    markType: string,
  ): GeoJSON.Feature => ({
    type: 'Feature',
    id,
    properties: { type: 'course-mark', markType },
    geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
  });

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: `selected-triangle-start:${pin.id}`,
        properties: { type: 'start-line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [pinEnd.lng, pinEnd.lat],
            [committee.lng, committee.lat],
          ],
        },
      },
      {
        type: 'Feature',
        id: `selected-triangle-leg:${pin.id}`,
        properties: { type: 'course-leg', courseType: 'triangle' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [start.lng, start.lat],
            [windward.lng, windward.lat],
            [wing.lng, wing.lat],
            [start.lng, start.lat],
          ],
        },
      },
      point(`selected-triangle-pin:${pin.id}`, pinEnd, 'pin'),
      point(`selected-triangle-committee:${pin.id}`, committee, 'committee'),
      point(`selected-triangle-windward:${pin.id}`, windward, 'windward'),
      point(`selected-triangle-wing:${pin.id}`, wing, 'wing'),
    ],
  };
}

function formatRaceStartLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function signedDelta(value: number, unit = ''): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${unit}`;
}

function angleDelta(from: number, to: number): number {
  return Math.round(((to - from + 540) % 360) - 180);
}

function trendFirstLast<T>(
  points: MarineTrendPoint[] | undefined,
  pick: (point: MarineTrendPoint) => T | null | undefined,
): { first: T; last: T } | null {
  const values = (points ?? []).map(pick).filter((v): v is T => v != null);
  if (values.length < 2) return null;
  return { first: values[0], last: values[values.length - 1] };
}

function windTrendText(points: MarineTrendPoint[] | undefined): string | null {
  const pair = trendFirstLast(points, (p) => p.wind);
  if (!pair) return null;
  const dirDelta = angleDelta(pair.first.degrees, pair.last.degrees);
  const speedDelta = Math.round((pair.last.knots - pair.first.knots) * 10) / 10;
  const shift = dirDelta > 0 ? 'veering' : dirDelta < 0 ? 'backing' : 'steady';
  const pressure = speedDelta > 0.4 ? 'building' : speedDelta < -0.4 ? 'easing' : 'steady';
  return `${pair.first.degrees}° → ${pair.last.degrees}° · ${pair.first.knots}–${pair.last.knots} kn · ${shift} ${Math.abs(dirDelta)}° · ${pressure} ${signedDelta(speedDelta, ' kn')}`;
}

function currentTrendText(points: MarineTrendPoint[] | undefined): string | null {
  const pair = trendFirstLast(points, (p) => p.current);
  if (!pair) return null;
  const speedDelta = Math.round((pair.last.knots - pair.first.knots) * 10) / 10;
  const flow = speedDelta > 0.1 ? 'rising' : speedDelta < -0.1 ? 'falling' : 'steady';
  return `${pair.first.degrees}° → ${pair.last.degrees}° set · ${pair.first.knots} → ${pair.last.knots} kn · ${flow} ${signedDelta(speedDelta, ' kn')}`;
}

function seaTrendText(points: MarineTrendPoint[] | undefined): string | null {
  const pair = trendFirstLast(points, (p) => p.waves);
  if (!pair) return null;
  const heightDelta = Math.round((pair.last.heightMeters - pair.first.heightMeters) * 10) / 10;
  const trend = heightDelta > 0.1 ? 'building' : heightDelta < -0.1 ? 'settling' : 'steady';
  return `${pair.first.heightMeters} → ${pair.last.heightMeters} m · ${trend} ${signedDelta(heightDelta, ' m')}`;
}

function shiftConditionsLine(
  line: string | null | undefined,
  directionDelta: number,
  speedDelta: number,
): string | null {
  if (!line) return null;
  const [directionRaw, speedRaw] = line.split('|');
  const direction = Number(directionRaw);
  const speed = Number(speedRaw);
  if (!Number.isFinite(direction) || !Number.isFinite(speed)) return line;
  const nextDirection = Math.round((direction + directionDelta + 360) % 360);
  const nextSpeed = Math.max(0, speed + speedDelta);
  return `${nextDirection}|${Number(nextSpeed.toFixed(1))}`;
}

// Label-less variant for the cockpit gauge cells — the cell's own caption
// carries the "WIND"/"TIDE" label, so the value reads as a bold figure.
function formatConditionsValue(line: string | null | undefined): string | null {
  const parsed = parseConditionsLine(line);
  if (!parsed) return null;
  return `${Math.round(parsed.deg)}° · ${parsed.kn.toFixed(1)} kn`;
}

// Hourly forecast isos arrive as "2026-06-13T06:00" (UTC, no Z). Render as
// the local clock hour for scrubber ticks — "2pm" matches formatWhen's style.
function formatScrubClock(iso: string): string {
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
  const hour12 = ((d.getHours() + 11) % 12) + 1;
  return `${hour12}${d.getHours() >= 12 ? 'pm' : 'am'}`;
}

// ---------------------------------------------------------------------------
// F1 — Felix · first-run · Causeway Bay overview
// ---------------------------------------------------------------------------
function FrameF1({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const next = handlers.nextEvent;
  const hasNext = Boolean(next?.label);
  // Series sheet — opened by tapping the "N races · {Series}" caption on the
  // drawn course's committee boat. Lists the season's races for this course.
  const [seriesSheetOpen, setSeriesSheetOpen] = useState(false);
  const seriesRaces = useAtlasSeriesRaces(
    seriesSheetOpen ? next?.season_id ?? null : null,
    seriesSheetOpen ? next?.course_id ?? null : null,
  );
  const closeSeriesSheet = useCallback(() => setSeriesSheetOpen(false), []);
  const handlePickSeriesRace = useCallback(
    (stepId: string) => {
      setSeriesSheetOpen(false);
      handlers.onStepPress?.(stepId);
    },
    [handlers],
  );
  const insets = useSafeAreaInsets();
  const homeVenue = useUserHomeVenue();
  const { getCurrentLocation } = useCurrentLocation();
  const { user: authUser } = useAuth();
  const { currentInterest } = useInterest();
  // F1 is the location-driven generic frame: sailing, plus golf / entrepreneur /
  // drawing / fitness / default route here. Sailing-only chrome (race-time bar,
  // Races filter, race-area/mark + marina/sail-service layers, the fleet lens,
  // SVG demo boat pins) is gated behind this so a golf or entrepreneur user
  // doesn't inherit regatta vocabulary. The relationship tiers stay but use
  // interest-neutral labels (Collaborators / Group) off the sailing frame.
  const isSailingFrame = isSailingInterestSlug(currentInterest?.slug ?? null);
  const visibilityLabels = getVisibilityLabels(currentInterest?.slug ?? null);
  const queryClient = useQueryClient();
  const lastAtlasStepStorageKey = useMemo(
    () =>
      [
        ATLAS_F1_LAST_STEP_KEY,
        authUser?.id ?? 'anon',
        currentInterest?.id ?? currentInterest?.slug ?? 'none',
      ].join(':'),
    [authUser?.id, currentInterest?.id, currentInterest?.slug],
  );
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
      if (authUser?.id && currentInterest?.slug) {
        void queryClient.invalidateQueries({
          queryKey: ['user-atlas-steps', authUser.id, currentInterest.slug],
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['atlas-series-races'] });
    }, [authUser?.id, currentInterest?.slug, queryClient]),
  );
  // ★ Saved dropdown (mockup #39 frame B) data — the user's mapped race
  // waters and favourited venues, consolidated alongside the step picker.
  const { racingAreas: myRacingAreas } = useMyRacingAreas(homeVenue?.id ?? null);
  const { savedVenues } = useSavedVenues();
  const [savedSheetOpen, setSavedSheetOpen] = useState(false);
  // Screen rect of the ★ trigger so the Saved menu opens as a dropdown under it.
  const savedStarRef = useRef<View>(null);
  const [savedAnchor, setSavedAnchor] = useState<AnchorRect | null>(null);
  const openSavedSheet = useCallback(() => {
    savedStarRef.current?.measureInWindow((x, y, width, height) => {
      setSavedAnchor({ x, y, width, height });
    });
    setSavedSheetOpen(true);
  }, []);
  const universalPlus = useUniversalPlus();
  const { groups: userGroups } = useUserAffinityGroups('sail-racing');
  // The fleet lens chip names the user's actual fleet ("Dragon HK"), not
  // the generic word — the small group is the lens, not a filter (V.3).
  const fleetChipGroup = useMemo(
    () =>
      userGroups.find((g) => g.kind === 'class_fleet') ??
      userGroups.find((g) => g.kind === 'practice_group') ??
      null,
    [userGroups],
  );
  const fleetChipLabel = fleetChipGroup
    ? fleetChipGroup.short_name?.trim() || fleetChipGroup.name
    : 'Fleet';
  // The group powering the fleet chip's name would render as an identical
  // subchip right below it — skip it; the renamed chip IS that group's lens.
  const subchipGroups = useMemo(
    () => userGroups.filter((g) => g.id !== fleetChipGroup?.id),
    [userGroups, fleetChipGroup],
  );
  const [activeGroupIds, setActiveGroupIds] = useState<string[]>([]);
  const toggleGroupChip = useCallback((groupId: string) => {
    setActiveGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  }, []);
  const [layersOpen, setLayersOpen] = useState(false);
  // Sites | Capabilities | Map segment (the nursing F4 three-tab reframe,
  // generalized to every F1 interest). Lands on Sites so the frame leads with
  // structure; Map keeps the full sailing/MapLibre experience byte-identical.
  const [f1View, setF1View] = useState<'sites' | 'capabilities' | 'map'>(
    handlers.initialView === 'map' ? 'map' : 'sites',
  );
  // Measured height of the floating chrome so the Sites/Capabilities surfaces
  // inset their scroll content clear of it (the chrome floats on top).
  const [f1ChromeH, setF1ChromeH] = useState(140);
  const [manageAreasOpen, setManageAreasOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<EditingRacingArea | null>(null);
  // Racing-area knowledge callout: tapping an area label opens a sheet with
  // the area's local-knowledge posts (RLS-scoped to the viewer).
  const [knowledgeArea, setKnowledgeArea] = useState<AtlasRacingAreaPressTarget | null>(null);
  const handleEditArea = useCallback((target: ManageAreasEditTarget) => {
    setManageAreasOpen(false);
    setEditingArea(target);
  }, []);
  // Tap-to-reposition flow. Captures the area we're moving plus the
  // current candidate center (initially the existing center; updated
  // on each map tap). Stays null when not active.
  const [repositionTarget, setRepositionTarget] = useState<
    | (EditingRacingArea & { newLat: number; newLng: number })
    | null
  >(null);
  // Tap-to-trace flow: user replaces the area's existing shape with a
  // real polygon by tapping vertices on the map. vertices grows on
  // each map tap while active.
  const [retraceTarget, setRetraceTarget] = useState<
    | (EditingRacingArea & { vertices: { lat: number; lng: number }[] })
    | null
  >(null);
  // Drag-to-reshape flow: the area's existing polygon vertices become
  // draggable handles. Vertex count never changes — only positions.
  const [reshapeTarget, setReshapeTarget] = useState<
    | (EditingRacingArea & {
        vertices: { lat: number; lng: number }[];
        dirty: boolean;
        selectedIndex: number | null;
      })
    | null
  >(null);
  const updateRacingAreaMutation = useUpdateRacingArea();
  // Map-editing modes (reposition / retrace) are map-only. If the user leaves
  // Atlas — or opens a non-map overlay — without finishing, the banner would
  // otherwise leak onto surfaces with no map to tap and no cancel in reach.
  // Reset both modes whenever Atlas loses focus.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setRepositionTarget(null);
        setRetraceTarget(null);
        setReshapeTarget(null);
      };
    }, []),
  );
  // Same guard for the in-tab Nearby list overlay (no focus change fires when
  // it slides over the map), so the editing banner can't strand on top of it.
  useEffect(() => {
    if (handlers.nearbyOverlayOpen) {
      setRepositionTarget(null);
      setRetraceTarget(null);
      setReshapeTarget(null);
    }
  }, [handlers.nearbyOverlayOpen]);
  const handleRetraceOnMap = useCallback((target: EditingRacingArea) => {
    setEditingArea(null);
    setRetraceTarget({ ...target, vertices: [] });
  }, []);
  const handleRetraceUndo = useCallback(() => {
    setRetraceTarget((prev) =>
      prev ? { ...prev, vertices: prev.vertices.slice(0, -1) } : prev,
    );
  }, []);
  const handleCancelRetrace = useCallback(() => {
    const reverted = retraceTarget
      ? {
          id: retraceTarget.id,
          name: retraceTarget.name,
          centerLat: retraceTarget.centerLat,
          centerLng: retraceTarget.centerLng,
          radiusMeters: retraceTarget.radiusMeters,
          classesUsed: retraceTarget.classesUsed,
        }
      : null;
    setRetraceTarget(null);
    if (reverted) setEditingArea(reverted);
  }, [retraceTarget]);
  const handleSaveRetrace = useCallback(async () => {
    if (!retraceTarget || retraceTarget.vertices.length < 3) return;
    // Build a closed Polygon ring: [v1, v2, ..., vN, v1].
    const ring: [number, number][] = retraceTarget.vertices.map((v) => [v.lng, v.lat]);
    ring.push(ring[0]);
    // Centroid for center_lat/lng (used by old consumers that still
    // read the point-fallback shape).
    let sumLat = 0;
    let sumLng = 0;
    for (const v of retraceTarget.vertices) {
      sumLat += v.lat;
      sumLng += v.lng;
    }
    const centerLat = sumLat / retraceTarget.vertices.length;
    const centerLng = sumLng / retraceTarget.vertices.length;
    try {
      await updateRacingAreaMutation.mutateAsync({
        id: retraceTarget.id,
        name: retraceTarget.name,
        centerLat,
        centerLng,
        radiusMeters: retraceTarget.radiusMeters ?? undefined,
        polygon: { type: 'Polygon', coordinates: [ring] },
        classesUsed: retraceTarget.classesUsed,
      });
      setRetraceTarget(null);
    } catch (err) {
      console.warn('[atlas] save retrace failed', err);
    }
  }, [retraceTarget, updateRacingAreaMutation]);
  const handleReshapeOnMap = useCallback((target: EditingRacingArea) => {
    const ring = target.polygon?.coordinates?.[0];
    if (!ring || ring.length < 4) return;
    // Drop the closing vertex (ring is [v1..vN, v1]) — handles are 1:1
    // with distinct corners.
    const vertices = ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
    setEditingArea(null);
    setReshapeTarget({ ...target, vertices, dirty: false, selectedIndex: null });
    // Fly to the area so the handles are actually in view — the edit
    // sheet can be opened from Manage areas with the camera elsewhere.
    setSearchFocus({ lat: target.centerLat, lng: target.centerLng });
  }, []);
  const handleReshapeVertexPress = useCallback((index: number) => {
    setReshapeTarget((prev) =>
      prev
        ? { ...prev, selectedIndex: prev.selectedIndex === index ? null : index }
        : prev,
    );
  }, []);
  const handleReshapeVertexDrag = useCallback(
    (index: number, coords: { lat: number; lng: number }) => {
      setReshapeTarget((prev) => {
        if (!prev || index < 0 || index >= prev.vertices.length) return prev;
        const vertices = prev.vertices.slice();
        vertices[index] = coords;
        return { ...prev, vertices, dirty: true };
      });
    },
    [],
  );
  const handleCancelReshape = useCallback(() => {
    const reverted = reshapeTarget
      ? {
          id: reshapeTarget.id,
          name: reshapeTarget.name,
          centerLat: reshapeTarget.centerLat,
          centerLng: reshapeTarget.centerLng,
          radiusMeters: reshapeTarget.radiusMeters,
          classesUsed: reshapeTarget.classesUsed,
          polygon: reshapeTarget.polygon,
        }
      : null;
    setReshapeTarget(null);
    if (reverted) setEditingArea(reverted);
  }, [reshapeTarget]);
  const handleSaveReshape = useCallback(async () => {
    if (!reshapeTarget || !reshapeTarget.dirty || reshapeTarget.vertices.length < 3) return;
    const ring: [number, number][] = reshapeTarget.vertices.map((v) => [v.lng, v.lat]);
    ring.push(ring[0]);
    let sumLat = 0;
    let sumLng = 0;
    for (const v of reshapeTarget.vertices) {
      sumLat += v.lat;
      sumLng += v.lng;
    }
    const centerLat = sumLat / reshapeTarget.vertices.length;
    const centerLng = sumLng / reshapeTarget.vertices.length;
    try {
      await updateRacingAreaMutation.mutateAsync({
        id: reshapeTarget.id,
        name: reshapeTarget.name,
        centerLat,
        centerLng,
        radiusMeters: reshapeTarget.radiusMeters ?? undefined,
        polygon: { type: 'Polygon', coordinates: [ring] },
        classesUsed: reshapeTarget.classesUsed,
      });
      setReshapeTarget(null);
    } catch (err) {
      console.warn('[atlas] save reshape failed', err);
    }
  }, [reshapeTarget, updateRacingAreaMutation]);
  const handleMoveOnMap = useCallback((target: EditingRacingArea) => {
    setEditingArea(null);
    setRepositionTarget({
      ...target,
      newLat: target.centerLat,
      newLng: target.centerLng,
    });
  }, []);
  const handleCancelReposition = useCallback(() => {
    // Reopen the edit form at the original area so the user doesn't
    // lose their place.
    const reverted = repositionTarget
      ? {
          id: repositionTarget.id,
          name: repositionTarget.name,
          centerLat: repositionTarget.centerLat,
          centerLng: repositionTarget.centerLng,
          radiusMeters: repositionTarget.radiusMeters,
          classesUsed: repositionTarget.classesUsed,
        }
      : null;
    setRepositionTarget(null);
    if (reverted) setEditingArea(reverted);
  }, [repositionTarget]);
  // While repositioning, paint a live preview at the candidate center.
  // If the area has a polygon shape (hand-traced), translate every
  // vertex by the (newLat-centerLat, newLng-centerLng) delta so the
  // shape rides with the new center. Otherwise fall back to a circle
  // preview using the stored radius.
  React.useEffect(() => {
    if (!repositionTarget) return;
    if (repositionTarget.polygon) {
      const dLat = repositionTarget.newLat - repositionTarget.centerLat;
      const dLng = repositionTarget.newLng - repositionTarget.centerLng;
      const translated: [number, number][][] = repositionTarget.polygon.coordinates.map(
        (ring) => ring.map(([lng, lat]) => [lng + dLng, lat + dLat]),
      );
      setAreaSheetPolygon({ type: 'Polygon', coordinates: translated });
      return () => setAreaSheetPolygon(null);
    }
    const polygon = shapeToPolygon({
      kind: 'circle',
      centerLat: repositionTarget.newLat,
      centerLng: repositionTarget.newLng,
      radiusMeters: repositionTarget.radiusMeters ?? 1500,
    });
    setAreaSheetPolygon(polygon);
    return () => setAreaSheetPolygon(null);
  }, [repositionTarget]);
  // While retracing, paint the in-flight polygon as the user adds
  // vertices. Needs ≥3 points to be a valid polygon; below that we
  // just clear the preview (the dots aren't visible yet — a future
  // pass could render them as standalone markers).
  React.useEffect(() => {
    if (!retraceTarget) return;
    if (retraceTarget.vertices.length < 3) {
      setAreaSheetPolygon(null);
      return;
    }
    const ring: [number, number][] = retraceTarget.vertices.map((v) => [v.lng, v.lat]);
    ring.push(ring[0]);
    setAreaSheetPolygon({ type: 'Polygon', coordinates: [ring] });
    return () => setAreaSheetPolygon(null);
  }, [retraceTarget]);
  // While reshaping, paint the live polygon as handles move.
  React.useEffect(() => {
    if (!reshapeTarget || reshapeTarget.vertices.length < 3) return;
    const ring: [number, number][] = reshapeTarget.vertices.map((v) => [v.lng, v.lat]);
    ring.push(ring[0]);
    setAreaSheetPolygon({ type: 'Polygon', coordinates: [ring] });
    return () => setAreaSheetPolygon(null);
  }, [reshapeTarget]);
  const handleSaveReposition = useCallback(async () => {
    if (!repositionTarget) return;
    // For polygon-shaped areas, translate every vertex by the delta so
    // the hand-traced shape rides with the new center. Without this
    // the mutation would store the original geometry against the new
    // center, leaving the polygon visibly disconnected from its name.
    let translatedPolygon: { type: 'Polygon'; coordinates: [number, number][][] } | undefined;
    if (repositionTarget.polygon) {
      const dLat = repositionTarget.newLat - repositionTarget.centerLat;
      const dLng = repositionTarget.newLng - repositionTarget.centerLng;
      translatedPolygon = {
        type: 'Polygon',
        coordinates: repositionTarget.polygon.coordinates.map((ring) =>
          ring.map(([lng, lat]) => [lng + dLng, lat + dLat] as [number, number]),
        ),
      };
    }
    try {
      await updateRacingAreaMutation.mutateAsync({
        id: repositionTarget.id,
        name: repositionTarget.name,
        centerLat: repositionTarget.newLat,
        centerLng: repositionTarget.newLng,
        radiusMeters: repositionTarget.radiusMeters ?? undefined,
        classesUsed: repositionTarget.classesUsed,
        polygon: translatedPolygon,
      });
      setRepositionTarget(null);
    } catch (err) {
      console.warn('[atlas] save reposition failed', err);
    }
  }, [repositionTarget, updateRacingAreaMutation]);
  const [searchOpen, setSearchOpen] = useState(false);
  // `bounds` is optional and only populated by geocoded place results;
  // when present, the canvas fits the camera to the extent (right zoom
  // for cities/neighborhoods/addresses) instead of hardcoded zoom 14.
  const [searchFocus, setSearchFocus] = useState<{
    lat: number;
    lng: number;
    bounds?: [number, number, number, number];
    zoom?: number;
  } | null>(handlers.initialFocus ?? null);
  // Sync searchFocus when handlers.initialFocus arrives async (e.g.
  // /(tabs)/atlas?orgSlug=... resolves the org's primary location
  // after first render). useState honors the initial value once, so
  // without this effect the camera never flew to a late-arriving
  // initialFocus — "Open map" from the org page landed on the default
  // HK overview instead of e.g. Baltimore for JHSON.
  React.useEffect(() => {
    if (handlers.initialFocus) {
      setSearchFocus(handlers.initialFocus);
    }
  }, [handlers.initialFocus]);
  // Step preview state — set when a step picked from search has
  // coords, so the camera flies AND a BottomSheet shows the step
  // detail with an "Open step" CTA that drills into /step/[id].
  // Keeps the user on Atlas (map-first surface). Cleared when the
  // user dismisses it or picks something else.
  const [stepPreview, setStepPreview] = useState<AtlasSearchResult | null>(null);
  // Org preview — mirrors stepPreview for organization search results
  // that carry a primary `organization_locations` lat/lng. Lets the
  // user see the org's main location on the map before drilling in.
  const [orgPreview, setOrgPreview] = useState<AtlasSearchResult | null>(null);
  const handleSearchSelect = useCallback((result: AtlasSearchResult) => {
    setSearchOpen(false);
    // People route to profile, steps to step detail, blueprint steps
    // to the blueprint — none of those carry coords, so no camera
    // move. Place results still fly to their lat/lng.
    if (result.kind === 'person' && result.userId) {
      router.push(`/profile/${result.userId}` as never);
      return;
    }
    if (result.kind === 'step' && result.stepId) {
      if (result.lat != null && result.lng != null) {
        // Step-with-location: keep the user on Atlas, fly the camera
        // and show a step-preview BottomSheet they can drill into.
        setSearchFocus({ lat: result.lat, lng: result.lng });
        setStepPreview(result);
        return;
      }
      // Location-less steps still route to /step/[id] so the user
      // can drill in — there's no map context to preserve.
      router.push(`/step/${result.stepId}` as never);
      return;
    }
    if (result.kind === 'blueprint_step' && result.blueprintId) {
      router.push(`/library/blueprints/${result.blueprintId}` as never);
      return;
    }
    if (result.kind === 'organization' && result.orgSlug) {
      if (result.lat != null && result.lng != null) {
        // Org has a primary `organization_locations` row — fly the
        // camera and surface a preview sheet. User can drill into
        // /organizations/[slug] from the sheet's CTA.
        setSearchFocus({ lat: result.lat, lng: result.lng });
        setOrgPreview(result);
        return;
      }
      router.push(`/organizations/${result.orgSlug}` as never);
      return;
    }
    if (result.kind === 'group' && result.groupId) {
      router.push(`/group/${result.groupId}` as never);
      return;
    }
    if (result.lat != null && result.lng != null) {
      setSearchFocus({ lat: result.lat, lng: result.lng, bounds: result.bounds });
    }
  }, []);
  // Compose-at-location: tap the + FAB to enter commit-mode, then any
  // tap on the map drops a candidate pin and rises the commit sheet.
  // Per the brief, this replaces the legacy SelectLocation modal — the
  // picker IS the real surface in a different mode. When arrived from
  // PlanWhereCard with ?fromPlan=1, we start ALREADY in commit-mode so
  // the user doesn't have to tap + after landing on Atlas.
  const [commitMode, setCommitMode] = useState(handlers.initialCommitMode ?? false);
  const [candidate, setCandidate] = useState<{ lng: number; lat: number } | null>(null);
  // Long-press on water opens the racing-area create sheet — the user
  // marks where racing happens even when their club isn't in BetterAt.
  const [areaSheetCenter, setAreaSheetCenter] = useState<{ lat: number; lng: number } | null>(null);
  // Stabilize the `center` reference passed to CreateRacingAreaSheet so
  // it doesn't generate a new {lat,lng} object literal on every render.
  // The sheet's useMemo(shape, [center, ...]) depended on identity, which
  // combined with the onShapeChange feedback up to AtlasScreen looped
  // forever once a tap-to-move handler became active. Keying on the raw
  // primitive lat/lng values eliminates the identity churn.
  const areaSheetCenterForSheet = useMemo(() => {
    if (editingArea) return { lat: editingArea.centerLat, lng: editingArea.centerLng };
    return areaSheetCenter;
  }, [editingArea, areaSheetCenter]);
  const initialCreateAreaConsumedRef = useRef(false);
  // Mirrors the create-sheet's current shape polygon (circle, rectangle, …)
  // so the canvas can paint a live preview as the user adjusts.
  const [areaSheetPolygon, setAreaSheetPolygon] = useState<GeoJSON.Polygon | null>(null);
  // Race-course authoring: opened from a racing area the user owns. Holds
  // the anchor area (id + center) and the live overlay preview the sheet
  // emits as the author dials in geometry.
  const [courseSheetArea, setCourseSheetArea] = useState<{
    id: string;
    lat: number;
    lng: number;
    defaultClass: string | null;
  } | null>(null);
  const [coursePreview, setCoursePreview] = useState<GeoJSON.FeatureCollection | null>(null);
  // Stabilize the `center` reference handed to CreateRaceCourseSheet, keyed
  // on the raw lat/lng. A fresh {lat,lng} literal each render re-fired the
  // sheet's previewCollection memo → onPreviewChange → setCoursePreview →
  // re-render, looping until "Maximum update depth exceeded" — the same
  // identity-churn trap CreateRacingAreaSheet solved with areaSheetCenterForSheet.
  const courseSheetCenter = useMemo(
    () => (courseSheetArea ? { lat: courseSheetArea.lat, lng: courseSheetArea.lng } : null),
    [courseSheetArea],
  );
  const handleAddCourse = useCallback((target: EditingRacingArea) => {
    // Hand off from the area edit sheet to the course sheet, anchored to
    // the area's center as the start-line seed.
    setEditingArea(null);
    setAreaSheetCenter(null);
    setCourseSheetArea({
      id: target.id,
      lat: target.centerLat,
      lng: target.centerLng,
      defaultClass: target.classesUsed[0] ?? null,
    });
  }, []);
  // Reverse-geocode the active commit-mode candidate so the "Pin
  // dropped" sheet reads "Near Hebe Haven" instead of raw coords.
  const { data: candidateNearest } = useNearestPlace({
    lat: candidate?.lat ?? null,
    lng: candidate?.lng ?? null,
    enabled: candidate !== null,
  });
  const candidateBody = useMemo(
    () => (candidate ? formatNearLabel(candidateNearest ?? null, candidate.lat, candidate.lng) : ''),
    [candidate, candidateNearest],
  );
  // Chip- and Layers-sheet-driven layer state. Overview owns peer
  // relationship filtering plus race-mark visibility only. Wind / tide
  // lives on the dedicated course frame; leaving it here made the chip
  // advertise data the overview no longer renders.
  const [showRaceMarks, setShowRaceMarks] = useState(true);
  const [showMarinas, setShowMarinas] = useState(false);
  const [showSailServices, setShowSailServices] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [showTide, setShowTide] = useState(false);
  const [showWaves, setShowWaves] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [showRaceAreas, setShowRaceAreas] = useState(true);
  const [showCourse, setShowCourse] = useState(true);
  const [basemap, setBasemap] = useState<AtlasBasemap>('map');
  // Nautical (seamarks) and Detailed (plain OSM) are the same raster base under
  // two craft-appropriate names — Nautical for sailing, Detailed for everyone
  // else. F1 stays mounted across an interest switch, so a stale cross-family
  // pick (Nautical selected as a sailor, then switch to golf) is coerced to the
  // sibling that the current interest actually offers.
  const effectiveBasemap = useMemo<AtlasBasemap>(() => {
    if (isSailingFrame && basemap === 'detailed') return 'nautical';
    if (!isSailingFrame && basemap === 'nautical') return 'detailed';
    return basemap;
  }, [basemap, isSailingFrame]);
  // Default the relationship lens to the same set exposed in the top chip row:
  // your own steps plus crew, fleet, and people you follow. Public peer steps
  // use the same pin tone as Following, so keeping this on by default prevents
  // public/followed Atlas steps from looking "missing" until a chip is toggled.
  const [peerRelationshipFilter, setPeerRelationshipFilter] = useState<Set<string> | null>(
    () => new Set(['you', 'crew', 'fleet', 'following']),
  );
  // Cluster peers by on-screen pixel proximity, not a fixed km radius. We
  // derive the merge threshold from the live zoom so it stays pixel-stable:
  // peers whose pins would visually collide (~44px apart) merge into one "+N"
  // badge; everyone else breaks out. At overview zoom the whole RHKYC pile
  // reads as a single density badge; as you zoom into the course, separated
  // peers split into individual tappable pins while truly-coincident peers
  // (same berth/start area) stay merged.
  const peerClusterLat = homeVenue?.lat ?? 22.295;
  const [peerClusterThresholdKm, setPeerClusterThresholdKm] = useState(2);
  const handleZoomChange = useCallback(
    (z: number) => {
      const metersPerPixel =
        (156543.03392 * Math.cos((peerClusterLat * Math.PI) / 180)) / Math.pow(2, z);
      const km = (44 * metersPerPixel) / 1000;
      // Snap to a coarse step so the pins memo only recomputes on a meaningful
      // zoom change, not on every zoom tick.
      setPeerClusterThresholdKm((prev) => (Math.abs(prev - km) < 0.05 ? prev : km));
    },
    [peerClusterLat],
  );
  // Institution POIs + peer step pins for the "near me" bbox. Center on the
  // user's home venue and query their active interest; fall back to the
  // Causeway Bay demo centroid (22.295, 114.18 = F1 camera preset, see
  // AtlasMapLibreCanvas.FRAME_CAMERA) only when no home venue is set.
  const restrictPeersToUserIds = useAffinityGroupMembers(activeGroupIds);
  // History chip — default map scope is the current arc's steps; this
  // opts older/other-arc own steps back in.
  const [showStepHistory, setShowStepHistory] = useState(false);
  const { pins: framePins, pickerSteps, archiveSteps, peerSteps, orgSteps } = useAtlasFramePins({
    lat: homeVenue?.lat ?? 22.295,
    lng: homeVenue?.lng ?? 114.18,
    interestSlug: currentInterest?.slug ?? 'sail-racing',
    radiusKm: 20,
    showMarinas,
    showSailServices,
    restrictPeersToUserIds,
    peerRelationshipFilter,
    peerClusterThresholdKm,
    includeStepHistory: showStepHistory,
  });
  const demoClubPin = useMemo<AtlasPinSpec | null>(() => {
    if (!isYachtClubDemoSlug(handlers.focusOrgSlug)) return null;
    return {
      id: 'demo-yacht-club-pin',
      kind: 'poi-club',
      label: YACHT_CLUB_DEMO_NAME,
      lat: YACHT_CLUB_DEMO_LOCATION.lat,
      lng: YACHT_CLUB_DEMO_LOCATION.lng,
      orgSlug: handlers.focusOrgSlug,
      subtitle: 'Synthetic club demo · public page, pricing, fleets, and map lens',
      provenance: 'Synthetic BetterAt demo data',
    };
  }, [handlers.focusOrgSlug]);
  const framePinsWithDemo = useMemo(
    () => (demoClubPin ? [...framePins, demoClubPin] : framePins),
    [demoClubPin, framePins],
  );
  const myNextStepPin = useMemo(
    () => framePinsWithDemo.find((pin) => pin.kind === 'my-step-next') ?? null,
    [framePinsWithDemo],
  );
  // Binary cockpit — wind & tide are race grammar. When the viewer's next
  // item is a race it keeps the course/conditions surface; every other item
  // is just a step and shows the step's "how" checklist and saved beats.
  const cockpitIsRace = myNextStepPin?.isRace ?? false;
  const cockpitShowsChecklist = !!myNextStepPin && !cockpitIsRace;
  // Do not auto-open the generic NEXT step on Atlas entry. Atlas restores the
  // last explicitly selected step instead; if none exists, it starts map-only.
  const showAmbientNextStepCockpit = false;
  const cockpitStep = useAtlasCockpitStep(
    showAmbientNextStepCockpit && cockpitShowsChecklist ? (myNextStepPin?.stepId ?? null) : null,
  );
  // When the checklist cockpit owns the next step, it already renders that
  // ONE step — so tapping the my-step-NEXT pin is suppressed to avoid stacking
  // a duplicate "YOUR NEXT STEP" card under the cockpit. Every OTHER pin still
  // opens its own sheet, including the viewer's done/planned step pins: tapping
  // a completed-step marker must show THAT step, not silently defer to the
  // cockpit's next step (which reads as "this marker is the next step").
  const cockpitOwnsNext = cockpitShowsChecklist;
  // Atlas opens like a maps app: unfocused, at the last-viewed camera.
  // The viewer's NEXT step no longer hijacks the camera on open — fly-to
  // is reserved for explicit acts (tapping the NEXT pin, search, a step
  // pick). Restore the persisted center+zoom once; 'none' lets the
  // home-venue fallback below take over for first-ever opens.
  const [lastCameraRestore, setLastCameraRestore] = useState<'pending' | 'restored' | 'none'>(
    'pending',
  );
  React.useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(ATLAS_F1_LAST_CAMERA_KEY).then((raw) => {
      if (cancelled) return;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { lat?: number; lng?: number; zoom?: number };
          if (
            typeof parsed.lat === 'number' && Number.isFinite(parsed.lat) &&
            typeof parsed.lng === 'number' && Number.isFinite(parsed.lng)
          ) {
            // Don't clobber an explicit focus that beat us here (deep link
            // via initialFocus, or an eager search) — restore is a default,
            // never an override.
            setSearchFocus((prev) =>
              prev ?? {
                lat: parsed.lat as number,
                lng: parsed.lng as number,
                zoom: typeof parsed.zoom === 'number' && Number.isFinite(parsed.zoom)
                  ? parsed.zoom
                  : undefined,
              },
            );
            setLastCameraRestore('restored');
            return;
          }
        } catch {
          // fall through to 'none'
        }
      }
      setLastCameraRestore('none');
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // Nothing persisted yet (first open)? Center on the viewer's home venue
  // once so Atlas opens where they actually are, not the Causeway Bay demo
  // centroid baked into the F1 camera preset. One-shot so panning away
  // doesn't snap back.
  const autoCenteredHomeRef = React.useRef(false);
  React.useEffect(() => {
    if (autoCenteredHomeRef.current) return;
    if (lastCameraRestore !== 'none') return;
    if (homeVenue?.lat == null || homeVenue?.lng == null) return;
    autoCenteredHomeRef.current = true;
    setSearchFocus((prev) => prev ?? { lat: homeVenue.lat as number, lng: homeVenue.lng as number });
  }, [lastCameraRestore, homeVenue]);
  const focusedClubPin = useMemo(
    () =>
      handlers.focusOrgSlug
        ? framePinsWithDemo.find((pin) => pin.orgSlug === handlers.focusOrgSlug) ?? null
        : null,
    [framePinsWithDemo, handlers.focusOrgSlug],
  );
  // Pin tap target — when a race-mark / POI / peer pin is tapped, store
  // it so the bottom sheet can swap from the default "Plan a step" CTA
  // to a context-specific detail card. Null = default sheet.
  const [selectedPin, setSelectedPin] = useState<AtlasPinSpec | null>(null);
  const [lastAtlasStepId, setLastAtlasStepId] = useState<string | null | undefined>(undefined);
  const restoredLastStepRef = useRef<string | null>(null);
  const persistLastAtlasStep = useCallback(
    (stepId: string | null | undefined) => {
      const trimmed = stepId?.trim();
      if (!trimmed) return;
      void AsyncStorage.setItem(lastAtlasStepStorageKey, trimmed).catch(() => {});
    },
    [lastAtlasStepStorageKey],
  );
  const selectableStepPin = useCallback((pin: AtlasPinSpec, prefix: string): AtlasPinSpec => {
    if (pin.kind !== 'my-step-next') return pin;
    return {
      ...pin,
      id: `${prefix}-${pin.id}`,
      kind: 'my-step-planned',
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLastAtlasStepId(undefined);
    restoredLastStepRef.current = null;
    void AsyncStorage.getItem(lastAtlasStepStorageKey)
      .then((value) => {
        if (!cancelled) setLastAtlasStepId(value?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) setLastAtlasStepId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [lastAtlasStepStorageKey]);
  useEffect(() => {
    if (!lastAtlasStepId) return;
    if (restoredLastStepRef.current === lastAtlasStepId) return;
    if (selectedPin) return;
    if (
      handlers.initialFocusStepId ||
      handlers.initialPeerFocus ||
      handlers.focusOrgSlug ||
      handlers.initialCommitMode ||
      handlers.initialCreateRacingArea
    ) {
      return;
    }
    if (framePinsWithDemo.length === 0) return;
    const pin = framePinsWithDemo.find((candidatePin) => candidatePin.stepId === lastAtlasStepId);
    if (!pin) return;
    restoredLastStepRef.current = lastAtlasStepId;
    setLayersOpen(false);
    setSelectedPin(selectableStepPin(pin, 'restored'));
    setSearchFocus({ lat: pin.lat, lng: pin.lng });
  }, [
    framePinsWithDemo,
    handlers.focusOrgSlug,
    handlers.initialCommitMode,
    handlers.initialCreateRacingArea,
    handlers.initialFocusStepId,
    handlers.initialPeerFocus,
    lastAtlasStepId,
    selectableStepPin,
    selectedPin,
  ]);
  useEffect(() => {
    persistLastAtlasStep(selectedPin?.stepId ?? selectedPin?.peer?.stepId ?? null);
  }, [persistLastAtlasStep, selectedPin?.peer?.stepId, selectedPin?.stepId]);
  const selectedStepId =
    selectedPin && isUserStepPin(selectedPin) && !isRaceStepPin(selectedPin)
      ? selectedPin.stepId ?? null
      : null;
  const selectedStepDetail = useAtlasCockpitStep(selectedStepId);
  const selectedRaceStepOpen = Boolean(selectedPin && isRaceStepPin(selectedPin));
  const selectedRaceStartAt =
    selectedPin && isRaceStepPin(selectedPin) ? selectedPin.raceStartAt ?? null : null;
  const selectedPickerStepId =
    selectedPin && (isUserStepPin(selectedPin) || isRaceStepPin(selectedPin))
      ? selectedPin.stepId ?? null
      : null;
  const topStepPickerStepId = useMemo(() => {
    if (selectedPickerStepId) return selectedPickerStepId;
    if (myNextStepPin?.stepId) return myNextStepPin.stepId;
    return (
      pickerSteps.find((step) => step.status === 'planned-next')?.step_id ??
      pickerSteps[0]?.step_id ??
      null
    );
  }, [myNextStepPin?.stepId, pickerSteps, selectedPickerStepId]);
  const topStepPillLabel = useMemo(() => {
    const index = pickerSteps.findIndex((s) => s.step_id === topStepPickerStepId);
    if (index < 0 || pickerSteps.length === 0) return 'Steps';
    return `${index + 1} of ${pickerSteps.length}`;
  }, [pickerSteps, topStepPickerStepId]);
  React.useEffect(() => {
    if (focusedClubPin) setSelectedPin(focusedClubPin);
  }, [focusedClubPin]);
  const initialFocusStepConsumedRef = useRef<string | null>(null);
  React.useEffect(() => {
    const stepId = handlers.initialFocusStepId;
    if (!stepId || initialFocusStepConsumedRef.current === stepId) return;
    const pin = framePinsWithDemo.find((candidatePin) => candidatePin.stepId === stepId);
    if (!pin) return;
    initialFocusStepConsumedRef.current = stepId;
    setLayersOpen(false);
    setSelectedPin(pin);
    setSearchFocus(
      handlers.initialFocus
        ? { lat: handlers.initialFocus.lat, lng: handlers.initialFocus.lng }
        : { lat: pin.lat, lng: pin.lng },
    );
  }, [handlers.initialFocus, handlers.initialFocusStepId, framePinsWithDemo]);
  React.useEffect(() => {
    if (!handlers.initialCreateRacingArea || initialCreateAreaConsumedRef.current) return;
    initialCreateAreaConsumedRef.current = true;
    const seed = handlers.initialFocus ?? searchFocus ?? { lat: 22.295, lng: 114.18 };
    setLayersOpen(false);
    setManageAreasOpen(false);
    setSelectedPin(null);
    setAreaSheetCenter({ lat: seed.lat, lng: seed.lng });
    setSearchFocus({ lat: seed.lat, lng: seed.lng });
  }, [handlers.initialCreateRacingArea, handlers.initialFocus, searchFocus]);
  const handlePinPress = useCallback((pin: AtlasPinSpec) => {
    // History-on-the-water pins ARE a past race step — go straight to it
    // (its review is what the note bubble previews) instead of a callout.
    if ((pin.kind === 'race-note' || pin.kind === 'race-history') && pin.stepId) {
      router.push(`/step/${pin.stepId}` as never);
      return;
    }
    // Auto-close the Layers sheet when a pin is tapped so the detail
    // sheet doesn't render inside / behind the Layers panel.
    setLayersOpen(false);
    setKnowledgeArea(null);
    // The checklist cockpit owns the NEXT step's surface AND only renders
    // while no pin is selected — selecting the suppressed NEXT pin would
    // unmount the cockpit and render no sheet (a dead-end tap). Instead,
    // restore the full cockpit: that IS this pin's detail surface.
    if (pin.kind === 'my-step-next' && cockpitOwnsNext) {
      setSelectedPin(selectableStepPin(pin, 'selected'));
      return;
    }
    setSelectedPin(pin);
  }, [cockpitOwnsNext, selectableStepPin]);
  // A peer broken out of a privacy cluster on demand (tapped in the cluster
  // drill-down list or the Nearby list). Rendered as one extra highlighted
  // pin so "8 nearby" stops being a dead-end count — you can see exactly
  // where that one sailor is and open their callout.
  const [focusedPeer, setFocusedPeer] = useState<AtlasPeerMember | null>(null);
  const focusPeerMember = useCallback((member: AtlasPeerMember) => {
    setLayersOpen(false);
    // A peer tap must land on the map — on F1 the Sites/Capabilities segments
    // render over the map, so without this the camera flies and the callout
    // opens underneath the active surface (the tap looks like a no-op).
    setF1View('map');
    // Clear any open area-sheet center — it outranks searchFocus in the
    // canvas's focusLocation, so a stale value would swallow the fly-to.
    setAreaSheetCenter(null);
    setFocusedPeer(member);
    setSearchFocus({ lat: member.lat, lng: member.lng });
    setSelectedPin({
      id: `peer-focus:${member.stepId}`,
      lat: member.lat,
      lng: member.lng,
      kind: relationshipToPeerKind(member.relationship),
      peer: member,
    });
  }, []);
  const clearSelectedPin = useCallback(() => {
    setSelectedPin(null);
    setFocusedPeer(null);
  }, []);
  // The step↔site cross-link (STEP callout "View <venue>" jump + the venue
  // callout's "N of your steps here" list + tap-to-open). Same hook nursing
  // uses; sailing's "sites" are venues / racing areas / clubs. Drawn from the
  // full located set so older seasons still resolve. Stays dark until steps
  // carry a where_location.poi_id (or sit within the fold grain of a venue).
  const crossLinkSteps = useMemo(
    () => [...pickerSteps, ...archiveSteps],
    [pickerSteps, archiveSteps],
  );
  const { openStepById, siteForSelectedStep, myStepsAtSelectedPoi } = useFrameStepSiteLinks({
    framePins: framePinsWithDemo,
    steps: crossLinkSteps,
    selectedPin,
    setSelectedPin,
    onFocusLocation: setSearchFocus,
    onStepPress: handlers.onStepPress,
  });
  // Racing areas are first-class sites too (groups share knowledge + steps
  // there), but they render as polygons selected into `knowledgeArea`, not as
  // framePins — so the hook above can't see them. List the viewer's steps at
  // the open area the same way, keyed on the area's poi_id / centroid.
  const myStepsAtArea = useMemo<NonNullable<AtlasPinSpec['stackedSteps']>>(() => {
    if (!knowledgeArea) return [];
    return stepsAtSiteAnchor(crossLinkSteps, {
      id: knowledgeArea.id,
      lat: knowledgeArea.centerLat,
      lng: knowledgeArea.centerLng,
    });
  }, [knowledgeArea, crossLinkSteps]);
  // When the Nearby list passes peer identity through the route params, break
  // that one peer out of the cluster the same way a drill-down tap does.
  React.useEffect(() => {
    if (handlers.initialPeerFocus) focusPeerMember(handlers.initialPeerFocus);
  }, [handlers.initialPeerFocus, focusPeerMember]);
  // Ashore cockpit ⇄ pill. The cockpit and any bottom sheet both anchor to
  // the bottom, so a tall sheet (a tapped POI / dropped pin) grows up into
  // the cockpit and covers its buttons. Fix: the cockpit yields the bottom
  // slot — it collapses to a slim top pill whenever a bottom sheet is open
  // (auto), or when the user taps its collapse chevron (manual). Tapping the
  // pill restores the full cockpit (and dismisses any open POI sheet so the
  // two don't immediately re-collide).
  const [cockpitManuallyCollapsed, setCockpitManuallyCollapsed] = useState(false);
  // Fully closed (no pill) — distinct from collapsed. Tapping the NEXT
  // pin on the map brings it back, as does a new next step.
  const [cockpitDismissed, setCockpitDismissed] = useState(false);
  React.useEffect(() => {
    setCockpitDismissed(false);
  }, [myNextStepPin?.stepId]);
  // A bottom sheet visibly occupies the bottom slot when a step preview, a
  // dropped-pin candidate, or a (non-suppressed) selected pin is showing —
  // mirror the render conditions below so the cockpit knows to yield.
  const aBottomSheetOpen =
    !!stepPreview ||
    !!candidate ||
    !!knowledgeArea ||
    (!!selectedPin && !(cockpitOwnsNext && selectedPin.kind === 'my-step-next'));
  const cockpitCollapsed = cockpitManuallyCollapsed || aBottomSheetOpen;
  const toggleCockpitCollapsed = useCallback(() => {
    if (cockpitCollapsed) {
      // Expanding from the pill: clear any open POI sheet so it can't
      // immediately re-collide with the restored full cockpit.
      setSelectedPin(null);
      setCockpitManuallyCollapsed(false);
    } else {
      setCockpitManuallyCollapsed(true);
    }
  }, [cockpitCollapsed]);
  // Tap-to-anchor flow: when the user picks a step without a place,
  // we enter "tap the map to anchor STEP here" mode. Reuses the same
  // banner/save-bar plumbing as racing-area reposition, just writing
  // to timeline_steps.location_lat/lng instead of the racing-area POI.
  const [anchorStepTarget, setAnchorStepTarget] = useState<{
    stepId: string;
    title: string;
    newLat: number | null;
    newLng: number | null;
  } | null>(null);
  const updateStepLocationMutation = useUpdateStepLocation();
  const handlePickStepFromPicker = useCallback(
    (step: PickerStep) => {
      setSavedSheetOpen(false);
      if (step.has_place && step.lat != null && step.lng != null) {
        // Recenter the map AND swap the bottom sheet to show this step's
        // detail. We find the existing my-step-* pin for this step and
        // set it as selectedPin so the "YOUR STEP" sheet renders with
        // title + body + Open step CTA — same as if the user tapped the
        // pin directly on the canvas.
        setSearchFocus({ lat: step.lat, lng: step.lng });
        const matchingPin = framePinsWithDemo.find(
          (pin) => pin.stepId === step.step_id,
        );
        if (matchingPin) {
          // The ambient next-step cockpit owns `my-step-next`, so the selected
          // sheet branch suppresses that kind to avoid duplicate cards. A
          // picker tap is explicit navigation, though: show the selected
          // step/race sheet by reusing the pin data under a non-suppressed
          // my-step kind.
          setSelectedPin(
            matchingPin.kind === 'my-step-next'
              ? {
                  ...matchingPin,
                  id: `picked-${matchingPin.id}`,
                  kind: 'my-step-planned',
                }
              : matchingPin,
          );
        } else {
          // No my-step-* pin renders for this step (e.g. status filtered
          // out, or the canvas refetch hasn't landed yet). Synthesize a
          // minimal pin so the sheet still updates immediately.
          setSelectedPin({
            id: `picked-${step.step_id}`,
            lat: step.lat,
            lng: step.lng,
            kind: 'my-step-planned',
            label: step.title,
            stepId: step.step_id,
          });
        }
        return;
      }
      // No place yet — start anchor mode rather than opening the step.
      setAnchorStepTarget({
        stepId: step.step_id,
        title: step.title,
        newLat: null,
        newLng: null,
      });
    },
    [framePinsWithDemo],
  );
  const handleCancelAnchorStep = useCallback(() => {
    setAnchorStepTarget(null);
  }, []);
  // ── ★ Saved dropdown wiring (mockup #39 frame B) ──────────────────────
  // Distances are measured from where the user is currently looking.
  const savedCenter = useMemo(
    () =>
      searchFocus
        ? { lat: searchFocus.lat, lng: searchFocus.lng }
        : homeVenue?.lat != null && homeVenue?.lng != null
          ? { lat: homeVenue.lat, lng: homeVenue.lng }
          : null,
    [searchFocus, homeVenue?.lat, homeVenue?.lng],
  );
  const savedRacingAreaItems = useMemo<SavedPlaceItem[]>(
    () =>
      myRacingAreas.map((area) => ({
        id: area.id,
        name: area.areaName,
        lat: area.centerLat,
        lng: area.centerLng,
        subtitle: area.typicalCourses?.[0] ?? null,
      })),
    [myRacingAreas],
  );
  const savedVenueItems = useMemo<SavedPlaceItem[]>(
    () =>
      savedVenues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        // SavedVenueWithDetails.coordinates is [lng, lat].
        lat: venue.coordinates?.[1] ?? null,
        lng: venue.coordinates?.[0] ?? null,
        isHome: venue.is_home_venue,
      })),
    [savedVenues],
  );
  const handlePickSavedPlace = useCallback((item: SavedPlaceItem) => {
    setSavedSheetOpen(false);
    if (item.lat != null && item.lng != null) {
      setSearchFocus({ lat: item.lat, lng: item.lng });
    }
  }, []);
  // ALL my steps → per-arc sections in the Saved sheet, current arc first
  // and expanded (the user cares most about the current arc). Near-now
  // picker steps sort ahead of archive steps within each arc.
  // Arc membership mirrors the timeline's resolution order
  // (realDataAdapter): explicit metadata.season_id move → date containment
  // (newest-first wins overlaps; end_date made inclusive) → season_id
  // column → nearest arc in time. Unresolvable steps land in EARLIER.
  const { data: allSeasons = [] } = useUserSeasons();
  const { data: currentSeason } = useCurrentSeason();
  const arcGroups = useMemo<ArcStepGroup[]>(() => {
    const entries: (ArchivePickerStep & ArcStepEntry)[] = [...pickerSteps, ...archiveSteps];
    if (entries.length === 0) return [];
    const knownIds = new Set(allSeasons.map((s) => s.id));
    const DAY_MS = 24 * 3600 * 1000;
    const windowSeasons = allSeasons
      .filter((s) => s.start_date && s.end_date)
      .sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date));
    const resolveArc = (step: ArchivePickerStep): string | null => {
      if (step.meta_season_id && knownIds.has(step.meta_season_id)) return step.meta_season_id;
      const t = Date.parse(step.starts_at ?? step.created_at);
      let nearest: { id: string; dist: number } | null = null;
      if (!Number.isNaN(t)) {
        for (const s of windowSeasons) {
          const start = Date.parse(s.start_date);
          const end = Date.parse(s.end_date) + DAY_MS;
          if (t >= start && t < end) return s.id;
          const dist = t < start ? start - t : t - end;
          if (!nearest || dist < nearest.dist) nearest = { id: s.id, dist };
        }
      }
      if (step.season_id && knownIds.has(step.season_id)) return step.season_id;
      return nearest?.id ?? null;
    };
    const byArc = new Map<string, (ArchivePickerStep & ArcStepEntry)[]>();
    for (const step of entries) {
      const arcId = resolveArc(step) ?? 'earlier';
      const bucket = byArc.get(arcId);
      if (bucket) bucket.push(step);
      else byArc.set(arcId, [step]);
    }
    // Rows within an arc mirror the Practice timeline's display order.
    for (const bucket of byArc.values()) {
      bucket.sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return Date.parse(a.created_at) - Date.parse(b.created_at);
      });
    }
    // Current arc first, then remaining arcs newest-first, EARLIER last.
    const orderedSeasons = [...allSeasons].sort(compareSeasonsByStartDate).reverse();
    if (currentSeason?.id) {
      const idx = orderedSeasons.findIndex((s) => s.id === currentSeason.id);
      if (idx > 0) orderedSeasons.unshift(orderedSeasons.splice(idx, 1)[0]);
    }
    const groups: ArcStepGroup[] = [];
    for (const season of orderedSeasons) {
      const steps = byArc.get(season.id);
      if (!steps || steps.length === 0) continue;
      const isCurrent = season.id === currentSeason?.id;
      groups.push({
        id: season.id,
        label: isCurrent ? `${season.name} · current arc` : season.name,
        isCurrent,
        steps,
      });
    }
    const earlier = byArc.get('earlier');
    if (earlier && earlier.length > 0) {
      groups.push({ id: 'earlier', label: 'Earlier', steps: earlier });
    }
    return groups;
  }, [pickerSteps, archiveSteps, allSeasons, currentSeason?.id]);
  // Peer steps → relationship-grouped rows. Map the data-layer relationship
  // enum (self/crew/cohort/fleet/following/public) onto the four list groups;
  // drop `self` (already covered by MY STEPS).
  const relationshipStepItems = useMemo<RelationshipStepItem[]>(() => {
    const REL_MAP: Record<string, PeerRelationship | null> = {
      self: null,
      crew: 'crew',
      fleet: 'fleet',
      cohort: 'following',
      following: 'following',
      public: 'nearby',
    };
    return peerSteps.reduce<RelationshipStepItem[]>((acc, peer) => {
      const relationship = REL_MAP[peer.relationship];
      if (!relationship) return acc;
      const title =
        peer.step_title?.trim() ||
        readablePeerPlaceName(peer.preview_name) ||
        `${peer.set_by_name ?? 'A sailor'}'s step`;
      acc.push({
        id: peer.step_id,
        title,
        relationship,
        lat: peer.lat,
        lng: peer.lng,
        by: peer.set_by_name,
      });
      return acc;
    }, []);
  }, [peerSteps]);
  const orgStepItems = useMemo<SavedPlaceItem[]>(
    () =>
      orgSteps.map((org) => ({
        id: org.step_id,
        name: org.title ?? org.place_name ?? 'Group step',
        lat: org.lat,
        lng: org.lng,
        subtitle: org.org_name ?? org.blueprint_title ?? null,
      })),
    [orgSteps],
  );
  const handlePickPeerStep = useCallback(
    (item: RelationshipStepItem) => {
      setSavedSheetOpen(false);
      // Break the peer out like a cluster drill-down: highlighted pin +
      // callout. A bare fly-to lands on an 8pt relationship dot the eye
      // can't find, and nothing on screen names the step you tapped.
      const peer = peerSteps.find((p) => p.step_id === item.id);
      if (peer) {
        focusPeerMember({
          stepId: peer.step_id,
          relationship: peer.relationship,
          name: peer.set_by_name ?? null,
          stepTitle: peer.step_title ?? null,
          placeName: peer.preview_name ?? null,
          setAt: peer.set_at ?? null,
          lat: peer.lat,
          lng: peer.lng,
        });
        return;
      }
      setSearchFocus({ lat: item.lat, lng: item.lng });
    },
    [peerSteps, focusPeerMember],
  );
  const handleAddPlaceInView = useCallback(() => {
    setSavedSheetOpen(false);
    if (savedCenter) {
      // Reuse the existing "save this water" flow — drop a racing area at
      // the current map center.
      setAreaSheetCenter({ lat: savedCenter.lat, lng: savedCenter.lng });
    }
  }, [savedCenter]);
  const handleSaveAnchorStep = useCallback(async () => {
    if (
      !anchorStepTarget ||
      anchorStepTarget.newLat == null ||
      anchorStepTarget.newLng == null
    ) {
      return;
    }
    try {
      await updateStepLocationMutation.mutateAsync({
        stepId: anchorStepTarget.stepId,
        lat: anchorStepTarget.newLat,
        lng: anchorStepTarget.newLng,
      });
      setAnchorStepTarget(null);
    } catch (err) {
      console.warn('[atlas] save anchor step failed', err);
    }
  }, [anchorStepTarget, updateStepLocationMutation]);
  const visibleFramePins = useMemo(() => {
    if (!handlers.focusOrgSlug) return framePinsWithDemo;
    const allowPeerKind = (kind: AtlasPinSpec['kind']) =>
      kind === 'you'
      || kind === 'crew'
      || kind === 'fleet'
      || kind === 'following'
      || kind === 'my-step-next'
      || kind === 'my-step-planned'
      || kind === 'my-step-done-just'
      || kind === 'my-step-done-recent'
      || kind === 'my-step-done-old';
    return framePinsWithDemo.filter((pin) => {
      if (allowPeerKind(pin.kind)) return true;
      if (pin.kind === 'poi-racing-area') return true;
      if (pin.kind === 'poi-club' || pin.kind === 'poi-club-anchor') {
        return pin.orgSlug === handlers.focusOrgSlug;
      }
      return pin.orgSlug === handlers.focusOrgSlug;
    });
  }, [framePinsWithDemo, handlers.focusOrgSlug]);
  // Race-marks layer — when the next event is a regatta, fetch its
  // earliest race_event's marks and merge into the pin set. Renders as
  // numbered amber pins per the design's pin grammar.
  const { data: raceMarkPins = [] } = useNextRaceMarks({
    regattaId: next?.event_kind === 'regatta' ? next.event_id : null,
  });
  const openLayersSheet = useCallback(() => {
    // Layers is mutually exclusive with all the bottom-sheet variants —
    // render suppression below hides any active pin sheet while preserving
    // selection, so closing Layers returns to the same step/race.
    setCommitMode(false);
    setCandidate(null);
    setLayersOpen(true);
  }, []);
  // Mockup #39 — the two selectors (WHAT all-steps/races + WHOSE relationship)
  // collapse into ONE relationship-first lens strip. The hero jobs are mapping
  // your own steps (My steps, on by default) and seeing the steps of people you
  // follow & know (Crew/Fleet/Following), with Races as a trailing filter.
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>(['you', 'crew', 'fleet', 'following']);
  // false = all steps; true = show only race pins (steps that carry
  // course/marks/conditions). Driven by the same merged strip now.
  const [raceOnly, setRaceOnly] = useState(false);
  const [dismissedRaceTimeEventKey, setDismissedRaceTimeEventKey] = useState<string | null>(null);
  const handleChipsChange = useCallback((activeIds: string[]) => {
    setActiveFilterIds(activeIds);
    const races = activeIds.includes('races');
    setRaceOnly(races);
    setShowStepHistory(activeIds.includes('history'));
    // Race marks ride with the Races lens (course geometry draws when Races is on).
    setShowRaceMarks(races || activeIds.includes('race-marks'));
    // Peer filter is the active relationship chips as an allow-list. An empty
    // selection means "all dots off" — users read unchecked chips as hidden,
    // so an empty Set (hide every relationship pin) honors that, not null
    // (show everyone). The NEXT pin stays: it backs the persistent cockpit HUD.
    const peerChips = activeIds.filter((id) =>
      ['you', 'crew', 'fleet', 'following'].includes(id),
    );
    setPeerRelationshipFilter(new Set(peerChips));
    if (races) {
      const exactRacePin =
        next?.event_kind === 'race_step' && next.event_id
          ? framePinsWithDemo.find((pin) => pin.isRace && pin.stepId === next.event_id)
          : null;
      const fallbackRacePin = framePinsWithDemo.find((pin) => pin.isRace && isUserStepPin(pin));
      const racePin = exactRacePin ?? fallbackRacePin;
      if (racePin) {
        setLayersOpen(false);
        setSelectedPin(selectableStepPin(racePin, 'race-filter'));
        setSearchFocus({ lat: racePin.lat, lng: racePin.lng });
      }
    }
  }, [framePinsWithDemo, next?.event_id, next?.event_kind, selectableStepPin]);
  // Mirror layers/chips into the controlled keys the LayersSheet reads.
  const controlledLayerKeys = useMemo(() => {
    const out = new Set<string>();
    if (showRaceMarks) out.add('sailing.race_marks');
    if (showMarinas) out.add('sailing.marinas');
    if (showSailServices) out.add('sailing.sail_services');
    if (showWind) out.add('sailing.wind');
    if (showTide) out.add('sailing.tide');
    if (showWaves) out.add('sailing.waves');
    if (showRaceAreas) out.add('sailing.race_areas');
    if (showCourse) out.add('sailing.course');
    return out;
  }, [showRaceMarks, showMarinas, showSailServices, showWind, showTide, showWaves, showRaceAreas, showCourse]);
  const handleLayerToggle = useCallback((key: string, on: boolean) => {
    if (key === 'sailing.race_marks') setShowRaceMarks(on);
    if (key === 'sailing.marinas') setShowMarinas(on);
    if (key === 'sailing.sail_services') setShowSailServices(on);
    if (key === 'sailing.wind') setShowWind(on);
    if (key === 'sailing.tide') setShowTide(on);
    if (key === 'sailing.waves') setShowWaves(on);
    if (key === 'sailing.race_areas') setShowRaceAreas(on);
    if (key === 'sailing.course') setShowCourse(on);
  }, []);
  // Map-center-following wind & tide. The user pans, MapLibre's
  // onRegionDidChange updates `mapCenter`, Open-Meteo returns the
  // marine snapshot for that water, and the overlay hooks paint
  // arrow grids around the new center. Defaults to the next-race
  // venue centroid so we have something to draw before the user
  // moves the map.
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: next?.lat ?? 22.2978,
    lng: next?.lng ?? 114.185,
  });
  // Persist every settled pan/zoom so the next Atlas open restores it.
  const handleMapCenterChange = useCallback(
    (coords: { lat: number; lng: number; zoom?: number }) => {
      setMapCenter({ lat: coords.lat, lng: coords.lng });
      void AsyncStorage.setItem(ATLAS_F1_LAST_CAMERA_KEY, JSON.stringify(coords));
    },
    [],
  );
  const { data: marineSnapshot } = useMarineSnapshot({
    lat: mapCenter.lat,
    lng: mapCenter.lng,
    enabled: showWind || showTide || showWaves || selectedRaceStepOpen || knowledgeArea !== null,
    targetTime: selectedRaceStepOpen ? selectedRaceStartAt : null,
  });
  const { data: raceTrendWindow } = useMarineTrendWindow({
    lat: mapCenter.lat,
    lng: mapCenter.lng,
    targetTime: selectedRaceStartAt,
    enabled: selectedRaceStepOpen && !!selectedRaceStartAt,
  });
  // Race-time window for the NEXT race (V.1) — when the upcoming race is
  // inside Open-Meteo's 16-day horizon, the wind/tide scrubber re-anchors
  // from "now + projections" to real hourly forecasts across the race
  // window, with the start hour as the scrubber's home position.
  const nextRaceWindow = useVenueRaceWindow({
    lat: next?.lat ?? null,
    lng: next?.lng ?? null,
    startsAt: next?.starts_at ?? null,
    // Always on when a race is upcoming — the top-chrome RaceTimeBar
    // renders from this window, not just the layer-toggled overlays.
    enabled: !!next?.starts_at,
  });
  // Race-time conditions for the venue-mastery sheet — only when the tapped
  // racing area is the one hosting the viewer's next race; otherwise the
  // sheet shows honest "now" conditions instead.
  const knowledgeAreaRaceTime = useMemo(() => {
    if (!knowledgeArea || !next?.area_poi_id || knowledgeArea.id !== next.area_poi_id) {
      return null;
    }
    if (nextRaceWindow.status !== 'ok') return null;
    const point =
      nextRaceWindow.points[nextRaceWindow.startIndex >= 0 ? nextRaceWindow.startIndex : 0];
    if (!point) return null;
    return {
      whenLabel: next.when ?? formatScrubClock(point.iso),
      point,
      flipLabel: nextRaceWindow.tideFlip
        ? `Tide flips ~${formatScrubClock(nextRaceWindow.tideFlip.atIso)}`
        : null,
    };
  }, [knowledgeArea, next, nextRaceWindow]);
  // Race-week window for the fleet "N of M boats in" count — only when the
  // tapped area hosts the viewer's next race (that's the date we know).
  const knowledgeAreaRaceWeek = useMemo(() => {
    if (!knowledgeArea || !next?.starts_at || !next.area_poi_id) return null;
    if (knowledgeArea.id !== next.area_poi_id) return null;
    const start = new Date(next.starts_at);
    if (Number.isNaN(start.getTime())) return null;
    const DAY = 24 * 60 * 60 * 1000;
    return {
      startIso: new Date(start.getTime() - 3 * DAY).toISOString(),
      endIso: new Date(start.getTime() + 3 * DAY).toISOString(),
    };
  }, [knowledgeArea, next]);
  // Fleet stats for the selected racing area. Same query key the venue
  // sheet uses, so React Query dedupes — this read just feeds the
  // venue-expert map pin.
  const { data: knowledgeAreaFleetStats } = useFleetVenueStats({
    areaPoiId: knowledgeArea?.id ?? null,
    eventWindow: knowledgeAreaRaceWeek,
  });
  // CTA brief (mock parity) — the one-line "what to set up for" under the
  // Plan-prep label: rig target from the race-start wind, a drill partner
  // (the fleetmate who knows this water best), plus the flip.
  const venuePrepSublabel = useMemo(() => {
    if (!knowledgeAreaRaceTime) return null;
    const parts: string[] = [];
    const w = knowledgeAreaRaceTime.point.wind;
    if (w) parts.push(`rig for ${Math.round(w.knots)} kn ${compassFromDegrees(w.degrees)}`);
    const top = knowledgeAreaFleetStats?.fleetmates[0];
    if (top) parts.push(`drill with ${top.displayName.split(' ')[0]}`);
    if (knowledgeAreaRaceTime.flipLabel) {
      parts.push(knowledgeAreaRaceTime.flipLabel.toLowerCase());
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [knowledgeAreaRaceTime, knowledgeAreaFleetStats]);
  // Venue-expert pin — the fleetmate with the most completed races at the
  // selected area, marked near (not on) the centroid so it doesn't sit
  // under the area's label pill.
  const venueExpertPin = useMemo<AtlasPinSpec | null>(() => {
    if (!knowledgeArea) return null;
    const top = knowledgeAreaFleetStats?.fleetmates[0];
    if (!top) return null;
    return {
      id: `venue-expert:${knowledgeArea.id}:${top.userId}`,
      lat: knowledgeArea.centerLat + 0.003,
      lng: knowledgeArea.centerLng,
      kind: 'venue-expert',
      label: `${top.displayName} · ${top.completedCount}× here`,
    };
  }, [knowledgeArea, knowledgeAreaFleetStats]);
  // Your history lives on the water (racer mock §4) — green dots where the
  // viewer's completed races at this area actually happened, with the most
  // recent review note pinned at the race it came from. Same scope as the
  // venue-expert pin: only while this area's venue sheet is open. Query key
  // matches the sheet's record row, so React Query dedupes the fetch.
  const { data: knowledgeAreaRecord } = useVenueRecord(knowledgeArea?.id ?? null);
  const raceHistoryPins = useMemo<AtlasPinSpec[]>(() => {
    if (!knowledgeArea) return [];
    const races = knowledgeAreaRecord?.locatedRaces ?? [];
    const noteRaceId = races.find((r) => r.noteBody)?.id ?? null;
    return races.map((r) =>
      r.id === noteRaceId
        ? {
            id: `race-note:${r.id}`,
            lat: r.lat,
            lng: r.lng,
            kind: 'race-note' as const,
            label: `“${r.noteBody}”`,
            stepId: r.id,
          }
        : {
            id: `race-history:${r.id}`,
            lat: r.lat,
            lng: r.lng,
            kind: 'race-history' as const,
            stepId: r.id,
          },
    );
  }, [knowledgeArea, knowledgeAreaRecord]);
  // One racing area "active" at a time — tapping an area's label focuses
  // it (others recede to a faint wash). Sticky after the knowledge sheet
  // closes; a background map tap restores all areas to normal.
  const [activeRacingAreaId, setActiveRacingAreaId] = useState<string | null>(null);
  const handleRacingAreaPress = useCallback((area: AtlasRacingAreaPressTarget) => {
    // Everyone gets the local-knowledge callout; owners reach the edit
    // sheet via the "Edit area" link inside the panel.
    setLayersOpen(false);
    setSelectedPin(null);
    setKnowledgeArea(area);
    setActiveRacingAreaId(area.id);
  }, []);
  // Saved-sheet racing-area rows behave like tapping the area on the map:
  // refocus the camera AND open the knowledge sheet (a bare refocus read
  // as "tap did nothing" in user testing).
  const handlePickSavedRacingArea = useCallback(
    (item: SavedPlaceItem) => {
      setSavedSheetOpen(false);
      if (item.lat != null && item.lng != null) {
        setSearchFocus({ lat: item.lat, lng: item.lng });
      }
      const area = myRacingAreas.find((a) => a.id === item.id);
      if (!area || area.centerLat == null || area.centerLng == null) return;
      const polygon: GeoJSON.Polygon =
        area.geometry?.type === 'Polygon'
          ? (area.geometry as GeoJSON.Polygon)
          : circlePolygon(area.centerLng, area.centerLat, area.radiusMeters ?? 1000);
      handleRacingAreaPress({
        id: area.id,
        name: area.areaName,
        venueId: area.venueId,
        centerLat: area.centerLat,
        centerLng: area.centerLng,
        classesUsed: area.classesUsed,
        createdBy: area.createdBy,
        polygon,
      });
    },
    [myRacingAreas, handleRacingAreaPress],
  );
  // HKO observations override Open-Meteo wind when a station is within
  // ~5km of map center. Real anemometer beats a 5km model grid for the
  // local read, but only inside the HK bbox — outside we don't bother
  // running the lookup.
  const hko = useHKOObservations();
  const hkoWind = useMemo(() => {
    if (selectedRaceStartAt) return null;
    if (!showWind && !selectedRaceStepOpen) return null;
    if (!isInHongKong(mapCenter.lat, mapCenter.lng)) return null;
    return hko.findNearest(mapCenter.lat, mapCenter.lng, 5);
    // hko.findNearest is a stable closure over query.data; recompute
    // when the dataset (or center) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapCenter.lat, mapCenter.lng, hko.data, showWind, selectedRaceStepOpen, selectedRaceStartAt]);
  // Live conditions handed to the area-knowledge callout so it can count
  // posts whose condition tags match right now. HKO station beats the
  // Open-Meteo grid when available, same precedence as the wind overlay.
  const areaLiveConditions = useMemo<CurrentConditions | null>(() => {
    const windDirection = hkoWind?.degrees ?? marineSnapshot?.wind?.degrees ?? null;
    const windSpeed = hkoWind?.knots ?? marineSnapshot?.wind?.knots ?? null;
    if (windDirection == null && windSpeed == null) return null;
    return {
      windDirection,
      windSpeed,
      currentSpeed: marineSnapshot?.current?.knots ?? null,
    };
  }, [hkoWind, marineSnapshot]);
  const windConditionsLine = useMemo(
    () =>
      hkoWind
        ? `${hkoWind.degrees}|${hkoWind.knots}`
        : conditionsLineFor(marineSnapshot?.wind ?? null),
    [hkoWind, marineSnapshot],
  );
  const tideConditionsLine = useMemo(
    () => conditionsLineFor(marineSnapshot?.current ?? null),
    [marineSnapshot],
  );
  // Seed new race courses with the live wind direction (degrees the wind
  // blows FROM) so authoring starts oriented to today's wind — windward
  // upwind — instead of locking to due north and reading as flipped.
  const defaultCourseWindDeg = useMemo(() => {
    const deg = Number((windConditionsLine ?? '').split('|')[0]);
    return Number.isFinite(deg) ? deg : 0;
  }, [windConditionsLine]);
  // Live current (SET, knots) parsed from the tide line — drives the
  // favored-side shading on the drawn course so the map's green half matches
  // the strategy card. Without it deriveCourseOverlay leaves favoredSide null
  // and both halves render at the same faint tint (no left/right read).
  const courseCurrent = useMemo(() => parseConditionsLine(tideConditionsLine), [tideConditionsLine]);
  // Which side of the beat the shore/shoaling is on, from GEBCO bathymetry —
  // feeds the strategy's shore-bend note. Keyed to the base (now) wind axis so
  // it stays put as the scrub slider veers the projected breeze.
  const shoreSide = useShoreSide({
    centerLat: mapCenter.lat,
    centerLng: mapCenter.lng,
    windDirection: defaultCourseWindDeg,
    enabled: showCourse || showWind,
  });
  // Real hourly forecast points when available — the open race-step's
  // ±hours trend window first, else the NEXT race's window. Null falls
  // back to the synthetic now+projection scrub.
  const raceScrubPoints = useMemo<MarineTrendPoint[] | null>(() => {
    if (selectedRaceStepOpen && raceTrendWindow?.points?.length) {
      return raceTrendWindow.points;
    }
    if (nextRaceWindow.status === 'ok') return nextRaceWindow.points;
    return null;
  }, [selectedRaceStepOpen, raceTrendWindow, nextRaceWindow]);
  const scrubWindows = useMemo(() => {
    if (raceScrubPoints) {
      // Same `"deg|knots"` string contract as the synthetic windows —
      // everything downstream (overlays, strategy, field pins) parses
      // via parseConditionsLine and must not care which source fed it.
      return raceScrubPoints.map((p) => ({
        label: formatScrubClock(p.iso),
        wind: conditionsLineFor(p.wind),
        tide: conditionsLineFor(p.current),
      }));
    }
    return [
      {
        label: 'now',
        wind: windConditionsLine,
        tide: tideConditionsLine,
      },
      {
        label: '+1h',
        wind: shiftConditionsLine(windConditionsLine, 6, 0.6),
        tide: shiftConditionsLine(tideConditionsLine, 8, 0.1),
      },
      {
        label: '+2h',
        wind: shiftConditionsLine(windConditionsLine, 10, 1.1),
        tide: shiftConditionsLine(tideConditionsLine, 16, 0.2),
      },
      {
        label: '+3h',
        wind: shiftConditionsLine(windConditionsLine, 14, 1.5),
        tide: shiftConditionsLine(tideConditionsLine, 24, 0.3),
      },
    ];
  }, [raceScrubPoints, tideConditionsLine, windConditionsLine]);
  // Scrubber home position: the race-start hour in real mode, 'now' in
  // synthetic mode. Snap back whenever the window's source flips (pin
  // opened/closed, forecast arriving) so a stale index never reads as a
  // different hour than the one displayed.
  const scrubStartIndex = useMemo(() => {
    if (!raceScrubPoints) return 0;
    const idx = raceScrubPoints.findIndex((p) => p.label === 'Start');
    return idx >= 0 ? idx : 0;
  }, [raceScrubPoints]);
  const scrubModeKey =
    selectedRaceStepOpen && raceTrendWindow?.points?.length
      ? `race-step:${selectedRaceStartAt ?? ''}`
      : nextRaceWindow.status === 'ok'
        ? `next-race:${next?.starts_at ?? ''}`
        : 'synthetic';
  useEffect(() => {
    setScrubIndex(scrubStartIndex);
    // Intentionally keyed to the mode only — re-running on every points
    // refetch would fight the user's scrub position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubModeKey]);
  // Tidal-stream reversal inside the race window — the amber "tide flips
  // at HH:MM" pill on the scrubber (and V.5's map annotation).
  const scrubTideFlip = useMemo(() => {
    if (selectedRaceStepOpen && raceTrendWindow?.points?.length && selectedRaceStartAt) {
      return detectTideFlip(raceTrendWindow.points, selectedRaceStartAt);
    }
    if (nextRaceWindow.status === 'ok') return nextRaceWindow.tideFlip;
    return null;
  }, [selectedRaceStepOpen, raceTrendWindow, selectedRaceStartAt, nextRaceWindow]);
  // V.5 — map annotation twin of the scrubber's amber flip pill. Anchored
  // just south of whichever point the flip was computed for (the open race
  // step, else the next race's area) so it doesn't sit under that pin.
  const tideFlipPin = useMemo<AtlasPinSpec | null>(() => {
    if (!scrubTideFlip) return null;
    const anchor =
      selectedRaceStepOpen && selectedPin
        ? { lat: selectedPin.lat, lng: selectedPin.lng }
        : next?.lat != null && next?.lng != null
          ? { lat: next.lat, lng: next.lng }
          : null;
    if (!anchor) return null;
    return {
      id: `tide-flip:${scrubTideFlip.atIso}`,
      lat: anchor.lat - 0.004,
      lng: anchor.lng,
      kind: 'tide-flip',
      label: `Tide flips ~${formatScrubClock(scrubTideFlip.atIso)}`,
    };
  }, [scrubTideFlip, selectedRaceStepOpen, selectedPin, next?.lat, next?.lng]);
  // When the next race is beyond Open-Meteo's 16-day horizon, say when the
  // race-time forecast will become available instead of silently showing
  // now-projections as if they were race conditions.
  const raceForecastOpensLabel = useMemo(() => {
    if (nextRaceWindow.status !== 'out-of-range' || !next?.starts_at) return null;
    const t = new Date(next.starts_at).getTime();
    if (!Number.isFinite(t)) return null;
    const opens = new Date(t - 16 * 86_400_000);
    if (opens.getTime() <= Date.now()) return null;
    return opens.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [nextRaceWindow.status, next?.starts_at]);
  const scrubWindow =
    scrubWindows[Math.min(scrubIndex, scrubWindows.length - 1)] ?? scrubWindows[0];
  // Mock parity — "12 kn SW building": trend word from the scrubbed hour's
  // wind speed vs two hours later in the same window.
  const scrubWindTrend = useMemo(() => {
    const knotsAt = (i: number) => Number((scrubWindows[i]?.wind ?? '').split('|')[1]);
    const here = knotsAt(Math.min(scrubIndex, scrubWindows.length - 1));
    const later = knotsAt(Math.min(scrubIndex + 2, scrubWindows.length - 1));
    if (!Number.isFinite(here) || !Number.isFinite(later)) return null;
    if (later - here >= 2) return 'building';
    if (here - later >= 2) return 'easing';
    return null;
  }, [scrubWindows, scrubIndex]);
  // Mock parity — race time is TOP chrome, not a bottom card. The bar owns
  // the scrubber whenever the NEXT race's forecast window is open; an open
  // race-step sheet runs its own window, and commit mode needs clear chrome.
  const raceTimeBarVisible =
    nextRaceWindow.status === 'ok' &&
    !!next &&
    !selectedRaceStepOpen &&
    !commitMode &&
    dismissedRaceTimeEventKey !== `${next.event_id ?? next.label}:${next.starts_at ?? ''}`;
  const raceCountdownLabel = useMemo(() => {
    if (!next?.starts_at) return null;
    const ms = new Date(next.starts_at).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const hours = Math.round(ms / 3_600_000);
    return hours <= 72 ? `${hours} h out` : `${Math.round(hours / 24)} d out`;
  }, [next?.starts_at]);
  const selectedTriangleRaceOpen = isTriangleRaceStepPin(selectedPin);
  const selectedRaceCoursePreview = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!selectedTriangleRaceOpen || !selectedPin) return null;
    const wind = parseConditionsLine(scrubWindow.wind);
    return trianglePreviewAroundPin(selectedPin, wind?.deg ?? defaultCourseWindDeg);
  }, [defaultCourseWindDeg, scrubWindow.wind, selectedPin, selectedTriangleRaceOpen]);
  const effectiveCoursePreview = coursePreview ?? selectedRaceCoursePreview;
  // Tactical advice for the race-mark sheet. Keyed to the scrubbed wind +
  // current ("deg|knots", wind FROM / current SET) so it tracks both the
  // live obs and the time-scrub slider. Position-independent — the favored
  // side/end follow conditions, not the tapped mark, so one card is correct
  // for every mark on the course.
  const courseStrategy = useMemo(() => {
    const wind = parseConditionsLine(scrubWindow.wind);
    if (wind == null) return null;
    const current = parseConditionsLine(scrubWindow.tide);
    return deriveCourseStrategy({
      windDirection: wind.deg,
      windSpeedKn: wind.kn,
      currentDirection: current?.deg,
      currentSpeedKn: current?.kn,
      shoreSide,
    });
  }, [scrubWindow.wind, scrubWindow.tide, shoreSide]);
  const windSourceLabel = useMemo(() => {
    if (hkoWind) return `${hkoWind.place} obs`;
    if (marineSnapshot?.wind) return 'JMA model';
    return undefined;
  }, [hkoWind, marineSnapshot]);
  const selectedRaceMarineAnchors = useMemo(
    () =>
      selectedRaceStepOpen && selectedPin
        ? [{ lat: selectedPin.lat, lng: selectedPin.lng }]
        : undefined,
    [selectedPin, selectedRaceStepOpen],
  );
  const showRaceConditionVectors = selectedRaceStepOpen && Boolean(scrubWindow.wind || scrubWindow.tide);
  const selectedRaceFieldPins = useMemo<AtlasPinSpec[]>(() => {
    if (!showRaceConditionVectors || !selectedPin) return [];
    const anchor = { lat: selectedPin.lat, lng: selectedPin.lng };
    const out: AtlasPinSpec[] = [];
    const wind = parseConditionsLine(scrubWindow.wind);
    if (wind) {
      const windFieldLabel = `${wind.deg}|${wind.kn}|field`;
      [wind.deg, (wind.deg + 180) % 360].forEach((bearing, index) => {
        const p = offsetPointByBearing(anchor, bearing, 0.72);
        out.push({
          id: `race-wind-field:${selectedPin.id}:${index}`,
          lat: p.lat,
          lng: p.lng,
          kind: 'wind-arrow',
          label: windFieldLabel,
        });
      });
    }
    const tide = parseConditionsLine(scrubWindow.tide);
    if (tide && tide.kn >= 0.05) {
      const tideFieldLabel = `${tide.deg}|${tide.kn}|field`;
      [tide.deg, (tide.deg + 180) % 360].forEach((bearing, index) => {
        const p = offsetPointByBearing(anchor, bearing, 0.62);
        out.push({
          id: `race-current-field:${selectedPin.id}:${index}`,
          lat: p.lat,
          lng: p.lng,
          kind: 'tide-arrow',
          label: tideFieldLabel,
        });
      });
    }
    return out;
  }, [scrubWindow.tide, scrubWindow.wind, selectedPin, showRaceConditionVectors]);
  const windPins = useWindOverlay({
    centerLat: mapCenter.lat,
    centerLng: mapCenter.lng,
    conditionsLine: scrubWindow.wind ?? '0|0',
    enabled: (showWind || showRaceConditionVectors) && scrubWindow.wind !== null,
    waterAnchors: selectedRaceMarineAnchors,
    waveHeightMeters: marineSnapshot?.waves?.heightMeters,
    source: raceScrubPoints
      ? `${scrubWindow.label} forecast`
      : scrubIndex === 0
        ? windSourceLabel
        : `${scrubWindow.label} projection`,
  });
  const tidePins = useTideOverlay({
    centerLat: mapCenter.lat,
    centerLng: mapCenter.lng,
    conditionsLine: scrubWindow.tide ?? '0|0',
    enabled: (showTide || showRaceConditionVectors) && scrubWindow.tide !== null,
    waterAnchors: selectedRaceMarineAnchors,
  });
  const waveConditionsLine = useMemo(
    () =>
      marineSnapshot?.waves
        ? `${marineSnapshot.waves.degrees}|${marineSnapshot.waves.heightMeters}`
        : null,
    [marineSnapshot],
  );
  const wavePins = useWaveOverlay({
    centerLat: mapCenter.lat,
    centerLng: mapCenter.lng,
    conditionsLine: waveConditionsLine ?? '0|0',
    enabled: showWaves && waveConditionsLine !== null,
  });
  const windTidePins = useMemo<AtlasPinSpec[]>(
    () => [...selectedRaceFieldPins, ...windPins, ...tidePins, ...wavePins],
    [selectedRaceFieldPins, windPins, tidePins, wavePins],
  );
  // Chip-driven peer-pin filtering (You / Crew / Fleet / Following) is applied
  // upstream in useAtlasFramePins, BEFORE clustering — filtering here would
  // re-hide the `kind:'fleet'` density badge when Crew/Following is active. So
  // this memo only carries the race-only lens for my-step pins.
  const filteredFramePins = useMemo(() => {
    let out = visibleFramePins;
    // Race-only filter applies only to my-step pins (they carry isRace);
    // POIs / peers / wind / tide are not steps and always pass through.
    // The next-step pin is exempt: it backs the persistent cockpit HUD, so
    // hiding it here while the cockpit still shows that step would make the
    // map and cockpit disagree. Your next step is always on the map.
    if (raceOnly) {
      out = out.filter((p) => {
        if (!p.kind.startsWith('my-step')) return true;
        if (p.kind === 'my-step-next') return true;
        return Boolean(p.isRace);
      });
    }
    return out;
  }, [visibleFramePins, raceOnly]);
  // Overview keeps the geography + race-mark vocabulary only. The older
  // wind/tide arrow field was too noisy and conflicted with the course
  // frame, which owns the richer conditions treatment.
  // A peer focused from a list breaks out of its cluster as one extra
  // highlighted pin (its server-jittered point), so the map shows where that
  // sailor is instead of just the merged "+N" badge.
  const focusedPeerPin = useMemo<AtlasPinSpec | null>(
    () =>
      focusedPeer
        ? {
            id: `peer-focus:${focusedPeer.stepId}`,
            lat: focusedPeer.lat,
            lng: focusedPeer.lng,
            kind: 'peer-focus',
            label: peerStepTitle(focusedPeer),
            peer: focusedPeer,
          }
        : null,
    [focusedPeer],
  );
  const pins = useMemo(
    () => [
      ...filteredFramePins,
      ...(showRaceMarks ? raceMarkPins : []),
      ...windTidePins,
      ...(focusedPeerPin ? [focusedPeerPin] : []),
      ...(venueExpertPin ? [venueExpertPin] : []),
      ...(tideFlipPin ? [tideFlipPin] : []),
      ...raceHistoryPins,
    ],
    [
      filteredFramePins,
      raceMarkPins,
      showRaceMarks,
      windTidePins,
      focusedPeerPin,
      venueExpertPin,
      tideFlipPin,
      raceHistoryPins,
    ],
  );
  const exitCommit = useCallback(() => {
    setCommitMode(false);
    setCandidate(null);
  }, []);
  const _handleDropPinPress = useCallback(() => {
    if (commitMode) exitCommit();
    else {
      // Entering commit-mode — clear any other sheet so the pin-drop
      // banner / candidate sheet doesn't render under the Layers panel.
      setLayersOpen(false);
      setSelectedPin(null);
      setCommitMode(true);
    }
  }, [commitMode, exitCommit]);
  const handleMapPress = useCallback(
    (coords: { lng: number; lat: number }) => {
      // Racing-area editing is opened by tapping the area's label pill
      // (onRacingAreaPress), NOT by tapping anywhere inside the polygon.
      // At course zoom the polygon fills the viewport, so a whole-area
      // hit-test turned every map tap into an edit-sheet open; the label
      // is the discrete affordance instead.
      if (retraceTarget) {
        setRetraceTarget((prev) =>
          prev
            ? { ...prev, vertices: [...prev.vertices, { lat: coords.lat, lng: coords.lng }] }
            : prev,
        );
        return;
      }
      // While reshaping: with a corner selected, a map tap moves it
      // there. With nothing selected, taps are inert — a stray tap
      // shouldn't dismiss the mode or warp the shape.
      if (reshapeTarget) {
        if (reshapeTarget.selectedIndex != null) {
          const idx = reshapeTarget.selectedIndex;
          setReshapeTarget((prev) => {
            if (!prev || idx >= prev.vertices.length) return prev;
            const vertices = prev.vertices.slice();
            vertices[idx] = { lat: coords.lat, lng: coords.lng };
            return { ...prev, vertices, dirty: true };
          });
        }
        return;
      }
      if (anchorStepTarget) {
        // Commit immediately on the first tap — clearer than a preview-
        // then-save dance. Fire the mutation, exit anchor mode, and
        // fly the camera to the new pin so the user sees the result.
        const target = anchorStepTarget;
        setAnchorStepTarget(null);
        setSearchFocus({ lat: coords.lat, lng: coords.lng });
        updateStepLocationMutation
          .mutateAsync({
            stepId: target.stepId,
            lat: coords.lat,
            lng: coords.lng,
          })
          .catch((err) => {
            console.warn('[atlas] anchor step failed', err);
            // Restore anchor mode so the user can try again.
            setAnchorStepTarget(target);
          });
        return;
      }
      if (repositionTarget) {
        setRepositionTarget((prev) =>
          prev ? { ...prev, newLat: coords.lat, newLng: coords.lng } : prev,
        );
        return;
      }
      // Racing-area create/edit sheet is open — a single tap repositions
      // the area's center. No intermediate "Move on map" step needed.
      // Also fly the camera to the new center so the marker stays in the
      // visible viewport above the sheet, which otherwise hides the
      // lower half of the map.
      if (editingArea) {
        setEditingArea((prev) =>
          prev ? { ...prev, centerLat: coords.lat, centerLng: coords.lng } : prev,
        );
        setSearchFocus({ lat: coords.lat, lng: coords.lng });
        return;
      }
      if (areaSheetCenter) {
        setAreaSheetCenter({ lat: coords.lat, lng: coords.lng });
        setSearchFocus({ lat: coords.lat, lng: coords.lng });
        return;
      }
      if (commitMode) {
        // Same housekeeping as entering commit-mode — if the user opens
        // Layers after entering commit-mode and then taps the map, the
        // resulting PIN DROPPED sheet would stack inside the Layers card.
        setLayersOpen(false);
        setSelectedPin(null);
        setCandidate(coords);
        return;
      }
      // Background tap dismisses the open pin sheet (Apple-Maps callout
      // behavior) — keeps one popup at a time and lets the wind/tide
      // scrubber come back. Pin taps don't reach here: marker presses are
      // handled by the marker itself, not the map surface. Also releases
      // the one-area-at-a-time racing-area focus back to "all areas".
      setSelectedPin(null);
      setActiveRacingAreaId(null);
    },
    [
      commitMode,
      repositionTarget,
      retraceTarget,
      reshapeTarget,
      editingArea,
      areaSheetCenter,
      anchorStepTarget,
      updateStepLocationMutation,
    ],
  );
  const chromePaddingTop = embedded ? Math.max(insets.top + 8, 48) : 50;
  const lastChromeHeightRef = useRef<number | null>(null);
  const lastHeaderHeightRef = useRef<number | null>(null);
  const handleFloatingChromeLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    if (lastChromeHeightRef.current === height) return;
    lastChromeHeightRef.current = height;
    setF1ChromeH(height);
    logAtlasDebug('f1:floating-chrome', {
      embedded,
      insetTop: Math.round(insets.top),
      chromePaddingTop,
      height,
      useMapLibre: handlers.useMapLibre ?? false,
    });
  }, [chromePaddingTop, embedded, handlers.useMapLibre, insets.top]);
  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    if (lastHeaderHeightRef.current === height) return;
    lastHeaderHeightRef.current = height;
    logAtlasDebug('f1:header-row', {
      height,
      embedded,
      insetTop: Math.round(insets.top),
    });
  }, [embedded, insets.top]);
  const repositionHasMoved = Boolean(
    repositionTarget &&
      (repositionTarget.newLat !== repositionTarget.centerLat ||
        repositionTarget.newLng !== repositionTarget.centerLng),
  );
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      {/* Full-bleed map; chrome floats on top as glass cards. The chip
          row + title pill no longer eat 100pt of vertical space — that
          was the design's "full-screen with floating boxes" intent. */}
      <View style={shellStyles.mapArea}>
        {f1View !== 'map' ? (
          f1View === 'sites' ? (
            <InterestSitesSurface
              interestName={currentInterest?.name ?? 'your craft'}
              framePins={framePinsWithDemo}
              steps={pickerSteps}
              toolbarOffset={f1ChromeH}
              bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
              onSitePress={(site) => {
                // Land ON the pin (open its callout + center) instead of a
                // bare camera fly to an unselected map — #37.
                const pin = framePinsWithDemo.find((p) => p.id === `poi:${site.id}`);
                setF1View('map');
                setSelectedPin(pin ?? null);
                setSearchFocus({ lat: site.lat, lng: site.lng });
              }}
              onPlanStep={() => handlers.onPrimaryAction?.()}
            />
          ) : (
            <CapabilitiesSurface
              interestId={currentInterest?.id ?? null}
              interestName={currentInterest?.name ?? 'your craft'}
              toolbarOffset={f1ChromeH}
              bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
              onPlanGap={(row) => {
                if (row && handlers.onPlanCapability) {
                  handlers.onPlanCapability({
                    category: row.category,
                    competencyIds:
                      row.unevidencedCompetencyIds.length > 0
                        ? row.unevidencedCompetencyIds
                        : row.competencyIds,
                  });
                } else {
                  handlers.onPrimaryAction?.();
                }
              }}
              onCategoryPress={(row) => {
                if (handlers.onPlanCapability) {
                  handlers.onPlanCapability({
                    category: row.category,
                    competencyIds:
                      row.unevidencedCompetencyIds.length > 0
                        ? row.unevidencedCompetencyIds
                        : row.competencyIds,
                  });
                } else {
                  handlers.onPrimaryAction?.();
                }
              }}
              onSitePress={(site) => {
                const pin = framePinsWithDemo.find((p) => p.id === `poi:${site.poiId}`);
                if (pin) {
                  // Center + select the pin so its callout opens — #37.
                  setF1View('map');
                  setSelectedPin(pin);
                  setSearchFocus({ lat: pin.lat, lng: pin.lng });
                }
              }}
            />
          )
        ) : handlers.useMapLibre ? (
          <AtlasMapLibreCanvas
            frame="f1"
            pins={pins}
            focusLocation={
              // Area-sheet center wins so a long-press flies the camera
              // above the sheet (the canvas's flyTo uses bottom-inset
              // padding). Falls through to existing focus sources.
              areaSheetCenter ?? searchFocus ?? (focusedClubPin ? { lat: focusedClubPin.lat, lng: focusedClubPin.lng } : null)
            }
            nextEvent={
              // Suppress the amber NEXT callout while a racing area is being
              // placed/edited — the area's preview polygon and label sit on
              // the same venue centroid, so leaving the tag up stacks two
              // boxes over each other on the edit canvas.
              next && !myNextStepPin && !areaSheetCenter && !editingArea
                ? {
                    ...next,
                    lat: next.lat ?? 22.2978,
                    lng: next.lng ?? 114.185,
                  }
                : null
            }
            nextRaceSeries={
              // Additive "N races · {Series}" caption on the drawn course's
              // committee boat. Unlike the amber chip above it is NOT
              // suppressed by myNextStepPin — the caption rides the course
              // geometry, not a duplicate pill — so the series context shows
              // even when the next-step pin owns the spot. Hidden while
              // authoring/editing an area (transient canvas state).
              next?.course_id &&
              (next?.series_count ?? 0) > 1 &&
              next?.series_label &&
              !areaSheetCenter &&
              !editingArea
                ? {
                    courseId: next.course_id,
                    count: next.series_count!,
                    label: next.series_label,
                  }
                : null
            }
            // Always wire onMapPress when the user is signed in.
            // handleMapPress's first branch is "tap inside one of your
            // own polygons → open the edit form" which has to run from
            // an idle state (no active tap-mode). Gating the prop on
            // an existing mode meant taps in idle never reached the
            // polygon hit-test, so Lamma Channel etc. felt dead.
            onMapPress={authUser?.id ? handleMapPress : undefined}
            onMapLongPress={(coords) => {
              // Long-press = "anchor a step at this exact spot". Skip the
              // commit-mode tap-to-drop dance and jump straight to the
              // PIN DROPPED sheet (same surface "Plan a step here" /
              // "Drop a pin" → tap-map produces). Racing-area creation
              // is reached via Manage racing areas, not by accident.
              setLayersOpen(false);
              setSelectedPin(null);
              setCommitMode(true);
              setCandidate(coords);
            }}
            // Render a candidate pin where the area will center. When the
            // area sheet is open we forward areaSheetCenter so the user
            // sees a red marker move as they long-press different spots.
            candidate={
              areaSheetCenter
                ? { lat: areaSheetCenter.lat, lng: areaSheetCenter.lng }
                : repositionTarget
                  ? { lat: repositionTarget.newLat, lng: repositionTarget.newLng }
                : candidate
            }
            racingAreaPreviewPolygon={areaSheetPolygon}
            reshapeVertices={reshapeTarget?.vertices ?? null}
            onReshapeVertexDrag={handleReshapeVertexDrag}
            onReshapeVertexPress={handleReshapeVertexPress}
            reshapeSelectedIndex={reshapeTarget?.selectedIndex ?? null}
            onMapCenterChange={handleMapCenterChange}
            onZoomChange={handleZoomChange}
            onPinPress={handlePinPress}
            onRacingAreaPress={handleRacingAreaPress}
            activeRacingAreaId={activeRacingAreaId}
            // Tapping the "N races · {Series}" caption opens the series sheet.
            // Wired only when the caption actually renders (multi-race series
            // on the drawn course), matching nextRaceSeries above.
            onNextSeriesPress={
              next?.course_id &&
              (next?.series_count ?? 0) > 1 &&
              next?.series_label &&
              !areaSheetCenter &&
              !editingArea
                ? () => setSeriesSheetOpen(true)
                : undefined
            }
            showRaceAreas={showRaceAreas}
            showCourse={showCourse && !selectedTriangleRaceOpen}
            coursePreviewCollection={effectiveCoursePreview}
            courseWindDirectionDeg={defaultCourseWindDeg}
            courseCurrentDirectionDeg={courseCurrent?.deg}
            courseCurrentSpeedKn={courseCurrent?.kn}
            basemap={effectiveBasemap}
          />
        ) : (
          <HongKongOverviewMap />
        )}

        {/* Floating glass chrome — chips on the left, action cluster on
            the right. Title pill removed (the tab-bar highlight already
            names the screen); profile + layers + locate now float as a
            standalone top-right cluster, separate from the filter strip. */}
        <View
          style={[
            shellStyles.floatingChrome,
            { paddingTop: chromePaddingTop },
            // Sites/Capabilities have no map behind them — without an opaque
            // plate the scrolling surface content bleeds up through the
            // transparent chrome and around the translucent segment pill.
            f1View !== 'map' && shellStyles.floatingChromeSolid,
          ]}
          onLayout={handleFloatingChromeLayout}
        >
          {/* Single floating capsule consolidating profile + search +
              layers + inbox. Apple-Maps style: one chrome element, not
              four. ProfileDropdown leads (avatar acts as the user's
              "home" affordance), the central search button shows
              "Region · Venue" and routes to the search modal, layers
              and notification bell sit at the trailing edge. */}
          <View style={shellStyles.topCapsuleRow} onLayout={handleHeaderLayout}>
            <View style={shellStyles.topCapsule}>
              {currentInterest ? (
                <Pressable
                  style={shellStyles.capsuleInterest}
                  onPress={() => openInterestSwitcher()}
                  hitSlop={4}
                  accessibilityLabel={`Current interest: ${currentInterest.name}. Tap to switch.`}
                >
                  <View
                    style={[
                      shellStyles.capsuleInterestDot,
                      { backgroundColor: currentInterest.accent_color },
                    ]}
                  />
                  <Text style={shellStyles.capsuleInterestText} numberOfLines={1}>
                    {currentInterest.name}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={11}
                    color="rgba(60, 60, 67, 0.62)"
                    style={shellStyles.capsuleInterestChevron}
                  />
                </Pressable>
              ) : null}
              {/* Mockup #39 — context · step pill · spacer · 🔍 · + · avatar.
                  The Saved/jump dropdown rides the step pill (right of the
                  interest dropdown); layers moves to the on-map FAB; the
                  spacer pushes the trailing controls right. */}
              <Pressable
                ref={savedStarRef}
                style={shellStyles.capsuleStepSwitcher}
                onPress={openSavedSheet}
                hitSlop={4}
                accessibilityLabel="Steps and saved places. Tap to jump."
              >
                <View style={shellStyles.capsuleStepDot} />
                <Text style={shellStyles.capsuleStepText} numberOfLines={1}>
                  {topStepPillLabel}
                </Text>
                <Ionicons name="chevron-down" size={11} color="rgba(10, 132, 255, 0.7)" />
              </Pressable>
              <View style={{ flex: 1 }} />
              {handlers.onNearbyPress ? (
                <Pressable
                  style={shellStyles.capsuleAction}
                  onPress={handlers.onNearbyPress}
                  hitSlop={6}
                  accessibilityLabel="People and sites nearby"
                >
                  <Ionicons name="list" size={16} color="rgba(60, 60, 67, 0.85)" />
                </Pressable>
              ) : null}
              <Pressable
                style={shellStyles.capsuleAction}
                onPress={() => {
                  // Opening search exits any modal-like state (reposition,
                  // retrace, commit-mode) so the user isn't visually
                  // "in" two flows at once. The reposition banner used
                  // to bleed through the search modal.
                  setRepositionTarget(null);
                  setRetraceTarget(null);
                  setReshapeTarget(null);
                  setCommitMode(false);
                  setCandidate(null);
                  setSearchOpen(true);
                }}
                hitSlop={6}
                accessibilityLabel="Search places"
              >
                <Ionicons name="search" size={16} color="rgba(60, 60, 67, 0.85)" />
              </Pressable>
              {universalPlus.isAvailable ? (
                <Pressable
                  style={[
                    shellStyles.capsuleAddButton,
                    { backgroundColor: currentInterest?.accent_color ?? '#007AFF' },
                  ]}
                  onPress={universalPlus.open}
                  hitSlop={6}
                  accessibilityLabel="Capture a step"
                >
                  <Ionicons name="add" size={19} color="#FFFFFF" />
                </Pressable>
              ) : null}
              <ProfileDropdown size={30} variant="light" menuAlign="right" />
            </View>
          </View>
          {/* Sites | Capabilities | Map segment — the nursing F4 reframe,
              generalized to every F1 interest. Sites/Capabilities lead with
              structure; Map preserves the full chart + sailing chrome. */}
          <View style={shellStyles.f4Segment}>
            {(['sites', 'capabilities', 'map'] as const).map((mode) => {
              const label = mode === 'sites' ? 'Sites' : mode === 'capabilities' ? 'Capabilities' : 'Map';
              return (
                <Pressable
                  key={mode}
                  style={[
                    shellStyles.f4SegmentItem,
                    f1View === mode && shellStyles.f4SegmentItemActive,
                  ]}
                  onPress={() => {
                    setF1View(mode);
                    if (mode !== 'map') setSelectedPin(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${label}`}
                  accessibilityState={{ selected: f1View === mode }}
                  testID={`atlas-f1-segment-${mode}`}
                >
                  <Text
                    style={[
                      shellStyles.f4SegmentText,
                      f1View === mode && shellStyles.f4SegmentTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* Mockup #39 — one relationship-first lens strip. WHOSE leads (My
              steps on by default, then Crew/Fleet/Following), Races trails as
              the WHAT filter. Replaces the two stacked rows so the hero is
              "your steps + the steps of people you follow & know," not search.
              Map-only: Sites/Capabilities own their own structure. */}
          {f1View === 'map' ? (
          <View style={{ marginTop: 9 }}>
          <FilterChipsRow
            chips={[
              { id: 'you', label: 'My steps', tone: 'you', active: activeFilterIds.includes('you') },
              { id: 'crew', label: visibilityLabels.crew, tone: 'crew', active: activeFilterIds.includes('crew') },
              {
                id: 'fleet',
                label: isSailingFrame ? fleetChipLabel : visibilityLabels.fleet,
                tone: 'fleet',
                active: activeFilterIds.includes('fleet'),
              },
              { id: 'following', label: 'Following', tone: 'following', active: activeFilterIds.includes('following') },
              // Races is sailing-only — a golf / entrepreneur user has no
              // race steps and the boat icon would read wrong.
              ...(isSailingFrame
                ? [
                    {
                      id: 'races',
                      label: 'Races',
                      icon: 'boat' as const,
                      dotColor: RACE_FILTER_DOT,
                      active: raceOnly,
                    },
                  ]
                : []),
              { id: 'history', label: 'History', icon: 'time-outline', active: showStepHistory },
            ]}
            onActiveIdsChange={handleChipsChange}
            rightInset={10}
            compact
            debugScope="f1"
          />
          </View>
          ) : null}
          {/* Headless InterestSwitcher hosts the modal so the imperative
              opener inside the capsule can pop it. Atlas doesn't mount
              the global NavigationHeader, so the sheet lives here. */}
          <InterestSwitcher headless />
          {f1View === 'map' && isSailingFrame && subchipGroups.length > 0 ? (
            <View style={shellStyles.groupSubchipRow}>
              {subchipGroups.map((g: UserAffinityGroup) => (
                <GroupSubchip
                  key={g.id}
                  group={g}
                  active={activeGroupIds.includes(g.id)}
                  onPress={() => toggleGroupChip(g.id)}
                />
              ))}
            </View>
          ) : null}
          {f1View === 'map' && isSailingFrame && raceTimeBarVisible && next ? (
            <RaceTimeBar
              raceLabel={next.label}
              countdownLabel={raceCountdownLabel}
              windows={scrubWindows.map((w) => w.label)}
              value={scrubIndex}
              onChange={setScrubIndex}
              wind={scrubWindow.wind}
              windTrend={scrubWindTrend}
              tide={scrubWindow.tide}
              flipNote={
                scrubTideFlip
                  ? `Tide flips ~${formatScrubClock(scrubTideFlip.atIso)}`
                  : null
              }
              strategy={courseStrategy}
              onDismiss={() => {
                setDismissedRaceTimeEventKey(`${next.event_id ?? next.label}:${next.starts_at ?? ''}`);
              }}
            />
          ) : null}
        </View>

        {/* SVG-fallback fixtures (RacingAreaTag + base-club AtlasPin) —
            these are percentage-positioned so they only render in the
            non-MapLibre fallback path. On the live MapLibre canvas the
            real RHKYC pin comes through useAtlasFramePins → MLMarker. */}
        {f1View === 'map' && isSailingFrame && hasNext && !commitMode && !handlers.useMapLibre && (
          <>
            <RacingAreaTag leftPct={84} topPct={20} text="Apr 14 · 3 from fleet" />
            <RacingAreaTag leftPct={65} topPct={61} text="Mar 28 · 4 from fleet" />
            <AtlasPin
              kind="you"
              leftPct={36}
              topPct={70}
              label="RHKYC CLUB"
              sublabel="Lady Catriona · Berth 14"
            />
          </>
        )}

        {/* Peer pins inside Victoria Harbour. When the next-event amber tag
            is rendered (preview/with-event mode), some of these pins sit
            under it — the tag is rendered LAST so it stacks on top. When
            the tag is absent (live tab cold-start), the pin cluster fills
            the harbor cleanly.

            Skipped in MapLibre mode — the canvas owns geographic pin
            placement once real lat/lng data lands via the
            atlas_peer_steps_near RPC. Until then the live MapLibre canvas
            shows the base map without phantom percentage-positioned pins. */}
        {f1View === 'map' && isSailingFrame && !handlers.useMapLibre && (
          <>
            <AtlasPin kind="crew" leftPct={22} topPct={44} />
            <AtlasPin kind="fleet" leftPct={32} topPct={50} />
            <AtlasPin kind="fleet" leftPct={42} topPct={45} />
            <AtlasPin kind="following" leftPct={48} topPct={52} />
            <AtlasPin kind="fleet" leftPct={56} topPct={44} />
            <AtlasPin kind="crew" leftPct={66} topPct={47} />
            <AtlasPin kind="fleet" leftPct={72} topPct={50} />
            <AtlasPin kind="following" leftPct={28} topPct={56} />
            <AtlasPin kind="following" leftPct={50} topPct={62} />
          </>
        )}

        {/* Highlighted next-event tag — SVG-fallback fixture positioned by
            screen percentage. On MapLibre mode the geographic NextEventMarker
            (inside the canvas) is the authoritative tag, so we suppress this
            fallback or two amber pills render, one of which doesn't pan with
            the map. */}
        {f1View === 'map' && isSailingFrame && hasNext && !commitMode && !handlers.useMapLibre && (
          <NextEventTag
            leftPct={50}
            topPct={47}
            eyebrow={`${next!.eyebrow ?? getAtlasNextEventLabel(currentInterest?.slug)} · ${next!.label.toUpperCase()}${next!.when ? ` · ${next!.when.toUpperCase()}` : ''}`}
            detail={next!.conditions}
          />
        )}

        {/* Commit-mode banner — tells the user the next tap will drop a
            pin and gives them an explicit way out. The blue + FAB is
            gone (entry is the Next Step sheet's "Drop a pin" button);
            this banner is the only commit-mode chrome remaining, so it
            absorbs the cancel affordance the FAB used to carry. */}
        {f1View === 'map' && commitMode && !candidate && (
          <View style={shellStyles.commitBannerInline}>
            <Ionicons name="location-outline" size={12} color="#FFFFFF" />
            <Text style={shellStyles.commitBannerInlineText}>
              Tap the map to drop a pin.
            </Text>
            <Pressable
              style={shellStyles.commitBannerCancel}
              onPress={exitCommit}
              hitSlop={8}
              accessibilityLabel="Cancel pin drop"
            >
              <Ionicons name="close" size={12} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {f1View === 'map' ? (
        <LayersFab
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          onLayersPress={openLayersSheet}
          onLocatePress={() => {
            // Try GPS first (iOS Maps locate behavior). If the user
            // denies permission or we're on web, fall back to flying
            // to the home venue. If neither is available, no-op.
            void getCurrentLocation().then((pos) => {
              if (pos) {
                setSearchFocus({ lat: pos.lat, lng: pos.lng });
                return;
              }
              if (homeVenue?.lat != null && homeVenue?.lng != null) {
                setSearchFocus({ lat: homeVenue.lat, lng: homeVenue.lng });
              }
            });
          }}
        />
        ) : null}

        {f1View !== 'map' ? null : handlers.nearbyOverlayOpen ||
        repositionTarget ||
        retraceTarget ||
        reshapeTarget ? null : showAmbientNextStepCockpit &&
          cockpitShowsChecklist &&
          myNextStepPin &&
          !selectedPin &&
          !cockpitDismissed ? (
          <StepCockpit
            title={
              cockpitStep?.title ??
              myNextStepPin.label?.split('|')[0]?.trim() ??
              'Next step'
            }
            locationName={cockpitStep?.locationName ?? null}
            subSteps={cockpitStep?.subSteps ?? []}
            beats={cockpitStep?.beats ?? []}
            onOpenStep={() => {
              const id = myNextStepPin.stepId;
              if (id) handlers.onStepPress?.(id);
            }}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            collapsed={cockpitCollapsed}
            onToggleCollapse={toggleCockpitCollapsed}
            onClose={() => setCockpitDismissed(true)}
          />
        ) : (showWind || showTide) && !selectedPin && !raceTimeBarVisible ? (
          // One popup at a time — the scrubber yields while a pin sheet
          // (race/step/area) is open so cards never stack, and yields to
          // the top-chrome RaceTimeBar which owns the same scrub state.
          <WindTideScrubber
            title={
              raceScrubPoints && next?.when
                ? `Race time · ${next.when}`
                : undefined
            }
            flipNote={
              scrubTideFlip
                ? `Tide flips ~${formatScrubClock(scrubTideFlip.atIso)}`
                : null
            }
            notice={
              raceForecastOpensLabel
                ? `Race-time forecast opens ${raceForecastOpensLabel} — showing now`
                : null
            }
            windows={scrubWindows.map((w) => w.label)}
            value={scrubIndex}
            onChange={setScrubIndex}
            metrics={[
              showWind
                ? { label: 'Wind', value: formatConditionsValue(scrubWindow.wind) }
                : null,
              showTide
                ? { label: 'Tide', value: formatConditionsValue(scrubWindow.tide) }
                : null,
            ].filter(
              (m): m is { label: string; value: string } =>
                m != null && m.value != null,
            )}
            // Strategy advice only makes sense in a race context — the
            // ambient layer scrubber can sit over land or open water with
            // no course, where "favored side" is nonsense. Race-time scrub
            // (anchored to the next race's venue) is the gate.
            strategy={raceScrubPoints ? courseStrategy : null}
            bottomOffset={
              ((handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0) +
              // The "NEXT RACE · plan a step" sheet sits in the same bottom
              // band; lift the scrubber clear of it so the cards never stack.
              (hasNext && !myNextStepPin ? 84 : 0)
            }
          />
        ) : null}
      </View>

      {/* All bottom-sheet variants are suppressed while Layers is open
          so the sheets never render inside / under the Layers panel. */}
      {/* `key` on each branch forces a fresh BottomSheet mount when the
          conditional swaps — otherwise React reconciles the sheet to the
          same instance and `useState(initialState)` only fires on the
          first ever mount. That made initialState='handle' silently
          inherit a prior 'mid' state when myNextStepPin loaded after
          the ATLAS empty-state branch had already mounted the sheet. */}
      {layersOpen || anchorStepTarget || retraceTarget || reshapeTarget ? null : repositionTarget ? (
        <BottomSheet
          key={`reposition:${repositionTarget.id}:${repositionHasMoved ? 'moved' : 'pending'}`}
          eyebrow="MOVE RACING AREA"
          title={repositionHasMoved ? 'Save the new position?' : 'Tap the map to choose a new center.'}
          body={
            repositionHasMoved
              ? `${repositionTarget.name} will move to this selected location.`
              : `${repositionTarget.name} is ready to move. Tap the map where the center should be.`
          }
          primary={
            repositionHasMoved
              ? {
                  label: updateRacingAreaMutation.isPending ? 'Saving...' : 'Save position',
                  icon: 'checkmark',
                  onPress: updateRacingAreaMutation.isPending ? undefined : handleSaveReposition,
                }
              : undefined
          }
          secondary={{
            label: 'Cancel',
            icon: 'close',
            onPress: updateRacingAreaMutation.isPending ? undefined : handleCancelReposition,
          }}
          showSecondaryInMid
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="mid"
        />
      ) : orgPreview ? (
        <BottomSheet
          key={`org-preview:${orgPreview.orgId}`}
          eyebrow={orgPreview.isMember ? 'YOUR ORGANIZATION' : 'ORGANIZATION'}
          title={orgPreview.name}
          body={orgPreview.detail ?? undefined}
          primary={{
            label: 'Open organization',
            icon: 'open-outline',
            onPress: () => {
              const slug = orgPreview.orgSlug;
              setOrgPreview(null);
              if (slug) router.push(`/organizations/${slug}` as never);
            },
          }}
          secondary={{
            label: 'Dismiss',
            icon: 'close',
            onPress: () => setOrgPreview(null),
          }}
          showSecondaryInMid
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="mid"
        />
      ) : stepPreview ? (
        <StepPreviewCallout
          key={`step-preview:${stepPreview.stepId}`}
          eyebrow={
            stepPreview.ownership === 'yours'
              ? 'YOUR STEP'
              : stepPreview.ownership === 'following'
                ? 'FROM SOMEONE YOU FOLLOW'
                : 'STEP'
          }
          title={stepPreview.name}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0}
          onOpen={() => {
            const id = stepPreview.stepId;
            setStepPreview(null);
            if (id) router.push(`/step/${id}` as never);
          }}
          onDismiss={() => setStepPreview(null)}
        />
      ) : candidate ? (
        <BottomSheet
          key="candidate"
          eyebrow="PIN DROPPED"
          title="Anchor a step at this location."
          body={candidateBody}
          primary={{
            label: 'Plan a step here',
            icon: 'add',
            // Before forwarding the pin to the add-step flow, resolve
            // the lat/lng to the nearest named place (club / sailing
            // POI within 1km). This stamps the location with a
            // human-readable name at write-time so the resulting step
            // never reads as "Dropped pin (22.366, 114.270)" later.
            onPress: async () => {
              const pin: { lat: number; lng: number; place?: string } = {
                lat: candidate.lat,
                lng: candidate.lng,
              };
              try {
                const { data } = await supabase.rpc('nearest_named_place', {
                  target_lat: candidate.lat,
                  target_lng: candidate.lng,
                  max_km: 1.0,
                });
                const row = (data as { name: string; short_name: string | null }[] | null)?.[0];
                if (row?.name) {
                  pin.place = row.short_name ?? row.name;
                }
              } catch {
                // Best-effort — fall through with no place name on RPC failure.
              }
              exitCommit();
              handlers.onPrimaryAction?.(pin);
            },
          }}
          secondary={{ label: 'Cancel', onPress: exitCommit }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      ) : knowledgeArea ? (
        <BottomSheet
          key={`area-knowledge:${knowledgeArea.id}`}
          eyebrow={
            knowledgeAreaRaceTime && next?.label
              ? `RACING AREA · NEXT: ${next.label.toUpperCase()}`
              : 'RACING AREA'
          }
          title={knowledgeArea.name}
          expandedContent={
            <VenueMasterySheet
              areaPoiId={knowledgeArea.id}
              raceTime={knowledgeAreaRaceTime}
              raceWindow={knowledgeAreaRaceWeek}
              liveConditions={areaLiveConditions}
            >
              {myStepsAtArea.length > 0 ? (
                <View style={shellStyles.stepsHereWrap}>
                  <Text style={shellStyles.stepsHereLabel}>
                    {myStepsAtArea.length} of your step
                    {myStepsAtArea.length === 1 ? '' : 's'} here
                  </Text>
                  <StackedStepList steps={myStepsAtArea} onOpenStep={openStepById} />
                </View>
              ) : null}
              <PlaceKnowledgeSection
                anchor={{ poiId: knowledgeArea.id }}
                interestSlug="sail-racing"
                conditions={areaLiveConditions}
                splitPublicBand
                groupBandLabel={knowledgeAreaFleetStats?.fleetName ?? null}
                onAddKnowledge={
                  knowledgeAreaRaceTime
                    ? () => {
                        const a = knowledgeArea;
                        setKnowledgeArea(null);
                        router.push({
                          pathname: '/venue/post/create',
                          params: {
                            ...(a.venueId ? { venueId: a.venueId } : {}),
                            areaPoiId: a.id,
                          },
                        } as never);
                      }
                    : undefined
                }
                onEditArea={
                  knowledgeArea.createdBy === authUser?.id
                    ? () => {
                        const a = knowledgeArea;
                        setKnowledgeArea(null);
                        setEditingArea({
                          id: a.id,
                          name: a.name,
                          centerLat: a.centerLat,
                          centerLng: a.centerLng,
                          radiusMeters: null,
                          classesUsed: a.classesUsed,
                          polygon: a.polygon,
                        });
                      }
                    : undefined
                }
              />
            </VenueMasterySheet>
          }
          primary={
            // When this water hosts the viewer's next race, the prime move
            // is planning prep for it; knowledge authoring stays reachable
            // via the add row inside the knowledge section.
            knowledgeAreaRaceTime && next
              ? {
                  label: `Plan prep · ${next.label}`,
                  sublabel: venuePrepSublabel ?? undefined,
                  icon: 'flag-outline',
                  onPress: () => {
                    const a = knowledgeArea;
                    setKnowledgeArea(null);
                    handlers.onPrimaryAction?.({
                      lat: a.centerLat,
                      lng: a.centerLng,
                      place: a.name,
                      suggestedTitle: `Prep for ${next.label}`,
                      areaPoiId: a.id,
                      startsAtHint: next.starts_at,
                    });
                  },
                }
              : {
                  label: 'Add local knowledge',
                  icon: 'add',
                  onPress: () => {
                    const a = knowledgeArea;
                    setKnowledgeArea(null);
                    router.push({
                      pathname: '/venue/post/create',
                      params: {
                        ...(a.venueId ? { venueId: a.venueId } : {}),
                        areaPoiId: a.id,
                      },
                    } as never);
                  },
                }
          }
          secondary={{ label: 'Close', onPress: () => setKnowledgeArea(null) }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="expanded"
        />
      ) : selectedPin && !(cockpitOwnsNext && selectedPin.kind === 'my-step-next') ? (
        // Race-marks are organizer-set artifacts of an upcoming race — the
        // user can't "plan a step" at one. Surface a richer eyebrow that
        // names the regatta they belong to, swap the CTA to "Open <race>"
        // so the user can jump into the race detail.
        selectedPin.kind === 'race-mark' ? (
          <BottomSheet
            key="race-mark"
            eyebrow={
              next?.label
                ? `RACE MARK · ${next.label.toUpperCase()}`
                : 'RACE MARK'
            }
            title={selectedPin.label ?? 'Mark'}
            body={
              [selectedPin.subtitle, selectedPin.provenance]
                .filter(Boolean)
                .join('\n') || bodyForPin(selectedPin)
            }
            expandedContent={
              courseStrategy ? <CourseStrategyCard strategy={courseStrategy} /> : undefined
            }
            primary={
              next?.label
                ? {
                    label: `Open ${next.label}`,
                    icon: 'open-outline',
                    onPress: () => {
                      handlers.onSecondaryAction?.();
                      clearSelectedPin();
                    },
                  }
                : { label: 'Close', icon: 'close', onPress: clearSelectedPin }
            }
            secondary={
              next?.label ? { label: 'Close', onPress: clearSelectedPin } : undefined
            }
            onClose={clearSelectedPin}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        ) : selectedPin.kind === 'poi-club' || selectedPin.kind === 'poi-club-anchor' ? (
          <BottomSheet
            key="poi-club"
            eyebrow="CLUB"
            title={selectedPin.label ?? 'Club'}
            body={[
              selectedPin.orgSlug
                ? 'Linked BetterAt organization.'
                : 'Club place pin — not linked to a claimed BetterAt organization yet.',
              'Club lens should show this organization’s events, fleets, pins, and public activity from the club’s point of view.',
            ].join('\n')}
            // Cross-link the viewer's own steps that sit at this club — the same
            // "here's what you've done here" affordance the generic-pin callout
            // carries. Club pins are the dominant sailing site type, so without
            // this the cross-link silently no-ops on every yacht club.
            expandedContent={
              myStepsAtSelectedPoi.length > 0 ? (
                <View style={shellStyles.stepsHereWrap}>
                  <Text style={shellStyles.stepsHereLabel}>
                    {myStepsAtSelectedPoi.length} of your step
                    {myStepsAtSelectedPoi.length === 1 ? '' : 's'} here
                  </Text>
                  <StackedStepList steps={myStepsAtSelectedPoi} onOpenStep={openStepById} />
                </View>
              ) : null
            }
            primary={{
              label: selectedPin.orgSlug ? 'Open organization' : 'Claim / link club',
              icon: selectedPin.orgSlug ? 'business-outline' : 'flag-outline',
              onPress: () => {
                clearSelectedPin();
                openOrganizationPin(selectedPin, handlers.onOrgPress);
              },
            }}
            secondary={{
              label: 'View club lens',
              icon: 'map-outline',
              onPress: () => {
                clearSelectedPin();
                openClubLens(selectedPin, handlers.onOrgLensPress);
              },
            }}
            onClose={clearSelectedPin}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        ) : selectedPin.stackedSteps && selectedPin.stackedSteps.length > 0 ? (
          // Several of the viewer's own steps share this spot — list them
          // so each is reachable. Must precede the clusterCount branch:
          // stack pins carry clusterCount too and would read "PEER STEPS".
          <BottomSheet
            key="my-step-stack"
            eyebrow="YOUR STEPS HERE"
            title={`${selectedPin.stackedSteps.length} ${selectedPin.clusterUnit ?? 'step'}s at ${selectedPin.subtitle ?? 'this spot'}`}
            body="Several of your steps share this location. Tap one to open it."
            expandedContent={
              <StackedStepList
                steps={selectedPin.stackedSteps}
                onOpenStep={(stepId) => {
                  clearSelectedPin();
                  handlers.onStepPress?.(stepId);
                }}
              />
            }
            secondary={{ label: 'Close', onPress: clearSelectedPin }}
            onClose={clearSelectedPin}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        ) : selectedPin.clusterCount != null ? (
          <BottomSheet
            key="peer-steps"
            eyebrow="PEER STEPS"
            title={`${selectedPin.peerMembers?.length ?? selectedPin.clusterCount} nearby peer steps`}
            body={
              [
                selectedPin.subtitle,
                selectedPin.provenance,
              ]
                .filter(Boolean)
                .join('\n')
            }
            expandedContent={
              selectedPin.peerMembers && selectedPin.peerMembers.length > 0 ? (
                <PeerMemberList
                  members={selectedPin.peerMembers}
                  onSelectMember={focusPeerMember}
                />
              ) : null
            }
            secondary={{ label: 'Close', onPress: clearSelectedPin }}
            onClose={clearSelectedPin}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        ) : selectedPin.kind === 'org-event' ? (
          <BottomSheet
            key="org-event"
            eyebrow="ORGANIZATION SESSION"
            title={selectedPin.label ?? 'Organization session'}
            source={
              [selectedPin.provenance, selectedPin.subtitle]
                .filter(Boolean)
                .join(' · ')
            }
            body={
              'An organization you belong to published this as an attendable session at this exact spot. Open it to see the plan, timing, and what to bring.'
            }
            primary={{
              label: 'Open step',
              icon: 'open-outline',
              onPress: () => {
                if (selectedPin.stepId) handlers.onStepPress?.(selectedPin.stepId);
              },
            }}
            secondary={{ label: 'Close', onPress: clearSelectedPin }}
            onClose={clearSelectedPin}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        ) : selectedPin.peer ? (
          <BottomSheet
            key="peer-step"
            eyebrow="PEER STEP"
            title={peerStepTitle(selectedPin.peer)}
            source={
              [
                selectedPin.peer.name?.trim() || null,
                peerRelationshipLabel(selectedPin.peer.relationship),
                relativeSetAt(selectedPin.peer.setAt),
                readablePeerPlaceName(selectedPin.peer.placeName),
              ]
                .filter(Boolean)
                .join(' · ')
            }
            body={
              'A peer in your crew, fleet, following graph, or cohort has a step near here. The pin is privacy-jittered to the neighborhood, but the step itself is shared with you — open it to see what they did.'
            }
            primary={{
              label: 'Open step',
              icon: 'open-outline',
              onPress: () => {
                const id = selectedPin.peer?.stepId;
                if (id) handlers.onStepPress?.(id);
              },
            }}
            secondary={{ label: 'Close', onPress: clearSelectedPin }}
            onClose={clearSelectedPin}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        ) : isRaceStepPin(selectedPin) ? (
          <BottomSheet
            key="race-step"
            eyebrow="⛵ RACE"
            title={titleForRaceStepPin(selectedPin)}
            source={sourceForRaceStepPin(selectedPin)}
            body={undefined}
            expandedContent={
              <RaceStepSheetContent
                strategy={courseStrategy}
                raceStartLabel={formatRaceStartLabel(selectedPin.raceStartAt)}
                courseSummary={
                  [
                    selectedPin.raceContext?.areaName?.trim() || null,
                    selectedPin.raceContext?.courseLabel?.trim() || null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || null
                }
                forecastUnavailable={Boolean(selectedPin.raceStartAt && marineSnapshot?.outOfRange)}
                conditionsLabel={
                  selectedPin.raceStartAt && marineSnapshot?.outOfRange
                    ? 'Race-start forecast unavailable'
                    : selectedPin.raceStartAt
                    ? `Conditions · race start${windSourceLabel ? ` · ${windSourceLabel}` : ''}`
                    : scrubIndex === 0
                    ? `Conditions · now${windSourceLabel ? ` · ${windSourceLabel}` : ''}`
                    : `Conditions · ${scrubWindow.label} projection${windSourceLabel ? ` · ${windSourceLabel}` : ''}`
                }
                metrics={[
                  { label: 'Wind', value: formatConditionsValue(scrubWindow.wind), detail: selectedPin.raceStartAt ? 'race start' : scrubIndex === 0 ? 'now' : scrubWindow.label },
                  { label: 'Current', value: formatConditionsValue(scrubWindow.tide), detail: selectedPin.raceStartAt ? 'race start · set' : scrubIndex === 0 ? 'now · set' : `${scrubWindow.label} · set` },
                  {
                    label: 'Sea',
                    value: marineSnapshot?.waves?.heightMeters != null
                      ? `${marineSnapshot.waves.heightMeters.toFixed(1)} m`
                      : null,
                    detail: marineSnapshot?.waves?.periodSeconds
                      ? `${selectedPin.raceStartAt ? 'race start' : scrubIndex === 0 ? 'now' : scrubWindow.label} · ${Math.round(marineSnapshot.waves.periodSeconds)}s`
                      : 'chop',
                  },
                ]}
                trends={[
                  {
                    label: 'Wind trend',
                    value: windTrendText(raceTrendWindow?.points),
                    values: (raceTrendWindow?.points ?? []).map((p) => p.wind?.knots ?? null),
                    color: '#2563EB',
                  },
                  {
                    label: 'Current trend',
                    value: currentTrendText(raceTrendWindow?.points),
                    values: (raceTrendWindow?.points ?? []).map((p) => p.current?.knots ?? null),
                    color: '#0E7490',
                  },
                  {
                    label: 'Sea trend',
                    value: seaTrendText(raceTrendWindow?.points),
                    values: (raceTrendWindow?.points ?? []).map((p) => p.waves?.heightMeters ?? null),
                    color: '#7C3AED',
                  },
                ]}
                onSetStart={() => {
                  if (selectedPin.stepId) handlers.onStepPress?.(selectedPin.stepId);
                }}
                onSetCourse={() => {
                  if (selectedPin.stepId) handlers.onStepPress?.(selectedPin.stepId);
                }}
                fallbackBody={bodyForRaceStepPin(selectedPin)}
              />
            }
            primary={{
              label: 'Open step',
              icon: 'open-outline',
              onPress: () => {
                if (selectedPin.stepId) handlers.onStepPress?.(selectedPin.stepId);
              },
            }}
            secondary={{ label: 'Close', onPress: clearSelectedPin }}
            onClose={clearSelectedPin}
            showSecondaryInMid
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
            handleBehavior="edgeTab"
            collapsedLabel="Race"
          />
        ) : isUserStepPin(selectedPin) ? (
          <BottomSheet
            key="user-step"
            eyebrow="STEP"
            title={selectedStepDetail?.title ?? titleForUserStepPin(selectedPin)}
            source={
              [
                selectedStepDetail?.locationName,
                selectedPin.subtitle,
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            }
            body={selectedStepDetail ? undefined : detailBodyForPin(selectedPin)}
            expandedContent={
              selectedStepDetail ? (
                <StepDetailSheetContent step={selectedStepDetail} />
              ) : null
            }
            primary={{
              label: 'Open step',
              icon: 'open-outline',
              onPress: () => {
                if (selectedPin.stepId) {
                  handlers.onStepPress?.(selectedPin.stepId);
                  return;
                }
                comingSoonAlert(
                  'Open step',
                  'This pin is a step location, but it is missing a step id. Refresh Atlas and try again.',
                );
              },
            }}
            // Cross-link to the venue this step sits at — the header X already
            // closes, so the secondary slot jumps to the site callout instead
            // of a redundant "Close". Omitted when the step has no mapped venue.
            secondary={
              siteForSelectedStep
                ? {
                    label: `View ${siteForSelectedStep.label ?? 'site'}`,
                    icon: 'location-outline',
                    onPress: () => {
                      setSearchFocus({
                        lat: siteForSelectedStep.lat,
                        lng: siteForSelectedStep.lng,
                      });
                      setSelectedPin(siteForSelectedStep);
                    },
                  }
                : { label: 'Close', onPress: clearSelectedPin }
            }
            onClose={clearSelectedPin}
            showSecondaryInMid
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
            handleBehavior="edgeTab"
            collapsedLabel="Step"
          />
        ) : (
          <BottomSheet
            key="pin-generic"
            eyebrow={eyebrowForPin(selectedPin)}
            title={selectedPin.label ?? 'Pin'}
            body={detailBodyForPin(selectedPin)}
            expandedContent={(() => {
              const poiId = knowledgePoiIdForPin(selectedPin);
              // Cross-link back to the viewer's own steps at this venue — turns
              // the location callout from a dead end into "here's what you've
              // done here." Sits above the shared place-knowledge feed.
              const stepsHere =
                myStepsAtSelectedPoi.length > 0 ? (
                  <View style={shellStyles.stepsHereWrap}>
                    <Text style={shellStyles.stepsHereLabel}>
                      {myStepsAtSelectedPoi.length} of your step
                      {myStepsAtSelectedPoi.length === 1 ? '' : 's'} here
                    </Text>
                    <StackedStepList steps={myStepsAtSelectedPoi} onOpenStep={openStepById} />
                  </View>
                ) : null;
              if (!poiId) return stepsHere ?? undefined;
              return (
                <>
                  {stepsHere}
                  <PlaceKnowledgeSection
                    anchor={{ poiId }}
                    conditions={null}
                    interestSlug="sail-racing"
                    onAddKnowledge={() => {
                      const label = selectedPin.label;
                      clearSelectedPin();
                      router.push({
                        pathname: '/venue/post/create',
                        params: { poiId, ...(label ? { poiName: label } : {}) },
                      } as never);
                    }}
                  />
                </>
              );
            })()}
            primary={{
              label: 'Plan a step here',
              icon: 'add',
              onPress: () => {
                handlers.onPrimaryAction?.({ lat: selectedPin.lat, lng: selectedPin.lng });
                clearSelectedPin();
              },
            }}
            secondary={{ label: 'Close', onPress: clearSelectedPin }}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        )
      ) : null}

      {/* Series sheet — opened by tapping the "N races · {Series}" caption.
          Renders last so it stacks above the mapArea-sibling sheets above. */}
      {seriesSheetOpen ? (
        <BottomSheet
          key="next-series"
          eyebrow={`${next?.series_count ?? seriesRaces.length} RACES`}
          title={next?.series_label ?? 'Series'}
          source={next?.where ? `At ${next.where}` : undefined}
          expandedContent={
            <View style={shellStyles.seriesList}>
              {seriesRaces.length === 0 ? (
                <Text style={shellStyles.seriesEmpty}>No races found for this series.</Text>
              ) : (
                seriesRaces.map((race, idx) => {
                  const when = formatRaceStartLabel(race.startsAt);
                  const isNext = race.id === next?.event_id;
                  return (
                    <Pressable
                      key={race.id}
                      onPress={() => handlePickSeriesRace(race.id)}
                      style={({ pressed }) => [
                        shellStyles.seriesRow,
                        idx > 0 && shellStyles.seriesRowDivider,
                        pressed && shellStyles.seriesRowPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${race.title}`}
                    >
                      <View style={shellStyles.seriesRowText}>
                        <Text style={shellStyles.seriesRowTitle} numberOfLines={1}>
                          {race.title}
                        </Text>
                        {when ? <Text style={shellStyles.seriesRowWhen}>{when}</Text> : null}
                      </View>
                      {isNext ? <Text style={shellStyles.seriesRowNext}>NEXT</Text> : null}
                      <Ionicons name="chevron-forward" size={16} color="rgba(60, 60, 67, 0.5)" />
                    </Pressable>
                  );
                })
              )}
            </View>
          }
          secondary={{ label: 'Close', icon: 'close', onPress: closeSeriesSheet }}
          showSecondaryInMid
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="expanded"
        />
      ) : null}

      {/* Racing-area sheet sits OUTSIDE mapArea so zIndex actually wins —
          the next-step/empty-state BottomSheets are siblings of mapArea,
          so an inner-mapArea sheet couldn't stack above them no matter
          how high its zIndex went. Render last + high zIndex + the same
          bottomOffset the other Atlas BottomSheets use so the tab bar
          doesn't eat the Save button. */}
      <SavedJumpSheet
        visible={savedSheetOpen}
        anchor={savedAnchor}
        steps={pickerSteps}
        selectedStepId={topStepPickerStepId}
        arcGroups={arcGroups}
        relationshipSteps={relationshipStepItems}
        orgStepItems={orgStepItems}
        racingAreas={savedRacingAreaItems}
        savedVenues={savedVenueItems}
        center={savedCenter}
        onDismiss={() => setSavedSheetOpen(false)}
        onPickStep={handlePickStepFromPicker}
        onPickPlace={handlePickSavedPlace}
        onPickRacingArea={handlePickSavedRacingArea}
        onPickPeerStep={handlePickPeerStep}
        onAddPlaceInView={handleAddPlaceInView}
      />

      <CreateRacingAreaSheet
        visible={areaSheetCenter !== null || editingArea !== null}
        center={areaSheetCenterForSheet}
        editingArea={editingArea}
        onMoveOnMap={handleMoveOnMap}
        onRetraceOnMap={handleRetraceOnMap}
        onReshapeOnMap={handleReshapeOnMap}
        onAddCourse={handleAddCourse}
        onClose={() => {
          // Lock searchFocus to the area's coords before clearing the
          // sheet center. Otherwise focusLocation falls through to a
          // stale searchFocus / focusedClubPin and the camera flies
          // away from where the user just saved.
          const lat = editingArea?.centerLat ?? areaSheetCenter?.lat;
          const lng = editingArea?.centerLng ?? areaSheetCenter?.lng;
          if (lat != null && lng != null) {
            setSearchFocus({ lat, lng });
          }
          setAreaSheetCenter(null);
          setEditingArea(null);
        }}
        bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        onShapeChange={setAreaSheetPolygon}
      />

      <CreateRaceCourseSheet
        visible={courseSheetArea !== null}
        center={courseSheetCenter}
        racingAreaId={courseSheetArea?.id ?? null}
        defaultBoatClass={courseSheetArea?.defaultClass}
        defaultWindDirectionDeg={defaultCourseWindDeg}
        bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        onPreviewChange={setCoursePreview}
        onClose={() => {
          if (courseSheetArea) {
            setSearchFocus({ lat: courseSheetArea.lat, lng: courseSheetArea.lng });
          }
          setCourseSheetArea(null);
          setCoursePreview(null);
        }}
      />

      {repositionTarget ? (
        <RepositionAreaBanner
          areaName={repositionTarget.name}
          hasMoved={repositionHasMoved}
          saving={updateRacingAreaMutation.isPending}
          onCancel={handleCancelReposition}
          onSave={handleSaveReposition}
          bottomOffset={((handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0) + 16}
          showActionBar={false}
        />
      ) : null}

      {retraceTarget ? (
        <RetraceAreaBanner
          areaName={retraceTarget.name}
          vertexCount={retraceTarget.vertices.length}
          saving={updateRacingAreaMutation.isPending}
          onUndo={handleRetraceUndo}
          onCancel={handleCancelRetrace}
          onSave={handleSaveRetrace}
          bottomOffset={((handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0) + 16}
        />
      ) : null}

      {reshapeTarget ? (
        <ReshapeAreaBanner
          areaName={reshapeTarget.name}
          dirty={reshapeTarget.dirty}
          hasSelection={reshapeTarget.selectedIndex != null}
          saving={updateRacingAreaMutation.isPending}
          onCancel={handleCancelReshape}
          onSave={handleSaveReshape}
          bottomOffset={((handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0) + 16}
        />
      ) : null}

      {anchorStepTarget ? (
        <RepositionAreaBanner
          areaName={anchorStepTarget.title}
          targetKind="step"
          hasMoved={anchorStepTarget.newLat != null && anchorStepTarget.newLng != null}
          saving={updateStepLocationMutation.isPending}
          onCancel={handleCancelAnchorStep}
          onSave={handleSaveAnchorStep}
          // Clear the MockTabBar (~55pt) + home-indicator inset so the
          // Cancel/Save action row isn't hidden behind the bottom tab bar.
          bottomOffset={insets.bottom + 72}
        />
      ) : null}

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && (
        <LayersSheet
          frame="f1"
          onClose={() => setLayersOpen(false)}
          controlledActiveKeys={controlledLayerKeys}
          onToggle={handleLayerToggle}
          basemap={effectiveBasemap}
          onBasemapChange={setBasemap}
          sailingChrome={isSailingFrame}
          onOpenManageAreas={
            isSailingFrame
              ? () => {
                  setLayersOpen(false);
                  setManageAreasOpen(true);
                }
              : undefined
          }
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}

      <ManageRacingAreasSheet
        visible={manageAreasOpen}
        onClose={() => setManageAreasOpen(false)}
        onEditArea={handleEditArea}
        onFocusArea={({ lat, lng }) => {
          setManageAreasOpen(false);
          setSearchFocus({ lat, lng });
        }}
        onAddArea={() => {
          setManageAreasOpen(false);
          // Seed the create sheet with the current camera focus when we
          // have one (search/result fly), otherwise fall back to the F1
          // canonical centroid. User can drag the center inside the
          // create sheet's map preview before saving.
          setAreaSheetCenter(
            searchFocus
              ? { lat: searchFocus.lat, lng: searchFocus.lng }
              : { lat: 22.295, lng: 114.18 },
          );
        }}
      />

      <AtlasSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
        viewerId={authUser?.id ?? null}
        filterChips={[
          { id: 'all', label: 'All', active: activeFilterIds.includes('all') },
          { id: 'you', label: 'My steps', tone: 'you', active: activeFilterIds.includes('you') },
          { id: 'crew', label: 'Crew', tone: 'crew', active: activeFilterIds.includes('crew') },
          { id: 'fleet', label: fleetChipLabel, tone: 'fleet', active: activeFilterIds.includes('fleet') },
          {
            id: 'following',
            label: 'Following',
            tone: 'following',
            active: activeFilterIds.includes('following'),
          },
        ]}
        onFilterChipsChange={handleChipsChange}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// F2 — Race-marks zoom (Victoria Harbour)
// ---------------------------------------------------------------------------
function FrameF2({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const insets = useSafeAreaInsets();
  const [layersOpen, setLayersOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<AtlasPinSpec | null>(null);
  const [showRaceMarks, setShowRaceMarks] = useState(true);
  const [showWind, setShowWind] = useState(true);
  const [showTide, setShowTide] = useState(true);
  const [showWaves, setShowWaves] = useState(false);
  const [showCrew, setShowCrew] = useState(true);
  const [showFleet, setShowFleet] = useState(true);
  const [showCourse, setShowCourse] = useState(true);
  const [scrubIndex, setScrubIndex] = useState(3);
  const next = handlers.nextEvent ?? null;
  const raceStart = { lat: 22.2838, lng: 114.1779 };
  const { data: liveRaceMarkPins = [] } = useNextRaceMarks({
    regattaId: next?.event_kind === 'regatta' ? next.event_id : null,
    enabled: Boolean(next?.event_kind === 'regatta' && next?.event_id),
  });
  const tideWindows = useMemo(
    () => [
      {
        sliderLabel: 'now',
        title: 'Read the line right now.',
        body:
          'The current is still weak and the pin-end bias is small. A clean lane matters more than forcing the favoured end.',
        windOverlayLabel: '102|10.5',
        windChip: '10.5 kn ESE',
        tideOverlayLabel: '246|0.1',
        tideChip: 'Flood 0.1 kn',
        waveOverlayLabel: '285|0.4',
        waveChip: '0.4 m swell',
        slack: '11:22',
        ctaLabel: 'Plan start setup',
      },
      {
        sliderLabel: '+1h',
        title: 'Preview the first shift at T + 1h.',
        body:
          'The breeze builds and starts to bend right. Mid-line starts still work, but the pin-end cross is beginning to matter.',
        windOverlayLabel: '108|11.3',
        windChip: '11.3 kn ESE',
        tideOverlayLabel: '255|0.2',
        tideChip: 'Flood 0.2 kn',
        waveOverlayLabel: '288|0.5',
        waveChip: '0.5 m swell',
        slack: '10:54',
        ctaLabel: 'Plan line approach',
      },
      {
        sliderLabel: '+2h',
        title: 'Scrub forward to the first beat at T + 2h.',
        body:
          'Pressure improves up the right edge while the flood weakens. This is the cleanest setup if the sequence stays on time.',
        windOverlayLabel: '111|11.8',
        windChip: '11.8 kn ESE',
        tideOverlayLabel: '264|0.3',
        tideChip: 'Flood 0.3 kn',
        waveOverlayLabel: '290|0.5',
        waveChip: '0.5 m swell',
        slack: '10:21',
        ctaLabel: 'Plan first beat',
      },
      {
        sliderLabel: '+3h',
        title: 'Plan the first beat at T + 3h.',
        body:
          'ESE 12 kn over an ebbing 0.4 kn current. Slack around 09:48. Pin end is favoured, but the flood line opens if the start slips.',
        windOverlayLabel: '112|12',
        windChip: '12 kn ESE',
        tideOverlayLabel: '270|0.4',
        tideChip: 'Ebb 0.4 kn',
        waveOverlayLabel: '292|0.6',
        waveChip: '0.6 m swell',
        slack: '09:48',
        ctaLabel: 'Plan first beat',
      },
      {
        sliderLabel: '+4h',
        title: 'Project the late-race current at T + 4h.',
        body:
          'The ebb strengthens and the left gate becomes safer. Overstanding the weather mark is less punished, but exits need more pace.',
        windOverlayLabel: '116|12.6',
        windChip: '12.6 kn ESE',
        tideOverlayLabel: '278|0.6',
        tideChip: 'Ebb 0.6 kn',
        waveOverlayLabel: '296|0.8',
        waveChip: '0.8 m swell',
        slack: '09:12',
        ctaLabel: 'Plan gate exit',
      },
      {
        sliderLabel: '+5h',
        title: 'Read the final run at T + 5h.',
        body:
          'The ebb is now fully on and the breeze is strongest. Downwind lanes compress quickly, so protect room at the leeward gate.',
        windOverlayLabel: '120|13.2',
        windChip: '13.2 kn ESE',
        tideOverlayLabel: '284|0.7',
        tideChip: 'Ebb 0.7 kn',
        waveOverlayLabel: '300|0.9',
        waveChip: '0.9 m swell',
        slack: '08:41',
        ctaLabel: 'Plan final run',
      },
    ],
    [],
  );
  const scrubWindow = tideWindows[Math.min(scrubIndex, tideWindows.length - 1)] ?? tideWindows[0];
  const fallbackRaceMarkPins = useMemo<AtlasPinSpec[]>(
    () => [
      {
        id: 'f2-race-start',
        lat: 22.2819,
        lng: 114.1772,
        kind: 'race-mark',
        label: 'PIN',
        subtitle: 'Favoured end · start line',
        provenance: 'Local course draft · share with crew or fleet when ready',
      },
      {
        id: 'f2-race-cb',
        lat: 22.2813,
        lng: 114.1849,
        kind: 'race-mark',
        label: 'CB',
        subtitle: 'Committee boat end · start line',
        provenance: 'Local course draft · share with crew or fleet when ready',
      },
      {
        id: 'f2-race-mark-1',
        lat: 22.2874,
        lng: 114.1808,
        kind: 'race-mark',
        label: '1',
        subtitle: `Windward mark · ${next?.label ?? 'Race 5'}`,
        provenance: 'Local course draft · share with crew or fleet when ready',
      },
      {
        id: 'f2-race-mark-2',
        lat: 22.2832,
        lng: 114.1807,
        kind: 'race-mark',
        label: '2',
        subtitle: `Leeward mark · ${next?.label ?? 'Race 5'}`,
        provenance: 'Local course draft · share with crew or fleet when ready',
      },
      {
        id: 'f2-race-mark-3a',
        lat: 22.2852,
        lng: 114.1785,
        kind: 'race-mark',
        label: '3A',
        subtitle: `Gate mark · ${next?.label ?? 'Race 5'}`,
        provenance: 'Local course draft · share with crew or fleet when ready',
      },
      {
        id: 'f2-race-mark-3b',
        lat: 22.2852,
        lng: 114.1829,
        kind: 'race-mark',
        label: '3B',
        subtitle: `Gate mark · ${next?.label ?? 'Race 5'}`,
        provenance: 'Local course draft · share with crew or fleet when ready',
      },
      {
        id: 'f2-start-line',
        lat: 22.2816,
        lng: 114.1810,
        kind: 'walk-annotation',
        walkLine: {
          from: [114.1772, 22.2819],
          to: [114.1849, 22.2813],
        },
      },
      {
        id: 'f2-leg-1',
        lat: 22.2844,
        lng: 114.1791,
        kind: 'walk-annotation',
        walkLine: {
          from: [114.1772, 22.2819],
          to: [114.1808, 22.2874],
        },
      },
      {
        id: 'f2-leg-2',
        lat: 22.2854,
        lng: 114.1807,
        kind: 'walk-annotation',
        walkLine: {
          from: [114.1785, 22.2852],
          to: [114.1829, 22.2852],
        },
      },
      {
        id: 'f2-leg-3',
        lat: 22.2839,
        lng: 114.1796,
        kind: 'walk-annotation',
        walkLine: {
          from: [114.1785, 22.2852],
          to: [114.1807, 22.2832],
        },
      },
    ],
    [next?.label],
  );
  const raceMarkPins = liveRaceMarkPins.length > 0 ? liveRaceMarkPins : fallbackRaceMarkPins;
  const windFieldPins = useMemo<AtlasPinSpec[]>(
    () => [
      { id: 'f2-wind-field-1', lat: 22.2878, lng: 114.1778, kind: 'wind-arrow', label: `${scrubWindow.windOverlayLabel}|field` },
      { id: 'f2-wind-field-2', lat: 22.2878, lng: 114.1805, kind: 'wind-arrow', label: `${scrubWindow.windOverlayLabel}|field` },
      { id: 'f2-wind-field-3', lat: 22.2878, lng: 114.1832, kind: 'wind-arrow', label: `${scrubWindow.windOverlayLabel}|field` },
      { id: 'f2-wind-field-4', lat: 22.2860, lng: 114.1778, kind: 'wind-arrow', label: `${scrubWindow.windOverlayLabel}|field` },
      { id: 'f2-wind-field-5', lat: 22.2860, lng: 114.1805, kind: 'wind-arrow', label: `${scrubWindow.windOverlayLabel}|field` },
      { id: 'f2-wind-field-6', lat: 22.2860, lng: 114.1832, kind: 'wind-arrow', label: `${scrubWindow.windOverlayLabel}|field` },
      { id: 'f2-wind-field-7', lat: 22.2842, lng: 114.1778, kind: 'wind-arrow', label: `${scrubWindow.windOverlayLabel}|field` },
      { id: 'f2-wind-field-8', lat: 22.2842, lng: 114.1805, kind: 'wind-arrow', label: `${scrubWindow.windOverlayLabel}|field` },
      { id: 'f2-wind-field-9', lat: 22.2842, lng: 114.1832, kind: 'wind-arrow', label: `${scrubWindow.windOverlayLabel}|field` },
      { id: 'f2-wind-primary', lat: 22.2885, lng: 114.1788, kind: 'wind-arrow', label: scrubWindow.windOverlayLabel, subtitle: scrubWindow.windChip },
    ],
    [scrubWindow.windChip, scrubWindow.windOverlayLabel],
  );
  // Wave / swell field — a sparse grid offset from the wind grid so the
  // three marine fields interleave rather than stack on the same coords.
  const waveFieldPins = useMemo<AtlasPinSpec[]>(
    () => [
      { id: 'f2-wave-field-1', lat: 22.2870, lng: 114.1791, kind: 'wave-arrow', label: `${scrubWindow.waveOverlayLabel}|field` },
      { id: 'f2-wave-field-2', lat: 22.2870, lng: 114.1818, kind: 'wave-arrow', label: `${scrubWindow.waveOverlayLabel}|field` },
      { id: 'f2-wave-field-3', lat: 22.2851, lng: 114.1791, kind: 'wave-arrow', label: `${scrubWindow.waveOverlayLabel}|field` },
      { id: 'f2-wave-field-4', lat: 22.2851, lng: 114.1818, kind: 'wave-arrow', label: `${scrubWindow.waveOverlayLabel}|field` },
      { id: 'f2-wave-primary', lat: 22.2873, lng: 114.1832, kind: 'wave-arrow', label: scrubWindow.waveOverlayLabel, subtitle: scrubWindow.waveChip },
    ],
    [scrubWindow.waveChip, scrubWindow.waveOverlayLabel],
  );
  const coursePins = useMemo<AtlasPinSpec[]>(
    () => [
      ...windFieldPins,
      ...waveFieldPins,
      {
        id: 'f2-tide-ebb',
        lat: 22.2863,
        lng: 114.1817,
        kind: 'tide-arrow',
        label: scrubWindow.tideOverlayLabel,
        subtitle: scrubWindow.tideChip,
      },
      ...raceMarkPins,
      {
        id: 'f2-you-pin-end',
        lat: 22.2815,
        lng: 114.1789,
        kind: 'you',
        label: 'You',
        subtitle: 'Helm setup near the pin end.',
        provenance: 'Your current approach line.',
      },
      {
        id: 'f2-crew-pin',
        lat: 22.2818,
        lng: 114.1804,
        kind: 'crew',
        label: 'Crew',
        subtitle: 'Your crew staging just off the line.',
        provenance: 'Shared boat position.',
      },
      {
        id: 'f2-fleet-1',
        lat: 22.2812,
        lng: 114.1827,
        kind: 'fleet',
        label: 'Fleet',
        subtitle: 'Fleet boat holding the middle lane.',
        provenance: 'Nearby competitor track.',
      },
      {
        id: 'f2-fleet-2',
        lat: 22.2820,
        lng: 114.1841,
        kind: 'fleet',
        subtitle: 'Fleet boat setting up to leeward.',
        provenance: 'Nearby competitor track.',
      },
      {
        id: 'f2-fleet-3',
        lat: 22.2826,
        lng: 114.1851,
        kind: 'fleet',
        subtitle: 'Fleet boat reaching in from the starboard side.',
        provenance: 'Nearby competitor track.',
      },
    ],
    [raceMarkPins, scrubWindow.tideChip, scrubWindow.tideOverlayLabel, windFieldPins, waveFieldPins],
  );
  const visiblePins = useMemo(
    () =>
      coursePins.filter((pin) => {
        if (pin.kind === 'race-mark') return showRaceMarks;
        if (pin.kind === 'walk-annotation') return showRaceMarks;
        if (pin.kind === 'wind-arrow') return showWind;
        if (pin.kind === 'tide-arrow') return showTide;
        if (pin.kind === 'wave-arrow') return showWaves;
        if (pin.kind === 'you' || pin.kind === 'crew') return showCrew;
        if (pin.kind === 'fleet') return showFleet;
        return true;
      }),
    [coursePins, showCrew, showFleet, showRaceMarks, showTide, showWind, showWaves],
  );
  const controlledLayerKeys = useMemo(() => {
    const out = new Set<string>();
    if (showRaceMarks) out.add('sailing.race_marks');
    if (showWind) out.add('sailing.wind');
    if (showTide) out.add('sailing.tide');
    if (showCourse) out.add('sailing.course');
    return out;
  }, [showRaceMarks, showTide, showWind, showCourse]);
  const handleLayerToggle = useCallback((key: string, on: boolean) => {
    if (key === 'sailing.race_marks') setShowRaceMarks(on);
    if (key === 'sailing.wind') setShowWind(on);
    if (key === 'sailing.tide') setShowTide(on);
    if (key === 'sailing.course') setShowCourse(on);
  }, []);
  const handleChipChange = useCallback((activeIds: string[]) => {
    setShowRaceMarks(activeIds.includes('race-marks'));
    setShowWind(activeIds.includes('wind'));
    setShowTide(activeIds.includes('tide'));
    setShowWaves(activeIds.includes('waves'));
    setShowCrew(activeIds.includes('crew'));
    setShowFleet(activeIds.includes('fleet'));
  }, []);
  const handlePinPress = useCallback((pin: AtlasPinSpec) => {
    setLayersOpen(false);
    setSelectedPin(pin);
  }, []);
  const clearSelectedPin = useCallback(() => setSelectedPin(null), []);
  const title = next?.label ? `${next.label} · course` : 'Race 5 · course';
  const subtitle = next
    ? [next.where, next.when].filter(Boolean).join(' · ') || handlers.subtitleOverride || 'RHKYC · Victoria Harbour'
    : handlers.subtitleOverride ?? 'RHKYC · Victoria Harbour · Sat 10:00';
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <View style={shellStyles.mapArea}>
        <View style={[shellStyles.floatingChrome, { paddingTop: embedded ? Math.max(insets.top + 8, 48) : 50 }]}>
          <TopChrome
            title={title}
            subtitle={subtitle}
            avatarInitial={handlers.avatarInitial ?? 'F'}
            onLayersPress={() => setLayersOpen(true)}
            onAvatarPress={handlers.onAvatarPress}
          />
          <FilterChipsRow
            chips={[
              { id: 'race-marks', label: 'Race marks', icon: 'triangle-outline', active: true },
              { id: 'wind', label: 'Wind', icon: 'flag-outline', active: true },
              { id: 'tide', label: 'Tide', icon: 'water-outline', active: true },
              { id: 'waves', label: 'Waves', icon: 'pulse-outline', active: false },
              { id: 'crew', label: 'Crew', tone: 'crew', active: true },
              { id: 'fleet', label: 'Fleet', tone: 'fleet', active: true },
            ]}
            onActiveIdsChange={handleChipChange}
            rightInset={104}
            compact
          />
        </View>

        {handlers.useMapLibre ? (
          <AtlasMapLibreCanvas
            frame="f2"
            pins={visiblePins}
            onPinPress={handlePinPress}
            showCourse={showCourse}
          />
        ) : (
          <RaceMarksZoomMap />
        )}

        {!handlers.useMapLibre ? (
          <>
            {showCrew ? <AtlasPin kind="crew" leftPct={32} topPct={66} selected /> : null}
            {showFleet ? (
              <>
                <AtlasPin kind="fleet" leftPct={48} topPct={56} />
                <AtlasPin kind="fleet" leftPct={62} topPct={68} />
                <AtlasPin kind="fleet" leftPct={70} topPct={62} />
                <AtlasPin kind="following" leftPct={42} topPct={72} />
              </>
            ) : null}
          </>
        ) : null}

        <View style={[shellStyles.zoomIndicator, { bottom: 12, right: 12 }]}>
          <Text style={shellStyles.zoomText}>zoom 14.2</Text>
        </View>
      </View>

      {layersOpen ? null : selectedPin ? (
        <BottomSheet
          eyebrow={eyebrowForPin(selectedPin)}
          title={titleForPin(selectedPin)}
          body={detailBodyForPin(selectedPin, [
            selectedPin.kind === 'you' || selectedPin.kind === 'crew' || selectedPin.kind === 'fleet'
              ? 'These dots are nearby boat positions, not planned or completed steps.'
              : null,
            selectedPin.kind === 'race-mark'
              ? 'Committee-set marks are informational here. You read them and plan around them; moving them belongs in race management, not on your practice map.'
              : null,
          ])}
          primary={{ label: 'Close', icon: 'close', onPress: clearSelectedPin }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="expanded"
        />
      ) : (
        <BottomSheet
          eyebrow="TIDE · SCRUB TO START"
          title={scrubWindow.title}
          body={scrubWindow.body}
          expandedContent={
            <View style={shellStyles.f2ScrubWrap}>
              <View style={shellStyles.f2ScrubHeader}>
                <Text style={shellStyles.f2ScrubHeaderLabel}>Tide window</Text>
                <Text style={shellStyles.f2ScrubHeaderValue}>{scrubWindow.sliderLabel.toUpperCase()}</Text>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={tideWindows.length - 1}
                step={1}
                value={scrubIndex}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="rgba(60, 60, 67, 0.18)"
                thumbTintColor="#007AFF"
                onValueChange={(value) => setScrubIndex(Math.round(value))}
                onSlidingComplete={(value) => setScrubIndex(Math.round(value))}
              />
              <View style={shellStyles.f2ScrubTicks}>
                {tideWindows.map((window) => (
                  <Text key={window.sliderLabel} style={shellStyles.f2ScrubTickText}>
                    {window.sliderLabel}
                  </Text>
                ))}
              </View>
              <View style={shellStyles.f2ScrubMetrics}>
                <Stat value={scrubWindow.sliderLabel.toUpperCase()} label="TIDE SCRUB" />
                <Stat value={scrubWindow.slack} label="SLACK" />
                <Stat value={scrubWindow.windChip.toUpperCase()} label="WIND" />
              </View>
              <View style={shellStyles.f2SheetLegend}>
                <View style={shellStyles.f2SheetLegendRow}>
                  <View style={shellStyles.f2LegendSquare} />
                  <Text style={shellStyles.f2SheetLegendText}>Orange squares are committee-set race marks.</Text>
                </View>
                <View style={shellStyles.f2SheetLegendRow}>
                  <View style={shellStyles.f2LegendDotCrew} />
                  <Text style={shellStyles.f2SheetLegendText}>Red dots are you and your crew.</Text>
                </View>
                <View style={shellStyles.f2SheetLegendRow}>
                  <View style={shellStyles.f2LegendDotFleet} />
                  <Text style={shellStyles.f2SheetLegendText}>Dark dots are other fleet boats nearby.</Text>
                </View>
              </View>
            </View>
          }
          primary={{
            label: scrubWindow.ctaLabel,
            icon: 'add',
            onPress: () =>
              handlers.onPrimaryAction?.({
                lat: raceStart.lat,
                lng: raceStart.lng,
                place: `${next?.label ?? 'Race 5'} start · ${next?.where ?? 'Victoria Harbour'}`,
                suggestedTitle: `${next?.label ?? 'Upcoming race'} · ${scrubWindow.ctaLabel.toLowerCase()}`,
                suggestedCategory: 'sailing',
                suggestedInterestSlug: 'sail-racing',
                metadata: {
                  atlas: {
                    course_source: liveRaceMarkPins.length > 0 ? 'official' : 'draft',
                    local_knowledge_sharing: {
                      audiences: ['crew', 'fleet', 'followers', 'following', 'public'],
                      share_marks: true,
                      share_notes: true,
                      share_track: false,
                    },
                    race_course_context: {
                      scrub_label: scrubWindow.sliderLabel,
                      scrub_title: scrubWindow.title,
                      plan_focus: scrubWindow.ctaLabel,
                      wind_chip: scrubWindow.windChip,
                      tide_chip: scrubWindow.tideChip,
                      slack: scrubWindow.slack,
                    },
                  },
                },
              }),
          }}
          secondary={{
            label: 'Leader replay',
            icon: 'play-circle-outline',
            onPress: () =>
              comingSoonAlert(
                'Leader replay',
                'This will replay the best starts from the fleet against the current wind and tide window. Race replay ships with the race-course phase.',
              ),
          }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="mid"
        />
      )}

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && (
        <LayersSheet
          frame="f2"
          onClose={() => setLayersOpen(false)}
          controlledActiveKeys={controlledLayerKeys}
          onToggle={handleLayerToggle}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// F3 — World Dragon (cross-fleet class lens)
// ---------------------------------------------------------------------------
function FrameF3({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const [layersOpen, setLayersOpen] = useState(false);
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="Dragon world"
        subtitle={handlers.subtitleOverride ?? '4 fleets · 1 class · zoom 3'}
        avatarInitial={handlers.avatarInitial ?? "F"}
      />
      <FilterChipsRow
        chips={[
          { id: 'class', label: 'Dragon class', icon: 'globe-outline', active: true },
          { id: 'crew', label: 'Crew', tone: 'crew' },
          { id: 'fleet', label: 'Fleet', tone: 'fleet' },
          { id: 'following', label: 'Following', tone: 'following' },
        ]}
      />
      <View style={shellStyles.mapArea}>
        {handlers.useMapLibre ? (
          <AtlasMapLibreCanvas frame="f3" />
        ) : (
          <WorldDragonMap />
        )}
        {/* Cluster bubbles spaced enough that the labels don't touch.
            Amsterdam (NL), Vilamoura (Worlds, PT) and HK are real
            geographic positions on the canonical world map; tightened
            slightly so the bubbles fit the phone column without
            collision. */}
        <ClusterTag leftPct={58} topPct={18} label="AMSTERDAM" count="18 sailors" />
        <ClusterTag leftPct={82} topPct={45} label="RHKYC · 24" count="SAILORS" highlight />
        <ClusterTag leftPct={38} topPct={38} label="WORLDS 2026" count="VILAMOURA" />
        <LayersFab
          onLayersPress={() => setLayersOpen(true)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      </View>

      <BottomSheet
        eyebrow="INTERNATIONAL PEERS · CLASS LENS"
        title="The Dragon community on one canvas."
        body="Zoom in to a fleet to see its pins. Race marks fade between zoom 8 — 9 to keep the world readable."
        primary={{ label: 'Back to Hong Kong', icon: 'arrow-back', onPress: handlers.onPrimaryAction }}
        secondary={{ label: 'Follow Amsterdam', onPress: handlers.onSecondaryAction }}
      />

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && (
        <LayersSheet
          frame="f3"
          onClose={() => setLayersOpen(false)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// F4 — Emily · Baltimore cold
// ---------------------------------------------------------------------------
function FrameF4({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const { user: authUser } = useAuth();
  // Search state — F4 inherited the shared TopChrome
  // pattern (which only renders a search glyph when onSearchPress is
  // wired) and had no headless InterestSwitcher mounted, so the
  // capsule's chevron tap fired into the void on the nursing frame.
  const [searchOpen, setSearchOpen] = useState(false);
  const handleSearchSelect = useCallback((result: AtlasSearchResult) => {
    setSearchOpen(false);
    if (result.kind === 'person' && result.userId) {
      router.push(`/profile/${result.userId}` as never);
      return;
    }
    if (result.kind === 'organization' && result.orgSlug) {
      if (result.lat != null && result.lng != null) {
        setSelectedNursingSite({
          id: result.orgSlug,
          name: result.name,
          lat: result.lat,
          lng: result.lng,
        });
        return;
      }
      router.push(`/organizations/${result.orgSlug}` as never);
      return;
    }
    if (result.lat != null && result.lng != null) {
      setSelectedNursingSite({
        id: result.id,
        name: result.name,
        lat: result.lat,
        lng: result.lng,
      });
    }
  }, []);
  // Real institution POIs + peer step pins for Baltimore. F4 camera is
  // centered on JHSON campus (39.297, -76.591) — see FRAME_CAMERA.
  const { pins: framePins, pickerSteps, archiveSteps } = useAtlasFramePins({
    lat: 39.297,
    lng: -76.591,
    interestSlug: 'nursing',
    radiusKm: 25,
  });
  // Rotation arcs (= seasons) + logged clinical sites feed the step picker's
  // ROTATION groups and YOUR CLINICAL SITES jump list.
  const { data: f4AllSeasons = [] } = useUserSeasons();
  const { data: f4CurrentSeason } = useCurrentSeason();
  const { sites: f4LoggedSites } = useNursingLoggedSites();
  const { pois: f4Pois } = useAtlasPois();
  // Next event — for the nursing demo we fall back to a fixture clinical
  // at JHH 4 South 7am tomorrow so the amber NEXT pill always reads.
  // When useAtlasNextEvent surfaces a real nursing event we'll prefer
  // that. The amber pill answers Emily's first question on landing:
  // "where am I tomorrow?"
  const nextNursing = useMemo<AtlasNextEvent>(() => {
    const base: AtlasNextEvent =
      handlers.nextEvent?.lat && handlers.nextEvent?.lng
        ? handlers.nextEvent
        : {
            label: 'Clinical',
            when: 'Tmrw 7am',
            where: 'JHH 4 South',
            conditions: 'JHH 4 South · cardiac',
            lat: 39.2966,
            lng: -76.5919,
          };
    // Phase A.2b — if the viewer already has a planned step within ~500m
    // of the NEXT POI, flip has_user_step so the bottom sheet's primary
    // CTA becomes "Open clinical" instead of "Plan a step here".
    const hasUserStep =
      base.lat != null &&
      base.lng != null &&
      framePins.some(
        (p) =>
          p.kind === 'my-step-planned' &&
          Math.abs(p.lat - (base.lat ?? 0)) < 0.005 &&
          Math.abs(p.lng - (base.lng ?? 0)) < 0.005,
      );
    // Source attribution — fixture-labeled until a real next_event_resolver
    // surfaces the row. When hasUserStep is true the source is the user's
    // own timeline; otherwise it's the demo placeholder.
    const sourceLabel =
      base.source_label ??
      (hasUserStep ? 'From: your timeline' : 'From: demo cohort schedule');
    return {
      ...base,
      eyebrow: base.eyebrow ?? 'NEXT SHIFT',
      has_user_step: hasUserStep,
      source_label: sourceLabel,
    };
  }, [handlers.nextEvent, framePins]);
  // Map filter chips (You / Cohort / Program / Faculty) — each toggles a pin
  // category on the live map. All default on so the map lands fully populated;
  // tapping a chip narrows. NB: the Cohort chip uses id 'peers' because the
  // shared FilterChipsRow treats a literal 'cohort' id as a single-select
  // anchor (clears the others) — not what we want for an independent toggle.
  const [showYouPins, setShowYouPins] = useState(true);
  const [showCohortPins, setShowCohortPins] = useState(true);
  const [showProgramPins, setShowProgramPins] = useState(true);
  const [showFacultyPins, setShowFacultyPins] = useState(true);
  const handleNursingChipsChange = useCallback((activeIds: string[]) => {
    const you = activeIds.includes('you');
    const cohort = activeIds.includes('peers');
    const program = activeIds.includes('program');
    const faculty = activeIds.includes('faculty');
    setShowYouPins(you);
    setShowCohortPins(cohort);
    setShowProgramPins(program);
    setShowFacultyPins(faculty);
    // If a chip is toggled OFF that hides the currently-selected pin's
    // category, dismiss its detail sheet too — otherwise the card lingers
    // over a pin that's no longer on the map.
    setSelectedPin((prev) => {
      if (!prev) return prev;
      const k = prev.kind;
      if (k === 'poi-preceptor') return faculty ? prev : null;
      if (k === 'org-event') return program ? prev : null;
      if (k === 'following' || k === 'crew' || k === 'fleet') return cohort ? prev : null;
      if (typeof k === 'string' && k.startsWith('my-step')) return you ? prev : null;
      return prev;
    });
  }, []);
  // Apply the chip lens to the frame pins. Institution geography (hospitals,
  // sim labs) is never filtered — it's the orientation layer, not a lens
  // target — so only person/step/faculty pins respond to the chips.
  const nursingMapPins = useMemo(
    () =>
      framePins.filter((p) => {
        if (p.kind === 'poi-preceptor') return showFacultyPins;
        if (p.kind === 'org-event') return showProgramPins;
        if (p.kind === 'following' || p.kind === 'crew' || p.kind === 'fleet') {
          return showCohortPins;
        }
        if (typeof p.kind === 'string' && p.kind.startsWith('my-step')) {
          return showYouPins;
        }
        return true;
      }),
    [framePins, showYouPins, showCohortPins, showProgramPins, showFacultyPins],
  );
  // No walk-time annotations in the nursing frame: hospital-to-hospital
  // walking minutes are the sailor's distance/layline grammar misapplied —
  // no nurse optimizes a JHH↔Pinkard walk. (Kept for sailing if desired.)
  // Sites | Map segment — the N1 reframe. Sites is the default surface: the
  // street map is near content-free for a nursing student, so it's demoted to
  // a secondary toggle (kept for cold first-run POI discovery + orientation).
  const [f4View, setF4View] = useState<'sites' | 'coverage' | 'map'>(
    handlers.initialView === 'map' ? 'map' : 'sites',
  );
  // Measured floating-chrome height. The chrome grows on the Map view (it
  // adds a FilterChipsRow), so a hardcoded toolbarOffset underlapped the
  // surfaces; measure the actual chrome and feed it to each surface inset.
  const [nursingChromeH, setNursingChromeH] = useState(132);
  const [selectedNursingSite, setSelectedNursingSite] = useState<NursingSiteDetailTarget | null>(null);
  // Log-a-shift (N2) — the located-evidence write path. Opening sets the
  // target site; null closes the sheet.
  const [logShiftSite, setLogShiftSite] = useState<LogShiftSite | null>(null);
  // Map audience chips — nursing keeps the street map as a secondary node
  // surface, not a chart/heatmap layer.
  const openNursingSiteDetail = useCallback((site: NursingSiteDetailTarget) => {
    setSelectedPin(null);
    setNextEventSheetOpen(false);
    setCandidate(null);
    setSelectedNursingSite(site);
  }, []);
  const chooseNursingWhereSite = useCallback((site: NursingSiteDetailTarget) => {
    if (handlers.initialCommitMode && site.lat != null && site.lng != null) {
      handlers.onPrimaryAction?.({
        lat: site.lat,
        lng: site.lng,
        place: site.unit ? `${site.name} · ${site.unit}` : site.name,
      });
      return;
    }
    openNursingSiteDetail(site);
  }, [handlers, openNursingSiteDetail]);
  const openNursingLogShift = useCallback((site: NursingSiteDetailTarget) => {
    setLogShiftSite({
      id: site.id,
      name: site.name,
      unit: site.unit,
      lat: site.lat,
      lng: site.lng,
    });
  }, []);
  const planNursingStepAtSite = useCallback((site: NursingSiteDetailTarget, title?: string) => {
    handlers.onPrimaryAction?.(
      site.lat != null && site.lng != null
        ? {
            lat: site.lat,
            lng: site.lng,
            place: site.unit ? `${site.name} · ${site.unit}` : site.name,
            suggestedTitle: title ?? `Clinical shift at ${site.unit ?? site.name}`,
            suggestedCategory: 'clinical',
            suggestedInterestSlug: 'nursing',
            metadata: {
              nursing: {
                source: 'atlas',
                site_id: site.id,
                site_name: site.name,
                unit: site.unit ?? null,
                privacy_floor: 'site',
              },
              plan: {
                what_will_you_do: title
                  ? `Prepare for ${title} at ${site.name}`
                  : `Prepare for clinical shift at ${site.unit ?? site.name}`,
                where_location: {
                  name: site.unit ? `${site.name} · ${site.unit}` : site.name,
                  lat: site.lat,
                  lng: site.lng,
                },
                target_event_kind: 'clinical_shift',
              },
            },
          }
        : undefined,
    );
  }, [handlers]);
  // Pin tap state — race-marks/peer/POI/cohort cells all route through
  // selectedPin so the sheet swap is one place. Mirror of FrameF1.
  const [selectedPin, setSelectedPin] = useState<AtlasPinSpec | null>(null);
  const [nextEventSheetOpen, setNextEventSheetOpen] = useState(false);
  // Step-selector dropdown (mirrors F1/F7) — the chrome's second pill, to the
  // right of the Nursing interest pill. Picking a step recenters the Map view
  // on that step's pin and opens its sheet. Replaces the hardcoded "Atlas"
  // title in the header.
  const [openStepPickerVisible, setOpenStepPickerVisible] = useState(false);
  const [f4FocusLocation, setF4FocusLocation] = useState<{ lat: number; lng: number } | null>(null);
  const selectedPickerStepId =
    selectedPin && isUserStepPin(selectedPin) ? selectedPin.stepId ?? null : null;
  const f4TopStepPickerStepId = useMemo(() => {
    if (selectedPickerStepId) return selectedPickerStepId;
    return (
      pickerSteps.find((step) => step.status === 'planned-next')?.step_id ??
      pickerSteps.find((step) => step.has_place)?.step_id ??
      pickerSteps[0]?.step_id ??
      null
    );
  }, [pickerSteps, selectedPickerStepId]);
  const f4TopStepActionLabel = useMemo(() => {
    const stepId = f4TopStepPickerStepId;
    if (!stepId) return 'Pick step';
    const index = pickerSteps.findIndex((step) => step.step_id === stepId);
    if (index < 0) return 'Pick step';
    const step = pickerSteps[index];
    const ordinal = `${index + 1}/${pickerSteps.length}`;
    const title = step?.title?.trim();
    return title ? `${title} · ${ordinal}` : `Step ${ordinal}`;
  }, [pickerSteps, f4TopStepPickerStepId]);
  const handlePickF4StepFromPicker = useCallback(
    (step: PickerStep) => {
      setOpenStepPickerVisible(false);
      setNextEventSheetOpen(false);
      setSelectedNursingSite(null);
      setF4View('map');
      const pin = framePins.find((candidate) => candidate.stepId === step.step_id);
      if (pin) {
        setF4FocusLocation({ lat: pin.lat, lng: pin.lng });
        setSelectedPin(pin);
        return;
      }
      if (step.has_place && step.lat != null && step.lng != null) {
        setF4FocusLocation({ lat: step.lat, lng: step.lng });
        setSelectedPin({
          id: `step-picker:${step.step_id}`,
          kind: 'my-step-planned',
          stepId: step.step_id,
          label: step.title,
          subtitle: step.location_name ?? undefined,
          lat: step.lat,
          lng: step.lng,
        });
      }
    },
    [framePins],
  );
  // The step↔site cross-link (YOUR STEP "View site" jump + the site callout's
  // "N of your steps here" list + tap-to-open). Frame-agnostic: drawn from the
  // full located set (picker + archive) so older rotations still resolve.
  const { openStepById, siteForSelectedStep, myStepsAtSelectedPoi } = useFrameStepSiteLinks({
    framePins,
    steps: useMemo(() => [...pickerSteps, ...archiveSteps], [pickerSteps, archiveSteps]),
    selectedPin,
    setSelectedPin,
    onFocusLocation: setF4FocusLocation,
    onStepPress: handlers.onStepPress,
  });
  // Rotation arcs for the picker — every nursing step bucketed by its
  // rotation (= season), current rotation first and expanded. Mirrors the
  // sail-racing arc resolution: explicit metadata.season_id → date
  // containment → season_id column → nearest rotation in time. Empty until
  // the student has rotations seeded, in which case the picker stays flat.
  const f4ArcGroups = useMemo<ArcStepGroup[]>(() => {
    const entries: (ArchivePickerStep & ArcStepEntry)[] = [...pickerSteps, ...archiveSteps];
    if (entries.length === 0 || f4AllSeasons.length === 0) return [];
    const knownIds = new Set(f4AllSeasons.map((s) => s.id));
    const DAY_MS = 24 * 3600 * 1000;
    const windowSeasons = f4AllSeasons
      .filter((s) => s.start_date && s.end_date)
      .sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date));
    const resolveArc = (step: ArchivePickerStep): string | null => {
      if (step.meta_season_id && knownIds.has(step.meta_season_id)) return step.meta_season_id;
      const t = Date.parse(step.starts_at ?? step.created_at);
      let nearest: { id: string; dist: number } | null = null;
      if (!Number.isNaN(t)) {
        for (const s of windowSeasons) {
          const start = Date.parse(s.start_date);
          const end = Date.parse(s.end_date) + DAY_MS;
          if (t >= start && t < end) return s.id;
          const dist = t < start ? start - t : t - end;
          if (!nearest || dist < nearest.dist) nearest = { id: s.id, dist };
        }
      }
      if (step.season_id && knownIds.has(step.season_id)) return step.season_id;
      return nearest?.id ?? null;
    };
    const byArc = new Map<string, (ArchivePickerStep & ArcStepEntry)[]>();
    for (const step of entries) {
      const arcId = resolveArc(step) ?? 'earlier';
      const bucket = byArc.get(arcId);
      if (bucket) bucket.push(step);
      else byArc.set(arcId, [step]);
    }
    for (const bucket of byArc.values()) {
      bucket.sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return Date.parse(a.created_at) - Date.parse(b.created_at);
      });
    }
    const orderedSeasons = [...f4AllSeasons].sort(compareSeasonsByStartDate).reverse();
    if (f4CurrentSeason?.id) {
      const idx = orderedSeasons.findIndex((s) => s.id === f4CurrentSeason.id);
      if (idx > 0) orderedSeasons.unshift(orderedSeasons.splice(idx, 1)[0]);
    }
    const groups: ArcStepGroup[] = [];
    for (const season of orderedSeasons) {
      const arcSteps = byArc.get(season.id);
      if (!arcSteps || arcSteps.length === 0) continue;
      const isCurrent = season.id === f4CurrentSeason?.id;
      groups.push({
        id: season.id,
        label: isCurrent ? `${season.name} · current` : season.name,
        isCurrent,
        steps: arcSteps,
      });
    }
    const earlier = byArc.get('earlier');
    if (earlier && earlier.length > 0) {
      groups.push({ id: 'earlier', label: 'Earlier', steps: earlier });
    }
    return groups;
  }, [pickerSteps, archiveSteps, f4AllSeasons, f4CurrentSeason?.id]);
  // Logged clinical sites for the picker's jump list — join the coverage
  // counts to each site's POI coords so a tap can fly the map there.
  const f4ClinicalSites = useMemo<ClinicalSiteItem[]>(() => {
    const coordByPoi = new Map(f4Pois.map((p) => [p.id, { lat: p.lat, lng: p.lng }]));
    return f4LoggedSites.map((s) => {
      const coord = coordByPoi.get(s.poiId);
      const parts = [
        `${s.shifts} ${s.shifts === 1 ? 'shift' : 'shifts'}`,
        s.evidenced > 0 ? `${s.evidenced} evidenced` : null,
      ].filter(Boolean);
      return {
        id: s.poiId,
        name: s.name,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
        subtitle: parts.join(' · '),
      };
    });
  }, [f4LoggedSites, f4Pois]);
  const handlePickF4Site = useCallback((site: ClinicalSiteItem) => {
    setOpenStepPickerVisible(false);
    setNextEventSheetOpen(false);
    setSelectedNursingSite(null);
    setF4View('map');
    if (site.lat != null && site.lng != null) {
      setF4FocusLocation({ lat: site.lat, lng: site.lng });
    }
  }, []);
  // Long-press → "PIN DROPPED · Plan a step here" sheet, mirroring F1.
  const [candidate, setCandidate] = useState<{ lng: number; lat: number } | null>(null);
  const { data: candidateNearest } = useNearestPlace({
    lat: candidate?.lat ?? null,
    lng: candidate?.lng ?? null,
    enabled: candidate !== null,
  });
  const candidateBody = useMemo(
    () => (candidate ? formatNearLabel(candidateNearest ?? null, candidate.lat, candidate.lng) : ''),
    [candidate, candidateNearest],
  );
  const clearF4SelectedPin = useCallback(() => setSelectedPin(null), []);
  const clearCandidate = useCallback(() => setCandidate(null), []);
  const handleNextEventTap = useCallback(() => {
    setSelectedPin(null);
    setNextEventSheetOpen(true);
  }, []);
  const closeNextEventSheet = useCallback(() => setNextEventSheetOpen(false), []);
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <View style={shellStyles.mapArea}>
        {selectedNursingSite ? (
          <NursingSiteDetailSurface
            site={selectedNursingSite}
            toolbarOffset={0}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0}
            onBack={() => setSelectedNursingSite(null)}
            onLogShift={openNursingLogShift}
          />
        ) : f4View === 'map' ? (
          handlers.useMapLibre ? (
            // Real Baltimore basemap (FRAME_CAMERA.f4 centers on the JHSON/JHH
            // campus) with the institution + peer pins from useAtlasFramePins.
            // Pin taps reuse the same selectedPin BottomSheet the Sites view
            // uses; long-press drops a candidate → "PIN DROPPED" anchor sheet.
            <AtlasMapLibreCanvas
              frame="f4"
              pins={nursingMapPins}
              nextEvent={
                nextNursing.lat != null && nextNursing.lng != null
                  ? { ...nextNursing, lat: nextNursing.lat, lng: nextNursing.lng }
                  : null
              }
              onPinPress={(pin) => setSelectedPin(pin)}
              onNextEventPress={handleNextEventTap}
              onMapLongPress={(coords) => {
                setSelectedPin(null);
                setCandidate(coords);
              }}
              candidate={candidate}
              focusLocation={f4FocusLocation}
            />
          ) : (
            <NursingMapSurface
              toolbarOffset={nursingChromeH}
              bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0}
              onOpenSite={chooseNursingWhereSite}
              onLogShift={openNursingLogShift}
              onPlanGap={(site) => planNursingStepAtSite(site, 'Pediatric assessment and OR scrub')}
            />
          )
        ) : f4View === 'coverage' ? (
          // Competency constellation (N3) — framework coverage from logged shifts.
          <NursingCoverageSurface
            toolbarOffset={nursingChromeH}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0}
            onPlanGap={(site, suggestedTitle) => planNursingStepAtSite(site, suggestedTitle)}
          />
        ) : (
          // Sites-first surface (default). Top inset clears the floating
          // chrome (title + segment); bottom inset clears the tab bar.
          <NursingSitesSurface
            nextEvent={nextNursing}
            toolbarOffset={nursingChromeH}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0}
            onSitePress={chooseNursingWhereSite}
            onLogShift={openNursingLogShift}
            onPlanStep={() => planNursingStepAtSite({
              id: 'next-rotation',
              name: nextNursing.where ?? 'Johns Hopkins Bayview Medical Center',
              unit: nextNursing.label === 'Clinical' ? 'MICU · Critical care' : nextNursing.label,
              lat: nextNursing.lat ?? undefined,
              lng: nextNursing.lng ?? undefined,
            })}
            onPrepPress={handleNextEventTap}
          />
        )}

        {/* Floating glass chrome — title + chips. Same pattern as F1. */}
        {!selectedNursingSite ? <View
          style={shellStyles.floatingChrome}
          onLayout={(e) => setNursingChromeH(e.nativeEvent.layout.height)}
        >
          <TopChrome
            title=""
            interestOverride={{ name: 'Nursing', accentColor: '#0097A7' }}
            stepSwitcher={
              pickerSteps.length > 0
                ? {
                    label: f4TopStepActionLabel,
                    onPress: () => setOpenStepPickerVisible(true),
                  }
                : null
            }
            avatarInitial={handlers.avatarInitial ?? 'E'}
            onSearchPress={() => setSearchOpen(true)}
            onNearbyPress={handlers.onNearbyPress}
          />
          {/* Sites | Coverage | Map segment — the reframe's spine. */}
          <View style={shellStyles.f4Segment}>
            {(['sites', 'coverage', 'map'] as const).map((mode) => {
              const label = mode === 'sites' ? 'Sites' : mode === 'coverage' ? 'Coverage' : 'Map';
              return (
                <Pressable
                  key={mode}
                  style={[
                    shellStyles.f4SegmentItem,
                    f4View === mode && shellStyles.f4SegmentItemActive,
                  ]}
                  onPress={() => {
                    setF4View(mode);
                    if (mode === 'map') setSelectedPin(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${label}`}
                  accessibilityState={{ selected: f4View === mode }}
                  testID={`atlas-nursing-segment-${mode}`}
                >
                  <Text
                    style={[
                      shellStyles.f4SegmentText,
                      f4View === mode && shellStyles.f4SegmentTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {f4View === 'map' ? (
          <View style={shellStyles.f4ChipsRow}>
            <FilterChipsRow
              chips={[
                { id: 'you', label: 'You', tone: 'you', active: true },
                { id: 'peers', label: 'Cohort', tone: 'cohort', active: true },
                { id: 'program', label: 'Program', tone: 'fleet', active: true },
                { id: 'faculty', label: 'Faculty', icon: 'school-outline', active: true },
              ]}
              onActiveIdsChange={handleNursingChipsChange}
            />
          </View>
          ) : null}
          {/* Headless InterestSwitcher hosts the modal so TopChrome's
              capsule pill (which calls openInterestSwitcher imperatively)
              can pop the picker. F1 mounts its own headless; F4 needs
              one too or the chevron taps are no-ops. */}
          <InterestSwitcher headless />
        </View> : null}

        {/* SVG-fallback fixtures: absolutely-positioned percentage pins
            only render when MapLibre is OFF. On the live MapLibre canvas
            these would freeze to the viewport during pan instead of moving
            with the map — the real institution pins come through the
            useAtlasFramePins → MLMarker path inside AtlasMapLibreCanvas. */}
        {f4View === 'map' && !handlers.useMapLibre && (
          <>
            <AtlasPin kind="osm-clinic" leftPct={48} topPct={50} label="Johns Hopkins Hosp." />
            <AtlasPin kind="osm-clinic" leftPct={72} topPct={42} label="Bayview" />
            <AtlasPin kind="osm-clinic" leftPct={22} topPct={62} label="U. of Maryland" />
            <AtlasPin kind="osm-clinic" leftPct={18} topPct={45} label="Sinai" />
            <AtlasPin kind="osm-clinic" leftPct={62} topPct={82} label="MedStar Harbor" />
            <AtlasPin kind="osm-clinic" leftPct={86} topPct={66} label="VA Medical Ctr." />
            <GhostStampOverlay leftPct={50} topPct={32} />
          </>
        )}

      </View>

      {f4View === 'coverage' ? null : candidate ? (
        // Coverage view is a full-height read surface — no persistent CTA sheet
        // overlays it (it would hide the gap card). Otherwise:
        // Long-press → "PIN DROPPED" sheet. Mirrors F1: reverse-geocodes
        // to "Near JHH" instead of raw coords, then routes through
        // handlers.onPrimaryAction to /races?openAddStep=1&pinLat=… so
        // the canonical add-step sheet picks up the location.
        <BottomSheet
          eyebrow="PIN DROPPED"
          title="Anchor a step at this location."
          body={candidateBody}
          primary={{
            label: 'Plan a step here',
            icon: 'add',
            onPress: () => {
              const pin = { lat: candidate.lat, lng: candidate.lng };
              clearCandidate();
              handlers.onPrimaryAction?.(pin);
            },
          }}
          secondary={{ label: 'Cancel', onPress: clearCandidate }}
          onClose={clearCandidate}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      ) : nextEventSheetOpen ? (
        <BottomSheet
          eyebrow={`TOMORROW · ${nextNursing.label.toUpperCase()}${nextNursing.when ? ` · ${nextNursing.when.toUpperCase()}` : ''}`}
          title={nextNursing.where ?? 'Your next clinical'}
          source={nextNursing.source_label}
          onSourcePress={() =>
            comingSoonAlert(
              'Open source',
              "Tapping the source line will open whatever surfaced this NEXT pill — a blueprint (e.g. MSN Acute Care · Week 6), a program session scheduled by your cohort lead, or your own timeline. The provenance routing ships with Phase 8 (pin source attribution).",
            )
          }
          body={[
            nextNursing.conditions,
            'Bring: stethoscope, scrub colors, badge.',
            nextNursing.has_user_step
              ? 'You have a clinical step on your timeline — open it to review intent and preceptor notes.'
              : '4 of your cohort are also on tomorrow. Tap Plan a step to pre-record your intent.',
          ]
            .filter(Boolean)
            .join('\n')}
          primary={
            nextNursing.has_user_step
              ? {
                  label: `Open ${nextNursing.label.toLowerCase()}`,
                  icon: 'open-outline',
                  onPress: () => {
                    closeNextEventSheet();
                    comingSoonAlert(
                      `Open ${nextNursing.label.toLowerCase()}`,
                      'This will open the existing step detail so you can review intent, preceptor notes, and pre-shift prep. Step-from-atlas navigation is being wired in Phase A.3.',
                    );
                  },
                }
              : {
                  label: 'Plan a step here',
                  icon: 'add',
                  onPress: () => {
                    closeNextEventSheet();
                    handlers.onPrimaryAction?.(
                      nextNursing.lat != null && nextNursing.lng != null
                        ? { lat: nextNursing.lat, lng: nextNursing.lng, place: nextNursing.where }
                        : undefined,
                    );
                  },
                }
          }
          secondary={{ label: 'Close', onPress: closeNextEventSheet }}
          onClose={closeNextEventSheet}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="expanded"
        />
      ) : selectedPin ? (
        selectedPin.kind === 'cohort-cell' ? (
          (() => {
            const [countStr, cluster] = (selectedPin.label ?? '0|general').split('|');
            const count = Number(countStr) || 0;
            const clusterLabel = cluster.charAt(0).toUpperCase() + cluster.slice(1);
            return (
              <BottomSheet
                eyebrow="COHORT CELL · THIS WEEK"
                title={`${count} step${count === 1 ? '' : 's'} here this week`}
                body={`Dominant skill: ${clusterLabel}.\nTap Anchor to add your own step nearby.`}
                primary={{
                  label: 'Anchor a step here',
                  icon: 'add',
                  onPress: () => {
                    handlers.onPrimaryAction?.({
                      lat: selectedPin.lat,
                      lng: selectedPin.lng,
                      place: selectedPin.label ?? undefined,
                    });
                    clearF4SelectedPin();
                  },
                }}
                secondary={{ label: 'Close', onPress: clearF4SelectedPin }}
                onClose={clearF4SelectedPin}
                bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
                initialState="expanded"
              />
            );
          })()
        ) : isUserStepPin(selectedPin) ? (
          // Viewer's own step pin — open the step detail, don't offer a
          // create-a-new-step CTA (that would silently duplicate the step
          // at the same location). Mirrors FrameF1's YOUR STEP branch.
          <BottomSheet
            key="user-step"
            eyebrow="YOUR STEP"
            title={titleForUserStepPin(selectedPin)}
            body={detailBodyForPin(selectedPin)}
            primary={{
              label: 'Open step',
              icon: 'open-outline',
              onPress: () => {
                if (selectedPin.stepId) {
                  handlers.onStepPress?.(selectedPin.stepId);
                  clearF4SelectedPin();
                }
              },
            }}
            // Cross-link to the place this step sits at — the header X already
            // closes, so the secondary slot jumps to the site callout instead
            // of a redundant "Close". Omitted when the step has no mapped site.
            secondary={
              siteForSelectedStep
                ? {
                    label: `View ${siteForSelectedStep.label ?? 'site'}`,
                    icon: 'business-outline',
                    onPress: () => {
                      setF4FocusLocation({
                        lat: siteForSelectedStep.lat,
                        lng: siteForSelectedStep.lng,
                      });
                      setSelectedPin(siteForSelectedStep);
                    },
                  }
                : { label: 'Close', onPress: clearF4SelectedPin }
            }
            showSecondaryInMid={siteForSelectedStep != null}
            onClose={clearF4SelectedPin}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="mid"
          />
        ) : (
          <BottomSheet
            eyebrow={eyebrowForPin(selectedPin)}
            title={selectedPin.label ?? 'Pin'}
            body={
              [selectedPin.subtitle, selectedPin.provenance]
                .filter(Boolean)
                .join('\n') || bodyForPin(selectedPin)
            }
            expandedContent={(() => {
              const poiId = knowledgePoiIdForPin(selectedPin);
              // Cross-link back to the viewer's own steps at this site — turns
              // the location callout from a dead end into "here's what you've
              // done here." Sits above the shared place-knowledge feed.
              const stepsHere =
                myStepsAtSelectedPoi.length > 0 ? (
                  <View style={shellStyles.stepsHereWrap}>
                    <Text style={shellStyles.stepsHereLabel}>
                      {myStepsAtSelectedPoi.length} of your step
                      {myStepsAtSelectedPoi.length === 1 ? '' : 's'} here
                    </Text>
                    <StackedStepList
                      steps={myStepsAtSelectedPoi}
                      onOpenStep={openStepById}
                    />
                  </View>
                ) : null;
              if (!poiId) return stepsHere ?? undefined;
              return (
                <>
                  {stepsHere}
                  <PlaceKnowledgeSection
                    anchor={{ poiId }}
                    conditions={null}
                    interestSlug="nursing"
                    onAddKnowledge={() => {
                      const label = selectedPin.label;
                      clearF4SelectedPin();
                      router.push({
                        pathname: '/venue/post/create',
                        params: { poiId, interestSlug: 'nursing', ...(label ? { poiName: label } : {}) },
                      } as never);
                    }}
                  />
                </>
              );
            })()}
            primary={{
              label:
                selectedPin.kind === 'poi-sim-anchor'
                  ? 'Block practice time'
                  : selectedPin.kind === 'poi-preceptor'
                    ? 'Open profile'
                    : 'Anchor a step here',
              icon: 'add',
              onPress: () => {
                // Preceptor "Open profile" is unwired — no profile route
                // exists yet for faculty. Stub honestly until Phase F
                // (reach-out channel sheet) lands.
                if (selectedPin.kind === 'poi-preceptor') {
                  clearF4SelectedPin();
                  comingSoonAlert(
                    'Open profile',
                    "Faculty profiles (office hours, shadowing history, contact channels) ship in Phase F. For now, you can save this preceptor to your mentors list when that lands.",
                  );
                  return;
                }
                handlers.onPrimaryAction?.({
                  lat: selectedPin.lat,
                  lng: selectedPin.lng,
                  place: selectedPin.label ?? selectedPin.subtitle ?? undefined,
                });
                clearF4SelectedPin();
              },
            }}
            secondary={{ label: 'Close', onPress: clearF4SelectedPin }}
            onClose={clearF4SelectedPin}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        )
      ) : null}

      {!embedded && !selectedNursingSite ? <MockTabBar activeTab="atlas" /> : null}

      {/* Search sheet sits at the frame's top level so its
          position:absolute inset:0 covers the full screen. Mounted
          inside floatingChrome it inherits a constrained stacking
          context and on web the map renders over its body. */}
      <AtlasSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
        viewerId={authUser?.id ?? null}
      />

      <LogShiftSheet
        visible={logShiftSite !== null}
        site={logShiftSite}
        onClose={() => setLogShiftSite(null)}
        onLogged={(count) =>
          showAlert(
            'Shift logged',
            `${count} competenc${count === 1 ? 'y' : 'ies'} added to this site. Coverage updated.`,
          )
        }
        bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0}
      />

      <OpenStepPicker
        visible={openStepPickerVisible}
        steps={pickerSteps}
        arcGroups={f4ArcGroups}
        clinicalSites={f4ClinicalSites}
        selectedStepId={f4TopStepPickerStepId}
        onDismiss={() => setOpenStepPickerVisible(false)}
        onPickStep={handlePickF4StepFromPicker}
        onPickSite={handlePickF4Site}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// F5 — Emily · JHU curated (competency overlay live)
// ---------------------------------------------------------------------------
function FrameF5({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const [layersOpen, setLayersOpen] = useState(false);
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="IV insertion · supervised"
        subtitle={handlers.subtitleOverride ?? '62 in cohort · 4 sites evidenced'}
        avatarInitial={handlers.avatarInitial ?? "E"}
      />
      <FilterChipsRow
        chips={[
          { id: 'you', label: 'You', tone: 'you' },
          { id: 'cohort', label: 'Cohort', tone: 'cohort', active: true },
          { id: 'jh', label: 'JH partners', icon: 'school-outline' },
          { id: 'competency', label: 'Competency', icon: 'ribbon-outline' },
        ]}
      />
      <View style={shellStyles.mapArea}>
        {handlers.useMapLibre ? (
          <AtlasMapLibreCanvas frame="f5" />
        ) : (
          <JhuCuratedMap />
        )}

        {/* Competency badge top-right */}
        <View style={[shellStyles.absChip, { top: 12, right: 12 }]}>
          <Ionicons name="ribbon" size={9} color="#AF52DE" />
          <Text style={shellStyles.absChipText}>competency · IV supervised</Text>
        </View>

        {/* SVG-fallback fixtures only — see F4 for the rationale. On the
            live MapLibre canvas these would freeze to viewport while the
            map pans, so we render them only when useMapLibre is OFF. */}
        {!handlers.useMapLibre && (
          <>
            <AtlasPin
              kind="jh-site"
              leftPct={55}
              topPct={48}
              label="Hopkins EB"
              badge="JH"
            />
            <View style={[shellStyles.absChip, { top: '38%', left: '68%', backgroundColor: '#AF52DE' }]}>
              <Text style={[shellStyles.absChipText, { color: '#FFF', fontWeight: '700' }]}>12</Text>
            </View>
            <AtlasPin kind="jh-site" leftPct={82} topPct={56} label="Bayview" badge="JH" />
            <AtlasPin kind="jh-site" leftPct={18} topPct={62} label="Suburban" badge="JH" />
            <AtlasPin kind="jh-site" leftPct={66} topPct={80} label="Howard County" badge="JH" />
            <AtlasPin kind="sim" leftPct={32} topPct={28} label="Pinkard" />
          </>
        )}

        <LayersFab
          onLayersPress={() => setLayersOpen(true)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      </View>

      <BottomSheet
        title="Where your cohort has evidenced this skill."
        body="38 of 62 · 4 sites · past 8 weeks"
        statsRow={[
          { value: '21', label: 'HOPKINS EB' },
          { value: '9', label: 'BAYVIEW' },
          { value: '6', label: 'SUBURBAN' },
          { value: '2', label: 'HOWARD CO.' },
        ]}
        primary={{ label: 'Plan supervised step', icon: 'add', onPress: handlers.onPrimaryAction }}
        secondary={{ label: 'See peer steps', icon: 'list-outline', onPress: handlers.onSecondaryAction }}
      />

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && (
        <LayersSheet
          frame="f5"
          onClose={() => setLayersOpen(false)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// F6 — Commit-mode (opened from Plan · Where)
// ---------------------------------------------------------------------------
const F6_DEFAULT_CANDIDATE = {
  lat: 22.286,
  lng: 114.182,
  place: 'Victoria Harbour',
};

function FrameF6({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const insets = useSafeAreaInsets();
  // When opened from a step's race map (RaceCourseLiveMap → ?frame=f6&lat&lng&area),
  // anchor the picker on that step's area instead of the demo default. initialFocus
  // is parsed synchronously from URL params, so seeding state from it is safe; the
  // effect below re-syncs if it arrives async (mirrors FrameF1).
  const focusArea = handlers.initialFocusLabel ?? null;
  const seedCandidate = handlers.initialFocus
    ? {
        lat: handlers.initialFocus.lat,
        lng: handlers.initialFocus.lng,
        place: focusArea ?? undefined,
      }
    : {
        lat: F6_DEFAULT_CANDIDATE.lat,
        lng: F6_DEFAULT_CANDIDATE.lng,
        place: F6_DEFAULT_CANDIDATE.place,
      };

  const [layersOpen, setLayersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocus, setSearchFocus] = useState<{ lat: number; lng: number } | null>(
    handlers.initialFocus ?? null,
  );
  const [candidate, setCandidate] = useState<{ lat: number; lng: number; place?: string }>(
    seedCandidate,
  );

  // The user's most common step locations, surfaced as one-tap chips so a
  // habitual spot never needs a manual pin-drop.
  const commonSpots = useStepLocationSuggestions({}).filter(
    (s) => s.lat != null && s.lng != null,
  );

  const focusLat = handlers.initialFocus?.lat;
  const focusLng = handlers.initialFocus?.lng;
  useEffect(() => {
    if (focusLat == null || focusLng == null) return;
    setCandidate({ lat: focusLat, lng: focusLng, place: focusArea ?? undefined });
    setSearchFocus({ lat: focusLat, lng: focusLng });
  }, [focusLat, focusLng, focusArea]);

  // "Default" = the unanchored demo spot; once we've seeded from a step's area
  // (initialFocus) the candidate is a real selection, not the Victoria Harbour
  // placeholder.
  const candidateIsDefault =
    !handlers.initialFocus &&
    Math.abs(candidate.lat - F6_DEFAULT_CANDIDATE.lat) < 0.000001 &&
    Math.abs(candidate.lng - F6_DEFAULT_CANDIDATE.lng) < 0.000001;
  const areaLabel = focusArea ?? F6_DEFAULT_CANDIDATE.place;
  const candidateLabel = candidateIsDefault
    ? `Favoured pin end · ${F6_DEFAULT_CANDIDATE.place}`
    : candidate.place
      ? `Selected place · ${candidate.place}`
      : 'Dropped pin · selected spot';
  const candidatePlace = candidateIsDefault
    ? F6_DEFAULT_CANDIDATE.place
    : candidate.place ?? `Dropped pin (${candidate.lat.toFixed(3)}, ${candidate.lng.toFixed(3)})`;
  const bottomOffset = (handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0;
  const commitHeaderTop = embedded ? Math.max(insets.top + 12, 58) : 6;
  const commitSheetBottomPadding = embedded
    ? Math.max(bottomOffset + 10, insets.bottom + 82)
    : Math.max(insets.bottom + 24, 24);
  const handleSearchSelect = useCallback((result: AtlasSearchResult) => {
    if (result.lat == null || result.lng == null) return;
    const next = { lat: result.lat, lng: result.lng, place: result.name };
    setCandidate(next);
    setSearchFocus({ lat: next.lat, lng: next.lng });
    setSearchOpen(false);
  }, []);

  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <View style={[shellStyles.commitHeaderRow, { paddingTop: commitHeaderTop }]}>
        <Text style={shellStyles.commitTitle} numberOfLines={1}>Pick a spot</Text>
        <View style={shellStyles.commitHeaderActions}>
          <Pressable
            style={shellStyles.glyphBtn}
            hitSlop={6}
            onPress={() => setSearchOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Search map"
          >
            <Ionicons name="search" size={17} color={IOS_REGISTER.accentUserAction} />
          </Pressable>
          <Pressable style={shellStyles.glyphBtn} hitSlop={6}>
            <Ionicons name="close" size={18} color={IOS_REGISTER.accentUserAction} />
          </Pressable>
        </View>
      </View>

      {/* Blue commit banner */}
      <View style={shellStyles.commitBanner}>
        <Ionicons name="location-outline" size={12} color="#FFF" />
        <Text style={shellStyles.commitBannerText} numberOfLines={2}>
          Drop a pin to anchor <Text style={{ fontWeight: '700' }}>{areaLabel}</Text> to a location.
        </Text>
      </View>

      {commonSpots.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={shellStyles.spotChipStrip}
          contentContainerStyle={shellStyles.spotChipRow}
        >
          {commonSpots.map((s) => {
            const selected =
              Math.abs(candidate.lat - (s.lat as number)) < 0.0005 &&
              Math.abs(candidate.lng - (s.lng as number)) < 0.0005;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  const next = { lat: s.lat as number, lng: s.lng as number, place: s.name };
                  setCandidate(next);
                  setSearchFocus({ lat: next.lat, lng: next.lng });
                }}
                style={[shellStyles.spotChip, selected && shellStyles.spotChipSelected]}
                accessibilityRole="button"
                accessibilityLabel={`Use ${s.name}`}
              >
                <Ionicons
                  name={s.reason === 'home_venue' ? 'home-outline' : 'location-outline'}
                  size={12}
                  color={selected ? '#FFFFFF' : IOS_REGISTER.accentUserAction}
                />
                <Text
                  style={[shellStyles.spotChipText, selected && shellStyles.spotChipTextSelected]}
                  numberOfLines={1}
                >
                  {s.name}
                  {s.useCount && s.useCount > 1 ? ` · ${s.useCount}×` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={[shellStyles.mapArea, { flex: 1 }]}>
        {handlers.useMapLibre ? (
          <AtlasMapLibreCanvas
            frame="f6"
            candidate={candidate}
            focusLocation={searchFocus}
            onMapPress={(coords) => {
              setCandidate(coords);
              setSearchFocus(coords);
            }}
          />
        ) : (
          <CommitHarbourMap />
        )}
        {/* SVG-fallback fixture only — real candidate pin sits inside
            AtlasMapLibreCanvas via the candidate prop when useMapLibre. */}
        {!handlers.useMapLibre && (
          <AtlasPin kind="candidate" leftPct={50} topPct={48} />
        )}

        <LayersFab
          onLayersPress={() => setLayersOpen(true)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      </View>

      <View style={[shellStyles.commitSheet, { paddingBottom: commitSheetBottomPadding }]}>
        <View style={shellStyles.commitSheetRow}>
          <Ionicons name="bookmark-outline" size={14} color="rgba(60, 60, 67, 0.62)" />
          <Text style={shellStyles.commitSheetEyebrow} numberOfLines={1}>{candidateLabel}</Text>
        </View>
        <Text style={shellStyles.commitSheetCoords} numberOfLines={1}>
          {candidate.lat.toFixed(3)} N · {candidate.lng.toFixed(3)} E · within {areaLabel} area
        </Text>
        <View style={shellStyles.btnRow}>
          <Pressable
            onPress={() =>
              handlers.onPrimaryAction?.({
                lat: candidate.lat,
                lng: candidate.lng,
                place: candidatePlace,
              })
            }
            style={[shellStyles.btn, shellStyles.btnPrimary]}
          >
            <Ionicons name="checkmark" size={14} color="#FFF" />
            <Text style={shellStyles.btnPrimaryText}>Use this location</Text>
          </Pressable>
          <Pressable
            onPress={() => setSearchFocus({ lat: candidate.lat, lng: candidate.lng })}
            style={[shellStyles.btn, shellStyles.btnSecondary]}
          >
            <Ionicons name="locate-outline" size={14} color={IOS_REGISTER.label} />
            <Text style={shellStyles.btnSecondaryText}>Recenter</Text>
          </Pressable>
        </View>
      </View>

      {layersOpen && (
        <LayersSheet
          frame="f6"
          onClose={() => setLayersOpen(false)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}
      <AtlasSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
        countryCode="HK"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// F7 — Lakshmi · rural entrepreneur near Ranchi
// ---------------------------------------------------------------------------
const WEEKDAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function formatInrMinor(minor: number): string {
  const major = Math.round(minor / 100);
  return `₹${major.toLocaleString('en-IN')}`;
}

function nextHaatFromCalendar(haats: HaatCalendar[]): HaatCalendar | null {
  if (haats.length === 0) return null;
  const today = new Date().getDay();
  return [...haats].sort((a, b) => {
    const da = (a.dayOfWeek - today + 7) % 7;
    const db = (b.dayOfWeek - today + 7) % 7;
    return da - db;
  })[0] ?? null;
}

function haatWhenLabel(haat: HaatCalendar | null): string | undefined {
  if (!haat) return undefined;
  const day = WEEKDAY_SHORT[haat.dayOfWeek]?.toUpperCase() ?? 'HAAT';
  const time = haat.startsAtLocal ? haat.startsAtLocal.slice(0, 5) : null;
  return [day, time].filter(Boolean).join(' ');
}

function makeHaatPrepMetadata(haat: HaatCalendar | null): Record<string, unknown> {
  return {
    livelihood: {
      haat_calendar_id: haat?.id ?? null,
      evidence_source: 'atlas_haat_cockpit',
    },
    plan: {
      what_will_you_do: haat
        ? `${haat.name} के लिए अचार और पापड़ तैयार करें`
        : 'अगले हाट के लिए सामान तैयार करें',
      how_sub_steps: [
        { id: 'stock', text: '30 जार अचार + 10 पैकेट पापड़ गिनें', sort_order: 0, completed: false },
        { id: 'price', text: '₹50 दाम रखें और पिछली कीमत लिखें', sort_order: 1, completed: false },
        { id: 'saving', text: 'कमाई से बचत बैंक मित्र में जमा करें', sort_order: 2, completed: false },
      ],
      target_event_kind: 'market_day',
      target_event_id: haat?.id ?? null,
    },
  };
}

// First-run frame for the entrepreneur vertical. Ranchi/Jharkhand camera,
// offline-aware chip row, voice-memo CTA prominent. Bilingual labels live
// on the event tables (label_local + locale_local) so the picker reads
// "Khunti haat · खुनी हाट" natively without F7 owning the rendering.
function FrameF7({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logHaatId, setLogHaatId] = useState<string | null>(null);
  const [demoLanguage, setDemoLanguage] = useState<DemoLanguage>('hi');
  const { currentInterest, allInterests, userInterests } = useInterest();
  const livelihood = useLivelihoodAtlas();
  const livelihoodInterest = useMemo(
    () =>
      userInterests.find((interest) => interest.slug === 'lac-craft-business') ??
      allInterests.find((interest) => interest.slug === 'lac-craft-business') ??
      currentInterest,
    [allInterests, currentInterest, userInterests],
  );
  const logLedger = useLogLivelihoodLedgerEntry(livelihoodInterest?.id ?? null);
  const primaryHaat = useMemo(
    () => nextHaatFromCalendar(livelihood.data?.haats ?? []),
    [livelihood.data?.haats],
  );
  // Entrepreneur POIs — supplier villages (white squares), haat markets
  // (green diamonds with day-of-week badges), Lakshmi's home anchor,
  // and any active mentees.
  const { pins: rawPins, pickerSteps, archiveSteps } = useAtlasFramePins({
    lat: 23.27,
    lng: 85.45,
    interestSlug: 'lac-craft-business',
    radiusKm: 35,
  });
  // Next event — tomorrow's Khunti haat. Fixture for the demo until a
  // real market-day resolver returns the next haat the user plans to
  // visit. The amber NEXT pill makes the bottom-sheet headline legible
  // on the map: "WED · KHUNTI HAAT" at Khunti's coords.
  const nextHaat = useMemo<AtlasNextEvent>(() => {
    const haatFromData = primaryHaat
      ? {
          label: primaryHaat.name,
          when: haatWhenLabel(primaryHaat),
          where: [primaryHaat.name, primaryHaat.localName].filter(Boolean).join(' · '),
          conditions: [
            primaryHaat.distanceKm != null ? `${primaryHaat.distanceKm} km` : null,
            primaryHaat.startsAtLocal ? `start ${primaryHaat.startsAtLocal.slice(0, 5)}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          lat: primaryHaat.lat ?? undefined,
          lng: primaryHaat.lng ?? undefined,
        }
      : null;
    const base: AtlasNextEvent =
      haatFromData?.lat && haatFromData?.lng
        ? haatFromData
        : handlers.nextEvent?.lat && handlers.nextEvent?.lng
        ? handlers.nextEvent
        : {
            label: 'Khunti haat',
            when: 'Wed 6am',
            where: 'Khunti haat · खुनी हाट',
            conditions: '~11 km · leave by 5:30',
            lat: 23.075,
            lng: 85.2792,
          };
    // Phase A.2b — if the viewer already has a planned step within ~500m
    // of the NEXT haat, set has_user_step so the sheet flips its primary
    // CTA from "Voice memo" to "Open Wednesday step".
    const hasUserStep =
      base.lat != null &&
      base.lng != null &&
      rawPins.some(
        (p) =>
          p.kind === 'my-step-planned' &&
          Math.abs(p.lat - (base.lat ?? 0)) < 0.005 &&
          Math.abs(p.lng - (base.lng ?? 0)) < 0.005,
      );
    const sourceLabel =
      base.source_label ??
      (hasUserStep ? 'From: your timeline' : 'From: weekly market schedule (curated)');
    return {
      ...base,
      eyebrow: base.eyebrow ?? 'NEXT MARKET',
      has_user_step: hasUserStep,
      source_label: sourceLabel,
    };
  }, [handlers.nextEvent, primaryHaat, rawPins]);
  // Pin tap state — supplier/haat/home/mentee/next-event all route
  // through here. Mirror of FrameF4's pattern. Opening any sheet
  // auto-closes the Layers panel + clears the other surfaces.
  const [selectedPin, setSelectedPin] = useState<AtlasPinSpec | null>(null);
  const [nextHaatSheetOpen, setNextHaatSheetOpen] = useState(false);
  const [openStepPickerVisible, setOpenStepPickerVisible] = useState(false);
  const [f7FocusLocation, setF7FocusLocation] = useState<{ lat: number; lng: number } | null>(null);
  const handleF7PinPress = useCallback((pin: AtlasPinSpec) => {
    setLayersOpen(false);
    setNextHaatSheetOpen(false);
    setOpenStepPickerVisible(false);
    setSelectedPin(pin);
  }, []);
  const clearF7SelectedPin = useCallback(() => setSelectedPin(null), []);
  const handleF7NextTap = useCallback(() => {
    setLayersOpen(false);
    setSelectedPin(null);
    setNextHaatSheetOpen(true);
  }, []);
  const closeF7NextSheet = useCallback(() => setNextHaatSheetOpen(false), []);
  const selectedPickerStepId =
    selectedPin && isUserStepPin(selectedPin) ? selectedPin.stepId ?? null : null;
  const formatF7StepSwitcherLabel = useCallback(
    (stepId: string | null | undefined) => {
      if (!stepId) return lx(demoLanguage, 'स्टेप चुनें', 'Pick step');
      const index = pickerSteps.findIndex((step) => step.step_id === stepId);
      if (index < 0) return lx(demoLanguage, 'स्टेप चुनें', 'Pick step');
      const step = pickerSteps[index];
      const ordinal = `${index + 1}/${pickerSteps.length}`;
      const title = step?.title?.trim();
      return title ? `${title} · ${ordinal}` : lx(demoLanguage, `स्टेप ${ordinal}`, `Step ${ordinal}`);
    },
    [demoLanguage, pickerSteps],
  );
  const f7TopStepPickerStepId = useMemo(() => {
    if (selectedPickerStepId) return selectedPickerStepId;
    return (
      pickerSteps.find((step) => step.status === 'planned-next')?.step_id ??
      pickerSteps.find((step) => step.has_place)?.step_id ??
      pickerSteps[0]?.step_id ??
      null
    );
  }, [pickerSteps, selectedPickerStepId]);
  const f7TopStepActionLabel = useMemo(
    () => formatF7StepSwitcherLabel(f7TopStepPickerStepId),
    [f7TopStepPickerStepId, formatF7StepSwitcherLabel],
  );
  const handlePickF7StepFromPicker = useCallback(
    (step: PickerStep) => {
      setOpenStepPickerVisible(false);
      setLayersOpen(false);
      setNextHaatSheetOpen(false);
      setLogOpen(false);
      setHealthOpen(false);
      const pin = rawPins.find((candidate) => candidate.stepId === step.step_id);
      if (pin) {
        setF7FocusLocation({ lat: pin.lat, lng: pin.lng });
        setSelectedPin(pin);
        return;
      }
      if (step.has_place && step.lat != null && step.lng != null) {
        setF7FocusLocation({ lat: step.lat, lng: step.lng });
        setSelectedPin({
          id: `step-picker:${step.step_id}`,
          kind: 'my-step-planned',
          stepId: step.step_id,
          label: step.title,
          subtitle: step.location_name ?? undefined,
          lat: step.lat,
          lng: step.lng,
        });
      }
    },
    [rawPins],
  );
  const openLogSheet = useCallback((haatId?: string | null) => {
    setLayersOpen(false);
    setSelectedPin(null);
    setNextHaatSheetOpen(false);
    setOpenStepPickerVisible(false);
    setHealthOpen(false);
    setLogHaatId(haatId ?? primaryHaat?.id ?? null);
    setLogOpen(true);
  }, [primaryHaat?.id]);
  const haatIdForPin = useCallback(
    (pin: AtlasPinSpec) => {
      const poiId = pin.id.startsWith('poi:') ? pin.id.slice(4) : null;
      if (poiId) {
        const byPoi = livelihood.data?.haats.find((haat) => haat.atlasPoiId === poiId);
        if (byPoi) return byPoi.id;
      }
      const byLocation = livelihood.data?.haats.find(
        (haat) =>
          haat.lat != null &&
          haat.lng != null &&
          Math.abs(haat.lat - pin.lat) < 0.002 &&
          Math.abs(haat.lng - pin.lng) < 0.002,
      );
      return byLocation?.id ?? primaryHaat?.id ?? null;
    },
    [livelihood.data?.haats, primaryHaat?.id],
  );
  const openHealthSheet = useCallback(() => {
    setLayersOpen(false);
    setSelectedPin(null);
    setNextHaatSheetOpen(false);
    setLogOpen(false);
    setHealthOpen(true);
  }, []);
  const closeHealthSheet = useCallback(() => setHealthOpen(false), []);
  const closeLogSheet = useCallback(() => setLogOpen(false), []);
  const submitLedger = useCallback(
    async (input: LogLivelihoodEntryInput) => {
      await logLedger.mutateAsync({
        ...input,
        haatCalendarId: input.haatCalendarId ?? logHaatId ?? primaryHaat?.id ?? null,
        orgUnitId: input.orgUnitId ?? livelihood.data?.profile?.shgUnitId ?? null,
      });
      setLogOpen(false);
      setHealthOpen(true);
    },
    [livelihood.data?.profile?.shgUnitId, logHaatId, logLedger, primaryHaat?.id],
  );
  const planHaatPrep = useCallback(() => {
    if (nextHaat.lat == null || nextHaat.lng == null) return;
    handlers.onPrimaryAction?.({
      lat: nextHaat.lat,
      lng: nextHaat.lng,
      place: nextHaat.where,
      suggestedTitle: `${nextHaat.label} की तैयारी`,
      suggestedCategory: 'market-day',
      metadata: makeHaatPrepMetadata(primaryHaat),
    });
  }, [handlers, nextHaat.label, nextHaat.lat, nextHaat.lng, nextHaat.where, primaryHaat]);
  // Chip filter state — pin kinds visible. Defaults: everything on so
  // the user sees the network on first load. Cohort/heatmap chips don't
  // exist on F7 (those are F4 nursing); F7 has Network/Haat/Suppliers/
  // Mentees plus the implicit "All" anchor.
  const [showHaats, setShowHaats] = useState(true);
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [showMentees, setShowMentees] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const handleF7ChipsChange = useCallback((activeIds: string[]) => {
    const all = activeIds.includes('all');
    setShowHaats(all || activeIds.includes('haat'));
    setShowSuppliers(all || activeIds.includes('suppliers'));
    setShowMentees(all || activeIds.includes('mentees'));
    setShowNetwork(all || activeIds.includes('network'));
  }, []);
  // Open the device's Maps app with directions from current location
  // to the destination. Uses universal Google Maps web URL — iOS opens
  // it in Apple Maps, Android opens Google Maps. Avoids the iOS-only
  // maps:// scheme so the same code works on both platforms.
  const openRouteTo = useCallback((lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch((err) => {
      console.warn('[atlas] Failed to open route', err);
    });
  }, []);
  // Apply chip filters to the raw pin list. Home anchor is always
  // visible (it's the user's base, not a filter target).
  const pins = useMemo(
    () =>
      rawPins.filter((p) => {
        if (p.kind === 'poi-haat') return showHaats;
        if (p.kind === 'poi-supplier') return showSuppliers;
        if (p.kind === 'poi-mentee') return showMentees;
        if (p.kind === 'following' || p.kind === 'crew') return showNetwork;
        return true;
      }),
    [rawPins, showHaats, showSuppliers, showMentees, showNetwork],
  );
  // Step↔site cross-link — a YOUR STEP callout offers "View <village/haat>"
  // and a supplier/haat/home callout lists "N of your steps here". Drawn from
  // the unfiltered rawPins + full located set so chip visibility and arc scope
  // don't hide the bridge. Frame-agnostic; mirrors F1/F4.
  const crossLinkSteps = useMemo(
    () => [...pickerSteps, ...archiveSteps],
    [pickerSteps, archiveSteps],
  );
  const { openStepById, siteForSelectedStep, myStepsAtSelectedPoi } = useFrameStepSiteLinks({
    framePins: rawPins,
    steps: crossLinkSteps,
    selectedPin,
    setSelectedPin,
    onFocusLocation: setF7FocusLocation,
    onStepPress: handlers.onStepPress,
  });
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <View style={shellStyles.mapArea}>
        {handlers.useMapLibre ? (
          <AtlasMapLibreCanvas
            frame="f7"
            pins={pins}
            nextEvent={
              nextHaat.lat != null && nextHaat.lng != null
                ? { ...nextHaat, lat: nextHaat.lat, lng: nextHaat.lng }
                : null
            }
            onPinPress={handleF7PinPress}
            onNextEventPress={handleF7NextTap}
            focusLocation={f7FocusLocation}
            focusZoomLevel={12.5}
          />
        ) : (
          <WorldDragonMap />
        )}
        {/* Floating glass chrome — title + chips. Same pattern as F1/F4.
            F7 adds the search glyph back (search-by-village is core to
            the entrepreneur workflow). */}
        <View style={shellStyles.floatingChrome}>
          <TopChrome
            title="Atlas"
            subtitle={
              handlers.subtitleOverride ??
              lx(demoLanguage, 'घर का धंधा · खूंटी · झारखंड', 'Home craft · Khunti · Jharkhand')
            }
            interestOverride={{
              name: lx(demoLanguage, 'घर का धंधा', 'Home business'),
              accentColor: '#C2410C',
            }}
            stepSwitcher={
              pickerSteps.length > 0
                ? {
                    label: f7TopStepActionLabel,
                    onPress: () => setOpenStepPickerVisible(true),
                  }
                : null
            }
            avatarInitial={handlers.avatarInitial ?? 'L'}
            onSearchPress={() => {
              /* search modal lands in a follow-up; glyph present per design. */
            }}
          />
          <FilterChipsRow
            chips={[
              { id: 'all', label: 'All' },
              { id: 'network', label: 'Network', tone: 'fleet' },
              { id: 'haat', label: 'Haat · हाट', icon: 'storefront-outline', active: true },
              { id: 'suppliers', label: 'Suppliers', icon: 'leaf-outline', active: true },
              { id: 'mentees', label: 'Mentees', tone: 'crew' },
            ]}
            onActiveIdsChange={handleF7ChipsChange}
          />
        </View>

        {/* Standalone offline pill — dark, anchored top-left under the
            chrome. Replaces a chip slot per design ("Offline pill
            replaces a chip in the top-left."). */}
        <View style={shellStyles.offlinePill}>
          <Ionicons name="cloud-offline-outline" size={11} color="#FFFFFF" />
          <Text style={shellStyles.offlinePillText}>
            {lx(demoLanguage, 'ऑफलाइन · 4h पहले sync', 'OFFLINE · synced 4h ago')}
          </Text>
        </View>

        {/* Route hint — anchored top-right under the chrome, tells the user
            the village-to-market route geometry appears after zooming in. */}
        <View style={shellStyles.routeHintChip}>
          <Ionicons name="git-branch-outline" size={11} color="rgba(60, 60, 67, 0.75)" />
          <Text style={shellStyles.routeHintText}>{lx(demoLanguage, 'Zoom करें: रास्ता', 'Zoom for route')}</Text>
        </View>
        <DemoLanguageToggle language={demoLanguage} onChange={setDemoLanguage} />
        <LayersFab
          onLayersPress={() => setLayersOpen(true)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      </View>

      {layersOpen ? null : logOpen ? (
        <LivelihoodLogSheet
          haats={livelihood.data?.haats ?? []}
          selectedHaatId={logHaatId}
          onSelectedHaatChange={setLogHaatId}
          onSubmit={submitLedger}
          onClose={closeLogSheet}
          language={demoLanguage}
          isSaving={logLedger.isPending}
          error={logLedger.error?.message ?? null}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      ) : healthOpen ? (
        <LivelihoodHealthSheet
          health={livelihood.health}
          lastEntry={livelihood.data?.ledger?.[0] ?? null}
          onLogPress={() => openLogSheet(primaryHaat?.id ?? null)}
          onClose={closeHealthSheet}
          language={demoLanguage}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      ) : nextHaatSheetOpen ? (
        <BottomSheet
          eyebrow={`TOMORROW · ${nextHaat.label.toUpperCase()}${nextHaat.when ? ` · ${nextHaat.when.toUpperCase()}` : ''}`}
          title={nextHaat.where ?? 'Your next market'}
          source={nextHaat.source_label}
          onSourcePress={() =>
            comingSoonAlert(
              'Open source',
              "Tapping the source line will open whatever surfaced this NEXT haat — your own pin, an NGO blueprint (e.g. SEWA Bharat weekly markets), or a government scheme. Provenance routing ships with Phase 8.",
            )
          }
          body={[
            nextHaat.conditions,
            '5 suppliers report fresh stock. 1 mentee posted nearby this morning.',
            nextHaat.has_user_step
              ? 'You have a step planned for this market — open it to add notes or capture a voice memo.'
              : 'Bring: 20 lac bangles · ask Asha about beadwork pricing.',
          ]
            .filter(Boolean)
            .join('\n')}
          primary={
            nextHaat.has_user_step
              ? {
                  label: `Open ${nextHaat.when?.split(' ')[0] ?? 'market'} step`,
                  icon: 'open-outline',
                  onPress: () => {
                    closeF7NextSheet();
                    comingSoonAlert(
                      `Open ${nextHaat.when?.split(' ')[0] ?? 'market'} step`,
                      'This will open the existing market step so you can add notes, capture a voice memo, or update what you plan to sell. Step-from-atlas navigation ships in Phase A.3.',
                    );
                  },
                }
              : {
                  label: 'Prepare for haat',
                  icon: 'checkmark',
                  onPress: () => {
                    closeF7NextSheet();
                    planHaatPrep();
                  },
                }
          }
          secondary={{
            label: 'Log last haat',
            icon: 'create-outline',
            onPress: () => {
              closeF7NextSheet();
              openLogSheet(primaryHaat?.id ?? null);
            },
          }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="expanded"
        />
      ) : selectedPin ? (
        isUserStepPin(selectedPin) ? (
          // Viewer's own step pin — open the step, don't offer "Anchor a step
          // here" (that silently duplicates the step). The secondary slot jumps
          // to the village/haat this step sits at; the header X already closes.
          <BottomSheet
            key="user-step"
            eyebrow={lx(demoLanguage, 'आपका स्टेप', 'YOUR STEP')}
            title={titleForUserStepPin(selectedPin)}
            body={detailBodyForPin(selectedPin)}
            primary={{
              label: lx(demoLanguage, 'स्टेप खोलें', 'Open step'),
              icon: 'open-outline',
              onPress: () => {
                if (selectedPin.stepId) {
                  handlers.onStepPress?.(selectedPin.stepId);
                  clearF7SelectedPin();
                }
              },
            }}
            secondary={
              siteForSelectedStep
                ? {
                    label: lx(
                      demoLanguage,
                      `${(siteForSelectedStep.label ?? 'जगह').split('|')[0]} देखें`,
                      `View ${(siteForSelectedStep.label ?? 'site').split('|')[0]}`,
                    ),
                    icon: 'business-outline',
                    onPress: () => {
                      setF7FocusLocation({
                        lat: siteForSelectedStep.lat,
                        lng: siteForSelectedStep.lng,
                      });
                      setSelectedPin(siteForSelectedStep);
                    },
                  }
                : { label: lx(demoLanguage, 'बंद करें', 'Close'), onPress: clearF7SelectedPin }
            }
            showSecondaryInMid={siteForSelectedStep != null}
            onClose={clearF7SelectedPin}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="mid"
          />
        ) : (
        <BottomSheet
          eyebrow={eyebrowForPin(selectedPin)}
          title={(selectedPin.label ?? 'Pin').split('|')[0]}
          body={detailBodyForPin(selectedPin, [atlasPinContextNote(selectedPin)])}
          expandedContent={(() => {
            const poiId = knowledgePoiIdForPin(selectedPin);
            // Cross-link back to the viewer's own steps at this village/haat —
            // turns the location callout from a dead end into "here's what
            // you've done here." Sits above the shared place-knowledge feed.
            const stepsHere =
              myStepsAtSelectedPoi.length > 0 ? (
                <View style={shellStyles.stepsHereWrap}>
                  <Text style={shellStyles.stepsHereLabel}>
                    {lx(
                      demoLanguage,
                      `यहाँ आपके ${myStepsAtSelectedPoi.length} स्टेप`,
                      `${myStepsAtSelectedPoi.length} of your step${
                        myStepsAtSelectedPoi.length === 1 ? '' : 's'
                      } here`,
                    )}
                  </Text>
                  <StackedStepList steps={myStepsAtSelectedPoi} onOpenStep={openStepById} />
                </View>
              ) : null;
            if (!poiId) return stepsHere ?? undefined;
            return (
              <>
                {stepsHere}
                <PlaceKnowledgeSection
                  anchor={{ poiId }}
                  conditions={null}
                  interestSlug="lac-craft-business"
                  onAddKnowledge={() => {
                    const label = selectedPin.label;
                    clearF7SelectedPin();
                    router.push({
                      pathname: '/venue/post/create',
                      params: { poiId, interestSlug: 'lac-craft-business', ...(label ? { poiName: label.split('|')[0] } : {}) },
                    } as never);
                  }}
                />
              </>
            );
          })()}
          primary={
            selectedPin.kind === 'poi-supplier'
              ? {
                  label: 'Plan a sourcing run',
                  icon: 'add',
                  onPress: () => {
                    handlers.onPrimaryAction?.({ lat: selectedPin.lat, lng: selectedPin.lng });
                    clearF7SelectedPin();
                  },
                }
              : selectedPin.kind === 'poi-haat'
                ? {
                    label: 'Log haat result',
                    icon: 'create-outline',
                    onPress: () => {
                      openLogSheet(haatIdForPin(selectedPin));
                      clearF7SelectedPin();
                    },
                  }
                : selectedPin.kind === 'poi-home-anchor'
                  ? {
                      label: 'Log a work session',
                      icon: 'add',
                      onPress: () => {
                        handlers.onPrimaryAction?.({
                          lat: selectedPin.lat,
                          lng: selectedPin.lng,
                          place: selectedPin.label ?? selectedPin.subtitle ?? undefined,
                        });
                        clearF7SelectedPin();
                      },
                    }
                  : selectedPin.kind === 'poi-mentee'
                    ? {
                        label: 'Open profile',
                        icon: 'person-circle-outline',
                        onPress: () => {
                          clearF7SelectedPin();
                          comingSoonAlert(
                            'Open profile',
                            "Mentee profiles (their craft, recent posts, contact via WhatsApp) ship in Phase F. For now, you can use the Route button to drop in on them in person.",
                          );
                        },
                      }
                    : {
                        label: 'Anchor a step here',
                        icon: 'add',
                        onPress: () => {
                          handlers.onPrimaryAction?.({
                            lat: selectedPin.lat,
                            lng: selectedPin.lng,
                            place: selectedPin.label ?? selectedPin.subtitle ?? undefined,
                          });
                          clearF7SelectedPin();
                        },
                      }
          }
          secondary={
            selectedPin.kind === 'poi-mentee' ||
            selectedPin.kind === 'poi-supplier' ||
            selectedPin.kind === 'poi-haat'
              ? {
                  label: 'Route',
                  icon: 'navigate-outline',
                  onPress: () => {
                    openRouteTo(selectedPin.lat, selectedPin.lng);
                    clearF7SelectedPin();
                  },
                }
              : { label: 'Close', onPress: clearF7SelectedPin }
          }
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="expanded"
        />
        )
      ) : (
        <BottomSheet
          eyebrow={[
            nextHaat.when?.toUpperCase() ?? null,
            nextHaat.label.toUpperCase(),
          ]
            .filter(Boolean)
            .join(' · ')}
          title={lx(demoLanguage, 'हाट की तैयारी, बिक्री, फिर हिसाब दर्ज करें.', 'Plan, sell, then log the haat result.')}
          body={[
            nextHaat.conditions,
            livelihood.data?.ledger?.[0]
              ? lx(
                  demoLanguage,
                  `पिछला हाट: ${formatInrMinor(livelihood.data.ledger[0].revenueMinor)} बिक्री · ${formatInrMinor(livelihood.data.ledger[0].savingsMinor)} बचत.`,
                  `Last haat: ${formatInrMinor(livelihood.data.ledger[0].revenueMinor)} sales · ${formatInrMinor(livelihood.data.ledger[0].savingsMinor)} saved.`,
                )
              : lx(
                  demoLanguage,
                  'अभी कोई हाट हिसाब नहीं है. पहली एंट्री लखपति प्रगति को चलाएगी.',
                  'No haat result logged yet. The first ledger entry will feed Lakhpati progress.',
                ),
            lx(
              demoLanguage,
              'इसे market cockpit की तरह इस्तेमाल करें: माल तैयार करें, बेचें, फिर बिक्री और बचत दर्ज करें.',
              'Use this like a market cockpit: prep stock, sell at the market, then log sales and savings.',
            ),
          ]
            .filter(Boolean)
            .join('\n')}
          primary={{ label: lx(demoLanguage, 'पिछला हाट दर्ज करें', 'Log last haat'), icon: 'create-outline', onPress: () => openLogSheet(primaryHaat?.id ?? null) }}
          secondary={{ label: lx(demoLanguage, 'धंधे की सेहत', 'Business health'), icon: 'analytics-outline', onPress: openHealthSheet }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="handle"
        />
      )}

      {layersOpen && (
        <LayersSheet
          frame="f7"
          onClose={() => setLayersOpen(false)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}

      <OpenStepPicker
        visible={openStepPickerVisible}
        steps={pickerSteps}
        selectedStepId={f7TopStepPickerStepId}
        onDismiss={() => setOpenStepPickerVisible(false)}
        onPickStep={handlePickF7StepFromPicker}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// F7 custom sheets — haat ledger + business health
// ---------------------------------------------------------------------------
function parseRupeesToMinor(value: string): number {
  const n = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function parseWhole(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function LivelihoodLogSheet({
  haats,
  selectedHaatId,
  onSelectedHaatChange,
  onSubmit,
  onClose,
  language,
  isSaving,
  error,
  bottomOffset = 0,
}: {
  haats: HaatCalendar[];
  selectedHaatId: string | null;
  onSelectedHaatChange: (id: string | null) => void;
  onSubmit: (input: LogLivelihoodEntryInput) => Promise<void>;
  onClose: () => void;
  language: DemoLanguage;
  isSaving: boolean;
  error: string | null;
  bottomOffset?: number;
}) {
  const [spokenEntry, setSpokenEntry] = useState('18 जार अचार, ₹50 UPI');
  const [product, setProduct] = useState('अचार');
  const [units, setUnits] = useState('18');
  const [unitPrice, setUnitPrice] = useState('50');
  const [payment, setPayment] = useState<'cash' | 'upi'>('upi');
  const [expenses, setExpenses] = useState('150');
  const [savings, setSavings] = useState('300');
  const [loanRepayment, setLoanRepayment] = useState('1000');
  const [customers, setCustomers] = useState('4');
  const [note, setNote] = useState('बेरो हाट में अचार बिका, रेखा साथ गई');
  const [tags, setTags] = useState<string[]>(['selling', 'money', 'digital']);
  const selected = haats.find((haat) => haat.id === selectedHaatId) ?? haats[0] ?? null;
  const unitCount = parseWhole(units);
  const unitPriceMinor = parseRupeesToMinor(unitPrice);
  const revenueMinor = unitCount * unitPriceMinor;
  const expenseMinor = parseRupeesToMinor(expenses);
  const profitMinor = Math.max(0, revenueMinor - expenseMinor);

  const toggleTag = (tag: string) => {
    setTags((prior) => (prior.includes(tag) ? prior.filter((t) => t !== tag) : [...prior, tag]));
  };
  const applyParsedSpeech = () => {
    const parsed = parseLivelihoodSaleText(spokenEntry);
    if (parsed.productName) setProduct(parsed.productName);
    if (parsed.quantity > 0) setUnits(String(parsed.quantity));
    if (parsed.unitPriceMinor > 0) setUnitPrice(String(Math.round(parsed.unitPriceMinor / 100)));
    if (parsed.paymentChannel === 'cash' || parsed.paymentChannel === 'upi') setPayment(parsed.paymentChannel);
  };

  return (
    <View style={[shellStyles.livelihoodSheet, { bottom: bottomOffset + 12 }]}>
      <View style={shellStyles.sheetHandle} />
      <View style={shellStyles.livelihoodHead}>
        <View>
          <Text style={shellStyles.livelihoodEyebrow}>{lx(language, 'बिक्री दर्ज करें · बोलकर', 'LOG A SALE · VOICE FIRST')}</Text>
          <Text style={shellStyles.livelihoodTitle}>{lx(language, 'आज की कमाई दर्ज करें', 'Enter today’s money')}</Text>
        </View>
        <Pressable style={shellStyles.roundClose} onPress={onClose} accessibilityRole="button">
          <Ionicons name="close" size={18} color={IOS_COLORS.secondaryLabel} />
        </Pressable>
      </View>

      <ScrollView style={shellStyles.livelihoodScroll} contentContainerStyle={shellStyles.livelihoodScrollContent}>
        {haats.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={shellStyles.haatPicker}>
            {haats.map((haat) => {
              const active = (selected?.id ?? selectedHaatId) === haat.id;
              return (
                <Pressable
                  key={haat.id}
                  style={[shellStyles.haatChoice, active && shellStyles.haatChoiceActive]}
                  onPress={() => onSelectedHaatChange(haat.id)}
                >
                  <Text style={[shellStyles.haatChoiceText, active && shellStyles.haatChoiceTextActive]}>
                    {haat.name}
                  </Text>
                  <Text style={shellStyles.haatChoiceSub}>{haatWhenLabel(haat) ?? 'weekly'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={shellStyles.livelihoodMuted}>No haat calendar rows yet. This result will still save to your ledger.</Text>
        )}

        <View style={shellStyles.voiceCaptureCard}>
          <View style={shellStyles.voiceMic}>
            <Ionicons name="mic" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={shellStyles.voiceTitle}>{lx(language, 'बोलकर बताएं', 'Say it in one line')}</Text>
            <TextInput
              value={spokenEntry}
              onChangeText={setSpokenEntry}
              style={shellStyles.voiceInput}
              placeholder={lx(language, '18 जार अचार, ₹50 UPI', '18 jars pickle, ₹50 UPI')}
              placeholderTextColor="rgba(120, 105, 80, 0.58)"
            />
          </View>
          <Pressable style={shellStyles.voiceApply} onPress={applyParsedSpeech} accessibilityRole="button">
            <Ionicons name="checkmark" size={14} color="#157F3B" />
          </Pressable>
        </View>

        <View style={shellStyles.productChipRow}>
          {[
            ['अचार', lx(language, 'अचार', 'Pickle')],
            ['पापड़', lx(language, 'पापड़', 'Papad')],
            ['कटहल', lx(language, 'कटहल', 'Jackfruit')],
            ['लाह शिल्प', lx(language, 'लाह शिल्प', 'Lac craft')],
          ].map(([id, label]) => {
            const active = product === id;
            return (
              <Pressable
                key={id}
                style={[shellStyles.productChip, active && shellStyles.productChipActive]}
                onPress={() => setProduct(id)}
                accessibilityRole="button"
              >
                <Text style={[shellStyles.productChipText, active && shellStyles.productChipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={shellStyles.livelihoodGrid}>
          <LedgerField label={lx(language, 'बिका', 'Sold')} value={units} onChange={setUnits} suffix={lx(language, 'जार', 'jars')} />
          <LedgerField label={lx(language, 'दाम', 'Price')} value={unitPrice} onChange={setUnitPrice} prefix="₹" suffix={lx(language, '/जार', '/jar')} />
          <LedgerField label={lx(language, 'खर्च', 'Costs')} value={expenses} onChange={setExpenses} prefix="₹" />
          <LedgerField label={lx(language, 'ग्राहक', 'Customers')} value={customers} onChange={setCustomers} />
        </View>

        <View style={shellStyles.paymentRow}>
          {[
            ['cash', lx(language, 'नकद', 'Cash')],
            ['upi', 'UPI'],
          ].map(([id, label]) => {
            const active = payment === id;
            return (
              <Pressable
                key={id}
                style={[shellStyles.paymentToggle, active && shellStyles.paymentToggleActive]}
                onPress={() => setPayment(id as 'cash' | 'upi')}
                accessibilityRole="button"
              >
                <Ionicons name={id === 'upi' ? 'phone-portrait-outline' : 'cash-outline'} size={13} color={active ? '#157F3B' : IOS_REGISTER.labelSecondary} />
                <Text style={[shellStyles.paymentToggleText, active && shellStyles.paymentToggleTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
          <View style={shellStyles.totalPill}>
            <Text style={shellStyles.totalPillLabel}>{lx(language, 'कुल', 'Total')}</Text>
            <Text style={shellStyles.totalPillValue}>{formatInrMinor(revenueMinor)}</Text>
          </View>
        </View>

        <View style={shellStyles.closeoutStrip}>
          <View>
            <Text style={shellStyles.closeoutLabel}>{lx(language, 'मुनाफ़ा', 'Profit')}</Text>
            <Text style={shellStyles.closeoutValue}>{formatInrMinor(profitMinor)}</Text>
          </View>
          <LedgerField label={lx(language, 'SHG बचत', 'SHG savings')} value={savings} onChange={setSavings} prefix="₹" compact />
          <LedgerField label="Mudra" value={loanRepayment} onChange={setLoanRepayment} prefix="₹" compact />
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          style={shellStyles.noteInput}
          placeholder={lx(language, 'बोले हुए नोट का सार', 'Voice note summary')}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          multiline
        />

        <View style={shellStyles.capabilityChips}>
          {[
            ['selling', lx(language, 'बिक्री', 'Selling')],
            ['money', lx(language, 'बचत', 'Savings')],
            ['quality', lx(language, 'क्वालिटी', 'Quality')],
            ['digital', 'UPI'],
          ].map(([id, label]) => {
            const active = tags.includes(id);
            return (
              <Pressable
                key={id}
                style={[shellStyles.capabilityChip, active && shellStyles.capabilityChipActive]}
                onPress={() => toggleTag(id)}
              >
                <Text style={[shellStyles.capabilityChipText, active && shellStyles.capabilityChipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={shellStyles.livelihoodError}>{error}</Text> : null}
      </ScrollView>

      <Pressable
        style={[shellStyles.livelihoodPrimary, isSaving && { opacity: 0.7 }]}
        onPress={() =>
          onSubmit({
            haatCalendarId: selected?.id ?? selectedHaatId,
            productName: product,
            unitLabel: 'जार',
            unitPriceMinor,
            paymentChannel: payment,
            sourceText: spokenEntry.trim() || null,
            isVoiceParsed: true,
            unitsSold: unitCount,
            revenueMinor,
            savingsMinor: parseRupeesToMinor(savings),
            expensesMinor: expenseMinor,
            loanRepaymentMinor: parseRupeesToMinor(loanRepayment),
            customerCount: parseWhole(customers),
            repeatCount: 0,
            capabilityTags: tags,
            evidenceNote: note.trim() || null,
          })
        }
        disabled={isSaving}
        accessibilityRole="button"
      >
        {isSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={shellStyles.livelihoodPrimaryText}>{lx(language, '₹ एंट्री सेव करें', 'Save money entry')}</Text>}
      </Pressable>
    </View>
  );
}

function LedgerField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  compact,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <View style={[shellStyles.ledgerField, compact && shellStyles.ledgerFieldCompact]}>
      <Text style={shellStyles.ledgerFieldLabel}>{label}</Text>
      <View style={shellStyles.ledgerInputRow}>
        {prefix ? <Text style={shellStyles.ledgerPrefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          style={shellStyles.ledgerInput}
        />
        {suffix ? <Text style={shellStyles.ledgerSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function LivelihoodHealthSheet({
  health,
  lastEntry,
  onLogPress,
  onClose,
  language = 'hi',
  bottomOffset = 0,
}: {
  health: LivelihoodHealth;
  lastEntry: LivelihoodLedgerEntry | null;
  onLogPress: () => void;
  onClose: () => void;
  language?: DemoLanguage;
  bottomOffset?: number;
}) {
  const capRows = [
    ['sourcing', lx(language, 'कच्चा माल जुटाना', 'Sourcing raw material'), lx(language, 'मंडी · supplier stock', 'Mandi · supplier stock')],
    ['quality', lx(language, 'बनाना & क्वालिटी', 'Making & quality'), 'CLF training · FSSAI'],
    ['selling', lx(language, 'बेचना · मार्केट', 'Selling · market'), health.strongestHaatName ? lx(language, `सबसे मजबूत: ${health.strongestHaatName}`, `Strongest: ${health.strongestHaatName}`) : lx(language, 'हाट result दर्ज करें', 'Log a haat result')],
    ['money', lx(language, 'बचत & कर्ज', 'Savings & credit'), lx(language, `${formatInrMinor(health.savingsMinor)} बचत`, `${formatInrMinor(health.savingsMinor)} saved`)],
    ['digital', lx(language, 'डिजिटल · UPI', 'Digital · UPI'), 'UPI / WhatsApp catalog'],
  ] as const;

  return (
    <View style={[shellStyles.livelihoodSheet, { bottom: bottomOffset + 12 }]}>
      <View style={shellStyles.sheetHandle} />
      <View style={shellStyles.livelihoodHead}>
        <View>
          <Text style={shellStyles.livelihoodEyebrow}>{lx(language, 'धंधे की सेहत · लखपति दीदी', 'BUSINESS HEALTH · LAKHPATI DIDI')}</Text>
          <Text style={shellStyles.livelihoodTitle}>{lx(language, 'इस साल की कमाई', 'This year’s earnings')}</Text>
        </View>
        <Pressable style={shellStyles.roundClose} onPress={onClose} accessibilityRole="button">
          <Ionicons name="close" size={18} color={IOS_COLORS.secondaryLabel} />
        </Pressable>
      </View>

      <View style={shellStyles.healthHero}>
        <View style={shellStyles.healthRing}>
          <Text style={shellStyles.healthRingValue}>{health.progressPct}%</Text>
          <Text style={shellStyles.healthRingSub}>of ₹1L</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={shellStyles.healthHeroTitle}>{lx(language, `${formatInrMinor(health.revenueMinor)} दर्ज`, `${formatInrMinor(health.revenueMinor)} logged`)}</Text>
          <Text style={shellStyles.healthHeroBody}>
            {lastEntry
              ? lx(language, `पिछला हाट: ${formatInrMinor(lastEntry.revenueMinor)} बिक्री, ${formatInrMinor(lastEntry.savingsMinor)} बचत.`, `Last haat: ${formatInrMinor(lastEntry.revenueMinor)} sales, ${formatInrMinor(lastEntry.savingsMinor)} saved.`)
              : lx(language, 'लखपति progress शुरू करने के लिए पहला हाट result दर्ज करें.', 'Log the first haat result to start the Lakhpati progress view.')}
          </Text>
        </View>
      </View>

      <View style={shellStyles.cashBookTiles}>
        <View style={[shellStyles.cashBookTile, { backgroundColor: '#EAF5EA' }]}>
          <Text style={shellStyles.cashBookLabel}>{lx(language, 'कमाई', 'Income')}</Text>
          <Text style={[shellStyles.cashBookValue, { color: '#157F3B' }]}>{formatInrMinor(health.revenueMinor)}</Text>
        </View>
        <View style={[shellStyles.cashBookTile, { backgroundColor: '#FFF1E6' }]}>
          <Text style={shellStyles.cashBookLabel}>{lx(language, 'खर्च', 'Costs')}</Text>
          <Text style={[shellStyles.cashBookValue, { color: '#C2410C' }]}>{formatInrMinor(health.expensesMinor)}</Text>
        </View>
        <View style={[shellStyles.cashBookTile, { backgroundColor: '#EFEAFF' }]}>
          <Text style={shellStyles.cashBookLabel}>{lx(language, 'मुनाफ़ा', 'Profit')}</Text>
          <Text style={[shellStyles.cashBookValue, { color: '#4F46E5' }]}>{formatInrMinor(health.profitMinor)}</Text>
        </View>
      </View>

      <Text style={shellStyles.healthSectionLabel}>{lx(language, 'हर क्षमता कहाँ बन रही है', 'Where each capability is being built')}</Text>
      {capRows.map(([key, title, sub]) => {
        const on = health.capabilityStates[key];
        return (
          <View key={key} style={shellStyles.capRow}>
            <View style={[shellStyles.capDot, { backgroundColor: on ? '#159447' : 'rgba(60,60,67,0.22)' }]} />
            <View style={{ flex: 1 }}>
              <Text style={shellStyles.capTitle}>{title}</Text>
              <Text style={shellStyles.capSub}>{sub}</Text>
            </View>
            <Text style={[shellStyles.capStatus, on && { color: '#159447' }]}>{on ? lx(language, 'मज़बूत', 'Strong') : lx(language, 'अभी नहीं', 'Not yet')}</Text>
          </View>
        );
      })}

      <Pressable style={shellStyles.gapRouteCard} onPress={onLogPress} accessibilityRole="button">
        <Text style={shellStyles.gapRouteKicker}>{lx(language, 'आगे बढ़ने का रास्ता', 'Next route')}</Text>
        <Text style={shellStyles.gapRouteTitle}>{lx(language, 'बचत और Mudra rows अब evidence हैं.', 'Savings and Mudra rows are evidence now.')}</Text>
        <Text style={shellStyles.gapRouteBody}>
          {lx(language, `${formatInrMinor(health.savingsMinor)} बचत और ${formatInrMinor(health.loanRepaymentMinor)} repayment mentor flags में जाएंगे.`, `${formatInrMinor(health.savingsMinor)} saved and ${formatInrMinor(health.loanRepaymentMinor)} repaid can roll into mentor flags later.`)}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// F8 — Ranchi mentor / CRP / CLF org Atlas
// ---------------------------------------------------------------------------
type MentorSurface = 'map' | 'queue' | 'cohort' | 'visit';
type DemoLanguage = 'hi' | 'en';

function lx(language: DemoLanguage, hi: string, en: string): string {
  return language === 'hi' ? hi : en;
}

function DemoLanguageToggle({
  language,
  onChange,
}: {
  language: DemoLanguage;
  onChange: (language: DemoLanguage) => void;
}) {
  return (
    <View style={shellStyles.demoLanguageToggle}>
      {(['hi', 'en'] as const).map((id) => {
        const active = language === id;
        return (
          <Pressable
            key={id}
            style={[shellStyles.demoLanguageButton, active && shellStyles.demoLanguageButtonActive]}
            onPress={() => onChange(id)}
            accessibilityRole="button"
          >
            <Text style={[shellStyles.demoLanguageText, active && shellStyles.demoLanguageTextActive]}>
              {id === 'hi' ? 'हिं' : 'EN'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function statusTone(status: MentorDidiStatus): string {
  if (status === 'thriving') return '#15803D';
  if (status === 'needs_attention') return '#D97706';
  return '#9A7B52';
}

function statusLabel(status: MentorDidiStatus, language: DemoLanguage = 'hi'): string {
  if (status === 'thriving') return lx(language, 'बढ़ रही', 'Growing');
  if (status === 'needs_attention') return lx(language, 'ध्यान चाहिए', 'Needs attention');
  return lx(language, 'रुकी हुई', 'Stalled');
}

function FrameF8({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const mentor = useLivelihoodMentorAtlas();
  const [surface, setSurface] = useState<MentorSurface>('map');
  const [selectedDidiId, setSelectedDidiId] = useState<string | null>(null);
  const [demoLanguage, setDemoLanguage] = useState<DemoLanguage>('hi');
  const selectedDidi = mentor.queue.find((didi) => didi.id === selectedDidiId) ?? mentor.queue[0] ?? null;
  const needsVisit = mentor.queue.filter((didi) => didi.status !== 'thriving');
  const villagePins = useMemo<AtlasPinSpec[]>(
    () =>
      mentor.villages.map((village) => {
        const alert = village.needsAttentionCount + village.stalledCount > 0;
        return {
          id: `mentor-village:${village.id}`,
          lat: village.lat,
          lng: village.lng,
          kind: alert ? 'mentor-cluster-alert' : 'mentor-cluster-ok',
          label: `${village.localName ?? village.name}|${village.didiCount}|${alert
            ? lx(
                demoLanguage,
                `${village.needsAttentionCount} ध्यान · ${village.stalledCount} रुकी`,
                `${village.needsAttentionCount} need · ${village.stalledCount} stalled`,
              )
            : lx(demoLanguage, 'बढ़ रही', 'on track')
          }`,
          subtitle: lx(
            demoLanguage,
            `${village.needsAttentionCount} ध्यान चाहिए · ${village.stalledCount} रुकी हुई`,
            `${village.needsAttentionCount} need attention · ${village.stalledCount} stalled`,
          ),
        };
      }),
    [demoLanguage, mentor.villages],
  );
  const selectedVillage = useMemo(() => {
    if (!selectedDidi) return mentor.villages[0] ?? null;
    return (
      mentor.villages.find((village) => village.name === selectedDidi.village) ??
      mentor.villages.find((village) => village.localName === selectedDidi.village) ??
      mentor.villages[0] ??
      null
    );
  }, [mentor.villages, selectedDidi]);
  const mentorFocus = selectedVillage
    ? { lat: selectedVillage.lat, lng: selectedVillage.lng }
    : null;

  const openVisit = useCallback((didi: MentorDidi) => {
    setSelectedDidiId(didi.id);
    setSurface('visit');
  }, []);

  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <View style={shellStyles.mapArea}>
        <AtlasMapLibreCanvas
          frame="f8"
          pins={villagePins}
          focusLocation={mentorFocus}
          focusZoomLevel={10.6}
          focusPadding={{ top: 170, bottom: 260, left: 30, right: 30 }}
          onPinPress={() => setSurface('queue')}
        />
        <View pointerEvents="none" style={shellStyles.mentorMapVeil} />
        <View style={shellStyles.floatingChrome}>
          <TopChrome
            title="Atlas"
            subtitle={handlers.subtitleOverride ?? lx(demoLanguage, 'रांची cluster · 6 गांव · CRP view', 'Ranchi cluster · 6 villages · CRP view')}
            interestOverride={{ name: lx(demoLanguage, 'CRP · मेंटर', 'CRP · Mentor'), accentColor: '#4338CA' }}
            avatarInitial={handlers.avatarInitial ?? 'C'}
            onSearchPress={() => {
              /* Search ships with the full mentor roster. */
            }}
          />
          <View style={shellStyles.mentorSegmentRow}>
            {[
              ['map', lx(demoLanguage, 'नक्शा', 'Map')],
              ['queue', lx(demoLanguage, 'कतार', 'Queue')],
              ['cohort', 'CLF'],
            ].map(([id, label]) => {
              const active = surface === id || (id === 'map' && surface === 'visit');
              return (
                <Pressable
                  key={id}
                  style={[shellStyles.mentorSegment, active && shellStyles.mentorSegmentActive]}
                  onPress={() => setSurface(id as MentorSurface)}
                  accessibilityRole="button"
                >
                  <Text style={[shellStyles.mentorSegmentText, active && shellStyles.mentorSegmentTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={shellStyles.mentorLegend}>
          <MentorLegendRow color="#15803D" label={statusLabel('thriving', demoLanguage)} />
          <MentorLegendRow color="#D97706" label={statusLabel('needs_attention', demoLanguage)} />
          <MentorLegendRow color="#9A7B52" label={statusLabel('stalled', demoLanguage)} />
        </View>
        <DemoLanguageToggle language={demoLanguage} onChange={setDemoLanguage} />

        {surface === 'map' ? (
          <MentorNeedHero
            count={needsVisit.length}
            didis={needsVisit.slice(0, 2)}
            language={demoLanguage}
            onQueuePress={() => setSurface('queue')}
            onVisitPress={() => {
              if (needsVisit[0]) openVisit(needsVisit[0]);
            }}
          />
        ) : null}
      </View>

      {surface === 'queue' ? (
        <MentorQueueSheet
          didis={mentor.queue}
          isLoading={mentor.isLoading}
          onClose={() => setSurface('map')}
          onOpenVisit={openVisit}
          language={demoLanguage}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      ) : surface === 'cohort' ? (
        <MentorCohortSheet
          summary={mentor.summary}
          onClose={() => setSurface('map')}
          language={demoLanguage}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      ) : surface === 'visit' && selectedDidi ? (
        <MentorVisitSheet
          didi={selectedDidi}
          onClose={() => setSurface('map')}
          onQueuePress={() => setSurface('queue')}
          language={demoLanguage}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      ) : null}

      {mentor.hasLiveData ? null : (
        <View style={shellStyles.mentorDataBadge}>
          <Text style={shellStyles.mentorDataBadgeText}>DEMO UNTIL #29 DATA SYNC</Text>
        </View>
      )}
    </View>
  );
}

function MentorLegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={shellStyles.mentorLegendRow}>
      <View style={[shellStyles.mentorLegendDot, { backgroundColor: color }]} />
      <Text style={shellStyles.mentorLegendText}>{label}</Text>
    </View>
  );
}

function MentorNeedHero({
  count,
  didis,
  language,
  onQueuePress,
  onVisitPress,
}: {
  count: number;
  didis: MentorDidi[];
  language: DemoLanguage;
  onQueuePress: () => void;
  onVisitPress: () => void;
}) {
  return (
    <View style={shellStyles.mentorHero}>
      <View style={shellStyles.mentorHeroKickerRow}>
        <Text style={shellStyles.mentorHeroKicker}>{lx(language, 'इस हफ्ते किसे देखूं', 'Who should I see this week?')}</Text>
        <Ionicons name="megaphone-outline" size={14} color="#4338CA" />
      </View>
      <Text style={shellStyles.mentorHeroTitle}>{lx(language, `${count} didi को मदद चाहिए`, `${count} didis need help`)}</Text>
      <View style={shellStyles.mentorHeroPeople}>
        {didis.map((didi) => (
          <View key={didi.id} style={shellStyles.mentorHeroPerson}>
            <View style={[shellStyles.mentorHeroAvatar, { backgroundColor: statusTone(didi.status) }]}>
              <Text style={shellStyles.mentorAvatarText}>{didi.initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={shellStyles.mentorHeroName} numberOfLines={1}>{didi.name}</Text>
              <Text style={shellStyles.mentorHeroReason} numberOfLines={1}>{didi.blueprintStep}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={shellStyles.mentorHeroButtons}>
        <Pressable style={shellStyles.mentorHeroPrimary} onPress={onVisitPress} accessibilityRole="button">
          <Text style={shellStyles.mentorHeroPrimaryText}>{lx(language, 'दौरा तय करें', 'Schedule visit')}</Text>
        </Pressable>
        <Pressable style={shellStyles.mentorHeroSecondary} onPress={onQueuePress} accessibilityRole="button">
          <Text style={shellStyles.mentorHeroSecondaryText}>{lx(language, 'सबको देखें', 'See all')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MentorQueueSheet({
  didis,
  isLoading,
  onClose,
  onOpenVisit,
  language,
  bottomOffset = 0,
}: {
  didis: MentorDidi[];
  isLoading: boolean;
  onClose: () => void;
  onOpenVisit: (didi: MentorDidi) => void;
  language: DemoLanguage;
  bottomOffset?: number;
}) {
  return (
    <View style={[shellStyles.mentorSheet, { bottom: bottomOffset + 12 }]}>
      <View style={shellStyles.sheetHandle} />
      <View style={shellStyles.livelihoodHead}>
        <View>
          <Text style={shellStyles.mentorEyebrow}>{lx(language, 'मेंटोरिंग कतार · दीदी', 'MENTORING QUEUE · DIDIS')}</Text>
          <Text style={shellStyles.livelihoodTitle}>{lx(language, 'दीदी · मदद की कतार', 'Didis · help queue')}</Text>
        </View>
        <Pressable style={shellStyles.roundClose} onPress={onClose} accessibilityRole="button">
          <Ionicons name="close" size={18} color={IOS_COLORS.secondaryLabel} />
        </Pressable>
      </View>
      <View style={shellStyles.mentorFilterRow}>
        <Text style={[shellStyles.mentorFilterChip, shellStyles.mentorFilterChipActive]}>{lx(language, 'मदद चाहिए', 'Needs help')} · {didis.filter((d) => d.status !== 'thriving').length}</Text>
        <Text style={shellStyles.mentorFilterChip}>{lx(language, 'लखपति राह', 'Lakhpati path')}</Text>
        <Text style={shellStyles.mentorFilterChip}>{lx(language, 'सब', 'All')}</Text>
      </View>
      {isLoading ? <ActivityIndicator size="small" color="#4338CA" /> : null}
      <ScrollView style={shellStyles.mentorQueueList}>
        {didis.map((didi) => (
          <Pressable
            key={didi.id}
            style={shellStyles.mentorQueueRow}
            onPress={() => onOpenVisit(didi)}
            accessibilityRole="button"
          >
            <View style={[shellStyles.mentorQueueAvatar, { backgroundColor: statusTone(didi.status) }]}>
              <Text style={shellStyles.mentorAvatarText}>{didi.initials}</Text>
              <View style={[shellStyles.mentorAvatarStatus, { backgroundColor: statusTone(didi.status) }]} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={shellStyles.mentorQueueName} numberOfLines={1}>
                {didi.name} <Text style={shellStyles.mentorQueueSmall}>· {didi.village}</Text>
              </Text>
              <Text style={shellStyles.mentorQueueStatus} numberOfLines={1}>
                {lx(language, 'स्थिति', 'Status')}: <Text style={{ color: statusTone(didi.status), fontWeight: '900' }}>{statusLabel(didi.status, language)}</Text> · {formatInrMinor(didi.revenueMinor)}
              </Text>
              <View style={shellStyles.mentorNudgeCard}>
                <Ionicons name="bulb-outline" size={14} color="#D97706" />
                <Text style={shellStyles.mentorNudgeText} numberOfLines={2}>{didi.nudgeBody}</Text>
                <View style={shellStyles.mentorNudgeButton}>
                  <Text style={shellStyles.mentorNudgeButtonText}>{lx(language, 'दौरा', 'Visit')}</Text>
                </View>
              </View>
            </View>
            <Text style={shellStyles.mentorQueueDistance}>{didi.distanceKm.toFixed(1)} km</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function MentorCohortSheet({
  summary,
  onClose,
  language,
  bottomOffset = 0,
}: {
  summary: MentorCohortSummary;
  onClose: () => void;
  language: DemoLanguage;
  bottomOffset?: number;
}) {
  return (
    <View style={[shellStyles.mentorSheet, { bottom: bottomOffset + 12 }]}>
      <View style={shellStyles.sheetHandle} />
      <View style={shellStyles.livelihoodHead}>
        <View>
          <Text style={shellStyles.mentorEyebrow}>{lx(language, 'CLF · JSLPS · प्रगति', 'CLF · JSLPS · PROGRESS')}</Text>
          <Text style={shellStyles.livelihoodTitle}>{lx(language, 'लखपति दीदी cohort', 'Lakhpati didi cohort')}</Text>
        </View>
        <Pressable style={shellStyles.roundClose} onPress={onClose} accessibilityRole="button">
          <Ionicons name="close" size={18} color={IOS_COLORS.secondaryLabel} />
        </Pressable>
      </View>
      <View style={shellStyles.mentorCohortHero}>
        <View style={shellStyles.mentorCohortRing}>
          <Text style={shellStyles.mentorCohortRingValue}>{summary.lakhpatiCount}</Text>
          <Text style={shellStyles.mentorCohortRingSub}>/ {summary.totalDidis}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={shellStyles.mentorCohortTitle}>{lx(language, `${summary.lakhpatiPct}% didi लखपति बनीं`, `${summary.lakhpatiPct}% didis crossed Lakhpati`)}</Text>
          <Text style={shellStyles.mentorCohortBody}>
            {lx(language, `${formatInrMinor(summary.revenueMinor)} दर्ज · ${summary.needsVisitCount} को इस हफ्ते दौरा चाहिए.`, `${formatInrMinor(summary.revenueMinor)} logged · ${summary.needsVisitCount} need a visit this week.`)}
          </Text>
        </View>
      </View>
      <Text style={shellStyles.healthSectionLabel}>{lx(language, 'Cluster में scheme uptake', 'Scheme uptake across the cluster')}</Text>
      {summary.schemeUptake.map((scheme) => (
        <View key={scheme.slug} style={shellStyles.mentorSchemeRow}>
          <View style={shellStyles.mentorSchemeNameWrap}>
            <Text style={shellStyles.mentorSchemeName}>{scheme.name}</Text>
            <Text style={shellStyles.mentorSchemeType}>{scheme.type}</Text>
          </View>
          <View style={shellStyles.mentorSchemeTrack}>
            <View
              style={[
                shellStyles.mentorSchemeFill,
                {
                  width: `${scheme.pct}%`,
                  backgroundColor:
                    scheme.tone === 'terra'
                      ? '#C2410C'
                      : scheme.tone === 'teal'
                        ? '#0E7490'
                        : scheme.tone === 'marigold'
                          ? '#D97706'
                          : '#4338CA',
                },
              ]}
            />
          </View>
          <Text style={shellStyles.mentorSchemePct}>{scheme.pct}%</Text>
        </View>
      ))}
      <Text style={shellStyles.healthSectionLabel}>{lx(language, 'गांव coverage', 'Village coverage')}</Text>
      <View style={shellStyles.mentorCoverageGrid}>
        {summary.villages.slice(0, 6).map((village) => {
          const toneStyle =
            village.progressPct >= 55
              ? shellStyles.mentorCoverageGood
              : village.progressPct >= 35
                ? shellStyles.mentorCoverageMid
                : shellStyles.mentorCoverageLow;
          return (
            <View key={village.id} style={[shellStyles.mentorCoverageCard, toneStyle]}>
              <Text style={shellStyles.mentorCoverageName}>{village.localName ?? village.name}</Text>
              <Text style={shellStyles.mentorCoverageSub}>{village.didiCount} didi</Text>
              <Text style={shellStyles.mentorCoveragePct}>▲ {village.progressPct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MentorVisitSheet({
  didi,
  onClose,
  onQueuePress,
  language,
  bottomOffset = 0,
}: {
  didi: MentorDidi;
  onClose: () => void;
  onQueuePress: () => void;
  language: DemoLanguage;
  bottomOffset?: number;
}) {
  return (
    <View style={[shellStyles.mentorVisitSheet, { bottom: bottomOffset + 12 }]}>
      <View style={shellStyles.sheetHandle} />
      <View style={shellStyles.mentorVisitHead}>
        <View style={[shellStyles.mentorQueueAvatar, { backgroundColor: statusTone(didi.status) }]}>
          <Text style={shellStyles.mentorAvatarText}>{didi.initials}</Text>
          <View style={[shellStyles.mentorAvatarStatus, { backgroundColor: statusTone(didi.status) }]} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={shellStyles.mentorEyebrow}>{lx(language, 'मेंटोरिंग दौरा · दर्ज करें', 'MENTORING VISIT · LOG')}</Text>
          <Text style={shellStyles.mentorVisitTitle} numberOfLines={1}>{didi.name}</Text>
          <Text style={shellStyles.mentorVisitSub} numberOfLines={1}>{didi.shgName} · {didi.village}</Text>
        </View>
        <Pressable style={shellStyles.roundClose} onPress={onClose} accessibilityRole="button">
          <Ionicons name="close" size={18} color={IOS_COLORS.secondaryLabel} />
        </Pressable>
      </View>
      <View style={shellStyles.mentorGapRow}>
        <MentorGapCard icon="🥭" title={lx(language, 'बनाना', 'Making')} status={didi.revenueMinor > 0 ? lx(language, 'मज़बूत', 'Strong') : lx(language, 'कमज़ोर', 'Weak')} ok={didi.revenueMinor > 0} />
        <MentorGapCard icon="🏦" title={lx(language, 'बेचना', 'Selling')} status={didi.haatCount > 1 ? lx(language, `${didi.haatCount} हाट`, `${didi.haatCount} haats`) : lx(language, '1 हाट', '1 haat')} ok={didi.haatCount > 1} />
        <MentorGapCard icon="📱" title={lx(language, 'डिजिटल', 'Digital')} status={didi.loanRepaymentMinor > 0 ? 'UPI' : lx(language, 'अभी नहीं', 'Not yet')} ok={didi.loanRepaymentMinor > 0} />
      </View>
      <View style={shellStyles.mentorPlanCard}>
        <Text style={shellStyles.mentorPlanKicker}>{lx(language, 'इस दौरे का लक्ष्य', 'Visit goal')}</Text>
        <Text style={shellStyles.mentorPlanTitle}>{didi.nudgeTitle}</Text>
        <Text style={shellStyles.mentorPlanBody}>{didi.nudgeBody}</Text>
        <View style={shellStyles.mentorAssignedStep}>
          <View style={shellStyles.mentorAssignedIcon}>
            <Ionicons name="clipboard-outline" size={16} color="#C2410C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={shellStyles.mentorAssignedTitle}>{lx(language, 'Blueprint step सौंपा', 'Blueprint step assigned')}</Text>
            <Text style={shellStyles.mentorAssignedSub}>{lx(language, `${didi.blueprintStep} · didi plan में जाएगा`, `${didi.blueprintStep} · goes into her plan`)}</Text>
          </View>
          <Ionicons name="checkmark" size={18} color="#15803D" />
        </View>
      </View>
      <Pressable style={shellStyles.mentorLogVisitRow} onPress={onQueuePress} accessibilityRole="button">
        <View style={shellStyles.mentorLogVisitIcon}>
          <Ionicons name="mic-outline" size={18} color="#4338CA" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={shellStyles.mentorLogVisitTitle}>{lx(language, 'Visit note बोलकर दर्ज करें', 'Record visit note by voice')}</Text>
          <Text style={shellStyles.mentorLogVisitSub}>{lx(language, 'यह note SHG → VO → CLF rollup का evidence बनेगा.', 'This note becomes evidence for SHG → VO → CLF rollup.')}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function MentorGapCard({
  icon,
  title,
  status,
  ok,
}: {
  icon: string;
  title: string;
  status: string;
  ok: boolean;
}) {
  return (
    <View style={[shellStyles.mentorGapCard, ok ? shellStyles.mentorGapOk : shellStyles.mentorGapWeak]}>
      <Text style={shellStyles.mentorGapIcon}>{icon}</Text>
      <Text style={shellStyles.mentorGapTitle}>{title}</Text>
      <Text style={[shellStyles.mentorGapStatus, { color: ok ? '#15803D' : '#D97706' }]}>{status}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// BottomSheet — shared bottom card with eyebrow / title / body / stats / btns
// ---------------------------------------------------------------------------
interface StatItem {
  value: string;
  label: string;
}
interface BottomSheetProps {
  eyebrow?: string;
  title?: string;
  /**
   * One-line provenance shown directly under the title in *both* mid
   * and expanded states (hidden only in 'handle'). Use for NEXT-pill
   * source attribution ("From: your timeline / cohort schedule / etc.")
   * so the user can answer "where did this come from?" without having
   * to expand the sheet.
   */
  source?: string;
  /**
   * When provided, the source line renders as a Pressable that fires
   * this callback — lets users drill into the blueprint, program, or
   * schedule that surfaced the NEXT event. Optional; if omitted source
   * is static text.
   */
  onSourcePress?: () => void;
  body?: string;
  expandedContent?: React.ReactNode;
  peerHeader?: { name: string; quote: string; eyebrow: string };
  statsRow?: StatItem[];
  primary?: {
    label: string;
    sublabel?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress?: () => void;
  };
  secondary?: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void };
  onClose?: () => void;
  /**
   * Render the secondary CTA in the mid state as well. Use this when the
   * secondary action is actually a primary navigation path, not a detail-
   * only affordance hidden behind sheet expansion.
   */
  showSecondaryInMid?: boolean;
  /**
   * Optional inline strip rendered between the pull-tab handle and the
   * eyebrow/title block. Shown in mid + expanded states, hidden in
   * handle-only. Used on Atlas to embed the step picker chips at the
   * top of the sheet so the user can jump between or anchor steps
   * without leaving the sheet.
   */
  topStripContent?: React.ReactNode;
  /**
   * Initial sheet state. Defaults to 'mid' for ambient sheets (persistent
   * next-event card). Pin-detail sheets pass 'expanded' so body/provenance
   * lines are visible immediately on first tap — the user asked for
   * detail; they shouldn't have to also tap the pull-tab to see it.
   */
  initialState?: 'handle' | 'mid' | 'expanded';
  /**
   * Default handle mode is the small centered grabber. `edgeTab` hides
   * the card off the left edge and leaves a compact restore tab.
   */
  handleBehavior?: 'inline' | 'edgeTab';
  collapsedLabel?: string;
}

function BottomSheet({
  eyebrow,
  title,
  source,
  onSourcePress,
  body,
  expandedContent,
  peerHeader,
  statsRow,
  primary,
  secondary,
  onClose,
  showSecondaryInMid = false,
  topStripContent,
  bottomOffset = 0,
  initialState = 'mid',
  handleBehavior = 'inline',
  collapsedLabel,
}: BottomSheetProps & { bottomOffset?: number }) {
  // Three-state sheet: HANDLE (28pt — just the pull tab, true edge-to-
  // edge map below), MID (~110pt — handle + eyebrow + primary CTA), and
  // EXPANDED (full content). Tap the handle to cycle: EXPANDED → MID →
  // HANDLE → EXPANDED.
  const [state, setState] = useState<'handle' | 'mid' | 'expanded'>(initialState);
  const cycle = useCallback(() => {
    setState((v) => (v === 'expanded' ? 'mid' : v === 'mid' ? 'handle' : 'expanded'));
  }, []);
  const { height: windowHeight } = useWindowDimensions();
  // Cap the expanded body so a tall detail (race strategy, stats, peer header)
  // scrolls instead of overflowing off-screen past the fixed CTA row.
  const expandedScrollMaxHeight = Math.round(windowHeight * 0.46);
  const showFull = state === 'expanded';
  const showMid = state !== 'handle';
  if (state === 'handle' && handleBehavior === 'edgeTab') {
    return (
      <View
        style={[
          shellStyles.edgeSheetTabWrap,
          bottomOffset > 0 && { bottom: bottomOffset },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => setState('mid')}
          accessibilityRole="button"
          accessibilityLabel={`Show ${collapsedLabel ?? title ?? 'step card'}`}
          hitSlop={{ top: 10, right: 12, bottom: 10, left: 12 }}
          style={({ pressed }) => (pressed ? shellStyles.edgeSheetTabPressed : null)}
        >
          <View style={[shellStyles.edgeSheetTab, shellStyles.edgeSheetTabRow]}>
            <View style={shellStyles.edgeSheetTabAccent} />
            <Text style={shellStyles.edgeSheetTabText} numberOfLines={1}>
              {collapsedLabel ?? eyebrow ?? 'Step'}
            </Text>
            <Ionicons name="chevron-up" size={13} color={IOS_REGISTER.labelTertiary} />
          </View>
        </Pressable>
      </View>
    );
  }
  return (
    <View
      style={[
        shellStyles.bottomSheet,
        bottomOffset > 0 && {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: bottomOffset,
          zIndex: 12,
          borderRadius: 16,
          marginHorizontal: 8,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        },
      ]}
    >
      {/* The grabber cycles sheet height; close, when present, lives in the header. */}
      <Pressable
        onPress={cycle}
        accessibilityRole="button"
        accessibilityLabel={`Sheet state: ${state}. Tap to cycle.`}
        hitSlop={12}
        style={shellStyles.sheetHandleHit}
      >
        <View style={shellStyles.sheetHandle} />
      </Pressable>
      {showMid && topStripContent ? (
        <View style={shellStyles.sheetTopStrip}>{topStripContent}</View>
      ) : null}
      {showMid ? (
        <View style={shellStyles.sheetHeaderRow}>
          <View style={shellStyles.sheetHeaderText}>
            {eyebrow ? <Text style={shellStyles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text style={shellStyles.sheetTitle} numberOfLines={showFull ? undefined : 1}>{title}</Text> : null}
          </View>
          <View style={shellStyles.sheetHeaderActions}>
            {/* Chevron toggles expanded ↔ mid only — it must match its own
                arrow direction. Minimizing further (handle / edge tab) is
                the grabber's job. */}
            <Pressable
              onPress={() => setState(showFull ? 'mid' : 'expanded')}
              accessibilityRole="button"
              accessibilityLabel={showFull ? 'Collapse sheet' : 'Expand sheet'}
              hitSlop={8}
              style={shellStyles.sheetCollapseButton}
            >
              <Ionicons
                name={showFull ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={IOS_REGISTER.labelSecondary}
              />
            </Pressable>
            {onClose ? (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close sheet"
                hitSlop={8}
                style={shellStyles.sheetCloseButton}
              >
                <Ionicons name="close" size={18} color={IOS_REGISTER.labelSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {showMid && source ? (
        onSourcePress ? (
          <Pressable onPress={onSourcePress} hitSlop={6}>
            <Text style={[shellStyles.sheetSource, shellStyles.sheetSourceLink]}>{source}</Text>
          </Pressable>
        ) : (
          <Text style={shellStyles.sheetSource}>{source}</Text>
        )
      ) : null}
      {showFull ? (
        <ScrollView
          style={{ maxHeight: expandedScrollMaxHeight }}
          contentContainerStyle={shellStyles.sheetScrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {peerHeader ? (
            <View>
              <Text style={shellStyles.peerName}>
                {peerHeader.name} <Text style={shellStyles.peerQuote}>· {peerHeader.quote}</Text>
              </Text>
              <Text style={shellStyles.peerEyebrow}>{peerHeader.eyebrow}</Text>
            </View>
          ) : null}
          {body ? <Text style={shellStyles.sheetBody}>{body}</Text> : null}
          {expandedContent}
          {statsRow ? (
            <View style={shellStyles.statsRow}>
              {statsRow.map((stat) => (
                <Stat key={stat.label} {...stat} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
      {showMid && (primary || secondary) && (
        <View style={shellStyles.btnRow}>
          {primary ? (
            <Pressable
              onPress={primary.onPress}
              style={[
                shellStyles.btn,
                shellStyles.btnPrimary,
                primary.sublabel ? shellStyles.btnTall : null,
              ]}
            >
              {primary.icon ? <Ionicons name={primary.icon} size={14} color="#FFF" /> : null}
              <View style={shellStyles.btnPrimaryTextCol}>
                <Text style={shellStyles.btnPrimaryText} numberOfLines={1}>{primary.label}</Text>
                {primary.sublabel ? (
                  <Text style={shellStyles.btnPrimarySubtext} numberOfLines={1}>
                    {primary.sublabel}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ) : null}
          {(showFull || showSecondaryInMid) && secondary ? (
            <Pressable onPress={secondary.onPress} style={[shellStyles.btn, shellStyles.btnSecondary]}>
              {secondary.icon ? (
                <Ionicons name={secondary.icon} size={14} color={IOS_REGISTER.label} />
              ) : null}
              <Text style={shellStyles.btnSecondaryText} numberOfLines={1}>{secondary.label}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Stat({ value, label }: StatItem) {
  return (
    <View style={shellStyles.stat}>
      <Text style={shellStyles.statValue}>{value}</Text>
      <Text style={shellStyles.statLabel}>{label}</Text>
    </View>
  );
}

function WindTideScrubber({
  windows,
  value,
  onChange,
  metrics,
  strategy,
  bottomOffset = 0,
  title,
  flipNote,
  notice,
}: {
  windows: string[];
  value: number;
  onChange: (value: number) => void;
  metrics: { label: string; value: string }[];
  strategy: CourseStrategy | null;
  bottomOffset?: number;
  /** Header override — "Race time · Sat 2pm" when real race forecasts feed the scrub. */
  title?: string;
  /** Amber tidal-reversal warning, e.g. "Tide flips ~3pm". */
  flipNote?: string | null;
  /** Honesty line when the race forecast isn't open yet. */
  notice?: string | null;
}) {
  const [strategyOpen, setStrategyOpen] = useState(false);
  if (windows.length === 0) return null;
  return (
    <View
      style={[
        shellStyles.windTideScrubber,
        { bottom: bottomOffset + 116 },
      ]}
      pointerEvents="box-none"
    >
      <View style={shellStyles.windTideScrubberCard}>
        <View style={shellStyles.windTideScrubberHeader}>
          <Text
            style={[
              shellStyles.windTideScrubberLabel,
              title ? scrubberRaceStyles.raceTitle : null,
            ]}
            numberOfLines={1}
          >
            {title ?? 'Wind / tide time'}
          </Text>
          <Text style={shellStyles.windTideScrubberValue}>
            {windows[Math.min(value, windows.length - 1)]?.toUpperCase()}
          </Text>
        </View>
        {flipNote ? (
          <View style={scrubberRaceStyles.flipPill}>
            <Ionicons name="warning-outline" size={11} color="#B25E09" />
            <Text style={scrubberRaceStyles.flipText} numberOfLines={1}>
              {flipNote}
            </Text>
          </View>
        ) : null}
        {notice ? (
          <Text style={scrubberRaceStyles.notice} numberOfLines={1}>
            {notice}
          </Text>
        ) : null}
        {metrics.length > 0 ? (
          <View style={cockpitStyles.gaugeRow}>
            {metrics.map((m) => (
              <View key={m.label} style={cockpitStyles.gaugeCell}>
                <Text style={cockpitStyles.gaugeLabel}>{m.label.toUpperCase()}</Text>
                <Text style={cockpitStyles.gaugeValue} numberOfLines={1}>
                  {m.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Slider
          minimumValue={0}
          maximumValue={Math.max(0, windows.length - 1)}
          step={1}
          value={value}
          minimumTrackTintColor="#007AFF"
          maximumTrackTintColor="rgba(60, 60, 67, 0.18)"
          thumbTintColor="#007AFF"
          onValueChange={(next) => onChange(Math.round(next))}
          onSlidingComplete={(next) => onChange(Math.round(next))}
        />
        <View style={shellStyles.windTideScrubberTicks}>
          {windows.map((window) => (
            <Text key={window} style={shellStyles.windTideScrubberTick}>
              {window}
            </Text>
          ))}
        </View>
        {strategy ? (
          <>
            <Pressable
              onPress={() => setStrategyOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={strategyOpen ? 'Hide strategy' : 'Show strategy'}
              style={scrubberStrategyStyles.toggle}
              hitSlop={6}
            >
              <Text style={scrubberStrategyStyles.toggleLabel}>STRATEGY</Text>
              <Text style={scrubberStrategyStyles.toggleHeadline} numberOfLines={1}>
                {strategyHeadline(strategy)}
              </Text>
              <Ionicons
                name={strategyOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={IOS_REGISTER.labelTertiary}
              />
            </Pressable>
            {strategyOpen ? (
              <ScrollView
                style={scrubberStrategyStyles.scroll}
                contentContainerStyle={scrubberStrategyStyles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <CourseStrategyCard strategy={strategy} />
              </ScrollView>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function StepCockpit({
  title,
  locationName,
  subSteps,
  beats,
  onOpenStep,
  bottomOffset = 0,
  collapsed = false,
  onToggleCollapse,
  onClose,
}: {
  title: string;
  locationName: string | null;
  subSteps: CockpitSubStep[];
  beats: CockpitBeat[];
  onOpenStep: () => void;
  bottomOffset?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}) {
  const doneCount = subSteps.filter((s) => s.completed).length;
  const beatDoneCount = beats.filter((b) => b.done).length;
  // Collapsed: tuck into the left edge above the tab bar. Tap to restore
  // the full cockpit.
  if (collapsed) {
    return (
      <View
        style={[
          shellStyles.edgeSheetTabWrap,
          bottomOffset > 0 && { bottom: bottomOffset },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={onToggleCollapse}
          accessibilityRole="button"
          accessibilityLabel="Next step — tap to expand"
          hitSlop={{ top: 10, right: 12, bottom: 10, left: 12 }}
          style={({ pressed }) => (pressed ? shellStyles.edgeSheetTabPressed : null)}
        >
          <View style={[shellStyles.edgeSheetTab, shellStyles.edgeSheetTabRow]}>
            <View style={shellStyles.edgeSheetTabAccent} />
            <Text style={shellStyles.edgeSheetTabText} numberOfLines={1}>
              NEXT STEP
            </Text>
            {subSteps.length > 0 ? (
              <Text style={shellStyles.edgeSheetTabCount}>
                {doneCount}/{subSteps.length}
              </Text>
            ) : null}
            <Ionicons name="chevron-up" size={13} color={IOS_REGISTER.labelTertiary} />
          </View>
        </Pressable>
      </View>
    );
  }
  return (
    <View
      style={[shellStyles.windTideScrubber, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      <View style={shellStyles.windTideScrubberCard}>
        <View style={stepCockpitStyles.eyebrowRow}>
          <View style={[stepCockpitStyles.stepPill, { backgroundColor: STEP_FILTER_DOT }]}>
            <Text style={stepCockpitStyles.stepPillText} numberOfLines={1}>
              STEP
            </Text>
          </View>
          <View style={stepCockpitStyles.nextPill}>
            <Text style={stepCockpitStyles.nextPillText} numberOfLines={1}>
              NEXT
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          {onToggleCollapse ? (
            <Pressable
              onPress={onToggleCollapse}
              accessibilityRole="button"
              accessibilityLabel="Collapse next step"
              hitSlop={10}
              style={stepCockpitStyles.collapseBtn}
            >
              <Ionicons name="chevron-down" size={16} color={IOS_REGISTER.labelTertiary} />
            </Pressable>
          ) : null}
          {onClose ? (
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close next step"
              hitSlop={10}
              style={stepCockpitStyles.collapseBtn}
            >
              <Ionicons name="close" size={16} color={IOS_REGISTER.labelTertiary} />
            </Pressable>
          ) : null}
        </View>
        <Text style={stepCockpitStyles.title} numberOfLines={2}>
          {title}
        </Text>
        {locationName ? (
          <Text style={stepCockpitStyles.subtitle} numberOfLines={1}>
            {locationName}
          </Text>
        ) : null}
        {subSteps.length > 0 ? (
          <>
            <Text style={stepCockpitStyles.checklistLead}>
              {doneCount} of {subSteps.length} done
            </Text>
            <ScrollView
              style={stepCockpitStyles.checklist}
              showsVerticalScrollIndicator={false}
            >
              {subSteps.map((s) => (
                <View key={s.id} style={stepCockpitStyles.checkRow}>
                  <View
                    style={[
                      stepCockpitStyles.checkBox,
                      s.completed && { backgroundColor: STEP_FILTER_DOT, borderColor: STEP_FILTER_DOT },
                    ]}
                  >
                    {s.completed ? (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      stepCockpitStyles.checkText,
                      s.completed && stepCockpitStyles.checkTextDone,
                    ]}
                    numberOfLines={2}
                  >
                    {s.text}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}
        {beats.length > 0 ? (
          <>
            <Text style={stepCockpitStyles.checklistLead}>
              {beatDoneCount} of {beats.length} beats done
            </Text>
            <StepBeatList beats={beats} compact />
          </>
        ) : null}
        <View style={stepCockpitStyles.actionRow}>
          <Pressable
            onPress={onOpenStep}
            style={[stepCockpitStyles.actionPrimary, { backgroundColor: STEP_FILTER_DOT }]}
          >
            <Ionicons name="open-outline" size={15} color="#FFFFFF" />
            <Text style={stepCockpitStyles.actionPrimaryText}>Open step</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function StepDetailSheetContent({ step }: { step: AtlasCockpitStep }) {
  return (
    <View style={stepDetailStyles.sectionStack}>
      {step.subSteps.length > 0 ? (
        <View>
          <Text style={stepDetailStyles.sectionEyebrow}>CHECKLIST</Text>
          <StepChecklistList subSteps={step.subSteps} />
        </View>
      ) : null}
      {step.beats.length > 0 ? (
        <View>
          <Text style={stepDetailStyles.sectionEyebrow}>BEATS</Text>
          <StepBeatList beats={step.beats} />
        </View>
      ) : null}
      {step.subSteps.length === 0 && step.beats.length === 0 ? (
        <Text style={shellStyles.sheetBody}>No checklist or beats saved for this step yet.</Text>
      ) : null}
    </View>
  );
}

function StepChecklistList({ subSteps }: { subSteps: CockpitSubStep[] }) {
  return (
    <View style={stepDetailStyles.listCard}>
      {subSteps.map((s) => (
        <View key={s.id} style={stepDetailStyles.row}>
          <View
            style={[
              stepDetailStyles.checkBox,
              s.completed && {
                backgroundColor: STEP_FILTER_DOT,
                borderColor: STEP_FILTER_DOT,
              },
            ]}
          >
            {s.completed ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
          </View>
          <Text
            style={[
              stepDetailStyles.rowText,
              s.completed && stepDetailStyles.rowTextDone,
            ]}
          >
            {s.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StepBeatList({ beats, compact = false }: { beats: CockpitBeat[]; compact?: boolean }) {
  return (
    <View style={[stepDetailStyles.listCard, compact && stepDetailStyles.listCardCompact]}>
      {beats.map((beat) => (
        <View key={beat.id} style={stepDetailStyles.beatRow}>
          <View
            style={[
              stepDetailStyles.beatDot,
              beat.done && { backgroundColor: STEP_FILTER_DOT },
            ]}
          >
            {beat.done ? <Ionicons name="checkmark" size={10} color="#FFFFFF" /> : null}
          </View>
          <View style={stepDetailStyles.beatTextCol}>
            <View style={stepDetailStyles.beatTitleRow}>
              <Text
                style={[
                  stepDetailStyles.rowText,
                  beat.done && stepDetailStyles.rowTextDone,
                ]}
                numberOfLines={compact ? 1 : 2}
              >
                {beat.title}
              </Text>
              {beat.timeLabel ? (
                <Text style={stepDetailStyles.beatTime} numberOfLines={1}>
                  {beat.timeLabel}
                </Text>
              ) : null}
            </View>
            {!compact && beat.body ? (
              <Text style={stepDetailStyles.beatBody}>{beat.body}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function RaceStepSheetContent({
  raceStartLabel,
  courseSummary,
  forecastUnavailable,
  conditionsLabel,
  metrics,
  trends,
  strategy,
  onSetStart,
  onSetCourse,
  fallbackBody,
}: {
  raceStartLabel: string | null;
  courseSummary: string | null;
  forecastUnavailable: boolean;
  conditionsLabel: string;
  metrics: { label: string; value: string | null; detail?: string | null }[];
  trends: { label: string; value: string | null; values: (number | null)[]; color: string }[];
  strategy: CourseStrategy | null;
  onSetStart: () => void;
  onSetCourse: () => void;
  fallbackBody: string;
}) {
  const [openSections, setOpenSections] = useState({
    conditions: true,
    trends: true,
    strategy: false,
  });
  const visibleMetrics = metrics.filter((m) => m.value);
  const visibleTrends = trends.filter((t) => t.value);
  const showFallback = visibleMetrics.length === 0 && !strategy;
  const toggleSection = useCallback((section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);
  return (
    <View style={raceStepStyles.stack}>
      <View style={raceStepStyles.startRow}>
        <View>
          <Text style={raceStepStyles.startEyebrow}>RACE START</Text>
          <Text style={raceStepStyles.startValue}>
            {raceStartLabel ?? 'Not set'}
          </Text>
        </View>
        <Pressable
          onPress={onSetStart}
          style={raceStepStyles.startEditButton}
          accessibilityRole="button"
          accessibilityLabel={raceStartLabel ? 'Edit race start time' : 'Set race start time'}
        >
          <Text style={raceStepStyles.startEditText}>
            {raceStartLabel ? 'Edit in step' : 'Set start time'}
          </Text>
        </Pressable>
      </View>
      <View style={raceStepStyles.startRow}>
        <View style={raceStepStyles.courseTextCol}>
          <Text style={raceStepStyles.startEyebrow}>RACE AREA & COURSE</Text>
          <Text style={raceStepStyles.startValue} numberOfLines={2}>
            {courseSummary ?? 'Not set'}
          </Text>
        </View>
        <Pressable
          onPress={onSetCourse}
          style={raceStepStyles.startEditButton}
          accessibilityRole="button"
          accessibilityLabel={courseSummary ? 'Edit race area and course' : 'Set race area and course'}
        >
          <Text style={raceStepStyles.startEditText}>
            {courseSummary ? 'Edit in step' : 'Set in step'}
          </Text>
        </Pressable>
      </View>
      <RacePopupSection
        title="Conditions"
        summary={conditionsLabel.replace(/^Conditions ·\s*/i, '')}
        open={openSections.conditions}
        onToggle={() => toggleSection('conditions')}
      >
        {forecastUnavailable ? (
          <Text style={raceStepStyles.trendUnavailable}>
            Race-start forecast is not available for this time yet. Set a start within the forecast window to show wind, current, and sea at the race.
          </Text>
        ) : visibleMetrics.length > 0 ? (
          <View style={raceStepStyles.metricGrid}>
            {visibleMetrics.map((metric) => (
              <View key={metric.label} style={raceStepStyles.metricCard}>
                <Text style={raceStepStyles.metricLabel}>{metric.label.toUpperCase()}</Text>
                <Text style={raceStepStyles.metricValue}>{metric.value}</Text>
                {metric.detail ? (
                  <Text style={raceStepStyles.metricDetail} numberOfLines={1}>
                    {metric.detail}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : showFallback ? (
          <Text style={shellStyles.sheetBody}>{fallbackBody}</Text>
        ) : null}
      </RacePopupSection>
      {visibleTrends.length > 0 ? (
        <RacePopupSection
          title="Trends"
          summary="T-60m to T+180m"
          open={openSections.trends}
          onToggle={() => toggleSection('trends')}
        >
          <View style={raceStepStyles.trendBlock}>
          {visibleTrends.map((trend) => (
            <View key={trend.label} style={raceStepStyles.trendRow}>
              <View style={raceStepStyles.trendTextCol}>
                <Text style={raceStepStyles.trendLabel}>{trend.label.toUpperCase()}</Text>
                <Text style={raceStepStyles.trendValue} numberOfLines={2}>{trend.value}</Text>
              </View>
              <TinySparkline values={trend.values} color={trend.color} />
            </View>
          ))}
          </View>
        </RacePopupSection>
      ) : raceStartLabel ? (
        <Text style={raceStepStyles.trendUnavailable}>
          Trend window unavailable for this race time.
        </Text>
      ) : null}
      {strategy ? (
        <RacePopupSection
          title="Strategy"
          summary={strategyHeadline(strategy)}
          open={openSections.strategy}
          onToggle={() => toggleSection('strategy')}
        >
          <View style={raceStepStyles.strategyWrap}>
            <CourseStrategyCard strategy={strategy} />
          </View>
        </RacePopupSection>
      ) : null}
    </View>
  );
}

function RacePopupSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: string | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={raceStepStyles.sectionCard}>
      <Pressable
        style={raceStepStyles.sectionHeader}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={raceStepStyles.sectionHeaderText}>
          <Text style={raceStepStyles.conditionsLabel}>{title}</Text>
          {summary ? (
            <Text style={raceStepStyles.sectionSummary} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={IOS_REGISTER.labelSecondary}
        />
      </Pressable>
      {open ? <View style={raceStepStyles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function TinySparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value != null);
  if (points.length < 2) return <View style={raceStepStyles.sparklineFallback} />;
  const width = 92;
  const height = 24;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const span = Math.max(max - min, 0.1);
  const maxIndex = Math.max(values.length - 1, 1);
  const coords = points.map((point) => {
    const x = (point.index / maxIndex) * width;
    const y = height - 4 - ((point.value - min) / span) * (height - 8);
    return { x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  return (
    <View style={raceStepStyles.sparklineWrap}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={`M0 ${height - 4} L${width} ${height - 4}`} stroke="rgba(60,60,67,0.18)" strokeWidth={1} />
        <Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
      </Svg>
    </View>
  );
}

const stepDetailStyles = StyleSheet.create({
  sectionStack: {
    gap: 14,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 6,
  },
  listCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: 'rgba(248, 248, 248, 0.88)',
    overflow: 'hidden',
  },
  listCardCompact: {
    maxHeight: 124,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.labelTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  rowTextDone: {
    color: IOS_REGISTER.labelSecondary,
    textDecorationLine: 'line-through',
  },
  beatRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  beatDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginTop: 1,
    borderWidth: 1.5,
    borderColor: STEP_FILTER_DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beatTextCol: {
    flex: 1,
    minWidth: 0,
  },
  beatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  beatTime: {
    fontSize: 10.5,
    fontWeight: '700',
    color: IOS_REGISTER.labelTertiary,
  },
  beatBody: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.labelSecondary,
  },
});

const raceStepStyles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 122, 255, 0.20)',
  },
  courseTextCol: {
    flex: 1,
    minWidth: 0,
  },
  startEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#2563EB',
  },
  startValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '800',
    color: IOS_REGISTER.label,
  },
  startEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 122, 255, 0.24)',
  },
  startEditText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2563EB',
  },
  conditionsLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    overflow: 'hidden',
  },
  sectionHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  sectionSummary: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '600',
    color: IOS_REGISTER.labelTertiary,
  },
  sectionBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: 'rgba(248, 248, 248, 0.92)',
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#2563EB',
  },
  metricValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
  },
  metricDetail: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
  },
  trendBlock: {
    gap: 5,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 248, 248, 0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  trendTextCol: {
    flex: 1,
    minWidth: 0,
  },
  trendLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  trendValue: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  sparklineWrap: {
    width: 92,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparklineFallback: {
    width: 92,
    height: 24,
  },
  trendUnavailable: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.labelTertiary,
  },
  strategyWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
});

const stepCockpitStyles = StyleSheet.create({
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  kindDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eyebrowText: {
    flex: 1,
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  collapseBtn: {
    marginLeft: 6,
  },
  stepPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  stepPillText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  nextPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.55)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  nextPillText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#B45309',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '58%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  pillLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pillTitle: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  whenBadge: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: 'hidden',
  },
  title: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
    lineHeight: 23,
    color: IOS_REGISTER.label,
  },
  subtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  checklistLead: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 10,
    marginBottom: 2,
  },
  checklist: {
    maxHeight: 168,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.labelTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  checkTextDone: {
    color: IOS_REGISTER.labelSecondary,
    textDecorationLine: 'line-through',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  actionSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
  },
});

const cockpitStyles = StyleSheet.create({
  gaugeRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 4,
  },
  gaugeCell: {
    flex: 1,
    gap: 2,
  },
  gaugeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: IOS_REGISTER.labelTertiary,
  },
  gaugeValue: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: IOS_REGISTER.label,
  },
});

const scrubberStrategyStyles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#D2691E',
  },
  toggleHeadline: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  scroll: {
    maxHeight: 240,
  },
  scrollContent: {
    paddingBottom: 4,
  },
});

const scrubberRaceStyles = StyleSheet.create({
  raceTitle: {
    color: '#B25E09',
  },
  flipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  flipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B25E09',
  },
  notice: {
    marginTop: 6,
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    fontStyle: 'italic',
  },
});

/**
 * Compact callout for a step tapped on the map. Replaces the wider
 * BottomSheet so the map remains the focus — the sheet was reading as a
 * "big white box." This is a stopgap toward the Apple-Maps-style pin
 * callout tracked in project_atlas_pin_popover_redesign.
 */
function StepPreviewCallout({
  eyebrow,
  title,
  bottomOffset,
  onOpen,
  onDismiss,
}: {
  eyebrow: string;
  title: string;
  bottomOffset: number;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <View
      style={[
        calloutStyles.wrap,
        { bottom: bottomOffset + 12 },
      ]}
      pointerEvents="box-none"
    >
      <View style={calloutStyles.card}>
        <View style={calloutStyles.textCol}>
          <Text style={calloutStyles.eyebrow}>{eyebrow}</Text>
          <Text style={calloutStyles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${title}`}
          style={calloutStyles.openBtn}
        >
          <Ionicons name="open-outline" size={14} color="#FFFFFF" />
          <Text style={calloutStyles.openBtnText}>Open</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={10}
          style={calloutStyles.closeBtn}
        >
          <Ionicons name="close" size={18} color={IOS_REGISTER.labelSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const calloutStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    maxWidth: 360,
    minWidth: 280,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#007AFF',
  },
  openBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const shellStyles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  seriesList: {
    marginTop: 4,
  },
  seriesEmpty: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
    paddingVertical: 12,
  },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  seriesRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60, 60, 67, 0.15)',
  },
  seriesRowPressed: {
    opacity: 0.55,
  },
  seriesRowText: {
    flex: 1,
  },
  seriesRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  seriesRowWhen: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
    marginTop: 1,
  },
  seriesRowNext: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#8A4B00',
    backgroundColor: 'rgba(255, 196, 0, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  windTideScrubber: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  windTideScrubberCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  windTideScrubberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  windTideScrubberLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
  },
  windTideScrubberValue: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
    fontVariant: ['tabular-nums'],
  },
  windTideScrubberSummary: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: -2,
  },
  windTideScrubberTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -6,
  },
  windTideScrubberTick: {
    fontSize: 10,
    color: IOS_REGISTER.labelTertiary,
  },
  // --- Status bar ---------------------------------------------------------
  statusBar: {
    height: 28,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBarTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    letterSpacing: -0.2,
  },
  statusBarNotch: {
    width: 70,
    height: 18,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  statusBarRight: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  // --- Top chrome ---------------------------------------------------------
  topChromeRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.4,
  },
  subtitleRow: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  subtitleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60, 60, 67, 0.4)',
  },
  subtitle: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  topRight: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  glyphBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarToggle: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  sidebarToggleHover: {
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderColor: IOS_COLORS.opaqueSeparator,
  },
  sidebarTogglePressed: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  sidebarIcon: {
    width: 16,
    height: 12,
    flexDirection: 'row',
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.secondaryLabel,
    overflow: 'hidden',
  },
  sidebarIconLeft: {
    width: 5,
    height: '100%',
    backgroundColor: IOS_COLORS.secondaryLabel,
  },
  sidebarIconRight: {
    flex: 1,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#5856D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // --- Chip row -----------------------------------------------------------
  chipsScroll: {
    maxHeight: 36,
  },
  chipsContainer: {
    paddingLeft: 16,
    paddingRight: 148,
    paddingBottom: 6,
  },
  chipsInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chip: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
  },
  chipCompact: {
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
  },
  chipActive: {
    // Active chips use iOS system blue instead of black. In walkthroughs,
    // black read as "disabled/off" while light gray read as "selected";
    // blue is the clearer iOS affordance for "on".
    backgroundColor: '#007AFF',
  },
  chipDim: {
    opacity: 0.55,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  chipDotCompact: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  crossInterestGlyph: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 5,
  },
  crossInterestDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  chipText: {
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.78)',
    fontWeight: '500',
    letterSpacing: -0.05,
  },
  chipTextCompact: {
    fontSize: 10,
    letterSpacing: -0.08,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // --- Map area -----------------------------------------------------------
  mapArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#D9E8F0',
  },
  /**
   * Floating glass-chrome container — sits absolute over the map at the
   * top, holds TopChrome + FilterChipsRow. paddingTop accounts for the
   * iOS notch / Dynamic Island so chrome sits cleanly below status bar
   * without a SafeAreaView wrapper above the map (which would cut into
   * the edge-to-edge canvas).
   */
  floatingChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingTop: 50,
    paddingBottom: 2,
    zIndex: 10,
  },
  /**
   * Opaque variant for the Sites/Capabilities surfaces (no map behind the
   * chrome). Matches the surface background (#F2F2F7) so the floating chrome
   * reads as a solid pinned header that content scrolls cleanly under,
   * instead of a transparent overlay the by-area bars bleed through.
   */
  floatingChromeSolid: {
    backgroundColor: '#F2F2F7',
  },
  chromePlate: {
    marginHorizontal: 10,
    paddingTop: 0,
    paddingBottom: 2,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  /**
   * F1 split-chrome row: chip plate on the left (flex), action cluster on
   * the right. Replaces the unified plate that wrapped title + chips +
   * profile. Title is gone (the highlighted tab names the screen), and
   * the cluster floats as its own piece of glass so global nav (profile)
   * and contextual filters (chips) read as separate UI families.
   */
  clusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 8,
  },
  locationAnchorSlot: {
    flex: 1,
    minWidth: 0,
  },
  /**
   * Sub-chip row for affinity groups (class-fleets, cohorts, crew pods,
   * practice groups). Renders only when the user belongs to at least
   * one group relevant to the active interest.
   */
  groupSubchipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 16,
  },
  groupSubchip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.10)',
  },
  groupSubchipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  groupSubchipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  groupSubchipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.85)',
    letterSpacing: -0.05,
  },
  groupSubchipTextActive: {
    color: '#FFFFFF',
  },
  topRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    // marginLeft: 'auto' so the cluster always right-aligns regardless of
    // whether the leading slot renders. Without this, `space-between` on
    // a one-child row snaps the only child to the start, putting the
    // cluster on the left edge.
    marginLeft: 'auto',
  },
  /**
   * Consolidated top capsule — Apple-Maps style. Single floating pill
   * containing: avatar | search field | layers | bell. Replaces the
   * previous split layout (LocationAnchor pill on left + topRightCluster
   * on right). One chrome element, not four.
   */
  topCapsuleRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  topCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  capsuleInterest: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 30,
    maxWidth: 140,
    flexShrink: 1,
    minWidth: 0,
  },
  capsuleInterestDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  capsuleInterestText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(28, 28, 30, 0.86)',
    letterSpacing: -0.1,
    flexShrink: 1,
    minWidth: 0,
  },
  capsuleInterestChevron: {
    marginLeft: 3,
  },
  capsuleStepSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    maxWidth: 170,
    minWidth: 88,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    backgroundColor: 'rgba(10, 132, 255, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10, 132, 255, 0.22)',
    flexShrink: 1,
  },
  capsuleStepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0A84FF',
  },
  capsuleStepText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '700',
    color: '#0A4FB8',
    letterSpacing: 0,
  },
  capsuleSearch: {
    flex: 1,
    minWidth: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    minHeight: 30,
  },
  /**
   * Text slot used by TopChrome (F2-F7) for inline title + subtitle.
   * Sits in place of the capsuleSearch slot on F1. Flexes to fill the
   * gap between the leading avatar and trailing icons; truncates with
   * ellipsis on both lines so a long race title doesn't overflow.
   */
  topCapsuleTextSlot: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  topCapsuleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(28, 28, 30, 0.92)',
    letterSpacing: -0.15,
  },
  topCapsuleSubtitle: {
    fontSize: 10.5,
    fontWeight: '500',
    color: 'rgba(60, 60, 67, 0.65)',
    letterSpacing: -0.05,
    marginTop: 1,
  },
  capsuleSearchIcon: {
    marginRight: 6,
  },
  capsuleSearchText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.78)',
    letterSpacing: -0.1,
  },
  capsuleAction: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Accent-filled "+" — matches the Practice tab's add-step button
  // (StepTaskBar.plusbtn) so the add affordance reads the same across tabs.
  capsuleAddButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  clusterBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  absChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.22)',
  },
  absChipText: {
    fontSize: 8.5,
    color: 'rgba(60, 60, 67, 0.72)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  f2WindChip: {
    top: 132,
    right: 12,
  },
  f2TideChip: {
    top: 168,
    right: 12,
  },
  f2LegendCard: {
    position: 'absolute',
    top: 132,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.16)',
    gap: 6,
    zIndex: 12,
  },
  f2LegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  f2LegendText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(28, 28, 30, 0.78)',
    letterSpacing: -0.1,
  },
  f2LegendSquare: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: '#E07A3C',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  f2LegendDotCrew: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF3B30',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  f2LegendDotFleet: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: 'rgba(40, 50, 70, 0.85)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  zoomIndicator: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  zoomText: {
    fontSize: 8.5,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  fabColumn: {
    position: 'absolute',
    right: 10,
    bottom: 14,
    alignItems: 'center',
    gap: 8,
    // Above the bottom step cockpit (windTideScrubber, zIndex 10) so the
    // capture + FAB floats over the card instead of being clipped behind it;
    // still below search/layers overlays (zIndex 40+).
    zIndex: 12,
  },
  fab: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  fabActive: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  // Larger, solid-blue + button so the compose-at-location entry point is
  // obvious. Sits below the layers/locate icons in the FAB column.
  fabDropPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_REGISTER.accentUserAction,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  commitBannerInline: {
    position: 'absolute',
    // Pushed down so the banner clears the Dynamic Island + status bar
    // + floating TopChrome + chip rail. Previously top: 12 placed it
    // directly under the iPhone notch where it looked like an iOS Live
    // Activity indicator and ate the location-pin glyph.
    top: 150,
    alignSelf: 'center',
    backgroundColor: IOS_REGISTER.accentUserAction,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  commitBannerInlineText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  commitBannerCancel: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  // --- Layers sheet -------------------------------------------------------
  layersBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    zIndex: 40,
  },
  layersSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    zIndex: 41,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
  },
  layersHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.fillPill,
    marginBottom: 8,
  },
  layersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  layersTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.4,
  },
  basemapSection: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
    marginBottom: 2,
  },
  basemapLabel: {
    marginBottom: 7,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  basemapSegmented: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 9,
    backgroundColor: IOS_REGISTER.fillPill,
    gap: 2,
  },
  basemapSegment: {
    flex: 1,
    minHeight: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  basemapSegmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  basemapSegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  basemapSegmentTextActive: {
    color: IOS_REGISTER.label,
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
    gap: 12,
  },
  layerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  layerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  layerSub: {
    marginTop: 1,
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  layerLockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  layerLockText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: 'rgba(60, 60, 67, 0.62)',
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  layersAttribution: {
    marginTop: 14,
    fontSize: 10,
    color: 'rgba(60, 60, 67, 0.55)',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  manageAreasBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
  },
  manageAreasText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  chipContextPill: {
    alignSelf: 'center',
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.18)',
  },
  f4ChipsRow: {
    marginTop: 12,
  },
  f4Segment: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 8,
    padding: 2,
    borderRadius: 9,
    // Opaque-ish backing + shadow so the control stays legible floating
    // over the map (the translucent grey washed out against chart tiles).
    backgroundColor: 'rgba(216, 216, 222, 0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  f4SegmentItem: {
    paddingVertical: 5,
    paddingHorizontal: 22,
    borderRadius: 7,
  },
  f4SegmentItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  f4SegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.78)',
    letterSpacing: -0.1,
  },
  f4SegmentTextActive: {
    color: '#000000',
  },
  offlinePill: {
    position: 'absolute',
    top: 138,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    zIndex: 20,
  },
  offlinePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  routeHintChip: {
    position: 'absolute',
    top: 138,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.18)',
    zIndex: 20,
  },
  routeHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.85)',
    letterSpacing: -0.1,
  },
  demoLanguageToggle: {
    position: 'absolute',
    top: 174,
    left: 12,
    zIndex: 22,
    flexDirection: 'row',
    gap: 2,
    padding: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  demoLanguageButton: {
    minWidth: 32,
    minHeight: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  demoLanguageButtonActive: {
    backgroundColor: '#4338CA',
  },
  demoLanguageText: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(60,60,67,0.70)',
    letterSpacing: 0.3,
  },
  demoLanguageTextActive: {
    color: '#FFFFFF',
  },
  livelihoodSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxHeight: '62%',
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.20)',
    padding: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  livelihoodHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  livelihoodEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#C2410C',
  },
  livelihoodTitle: {
    marginTop: 3,
    fontSize: 19,
    fontWeight: '800',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  livelihoodScroll: {
    marginTop: 8,
  },
  livelihoodScrollContent: {
    paddingBottom: 2,
  },
  roundClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 105, 80, 0.12)',
  },
  livelihoodMuted: {
    marginTop: 10,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
  },
  haatPicker: {
    marginTop: 12,
    marginBottom: 10,
  },
  haatChoice: {
    minWidth: 104,
    marginRight: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F4EBDD',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.16)',
  },
  haatChoiceActive: {
    backgroundColor: '#E8F4E8',
    borderColor: 'rgba(21, 148, 71, 0.34)',
  },
  haatChoiceText: {
    fontSize: 12,
    fontWeight: '800',
    color: IOS_REGISTER.label,
  },
  haatChoiceTextActive: {
    color: '#157F3B',
  },
  haatChoiceSub: {
    marginTop: 2,
    fontSize: 10.5,
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '600',
  },
  voiceCaptureCard: {
    marginTop: 4,
    marginBottom: 10,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.18)',
    padding: 10,
  },
  voiceMic: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CC3A0A',
    shadowColor: '#CC3A0A',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  voiceTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#7C2D12',
  },
  voiceInput: {
    marginTop: 2,
    padding: 0,
    fontSize: 13,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  voiceApply: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4E8',
  },
  productChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 10,
  },
  productChip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F4EBDD',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.12)',
  },
  productChipActive: {
    backgroundColor: '#E8F4E8',
    borderColor: 'rgba(21, 148, 71, 0.34)',
  },
  productChipText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: IOS_REGISTER.labelSecondary,
  },
  productChipTextActive: {
    color: '#157F3B',
  },
  livelihoodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  ledgerField: {
    flexGrow: 1,
    flexBasis: '46%',
  },
  ledgerFieldCompact: {
    flexGrow: 1,
    flexBasis: 88,
  },
  ledgerFieldLabel: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '700',
    marginBottom: 4,
  },
  ledgerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.22)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
  },
  ledgerPrefix: {
    fontSize: 14,
    fontWeight: '800',
    color: IOS_REGISTER.label,
    marginRight: 3,
  },
  ledgerInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    padding: 0,
  },
  ledgerSuffix: {
    marginLeft: 3,
    fontSize: 10,
    fontWeight: '800',
    color: IOS_REGISTER.labelTertiary,
  },
  paymentRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentToggle: {
    minWidth: 68,
    minHeight: 34,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F4EBDD',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.16)',
  },
  paymentToggleActive: {
    backgroundColor: '#E8F4E8',
    borderColor: 'rgba(21, 148, 71, 0.34)',
  },
  paymentToggleText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: IOS_REGISTER.labelSecondary,
  },
  paymentToggleTextActive: {
    color: '#157F3B',
  },
  totalPill: {
    marginLeft: 'auto',
    minWidth: 92,
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#EAF5EA',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  totalPillLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#157F3B',
  },
  totalPillValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#157F3B',
  },
  closeoutStrip: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#F8F3EA',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.16)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
  },
  closeoutLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#7C2D12',
  },
  closeoutValue: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '900',
    color: '#157F3B',
  },
  noteInput: {
    minHeight: 54,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.22)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 12.5,
    color: IOS_REGISTER.label,
    textAlignVertical: 'top',
  },
  capabilityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  capabilityChip: {
    borderRadius: 999,
    backgroundColor: '#F4EBDD',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  capabilityChipActive: {
    backgroundColor: '#DFF2E3',
  },
  capabilityChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: IOS_REGISTER.labelSecondary,
  },
  capabilityChipTextActive: {
    color: '#157F3B',
  },
  livelihoodError: {
    marginTop: 8,
    fontSize: 12,
    color: '#B91C1C',
  },
  livelihoodPrimary: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CC3A0A',
  },
  livelihoodPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  healthHero: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.16)',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  healthRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 8,
    borderColor: '#159447',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F3EA',
  },
  healthRingValue: {
    fontSize: 18,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  healthRingSub: {
    fontSize: 9,
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '700',
  },
  healthHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: IOS_REGISTER.label,
  },
  healthHeroBody: {
    marginTop: 3,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
  },
  cashBookTiles: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  cashBookTile: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124, 82, 39, 0.12)',
  },
  cashBookLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: IOS_REGISTER.labelSecondary,
  },
  cashBookValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '900',
  },
  healthSectionLabel: {
    marginTop: 14,
    marginBottom: 4,
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.7,
    color: IOS_REGISTER.labelTertiary,
    textTransform: 'uppercase',
  },
  capRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(124, 82, 39, 0.14)',
  },
  capDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  capTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: IOS_REGISTER.label,
  },
  capSub: {
    marginTop: 1,
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
  },
  capStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: IOS_REGISTER.labelTertiary,
  },
  gapRouteCard: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217, 119, 6, 0.28)',
  },
  gapRouteKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    color: '#B45309',
  },
  gapRouteTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#7C2D12',
  },
  gapRouteBody: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#9A3412',
  },
  mentorMap: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E7D8BF',
    overflow: 'hidden',
  },
  mentorField: {
    position: 'absolute',
    borderRadius: 80,
    backgroundColor: '#D9E3C2',
    opacity: 0.9,
  },
  mentorFieldDark: {
    position: 'absolute',
    borderRadius: 80,
    backgroundColor: '#CBD8AE',
    opacity: 0.85,
  },
  mentorRoad: {
    position: 'absolute',
    height: 7,
    backgroundColor: '#EFE3CC',
    borderRadius: 4,
  },
  mentorMapVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 247, 237, 0.18)',
  },
  mentorSegmentRow: {
    marginHorizontal: 10,
    marginTop: 2,
    padding: 3,
    flexDirection: 'row',
    borderRadius: 11,
    backgroundColor: 'rgba(67, 56, 202, 0.13)',
    gap: 3,
  },
  mentorSegment: {
    flex: 1,
    minHeight: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorSegmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  mentorSegmentText: {
    fontSize: 12,
    fontWeight: '800',
    color: IOS_REGISTER.labelSecondary,
  },
  mentorSegmentTextActive: {
    color: IOS_REGISTER.label,
  },
  mentorBase: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -45 }, { translateY: -38 }],
    alignItems: 'center',
  },
  mentorBaseIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#4338CA',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  mentorBaseLabel: {
    marginTop: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    color: '#2A2118',
  },
  mentorVillage: {
    position: 'absolute',
    width: 104,
    alignItems: 'center',
    transform: [{ translateX: -52 }, { translateY: -26 }],
  },
  mentorVillageMarker: {
    minWidth: 48,
    height: 46,
    paddingHorizontal: 8,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },
  mentorVillageMarkerAlert: {
    borderColor: '#D97706',
    shadowColor: '#D97706',
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  mentorVillageCount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#2A2118',
  },
  mentorVillageName: {
    marginTop: 5,
    fontSize: 10.5,
    fontWeight: '900',
    color: '#3A2C1A',
    textAlign: 'center',
  },
  mentorDots: {
    marginTop: 3,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
    maxWidth: 72,
  },
  mentorStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  mentorLegend: {
    position: 'absolute',
    left: 12,
    bottom: 250,
    zIndex: 22,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 253, 248, 0.94)',
    gap: 3,
  },
  mentorLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mentorLegendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  mentorLegendText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4A3D2C',
  },
  mentorSelectedChip: {
    position: 'absolute',
    right: 12,
    bottom: 250,
    width: 178,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 253, 248, 0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(80,60,40,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  mentorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  mentorSelectedName: {
    fontSize: 12,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorSelectedSub: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
  },
  mentorHero: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 74,
    zIndex: 30,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFFDF8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(80,60,40,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  mentorHeroKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mentorHeroKicker: {
    flex: 1,
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: '#B45309',
    textTransform: 'uppercase',
  },
  mentorHeroTitle: {
    marginTop: 5,
    fontSize: 19,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorHeroPeople: {
    marginTop: 11,
    flexDirection: 'row',
    gap: 8,
  },
  mentorHeroPerson: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#EFE6D3',
    padding: 8,
  },
  mentorHeroAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorHeroName: {
    fontSize: 12,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorHeroReason: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '800',
    color: '#B45309',
  },
  mentorHeroButtons: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 9,
  },
  mentorHeroPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4338CA',
  },
  mentorHeroPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  mentorHeroSecondary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(67,56,202,0.10)',
  },
  mentorHeroSecondaryText: {
    color: '#4338CA',
    fontSize: 13,
    fontWeight: '900',
  },
  mentorSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxHeight: '76%',
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#FFFDF8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(80,60,40,0.14)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  mentorEyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.7,
    color: '#4338CA',
    textTransform: 'uppercase',
  },
  mentorFilterRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 7,
  },
  mentorFilterChip: {
    overflow: 'hidden',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EFE6D3',
    color: IOS_REGISTER.labelSecondary,
    fontSize: 11,
    fontWeight: '900',
  },
  mentorFilterChipActive: {
    backgroundColor: '#D97706',
    color: '#FFFFFF',
  },
  mentorQueueList: {
    marginTop: 8,
  },
  mentorQueueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(80,60,40,0.12)',
  },
  mentorQueueAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorAvatarStatus: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  mentorQueueName: {
    fontSize: 14,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorQueueSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
  },
  mentorQueueStatus: {
    marginTop: 3,
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
  },
  mentorNudgeCard: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 11,
    padding: 8,
    backgroundColor: '#FFF4E6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,119,6,0.30)',
  },
  mentorNudgeText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: '#9A3412',
  },
  mentorNudgeButton: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#4338CA',
  },
  mentorNudgeButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  mentorQueueDistance: {
    width: 42,
    textAlign: 'right',
    fontSize: 10.5,
    fontWeight: '900',
    color: IOS_REGISTER.labelSecondary,
  },
  mentorCohortHero: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(80,60,40,0.12)',
  },
  mentorCohortRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 9,
    borderColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F3EA',
  },
  mentorCohortRingValue: {
    fontSize: 18,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorCohortRingSub: {
    fontSize: 10,
    fontWeight: '800',
    color: IOS_REGISTER.labelSecondary,
  },
  mentorCohortTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorCohortBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: IOS_REGISTER.labelSecondary,
  },
  mentorSchemeRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  mentorSchemeNameWrap: {
    width: 92,
  },
  mentorSchemeName: {
    fontSize: 12,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorSchemeType: {
    fontSize: 9.5,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
  },
  mentorSchemeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(120,90,50,0.15)',
  },
  mentorSchemeFill: {
    height: '100%',
    borderRadius: 4,
  },
  mentorSchemePct: {
    width: 36,
    textAlign: 'right',
    fontSize: 11.5,
    fontWeight: '900',
    color: '#4338CA',
  },
  mentorCoverageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mentorCoverageCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 86,
    borderRadius: 12,
    padding: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(80,60,40,0.12)',
  },
  mentorCoverageGood: {
    backgroundColor: 'rgba(21,128,61,0.10)',
  },
  mentorCoverageMid: {
    backgroundColor: 'rgba(217,119,6,0.12)',
  },
  mentorCoverageLow: {
    backgroundColor: 'rgba(154,123,82,0.12)',
  },
  mentorCoverageName: {
    fontSize: 11.5,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorCoverageSub: {
    marginTop: 2,
    fontSize: 9.5,
    fontWeight: '800',
    color: IOS_REGISTER.labelSecondary,
  },
  mentorCoveragePct: {
    marginTop: 6,
    fontSize: 10.5,
    fontWeight: '900',
    color: '#15803D',
  },
  mentorVisitSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxHeight: '70%',
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#FFFDF8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(80,60,40,0.14)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  mentorVisitHead: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  mentorVisitTitle: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorVisitSub: {
    marginTop: 1,
    fontSize: 11.5,
    color: IOS_REGISTER.labelSecondary,
  },
  mentorGapRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  mentorGapCard: {
    flex: 1,
    borderRadius: 12,
    padding: 9,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(80,60,40,0.12)',
  },
  mentorGapOk: {
    backgroundColor: 'rgba(21,128,61,0.10)',
  },
  mentorGapWeak: {
    backgroundColor: 'rgba(217,119,6,0.12)',
  },
  mentorGapIcon: {
    fontSize: 16,
  },
  mentorGapTitle: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorGapStatus: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '900',
  },
  mentorPlanCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 13,
    backgroundColor: 'rgba(67,56,202,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(67,56,202,0.28)',
  },
  mentorPlanKicker: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: '#4338CA',
    textTransform: 'uppercase',
  },
  mentorPlanTitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
    color: '#312E81',
  },
  mentorPlanBody: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    color: '#3730A3',
  },
  mentorAssignedStep: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  mentorAssignedIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(194,65,12,0.10)',
  },
  mentorAssignedTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorAssignedSub: {
    marginTop: 1,
    fontSize: 10.5,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
  },
  mentorLogVisitRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#EFE6D3',
  },
  mentorLogVisitIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(67,56,202,0.10)',
  },
  mentorLogVisitTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: IOS_REGISTER.label,
  },
  mentorLogVisitSub: {
    marginTop: 2,
    fontSize: 10.5,
    lineHeight: 14,
    color: IOS_REGISTER.labelSecondary,
  },
  mentorDataBadge: {
    position: 'absolute',
    top: 148,
    alignSelf: 'center',
    zIndex: 50,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(67,56,202,0.92)',
  },
  mentorDataBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  f2ScrubWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_REGISTER.separator,
  },
  f2ScrubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  f2ScrubHeaderLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(60, 60, 67, 0.62)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  f2ScrubHeaderValue: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },
  f2ScrubTicks: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  f2ScrubTickText: {
    fontSize: 10,
    color: 'rgba(60, 60, 67, 0.62)',
    letterSpacing: -0.1,
  },
  f2ScrubMetrics: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  f2SheetLegend: {
    marginTop: 10,
    gap: 6,
  },
  f2SheetLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  f2SheetLegendText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.82)',
    lineHeight: 15,
    letterSpacing: -0.1,
  },
  chipContextPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(28, 28, 30, 0.78)',
    letterSpacing: -0.1,
  },
  heatmapLegendCard: {
    position: 'absolute',
    top: 126,
    alignSelf: 'center',
    width: 242,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.16)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 24,
  },
  heatmapLegendTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
    marginBottom: 6,
  },
  heatmapLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heatmapLegendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.18)',
  },
  heatmapLegendText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  layerToggle: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: IOS_REGISTER.fillPill,
    justifyContent: 'center',
    padding: 2,
  },
  layerToggleOn: {
    backgroundColor: '#34C759',
  },
  layerToggleLocked: {
    opacity: 0.5,
  },
  layerToggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  layerToggleKnobOn: {
    alignSelf: 'flex-end',
  },
  // --- Bottom sheet -------------------------------------------------------
  bottomSheet: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: '#FFFFFF',
  },
  edgeSheetTabWrap: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    zIndex: 12,
    alignItems: 'flex-start',
  },
  edgeSheetTab: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  edgeSheetTabPressed: {
    opacity: 0.72,
  },
  // Row layout lives on this inner View — function-form Pressable styles
  // silently strip flexDirection (see feedback_pressable_margin_row_stripping).
  edgeSheetTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: 200,
  },
  edgeSheetTabAccent: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  edgeSheetTabText: {
    flexShrink: 1,
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.label,
    textTransform: 'uppercase',
  },
  edgeSheetTabCount: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
  },
  sheetScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  sheetHandleHit: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60, 60, 67, 0.28)',
  },
  sheetTopStrip: {
    marginHorizontal: -16,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sheetHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  sheetHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetCollapseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
  },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    color: '#D2691E',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  peerName: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  peerQuote: {
    fontWeight: '400',
    fontStyle: 'italic',
    color: IOS_REGISTER.labelSecondary,
  },
  peerEyebrow: {
    marginTop: 2,
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  sheetBody: {
    marginTop: 3,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 16,
    letterSpacing: -0.05,
  },
  sheetSource: {
    marginTop: 4,
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
    letterSpacing: -0.05,
  },
  sheetSourceLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  peerListWrap: {
    marginTop: 8,
    gap: 8,
  },
  stepsHereWrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  stepsHereLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelTertiary,
  },
  peerListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  peerListDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  peerListName: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  peerListMeta: {
    marginLeft: 'auto',
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.05,
  },
  peerListMore: {
    marginTop: 2,
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
    letterSpacing: -0.05,
  },
  peerListChevron: {
    marginLeft: -2,
  },
  statsRow: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'column',
  },
  statValue: {
    fontFamily: fontFamily.mono,
    fontSize: 18,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 8.5,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  btnRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnPrimary: {
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  btnTall: {
    height: 46,
  },
  btnPrimaryTextCol: {
    alignItems: 'center',
    flexShrink: 1,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  btnPrimarySubtext: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  btnSecondary: {
    backgroundColor: IOS_REGISTER.fillPill,
  },
  btnSecondaryText: {
    color: IOS_REGISTER.label,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  // --- Tab bar mock -------------------------------------------------------
  tabBar: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 9,
    color: 'rgba(60, 60, 67, 0.55)',
    fontWeight: '500',
  },
  // --- Commit-mode (F6) ---------------------------------------------------
  commitHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commitTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.3,
  },
  commitHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commitBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commitBannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    letterSpacing: -0.05,
    lineHeight: 16,
  },
  spotChipStrip: {
    flexGrow: 0,
    marginBottom: 8,
  },
  spotChipRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    maxWidth: 220,
  },
  spotChipSelected: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  spotChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  spotChipTextSelected: {
    color: '#FFFFFF',
  },
  commitSheet: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: '#FFFFFF',
  },
  commitSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commitSheetEyebrow: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  commitSheetCoords: {
    marginTop: 3,
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
});
