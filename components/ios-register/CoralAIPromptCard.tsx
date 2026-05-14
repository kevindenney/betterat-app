/**
 * CoralAIPromptCard — ~12% coral fill, sparkles glyph, ALL-CAPS coral
 * eyebrow, 17px body (italic accent allowed only as a quotation-mark
 * substitute, never as voice grammar), filled iOS-blue button + text
 * "Not now" pair.
 *
 * Replaces the editorial lilac AI prompt card. Same semantic: AI offering
 * a synthesis the user can accept or decline. AI never speaks as itself
 * (no "I think...") — the eyebrow names the source ("FROM YOUR PLAYBOOK")
 * and the body is phrased as a question.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

interface Props {
  label: string;
  /** Body text. Use <Text style={{ fontStyle: 'italic' }}> for embedded concept names. */
  children: React.ReactNode;
  primaryAction: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  /**
   * Primary button accent. Race Prep uses 'blue' (user action: "open as a
   * concept"). Debrief uses 'coral' (system signal: "follow a thread the
   * system noticed"). See the Debrief iOS register side rail's "Two
   * accents, two jobs — with one local override" block.
   */
  primaryAccent?: 'blue' | 'coral';
}

export function CoralAIPromptCard({
  label,
  children,
  primaryAction,
  secondaryAction,
  primaryAccent = 'blue',
}: Props) {
  const primaryBg =
    primaryAccent === 'coral'
      ? IOS_REGISTER.accentMarkedContent
      : IOS_REGISTER.accentUserAction;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons
          name="sparkles"
          size={17}
          color={IOS_REGISTER.accentMarkedContent}
        />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.body}>{children}</Text>
      <View style={styles.actions}>
        <Pressable
          style={[styles.btnFill, { backgroundColor: primaryBg }]}
          onPress={primaryAction.onPress}
          accessibilityRole="button"
        >
          <Text style={styles.btnFillText}>{primaryAction.label}</Text>
        </Pressable>
        {secondaryAction && (
          <Pressable
            style={styles.btnText}
            onPress={secondaryAction.onPress}
            accessibilityRole="button"
          >
            <Text style={styles.btnTextLabel}>{secondaryAction.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 16,
    paddingRight: 18,
    paddingBottom: 14,
    paddingLeft: 18,
    backgroundColor: IOS_REGISTER.accentMarkedContentTint,
    borderRadius: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  label: {
    ...IOS_REGISTER_TEXT.aiPromptLabel,
    color: IOS_REGISTER.accentMarkedContent,
  },
  body: {
    ...IOS_REGISTER_TEXT.aiPromptBody,
    color: IOS_REGISTER.label,
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  btnFill: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  btnFillText: {
    ...IOS_REGISTER_TEXT.buttonFill,
    color: '#FFFFFF',
  },
  btnText: {
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  btnTextLabel: {
    ...IOS_REGISTER_TEXT.buttonText,
    color: IOS_REGISTER.labelSecondary,
  },
});
