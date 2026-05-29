/**
 * InvitePeopleSheet — owner generates a shareable invite link.
 *
 * Minimal v1: tap "Generate invite link" → server creates an invite row
 * with channel='link' and a fresh token → we surface the resulting URL
 * with Copy + Share buttons so the owner can hand it to Rita, Eric, etc.
 * via WhatsApp / iMessage / whatever they already use.
 *
 * Reuses the existing organizationInviteService.createInvite and the
 * established `/invite/<token>` URL convention (see app/social-
 * notifications.tsx for the route handler).
 *
 * Future work (not in v1):
 *  - Email channel: type email → invite + magic-link email
 *  - Search-and-invite from people you follow (matches the demo where
 *    Kevin follows Rita / Eric / Joseph)
 *  - Revoke / resend pending invites
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { organizationInviteService } from '@/services/OrganizationInviteService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

interface InvitePeopleSheetProps {
  visible: boolean;
  orgId: string;
  orgName: string;
  onClose: () => void;
}

const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://better.at';

function buildInviteUrl(token: string): string {
  return `${WEB_BASE.replace(/\/$/, '')}/invite/${encodeURIComponent(token)}`;
}

export function InvitePeopleSheet({
  visible,
  orgId,
  orgName,
  onClose,
}: InvitePeopleSheetProps) {
  const [generating, setGenerating] = useState(false);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [latestToken, setLatestToken] = useState<string | null>(null);

  // Reset on open so a previous session's link doesn't linger.
  useEffect(() => {
    if (visible) {
      setLatestUrl(null);
      setLatestToken(null);
    }
  }, [visible]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const created = await organizationInviteService.createInvite({
        organization_id: orgId,
        role_label: 'Member',
        role_key: 'member',
        channel: 'link',
        status: 'sent',
        metadata: { source: 'invite_people_sheet' },
      });
      const token = created.invite_token || null;
      if (!token) {
        throw new Error('Invite created but no token returned.');
      }
      setLatestToken(token);
      setLatestUrl(buildInviteUrl(token));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not generate invite.';
      showAlert('Could not generate invite', message);
    } finally {
      setGenerating(false);
    }
  }, [orgId]);

  const handleCopy = useCallback(async () => {
    if (!latestUrl) return;
    try {
      await Clipboard.setStringAsync(latestUrl);
      showAlert('Copied', 'Invite link copied to clipboard.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not copy.';
      showAlert('Could not copy', message);
    }
  }, [latestUrl]);

  const handleShare = useCallback(async () => {
    if (!latestUrl) return;
    try {
      await Share.share({
        message: `Join ${orgName} on BetterAt: ${latestUrl}`,
        url: latestUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not share.';
      showAlert('Could not share', message);
    }
  }, [latestUrl, orgName]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
              <Text style={styles.headerBtnText}>Close</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Invite people</Text>
            <View style={styles.headerBtn} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.intro}>
              Share a link to {orgName}. Anyone who taps it can request to
              join.
            </Text>

            {latestUrl ? (
              <View style={styles.linkCard}>
                <Text style={styles.linkLabel}>INVITE LINK</Text>
                <Text style={styles.linkUrl} numberOfLines={2} ellipsizeMode="middle">
                  {latestUrl}
                </Text>
                <View style={styles.linkActions}>
                  <Pressable style={styles.linkBtn} onPress={handleCopy}>
                    <Ionicons
                      name="copy-outline"
                      size={16}
                      color={IOS_COLORS.systemBlue}
                    />
                    <Text style={styles.linkBtnText}>Copy</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.linkBtn, styles.linkBtnPrimary]}
                    onPress={handleShare}
                  >
                    <Ionicons
                      name="share-outline"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={[styles.linkBtnText, styles.linkBtnTextPrimary]}>
                      Share
                    </Text>
                  </Pressable>
                </View>
                {latestToken ? (
                  <Text style={styles.linkToken}>Token: {latestToken}</Text>
                ) : null}
              </View>
            ) : (
              <Pressable
                style={[styles.primary, generating && styles.primaryDisabled]}
                disabled={generating}
                onPress={handleGenerate}
              >
                {generating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="link-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryText}>Generate invite link</Text>
                  </>
                )}
              </Pressable>
            )}

            <View style={styles.footnote}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.footnoteText}>
                {latestUrl
                  ? 'Generate a fresh link any time. The previous one keeps working until you revoke it.'
                  : 'A unique link is created when you tap Generate. You can share it via Messages, WhatsApp, email, or anything else.'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    minHeight: '50%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.16)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: IOS_REGISTER.label },
  headerBtn: { minWidth: 56, paddingVertical: 4 },
  headerBtnText: { fontSize: 16, color: IOS_COLORS.systemBlue },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 18 },
  intro: { fontSize: 14, color: IOS_REGISTER.label, lineHeight: 20 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  linkCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F7FAFF',
    borderWidth: 1,
    borderColor: 'rgba(11,99,206,0.18)',
    gap: 10,
  },
  linkLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkUrl: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: IOS_REGISTER.label,
  },
  linkActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(11,99,206,0.4)',
  },
  linkBtnPrimary: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderColor: IOS_COLORS.systemBlue,
  },
  linkBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  linkBtnTextPrimary: { color: '#FFFFFF' },
  linkToken: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footnote: { flexDirection: 'row', gap: 6, paddingHorizontal: 4 },
  footnoteText: {
    flex: 1,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 16,
  },
});
