/**
 * Surface B · Fleet Plans — peer cards for a single blueprint's subscribers.
 *
 * Hero: "Same race · same blueprint" green eyebrow, italic-serif quoted
 * title, summary stats (Subscribed / Active 7d / On step N).
 *
 * Filters: All / On step N / Ahead / Behind.
 *
 * Each peer card: avatar, name + club, current step + last activity,
 * status chip (Same step / Ahead / Behind), mini progress bar, "N/total"
 * step tag.
 */

import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Anchor,
  ArrowUp,
  Check,
  ChevronLeft,
  Filter as FilterIcon,
  Flag,
} from 'lucide-react-native';

export type FleetPeerStatus = 'same-step' | 'ahead' | 'behind';

export interface FleetPeer {
  id: string;
  initials: string;
  /** "PL" "BV" "SN" "KH" "MO" "TS" — same swatch set used elsewhere. */
  avatarColorKey?: 'navy' | 'green' | 'purple' | 'brown' | 'gold';
  name: string;
  /** "RHKYC · HKG-12" */
  whereLine: string;
  /** "On Step 4 · Boat-speed baseline · captured 2 sessions" */
  activityLine: string;
  /** Current step number; renders in the "N/total" tag and the mini progress bar. */
  currentStepNumber: number;
  totalSteps: number;
  status: FleetPeerStatus;
}

export interface FleetPlansViewProps {
  /** "Worlds Fleet" — title-bar copy. */
  topTitle?: string;
  /** "Practice" — back-button copy. */
  backLabel?: string;
  /** "Worlds Fleet · \"Prepare for the Worlds\"" hero title. */
  heroTitle: string;
  /** "Same race · same blueprint" eyebrow. */
  heroEyebrow?: string;
  /** "63 sailors subscribed · 8 in your week" */
  metaLine: string;
  /** Stats grid above the filter chips. */
  stats: { value: number; label: string }[];
  /** The step number the viewer is currently on — labels the "On step N" filter. */
  viewerCurrentStepNumber?: number;
  peers: FleetPeer[];
  onBack?: () => void;
  onFilterTap?: () => void;
  onPeerTap?: (peer: FleetPeer) => void;
}

type Filter = 'all' | 'same-step' | 'ahead' | 'behind';

const C = {
  page: '#F2F2F7',
  card: '#FFFFFF',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  label4: '#C7C7CC',
  line: '#E5E5EA',
  gray6: '#F2F2F7',
  blue: '#007AFF',
  blueDeep: '#0040DD',
  blueStrong: '#A8C8FF',
  blueTint: '#E6F0FF',
  green: '#34C759',
  greenDeep: '#0A6B2A',
  greenSoft: '#B7E8C2',
  greenTint: '#E8F8EC',
  serif: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }) as string,
};

const AVATAR_GRADIENTS: Record<NonNullable<FleetPeer['avatarColorKey']>, string> = {
  navy: '#4E6A85',
  green: '#3E6C4E',
  purple: '#5C3F7A',
  brown: '#4A3F2E',
  gold: '#8E6320',
};

export function FleetPlansView({
  topTitle = 'Worlds Fleet',
  backLabel = 'Practice',
  heroTitle,
  heroEyebrow = 'Same race · same blueprint',
  metaLine,
  stats,
  viewerCurrentStepNumber,
  peers,
  onBack,
  onFilterTap,
  onPeerTap,
}: FleetPlansViewProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const sameStep = peers.filter((p) => p.status === 'same-step').length;
    const ahead = peers.filter((p) => p.status === 'ahead').length;
    const behind = peers.filter((p) => p.status === 'behind').length;
    return { all: peers.length, sameStep, ahead, behind };
  }, [peers]);

  const visible = useMemo(() => {
    if (filter === 'all') return peers;
    return peers.filter((p) => p.status === filter);
  }, [peers, filter]);

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.back} onPress={onBack} hitSlop={8} disabled={!onBack}>
          <ChevronLeft size={18} color={C.blue} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
        <Text style={styles.topTtl}>{topTitle}</Text>
        <Pressable hitSlop={8} onPress={onFilterTap} style={styles.topRight}>
          <FilterIcon size={18} color={C.label2} />
        </Pressable>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroEyeRow}>
          <Anchor size={12} color={C.greenDeep} />
          <Text style={styles.heroEye}>{heroEyebrow}</Text>
        </View>
        <Text style={styles.heroTitle}>{heroTitle}</Text>
        <Text style={styles.metaLine}>{metaLine}</Text>
        <View style={styles.statRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filter}>
        <FilterChip
          label="All"
          n={counts.all}
          on={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterChip
          label={`On step ${viewerCurrentStepNumber ?? '—'}`}
          n={counts.sameStep}
          on={filter === 'same-step'}
          onPress={() => setFilter('same-step')}
        />
        <FilterChip
          label="Ahead"
          n={counts.ahead}
          on={filter === 'ahead'}
          onPress={() => setFilter('ahead')}
        />
        <FilterChip
          label="Behind"
          n={counts.behind}
          on={filter === 'behind'}
          onPress={() => setFilter('behind')}
        />
      </View>

      {/* Peer list */}
      <ScrollView style={styles.listScroll} contentContainerStyle={styles.list}>
        {visible.map((peer) => (
          <PeerCard key={peer.id} peer={peer} onPress={() => onPeerTap?.(peer)} />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  n,
  on,
  onPress,
}: {
  label: string;
  n: number;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      <Text style={[styles.chipCount, on && styles.chipCountOn]}>{n}</Text>
    </Pressable>
  );
}

function PeerCard({ peer, onPress }: { peer: FleetPeer; onPress?: () => void }) {
  const colorBg = AVATAR_GRADIENTS[peer.avatarColorKey ?? 'navy'];
  const progressPct = Math.max(
    0,
    Math.min(100, Math.round((peer.currentStepNumber / peer.totalSteps) * 100)),
  );

  const statusStyle =
    peer.status === 'same-step'
      ? styles.chipActive
      : peer.status === 'ahead'
        ? styles.chipAhead
        : styles.chipBehind;

  const statusText =
    peer.status === 'same-step'
      ? 'Same step'
      : peer.status === 'ahead'
        ? 'Ahead'
        : 'Behind you';

  const statusIcon =
    peer.status === 'same-step' ? (
      <Flag size={9} color={C.blueDeep} fill={C.blueDeep} />
    ) : peer.status === 'ahead' ? (
      <ArrowUp size={9} color={C.greenDeep} />
    ) : (
      <Check size={9} color={C.label2} />
    );

  const statusColor =
    peer.status === 'same-step'
      ? styles.statusTextActive
      : peer.status === 'ahead'
        ? styles.statusTextAhead
        : styles.statusTextBehind;

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
    >
      <View style={[styles.av, { backgroundColor: colorBg }]}>
        <Text style={styles.avText}>{peer.initials}</Text>
      </View>
      <View style={styles.cardMid}>
        <View style={styles.whoLine}>
          <Text style={styles.who}>{peer.name}</Text>
          <Text style={styles.where}>{peer.whereLine}</Text>
        </View>
        <Text style={styles.what}>{peer.activityLine}</Text>
      </View>
      <View style={styles.rightSide}>
        <View style={[styles.statusChip, statusStyle]}>
          {statusIcon}
          <Text style={[styles.statusText, statusColor]}>{statusText}</Text>
        </View>
        <View style={styles.progressMini}>
          <View style={[styles.progressMiniBar, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.stepTag}>
          <Text style={styles.stepTagStrong}>{peer.currentStepNumber}</Text>/{peer.totalSteps}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.page,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    width: 100,
  },
  backText: {
    color: C.blue,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  topTtl: {
    fontSize: 16,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.25,
  },
  topRight: {
    width: 100,
    alignItems: 'flex-end',
  },
  hero: {
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  heroEyeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  heroEye: {
    fontSize: 10,
    fontWeight: '700',
    color: C.greenDeep,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: C.serif,
    fontStyle: 'italic',
    fontSize: 18,
    fontWeight: '500',
    color: C.label,
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 6,
  },
  metaLine: {
    fontSize: 11,
    color: C.label3,
    letterSpacing: -0.05,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 11,
  },
  stat: {
    flex: 1,
    backgroundColor: C.gray6,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: C.label,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: C.label3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  filter: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 11,
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.gray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipOn: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    color: C.label2,
    letterSpacing: -0.05,
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  chipCount: {
    fontSize: 11,
    color: C.label3,
  },
  chipCountOn: {
    color: 'rgba(255,255,255,0.78)',
  },
  listScroll: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 8,
  },
  card: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  av: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardMid: {
    flex: 1,
    gap: 4,
  },
  whoLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  who: {
    fontSize: 13,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.1,
  },
  where: {
    fontSize: 10.5,
    color: C.label3,
    letterSpacing: -0.05,
  },
  what: {
    fontSize: 11.5,
    color: C.label2,
    letterSpacing: -0.05,
    lineHeight: 16,
  },
  rightSide: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipActive: {
    backgroundColor: C.blueTint,
    borderColor: C.blueStrong,
  },
  chipAhead: {
    backgroundColor: C.greenTint,
    borderColor: C.greenSoft,
  },
  chipBehind: {
    backgroundColor: C.gray6,
    borderColor: C.line,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statusTextActive: {
    color: C.blueDeep,
  },
  statusTextAhead: {
    color: C.greenDeep,
  },
  statusTextBehind: {
    color: C.label2,
  },
  progressMini: {
    width: 62,
    height: 5,
    backgroundColor: C.line,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressMiniBar: {
    height: 5,
    backgroundColor: C.blue,
    borderRadius: 3,
  },
  stepTag: {
    fontSize: 9.5,
    fontWeight: '700',
    color: C.label3,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  stepTagStrong: {
    color: C.label2,
  },
});
