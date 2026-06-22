import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useOrganizationSearch } from '@/hooks/useOrganizationSearch';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useAuth } from '@/providers/AuthProvider';
import { organizationDiscoveryService, isEmailAllowed } from '@/services/OrganizationDiscoveryService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { IOS_COLORS, IOS_TYPOGRAPHY, IOS_SPACING, IOS_RADIUS } from '@/lib/design-tokens-ios';
import { resolveOrgMembershipStatus } from '@/hooks/orgMembershipStatus';

interface OrganizationSearchContentProps {
  toolbarOffset?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Plural noun for the entity, used in placeholder/helper/empty copy. Defaults to "organizations". */
  noun?: string;
  /** Override the search-box placeholder. Defaults to `Search ${noun}`. */
  placeholder?: string;
  /** Override the helper line under the search box. */
  helperText?: string;
}

function formatJoinModeLabel(joinMode: string): string {
  if (joinMode === 'open_join') return 'Open join';
  if (joinMode === 'request_to_join') return 'Request access';
  return 'Invite required';
}

function normalizeMembershipStatus(value: unknown): 'active' | 'pending' | 'rejected' | 'none' {
  const raw = String(value || '').toLowerCase();
  if (raw === 'active' || raw === 'verified') return 'active';
  if (raw === 'pending' || raw === 'invited') return 'pending';
  if (raw === 'rejected') return 'rejected';
  return 'none';
}

export function OrganizationSearchContent({
  toolbarOffset = 0,
  onScroll,
  noun = 'organizations',
  placeholder,
  helperText,
}: OrganizationSearchContentProps) {
  const [query, setQuery] = useState('');
  const [joiningOrgId, setJoiningOrgId] = useState<string | null>(null);
  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const { user } = useAuth();
  const { memberships, activeOrganizationId, setActiveOrganizationId, refreshMemberships } = useOrganization();
  const {results, loading, errorText} = useOrganizationSearch({
    query: normalizedQuery,
    enabled: normalizedQuery.length > 0,
    limit: 20,
  });

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  const membershipsByOrgId = useMemo(() => {
    const map = new Map<string, any>();
    memberships.forEach((membership) => {
      map.set(membership.organization_id, membership);
    });
    return map;
  }, [memberships]);

  const handleJoin = useCallback(async (org: any) => {
    if (!org?.id || joiningOrgId) return;
    setJoiningOrgId(org.id);
    try {
      const result = await organizationDiscoveryService.requestJoin({
        orgId: org.id,
        mode: org.join_mode,
      });
      await refreshMemberships();
      if (result.status === 'active') {
        await setActiveOrganizationId(org.id);
      }
    } catch (error: any) {
      showAlert('Unable to join', String(error?.message || 'Please try again.'));
    } finally {
      setJoiningOrgId(null);
    }
  }, [joiningOrgId, refreshMemberships, setActiveOrganizationId]);

  const handleUseOrg = useCallback(async (orgId: string) => {
    try {
      await setActiveOrganizationId(orgId);
    } catch (error: any) {
      showAlert('Unable to switch', String(error?.message || 'Please try again.'));
    }
  }, [setActiveOrganizationId]);

  const renderItem = useCallback(({item}: {item: any}) => {
      const membership = membershipsByOrgId.get(item.id);
      const membershipStatus = normalizeMembershipStatus(
        membership ? resolveOrgMembershipStatus(membership) : null,
      );
      const isCurrentOrg = activeOrganizationId === item.id;
      const allowedDomains = Array.isArray(item.allowed_email_domains) ? item.allowed_email_domains : [];
      const emailAllowed = isEmailAllowed({
        email: user?.email,
        allowedDomains,
      });
      const requiresDomain = item.join_mode === 'open_join' && allowedDomains.length > 0;
      const isRestricted = requiresDomain && !emailAllowed;
      const joining = joiningOrgId === item.id;
      let buttonLabel = '';
      let buttonDisabled = false;
      let onPress: (() => void) | undefined;
      let subtitle = formatJoinModeLabel(item.join_mode);

      if (membershipStatus === 'active') {
        buttonLabel = isCurrentOrg ? 'Current' : 'Use this org';
        buttonDisabled = isCurrentOrg;
        onPress = isCurrentOrg ? undefined : (() => {
          void handleUseOrg(item.id);
        });
        subtitle = 'Member';
      } else if (membershipStatus === 'pending') {
        buttonLabel = 'Request sent';
        buttonDisabled = true;
      } else if (membershipStatus === 'rejected') {
        buttonLabel = 'Removed';
        buttonDisabled = true;
      } else if (isRestricted) {
        buttonLabel = 'Restricted';
        buttonDisabled = true;
        subtitle = `Requires @${allowedDomains[0]}`;
      } else if (item.join_mode === 'open_join') {
        buttonLabel = joining ? 'Joining...' : 'Join';
        buttonDisabled = joining;
        onPress = () => {
          void handleJoin(item);
        };
      } else if (item.join_mode === 'request_to_join' && item.has_approver === false) {
        // No active approver — the request would go nowhere, so show it as
        // a passive directory listing instead of an actionable button.
        buttonLabel = 'Not yet joinable';
        buttonDisabled = true;
        subtitle = 'Not on BetterAt yet';
      } else if (item.join_mode === 'request_to_join') {
        buttonLabel = joining ? 'Sending...' : 'Request access';
        buttonDisabled = joining;
        onPress = () => {
          void handleJoin(item);
        };
      } else {
        buttonLabel = 'Invite required';
        buttonDisabled = true;
      }

      return (
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
          <Pressable
            style={[styles.actionButton, buttonDisabled && styles.actionButtonDisabled]}
            disabled={buttonDisabled}
            onPress={onPress}
          >
            <Text style={[styles.actionButtonText, buttonDisabled && styles.actionButtonTextDisabled]}>
              {buttonLabel}
            </Text>
          </Pressable>
        </View>
      );
  }, [activeOrganizationId, handleJoin, handleUseOrg, joiningOrgId, membershipsByOrgId, user?.email]);

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardDismissMode="on-drag"
      ListHeaderComponent={(
        <View style={[styles.header, {paddingTop: toolbarOffset + IOS_SPACING.md}]}>
          <View style={styles.searchInputWrapper}>
            <Search
              size={16}
              color={IOS_COLORS.placeholderText}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder ?? `Search ${noun}`}
              placeholderTextColor={IOS_COLORS.placeholderText}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={handleClear} hitSlop={8}>
                <X size={16} color={IOS_COLORS.systemGray2} />
              </Pressable>
            )}
          </View>

          <Text style={styles.helperText}>
            {helperText ?? 'Search by organization name or slug.'}
          </Text>
        </View>
      )}
      ListEmptyComponent={(
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            {loading ? `Searching ${noun}...` : `No ${noun} found`}
          </Text>
          <Text style={styles.emptyText}>
            {errorText || (normalizedQuery.length === 0
              ? `Start typing to find ${noun}.`
              : 'Try a different search term.')}
          </Text>
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: IOS_SPACING.xxxxl,
  },
  header: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    borderRadius: IOS_RADIUS.sm,
    paddingHorizontal: IOS_SPACING.md,
    height: 36,
  },
  searchIcon: {
    marginRight: IOS_SPACING.xs,
  },
  searchInput: {
    flex: 1,
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    paddingVertical: 0,
  },
  helperText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginTop: IOS_SPACING.sm,
  },
  row: {
    marginHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: IOS_SPACING.sm,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    ...IOS_TYPOGRAPHY.body,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  rowSubtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: IOS_COLORS.systemBlue,
    backgroundColor: '#FFFFFF',
    borderRadius: IOS_RADIUS.full,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.xs,
    minWidth: 92,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    borderColor: IOS_COLORS.systemGray4,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  actionButtonText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
  actionButtonTextDisabled: {
    color: IOS_COLORS.secondaryLabel,
  },
  emptyContainer: {
    paddingHorizontal: IOS_SPACING.xl,
    paddingTop: IOS_SPACING.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginTop: IOS_SPACING.sm,
  },
});
