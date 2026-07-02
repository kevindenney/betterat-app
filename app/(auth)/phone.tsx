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
 * Strings live in the `auth` i18n namespace (`lib/i18n/locales/<lng>/auth.json`).
 * Hindi translation ships with this screen for dev-context launch.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const isSafeReturnPath = (path: string | undefined): path is string =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');

const isValidE164Phone = (value: string) => /^\+[1-9]\d{7,14}$/.test(value.trim());

const isValidOtpCode = (value: string) => /^\d{4,8}$/.test(value.trim());

export default function PhoneAuthScreen() {
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { t } = useTranslation('auth');

  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('+');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError(t('phone.errors.phoneRequired'));
      return;
    }
    if (!isValidE164Phone(trimmedPhone)) {
      setError(t('phone.errors.phoneFormat'));
      return;
    }
    setBusy(true);
    try {
      await sendPhoneOtp(trimmedPhone);
      setPhone(trimmedPhone);
      setStage('code');
    } catch (e: any) {
      setError(e?.message ?? t('phone.errors.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    const trimmedPhone = phone.trim();
    const trimmedCode = code.trim();
    if (!isValidOtpCode(trimmedCode)) {
      setError(t('phone.errors.codeFormat'));
      return;
    }
    setBusy(true);
    try {
      const { isNewUser } = await verifyPhoneOtp(trimmedPhone, trimmedCode);
      // `verifyPhoneOtp` already set signedIn=true; route based on whether
      // the profile needs onboarding.
      if (isSafeReturnPath(returnTo)) {
        router.replace(returnTo as any);
        return;
      }
      if (isNewUser) {
        router.replace('/(auth)/sailor-onboarding-comprehensive' as any);
      } else {
        router.replace('/(tabs)/races');
      }
    } catch (e: any) {
      setError(e?.message ?? t('phone.errors.verifyFailed'));
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
        accessibilityLabel={t('common.goBack')}
      >
        <Ionicons name="chevron-back" size={24} color={C.labelDark} />
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={styles.title}>
          {stage === 'phone' ? t('phone.title') : t('phone.codeTitle')}
        </Text>
        <Text style={styles.subtitle}>
          {stage === 'phone'
            ? t('phone.subtitle')
            : t('phone.codeSubtitle', { phone })}
        </Text>

        {stage === 'phone' ? (
          <>
            <TextInput
              testID="phone-auth-phone-input"
              accessibilityLabel={t('phone.phoneLabel')}
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('phone.phonePlaceholder')}
              placeholderTextColor={C.labelLight}
              keyboardType={Platform.OS === 'web' ? 'default' : 'phone-pad'}
              autoComplete="tel"
              textContentType="telephoneNumber"
              editable={!busy}
              autoCorrect={false}
            />
            <Text style={styles.hint}>{t('phone.phoneHint')}</Text>
          </>
        ) : (
          <TextInput
            testID="phone-auth-code-input"
            accessibilityLabel={t('phone.codeLabel')}
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder={t('phone.codePlaceholder')}
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
              {stage === 'phone' ? t('phone.sendButton') : t('phone.verifyButton')}
            </Text>
          )}
        </TouchableOpacity>

        {stage === 'code' && (
          <TouchableOpacity onPress={handleSend} disabled={busy} style={styles.resendButton}>
            <Text style={styles.resendText}>{t('phone.resendButton')}</Text>
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
