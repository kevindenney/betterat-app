import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RaceCommsModal } from '@/components/ai/RaceCommsModal';
import { useRaceCommsDraft } from '@/hooks/ai/useRaceCommsDraft';
import { SailwaveImportModal } from '@/components/sailwave';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useWorkspaceDomain } from '@/hooks/useWorkspaceDomain';
import { useOrganizationCommunicationsUnread } from '@/hooks/useOrganizationCommunicationsUnread';
import { formatBadgeCount } from '@/lib/utils/formatBadgeCount';
import { buildProgramCommunicationsHref } from '@/lib/communications/drillDown';
import { buildProgramAssessmentHref } from '@/lib/assessments/drillDown';
import { buildInstitutionProgramItems, type InstitutionProgramItems } from '@/lib/programs/dashboardSections';
import {
  programService,
  OrganizationAssessmentSummary,
} from '@/services/ProgramService';

const UPCOMING_RACES = [
  {
    id: 'race-1',
    name: 'Spring Championship • Race 1',
    start: '2024-03-15T10:00:00Z',
    fleet: 'Dragon Class',
    entries: 12,
    status: 'Ready',
  },
  {
    id: 'race-2',
    name: 'Spring Championship • Race 2',
    start: '2024-03-15T14:00:00Z',
    fleet: 'Dragon Class',
    entries: 12,
    status: 'Pending',
  },
  {
    id: 'race-3',
    name: 'Junior Training Scrimmage',
    start: '2024-03-22T11:00:00Z',
    fleet: 'Optimist',
    entries: 8,
    status: 'Setup Required',
  },
];

const ACTIVE_RACES = [
  {
    id: 'race-live',
    name: 'Spring Championship • Race 1',
    elapsed: '00:24:16',
    course: 'Windward / Leeward',
    checkIn: 11,
  },
];

const COMPLETED_RACES = [
  {
    id: 'race-done-1',
    name: 'Winter Series • Final',
    finished: '2024-03-08T16:00:00Z',
    winner: 'Sarah Johnson',
    boats: 15,
  },
  {
    id: 'race-done-2',
    name: 'Training Race',
    finished: '2024-03-01T16:00:00Z',
    winner: 'Mike Chen',
    boats: 8,
  },
];

const STATUS_COLORS: Record<string, string> = {
  Ready: '#10B981',
  Pending: '#F59E0B',
  'Setup Required': '#EF4444',
};

const QuickAction = ({
  icon,
  label,
  subtitle,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress}>
    <View style={styles.quickIcon}>
      <Ionicons name={icon} size={18} color="#2563EB" />
    </View>
    <View style={{ flex: 1 }}>
      <ThemedText style={styles.quickLabel}>{label}</ThemedText>
      <ThemedText style={styles.quickHelper}>{subtitle}</ThemedText>
    </View>
    {badge && badge > 0 ? (
      <View style={styles.quickActionBadge}>
        <ThemedText style={styles.quickActionBadgeText}>{formatBadgeCount(badge)}</ThemedText>
      </View>
    ) : null}
    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
  </TouchableOpacity>
);

export default function RaceManagementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string; createdProgramId?: string; programId?: string; action?: string }>();
  const refreshParam = Array.isArray(params.refresh) ? params.refresh[0] : params.refresh;
  const routeProgramId = Array.isArray(params.programId) ? params.programId[0] : params.programId;
  const createdProgramId = Array.isArray(params.createdProgramId) ? params.createdProgramId[0] : params.createdProgramId;
  const actionParam = Array.isArray(params.action) ? params.action[0] : params.action;
  const highlightedProgramId = routeProgramId || createdProgramId;
  const [transientHighlightId, setTransientHighlightId] = useState<string | null>(null);
  const [programUpdateBannerVisible, setProgramUpdateBannerVisible] = useState(false);
  const [programUpdateBannerText, setProgramUpdateBannerText] = useState('Program updated');
  const isFocused = useIsFocused();
  const { activeOrganization, ready: orgReady } = useOrganization();
  const { activeDomain, isSailingDomain, isNursingPresentationDomain } = useWorkspaceDomain();
  const { unreadCount: communicationsUnreadCount, unreadCountByProgram } = useOrganizationCommunicationsUnread();
  const hasActiveOrganization = Boolean(activeOrganization?.id);
  const isInstitutionOrganization = activeOrganization?.organization_type === 'institution';
  const isRaceWorkspace = orgReady && hasActiveOrganization && isSailingDomain && !isInstitutionOrganization;
  const hasOrgDomainMismatch = orgReady && hasActiveOrganization && isInstitutionOrganization && isSailingDomain;
  const isInstitutionWorkspace = orgReady && hasActiveOrganization && isInstitutionOrganization && !hasOrgDomainMismatch;
  const allowRaceWorkflows = isRaceWorkspace;
  const contextLabel = useMemo(() => {
    if (!hasActiveOrganization) return 'No organization selected';
    if (activeDomain === 'nursing') return 'Nursing';
    if (activeDomain === 'sailing') return 'Sailing';
    if (activeDomain === 'drawing') return 'Drawing';
    if (activeDomain === 'fitness') return 'Fitness';
    return 'General';
  }, [activeDomain, hasActiveOrganization]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'active' | 'completed'>('upcoming');
  const [commsModalVisible, setCommsModalVisible] = useState(false);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [selectedRaceName, setSelectedRaceName] = useState<string | null>(null);
  const [sailwaveModalVisible, setSailwaveModalVisible] = useState(false);
  const [institutionProgramItems, setInstitutionProgramItems] = useState<InstitutionProgramItems>({
    upcoming: [],
    active: [],
    completed: [],
  });
  const [assessmentSummary, setAssessmentSummary] = useState<OrganizationAssessmentSummary>({
    total: 0,
    draft: 0,
    submitted: 0,
    reviewed: 0,
    finalized: 0,
  });
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programsLoadError, setProgramsLoadError] = useState<string | null>(null);
  const lastRefreshTokenRef = useRef<string | null>(null);
  const upcomingItems = isInstitutionWorkspace
    ? institutionProgramItems.upcoming
    : UPCOMING_RACES;
  const activeItems = isInstitutionWorkspace
    ? institutionProgramItems.active
    : ACTIVE_RACES;
  const completedItems = isInstitutionWorkspace
    ? institutionProgramItems.completed
    : COMPLETED_RACES;
  const quickActionAssessmentTarget = useMemo(() => {
    if (!isInstitutionWorkspace) return null;
    return (
      institutionProgramItems.active[0] ||
      institutionProgramItems.upcoming[0] ||
      institutionProgramItems.completed[0] ||
      null
    );
  }, [institutionProgramItems.active, institutionProgramItems.completed, institutionProgramItems.upcoming, isInstitutionWorkspace]);
  const quickActionCommunicationsTarget = useMemo(() => {
    if (!isInstitutionWorkspace) return null;
    return (
      institutionProgramItems.active[0] ||
      institutionProgramItems.upcoming[0] ||
      institutionProgramItems.completed[0] ||
      null
    );
  }, [institutionProgramItems.active, institutionProgramItems.completed, institutionProgramItems.upcoming, isInstitutionWorkspace]);
  const getProgramUnreadCount = useCallback(
    (programId: string) => {
      const key = String(programId || '').trim();
      if (!key) return 0;
      return unreadCountByProgram[key] || 0;
    },
    [unreadCountByProgram]
  );
  const quickActionCommunicationsBadgeCount = useMemo(() => {
    if (!isInstitutionWorkspace) return undefined;
    if (!quickActionCommunicationsTarget) return communicationsUnreadCount;
    return getProgramUnreadCount(quickActionCommunicationsTarget.id);
  }, [
    communicationsUnreadCount,
    getProgramUnreadCount,
    isInstitutionWorkspace,
    quickActionCommunicationsTarget,
  ]);
  const {
    draft: commsDraft,
    isGenerating: commsGenerating,
    error: commsError,
    generate: generateComms,
    reset: resetComms,
    lastGeneratedAt: commsGeneratedAt,
  } = useRaceCommsDraft({
    raceId: allowRaceWorkflows ? selectedRaceId : null,
    enabled: allowRaceWorkflows && isFocused && commsModalVisible,
  });

  useEffect(() => {
    if (!allowRaceWorkflows) {
      return;
    }
    if (!isFocused) {
      return;
    }
    if (commsModalVisible && selectedRaceId) {
      generateComms();
    }
  }, [allowRaceWorkflows, isFocused, commsModalVisible, selectedRaceId, generateComms]);

  const openCommsModal = (raceId: string, raceName: string) => {
    setSelectedRaceId(raceId);
    setSelectedRaceName(raceName);
    setCommsModalVisible(true);
  };

  const closeCommsModal = () => {
    setCommsModalVisible(false);
    setSelectedRaceId(null);
    setSelectedRaceName(null);
    resetComms();
  };

  useEffect(() => {
    if (!allowRaceWorkflows && commsModalVisible) {
      setCommsModalVisible(false);
      setSelectedRaceId(null);
      setSelectedRaceName(null);
      resetComms();
    }
  }, [allowRaceWorkflows, commsModalVisible, resetComms]);

  useEffect(() => {
    if (!isFocused && commsModalVisible) {
      setCommsModalVisible(false);
      setSelectedRaceId(null);
      setSelectedRaceName(null);
      resetComms();
    }
  }, [isFocused, commsModalVisible, resetComms]);

  const loadInstitutionPrograms = useCallback(async () => {
    if (!isInstitutionWorkspace || !activeOrganization?.id) return;

    try {
      setProgramsLoading(true);
      setProgramsLoadError(null);
      const domainFilter = activeDomain !== 'sailing' && activeDomain !== 'generic' ? activeDomain : undefined;
      const [programs, sessions, participantCounts, nextAssessmentSummary] = await Promise.all([
        programService.listPrograms(activeOrganization.id, domainFilter ? { domain: domainFilter } : {}),
        programService.listOrganizationProgramSessions(activeOrganization.id, 200),
        programService.getProgramParticipantCounts(activeOrganization.id),
        programService.getOrganizationAssessmentSummary(activeOrganization.id),
      ]);

      const sections = buildInstitutionProgramItems({
        programs,
        sessions,
        participantCounts,
      });
      setInstitutionProgramItems(sections);
      setAssessmentSummary(nextAssessmentSummary);
      const targetProgramId = routeProgramId || createdProgramId;
      if (targetProgramId) {
        if (sections.active.some((row) => row.id === targetProgramId)) {
          setActiveTab('active');
        } else if (sections.completed.some((row) => row.id === targetProgramId)) {
          setActiveTab('completed');
        } else if (sections.upcoming.some((row) => row.id === targetProgramId)) {
          setActiveTab('upcoming');
        }
      }
    } catch (error: any) {
      console.error('[programs] Failed to load institution program cards:', error);
      setProgramsLoadError(error?.message || 'Unable to load programs');
    } finally {
      setProgramsLoading(false);
    }
  }, [activeDomain, activeOrganization?.id, createdProgramId, isInstitutionWorkspace, routeProgramId]);

  useEffect(() => {
    if (!isFocused) return;
    void loadInstitutionPrograms();
  }, [isFocused, loadInstitutionPrograms]);

  useEffect(() => {
    if (!highlightedProgramId && !actionParam) return;
    if (highlightedProgramId) {
      setTransientHighlightId(highlightedProgramId);
    }
    setProgramUpdateBannerVisible(true);
    if (actionParam === 'created') {
      setProgramUpdateBannerText('Program created');
    } else if (actionParam === 'templates-updated') {
      setProgramUpdateBannerText('Templates updated');
    } else if (actionParam === 'assignments-updated') {
      setProgramUpdateBannerText('Assignments updated');
    } else {
      setProgramUpdateBannerText('Program updated');
    }
    const timer = highlightedProgramId
      ? setTimeout(() => {
          setTransientHighlightId((current) => (current === highlightedProgramId ? null : current));
        }, 7000)
      : null;
    const bannerTimer = setTimeout(() => {
      setProgramUpdateBannerVisible(false);
    }, 6000);
    return () => {
      if (timer) clearTimeout(timer);
      clearTimeout(bannerTimer);
    };
  }, [actionParam, highlightedProgramId]);

  useEffect(() => {
    if (!isInstitutionWorkspace) return;
    const refreshToken = refreshParam;
    if (!refreshToken) return;
    if (lastRefreshTokenRef.current === refreshToken) return;
    lastRefreshTokenRef.current = refreshToken;
    void loadInstitutionPrograms();
  }, [isInstitutionWorkspace, loadInstitutionPrograms, refreshParam]);

  useEffect(() => {
    if (!isInstitutionWorkspace) return;
    if (!refreshParam && !actionParam && !routeProgramId && !createdProgramId) return;
    // Strip one-time return params so revisits/back-forward don't replay feedback cues.
    router.replace('/(tabs)/programs' as any);
  }, [actionParam, createdProgramId, isInstitutionWorkspace, refreshParam, routeProgramId, router]);

  const metrics = useMemo(() => {
    return [
      {
        key: 'upcoming',
        label: isInstitutionWorkspace ? 'Upcoming Cohorts' : 'Upcoming Races',
        value: upcomingItems.length,
        helper: isInstitutionWorkspace ? 'Scheduled and ready for orientation' : 'Scheduled and ready to brief',
        icon: 'calendar-outline',
      },
      {
        key: 'active',
        label: isInstitutionWorkspace ? 'In Session' : 'On the water',
        value: activeItems.length,
        helper: isInstitutionWorkspace ? 'Live program sessions in progress' : 'Running right now',
        icon: 'speedometer-outline',
      },
      {
        key: 'results',
        label: isInstitutionWorkspace ? 'Evaluations posted' : 'Results posted',
        value: isInstitutionWorkspace ? (assessmentSummary.submitted + assessmentSummary.reviewed) : completedItems.length,
        helper: isInstitutionWorkspace ? 'Awaiting reviewer sign-off' : 'Awaiting publishing review',
        icon: 'trophy-outline',
      },
    ];
  }, [
    activeItems.length,
    assessmentSummary.reviewed,
    assessmentSummary.submitted,
    completedItems.length,
    isInstitutionWorkspace,
    upcomingItems.length,
  ]);

  const quickActions = [
    {
      icon: 'flag-outline',
      label: isInstitutionWorkspace ? 'Launch program block' : 'Launch start sequence',
      subtitle: isInstitutionWorkspace ? 'Notify staff and participants' : 'Signal timers & notify fleet',
      onPress: () => {
        if (isInstitutionWorkspace) {
          const firstProgramId = institutionProgramItems.upcoming[0]?.id || institutionProgramItems.active[0]?.id;
          router.push((firstProgramId ? `/programs/session-builder?programId=${firstProgramId}` : '/(tabs)/members') as any);
          return;
        }
        setActiveTab('active');
        const race = ACTIVE_RACES[0] ?? UPCOMING_RACES[0];
        if (race) openCommsModal(race.id, race.name);
      },
    },
    {
      icon: 'document-text-outline',
      label: isInstitutionWorkspace ? 'Post schedule updates' : 'Post course updates',
      subtitle: isInstitutionWorkspace ? 'Share program and session changes' : 'Share mark changes instantly',
      badge: quickActionCommunicationsBadgeCount,
      onPress: () => {
        if (isInstitutionWorkspace) {
          router.push(
            (
              quickActionCommunicationsTarget
                ? buildProgramCommunicationsHref({
                    programId: quickActionCommunicationsTarget.id,
                    programTitle: quickActionCommunicationsTarget.name,
                  })
                : '/communications'
            ) as any
          );
          return;
        }
        const race = UPCOMING_RACES[0];
        if (race) openCommsModal(race.id, race.name);
        else {
          router.push('/(tabs)/race/add-tufte');
        }
      },
    },
    {
      icon: 'timer-outline',
      label: isInstitutionWorkspace ? 'Record assessments' : 'Record finishes',
      subtitle: isInstitutionWorkspace ? 'Capture competencies and feedback' : 'Capture times & penalties',
      onPress: () => {
        if (isInstitutionWorkspace) {
          router.push(
            (
              quickActionAssessmentTarget
                ? buildProgramAssessmentHref({
                    programId: quickActionAssessmentTarget.id,
                    programTitle: quickActionAssessmentTarget.name,
                  })
                : '/assessments'
            ) as any
          );
          return;
        }
        router.push('/club/results/entry' as any);
      },
    },
  ] as const;

  if (!orgReady) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingState}>
          <Ionicons name="hourglass-outline" size={26} color="#2563EB" />
          <ThemedText style={styles.loadingStateTitle}>Loading workspace…</ThemedText>
          <ThemedText style={styles.loadingStateBody}>
            Resolving your organization context before loading operations.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!hasActiveOrganization) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingState}>
          <Ionicons name="business-outline" size={26} color="#2563EB" />
          <ThemedText style={styles.loadingStateTitle}>No active organization</ThemedText>
          <ThemedText style={styles.loadingStateBody}>
            Select an active organization to load the Programs workspace.
          </ThemedText>
          <TouchableOpacity style={styles.stateActionButton} onPress={() => router.push('/settings/organization-access' as any)}>
            <ThemedText style={styles.stateActionButtonText}>Open organization access</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (hasOrgDomainMismatch) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingState}>
          <Ionicons name="alert-circle-outline" size={26} color="#B91C1C" />
          <ThemedText style={styles.loadingStateTitle}>Organization context mismatch</ThemedText>
          <ThemedText style={styles.loadingStateBody}>
            This institution workspace is currently resolving with sailing context. Switch organizations and retry.
          </ThemedText>
          <TouchableOpacity style={styles.stateActionButton} onPress={() => router.push('/settings/organization-access' as any)}>
            <ThemedText style={styles.stateActionButtonText}>Switch organization</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (!isInstitutionWorkspace && !isRaceWorkspace) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingState}>
          <Ionicons name="compass-outline" size={26} color="#2563EB" />
          <ThemedText style={styles.loadingStateTitle}>Programs unavailable for this organization</ThemedText>
          <ThemedText style={styles.loadingStateBody}>
            Switch to an institution workspace to manage programs and assignments.
          </ThemedText>
          <TouchableOpacity style={styles.stateActionButton} onPress={() => router.push('/settings/organization-access' as any)}>
            <ThemedText style={styles.stateActionButtonText}>Switch organization</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const renderUpcoming = () => (
    <View style={styles.listColumn}>
      {upcomingItems.length === 0 ? (
        <View style={styles.emptyListCard}>
          <ThemedText style={styles.emptyListTitle}>
            {isInstitutionWorkspace ? 'No upcoming programs' : 'No upcoming races'}
          </ThemedText>
          <ThemedText style={styles.emptyListBody}>
            {isInstitutionWorkspace
              ? 'Create your first program to start managing sessions and assignments.'
              : 'Create your first race to begin scheduling starts and entries.'}
          </ThemedText>
        </View>
      ) : null}
      {upcomingItems.map((race) => (
        <View
          key={race.id}
          style={[
            styles.upcomingCard,
            transientHighlightId && race.id === transientHighlightId && styles.highlightCard,
          ]}
        >
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{race.name}</ThemedText>
            <View
              style={[styles.statusBadge, { backgroundColor: `${(STATUS_COLORS[race.status] ?? '#64748B')}1A` }]}
            >
              <Ionicons name="ellipse" size={10} color={STATUS_COLORS[race.status] ?? '#64748B'} />
              <ThemedText
                style={[styles.statusText, { color: STATUS_COLORS[race.status] ?? '#64748B' }]}
              >
                {race.status}
              </ThemedText>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color="#64748B" />
              <ThemedText style={styles.metaText}>
                {format(new Date(race.start), 'MMM d • h:mm a')}
              </ThemedText>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name={isInstitutionWorkspace ? 'school-outline' : 'boat-outline'} size={16} color="#64748B" />
              <ThemedText style={styles.metaText}>
                {isInstitutionWorkspace ? (race as any).track : (race as any).fleet}
              </ThemedText>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color="#64748B" />
              <ThemedText style={styles.metaText}>
                {isInstitutionWorkspace ? `${(race as any).learners} learners` : `${(race as any).entries} entries`}
              </ThemedText>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.cardButton} onPress={() => router.push('/(tabs)/members')}>
              <Ionicons name="people-circle-outline" size={18} color="#2563EB" />
              <ThemedText style={styles.cardButtonText}>{isInstitutionWorkspace ? 'Assign faculty' : 'Assign team'}</ThemedText>
            </TouchableOpacity>
            {isInstitutionWorkspace ? (
              <TouchableOpacity
                style={styles.cardButton}
                onPress={() => router.push((`/programs/assign?programId=${race.id}`) as any)}
              >
                <Ionicons name="person-add-outline" size={18} color="#2563EB" />
                <ThemedText style={styles.cardButtonText}>Assign people</ThemedText>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.cardButton}
              onPress={() =>
                router.push(
                  (isInstitutionWorkspace
                    ? '/programs/templates?type=session'
                    : `/race/documents/${race.id}`) as any
                )
              }
            >
              <Ionicons name="document-outline" size={18} color="#2563EB" />
              <ThemedText style={styles.cardButtonText}>{isInstitutionWorkspace ? 'Program docs' : 'Docs'}</ThemedText>
            </TouchableOpacity>
            {isInstitutionWorkspace ? (
              <TouchableOpacity
                style={styles.cardButtonPrimary}
                onPress={() =>
                  router.push(
                    buildProgramCommunicationsHref({
                      programId: race.id,
                      programTitle: race.name,
                    }) as any
                  )
                }
              >
                <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.cardButtonPrimaryText}>
                  Notify group{getProgramUnreadCount(race.id) > 0 ? ` (${formatBadgeCount(getProgramUnreadCount(race.id))})` : ''}
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.cardButton}
                  onPress={() => (allowRaceWorkflows ? openCommsModal(race.id, race.name) : undefined)}
                >
                  <Ionicons name="sparkles-outline" size={18} color="#2563EB" />
                  <ThemedText style={styles.cardButtonText}>Draft update</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cardButtonPrimary}
                  onPress={() => (allowRaceWorkflows ? openCommsModal(race.id, race.name) : undefined)}
                >
                  <Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.cardButtonPrimaryText}>Brief sailors</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ))}
    </View>
  );

  const renderActive = () => (
    <View style={styles.listColumn}>
      {activeItems.length === 0 ? (
        <View style={styles.emptyListCard}>
          <ThemedText style={styles.emptyListTitle}>
            {isInstitutionWorkspace ? 'No active sessions' : 'No races in progress'}
          </ThemedText>
          <ThemedText style={styles.emptyListBody}>
            {isInstitutionWorkspace
              ? 'Active program sessions will appear here.'
              : 'Live race controls and timing will appear here when racing starts.'}
          </ThemedText>
        </View>
      ) : null}
      {activeItems.map((race) => (
        <View
          key={race.id}
          style={[
            styles.activeCard,
            transientHighlightId && race.id === transientHighlightId && styles.highlightCard,
          ]}
        >
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{race.name}</ThemedText>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.liveText}>{isInstitutionWorkspace ? 'IN SESSION' : 'LIVE'}</ThemedText>
            </View>
          </View>
          <View style={styles.activeBody}>
            <View style={styles.activeMetric}>
              <ThemedText style={styles.activeValue}>{race.elapsed}</ThemedText>
              <ThemedText style={styles.activeLabel}>Elapsed</ThemedText>
            </View>
            <View style={styles.activeMetric}>
              <ThemedText style={styles.activeValue}>
                {isInstitutionWorkspace ? (race as any).unit : (race as any).course}
              </ThemedText>
              <ThemedText style={styles.activeLabel}>{isInstitutionWorkspace ? 'Unit' : 'Course'}</ThemedText>
            </View>
            <View style={styles.activeMetric}>
              <ThemedText style={styles.activeValue}>{race.checkIn}</ThemedText>
              <ThemedText style={styles.activeLabel}>{isInstitutionWorkspace ? 'Learners checked in' : 'Checked in'}</ThemedText>
            </View>
          </View>
          <View style={styles.activeActions}>
            <TouchableOpacity
              style={styles.controlPrimary}
              onPress={() =>
                router.push(
                  (
                    isInstitutionWorkspace
                      ? buildProgramAssessmentHref({
                          programId: race.id,
                          programTitle: race.name,
                        })
                      : '/club/results/entry'
                  ) as any
                )
              }
            >
              <Ionicons name="flag-outline" size={20} color="#FFFFFF" />
              <ThemedText style={styles.controlPrimaryText}>
                {isInstitutionWorkspace ? 'Complete session' : 'Finish race'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlSecondary}
              onPress={() =>
                router.push((isInstitutionWorkspace ? '/settings/organization-access' : `/club/race/control/${race.id}`) as any)
              }
            >
              <Ionicons name="pause-outline" size={20} color="#2563EB" />
              <ThemedText style={styles.controlSecondaryText}>
                {isInstitutionWorkspace ? 'Pause intake' : 'Pause'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlSecondary}
              onPress={() =>
                router.push(
                  (
                    isInstitutionWorkspace
                      ? buildProgramCommunicationsHref({
                          programId: race.id,
                          programTitle: race.name,
                        })
                      : `/club/race/control/${race.id}`
                  ) as any
                )
              }
            >
              <Ionicons name="chatbubble-outline" size={20} color="#2563EB" />
              <ThemedText style={styles.controlSecondaryText}>
                Send update{isInstitutionWorkspace && getProgramUnreadCount(race.id) > 0 ? ` (${formatBadgeCount(getProgramUnreadCount(race.id))})` : ''}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderCompleted = () => (
    <View style={styles.listColumn}>
      {completedItems.length === 0 ? (
        <View style={styles.emptyListCard}>
          <ThemedText style={styles.emptyListTitle}>
            {isInstitutionWorkspace ? 'No completed programs yet' : 'No completed races yet'}
          </ThemedText>
          <ThemedText style={styles.emptyListBody}>
            {isInstitutionWorkspace
              ? 'Completed program sessions and evaluations will appear here.'
              : 'Published race results and recaps will appear here.'}
          </ThemedText>
        </View>
      ) : null}
      {completedItems.map((race) => (
        <View
          key={race.id}
          style={[
            styles.completedCard,
            transientHighlightId && race.id === transientHighlightId && styles.highlightCard,
          ]}
        >
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{race.name}</ThemedText>
            <ThemedText style={styles.completedDate}>
              {format(new Date(race.finished), 'MMM d, yyyy')}
            </ThemedText>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="trophy-outline" size={16} color="#64748B" />
              <ThemedText style={styles.metaText}>
                {isInstitutionWorkspace ? `Lead: ${(race as any).lead}` : `Winner: ${(race as any).winner}`}
              </ThemedText>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color="#64748B" />
              <ThemedText style={styles.metaText}>
                {isInstitutionWorkspace ? `${(race as any).learners} learners` : `${(race as any).boats} boats`}
              </ThemedText>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardButton}
              onPress={() =>
                router.push(
                  (
                    isInstitutionWorkspace
                      ? buildProgramAssessmentHref({
                          programId: race.id,
                          programTitle: race.name,
                        })
                      : `/club/results/${race.id}`
                  ) as any
                )
              }
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#2563EB" />
              <ThemedText style={styles.cardButtonText}>{isInstitutionWorkspace ? 'Publish evaluations' : 'Publish'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardButton}
              onPress={() =>
                router.push(
                  (
                    isInstitutionWorkspace
                      ? buildProgramCommunicationsHref({
                          programId: race.id,
                          programTitle: race.name,
                        })
                      : '/(tabs)/community'
                  ) as any
                )
              }
            >
              <Ionicons name="mail-outline" size={18} color="#2563EB" />
              <ThemedText style={styles.cardButtonText}>
                Send recap{isInstitutionWorkspace && getProgramUnreadCount(race.id) > 0 ? ` (${formatBadgeCount(getProgramUnreadCount(race.id))})` : ''}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardButtonPrimary}
              onPress={() =>
                router.push(
                  (
                    isInstitutionWorkspace
                      ? buildProgramAssessmentHref({
                          programId: race.id,
                          programTitle: race.name,
                        })
                      : `/race/analysis/${race.id}`
                  ) as any
                )
              }
            >
              <Ionicons name="analytics-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.cardButtonPrimaryText}>
                {isInstitutionWorkspace ? 'Open assessments' : 'Open analytics'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contextPill}>
          <ThemedText style={styles.contextPillText}>Context: {contextLabel}</ThemedText>
        </View>
        <View style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <ThemedText style={styles.heroTitle}>
              {isInstitutionWorkspace ? 'Programs & Placements' : 'Race Command Center'}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {isInstitutionWorkspace
                ? 'Coordinate programs, sessions, participant assignments, and assessment workflows in one place.'
                : 'Coordinate starts, documents, and scoring with one view for your race committee.'}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={() =>
              router.push((isInstitutionWorkspace ? '/programs/create' : '/(tabs)/race/add-tufte') as any)
            }
          >
            <Ionicons name="add-circle" size={22} color="#FFFFFF" />
            <ThemedText style={styles.heroButtonText}>
              {isInstitutionWorkspace ? 'Create Program' : 'Create Race'}
            </ThemedText>
          </TouchableOpacity>
        </View>
        {isInstitutionWorkspace ? (
          <View style={styles.programRefreshRow}>
            <TouchableOpacity style={styles.inlineRefreshButton} onPress={() => void loadInstitutionPrograms()}>
              <Ionicons name="refresh-outline" size={16} color="#2563EB" />
              <ThemedText style={styles.inlineRefreshButtonText}>Refresh programs</ThemedText>
            </TouchableOpacity>
            {programsLoading ? (
              <View style={styles.inlineLoadingRow}>
                <ActivityIndicator size="small" color="#2563EB" />
                <ThemedText style={styles.inlineLoadingLabel}>Syncing latest data…</ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
        {isInstitutionWorkspace && programsLoadError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
            <ThemedText style={styles.errorBannerText}>{programsLoadError}</ThemedText>
          </View>
        ) : null}
        {isInstitutionWorkspace && programUpdateBannerVisible ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#166534" />
            <ThemedText style={styles.successBannerText}>{programUpdateBannerText}</ThemedText>
            <TouchableOpacity onPress={() => setProgramUpdateBannerVisible(false)}>
              <Ionicons name="close" size={16} color="#166534" />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.metricsRow}>
          {metrics.map((metric) => (
            <View key={metric.key} style={styles.metricCard}>
              <View style={styles.metricIcon}>
                <Ionicons name={metric.icon as any} size={18} color="#2563EB" />
              </View>
              <ThemedText style={styles.metricLabel}>{metric.label}</ThemedText>
              <ThemedText style={styles.metricValue}>{metric.value}</ThemedText>
              <ThemedText style={styles.metricHelper}>{metric.helper}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.quickColumn}>
          {quickActions.map((action) => (
            <QuickAction key={action.label} {...action} />
          ))}
        </View>

        <View style={styles.tabRow}>
          {(
            [
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'active', label: 'Active' },
              { key: 'completed', label: 'Completed' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <ThemedText
                style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}
              >
                {tab.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'upcoming' && renderUpcoming()}
        {activeTab === 'active' && renderActive()}
        {activeTab === 'completed' && renderCompleted()}

        <View style={styles.operationsCard}>
              <ThemedText style={styles.sectionTitle}>
            {isInstitutionWorkspace
              ? (isNursingPresentationDomain ? 'Clinical operations toolkit' : 'Program operations toolkit')
              : 'Operations toolkit'}
          </ThemedText>
          <ThemedText style={styles.sectionHelper}>
            {isInstitutionWorkspace
              ? (isNursingPresentationDomain
                ? 'Keep clinical documentation, patient safety protocols, and competency workflows current.'
                : 'Keep program templates, session notes, and assessment workflows current.')
              : 'Keep race documentation and safety plans current before teams leave the dock.'}
          </ThemedText>
          <View style={styles.operationsGrid}>
            <TouchableOpacity
              style={styles.operationTile}
              onPress={() =>
                router.push(
                  (isInstitutionWorkspace ? '/programs/templates?type=checklist' : '/(tabs)/race-management') as any
                )
              }
            >
              <Ionicons name="medkit-outline" size={20} color="#2563EB" />
              <ThemedText style={styles.operationLabel}>
                {isInstitutionWorkspace
                  ? (isNursingPresentationDomain ? 'Patient safety checklist' : 'Session checklist')
                  : 'Safety checklist'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.operationTile}
              onPress={() =>
                router.push(
                  (isInstitutionWorkspace ? '/programs/templates?type=message' : '/(tabs)/races') as any
                )
              }
            >
              <Ionicons name="cloudy-outline" size={20} color="#2563EB" />
              <ThemedText style={styles.operationLabel}>
                {isInstitutionWorkspace
                  ? (isNursingPresentationDomain ? 'Clinical partner notes' : 'Program notes')
                  : 'Weather briefing'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.operationTile}
              onPress={() =>
                router.push(
                  (isInstitutionWorkspace ? '/programs/templates?type=session' : '/(tabs)/race-management') as any
                )
              }
            >
              <Ionicons name="map-outline" size={20} color="#2563EB" />
              <ThemedText style={styles.operationLabel}>
                {isInstitutionWorkspace
                  ? (isNursingPresentationDomain ? 'Rotation templates' : 'Session templates')
                  : 'Course maps'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.operationTile}
              onPress={() =>
                router.push(
                  (isInstitutionWorkspace ? '/programs/templates?type=assessment' : '/club/results/entry') as any
                )
              }
            >
              <Ionicons name="clipboard-outline" size={20} color="#2563EB" />
              <ThemedText style={styles.operationLabel}>
                {isInstitutionWorkspace
                  ? (isNursingPresentationDomain ? 'Competency rubrics' : 'Assessment rubrics')
                  : 'Result templates'}
              </ThemedText>
            </TouchableOpacity>
            {isInstitutionWorkspace ? (
              <TouchableOpacity
                style={[styles.operationTile, styles.operationTileSailwave]}
                onPress={() => router.push('/settings/organization-access')}
              >
                <Ionicons name="download-outline" size={20} color="#059669" />
                <ThemedText style={styles.operationLabelSailwave}>Roster import</ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.operationTile, styles.operationTileSailwave]}
                onPress={() => setSailwaveModalVisible(true)}
              >
                <Ionicons name="swap-horizontal-outline" size={20} color="#059669" />
                <ThemedText style={styles.operationLabelSailwave}>Sailwave Import</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
      {allowRaceWorkflows && (
        <RaceCommsModal
          visible={commsModalVisible}
          onClose={closeCommsModal}
          raceName={selectedRaceName ?? undefined}
          draft={commsDraft}
          isGenerating={commsGenerating}
          error={commsError}
          onGenerate={generateComms}
          lastGeneratedAt={commsGeneratedAt ?? null}
        />
      )}
      {allowRaceWorkflows && (
        <SailwaveImportModal
          visible={sailwaveModalVisible}
          onClose={() => setSailwaveModalVisible(false)}
          onImportComplete={(data) => {
            setSailwaveModalVisible(false);
            showAlertWithButtons(
              'Import Successful',
              `Imported ${data.competitors?.length || 0} competitors and ${data.races?.length || 0} races from Sailwave.`,
              [{ text: 'View Results', onPress: () => router.push('/club/results/entry') }]
            );
          }}
        />
      )}
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
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  loadingStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  loadingStateBody: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  stateActionButton: {
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  stateActionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  contextPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: -8,
  },
  contextPillText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  heroCopy: {
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  programRefreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: -10,
  },
  inlineRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  inlineRefreshButtonText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineLoadingLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: -10,
  },
  errorBannerText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: -10,
  },
  successBannerText: {
    flex: 1,
    color: '#166534',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  metricCard: {
    flex: 1,
    minWidth: 180,
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
    color: '#64748B',
  },
  quickColumn: {
    gap: 12,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  quickHelper: {
    fontSize: 12,
    color: '#64748B',
  },
  quickActionBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  quickActionBadgeText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  tabButtonTextActive: {
    color: '#0F172A',
  },
  listColumn: {
    gap: 12,
  },
  emptyListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 6,
  },
  emptyListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyListBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
  },
  upcomingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  highlightCard: {
    borderColor: '#2563EB',
    borderWidth: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 10px rgba(37, 99, 235, 0.14)',
      },
      default: {
        shadowColor: '#2563EB',
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#475569',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
  },
  cardButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  cardButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2563EB',
  },
  cardButtonPrimaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 16,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EA580C',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  activeBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  activeMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  activeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  activeLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  activeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  controlPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
  },
  controlPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  controlSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  controlSecondaryText: {
    color: '#2563EB',
    fontWeight: '600',
  },
  completedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  completedDate: {
    fontSize: 12,
    color: '#64748B',
  },
  operationsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 16,
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
  operationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  operationTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  operationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  operationTileSailwave: {
    borderColor: '#6EE7B7',
    backgroundColor: '#ECFDF5',
  },
  operationLabelSailwave: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
});
