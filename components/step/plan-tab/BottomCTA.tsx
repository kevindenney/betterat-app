/**
 * <BottomCTA> — reusable footer CTA wrapper for StepCard's footer slot.
 *
 * Phase 1 · iOS register · D3. Active state ships the user to the next
 * phase ("Next: Do →"); disabled state shows a centered hint line
 * underneath ("Add a what to enable").
 *
 * Canonical: docs/redesign/ios-register/step-loop-integration-canonical.html
 *            .step-card-footer .btn · derived from §1
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import {
  GRAY_5,
  IOS_BLUE,
  LABEL_3,
  LABEL_4,
} from '@/lib/design-tokens-step-loop-ios';

export interface BottomCTAProps {
  label: string;
  /** Hint rendered beneath the button. Common: "Add a what to enable" / "Plan looks ready". */
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
}

export function BottomCTA({ label, hint, disabled, onPress, testID }: BottomCTAProps) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityLabel={label}
        style={[styles.btn, disabled && styles.btnDisabled]}
      >
        <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>{label}</Text>
        <ArrowRight
          size={disabled ? 14 : 16}
          color={disabled ? LABEL_4 : '#FFFFFF'}
        />
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 14,
    backgroundColor: IOS_BLUE,
    paddingHorizontal: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 22px -8px rgba(0, 122, 255, 0.40), 0 1px 2px rgba(0,0,0,0.06)',
      } as any,
      default: {
        shadowColor: IOS_BLUE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },
  btnDisabled: {
    backgroundColor: GRAY_5,
    ...Platform.select({
      web: { boxShadow: 'none' } as any,
      default: {
        shadowOpacity: 0,
        elevation: 0,
      },
    }),
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  btnTextDisabled: {
    color: LABEL_3,
  },
  hint: {
    marginTop: 6,
    fontSize: 10.5,
    color: LABEL_3,
    textAlign: 'center',
  },
});
