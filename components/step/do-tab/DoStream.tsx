import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { sortCapturesNewestFirst, type DoCaptureItem } from './doCaptureModel';
import { CaptureRow } from './CaptureRow';

const CORAL = '#FF6B6B';
const CORAL_DEEP = '#E54848';
const GRAY_5 = '#E5E5EA';
const GRAY_6 = '#F2F2F7';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';
const LABEL_4 = 'rgba(60, 60, 67, 0.30)';

export interface DoStreamProps {
  captures: DoCaptureItem[];
  stepId?: string;
  nowMs?: number;
  emptyMessage?: string;
  readOnly?: boolean;
  onCapturePress?: (captureId: string) => void;
  onCaptureLongPress?: (captureId: string) => void;
  onPressPlayVoice?: (captureId: string) => void;
  onEditCapture?: (captureId: string) => void;
  onDeleteCapture?: (captureId: string) => void;
}

export function DoStream({
  captures,
  nowMs,
  emptyMessage = 'Captures will appear here as you record them.',
  readOnly,
  onCaptureLongPress,
  onPressPlayVoice,
  onEditCapture,
  onDeleteCapture,
}: DoStreamProps) {
  const ordered = sortCapturesNewestFirst(captures);

  return (
    <View style={styles.streamWrap}>
      <View style={styles.streamEyebrow}>
        <Text style={styles.streamEyebrowLbl}>
          <Text style={styles.streamEyebrowArrow}>↓ </Text>
          NEWEST FIRST
        </Text>
        {ordered.length > 0 ? (
          <View style={styles.freshest} accessibilityElementsHidden importantForAccessibility="no">
            <View style={styles.freshestDot} />
            <Text style={styles.freshestText}>Just now</Text>
          </View>
        ) : null}
      </View>

      {ordered.length === 0 ? (
        <View style={styles.emptyStream}>
          <Text style={styles.emptyStreamText}>{emptyMessage}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.stream}
          contentContainerStyle={styles.streamContent}
          showsVerticalScrollIndicator={false}
        >
          {ordered.map((c, i) => (
            <CaptureRow
              key={c.id}
              capture={c}
              fresh={i === 0 && c.kind !== 'time_marker'}
              nowMs={nowMs}
              onPressPlayVoice={onPressPlayVoice}
              onEdit={readOnly ? undefined : onEditCapture}
              onDelete={readOnly ? undefined : onDeleteCapture}
              onLongPress={readOnly ? undefined : onCaptureLongPress}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  streamWrap: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  streamEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
    marginHorizontal: 4,
    marginBottom: 6,
  },
  streamEyebrowLbl: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.7,
    color: LABEL_3,
  },
  streamEyebrowArrow: {
    color: LABEL_4,
  },
  freshest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freshestDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: CORAL,
  },
  freshestText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: CORAL_DEEP,
  },
  stream: {
    flex: 1,
  },
  streamContent: {
    gap: 10,
    paddingBottom: 8,
  },
  emptyStream: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: GRAY_6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  emptyStreamText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: LABEL_3,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
