import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IOS_BLUE = '#007AFF';
const GRAY_5 = '#E5E5EA';
const GRAY_6 = '#F2F2F7';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';

export interface CaptureTypesSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectVideo?: () => void;
  onSelectScan?: () => void;
  onSelectMeasurement?: () => void;
}

export function CaptureTypesSheet({
  visible,
  onDismiss,
  onSelectVideo,
  onSelectScan,
  onSelectMeasurement,
}: CaptureTypesSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityLabel="Close capture types" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>More capture types</Text>
        <CaptureTypeRow
          icon="videocam-outline"
          title="Video"
          subtitle="Placeholder for Phase 3.1"
          onPress={onSelectVideo ?? onDismiss}
        />
        <CaptureTypeRow
          icon="scan-outline"
          title="Scan"
          subtitle="Placeholder for forms, labels, or equipment"
          onPress={onSelectScan ?? onDismiss}
        />
        <CaptureTypeRow
          icon="analytics-outline"
          title="Measurement"
          subtitle="Placeholder for structured numbers"
          onPress={onSelectMeasurement ?? onDismiss}
        />
      </View>
    </Modal>
  );
}

function CaptureTypeRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.icon}>
        <Ionicons name={icon} size={18} color={IOS_BLUE} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={LABEL_3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: GRAY_5,
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: LABEL,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
  },
  rowPressed: {
    opacity: 0.65,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GRAY_6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: LABEL_2,
  },
  rowSubtitle: {
    fontSize: 12,
    color: LABEL_3,
    marginTop: 2,
  },
});
