/**
 * LibraryManager — full library view with grouping by type or creator.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useLibrary, useLibraryResources, useAddResource, useDeleteResource } from '@/hooks/useLibrary';
import { LibraryResourceCard } from './LibraryResourceCard';
import { AddResourceSheet } from './AddResourceSheet';
import { EditResourceSheet } from './EditResourceSheet';
import { CourseToTimelineSheet } from './CourseToTimelineSheet';
import { getResourceTypeLabel } from './ResourceTypeIcon';
import { showConfirm, showAlert } from '@/lib/utils/crossPlatformAlert';
import { ManifestoEditor } from '@/components/interest/ManifestoEditor';
import { AIInsightsCard } from '@/components/interest/AIInsightsCard';
import { LibrarianSavedToast } from '@/components/library/librarian/LibrarianSavedToast';
import type { LibraryResourceRecord, ResourceType, CreateLibraryResourceInput } from '@/types/library';

type GroupMode = 'type' | 'creator';

export function LibraryManager() {
  const { currentInterest } = useInterest();
  const { user } = useAuth();
  const interestId = currentInterest?.id;
  const { data: library, isLoading: libraryLoading } = useLibrary(interestId);
  const { data: resources, isLoading: resourcesLoading } = useLibraryResources(library?.id);
  const addResource = useAddResource();
  const deleteResource = useDeleteResource();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingResource, setEditingResource] = useState<LibraryResourceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('type');
  const [courseForTimeline, setCourseForTimeline] = useState<LibraryResourceRecord | null>(null);
  const [savedToastVisible, setSavedToastVisible] = useState(false);

  const isLoading = libraryLoading || resourcesLoading;

  // Filter resources by search query
  const filteredResources = useMemo(() => {
    if (!resources) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      (r.author_or_creator ?? '').toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q)
    );
  }, [resources, searchQuery]);

  // Group resources by type
  const groupedByType = useMemo(() => {
    if (!filteredResources.length) return [];
    const groups = new Map<ResourceType, LibraryResourceRecord[]>();
    for (const r of filteredResources) {
      const existing = groups.get(r.resource_type) ?? [];
      existing.push(r);
      groups.set(r.resource_type, existing);
    }
    return Array.from(groups.entries()).map(([type, items]) => ({
      key: type,
      label: getResourceTypeLabel(type),
      items,
    }));
  }, [filteredResources]);

  // Group resources by creator
  const groupedByCreator = useMemo(() => {
    if (!filteredResources.length) return [];
    const groups = new Map<string, LibraryResourceRecord[]>();
    for (const r of filteredResources) {
      const creator = r.author_or_creator || 'Unknown';
      const existing = groups.get(creator) ?? [];
      existing.push(r);
      groups.set(creator, existing);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([creator, items]) => ({
        key: creator,
        label: creator,
        items,
        count: items.length,
      }));
  }, [filteredResources]);

  const grouped = groupMode === 'type' ? groupedByType : groupedByCreator;

  const handleAddResource = useCallback((input: CreateLibraryResourceInput) => {
    addResource.mutate(input, {
      onSuccess: () => {
        setShowAddSheet(false);
        setSavedToastVisible(true);
      },
    });
  }, [addResource]);

  const handleDeleteResource = useCallback((resourceId: string, title: string) => {
    showConfirm(
      'Delete Resource',
      `Remove "${title}" from your library?`,
      () => {
        if (library?.id) {
          deleteResource.mutate({ resourceId, libraryId: library.id });
        }
      },
      { destructive: true },
    );
  }, [deleteResource, library?.id]);

  const handleCourseTimelineSuccess = useCallback((stepCount: number) => {
    showAlert('Added to Timeline', `Created ${stepCount} lesson step${stepCount !== 1 ? 's' : ''} in your timeline.`);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Manifesto — My Vision section */}
        {interestId && currentInterest?.name && (
          <ManifestoEditor
            interestId={interestId}
            interestName={currentInterest.name}
          />
        )}

        {/* AI Insights */}
        {interestId && (
          <AIInsightsCard interestId={interestId} />
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>My Library</Text>
            <Text style={styles.subtitle}>
              {resources?.length ?? 0} resource{(resources?.length ?? 0) !== 1 ? 's' : ''}
            </Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => setShowAddSheet(true)}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Search */}
        {resources && resources.length > 0 && (
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={IOS_COLORS.secondaryLabel} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search resources..."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={IOS_COLORS.systemGray3} />
              </Pressable>
            )}
          </View>
        )}

        {/* Group mode toggle */}
        {resources && resources.length > 0 && (
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleButton, groupMode === 'type' && styles.toggleButtonActive]}
              onPress={() => setGroupMode('type')}
            >
              <Text style={[styles.toggleText, groupMode === 'type' && styles.toggleTextActive]}>
                By Type
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleButton, groupMode === 'creator' && styles.toggleButtonActive]}
              onPress={() => setGroupMode('creator')}
            >
              <Text style={[styles.toggleText, groupMode === 'creator' && styles.toggleTextActive]}>
                By Creator
              </Text>
            </Pressable>
          </View>
        )}

        {/* Empty state */}
        {(!resources || resources.length === 0) && (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={56} color={IOS_COLORS.systemGray3} />
            <Text style={styles.emptyTitle}>Build Your Library</Text>
            <Text style={styles.emptySubtitle}>
              Add YouTube videos, courses, PDFs, notes, and other resources you use for learning.
            </Text>
            <Pressable
              style={styles.emptyAddButton}
              onPress={() => setShowAddSheet(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyAddText}>Add First Resource</Text>
            </Pressable>
          </View>
        )}

        {/* Grouped resources */}
        {grouped.map(({ key, label, items }) => (
          <View key={key} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupLabel}>{label}</Text>
              {'count' in items && groupMode === 'creator' && (
                <Text style={styles.groupCount}>
                  {(items as LibraryResourceRecord[]).length}
                </Text>
              )}
            </View>
            <View style={styles.groupItems}>
              {items.map((resource: LibraryResourceRecord) => (
                <LibraryResourceCard
                  key={resource.id}
                  resource={resource}
                  onEdit={() => setEditingResource(resource)}
                  onDelete={() => handleDeleteResource(resource.id, resource.title)}
                  onAddToTimeline={
                    resource.resource_type === 'online_course'
                      ? () => setCourseForTimeline(resource)
                      : undefined
                  }
                />
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add resource sheet */}
      {library && (
        <AddResourceSheet
          visible={showAddSheet}
          libraryId={library.id}
          interestName={currentInterest?.name}
          onSubmit={handleAddResource}
          onClose={() => setShowAddSheet(false)}
        />
      )}

      {/* Edit resource sheet */}
      {library && (
        <EditResourceSheet
          visible={editingResource !== null}
          resource={editingResource}
          libraryId={library.id}
          onClose={() => setEditingResource(null)}
        />
      )}

      {/* Course to timeline sheet */}
      {courseForTimeline && user?.id && interestId && (
        <CourseToTimelineSheet
          visible={true}
          resource={courseForTimeline}
          userId={user.id}
          interestId={interestId}
          onClose={() => setCourseForTimeline(null)}
          onSuccess={handleCourseTimelineSuccess}
        />
      )}

      <LibrarianSavedToast
        visible={savedToastVisible}
        interestName={currentInterest?.name}
        onHide={() => setSavedToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IOS_SPACING.md,
  },
  headerInfo: {
    gap: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  subtitle: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 8,
    marginBottom: IOS_SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
    padding: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    padding: 2,
    marginBottom: IOS_SPACING.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  toggleTextActive: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: IOS_SPACING.xl * 2,
    gap: IOS_SPACING.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  emptySubtitle: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.systemBlue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: IOS_SPACING.sm,
  },
  emptyAddText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  group: {
    marginBottom: IOS_SPACING.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IOS_SPACING.sm,
    paddingHorizontal: 4,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  groupCount: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
  },
  groupItems: {
    gap: IOS_SPACING.xs,
  },
});
