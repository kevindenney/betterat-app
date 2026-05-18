/**
 * FleetPlansScreen — canonical Worlds Fleet view (§B-B).
 *
 * Hero: "Same race · same blueprint" eyebrow, italic-serif quoted title,
 * summary stat tiles, filter chips, PeerCard list.
 *
 * Data-prop shaped — routes own the data layer.
 */

import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Anchor, ChevronLeft, Filter as FilterIcon } from 'lucide-react-native';
import { PeerCard, type FleetPeer, type FleetPeerStatus } from '@/components/fleets/PeerCard';

export type { FleetPeer, FleetPeerStatus } from '@/components/fleets/PeerCard';

export interface FleetPlansScreenProps {
  topTitle?: string;
  backLabel?: string;
  heroTitle: string;
  heroEyebrow?: string;
  metaLine: string;
  stats: { value: number; label: string }[];
  /** The step number the viewer is currently on — labels the "On step N" filter. */
  viewerCurrentStepNumber?: number;
  peers: FleetPeer[];
  onBack?: () => void;
  onFilterTap?: () => void;
  onPeerTap?: (peer: FleetPeer) => void;
}

type Filter = 'all' | FleetPeerStatus;

const C = {
  page: '#F2F2F7',
  card: '#FFFFFF',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  line: '#E5E5EA',
  gray6: '#F2F2F7',
  blue: '#007AFF',
  greenDeep: '#0A6B2A',
  serif: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }) as string,
};

export function FleetPlansScreen({
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
}: FleetPlansScreenProps) {
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
});
