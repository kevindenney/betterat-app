import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FilterStrip } from '@/components/timelines';
import { FleetCaptureCard } from './FleetCaptureCard';
import type { FleetCaptureRow, FleetFeedSummary } from '@/services/FleetCaptureFeedService';

export interface FleetViewTimeMarker {
  atTime: string;
  label: string;
}

export interface FleetViewProps {
  step: { id: string; title: string; settledLabel: string; eventLabel: string };
  stats: FleetFeedSummary;
  filterChips: { id: string; label: string; count?: number }[];
  activeFilterIds: string[];
  onFilterToggle: (id: string) => void;
  captures: FleetCaptureRow[];
  timeMarkers?: FleetViewTimeMarker[];
  isLoading?: boolean;
}

export function FleetView({
  step,
  stats,
  filterChips,
  activeFilterIds,
  onFilterToggle,
  captures,
  timeMarkers = [],
  isLoading,
}: FleetViewProps) {
  const interleavedRows = React.useMemo(() => {
    if (timeMarkers.length === 0) return captures.map((c) => ({ kind: 'capture' as const, capture: c }));
    const sortedMarkers = [...timeMarkers].sort((a, b) => (a.atTime > b.atTime ? -1 : 1));
    const out: ({ kind: 'capture'; capture: FleetCaptureRow } | { kind: 'marker'; marker: FleetViewTimeMarker })[] = [];
    let mIndex = 0;
    for (const capture of captures) {
      while (mIndex < sortedMarkers.length && sortedMarkers[mIndex].atTime >= capture.capturedAt) {
        out.push({ kind: 'marker', marker: sortedMarkers[mIndex] });
        mIndex += 1;
      }
      out.push({ kind: 'capture', capture });
    }
    while (mIndex < sortedMarkers.length) {
      out.push({ kind: 'marker', marker: sortedMarkers[mIndex] });
      mIndex += 1;
    }
    return out;
  }, [captures, timeMarkers]);

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.pill}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText}>Fleet · settled</Text>
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.meta}>
          <Text style={styles.metaEm}>{step.settledLabel}</Text> · {step.eventLabel}
        </Text>
        <View style={styles.statsStrip}>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{stats.boats}</Text>
            <Text style={styles.statLabel}>Boats</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{stats.captures}</Text>
            <Text style={styles.statLabel}>Shared captures</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{stats.yours}</Text>
            <Text style={styles.statLabel}>Yours</Text>
          </View>
          {stats.yourFinish ? (
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{stats.yourFinish}</Text>
              <Text style={styles.statLabel}>Finish</Text>
            </View>
          ) : null}
        </View>
      </View>

      <FilterStrip
        options={filterChips.map((chip) => ({
          key: chip.id,
          label: chip.count != null ? `${chip.label} · ${chip.count}` : chip.label,
        }))}
        selectedKey={activeFilterIds[0] ?? filterChips[0]?.id ?? ''}
        onSelect={onFilterToggle}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : interleavedRows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No shared captures from your fleet yet.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {interleavedRows.map((row, idx) =>
            row.kind === 'marker' ? (
              <View key={`marker-${idx}`} style={styles.timeMarker}>
                <View style={styles.timeMarkerLine} />
                <Text style={styles.timeMarkerLabel}>{row.marker.label}</Text>
                <View style={styles.timeMarkerLine} />
              </View>
            ) : (
              <FleetCaptureCard key={row.capture.id} capture={row.capture} />
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.10)',
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
  },
  metaEm: {
    fontWeight: '600',
    color: '#111827',
    fontStyle: 'italic',
  },
  statsStrip: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  statCell: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 80,
  },
  timeMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  timeMarkerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D1D5DB',
  },
  timeMarkerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
