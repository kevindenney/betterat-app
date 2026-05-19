import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useToast } from '@/components/ui/AppToast';
import { PlaybookHome } from '@/components/playbook/PlaybookHome';
import { PlaybookIosPreview } from '@/app/playbook-ios';
import { PlaybookLanding } from '@/components/playbook/PlaybookLanding';
import { InspirationWizard } from '@/components/inspiration/InspirationWizard';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useInterest } from '@/providers/InterestProvider';
import { usePlaybook, usePlaybookInsights, useLifecycleConcepts, useDiscardPlaybookInsight, useRefinePlaybookInsight } from '@/hooks/usePlaybook';
import { useSubscribedBlueprints } from '@/hooks/useBlueprint';

export default function PlaybookIndexScreen() {
  const [inspirationWizardOpen, setInspirationWizardOpen] = React.useState(false);

  if (FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER) {
    return (
      <>
        <Phase6PlaybookLanding />
        <InspirationWizard
          visible={inspirationWizardOpen}
          onClose={() => setInspirationWizardOpen(false)}
        />
      </>
    );
  }

  if (FEATURE_FLAGS.PLAYBOOK_IOS_REGISTER) {
    return (
      <>
        <PlaybookIosPreview
          embedded
          onOpenInspiration={() => setInspirationWizardOpen(true)}
        />
        <InspirationWizard
          visible={inspirationWizardOpen}
          onClose={() => setInspirationWizardOpen(false)}
        />
      </>
    );
  }
  return <PlaybookHome />;
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
        stats={{
          insights: insights.length,
          testing: concepts.filter((concept) => concept.state === 'testing').length,
          settled: concepts.filter((concept) => concept.state === 'settled').length,
        }}
        insights={insights}
        concepts={concepts}
        subscribedBlueprintCount={subscribedBlueprints.length}
        onOpenBlueprints={() => router.push('/(tabs)/playbook/blueprints' as any)}
        onRefineInsight={async (insightId) => {
          const concept = await refineInsight.mutateAsync({ insightId });
          toast.show('Concept refined', 'success');
          router.push(`/(tabs)/playbook/concept/${concept.id}` as any);
        }}
        onDiscardInsight={async (insightId) => {
          await discardInsight.mutateAsync({ insightId });
          toast.show('Insight discarded', 'info');
        }}
        onOpenConcept={(conceptId) => router.push(`/(tabs)/playbook/concept/${conceptId}` as any)}
      />
    </ScrollView>
  );
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
