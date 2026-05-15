/**
 * RaceLogScreen — iOS-register historical archive surface.
 *
 * The deeper, denser counterpart to RaceCardsScreen: where the cards view
 * shows one season's five steps as a horizontal arc, this is the multi-year
 * archive — every race the user has sailed, grouped by season, scrolled
 * vertically.
 *
 * Same iOS register vocabulary, different temporal scale:
 *   - cards view = furniture surface, 268pt covers, 1.3 visible
 *   - log view   = thread-list density, ~66pt per row, Apple Mail pacing
 *
 * The four-state grammar (debriefed / in progress / current / planned)
 * carries down from the cards view into the archive — same pill, same
 * colors, same dot grammar. **No earned-exception treatment on the current
 * entry**: this is navigation, not a decision surface (per design intent).
 *
 * Visual source: Claude Design "Race Log · Felix sailing · iOS register"
 * handoff. See docs/redesign/IOS_MIGRATION_PLAN.md.
 */

import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { StepCardStatus } from './StepCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RaceLogConceptDot {
  /** Muted variant — tertiary fill instead of coral, used on planned entries. */
  muted?: boolean;
}

export interface RaceLogEntryItem {
  /** Stable id — routed to /race/ios/[stepId] on tap. */
  id: string;
  /** "01", "02", … — pre-formatted ordinal in the season. */
  num: string;
  /** Display name. */
  name: string;
  /** "Dec 14", "Saturday", "Feb 22". */
  dateLabel: string;
  /** "Steady N · 14 kn", "Building NE", "Light & shifty", "Forecast pending". */
  conditionsLabel?: string;
  status: StepCardStatus;
  /**
   * Status-specific trailing copy on the meta line. Caller picks one:
   *   captures   → "12 captures"
   *   pending    → "debrief pending" (amber)
   *   plan       → "plan in draft · 3 beats" (iOS blue)
   *   notStarted → "not started" (italic tertiary)
   */
  trailing?: {
    captures?: number;
    pending?: string;
    plan?: string;
    notStarted?: boolean;
  };
  /** Up to 2 coral concept dots after the name; muted means tertiary fill. */
  conceptDots?: RaceLogConceptDot[];
}

export interface RaceLogSeason {
  /** Stable id — used for the collapse-toggle key. */
  id: string;
  /** "Winter 2025-2026". */
  name: string;
  /** Right-aligned header summary: "5 races · 3 debriefed". */
  summary?: string;
  /** Optional default-collapsed state on initial render. */
  defaultCollapsed?: boolean;
  entries: RaceLogEntryItem[];
}

export interface RaceLogFilterChip {
  id: string;
  label: string;
  /** Filled "on" state vs idle. */
  active?: boolean;
  /** Picker variant — transparent fill, blue label, trailing chevron. */
  picker?: boolean;
  /** Leading glyph (Ionicons name). Optional. */
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export type ReflectSubTab = 'progress' | 'race-log' | 'profile';

interface Props {
  /**
   * When true (default), render the Race Log top-chrome (nav title +
   * search) and the Reflect sub-tabs segmented control. When false, the
   * parent screen owns those affordances (cutover-time wiring).
   */
  showChrome?: boolean;
  /** Active sub-tab — only used when chrome is shown. Defaults to race-log. */
  activeSubTab?: ReflectSubTab;
  onSubTabChange?: (tab: ReflectSubTab) => void;
  onSearchPress?: () => void;
  /** Filter chips above the season list. Order and selected state are caller-controlled. */
  filterChips?: RaceLogFilterChip[];
  seasons: RaceLogSeason[];
  onEntryPress?: (entry: RaceLogEntryItem, season: RaceLogSeason) => void;
  /** Footer hint under the seasons — design example: "Autumn 2024, Summer 2024…" */
  feedFootHint?: string;
  /**
   * Bottom inset so the feed clears the floating tab bar. Caller passes
   * safe-area + 64pt tab + 22pt float offset. Defaults to 130.
   */
  bottomPad?: number;
  /**
   * Top inset for the inner ScrollView's contentContainerStyle. When
   * embedded inside a tab that overlays a translucent toolbar, the caller
   * passes the measured toolbar height so the feed scrolls beneath it
   * rather than starting hidden under it. Defaults to 0.
   */
  topInset?: number;
  /** Forwarded to the inner ScrollView (e.g. for scroll-driven toolbar hide). */
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll'];
}

// ---------------------------------------------------------------------------

export function RaceLogScreen({
  showChrome = true,
  activeSubTab = 'race-log',
  onSubTabChange,
  onSearchPress,
  filterChips,
  seasons,
  onEntryPress,
  feedFootHint,
  bottomPad = 130,
  topInset = 0,
  onScroll,
}: Props) {
  return (
    <View style={styles.screen}>
      {showChrome && (
        <>
          <View style={styles.topChrome}>
            <Text style={styles.navTitle}>Race Log</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search"
              onPress={onSearchPress}
              hitSlop={8}
            >
              <Ionicons
                name="search"
                size={21}
                color={IOS_REGISTER.accentUserAction}
              />
            </Pressable>
          </View>

          <SubTabs active={activeSubTab} onChange={onSubTabChange} />
        </>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: bottomPad }}
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? 16 : undefined}
      >
        {filterChips && filterChips.length > 0 && (
          <FilterChipRow chips={filterChips} />
        )}

        {seasons.map((season) => (
          <SeasonGroup
            key={season.id}
            season={season}
            onEntryPress={(entry) => onEntryPress?.(entry, season)}
          />
        ))}

        {feedFootHint ? (
          <Text style={styles.feedFoot}>{feedFootHint}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-tab segmented control — Progress / Race Log / Profile
// ---------------------------------------------------------------------------

function SubTabs({
  active,
  onChange,
}: {
  active: ReflectSubTab;
  onChange?: (tab: ReflectSubTab) => void;
}) {
  const tabs: { id: ReflectSubTab; label: string }[] = [
    { id: 'progress', label: 'Progress' },
    { id: 'race-log', label: 'Race Log' },
    { id: 'profile', label: 'Profile' },
  ];
  return (
    <View style={styles.subtabs} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange?.(t.id)}
            style={[styles.seg, on && styles.segOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.segLabel, on && styles.segLabelOn]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Filter chip row — All / This year / scope / season picker
// ---------------------------------------------------------------------------

function FilterChipRow({ chips }: { chips: RaceLogFilterChip[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRowContent}
    >
      {chips.map((c) => (
        <FilterChip key={c.id} chip={c} />
      ))}
      <View style={{ width: 8 }} />
    </ScrollView>
  );
}

function FilterChip({ chip }: { chip: RaceLogFilterChip }) {
  const isPicker = !!chip.picker;
  return (
    <Pressable
      onPress={chip.onPress}
      style={[
        styles.chip,
        chip.active && styles.chipActive,
        isPicker && styles.chipPicker,
      ]}
      accessibilityRole="button"
      accessibilityLabel={chip.label}
    >
      {chip.icon && (
        <Ionicons
          name={chip.icon}
          size={13}
          color={
            isPicker
              ? IOS_REGISTER.accentUserAction
              : IOS_REGISTER.label
          }
        />
      )}
      <Text
        style={[
          styles.chipLabel,
          isPicker && { color: IOS_REGISTER.accentUserAction },
        ]}
      >
        {chip.label}
      </Text>
      {isPicker && (
        <Ionicons
          name="chevron-down"
          size={11}
          color={IOS_REGISTER.accentUserAction}
        />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Season group — collapsible header + entries
// ---------------------------------------------------------------------------

function SeasonGroup({
  season,
  onEntryPress,
}: {
  season: RaceLogSeason;
  onEntryPress: (entry: RaceLogEntryItem) => void;
}) {
  const [collapsed, setCollapsed] = useState(!!season.defaultCollapsed);
  return (
    <View style={styles.season}>
      <Pressable
        onPress={() => setCollapsed((c) => !c)}
        style={styles.seasonHead}
        accessibilityRole="button"
        accessibilityLabel={`${season.name} — ${
          collapsed ? 'expand' : 'collapse'
        }`}
      >
        <View
          style={[
            styles.seasonChev,
            collapsed && { transform: [{ rotate: '-90deg' }] },
          ]}
        >
          <Ionicons
            name="chevron-down"
            size={16}
            color={IOS_REGISTER.labelSecondary}
          />
        </View>
        <Text style={styles.seasonName}>{season.name}</Text>
        {season.summary ? (
          <Text style={styles.seasonSummary}>{season.summary}</Text>
        ) : null}
      </Pressable>

      {!collapsed && season.entries.length > 0 && (
        <View style={styles.entries}>
          {season.entries.map((entry, idx) => (
            <RaceLogEntry
              key={entry.id}
              entry={entry}
              isFirst={idx === 0}
              isLast={idx === season.entries.length - 1}
              onPress={() => onEntryPress(entry)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Race log entry row — Apple Mail thread-list density
// ---------------------------------------------------------------------------

function RaceLogEntry({
  entry,
  isFirst,
  isLast,
  onPress,
}: {
  entry: RaceLogEntryItem;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const isCurrent = entry.status === 'current';
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.entry,
        !isFirst && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: IOS_REGISTER.separator,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.num} — ${entry.name}`}
    >
      <View style={styles.numCol}>
        <Text
          style={[
            styles.num,
            isCurrent && {
              color: IOS_REGISTER.accentUserAction,
              fontWeight: '600',
            },
          ]}
        >
          {entry.num}
        </Text>
        {!isLast && <View style={styles.numRail} />}
      </View>

      <View style={styles.entryBody}>
        <View style={styles.entryNameRow}>
          <Text style={styles.entryName} numberOfLines={1}>
            {entry.name}
          </Text>
          {entry.conceptDots && entry.conceptDots.length > 0 && (
            <View style={styles.conceptDotsRow}>
              {entry.conceptDots.map((d, i) => (
                <View
                  key={i}
                  style={[
                    styles.conceptDot,
                    d.muted && {
                      backgroundColor: IOS_REGISTER.labelTertiary,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
        <Text style={styles.entryMeta} numberOfLines={1}>
          <Text>{entry.dateLabel}</Text>
          {entry.conditionsLabel ? (
            <>
              <Text style={styles.metaSep}> · </Text>
              <Text>{entry.conditionsLabel}</Text>
            </>
          ) : null}
          {renderTrailing(entry.trailing)}
        </Text>
      </View>

      <View style={styles.entryRight}>
        <StatusPill status={entry.status} />
      </View>

      <Ionicons
        name="chevron-forward"
        size={15}
        color={IOS_REGISTER.labelTertiary}
      />
    </Pressable>
  );
}

function renderTrailing(trailing?: RaceLogEntryItem['trailing']) {
  if (!trailing) return null;
  const { captures, pending, plan, notStarted } = trailing;
  const parts: React.ReactNode[] = [];
  if (typeof captures === 'number') {
    parts.push(
      <Text key="cap">
        {captures} {captures === 1 ? 'capture' : 'captures'}
      </Text>,
    );
  }
  if (pending) {
    parts.push(
      <Text key="pending" style={{ color: '#8A6418', fontWeight: '500' }}>
        {pending}
      </Text>,
    );
  }
  if (plan) {
    parts.push(
      <Text
        key="plan"
        style={{
          color: IOS_REGISTER.accentUserAction,
          fontWeight: '500',
        }}
      >
        {plan}
      </Text>,
    );
  }
  if (notStarted) {
    parts.push(
      <Text
        key="ns"
        style={{
          color: IOS_REGISTER.labelTertiary,
          fontStyle: 'italic',
        }}
      >
        not started
      </Text>,
    );
  }
  if (parts.length === 0) return null;
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    out.push(<Text key={`sep${i}`} style={styles.metaSep}> · </Text>);
    out.push(p);
  });
  return <>{out}</>;
}

// ---------------------------------------------------------------------------
// Status pill — same grammar as RaceCardsScreen (no earned-exception here)
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: StepCardStatus }) {
  if (status === 'debriefed') {
    return (
      <View style={[styles.pill, { backgroundColor: 'rgba(52, 199, 89, 0.12)' }]}>
        <Ionicons name="checkmark" size={10} color="#1F7A3A" />
        <Text style={[styles.pillText, { color: '#1F7A3A' }]}>Debriefed</Text>
      </View>
    );
  }
  if (status === 'in_progress') {
    return (
      <View style={[styles.pill, { backgroundColor: 'rgba(201, 150, 50, 0.14)' }]}>
        <View style={[styles.pillDot, { backgroundColor: '#8A6418' }]} />
        <Text style={[styles.pillText, { color: '#8A6418' }]}>In progress</Text>
      </View>
    );
  }
  if (status === 'current') {
    // No earned-exception on the entry — only the pill carries state.
    return (
      <View style={[styles.pill, { backgroundColor: IOS_REGISTER.accentUserAction }]}>
        <View style={[styles.pillDot, { backgroundColor: '#fff' }]} />
        <Text style={[styles.pillText, { color: '#fff' }]}>Current</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, { backgroundColor: '#E5E5EA' }]}>
      <View style={[styles.pillDot, { backgroundColor: IOS_REGISTER.labelTertiary }]} />
      <Text style={[styles.pillText, { color: IOS_REGISTER.labelSecondary }]}>
        Planned
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  // ----- top chrome -----
  topChrome: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: IOS_REGISTER.label,
  },
  // ----- sub-tab segmented control -----
  subtabs: {
    marginHorizontal: 16,
    marginTop: 6,
    padding: 2,
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: 9,
    flexDirection: 'row',
    height: 32,
  },
  seg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  segOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 1,
  },
  segLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.08,
    color: IOS_REGISTER.label,
  },
  segLabelOn: {
    fontWeight: '600',
  },
  // ----- filter chips -----
  filterRowContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFEFF4',
  },
  chipActive: {
    backgroundColor: 'rgba(60, 60, 67, 0.22)',
  },
  chipPicker: {
    backgroundColor: 'transparent',
    paddingLeft: 8,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: IOS_REGISTER.label,
  },
  // ----- season group -----
  season: {
    marginTop: 22,
  },
  seasonHead: {
    marginHorizontal: 16,
    marginBottom: 6,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  seasonChev: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonName: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.35,
    color: IOS_REGISTER.label,
  },
  seasonSummary: {
    marginLeft: 'auto',
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },
  entries: {
    marginHorizontal: 16,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // ----- entry row -----
  entry: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  numCol: {
    width: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 3,
  },
  num: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 17,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: -0.34,
    fontVariant: ['tabular-nums'],
    marginBottom: 2,
  },
  numRail: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
    marginTop: 3,
  },
  entryBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  entryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.24,
    color: IOS_REGISTER.label,
    lineHeight: 18,
  },
  conceptDotsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  conceptDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  entryMeta: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.08,
    lineHeight: 17,
  },
  metaSep: {
    color: IOS_REGISTER.labelTertiary,
  },
  entryRight: {
    alignItems: 'flex-end',
  },
  // ----- pill -----
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  // ----- feed foot -----
  feedFoot: {
    paddingHorizontal: 24,
    paddingTop: 24,
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    lineHeight: 18,
    letterSpacing: -0.05,
    textAlign: 'center',
  },
});
