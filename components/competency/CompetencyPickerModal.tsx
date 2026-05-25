/**
 * CompetencyPickerModal — Searchable browser for selecting competencies
 * to link to a step. Shows competencies grouped by category with
 * current progress status badges.
 */

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { COMPETENCY_STATUS_CONFIG, type CompetencyStatus } from '@/types/competency';
import type { CompetencyWithProgress } from '@/types/competency';
import { useAuth } from '@/providers/AuthProvider';
import { getUserCompetencyProgress } from '@/services/competencyService';
import { useQuery } from '@tanstack/react-query';

interface CompetencyPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedIds: string[];
  onToggle: (competencyId: string, title: string) => void;
  interestId: string;
  /**
   * Lightweight capability suggestions shown when the interest does not
   * have a formal competency catalog, or when AI/network suggestions imply
   * useful tags that are not yet structured competencies.
   */
  suggestedCapabilities?: { id: string; label: string; source?: string }[];
  selectedSuggestedLabels?: string[];
  onToggleSuggested?: (label: string) => void;
}

export function CompetencyPickerModal({
  visible,
  onClose,
  selectedIds,
  onToggle,
  interestId,
  suggestedCapabilities = [],
  selectedSuggestedLabels = [],
  onToggleSuggested,
}: CompetencyPickerModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: competencies = [] } = useQuery({
    queryKey: ['competency-progress', user?.id, interestId],
    queryFn: () => getUserCompetencyProgress(user!.id, interestId),
    enabled: Boolean(user?.id) && visible,
  });

  // Group by category
  const categories = useMemo(() => {
    const map = new Map<string, CompetencyWithProgress[]>();
    const lowerSearch = search.toLowerCase();

    for (const c of competencies) {
      if (lowerSearch && !c.title.toLowerCase().includes(lowerSearch) && !c.category.toLowerCase().includes(lowerSearch)) {
        continue;
      }
      let list = map.get(c.category);
      if (!list) {
        list = [];
        map.set(c.category, list);
      }
      list.push(c);
    }

    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      items: items.sort((a, b) => a.sort_order - b.sort_order),
    }));
  }, [competencies, search]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedSuggestedSet = useMemo(
    () => new Set(selectedSuggestedLabels.map(normalizeLabel)),
    [selectedSuggestedLabels],
  );
  const filteredSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suggestedCapabilities.filter((sug) => {
      if (!q) return true;
      return (
        sug.label.toLowerCase().includes(q) ||
        sug.source?.toLowerCase().includes(q)
      );
    });
  }, [search, suggestedCapabilities]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.sheet}>
          {/* Drag handle */}
          <View style={s.dragHandleWrap}>
            <View style={s.dragHandle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Add Competencies</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Search */}
          <View style={s.searchWrap}>
            <Ionicons name="search" size={16} color={IOS_COLORS.secondaryLabel} style={s.searchIcon} />
            <TextInput
              style={s.searchInput}
              placeholder="Search competencies..."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={6}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>

          {/* Selected count */}
          {selectedIds.length + selectedSuggestedLabels.length > 0 && (
            <Text style={s.selectedCount}>
              {selectedIds.length + selectedSuggestedLabels.length} selected
            </Text>
          )}

          {/* Category list */}
          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {filteredSuggestions.length > 0 && (
              <View style={s.suggestedBlock}>
                <Text style={s.suggestedEye}>Suggested for this step</Text>
                {filteredSuggestions.map((sug) => {
                  const selected = selectedSuggestedSet.has(normalizeLabel(sug.label));
                  return (
                    <Pressable
                      key={sug.id}
                      style={[s.compRow, selected && s.compRowSelected]}
                      onPress={() => onToggleSuggested?.(sug.label)}
                    >
                      <Ionicons
                        name={selected ? 'checkbox' : 'sparkles-outline'}
                        size={20}
                        color={selected ? '#0097A7' : '#8B5CF6'}
                      />
                      <View style={s.compInfo}>
                        <Text style={s.compTitle} numberOfLines={1}>
                          {sug.label}
                        </Text>
                        {sug.source ? (
                          <Text style={s.compDesc} numberOfLines={1}>
                            {sug.source}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {categories.length === 0 && filteredSuggestions.length === 0 && (
              <Text style={s.emptyText}>
                {search ? 'No capabilities match your search' : 'No suggested capabilities yet'}
              </Text>
            )}

            {categories.map(({ category, items }) => {
              const isExpanded = expandedCategory === category || search.length > 0;
              const selectedInCategory = items.filter((c) => selectedSet.has(c.id)).length;

              return (
                <View key={category} style={s.categoryBlock}>
                  <Pressable
                    style={s.categoryHeader}
                    onPress={() => setExpandedCategory(isExpanded && !search ? null : category)}
                  >
                    <Ionicons
                      name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                      size={16}
                      color="#6B7280"
                    />
                    <Text style={s.categoryTitle}>{category}</Text>
                    <Text style={s.categoryCount}>
                      {selectedInCategory > 0 ? `${selectedInCategory}/` : ''}{items.length}
                    </Text>
                  </Pressable>

                  {isExpanded &&
                    items.map((comp) => {
                      const isSelected = selectedSet.has(comp.id);
                      const status: CompetencyStatus = comp.progress?.status ?? 'not_started';
                      const cfg = COMPETENCY_STATUS_CONFIG[status];

                      return (
                        <Pressable
                          key={comp.id}
                          style={[s.compRow, isSelected && s.compRowSelected]}
                          onPress={() => onToggle(comp.id, comp.title)}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isSelected ? '#0097A7' : '#D1D5DB'}
                          />
                          <View style={s.compInfo}>
                            <Text style={s.compTitle} numberOfLines={1}>
                              {comp.title}
                            </Text>
                            {comp.description && (
                              <Text style={s.compDesc} numberOfLines={1}>
                                {comp.description}
                              </Text>
                            )}
                          </View>
                          {status !== 'not_started' && (
                            <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                              <Text style={[s.statusBadgeText, { color: cfg.color }]}>
                                {cfg.label}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                </View>
              );
            })}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D1D5DB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    padding: 0,
  },
  selectedCount: {
    fontSize: 12,
    color: '#0097A7',
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    paddingTop: 40,
  },
  suggestedBlock: {
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  suggestedEye: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  categoryBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  categoryTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  categoryCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingLeft: 44,
    paddingVertical: 10,
    gap: 10,
  },
  compRowSelected: {
    backgroundColor: '#F0FDFA',
  },
  compInfo: {
    flex: 1,
  },
  compTitle: {
    fontSize: 14,
    color: '#1F2937',
  },
  compDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
