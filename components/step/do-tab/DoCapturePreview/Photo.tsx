import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DoCaptureItem } from '../doCaptureModel';

const PHOTO_BG_TOP = '#B8C5D1';
const PHOTO_BG_BOTTOM = '#6B7E8E';
const CORNER_BG = 'rgba(0, 0, 0, 0.32)';

export interface PhotoCapturePreviewProps {
  capture: DoCaptureItem;
}

/**
 * Frame 2 — photo capture preview.
 * Renders the actual image when a mediaUri is present; otherwise falls back
 * to the canonical placeholder gradient with the photo caption label.
 */
export function PhotoCapturePreview({ capture }: PhotoCapturePreviewProps) {
  const hasUri = Boolean(capture.mediaUri);
  return (
    <View style={styles.frame} accessibilityLabel={capture.body || 'Photo capture'}>
      {hasUri ? (
        <Image source={{ uri: capture.mediaUri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.placeholder, styles.placeholderGradient]} />
      )}
      <View style={styles.corner}>
        <Ionicons name="camera" size={11} color="#FFFFFF" />
      </View>
      {capture.body ? (
        <View style={styles.labelWrap}>
          <Text style={styles.label} numberOfLines={1}>
            {capture.body}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    marginTop: 2,
    borderRadius: 8,
    overflow: 'hidden',
    height: 92,
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: PHOTO_BG_TOP,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholderGradient: {
    backgroundColor: PHOTO_BG_BOTTOM,
  },
  corner: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: CORNER_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    right: 32,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.4,
    color: 'rgba(255, 255, 255, 0.92)',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
