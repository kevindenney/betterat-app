/**
 * Fleet roster + management.
 *
 * Shows real fleet_members (active + invited) and pending email invites
 * via the get_fleet_roster RPC. Owners get role controls: promote a
 * member to captain (the admin-equivalent — can invite & manage), demote,
 * or remove. The "Invite" button opens FleetInviteSheet (by name or email).
 *
 * fleetId comes in as a route param (from create / hub). If absent we fall
 * back to the viewer's first fleet.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { useFleetRoster, useUserFleets } from '@/hooks/useFleetData';
import { fleetService, type FleetRosterEntry } from '@/services/fleetService';
import { FleetInviteSheet } from '@/components/fleets/FleetInviteSheet';
import { TUFTE_BACKGROUND } from '@/components/cards/constants';

const COLORS = {
  background: TUFTE_BACKGROUND,
  surface: '#FFFFFF',
  text: '#1C1C1E',
  secondaryText: '#6B7280',
  tertiaryText: '#9CA3AF',
  hairline: '#E5E7EB',
  accent: '#007AFF',
  accentSoft: 'rgba(0, 122, 255, 0.10)',
  warnSoft: '#FEF3C7',
  warnText: '#92400E',
  destructive: '#DC2626',
  ownerBadge: '#0F766E',
  ownerBadgeSoft: 'rgba(15, 118, 110, 0.12)',
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  captain: 'Captain',
  coach: 'Coach',
  support: 'Support',
  member: 'Member',
};

export default function FleetMembersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ fleetId?: string; fleetName?: string }>();

  const { fleets } = useUserFleets(user?.id);
  const fleetId = params.fleetId ?? fleets[0]?.fleet.id;
  const fleetName = params.fleetName ?? fleets.find(f => f.fleet.id === fleetId)?.fleet.name ?? 'Fleet';

  const { roster, loading, refresh } = useFleetRoster(fleetId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manageTarget, setManageTarget] = useState<FleetRosterEntry | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const viewerRole = useMemo(
    () => roster.find(r => r.userId && r.userId === user?.id)?.role,
    [roster, user?.id],
  );
  const isOwner = viewerRole === 'owner';
  const canManage = viewerRole === 'owner' || viewerRole === 'captain';

  const rosterSummary = useMemo(() => {
    const active = roster.filter(r => !r.isEmailInvite && r.status === 'active').length;
    const invited = roster.length - active;
    const members = `${active} ${active === 1 ? 'member' : 'members'}`;
    return invited > 0 ? `${members} · ${invited} invited` : members;
  }, [roster]);

  const closeInvite = useCallback(() => {
    setInviteOpen(false);
    void refresh();
  }, [refresh]);

  const handleRoleChange = useCallback(
    async (target: FleetRosterEntry, role: 'captain' | 'member') => {
      if (!fleetId || !target.userId) return;
      setBusy(true);
      try {
        await fleetService.setFleetMemberRole(fleetId, target.userId, role);
        setManageTarget(null);
        await refresh();
      } catch (e: any) {
        showAlert('Could not update role', e?.message ?? 'Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [fleetId, refresh],
  );

  const handleMakeOwner = useCallback(
    (target: FleetRosterEntry) => {
      if (!fleetId || !target.userId) return;
      setManageTarget(null);
      const transferAction = async () => {
        setBusy(true);
        try {
          await fleetService.transferFleetOwnership(fleetId, target.userId!);
          await refresh();
          showAlert('Ownership transferred', `${target.displayName} now owns this fleet. You're a captain.`);
        } catch (e: any) {
          showAlert('Could not transfer ownership', e?.message ?? 'Please try again.');
        } finally {
          setBusy(false);
        }
      };
      showConfirm(
        `Make ${target.displayName} the owner?`,
        "You'll step down to captain and they'll control this fleet, including the ability to delete it. You can't undo this yourself.",
        transferAction,
        { destructive: true, confirmText: 'Transfer' },
      );
    },
    [fleetId, refresh],
  );

  const handleDeleteFleet = useCallback(() => {
    if (!fleetId) return;
    const deleteAction = async () => {
      setBusy(true);
      try {
        await fleetService.deleteFleet(fleetId);
        router.back();
      } catch (e: any) {
        setBusy(false);
        showAlert('Could not delete fleet', e?.message ?? 'Please try again.');
      }
    };
    showConfirm(
      `Delete ${fleetName}?`,
      'This permanently removes the fleet, its roster, invites, plans, and posts for everyone. This cannot be undone.',
      deleteAction,
      { destructive: true, confirmText: 'Delete fleet' },
    );
  }, [fleetId, fleetName, router]);

  const handleRemove = useCallback(
    (target: FleetRosterEntry) => {
      if (!fleetId) return;
      setManageTarget(null);
      const removeAction = async () => {
        setBusy(true);
        try {
          if (target.isEmailInvite) {
            await fleetService.revokeFleetInvite(target.rowId);
          } else if (target.userId) {
            await fleetService.removeFleetMember(fleetId, target.userId);
          }
          await refresh();
        } catch (e: any) {
          showAlert('Could not remove', e?.message ?? 'Please try again.');
        } finally {
          setBusy(false);
        }
      };
      showConfirm(
        target.isEmailInvite ? 'Cancel invite?' : `Remove ${target.displayName}?`,
        target.isEmailInvite
          ? 'This pending invite will be cancelled.'
          : 'They will lose access to this fleet.',
        removeAction,
        { destructive: true },
      );
    },
    [fleetId, refresh],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
          <Ionicons name="chevron-back" size={24} color={COLORS.accent} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>{fleetName}</Text>
          <Text style={styles.headerSubtitle}>{rosterSummary}</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      {loading && roster.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {canManage ? (
            <Pressable style={styles.inviteButton} onPress={() => setInviteOpen(true)}>
              <Ionicons name="person-add" size={17} color="#FFFFFF" />
              <Text style={styles.inviteButtonText}>Invite sailors</Text>
            </Pressable>
          ) : null}

          <Text style={styles.sectionLabel}>ROSTER</Text>
          <View style={styles.list}>
            {roster.map((entry, index) => {
              const isViewer = entry.userId && entry.userId === user?.id;
              const manageable =
                canManage && !isViewer && (isOwner || entry.isEmailInvite);
              return (
                <Pressable
                  key={entry.rowId}
                  style={[styles.row, index < roster.length - 1 && styles.rowBorder]}
                  disabled={!manageable}
                  onPress={() => manageable && setManageTarget(entry)}
                >
                  <View style={styles.avatar}>
                    {entry.avatarUrl ? (
                      <Image source={{ uri: entry.avatarUrl }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {entry.displayName.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {entry.displayName}{isViewer ? ' (you)' : ''}
                    </Text>
                    <View style={styles.rowMetaLine}>
                      <RoleBadge role={entry.role} />
                      {entry.status === 'invited' ? (
                        <Text style={styles.statusChip}>Invited</Text>
                      ) : null}
                      {entry.isEmailInvite ? (
                        <Text style={styles.statusChip}>Pending email</Text>
                      ) : null}
                    </View>
                  </View>
                  {manageable ? (
                    <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.tertiaryText} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {isOwner ? (
            <View style={styles.dangerZone}>
              <Text style={styles.sectionLabel}>DANGER ZONE</Text>
              <Pressable style={styles.dangerButton} onPress={handleDeleteFleet}>
                <Ionicons name="trash-outline" size={17} color={COLORS.destructive} />
                <Text style={styles.dangerButtonText}>Delete this fleet</Text>
              </Pressable>
              <Text style={styles.dangerHint}>
                Permanently removes the fleet for all members. To keep it running, transfer
                ownership to another member instead.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {fleetId ? (
        <FleetInviteSheet
          visible={inviteOpen}
          onClose={closeInvite}
          fleetId={fleetId}
          fleetName={fleetName}
        />
      ) : null}

      <Modal
        visible={!!manageTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setManageTarget(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setManageTarget(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {manageTarget?.displayName}
            </Text>
            {busy ? (
              <ActivityIndicator color={COLORS.accent} style={styles.sheetSpinner} />
            ) : (
              <>
                {isOwner && manageTarget && !manageTarget.isEmailInvite ? (
                  manageTarget.role === 'captain' ? (
                    <SheetAction
                      label="Demote to member"
                      hint="Removes invite & manage rights"
                      onPress={() => handleRoleChange(manageTarget, 'member')}
                    />
                  ) : (
                    <SheetAction
                      label="Promote to captain"
                      hint="Admin — can invite & manage members"
                      onPress={() => handleRoleChange(manageTarget, 'captain')}
                    />
                  )
                ) : null}
                {isOwner && manageTarget && !manageTarget.isEmailInvite && manageTarget.status === 'active' ? (
                  <SheetAction
                    label="Make owner"
                    hint="Hands over the fleet — you become a captain"
                    onPress={() => handleMakeOwner(manageTarget)}
                  />
                ) : null}
                <SheetAction
                  label={manageTarget?.isEmailInvite ? 'Cancel invite' : 'Remove from fleet'}
                  destructive
                  onPress={() => manageTarget && handleRemove(manageTarget)}
                />
              </>
            )}
            <Pressable style={styles.sheetCancel} onPress={() => setManageTarget(null)}>
              <Text style={styles.sheetCancelText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isOwner = role === 'owner';
  return (
    <View style={[styles.roleBadge, isOwner && styles.roleBadgeOwner]}>
      <Text style={[styles.roleBadgeText, isOwner && styles.roleBadgeTextOwner]}>
        {ROLE_LABEL[role] ?? 'Member'}
      </Text>
    </View>
  );
}

function SheetAction({
  label,
  hint,
  destructive,
  onPress,
}: {
  label: string;
  hint?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.sheetAction} onPress={onPress}>
      <Text style={[styles.sheetActionLabel, destructive && styles.sheetActionDestructive]}>
        {label}
      </Text>
      {hint ? <Text style={styles.sheetActionHint}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  headerSide: { width: 40 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  headerSubtitle: { fontSize: 12, color: COLORS.secondaryText, marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  inviteButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondaryText,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  list: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.hairline,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40 },
  avatarInitial: { fontSize: 15, fontWeight: '600', color: '#475569' },
  rowText: { flex: 1, gap: 4 },
  rowName: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.accentSoft,
  },
  roleBadgeOwner: { backgroundColor: COLORS.ownerBadgeSoft },
  roleBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.accent },
  roleBadgeTextOwner: { color: COLORS.ownerBadge },
  statusChip: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.warnText,
    backgroundColor: COLORS.warnSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondaryText,
    textAlign: 'center',
    marginBottom: 12,
  },
  sheetSpinner: { paddingVertical: 24 },
  sheetAction: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.hairline,
  },
  sheetActionLabel: { fontSize: 16, color: COLORS.text, fontWeight: '500' },
  sheetActionDestructive: { color: COLORS.destructive },
  sheetActionHint: { fontSize: 12, color: COLORS.secondaryText, marginTop: 2 },
  sheetCancel: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  sheetCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  dangerZone: { marginTop: 32 },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.destructive,
  },
  dangerButtonText: { fontSize: 15, fontWeight: '600', color: COLORS.destructive },
  dangerHint: { fontSize: 12, color: COLORS.secondaryText, marginTop: 8, lineHeight: 17 },
});
