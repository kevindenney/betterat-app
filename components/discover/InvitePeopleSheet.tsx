/**
 * InvitePeopleSheet — owner invites people to their org.
 *
 * Two paths:
 *  1. On BetterAt — search people by name/email and invite them directly.
 *     The invite lands in their in-app inbox (social notification) so they
 *     can accept without leaving the app.
 *  2. Not on BetterAt — generate a shareable link to hand out via Messages /
 *     WhatsApp / email. Anyone who taps it routes through `/invite/<token>`.
 *
 * Both paths reuse organizationInviteService.createInvite and the
 * `/invite/<token>` route. Tokens are generated client-side because the
 * organization_invites table has no invite_token default.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { organizationInviteService } from '@/services/OrganizationInviteService';
import { NotificationService } from '@/services/NotificationService';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

interface InvitePeopleSheetProps {
  visible: boolean;
  orgId: string;
  orgName: string;
  onClose: () => void;
}

interface PersonResult {
  id: string;
  name: string;
  email: string | null;
  avatarEmoji?: string;
  avatarColor?: string;
}

interface PendingInvite {
  id: string;
  name: string;
  email: string | null;
  isLink: boolean;
  statusLabel: string;
}

const WEB_BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://better.at';

function buildInviteUrl(token: string): string {
  return `${WEB_BASE.replace(/\/$/, '')}/invite/${encodeURIComponent(token)}`;
}

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function InvitePeopleSheet({
  visible,
  orgId,
  orgName,
  onClose,
}: InvitePeopleSheetProps) {
  const { user } = useAuth();

  // ── Member search ─────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PersonResult[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const memberIdsRef = useRef<Set<string>>(new Set());
  const searchSeq = useRef(0);

  // ── Link generation ───────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [linkName, setLinkName] = useState('');
  const [linkEmail, setLinkEmail] = useState('');

  // Load existing invites so already-invited people keep their status across
  // sessions, and the owner can see everyone they've invited.
  const refreshInvites = useCallback(async () => {
    const invites =
      await organizationInviteService.listPendingOrganizationInvites(orgId);

    const invitedSet = new Set<string>();
    const rows: PendingInvite[] = invites.map((inv) => {
      const targetId =
        typeof inv.metadata?.target_user_id === 'string'
          ? (inv.metadata.target_user_id as string)
          : null;
      if (targetId) invitedSet.add(targetId);
      const isLink = !inv.invitee_name && !inv.invitee_email;
      return {
        id: inv.id,
        name: inv.invitee_name?.trim() || (isLink ? 'Shareable link' : 'Invited person'),
        email: inv.invitee_email ?? null,
        isLink,
        statusLabel: inv.status === 'opened' ? 'Opened' : 'Invited',
      };
    });

    setInvitedIds(invitedSet);
    setPendingInvites(rows);
  }, [orgId]);

  // Reset on open so a previous session's state doesn't linger.
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
    setInvitingId(null);
    setInvitedIds(new Set());
    setPendingInvites([]);
    setLatestUrl(null);
    setGenerating(false);
    setLinkName('');
    setLinkEmail('');

    // Load existing member ids so we don't offer to invite them again.
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', orgId);
      if (cancelled) return;
      memberIdsRef.current = new Set(
        (data ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean),
      );
      if (cancelled) return;
      await refreshInvites();
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, orgId, refreshInvites]);

  // Debounced people search.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const handle = setTimeout(async () => {
      try {
        const pattern = `%${trimmed}%`;
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
          .limit(12);

        if (seq !== searchSeq.current) return;

        const rows = (profiles ?? []).filter(
          (p: { id: string }) => p.id !== user?.id && !memberIdsRef.current.has(p.id),
        );

        // Enrich avatars from sailor_profiles (matches GlobalSearchService).
        let avatarMap: Record<string, { avatar_emoji?: string; avatar_color?: string }> = {};
        if (rows.length > 0) {
          const { data: sailorProfiles } = await supabase
            .from('sailor_profiles')
            .select('user_id, avatar_emoji, avatar_color')
            .in('user_id', rows.map((r: { id: string }) => r.id));
          (sailorProfiles ?? []).forEach((sp: any) => {
            avatarMap[sp.user_id] = sp;
          });
        }

        if (seq !== searchSeq.current) return;
        setResults(
          rows.map((p: { id: string; full_name: string | null; email: string | null }) => ({
            id: p.id,
            name: p.full_name?.trim() || p.email || 'BetterAt member',
            email: p.email ?? null,
            avatarEmoji: avatarMap[p.id]?.avatar_emoji,
            avatarColor: avatarMap[p.id]?.avatar_color,
          })),
        );
      } catch {
        if (seq === searchSeq.current) setResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, user?.id]);

  const handleInvitePerson = useCallback(
    async (person: PersonResult) => {
      if (invitingId || invitedIds.has(person.id)) return;
      setInvitingId(person.id);
      try {
        const token = generateToken();
        await organizationInviteService.createInvite({
          organization_id: orgId,
          invitee_name: person.name,
          invitee_email: person.email,
          invite_token: token,
          role_label: 'Member',
          role_key: 'member',
          channel: 'link',
          status: 'sent',
          metadata: { source: 'invite_people_sheet', target_user_id: person.id },
        });

        await NotificationService.notifyOrgInviteReceived({
          targetUserId: person.id,
          inviterName: user?.user_metadata?.full_name || user?.email || 'Someone',
          inviterId: user?.id || '',
          organizationId: orgId,
          organizationName: orgName,
          roleLabel: 'Member',
          inviteToken: token,
        });

        setInvitedIds((prev) => new Set(prev).add(person.id));
        await refreshInvites();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not send invite.';
        showAlert('Could not send invite', message);
      } finally {
        setInvitingId(null);
      }
    },
    [invitingId, invitedIds, orgId, orgName, user, refreshInvites],
  );

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const token = generateToken();
      const name = linkName.trim();
      const email = linkEmail.trim();
      await organizationInviteService.createInvite({
        organization_id: orgId,
        invitee_name: name || null,
        invitee_email: email || null,
        role_label: 'Member',
        role_key: 'member',
        invite_token: token,
        channel: 'link',
        status: 'sent',
        metadata: { source: 'invite_people_sheet' },
      });
      setLatestUrl(buildInviteUrl(token));
      setLinkName('');
      setLinkEmail('');
      await refreshInvites();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not generate invite.';
      showAlert('Could not generate invite', message);
    } finally {
      setGenerating(false);
    }
  }, [orgId, linkName, linkEmail, refreshInvites]);

  const handleCopy = useCallback(async () => {
    if (!latestUrl) return;
    await Clipboard.setStringAsync(latestUrl);
    showAlert('Copied', 'Invite link copied to clipboard.');
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

  const showResults = query.trim().length >= 2;
  const emptyMatch = showResults && !searching && results.length === 0;

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
            {/* ── On BetterAt ── */}
            <Text style={styles.sectionLabel}>ON BETTERAT</Text>
            <View style={styles.searchBox}>
              <Ionicons
                name="search"
                size={16}
                color={IOS_REGISTER.labelSecondary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or email"
                placeholderTextColor={IOS_REGISTER.labelTertiary}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searching ? <ActivityIndicator size="small" /> : null}
            </View>

            {showResults ? (
              <View style={styles.results}>
                {results.map((person) => {
                  const invited = invitedIds.has(person.id);
                  const isInviting = invitingId === person.id;
                  return (
                    <View key={person.id} style={styles.personRow}>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: person.avatarColor || '#E3ECF7' },
                        ]}
                      >
                        <Text style={styles.avatarText}>
                          {person.avatarEmoji || initialsFor(person.name)}
                        </Text>
                      </View>
                      <View style={styles.personMeta}>
                        <Text style={styles.personName} numberOfLines={1}>
                          {person.name}
                        </Text>
                        {person.email ? (
                          <Text style={styles.personEmail} numberOfLines={1}>
                            {person.email}
                          </Text>
                        ) : null}
                      </View>
                      {invited ? (
                        <View style={styles.invitedPill}>
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color={IOS_COLORS.systemGreen}
                          />
                          <Text style={styles.invitedText}>Invited</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={[styles.inviteBtn, isInviting && styles.inviteBtnBusy]}
                          disabled={isInviting}
                          onPress={() => handleInvitePerson(person)}
                        >
                          {isInviting ? (
                            <ActivityIndicator
                              size="small"
                              color={IOS_COLORS.systemBlue}
                            />
                          ) : (
                            <Text style={styles.inviteBtnText}>Invite</Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                {emptyMatch ? (
                  <Text style={styles.emptyMatch}>
                    No one on BetterAt matches “{query.trim()}”. Use a link below
                    to invite them.
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.searchHint}>
                Find coaches, peers, or members already on BetterAt — they’ll get
                the invite in their inbox.
              </Text>
            )}

            {pendingInvites.length > 0 ? (
              <View style={styles.pendingBlock}>
                <Text style={styles.sectionLabel}>PENDING INVITES</Text>
                {pendingInvites.map((inv) => (
                  <View key={inv.id} style={styles.personRow}>
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: inv.isLink ? '#EAF1FB' : '#E3ECF7' },
                      ]}
                    >
                      {inv.isLink ? (
                        <Ionicons
                          name="link-outline"
                          size={18}
                          color={IOS_COLORS.systemBlue}
                        />
                      ) : (
                        <Text style={styles.avatarText}>{initialsFor(inv.name)}</Text>
                      )}
                    </View>
                    <View style={styles.personMeta}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {inv.name}
                      </Text>
                      {inv.email ? (
                        <Text style={styles.personEmail} numberOfLines={1}>
                          {inv.email}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.invitedPill}>
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={IOS_COLORS.systemGreen}
                      />
                      <Text style={styles.invitedText}>{inv.statusLabel}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.divider} />

            {/* ── Not on BetterAt ── */}
            <Text style={styles.sectionLabel}>NOT ON BETTERAT</Text>
            <Text style={styles.intro}>
              Invite someone by name so you can track them, or share an open link
              to {orgName} that anyone can use.
            </Text>

            {!latestUrl ? (
              <View style={styles.linkFields}>
                <TextInput
                  style={styles.linkField}
                  placeholder="Name (optional)"
                  placeholderTextColor={IOS_REGISTER.labelTertiary}
                  value={linkName}
                  onChangeText={setLinkName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.linkField}
                  placeholder="Email (optional)"
                  placeholderTextColor={IOS_REGISTER.labelTertiary}
                  value={linkEmail}
                  onChangeText={setLinkEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            ) : null}

            {latestUrl ? (
              <View style={styles.linkCard}>
                <Text style={styles.linkLabel}>INVITE LINK</Text>
                <Text
                  style={styles.linkUrl}
                  numberOfLines={2}
                  ellipsizeMode="middle"
                >
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
                    <Ionicons name="share-outline" size={16} color="#FFFFFF" />
                    <Text style={[styles.linkBtnText, styles.linkBtnTextPrimary]}>
                      Share
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={[styles.secondary, generating && styles.primaryDisabled]}
                disabled={generating}
                onPress={handleGenerate}
              >
                {generating ? (
                  <ActivityIndicator color={IOS_COLORS.systemBlue} />
                ) : (
                  <>
                    <Ionicons
                      name="link-outline"
                      size={18}
                      color={IOS_COLORS.systemBlue}
                    />
                    <Text style={styles.secondaryText}>
                      {linkName.trim()
                        ? `Create invite for ${linkName.trim()}`
                        : 'Generate invite link'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {latestUrl ? (
              <Pressable style={styles.regenerate} onPress={handleGenerate}>
                <Text style={styles.regenerateText}>Generate a fresh link</Text>
              </Pressable>
            ) : null}
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
    maxHeight: '88%',
    minHeight: '55%',
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
  scrollContent: { padding: 16, paddingBottom: 32, gap: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: IOS_REGISTER.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F2F4F7',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_REGISTER.label,
    padding: 0,
  },
  searchHint: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 18,
  },
  results: { gap: 4 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: IOS_REGISTER.label },
  personMeta: { flex: 1 },
  personName: { fontSize: 15, fontWeight: '600', color: IOS_REGISTER.label },
  personEmail: { fontSize: 12, color: IOS_REGISTER.labelSecondary },
  inviteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(11,99,206,0.4)',
    minWidth: 72,
    alignItems: 'center',
  },
  inviteBtnBusy: { opacity: 0.6 },
  inviteBtnText: { fontSize: 14, fontWeight: '600', color: IOS_COLORS.systemBlue },
  invitedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  invitedText: { fontSize: 14, fontWeight: '600', color: IOS_COLORS.systemGreen },
  emptyMatch: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 18,
    paddingVertical: 6,
  },
  pendingBlock: { gap: 4, marginTop: 4 },
  linkFields: { gap: 8 },
  linkField: {
    fontSize: 15,
    color: IOS_REGISTER.label,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F2F4F7',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.16)',
    marginVertical: 6,
  },
  intro: { fontSize: 14, color: IOS_REGISTER.label, lineHeight: 20 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(11,99,206,0.4)',
    backgroundColor: '#F7FAFF',
  },
  secondaryText: { color: IOS_COLORS.systemBlue, fontSize: 16, fontWeight: '700' },
  primaryDisabled: { opacity: 0.6 },
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
  linkBtnText: { fontSize: 14, fontWeight: '600', color: IOS_COLORS.systemBlue },
  linkBtnTextPrimary: { color: '#FFFFFF' },
  regenerate: { alignItems: 'center', paddingVertical: 6 },
  regenerateText: { fontSize: 13, color: IOS_COLORS.systemBlue, fontWeight: '600' },
});
