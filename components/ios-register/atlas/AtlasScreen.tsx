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

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useAuth } from '@/providers/AuthProvider';
import { useWebDrawer } from '@/providers/WebDrawerProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  HongKongOverviewMap,
  RaceMarksZoomMap,
  WorldDragonMap,
  BaltimoreColdMap,
  JhuCuratedMap,
  CommitHarbourMap,
} from './AtlasMaps';
import {
  AtlasMapLibreCanvas,
  type AtlasBasemap,
  type AtlasPinSpec,
  type AtlasRacingAreaPressTarget,
} from './AtlasMapLibreCanvas';
import { CreateRacingAreaSheet } from './CreateRacingAreaSheet';
import { CreateRaceCourseSheet } from './CreateRaceCourseSheet';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';
import { NotificationBell } from '@/components/social/NotificationBell';
import { AtlasSearchSheet, type AtlasSearchResult } from './AtlasSearchSheet';
import { supabase } from '@/services/supabase';
import { OpenStepPicker } from './OpenStepPicker';
import { ManageRacingAreasSheet, type ManageAreasEditTarget } from './ManageRacingAreasSheet';
import type { EditingRacingArea } from './CreateRacingAreaSheet';
import { RepositionAreaBanner } from './RepositionAreaBanner';
import { RetraceAreaBanner } from './RetraceAreaBanner';
import { useUpdateRacingArea } from '@/hooks/useUpdateRacingArea';
import { useUpdateStepLocation } from '@/hooks/useUpdateStepLocation';
import { useAtlasRacingAreas } from '@/hooks/useAtlasRacingAreas';
import { findRacingAreaAtPoint } from '@/lib/atlas-racing-area-hit-test';
import { shapeToPolygon } from '@/lib/atlas-racing-area-shape';
import type { PickerStep } from '@/hooks/useUserAtlasSteps';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useInterest } from '@/providers/InterestProvider';
import { InterestSwitcher, openInterestSwitcher } from '@/components/InterestSwitcher';
import { useUniversalPlus } from '@/components/capture';
import { useUserAffinityGroups, affinityGroupTone, type UserAffinityGroup } from '@/hooks/useUserAffinityGroups';
import { useAffinityGroupMembers } from '@/hooks/useAffinityGroupMembers';
import { useAtlasFramePins } from '@/hooks/useAtlasFramePins';
import { useNearestPlace, formatNearLabel } from '@/hooks/useNearestPlace';
import { useMarineSnapshot, conditionsLineFor } from '@/hooks/useMarineSnapshot';
import { useHKOObservations, isInHongKong } from '@/hooks/useHKOObservations';
import { useWindOverlay } from '@/hooks/useWindOverlay';
import { useTideOverlay } from '@/hooks/useTideOverlay';
import { useWaveOverlay } from '@/hooks/useWaveOverlay';
import { useNextRaceMarks } from '@/hooks/useNextRaceMarks';
import { useWalkTimeAnnotations } from '@/hooks/useWalkTimeAnnotations';
import { useCohortHeatmap } from '@/hooks/useCohortHeatmap';
import { useCompetencyGlow } from '@/hooks/useCompetencyGlow';
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

export type AtlasFrameId = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7';

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
  /** Venue/area snippet, e.g. "Victoria Harbour, favoured end".
   *  Used in the bottom-sheet body — verbose is fine here. */
  where?: string;
  /** Short wind/tide snippet for the amber map tag, e.g. "12kn ESE · ebb 0.4kn".
   *  Kept terse to fit the small overlay; if absent the tag shows only
   *  the eyebrow line. */
  conditions?: string;
  /**
   * Polymorphic event reference — when set, downstream surfaces can
   * auto-link a new Step to this Event (target_event_kind/id). The
   * Atlas amber NEXT tag also uses the source row's venue coords for
   * geographic anchoring.
   */
  event_kind?: 'regatta' | 'race_event' | 'tournament' | 'competition' | 'market_day' | 'pitch';
  event_id?: string;
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
    metadata?: Record<string, unknown>;
  }) => void;
  /** Bottom-sheet secondary CTA — "Open <next event>" / "Skip" etc. */
  onSecondaryAction?: () => void;
  /** Open an existing timeline step surfaced as a my-step-* atlas pin. */
  onStepPress?: (stepId: string) => void;
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
  onSecondaryAction,
  onStepPress,
  onAvatarPress,
  onOrgPress,
  onOrgLensPress,
  focusOrgSlug,
  subtitleOverride,
  nextEvent,
  avatarInitial,
  initialFocus,
  useMapLibre = false,
  initialCommitMode = false,
  bottomSheetOffset = 0,
}: AtlasScreenProps) {
  const handlers: AtlasFrameHandlers & {
    avatarInitial?: string;
    useMapLibre?: boolean;
    bottomSheetOffset?: number;
  } = {
    onPrimaryAction,
    onSecondaryAction,
    onStepPress,
    onAvatarPress,
    onOrgPress,
    onOrgLensPress,
    focusOrgSlug,
    subtitleOverride,
    nextEvent,
    avatarInitial,
    initialFocus,
    useMapLibre,
    initialCommitMode,
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
  }
}

/**
 * Pin kinds that bypass chip-driven filtering — anchor pins are map
 * chrome (your-base markers), institutions are persistent geography,
 * viewer's own steps belong to the user regardless of filter state.
 * Faculty/Following chips should never hide these.
 */
const ALWAYS_VISIBLE_KINDS: Set<AtlasPinSpec['kind']> = new Set([
  'poi-sim-anchor',
  'poi-club-anchor',
  'poi-home-anchor',
  'poi-hospital',
  'poi-club',
  'my-step-next',
  'my-step-planned',
  'my-step-done-just',
  'my-step-done-recent',
  'my-step-done-old',
]);

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
  onLayersPress,
  onSearchPress,
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
  onLayersPress?: () => void;
  /**
   * Optional search glyph — restored for F7 per design. Off on F1 by
   * default. Frames opt in by passing a handler.
   */
  onSearchPress?: () => void;
  /** Unused — kept for callsite compat; ProfileDropdown owns its own tap. */
  onAvatarPress?: () => void;
}) {
  const { isDrawerOpen, openDrawer } = useWebDrawer();
  const showWebSidebarToggle =
    Platform.OS === 'web' && FEATURE_FLAGS.USE_WEB_SIDEBAR_LAYOUT && !isDrawerOpen;
  const { currentInterest } = useInterest();
  const universalPlus = useUniversalPlus();

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
              style={shellStyles.capsuleAction}
              hitSlop={6}
              onPress={universalPlus.open}
              accessibilityLabel="Add"
            >
              <Ionicons name="add" size={18} color="rgba(60, 60, 67, 0.85)" />
            </Pressable>
          ) : null}
          <View style={shellStyles.capsuleAction}>
            <NotificationBell size={16} color="rgba(60, 60, 67, 0.85)" />
          </View>
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

  React.useEffect(() => {
    onActiveIdsChange?.(activeIds);
  }, [activeIds, onActiveIdsChange]);

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
  dim,
  crossInterest,
  compact,
  onPress,
}: FilterChipItem & { compact?: boolean; onPress?: () => void }) {
  const toneDot: Record<string, string> = {
    you: '#FF3B30',
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
      {tone && !crossInterest ? (
        <View
          style={[
            shellStyles.chipDot,
            compact && shellStyles.chipDotCompact,
            { backgroundColor: toneDot[tone] },
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
  onLocatePress,
  commitMode,
  bottomOffset = 0,
  showLocate = true,
}: {
  onLayersPress?: () => void;
  onDropPinPress?: () => void;
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
  | 'institution.curated_sites';

interface LayerItem {
  key: AtlasLayerKey;
  label: string;
  sub?: string;
  defaultOn: boolean;
  locked?: boolean;
}

function getLayersForFrame(frame: AtlasFrameId): LayerItem[] {
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
      { key: 'sailing.wind', label: 'Wind forecast', sub: 'Direction + speed for next race day', defaultOn: true },
      { key: 'sailing.tide', label: 'Tidal current', sub: 'Set + drift around the course', defaultOn: true },
      { key: 'sailing.waves', label: 'Swell', sub: 'Wave direction + height', defaultOn: true },
      { key: 'sailing.race_areas', label: 'Race areas', sub: 'Highlighted racing zones', defaultOn: true },
      { key: 'sailing.course', label: 'Race course', sub: 'Marks, laylines, start box · zoom ≥ 13', defaultOn: true },
      { key: 'sailing.race_marks', label: 'Race marks', sub: 'Visible at zoom ≥ 14', defaultOn: false },
      { key: 'sailing.marinas', label: 'Marinas & clubs', sub: 'Sailing venues nearby', defaultOn: true },
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

  if (frame === 'f4') {
    return [
      { key: 'core.healthcare_pois', label: 'Healthcare sites', sub: 'Site-level floor — cannot sharpen', defaultOn: true, locked: true },
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
   * Lift the sheet above the floating tab bar so the last layer row + the
   * attribution footer aren't hidden under it. Same pattern as the
   * BottomSheet's bottomOffset prop.
   */
  bottomOffset?: number;
}) {
  const layers = getLayersForFrame(frame);
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
    // Only the sailing condition overlays are parent-controlled from the
    // chip rail. Clear those first, then reapply the parent's current on-set.
    // Uncontrolled layers like "Peer steps" and "My steps" keep their own
    // internal state instead of being dimmed just because they're absent
    // from controlledActiveKeys.
    for (const key of ['sailing.race_marks', 'sailing.wind', 'sailing.tide'] as const) {
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
              {([
                ['map', 'Map'],
                ['satellite', 'Satellite'],
                ['nautical', 'Nautical'],
              ] as const).map(([value, label]) => {
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

function isUserStepPin(pin: AtlasPinSpec): boolean {
  return (
    pin.kind === 'my-step-next' ||
    pin.kind === 'my-step-planned' ||
    pin.kind === 'my-step-done-just' ||
    pin.kind === 'my-step-done-recent' ||
    pin.kind === 'my-step-done-old'
  );
}

function titleForUserStepPin(pin: AtlasPinSpec): string {
  return (pin.label ?? 'Step').split('|')[0]?.trim() || 'Step';
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

function formatConditionsSummary(label: string, line: string | null | undefined): string | null {
  if (!line) return null;
  const [directionRaw, speedRaw] = line.split('|');
  const direction = Number(directionRaw);
  const speed = Number(speedRaw);
  if (!Number.isFinite(direction) || !Number.isFinite(speed)) return null;
  return `${label} ${Math.round(direction)}° ${speed.toFixed(1)} kn`;
}

// ---------------------------------------------------------------------------
// F1 — Felix · first-run · Causeway Bay overview
// ---------------------------------------------------------------------------
function FrameF1({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const next = handlers.nextEvent;
  const hasNext = Boolean(next?.label);
  const insets = useSafeAreaInsets();
  const homeVenue = useUserHomeVenue();
  const { getCurrentLocation } = useCurrentLocation();
  const { currentInterest } = useInterest();
  const universalPlus = useUniversalPlus();
  const { groups: userGroups } = useUserAffinityGroups('sail-racing');
  const [activeGroupIds, setActiveGroupIds] = useState<string[]>([]);
  const toggleGroupChip = useCallback((groupId: string) => {
    setActiveGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  }, []);
  const [layersOpen, setLayersOpen] = useState(false);
  const [manageAreasOpen, setManageAreasOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<EditingRacingArea | null>(null);
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
  const updateRacingAreaMutation = useUpdateRacingArea();
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
      router.push(`/sailor/${result.userId}` as never);
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
      // Groups don't have a dedicated route yet — pass through the
      // groupId as a query param to a generic surface. v2 lands a
      // proper /group/[id] page.
      router.push(`/discover?group=${result.groupId}` as never);
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
  const [showMarinas, setShowMarinas] = useState(true);
  const [showSailServices, setShowSailServices] = useState(false);
  const [showWind, setShowWind] = useState(true);
  const [showTide, setShowTide] = useState(true);
  const [showWaves, setShowWaves] = useState(true);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [showRaceAreas, setShowRaceAreas] = useState(true);
  const [showCourse, setShowCourse] = useState(true);
  const [basemap, setBasemap] = useState<AtlasBasemap>('map');
  const [peerRelationshipFilter, setPeerRelationshipFilter] = useState<Set<string> | null>(null);
  // Institution POIs + peer step pins for the "near me" bbox. Center on the
  // user's home venue and query their active interest; fall back to the
  // Causeway Bay demo centroid (22.295, 114.18 = F1 camera preset, see
  // AtlasMapLibreCanvas.FRAME_CAMERA) only when no home venue is set.
  const restrictPeersToUserIds = useAffinityGroupMembers(activeGroupIds);
  const { pins: framePins, pickerSteps } = useAtlasFramePins({
    lat: homeVenue?.lat ?? 22.295,
    lng: homeVenue?.lng ?? 114.18,
    interestSlug: currentInterest?.slug ?? 'sail-racing',
    radiusKm: 20,
    showMarinas,
    showSailServices,
    restrictPeersToUserIds,
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
  // Auto-center on the viewer's next step the first time it appears.
  // The point of Atlas is "show me where I'm going" — landing on the
  // bbox centroid is a useless default when we already know which
  // pin matters most. Fires once per session per next-step id so
  // panning away doesn't snap back.
  const autoCenteredNextStepIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!myNextStepPin) return;
    const id = myNextStepPin.stepId ?? myNextStepPin.id ?? null;
    if (!id) return;
    if (autoCenteredNextStepIdRef.current === id) return;
    autoCenteredNextStepIdRef.current = id;
    setSearchFocus({ lat: myNextStepPin.lat, lng: myNextStepPin.lng });
  }, [myNextStepPin]);
  // No upcoming step to anchor on? Center on the viewer's home venue once
  // so Atlas opens where they actually are, not the Causeway Bay demo
  // centroid baked into the F1 camera preset. One-shot so panning away
  // doesn't snap back; the next-step effect above takes precedence.
  const autoCenteredHomeRef = React.useRef(false);
  React.useEffect(() => {
    if (autoCenteredHomeRef.current) return;
    if (myNextStepPin) return;
    if (homeVenue?.lat == null || homeVenue?.lng == null) return;
    autoCenteredHomeRef.current = true;
    setSearchFocus({ lat: homeVenue.lat, lng: homeVenue.lng });
  }, [myNextStepPin, homeVenue]);
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
  React.useEffect(() => {
    if (focusedClubPin) setSelectedPin(focusedClubPin);
  }, [focusedClubPin]);
  const handlePinPress = useCallback((pin: AtlasPinSpec) => {
    // Auto-close the Layers sheet when a pin is tapped so the detail
    // sheet doesn't render inside / behind the Layers panel.
    setLayersOpen(false);
    setSelectedPin(pin);
  }, []);
  const clearSelectedPin = useCallback(() => setSelectedPin(null), []);
  const [openStepPickerVisible, setOpenStepPickerVisible] = useState(false);
  // Tap-to-anchor flow: when the user picks a step without a place,
  // we enter "tap the map to anchor STEP here" mode. Reuses the same
  // banner/save-bar plumbing as racing-area reposition, just writing
  // to timeline_steps.location_lat/lng instead of venue_racing_areas.
  const [anchorStepTarget, setAnchorStepTarget] = useState<{
    stepId: string;
    title: string;
    newLat: number | null;
    newLng: number | null;
  } | null>(null);
  const updateStepLocationMutation = useUpdateStepLocation();
  const handlePickStepFromPicker = useCallback(
    (step: PickerStep) => {
      setOpenStepPickerVisible(false);
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
          setSelectedPin(matchingPin);
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
    // clear any active pin sheet AND exit commit-mode so the PIN DROPPED
    // card doesn't stack under the Layers panel.
    setSelectedPin(null);
    setCommitMode(false);
    setCandidate(null);
    setLayersOpen(true);
  }, []);
  // Collapsed-filter pill state. Sailors come to Atlas to scout the next
  // race, not to toggle social filters — so chips default to hidden behind
  // a small pill that reflects the active filter when expanded.
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>(['all']);
  const handleChipsChange = useCallback((activeIds: string[]) => {
    setActiveFilterIds(activeIds);
    const all = activeIds.includes('all');
    setShowRaceMarks(all || activeIds.includes('race-marks'));
    // Peer filter is null when "All" is active (show everything),
    // otherwise the active relationship chips form an allow-list.
    const peerChips = activeIds.filter((id) =>
      ['you', 'crew', 'fleet', 'following'].includes(id),
    );
    setPeerRelationshipFilter(all || peerChips.length === 0 ? null : new Set(peerChips));
  }, []);
  const filterPillLabel = useMemo(() => {
    if (activeFilterIds.length === 0 || activeFilterIds.includes('all')) return 'Filter';
    const map: Record<string, string> = { you: 'You', crew: 'Crew', fleet: 'Fleet', following: 'Following' };
    if (activeFilterIds.length === 1) {
      const single = map[activeFilterIds[0]];
      return single ? `Filter · ${single}` : 'Filter · Custom';
    }
    return `Filter · ${activeFilterIds.length}`;
  }, [activeFilterIds]);
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
  const { data: marineSnapshot } = useMarineSnapshot({
    lat: mapCenter.lat,
    lng: mapCenter.lng,
    enabled: showWind || showTide || showWaves,
  });
  const { user: authUser } = useAuth();
  // Racing-area feature collection — same query key as the canvas, so
  // free cached read. Used by handleMapPress for polygon hit-testing.
  const { featureCollection: raceAreasForHitTest } = useAtlasRacingAreas({
    centerLat: mapCenter.lat,
    centerLng: mapCenter.lng,
  });
  const handleRacingAreaPress = useCallback(
    (area: AtlasRacingAreaPressTarget) => {
      if (area.createdBy !== authUser?.id) return;
      setEditingArea({
        id: area.id,
        name: area.name,
        centerLat: area.centerLat,
        centerLng: area.centerLng,
        radiusMeters: null,
        classesUsed: area.classesUsed,
        polygon: area.polygon,
      });
    },
    [authUser?.id],
  );
  // HKO observations override Open-Meteo wind when a station is within
  // ~5km of map center. Real anemometer beats a 5km model grid for the
  // local read, but only inside the HK bbox — outside we don't bother
  // running the lookup.
  const hko = useHKOObservations();
  const hkoWind = useMemo(() => {
    if (!showWind) return null;
    if (!isInHongKong(mapCenter.lat, mapCenter.lng)) return null;
    return hko.findNearest(mapCenter.lat, mapCenter.lng, 5);
    // hko.findNearest is a stable closure over query.data; recompute
    // when the dataset (or center) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapCenter.lat, mapCenter.lng, hko.data, showWind]);
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
  const scrubWindows = useMemo(
    () => [
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
    ],
    [tideConditionsLine, windConditionsLine],
  );
  const scrubWindow =
    scrubWindows[Math.min(scrubIndex, scrubWindows.length - 1)] ?? scrubWindows[0];
  const windSourceLabel = useMemo(() => {
    if (hkoWind) return `${hkoWind.place} obs`;
    if (marineSnapshot?.wind) return 'JMA model';
    return undefined;
  }, [hkoWind, marineSnapshot]);
  const windPins = useWindOverlay({
    centerLat: mapCenter.lat,
    centerLng: mapCenter.lng,
    conditionsLine: scrubWindow.wind ?? '0|0',
    enabled: showWind && scrubWindow.wind !== null,
    waveHeightMeters: marineSnapshot?.waves?.heightMeters,
    source: scrubIndex === 0 ? windSourceLabel : `${scrubWindow.label} projection`,
  });
  const tidePins = useTideOverlay({
    centerLat: mapCenter.lat,
    centerLng: mapCenter.lng,
    conditionsLine: scrubWindow.tide ?? '0|0',
    enabled: showTide && scrubWindow.tide !== null,
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
    () => [...windPins, ...tidePins, ...wavePins],
    [windPins, tidePins, wavePins],
  );
  // Apply chip-driven peer-pin filtering: when "All" is off and one
  // or more relationship chips are active, hide peer pins whose kind
  // isn't in the allow-list. POIs / race-marks / wind / tide always
  // show — they're not "peer" data.
  const filteredFramePins = useMemo(() => {
    if (!peerRelationshipFilter) return visibleFramePins;
    return visibleFramePins.filter((p) => {
      const isPeerKind = ['you', 'crew', 'fleet', 'following'].includes(p.kind);
      if (!isPeerKind) return true;
      return peerRelationshipFilter.has(p.kind);
    });
  }, [visibleFramePins, peerRelationshipFilter]);
  // Overview keeps the geography + race-mark vocabulary only. The older
  // wind/tide arrow field was too noisy and conflicted with the course
  // frame, which owns the richer conditions treatment.
  const pins = useMemo(
    () => [
      ...filteredFramePins,
      ...(showRaceMarks ? raceMarkPins : []),
      ...windTidePins,
    ],
    [filteredFramePins, raceMarkPins, showRaceMarks, windTidePins],
  );
  const exitCommit = useCallback(() => {
    setCommitMode(false);
    setCandidate(null);
  }, []);
  const handleDropPinPress = useCallback(() => {
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
      // Polygon hit-test for racing areas first — runs before all
      // other tap modes so tapping a polygon you authored jumps to
      // the edit form. Skip while any tap-consuming mode is already
      // active (commit / anchor / reposition / editing / area-create).
      const inActiveTapMode =
        commitMode ||
        anchorStepTarget ||
        repositionTarget ||
        editingArea ||
        areaSheetCenter;
      if (!inActiveTapMode && authUser?.id) {
        const hit = findRacingAreaAtPoint(raceAreasForHitTest, coords.lng, coords.lat);
        if (hit && hit.properties.createdBy === authUser.id) {
          // Compute the polygon's centroid so Move on Map can use it as
          // the anchor for translation deltas. Using the tap coords as
          // the center (the old behavior) made move-delta math wrong —
          // every tap registered as a large displacement from where the
          // user happened to tap, not the polygon's actual center.
          const ring = hit.geometry.coordinates[0] ?? [];
          let sumLat = 0;
          let sumLng = 0;
          for (const v of ring) {
            sumLng += v[0];
            sumLat += v[1];
          }
          const cLat = ring.length > 0 ? sumLat / ring.length : coords.lat;
          const cLng = ring.length > 0 ? sumLng / ring.length : coords.lng;
          handleRacingAreaPress({
            id: hit.properties.id,
            name: hit.properties.name,
            centerLat: cLat,
            centerLng: cLng,
            classesUsed: hit.properties.classesUsed ?? [],
            createdBy: hit.properties.createdBy,
            polygon: hit.geometry,
          });
          return;
        }
      }
      if (retraceTarget) {
        setRetraceTarget((prev) =>
          prev
            ? { ...prev, vertices: [...prev.vertices, { lat: coords.lat, lng: coords.lng }] }
            : prev,
        );
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
      }
    },
    // authUser.id + raceAreasForHitTest are real reactive deps (auth
    // context + react-query result) — the exhaustive-deps rule
    // misclassifies them as outer-scope. Leave them in so a fresh
    // sign-in or area refetch rebuilds the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      commitMode,
      repositionTarget,
      retraceTarget,
      editingArea,
      areaSheetCenter,
      anchorStepTarget,
      updateStepLocationMutation,
      handleRacingAreaPress,
      authUser?.id,
      raceAreasForHitTest,
    ],
  );
  const chromePaddingTop = embedded ? Math.max(insets.top + 8, 48) : 50;
  const lastChromeHeightRef = useRef<number | null>(null);
  const lastHeaderHeightRef = useRef<number | null>(null);
  const handleFloatingChromeLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    if (lastChromeHeightRef.current === height) return;
    lastChromeHeightRef.current = height;
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
        {handlers.useMapLibre ? (
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
              next && !myNextStepPin
                ? {
                    ...next,
                    lat: next.lat ?? 22.2978,
                    lng: next.lng ?? 114.185,
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
            onMapCenterChange={setMapCenter}
            onPinPress={handlePinPress}
            onRacingAreaPress={handleRacingAreaPress}
            showRaceAreas={showRaceAreas}
            showCourse={showCourse}
            coursePreviewCollection={coursePreview}
            basemap={basemap}
          />
        ) : (
          <HongKongOverviewMap />
        )}

        {/* Floating glass chrome — chips on the left, action cluster on
            the right. Title pill removed (the tab-bar highlight already
            names the screen); profile + layers + locate now float as a
            standalone top-right cluster, separate from the filter strip. */}
        <View
          style={[shellStyles.floatingChrome, { paddingTop: chromePaddingTop }]}
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
              <Pressable
                style={shellStyles.capsuleSearch}
                onPress={() => {
                  // Opening search exits any modal-like state (reposition,
                  // retrace, commit-mode) so the user isn't visually
                  // "in" two flows at once. The reposition banner used
                  // to bleed through the search modal.
                  setRepositionTarget(null);
                  setRetraceTarget(null);
                  setCommitMode(false);
                  setCandidate(null);
                  setSearchOpen(true);
                }}
                hitSlop={4}
                accessibilityLabel="Search places"
              >
                <Ionicons
                  name="search"
                  size={14}
                  color="rgba(60, 60, 67, 0.62)"
                  style={shellStyles.capsuleSearchIcon}
                />
                <Text style={shellStyles.capsuleSearchText} numberOfLines={1}>
                  {homeVenue?.region && homeVenue?.venue
                    ? `${homeVenue.region} · ${homeVenue.venue}`
                    : (homeVenue?.region ?? homeVenue?.venue ?? 'Search places')}
                </Text>
              </Pressable>
              <Pressable
                style={shellStyles.capsuleAction}
                onPress={openLayersSheet}
                hitSlop={6}
                accessibilityLabel="Map layers"
              >
                <Ionicons name="layers-outline" size={16} color="rgba(60, 60, 67, 0.85)" />
              </Pressable>
              {universalPlus.isAvailable ? (
                <Pressable
                  style={shellStyles.capsuleAction}
                  onPress={universalPlus.open}
                  hitSlop={6}
                  accessibilityLabel="Add"
                >
                  <Ionicons name="add" size={18} color="rgba(60, 60, 67, 0.85)" />
                </Pressable>
              ) : null}
              <View style={shellStyles.capsuleAction}>
                <NotificationBell size={16} color="rgba(60, 60, 67, 0.85)" />
              </View>
              <ProfileDropdown size={30} variant="light" menuAlign="right" />
            </View>
          </View>
          {/* Headless InterestSwitcher hosts the modal so the imperative
              opener inside the capsule can pop it. Atlas doesn't mount
              the global NavigationHeader, so the sheet lives here. */}
          <InterestSwitcher headless />
          {filterExpanded ? (
            <View style={shellStyles.filterExpandedBlock}>
              <View style={shellStyles.filterExpandedRow}>
                <View style={shellStyles.chipPlate}>
                  <FilterChipsRow
                    chips={[
                      { id: 'all', label: 'All', active: activeFilterIds.includes('all') },
                      { id: 'you', label: 'You', tone: 'you', active: activeFilterIds.includes('you') },
                      { id: 'crew', label: 'Crew', tone: 'crew', active: activeFilterIds.includes('crew') },
                      { id: 'fleet', label: 'Fleet', tone: 'fleet', active: activeFilterIds.includes('fleet') },
                    ]}
                    onActiveIdsChange={handleChipsChange}
                    rightInset={10}
                    compact
                    debugScope="f1"
                  />
                </View>
                <Pressable
                  style={shellStyles.filterCollapseBtn}
                  onPress={() => setFilterExpanded(false)}
                  hitSlop={6}
                  accessibilityLabel="Collapse filters"
                >
                  <Ionicons name="chevron-up" size={14} color="rgba(60, 60, 67, 0.78)" />
                </Pressable>
              </View>

              {userGroups.length > 0 ? (
                <View style={shellStyles.groupSubchipRow}>
                  {userGroups.map((g: UserAffinityGroup) => (
                    <GroupSubchip
                      key={g.id}
                      group={g}
                      active={activeGroupIds.includes(g.id)}
                      onPress={() => toggleGroupChip(g.id)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : activeFilterIds.length > 0 && !activeFilterIds.includes('all') ? (
            // Filter pill only appears when filters are actually applied.
            // Default "All" state hides this entirely so the map reads
            // clean — matches Apple Maps' "Open Now" chip pattern where
            // the chip surfaces only when a filter is active.
            <View style={shellStyles.filterPillRow}>
              <Pressable
                style={shellStyles.filterPill}
                onPress={() => setFilterExpanded(true)}
                hitSlop={6}
                accessibilityLabel="Expand filters"
              >
                <Ionicons
                  name="funnel-outline"
                  size={13}
                  color="rgba(60, 60, 67, 0.78)"
                  style={{ marginRight: 5 }}
                />
                <Text style={shellStyles.filterPillText}>{filterPillLabel}</Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color="rgba(60, 60, 67, 0.55)"
                  style={{ marginLeft: 3 }}
                />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* SVG-fallback fixtures (RacingAreaTag + base-club AtlasPin) —
            these are percentage-positioned so they only render in the
            non-MapLibre fallback path. On the live MapLibre canvas the
            real RHKYC pin comes through useAtlasFramePins → MLMarker. */}
        {hasNext && !commitMode && !handlers.useMapLibre && (
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
        {!handlers.useMapLibre && (
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
        {hasNext && !commitMode && !handlers.useMapLibre && (
          <NextEventTag
            leftPct={50}
            topPct={47}
            eyebrow={`NEXT · ${next!.label.toUpperCase()}${next!.when ? ` · ${next!.when.toUpperCase()}` : ''}`}
            detail={next!.conditions}
          />
        )}

        {/* Commit-mode banner — tells the user the next tap will drop a
            pin and gives them an explicit way out. The blue + FAB is
            gone (entry is the Next Step sheet's "Drop a pin" button);
            this banner is the only commit-mode chrome remaining, so it
            absorbs the cancel affordance the FAB used to carry. */}
        {commitMode && !candidate && (
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

        <LayersFab
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
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

        {(showWind || showTide) && (
          <WindTideScrubber
            windows={scrubWindows.map((w) => w.label)}
            value={scrubIndex}
            onChange={setScrubIndex}
            summary={[
              showWind ? formatConditionsSummary('Wind', scrubWindow.wind) : null,
              showTide ? formatConditionsSummary('Tide', scrubWindow.tide) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          />
        )}
      </View>

      {/* All bottom-sheet variants are suppressed while Layers is open
          so the sheets never render inside / under the Layers panel. */}
      {/* `key` on each branch forces a fresh BottomSheet mount when the
          conditional swaps — otherwise React reconciles the sheet to the
          same instance and `useState(initialState)` only fires on the
          first ever mount. That made initialState='handle' silently
          inherit a prior 'mid' state when myNextStepPin loaded after
          the ATLAS empty-state branch had already mounted the sheet. */}
      {layersOpen || anchorStepTarget || retraceTarget ? null : repositionTarget ? (
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
          body={orgPreview.detail ?? null}
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
      ) : selectedPin ? (
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
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        ) : selectedPin.clusterCount != null ? (
          <BottomSheet
            key="peer-steps"
            eyebrow="PEER STEPS"
            title={`${selectedPin.clusterCount} nearby peer steps`}
            body={
              [
                selectedPin.subtitle,
                selectedPin.provenance,
                'Use this as social context: people in your crew, fleet, following graph, or cohort have activity around this water.',
              ]
                .filter(Boolean)
                .join('\n')
            }
            primary={{
              label: 'Explore peer steps',
              icon: 'people-outline',
              onPress: () => {
                clearSelectedPin();
                comingSoonAlert(
                  'Explore peer steps',
                  'This will open the privacy-safe list behind the cluster: relationship, public preview, and any steps the viewer is allowed to open. For now the badge is a density signal only.',
                );
              },
            }}
            secondary={{ label: 'Close', onPress: clearSelectedPin }}
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        ) : isUserStepPin(selectedPin) ? (
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
                  return;
                }
                comingSoonAlert(
                  'Open step',
                  'This pin is a step location, but it is missing a step id. Refresh Atlas and try again.',
                );
              },
            }}
            secondary={{
              label: 'Pick another',
              icon: 'chevron-down',
              onPress: () => setOpenStepPickerVisible(true),
            }}
            showSecondaryInMid
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="mid"
          />
        ) : (
          <BottomSheet
            key="pin-generic"
            eyebrow={eyebrowForPin(selectedPin)}
            title={selectedPin.label ?? 'Pin'}
            body={detailBodyForPin(selectedPin)}
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
      ) : hasNext && !myNextStepPin ? (
        <BottomSheet
          key="has-next"
          eyebrow={`NEXT · ${next!.label.toUpperCase()}`}
          title={`Plan a step for ${next!.label}.`}
          body={`${[next!.where, next!.when].filter(Boolean).join(' · ')}\nNo steps here from you, your crew, or your fleet yet.`}
          primary={{ label: `${next!.label} details`, icon: 'open-outline', onPress: handlers.onSecondaryAction }}
          secondary={{ label: 'Drop a pin', icon: 'location-outline', onPress: handleDropPinPress }}
          showSecondaryInMid
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="mid"
        />
      ) : myNextStepPin ? (
        <BottomSheet
          key="my-next-step"
          eyebrow="YOUR NEXT STEP"
          title={titleForUserStepPin(myNextStepPin)}
          body={[
            myNextStepPin.label?.includes('|') ? null : myNextStepPin.label,
            'Tap to open this step, or drop a pin to anchor a new one.',
          ]
            .filter(Boolean)
            .join('\n')}
          primary={{
            label: 'Open step',
            icon: 'chevron-down',
            onPress: () => setOpenStepPickerVisible(true),
          }}
          secondary={{ label: 'Drop a pin', icon: 'location-outline', onPress: handleDropPinPress }}
          showSecondaryInMid
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          // Start collapsed so the sheet doesn't eat the map by
          // default. User can pull it up via the handle when they
          // want it. Selected-pin and committed-mode sheets keep
          // initialState="mid" / "expanded" since those are the
          // result of an explicit user action.
          initialState="handle"
        />
      ) : (
        <BottomSheet
          key="atlas-empty"
          eyebrow="ATLAS"
          title="Anchor your next step to a place."
          body="No steps here from you, your crew, or your fleet yet. Drop a pin to start, or tap any pin to see who's there."
          primary={{
            label: 'Drop a pin',
            icon: 'location-outline',
            onPress: handleDropPinPress,
          }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="mid"
        />
      )}

      {/* Racing-area sheet sits OUTSIDE mapArea so zIndex actually wins —
          the next-step/empty-state BottomSheets are siblings of mapArea,
          so an inner-mapArea sheet couldn't stack above them no matter
          how high its zIndex went. Render last + high zIndex + the same
          bottomOffset the other Atlas BottomSheets use so the tab bar
          doesn't eat the Save button. */}
      <OpenStepPicker
        visible={openStepPickerVisible}
        steps={pickerSteps}
        onDismiss={() => setOpenStepPickerVisible(false)}
        onPickStep={handlePickStepFromPicker}
      />

      <CreateRacingAreaSheet
        visible={areaSheetCenter !== null || editingArea !== null}
        center={areaSheetCenterForSheet}
        editingArea={editingArea}
        onMoveOnMap={handleMoveOnMap}
        onRetraceOnMap={handleRetraceOnMap}
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

      {anchorStepTarget ? (
        <RepositionAreaBanner
          areaName={anchorStepTarget.title}
          hasMoved={anchorStepTarget.newLat != null && anchorStepTarget.newLng != null}
          saving={updateStepLocationMutation.isPending}
          onCancel={handleCancelAnchorStep}
          onSave={handleSaveAnchorStep}
          bottomOffset={((handlers as { bottomSheetOffset?: number }).bottomSheetOffset ?? 0) + 16}
        />
      ) : null}

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && (
        <LayersSheet
          frame="f1"
          onClose={() => setLayersOpen(false)}
          controlledActiveKeys={controlledLayerKeys}
          onToggle={handleLayerToggle}
          basemap={basemap}
          onBasemapChange={setBasemap}
          onOpenManageAreas={() => {
            setLayersOpen(false);
            setManageAreasOpen(true);
          }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}

      <ManageRacingAreasSheet
        visible={manageAreasOpen}
        onClose={() => setManageAreasOpen(false)}
        onEditArea={handleEditArea}
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
          { id: 'you', label: 'You', tone: 'you', active: activeFilterIds.includes('you') },
          { id: 'crew', label: 'Crew', tone: 'crew', active: activeFilterIds.includes('crew') },
          { id: 'fleet', label: 'Fleet', tone: 'fleet', active: activeFilterIds.includes('fleet') },
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
  const [layersOpen, setLayersOpen] = useState(false);
  // Search + camera focus state — F4 inherited the shared TopChrome
  // pattern (which only renders a search glyph when onSearchPress is
  // wired) and had no headless InterestSwitcher mounted, so the
  // capsule's chevron tap fired into the void on the nursing frame.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocus, setSearchFocus] = useState<{
    lat: number;
    lng: number;
    bounds?: [number, number, number, number];
  } | null>(null);
  const handleSearchSelect = useCallback((result: AtlasSearchResult) => {
    setSearchOpen(false);
    if (result.kind === 'person' && result.userId) {
      router.push(`/sailor/${result.userId}` as never);
      return;
    }
    if (result.kind === 'organization' && result.orgSlug) {
      if (result.lat != null && result.lng != null) {
        setSearchFocus({ lat: result.lat, lng: result.lng, bounds: result.bounds });
        return;
      }
      router.push(`/organizations/${result.orgSlug}` as never);
      return;
    }
    if (result.lat != null && result.lng != null) {
      setSearchFocus({ lat: result.lat, lng: result.lng, bounds: result.bounds });
    }
  }, []);
  // The "FIRST STEP · ANCHOR WHERE" prompt dismisses to a smaller "Plan a
  // step" sheet when the user taps Skip — same pattern as F1's cold-start.
  // Local state for v1; per-user persistence ("don't show again") lands
  // alongside Phase A1's user preferences surface.
  const [anchorPromptDismissed, setAnchorPromptDismissed] = useState(false);
  // Real institution POIs + peer step pins for Baltimore. F4 camera is
  // centered on JHSON campus (39.297, -76.591) — see FRAME_CAMERA.
  const { pins: framePins } = useAtlasFramePins({
    lat: 39.297,
    lng: -76.591,
    interestSlug: 'nursing',
    radiusKm: 25,
  });
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
    return { ...base, has_user_step: hasUserStep, source_label: sourceLabel };
  }, [handlers.nextEvent, framePins]);
  // Walk-time annotations between same-campus institution pins —
  // e.g. JHH East Baltimore ↔ Pinkard sim lab "8 min".
  const walkAnnotations = useWalkTimeAnnotations(framePins);
  // Chip state — cohort hexes, faculty diamonds, followed individuals.
  // "All" toggles everything on. Defaults are heatmap + faculty on.
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFaculty, setShowFaculty] = useState(true);
  const [showFollowing, setShowFollowing] = useState(false);
  const [heatmapLegendOpen, setHeatmapLegendOpen] = useState(false);
  const handleF4ChipsChange = useCallback((activeIds: string[]) => {
    const all = activeIds.includes('all');
    // Heatmap chip controls only the cohort-density hex layer. Previously
    // the Cohort chip also forced showHeatmap=true, so turning Heatmap off
    // appeared to do nothing whenever Cohort was still selected.
    const nextShowHeatmap = all || activeIds.includes('heatmap');
    setShowHeatmap(nextShowHeatmap);
    if (!nextShowHeatmap) setHeatmapLegendOpen(false);
    setShowFaculty(all || activeIds.includes('faculty'));
    setShowFollowing(all || activeIds.includes('following'));
  }, []);
  // Pin tap state — race-marks/peer/POI/cohort cells all route through
  // selectedPin so the sheet swap is one place. Mirror of FrameF1.
  const [selectedPin, setSelectedPin] = useState<AtlasPinSpec | null>(null);
  const [nextEventSheetOpen, setNextEventSheetOpen] = useState(false);
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
  const handleF4PinPress = useCallback((pin: AtlasPinSpec) => {
    setLayersOpen(false);
    // Tapping a pin while the NEXT-clinical sheet is open should swap
    // to the pin's detail sheet, not stack behind the NEXT sheet. The
    // bottom-sheet render order priorities NEXT over selectedPin, so
    // we have to close NEXT explicitly here.
    setNextEventSheetOpen(false);
    setSelectedPin(pin);
  }, []);
  const clearF4SelectedPin = useCallback(() => setSelectedPin(null), []);
  const clearCandidate = useCallback(() => setCandidate(null), []);
  const handleNextEventTap = useCallback(() => {
    setLayersOpen(false);
    setSelectedPin(null);
    setNextEventSheetOpen(true);
  }, []);
  const closeNextEventSheet = useCallback(() => setNextEventSheetOpen(false), []);
  const { data: queriedHeatmapCells = [] } = useCohortHeatmap({
    centerLat: 39.29,
    centerLng: -76.61,
    interestSlug: 'nursing',
    enabled: showHeatmap,
  });
  // React Query retains the last successful data even when a query is
  // disabled. Keep the render layer honest: when the Heatmap chip is off,
  // pass no cohort cells and no competency glow to the canvas.
  const heatmapCells = useMemo(
    () => (showHeatmap ? queriedHeatmapCells : []),
    [showHeatmap, queriedHeatmapCells],
  );
  // Competency-evidence glow — annotates institution POIs (JHH, Bayview,
  // etc.) with a `glowCluster` derived from the nearest heatmap cell so
  // the renderer paints a soft aura behind each pin in the dominant
  // competency's color. Free relative to the heatmap query.
  const framePinsWithGlow = useCompetencyGlow(framePins, heatmapCells);
  // Apply chip-driven filters. Faculty diamonds (poi-preceptor) hide
  // when Faculty chip is off. Followed-people peer pins hide unless
  // Following chip is on. ALWAYS_VISIBLE_KINDS (module scope) bypasses
  // chip state entirely — anchor pins are map chrome, not data, so they
  // shouldn't disappear when a user filters by Faculty.
  const filteredFramePins = useMemo(() => {
    return framePinsWithGlow.filter((p) => {
      if (ALWAYS_VISIBLE_KINDS.has(p.kind)) return true;
      if (p.kind === 'poi-preceptor') return showFaculty;
      if (p.kind === 'following') return showFollowing;
      return true;
    });
  }, [framePinsWithGlow, showFaculty, showFollowing]);
  const pins = useMemo(
    () => [...heatmapCells, ...filteredFramePins, ...walkAnnotations],
    [heatmapCells, filteredFramePins, walkAnnotations],
  );
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <View style={shellStyles.mapArea}>
        {handlers.useMapLibre ? (
          <AtlasMapLibreCanvas
            frame="f4"
            pins={pins}
            focusLocation={searchFocus}
            nextEvent={
              nextNursing.lat != null && nextNursing.lng != null
                ? { ...nextNursing, lat: nextNursing.lat, lng: nextNursing.lng }
                : null
            }
            candidate={candidate}
            onPinPress={handleF4PinPress}
            onNextEventPress={handleNextEventTap}
            onMapLongPress={(coords) => {
              setLayersOpen(false);
              setSelectedPin(null);
              setNextEventSheetOpen(false);
              setCandidate(coords);
            }}
          />
        ) : (
          <BaltimoreColdMap />
        )}

        {/* Floating glass chrome — title + chips. Same pattern as F1. */}
        <View style={shellStyles.floatingChrome}>
          <TopChrome
            title="Atlas"
            subtitle={handlers.subtitleOverride ?? 'Nursing · JHSON · Baltimore'}
            avatarInitial={handlers.avatarInitial ?? 'E'}
            onSearchPress={() => setSearchOpen(true)}
          />
          <FilterChipsRow
            chips={[
              { id: 'all', label: 'All', active: true },
              { id: 'cohort', label: 'Cohort', tone: 'cohort' },
              { id: 'heatmap', label: 'Heatmap', icon: 'grid-outline', active: true },
              { id: 'faculty', label: 'Faculty', icon: 'school-outline' },
              { id: 'following', label: 'Following', tone: 'following', dim: true },
              { id: 'cross-interest', label: 'All my interests', crossInterest: true, dim: true },
            ]}
            onActiveIdsChange={handleF4ChipsChange}
          />
          {/* Headless InterestSwitcher hosts the modal so TopChrome's
              capsule pill (which calls openInterestSwitcher imperatively)
              can pop the picker. F1 mounts its own headless; F4 needs
              one too or the chevron taps are no-ops. */}
          <InterestSwitcher headless />
          {/* Active-chip context pill — surfaces what the heatmap is
              showing right now ("Cohort heatmap · this week"). Only shown
              when the heatmap chip is selected. */}
          {showHeatmap ? (
            <Pressable
              style={shellStyles.chipContextPill}
              onPress={() => setHeatmapLegendOpen((v) => !v)}
              hitSlop={6}
            >
              <Ionicons name="apps-outline" size={10} color="rgba(60, 60, 67, 0.75)" />
              <Text style={shellStyles.chipContextPillText}>
                Cohort heatmap · this week
              </Text>
              <Ionicons
                name={heatmapLegendOpen ? 'chevron-up' : 'chevron-down'}
                size={10}
                color="rgba(60, 60, 67, 0.65)"
              />
            </Pressable>
          ) : null}
        </View>

        {showHeatmap && heatmapLegendOpen ? (
          <View style={shellStyles.heatmapLegendCard}>
            <Text style={shellStyles.heatmapLegendTitle}>Cohort heatmap</Text>
            <View style={shellStyles.heatmapLegendRow}>
              <View style={[shellStyles.heatmapLegendSwatch, { backgroundColor: 'rgba(255, 59, 48, 0.34)' }]} />
              <Text style={shellStyles.heatmapLegendText}>Hex number = steps here this week</Text>
            </View>
            <View style={shellStyles.heatmapLegendRow}>
              <View style={[shellStyles.heatmapLegendSwatch, { backgroundColor: 'rgba(88, 86, 214, 0.34)' }]} />
              <Text style={shellStyles.heatmapLegendText}>Color = dominant skill cluster</Text>
            </View>
            <View style={shellStyles.heatmapLegendRow}>
              <Ionicons name="lock-closed" size={10} color="rgba(60, 60, 67, 0.58)" />
              <Text style={shellStyles.heatmapLegendText}>Only cohort-level cells, no individual patient sites</Text>
            </View>
          </View>
        ) : null}

        {/* SVG-fallback fixtures: absolutely-positioned percentage pins
            only render when MapLibre is OFF. On the live MapLibre canvas
            these would freeze to the viewport during pan instead of moving
            with the map — the real institution pins come through the
            useAtlasFramePins → MLMarker path inside AtlasMapLibreCanvas. */}
        {!handlers.useMapLibre && (
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

        <LayersFab
          onLayersPress={() => setLayersOpen(true)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      </View>

      {layersOpen ? null : candidate ? (
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
            secondary={{ label: 'Close', onPress: clearF4SelectedPin }}
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
            bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
            initialState="expanded"
          />
        )
      ) : anchorPromptDismissed ? (
        <BottomSheet
          eyebrow="PLAN A STEP"
          title="Anchor your next step to a place."
          body="Drop a pin on the map, or pick a spot from your venues."
          primary={{ label: 'Plan a step', icon: 'add', onPress: handlers.onPrimaryAction }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      ) : (
        <BottomSheet
          eyebrow="COHORT · THIS WEEK"
          title="21 of 30 practiced central-line"
          body={'At Bloomberg this week.\nTomorrow 7am — clinical at JHH 4 South. Shift logging from Atlas is not wired yet.'}
          primary={{
            label: 'Log shift',
            icon: 'add',
            onPress: () =>
              comingSoonAlert(
                'Log shift',
                'This will open the completed-shift capture flow for the clinical site, not the generic Practice tab. Atlas-to-shift logging is queued in Phase A.3.',
              ),
          }}
          secondary={{
            label: 'See heatmap',
            onPress: () => {
              setAnchorPromptDismissed(true);
              handlers.onSecondaryAction?.();
            },
          }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && (
        <LayersSheet
          frame="f4"
          onClose={() => setLayersOpen(false)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}

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
  const [layersOpen, setLayersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocus, setSearchFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [candidate, setCandidate] = useState<{ lat: number; lng: number; place?: string }>({
    lat: F6_DEFAULT_CANDIDATE.lat,
    lng: F6_DEFAULT_CANDIDATE.lng,
    place: F6_DEFAULT_CANDIDATE.place,
  });
  const candidateIsDefault =
    Math.abs(candidate.lat - F6_DEFAULT_CANDIDATE.lat) < 0.000001 &&
    Math.abs(candidate.lng - F6_DEFAULT_CANDIDATE.lng) < 0.000001;
  const candidateLabel = candidateIsDefault
    ? `Favoured pin end · ${F6_DEFAULT_CANDIDATE.place}`
    : candidate.place
      ? `Selected place · ${candidate.place}`
      : 'Dropped pin · selected spot';
  const candidatePlace = candidateIsDefault
    ? F6_DEFAULT_CANDIDATE.place
    : candidate.place ?? `Dropped pin (${candidate.lat.toFixed(3)}, ${candidate.lng.toFixed(3)})`;
  const handleSearchSelect = useCallback((result: AtlasSearchResult) => {
    const next = { lat: result.lat, lng: result.lng, place: result.name };
    setCandidate(next);
    setSearchFocus(next);
    setSearchOpen(false);
  }, []);

  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <View style={shellStyles.commitHeaderRow}>
        <Text style={shellStyles.commitTitle}>Pick a spot</Text>
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
        <Text style={shellStyles.commitBannerText}>
          Drop a pin to anchor <Text style={{ fontWeight: '700' }}>Race 4 plan</Text> to a location.
        </Text>
      </View>

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

      <View style={shellStyles.commitSheet}>
        <View style={shellStyles.commitSheetRow}>
          <Ionicons name="bookmark-outline" size={14} color="rgba(60, 60, 67, 0.62)" />
          <Text style={shellStyles.commitSheetEyebrow}>{candidateLabel}</Text>
        </View>
        <Text style={shellStyles.commitSheetCoords}>
          {candidate.lat.toFixed(3)} N · {candidate.lng.toFixed(3)} E · within Race 4 area
        </Text>
        <View style={shellStyles.statsRow}>
          <Stat value="14" label="PEERS ≤ 200M" />
          <Stat value="6" label="IN YOUR FLEET" />
          <Stat value="3" label="CREW" />
        </View>
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
            onPress={() =>
              setCandidate({
                lat: F6_DEFAULT_CANDIDATE.lat,
                lng: F6_DEFAULT_CANDIDATE.lng,
                place: F6_DEFAULT_CANDIDATE.place,
              })
            }
            style={[shellStyles.btn, shellStyles.btnSecondary]}
          >
            <Ionicons name="locate-outline" size={14} color={IOS_REGISTER.label} />
            <Text style={shellStyles.btnSecondaryText}>Adjust</Text>
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
// First-run frame for the entrepreneur vertical. Ranchi/Jharkhand camera,
// offline-aware chip row, voice-memo CTA prominent. Bilingual labels live
// on the event tables (label_local + locale_local) so the picker reads
// "Khunti haat · खुनी हाट" natively without F7 owning the rendering.
function FrameF7({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const [layersOpen, setLayersOpen] = useState(false);
  // Entrepreneur POIs — supplier villages (white squares), haat markets
  // (green diamonds with day-of-week badges), Lakshmi's home anchor,
  // and any active mentees.
  const { pins: rawPins } = useAtlasFramePins({
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
    const base: AtlasNextEvent =
      handlers.nextEvent?.lat && handlers.nextEvent?.lng
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
    return { ...base, has_user_step: hasUserStep, source_label: sourceLabel };
  }, [handlers.nextEvent, rawPins]);
  // Pin tap state — supplier/haat/home/mentee/next-event all route
  // through here. Mirror of FrameF4's pattern. Opening any sheet
  // auto-closes the Layers panel + clears the other surfaces.
  const [selectedPin, setSelectedPin] = useState<AtlasPinSpec | null>(null);
  const [nextHaatSheetOpen, setNextHaatSheetOpen] = useState(false);
  const handleF7PinPress = useCallback((pin: AtlasPinSpec) => {
    setLayersOpen(false);
    setNextHaatSheetOpen(false);
    setSelectedPin(pin);
  }, []);
  const clearF7SelectedPin = useCallback(() => setSelectedPin(null), []);
  const handleF7NextTap = useCallback(() => {
    setLayersOpen(false);
    setSelectedPin(null);
    setNextHaatSheetOpen(true);
  }, []);
  const closeF7NextSheet = useCallback(() => setNextHaatSheetOpen(false), []);
  // Chip filter state — pin kinds visible. Defaults: everything on so
  // the user sees the network on first load. Cohort/heatmap chips don't
  // exist on F7 (those are F4 nursing); F7 has Network/Haat/Suppliers/
  // Mentees plus the implicit "All" anchor.
  const [showHaats, setShowHaats] = useState(true);
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [showMentees, setShowMentees] = useState(true);
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
  const openRouteToHaat = useCallback(() => {
    if (nextHaat.lat == null || nextHaat.lng == null) return;
    openRouteTo(nextHaat.lat, nextHaat.lng);
  }, [nextHaat.lat, nextHaat.lng, openRouteTo]);
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
            subtitle={handlers.subtitleOverride ?? 'Home craft · Khunti · Jharkhand'}
            avatarInitial={handlers.avatarInitial ?? 'L'}
            onSearchPress={() => {
              /* search modal lands in a follow-up; glyph present per design. */
            }}
          />
          <FilterChipsRow
            chips={[
              { id: 'all', label: 'All', active: true },
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
          <Text style={shellStyles.offlinePillText}>OFFLINE · synced 4h ago</Text>
        </View>

        {/* "Route @ z14" hint chip — anchored top-right under the chrome,
            tells the user the village-to-market route geometry only shows
            up at deeper zoom. */}
        <View style={shellStyles.routeHintChip}>
          <Ionicons name="git-branch-outline" size={11} color="rgba(60, 60, 67, 0.75)" />
          <Text style={shellStyles.routeHintText}>Route @ z14</Text>
        </View>
        <LayersFab
          onLayersPress={() => setLayersOpen(true)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      </View>

      {layersOpen ? null : nextHaatSheetOpen ? (
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
                  label: 'Voice memo',
                  icon: 'mic',
                  onPress: () => {
                    closeF7NextSheet();
                    handlers.onPrimaryAction?.(
                      nextHaat.lat != null && nextHaat.lng != null
                        ? { lat: nextHaat.lat, lng: nextHaat.lng, place: nextHaat.where }
                        : undefined,
                    );
                  },
                }
          }
          secondary={{
            label: 'Open route',
            icon: 'navigate-outline',
            onPress: () => {
              closeF7NextSheet();
              openRouteToHaat();
            },
          }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
          initialState="expanded"
        />
      ) : selectedPin ? (
        <BottomSheet
          eyebrow={eyebrowForPin(selectedPin)}
          title={(selectedPin.label ?? 'Pin').split('|')[0]}
          body={detailBodyForPin(selectedPin, [atlasPinContextNote(selectedPin)])}
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
                    label: 'Plan a step here',
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
      ) : (
        <BottomSheet
          eyebrow="WEDNESDAY · KHUNTI HAAT"
          title={'Plan a step at कल का बाज़ार — tomorrow’s market.'}
          body="5 suppliers report fresh stock. 1 mentee posted nearby this morning."
          primary={{ label: 'Voice memo', icon: 'mic', onPress: handlers.onPrimaryAction }}
          secondary={{ label: 'Open route', icon: 'navigate-outline', onPress: openRouteToHaat }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}

      {layersOpen && (
        <LayersSheet
          frame="f7"
          onClose={() => setLayersOpen(false)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}
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
  primary?: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void };
  secondary?: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void };
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
  showSecondaryInMid = false,
  topStripContent,
  bottomOffset = 0,
  initialState = 'mid',
}: BottomSheetProps & { bottomOffset?: number }) {
  // Three-state sheet: HANDLE (28pt — just the pull tab, true edge-to-
  // edge map below), MID (~110pt — handle + eyebrow + primary CTA), and
  // EXPANDED (full content). Tap the handle to cycle: EXPANDED → MID →
  // HANDLE → EXPANDED.
  const [state, setState] = useState<'handle' | 'mid' | 'expanded'>(initialState);
  const cycle = useCallback(() => {
    setState((v) => (v === 'expanded' ? 'mid' : v === 'mid' ? 'handle' : 'expanded'));
  }, []);
  const showFull = state === 'expanded';
  const showMid = state !== 'handle';
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
      {/* Grabber is the only sheet-state control — Apple sheets don't
          render a separate corner button. Tap the grabber to cycle
          handle → mid → expanded. */}
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
      {showMid && eyebrow ? <Text style={shellStyles.eyebrow}>{eyebrow}</Text> : null}
      {showFull && peerHeader ? (
        <View>
          <Text style={shellStyles.peerName}>
            {peerHeader.name} <Text style={shellStyles.peerQuote}>· {peerHeader.quote}</Text>
          </Text>
          <Text style={shellStyles.peerEyebrow}>{peerHeader.eyebrow}</Text>
        </View>
      ) : null}
      {showMid && title ? <Text style={shellStyles.sheetTitle} numberOfLines={showFull ? undefined : 1}>{title}</Text> : null}
      {showMid && source ? (
        onSourcePress ? (
          <Pressable onPress={onSourcePress} hitSlop={6}>
            <Text style={[shellStyles.sheetSource, shellStyles.sheetSourceLink]}>{source}</Text>
          </Pressable>
        ) : (
          <Text style={shellStyles.sheetSource}>{source}</Text>
        )
      ) : null}
      {showFull && body ? <Text style={shellStyles.sheetBody}>{body}</Text> : null}
      {showFull && expandedContent}
      {showFull && statsRow ? (
        <View style={shellStyles.statsRow}>
          {statsRow.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </View>
      ) : null}
      {showMid && (primary || secondary) && (
        <View style={shellStyles.btnRow}>
          {primary ? (
            <Pressable onPress={primary.onPress} style={[shellStyles.btn, shellStyles.btnPrimary]}>
              {primary.icon ? <Ionicons name={primary.icon} size={14} color="#FFF" /> : null}
              <Text style={shellStyles.btnPrimaryText}>{primary.label}</Text>
            </Pressable>
          ) : null}
          {(showFull || showSecondaryInMid) && secondary ? (
            <Pressable onPress={secondary.onPress} style={[shellStyles.btn, shellStyles.btnSecondary]}>
              {secondary.icon ? (
                <Ionicons name={secondary.icon} size={14} color={IOS_REGISTER.label} />
              ) : null}
              <Text style={shellStyles.btnSecondaryText}>{secondary.label}</Text>
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
  summary,
  bottomOffset = 0,
}: {
  windows: string[];
  value: number;
  onChange: (value: number) => void;
  summary: string;
  bottomOffset?: number;
}) {
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
          <Text style={shellStyles.windTideScrubberLabel}>Wind / tide time</Text>
          <Text style={shellStyles.windTideScrubberValue}>
            {windows[Math.min(value, windows.length - 1)]?.toUpperCase()}
          </Text>
        </View>
        {summary ? (
          <Text style={shellStyles.windTideScrubberSummary} numberOfLines={1}>
            {summary}
          </Text>
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
      </View>
    </View>
  );
}

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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
  },
  windTideScrubberValue: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_REGISTER.accentUserAction,
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
   * Container that stacks the primary chip row + an optional second
   * row of affinity-group sub-chips beneath it.
   */
  filterExpandedBlock: {
    gap: 4,
  },
  /**
   * Row that wraps the expanded chip plate + an external collapse button.
   * Splitting the button out of the plate lets the plate shrink to chip
   * width instead of stretching across empty space.
   */
  filterExpandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
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
  chipPlate: {
    flexShrink: 1,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /**
   * Collapsed filter pill — Atlas's default state. Sailors come here to
   * scout the next race, not to toggle social filters, so the chip row is
   * hidden behind this pill on cold load. Tap to expand; the pill label
   * reflects the active filter so users at-a-glance know if a filter is
   * applied (e.g. "Filter · Crew").
   */
  filterPillRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.85)',
    letterSpacing: -0.1,
  },
  filterCollapseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  capsuleSearch: {
    flex: 1,
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
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 9,
    color: 'rgba(60, 60, 67, 0.62)',
    fontWeight: '600',
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
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.62)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  f2ScrubHeaderValue: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
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
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
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
    fontSize: 18,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: '600',
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
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  btnSecondary: {
    backgroundColor: IOS_REGISTER.fillPill,
  },
  btnSecondaryText: {
    color: IOS_REGISTER.label,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
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
