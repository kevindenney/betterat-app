/**
 * ToolbarComposer — 17pt prompt above + six modality-equal 44px tools in
 * a rounded white card. Capture is one of several actions; the user picks.
 *
 * Design principle (from the editorial register spec, ported to iOS):
 * COMPOSITION SURFACES GET TOOLBAR COMPOSERS; CAPTURE SURFACES GET HERO-
 * MIC COMPOSERS. Race Prep is composition (use this). On the Water is
 * capture (use a hero mic instead).
 *
 * The sparkles tool is the coral-tinted AI affordance; all others use
 * iOS blue.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER, IOS_REGISTER_TEXT } from '@/lib/design-tokens-ios';

export interface ComposerTool {
  /** Unique key */
  key: string;
  /** Accessibility label */
  label: string;
  /** Ionicons name */
  icon: keyof typeof Ionicons.glyphMap;
  /** Coral-tint AI affordance variant (typically the sparkles tool) */
  sparkles?: boolean;
  onPress: () => void;
}

interface Props {
  prompt?: string;
  tools: ComposerTool[];
}

export function ToolbarComposer({ prompt, tools }: Props) {
  return (
    <View style={styles.composer}>
      {prompt ? <Text style={styles.prompt}>{prompt}</Text> : null}
      <View style={styles.toolbar}>
        {tools.map((tool) => (
          <Pressable
            key={tool.key}
            onPress={tool.onPress}
            style={styles.tool}
            accessibilityLabel={tool.label}
            accessibilityRole="button"
          >
            <Ionicons
              name={tool.icon}
              size={22}
              color={
                tool.sparkles
                  ? IOS_REGISTER.accentMarkedContent
                  : IOS_REGISTER.accentUserAction
              }
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    paddingTop: 28,
    paddingRight: 20,
    paddingBottom: 16,
    paddingLeft: 20,
  },
  prompt: {
    ...IOS_REGISTER_TEXT.composerPrompt,
    color: IOS_REGISTER.label,
    marginBottom: 18,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
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
  tool: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
