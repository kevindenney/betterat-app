/**
 * LogEntry — one row in the On the Water running log.
 *
 * Unlike Debrief's CaptureCard (white card, gray-6 ground, completed
 * artifact), LogEntry is a stream row without card chrome — it sits
 * directly on the atmospheric ground. The user is in motion; entries
 * are ephemeral until the race ends and Debrief promotes them to cards.
 *
 * Each row: 13pt tabular time, small beat glyph, small type glyph, body.
 * Body varies by kind (voice italic, note regular, photo thumbnail,
 * flag pill). White text on atmospheric ground.
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

export type LogEntryKind = 'voice' | 'note' | 'photo' | 'flag';
export type LogEntryBeat = 'pre_start' | 'start' | 'beat' | 'mark' | 'finish';

interface Props {
  time: string;
  kind: LogEntryKind;
  beat?: LogEntryBeat;
  text?: string;
  photoUri?: string;
  photoCaption?: string;
}

const TYPE_ICON: Record<LogEntryKind, keyof typeof Ionicons.glyphMap> = {
  voice: 'mic',
  note: 'pencil',
  photo: 'image',
  flag: 'flag',
};

const BEAT_ICON: Record<LogEntryBeat, keyof typeof Ionicons.glyphMap> = {
  pre_start: 'anchor',
  start: 'flag-outline',
  beat: 'boat-outline',
  mark: 'flag-outline',
  finish: 'flag-outline',
};

export function LogEntry({
  time,
  kind,
  beat,
  text,
  photoUri,
  photoCaption,
}: Props) {
  const isFlag = kind === 'flag';

  return (
    <View style={styles.row}>
      <Text style={styles.time}>{time}</Text>
      <View style={styles.glyphCol}>
        {beat ? (
          <Ionicons
            name={BEAT_ICON[beat]}
            size={14}
            color="rgba(255, 255, 255, 0.55)"
          />
        ) : null}
      </View>
      <View style={styles.glyphCol}>
        <Ionicons
          name={TYPE_ICON[kind]}
          size={14}
          color={
            isFlag
              ? IOS_REGISTER.accentMarkedContent
              : 'rgba(255, 255, 255, 0.80)'
          }
        />
      </View>
      <View style={styles.body}>
        {kind === 'voice' && text ? (
          <Text style={styles.voiceText}>{`“${text}”`}</Text>
        ) : null}
        {kind === 'note' && text ? (
          <Text style={styles.noteText}>{text}</Text>
        ) : null}
        {kind === 'photo' ? (
          <View style={styles.photo}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
            ) : null}
            {photoCaption ? (
              <View style={styles.photoCaptionOverlay}>
                <Text style={styles.photoCaption}>{photoCaption}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {kind === 'flag' ? (
          <View style={styles.flagPill}>
            <Ionicons
              name="flag"
              size={12}
              color={IOS_REGISTER.accentMarkedContent}
            />
            <Text style={styles.flagPillText}>flagged for debrief</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  time: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.72)',
    fontVariant: ['tabular-nums'],
    width: 42,
    marginTop: 1,
  },
  glyphCol: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  voiceText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#FFFFFF',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  noteText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  photo: {
    width: 200,
    maxWidth: '100%',
    height: 112,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoCaptionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  photoCaption: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.94)',
    letterSpacing: 0.5,
  },
  flagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingRight: 12,
    paddingLeft: 10,
    backgroundColor: IOS_REGISTER.accentMarkedContentTintStrong,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  flagPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.accentMarkedContent,
    letterSpacing: -0.1,
  },
});
