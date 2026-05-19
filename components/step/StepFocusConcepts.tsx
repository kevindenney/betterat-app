/**
 * StepFocusConcepts — displays Playbook concepts linked to this step.
 *
 * Fetched from step_playbook_links (item_type='concept'), then hydrated
 * with concept titles from playbook_concepts. Shown as compact reminder
 * cards on the Act and Review tabs.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { getStepLinks } from '@/services/PlaybookService';
import { supabase } from '@/services/supabase';
import { STEP_COLORS } from '@/lib/step-theme';
import { IOS_SPACING } from '@/lib/design-tokens-ios';

interface ConceptDisplay {
  id: string;
  title: string;
  slug?: string;
}

interface StepFocusConceptsProps {
  stepId: string;
  /** Compact mode: single line per concept (for Act tab). Expanded: shows body preview (Review tab) */
  variant?: 'compact' | 'review';
}

export function StepFocusConcepts({ stepId, variant = 'compact' }: StepFocusConceptsProps) {
  const [concepts, setConcepts] = useState<ConceptDisplay[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Get linked concepts for this step
        const links = await getStepLinks(stepId);
        const conceptLinks = links.filter((l) => l.item_type === 'concept');

        if (conceptLinks.length === 0) {
          if (!cancelled) {
            setConcepts([]);
            setLoaded(true);
          }
          return;
        }

        // Hydrate with titles from playbook_concepts
        const conceptIds = conceptLinks.map((l) => l.item_id);
        const { data } = await supabase
          .from('playbook_concepts')
          .select('id, title, slug')
          .in('id', conceptIds);

        if (!cancelled) {
          setConcepts(
            (data || []).map((c: any) => ({
              id: c.id,
              title: c.title,
              slug: c.slug,
            }))
          );
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [stepId]);

  if (!loaded || concepts.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BookOpen size={14} color={STEP_COLORS.accent} />
        <Text style={styles.headerText}>
          {variant === 'review' ? 'FOCUS CONCEPTS' : 'FOCUS'}
        </Text>
      </View>
      {concepts.map((concept) => (
        <Pressable
          key={concept.id}
          style={styles.conceptCard}
          onPress={() => {
            if (concept.slug) {
              router.push(`/(tabs)/library/concept/${concept.slug}` as any);
            }
          }}
        >
          <BookOpen size={14} color={STEP_COLORS.accent} />
          <Text style={styles.conceptTitle} numberOfLines={2}>
            {concept.title}
          </Text>
          {concept.slug && <ChevronRight size={14} color="#C7C7CC" />}
        </Pressable>
      ))}
      {variant === 'review' && (
        <Text style={styles.reviewHint}>
          Did you practice these? Reflect on what worked.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: IOS_SPACING.md,
    gap: 6,
    marginBottom: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 1,
  },
  conceptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  conceptTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
  },
  reviewHint: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#8E8E93',
    marginTop: 2,
  },
});
