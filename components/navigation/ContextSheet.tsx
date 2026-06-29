import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  useInterest,
  type Interest,
} from '@/providers/InterestProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useProfileMenuData, type OrgMembership } from '@/hooks/useProfileMenuData';
import { fontFamily } from '@/lib/design-tokens-editorial';

export type ContextSurface = 'practice' | 'studio' | 'admin';

type ContextSheetProps = {
  visible: boolean;
  surface: ContextSurface;
  onClose: () => void;
};

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager', 'faculty', 'instructor']);
const STUDIO_ROLES = new Set(['owner', 'admin', 'manager', 'faculty', 'instructor', 'author', 'creator', 'blueprint_author', 'mentor', 'coach']);

function initialsFor(name?: string | null): string {
  const tokens = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '·';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

function normalizedRole(role: string | null | undefined): string {
  return String(role || '').trim().toLowerCase();
}

function roleBadge(membership: OrgMembership): string {
  const role = normalizedRole(membership.role);
  if (MANAGER_ROLES.has(role)) return 'Admin';
  if (membership.is_faculty) return 'Leader';
  if (membership.is_author || STUDIO_ROLES.has(role)) return 'Author';
  return 'Member';
}

function orgSurfaces(membership: OrgMembership): { canStudio: boolean; canAdmin: boolean } {
  const role = normalizedRole(membership.role);
  const canStudio =
    membership.is_admin ||
    membership.is_faculty ||
    membership.is_author ||
    STUDIO_ROLES.has(role);
  const canAdmin = MANAGER_ROLES.has(role);
  return { canStudio, canAdmin };
}

function isGroupMembership(
  membership: OrgMembership,
  orgRows: ReturnType<typeof useOrganization>['memberships'],
): boolean {
  const row = orgRows.find((candidate) => candidate.organization_id === membership.org_id);
  const type = String(row?.organization?.organization_type || '').toLowerCase();
  const metadata = (row?.organization?.metadata as Record<string, unknown> | null) || {};
  const kind = String(metadata.kind || metadata.type || metadata.workspace_kind || '').toLowerCase();
  const name = membership.org_name.toLowerCase();
  return type === 'community' ||
    kind.includes('group') ||
    kind.includes('fleet') ||
    name.includes(' group') ||
    name.includes(' fleet');
}

export function ContextSheet({ visible, surface, onClose }: ContextSheetProps) {
  const {
    currentInterest,
    userInterests,
    switchInterest,
    loading: interestsLoading,
  } = useInterest();
  const {
    activeOrganizationId,
    memberships: orgRows,
    setActiveOrganizationId,
  } = useOrganization();
  const menu = useProfileMenuData();
  const { width } = useWindowDimensions();
  const [groupsOpen, setGroupsOpen] = useState(true);
  const orgMemberships = useMemo(
    () =>
      menu.memberships.filter((membership) => {
        if (isGroupMembership(membership, orgRows)) return false;
        const { canStudio, canAdmin } = orgSurfaces(membership);
        return canStudio || canAdmin;
      }),
    [menu.memberships, orgRows],
  );
  const groupMemberships = useMemo(
    () => menu.memberships.filter((membership) => isGroupMembership(membership, orgRows)),
    [menu.memberships, orgRows],
  );
  const activeOrgId = activeOrganizationId || null;
  const personalStudioVisible = menu.isAuthor || menu.counts.authoredBlueprints > 0;
  const showDesktop = Platform.OS === 'web' && width >= 1024;

  const closeAndRun = async (work: () => Promise<void> | void) => {
    onClose();
    await work();
  };

  const switchToPersonalStudio = () => closeAndRun(async () => {
    await setActiveOrganizationId(null);
    router.push('/studio' as any);
  });

  // An interest IS the Practice destination: clear org context, switch the
  // interest, then route to Practice — same contract as switchToPersonalPractice.
  const switchToInterestPractice = (interest: Interest) => closeAndRun(async () => {
    await setActiveOrganizationId(null);
    if (interest.slug !== currentInterest?.slug) {
      await switchInterest(interest.slug);
    }
    router.replace('/(tabs)/practice' as any);
  });

  const manageInterests = () => closeAndRun(() => {
    router.push({ pathname: '/(tabs)/library', params: { zone: 'interests' } } as any);
  });

  const joinOrganization = () => closeAndRun(() => {
    router.push({ pathname: '/(tabs)/library', params: { zone: 'orgs' } } as any);
  });

  const switchToOrg = (membership: OrgMembership, destination: 'studio' | 'admin' | 'group') =>
    closeAndRun(async () => {
      await setActiveOrganizationId(membership.org_id);
      if (membership.interest_slug) {
        try {
          await switchInterest(membership.interest_slug);
        } catch {
          /* non-fatal: route switch still lands in the selected workspace */
        }
      }
      if (destination === 'admin') {
        router.replace(`/admin/${membership.org_id}/overview` as any);
      } else if (destination === 'group') {
        router.push(`/group/${membership.org_id}` as any);
      } else {
        router.replace('/studio' as any);
      }
    });

  const renderInterestRow = (interest: Interest) => {
    // The checkmark is Practice-scoped: an interest is "current" only while you
    // are actually in personal Practice. In Studio/Admin no interest is ticked.
    const inPersonalPractice = !activeOrgId && surface === 'practice';
    const active = inPersonalPractice && interest.slug === currentInterest?.slug;
    return (
      <TouchableOpacity
        key={interest.id}
        style={[styles.subRow, active && styles.subRowActive]}
        onPress={() => switchToInterestPractice(interest)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Practice ${interest.name}`}
      >
        <View style={[styles.interestDot, { backgroundColor: interest.accent_color }]} />
        <Text style={[styles.subRowLabel, active && styles.subRowLabelActive]} numberOfLines={1}>
          {interest.name}
        </Text>
        {active ? <Ionicons name="checkmark" size={16} color="#2563EB" /> : null}
      </TouchableOpacity>
    );
  };

  const renderMembershipBlock = (membership: OrgMembership, grouped: boolean) => {
    const active = activeOrgId === membership.org_id;
    const { canStudio, canAdmin } = orgSurfaces(membership);
    const primary: 'studio' | 'admin' | 'group' = grouped
      ? 'group'
      : canAdmin
      ? 'admin'
      : 'studio';
    return (
      <View key={membership.org_id} style={styles.workspaceBlock}>
        <TouchableOpacity
          style={styles.workspaceHeader}
          onPress={() => switchToOrg(membership, primary)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${membership.org_name}`}
        >
          <View style={styles.mono}>
            <Text style={styles.monoText}>{membership.org_short_name || initialsFor(membership.org_name)}</Text>
          </View>
          <View style={styles.workspaceTitleCol}>
            <Text style={styles.workspaceName} numberOfLines={1}>{membership.org_name}</Text>
            <Text style={styles.workspaceSub} numberOfLines={1}>
              {grouped ? 'Group workspace' : 'Organization workspace'}
            </Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleBadge(membership)}</Text>
          </View>
        </TouchableOpacity>

        {canStudio ? (
          <SheetRow
            icon="color-wand-outline"
            label="Studio"
            active={active && surface === 'studio'}
            tone="studio"
            onPress={() => switchToOrg(membership, 'studio')}
          />
        ) : null}
        {canAdmin ? (
          <SheetRow
            icon="shield-checkmark-outline"
            label="Admin"
            active={active && surface === 'admin'}
            tone="admin"
            onPress={() => switchToOrg(membership, 'admin')}
          />
        ) : null}
        {grouped ? (
          <SheetRow
            icon="people-circle-outline"
            label="Group steps"
            active={active && surface === 'practice'}
            onPress={() => switchToOrg(membership, 'group')}
          />
        ) : null}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={showDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, showDesktop && styles.backdropDesktop]}
        onPress={onClose}
        accessible={false}
      >
        <Pressable
          testID="context-switcher-sheet"
          style={[styles.sheet, showDesktop && styles.sheetDesktop]}
          onPress={(event) => event.stopPropagation()}
          accessible={false}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetKicker}>Context</Text>
              <Text style={styles.sheetTitle}>Switch workspace</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close context switcher"
            >
              <Ionicons name="close" size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>Personal</Text>
            <View style={styles.workspaceBlock}>
              {!interestsLoading ? userInterests.map(renderInterestRow) : null}
              <TouchableOpacity
                style={styles.addRow}
                onPress={manageInterests}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Add interest"
              >
                <Ionicons name="add" size={15} color="#2563EB" />
                <Text style={styles.addRowText}>Add interest</Text>
              </TouchableOpacity>

              {personalStudioVisible ? (
                <>
                  <View style={styles.surfaceDivider} />
                  <SheetRow
                    icon="color-wand-outline"
                    label="Studio"
                    active={!activeOrgId && surface === 'studio'}
                    tone="studio"
                    onPress={switchToPersonalStudio}
                  />
                </>
              ) : null}
            </View>

            {orgMemberships.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Organizations</Text>
                {orgMemberships.map((membership) => renderMembershipBlock(membership, false))}
              </>
            ) : null}

            {groupMemberships.length > 0 ? (
              <>
                <TouchableOpacity
                  style={styles.groupsHeader}
                  onPress={() => setGroupsOpen((open) => !open)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.sectionLabelInline}>Groups</Text>
                  <Ionicons
                    name={groupsOpen ? 'chevron-down' : 'chevron-forward'}
                    size={14}
                    color="#64748B"
                  />
                </TouchableOpacity>
                {groupsOpen ? groupMemberships.map((membership) => renderMembershipBlock(membership, true)) : null}
              </>
            ) : null}

            {orgMemberships.length === 0 && groupMemberships.length === 0 ? (
              <Text style={styles.sectionLabel}>Organizations</Text>
            ) : null}
            <TouchableOpacity
              style={styles.joinRow}
              onPress={joinOrganization}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Join another organization"
            >
              <Ionicons name="add" size={15} color="#2563EB" />
              <Text style={styles.joinText}>Join another organization</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetRow({
  icon,
  label,
  active,
  tone = 'neutral',
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  tone?: 'neutral' | 'practice' | 'studio' | 'admin';
  onPress: () => void;
}) {
  const iconColor = tone === 'studio'
    ? '#6D5BD0'
    : tone === 'admin'
    ? '#475569'
    : tone === 'practice'
    ? '#2563EB'
    : '#64748B';
  return (
    <TouchableOpacity
      style={[styles.row, active && styles.rowActive]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.rowLabel, active && styles.rowLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {active ? (
        <Ionicons name="checkmark" size={17} color={iconColor} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.34)',
    justifyContent: 'flex-end',
  },
  backdropDesktop: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 70,
    paddingLeft: 24,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    maxHeight: '86%',
  },
  sheetDesktop: {
    width: 380,
    maxHeight: 680,
    borderRadius: 16,
    boxShadow: '0 20px 48px rgba(15,23,42,0.22)',
  } as any,
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  sheetKicker: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: fontFamily.mono,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    marginTop: 2,
    fontFamily: fontFamily.serif,
    fontSize: 24,
    fontWeight: '500',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  scroll: {
    maxHeight: 600,
  },
  scrollInner: {
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  sectionLabel: {
    marginTop: 14,
    marginBottom: 7,
    paddingHorizontal: 4,
    fontSize: 10,
    fontFamily: fontFamily.mono,
    color: '#64748B',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sectionLabelInline: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    color: '#64748B',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  groupsHeader: {
    marginTop: 14,
    marginBottom: 7,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workspaceBlock: {
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    padding: 8,
    marginBottom: 8,
  },
  workspaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  mono: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  workspaceTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  workspaceName: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  workspaceSub: {
    marginTop: 1,
    color: '#64748B',
    fontSize: 11.5,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  roleBadgeText: {
    color: '#334155',
    fontSize: 10.5,
    fontWeight: '700',
  },
  row: {
    minHeight: 44,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  rowLabelActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  surfaceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 5,
    marginHorizontal: 6,
  },
  subRow: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  subRowActive: {
    backgroundColor: '#EFF6FF',
  },
  interestDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  subRowLabel: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  subRowLabelActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  addRow: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addRowText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  joinRow: {
    minHeight: 40,
    marginTop: 2,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
});
