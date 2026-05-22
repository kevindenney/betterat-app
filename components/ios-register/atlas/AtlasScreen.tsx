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

import React, { useState } from 'react';
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
}

export function AtlasScreen({
  frame,
  embedded = false,
  onPrimaryAction,
  onSecondaryAction,
  subtitleOverride,
  nextEvent,
}: AtlasScreenProps) {
  const handlers: AtlasFrameHandlers = {
    onPrimaryAction,
    onSecondaryAction,
    subtitleOverride,
    nextEvent,
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
      {icon ? (
        <Ionicons
          name={icon}
          size={11}
          color={active ? '#FFFFFF' : 'rgba(60, 60, 67, 0.72)'}
          style={{ marginRight: 4 }}
        />
      ) : null}
      {tone ? (
        <View style={[shellStyles.chipDot, { backgroundColor: toneDot[tone] }]} />
      ) : null}
      <Text style={[shellStyles.chipText, active && shellStyles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LayersFab() {
  return (
    <View pointerEvents="none" style={shellStyles.fabColumn}>
      <View style={shellStyles.fab}>
        <Ionicons name="layers-outline" size={16} color="rgba(60, 60, 67, 0.78)" />
      </View>
      <View style={shellStyles.fab}>
        <Ionicons name="locate-outline" size={16} color="rgba(60, 60, 67, 0.78)" />
      </View>
    </View>
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
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="Atlas"
        subtitle={handlers.subtitleOverride ?? 'Sailing · RHKYC · Hong Kong'}
        avatarInitial="F"
      />
      <FilterChipsRow
        chips={[
          { id: 'all', label: 'All', active: true },
          { id: 'you', label: 'You', tone: 'you' },
          { id: 'crew', label: 'Crew', tone: 'crew' },
          { id: 'fleet', label: 'Fleet', tone: 'fleet' },
          { id: 'following', label: 'Following', tone: 'following', dim: true },
        ]}
      />
      <View style={shellStyles.mapArea}>
        <HongKongOverviewMap />

        {/* Racing-area last-race tags + the user's base pin only render
            once real resolver data is wired. Until then the labels would
            be fiction — see Phase A1 resolvers in the brief. */}
        {hasNext && (
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
            the harbor cleanly. */}
        <AtlasPin kind="crew" leftPct={22} topPct={44} />
        <AtlasPin kind="fleet" leftPct={32} topPct={50} />
        <AtlasPin kind="fleet" leftPct={42} topPct={45} />
        <AtlasPin kind="following" leftPct={48} topPct={52} />
        <AtlasPin kind="fleet" leftPct={56} topPct={44} />
        <AtlasPin kind="crew" leftPct={66} topPct={47} />
        <AtlasPin kind="fleet" leftPct={72} topPct={50} />
        <AtlasPin kind="following" leftPct={28} topPct={56} />
        <AtlasPin kind="following" leftPct={50} topPct={62} />

        {/* Highlighted next-event tag on Victoria Harbour. Rendered LAST so
            it stacks above the peer pins; otherwise the pins occlude the
            tag's detail line. */}
        {hasNext && (
          <NextEventTag
            leftPct={50}
            topPct={47}
            eyebrow={`NEXT · ${next!.label.toUpperCase()}${next!.when ? ` · ${next!.when.toUpperCase()}` : ''}`}
            detail={next!.conditions}
          />
        )}

        <LayersFab />
      </View>

      {hasNext ? (
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// F2 — Race-marks zoom (Victoria Harbour)
// ---------------------------------------------------------------------------
function FrameF2({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="Race 4 course"
        subtitle={handlers.subtitleOverride ?? 'RHKYC · Victoria Harbour · Sat 10:00'}
        avatarInitial="F"
      />
      <FilterChipsRow
        chips={[
          { id: 'marks', label: 'Race marks', icon: 'triangle-outline', active: true },
          { id: 'crew', label: 'Crew', tone: 'crew' },
          { id: 'fleet', label: 'Fleet', tone: 'fleet' },
          { id: 'wind', label: 'Wind', icon: 'flag-outline' },
          { id: 'tide', label: 'Tide', icon: 'water-outline' },
        ]}
      />
      <View style={shellStyles.mapArea}>
        <RaceMarksZoomMap />

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

        <LayersFab />
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// F3 — World Dragon (cross-fleet class lens)
// ---------------------------------------------------------------------------
function FrameF3({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="Dragon world"
        subtitle={handlers.subtitleOverride ?? '4 fleets · 1 class · zoom 3'}
        avatarInitial="F"
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
        <WorldDragonMap />
        {/* Cluster bubbles spaced enough that the labels don't touch.
            Amsterdam (NL), Vilamoura (Worlds, PT) and HK are real
            geographic positions on the canonical world map; tightened
            slightly so the bubbles fit the phone column without
            collision. */}
        <ClusterTag leftPct={58} topPct={18} label="AMSTERDAM" count="18 sailors" />
        <ClusterTag leftPct={82} topPct={45} label="RHKYC · 24" count="SAILORS" highlight />
        <ClusterTag leftPct={38} topPct={38} label="WORLDS 2026" count="VILAMOURA" />
        <LayersFab />
      </View>

      <BottomSheet
        eyebrow="INTERNATIONAL PEERS · CLASS LENS"
        title="The Dragon community on one canvas."
        body="Zoom in to a fleet to see its pins. Race marks fade between zoom 8 — 9 to keep the world readable."
        primary={{ label: 'Back to Hong Kong', icon: 'arrow-back', onPress: handlers.onPrimaryAction }}
        secondary={{ label: 'Follow Amsterdam', onPress: handlers.onSecondaryAction }}
      />

      {!embedded && <MockTabBar activeTab="atlas" />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// F4 — Emily · Baltimore cold
// ---------------------------------------------------------------------------
function FrameF4({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="Atlas"
        subtitle={handlers.subtitleOverride ?? 'Nursing · MSN · Baltimore'}
        avatarInitial="E"
      />
      <FilterChipsRow
        chips={[
          { id: 'all', label: 'All', active: true },
          { id: 'you', label: 'You', tone: 'you' },
          { id: 'cohort', label: 'Cohort', tone: 'cohort', dim: true },
          { id: 'sites', label: 'Clinical sites', icon: 'medical-outline' },
          { id: 'following', label: 'Following', tone: 'following', dim: true },
        ]}
      />
      <View style={shellStyles.mapArea}>
        <BaltimoreColdMap />

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

        <LayersFab />
      </View>

      <BottomSheet
        eyebrow="FIRST STEP · ANCHOR WHERE"
        title="Tag your last clinical step to where it happened."
        body={'From your timeline: "Med-surg shift · Tuesday morning." One tap to anchor.'}
        primary={{ label: 'Anchor · pick site', icon: 'location', onPress: handlers.onPrimaryAction }}
        secondary={{ label: 'Skip', onPress: handlers.onSecondaryAction }}
      />

      {!embedded && <MockTabBar activeTab="atlas" />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// F5 — Emily · JHU curated (competency overlay live)
// ---------------------------------------------------------------------------
function FrameF5({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
  return (
    <View style={shellStyles.frame}>
      {!embedded && <StatusBar />}
      <TopChrome
        title="IV insertion · supervised"
        subtitle={handlers.subtitleOverride ?? '62 in cohort · 4 sites evidenced'}
        avatarInitial="E"
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
        <JhuCuratedMap />

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

        <LayersFab />
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// F6 — Commit-mode (opened from Plan · Where)
// ---------------------------------------------------------------------------
function FrameF6({ embedded, handlers }: { embedded: boolean; handlers: AtlasFrameHandlers }) {
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
        <CommitHarbourMap />
        {/* Candidate pin where the user tapped */}
        <AtlasPin kind="candidate" leftPct={50} topPct={48} />

        <LayersFab />
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
