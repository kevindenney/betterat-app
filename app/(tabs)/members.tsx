
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Href } from 'expo-router';
import { format } from 'date-fns';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSafeImageUri } from '@/lib/utils/safeImageUri';
import {
  clubMemberService,
  ClubMember,
  ClubMemberStats,
  MemberFilters,
} from '@/services/ClubMemberService';
import { supabase } from '@/services/supabase';

const membershipTypeOptions = [
  'full',
  'social',
  'junior',
  'senior',
  'family',
  'honorary',
  'crew',
  'guest',
];

const statusOptions = ['active', 'pending', 'inactive', 'expired', 'suspended'];
const roleOptions = ['admin', 'race_admin', 'volunteer_results', 'member', 'guest'];
const paymentStatusOptions = ['paid', 'unpaid', 'partial', 'waived', 'overdue'];

const formatLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatNumber = (value?: number | null) =>
  value === undefined || value === null ? '—' : value.toLocaleString();

const formatCurrency = (value?: number | null) =>
  value === undefined || value === null
    ? '—'
    : `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const FilterChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.filterChip, active && styles.filterChipActive]}
    onPress={onPress}
  >
    <ThemedText style={[styles.filterChipText, active && styles.filterChipTextActive]}>
      {label}
    </ThemedText>
  </TouchableOpacity>
);

export default function MembersScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [stats, setStats] = useState<ClubMemberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clubId, setClubId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<MemberFilters>({
    membership_type: [],
    status: [],
    role: [],
    payment_status: [],
    search: '',
  });

  const loadClubContext = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clubProfile } = await supabase
        .from('club_profiles')
        .select('id, yacht_club_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clubProfile?.yacht_club_id) {
        setClubId(clubProfile.yacht_club_id);
        return;
      }

      // Fallback: if a profile exists but legacy linkage is missing, use profile id.
      if (clubProfile?.id) {
        setClubId(clubProfile.id);
        return;
      }

      // Additional fallback: resolve club by creator ownership.
      const { data: ownedClub } = await supabase
        .from('clubs')
        .select('id')
        .eq('created_by', user.id)
        .maybeSingle();

      if (ownedClub?.id) {
        setClubId(ownedClub.id);
      }
    } catch (error) {
      console.error('Error loading club context:', error);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    if (!clubId) return;

    try {
      setLoading(true);
      const [membersData, statsData] = await Promise.all([
        clubMemberService.getClubMembers(clubId, {
          ...filters,
          search: searchText,
        }),
        clubMemberService.getClubMemberStats(clubId),
      ]);

      setMembers(membersData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading members:', error);
      showAlert('Error', 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [clubId, filters, searchText]);

  useEffect(() => {
    void loadClubContext();
  }, [loadClubContext]);

  useEffect(() => {
    if (clubId) {
      void loadMembers();
    }
  }, [clubId, filters, loadMembers]);

  const handleSearch = () => {
    loadMembers();
  };

  const handleExportMembers = async () => {
    if (!clubId) return;

    try {
      await clubMemberService.shareExportedMembers(clubId, 'Club');
    } catch (error) {
      console.error('Error exporting members:', error);
      showAlert('Error', 'Failed to export members');
    }
  };

  const handleViewPendingRequests = () => {
    router.push('/members/requests');
  };

  const handleInviteMembers = () => {
    void Linking.openURL(
      'mailto:?subject=Join%20our%20club%20on%20RegattaFlow&body=We%20would%20love%20to%20have%20you%20join%20our%20club%20workspace%20on%20RegattaFlow.'
    );
  };

  const handleSendGroupMessage = () => {
    router.push('/(tabs)/community');
  };

  const handleImportRoster = () => {
    router.push('/club/entries');
  };

  const handleViewMemberDetail = (memberId: string) => {
    router.push(`/members/${memberId}` as Href);
  };

  const toggleFilter = (type: keyof MemberFilters, value: string) => {
    setFilters((prev) => {
      const currentValues = prev[type] as string[];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value];

      return {
        ...prev,
        [type]: nextValues,
      };
    });
  };

  const resetFilters = () => {
    setFilters({
      membership_type: [],
      status: [],
      role: [],
      payment_status: [],
      search: '',
    });
  };

  const metrics = useMemo<Metric[]>(() => {
    const totalMembers = stats?.total_members ?? 0;
    const activeMembers = stats?.active_members ?? 0;
    const pendingRequests = stats?.pending_requests ?? 0;
    const activeRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

    return [
      {
        key: 'total',
        label: 'Total Members',
        value: formatNumber(totalMembers),
        helper: 'Across all membership levels',
        icon: 'people-outline',
      },
      {
        key: 'active',
        label: 'Active Members',
        value: formatNumber(activeMembers),
        helper: `${activeRate}% active`,
        icon: 'shield-checkmark-outline',
      },
      {
        key: 'pending',
        label: 'Pending Requests',
        value: formatNumber(pendingRequests),
        helper: 'Awaiting approval',
        icon: 'alert-circle-outline',
      },
      {
        key: 'revenue',
        label: 'Membership Revenue',
        value: formatCurrency(stats?.membership_revenue),
        helper: 'Collected this season',
        icon: 'cash-outline',
      },
    ];
  }, [stats]);

  const membershipBreakdown = useMemo(() => {
    if (!members.length) return [] as { type: string; count: number }[];

    const counts: Record<string, number> = {};
    members.forEach((member) => {
      const type = member.membership_type ?? 'unknown';
      counts[type] = (counts[type] ?? 0) + 1;
    });

    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [members]);

  const quickActions = [
    {
      key: 'invite',
      label: 'Invite member',
      icon: 'person-add-outline',
      action: handleInviteMembers,
    },
    {
      key: 'requests',
      label: 'Review requests',
      icon: 'document-text-outline',
      action: handleViewPendingRequests,
      badge: stats?.pending_requests ?? 0,
    },
    {
      key: 'export',
      label: 'Export roster',
      icon: 'download-outline',
      action: handleExportMembers,
    },
    {
      key: 'email',
      label: 'Send message',
      icon: 'mail-outline',
      action: handleSendGroupMessage,
    },
  ] as const;

  const renderMemberCard = (member: ClubMember) => {
    const avatarUri = getSafeImageUri(member.user?.avatar_url);
    const membershipType = formatLabel(member.membership_type);
    const joinedDate = member.joined_date ? format(new Date(member.joined_date), 'MMM d, yyyy') : '—';
    const paymentStatus = member.payment_status ? formatLabel(member.payment_status) : 'Unknown';

    return (
      <TouchableOpacity
        key={member.id}
        style={styles.memberCard}
        onPress={() => handleViewMemberDetail(member.id)}
      >
        <View style={styles.memberAvatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.memberAvatarImage} />
          ) : (
            <Ionicons name="person-circle" size={52} color="#CBD5E1" />
          )}
        </View>
        <View style={styles.memberContent}>
          <View style={styles.memberHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.memberName}>
                {member.user?.full_name || member.user?.email || 'Unknown member'}
              </ThemedText>
              <ThemedText style={styles.memberSubline}>
                {membershipType} • Joined {joinedDate}
              </ThemedText>
            </View>
            <View
              style={[styles.statusPill, { backgroundColor: `${getStatusColor(member.status)}1A` }]}
            >
              <ThemedText style={[styles.statusPillText, { color: getStatusColor(member.status) }]}
              >
                {formatLabel(member.status)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.memberMetaRow}>
            {member.boat_class && (
              <View style={styles.memberMetaItem}>
                <Ionicons name="boat-outline" size={16} color="#64748B" />
                <ThemedText style={styles.memberMetaText}>
                  {member.boat_class}
                  {member.sail_number ? ` • ${member.sail_number}` : ''}
                </ThemedText>
              </View>
            )}
            <View style={styles.memberMetaItem}>
              <Ionicons name="card-outline" size={16} color="#64748B" />
              <ThemedText style={styles.memberMetaText}>{paymentStatus}</ThemedText>
            </View>
          </View>

          {member.role && member.role !== 'member' && (
            <View style={styles.roleTag}>
              <Ionicons name="shield-checkmark" size={12} color="#7C3AED" />
              <ThemedText style={styles.roleTagText}>{formatLabel(member.role)}</ThemedText>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      </TouchableOpacity>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'inactive':
      case 'expired':
        return '#EF4444';
      case 'suspended':
        return '#8B5CF6';
      default:
        return '#64748B';
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <ThemedText style={styles.heroTitle}>Membership HQ</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Manage rosters, approvals, and member communications in one view.
            </ThemedText>
          </View>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={handleInviteMembers}
          >
            <Ionicons name="add-circle" size={22} color="#FFFFFF" />
            <ThemedText style={styles.heroButtonText}>Invite Members</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          {metrics.map((metric) => (
            <View key={metric.key} style={styles.metricCard}>
              <View style={styles.metricIcon}>
                <Ionicons name={metric.icon as any} size={18} color="#007AFF" />
              </View>
              <ThemedText style={styles.metricLabel}>{metric.label}</ThemedText>
              <ThemedText style={styles.metricValue}>{metric.value}</ThemedText>
              <ThemedText style={styles.metricHelper}>{metric.helper}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.quickActionRow}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.quickActionTile}
              onPress={action.action}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={action.icon as any} size={20} color="#007AFF" />
              </View>
              <ThemedText style={styles.quickActionLabel}>{formatLabel(action.label)}</ThemedText>
              {'badge' in action && action.badge ? (
                <View style={styles.quickActionBadge}>
                  <ThemedText style={styles.quickActionBadgeText}>{action.badge}</ThemedText>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, or sail number"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              placeholderTextColor="#94A3B8"
            />
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <Ionicons name="filter-outline" size={18} color="#007AFF" />
            <ThemedText style={styles.filterButtonText}>Filters</ThemedText>
            {(filters.membership_type?.length ||
              filters.status?.length ||
              filters.role?.length ||
              filters.payment_status?.length) > 0 && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {stats?.pending_requests ? (
          <TouchableOpacity style={styles.alertBanner} onPress={handleViewPendingRequests}>
            <Ionicons name="alert-circle" size={20} color="#F59E0B" />
            <ThemedText style={styles.alertText}>
              {stats.pending_requests} pending membership request
              {stats.pending_requests > 1 ? 's' : ''}
            </ThemedText>
            <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <ThemedText style={styles.sectionTitle}>Member roster</ThemedText>
              <ThemedText style={styles.sectionHelper}>
                {members.length ? `${members.length} profiles` : 'No members yet'}
              </ThemedText>
            </View>
            <TouchableOpacity style={styles.sectionAction} onPress={handleExportMembers}>
              <Ionicons name="download-outline" size={18} color="#007AFF" />
              <ThemedText style={styles.sectionActionText}>Export CSV</ThemedText>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color="#007AFF" />
              <ThemedText style={styles.loadingText}>Loading member roster…</ThemedText>
            </View>
          ) : members.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={32} color="#007AFF" />
              </View>
              <ThemedText style={styles.emptyTitle}>No members yet</ThemedText>
              <ThemedText style={styles.emptyBody}>
                {searchText ||
                filters.membership_type.length ||
                filters.status.length ||
                filters.role.length ||
                filters.payment_status.length
                  ? 'Try clearing filters to see more results.'
                  : 'Invite your first members to build the roster.'}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.memberList}>
              {members.map(renderMemberCard)}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <ThemedText style={styles.sectionTitle}>Membership breakdown</ThemedText>
          <ThemedText style={styles.sectionHelper}>
            Track which programs are driving engagement
          </ThemedText>
          <View style={styles.breakdownRow}>
            {(membershipBreakdown.length ? membershipBreakdown : [{ type: 'Full', count: 0 }]).map(
              ({ type, count }) => (
                <View key={type} style={styles.breakdownCard}>
                  <View style={styles.breakdownIcon}>
                    <Ionicons name="person-outline" size={18} color="#007AFF" />
                  </View>
                  <ThemedText style={styles.breakdownLabel}>{formatLabel(type)}</ThemedText>
                  <ThemedText style={styles.breakdownValue}>{formatNumber(count)}</ThemedText>
                </View>
              )
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <ThemedText style={styles.sectionTitle}>Operations</ThemedText>
          <View style={styles.operationsRow}>
            <TouchableOpacity style={styles.operationButton} onPress={handleExportMembers}>
              <Ionicons name="cloud-download-outline" size={20} color="#007AFF" />
              <ThemedText style={styles.operationButtonText}>Export roster</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.operationButton}
              onPress={handleSendGroupMessage}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#007AFF" />
              <ThemedText style={styles.operationButtonText}>Group message</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.operationButton}
              onPress={handleImportRoster}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#007AFF" />
              <ThemedText style={styles.operationButtonText}>Import roster</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={showFilters}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.filterOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowFilters(false)}
          />
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <ThemedText style={styles.filterTitle}>Filters</ThemedText>
              <TouchableOpacity onPress={resetFilters}>
                <ThemedText style={styles.filterReset}>Clear</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Membership type</ThemedText>
                <View style={styles.filterChipRow}>
                  {membershipTypeOptions.map((option) => (
                    <FilterChip
                      key={option}
                      label={formatLabel(option)}
                      active={filters.membership_type.includes(option)}
                      onPress={() => toggleFilter('membership_type', option)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Status</ThemedText>
                <View style={styles.filterChipRow}>
                  {statusOptions.map((option) => (
                    <FilterChip
                      key={option}
                      label={formatLabel(option)}
                      active={filters.status.includes(option)}
                      onPress={() => toggleFilter('status', option)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Roles</ThemedText>
                <View style={styles.filterChipRow}>
                  {roleOptions.map((option) => (
                    <FilterChip
                      key={option}
                      label={formatLabel(option)}
                      active={filters.role.includes(option)}
                      onPress={() => toggleFilter('role', option)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Payment status</ThemedText>
                <View style={styles.filterChipRow}>
                  {paymentStatusOptions.map((option) => (
                    <FilterChip
                      key={option}
                      label={formatLabel(option)}
                      active={filters.payment_status.includes(option)}
                      onPress={() => toggleFilter('payment_status', option)}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={() => {
                  setShowFilters(false);
                  handleSearch();
                }}
              >
                <ThemedText style={styles.filterApplyText}>Apply filters</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    marginRight: 16,
    gap: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.78)',
  },
  heroButton: {
    backgroundColor: '#007AFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 200,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionTile: {
    flex: 1,
    minWidth: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 14,
    gap: 10,
    position: 'relative',
  },
  quickActionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  quickActionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  quickActionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
    padding: 14,
  },
  alertText: {
    flex: 1,
    color: '#92400E',
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionHelper: {
    fontSize: 13,
    color: '#64748B',
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  memberList: {
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  memberAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  memberContent: {
    flex: 1,
    gap: 8,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  memberSubline: {
    fontSize: 13,
    color: '#64748B',
  },
  memberMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  memberMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberMetaText: {
    fontSize: 13,
    color: '#475569',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F3E8FF',
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
  },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#475569',
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  breakdownCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  breakdownIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  operationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  operationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  operationButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    gap: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterReset: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  filterSection: {
    gap: 12,
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#007AFF',
  },
  filterFooter: {
    paddingTop: 8,
  },
  filterApplyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  filterApplyText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
