/**
 * PerformanceMetrics - Statistical analysis of race performance
 *
 * Displays speed, VMG, distance, and time statistics
 * Part of Phase 3: DEBRIEF Mode
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GPSPoint } from './modes/DebriefModeLayout';

interface PerformanceMetricsProps {
  gpsTrack: GPSPoint[];
  weather?: {
    wind?: { direction: number };
  };
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  gpsTrack,
  weather,
}) => {
  // Show empty state if no GPS track data
  if (!gpsTrack || gpsTrack.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Performance Metrics</Text>
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No GPS Track Data</Text>
          <Text style={styles.emptyDescription}>
            Record a GPS track during your race to see detailed performance metrics including speed analysis, VMG, distance sailed, and time breakdown.
          </Text>
          <View style={styles.emptyHint}>
            <Ionicons name="information-circle-outline" size={16} color="#64748B" />
            <Text style={styles.emptyHintText}>
              Start the race timer with GPS tracking enabled to collect data
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Calculate metrics
  const metrics = calculatePerformanceMetrics(gpsTrack, weather?.wind?.direction);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Performance Metrics</Text>

      <View style={styles.grid}>
        {/* Speed Analysis */}
        <MetricCard
          icon="speedometer-outline"
          title="Speed Analysis"
          metrics={[
            { label: 'Average', value: `${metrics.avgSpeed} kts`, color: '#3B82F6' },
            { label: 'Maximum', value: `${metrics.maxSpeed} kts`, color: '#10B981' },
            { label: 'Upwind Avg', value: `${metrics.upwindSpeed} kts`, color: '#6B7280' },
            { label: 'Downwind Avg', value: `${metrics.downwindSpeed} kts`, color: '#6B7280' },
          ]}
        />

        {/* VMG Analysis */}
        <MetricCard
          icon="compass-outline"
          title="VMG (Velocity Made Good)"
          metrics={[
            { label: 'Upwind VMG', value: `${metrics.upwindVMG} kts`, color: '#3B82F6' },
            { label: 'Downwind VMG', value: `${metrics.downwindVMG} kts`, color: '#10B981' },
            { label: 'VMG Efficiency', value: `${metrics.vmgEfficiency}%`, color: '#8B5CF6' },
          ]}
        />

        {/* Distance */}
        <MetricCard
          icon="navigate-outline"
          title="Distance Sailed"
          metrics={[
            { label: 'Total Distance', value: `${metrics.totalDistance} nm`, color: '#3B82F6' },
            { label: 'Extra Distance', value: `${metrics.extraDistance} nm`, color: '#F59E0B' },
            { label: 'Efficiency', value: `${metrics.distanceEfficiency}%`, color: '#10B981' },
          ]}
        />

        {/* Time Analysis */}
        <MetricCard
          icon="time-outline"
          title="Time Breakdown"
          metrics={[
            { label: 'Total Time', value: metrics.totalTime, color: '#3B82F6' },
            { label: 'Port Tack', value: `${metrics.portTackPercent}%`, color: '#EF4444' },
            { label: 'Starboard Tack', value: `${metrics.starboardTackPercent}%`, color: '#10B981' },
          ]}
        />
      </View>
    </View>
  );
};

/**
 * Metric Card Component
 */
interface MetricCardProps {
  icon: string;
  title: string;
  metrics: { label: string; value: string; color: string }[];
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, metrics }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Ionicons name={icon as any} size={20} color="#3B82F6" />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    <View style={styles.cardContent}>
      {metrics.map((metric, index) => (
        <View key={index} style={styles.metricRow}>
          <Text style={styles.metricLabel}>{metric.label}</Text>
          <Text style={[styles.metricValue, { color: metric.color }]}>
            {metric.value}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

/**
 * Calculate all performance metrics from GPS track
 */
export function calculatePerformanceMetrics(track: GPSPoint[], windDirection?: number) {
  if (track.length === 0) {
    return {
      avgSpeed: '0.0',
      maxSpeed: '0.0',
      upwindSpeed: '0.0',
      downwindSpeed: '0.0',
      upwindVMG: '0.0',
      downwindVMG: '0.0',
      vmgEfficiency: '0',
      totalDistance: '0.00',
      extraDistance: '0.00',
      distanceEfficiency: '100',
      totalTime: '0m',
      portTackPercent: '50',
      starboardTackPercent: '50',
    };
  }

  // Speed analysis
  const speeds = track.map(p => p.speed);
  const avgSpeed = (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1);
  const maxSpeed = Math.max(...speeds).toFixed(1);

  // Categorize points by sailing angle (relative to wind)
  const upwindPoints: number[] = [];
  const downwindPoints: number[] = [];

  if (windDirection !== undefined) {
    track.forEach(point => {
      const angleToWind = Math.abs(((point.heading - windDirection + 180) % 360) - 180);
      if (angleToWind < 90) {
        upwindPoints.push(point.speed);
      } else {
        downwindPoints.push(point.speed);
      }
    });
  }

  const upwindSpeed = upwindPoints.length > 0
    ? (upwindPoints.reduce((a, b) => a + b, 0) / upwindPoints.length).toFixed(1)
    : avgSpeed;

  const downwindSpeed = downwindPoints.length > 0
    ? (downwindPoints.reduce((a, b) => a + b, 0) / downwindPoints.length).toFixed(1)
    : avgSpeed;

  // VMG (simplified - would need wind data for accurate calculation)
  const upwindVMG = (parseFloat(upwindSpeed) * 0.85).toFixed(1); // Approximation
  const downwindVMG = (parseFloat(downwindSpeed) * 0.90).toFixed(1); // Approximation
  const vmgEfficiency = Math.round(
    ((parseFloat(upwindVMG) + parseFloat(downwindVMG)) /
    (parseFloat(upwindSpeed) + parseFloat(downwindSpeed))) * 100
  );

  // Distance calculation
  let totalDistance = 0;
  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1];
    const curr = track[i];
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = toRad(curr.latitude - prev.latitude);
    const dLon = toRad(curr.longitude - prev.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(prev.latitude)) * Math.cos(toRad(curr.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDistance += R * c;
  }

  // Extra distance (assume 10% is optimal for now)
  const optimalDistance = totalDistance * 0.9;
  const extraDistance = (totalDistance - optimalDistance).toFixed(2);
  const distanceEfficiency = Math.round((optimalDistance / totalDistance) * 100);

  // Time analysis
  const totalSeconds = (track[track.length - 1].timestamp.getTime() - track[0].timestamp.getTime()) / 1000;
  const totalMinutes = Math.round(totalSeconds / 60);
  const totalTime = `${totalMinutes}m`;

  // Tack analysis (simplified - based on heading)
  const portTackCount = track.filter(p => {
    const heading = p.heading % 360;
    return heading >= 180;
  }).length;
  const portTackPercent = Math.round((portTackCount / track.length) * 100);
  const starboardTackPercent = 100 - portTackPercent;

  return {
    avgSpeed,
    maxSpeed,
    upwindSpeed,
    downwindSpeed,
    upwindVMG,
    downwindVMG,
    vmgEfficiency: vmgEfficiency.toString(),
    totalDistance: totalDistance.toFixed(2),
    extraDistance,
    distanceEfficiency: distanceEfficiency.toString(),
    totalTime,
    portTackPercent: portTackPercent.toString(),
    starboardTackPercent: starboardTackPercent.toString(),
  };
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardContent: {
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Empty state styles
  emptyState: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 400,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyHintText: {
    fontSize: 13,
    color: '#64748B',
  },
});
