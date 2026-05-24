/**
 * <PeerReflectionQuote> — lilac italic-serif quote of the latest peer
 * reflection on this step.
 *
 * "Latest peer reflection is the only thing under the deck that isn't a
 * tab, because reflection is the engine."
 *   — docs/redesign/v3 · screen 01
 *
 * Renders inside <StepCard>'s `belowTitle` slot when STEP_IDENTITY_DECK_V3
 * is on AND the step's discussionPeek has a latest entry. v1 sources the
 * quote from useStepDiscussionPeek (latest comment in the step's discuss
 * thread); a dedicated peer_reflections schema lands in a follow-up.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  IOS_PURPLE,
  IOS_PURPLE_DEEP,
  IOS_PURPLE_TINT,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

export interface PeerReflectionQuoteProps {
  /** Author's display name (full name, will be shown as written). */
  authorName: string;
  /** 1–2 letter initials for the avatar. Auto-derived if omitted. */
  authorInitials?: string;
  /** Avatar tint background color. Defaults to lilac. */
  authorTint?: string;
  /** Relative time label, e.g. "this morning", "2 days ago". */
  when?: string;
  /** Reflection body — rendered italic, serif, lilac. */
  body: string;
  onReply?: () => void;
  onMarkAsConcept?: () => void;
  testID?: string;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PeerReflectionQuote({
  authorName,
  authorInitials,
  authorTint,
  when,
  body,
  onReply,
  onMarkAsConcept,
  testID,
}: PeerReflectionQuoteProps) {
  const initials = authorInitials ?? initialsFor(authorName);
  const tint = authorTint ?? IOS_PURPLE;
  const showActions = Boolean(onReply || onMarkAsConcept);

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: tint }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.authorName}>{authorName}</Text>
        {when ? <Text style={styles.when}>{when}</Text> : null}
      </View>

      <Text style={styles.body}>"{body.trim()}"</Text>

      {showActions ? (
        <View style={styles.actions}>
          {onReply ? (
            <Pressable onPress={onReply} hitSlop={6} style={styles.actionBtn}>
              <Ionicons name="arrow-undo-outline" size={13} color={IOS_PURPLE_DEEP} />
              <Text style={styles.actionText}>Reply</Text>
            </Pressable>
          ) : null}
          {onMarkAsConcept ? (
            <Pressable onPress={onMarkAsConcept} hitSlop={6} style={styles.actionBtn}>
              <Ionicons name="bookmark-outline" size={13} color={IOS_PURPLE_DEEP} />
              <Text style={styles.actionText}>Mark as concept seed</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: IOS_PURPLE_TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(88, 86, 214, 0.20)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  authorName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: LABEL,
  },
  when: {
    fontSize: 12,
    color: LABEL_3,
  },
  body: {
    marginTop: 6,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.1,
    color: LABEL_2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_PURPLE_DEEP,
  },
});
