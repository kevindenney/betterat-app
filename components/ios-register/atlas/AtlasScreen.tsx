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

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  HongKongOverviewMap,
  RaceMarksZoomMap,
  WorldDragonMap,
  BaltimoreColdMap,
  JhuCuratedMap,
  CommitHarbourMap,
} from './AtlasMaps';
import { AtlasMapLibreCanvas, type AtlasPinSpec } from './AtlasMapLibreCanvas';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';
import { useAtlasFramePins } from '@/hooks/useAtlasFramePins';
import { useNextRaceMarks } from '@/hooks/useNextRaceMarks';
import { useWalkTimeAnnotations } from '@/hooks/useWalkTimeAnnotations';
import { useWindOverlay } from '@/hooks/useWindOverlay';
import { useTideOverlay } from '@/hooks/useTideOverlay';
import { useCohortHeatmap } from '@/hooks/useCohortHeatmap';
import { useCompetencyGlow } from '@/hooks/useCompetencyGlow';
import {
  AtlasPin,
  ClusterTag,
  GhostStampOverlay,
  NextEventTag,
  RacingAreaTag,
} from './AtlasPins';

export type AtlasFrameId = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7';

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
}

export interface AtlasFrameHandlers {
  /**
   * Bottom-sheet primary CTA — "Plan a step" / "Anchor · pick site" / in
   * commit-mode "Plan a step here". When the user is in compose-at-
   * location mode with a dropped pin, F1 forwards the candidate coords
   * so the caller can thread them into the add-step flow.
   */
  onPrimaryAction?: (pin?: { lat: number; lng: number; place?: string }) => void;
  /** Bottom-sheet secondary CTA — "Open <next event>" / "Skip" etc. */
  onSecondaryAction?: () => void;
  /** TopChrome avatar tap — routes to Profile in the live tab. */
  onAvatarPress?: () => void;
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
  onAvatarPress,
  subtitleOverride,
  nextEvent,
  avatarInitial,
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
    onAvatarPress,
    subtitleOverride,
    nextEvent,
    avatarInitial,
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
  /** Unused — kept for callsite compat; ProfileDropdown owns its own tap. */
  onAvatarPress?: () => void;
}) {
  return (
    <View style={shellStyles.topChromeRow}>
      <View style={{ flex: 1 }}>
        <Text style={shellStyles.title}>{title}</Text>
        {subtitle ? (
          <View style={shellStyles.subtitleRow}>
            <View style={shellStyles.subtitleDot} />
            <Text style={shellStyles.subtitle}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
      <View style={shellStyles.topRight}>
        {onLayersPress ? (
          <Pressable style={shellStyles.glyphBtn} hitSlop={6} onPress={onLayersPress}>
            <Ionicons name="layers-outline" size={16} color={IOS_REGISTER.label} />
          </Pressable>
        ) : null}
        <ProfileDropdown size={30} variant="light" />
      </View>
    </View>
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
}: {
  chips: FilterChipItem[];
  /**
   * Optional callback fired whenever the active-chip set changes. Lets
   * the parent frame (e.g. FrameF1) read Wind/Tide chip state to gate
   * the corresponding overlay layers.
   */
  onActiveIdsChange?: (activeIds: string[]) => void;
}) {
  // Local toggle state — chips are interactive even though the underlying
  // query layer is not wired yet. Initial active chip is whichever item
  // shipped active=true. Multi-select on data peer chips (You/Crew/Fleet
  // etc.), single-select on the leading "All" / sticky chip.
  const initialActive = chips.filter((c) => c.active).map((c) => c.id);
  const [activeIds, setActiveIds] = useState<string[]>(
    initialActive.length > 0 ? initialActive : [chips[0]?.id].filter(Boolean) as string[],
  );

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

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={shellStyles.chipsContainer}
      style={shellStyles.chipsScroll}
    >
      {chips.map((chip) => (
        <FilterChip
          key={chip.id}
          {...chip}
          active={activeIds.includes(chip.id)}
          onPress={() => handlePress(chip.id)}
        />
      ))}
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
  onPress,
}: FilterChipItem & { onPress?: () => void }) {
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
        active && shellStyles.chipActive,
        dim && shellStyles.chipDim,
      ]}
    >
      {crossInterest ? <CrossInterestGlyph active={active} /> : null}
      {icon && !crossInterest ? (
        <Ionicons
          name={icon}
          size={11}
          color={active ? '#FFFFFF' : 'rgba(60, 60, 67, 0.72)'}
          style={{ marginRight: 4 }}
        />
      ) : null}
      {tone && !crossInterest ? (
        <View style={[shellStyles.chipDot, { backgroundColor: toneDot[tone] }]} />
      ) : null}
      <Text style={[shellStyles.chipText, active && shellStyles.chipTextActive]}>{label}</Text>
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

function LayersFab({
  onLayersPress,
  onDropPinPress,
  commitMode,
  bottomOffset = 0,
}: {
  onLayersPress?: () => void;
  onDropPinPress?: () => void;
  commitMode?: boolean;
  /** Lift the FAB column above the floating bottom sheet + tab bar. */
  bottomOffset?: number;
}) {
  // When the sheet floats above the tab bar, the FAB column must sit
  // ABOVE the sheet — otherwise the layers/locate/+ buttons get covered.
  // ~120pt of sheet (MID state) + 12pt margin on top of the offset.
  const dynamicBottom = bottomOffset > 0 ? bottomOffset + 132 : 14;
  return (
    <View
      style={[shellStyles.fabColumn, { bottom: dynamicBottom }]}
      pointerEvents="box-none"
    >
      <Pressable style={shellStyles.fab} onPress={onLayersPress} hitSlop={6}>
        <Ionicons name="layers-outline" size={16} color="rgba(60, 60, 67, 0.78)" />
      </Pressable>
      <Pressable style={shellStyles.fab} hitSlop={6}>
        <Ionicons name="locate-outline" size={16} color="rgba(60, 60, 67, 0.78)" />
      </Pressable>
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
  | 'sailing.wind'
  | 'sailing.tide'
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

  if (frame === 'f1' || frame === 'f2' || frame === 'f6') {
    return [
      { key: 'sailing.race_marks', label: 'Race marks', sub: 'Renders at zoom ≥ 14', defaultOn: true },
      { key: 'sailing.wind', label: 'Wind', sub: 'Forecast vector + speed', defaultOn: true },
      { key: 'sailing.tide', label: 'Tide', sub: 'Set + drift', defaultOn: true },
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
  /**
   * Lift the sheet above the floating tab bar so the last layer row + the
   * attribution footer aren't hidden under it. Same pattern as the
   * BottomSheet's bottomOffset prop.
   */
  bottomOffset?: number;
}) {
  const layers = getLayersForFrame(frame);
  const [internalKeys, setInternalKeys] = useState<Set<string>>(
    () => new Set(layers.filter((l) => l.defaultOn).map((l) => l.key)),
  );
  // Merge controlled + internal — controlled keys win when both define.
  const activeKeys = useMemo(() => {
    if (!controlledActiveKeys) return internalKeys;
    const out = new Set(internalKeys);
    for (const layer of layers) {
      if (!controlledActiveKeys.has(layer.key)) out.delete(layer.key);
      else out.add(layer.key);
    }
    return out;
  }, [internalKeys, controlledActiveKeys, layers]);

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
        {/* Attribution required by OpenFreeMap / OpenMapTiles / OSM
            licenses. Lives at the bottom of the Layers sheet so the
            (i) chrome button stays off the map canvas. */}
        <Text style={shellStyles.layersAttribution}>
          Tiles · OpenFreeMap · © OpenMapTiles · © OpenStreetMap
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
  if (pin.kind === 'poi-preceptor') return 'PRECEPTOR';
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

// ---------------------------------------------------------------------------
// F1 — Felix · first-run · Causeway Bay overview
// ---------------------------------------------------------------------------
function FrameF1({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const next = handlers.nextEvent;
  const hasNext = Boolean(next?.label);
  const [layersOpen, setLayersOpen] = useState(false);
  // Compose-at-location: tap the + FAB to enter commit-mode, then any
  // tap on the map drops a candidate pin and rises the commit sheet.
  // Per the brief, this replaces the legacy SelectLocation modal — the
  // picker IS the real surface in a different mode. When arrived from
  // PlanWhereCard with ?fromPlan=1, we start ALREADY in commit-mode so
  // the user doesn't have to tap + after landing on Atlas.
  const [commitMode, setCommitMode] = useState(handlers.initialCommitMode ?? false);
  const [candidate, setCandidate] = useState<{ lng: number; lat: number } | null>(null);
  // Real institution POIs + peer step pins for the Causeway Bay bbox.
  // 22.295, 114.18 is the F1 camera centroid — see AtlasMapLibreCanvas.FRAME_CAMERA.
  const { pins: framePins } = useAtlasFramePins({
    lat: 22.295,
    lng: 114.18,
    interestSlug: 'sail-racing',
    radiusKm: 20,
  });
  // Race-marks layer — when the next event is a regatta, fetch its
  // earliest race_event's marks and merge into the pin set. Renders as
  // numbered amber pins per the design's pin grammar.
  const { data: raceMarkPins = [] } = useNextRaceMarks({
    regattaId: next?.event_kind === 'regatta' ? next.event_id : null,
  });
  // Pin tap target — when a race-mark / POI / peer pin is tapped, store
  // it so the bottom sheet can swap from the default "Plan a step" CTA
  // to a context-specific detail card. Null = default sheet.
  const [selectedPin, setSelectedPin] = useState<AtlasPinSpec | null>(null);
  const handlePinPress = useCallback((pin: AtlasPinSpec) => {
    // Auto-close the Layers sheet when a pin is tapped so the detail
    // sheet doesn't render inside / behind the Layers panel.
    setLayersOpen(false);
    setSelectedPin(pin);
  }, []);
  const clearSelectedPin = useCallback(() => setSelectedPin(null), []);
  const openLayersSheet = useCallback(() => {
    // Layers is mutually exclusive with all the bottom-sheet variants —
    // clear any active pin sheet AND exit commit-mode so the PIN DROPPED
    // card doesn't stack under the Layers panel.
    setSelectedPin(null);
    setCommitMode(false);
    setCandidate(null);
    setLayersOpen(true);
  }, []);
  // Chip- and Layers-sheet-driven layer state. "all" chip is the anchor:
  // when active, every peer relationship + wind + tide + race-marks shows.
  // Toggling specific chips (You/Crew/Fleet/Following/Wind/Tide/Race-marks)
  // filters their corresponding pin kinds. Same state is shared with the
  // LayersSheet so toggling there also moves the chips.
  const [showWind, setShowWind] = useState(true);
  const [showTide, setShowTide] = useState(true);
  const [showRaceMarks, setShowRaceMarks] = useState(true);
  const [peerRelationshipFilter, setPeerRelationshipFilter] = useState<Set<string> | null>(null);
  const handleChipsChange = useCallback((activeIds: string[]) => {
    const all = activeIds.includes('all');
    setShowWind(all || activeIds.includes('wind'));
    setShowTide(all || activeIds.includes('tide'));
    setShowRaceMarks(all || activeIds.includes('race-marks'));
    // Peer filter is null when "All" is active (show everything),
    // otherwise the active relationship chips form an allow-list.
    const peerChips = activeIds.filter((id) =>
      ['you', 'crew', 'fleet', 'following'].includes(id),
    );
    setPeerRelationshipFilter(all || peerChips.length === 0 ? null : new Set(peerChips));
  }, []);
  // Mirror layers/chips into the controlled keys the LayersSheet reads.
  const controlledLayerKeys = useMemo(() => {
    const out = new Set<string>();
    if (showRaceMarks) out.add('sailing.race_marks');
    if (showWind) out.add('sailing.wind');
    if (showTide) out.add('sailing.tide');
    return out;
  }, [showRaceMarks, showWind, showTide]);
  const handleLayerToggle = useCallback((key: string, on: boolean) => {
    if (key === 'sailing.race_marks') setShowRaceMarks(on);
    if (key === 'sailing.wind') setShowWind(on);
    if (key === 'sailing.tide') setShowTide(on);
  }, []);
  // Minimal wind + tide overlays — water-anchored only, one large arrow
  // per racing area, no time scrubbing. Per design pass: "fewer larger
  // arrows over water only".
  //
  // We seed waterAnchors with the next-event coords so there's always at
  // least one arrow at the user's current focus (otherwise zooming into
  // Victoria Harbour can hide all the racing-area arrows and the wind
  // field appears to "disappear" after first render).
  //
  // Wind anchors offset ~400m EAST of the venue so the arrow disc doesn't
  // sit underneath the amber NEXT pill / +N cluster badge that lives at
  // the venue centroid. Tide gets its own offset inside useTideOverlay.
  const windAnchors = useMemo(() => {
    const out = framePins
      .filter((p) => p.kind === 'poi-racing-area')
      .map((p) => ({ lat: p.lat, lng: p.lng }));
    const nextLat = next?.lat;
    const nextLng = next?.lng;
    if (nextLat != null && nextLng != null) {
      const exists = out.some(
        (a) => Math.abs(a.lat - nextLat) < 0.005 && Math.abs(a.lng - nextLng) < 0.005,
      );
      if (!exists) out.push({ lat: nextLat, lng: nextLng });
    }
    const dLngOffset = 0.4 / (111 * Math.cos((22.295 * Math.PI) / 180));
    return out.map((a) => ({ lat: a.lat + 0.0018, lng: a.lng + dLngOffset }));
  }, [framePins, next?.lat, next?.lng]);
  const tideAnchors = useMemo(() => {
    const out = framePins
      .filter((p) => p.kind === 'poi-racing-area')
      .map((p) => ({ lat: p.lat, lng: p.lng }));
    const nextLat = next?.lat;
    const nextLng = next?.lng;
    if (nextLat != null && nextLng != null) {
      const exists = out.some(
        (a) => Math.abs(a.lat - nextLat) < 0.005 && Math.abs(a.lng - nextLng) < 0.005,
      );
      if (!exists) out.push({ lat: nextLat, lng: nextLng });
    }
    const dLngOffset = -0.4 / (111 * Math.cos((22.295 * Math.PI) / 180));
    return out.map((a) => ({ lat: a.lat - 0.0018, lng: a.lng + dLngOffset }));
  }, [framePins, next?.lat, next?.lng]);
  const windPins = useWindOverlay({
    centerLat: next?.lat ?? 22.295,
    centerLng: next?.lng ?? 114.18,
    conditionsLine: next?.conditions,
    enabled: showWind,
    waterAnchors: windAnchors,
  });
  const tidePins = useTideOverlay({
    centerLat: next?.lat ?? 22.295,
    centerLng: next?.lng ?? 114.18,
    conditionsLine: next?.conditions,
    enabled: showTide,
    waterAnchors: tideAnchors,
  });
  // Apply chip-driven peer-pin filtering: when "All" is off and one
  // or more relationship chips are active, hide peer pins whose kind
  // isn't in the allow-list. POIs / race-marks / wind / tide always
  // show — they're not "peer" data.
  const filteredFramePins = useMemo(() => {
    if (!peerRelationshipFilter) return framePins;
    return framePins.filter((p) => {
      const isPeerKind = ['you', 'crew', 'fleet', 'following'].includes(p.kind);
      if (!isPeerKind) return true;
      return peerRelationshipFilter.has(p.kind);
    });
  }, [framePins, peerRelationshipFilter]);
  // Z-order: wind (base field), POIs (places), race-marks, tide (so its
  // chevron reads above the racing-area pin it points away from).
  const pins = useMemo(
    () => [
      ...windPins,
      ...filteredFramePins,
      ...(showRaceMarks ? raceMarkPins : []),
      ...tidePins,
    ],
    [windPins, filteredFramePins, raceMarkPins, tidePins, showRaceMarks],
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
      if (commitMode) {
        // Same housekeeping as entering commit-mode — if the user opens
        // Layers after entering commit-mode and then taps the map, the
        // resulting PIN DROPPED sheet would stack inside the Layers card.
        setLayersOpen(false);
        setSelectedPin(null);
        setCandidate(coords);
      }
    },
    [commitMode],
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
            nextEvent={
              next
                ? {
                    ...next,
                    lat: next.lat ?? 22.2978,
                    lng: next.lng ?? 114.185,
                  }
                : null
            }
            onMapPress={commitMode ? handleMapPress : undefined}
            candidate={candidate}
            onPinPress={handlePinPress}
          />
        ) : (
          <HongKongOverviewMap />
        )}

        {/* Floating glass chrome — title + chips */}
        <View style={shellStyles.floatingChrome}>
          <TopChrome
            title="Atlas"
            avatarInitial={handlers.avatarInitial ?? 'F'}
            onLayersPress={openLayersSheet}
            onAvatarPress={handlers.onAvatarPress}
          />
          <FilterChipsRow
            chips={[
              { id: 'all', label: 'All', active: true },
              { id: 'you', label: 'You', tone: 'you' },
              { id: 'crew', label: 'Crew', tone: 'crew' },
              { id: 'fleet', label: 'Fleet', tone: 'fleet' },
              { id: 'following', label: 'Following', tone: 'following', dim: true },
              { id: 'wind', label: 'Wind', icon: 'arrow-up-outline', active: true },
              { id: 'tide', label: 'Tide', icon: 'water-outline', active: true },
              { id: 'race-marks', label: 'Race marks', icon: 'triangle-outline', active: true },
              { id: 'cross-interest', label: 'All my interests', crossInterest: true, dim: true },
            ]}
            onActiveIdsChange={handleChipsChange}
          />
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
            pin. Hides once a candidate is placed (the sheet takes over). */}
        {commitMode && !candidate && (
          <View style={shellStyles.commitBannerInline}>
            <Ionicons name="location-outline" size={12} color="#FFFFFF" />
            <Text style={shellStyles.commitBannerInlineText}>
              Tap the map to drop a pin.
            </Text>
          </View>
        )}

        <LayersFab
          onLayersPress={openLayersSheet}
          onDropPinPress={handlers.useMapLibre ? handleDropPinPress : undefined}
          commitMode={commitMode}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />

        {/* Tide time-slider removed per design feedback — keep wind/tide
            minimal (large arrows over water only, no scrubbing). Real
            Storm Glass per-event tides land in a follow-up. */}
      </View>

      {/* All bottom-sheet variants are suppressed while Layers is open
          so the sheets never render inside / under the Layers panel. */}
      {layersOpen ? null : candidate ? (
        <BottomSheet
          eyebrow="PIN DROPPED"
          title="Anchor a step at this location."
          body={`${candidate.lat.toFixed(4)} N · ${candidate.lng.toFixed(4)} E`}
          primary={{
            label: 'Plan a step here',
            icon: 'add',
            onPress: () => {
              const pin = { lat: candidate.lat, lng: candidate.lng };
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
        ) : (
          <BottomSheet
            eyebrow={eyebrowForPin(selectedPin)}
            title={selectedPin.label ?? 'Pin'}
            body={selectedPin.subtitle ?? bodyForPin(selectedPin)}
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
      ) : hasNext ? (
        <BottomSheet
          eyebrow="NEXT · PRE-STAGED"
          title={`Plan a step for ${next!.label}.`}
          body={[next!.where, next!.when].filter(Boolean).join(' · ')}
          primary={{ label: 'Plan a step', icon: 'add', onPress: handlers.onPrimaryAction }}
          secondary={{ label: `Open ${next!.label}`, onPress: handlers.onSecondaryAction }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      ) : (
        <BottomSheet
          eyebrow="PLAN A STEP"
          title="Anchor your next step to a place."
          body="Drop a pin on the map, or pick a spot from your venues."
          primary={{ label: 'Plan a step', icon: 'add', onPress: handlers.onPrimaryAction }}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      )}

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && (
        <LayersSheet
          frame="f1"
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
// F2 — Race-marks zoom (Victoria Harbour)
// ---------------------------------------------------------------------------
function FrameF2({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const [layersOpen, setLayersOpen] = useState(false);
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="Race 4 course"
        subtitle={handlers.subtitleOverride ?? 'RHKYC · Victoria Harbour · Sat 10:00'}
        avatarInitial={handlers.avatarInitial ?? "F"}
      />
      <FilterChipsRow
        chips={[
          { id: 'marks', label: 'Race marks', icon: 'triangle-outline', active: true },
          { id: 'crew', label: 'Crew', tone: 'crew' },
          { id: 'fleet', label: 'Fleet', tone: 'fleet' },
          { id: 'wind', label: 'Wind', icon: 'flag-outline' },
          { id: 'tide', label: 'Tide', icon: 'water-outline' },
          { id: 'cross-interest', label: 'All my interests', crossInterest: true, dim: true },
        ]}
      />
      <View style={shellStyles.mapArea}>
        {handlers.useMapLibre ? (
          <AtlasMapLibreCanvas frame="f2" />
        ) : (
          <RaceMarksZoomMap />
        )}

        {/* Wind chip top-right */}
        <View style={[shellStyles.absChip, { top: 12, right: 12 }]}>
          <Ionicons name="flag" size={9} color="rgba(60, 60, 67, 0.7)" />
          <Text style={shellStyles.absChipText}>12KN ESE</Text>
        </View>
        {/* Tide chip bottom-left */}
        <View style={[shellStyles.absChip, { bottom: 60, left: 12 }]}>
          <Ionicons name="water" size={9} color="rgba(60, 60, 67, 0.7)" />
          <Text style={shellStyles.absChipText}>EBB 0.4KN</Text>
        </View>

        {/* The selected peer pin near the pin end (Phyl Loong) — highlighted */}
        <AtlasPin kind="crew" leftPct={32} topPct={66} selected />
        {/* Other fleet pins scattered */}
        <AtlasPin kind="fleet" leftPct={48} topPct={56} />
        <AtlasPin kind="fleet" leftPct={62} topPct={68} />
        <AtlasPin kind="fleet" leftPct={70} topPct={62} />
        <AtlasPin kind="following" leftPct={42} topPct={72} />

        {/* Zoom indicator */}
        <View style={[shellStyles.zoomIndicator, { bottom: 12, right: 12 }]}>
          <Text style={shellStyles.zoomText}>zoom 14.2</Text>
        </View>

        <LayersFab
          onLayersPress={() => setLayersOpen(true)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      </View>

      <BottomSheet
        peerHeader={{
          name: 'Phyl Loong',
          quote: 'Pin-end approach in light air',
          eyebrow: 'Crew · Race 3 · Sat April 27',
        }}
        statsRow={[
          { value: '3', label: 'SUB-STEPS' },
          { value: '6', label: 'CAPTURES' },
          { value: '2', label: 'CONCEPTS' },
        ]}
        primary={{ label: 'Add to my timeline', icon: 'add', onPress: handlers.onPrimaryAction }}
        secondary={{ label: 'Suggest to…', icon: 'paper-plane-outline', onPress: handlers.onSecondaryAction }}
      />

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && (
        <LayersSheet
          frame="f2"
          onClose={() => setLayersOpen(false)}
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
  const [layersOpen, setLayersOpen] = useState(false);
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
  const nextNursing = useMemo(() => {
    if (handlers.nextEvent?.lat && handlers.nextEvent?.lng) return handlers.nextEvent;
    return {
      label: 'Clinical',
      when: 'Tmrw 7am',
      where: 'JHH 4 South',
      conditions: 'JHH 4 South · cardiac',
      lat: 39.2966,
      lng: -76.5919,
    } as AtlasNextEvent;
  }, [handlers.nextEvent]);
  // Walk-time annotations between same-campus institution pins —
  // e.g. JHH East Baltimore ↔ Pinkard sim lab "8 min".
  const walkAnnotations = useWalkTimeAnnotations(framePins);
  // Chip state — cohort hexes, faculty diamonds, followed individuals.
  // "All" toggles everything on. Defaults are heatmap + faculty on.
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFaculty, setShowFaculty] = useState(true);
  const [showFollowing, setShowFollowing] = useState(false);
  const handleF4ChipsChange = useCallback((activeIds: string[]) => {
    const all = activeIds.includes('all');
    setShowHeatmap(all || activeIds.includes('heatmap') || activeIds.includes('cohort'));
    setShowFaculty(all || activeIds.includes('faculty'));
    setShowFollowing(all || activeIds.includes('following'));
  }, []);
  // Pin tap state — race-marks/peer/POI/cohort cells all route through
  // selectedPin so the sheet swap is one place. Mirror of FrameF1.
  const [selectedPin, setSelectedPin] = useState<AtlasPinSpec | null>(null);
  const handleF4PinPress = useCallback((pin: AtlasPinSpec) => {
    setLayersOpen(false);
    setSelectedPin(pin);
  }, []);
  const clearF4SelectedPin = useCallback(() => setSelectedPin(null), []);
  const [nextEventSheetOpen, setNextEventSheetOpen] = useState(false);
  const handleNextEventTap = useCallback(() => {
    setLayersOpen(false);
    setSelectedPin(null);
    setNextEventSheetOpen(true);
  }, []);
  const closeNextEventSheet = useCallback(() => setNextEventSheetOpen(false), []);
  const { data: heatmapCells = [] } = useCohortHeatmap({
    centerLat: 39.29,
    centerLng: -76.61,
    interestSlug: 'nursing',
    enabled: showHeatmap,
  });
  // Competency-evidence glow — annotates institution POIs (JHH, Bayview,
  // etc.) with a `glowCluster` derived from the nearest heatmap cell so
  // the renderer paints a soft aura behind each pin in the dominant
  // competency's color. Free relative to the heatmap query.
  const framePinsWithGlow = useCompetencyGlow(framePins, heatmapCells);
  // Apply chip-driven filters. Faculty diamonds (poi-preceptor) hide
  // when Faculty chip is off. Followed-people peer pins hide unless
  // Following chip is on. Institutions + sim anchor always visible.
  const filteredFramePins = useMemo(() => {
    return framePinsWithGlow.filter((p) => {
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
            nextEvent={
              nextNursing.lat != null && nextNursing.lng != null
                ? { ...nextNursing, lat: nextNursing.lat, lng: nextNursing.lng }
                : null
            }
            onPinPress={handleF4PinPress}
            onNextEventPress={handleNextEventTap}
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
          {/* Active-chip context pill — surfaces what the heatmap is
              showing right now ("Cohort heatmap · this week"). Only shown
              when the heatmap chip is selected. */}
          {showHeatmap ? (
            <View style={shellStyles.chipContextPill}>
              <Ionicons name="apps-outline" size={10} color="rgba(60, 60, 67, 0.75)" />
              <Text style={shellStyles.chipContextPillText}>
                Cohort heatmap · this week
              </Text>
            </View>
          ) : null}
        </View>

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

      {layersOpen ? null : nextEventSheetOpen ? (
        <BottomSheet
          eyebrow={`TOMORROW · ${nextNursing.label.toUpperCase()}${nextNursing.when ? ` · ${nextNursing.when.toUpperCase()}` : ''}`}
          title={nextNursing.where ?? 'Your next clinical'}
          body={[
            nextNursing.conditions,
            'Bring: stethoscope, scrub colors, badge.',
            '4 of your cohort are also on tomorrow. Tap Plan a step to pre-record your intent.',
          ]
            .filter(Boolean)
            .join('\n')}
          primary={{
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
          }}
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
                    handlers.onPrimaryAction?.({ lat: selectedPin.lat, lng: selectedPin.lng });
                    clearF4SelectedPin();
                  },
                }}
                secondary={{ label: 'Close', onPress: clearF4SelectedPin }}
                bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
                initialState="expanded"
              />
            );
          })()
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
              label: 'Anchor a step here',
              icon: 'add',
              onPress: () => {
                handlers.onPrimaryAction?.({ lat: selectedPin.lat, lng: selectedPin.lng });
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
          title="21 of 30 classmates practiced central-line at Bloomberg this week."
          body="Tomorrow 7am — clinical at JHH 4 South. Tap to anchor your last shift."
          primary={{ label: 'Anchor shift', icon: 'add', onPress: handlers.onPrimaryAction }}
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
function FrameF6({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  const [layersOpen, setLayersOpen] = useState(false);
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <View style={shellStyles.commitHeaderRow}>
        <Text style={shellStyles.commitTitle}>Pick a spot</Text>
        <Pressable style={shellStyles.glyphBtn} hitSlop={6}>
          <Ionicons name="close" size={18} color={IOS_REGISTER.accentUserAction} />
        </Pressable>
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
          <AtlasMapLibreCanvas frame="f6" />
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
          <Text style={shellStyles.commitSheetEyebrow}>Favoured pin end · Victoria Harbour</Text>
        </View>
        <Text style={shellStyles.commitSheetCoords}>22.286 N · 114.182 E · within Race 4 area</Text>
        <View style={shellStyles.statsRow}>
          <Stat value="14" label="PEERS ≤ 200M" />
          <Stat value="6" label="IN YOUR FLEET" />
          <Stat value="3" label="CREW" />
        </View>
        <View style={shellStyles.btnRow}>
          <Pressable onPress={handlers.onPrimaryAction} style={[shellStyles.btn, shellStyles.btnPrimary]}>
            <Ionicons name="checkmark" size={14} color="#FFF" />
            <Text style={shellStyles.btnPrimaryText}>Use this location</Text>
          </Pressable>
          <Pressable onPress={handlers.onSecondaryAction} style={[shellStyles.btn, shellStyles.btnSecondary]}>
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
  const { pins } = useAtlasFramePins({
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
    if (handlers.nextEvent?.lat && handlers.nextEvent?.lng) return handlers.nextEvent;
    return {
      label: 'Khunti haat',
      when: 'Wed 6am',
      where: 'Khunti haat · खुनी हाट',
      conditions: '~11 km · leave by 5:30',
      lat: 23.075,
      lng: 85.2792,
    };
  }, [handlers.nextEvent]);
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
          />
        ) : (
          <WorldDragonMap />
        )}
        {/* Floating glass chrome — title + chips. Same pattern as F1/F4. */}
        <View style={shellStyles.floatingChrome}>
          <TopChrome
            title="Atlas"
            subtitle={handlers.subtitleOverride ?? 'Entrepreneur · Jharkhand · Network'}
            avatarInitial={handlers.avatarInitial ?? 'L'}
          />
          <FilterChipsRow
            chips={[
              { id: 'all', label: 'All', active: true },
              { id: 'network', label: 'Network', tone: 'fleet' },
              { id: 'haat', label: 'Haat · हाट', icon: 'storefront-outline' },
              { id: 'suppliers', label: 'Suppliers', icon: 'leaf-outline' },
              { id: 'mom', label: 'Mentees', tone: 'crew', dim: true },
              { id: 'offline', label: 'OFFLINE · synced 4h', icon: 'cloud-offline-outline' },
            ]}
          />
        </View>
        <LayersFab
          onLayersPress={() => setLayersOpen(true)}
          bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
        />
      </View>

      <BottomSheet
        eyebrow="WEDNESDAY · KHUNTI HAAT"
        title={'Plan a step at कल का बाज़ार — tomorrow’s market.'}
        body="5 suppliers report fresh stock. 1 mentee posted nearby this morning."
        primary={{ label: 'Voice memo', icon: 'mic', onPress: handlers.onPrimaryAction }}
        secondary={{ label: 'Open route', icon: 'navigate-outline', onPress: handlers.onSecondaryAction }}
        bottomOffset={(handlers as { bottomSheetOffset?: number }).bottomSheetOffset}
      />

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
  body?: string;
  peerHeader?: { name: string; quote: string; eyebrow: string };
  statsRow?: StatItem[];
  primary?: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void };
  secondary?: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void };
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
  body,
  peerHeader,
  statsRow,
  primary,
  secondary,
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
      <Pressable
        onPress={cycle}
        accessibilityRole="button"
        accessibilityLabel={`Sheet state: ${state}. Tap to cycle.`}
        hitSlop={12}
        style={shellStyles.sheetHandleHit}
      >
        <View style={shellStyles.sheetHandle} />
      </Pressable>
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
      {showFull && body ? <Text style={shellStyles.sheetBody}>{body}</Text> : null}
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
          {showFull && secondary ? (
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const shellStyles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.4,
  },
  subtitleRow: {
    marginTop: 2,
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
    paddingRight: 24,
    gap: 6,
    paddingBottom: 6,
  },
  chip: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
  },
  chipActive: {
    backgroundColor: '#000000',
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
    paddingBottom: 4,
    zIndex: 10,
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
  // --- Layers sheet -------------------------------------------------------
  layersBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    zIndex: 10,
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
    zIndex: 11,
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
  chipContextPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(28, 28, 30, 0.78)',
    letterSpacing: -0.1,
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
