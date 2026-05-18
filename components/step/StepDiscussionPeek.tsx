/**
 * StepDiscussionPeek — compact peek strip of a step's Discussion thread,
 * rendered above the Plan/Do/Reflect tab content on subscribed-blueprint
 * steps. Tap routes to the fullscreen Discussion screen.
 *
 * Layout (single row):
 *   [💬]  Discussion · 14 notes        ›
 *         "Phyl: Hit target on close reach..."
 *
 * Hidden when there are no notes — the surface is purely additive.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, MessageCircle } from 'lucide-react-native';

export interface StepDiscussionPeekProps {
  noteCount: number;
  latestSnippet: string;
  latestAuthorName: string | null;
  onPress: () => void;
}

export function StepDiscussionPeek({
  noteCount,
  latestSnippet,
  latestAuthorName,
  onPress,
}: StepDiscussionPeekProps) {
  const cleanedSnippet = latestSnippet
    .trim()
    .replace(/^["“”]+|["“”]+$/g, '')
    .slice(0, 140);
  // Outer View carries margins. Inner Pressable uses a STATIC style object
  // (not the {pressed} function form), because the function-returning style
  // form with flexDirection:'row' silently strips the row layout in RN
  // 0.81 / Pressable. With a static style, the row lays out correctly AND
  // scroll gestures propagate to the parent ScrollView (an absoluteFill
  // Pressable overlay does work for layout but swallows scroll touches).
  return (
    <View style={styles.outer}>
      <Pressable
        style={styles.wrap}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open Discussion · ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`}
      >
        <View style={styles.ico}>
          <MessageCircle size={13} color={C.purple} strokeWidth={2.2} />
        </View>
        <View style={styles.body}>
          <Text style={styles.header} numberOfLines={1}>
            <Text style={styles.headerStrong}>Discussion</Text>
            {' · '}
            {noteCount} {noteCount === 1 ? 'note' : 'notes'}
          </Text>
          <Text style={styles.snippet} numberOfLines={2}>
            {latestAuthorName ? (
              <Text style={styles.snippetAuthor}>{latestAuthorName}: </Text>
            ) : null}
            {cleanedSnippet}
          </Text>
        </View>
        <ChevronRight size={14} color={C.purpleDeep} />
      </Pressable>
    </View>
  );
}

const C = {
  purple: '#5856D6',
  purpleDeep: '#3F3DAB',
  purpleSoft: '#D7D6F4',
  purpleTint: '#EFEFFB',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
};

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.purpleTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.purpleSoft,
    borderRadius: 12,
  },
  wrapPressed: {
    opacity: 0.7,
  },
  ico: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  header: {
    fontSize: 11,
    color: C.purpleDeep,
    letterSpacing: 0.2,
  },
  headerStrong: {
    fontWeight: '700',
  },
  headerSep: {
    color: C.purpleSoft,
  },
  snippet: {
    fontSize: 12.5,
    color: C.label,
    letterSpacing: -0.05,
    lineHeight: 17,
  },
  snippetAuthor: {
    color: C.label2,
    fontWeight: '600',
  },
});
