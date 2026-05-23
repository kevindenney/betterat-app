import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useToast } from '@/components/ui/AppToast';
import { PlaybookHome } from '@/components/playbook/PlaybookHome';
import { PlaybookIosPreview } from '@/app/playbook-ios';
import { PlaybookLanding } from '@/components/playbook/PlaybookLanding';
import { LibraryLanding } from '@/components/library/LibraryLanding';
import { LibrarianStrip } from '@/components/library/librarian/LibrarianStrip';
import {
  LibrarianNoticedCard,
  type LibrarianObservation,
} from '@/components/library/librarian/LibrarianNoticedCard';
import { InspirationWizard } from '@/components/inspiration/InspirationWizard';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useInterest } from '@/providers/InterestProvider';
import { usePlaybook, usePlaybookInsights, useLifecycleConcepts, useDiscardPlaybookInsight, useRefinePlaybookInsight } from '@/hooks/usePlaybook';
import { useSubscribedBlueprints } from '@/hooks/useBlueprint';

export default function LibraryIndexScreen() {
  const [inspirationWizardOpen, setInspirationWizardOpen] = React.useState(false);

  // Pick the Concepts-zone body based on existing feature flags. Wave 1
  // wraps it with the segmented zone header; Wave 2 will replace each
  // body individually.
  const conceptsBody = FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER ? (
    <Phase6PlaybookLanding />
  ) : FEATURE_FLAGS.PLAYBOOK_IOS_REGISTER ? (
    <PlaybookIosPreview
      embedded
      onOpenInspiration={() => setInspirationWizardOpen(true)}
    />
  ) : (
    <PlaybookHome />
  );

  return (
    <>
      <LibraryLanding conceptsBody={conceptsBody} />
      <InspirationWizard
        visible={inspirationWizardOpen}
        onClose={() => setInspirationWizardOpen(false)}
      />
    </>
  );
}

function Phase6PlaybookLanding() {
  const toast = useToast();
  const { currentInterest } = useInterest();
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const { data: subscribedBlueprints = [] } = useSubscribedBlueprints(currentInterest?.id);
  const {
    data: insights = [],
    error: insightsError,
  } = usePlaybookInsights(currentInterest?.id);
  const {
    data: concepts = [],
    error: conceptsError,
  } = useLifecycleConcepts(currentInterest?.id);
  const discardInsight = useDiscardPlaybookInsight(currentInterest?.id);
  const refineInsight = useRefinePlaybookInsight(currentInterest?.id, playbook?.id);
  const phase6UnavailableMessage = insightsError?.message ?? conceptsError?.message ?? null;
  const [observationDismissed, setObservationDismissed] = React.useState(false);

  const observation: LibrarianObservation | null = observationDismissed
    ? null
    : buildSampleObservation({
        onDismiss: () => setObservationDismissed(true),
      });

  if (phase6UnavailableMessage) {
    return (
      <View style={styles.unavailableScreen}>
        <View style={styles.unavailableHero}>
          <Text style={styles.unavailableEyebrow}>Playbook</Text>
          <Text style={styles.unavailableHeadline}>Phase 6 data is unavailable in this environment</Text>
          <Text style={styles.unavailableBody}>
            The Playbook tab UI is live, but this Supabase project does not have the
            Phase 6 tables for insights and concept lifecycle yet.
          </Text>
          <Text style={styles.unavailableBody}>
            Apply the Phase 6 migration, then reload this screen. Until then, Playbook
            cannot render real Recent Insights, Concepts in Development, or Settled Foundations.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F2F2F7' }} showsVerticalScrollIndicator={false}>
      <PlaybookLanding
        hideHero
        stats={{
          insights: insights.length,
          testing: concepts.filter((concept) => concept.state === 'testing').length,
          settled: concepts.filter((concept) => concept.state === 'settled').length,
        }}
        insights={insights}
        concepts={concepts}
        subscribedBlueprintCount={subscribedBlueprints.length}
        onOpenBlueprints={() => router.push('/(tabs)/library/blueprints' as any)}
        onRefineInsight={async (insightId) => {
          const concept = await refineInsight.mutateAsync({ insightId });
          toast.show('Concept refined', 'success');
          router.push(`/(tabs)/library/concept/${concept.id}` as any);
        }}
        onDiscardInsight={async (insightId) => {
          await discardInsight.mutateAsync({ insightId });
          toast.show('Insight discarded', 'info');
        }}
        onOpenConcept={(conceptId) => router.push(`/(tabs)/library/concept/${conceptId}` as any)}
        librarianStrip={
          <LibrarianStrip
            onAsk={(seedQuery) =>
              router.push({
                pathname: '/(tabs)/library/ask',
                params: seedQuery ? { q: seedQuery } : {},
              } as any)
            }
          />
        }
        librarianNoticed={
          observation ? <LibrarianNoticedCard observation={observation} /> : null
        }
      />
    </ScrollView>
  );
}

/**
 * Until the librarian has a corpus reader, the unprompted-observation
 * surface ships with a single canonical example so the design's voice
 * lands before retrieval does. Concept lifecycle hooks will replace
 * this with real "concept untouched for N weeks with contradicting
 * debrief" pattern detection.
 */
function buildSampleObservation({
  onDismiss,
}: {
  onDismiss: () => void;
}): LibrarianObservation {
  return {
    id: 'sample-pick-a-side',
    body: 'You\'ve held "Pick a side and commit" for 8 weeks without testing it. The most recent debrief contradicts it — Race 3, where you held the left and lost the leg to the shift.',
    emphasise: ['Pick a side and commit'],
    concept: {
      title: 'Pick a side and commit',
      state: 'forming',
    },
    evidence: {
      label: 'Race 3 debrief',
      date: 'Apr 19',
    },
    primaryAction: {
      label: 'Promote to forming-with-tension',
      onPress: onDismiss,
    },
    secondaryAction: {
      label: 'Add evidence',
      onPress: onDismiss,
    },
    onDismiss,
  };
}

const styles = StyleSheet.create({
  unavailableScreen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 16,
  },
  unavailableHero: {
    marginTop: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F5C58A',
    padding: 18,
    gap: 10,
  },
  unavailableEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: '#9A3412',
  },
  unavailableHeadline: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    color: '#7C2D12',
  },
  unavailableBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#9A3412',
  },
});
