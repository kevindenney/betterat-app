/**
 * RetraceAreaBanner — overlay chrome shown while the user is tracing
 * the actual outline of a racing area by tapping vertices on the
 * map. Replaces the area's current shape (circle / rectangle /
 * existing polygon) with whatever the user traces.
 *
 * Save enables once the user has placed at least 3 vertices.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

interface RetraceAreaBannerProps {
  areaName: string;
  vertexCount: number;
  saving: boolean;
  onUndo: () => void;
  onCancel: () => void;
  onSave: () => void;
  bottomOffset?: number;
}

// Same chrome-clear offset as RepositionAreaBanner so the banner
// doesn't sit under the floating chrome cluster.
const CHROME_CLEAR_HEIGHT = 96;
const MIN_VERTICES = 3;

export function RetraceAreaBanner({
  areaName,
  vertexCount,
  saving,
  onUndo,
  onCancel,
  onSave,
  bottomOffset = 16,
}: RetraceAreaBannerProps) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 8) + CHROME_CLEAR_HEIGHT;
  const canSave = vertexCount >= MIN_VERTICES && !saving;
  const hint =
    vertexCount === 0
      ? `Tap on the map to start tracing ${areaName}'s outline.`
      : vertexCount < MIN_VERTICES
        ? `${vertexCount} of ${MIN_VERTICES} points placed. Keep tapping around the outline.`
        : `${vertexCount} points placed. Tap Save to finish, or keep adding points.`;
  return (
    <>
      <View style={[styles.topBanner, { top }]} pointerEvents="none">
        <View style={styles.topBannerInner}>
          <Ionicons name="create" size={14} color="#FFFFFF" />
          <Text style={styles.topBannerText} numberOfLines={3}>
            <Text style={styles.topBannerName}>{areaName}</Text>
            {'\n'}
            {hint}
          </Text>
        </View>
      </View>

      <View style={[styles.actionBar, { bottom: bottomOffset }]} pointerEvents="box-none">
        <Pressable
          onPress={onUndo}
          disabled={vertexCount === 0 || saving}
          hitSlop={6}
          style={({ pressed }) => [
            styles.btn,
            styles.btnGhost,
            (vertexCount === 0 || saving) && { opacity: 0.4 },
            pressed && vertexCount > 0 && !saving && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Undo last point"
        >
          <Ionicons name="arrow-undo" size={18} color={IOS_REGISTER.label} />
        </Pressable>
        <Pressable
          onPress={onCancel}
          disabled={saving}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            pressed && !saving && { opacity: 0.7 },
            saving && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel retrace"
        >
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            !canSave && styles.btnDisabled,
            pressed && canSave && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save new shape"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.btnPrimaryText,
                !canSave && styles.btnDisabledText,
              ]}
            >
              {canSave ? 'Save shape' : `${vertexCount}/${MIN_VERTICES}`}
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1300,
    alignItems: 'center',
  },
  topBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 132, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    maxWidth: 480,
  },
  topBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    lineHeight: 17,
  },
  topBannerName: {
    fontWeight: '700',
  },
  actionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1310,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  btn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnGhost: {
    width: 44,
    paddingHorizontal: 0,
    backgroundColor: 'rgba(120, 120, 130, 0.10)',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(120, 120, 130, 0.14)',
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Disabled state needs to stay legible against the white card.
  // rgba(blue, 0.4) over white reads as near-white with white text —
  // user sees no button. Mid-tone gray fill + dark gray text keeps
  // the "vertex count / 3" affordance visible and obviously inactive.
  btnDisabled: {
    backgroundColor: 'rgba(120, 120, 130, 0.16)',
  },
  btnDisabledText: {
    color: IOS_REGISTER.label,
    opacity: 0.55,
  },
});
