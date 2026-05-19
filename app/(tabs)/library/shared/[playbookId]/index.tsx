/**
 * Shared Playbook (read-only) — coach / teammate view.
 *
 * Renders a stripped version of PlaybookHome: vision, concepts, resources,
 * patterns, reviews, and Q&A. Everything else (suggestion queue, raw inbox,
 * quick capture, edit buttons) is hidden. RLS enforces access via the
 * `playbook_shares` shared-read policies added in Phase 1.
 *
 * Viewers can copy concepts and resources into their own Playbook.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { acceptShare } from '@/services/PlaybookService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  usePlaybook,
  usePlaybookById,
  usePlaybookConcepts,
  usePlaybookResources,
  usePlaybookPatterns,
  usePlaybookReviews,
  usePlaybookQA,
  useCreatePlaybookConcept,
  useAddPlaybookResource,
} from '@/hooks/usePlaybook';

export default function SharedPlaybookScreen() {
  const { playbookId } = useLocalSearchParams<{ playbookId: string }>();
  const id = typeof playbookId === 'string' ? playbookId : undefined;
  const { user } = useAuth();
  const { currentInterest } = useInterest();

  // Auto-accept pending invite on first visit
  const acceptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!id || !user?.id || acceptedRef.current.has(id)) return;
    acceptedRef.current.add(id);
    acceptShare(user.id, id).catch(() => {});
  }, [id, user?.id]);

  const { data: playbook, isLoading, error } = usePlaybookById(id);

  // Get the viewer's own playbook for the same interest (to copy into)
  const { data: myPlaybook } = usePlaybook(
    playbook?.interest_id && currentInterest?.id === playbook.interest_id
      ? currentInterest.id
      : undefined,
  );

  const { data: concepts = [] } = usePlaybookConcepts(id, playbook?.interest_id);
  const { data: resources = [] } = usePlaybookResources(id);
  const { data: patterns = [] } = usePlaybookPatterns(id);
  const { data: reviews = [] } = usePlaybookReviews(id);
  const { data: qa = [] } = usePlaybookQA(id);

  const createConcept = useCreatePlaybookConcept();
  const addResource = useAddPlaybookResource();

  // Track which items have been copied (by source id)
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

  const handleCopyConcept = useCallback(
    async (concept: { id: string; title: string; body_md?: string | null; interest_id?: string }) => {
      if (!myPlaybook?.id || !playbook?.interest_id) {
        showAlert(
          'Switch interest first',
          'To copy this concept, switch to the same interest in your interest picker, then try again.',
        );
        return;
      }
      try {
        const slug = concept.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        await createConcept.mutateAsync({
          playbook_id: myPlaybook.id,
          origin: 'personal',
          source_concept_id: concept.id,
          interest_id: playbook.interest_id,
          slug,
          title: concept.title,
          body_md: concept.body_md ?? '',
        });
        setCopiedIds((prev) => new Set(prev).add(concept.id));
        showAlert('Copied', `"${concept.title}" added to your Playbook.`);
      } catch (err) {
        showAlert('Copy failed', err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [myPlaybook?.id, playbook?.interest_id, createConcept],
  );

  const handleCopyResource = useCallback(
    async (resource: {
      id: string;
      title: string;
      url?: string | null;
      resource_type?: string;
      description?: string | null;
      source_platform?: string | null;
      author_or_creator?: string | null;
    }) => {
      if (!myPlaybook?.id) {
        showAlert(
          'Switch interest first',
          'To copy this resource, switch to the same interest in your interest picker, then try again.',
        );
        return;
      }
      try {
        await addResource.mutateAsync({
          playbook_id: myPlaybook.id,
          title: resource.title,
          url: resource.url,
          resource_type: (resource.resource_type as any) ?? 'other',
          description: resource.description,
          source_platform: resource.source_platform,
          author_or_creator: resource.author_or_creator,
        });
        setCopiedIds((prev) => new Set(prev).add(resource.id));
        showAlert('Copied', `"${resource.title}" added to your Playbook.`);
      } catch (err) {
        showAlert('Copy failed', err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [myPlaybook?.id, addResource],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={IOS_COLORS.systemBlue} />
      </View>
    );
  }

  if (error || !playbook) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="lock-closed-outline"
          size={48}
          color={IOS_COLORS.tertiaryLabel}
        />
        <Text style={styles.emptyTitle}>Not available</Text>
        <Text style={styles.emptyText}>
          This Playbook is no longer shared with you, or you're not signed in
          with the invited account.
        </Text>
      </View>
    );
  }

  const canCopy = Boolean(myPlaybook?.id);
  const sameInterest = currentInterest?.id === playbook.interest_id;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/library')}
        >
          <Ionicons name="chevron-back" size={20} color={IOS_COLORS.systemBlue} />
          <Text style={styles.backText}>Playbook</Text>
        </Pressable>
        <View style={styles.readOnlyBadge}>
          <Ionicons
            name="eye-outline"
            size={12}
            color={IOS_COLORS.systemBlue}
          />
          <Text style={styles.readOnlyText}>Read-only</Text>
        </View>
        <Text style={styles.eyebrow}>Shared Playbook</Text>
        <Text style={styles.heading}>{playbook.name}</Text>
      </View>

      {!sameInterest && (
        <View style={styles.interestHint}>
          <Ionicons name="information-circle-outline" size={16} color={IOS_COLORS.systemOrange} />
          <Text style={styles.interestHintText}>
            Switch to the same interest to copy items into your Playbook.
          </Text>
        </View>
      )}

      {playbook.vision_md ? (
        <Section title="Vision">
          <Text style={styles.body}>{playbook.vision_md}</Text>
        </Section>
      ) : null}

      <Section title="Concepts" count={concepts.length}>
        {concepts.length === 0 ? (
          <EmptyLine>No concepts yet.</EmptyLine>
        ) : (
          concepts.map((c) => (
            <ConceptRow
              key={c.id}
              concept={c}
              canCopy={canCopy}
              copied={copiedIds.has(c.id)}
              onCopy={() => handleCopyConcept(c)}
            />
          ))
        )}
      </Section>

      <Section title="Resources" count={resources.length}>
        {resources.length === 0 ? (
          <EmptyLine>No resources yet.</EmptyLine>
        ) : (
          resources.map((r) => (
            <ResourceRow
              key={r.id}
              resource={r}
              canCopy={canCopy}
              copied={copiedIds.has(r.id)}
              onCopy={() => handleCopyResource(r)}
            />
          ))
        )}
      </Section>

      <Section title="Patterns" count={patterns.length}>
        {patterns.length === 0 ? (
          <EmptyLine>No patterns yet.</EmptyLine>
        ) : (
          patterns.map((p) => (
            <View key={p.id} style={styles.card}>
              <Text style={styles.cardTitle}>{p.title}</Text>
              {p.body_md ? (
                <Text style={styles.cardBody}>{p.body_md}</Text>
              ) : null}
            </View>
          ))
        )}
      </Section>

      <Section title="Reviews" count={reviews.length}>
        {reviews.length === 0 ? (
          <EmptyLine>No reviews yet.</EmptyLine>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.cardMeta}>
                {new Date(r.period_start).toLocaleDateString()} –{' '}
                {new Date(r.period_end).toLocaleDateString()}
              </Text>
              <Text style={styles.cardBody}>{r.summary_md}</Text>
              {r.focus_suggestion_md ? (
                <Text style={styles.focusText}>
                  Focus: {r.focus_suggestion_md}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </Section>

      <Section title="Saved Q&A" count={qa.length}>
        {qa.length === 0 ? (
          <EmptyLine>No saved Q&A yet.</EmptyLine>
        ) : (
          qa.map((q) => (
            <View key={q.id} style={styles.card}>
              <Text style={styles.cardTitle}>{q.question}</Text>
              <Text style={styles.cardBody}>{q.answer_md}</Text>
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConceptRow({
  concept,
  canCopy,
  copied,
  onCopy,
}: {
  concept: { id: string; title: string; origin: string; body_md?: string | null };
  canCopy: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
      onPress={() => setExpanded((v) => !v)}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle} numberOfLines={expanded ? undefined : 1}>
          {concept.title}
        </Text>
        <Text style={styles.rowMeta}>{concept.origin}</Text>
      </View>
      {expanded && concept.body_md ? (
        <Text style={styles.cardBody}>{concept.body_md}</Text>
      ) : null}
      {expanded && canCopy && (
        <CopyButton copied={copied} onPress={onCopy} label="Copy concept" />
      )}
    </Pressable>
  );
}

function ResourceRow({
  resource,
  canCopy,
  copied,
  onCopy,
}: {
  resource: { id: string; title: string; resource_type?: string | null };
  canCopy: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {resource.title}
      </Text>
      {canCopy && (
        <CopyButton copied={copied} onPress={onCopy} label="Copy" compact />
      )}
      <Text style={styles.rowMeta}>{resource.resource_type}</Text>
    </View>
  );
}

function CopyButton({
  copied,
  onPress,
  label,
  compact,
}: {
  copied: boolean;
  onPress: () => void;
  label: string;
  compact?: boolean;
}) {
  if (copied) {
    return (
      <View style={[styles.copyBtn, styles.copyBtnDone]}>
        <Ionicons name="checkmark" size={compact ? 12 : 14} color={IOS_COLORS.systemGreen} />
        {!compact && <Text style={styles.copyBtnDoneText}>Copied</Text>}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.6 }]}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <Ionicons name="copy-outline" size={compact ? 12 : 14} color={IOS_COLORS.systemBlue} />
      {!compact && <Text style={styles.copyBtnText}>{label}</Text>}
    </Pressable>
  );
}

interface SectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
}

function Section({ title, count, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
        {typeof count === 'number' ? ` · ${count}` : ''}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <Text style={styles.emptyInline}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  content: {
    padding: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.xl,
    gap: IOS_SPACING.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: IOS_SPACING.xl,
    gap: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  emptyText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    maxWidth: 320,
  },
  header: {
    gap: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: IOS_SPACING.sm,
    marginLeft: -4,
  },
  backText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  readOnlyBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    marginBottom: IOS_SPACING.sm,
  },
  readOnlyText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: IOS_COLORS.systemBlue,
  },
  interestHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: IOS_SPACING.md,
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
    borderRadius: 10,
  },
  interestHintText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.systemOrange,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: IOS_COLORS.systemIndigo,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  section: {
    gap: IOS_SPACING.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: IOS_COLORS.secondaryLabel,
  },
  sectionBody: {
    gap: IOS_SPACING.sm,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    padding: IOS_SPACING.md,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  rowMeta: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'capitalize',
  },
  card: {
    padding: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  cardMeta: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: IOS_COLORS.systemIndigo,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
    color: IOS_COLORS.label,
  },
  focusText: {
    fontSize: 12,
    color: IOS_COLORS.systemOrange,
    fontStyle: 'italic',
  },
  emptyInline: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    paddingVertical: IOS_SPACING.sm,
  },
  copyBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  copyBtnDone: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
  },
  copyBtnDoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemGreen,
  },
});
