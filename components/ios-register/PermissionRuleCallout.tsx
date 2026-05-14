/**
 * PermissionRuleCallout — inline callout for a "rule you committed to."
 *
 * 3px coral left border + flag glyph + ALL-CAPS coral eyebrow + 17px
 * semibold rule text. Lives inside a beat card (typically Contingency).
 * Marked content the user committed to — same coral semantic as the AI
 * prompt card, distinct grammar (user-authored rule, not system prompt).
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

interface Props {
  /** Label above the rule, e.g. "YOUR RULE" — will be rendered ALL-CAPS */
  label?: string;
  /** The rule itself */
  text: string;
}

export function PermissionRuleCallout({ label = 'Your rule', text }: Props) {
  return (
    <View style={styles.callout}>
      <Ionicons
        name="flag"
        size={17}
        color={IOS_REGISTER.accentMarkedContent}
        style={styles.flag}
      />
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
    paddingTop: 12,
    paddingRight: 14,
    paddingBottom: 13,
    paddingLeft: 13,
    backgroundColor: '#FAFAFC',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: IOS_REGISTER.accentMarkedContent,
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 0 0 0.5px rgba(60, 60, 67, 0.20)',
      } as any,
      default: {},
    }),
  },
  flag: {
    marginTop: 1,
    lineHeight: 17,
  },
  body: {
    flex: 1,
  },
  label: {
    ...IOS_REGISTER_TEXT.ruleLabel,
    color: IOS_REGISTER.accentMarkedContent,
    marginBottom: 4,
  },
  text: {
    ...IOS_REGISTER_TEXT.ruleText,
    color: IOS_REGISTER.label,
  },
});
