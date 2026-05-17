import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
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

export function ConceptDetail({ conceptId }: { conceptId: string }) {
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

  const handleLinkToStep = async () => {
    if (!user?.id || !currentInterest?.id || !playbook?.id) return;
    setLinking(true);
    try {
      const { data: step } = await supabase
        .from('timeline_steps')
        .select('id,title,status')
        .eq('user_id', user.id)
        .eq('interest_id', currentInterest.id)
        .in('status', ['pending', 'in_progress'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!step) {
        showAlert('No active step', 'Create or open a current step, then link this concept from Plan.');
        return;
      }

      await linkConcept.mutateAsync({
        stepId: step.id,
        conceptId: concept.id,
        userId: user.id,
        interestId: currentInterest.id,
      });
      showAlert('Concept linked', `Linked "${concept.title}" to ${step.title}.`);
    } finally {
      setLinking(false);
    }
  };

  const handlePromote = async () => {
    await promote.mutateAsync();
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>Back to Playbook</Text>
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
        <Pressable style={styles.cta} onPress={handleLinkToStep} disabled={linking}>
          <Text style={styles.ctaText}>{linking ? 'Linking…' : 'Link to a step'}</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
    paddingBottom: 96,
    gap: 14,
  },
  back: {
    alignSelf: 'flex-start',
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
});
