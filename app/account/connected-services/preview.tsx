/**
 * /account/connected-services/preview — Screen 05 of the v3 designs.
 *
 * UI-only mock of the canonical "Lakshmi chats with BetterAt Sakhi"
 * thread. WhatsApp visual register (green header, bot-on-left,
 * user-on-right bubbles, voice-note waveform), Marathi auto-translate
 * chrome, "Heard · added as a step" parse card with ✓ Looks right /
 * Edit, then a "FROM SUVARNA SHG" relayed suggestion with Accept /
 * Decline / Reply.
 *
 * Not interactive past navigation back. This is a screenshot the
 * reviewer can show to BSP partners and field testers to convey what
 * the connected experience looks like — not the live surface (which
 * lives in WhatsApp itself).
 *
 * Gated by WHATSAPP_CONNECT_V3.
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

const WA_GREEN = '#075E54';
const WA_GREEN_TINT = '#DCF8C6';
const WA_BG = '#ECE5DD';

export default function PreviewChatScreen() {
  const flagOn = FEATURE_FLAGS.WHATSAPP_CONNECT_V3;

  if (!flagOn) {
    return (
      <SafeAreaView style={styles.disabled}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.disabledTitle}>Preview not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.surface} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Outer iOS chrome */}
      <View style={styles.outerNav}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/account/connected-services/whatsapp' as never))}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={IOS_COLORS.systemBlue} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.outerNavTitle}>Preview</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Faux WhatsApp surface */}
      <View style={styles.waSurface}>
        <View style={styles.waHeader}>
          <View style={styles.waHeaderAvatar}>
            <Text style={styles.waHeaderAvatarText}>BS</Text>
          </View>
          <View style={styles.waHeaderText}>
            <Text style={styles.waHeaderName}>BetterAt Sakhi</Text>
            <Text style={styles.waHeaderSub}>
              auto-translates Marathi ↔ English · online
            </Text>
          </View>
          <Ionicons name="videocam" size={20} color="#FFFFFF" style={styles.waHeaderIcon} />
          <Ionicons name="call" size={18} color="#FFFFFF" style={styles.waHeaderIcon} />
          <Ionicons name="ellipsis-vertical" size={18} color="#FFFFFF" />
        </View>

        <ScrollView style={styles.waScroll} contentContainerStyle={styles.waScrollContent}>
          <View style={styles.waDayChip}>
            <Text style={styles.waDayChipText}>Today · संध्याकाळ</Text>
          </View>

          {/* Sundown prompt from the bot */}
          <View style={styles.botBubble}>
            <Text style={styles.bubbleEyebrow}>◯ BETTERAT · EVENING</Text>
            <Text style={styles.bubbleBody}>
              Lakshmi-tai, namaskar 🙏 How was the bazaar today? Send me a
              voice note — what did you sell, who bought, any new orders?
            </Text>
            <Text style={styles.bubbleTime}>5:48 PM</Text>
          </View>

          {/* User voice note reply */}
          <View style={styles.userBubble}>
            <View style={styles.voiceRow}>
              <Ionicons name="play" size={14} color={IOS_REGISTER.label} />
              <View style={styles.waveform}>
                {[6, 14, 9, 18, 12, 8, 16, 10, 14, 6, 18, 11, 8].map((h, i) => (
                  <View key={i} style={[styles.waveBar, { height: h }]} />
                ))}
              </View>
              <Text style={styles.voiceDuration}>0:42</Text>
            </View>
            <Text style={styles.userBubbleTranscript} numberOfLines={2}>
              "चार दुपट्टे विकले. नवीन भरतकाम पाहून दोघींनी ऑर्डर दिल्या…"
            </Text>
            <Text style={[styles.bubbleTime, styles.bubbleTimeUser]}>5:51 PM ✓✓</Text>
          </View>

          {/* Heard · added as a step */}
          <View style={styles.botBubble}>
            <Text style={styles.bubbleEyebrow}>◇ HEARD · ADDED AS A STEP</Text>
            <View style={styles.stepCard}>
              <Text style={styles.stepEyebrow}>TODAY'S STEP</Text>
              <Text style={styles.stepTitle}>Sold 4 dupattas · 2 new embroidery orders</Text>
              <Text style={styles.stepMeta}>
                capability: customer demand · embroidery patterns
                {'\n'}session: Pre-Diwali market cycle · day 12 of 30
              </Text>
            </View>
            <View style={styles.confirmRow}>
              <View style={styles.confirmBtnPrimary}>
                <Text style={styles.confirmBtnPrimaryText}>✓ Looks right</Text>
              </View>
              <View style={styles.confirmBtnSecondary}>
                <Text style={styles.confirmBtnSecondaryText}>Edit</Text>
              </View>
            </View>
            <Text style={styles.bubbleTime}>5:51 PM</Text>
          </View>

          {/* Relayed SHG suggestion */}
          <View style={styles.botBubble}>
            <Text style={styles.bubbleEyebrow}>◯ FROM SUVARNA SHG</Text>
            <Text style={styles.bubbleBody}>
              <Text style={styles.bubbleBodyBold}>Sunita-tai suggested a step</Text> —
              try the Latur-market fabric supplier she found this morning.
              Cheaper for bulk cotton.
            </Text>
            <View style={styles.actionRow}>
              <View style={styles.actionPrimary}>
                <Text style={styles.actionPrimaryText}>Accept</Text>
              </View>
              <View style={styles.actionSecondary}>
                <Text style={styles.actionSecondaryText}>Decline</Text>
              </View>
              <View style={styles.actionSecondary}>
                <Text style={styles.actionSecondaryText}>Reply to Sunita</Text>
              </View>
            </View>
            <Text style={styles.bubbleTime}>5:52 PM</Text>
          </View>
        </ScrollView>

        {/* Composer */}
        <View style={styles.composer}>
          <View style={styles.composerInput}>
            <Ionicons name="add" size={20} color={IOS_REGISTER.labelSecondary} />
            <Text style={styles.composerPlaceholder}>Message…</Text>
            <Ionicons name="camera" size={18} color={IOS_REGISTER.labelSecondary} />
          </View>
          <View style={styles.micBtn}>
            <Ionicons name="mic" size={18} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <Text style={styles.footnote}>
        Static preview. The actual chat lives in your WhatsApp once
        connected — this is for design and partner reviews.
      </Text>
    </SafeAreaView>
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
  },
  outerNav: {
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
  outerNavTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },

  // Faux WhatsApp
  waSurface: {
    flex: 1,
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: WA_BG,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  waHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: WA_GREEN,
  },
  waHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#0E8C7A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waHeaderAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  waHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  waHeaderName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  waHeaderSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontStyle: 'italic',
  },
  waHeaderIcon: {
    marginLeft: 4,
  },

  waScroll: { flex: 1 },
  waScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  waDayChip: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  waDayChipText: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '500',
  },

  botBubble: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderTopLeftRadius: 4,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    backgroundColor: WA_GREEN_TINT,
    borderRadius: 12,
    borderTopRightRadius: 4,
    padding: 10,
  },
  bubbleEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#5856D6',
    marginBottom: 4,
  },
  bubbleBody: {
    fontSize: 13.5,
    color: IOS_REGISTER.label,
    lineHeight: 18,
  },
  bubbleBodyBold: {
    fontWeight: '700',
  },
  bubbleTime: {
    fontSize: 10,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeUser: {
    color: '#1F7A3A',
  },

  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  waveBar: {
    width: 2.5,
    borderRadius: 1,
    backgroundColor: '#1F7A3A',
  },
  voiceDuration: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '500',
  },
  userBubbleTranscript: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    fontStyle: 'italic',
    marginTop: 6,
  },

  stepCard: {
    marginTop: 6,
    backgroundColor: '#F9F9F8',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  stepEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginTop: 2,
  },
  stepMeta: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 4,
    lineHeight: 14,
  },

  confirmRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  confirmBtnPrimary: {
    backgroundColor: '#5856D6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  confirmBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtnSecondary: {
    backgroundColor: 'rgba(88, 86, 214, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  confirmBtnSecondaryText: {
    color: '#5856D6',
    fontSize: 12,
    fontWeight: '600',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  actionPrimary: {
    backgroundColor: IOS_REGISTER.label,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actionSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
  },
  actionSecondaryText: {
    color: IOS_REGISTER.label,
    fontSize: 12,
    fontWeight: '600',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F0EFEA',
  },
  composerInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  composerPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footnote: {
    fontSize: 11.5,
    color: IOS_REGISTER.labelTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
});
