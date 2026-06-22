import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useToast } from '@/components/ui/AppToast';
import { PlaybookHome } from '@/components/playbook/PlaybookHome';
import { PlaybookIosPreview } from '@/app/playbook-ios';
import { PlaybookLanding } from '@/components/playbook/PlaybookLanding';
import { LibraryLanding } from '@/components/library/LibraryLanding';
import { LibrarianLine } from '@/components/library/librarian/LibrarianLine';
import {
  LibrarianNoticedCard,
  type LibrarianObservation,
} from '@/components/library/librarian/LibrarianNoticedCard';
import { EvidenceStepPickerSheet } from '@/components/library/librarian/EvidenceStepPickerSheet';
import { InspirationWizard } from '@/components/inspiration/InspirationWizard';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useInterest } from '@/providers/InterestProvider';
import {
  usePlaybook,
  usePlaybookInsights,
  useLifecycleConcepts,
  useDiscardPlaybookInsight,
  useRefinePlaybookInsight,
} from '@/hooks/usePlaybook';

interface ObservationAnchor {
  id: string;
  title: string;
  state: 'forming' | 'forming-with-tension' | 'testing' | 'settled';
  /** Number of step_concept_links rows pointing at this concept.
   *  Powers the body copy ("0 evidence yet" vs "3 steps tested it"). */
  evidenceCount: number;
}

export default function LibraryIndexScreen() {
  const [inspirationWizardOpen, setInspirationWizardOpen] = React.useState(false);
  const [observationDismissed, setObservationDismissed] = React.useState(false);
  const [evidencePickerOpen, setEvidencePickerOpen] = React.useState(false);
  const toast = useToast();
  const { currentInterest } = useInterest();
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const { data: concepts = [] } = useLifecycleConcepts(currentInterest?.id);

  // Pick a real concept to anchor the librarian observation on.
  // Priority — the librarian's job is "what needs attention":
  //   1. Forming, zero evidence — you said this matters but haven't
  //      tested it. Highest priority.
  //   2. Forming-with-tension, low evidence — you've promoted it but
  //      it still needs more steps.
  //   3. Testing, oldest by updated_at — under exercise but stalled.
  //   4. Anything else (including settled) — last.
  // Falls back to the sample observation only when the user has zero
  // concepts.
  const observationAnchor = React.useMemo<ObservationAnchor | null>(() => {
    if (concepts.length === 0) return null;
    const stateWeight: Record<string, number> = {
      forming: 0,
      'forming-with-tension': 1,
      testing: 2,
      settled: 3,
    };
    const ranked = [...concepts].sort((a, b) => {
      const wa = stateWeight[a.state ?? 'forming'] ?? 4;
      const wb = stateWeight[b.state ?? 'forming'] ?? 4;
      if (wa !== wb) return wa - wb;
      const ea = a.linked_step_count ?? 0;
      const eb = b.linked_step_count ?? 0;
      if (ea !== eb) return ea - eb;
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return ta - tb;
    });
    const candidate = ranked[0];
    return {
      id: candidate.id,
      title: candidate.title ?? 'Untitled concept',
      state: candidate.state ?? 'forming',
      evidenceCount: candidate.linked_step_count ?? 0,
    };
  }, [concepts]);

  const handleAddEvidence = React.useCallback(() => {
    if (observationAnchor) {
      setEvidencePickerOpen(true);
    } else {
      toast.show(
        'No concepts yet — capture one first, then attach a step as evidence.',
        'info',
      );
    }
  }, [observationAnchor, toast]);

  const librarianSlot = (
    <LibrarianSlot
      observationDismissed={observationDismissed}
      onDismissObservation={() => setObservationDismissed(true)}
      anchor={observationAnchor}
      onPromote={() =>
        toast.show(
          "Promote needs corpus wiring · the librarian can't yet rewrite concepts",
          'info',
        )
      }
      onAddEvidence={handleAddEvidence}
    />
  );

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
      <LibraryLanding
        conceptsBody={conceptsBody}
        librarianSlot={librarianSlot}
        onOpenInspiration={() => setInspirationWizardOpen(true)}
      />
      <InspirationWizard
        visible={inspirationWizardOpen}
        onClose={() => setInspirationWizardOpen(false)}
      />
      {observationAnchor ? (
        <EvidenceStepPickerSheet
          visible={evidencePickerOpen}
          conceptId={observationAnchor.id}
          conceptTitle={observationAnchor.title}
          interestId={currentInterest?.id}
          playbookId={playbook?.id}
          onClose={() => setEvidencePickerOpen(false)}
          onLinked={() => toast.show('Evidence attached', 'success')}
        />
      ) : null}
    </>
  );
}

function LibrarianSlot({
  observationDismissed,
  onDismissObservation,
  anchor,
  onPromote,
  onAddEvidence,
}: {
  observationDismissed: boolean;
  onDismissObservation: () => void;
  anchor: ObservationAnchor | null;
  onPromote: () => void;
  onAddEvidence: () => void;
}) {
  // The full noticed card is collapsed by default — the librarian shows
  // one line, and tapping it reveals the card with its Promote /
  // Add-evidence actions. Earlier the card sat open in the feed and
  // pushed the user's own plans below the fold.
  const [expanded, setExpanded] = React.useState(false);

  // No fabricated observation for users without concepts. The card cites a
  // real concept + evidence; a canned sample fabricated sailing history
  // ("held 'Pick a side and commit' for 8 weeks… Race 3") that leaked to
  // every persona. Until there's a real concept to anchor on, the line
  // carries the librarian's voice as the rotating "Ask" prompt on its own.
  const observation: LibrarianObservation | null =
    observationDismissed || !anchor
      ? null
      : buildObservationForConcept({
          anchor,
          onDismiss: () => {
            setExpanded(false);
            onDismissObservation();
          },
          onPromote,
          onAddEvidence,
        });

  const insightTeaser = anchor
    ? `${anchor.title} is ${humanState(anchor.state)} — ${
        anchor.evidenceCount === 0
          ? 'no step has tested it yet'
          : `${anchor.evidenceCount} step${anchor.evidenceCount === 1 ? '' : 's'} so far`
      }.`
    : null;

  return (
    <>
      <LibrarianLine
        insightText={observation ? insightTeaser : null}
        emphasise={anchor ? [anchor.title] : []}
        expanded={expanded}
        onToggleExpand={() => setExpanded((v) => !v)}
        onAsk={(seedQuery) =>
          router.push({
            pathname: '/(tabs)/library/ask',
            params: seedQuery ? { q: seedQuery } : {},
          } as any)
        }
      />
      {observation && expanded ? (
        <LibrarianNoticedCard observation={observation} />
      ) : null}
    </>
  );
}

function Phase6PlaybookLanding() {
  const toast = useToast();
  const { currentInterest } = useInterest();
  const { data: playbook } = usePlaybook(currentInterest?.id);
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
          <Text style={styles.unavailableEyebrow}>Library</Text>
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

  // No inner ScrollView — LibraryLanding's body ScrollView already wraps
  // this slot. A nested same-axis ScrollView was clipping the bottom of
  // "Concepts in development" behind the floating tab bar.
  return (
    <PlaybookLanding
      hideHero
      insights={insights}
      concepts={concepts}
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
      onLinkConcept={(conceptId) =>
        router.push(`/(tabs)/library/concept/${conceptId}?action=link` as any)
      }
      onEditConcept={(conceptId) =>
        router.push(`/(tabs)/library/concept/${conceptId}?action=edit` as any)
      }
    />
  );
}

function buildObservationForConcept({
  anchor,
  onDismiss,
  onPromote,
  onAddEvidence,
}: {
  anchor: ObservationAnchor;
  onDismiss: () => void;
  onPromote: () => void;
  onAddEvidence: () => void;
}): LibrarianObservation {
  const stateClause = humanState(anchor.state);
  const evidenceClause =
    anchor.evidenceCount === 0
      ? 'No steps have tested it yet.'
      : `${anchor.evidenceCount} step${anchor.evidenceCount === 1 ? '' : 's'} tested it so far.`;
  return {
    id: `concept:${anchor.id}`,
    // No quotes here — renderWithEmphasis wraps the emphasised title in
    // curly quotes. Adding straight quotes too double-quoted it (the
    // butted "/" pair rendered as a ™-looking glyph).
    body: `${anchor.title} is ${stateClause}. ${evidenceClause} Attach another step that exercises or contradicts it to move it along.`,
    emphasise: [anchor.title],
    concept: {
      id: anchor.id,
      title: anchor.title,
      state: anchor.state,
    },
    evidence: {
      label:
        anchor.evidenceCount === 0
          ? 'No evidence yet'
          : `${anchor.evidenceCount} evidence step${anchor.evidenceCount === 1 ? '' : 's'}`,
      date: '',
    },
    primaryAction: {
      label: 'Promote to forming-with-tension',
      onPress: onPromote,
    },
    secondaryAction: {
      label: 'Add evidence',
      onPress: onAddEvidence,
    },
    onDismiss,
  };
}

function humanState(state: ObservationAnchor['state']): string {
  switch (state) {
    case 'forming':
      return 'still forming';
    case 'forming-with-tension':
      return 'forming with tension';
    case 'testing':
      return 'under test';
    case 'settled':
      return 'settled';
  }
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
