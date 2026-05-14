/**
 * CaptureCard — one row in the Debrief chronological capture stack.
 *
 * Header: time (13pt tabular nums) + circular tinted glyph (mic / pencil /
 * photo / flag) + kind label + optional beat tag.
 *
 * Body varies by kind:
 *   voice → italic 17pt prose (iOS Notes / Messages transcription convention)
 *   note  → regular 17pt prose
 *   photo → 240x135 thumbnail (caption slot via photoCaption)
 *   flag  → coral "flagged on the water." pill row
 *
 * When `flagged` is true (the user tagged this capture in the moment via the
 * silent-flag affordance on the On the Water composer), the card gains a
 * 3px coral inset on the left edge without changing external geometry.
 */

import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

export type CaptureKind = 'voice' | 'note' | 'photo' | 'flag';

interface Props {
  /** Display-formatted time, e.g. "13:08" or "1:22 pm" */
  time: string;
  kind: CaptureKind;
  /** Beat label rendered after the kind name, e.g. "first beat" */
  beat?: string;
  /** Voice or note text body */
  text?: string;
  /** Photo URI (when kind === 'photo') */
  photoUri?: string;
  /** Optional caption rendered over the photo */
  photoCaption?: string;
  /** When true, render a 3px coral left inset shadow */
  flagged?: boolean;
  /** When kind === 'flag', the trailing post-hoc note ("no caption", etc.) */
  flagAfter?: string;
}

const ICON_MAP: Record<CaptureKind, keyof typeof Ionicons.glyphMap> = {
  voice: 'mic',
  note: 'pencil',
  photo: 'image',
  flag: 'flag',
};

const KIND_LABEL: Record<CaptureKind, string> = {
  voice: 'Voice',
  note: 'Note',
  photo: 'Photo',
  flag: 'Silent flag',
};

export function CaptureCard({
  time,
  kind,
  beat,
  text,
  photoUri,
  photoCaption,
  flagged,
  flagAfter,
}: Props) {
  const isCoralGlyph = kind === 'flag';

  return (
    <View style={[styles.card, flagged && styles.cardFlagged]}>
      <View style={styles.head}>
        <Text style={styles.time}>{time}</Text>
        <View style={[styles.glyph, isCoralGlyph && styles.glyphCoral]}>
          <Ionicons
            name={ICON_MAP[kind]}
            size={12}
            color={
              isCoralGlyph
                ? IOS_REGISTER.accentMarkedContent
                : IOS_REGISTER.accentUserAction
            }
          />
        </View>
        <Text style={styles.kind}>
          {KIND_LABEL[kind]}
          {beat ? <Text style={styles.beat}>{' · ' + beat}</Text> : null}
        </Text>
      </View>

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
        <View style={styles.flagRow}>
          <View style={styles.flagPill}>
            <Ionicons
              name="flag"
              size={13}
              color={IOS_REGISTER.accentMarkedContent}
            />
            <Text style={styles.flagPillText}>flagged on the water.</Text>
          </View>
          {flagAfter ? (
            <Text style={styles.flagAfter}>{flagAfter}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
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
  cardFlagged: {
    paddingLeft: 18,
    borderLeftWidth: 3,
    borderLeftColor: IOS_REGISTER.accentMarkedContent,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  time: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  glyph: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  glyphCoral: {
    backgroundColor: IOS_REGISTER.accentMarkedContentTintStrong,
  },
  kind: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  beat: {
    color: IOS_REGISTER.labelTertiary,
  },
  voiceText: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.label,
    fontStyle: 'italic',
  },
  noteText: {
    ...IOS_REGISTER_TEXT.body,
    color: IOS_REGISTER.label,
  },
  photo: {
    width: 240,
    maxWidth: '100%',
    height: 135,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#7891AF',
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  photoCaption: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.94)',
    letterSpacing: 0.5,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      web: '"SF Mono", ui-monospace, Menlo, monospace',
      default: 'monospace',
    }) as string,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 10,
    backgroundColor: IOS_REGISTER.accentMarkedContentTintStrong,
    borderRadius: 999,
  },
  flagPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.accentMarkedContent,
    letterSpacing: -0.1,
  },
  flagAfter: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    fontStyle: 'italic',
    letterSpacing: -0.1,
  },
});
