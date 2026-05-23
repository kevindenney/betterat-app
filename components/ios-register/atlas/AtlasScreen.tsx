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

import React, { useCallback, useState } from 'react';
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
import { AtlasMapLibreCanvas } from './AtlasMapLibreCanvas';
import {
  AtlasPin,
  ClusterTag,
  GhostStampOverlay,
  NextEventTag,
  RacingAreaTag,
} from './AtlasPins';

export type AtlasFrameId = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6';

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
}

export interface AtlasFrameHandlers {
  /** Bottom-sheet primary CTA — "Plan a step" / "Anchor · pick site" etc. */
  onPrimaryAction?: () => void;
  /** Bottom-sheet secondary CTA — "Open <next event>" / "Skip" etc. */
  onSecondaryAction?: () => void;
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

interface AtlasScreenProps extends AtlasFrameHandlers {
  frame: AtlasFrameId;
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
}

export function AtlasScreen({
  frame,
  embedded = false,
  onPrimaryAction,
  onSecondaryAction,
  subtitleOverride,
  nextEvent,
  avatarInitial,
  useMapLibre = false,
}: AtlasScreenProps) {
  const handlers: AtlasFrameHandlers & { avatarInitial?: string; useMapLibre?: boolean } = {
    onPrimaryAction,
    onSecondaryAction,
    subtitleOverride,
    nextEvent,
    avatarInitial,
    useMapLibre,
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
  avatarInitial = 'F',
}: {
  title: string;
  subtitle: string;
  avatarInitial?: string;
}) {
  return (
    <View style={shellStyles.topChromeRow}>
      <View style={{ flex: 1 }}>
        <Text style={shellStyles.title}>{title}</Text>
        <View style={shellStyles.subtitleRow}>
          <View style={shellStyles.subtitleDot} />
          <Text style={shellStyles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={shellStyles.topRight}>
        <Pressable style={shellStyles.glyphBtn} hitSlop={6}>
          <Ionicons name="search" size={16} color={IOS_REGISTER.label} />
        </Pressable>
        <Pressable style={shellStyles.glyphBtn} hitSlop={6}>
          <Ionicons name="layers-outline" size={16} color={IOS_REGISTER.label} />
        </Pressable>
        <View style={shellStyles.avatar}>
          <Text style={shellStyles.avatarText}>{avatarInitial}</Text>
        </View>
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

function FilterChipsRow({ chips }: { chips: FilterChipItem[] }) {
  // Local toggle state — chips are interactive even though the underlying
  // query layer is not wired yet. Initial active chip is whichever item
  // shipped active=true. Multi-select on data peer chips (You/Crew/Fleet
  // etc.), single-select on the leading "All" / sticky chip.
  const initialActive = chips.filter((c) => c.active).map((c) => c.id);
  const [activeIds, setActiveIds] = useState<string[]>(
    initialActive.length > 0 ? initialActive : [chips[0]?.id].filter(Boolean) as string[],
  );

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
}: {
  onLayersPress?: () => void;
  onDropPinPress?: () => void;
  commitMode?: boolean;
}) {
  return (
    <View style={shellStyles.fabColumn} pointerEvents="box-none">
      <Pressable style={shellStyles.fab} onPress={onLayersPress} hitSlop={6}>
        <Ionicons name="layers-outline" size={16} color="rgba(60, 60, 67, 0.78)" />
      </Pressable>
      <Pressable style={shellStyles.fab} hitSlop={6}>
        <Ionicons name="locate-outline" size={16} color="rgba(60, 60, 67, 0.78)" />
      </Pressable>
      {onDropPinPress ? (
        <Pressable
          style={[shellStyles.fab, commitMode && shellStyles.fabActive]}
          onPress={onDropPinPress}
          hitSlop={6}
        >
          <Ionicons
            name={commitMode ? 'close' : 'add-circle-outline'}
            size={16}
            color={commitMode ? '#FFFFFF' : IOS_REGISTER.accentUserAction}
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
}: {
  frame: AtlasFrameId;
  onClose: () => void;
}) {
  const layers = getLayersForFrame(frame);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(
    () => new Set(layers.filter((l) => l.defaultOn).map((l) => l.key)),
  );

  const toggle = (item: LayerItem) => {
    if (item.locked) return;
    setActiveKeys((prev) => {
      const next = new Set(prev);
      if (next.has(item.key)) next.delete(item.key);
      else next.add(item.key);
      return next;
    });
  };

  return (
    <>
      <Pressable style={shellStyles.layersBackdrop} onPress={onClose} />
      <View style={shellStyles.layersSheet}>
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
  // picker IS the real surface in a different mode.
  const [commitMode, setCommitMode] = useState(false);
  const [candidate, setCandidate] = useState<{ lng: number; lat: number } | null>(null);
  const exitCommit = useCallback(() => {
    setCommitMode(false);
    setCandidate(null);
  }, []);
  const handleDropPinPress = useCallback(() => {
    if (commitMode) exitCommit();
    else setCommitMode(true);
  }, [commitMode, exitCommit]);
  const handleMapPress = useCallback(
    (coords: { lng: number; lat: number }) => {
      if (commitMode) setCandidate(coords);
    },
    [commitMode],
  );
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="Atlas"
        subtitle={handlers.subtitleOverride ?? 'Sailing · RHKYC · Hong Kong'}
        avatarInitial={handlers.avatarInitial ?? "F"}
      />
      <FilterChipsRow
        chips={[
          { id: 'all', label: 'All', active: true },
          { id: 'you', label: 'You', tone: 'you' },
          { id: 'crew', label: 'Crew', tone: 'crew' },
          { id: 'fleet', label: 'Fleet', tone: 'fleet' },
          { id: 'following', label: 'Following', tone: 'following', dim: true },
          { id: 'cross-interest', label: 'All my interests', crossInterest: true, dim: true },
        ]}
      />
      <View style={shellStyles.mapArea}>
        {handlers.useMapLibre ? (
          <AtlasMapLibreCanvas
            frame="f1"
            onMapPress={commitMode ? handleMapPress : undefined}
            candidate={candidate}
          />
        ) : (
          <HongKongOverviewMap />
        )}

        {/* Racing-area last-race tags + the user's base pin only render
            once real resolver data is wired. Until then the labels would
            be fiction — see Phase A1 resolvers in the brief. */}
        {hasNext && !commitMode && (
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

        {/* Highlighted next-event tag on Victoria Harbour. Rendered LAST so
            it stacks above the peer pins; otherwise the pins occlude the
            tag's detail line. */}
        {hasNext && !commitMode && (
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
          onLayersPress={() => setLayersOpen(true)}
          onDropPinPress={handlers.useMapLibre ? handleDropPinPress : undefined}
          commitMode={commitMode}
        />
      </View>

      {candidate ? (
        <BottomSheet
          eyebrow="PIN DROPPED"
          title="Anchor a step at this location."
          body={`${candidate.lat.toFixed(4)} N · ${candidate.lng.toFixed(4)} E`}
          primary={{
            label: 'Plan a step here',
            icon: 'add',
            onPress: () => {
              exitCommit();
              handlers.onPrimaryAction?.();
            },
          }}
          secondary={{ label: 'Cancel', onPress: exitCommit }}
        />
      ) : hasNext ? (
        <BottomSheet
          eyebrow="NEXT · PRE-STAGED"
          title={`Plan a step for ${next!.label}.`}
          body={[next!.where, next!.when].filter(Boolean).join(' · ')}
          primary={{ label: 'Plan a step', icon: 'add', onPress: handlers.onPrimaryAction }}
          secondary={{ label: `Open ${next!.label}`, onPress: handlers.onSecondaryAction }}
        />
      ) : (
        <BottomSheet
          eyebrow="PLAN A STEP"
          title="Anchor your next step to a place."
          body="Drop a pin on the map, or pick a spot from your venues."
          primary={{ label: 'Plan a step', icon: 'add', onPress: handlers.onPrimaryAction }}
        />
      )}

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && <LayersSheet frame="f1" onClose={() => setLayersOpen(false)} />}
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

        <LayersFab onLayersPress={() => setLayersOpen(true)} />
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

      {layersOpen && <LayersSheet frame="f2" onClose={() => setLayersOpen(false)} />}
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
        <LayersFab onLayersPress={() => setLayersOpen(true)} />
      </View>

      <BottomSheet
        eyebrow="INTERNATIONAL PEERS · CLASS LENS"
        title="The Dragon community on one canvas."
        body="Zoom in to a fleet to see its pins. Race marks fade between zoom 8 — 9 to keep the world readable."
        primary={{ label: 'Back to Hong Kong', icon: 'arrow-back', onPress: handlers.onPrimaryAction }}
        secondary={{ label: 'Follow Amsterdam', onPress: handlers.onSecondaryAction }}
      />

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && <LayersSheet frame="f3" onClose={() => setLayersOpen(false)} />}
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
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="Atlas"
        subtitle={handlers.subtitleOverride ?? 'Nursing · MSN · Baltimore'}
        avatarInitial={handlers.avatarInitial ?? "E"}
      />
      <FilterChipsRow
        chips={[
          { id: 'all', label: 'All', active: true },
          { id: 'you', label: 'You', tone: 'you' },
          { id: 'cohort', label: 'Cohort', tone: 'cohort', dim: true },
          { id: 'sites', label: 'Clinical sites', icon: 'medical-outline' },
          { id: 'following', label: 'Following', tone: 'following', dim: true },
          { id: 'cross-interest', label: 'All my interests', crossInterest: true, dim: true },
        ]}
      />
      <View style={shellStyles.mapArea}>
        {handlers.useMapLibre ? (
          <AtlasMapLibreCanvas frame="f4" />
        ) : (
          <BaltimoreColdMap />
        )}

        {/* Site-level only banner */}
        <View style={[shellStyles.absChip, { top: 12, right: 12 }]}>
          <Ionicons name="lock-closed" size={9} color="rgba(60, 60, 67, 0.55)" />
          <Text style={shellStyles.absChipText}>site-level only</Text>
        </View>

        {/* Generic OSM-sourced healthcare POIs */}
        <AtlasPin kind="osm-clinic" leftPct={48} topPct={50} label="Johns Hopkins Hosp." />
        <AtlasPin kind="osm-clinic" leftPct={72} topPct={42} label="Bayview" />
        <AtlasPin kind="osm-clinic" leftPct={22} topPct={62} label="U. of Maryland" />
        <AtlasPin kind="osm-clinic" leftPct={18} topPct={45} label="Sinai" />
        {/* MedStar moved up + left from 55,75 so its label does not collide
            with the "INNER HARBOR" italic water label below it. */}
        <AtlasPin kind="osm-clinic" leftPct={62} topPct={82} label="MedStar Harbor" />
        <AtlasPin kind="osm-clinic" leftPct={86} topPct={66} label="VA Medical Ctr." />

        {/* Ghost-pin sample stamp — fades when real cohort joins */}
        <GhostStampOverlay leftPct={50} topPct={32} />

        <LayersFab onLayersPress={() => setLayersOpen(true)} />
      </View>

      {anchorPromptDismissed ? (
        <BottomSheet
          eyebrow="PLAN A STEP"
          title="Anchor your next step to a place."
          body="Drop a pin on the map, or pick a spot from your venues."
          primary={{ label: 'Plan a step', icon: 'add', onPress: handlers.onPrimaryAction }}
        />
      ) : (
        <BottomSheet
          eyebrow="FIRST STEP · ANCHOR WHERE"
          title="Tag your last clinical step to where it happened."
          body={'From your timeline: "Med-surg shift · Tuesday morning." One tap to anchor.'}
          primary={{ label: 'Anchor · pick site', icon: 'location', onPress: handlers.onPrimaryAction }}
          secondary={{
            label: 'Skip',
            onPress: () => {
              setAnchorPromptDismissed(true);
              handlers.onSecondaryAction?.();
            },
          }}
        />
      )}

      {!embedded && <MockTabBar activeTab="atlas" />}

      {layersOpen && <LayersSheet frame="f4" onClose={() => setLayersOpen(false)} />}
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

        {/* JH-claimed sites with counts (constellation across affiliates).
            Positions spread enough that the labels below each pin don't
            overlap; shortened "Hopkins East Baltimore" → "Hopkins EB" to
            fit the pin's label width and match the bottom-sheet stat. */}
        <AtlasPin
          kind="jh-site"
          leftPct={55}
          topPct={48}
          label="Hopkins EB"
          badge="JH"
        />
        {/* Large peer count bubble — shifted further right of Hopkins so
            it does not jam against the site label. */}
        <View style={[shellStyles.absChip, { top: '38%', left: '68%', backgroundColor: '#AF52DE' }]}>
          <Text style={[shellStyles.absChipText, { color: '#FFF', fontWeight: '700' }]}>12</Text>
        </View>

        <AtlasPin kind="jh-site" leftPct={82} topPct={56} label="Bayview" badge="JH" />
        <AtlasPin kind="jh-site" leftPct={18} topPct={62} label="Suburban" badge="JH" />
        {/* Howard County shifted left so its label clears the layers FAB */}
        <AtlasPin kind="jh-site" leftPct={66} topPct={80} label="Howard County" badge="JH" />
        <AtlasPin kind="sim" leftPct={32} topPct={28} label="Pinkard" />

        <LayersFab onLayersPress={() => setLayersOpen(true)} />
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

      {layersOpen && <LayersSheet frame="f5" onClose={() => setLayersOpen(false)} />}
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
        {/* Candidate pin where the user tapped */}
        <AtlasPin kind="candidate" leftPct={50} topPct={48} />

        <LayersFab onLayersPress={() => setLayersOpen(true)} />
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

      {layersOpen && <LayersSheet frame="f6" onClose={() => setLayersOpen(false)} />}
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
}

function BottomSheet({
  eyebrow,
  title,
  body,
  peerHeader,
  statsRow,
  primary,
  secondary,
}: BottomSheetProps) {
  return (
    <View style={shellStyles.bottomSheet}>
      {eyebrow ? <Text style={shellStyles.eyebrow}>{eyebrow}</Text> : null}
      {peerHeader ? (
        <View>
          <Text style={shellStyles.peerName}>
            {peerHeader.name} <Text style={shellStyles.peerQuote}>· {peerHeader.quote}</Text>
          </Text>
          <Text style={shellStyles.peerEyebrow}>{peerHeader.eyebrow}</Text>
        </View>
      ) : null}
      {title ? <Text style={shellStyles.sheetTitle}>{title}</Text> : null}
      {body ? <Text style={shellStyles.sheetBody}>{body}</Text> : null}
      {statsRow ? (
        <View style={shellStyles.statsRow}>
          {statsRow.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </View>
      ) : null}
      {(primary || secondary) && (
        <View style={shellStyles.btnRow}>
          {primary ? (
            <Pressable onPress={primary.onPress} style={[shellStyles.btn, shellStyles.btnPrimary]}>
              {primary.icon ? <Ionicons name={primary.icon} size={14} color="#FFF" /> : null}
              <Text style={shellStyles.btnPrimaryText}>{primary.label}</Text>
            </Pressable>
          ) : null}
          {secondary ? (
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
  commitBannerInline: {
    position: 'absolute',
    top: 12,
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
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: '#FFFFFF',
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
