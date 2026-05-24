/**
 * /account/connected-services/whatsapp — Screens 15 + 17 of the v3
 * screen designs · The reflecting & suggesting system.
 *
 * Two states behind a single route:
 *   - Not connected (Screen 15): QR + 6-digit code + Open WhatsApp
 *     deep-link, plus a "Mark as connected" affordance that flips the
 *     local AsyncStorage flag so reviewers can walk the confirmed UX.
 *   - Connected (Screen 17): green confirmation header + three toggles
 *     (peer suggestions, daily prompt, SHG bridge) + a "Send me a prompt
 *     now" test button (UI-only, no real send).
 *
 * Telegram piggybacks on the same route with ?provider=telegram. Same
 * visual chrome, different deep-link + tint. The Connect pane only — the
 * confirmed-state UX for Telegram lands when the real bot wiring does.
 *
 * Gated by WHATSAPP_CONNECT_V3. Per the WhatsApp Business Platform ToS
 * analysis (2026-05-24), the SHG bridge toggle is shown but its docs
 * call out that the actual in-group bot behavior is deferred until Meta
 * widens Groups API access — for now it's a placeholder switch.
 */

import React, { useCallback, useMemo } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import {
  useIsConnectedToWhatsApp,
  useWhatsAppToggles,
} from '@/hooks/useConnectedServices';

type Provider = 'whatsapp' | 'telegram';

const PROVIDER_TINT: Record<Provider, string> = {
  whatsapp: '#25D366',
  telegram: '#2AABEE',
};

const PROVIDER_NAME: Record<Provider, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

function generateCode(): string {
  // v1 mock — a stable random 6-digit code per session. Real flow gets
  // a server-issued, single-use, time-boxed token written to a
  // whatsapp_links row. UI doesn't care which.
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

export default function ConnectWhatsAppScreen() {
  const flagOn = FEATURE_FLAGS.WHATSAPP_CONNECT_V3;
  const params = useLocalSearchParams<{ provider?: string }>();
  const provider: Provider = params.provider === 'telegram' ? 'telegram' : 'whatsapp';
  const tint = PROVIDER_TINT[provider];
  const name = PROVIDER_NAME[provider];

  const { isConnected, markConnected } = useIsConnectedToWhatsApp();
  const code = useMemo(generateCode, []);

  const openClient = useCallback(() => {
    // v1 mock — the real deep-link routes to the BetterAt bot via the
    // BSP's hosted chat URL (e.g. wa.me/<botPhone>?text=<code>). For
    // the preview, just open the platform's universal app.
    const url = provider === 'whatsapp' ? 'https://wa.me/' : 'https://t.me/';
    Linking.openURL(url).catch(() => {
      /* swallow — preview UX */
    });
  }, [provider]);

  if (!flagOn) {
    return (
      <SafeAreaView style={styles.disabled}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.disabledTitle}>Connect {name} isn't live yet.</Text>
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
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/account/connected-services' as never))}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={IOS_COLORS.systemBlue} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>Connect {name}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {isConnected ? (
          <ConnectedView name={name} tint={tint} provider={provider} onDisconnect={() => markConnected(false)} />
        ) : (
          <ConnectPane
            name={name}
            tint={tint}
            provider={provider}
            code={code}
            onOpenClient={openClient}
            onMarkConnected={() => markConnected(true)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConnectPane({
  name,
  tint,
  provider,
  code,
  onOpenClient,
  onMarkConnected,
}: {
  name: string;
  tint: string;
  provider: Provider;
  code: string;
  onOpenClient: () => void;
  onMarkConnected: () => void;
}) {
  const botContact = provider === 'whatsapp' ? 'BetterAt Sakhi' : 'BetterAt Bot';
  return (
    <View style={styles.pane}>
      <Text style={styles.paneTitle}>
        <Text style={styles.paneTitleItalic}>{botContact}</Text> in your {name}
      </Text>
      <Text style={styles.paneSub}>
        Tap below to start a chat with our bot. Send the code so we know it's you.
        Voice notes work in any language.
      </Text>

      {/* QR placeholder — real flow renders a server-generated QR PNG
          encoding the deep-link + code. Replaced when wiring lands. */}
      <View style={styles.qrFrame}>
        <View style={styles.qrInner}>
          <Ionicons name="qr-code" size={140} color={IOS_REGISTER.label} />
        </View>
      </View>

      <View style={styles.codeBox}>
        <Text style={styles.codeEyebrow}>YOUR CODE</Text>
        <Text style={styles.codeDigits}>
          {code.slice(0, 3)}{' '}{code.slice(3)}
        </Text>
        <Text style={styles.codeFootnote}>expires in 10:00</Text>
      </View>

      <Pressable style={[styles.primaryBtn, { backgroundColor: tint }]} onPress={onOpenClient}>
        <Ionicons name={provider === 'whatsapp' ? 'logo-whatsapp' : 'paper-plane'} size={18} color="#FFFFFF" />
        <Text style={styles.primaryBtnText}>Open {name}</Text>
      </Pressable>

      <Text style={styles.altLine}>
        On a different phone? Scan the QR with {name}'s camera.
      </Text>

      {/* Preview-only escape hatch — flips local state so reviewers can
          walk the confirmed UX. Real flow drops this once the BSP webhook
          confirms the code on its side. */}
      <Pressable style={styles.previewBtn} onPress={onMarkConnected}>
        <Ionicons name="flash-outline" size={13} color={IOS_REGISTER.labelSecondary} />
        <Text style={styles.previewBtnText}>Preview: mark as connected</Text>
      </Pressable>
    </View>
  );
}

function ConnectedView({
  name,
  tint,
  provider,
  onDisconnect,
}: {
  name: string;
  tint: string;
  provider: Provider;
  onDisconnect: () => void;
}) {
  const { toggles, setToggle } = useWhatsAppToggles();
  const phoneMasked = provider === 'whatsapp' ? '+91 98 7654 3210' : '@username';
  const shg = provider === 'whatsapp' ? 'Suvarna Mahila SHG · 12 members' : '—';

  return (
    <View style={styles.pane}>
      <View style={[styles.connectedDisc, { backgroundColor: 'rgba(52, 199, 89, 0.16)' }]}>
        <Ionicons name="checkmark" size={42} color="#1F7A3A" />
      </View>
      <Text style={styles.connectedTitle}>
        {name} <Text style={styles.connectedTitleItalic}>connected</Text>
      </Text>
      <Text style={styles.connectedSub}>
        Sending to <Text style={styles.connectedPhone}>{phoneMasked}</Text>
        {'\n'}via <Text style={styles.connectedBot}>BetterAt Sakhi</Text> · verified business
        {'\n'}<Text style={styles.connectedQuiet}>Daily prompt at sundown · in Marathi</Text>
      </Text>

      <Pressable style={[styles.testBtn]} onPress={() => {
        /* preview-only test send — real flow would POST to the bot */
      }}>
        <Ionicons name="notifications-outline" size={15} color={IOS_REGISTER.label} />
        <Text style={styles.testBtnText}>Send me a prompt now</Text>
      </Pressable>

      <Text style={[styles.sectionEyebrow, { marginTop: 28 }]}>WHAT FLOWS THROUGH {name.toUpperCase()}</Text>
      <View style={styles.toggleCard}>
        <ToggleRow
          icon="bulb-outline"
          tint="#FF9500"
          name="Peer suggestions"
          sub="accept/decline inline"
          value={toggles.peerSuggestions}
          onValueChange={(v) => setToggle('peerSuggestions', v)}
        />
        <View style={styles.divider} />
        <ToggleRow
          icon="alarm-outline"
          tint="#AF52DE"
          name="Daily prompt"
          sub="at sundown · Marathi"
          value={toggles.dailyPrompt}
          onValueChange={(v) => setToggle('dailyPrompt', v)}
        />
        <View style={styles.divider} />
        <ToggleRow
          icon="people-outline"
          tint="#5856D6"
          name="SHG bridge"
          sub={shg}
          value={toggles.shgBridge}
          onValueChange={(v) => setToggle('shgBridge', v)}
          disabledNote="Deferred — pending Meta Groups API access"
        />
      </View>

      <View style={styles.previewLinkRow}>
        <Pressable
          onPress={() => router.push('/account/connected-services/preview' as never)}
          hitSlop={6}
        >
          <Text style={styles.previewLinkText}>Preview how this looks in {name}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.disconnectBtn} onPress={onDisconnect}>
        <Text style={[styles.disconnectBtnText, { color: tint }]}>
          {/* tint reused for the destructive accent on the connect screen */}
          Disconnect
        </Text>
      </Pressable>
    </View>
  );
}

function ToggleRow({
  icon,
  tint,
  name,
  sub,
  value,
  onValueChange,
  disabledNote,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  name: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabledNote?: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
      </View>
      <View style={styles.toggleRowText}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
        {disabledNote ? (
          <Text style={styles.disabledNote} numberOfLines={1}>
            {disabledNote}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
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
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 40 },
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
  codeBox: {
    alignItems: 'center',
    marginTop: 22,
  },
  codeEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelTertiary,
    textTransform: 'uppercase',
  },
  codeDigits: {
    fontSize: 38,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  codeFootnote: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
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
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 30,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  previewBtnText: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '500',
  },

  // Connected (Screen 17)
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
  connectedQuiet: {
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
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
  toggleCard: {
    width: '100%',
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  toggleRowText: {
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
  disabledNote: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_REGISTER.separator,
    marginLeft: 52,
  },
  previewLinkRow: {
    marginTop: 22,
  },
  previewLinkText: {
    fontSize: 13,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
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
