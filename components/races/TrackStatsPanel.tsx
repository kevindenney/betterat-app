/**
 * Track Stats Panel Component
 * Displays real-time statistics during GPS tracking
 *
 * Shows:
 * - Current speed (SOG)
 * - Distance sailed
 * - Average speed
 * - Max speed
 * - Time elapsed
 * - Current heading
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity, Navigation, Timer, TrendingUp } from 'lucide-react-native';

interface TrackStatsPanelProps {
  // Current speed in knots
  currentSpeed?: number;

  // Distance sailed in nautical miles
  distanceSailed: number;

  // Average speed in knots
  averageSpeed: number;

  // Max speed in knots
  maxSpeed: number;

  // Time elapsed in seconds
  timeElapsed: number;

  // Current heading in degrees
  currentHeading?: number;
}

export function TrackStatsPanel({
  currentSpeed = 0,
  distanceSailed,
  averageSpeed,
  maxSpeed,
  timeElapsed,
  currentHeading = 0,
}: TrackStatsPanelProps) {
  // Format time elapsed as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format heading as compass direction
  const formatHeading = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return `${directions[index]} ${Math.round(degrees)}°`;
  };

  return (
    <View style={styles.container}>
      {/* Current Speed - Primary stat */}
      <View style={[styles.statCard, styles.primaryCard]}>
        <Activity size={20} color="#007AFF" style={styles.icon} />
        <View style={styles.statContent}>
          <Text style={styles.primaryValue}>{currentSpeed.toFixed(1)}</Text>
          <Text style={styles.primaryUnit}>kts</Text>
        </View>
        <Text style={styles.primaryLabel}>Speed</Text>
      </View>

      {/* Secondary stats */}
      <View style={styles.secondaryStats}>
        <StatItem
          icon={<Navigation size={16} color="#64748B" />}
          label="Heading"
          value={formatHeading(currentHeading)}
        />

        <StatItem
          icon={<Timer size={16} color="#64748B" />}
          label="Time"
          value={formatTime(timeElapsed)}
        />

        <StatItem
          icon={<TrendingUp size={16} color="#64748B" />}
          label="Distance"
          value={`${distanceSailed.toFixed(2)} nm`}
        />

        <StatItem
          label="Avg Speed"
          value={`${averageSpeed.toFixed(1)} kts`}
        />

        <StatItem
          label="Max Speed"
          value={`${maxSpeed.toFixed(1)} kts`}
        />
      </View>
    </View>
  );
}

interface StatItemProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
}

function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      {icon && <View style={styles.statIcon}>{icon}</View>}
      <View style={styles.statTextContainer}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F8FAFC',
  },
  primaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 8,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  primaryValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 56,
  },
  primaryUnit: {
    fontSize: 20,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 4,
  },
  primaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryStats: {
    gap: 8,
  },
  statItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statIcon: {
    marginRight: 10,
  },
  statTextContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
});
