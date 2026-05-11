/**
 * MeasurementReview — Displays AI-extracted measurements from a training session.
 *
 * Shows measurements grouped by category with edit/verify controls and
 * trend indicators compared to recent history.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  ExtractedMeasurement,
  StepMeasurements,
  Measurement,
} from '@/types/measurements';
import type { MeasurementHistorySummary } from '@/services/MeasurementExtractionService';

// Design tokens matching StepCritiqueContent
const C = {
  cardBg: '#FFFFFF',
  cardBorder: '#E5E4E1',
  sectionLabel: '#9C9B99',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#D1D0CD',
  accent: '#3D8A5A',
  accentGlow: '#C8F0D8',
  dotInactive: '#EDECEA',
  radius: 12,
} as const;

interface MeasurementReviewProps {
  measurements: StepMeasurements;
  history?: MeasurementHistorySummary;
  readOnly?: boolean;
  onUpdate?: (updated: ExtractedMeasurement[]) => void;
}

export function MeasurementReview({
  measurements,
  history,
  readOnly,
  onUpdate,
}: MeasurementReviewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const extracted = measurements.extracted;

  const handleVerifyAll = useCallback(() => {
    const updated = extracted.map((m) => ({ ...m, verified: true }));
    onUpdate?.(updated);
  }, [extracted, onUpdate]);

  const handleVerifySingle = useCallback(
    (id: string) => {
      const updated = extracted.map((m) => (m.id === id ? { ...m, verified: true } : m));
      onUpdate?.(updated);
    },
    [extracted, onUpdate],
  );

  if (!extracted.length) return null;

  const exerciseItems = extracted.filter((m) => m.measurement.category === 'exercise');
  const healthItems = extracted.filter((m) => m.measurement.category === 'health');
  const perfItems = extracted.filter((m) => m.measurement.category === 'performance');
  const unverifiedCount = extracted.filter((m) => !m.verified).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics-outline" size={14} color={C.accent} />
          <Text style={styles.sectionLabel}>STEP DATA</Text>
        </View>
        {!readOnly && unverifiedCount > 0 && (
          <Pressable onPress={handleVerifyAll} hitSlop={8}>
            <Text style={styles.verifyAllText}>Verify all</Text>
          </Pressable>
        )}
      </View>

      {/* Exercise measurements */}
      {exerciseItems.length > 0 && (
        <MeasurementGroup
          title="Exercises"
          items={exerciseItems}
          history={history}
          editingId={editingId}
          readOnly={readOnly}
          onEdit={setEditingId}
          onVerify={handleVerifySingle}
        />
      )}

      {/* Health measurements */}
      {healthItems.length > 0 && (
        <MeasurementGroup
          title="Health"
          items={healthItems}
          history={history}
          editingId={editingId}
          readOnly={readOnly}
          onEdit={setEditingId}
          onVerify={handleVerifySingle}
        />
      )}

      {/* Performance measurements */}
      {perfItems.length > 0 && (
        <MeasurementGroup
          title="Performance"
          items={perfItems}
          history={history}
          editingId={editingId}
          readOnly={readOnly}
          onEdit={setEditingId}
          onVerify={handleVerifySingle}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// MeasurementGroup
// ---------------------------------------------------------------------------

function MeasurementGroup({
  title,
  items,
  history,
  editingId,
  readOnly,
  onEdit,
  onVerify,
}: {
  title: string;
  items: ExtractedMeasurement[];
  history?: MeasurementHistorySummary;
  editingId: string | null;
  readOnly?: boolean;
  onEdit: (id: string | null) => void;
  onVerify: (id: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {items.map((item) => (
        <MeasurementRow
          key={item.id}
          item={item}
          history={history}
          isEditing={editingId === item.id}
          readOnly={readOnly}
          onEdit={() => onEdit(editingId === item.id ? null : item.id)}
          onVerify={() => onVerify(item.id)}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// MeasurementRow
// ---------------------------------------------------------------------------

function MeasurementRow({
  item,
  history,
  readOnly,
  onVerify,
}: {
  item: ExtractedMeasurement;
  history?: MeasurementHistorySummary;
  isEditing?: boolean;
  readOnly?: boolean;
  onEdit?: () => void;
  onVerify: () => void;
}) {
  const m = item.measurement;
  const trend = getTrend(m, history);

  return (
    <View style={[styles.row, !item.verified && styles.rowUnverified]}>
      <View style={styles.rowMain}>
        {/* Title + value */}
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>{getMeasurementTitle(m)}</Text>
          <Text style={styles.rowValue}>{getMeasurementValue(m)}</Text>
        </View>

        {/* Trend indicator */}
        {trend && (
          <View style={styles.trendBadge}>
            {trend.type === 'pr' ? (
              <Text style={styles.prBadge}>PR!</Text>
            ) : (
              <>
                <Ionicons
                  name={trend.type === 'up' ? 'arrow-up' : trend.type === 'down' ? 'arrow-down' : 'remove'}
                  size={10}
                  color={trend.type === 'up' ? C.accent : trend.type === 'down' ? '#D89575' : C.labelMid}
                />
                {trend.delta && (
                  <Text
                    style={[
                      styles.trendText,
                      { color: trend.type === 'up' ? C.accent : trend.type === 'down' ? '#D89575' : C.labelMid },
                    ]}
                  >
                    {trend.delta}
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        {/* Actions */}
        {!readOnly && (
          <View style={styles.rowActions}>
            {!item.verified && (
              <Pressable onPress={onVerify} hitSlop={6}>
                <Ionicons name="checkmark-circle-outline" size={18} color={C.accent} />
              </Pressable>
            )}
            {item.verified && (
              <Ionicons name="checkmark-circle" size={16} color={C.accent} />
            )}
          </View>
        )}
      </View>

      {/* Confidence indicator for unverified */}
      {!item.verified && (
        <View style={styles.confidenceRow}>
          <View style={styles.confidenceBar}>
            <View
              style={[styles.confidenceFill, { width: `${item.confidence * 100}%` }]}
            />
          </View>
          <Text style={styles.confidenceText}>
            {Math.round(item.confidence * 100)}% confidence
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMeasurementTitle(m: Measurement): string {
  switch (m.category) {
    case 'exercise':
      return m.exercise_name;
    case 'health':
      return m.metric_name || m.metric_type.replace(/_/g, ' ');
    case 'performance':
      return m.metric_name;
  }
}

function getMeasurementValue(m: Measurement): string {
  switch (m.category) {
    case 'exercise': {
      const parts: string[] = [];
      if (m.sets && m.reps) parts.push(`${m.sets}×${m.reps}`);
      if (m.weight_value) parts.push(`${m.weight_value} ${m.weight_unit || 'lbs'}`);
      if (m.duration_seconds) {
        const mins = Math.floor(m.duration_seconds / 60);
        const secs = m.duration_seconds % 60;
        parts.push(secs ? `${mins}:${String(secs).padStart(2, '0')}` : `${mins} min`);
      }
      if (m.distance_value) parts.push(`${m.distance_value} ${m.distance_unit || 'mi'}`);
      if (m.rpe) parts.push(`RPE ${m.rpe}`);
      return parts.join(' · ') || 'recorded';
    }
    case 'health':
      if (m.metric_type === 'blood_pressure' && m.secondary_value) {
        return `${m.value}/${m.secondary_value} ${m.unit || 'mmHg'}`;
      }
      return `${m.value} ${m.unit || ''}`.trim();
    case 'performance':
      return `${m.value} ${m.unit || ''}`.trim();
  }
}

interface TrendInfo {
  type: 'up' | 'down' | 'same' | 'pr';
  delta?: string;
}

function getTrend(m: Measurement, history?: MeasurementHistorySummary): TrendInfo | null {
  if (!history?.hasData) return null;

  // Only compute trends for exercises with weight
  if (m.category !== 'exercise' || !m.weight_value) return null;

  const name = m.exercise_name.toLowerCase();
  const pr = history.exercisePRs[name];

  if (!pr) return null;

  if (m.weight_value > pr.value) {
    return { type: 'pr' };
  }

  const diff = m.weight_value - pr.value;
  if (diff === 0) return { type: 'same' };

  return {
    type: diff > 0 ? 'up' : 'down',
    delta: `${diff > 0 ? '+' : ''}${diff}${m.weight_unit || 'lbs'}`,
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.cardBg,
    borderRadius: C.radius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.sectionLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  verifyAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.accent,
  },
  group: {
    gap: 6,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: C.labelMid,
  },
  row: {
    backgroundColor: C.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 10,
    gap: 6,
  },
  rowUnverified: {
    borderColor: 'rgba(61,138,90,0.3)',
    backgroundColor: 'rgba(200,240,216,0.15)',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowContent: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.labelDark,
    textTransform: 'capitalize',
  },
  rowValue: {
    fontSize: 12,
    color: C.labelMid,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  prBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4A64A',
    backgroundColor: 'rgba(212,166,74,0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 6,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confidenceBar: {
    flex: 1,
    height: 3,
    backgroundColor: C.dotInactive,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 1.5,
  },
  confidenceText: {
    fontSize: 9,
    color: C.labelLight,
  },
});
