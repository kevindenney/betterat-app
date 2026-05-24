/**
 * /account/connected-services — Screen 14 of the v3 screen designs.
 *
 * Lives under the avatar tap (Profile-as-tab is gone in v3). Lists two
 * daily-driver chat clients (WhatsApp, Telegram) on top and the existing
 * secondary channels (email digest, push notifications) underneath. Each
 * chat client row routes to its own connect pane.
 *
 * Gated by WHATSAPP_CONNECT_V3. Off-flag, this route is dead-stock — the
 * ProfileDropdown entry doesn't render and nothing deep-links here.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useIsConnectedToWhatsApp } from '@/hooks/useConnectedServices';

export default function ConnectedServicesIndexScreen() {
  const flagOn = FEATURE_FLAGS.WHATSAPP_CONNECT_V3;
  const { isConnected } = useIsConnectedToWhatsApp();

  if (!flagOn) {
    return (
      <SafeAreaView style={styles.disabled}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.disabledTitle}>Connected services aren't live yet.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_WHATSAPP_CONNECT_V3 in this environment to preview.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.surface} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.navBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/account' as never))}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={IOS_COLORS.systemBlue} />
          <Text style={styles.backText}>Done</Text>
        </Pressable>
        <Text style={styles.navTitle}>Connected services</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.sectionEyebrow}>DAILY-DRIVER CLIENTS</Text>
        <View style={styles.card}>
          <ClientRow
            icon="logo-whatsapp"
            tint="#25D366"
            name="WhatsApp"
            sub="your BetterAt as a chat thread"
            actionLabel={isConnected ? 'Connected' : 'Connect'}
            connected={isConnected}
            onPress={() => router.push('/account/connected-services/whatsapp' as never)}
          />
          <View style={styles.divider} />
          <ClientRow
            icon="paper-plane"
            tint="#2AABEE"
            name="Telegram"
            sub="your BetterAt as a chat thread"
            actionLabel="Connect"
            connected={false}
            onPress={() => router.push('/account/connected-services/whatsapp?provider=telegram' as never)}
          />
        </View>
        <Text style={styles.sectionFootnote}>
          Connect one and your steps, suggestions, and daily prompts come to you
          wherever you already are. Voice in, voice out.
        </Text>

        <Text style={[styles.sectionEyebrow, styles.sectionEyebrowSecond]}>OTHER</Text>
        <View style={styles.card}>
          <SecondaryRow
            icon="mail-outline"
            tint={IOS_COLORS.systemGray}
            name="Email weekly digest"
            sub="on · Sunday 8 AM"
            onPress={() => {
              /* future: navigate to email digest settings */
            }}
          />
          <View style={styles.divider} />
          <SecondaryRow
            icon="notifications-outline"
            tint={IOS_COLORS.systemOrange}
            name="Push notifications"
            sub="peers + suggestions only"
            onPress={() => {
              /* future: navigate to notification settings */
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ClientRow({
  icon,
  tint,
  name,
  sub,
  actionLabel,
  connected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  name: string;
  sub: string;
  actionLabel: string;
  connected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={[styles.connectPill, connected && styles.connectPillConnected]}>
        {connected ? (
          <Ionicons name="checkmark" size={12} color="#1F7A3A" />
        ) : null}
        <Text style={[styles.connectPillText, connected && styles.connectPillTextConnected]}>
          {actionLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function SecondaryRow({
  icon,
  tint,
  name,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  name: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, styles.rowIconSecondary, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={IOS_REGISTER.labelTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  disabled: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  disabledTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginBottom: 6,
  },
  disabledBody: {
    fontSize: 13.5,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
  },
  backText: {
    fontSize: 15,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 40 },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: IOS_SPACING.lg + 4,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionEyebrowSecond: {
    marginTop: 28,
  },
  sectionFootnote: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: IOS_SPACING.lg + 4,
    marginTop: 10,
    lineHeight: 17,
  },
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    marginHorizontal: IOS_SPACING.lg,
    borderRadius: 14,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_REGISTER.separator,
    marginLeft: 56,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconSecondary: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.label,
  },
  rowSub: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  connectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  connectPillConnected: {
    backgroundColor: 'rgba(52, 199, 89, 0.16)',
  },
  connectPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  connectPillTextConnected: {
    color: '#1F7A3A',
  },
});
