import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useUniversalPlus } from '@/components/capture/UniversalPlusProvider';
import {
  useConceptCapabilityChips,
  useConceptTestedSteps,
  useConceptTrailQuotes,
  useDeletePlaybookConcept,
  useLinkConceptToStep,
  usePlaybook,
  usePlaybookConcepts,
  usePlaybookConceptById,
  usePromoteConceptToSettled,
} from '@/hooks/usePlaybook';
import { draftConceptSynthesis } from '@/services/ConceptSynthesisService';
import { ConceptEditor } from './concepts/ConceptEditor';
import { supabase } from '@/services/supabase';
import { showAlert, showConfirm, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { PlaybookConceptLifecycleState } from '@/types/playbook';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { TrophyScreen, TROPHY_BG, type TrophyVariant } from '@/components/ios-register';
import { hapticSuccess } from '@/lib/haptics';

// ── palette (matches the concepts-redesign mock) ────────────────────
const ACCENT = '#7C4DFF';
const ACCENT_SOFT = '#F1ECFF';
const ACCENT_INK = '#4A2FB0';
const GOLD = '#FF9500';
const GREEN_INK = '#1E8E3E';
const BLUE = '#007AFF';
const RED = '#FF3B30';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const MUTED = 'rgba(60,60,67,0.6)';
const MUTED_2 = 'rgba(60,60,67,0.45)';
const FAINT = 'rgba(60,60,67,0.3)';
const SEP = 'rgba(60,60,67,0.16)';
const SEP_SOFT = 'rgba(60,60,67,0.09)';

const ADVANCE_THRESHOLD = 3;
const ORDER: UIState[] = ['forming', 'testing', 'settled'];

type UIState = 'forming' | 'testing' | 'settled';

function uiState(state: PlaybookConceptLifecycleState | undefined): UIState {
  if (state === 'settled') return 'settled';
  if (state === 'testing') return 'testing';
  return 'forming';
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function originLabel(origin: string): string {
  switch (origin) {
    case 'personal':
      return 'Personal';
    case 'forked':
      return 'Forked from baseline';
    case 'platform_baseline':
      return 'Platform baseline';
    case 'pathway_baseline':
      return 'Pathway baseline';
    default:
      return 'Concept';
  }
}

export function ConceptDetail({ conceptId }: { conceptId: string }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const universalPlus = useUniversalPlus();
  const params = useLocalSearchParams<{ action?: string }>();
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const { data: concept } = usePlaybookConceptById(conceptId);
  const { data: allConcepts = [] } = usePlaybookConcepts(playbook?.id, currentInterest?.id);
  const { data: quotes = [] } = useConceptTrailQuotes(conceptId);
  const { data: steps = [] } = useConceptTestedSteps(conceptId);
  const { data: capabilityLabels = [] } = useConceptCapabilityChips(conceptId);
  const linkConcept = useLinkConceptToStep();
  const promote = usePromoteConceptToSettled(conceptId);
  const deleteConcept = useDeletePlaybookConcept();
  const [editing, setEditing] = useState(false);
  const [trophyVisible, setTrophyVisible] = useState(false);
  const [linking, setLinking] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [candidateSteps, setCandidateSteps] = useState<TimelineStepRecord[]>([]);
  const [selectedStep, setSelectedStep] = useState<TimelineStepRecord | null>(null);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<'all' | 'in_progress' | 'pending' | 'completed'>('all');
  const handledActionRef = useRef(false);

  const synthesis = useMemo(() => {
    if (!concept) return '';
    return draftConceptSynthesis({
      title: concept.title,
      body: concept.body ?? concept.body_md ?? '',
      quotes: quotes.map((quote) => quote.quote_text),
    });
  }, [concept, quotes]);

  const relatedConcepts = useMemo(() => {
    if (!concept?.related_concept_ids?.length) return [];
    const byId = new Map(allConcepts.map((c) => [c.id, c]));
    return concept.related_concept_ids
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [concept, allConcepts]);

  const loadCandidateSteps = async () => {
    if (!user?.id || !currentInterest?.id) return [];
    const { data: stepRows, error } = await supabase
      .from('timeline_steps')
      .select('id,title,description,status,updated_at,user_id,interest_id,organization_id,program_session_id,source_type,source_id,category,starts_at,ends_at,location_name,location_lat,location_lng,location_place_id,visibility,share_approximate_location,copied_from_user_id,source_blueprint_id,sort_order,metadata,collaborator_user_ids,completed_at,due_at,is_timed,created_at')
      .eq('user_id', user.id)
      .eq('interest_id', currentInterest.id)
      .in('status', ['pending', 'in_progress', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(24);

    if (error) throw error;
    return (stepRows ?? []) as TimelineStepRecord[];
  };

  const handleOpenStepPicker = async () => {
    if (!user?.id || !currentInterest?.id || !playbook?.id) return;
    setLoadingSteps(true);
    try {
      const stepsForPicker = await loadCandidateSteps();
      setCandidateSteps(stepsForPicker);
      setSelectedStep(null);
      setSearch('');
      setSegment('all');
      setPickerVisible(true);
    } finally {
      setLoadingSteps(false);
    }
  };

  // Honor the ?action intent passed from the list's inline card actions.
  useEffect(() => {
    if (!concept || handledActionRef.current) return;
    if (params.action === 'edit') {
      handledActionRef.current = true;
      const baseline =
        concept.origin === 'platform_baseline' || concept.origin === 'pathway_baseline';
      if (!baseline && playbook?.id) setEditing(true);
    } else if (params.action === 'link') {
      handledActionRef.current = true;
      if (playbook?.id) handleOpenStepPicker();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept, playbook?.id, params.action]);

  if (!concept) return null;

  const state = uiState(concept.state);
  const evidenceCount = new Set(steps.map((step: any) => step.id)).size;
  const canPromote = evidenceCount >= ADVANCE_THRESHOLD;
  const curIdx = ORDER.indexOf(state);

  const isBaseline =
    concept.origin === 'platform_baseline' || concept.origin === 'pathway_baseline';
  const canEdit = !isBaseline && Boolean(playbook?.id);
  const canDelete =
    (concept.origin === 'personal' || concept.origin === 'forked') && Boolean(playbook?.id);

  // Lifecycle goal + progress.
  let goalIcon: keyof typeof Ionicons.glyphMap = 'link';
  let goalText = '';
  let progress = 0;
  if (state === 'forming') {
    const have = new Set(steps.map((s: any) => s.id)).size;
    progress = Math.min(1, have / ADVANCE_THRESHOLD);
    goalText = `Link ${ADVANCE_THRESHOLD} steps to start testing — ${have}/${ADVANCE_THRESHOLD} so far.`;
  } else if (state === 'testing') {
    progress = Math.min(1, evidenceCount / ADVANCE_THRESHOLD);
    if (canPromote) {
      goalIcon = 'checkmark-circle';
      goalText = 'Evidence is in — review the steps, then promote to a settled foundation.';
    } else {
      const remaining = Math.max(0, ADVANCE_THRESHOLD - evidenceCount);
      goalText = `${remaining} more tested step${remaining === 1 ? '' : 's'} to settle this — needs ${ADVANCE_THRESHOLD} with evidence.`;
    }
  } else {
    goalIcon = 'ribbon-outline';
    progress = 1;
    goalText = 'A settled foundation — it now backs the steps you take.';
  }

  // Trophy-of-Becoming beat shown the moment this concept crosses into settled.
  const otherSettled = allConcepts.filter(
    (c) => c.id !== concept.id && uiState(c.state) === 'settled',
  ).length;
  const trophyVariant: TrophyVariant = otherSettled === 0 ? 'first' : 'canonical';
  const trophyQuote =
    quotes[0]?.quote_text?.trim() ||
    (concept.body ?? concept.body_md ?? '').trim() ||
    concept.title;
  const trophyAttribution = `From your practice · ${new Date(
    concept.settled_at ?? Date.now(),
  ).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`;
  const trophyContext = [
    `${evidenceCount} step${evidenceCount === 1 ? '' : 's'}`,
    currentInterest?.name,
  ].filter((s): s is string => Boolean(s));

  const handleDelete = () => {
    if (!playbook?.id) return;
    showConfirm(
      'Delete concept?',
      'This removes the concept from your Library. Forked concepts can be re-forked from the baseline later.',
      async () => {
        try {
          await deleteConcept.mutateAsync({ conceptId: concept.id, playbookId: playbook.id });
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/library' as any);
        } catch (err) {
          showAlert('Delete failed', (err as Error).message);
        }
      },
      { destructive: true },
    );
  };

  const handleShare = async () => {
    if (Platform.OS === 'web') {
      showAlert('Share', 'Sharing concepts is available in the mobile app.');
      return;
    }
    try {
      await Share.share({
        title: concept.title,
        message: synthesis ? `${concept.title}\n\n${synthesis}` : concept.title,
      });
    } catch {
      /* user dismissed */
    }
  };

  const handleConfirmLink = async () => {
    if (!selectedStep || !user?.id || !currentInterest?.id) return;
    setLinking(true);
    try {
      await linkConcept.mutateAsync({
        stepId: selectedStep.id,
        conceptId: concept.id,
        userId: user.id,
        interestId: currentInterest.id,
      });
      setPickerVisible(false);
      const linkedStepId = selectedStep.id;
      const linkedStepTitle = selectedStep.title;
      showAlertWithButtons(
        'Concept linked',
        `Linked "${concept.title}" to ${linkedStepTitle}.`,
        [
          { text: 'View step', onPress: () => router.push(`/(tabs)/practice?selected=${linkedStepId}` as any) },
          { text: 'Done', style: 'cancel' },
        ],
      );
    } finally {
      setLinking(false);
    }
  };

  const handlePromote = async () => {
    try {
      await promote.mutateAsync();
      hapticSuccess();
      setTrophyVisible(true);
    } catch (err) {
      showAlert('Promote failed', (err as Error).message);
    }
  };

  const handleNewStep = () => {
    setPickerVisible(false);
    if (universalPlus.isAvailable) universalPlus.open();
    else showAlert('Create a step', 'Open the Plan tab to add a step, then link it here.');
  };

  const filteredSteps = candidateSteps.filter((step) => {
    if (segment !== 'all' && step.status !== segment) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (step.title ?? '').toLowerCase().includes(q);
  });

  const groups: { label: string; status: TimelineStepRecord['status'] }[] = [
    { label: 'In progress', status: 'in_progress' },
    { label: 'Planned', status: 'pending' },
    { label: 'Completed', status: 'completed' },
  ];

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 12,
          paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/(tabs)/library' as any)
        }
        accessibilityRole="button"
        accessibilityLabel="Back to Concepts"
        hitSlop={8}
        style={styles.back}
      >
        <Ionicons name="chevron-back" size={18} color={BLUE} />
        <Text style={styles.backText}>Concepts</Text>
      </Pressable>

      <Text style={styles.eye}>Playbook concept</Text>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{concept.title}</Text>
        <StateChip state={state} />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaOrigin}>{originLabel(concept.origin)}</Text>
        <View style={styles.metaDot} />
        <Text style={styles.meta}>
          {quotes.length} moment{quotes.length === 1 ? '' : 's'} · {steps.length} tested-in step
          {steps.length === 1 ? '' : 's'}
        </Text>
      </View>

      {/* lifecycle header */}
      <View style={styles.lifecard}>
        <View style={styles.steps3}>
          {ORDER.map((s, i) => {
            // The terminal stage (settled) is itself an achievement, so once
            // reached it reads as done — otherwise `i < curIdx` never marks the
            // last node complete and it stays stuck in the "current" style.
            const done = i < curIdx || (state === 'settled' && i === curIdx);
            const isCur = i === curIdx && !done;
            return (
              <React.Fragment key={s}>
                <View style={styles.s3}>
                  <View
                    style={[
                      styles.s3ring,
                      done && styles.s3ringDone,
                      isCur && styles.s3ringCur,
                    ]}
                  >
                    {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                  </View>
                  <Text
                    style={[
                      styles.s3lab,
                      done && styles.s3labDone,
                      isCur && styles.s3labCur,
                    ]}
                  >
                    {s}
                  </Text>
                </View>
                {i < ORDER.length - 1 ? (
                  <View style={[styles.s3line, done && styles.s3lineDone]} />
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
        <View style={styles.lifeGoal}>
          <View style={styles.lifeGoalIcon}>
            <Ionicons name={goalIcon} size={15} color={ACCENT} />
          </View>
          <Text style={styles.lifeGoalText}>{goalText}</Text>
        </View>
        <View style={styles.lifeProgTrack}>
          <View style={[styles.lifeProgFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>

      {/* quiet actions */}
      {canEdit || canDelete ? (
        <View style={styles.qactions}>
          {canEdit ? (
            <Pressable style={styles.qbtn} onPress={() => setEditing(true)} hitSlop={4}>
              <Ionicons name="create-outline" size={15} color={LABEL_2} />
              <Text style={styles.qbtnText}>Edit</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.qbtn} onPress={handleShare} hitSlop={4}>
            <Ionicons name="share-outline" size={15} color={LABEL_2} />
            <Text style={styles.qbtnText}>Share</Text>
          </Pressable>
          {canDelete ? (
            <Pressable
              style={styles.qbtn}
              onPress={handleDelete}
              hitSlop={4}
              disabled={deleteConcept.isPending}
            >
              <Ionicons name="trash-outline" size={15} color={RED} />
              <Text style={[styles.qbtnText, styles.qbtnTextDanger]}>
                {deleteConcept.isPending ? 'Deleting…' : 'Delete'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* synthesis */}
      {synthesis ? (
        <View style={styles.dsec}>
          <View style={styles.dsecK}>
            <Text style={styles.dsecKt}>Synthesis</Text>
            <View style={styles.aiTag}>
              <Ionicons name="sparkles" size={13} color={ACCENT} />
              <Text style={styles.aiTagText}>Drafted from your moments</Text>
            </View>
          </View>
          <Text style={styles.synBody}>{synthesis}</Text>
        </View>
      ) : null}

      {/* trail of moments */}
      {quotes.length > 0 ? (
        <View style={styles.dsec}>
          <View style={styles.dsecK}>
            <Text style={styles.dsecKt}>Trail of moments</Text>
          </View>
          <View style={styles.trail}>
            {quotes.map((q, i) => (
              <View key={q.id} style={styles.moment}>
                <View style={styles.mrail}>
                  <View style={styles.mdotbig} />
                  {i < quotes.length - 1 ? <View style={styles.mline} /> : null}
                </View>
                <View style={styles.mbody}>
                  <Text style={styles.mq}>{q.quote_text}</Text>
                  <View style={styles.msrc}>
                    <Ionicons name="chatbubble-ellipses-outline" size={12} color={MUTED} />
                    <Text style={styles.msrcText}>
                      {q.source_label}
                      {q.created_at
                        ? ` · ${new Date(q.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}`
                        : ''}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* tested in */}
      {steps.length > 0 ? (
        <View style={styles.dsec}>
          <View style={styles.dsecK}>
            <Text style={styles.dsecKt}>Tested in</Text>
          </View>
          <View style={styles.testchips}>
            {steps.map((step: any) => (
              <Pressable
                key={step.id}
                style={styles.tchip}
                onPress={() => router.push(`/(tabs)/practice?selected=${step.id}` as any)}
              >
                <View style={[styles.tchipDot, statusDotStyle(step.status)]} />
                <Text style={styles.tchipTitle} numberOfLines={1}>
                  {step.title || 'Untitled'}
                </Text>
                <Text style={styles.tchipDate}>{formatStepStatus(step.status)}</Text>
                <Ionicons name="chevron-forward" size={16} color={FAINT} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* capabilities */}
      {capabilityLabels.length > 0 ? (
        <View style={styles.dsec}>
          <View style={styles.dsecK}>
            <Text style={styles.dsecKt}>Capabilities it builds</Text>
          </View>
          <View style={styles.pills}>
            {capabilityLabels.map((label) => (
              <View key={label} style={styles.capPill}>
                <Ionicons name="layers-outline" size={13} color={ACCENT_INK} />
                <Text style={styles.capPillText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* related */}
      {relatedConcepts.length > 0 ? (
        <View style={styles.dsec}>
          <View style={styles.dsecK}>
            <Text style={styles.dsecKt}>Related concepts</Text>
          </View>
          <View style={styles.pills}>
            {relatedConcepts.map((rc) => (
              <Pressable
                key={rc.id}
                style={styles.relPill}
                onPress={() => router.push(`/(tabs)/library/concept/${rc.id}` as any)}
              >
                <Ionicons name="bulb-outline" size={13} color={MUTED} />
                <Text style={styles.relPillText}>{rc.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* primary action */}
      <View style={styles.primary}>
        {state === 'testing' && canPromote ? (
          <>
            <Pressable
              style={[styles.bigbtn, styles.bigbtnPromote]}
              onPress={handlePromote}
              disabled={promote.isPending}
            >
              <Ionicons name="ribbon-outline" size={18} color="#fff" />
              <Text style={styles.bigbtnText}>
                {promote.isPending ? 'Promoting…' : 'Promote to a foundation'}
              </Text>
            </Pressable>
            <Text style={styles.primaryHint}>
              Enough evidence is in — settle it, or link one more step.
            </Text>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.bigbtn, styles.bigbtnGo]}
              onPress={handleOpenStepPicker}
              disabled={loadingSteps}
            >
              <Ionicons name="link" size={18} color="#fff" />
              <Text style={styles.bigbtnText}>
                {loadingSteps ? 'Loading steps…' : 'Link to a step'}
              </Text>
            </Pressable>
            <Text style={styles.primaryHint}>
              {state === 'forming'
                ? 'Test this idea in a real step to start building evidence.'
                : state === 'testing'
                  ? (() => {
                      const remaining = Math.max(0, ADVANCE_THRESHOLD - evidenceCount);
                      return `${remaining} more tested step${remaining === 1 ? '' : 's'} ${remaining === 1 ? 'settles' : 'settle'} this concept.`;
                    })()
                  : 'A settled foundation — keep testing it as conditions change.'}
            </Text>
          </>
        )}
      </View>

      {/* ── link-to-a-step picker ── */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetGrab} />
            <View style={styles.sheetHead}>
              <View style={styles.sheetHeadRow}>
                <Text style={styles.sheetTitle}>Link to a step</Text>
                <Pressable onPress={() => setPickerVisible(false)} hitSlop={10}>
                  <Text style={styles.sheetCancel}>Cancel</Text>
                </Pressable>
              </View>
              <Text style={styles.sheetSub}>
                Choose where <Text style={styles.sheetSubEm}>{concept.title}</Text> should be
                tested next.
              </Text>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={MUTED} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search your steps…"
                  placeholderTextColor={MUTED_2}
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.lseg}>
                {(
                  [
                    ['all', 'All'],
                    ['in_progress', 'In progress'],
                    ['pending', 'Planned'],
                    ['completed', 'Completed'],
                  ] as const
                ).map(([key, label]) => (
                  <Pressable
                    key={key}
                    style={[styles.lsegBtn, segment === key && styles.lsegBtnOn]}
                    onPress={() => setSegment(key)}
                  >
                    <Text
                      style={[styles.lsegText, segment === key && styles.lsegTextOn]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent}>
              <Pressable style={styles.newStep} onPress={handleNewStep}>
                <View style={styles.newStepPlus}>
                  <Ionicons name="add" size={17} color="#fff" />
                </View>
                <View style={styles.newStepBody}>
                  <Text style={styles.newStepTitle}>New step for this concept</Text>
                  <Text style={styles.newStepSub}>Create a step, then link it in one move</Text>
                </View>
              </Pressable>

              {filteredSteps.length === 0 ? (
                <Text style={styles.sheetEmpty}>
                  No steps match. Try another filter, or create one above.
                </Text>
              ) : (
                groups.map((group) => {
                  const rows = filteredSteps.filter((s) => s.status === group.status);
                  if (rows.length === 0) return null;
                  return (
                    <View key={group.status}>
                      <Text style={styles.grp}>{group.label}</Text>
                      {rows.map((step) => {
                        const isSelected = selectedStep?.id === step.id;
                        const race = isRaceStep(step);
                        return (
                          <Pressable
                            key={step.id}
                            style={[styles.srow, isSelected && styles.srowSel]}
                            onPress={() => setSelectedStep(step)}
                          >
                            <View style={[styles.radio, isSelected && styles.radioSel]}>
                              {isSelected ? <View style={styles.radioInner} /> : null}
                            </View>
                            <View style={styles.srowBody}>
                              <View style={styles.srowTitleRow}>
                                <Text
                                  style={[styles.srowTitle, isSelected && styles.srowTitleSel]}
                                  numberOfLines={1}
                                >
                                  {step.title || 'Untitled'}
                                </Text>
                                {race ? (
                                  <View style={styles.raceBadge}>
                                    <Text style={styles.raceBadgeText}>Race</Text>
                                  </View>
                                ) : null}
                              </View>
                              <View style={styles.srowMeta}>
                                <View style={[styles.srowMetaDot, statusDotStyle(step.status)]} />
                                <Text style={styles.srowMetaText}>
                                  {formatStepStatus(step.status)} · {formatStepRecency(step)}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.sheetFoot}>
              <Text style={styles.why}>
                <Ionicons name="sparkles" size={12} color={ACCENT} /> Linking adds this concept to
                the step's review — each link is evidence toward settling it.
              </Text>
              <Pressable
                style={[styles.bigbtn, styles.bigbtnGo, (!selectedStep || linking) && styles.bigbtnDisabled]}
                onPress={handleConfirmLink}
                disabled={!selectedStep || linking}
              >
                {linking ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="link" size={18} color="#fff" />
                    <Text style={styles.bigbtnText} numberOfLines={1}>
                      {selectedStep ? `Link to ${selectedStep.title}` : 'Select a step'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {editing && playbook?.id ? (
        <ConceptEditor
          mode="edit"
          concept={concept}
          playbookId={playbook.id}
          onClose={() => setEditing(false)}
        />
      ) : null}

      {/* ── Trophy of Becoming — fires when the concept settles ── */}
      <Modal
        visible={trophyVisible}
        animationType="fade"
        onRequestClose={() => setTrophyVisible(false)}
      >
        <View
          style={[
            styles.trophyPage,
            {
              backgroundColor: TROPHY_BG,
              paddingTop: insets.top,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <TrophyScreen
            variant={trophyVariant}
            content={{
              quote: trophyQuote,
              attribution: trophyAttribution,
              capabilityLabel: concept.title,
              contextSpans: trophyContext,
            }}
          />
          <Pressable
            style={styles.trophyDone}
            onPress={() => setTrophyVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.trophyDoneText}>Done</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

function StateChip({ state }: { state: UIState }) {
  const color = state === 'forming' ? GOLD : state === 'testing' ? ACCENT : GREEN_INK;
  const bg =
    state === 'forming' ? '#FFF4E5' : state === 'testing' ? ACCENT_SOFT : '#E3F7E8';
  const ink = state === 'forming' ? GOLD : state === 'testing' ? ACCENT_INK : GREEN_INK;
  return (
    <View style={[styles.stateChip, { backgroundColor: bg }]}>
      <View style={[styles.stateDot, { backgroundColor: color }]} />
      <Text style={[styles.stateText, { color: ink }]}>{cap(state)}</Text>
    </View>
  );
}

function isRaceStep(step: TimelineStepRecord): boolean {
  const anyStep = step as any;
  return (
    anyStep.is_race === true ||
    anyStep.category === 'race' ||
    anyStep.source_type === 'race'
  );
}

function statusDotStyle(status?: string | null) {
  switch (status) {
    case 'completed':
      return { backgroundColor: '#34C759' };
    case 'in_progress':
      return { backgroundColor: GOLD };
    default:
      return { backgroundColor: FAINT };
  }
}

function formatStepStatus(status?: string | null) {
  switch (status) {
    case 'in_progress':
      return 'In progress';
    case 'pending':
      return 'Planned';
    case 'completed':
      return 'Completed';
    default:
      return 'Step';
  }
}

function formatStepRecency(step: Pick<TimelineStepRecord, 'updated_at' | 'completed_at'>) {
  const ts = step.completed_at ?? step.updated_at;
  if (!ts) return 'recently updated';
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingHorizontal: 16,
    gap: 13,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    fontSize: 15,
    color: BLUE,
    fontWeight: '600',
  },
  eye: {
    fontSize: 10.5,
    fontWeight: '800',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 33,
    lineHeight: 38,
    color: LABEL,
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaOrigin: {
    fontSize: 12.5,
    color: MUTED_2,
    fontWeight: '600',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: FAINT,
  },
  meta: {
    fontSize: 12.5,
    color: MUTED,
    fontWeight: '600',
  },

  // lifecycle header
  lifecard: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  steps3: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
  },
  s3: {
    alignItems: 'center',
    gap: 5,
    width: 74,
  },
  s3ring: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: SEP,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  s3ringDone: {
    backgroundColor: GREEN_INK,
    borderColor: GREEN_INK,
  },
  s3ringCur: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  s3lab: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: MUTED_2,
  },
  s3labDone: {
    color: GREEN_INK,
  },
  s3labCur: {
    color: ACCENT_INK,
  },
  s3line: {
    flex: 1,
    height: 2,
    backgroundColor: SEP,
    marginTop: -19,
  },
  s3lineDone: {
    backgroundColor: GREEN_INK,
  },
  lifeGoal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  lifeGoalIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifeGoalText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: LABEL_2,
    lineHeight: 18,
  },
  lifeProgTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: SEP_SOFT,
    overflow: 'hidden',
    marginTop: 11,
  },
  lifeProgFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 999,
  },

  // quiet actions
  qactions: {
    flexDirection: 'row',
    gap: 8,
  },
  qbtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    borderRadius: 11,
    paddingVertical: 9,
  },
  qbtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: LABEL_2,
  },
  qbtnTextDanger: {
    color: RED,
  },

  // detail sections
  dsec: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  dsecK: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dsecKt: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MUTED,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  aiTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED_2,
  },
  synBody: {
    fontSize: 15,
    lineHeight: 23,
    color: LABEL_2,
  },

  // trail timeline
  trail: {
    flexDirection: 'column',
  },
  moment: {
    flexDirection: 'row',
    gap: 13,
  },
  mrail: {
    width: 14,
    alignItems: 'center',
  },
  mdotbig: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: ACCENT,
    marginTop: 4,
  },
  mline: {
    flex: 1,
    width: 2,
    backgroundColor: SEP,
    marginVertical: 2,
  },
  mbody: {
    flex: 1,
    paddingBottom: 15,
  },
  mq: {
    fontSize: 15,
    lineHeight: 21,
    color: LABEL,
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
  },
  msrc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  msrcText: {
    fontSize: 11.5,
    color: MUTED,
    fontWeight: '600',
  },

  // tested-in chips
  testchips: {
    gap: 8,
  },
  tchip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tchipDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  tchipTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: LABEL,
  },
  tchipDate: {
    fontSize: 11.5,
    color: MUTED,
    fontWeight: '600',
  },

  // capability + related pills
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  capPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT_SOFT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  capPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: ACCENT_INK,
  },
  relPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SEP_SOFT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  relPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: LABEL_2,
  },

  // primary CTA
  primary: {
    marginTop: 3,
  },
  bigbtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  bigbtnGo: {
    backgroundColor: ACCENT,
  },
  bigbtnPromote: {
    backgroundColor: GREEN_INK,
  },
  bigbtnDisabled: {
    opacity: 0.5,
  },
  bigbtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flexShrink: 1,
  },
  primaryHint: {
    textAlign: 'center',
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
    marginTop: 8,
  },

  // ── link sheet ──
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,28,30,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: 0,
  },
  sheetGrab: {
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: SEP,
    alignSelf: 'center',
    marginTop: 9,
    marginBottom: 2,
  },
  sheetHead: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SEP_SOFT,
  },
  sheetHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: LABEL,
  },
  sheetCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: BLUE,
  },
  sheetSub: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 18,
  },
  sheetSubEm: {
    color: ACCENT_INK,
    fontWeight: '700',
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(118,118,128,0.1)',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 11,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: LABEL,
    ...Platform.select({
      web: { outlineWidth: 0 } as Record<string, unknown>,
      default: {},
    }),
  },
  lseg: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(118,118,128,0.1)',
    borderRadius: 9,
    padding: 3,
    marginTop: 10,
  },
  lsegBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    alignItems: 'center',
  },
  lsegBtnOn: {
    backgroundColor: '#fff',
  },
  lsegText: {
    fontSize: 12,
    fontWeight: '600',
    color: LABEL_2,
  },
  lsegTextOn: {
    color: LABEL,
  },
  sheetList: {
    paddingHorizontal: 12,
  },
  sheetListContent: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  sheetEmpty: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 24,
  },
  newStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 4,
    backgroundColor: '#FBFAFF',
  },
  newStepPlus: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newStepBody: {
    flex: 1,
  },
  newStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT_INK,
  },
  newStepSub: {
    fontSize: 11.5,
    color: MUTED,
    fontWeight: '500',
  },
  grp: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MUTED_2,
    paddingHorizontal: 6,
    paddingTop: 9,
    paddingBottom: 6,
  },
  srow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  srowSel: {
    borderColor: ACCENT,
    backgroundColor: '#FBFAFF',
  },
  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: SEP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSel: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  srowBody: {
    flex: 1,
    minWidth: 0,
  },
  srowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  srowTitle: {
    flexShrink: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: LABEL,
  },
  srowTitleSel: {
    color: ACCENT_INK,
  },
  raceBadge: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  raceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: BLUE,
  },
  srowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  srowMetaDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  srowMetaText: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
  },
  sheetFoot: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SEP_SOFT,
  },
  why: {
    fontSize: 11.5,
    color: MUTED,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 17,
  },
  trophyPage: {
    flex: 1,
  },
  trophyDone: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  trophyDoneText: {
    fontSize: 17,
    color: BLUE,
  },
});
