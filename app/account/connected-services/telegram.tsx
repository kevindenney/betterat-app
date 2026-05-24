/**
 * /account/connected-services/telegram — real Telegram link pane.
 *
 * Same visual chrome as /account/connected-services/whatsapp but driven by
 * the real telegram_links row (via useTelegramLink) instead of AsyncStorage.
 *
 * Connect pane: "Open Telegram" deep-links to https://t.me/<bot> with the
 * user's id as the /start payload. The bot recognises that on the first
 * inbound message and either auto-links or replies with a confirmation
 * link to /settings/telegram?code=<x>. Either way the existing webhook
 * (api/telegram/webhook.ts) handles it.
 *
 * Connected pane: shows the linked @username, a Test message button
 * (UI-only placeholder until we wire a bot test ping), and Disconnect
 * which flips is_active=false on the link row.
 *
 * Gated by WHATSAPP_CONNECT_V3 (same flag as the Connected Services index).
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
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
import {
  useTelegramLink,
  telegramBotUsername,
  telegramBotDeepLink,
} from '@/hooks/useTelegramLink';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';

const TG_TINT = '#2AABEE';

export default function ConnectTelegramScreen() {
  const flagOn = FEATURE_FLAGS.WHATSAPP_CONNECT_V3;
  const { link, isConnected, isLoaded, refresh, disconnect } = useTelegramLink();

  const openBot = useCallback(() => {
    // No payload — webhook only auto-handles `link_<code>` and bare UUIDs
    // fall through to the welcome message (noisy for already-linked users).
    const url = telegramBotDeepLink();
    Linking.openURL(url).catch(() => {
      /* swallow — universal Telegram link, no fallback needed */
    });
  }, []);

  const onDisconnect = useCallback(() => {
    showConfirm(
      'Disconnect Telegram',
      'BetterAt will stop sending and receiving messages via Telegram. You can reconnect any time.',
      async () => {
        await disconnect();
      },
      { destructive: true },
    );
  }, [disconnect]);

  if (!flagOn) {
    return (
      <SafeAreaView style={styles.disabled}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.disabledTitle}>Connect Telegram isn't live yet.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_WHATSAPP_CONNECT_V3 to preview.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.surface} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.navBar}>
        <Pressable
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/account/connected-services' as never)
          }
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={IOS_COLORS.systemBlue} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>Connect Telegram</Text>
        <Pressable onPress={() => void refresh()} hitSlop={8} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color={IOS_COLORS.systemBlue} />
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {!isLoaded ? (
          <View style={styles.loading}>
            <ActivityIndicator color={TG_TINT} />
          </View>
        ) : isConnected ? (
          <ConnectedView
            usernameLabel={link?.telegram_username ? `@${link.telegram_username}` : 'Telegram user'}
            onDisconnect={onDisconnect}
          />
        ) : (
          <ConnectPane onOpenBot={openBot} onRefresh={() => void refresh()} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConnectPane({
  onOpenBot,
  onRefresh,
}: {
  onOpenBot: () => void;
  onRefresh: () => void;
}) {
  const bot = telegramBotUsername();
  return (
    <View style={styles.pane}>
      <Text style={styles.paneTitle}>
        <Text style={styles.paneTitleItalic}>BetterAt Assistant</Text> in your Telegram
      </Text>
      <Text style={styles.paneSub}>
        Tap below to start a chat. Send any message and the bot will reply with a one-tap
        link back here to confirm it's you. Voice notes work in any language.
      </Text>

      <View style={styles.qrFrame}>
        <View style={styles.qrInner}>
          <Ionicons name="paper-plane" size={120} color={TG_TINT} />
        </View>
      </View>

      <View style={styles.botBox}>
        <Text style={styles.botEyebrow}>BOT</Text>
        <Text style={styles.botHandle}>@{bot}</Text>
      </View>

      <Pressable style={[styles.primaryBtn, { backgroundColor: TG_TINT }]} onPress={onOpenBot}>
        <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
        <Text style={styles.primaryBtnText}>Open Telegram</Text>
      </Pressable>

      <Text style={styles.altLine}>
        On a different phone? Open Telegram and search for @{bot}.
      </Text>

      <Pressable style={styles.refreshPill} onPress={onRefresh}>
        <Ionicons name="refresh" size={13} color={IOS_REGISTER.labelSecondary} />
        <Text style={styles.refreshPillText}>I've linked — refresh</Text>
      </Pressable>
    </View>
  );
}

function ConnectedView({
  usernameLabel,
  onDisconnect,
}: {
  usernameLabel: string;
  onDisconnect: () => void;
}) {
  const bot = telegramBotUsername();
  const reopenBot = useCallback(() => {
    Linking.openURL(`https://t.me/${bot}`).catch(() => {});
  }, [bot]);

  return (
    <View style={styles.pane}>
      <View style={[styles.connectedDisc, { backgroundColor: 'rgba(52, 199, 89, 0.16)' }]}>
        <Ionicons name="checkmark" size={42} color="#1F7A3A" />
      </View>
      <Text style={styles.connectedTitle}>
        Telegram <Text style={styles.connectedTitleItalic}>connected</Text>
      </Text>
      <Text style={styles.connectedSub}>
        Sending to <Text style={styles.connectedPhone}>{usernameLabel}</Text>
        {'\n'}via <Text style={styles.connectedBot}>@{bot}</Text>
      </Text>

      <Pressable style={styles.testBtn} onPress={reopenBot}>
        <Ionicons name="open-outline" size={15} color="#FFFFFF" />
        <Text style={styles.testBtnText}>Open chat with @{bot}</Text>
      </Pressable>

      <Text style={[styles.sectionEyebrow, { marginTop: 28 }]}>WHAT THE BOT CAN DO</Text>
      <View style={styles.cardList}>
        <CapabilityRow
          icon="checkmark-done-outline"
          tint="#34C759"
          name="Log observations"
          sub={`"I learned my tacks were sharp today on Hong Kong 2027"`}
        />
        <View style={styles.divider} />
        <CapabilityRow
          icon="mic-outline"
          tint="#FF9500"
          name="Voice notes in any language"
          sub="transcribed + parsed into a step update"
        />
        <View style={styles.divider} />
        <CapabilityRow
          icon="image-outline"
          tint="#5856D6"
          name="Photos as evidence"
          sub="attached to the matching step"
        />
        <View style={styles.divider} />
        <CapabilityRow
          icon="alarm-outline"
          tint="#AF52DE"
          name="Daily prompt + weekly digest"
          sub="quiet check-ins on your timeline"
        />
      </View>

      <Pressable style={styles.disconnectBtn} onPress={onDisconnect}>
        <Text style={[styles.disconnectBtnText, { color: TG_TINT }]}>Disconnect</Text>
      </Pressable>
    </View>
  );
}

function CapabilityRow({
  icon,
  tint,
  name,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  name: string;
  sub: string;
}) {
  return (
    <View style={styles.capRow}>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
      </View>
      <View style={styles.capRowText}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={2}>{sub}</Text>
      </View>
    </View>
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
    minWidth: 70,
  },
  backText: {
    fontSize: 15,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  refreshBtn: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 40 },
  loading: {
    paddingTop: 64,
    alignItems: 'center',
  },
  pane: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 16,
    alignItems: 'center',
  },
  paneTitle: {
    fontSize: 26,
    fontWeight: '400',
    color: IOS_REGISTER.label,
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      web: 'Georgia, "Times New Roman", serif',
      default: 'Georgia',
    }) as string,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: 8,
  },
  paneTitleItalic: {
    fontStyle: 'italic',
  },
  paneSub: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },
  qrFrame: {
    marginTop: 28,
    width: 200,
    height: 200,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  qrInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  botBox: {
    alignItems: 'center',
    marginTop: 22,
  },
  botEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelTertiary,
    textTransform: 'uppercase',
  },
  botHandle: {
    fontSize: 22,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 220,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  altLine: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  refreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  refreshPillText: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '500',
  },

  connectedDisc: {
    width: 80,
    height: 80,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  connectedTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginTop: 16,
  },
  connectedTitleItalic: {
    fontStyle: 'italic',
    color: '#1F7A3A',
  },
  connectedSub: {
    fontSize: 13.5,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  connectedPhone: {
    color: IOS_REGISTER.label,
    fontWeight: '600',
  },
  connectedBot: {
    color: IOS_REGISTER.label,
    fontWeight: '500',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.label,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionEyebrow: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardList: {
    width: '100%',
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
  },
  capRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  capRowText: {
    flex: 1,
    minWidth: 0,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_REGISTER.separator,
    marginLeft: 52,
  },
  disconnectBtn: {
    marginTop: 26,
    paddingVertical: 12,
  },
  disconnectBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
