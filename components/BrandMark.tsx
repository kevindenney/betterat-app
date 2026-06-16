/**
 * BrandMark — the BetterAt disc logo, drawn with native views instead of a
 * raster. The PNG version (assets/images/brand-mark*.png) has a hairline inner
 * ring that breaks up / pixelates when the bitmap is downscaled to small sizes
 * (e.g. the 32pt brand pill). Rendering the disc, ring, "b", and underline as
 * vector primitives keeps every size crisp.
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

const NAVY = '#0B1A33';

type Props = {
  size?: number;
  /** Merged onto the outer disc — use for shadow/elevation at call sites. */
  style?: StyleProp<ViewStyle>;
};

export function BrandMark({ size = 32, style }: Props) {
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {/* Thin inner ring, inset from the edge */}
      <View
        style={[
          styles.ring,
          {
            top: size * 0.08,
            left: size * 0.08,
            right: size * 0.08,
            bottom: size * 0.08,
            borderRadius: size / 2,
            borderWidth: Math.max(StyleSheet.hairlineWidth, size * 0.02),
          },
        ]}
      />
      <Text
        allowFontScaling={false}
        style={[
          styles.letter,
          { fontSize: size * 0.46, lineHeight: size * 0.5 },
        ]}
      >
        b
      </Text>
      <View
        style={[
          styles.underline,
          {
            width: size * 0.4,
            height: Math.max(1.5, size * 0.055),
            borderRadius: size,
            marginTop: size * 0.03,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  underline: {
    backgroundColor: '#FFFFFF',
  },
});

export default BrandMark;
