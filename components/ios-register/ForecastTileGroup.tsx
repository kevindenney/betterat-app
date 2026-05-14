/**
 * ForecastTileGroup — four equal-width tiles on an atmospheric-slate
 * gradient panel. White rounded-rect tiles with ALL-CAPS 10.5pt label,
 * 19pt value, 11.5pt sub, and a 16px SF Symbol top-right.
 *
 * Per the register spec, the atmospheric tint is SCOPED TO THIS SECTION
 * ONLY — it never bleeds onto the surrounding surface.
 *
 * Sailing example: WIND / SEA / TIDE / SKY. Clinical example: VITALS /
 * ACUITY / CENSUS / WEATHER (TBD with first clinical user).
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

export interface ForecastTile {
  label: string;
  value: string;
  /** Optional secondary unit string rendered inline after value */
  unit?: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
  tiles: ForecastTile[];
}

export function ForecastTileGroup({ tiles }: Props) {
  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={[
          IOS_REGISTER.atmosphericSlate,
          IOS_REGISTER.atmosphericSlateFade,
        ]}
        style={styles.panel}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <Tile key={tile.label} tile={tile} />
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

function Tile({ tile }: { tile: ForecastTile }) {
  return (
    <View style={styles.tile}>
      <Ionicons
        name={tile.icon}
        size={16}
        color={IOS_REGISTER.labelSecondary}
        style={styles.glyph}
      />
      <Text style={styles.label}>{tile.label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{tile.value}</Text>
        {tile.unit ? <Text style={styles.unit}>{tile.unit}</Text> : null}
      </View>
      {tile.sub ? <Text style={styles.sub}>{tile.sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: 16,
    marginBottom: 6,
  },
  panel: {
    paddingTop: 16,
    paddingRight: 8,
    paddingBottom: 18,
    paddingLeft: 8,
    borderRadius: 16,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 11,
    minWidth: 0,
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  glyph: {
    position: 'absolute',
    top: 10,
    right: 11,
  },
  label: {
    ...IOS_REGISTER_TEXT.tileLabel,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 18,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    ...IOS_REGISTER_TEXT.tileValue,
    color: IOS_REGISTER.label,
  },
  unit: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginLeft: 2,
  },
  sub: {
    ...IOS_REGISTER_TEXT.tileSub,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 4,
  },
});
