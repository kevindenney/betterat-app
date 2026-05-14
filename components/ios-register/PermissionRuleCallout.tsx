/**
 * PermissionRuleCallout — coral-bordered card for a "rule you committed to."
 *
 * Two variants per the editorial-register principle "components persist
 * across surfaces and scale to the surface's role":
 *
 *   variant="inline" (default) — 3px coral border, 17pt semibold rule,
 *     contained inside a beat card. Used on Race Prep.
 *
 *   variant="pinned" — 4px coral border, 24pt coral flag, 24pt semibold
 *     rule, generous padding, optional "watching pulse" + ack line.
 *     Used on On the Water where the rule is load-bearing for action.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

type Variant = 'inline' | 'pinned';

interface Props {
  /** Label above the rule. ALL-CAPS rendering is applied via styling. */
  label?: string;
  /** The rule itself */
  text: string;
  variant?: Variant;
  /** Pinned-variant only: ack line + optional "watching" pulse */
  ack?: string;
  watching?: boolean;
}

export function PermissionRuleCallout({
  label = 'Your rule',
  text,
  variant = 'inline',
  ack,
  watching,
}: Props) {
  if (variant === 'pinned') {
    return (
      <View style={styles.pinned}>
        <Ionicons
          name="flag"
          size={24}
          color={IOS_REGISTER.accentMarkedContent}
          style={styles.pinnedFlag}
        />
        <Text style={styles.pinnedLabel}>{label}</Text>
        <Text style={styles.pinnedText}>{text}</Text>
        {(ack || watching) && (
          <View style={styles.pinnedAckRow}>
            {ack ? <Text style={styles.pinnedAck}>{ack}</Text> : <View />}
            {watching && (
              <View style={styles.watchingPill}>
                <View style={styles.watchingPulse} />
                <Text style={styles.watchingText}>watching</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <Ionicons
        name="flag"
        size={17}
        color={IOS_REGISTER.accentMarkedContent}
        style={styles.inlineFlag}
      />
      <View style={styles.inlineBody}>
        <Text style={styles.inlineLabel}>{label}</Text>
        <Text style={styles.inlineText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Inline variant (Race Prep)
  inline: {
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
  inlineFlag: {
    marginTop: 1,
    lineHeight: 17,
  },
  inlineBody: {
    flex: 1,
  },
  inlineLabel: {
    ...IOS_REGISTER_TEXT.ruleLabel,
    color: IOS_REGISTER.accentMarkedContent,
    marginBottom: 4,
  },
  inlineText: {
    ...IOS_REGISTER_TEXT.ruleText,
    color: IOS_REGISTER.label,
  },

  // Pinned variant (On the Water) — load-bearing scaled-up version
  pinned: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: IOS_REGISTER.accentMarkedContent,
    paddingTop: 20,
    paddingRight: 22,
    paddingBottom: 18,
    paddingLeft: 22,
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.10)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 6,
      },
    }),
  },
  pinnedFlag: {
    marginBottom: 6,
    lineHeight: 24,
  },
  pinnedLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: IOS_REGISTER.accentMarkedContent,
    marginBottom: 8,
  },
  pinnedText: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    color: IOS_REGISTER.label,
    letterSpacing: -0.5,
  },
  pinnedAckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  pinnedAck: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  watchingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  watchingPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  watchingText: {
    fontSize: 13,
    color: IOS_REGISTER.accentMarkedContent,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
});
