/**
 * CaptureTimeline — chronological "So far today" feed merging observations
 * and media uploads into a single time-ordered list. Matches mockup 14.
 *
 * Rows render as: 3px tertiary rule · tertiary timestamp+type · optional
 * thumbnail · serif 14px body. Hairline divider between rows. Photo rows
 * support inline caption editing; observation rows support inline removal.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, text } from '@/lib/design-tokens-editorial';
import { STEP_PALETTE } from '@/lib/step-theme';
import type { MediaUpload, Observation } from '@/types/step-detail';

interface CaptureTimelineProps {
  observations: Observation[];
  mediaUploads: MediaUpload[];
  onRemoveObservation?: (id: string) => void;
  onRemoveMedia?: (id: string) => void;
  onUpdateMediaCaption?: (id: string, caption: string) => void;
  onPreviewMedia?: (uri: string) => void;
  readOnly?: boolean;
}

type TimelineEntry =
  | {
      kind: 'observation';
      id: string;
      timestamp: string;
      text: string;
      source: 'voice' | 'note';
    }
  | {
      kind: 'media';
      id: string;
      timestamp: string;
      uri: string;
      mediaType: 'photo' | 'video';
      caption?: string;
    };

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .toLowerCase();
  if (isToday) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

export function CaptureTimeline({
  observations,
  mediaUploads,
  onRemoveObservation,
  onRemoveMedia,
  onUpdateMediaCaption,
  onPreviewMedia,
  readOnly,
}: CaptureTimelineProps) {
  const entries = useMemo<TimelineEntry[]>(() => {
    const obs: TimelineEntry[] = observations.map((o) => ({
      kind: 'observation' as const,
      id: o.id,
      timestamp: o.timestamp,
      text: o.text,
      source: o.source ?? 'note',
    }));
    const media: TimelineEntry[] = mediaUploads.map((m) => ({
      kind: 'media' as const,
      id: m.id,
      timestamp: m.created_at ?? '',
      uri: m.uri,
      mediaType: m.type,
      caption: m.caption,
    }));
    return [...obs, ...media].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });
  }, [observations, mediaUploads]);

  if (entries.length === 0) return null;

  return (
    <View style={s.container}>
      <Text style={s.eyebrow}>So far today</Text>
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1;
        const typeLabel =
          entry.kind === 'observation'
            ? entry.source
            : entry.mediaType === 'video'
              ? 'video'
              : 'photo';
        const timestampLabel = entry.timestamp
          ? `${formatTimestamp(entry.timestamp)} · ${typeLabel}`
          : typeLabel;

        return (
          <View
            key={`${entry.kind}_${entry.id}`}
            style={[s.row, !isLast && s.rowBorder]}
          >
            <View style={s.rule} />
            <View style={s.rowContent}>
              <View style={s.rowHeader}>
                <Text style={s.timestamp}>{timestampLabel}</Text>
                {!readOnly &&
                  (entry.kind === 'observation' ? (
                    onRemoveObservation && (
                      <Pressable
                        onPress={() => onRemoveObservation(entry.id)}
                        hitSlop={8}
                        style={s.removeBtn}
                        accessibilityLabel="Remove note"
                      >
                        <Ionicons
                          name="close"
                          size={14}
                          color={STEP_PALETTE.textTertiary}
                        />
                      </Pressable>
                    )
                  ) : (
                    onRemoveMedia && (
                      <Pressable
                        onPress={() => onRemoveMedia(entry.id)}
                        hitSlop={8}
                        style={s.removeBtn}
                        accessibilityLabel="Remove media"
                      >
                        <Ionicons
                          name="close"
                          size={14}
                          color={STEP_PALETTE.textTertiary}
                        />
                      </Pressable>
                    )
                  ))}
              </View>

              {entry.kind === 'media' && (
                <Pressable
                  onPress={
                    entry.mediaType === 'photo' && onPreviewMedia
                      ? () => onPreviewMedia(entry.uri)
                      : undefined
                  }
                  style={s.thumbWrapper}
                >
                  <Image source={{ uri: entry.uri }} style={s.thumb} />
                  {entry.mediaType === 'video' && (
                    <View style={s.videoBadge}>
                      <Ionicons name="videocam" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              )}

              {entry.kind === 'observation' ? (
                <Text style={s.body}>{entry.text}</Text>
              ) : readOnly ? (
                entry.caption ? <Text style={s.body}>{entry.caption}</Text> : null
              ) : (
                <TextInput
                  style={s.captionInput}
                  defaultValue={entry.caption ?? ''}
                  onChangeText={(t) =>
                    onUpdateMediaCaption?.(entry.id, t)
                  }
                  placeholder="Add a caption…"
                  placeholderTextColor={STEP_PALETTE.textTertiary}
                  multiline
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 0,
  },
  eyebrow: {
    ...text.sansEyebrow,
    color: STEP_PALETTE.textTertiary,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: STEP_PALETTE.borderTertiary,
  },
  rule: {
    flexShrink: 0,
    width: 3,
    backgroundColor: STEP_PALETTE.textTertiary,
    borderRadius: 2,
    marginVertical: 4,
  },
  rowContent: {
    flex: 1,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 11,
    color: STEP_PALETTE.textTertiary,
  },
  removeBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  thumbWrapper: {
    width: 80,
    height: 60,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: STEP_PALETTE.bgSecondary,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  body: {
    fontFamily: fontFamily.serif,
    fontSize: 14,
    lineHeight: 22,
    color: STEP_PALETTE.textPrimary,
  },
  captionInput: {
    fontFamily: fontFamily.serif,
    fontSize: 14,
    lineHeight: 22,
    color: STEP_PALETTE.textPrimary,
    padding: 0,
    margin: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
});
