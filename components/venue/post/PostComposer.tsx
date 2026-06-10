/**
 * PostComposer
 *
 * Modal for creating/editing posts. Includes post type selector,
 * topic tag picker, condition tag editor, and optional map location picker.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { TufteTokens } from '@/constants/designSystem';
import { POST_TYPE_CONFIG } from '@/types/community-feed';
import { useCreatePost, useUpdatePost } from '@/hooks/useCommunityFeed';
import { useTopicTags } from '@/hooks/useCommunityFeed';
import { useVenueRacingAreas } from '@/hooks/useVenueRacingAreas';
import { useKnowledgeAudiences } from '@/hooks/useKnowledgeAudiences';
import { useInterest } from '@/providers/InterestProvider';
import { getVisibilityLabels } from '@/lib/vocabulary';
import { CatalogRaceService } from '@/services/CatalogRaceService';
import type { PostType, KnowledgeScopeType } from '@/types/community-feed';
import type { CatalogRace } from '@/types/catalog-race';

interface PostComposerProps {
  visible: boolean;
  venueId?: string;       // Optional - for venue-linked posts
  communityId?: string;   // Optional - for community posts
  // Note: At least one of venueId, communityId, or poiId should be provided
  racingAreaId?: string | null;
  /** Atlas POI anchor (hospital, haat, golf course…) — pre-bound, replaces the venue/area pickers. */
  poiId?: string | null;
  poiName?: string | null;
  /** Scopes topic chips to the composing interest's vocab (defaults to sail-racing). */
  interestSlug?: string | null;
  catalogRaceId?: string | null;
  catalogRaceName?: string | null;
  /** Pass an existing post to enter edit mode */
  editingPost?: {
    id: string;
    title: string;
    body?: string | null;
    post_type: import('@/types/community-feed').PostType;
  } | null;
  onDismiss: () => void;
  onSuccess?: () => void;
}

const POST_TYPES: PostType[] = ['discussion', 'tip', 'question', 'report', 'safety_alert'];

export function PostComposer({
  visible,
  venueId,
  communityId,
  racingAreaId,
  poiId,
  poiName,
  interestSlug,
  catalogRaceId: initialCatalogRaceId,
  catalogRaceName: initialCatalogRaceName,
  editingPost,
  onDismiss,
  onSuccess,
}: PostComposerProps) {
  const isEditing = !!editingPost;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [postType, setPostType] = useState<PostType>('discussion');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [conditionLabel, setConditionLabel] = useState('');

  // Area + audience scoping
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(racingAreaId || null);
  const [scopeType, setScopeType] = useState<KnowledgeScopeType>('public');
  const [scopeId, setScopeId] = useState<string | null>(null);

  const { currentInterest } = useInterest();
  const visibilityLabels = getVisibilityLabels(currentInterest?.slug);
  const { areas: racingAreas } = useVenueRacingAreas(venueId);
  const { data: audiences } = useKnowledgeAudiences();

  // Race tagging
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(initialCatalogRaceId || null);
  const [selectedRaceName, setSelectedRaceName] = useState<string | null>(initialCatalogRaceName || null);
  const [showRacePicker, setShowRacePicker] = useState(false);
  const [raceSearchQuery, setRaceSearchQuery] = useState('');
  const [raceSearchResults, setRaceSearchResults] = useState<CatalogRace[]>([]);

  const { data: topicTags } = useTopicTags(interestSlug);
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();

  // Populate form when entering edit mode
  React.useEffect(() => {
    if (editingPost && visible) {
      setTitle(editingPost.title || '');
      setBody(editingPost.body || '');
      setPostType(editingPost.post_type || 'discussion');
    }
  }, [editingPost, visible]);

  const resetForm = useCallback(() => {
    setTitle('');
    setBody('');
    setPostType('discussion');
    setSelectedTagIds([]);
    setConditionLabel('');
    setSelectedAreaId(null);
    setScopeType('public');
    setScopeId(null);
    setSelectedRaceId(null);
    setSelectedRaceName(null);
    setRaceSearchQuery('');
    setRaceSearchResults([]);
  }, []);

  const handleSelectScope = useCallback((type: KnowledgeScopeType, id: string | null) => {
    setScopeType(type);
    setScopeId(id);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      showAlert('Title Required', 'Please add a title for your post.');
      return;
    }

    try {
      if (isEditing && editingPost) {
        // Update existing post
        await updatePost.mutateAsync({
          postId: editingPost.id,
          updates: {
            title: title.trim(),
            body: body.trim() || undefined,
            post_type: postType,
          },
        });
      } else {
        // Validate that we have a venue, community, or place to post to
        if (!venueId && !communityId && !poiId) {
          showAlert('Error', 'Post must be associated with a venue, community, or place.');
          return;
        }

        const conditionTags = conditionLabel.trim()
          ? [{
              label: conditionLabel.trim(),
              wind_direction_min: null,
              wind_direction_max: null,
              wind_speed_min: null,
              wind_speed_max: null,
              tide_phase: null,
              wave_height_min: null,
              wave_height_max: null,
              current_speed_min: null,
              current_speed_max: null,
              season: null,
              time_of_day: null,
            }]
          : undefined;

        await createPost.mutateAsync({
          venue_id: venueId || undefined,
          community_id: communityId || undefined,
          title: title.trim(),
          body: body.trim() || undefined,
          post_type: postType,
          poi_id: poiId || undefined,
          // Single-anchor CHECK on venue_discussions: a post anchors a
          // racing area OR a POI, never both.
          racing_area_id: poiId ? undefined : selectedAreaId || undefined,
          scope_type: scopeType,
          scope_id: scopeId || undefined,
          topic_tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
          condition_tags: conditionTags,
          catalog_race_id: selectedRaceId || undefined,
        });
      }

      resetForm();
      onSuccess?.();
      onDismiss();
    } catch (error: any) {
      console.error('[PostComposer] Error:', error);
      const errorMessage = error?.message || `Failed to ${isEditing ? 'update' : 'create'} post. Please try again.`;
      showAlert(isEditing ? 'Cannot Update Post' : 'Cannot Create Post', errorMessage);
    }
  }, [title, body, postType, venueId, communityId, poiId, selectedAreaId, scopeType, scopeId, selectedTagIds, conditionLabel, selectedRaceId, createPost, updatePost, isEditing, editingPost, resetForm, onSuccess, onDismiss]);

  const handleDismiss = useCallback(() => {
    if (title.trim() || body.trim()) {
      showConfirm(
        'Discard Post?',
        'You have unsaved changes. Are you sure you want to discard?',
        () => { resetForm(); onDismiss(); },
        { destructive: true, confirmText: 'Discard', cancelText: 'Keep Editing' }
      );
    } else {
      onDismiss();
    }
  }, [title, body, resetForm, onDismiss]);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const handleRaceSearch = useCallback(async (query: string) => {
    setRaceSearchQuery(query);
    if (query.trim().length < 2) {
      setRaceSearchResults([]);
      return;
    }
    try {
      const results = await CatalogRaceService.searchRaces(query.trim());
      setRaceSearchResults(results);
    } catch {
      setRaceSearchResults([]);
    }
  }, []);

  const handleSelectRace = useCallback((race: CatalogRace) => {
    setSelectedRaceId(race.id);
    setSelectedRaceName(race.short_name || race.name);
    setShowRacePicker(false);
    setRaceSearchQuery('');
    setRaceSearchResults([]);
  }, []);

  const handleClearRace = useCallback(() => {
    setSelectedRaceId(null);
    setSelectedRaceName(null);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleDismiss}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Post' : 'New Post'}</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!title.trim() || createPost.isPending || updatePost.isPending}
            style={[styles.submitButton, !title.trim() && styles.submitButtonDisabled]}
          >
            {(createPost.isPending || updatePost.isPending) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>{isEditing ? 'Save' : 'Post'}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Post Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Post Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeRow}
            >
              {POST_TYPES.map(type => {
                const config = POST_TYPE_CONFIG[type];
                const isSelected = postType === type;
                return (
                  <Pressable
                    key={type}
                    style={[
                      styles.typeOption,
                      isSelected && { backgroundColor: config.bgColor, borderColor: config.color },
                    ]}
                    onPress={() => setPostType(type)}
                  >
                    <Ionicons
                      name={config.icon as any}
                      size={16}
                      color={isSelected ? config.color : '#9CA3AF'}
                    />
                    <Text style={[
                      styles.typeOptionText,
                      isSelected && { color: config.color, fontWeight: '600' },
                    ]}>
                      {config.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <TextInput
              style={styles.titleInput}
              placeholder="Title"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              autoFocus
            />
            <Text style={styles.charCount}>{title.length}/200</Text>
          </View>

          {/* Body */}
          <View style={styles.section}>
            <TextInput
              style={styles.bodyInput}
              placeholder="Share your knowledge, ask a question, or report conditions..."
              placeholderTextColor="#9CA3AF"
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Topic Tags */}
          {topicTags && topicTags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Topics</Text>
              <View style={styles.tagGrid}>
                {topicTags.map(tag => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <Pressable
                      key={tag.id}
                      style={[
                        styles.tagOption,
                        isSelected && { backgroundColor: `${tag.color}15`, borderColor: tag.color || '#E5E7EB' },
                      ]}
                      onPress={() => toggleTag(tag.id)}
                    >
                      {tag.icon && (
                        <Ionicons
                          name={tag.icon as any}
                          size={12}
                          color={isSelected ? tag.color || '#6B7280' : '#9CA3AF'}
                        />
                      )}
                      <Text style={[
                        styles.tagOptionText,
                        isSelected && { color: tag.color || '#374151', fontWeight: '600' },
                      ]}>
                        {tag.display_name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Pre-bound place anchor (Atlas POI) — shown, not pickable */}
          {!isEditing && poiId && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Place</Text>
              <View style={styles.tagGrid}>
                <View style={[styles.scopeChip, styles.scopeChipSelected]}>
                  <Ionicons name="location" size={12} color="#2563EB" />
                  <Text style={[styles.scopeChipText, styles.scopeChipTextSelected]}>
                    {poiName || 'This place'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Racing Area */}
          {!isEditing && venueId && racingAreas.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Area</Text>
              <View style={styles.tagGrid}>
                <Pressable
                  style={[styles.scopeChip, !selectedAreaId && styles.scopeChipSelected]}
                  onPress={() => setSelectedAreaId(null)}
                >
                  <Ionicons
                    name="map-outline"
                    size={12}
                    color={!selectedAreaId ? '#2563EB' : '#9CA3AF'}
                  />
                  <Text style={[styles.scopeChipText, !selectedAreaId && styles.scopeChipTextSelected]}>
                    Whole venue
                  </Text>
                </Pressable>
                {racingAreas.map(area => {
                  const isSelected = selectedAreaId === area.id;
                  return (
                    <Pressable
                      key={area.id}
                      style={[styles.scopeChip, isSelected && styles.scopeChipSelected]}
                      onPress={() => setSelectedAreaId(area.id)}
                    >
                      <Ionicons
                        name="location-outline"
                        size={12}
                        color={isSelected ? '#2563EB' : '#9CA3AF'}
                      />
                      <Text style={[styles.scopeChipText, isSelected && styles.scopeChipTextSelected]}>
                        {area.areaName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Audience */}
          {!isEditing && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Audience</Text>
              <View style={styles.tagGrid}>
                <Pressable
                  style={[styles.scopeChip, scopeType === 'public' && styles.scopeChipSelected]}
                  onPress={() => handleSelectScope('public', null)}
                >
                  <Ionicons
                    name="globe-outline"
                    size={12}
                    color={scopeType === 'public' ? '#2563EB' : '#9CA3AF'}
                  />
                  <Text style={[styles.scopeChipText, scopeType === 'public' && styles.scopeChipTextSelected]}>
                    Public
                  </Text>
                </Pressable>
                {(audiences || []).map(audience => {
                  const isSelected = scopeType === audience.scopeType && scopeId === audience.scopeId;
                  const prefix = audience.scopeType === 'fleet'
                    ? visibilityLabels.fleet
                    : audience.scopeType === 'org'
                      ? 'Org'
                      : audience.scopeType === 'cohort'
                        ? 'Cohort'
                        : 'Subscribers';
                  const icon = audience.scopeType === 'fleet'
                    ? 'people-outline'
                    : audience.scopeType === 'org'
                      ? 'business-outline'
                      : audience.scopeType === 'cohort'
                        ? 'school-outline'
                        : 'ribbon-outline';
                  return (
                    <Pressable
                      key={`${audience.scopeType}-${audience.scopeId}`}
                      style={[styles.scopeChip, isSelected && styles.scopeChipSelected]}
                      onPress={() => handleSelectScope(audience.scopeType, audience.scopeId)}
                    >
                      <Ionicons
                        name={icon as any}
                        size={12}
                        color={isSelected ? '#2563EB' : '#9CA3AF'}
                      />
                      <Text style={[styles.scopeChipText, isSelected && styles.scopeChipTextSelected]} numberOfLines={1}>
                        {prefix} · {audience.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {scopeType !== 'public' && (
                <Text style={styles.conditionHint}>
                  Only members of this group will see this post
                </Text>
              )}
            </View>
          )}

          {/* Tag a Race — sailing-only; hidden for POI-anchored knowledge */}
          {!poiId && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Race (optional)</Text>
            {selectedRaceId && selectedRaceName ? (
              <View style={styles.raceChipRow}>
                <View style={styles.raceChipSelected}>
                  <Ionicons name="flag" size={12} color={TufteTokens.colors?.accent || '#5856D6'} />
                  <Text style={styles.raceChipSelectedText} numberOfLines={1}>
                    {selectedRaceName}
                  </Text>
                  <Pressable onPress={handleClearRace} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </Pressable>
                </View>
              </View>
            ) : showRacePicker ? (
              <View style={styles.racePickerContainer}>
                <View style={styles.raceSearchRow}>
                  <Ionicons name="search" size={14} color="#9CA3AF" />
                  <TextInput
                    style={styles.raceSearchInput}
                    placeholder="Search races..."
                    placeholderTextColor="#9CA3AF"
                    value={raceSearchQuery}
                    onChangeText={handleRaceSearch}
                    autoFocus
                  />
                  <Pressable onPress={() => { setShowRacePicker(false); setRaceSearchQuery(''); setRaceSearchResults([]); }}>
                    <Text style={styles.raceSearchCancel}>Cancel</Text>
                  </Pressable>
                </View>
                {raceSearchResults.length > 0 && (
                  <View style={styles.raceResultsList}>
                    {raceSearchResults.slice(0, 6).map(race => (
                      <Pressable
                        key={race.id}
                        style={styles.raceResultRow}
                        onPress={() => handleSelectRace(race)}
                      >
                        <View style={styles.raceResultInfo}>
                          <Text style={styles.raceResultName} numberOfLines={1}>
                            {race.name}
                          </Text>
                          {race.country && (
                            <Text style={styles.raceResultMeta} numberOfLines={1}>
                              {[race.organizing_authority, race.country].filter(Boolean).join(' · ')}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                      </Pressable>
                    ))}
                  </View>
                )}
                {raceSearchQuery.trim().length >= 2 && raceSearchResults.length === 0 && (
                  <Text style={styles.raceNoResults}>No races found</Text>
                )}
              </View>
            ) : (
              <Pressable
                style={styles.raceChipEmpty}
                onPress={() => setShowRacePicker(true)}
              >
                <Ionicons name="flag-outline" size={14} color="#9CA3AF" />
                <Text style={styles.raceChipEmptyText}>Tag a Race</Text>
              </Pressable>
            )}
          </View>
          )}

          {/* Condition Label (simplified) — sailing-only; hidden for POI-anchored knowledge */}
          {!poiId && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Conditions (optional)</Text>
            <TextInput
              style={styles.conditionInput}
              placeholder='e.g. "NE 15-20kts, ebb tide"'
              placeholderTextColor="#9CA3AF"
              value={conditionLabel}
              onChangeText={setConditionLabel}
            />
            <Text style={styles.conditionHint}>
              Describe the conditions when this tip applies
            </Text>
          </View>
          )}

          {/* Tips */}
          <View style={styles.tipsSection}>
            <Text style={styles.tipsTitle}>Tips for great posts</Text>
            <Text style={styles.tipText}>
              {postType === 'tip' && '• Share specific, actionable advice based on your experience'}
              {postType === 'question' && '• Be specific about what you need help with'}
              {postType === 'report' && '• Include current conditions and what you observed'}
              {postType === 'safety_alert' && '• Be clear about the hazard and its location'}
              {postType === 'discussion' && '• Start a conversation about tactics, strategy, or venue knowledge'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TufteTokens.backgrounds.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: TufteTokens.spacing.section,
    paddingVertical: TufteTokens.spacing.standard,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
  },
  cancelButton: {
    ...TufteTokens.typography.secondary,
    color: '#6B7280',
  },
  headerTitle: {
    ...TufteTokens.typography.primary,
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: TufteTokens.spacing.section,
    paddingVertical: TufteTokens.spacing.compact,
    borderRadius: TufteTokens.borderRadius.subtle,
    minWidth: 60,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    ...TufteTokens.typography.tertiary,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: TufteTokens.spacing.section,
    paddingVertical: TufteTokens.spacing.standard,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#8E8E93',
    marginBottom: TufteTokens.spacing.compact,
  },
  // Post type
  typeRow: {
    flexDirection: 'row',
    gap: TufteTokens.spacing.compact,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeOptionText: {
    ...TufteTokens.typography.tertiary,
    color: '#9CA3AF',
  },
  // Title
  titleInput: {
    ...TufteTokens.typography.primary,
    fontSize: 18,
    color: '#111827',
    padding: 0,
  },
  charCount: {
    ...TufteTokens.typography.micro,
    color: '#D1D5DB',
    textAlign: 'right',
    marginTop: 4,
  },
  // Body
  bodyInput: {
    ...TufteTokens.typography.secondary,
    color: '#374151',
    minHeight: 120,
    padding: 0,
    lineHeight: 20,
  },
  // Tags
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TufteTokens.spacing.compact,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagOptionText: {
    ...TufteTokens.typography.tertiary,
    color: '#9CA3AF',
  },
  // Area + audience scope chips
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scopeChipSelected: {
    backgroundColor: '#2563EB12',
    borderColor: '#2563EB40',
  },
  scopeChipText: {
    ...TufteTokens.typography.tertiary,
    color: '#9CA3AF',
    maxWidth: 220,
  },
  scopeChipTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  // Race picker
  raceChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  raceChipSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    backgroundColor: '#5856D612',
    borderRadius: TufteTokens.borderRadius.subtle,
    borderWidth: 1,
    borderColor: '#5856D630',
  },
  raceChipSelectedText: {
    ...TufteTokens.typography.tertiary,
    color: '#5856D6',
    fontWeight: '600',
    maxWidth: 200,
  },
  raceChipEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
    alignSelf: 'flex-start',
  },
  raceChipEmptyText: {
    ...TufteTokens.typography.tertiary,
    color: '#9CA3AF',
  },
  racePickerContainer: {
    gap: TufteTokens.spacing.compact,
  },
  raceSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  raceSearchInput: {
    flex: 1,
    ...TufteTokens.typography.secondary,
    color: '#374151',
    padding: 0,
  },
  raceSearchCancel: {
    ...TufteTokens.typography.tertiary,
    color: '#6B7280',
  },
  raceResultsList: {
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
    overflow: 'hidden',
  },
  raceResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  raceResultInfo: {
    flex: 1,
    marginRight: 8,
  },
  raceResultName: {
    ...TufteTokens.typography.secondary,
    color: '#374151',
    fontWeight: '500',
  },
  raceResultMeta: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
    marginTop: 1,
  },
  raceNoResults: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: TufteTokens.spacing.compact,
  },

  // Conditions
  conditionInput: {
    ...TufteTokens.typography.secondary,
    color: '#374151',
    backgroundColor: TufteTokens.backgrounds.subtle,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  conditionHint: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
    marginTop: 4,
  },
  // Tips
  tipsSection: {
    marginHorizontal: TufteTokens.spacing.section,
    marginTop: TufteTokens.spacing.section,
    padding: TufteTokens.spacing.standard,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  tipsTitle: {
    ...TufteTokens.typography.micro,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  tipText: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
    lineHeight: 16,
  },
});

export default PostComposer;
