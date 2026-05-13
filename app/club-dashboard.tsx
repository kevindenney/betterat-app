import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/text';
import { useClubs } from '@/hooks/useData';
import { useClubMembers } from '@/hooks/useClubMembers';
import {
  ClubIntegrationSnapshot,
  ClubMembershipRecord,
  ClubDocumentSnapshot,
  useClubIntegrationSnapshots,
} from '@/hooks/useClubIntegrationSnapshots';
import { useClubEntries } from '@/hooks/useClubEntries';
import {
  ClubRole,
  getClubRoleDefinition,
  hasAdminAccess,
  isManagementRole,
  normalizeClubRole,
} from '@/types/club';
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  FileText,
  Users,
  Trophy,
  Globe,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react-native';

type DashboardView =
  | 'dashboard'
  | 'events'
  | 'entries'
  | 'documents'
  | 'volunteers'
  | 'results'
  | 'publishing'
  | 'members';

const NAV_ITEMS: {
  id: DashboardView;
  label: string;
  icon: React.ComponentType<any>;
  requiresManagement?: boolean;
}[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'events', label: 'Events', icon: CalendarDays, requiresManagement: true },
  { id: 'entries', label: 'Entries & Payments', icon: CreditCard, requiresManagement: true },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'volunteers', label: 'Volunteers', icon: Users, requiresManagement: true },
  { id: 'results', label: 'Results', icon: Trophy, requiresManagement: true },
  { id: 'publishing', label: 'Publishing', icon: Globe, requiresManagement: true },
  { id: 'members', label: 'Members', icon: ShieldCheck, requiresManagement: true },
];

const MODULE_ROADMAP: Record<Exclude<DashboardView, 'dashboard'>, string> = {
  events: 'Regatta setup and calendar publishing are in progress. You will soon manage race series, fees, and NOR packages here.',
  entries: 'The entry ledger, Stripe payouts, and refund workflows are being wired up now. Expect sandbox access in the next milestone.',
  documents: 'Document automation is almost ready. Upload NORs/SIs, set expirations, and push notifications once the module ships.',
  volunteers: 'Assign PRO, signal boats, and volunteer crews with the roster module rolling out shortly.',
  results: 'Live scoring review, protest tracking, and publishing to microsites are scheduled after the payments milestone.',
  publishing: 'White-label microsites and embeddable widgets will surface here with custom branding controls.',
  members: 'Membership approvals, renewals, and role assignments are nearly complete. You will approve sailors and assign access shortly.',
};

const filterVolunteerEvents = (snapshot: ClubIntegrationSnapshot) =>
  snapshot.events.filter((event) => {
    const type = (event.eventType || '').toLowerCase();
    return type.includes('volunteer') || type.includes('maintenance') || type.includes('training');
  });

const ClubDashboardScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId?: string; view?: string }>();

  const clubId = typeof params.clubId === 'string' ? params.clubId : '';
  const requestedView = typeof params.view === 'string' ? (params.view as DashboardView) : undefined;

  const { data: memberships, loading: membershipsLoading, error: membershipsError, refetch } = useClubs();

  const membershipRecord = useMemo(() => {
    if (!clubId || !memberships) return null;
    return (memberships as ClubMembershipRecord[]).find((membership) => {
      const currentClubId =
        (membership.yacht_clubs?.id as string | undefined) ||
        (membership.club?.id as string | undefined) ||
        membership.club_id;
      return currentClubId === clubId;
    }) || null;
  }, [clubId, memberships]);

  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const ENTRY_FILTERS = useMemo(
    () => [
      { id: 'all', label: 'All' },
      { id: 'confirmed', label: 'Confirmed' },
      { id: 'pending', label: 'Pending payment' },
      { id: 'waitlist', label: 'Waitlist' },
      { id: 'withdrawn', label: 'Withdrawn' },
    ] as const,
    []
  );

  type EntryFilterId = typeof ENTRY_FILTERS[number]['id'];

  const [entryFilter, setEntryFilter] = useState<EntryFilterId>('all');

  useEffect(() => {
    if (requestedView && NAV_ITEMS.some((item) => item.id === requestedView)) {
      setActiveView(requestedView);
    }
  }, [requestedView]);

  const role: ClubRole | null = useMemo(() => {
    if (!membershipRecord) {
      return null;
    }
    return normalizeClubRole(membershipRecord.role ?? null);
  }, [membershipRecord]);

  const roleDefinition = role ? getClubRoleDefinition(role) : null;
  const managementAccess = role ? isManagementRole(role) : false;
  const adminAccess = role ? hasAdminAccess(role) : false;

  const enableEntriesFetch =
    Boolean(clubId) && (managementAccess || activeView === 'entries' || activeView === 'dashboard');
  const {
    entries,
    summary: entrySummary,
    loading: entriesLoading,
    error: entriesError,
    refetch: refetchEntries,
  } = useClubEntries(clubId, { enabled: enableEntriesFetch });

  const enableMemberFetch = Boolean(clubId) && (managementAccess || activeView === 'members');
  const {
    members,
    loading: membersLoading,
    error: membersError,
    refetch: refetchMembers,
    groupedByRole,
  } = useClubMembers(clubId, { enabled: enableMemberFetch });

  const { snapshots, loading: snapshotLoading, error: snapshotError, refetch: refetchSnapshots } =
    useClubIntegrationSnapshots(membershipRecord ? [membershipRecord] : []);

  const snapshot = snapshots[0] ?? null;

  const onRefresh = async () => {
    const promises: Promise<unknown>[] = [refetch(), refetchSnapshots()];
    if (enableEntriesFetch) {
      promises.push(refetchEntries());
    }
    if (enableMemberFetch) {
      promises.push(refetchMembers());
    }
    await Promise.allSettled(promises);
  };

  const renderRoadmapNotice = (view: Exclude<DashboardView, 'dashboard'>) => {
    if (!MODULE_ROADMAP[view]) return null;
    return (
      <View style={styles.noticeCard}>
        <AlertCircle color="#1B2534" size={18} />
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>Module on deck</Text>
          <Text style={styles.noticeCopy}>{MODULE_ROADMAP[view]}</Text>
        </View>
      </View>
    );
  };

  const renderRegattaList = (limit?: number) => {
    if (!snapshot || snapshot.regattas.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>No regattas yet</Text>
          <Text style={styles.emptyCopy}>
            Configure a series to unlock online entries, payments, and live results.
          </Text>
        </View>
      );
    }

    return snapshot.regattas.slice(0, limit ?? snapshot.regattas.length).map((regatta) => (
      <View key={regatta.id} style={styles.listRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>{regatta.name}</Text>
          <Text style={styles.listMeta}>
            {formatDate(regatta.startDate)}
            {regatta.endDate ? ` • Ends ${formatDate(regatta.endDate)}` : ''}
          </Text>
          {regatta.eventType && <Text style={styles.listTag}>{regatta.eventType}</Text>}
        </View>
        <Text style={styles.listAction}>
          {regatta.entryFee
            ? `${regatta.currency || 'USD'} ${regatta.entryFee.toFixed(2)}`
            : 'Free entry'}
        </Text>
      </View>
    ));
  };

  const renderEventList = () => {
    if (!snapshot || snapshot.events.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>Your calendar is open</Text>
          <Text style={styles.emptyCopy}>
            Add clinics, socials, and work parties to keep members in the loop.
          </Text>
        </View>
      );
    }

    return snapshot.events.map((event) => (
      <View key={event.id} style={styles.listRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>{event.title}</Text>
          <Text style={styles.listMeta}>{formatDate(event.startDate)}</Text>
          {event.eventType && <Text style={styles.listTag}>{event.eventType}</Text>}
        </View>
        <Text style={styles.listAction}>{event.status || 'Scheduled'}</Text>
      </View>
    ));
  };

  const renderEntrySummary = () => {
    if (entriesLoading) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>Loading entry stats…</Text>
          <Text style={styles.emptyCopy}>Hold tight while we sync registrations and payments.</Text>
        </View>
      );
    }

    if (entriesError) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>We could not load entries</Text>
          <Text style={styles.emptyCopy}>Pull down to retry or try again in a moment.</Text>
        </View>
      );
    }

    if (entrySummary.totalEntries === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>No entries yet</Text>
          <Text style={styles.emptyCopy}>
            Open registration on a regatta and we will collect entries, waivers, and payments here.
          </Text>
        </View>
      );
    }

    const primaryCurrency = entrySummary.currencyBreakdown[0]?.currency || 'USD';

    return (
      <>
        <View style={styles.entrySummaryRow}>
          <View style={styles.entrySummaryCard}>
            <Text style={styles.entrySummaryLabel}>Total entries</Text>
            <Text style={styles.entrySummaryValue}>{entrySummary.totalEntries}</Text>
          </View>
          <View style={styles.entrySummaryCard}>
            <Text style={styles.entrySummaryLabel}>Confirmed</Text>
            <Text style={styles.entrySummaryValue}>{entrySummary.confirmed}</Text>
          </View>
          <View style={styles.entrySummaryCard}>
            <Text style={styles.entrySummaryLabel}>Pending payment</Text>
            <Text style={styles.entrySummaryValue}>{entrySummary.pendingPayment}</Text>
          </View>
          <View style={styles.entrySummaryCard}>
            <Text style={styles.entrySummaryLabel}>Waitlist</Text>
            <Text style={styles.entrySummaryValue}>{entrySummary.waitlist}</Text>
          </View>
        </View>

        <View style={styles.entrySummaryRow}>
          <View style={styles.entrySummaryCard}>
            <Text style={styles.entrySummaryLabel}>Collected ({primaryCurrency})</Text>
            <Text style={styles.entrySummaryValue}>
              {formatCurrency(entrySummary.revenueCollected, primaryCurrency)}
            </Text>
          </View>
          <View style={styles.entrySummaryCard}>
            <Text style={styles.entrySummaryLabel}>Outstanding ({primaryCurrency})</Text>
            <Text style={styles.entrySummaryValue}>
              {formatCurrency(entrySummary.revenueOutstanding, primaryCurrency)}
            </Text>
          </View>
          <View style={styles.entrySummaryCard}>
            <Text style={styles.entrySummaryLabel}>Refunded ({primaryCurrency})</Text>
            <Text style={styles.entrySummaryValue}>
              {formatCurrency(entrySummary.revenueRefunded, primaryCurrency)}
            </Text>
          </View>
        </View>

        {entrySummary.currencyBreakdown.length > 1 && (
          <View style={styles.currencyBreakdownCard}>
            <Text style={styles.entrySummaryLabel}>Multi-currency breakdown</Text>
            {entrySummary.currencyBreakdown.map((bucket) => (
              <Text key={bucket.currency} style={styles.currencyBreakdownRow}>
                {bucket.currency}: collected {formatCurrency(bucket.collected, bucket.currency)} • outstanding {formatCurrency(bucket.outstanding, bucket.currency)}
              </Text>
            ))}
          </View>
        )}
      </>
    );
  };

  const renderEntryList = () => {
    if (entriesLoading) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>Loading entries…</Text>
          <Text style={styles.emptyCopy}>Syncing the latest registrations.</Text>
        </View>
      );
    }

    if (entriesError) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>Unable to load entries</Text>
          <Text style={styles.emptyCopy}>Pull to refresh or try again later.</Text>
        </View>
      );
    }

    const filtered = entries.filter((entry) => {
      switch (entryFilter) {
        case 'confirmed':
          return entry.status === 'confirmed';
        case 'pending':
          return (
            entry.status === 'pending_payment' ||
            entry.payment_status === 'pending' ||
            entry.payment_status === 'unpaid'
          );
        case 'waitlist':
          return entry.status === 'waitlist';
        case 'withdrawn':
          return entry.status === 'withdrawn' || entry.status === 'rejected';
        default:
          return true;
      }
    });

    if (filtered.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>No entries in this filter</Text>
          <Text style={styles.emptyCopy}>
            Switch filters or open registration to start accepting race entries.
          </Text>
        </View>
      );
    }

    return filtered.slice(0, 12).map((entry) => {
      const feeDisplay = formatCurrency(entry.entry_fee_amount, entry.entry_fee_currency);
      return (
        <TouchableOpacity
          key={entry.id}
          style={styles.listRow}
          onPress={() =>
            router.push({
              pathname: '/club/entries/[entryId]',
              params: { entryId: entry.id, clubId },
            })
          }
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle}>{entry.regatta?.name || 'Regatta entry'}</Text>
            <Text style={styles.listMeta}>
              {entry.entry_number ? `Entry #${entry.entry_number}` : entry.sail_number || 'Awaiting sail number'}
              {entry.entry_class ? ` • ${entry.entry_class}` : ''}
            </Text>
            <Text style={styles.listMeta}>
              Status: {entry.status.replace(/_/g, ' ')} • Payment: {entry.payment_status.replace(/_/g, ' ')}
            </Text>
            {entry.regatta?.start_date && (
              <Text style={styles.listMeta}>
                Race starts {formatDate(entry.regatta.start_date)}
              </Text>
            )}
          </View>
          <Text style={styles.listAction}>{feeDisplay}</Text>
        </TouchableOpacity>
      );
    });
  };

  const handleOpenDocument = async (document: ClubDocumentSnapshot) => {
    if (!document.url) return;

    try {
      await Linking.openURL(document.url);
    } catch (err) {
      console.warn('[ClubDashboard] Failed to open document', err);
    }
  };

  const renderDocuments = () => {
    if (!snapshot || snapshot.documents.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>No club documents yet</Text>
          <Text style={styles.emptyCopy}>
            Upload NORs, SIs, and bulletins from the desktop console while we finish in-app publishing.
          </Text>
        </View>
      );
    }

    return snapshot.documents.map((document) => (
      <TouchableOpacity
        key={document.id}
        style={styles.listRow}
        onPress={() => handleOpenDocument(document)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>{document.title}</Text>
          <Text style={styles.listMeta}>
            {document.documentType || 'Document'} • {formatDate(document.publishDate)}
          </Text>
        </View>
        <Text style={styles.listAction}>Open</Text>
      </TouchableOpacity>
    ));
  };

  const renderVolunteerList = () => {
    if (!snapshot) return null;

    const volunteerEvents = filterVolunteerEvents(snapshot);
    if (volunteerEvents.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>No volunteer shifts posted</Text>
          <Text style={styles.emptyCopy}>
            Assign PRO, signal boat, and protest committee slots once the roster module launches.
          </Text>
        </View>
      );
    }

    return volunteerEvents.map((event) => (
      <View key={event.id} style={styles.listRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>{event.title}</Text>
          <Text style={styles.listMeta}>{formatDate(event.startDate)}</Text>
        </View>
        <Text style={styles.listAction}>Volunteer</Text>
      </View>
    ));
  };

  const totalMembers = members.length;
  const roleHighlights = useMemo(() => {
    const rolesToHighlight: ClubRole[] = [
      'admin',
      'race_admin',
      'volunteer_results',
    ];

    return rolesToHighlight
      .map((clubRole) => ({
        role: clubRole,
        count: groupedByRole[clubRole]?.length ?? 0,
        label: getClubRoleDefinition(clubRole).label,
      }))
      .filter((item) => item.count > 0);
  }, [groupedByRole]);

  const renderMembersSummary = () => {
    if (!membershipRecord || !roleDefinition) return null;

    return (
      <View style={styles.focusCard}>
        <Text style={styles.focusTitle}>Membership snapshot</Text>
        <Text style={styles.focusMeta}>Role: {roleDefinition.label}</Text>
        {membershipRecord.membership_type && (
          <Text style={styles.focusMeta}>Membership type: {membershipRecord.membership_type}</Text>
        )}
        {membershipRecord.payment_status && (
          <Text style={styles.focusMeta}>Payment status: {membershipRecord.payment_status}</Text>
        )}
        <Text style={[styles.focusMeta, { marginTop: 8 }]}>
          Roster size: {totalMembers > 0 ? `${totalMembers} members` : 'Syncing…'}
        </Text>
        {roleHighlights.length > 0 && (
          <View style={styles.roleHighlightRow}>
            {roleHighlights.map((highlight) => (
              <View key={highlight.role} style={styles.roleHighlightBadge}>
                <Text style={styles.roleHighlightTitle}>{highlight.count}</Text>
                <Text style={styles.roleHighlightLabel}>{highlight.label}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.focusCopy, { marginTop: 12 }]}>
          Approvals and renewals will appear here once the membership desk ships. You will review
          applications, assign roles, and manage dues from this workspace.
        </Text>
      </View>
    );
  };

  const renderMemberRoster = () => {
    if (membersLoading) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>Loading roster…</Text>
          <Text style={styles.emptyCopy}>Pull to refresh if this takes longer than expected.</Text>
        </View>
      );
    }

    if (membersError) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>We could not load the roster</Text>
          <Text style={styles.emptyCopy}>Pull down to retry or check your connection.</Text>
        </View>
      );
    }

    if (members.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHeadline}>No members yet</Text>
          <Text style={styles.emptyCopy}>
            Invite sailors or import a roster to start assigning roles and permissions.
          </Text>
        </View>
      );
    }

    const roleOrder: ClubRole[] = [
      'admin',
      'race_admin',
      'volunteer_results',
      'member',
      'guest',
    ];

    return roleOrder
      .filter((clubRole) => groupedByRole[clubRole]?.length)
      .map((clubRole) => {
        const roleMembers = groupedByRole[clubRole]
          .slice()
          .sort((a, b) => {
            const nameA = a.user?.full_name || '';
            const nameB = b.user?.full_name || '';
            return nameA.localeCompare(nameB);
          });

        const roleInfo = getClubRoleDefinition(clubRole);

        return (
          <View key={clubRole} style={styles.roleGroup}>
            <Text style={styles.roleGroupTitle}>{roleInfo.label}</Text>
            <Text style={styles.roleGroupDetail}>{roleInfo.description}</Text>
            {roleMembers.map((member) => (
              <View key={member.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{member.user?.full_name || 'Member'}</Text>
                  <Text style={styles.listMeta}>
                    {member.membership_type ? `${member.membership_type} • ` : ''}
                    Status: {member.status}
                  </Text>
                  <Text style={styles.listMeta}>
                    Payments: {member.payment_status || 'unknown'}
                    {member.last_payment_date ? ` • Last paid ${formatDate(member.last_payment_date)}` : ''}
                  </Text>
                </View>
                {member.member_number && (
                  <Text style={styles.listAction}>#{member.member_number}</Text>
                )}
              </View>
            ))}
          </View>
        );
      });
  };

  const renderView = () => {
    if (!snapshot) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyHeadline}>Club data not connected yet</Text>
          <Text style={styles.emptyCopy}>
            Ask your club administrator to connect RegattaFlow so you can manage events, documents, and
            members from one control center.
          </Text>
        </View>
      );
    }

    switch (activeView) {
      case 'dashboard': {
        const primaryCurrency = entrySummary.currencyBreakdown[0]?.currency || 'USD';
        const metricCards = [
          {
            id: 'total-entries',
            label: 'Total entries',
            value: entrySummary.totalEntries.toString(),
            onPress: () => {
              setActiveView('entries');
              setEntryFilter('all');
            },
          },
          {
            id: 'pending-payments',
            label: 'Pending payment',
            value: entrySummary.pendingPayment.toString(),
            onPress: () => {
              setActiveView('entries');
              setEntryFilter('pending');
            },
          },
          {
            id: 'revenue-collected',
            label: `Collected (${primaryCurrency})`,
            value: formatCurrency(entrySummary.revenueCollected, primaryCurrency),
            onPress: () => {
              setActiveView('entries');
              setEntryFilter('confirmed');
            },
          },
          {
            id: 'volunteer-needs',
            label: 'Volunteer needs',
            value: String(snapshot.insights.volunteerNeeds ?? 0),
            onPress: () => {
              setActiveView('volunteers');
            },
          },
        ];

        return (
          <>
            {snapshot.insights.nextAction && (
              <View style={styles.noticeCard}>
                <AlertCircle color="#0B63F6" size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noticeTitle}>Recommended next step</Text>
                  <Text style={styles.noticeCopy}>{snapshot.insights.nextAction}</Text>
                </View>
              </View>
            )}

            <View style={styles.metricRow}>
              {metricCards.map((metric) => (
                metric.onPress ? (
                  <TouchableOpacity
                    key={metric.id}
                    style={[styles.metricCard, styles.metricCardInteractive]}
                    onPress={metric.onPress}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.metricValue}>{metric.value}</Text>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                    <Text style={styles.metricHint}>Tap to open</Text>
                  </TouchableOpacity>
                ) : (
                  <View key={metric.id} style={styles.metricCard}>
                    <Text style={styles.metricValue}>{metric.value}</Text>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                  </View>
                )
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Next regattas</Text>
              {renderRegattaList(4)}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Club documents</Text>
              {renderDocuments()}
            </View>
          </>
        );
      }

      case 'events':
        return (
          <>
            {renderRoadmapNotice('events')}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming events</Text>
              {renderEventList()}
            </View>
          </>
        );

      case 'entries':
        return (
          <>
            {renderRoadmapNotice('entries')}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Entry summary</Text>
              {renderEntrySummary()}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Latest entries</Text>
              <View style={styles.entryFilterRow}>
                {ENTRY_FILTERS.map((filter) => (
                  <TouchableOpacity
                    key={filter.id}
                    style={[
                      styles.entryFilterChip,
                      entryFilter === filter.id && styles.entryFilterChipActive,
                    ]}
                    onPress={() => setEntryFilter(filter.id)}
                  >
                    <Text
                      style={[
                        styles.entryFilterLabel,
                        entryFilter === filter.id && styles.entryFilterLabelActive,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {renderEntryList()}
            </View>
          </>
        );

      case 'documents':
        return (
          <>
            {renderRoadmapNotice('documents')}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Published documents</Text>
              {renderDocuments()}
            </View>
          </>
        );

      case 'volunteers':
        return (
          <>
            {renderRoadmapNotice('volunteers')}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Volunteer roster</Text>
              {renderVolunteerList()}
            </View>
          </>
        );

      case 'results':
        return (
          <>
            {renderRoadmapNotice('results')}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent results</Text>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyHeadline}>Results automation in progress</Text>
                <Text style={styles.emptyCopy}>
                  Race officers will validate finishes, manage protests, and publish standings directly from this view.
                </Text>
              </View>
            </View>
          </>
        );

      case 'publishing':
        return (
          <>
            {renderRoadmapNotice('publishing')}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>White-label microsite</Text>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyHeadline}>Brand-ready microsites</Text>
                <Text style={styles.emptyCopy}>
                  Configure themes, custom domains, and embeddable widgets so regatta information stays in sync wherever your club publishes it.
                </Text>
              </View>
              <View style={styles.snippetCard}>
                <Text style={styles.sectionTitle}>Widget snippets</Text>
                <View style={styles.codeBlock}>
                  <Text style={styles.codeText}>
                    {`<script src="https://widgets.regattaflow.com/embed.js"\n        data-club="${clubId}"\n        data-view="calendar">\n</script>`}
                  </Text>
                </View>
                <Text style={styles.codeCaption}>
                  Drop this snippet into your existing club website to render a live calendar.
                </Text>
              </View>
            </View>
          </>
        );

      case 'members':
        return (
          <>
            {renderRoadmapNotice('members')}
            {renderMembersSummary()}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Club roster</Text>
              {renderMemberRoster()}
            </View>
          </>
        );

      default:
        return null;
    }
  };

  if (!clubId) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyHeadline}>Club not specified</Text>
          <Text style={styles.emptyCopy}>Return to My Clubs and choose a club to manage.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(tabs)/clubs')}>
            <Text style={styles.primaryButtonText}>Back to clubs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const loading =
    membershipsLoading || snapshotLoading || (enableEntriesFetch ? entriesLoading : false);
  const error = membershipsError || snapshotError;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#111" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {snapshot?.club.name || membershipRecord?.yacht_clubs?.name || 'Club workspace'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {roleDefinition
              ? `${roleDefinition.label}${adminAccess ? ' • Admin access' : ''}`
              : 'Member access'}
          </Text>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingBar}>
          <Text style={styles.loadingText}>Syncing club data…</Text>
        </View>
      )}

      {error && (
        <View style={styles.noticeCard}>
          <AlertCircle color="#B54708" size={18} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeTitle, { color: '#B54708' }]}>We could not load club data</Text>
            <Text style={[styles.noticeCopy, { color: '#B54708' }]}>
              Pull to refresh or try again later.
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.navBar}
        contentContainerStyle={styles.navContent}
      >
        {NAV_ITEMS.map((item) => {
          const disabled = item.requiresManagement && !managementAccess;
          const active = activeView === item.id;
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navChip,
                active && styles.navChipActive,
                disabled && styles.navChipDisabled,
              ]}
              onPress={() => {
                if (disabled) return;
                setActiveView(item.id);
              }}
            >
              <Icon size={16} color={active ? '#0B63F6' : '#3C4759'} />
              <Text
                style={[
                  styles.navChipLabel,
                  active && styles.navChipLabelActive,
                  disabled && styles.navChipLabelDisabled,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      >
        {renderView()}
      </ScrollView>
    </View>
  );
};

const formatDate = (iso?: string | null) => {
  if (!iso) return 'TBD';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatCurrency = (amount?: number, currency?: string) => {
  const safeCurrency = currency || 'USD';
  const numeric = Number.isFinite(amount) ? (amount as number) : 0;
  return `${safeCurrency} ${numeric.toFixed(2)}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E3E8EF',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F1728',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#475467',
    marginTop: 2,
  },
  loadingBar: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#475467',
  },
  navBar: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E3E8EF',
  },
  navContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  navChipActive: {
    backgroundColor: '#E9F2FF',
    borderWidth: 1,
    borderColor: '#0B63F6',
  },
  navChipDisabled: {
    opacity: 0.4,
  },
  navChipLabel: {
    fontSize: 13,
    color: '#3C4759',
    fontWeight: '600',
  },
  navChipLabelActive: {
    color: '#0B63F6',
  },
  navChipLabelDisabled: {
    color: '#98A2B3',
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 18,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E3E8EF',
  },
  metricCardInteractive: {
    borderColor: '#0B63F6',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F1728',
  },
  metricLabel: {
    fontSize: 13,
    color: '#475467',
    marginTop: 6,
  },
  metricHint: {
    fontSize: 11,
    color: '#0B63F6',
    marginTop: 4,
    fontWeight: '600',
  },
  entrySummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  entrySummaryCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3E8EF',
  },
  entrySummaryLabel: {
    fontSize: 12,
    color: '#475467',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  entrySummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F1728',
  },
  currencyBreakdownCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    padding: 16,
    gap: 6,
  },
  currencyBreakdownRow: {
    fontSize: 12,
    color: '#475467',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F1728',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2F4F7',
    padding: 14,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  listMeta: {
    fontSize: 12,
    color: '#667085',
    marginTop: 4,
  },
  listTag: {
    fontSize: 12,
    color: '#0B63F6',
    marginTop: 6,
    fontWeight: '600',
  },
  listAction: {
    fontSize: 12,
    color: '#0B63F6',
    fontWeight: '600',
    marginLeft: 12,
  },
  entryFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  entryFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F2F4F7',
  },
  entryFilterChipActive: {
    backgroundColor: '#E9F2FF',
    borderWidth: 1,
    borderColor: '#0B63F6',
  },
  entryFilterLabel: {
    fontSize: 13,
    color: '#3C4759',
    fontWeight: '600',
  },
  entryFilterLabelActive: {
    color: '#0B63F6',
  },
  emptyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    gap: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyHeadline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F1728',
    textAlign: 'center',
  },
  emptyCopy: {
    fontSize: 14,
    color: '#475467',
    textAlign: 'center',
    lineHeight: 20,
  },
  focusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    gap: 8,
  },
  focusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F1728',
  },
  focusMeta: {
    fontSize: 13,
    color: '#475467',
  },
  focusCopy: {
    fontSize: 13,
    color: '#475467',
    lineHeight: 18,
  },
  roleHighlightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  roleHighlightBadge: {
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  roleHighlightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B63F6',
  },
  roleHighlightLabel: {
    fontSize: 11,
    color: '#475467',
    marginTop: 2,
  },
  roleGroup: {
    marginBottom: 18,
  },
  roleGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F1728',
    marginBottom: 2,
  },
  roleGroupDetail: {
    fontSize: 12,
    color: '#475467',
    marginBottom: 10,
  },
  snippetCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    padding: 18,
    marginTop: 16,
    gap: 12,
  },
  codeBlock: {
    backgroundColor: '#0F1728',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  codeText: {
    color: '#E0E7FF',
    fontFamily: 'Menlo',
    fontSize: 12,
    lineHeight: 18,
  },
  codeCaption: {
    fontSize: 12,
    color: '#475467',
    marginTop: 8,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#E9EFFB',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B2534',
  },
  noticeCopy: {
    fontSize: 13,
    color: '#1B2534',
    marginTop: 4,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#0B63F6',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ClubDashboardScreen;
