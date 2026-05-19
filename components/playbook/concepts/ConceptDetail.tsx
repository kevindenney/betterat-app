/**
 * ConceptDetail — read view for a single concept with Edit (personal/forked),
 * Fork (inherited baselines), and Pull-latest (forked rows with upstream drift).
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
  usePlaybook,
  usePlaybookConceptBySlug,
  useForkConcept,
  usePullLatestConcept,
  useDeletePlaybookConcept,
} from '@/hooks/usePlaybook';
import { getConceptById, updateConcept } from '@/services/PlaybookService';
import { createStep } from '@/services/TimelineStepService';
import { ConceptEditor } from './ConceptEditor';
import { PlaybookAIService } from '@/services/ai/PlaybookAIService';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import type { PlaybookConceptRecord, ConceptOrigin } from '@/types/playbook';

interface ConceptDetailProps {
  slug: string;
}

const ORIGIN_LABEL: Record<ConceptOrigin, string> = {
  platform_baseline: 'Platform baseline',
  pathway_baseline: 'Pathway baseline',
  personal: 'Personal',
  forked: 'Forked from baseline',
};

export function ConceptDetail({ slug }: ConceptDetailProps) {
  const { currentInterest } = useInterest();
  const interestId = currentInterest?.id;
  const { user } = useAuth();
  const { data: playbook } = usePlaybook(interestId);
  const {
    data: concept,
    isLoading,
  } = usePlaybookConceptBySlug(playbook?.id, interestId, slug);

  const [editing, setEditing] = useState(false);
  const [upstream, setUpstream] = useState<PlaybookConceptRecord | null>(null);

  const forkMutation = useForkConcept();
  const pullMutation = usePullLatestConcept();
  const deleteMutation = useDeletePlaybookConcept();

  // Ask about this concept — multi-question history with sources
  interface QAEntry {
    question: string;
    answer: string;
    sources: { type: string; id: string; label: string; url?: string }[];
  }
  const [askQuestion, setAskQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<QAEntry[]>([]);
  const [asking, setAsking] = useState(false);

  // Related concepts (backlinks)
  const [relatedConcepts, setRelatedConcepts] = useState<
    { id: string; title: string; slug: string }[]
  >([]);

  const handleAsk = async () => {
    const q = askQuestion.trim();
    if (!q || !playbook?.id) return;
    setAsking(true);
    setAskQuestion('');
    try {
      const contextualQ = `About my "${concept!.title}" concept: ${q}`;
      const result = await PlaybookAIService.ask(playbook.id, contextualQ);
      setQaHistory((prev) => [
        ...prev,
        {
          question: q,
          answer: result.answer_md,
          sources: Array.isArray(result.sources) ? result.sources : [],
        },
      ]);
    } catch {
      setQaHistory((prev) => [
        ...prev,
        { question: q, answer: 'Sorry, could not get an answer. Try again.', sources: [] },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const handleDeepDive = async () => {
    if (!concept) return;
    const parts: string[] = [
      `I'm studying the following concept and want to understand it more deeply. Please help me explore it, explain key nuances, and suggest how I might apply this in practice.`,
      `\n**${concept.title}**\n\n${concept.body_md || '(No notes yet)'}`,
    ];
    if (qaHistory.length > 0) {
      parts.push(`\nHere's what I've explored so far:`);
      for (const entry of qaHistory) {
        parts.push(`\n**Q:** ${entry.question}\n**A:** ${entry.answer}`);
      }
      parts.push(`\nPlease continue from where this conversation left off and go deeper.`);
    }
    const prompt = parts.join('\n');
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard?.writeText(prompt);
        showAlert(
          'Copied!',
          qaHistory.length > 0
            ? 'Concept + conversation copied to clipboard. Paste into ChatGPT or Claude to continue.'
            : 'Concept copied to clipboard. Paste into ChatGPT or Claude to dive deeper.',
        );
      } catch {
        showAlert('Copy failed', 'Could not access clipboard.');
      }
    } else {
      await Share.share({ message: prompt });
    }
  };

  const [updatingConcept, setUpdatingConcept] = useState(false);
  const [creatingStep, setCreatingStep] = useState(false);

  /** Merge Q&A conversation insights into the concept body */
  const handleUpdateConceptFromQA = async () => {
    if (!concept || !playbook || !user?.id || qaHistory.length === 0) return;
    setUpdatingConcept(true);
    try {
      // Build a prompt for Gemini to merge conversation insights into the concept
      const conversationSummary = qaHistory
        .map((e) => `Q: ${e.question}\nA: ${e.answer}`)
        .join('\n\n');
      const result = await PlaybookAIService.ask(
        playbook.id,
        `Rewrite and enrich the following concept by merging in the insights from the conversation below. Preserve ALL existing content and ADD the new knowledge learned from the Q&A. Return ONLY the updated markdown body — no JSON wrapper, no explanation.\n\nCONCEPT: ${concept.title}\nCURRENT BODY:\n${concept.body_md || '(empty)'}\n\nCONVERSATION INSIGHTS:\n${conversationSummary}\n\nReturn the merged markdown body:`,
      );
      // The answer_md IS the merged body
      const mergedBody = result.answer_md;
      if (mergedBody && mergedBody.length > 10) {
        await updateConcept(user.id, concept.id, { body_md: mergedBody });
        showAlert('Concept updated', 'Your conversation insights have been merged into the concept.');
      } else {
        showAlert('No update', 'Could not generate a meaningful update.');
      }
    } catch (err) {
      showAlert('Update failed', (err as Error).message);
    } finally {
      setUpdatingConcept(false);
    }
  };

  /** Create a timeline step from the Q&A conversation */
  const handleCreateStepFromQA = async () => {
    if (!concept || !user?.id || !interestId || qaHistory.length === 0) return;
    setCreatingStep(true);
    try {
      // Derive a step title and description from the conversation
      const lastQ = qaHistory[qaHistory.length - 1];
      const allAnswers = qaHistory.map((e) => e.answer).join('\n\n');
      const stepTitle = `${concept.title}: ${lastQ.question.slice(0, 60)}`;
      const stepDescription = `Based on exploring the "${concept.title}" concept:\n\n${allAnswers.slice(0, 2000)}`;

      const step = await createStep({
        user_id: user.id,
        interest_id: interestId,
        title: stepTitle.slice(0, 100),
        description: stepDescription,
        category: 'general',
        source_type: 'manual',
        status: 'pending',
        metadata: {
          plan: {
            what_will_you_do: stepDescription.slice(0, 500),
          },
          source_concept_id: concept.id,
          source_concept_title: concept.title,
        },
      });
      showAlert('Step created', 'Added to your timeline.');
      router.push(`/(tabs)/practice?selected=${step.id}` as any);
    } catch (err) {
      showAlert('Step creation failed', (err as Error).message);
    } finally {
      setCreatingStep(false);
    }
  };

  /** Create a timeline step directly from this concept (no Q&A needed) */
  const handleCreateStepFromConcept = async () => {
    if (!concept || !user?.id || !interestId) return;
    setCreatingStep(true);
    try {
      const bodyPreview = (concept.body_md || '').slice(0, 500);
      const step = await createStep({
        user_id: user.id,
        interest_id: interestId,
        title: `Practice: ${concept.title}`.slice(0, 100),
        description: bodyPreview,
        category: 'reading_study',
        source_type: 'manual',
        status: 'pending',
        metadata: {
          plan: {
            what_will_you_do: bodyPreview,
          },
          source_concept_id: concept.id,
          source_concept_title: concept.title,
        },
      });
      showAlert('Step created', 'Added to your timeline.');
      router.push(`/(tabs)/practice?selected=${step.id}` as any);
    } catch (err) {
      showAlert('Step creation failed', (err as Error).message);
    } finally {
      setCreatingStep(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (concept?.source_concept_id) {
      getConceptById(concept.source_concept_id)
        .then((src) => {
          if (!cancelled) setUpstream(src);
        })
        .catch(() => undefined);
    } else {
      setUpstream(null);
    }
    return () => {
      cancelled = true;
    };
  }, [concept?.source_concept_id]);

  // Resolve related_concept_ids to titles for display
  useEffect(() => {
    let cancelled = false;
    const ids = concept?.related_concept_ids ?? [];
    if (ids.length === 0) {
      setRelatedConcepts([]);
      return;
    }
    Promise.all(ids.map((id) => getConceptById(id)))
      .then((results) => {
        if (cancelled) return;
        setRelatedConcepts(
          results
            .filter((r): r is PlaybookConceptRecord => r !== null)
            .map((r) => ({ id: r.id, title: r.title, slug: r.slug })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [concept?.related_concept_ids]);

  if (isLoading) {
    return (
      <View style={styles.full}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!concept || !playbook) {
    return (
      <View style={styles.full}>
        <Ionicons name="search-outline" size={36} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.title}>Concept not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isBaseline =
    concept.origin === 'platform_baseline' || concept.origin === 'pathway_baseline';
  const canEdit = !isBaseline;
  const canFork = isBaseline;
  const canDelete = concept.origin === 'personal' || concept.origin === 'forked';
  const hasUpstreamUpdate =
    concept.origin === 'forked' &&
    upstream !== null &&
    new Date(upstream.updated_at) > new Date(concept.updated_at);

  const handleFork = async () => {
    try {
      const forked = await forkMutation.mutateAsync({
        playbookId: playbook.id,
        sourceConceptId: concept.id,
      });
      showAlert('Forked', 'You can now edit your personal copy.');
      router.replace(`/library/concepts/${forked.slug}` as any);
    } catch (err) {
      showAlert('Fork failed', (err as Error).message);
    }
  };

  const handlePullLatest = () => {
    showConfirm(
      'Pull latest?',
      'This overwrites the body of your forked concept with the upstream version. Your title stays yours. Continue?',
      async () => {
        try {
          await pullMutation.mutateAsync({
            conceptId: concept.id,
            playbookId: playbook.id,
          });
        } catch (err) {
          showAlert('Pull failed', (err as Error).message);
        }
      },
    );
  };

  const handleDelete = () => {
    showConfirm(
      'Delete concept?',
      'This removes the concept from your Playbook. Forked concepts can be re-forked from the baseline later.',
      async () => {
        try {
          await deleteMutation.mutateAsync({
            conceptId: concept.id,
            playbookId: playbook.id,
          });
          router.back();
        } catch (err) {
          showAlert('Delete failed', (err as Error).message);
        }
      },
      { destructive: true },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={16} color={IOS_COLORS.systemBlue} />
        <Text style={styles.backLinkText}>Concepts</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.origin}>{ORIGIN_LABEL[concept.origin]}</Text>
          <Text style={styles.title}>{concept.title}</Text>
        </View>
      </View>

      {hasUpstreamUpdate ? (
        <View style={styles.updateBanner}>
          <Ionicons name="cloud-download-outline" size={16} color={IOS_COLORS.systemOrange} />
          <Text style={styles.updateBannerText}>
            Upstream baseline has new content since your fork.
          </Text>
          <Pressable onPress={handlePullLatest} style={styles.bannerAction}>
            <Text style={styles.bannerActionText}>Pull latest</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        {canEdit ? (
          <Pressable
            onPress={() => setEditing(true)}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="create-outline" size={16} color={IOS_COLORS.systemBlue} />
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
        ) : null}
        {canFork ? (
          <Pressable
            onPress={handleFork}
            disabled={forkMutation.isPending}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="git-branch-outline" size={16} color={IOS_COLORS.systemBlue} />
            <Text style={styles.actionText}>
              {forkMutation.isPending ? 'Forking…' : 'Fork'}
            </Text>
          </Pressable>
        ) : null}
        {canDelete ? (
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={16} color={IOS_COLORS.systemRed} />
            <Text style={[styles.actionText, { color: IOS_COLORS.systemRed }]}>
              Delete
            </Text>
          </Pressable>
        ) : null}
        {concept.body_md ? (
          <Pressable
            onPress={handleDeepDive}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="open-outline" size={16} color={IOS_COLORS.systemIndigo} />
            <Text style={[styles.actionText, { color: IOS_COLORS.systemIndigo }]}>
              Deep dive
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleCreateStepFromConcept}
          disabled={creatingStep}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name="add-circle-outline" size={16} color={IOS_COLORS.systemGreen} />
          <Text style={[styles.actionText, { color: IOS_COLORS.systemGreen }]}>
            {creatingStep ? 'Creating…' : 'Create step'}
          </Text>
        </Pressable>
      </View>

      {concept.body_md ? (
        <View style={styles.bodyCard}>
          <Text style={styles.body}>{concept.body_md}</Text>
        </View>
      ) : (
        <Text style={styles.empty}>No body yet.</Text>
      )}

      {/* Related concepts (backlinks) */}
      {relatedConcepts.length > 0 ? (
        <View style={styles.relatedSection}>
          <View style={styles.relatedHeader}>
            <Ionicons name="git-network-outline" size={14} color={IOS_COLORS.systemTeal} />
            <Text style={styles.relatedTitle}>Related concepts</Text>
          </View>
          <View style={styles.relatedChips}>
            {relatedConcepts.map((rc) => (
              <Pressable
                key={rc.id}
                onPress={() => router.push(`/library/concepts/${rc.slug}` as any)}
                style={({ pressed }) => [styles.relatedChip, pressed && styles.pressed]}
              >
                <Ionicons name="bulb-outline" size={12} color={IOS_COLORS.systemTeal} />
                <Text style={styles.relatedChipText} numberOfLines={1}>
                  {rc.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.meta}>
        Updated {new Date(concept.updated_at).toLocaleString()}
      </Text>

      {/* Ask about this concept */}
      <View style={styles.askSection}>
        <View style={styles.askHeader}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={IOS_COLORS.systemIndigo} />
          <Text style={styles.askTitle}>Ask about this concept</Text>
        </View>
        <View style={styles.askInputRow}>
          <TextInput
            value={askQuestion}
            onChangeText={setAskQuestion}
            placeholder={`e.g. "Why does this matter?" or "How do I apply this?"`}
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            style={[styles.askInput, asking && { opacity: 0.5 }]}
            editable={!asking}
            onSubmitEditing={handleAsk}
          />
          <Pressable
            onPress={handleAsk}
            disabled={asking || !askQuestion.trim()}
            style={({ pressed }) => [
              styles.askBtn,
              (asking || !askQuestion.trim()) && styles.askBtnDisabled,
              pressed && styles.askBtnPressed,
            ]}
          >
            {asking ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
        {qaHistory.map((entry, i) => (
          <View key={i} style={styles.qaEntry}>
            <Text style={styles.questionText}>{entry.question}</Text>
            <View style={styles.answerCard}>
              <Text style={styles.answerText}>{entry.answer}</Text>
              {entry.sources.length > 0 ? (
                <View style={styles.sourcesRow}>
                  {entry.sources.map((src, j) => (
                    <View key={j} style={styles.sourceChip}>
                      <Ionicons
                        name={
                          src.type === 'concept' ? 'bulb-outline' :
                          src.type === 'resource' ? 'document-outline' :
                          'calendar-outline'
                        }
                        size={12}
                        color={IOS_COLORS.systemIndigo}
                      />
                      <Text style={styles.sourceChipText} numberOfLines={1}>
                        {src.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))}
        {asking ? (
          <View style={styles.answerCard}>
            <ActivityIndicator size="small" color={IOS_COLORS.systemIndigo} />
          </View>
        ) : null}
        {/* Action buttons after conversation */}
        {qaHistory.length > 0 && !asking ? (
          <View style={styles.qaActionsRow}>
            <Pressable
              onPress={handleUpdateConceptFromQA}
              disabled={updatingConcept}
              style={({ pressed }) => [styles.qaAction, styles.qaActionUpdate, pressed && styles.pressed]}
            >
              {updatingConcept ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={14} color="#fff" />
                  <Text style={styles.qaActionText}>Update concept</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={handleCreateStepFromQA}
              disabled={creatingStep}
              style={({ pressed }) => [styles.qaAction, styles.qaActionStep, pressed && styles.pressed]}
            >
              {creatingStep ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={14} color="#fff" />
                  <Text style={styles.qaActionText}>Create step</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>

      {editing ? (
        <ConceptEditor
          mode="edit"
          concept={concept}
          playbookId={playbook.id}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  content: {
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  full: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: IOS_SPACING.xl,
    gap: IOS_SPACING.md,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  origin: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: IOS_COLORS.systemIndigo,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  pressed: {
    opacity: 0.6,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    padding: IOS_SPACING.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
  },
  updateBannerText: {
    flex: 1,
    fontSize: 12,
    color: IOS_COLORS.label,
  },
  bannerAction: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.systemOrange,
  },
  bannerActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  bodyCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: IOS_COLORS.label,
  },
  empty: {
    fontSize: 13,
    fontStyle: 'italic',
    color: IOS_COLORS.tertiaryLabel,
  },
  meta: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  askSection: {
    gap: IOS_SPACING.sm,
    marginTop: IOS_SPACING.md,
  },
  askHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  askTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.systemIndigo,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  askInputRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
    alignItems: 'center',
  },
  askInput: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 10,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    ...Platform.select({
      web: { outlineWidth: 0 } as Record<string, unknown>,
      default: {},
    }),
  },
  askBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.systemIndigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBtnDisabled: {
    opacity: 0.4,
  },
  askBtnPressed: {
    opacity: 0.8,
  },
  answerCard: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: IOS_SPACING.lg,
    borderLeftWidth: 3,
    borderLeftColor: IOS_COLORS.systemIndigo,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
  },
  qaEntry: {
    gap: IOS_SPACING.xs,
  },
  questionText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    paddingLeft: IOS_SPACING.sm,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: IOS_SPACING.sm,
    paddingTop: IOS_SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(88, 86, 214, 0.08)',
  },
  sourceChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.systemIndigo,
    maxWidth: 150,
  },
  qaActionsRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
    marginTop: IOS_SPACING.sm,
  },
  qaAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
  },
  qaActionUpdate: {
    backgroundColor: IOS_COLORS.systemIndigo,
  },
  qaActionStep: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  qaActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  relatedSection: {
    gap: IOS_SPACING.sm,
  },
  relatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  relatedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.systemTeal,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  relatedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  relatedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(90, 200, 250, 0.1)',
  },
  relatedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemTeal,
    maxWidth: 180,
  },
  backButton: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  backText: {
    color: '#fff',
    fontWeight: '700',
  },
});
