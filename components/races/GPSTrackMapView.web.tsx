import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GPSTrackMapViewProps } from './GPSTrackMapView.types';

function metersToNauticalMiles(value: number) {
  return value / 1852;
}

function metersPerSecondToKnots(value: number) {
  return value * 1.94384;
}

function formatNumber(value: number, fractionDigits = 1) {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : '0.0';
}

export function GPSTrackMapView({
  trackPoints,
  fleetTracks = [],
}: GPSTrackMapViewProps) {
  const summary = useMemo(() => {
    if (trackPoints.length === 0) {
      return null;
    }

    let distanceMeters = 0;
    let maxSpeed = 0;

    for (let i = 1; i < trackPoints.length; i += 1) {
      const prev = trackPoints[i - 1];
      const current = trackPoints[i];

      const dLat = ((current.lat - prev.lat) * Math.PI) / 180;
      const dLon = ((current.lng - prev.lng) * Math.PI) / 180;
      const lat1 = (prev.lat * Math.PI) / 180;
      const lat2 = (current.lat * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceMeters += 6371000 * c;

      const currentSpeed = metersPerSecondToKnots(current.speed || 0);
      if (currentSpeed > maxSpeed) {
        maxSpeed = currentSpeed;
      }
    }

    const nauticalMiles = metersToNauticalMiles(distanceMeters);
    return {
      nauticalMiles,
      maxSpeed,
      lastHeading: trackPoints[trackPoints.length - 1]?.heading ?? 0,
    };
  }, [trackPoints]);

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        GPS Track Preview
      </Text>
      <Text style={styles.subtitle}>
        Native map rendering is unavailable on web. This summary shows the latest GPS data points
        so you can review fleet activity without leaving the browser.
      </Text>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Track Points</Text>
          <Text style={styles.metricValue}>{trackPoints.length}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Fleet Tracks</Text>
          <Text style={styles.metricValue}>{fleetTracks.length}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Distance</Text>
          <Text style={styles.metricValue}>
            {summary ? `${formatNumber(summary.nauticalMiles)} nm` : '—'}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Max Speed</Text>
          <Text style={styles.metricValue}>
            {summary ? `${formatNumber(summary.maxSpeed)} kn` : '—'}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Heading</Text>
          <Text style={styles.metricValue}>
            {summary ? `${formatNumber(summary.lastHeading, 0)}°` : '—'}
          </Text>
        </View>
      </View>

      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Map preview is native-only right now</Text>
        <Text style={styles.fallbackCopy}>
          Open the BetterAt mobile app to see a live map with GPS breadcrumbs, fleet overlays,
          and course marks.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#F8FAFF',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  subtitle: {
    fontSize: 13,
    color: '#3F3F46',
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexBasis: '30%',
    minWidth: 120,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  metricLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#6366F1',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  fallback: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338CA',
    marginBottom: 6,
  },
  fallbackCopy: {
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 18,
  },
});
