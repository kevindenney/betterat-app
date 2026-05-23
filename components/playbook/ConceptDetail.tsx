import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import {
  useConceptCapabilityChips,
  useConceptTestedSteps,
  useConceptTrailQuotes,
  useLinkConceptToStep,
  usePlaybook,
  usePlaybookConceptById,
  usePromoteConceptToSettled,
} from '@/hooks/usePlaybook';
import { draftConceptSynthesis } from '@/services/ConceptSynthesisService';
import { CapabilityChips } from './CapabilityChips';
import { ConceptSynthesis } from './ConceptSynthesis';
import { TestedInStrip } from './TestedInStrip';
import { TrailOfMoments } from './TrailOfMoments';
import { supabase } from '@/services/supabase';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type { TimelineStepRecord } from '@/types/timeline-steps';

export function ConceptDetail({ conceptId }: { conceptId: string }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const { data: concept } = usePlaybookConceptById(conceptId);
  const { data: quotes = [] } = useConceptTrailQuotes(conceptId);
  const { data: steps = [] } = useConceptTestedSteps(conceptId);
  const { data: capabilityLabels = [] } = useConceptCapabilityChips(conceptId);
  const linkConcept = useLinkConceptToStep();
  const promote = usePromoteConceptToSettled(conceptId);
  const [linking, setLinking] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [candidateSteps, setCandidateSteps] = useState<TimelineStepRecord[]>([]);
  const [selectedStep, setSelectedStep] = useState<TimelineStepRecord | null>(null);

  const synthesis = useMemo(() => {
    if (!concept) return '';
    return draftConceptSynthesis({
      title: concept.title,
      body: concept.body ?? concept.body_md ?? '',
      quotes: quotes.map((quote) => quote.quote_text),
    });
  }, [concept, quotes]);

  if (!concept) return null;

  const state = concept.state ?? 'forming';
  const evidenceCount = new Set(steps.map((step: any) => step.id)).size;
  const canPromote = evidenceCount >= 3;

  const loadCandidateSteps = async () => {
    if (!user?.id || !currentInterest?.id) return [];
    const { data: stepRows, error } = await supabase
      .from('timeline_steps')
      .select('id,title,description,status,updated_at,user_id,interest_id,organization_id,program_session_id,source_type,source_id,category,starts_at,ends_at,location_name,location_lat,location_lng,location_place_id,visibility,share_approximate_location,copied_from_user_id,source_blueprint_id,sort_order,metadata,collaborator_user_ids,completed_at,due_at,is_timed,created_at')
      .eq('user_id', user.id)
      .eq('interest_id', currentInterest.id)
      .in('status', ['pending', 'in_progress', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(12);

    if (error) throw error;
    return (stepRows ?? []) as TimelineStepRecord[];
  };

  const handleOpenStepPicker = async () => {
    if (!user?.id || !currentInterest?.id || !playbook?.id) return;
    setLoadingSteps(true);
    try {
      const stepsForPicker = await loadCandidateSteps();
      setCandidateSteps(stepsForPicker);
      setSelectedStep(stepsForPicker[0] ?? null);
      if (stepsForPicker.length === 0) {
        showAlert('No recent steps', 'Create or open a step in this interest, then link this concept to it.');
        return;
      }
      setPickerVisible(true);
    } finally {
      setLoadingSteps(false);
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
      showAlert('Concept linked', `Linked "${concept.title}" to ${selectedStep.title}.`);
    } finally {
      setLinking(false);
    }
  };

  const handlePromote = async () => {
    await promote.mutateAsync();
  };

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
        accessibilityLabel="Back to Library"
        hitSlop={8}
        style={styles.back}
      >
        <Ionicons name="chevron-back" size={18} color="#007AFF" />
        <Text style={styles.backText}>Library</Text>
      </Pressable>

      <View style={styles.head}>
        <Text style={styles.eye}>Playbook concept</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{state}</Text>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{concept.title}</Text>
        <Text style={styles.meta}>
          {quotes.length} quotes · {steps.length} tested-in steps
        </Text>
      </View>

      <ConceptSynthesis body={synthesis} draftedAtLabel={concept.ai_synthesis_drafted_at ? new Date(concept.ai_synthesis_drafted_at).toLocaleDateString() : undefined} />
      <TrailOfMoments quotes={quotes} />
      <TestedInStrip
        steps={steps.map((step: any) => ({ id: step.id, title: step.title, status: step.status }))}
        onPressStep={(stepId) => router.push(`/race/ios/${stepId}` as any)}
      />
      <CapabilityChips labels={capabilityLabels} />

      {state === 'forming' ? (
        <Pressable style={styles.cta} onPress={handleOpenStepPicker} disabled={linking || loadingSteps}>
          <Text style={styles.ctaText}>{linking ? 'Linking…' : loadingSteps ? 'Loading steps…' : 'Link to a step'}</Text>
        </Pressable>
      ) : null}

      {state === 'testing' ? (
        <View style={styles.footerBlock}>
          <Pressable
            style={[styles.cta, !canPromote && styles.ctaDisabled]}
            onPress={handlePromote}
            disabled={!canPromote || promote.isPending}
          >
            <Text style={[styles.ctaText, !canPromote && styles.ctaTextDisabled]}>
              {promote.isPending ? 'Promoting…' : 'Promote to settled'}
            </Text>
          </Pressable>
          {!canPromote ? <Text style={styles.hint}>{Math.max(0, 3 - evidenceCount)} more to promote</Text> : null}
        </View>
      ) : null}

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalTitle}>Link to a step</Text>
                <Text style={styles.modalSubtitle}>Choose where "{concept.title}" should be tested next.</Text>
              </View>
              <Pressable onPress={() => setPickerVisible(false)} hitSlop={12}>
                <Text style={styles.modalDismiss}>Cancel</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.stepList} contentContainerStyle={styles.stepListContent}>
              {candidateSteps.map((step) => {
                const isSelected = selectedStep?.id === step.id;
                return (
                  <Pressable
                    key={step.id}
                    style={[styles.stepRow, isSelected && styles.stepRowSelected]}
                    onPress={() => setSelectedStep(step)}
                  >
                    <View style={styles.stepRowText}>
                      <Text style={[styles.stepRowTitle, isSelected && styles.stepRowTitleSelected]} numberOfLines={1}>
                        {step.title || 'Untitled'}
                      </Text>
                      <Text style={styles.stepRowMeta}>
                        {formatStepStatus(step.status)} · {formatStepRecency(step)}
                      </Text>
                    </View>
                    {isSelected ? <Text style={styles.stepRowCheck}>Selected</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={[styles.cta, (!selectedStep || linking) && styles.ctaDisabled]}
              onPress={handleConfirmLink}
              disabled={!selectedStep || linking}
            >
              {linking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.ctaText, (!selectedStep || linking) && styles.ctaTextDisabled]}>
                  {selectedStep ? `Link to ${selectedStep.title}` : 'Select a step'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
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
    gap: 14,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 4,
  },
  backText: {
    fontSize: 15,
    color: '#007AFF',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eye: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C4DFF',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  pill: {
    borderRadius: 999,
    backgroundColor: 'rgba(124,77,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C4DFF',
    textTransform: 'uppercase',
  },
  titleBlock: {
    gap: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 41,
    color: '#1C1C1E',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  meta: {
    fontSize: 13,
    color: 'rgba(60,60,67,0.6)',
  },
  cta: {
    borderRadius: 14,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaDisabled: {
    backgroundColor: '#D1D1D6',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaTextDisabled: {
    color: '#FFFFFF',
  },
  footerBlock: {
    gap: 8,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(60,60,67,0.6)',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,28,30,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalTitleBlock: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(60,60,67,0.75)',
  },
  modalDismiss: {
    fontSize: 15,
    color: '#007AFF',
  },
  stepList: {
    maxHeight: 360,
  },
  stepListContent: {
    gap: 10,
  },
  stepRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepRowSelected: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0,122,255,0.06)',
  },
  stepRowText: {
    flex: 1,
    gap: 4,
  },
  stepRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  stepRowTitleSelected: {
    color: '#007AFF',
  },
  stepRowMeta: {
    fontSize: 13,
    color: 'rgba(60,60,67,0.6)',
  },
  stepRowCheck: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
  },
});
