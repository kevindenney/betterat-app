/**
 * ConceptList — grid of concept cards for the current interest + playbook.
 * Shows personal + inherited baselines together. Tapping "New concept" opens
 * ConceptEditor in create mode.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { useInterest } from '@/providers/InterestProvider';
import {
  usePlaybook,
  usePlaybookConcepts,
} from '@/hooks/usePlaybook';
import { ConceptCard } from './ConceptCard';
import { ConceptEditor } from './ConceptEditor';
import { getConceptById } from '@/services/PlaybookService';
import type { ConceptOrigin } from '@/types/playbook';

const FILTERS: { key: 'all' | ConceptOrigin; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'personal', label: 'Personal' },
  { key: 'forked', label: 'Forked' },
  { key: 'platform_baseline', label: 'Platform' },
  { key: 'pathway_baseline', label: 'Pathway' },
];

export function ConceptList() {
  const { currentInterest } = useInterest();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const interestId = currentInterest?.id;
  const { data: playbook } = usePlaybook(interestId);
  const { data: concepts = [], isLoading } = usePlaybookConcepts(playbook?.id, interestId);
  const [filter, setFilter] = useState<'all' | ConceptOrigin>('all');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [updateMap, setUpdateMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Cheap client-side check for upstream updates — resolves per forked row.
    let cancelled = false;
    const compute = async () => {
      const next: Record<string, boolean> = {};
      for (const c of concepts) {
        if (c.origin !== 'forked' || !c.source_concept_id) continue;
        try {
          const src = await getConceptById(c.source_concept_id);
          if (!src) continue;
          next[c.id] = new Date(src.updated_at) > new Date(c.updated_at);
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setUpdateMap(next);
    };
    compute();
    return () => {
      cancelled = true;
    };
  }, [concepts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return concepts.filter((c) => {
      if (filter !== 'all' && c.origin !== filter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.body_md.toLowerCase().includes(q)
      );
    });
  }, [concepts, filter, search]);

  const columns = width >= 1100 ? 3 : width >= 720 ? 2 : 1;
  const cardWidth = `${100 / columns}%` as const;

  if (!currentInterest || !playbook) {
    return (
      <View style={styles.fullMessage}>
        <Text style={styles.messageText}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { paddingTop: toolbarHeight + IOS_SPACING.md },
        ]}
      >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/(tabs)/library' as any)}
          hitSlop={8}
          style={styles.backLink}
        >
          <Ionicons name="chevron-back" size={16} color={IOS_COLORS.systemBlue} />
          <Text style={styles.backText}>Playbook</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => setEditorOpen(true)}
          style={styles.newButton}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.newText}>New concept</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search concepts"
        placeholderTextColor={IOS_COLORS.tertiaryLabel}
        style={styles.search}
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <Text style={styles.messageText}>Loading concepts…</Text>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bulb-outline" size={32} color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.emptyTitle}>No concepts yet</Text>
          <Text style={styles.emptyText}>
            Tap "New concept" to write your first personal entry, or subscribe
            to a pathway to inherit a baseline set.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {filtered.map((concept) => (
            <View
              key={concept.id}
              style={[styles.cardSlot, { width: cardWidth }]}
            >
              <ConceptCard concept={concept} hasUpdate={updateMap[concept.id]} />
            </View>
          ))}
        </View>
      )}

      {editorOpen ? (
        <ConceptEditor
          mode="create"
          playbookId={playbook.id}
          interestId={currentInterest.id}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}
      </ScrollView>
      <TabScreenToolbar
        title="Concepts"
        subtitle={currentInterest.name}
        topInset={insets.top}
        onMeasuredHeight={setToolbarHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  newText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  search: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 10,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    fontSize: 14,
    color: IOS_COLORS.label,
    ...Platform.select({
      web: { outlineWidth: 0 } as Record<string, unknown>,
      default: {},
    }),
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.sm,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.xs,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  chipActive: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  chipTextActive: {
    color: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -IOS_SPACING.xs,
  },
  cardSlot: {
    padding: IOS_SPACING.xs,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: IOS_SPACING.xl,
    gap: IOS_SPACING.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_COLORS.label,
  },
  emptyText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    maxWidth: 360,
  },
  fullMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: IOS_SPACING.xl,
  },
  messageText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
});
