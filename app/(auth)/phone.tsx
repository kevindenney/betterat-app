/**
 * Phone + OTP sign-in / sign-up — `/(auth)/phone`
 *
 * Two-step screen (phone → code) wired to `useAuth().sendPhoneOtp` and
 * `useAuth().verifyPhoneOtp`. Built for the plan §4 Step 5 "dev-context"
 * onboarding entry: voice-first / partial-literacy users who only have a
 * phone number. After verifying:
 *
 *   - New user (no `users` row, or onboarding_completed=false) → routed to
 *     `/(auth)/sailor-onboarding-comprehensive`, which already collects
 *     name + interest + initial timeline state.
 *   - Returning user → routed to `/(tabs)/races` (timeline).
 *
 * No Hindi translation yet — the plan calls for a dedicated i18n pass.
 * This screen uses literal English so the surface is shippable and the
 * i18n migration can swap strings into a new `auth` namespace once it
 * lands.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Text } from '@/components/ui/text';
import { useAuth } from '@/providers/AuthProvider';

const C = {
  bg: '#F5F4F1',
  cardBg: '#FFFFFF',
  cardBorder: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  accent: '#3D8A5A',
  accentBg: 'rgba(61,138,90,0.08)',
  error: '#C24F3E',
  errorBg: 'rgba(194,79,62,0.08)',
} as const;

type Stage = 'phone' | 'code';

export default function PhoneAuthScreen() {
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('+');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    setBusy(true);
    try {
      await sendPhoneOtp(phone);
      setStage('code');
    } catch (e: any) {
      setError(e?.message ?? 'Could not send code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setBusy(true);
    try {
      const { isNewUser } = await verifyPhoneOtp(phone, code);
      // `verifyPhoneOtp` already set signedIn=true; route based on whether
      // the profile needs onboarding.
      if (returnTo && typeof returnTo === 'string' && returnTo.startsWith('/')) {
        router.replace(returnTo as any);
        return;
      }
      if (isNewUser) {
        router.replace('/(auth)/sailor-onboarding-comprehensive' as any);
      } else {
        router.replace('/(tabs)/races');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not verify code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => (stage === 'code' ? setStage('phone') : router.back())}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={C.labelDark} />
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={styles.title}>
          {stage === 'phone' ? 'Continue with your phone' : 'Enter the code'}
        </Text>
        <Text style={styles.subtitle}>
          {stage === 'phone'
            ? "We'll text you a one-time code. No password needed."
            : `Enter the 6-digit code we texted to ${phone}.`}
        </Text>

        {stage === 'phone' ? (
          <>
            <TextInput
              testID="phone-auth-phone-input"
              accessibilityLabel="Phone number"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+919812345678"
              placeholderTextColor={C.labelLight}
              keyboardType={Platform.OS === 'web' ? 'default' : 'phone-pad'}
              autoComplete="tel"
              textContentType="telephoneNumber"
              editable={!busy}
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Use the international format starting with + and your country code.
            </Text>
          </>
        ) : (
          <TextInput
            testID="phone-auth-code-input"
            accessibilityLabel="One-time code"
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={C.labelLight}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={8}
            editable={!busy}
          />
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          testID={stage === 'phone' ? 'phone-auth-send-button' : 'phone-auth-verify-button'}
          accessibilityRole="button"
          style={[styles.primaryButton, busy && styles.buttonDisabled]}
          onPress={stage === 'phone' ? handleSend : handleVerify}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {stage === 'phone' ? 'Send code' : 'Verify'}
            </Text>
          )}
        </TouchableOpacity>

        {stage === 'code' && (
          <TouchableOpacity onPress={handleSend} disabled={busy} style={styles.resendButton}>
            <Text style={styles.resendText}>Resend code</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    padding: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: C.labelDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: C.labelMid,
    lineHeight: 22,
    marginBottom: 24,
  },
  input: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: C.labelDark,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: C.labelLight,
    marginBottom: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.errorBg,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: C.error,
  },
  primaryButton: {
    backgroundColor: C.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  resendText: {
    fontSize: 14,
    color: C.accent,
    fontWeight: '500',
  },
});
