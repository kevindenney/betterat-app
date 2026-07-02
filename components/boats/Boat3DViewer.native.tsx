/**
 * Boat3DViewer Component - Native Fallback
 * Shows informational fallback for iOS/Android
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface Boat3DViewerProps {
  boatClass: string;
  tuning: {
    shrouds: number;
    backstay: number;
    forestay: number;
    mastButtPosition: number;
  };
  width?: number;
  height?: number;
}

interface BoatRigProfile {
  name: string;
  forestayBaseline: number;
  headline: string;
  notes: string[];
}

type BoatClassSummary = Record<string, BoatRigProfile>;

const CLASS_SUMMARY: BoatClassSummary = {
  etchells: {
    name: 'Etchells',
    forestayBaseline: 10950,
    headline: 'Etchells tuned baseline',
    notes: [
      'Mast rake target: 47–47.5 in (forestay ~10950 mm)',
      'Upper shroud: 25–28 Loos PT-2M',
      'Lower shroud: 12–14 Loos PT-1M',
      'Backstay marks 0–7 with vang assist above 12 kts',
    ],
  },
  dragon: {
    name: 'Dragon',
    forestayBaseline: 10800,
    headline: 'Dragon base rig matrix',
    notes: [
      'Forestay baseline: 10800 mm with 120 mm pre-bend',
      'Upper shrouds: 28 Loos, lowers 18 for medium breeze',
      'Backstay adds ~40 mm bend at mark 6 (>14 kts)',
    ],
  },
};

/**
 * 3D Boat Viewer - Native Fallback
 * Shows tuning information without 3D rendering
 */
export function Boat3DViewer({
  boatClass,
  tuning,
  width = 375,
  height = 400,
}: Boat3DViewerProps) {
  const normalizedClass = boatClass.trim().toLowerCase();
  const guide = CLASS_SUMMARY[normalizedClass];

  return (
    <View style={[styles.fallbackContainer, { width, height }]}>
      <Text style={styles.fallbackTitle}>3D Viewer available on web</Text>
      <Text style={styles.fallbackBody}>
        Open BetterAt on a desktop browser to interact with the live 3D rig model.
      </Text>
      <Text style={styles.fallbackMetrics}>
        Shrouds: {tuning.shrouds}% • Backstay: {tuning.backstay}%
      </Text>
      {guide && (
        <View style={styles.guideBlock}>
          <Text style={styles.guideHeadline}>{guide.headline}</Text>
          {guide.notes.map((note) => (
            <Text key={note} style={styles.guideNote}>
              • {note}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  fallbackBody: {
    fontSize: 13,
    color: '#1e3a8a',
    textAlign: 'center',
  },
  fallbackMetrics: {
    fontSize: 12,
    color: '#0f172a',
  },
  guideBlock: {
    marginTop: 12,
    gap: 4,
  },
  guideHeadline: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  guideNote: {
    fontSize: 11,
    color: '#1e3a8a',
    textAlign: 'left',
  },
});
