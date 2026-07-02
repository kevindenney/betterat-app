/**
 * RigTuneCard — per-class rig-tune baseline for the race's wind band.
 *
 * Sits beneath the course strategy on a race step: once the strategy block
 * knows the race-time wind, this turns that wind into a class-specific
 * starting point (shroud tension, rake, the one trim move that matters).
 * Presentational only — the band + guide are resolved by `rigTuneFor`.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { RigTuneBand } from '@/lib/rigTune';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface Props {
  boatClass: string;
  source: string;
  band: RigTuneBand;
}

export function RigTuneCard({ boatClass, source, band }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons name="construct-outline" size={13} color={IOS_REGISTER.label} />
          <Text style={styles.title}>RIG TUNE · {boatClass.toUpperCase()}</Text>
        </View>
        <View style={styles.bandPill}>
          <Text style={styles.bandPillText}>
            {band.label.toUpperCase()} · {band.windRange}
          </Text>
        </View>
      </View>

      <View style={styles.settings}>
        {band.settings.map((s) => (
          <View key={s.label} style={styles.settingRow}>
            <Text style={styles.settingLabel}>{s.label}</Text>
            <Text style={styles.settingValue}>{s.value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>{band.note}</Text>
      <Text style={styles.source}>{source}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.groundBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.label,
  },
  bandPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  bandPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: IOS_REGISTER.accentUserAction,
  },
  settings: {
    marginTop: 10,
    gap: 6,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    flexShrink: 0,
  },
  settingValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.label,
  },
  source: {
    marginTop: 8,
    fontSize: 10,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
  },
});

export default RigTuneCard;
