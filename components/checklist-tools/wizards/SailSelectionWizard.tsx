/**
 * SailSelectionWizard
 *
 * Interactive sail selection wizard for morning checklist.
 * Shows AI-powered sail recommendations based on conditions,
 * allows user to select sails and add notes for the learning loop.
 */

import { NudgeList } from '@/components/checklist-tools/NudgeBanner';
import { SailInspectionWizard } from '@/components/sail-inspection';
import { usePersonalizedNudges } from '@/hooks/useAdaptiveLearning';
import { useAuth } from '@/providers/AuthProvider';
import { formatSailDisplayName, getSailConditionColor, useSailInventory } from '@/hooks/useSailInventory';
import type { ChecklistToolProps } from '@/lib/checklists/toolRegistry';
import { SAIL_HINTS, getWindRange, sailRecommendationService } from '@/services/ai/SailRecommendationService';
import { sailorRacePreparationService } from '@/services/SailorRacePreparationService';
import type {
  SailRecommendation,
  SailSelectionIntention,
  SailSelectionRecommendations,
} from '@/types/morningChecklist';
import type { SailInventoryItem, SailSelectionIntention as PersistedSailSelectionIntention } from '@/types/raceIntentions';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Eye,
  Pencil,
  Plus,
  Sailboat,
  Sparkles,
  Trash2,
  Wind,
  X
} from 'lucide-react-native';
import { equipmentService } from '@/services/EquipmentService';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  purple: '#AF52DE',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  yellow: '#FFCC00',
  gray: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  gray4: '#3A3A3C',
  gray5: '#2C2C2E',
  background: '#F2F2F7',
  secondaryBackground: '#FFFFFF',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
  separator: '#3C3C4349',
};

interface SailSelectionWizardProps extends ChecklistToolProps {
  wind?: {
    direction?: string;
    speedMin?: number;
    speedMax?: number;
    average?: number;
    gusts?: number;
  };
  waveState?: string | null;
  boatClass?: string | null;
  boatClassId?: string | null;
  venueId?: string | null;
  existingIntention?: SailSelectionIntention | null;
}

type SailCategory = 'mainsail' | 'headsail' | 'downwind';

function normalizeRecommendationError(error: unknown): string {
  const message = (error as { message?: string })?.message?.toLowerCase?.() || '';
  if (!message) return 'Unable to load sail guidance right now. Showing manual selection.';
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network issue while loading sail guidance. Showing manual selection.';
  }
  if (message.includes('permission') || message.includes('not authorized') || message.includes('row-level security')) {
    return 'Sail guidance is unavailable for this account. Showing manual selection.';
  }
  return 'Sail guidance is temporarily unavailable. Showing manual selection.';
}

export function SailSelectionWizard({
  item: _item,
  regattaId,
  boatId,
  onComplete,
  onCancel,
  wind,
  waveState,
  boatClass,
  boatClassId,
  venueId,
  existingIntention,
}: SailSelectionWizardProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Fetch sail inventory
  const {
    sails: sailInventory,
    allSails,
    isLoading: isLoadingSails,
    error: sailError,
    hasSails,
    refresh: refreshSails,
  } = useSailInventory({
    boatId: boatId || null,
    enabled: !!boatId,
  });

  // Fetch personalized nudges for sail selection
  const {
    conditionsInsights: sailNudges,
    checklistAdditions,
    isLoading: isLoadingNudges,
    recordDelivery,
  } = usePersonalizedNudges(regattaId || '', {
    venueId: venueId || undefined,
    boatClassId: boatClassId || undefined,
    forecast: wind?.average ? {
      windSpeed: wind.average,
      windDirection: 0, // Direction not critical for sail selection
    } : undefined,
  });

  // Filter nudges relevant to sail selection (equipment issues, weather adaptation)
  const relevantNudges = useMemo(() => {
    const allNudges = [...(sailNudges || []), ...(checklistAdditions || [])];
    return allNudges.filter(
      (n) =>
        n.category === 'equipment_issue' ||
        n.category === 'weather_adaptation' ||
        n.category === 'successful_strategy'
    );
  }, [sailNudges, checklistAdditions]);

  // State
  const [recommendations, setRecommendations] = useState<SailSelectionRecommendations | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [selectedSails, setSelectedSails] = useState<{
    mainsailId?: string;
    headsailId?: string;
    downwindId?: string;
  }>(existingIntention?.selectedSails || {});
  const [userNotes, setUserNotes] = useState(existingIntention?.userNotes || '');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<SailCategory>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [_showQuickAddSail, setShowQuickAddSail] = useState(false);
  const [inspectingSail, setInspectingSail] = useState<SailInventoryItem | null>(null);
  const [addingToCategory, setAddingToCategory] = useState<SailCategory | null>(null);
  const [newSailName, setNewSailName] = useState('');
  const [newSailMaker, setNewSailMaker] = useState('');
  const [newSailWeight, setNewSailWeight] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [isAddingSail, setIsAddingSail] = useState(false);
  const [editingSailId, setEditingSailId] = useState<string | null>(null);
  const [editSailName, setEditSailName] = useState('');
  const [editSailMaker, setEditSailMaker] = useState('');
  const [editSailWeight, setEditSailWeight] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Check for unsaved changes before closing
  const hasUnsavedChanges = useMemo(() => {
    const origSails = existingIntention?.selectedSails || {};
    const origNotes = existingIntention?.userNotes || '';
    const sailsChanged =
      selectedSails.mainsailId !== origSails.mainsailId ||
      selectedSails.headsailId !== origSails.headsailId ||
      selectedSails.downwindId !== origSails.downwindId;
    return sailsChanged || userNotes !== origNotes;
  }, [selectedSails, userNotes, existingIntention]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      showConfirm(
        'Discard Changes?',
        'You have unsaved sail selections.',
        () => onCancel(),
        { destructive: true, confirmText: 'Discard' }
      );
    } else {
      onCancel();
    }
  }, [hasUnsavedChanges, onCancel]);

  // Fetch recommendations when sails are loaded
  const fetchRecommendations = useCallback(async () => {
    if (!hasSails || isLoadingSails) return;
    setIsLoadingRecommendations(true);
    setRecommendationError(null);
    try {
      const recs = await sailRecommendationService.getAIEnhancedRecommendations({
        sails: sailInventory,
        wind: wind || {},
        waveState: waveState || undefined,
        boatClass: boatClass || undefined,
      });
      setRecommendations(recs);

      // Pre-select recommended sails if no existing selection
      if (!existingIntention?.selectedSails) {
        setSelectedSails({
          mainsailId: recs.mainsail?.sailId,
          headsailId: recs.headsail?.sailId,
          downwindId: recs.downwind?.sailId,
        });
      }
    } catch (error) {
      console.error('Failed to get sail recommendations:', error);
      setRecommendationError(normalizeRecommendationError(error));
      try {
        const fallback = await sailRecommendationService.getRecommendations({
          sails: sailInventory,
          wind: wind || {},
          waveState: waveState || undefined,
          boatClass: boatClass || undefined,
        });
        setRecommendations(fallback);
      } catch {
        setRecommendations(null);
      }
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [hasSails, isLoadingSails, sailInventory, wind, waveState, boatClass, existingIntention]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Format conditions summary
  const conditionsSummary = useMemo(() => {
    const parts: string[] = [];
    if (wind?.direction) parts.push(wind.direction);
    if (wind?.speedMin && wind?.speedMax) {
      parts.push(`${wind.speedMin}-${wind.speedMax} kt`);
    } else if (wind?.average) {
      parts.push(`~${wind.average} kt`);
    }
    if (waveState) parts.push(waveState);
    return parts.length > 0 ? parts.join(', ') : 'Conditions not available';
  }, [wind, waveState]);

  // Get sail by ID
  const getSailById = useCallback(
    (id: string | undefined): SailInventoryItem | undefined => {
      if (!id) return undefined;
      return allSails.find((s) => s.id === id);
    },
    [allSails]
  );

  // Handle sail selection
  const handleSelectSail = useCallback((category: SailCategory, sailId: string) => {
    setSelectedSails((prev) => ({
      ...prev,
      [`${category}Id`]: sailId,
    }));
  }, []);

  // Handle inspect sail
  const handleInspectSail = useCallback((sail: SailInventoryItem) => {
    setInspectingSail(sail);
  }, []);

  const handleInspectionComplete = useCallback(() => {
    setInspectingSail(null);
    refreshSails();
  }, [refreshSails]);

  // Handle add sail
  const CATEGORY_DB_MAP: Record<SailCategory, string> = {
    mainsail: 'mainsail',
    headsail: 'genoa',
    downwind: 'spinnaker',
  };

  const handleAddSail = useCallback(async () => {
    if (!boatId || !addingToCategory) return;
    setIsAddingSail(true);
    try {
      const dbCategory = CATEGORY_DB_MAP[addingToCategory];
      const categoryLabel = addingToCategory === 'mainsail' ? 'Mainsail' : addingToCategory === 'headsail' ? 'Genoa' : 'Spinnaker';
      await equipmentService.createEquipment({
        boat_id: boatId,
        category: dbCategory,
        custom_name: newSailName.trim() || `${categoryLabel} #${(allSails.length + 1)}`,
        manufacturer: newSailMaker.trim() || undefined,
        condition_rating: 8,
        specifications: { sailWeight: newSailWeight },
      });
      setAddingToCategory(null);
      setNewSailName('');
      setNewSailMaker('');
      setNewSailWeight('medium');
      await refreshSails();
    } catch (error) {
      console.error('Failed to add sail:', error);
      showAlert('Error', 'Failed to add sail. Please try again.');
    } finally {
      setIsAddingSail(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boatId, addingToCategory, newSailName, newSailMaker, refreshSails]);

  // Handle delete sail with confirmation
  const handleDeleteSail = useCallback((sail: SailInventoryItem) => {
    showConfirm(
      'Remove Sail',
      `Remove "${formatSailDisplayName(sail)}" from your inventory?`,
      async () => {
        try {
          await equipmentService.deleteEquipment(sail.id);
          setSelectedSails((prev) => {
            const updated = { ...prev };
            if (prev.mainsailId === sail.id) delete updated.mainsailId;
            if (prev.headsailId === sail.id) delete updated.headsailId;
            if (prev.downwindId === sail.id) delete updated.downwindId;
            return updated;
          });
          await refreshSails();
        } catch (error) {
          console.error('Failed to delete sail:', error);
          showAlert('Error', 'Failed to remove sail. Please try again.');
        }
      },
      { destructive: true }
    );
  }, [refreshSails]);

  // Handle start editing sail
  const handleStartEdit = useCallback((sail: SailInventoryItem) => {
    setEditingSailId(sail.id);
    setEditSailName(sail.customName || '');
    setEditSailMaker(sail.manufacturer || '');
    setEditSailWeight(sail.sailWeight || 'medium');
  }, []);

  // Handle save edit
  const handleSaveEdit = useCallback(async (sailId: string) => {
    setIsSavingEdit(true);
    try {
      await equipmentService.updateEquipment(sailId, {
        custom_name: editSailName.trim() || undefined,
        manufacturer: editSailMaker.trim() || undefined,
        specifications: { sailWeight: editSailWeight },
      });
      setEditingSailId(null);
      await refreshSails();
    } catch (error) {
      console.error('Failed to update sail:', error);
      showAlert('Error', 'Failed to update sail. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  }, [editSailName, editSailMaker, editSailWeight, refreshSails]);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (!user?.id) {
        showAlert('Sign in required', 'Please sign in to save sail selection.');
        return;
      }
      if (!regattaId) {
        showAlert('Race unavailable', 'Unable to save sail selection without a race id.');
        return;
      }

      const selectedMainsail = getSailById(selectedSails.mainsailId);
      const selectedHeadsail = getSailById(selectedSails.headsailId);
      const selectedDownwind = getSailById(selectedSails.downwindId);
      const windAverage =
        wind?.average ||
        ((wind?.speedMin ?? 0) && (wind?.speedMax ?? 0)
          ? ((wind?.speedMin || 0) + (wind?.speedMax || 0)) / 2
          : wind?.speedMin || wind?.speedMax || 0);
      const windRange = windAverage > 0 ? getWindRange(windAverage) : undefined;

      // Build intention data
      const intention: PersistedSailSelectionIntention = {
        mainsail: selectedMainsail?.id,
        mainsailName: selectedMainsail ? formatSailDisplayName(selectedMainsail) : undefined,
        jib: selectedHeadsail?.id,
        jibName: selectedHeadsail ? formatSailDisplayName(selectedHeadsail) : undefined,
        spinnaker: selectedDownwind?.id,
        spinnakerName: selectedDownwind ? formatSailDisplayName(selectedDownwind) : undefined,
        notes: userNotes || recommendations?.combinationReasoning || undefined,
        windRangeContext: windRange ? SAIL_HINTS.mainsail[windRange] : undefined,
      };

      const saved = await sailorRacePreparationService.updateSailSelection(
        regattaId,
        user.id,
        intention
      );
      if (!saved) {
        showAlert('Unable to save', 'Sail selection could not be saved right now. Please try again.');
        return;
      }

      onComplete();
    } catch (error) {
      console.error('Failed to save sail selection intention:', error);
      showAlert('Save failed', 'Failed to save sail selection. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, regattaId, getSailById, selectedSails, wind?.average, wind?.speedMin, wind?.speedMax, userNotes, recommendations?.combinationReasoning, onComplete]);

  // Handle learn more - navigate to Equipment & Rigging module in Race Preparation Mastery course
  const handleLearnMore = useCallback(() => {
    onCancel(); // Close modal first
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/learn/race-preparation-mastery' as any,
        params: {
          moduleId: 'module-13-3', // Equipment & Rigging module
        },
      });
    }, 150);
  }, [router, onCancel]);

  // Sail weight display helpers
  const getWeightLabel = (weight?: 'light' | 'medium' | 'heavy') => {
    switch (weight) {
      case 'light': return 'Light';
      case 'medium': return 'Medium';
      case 'heavy': return 'Heavy';
      default: return null;
    }
  };

  const getWeightColor = (weight?: 'light' | 'medium' | 'heavy') => {
    switch (weight) {
      case 'light': return IOS_COLORS.blue;
      case 'medium': return IOS_COLORS.orange;
      case 'heavy': return IOS_COLORS.red;
      default: return IOS_COLORS.gray;
    }
  };

  // Render a sail option
  const renderSailOption = (
    sail: SailInventoryItem,
    category: SailCategory,
    isRecommended: boolean
  ) => {
    const isSelected =
      selectedSails[`${category}Id` as keyof typeof selectedSails] === sail.id;
    const conditionColor = getSailConditionColor(sail.conditionRating);
    const isEditing = editingSailId === sail.id;

    // Inline edit form
    if (isEditing) {
      return (
        <View key={sail.id} style={[styles.sailOption, styles.sailOptionEditing]}>
          <TextInput
            style={styles.editSailInput}
            value={editSailName}
            onChangeText={setEditSailName}
            placeholder="Sail name"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            autoFocus
          />
          <TextInput
            style={styles.editSailInput}
            value={editSailMaker}
            onChangeText={setEditSailMaker}
            placeholder="Sailmaker (optional)"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
          />
          <View style={styles.weightPickerRow}>
            <Text style={styles.weightPickerLabel}>Cloth Weight</Text>
            <View style={styles.weightPickerOptions}>
              {(['light', 'medium', 'heavy'] as const).map((w) => (
                <Pressable
                  key={w}
                  style={[
                    styles.weightPickerOption,
                    editSailWeight === w && { backgroundColor: `${getWeightColor(w)}18`, borderColor: getWeightColor(w) },
                  ]}
                  onPress={() => setEditSailWeight(w)}
                >
                  <Text
                    style={[
                      styles.weightPickerOptionText,
                      editSailWeight === w && { color: getWeightColor(w), fontWeight: '600' },
                    ]}
                  >
                    {getWeightLabel(w)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.inlineAddActions}>
            <Pressable style={styles.inlineAddCancel} onPress={() => setEditingSailId(null)}>
              <Text style={styles.inlineAddCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.inlineAddSave, isSavingEdit && styles.inlineAddSaveDisabled]}
              onPress={() => handleSaveEdit(sail.id)}
              disabled={isSavingEdit}
            >
              {isSavingEdit ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.inlineAddSaveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View key={sail.id} style={[styles.sailOption, isSelected && styles.sailOptionSelected]}>
        {/* Main row — tap to select */}
        <Pressable
          style={styles.sailOptionMainRow}
          onPress={() => handleSelectSail(category, sail.id)}
        >
          <CircleDot
            size={20}
            color={isSelected ? IOS_COLORS.blue : IOS_COLORS.gray3}
            fill={isSelected ? IOS_COLORS.blue : 'transparent'}
          />
          <View style={styles.sailOptionInfo}>
            <View style={styles.sailNameRow}>
              <Text style={[styles.sailOptionName, isSelected && styles.sailOptionNameSelected]}>
                {formatSailDisplayName(sail)}
              </Text>
              {sail.sailWeight && (
                <View style={[styles.weightBadge, { backgroundColor: `${getWeightColor(sail.sailWeight)}15` }]}>
                  <Text style={[styles.weightBadgeText, { color: getWeightColor(sail.sailWeight) }]}>
                    {getWeightLabel(sail.sailWeight)}
                  </Text>
                </View>
              )}
              {isRecommended && (
                <View style={styles.recommendedBadge}>
                  <Sparkles size={10} color={IOS_COLORS.purple} />
                  <Text style={styles.recommendedBadgeText}>Rec</Text>
                </View>
              )}
            </View>
            <View style={styles.sailMetaRow}>
              {sail.conditionRating != null && (
                <>
                  <View
                    style={[styles.sailConditionDot, { backgroundColor: conditionColor }]}
                  />
                  <Text style={styles.sailConditionText}>
                    {sail.conditionRating}/10
                  </Text>
                </>
              )}
              {sail.totalRacesUsed != null && sail.totalRacesUsed > 0 && (
                <Text style={styles.sailConditionText}>
                  {sail.conditionRating != null ? ' · ' : ''}{sail.totalRacesUsed} races
                </Text>
              )}
            </View>
          </View>
        </Pressable>

        {/* Action buttons — always visible */}
        <View style={styles.sailActions}>
          <Pressable
            style={styles.sailActionButton}
            onPress={(e) => {
              e.stopPropagation?.();
              handleStartEdit(sail);
            }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Pencil size={13} color={IOS_COLORS.blue} />
          </Pressable>
          <Pressable
            style={styles.sailActionButton}
            onPress={(e) => {
              e.stopPropagation?.();
              handleInspectSail(sail);
            }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Eye size={13} color={IOS_COLORS.blue} />
          </Pressable>
          <Pressable
            style={[styles.sailActionButton, styles.sailActionButtonDanger]}
            onPress={(e) => {
              e.stopPropagation?.();
              handleDeleteSail(sail);
            }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Trash2 size={13} color={IOS_COLORS.red} />
          </Pressable>
        </View>
      </View>
    );
  };

  // Render a category section
  const renderCategorySection = (
    category: SailCategory,
    label: string,
    sails: SailInventoryItem[],
    recommendation?: SailRecommendation
  ) => {
    const isExpanded = !collapsedCategories.has(category);
    const selectedId = selectedSails[`${category}Id` as keyof typeof selectedSails];
    const selectedSail = getSailById(selectedId);
    const isAddingHere = addingToCategory === category;

    const toggleCategory = () => {
      setCollapsedCategories((prev) => {
        const next = new Set(prev);
        if (next.has(category)) {
          next.delete(category);
        } else {
          next.add(category);
        }
        return next;
      });
    };

    return (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeaderRow}>
          <Pressable
            style={styles.categoryHeader}
            onPress={toggleCategory}
          >
            <View style={styles.categoryHeaderLeft}>
              <Sailboat size={18} color={IOS_COLORS.label} />
              <Text style={styles.categoryTitle}>{label}</Text>
              <Text style={styles.categorySailCount}>{sails.length}</Text>
            </View>
            <View style={styles.categoryHeaderRight}>
              {!isExpanded && selectedSail && (
                <Text style={styles.selectedSailName} numberOfLines={1}>
                  {formatSailDisplayName(selectedSail)}
                </Text>
              )}
              {isExpanded ? (
                <ChevronUp size={18} color={IOS_COLORS.gray} />
              ) : (
                <ChevronDown size={18} color={IOS_COLORS.gray} />
              )}
            </View>
          </Pressable>
          <Pressable
            style={styles.addSailButton}
            onPress={() => {
              if (!isExpanded) toggleCategory();
              setAddingToCategory(isAddingHere ? null : category);
              setNewSailName('');
              setNewSailMaker('');
              setNewSailWeight('medium');
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Plus size={16} color={IOS_COLORS.blue} />
          </Pressable>
        </View>

        {isExpanded && (
          <View style={styles.categoryContent}>
            {/* Recommendation info */}
            {recommendation && (
              <View style={styles.recommendationInfo}>
                <Sparkles size={14} color={IOS_COLORS.purple} />
                <Text style={styles.recommendationText}>
                  {recommendation.reasoning}
                </Text>
              </View>
            )}

            {/* Sail options */}
            {sails.length > 0 ? (
              <View style={styles.sailOptions}>
                {sails.map((sail) =>
                  renderSailOption(
                    sail,
                    category,
                    sail.id === recommendation?.sailId
                  )
                )}
              </View>
            ) : (
              <Text style={styles.emptyCategoryText}>
                No {label.toLowerCase()} sails yet
              </Text>
            )}

            {/* Inline add form */}
            {isAddingHere && (
              <View style={styles.inlineAddForm}>
                <TextInput
                  style={styles.inlineAddInput}
                  value={newSailName}
                  onChangeText={setNewSailName}
                  placeholder={`Sail name (e.g. ${label} #2)`}
                  placeholderTextColor={IOS_COLORS.tertiaryLabel}
                  autoFocus
                />
                <TextInput
                  style={styles.inlineAddInput}
                  value={newSailMaker}
                  onChangeText={setNewSailMaker}
                  placeholder="Sailmaker (optional)"
                  placeholderTextColor={IOS_COLORS.tertiaryLabel}
                />
                {/* Sail weight picker */}
                <View style={styles.weightPickerRow}>
                  <Text style={styles.weightPickerLabel}>Cloth Weight</Text>
                  <View style={styles.weightPickerOptions}>
                    {(['light', 'medium', 'heavy'] as const).map((w) => (
                      <Pressable
                        key={w}
                        style={[
                          styles.weightPickerOption,
                          newSailWeight === w && { backgroundColor: `${getWeightColor(w)}18`, borderColor: getWeightColor(w) },
                        ]}
                        onPress={() => setNewSailWeight(w)}
                      >
                        <Text
                          style={[
                            styles.weightPickerOptionText,
                            newSailWeight === w && { color: getWeightColor(w), fontWeight: '600' },
                          ]}
                        >
                          {getWeightLabel(w)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.inlineAddActions}>
                  <Pressable
                    style={styles.inlineAddCancel}
                    onPress={() => setAddingToCategory(null)}
                  >
                    <Text style={styles.inlineAddCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.inlineAddSave, isAddingSail && styles.inlineAddSaveDisabled]}
                    onPress={handleAddSail}
                    disabled={isAddingSail}
                  >
                    {isAddingSail ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.inlineAddSaveText}>Add</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // Handle quick-add sail success
  const _handleQuickAddSuccess = useCallback(async () => {
    setShowQuickAddSail(false);
    await refreshSails();
  }, [refreshSails]);

  // Calculate wind range for generic recommendations
  const windAvg = useMemo(() => {
    if (wind?.average) return wind.average;
    if (wind?.speedMin && wind?.speedMax) return (wind.speedMin + wind.speedMax) / 2;
    return wind?.speedMin || wind?.speedMax || 10;
  }, [wind]);

  const _windRange = useMemo(() => getWindRange(windAvg), [windAvg]);

  // Handle navigation to boat management
  const _handleManageBoatSails = useCallback(() => {
    if (boatId) {
      router.push(`/(tabs)/boat/${boatId}?tab=sails`);
      onCancel();
    }
  }, [boatId, router, onCancel]);

  const handleSelectBoat = useCallback(() => {
    router.push('/(tabs)/boat');
    onCancel();
  }, [router, onCancel]);

  // Render loading state
  if (isLoadingSails || (isLoadingRecommendations && !recommendations)) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={onCancel}>
            <X size={24} color={IOS_COLORS.gray} />
          </Pressable>
          <Text style={styles.headerTitle}>Sail Selection</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.blue} />
          <Text style={styles.loadingText}>Loading sails...</Text>
        </View>
      </View>
    );
  }

  // Render error state (no boat selected)
  if (sailError || !boatId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={onCancel}>
            <X size={24} color={IOS_COLORS.gray} />
          </Pressable>
          <Text style={styles.headerTitle}>Sail Selection</Text>
          <View style={styles.headerRight} />
        </View>
        <ScrollView contentContainerStyle={styles.errorScrollContent}>
          <View style={styles.errorContainer}>
            <AlertTriangle size={48} color={IOS_COLORS.orange} />
            <Text style={styles.errorTitle}>{sailError ? 'Error' : 'No Boat Selected'}</Text>
            <Text style={styles.errorDescription}>
              {sailError || 'Select a boat to manage your sail inventory.'}
            </Text>
            <Pressable style={styles.linkButton} onPress={handleSelectBoat}>
              <Sailboat size={18} color="#FFFFFF" />
              <Text style={styles.linkButtonText}>Select a Boat</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Combine jibs and genoas for headsail section
  const headsails = [...sailInventory.jibs, ...sailInventory.genoas];
  const downwindSails = [...sailInventory.spinnakers, ...sailInventory.codeZeros];

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={IOS_COLORS.gray} />
          </Pressable>
          <Text style={styles.headerTitle}>Sail Selection</Text>
          <View style={styles.headerRight}>
            <Pressable style={styles.learnIconButton} onPress={handleLearnMore}>
              <BookOpen size={20} color={IOS_COLORS.purple} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentInner}
          keyboardShouldPersistTaps="handled"
        >
          {/* Conditions */}
          <View style={styles.conditionsCard}>
            <View style={styles.conditionsHeader}>
              <Wind size={20} color={IOS_COLORS.blue} />
              <Text style={styles.conditionsTitle}>Conditions</Text>
            </View>
            <Text style={styles.conditionsText}>{conditionsSummary}</Text>
          </View>

          {/* Combination Reasoning */}
          {recommendations?.combinationReasoning && (
            <View style={styles.reasoningCard}>
              <Sparkles size={16} color={IOS_COLORS.purple} />
              <Text style={styles.reasoningText}>
                {recommendations.combinationReasoning}
              </Text>
            </View>
          )}

          {recommendationError && (
            <View style={styles.recommendationWarningCard}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                <AlertTriangle size={16} color={IOS_COLORS.orange} />
                <Text style={[styles.recommendationWarningText, { flex: 1 }]}>{recommendationError}</Text>
              </View>
              <Pressable
                onPress={fetchRecommendations}
                style={styles.retryButton}
                hitSlop={8}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {/* Personalized Nudges from Past Races */}
          {relevantNudges.length > 0 && (
            <NudgeList
              nudges={relevantNudges}
              title="From Your Past Sail Choices"
              channel="checklist"
              maxVisible={3}
              isLoading={isLoadingNudges}
              onRecordDelivery={recordDelivery as any}
            />
          )}

          {/* Sail Categories */}
          <View style={styles.categoriesContainer}>
            {renderCategorySection(
              'mainsail',
              'Mainsail',
              sailInventory.mainsails,
              recommendations?.mainsail
            )}
            {renderCategorySection(
              'headsail',
              'Headsail',
              headsails,
              recommendations?.headsail
            )}
            {renderCategorySection(
              'downwind',
              'Downwind',
              downwindSails,
              recommendations?.downwind
            )}
          </View>

          {/* User Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Your Notes</Text>
            <Text style={styles.notesSubLabel}>
              Record your reasoning or planned changes
            </Text>
            <TextInput
              style={styles.notesInput}
              value={userNotes}
              onChangeText={setUserNotes}
              placeholder="e.g., Going bigger jib than suggested due to light patches expected..."
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Tip */}
          <View style={styles.tipCard}>
            <Sparkles size={16} color={IOS_COLORS.purple} />
            <Text style={styles.tipText}>
              After the race, review how your sail choices performed. Your
              feedback improves future recommendations.
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Action */}
        <View style={styles.bottomAction}>
          <Pressable
            style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle2 size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Save & Complete</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Sail Inspection Modal */}
      {inspectingSail && (
        <RNModal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setInspectingSail(null)}
        >
          <SailInspectionWizard
            equipmentId={inspectingSail.id}
            boatId={boatId}
            sailName={formatSailDisplayName(inspectingSail)}
            inspectionType="pre_race"
            onComplete={handleInspectionComplete}
            onCancel={() => setInspectingSail(null)}
          />
        </RNModal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  closeButton: {
    padding: 4,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  learnIconButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: IOS_COLORS.secondaryLabel,
  },
  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorScrollContent: {
    flexGrow: 1,
  },
  quickAddButtonContainer: {
    marginTop: 24,
    width: '100%',
    paddingHorizontal: 20,
  },
  // Navigation links for empty state
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.blue,
    marginTop: 16,
    gap: 8,
  },
  linkButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Generic sail recommendations for empty state
  genericRecommendationsCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    width: '100%',
  },
  genericRecommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  genericRecommendationsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  sailHint: {
    marginBottom: 10,
  },
  sailHintCategory: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  sailHintText: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
    lineHeight: 18,
  },
  // Conditions
  conditionsCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  conditionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  conditionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conditionsText: {
    fontSize: 17,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  // Reasoning
  reasoningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${IOS_COLORS.purple}08`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  reasoningText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
  // Categories
  categoriesContainer: {
    gap: 8,
    marginBottom: 20,
  },
  categorySection: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  addSailButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${IOS_COLORS.blue}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categorySailCount: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    marginLeft: 4,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedSailName: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  categoryContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  recommendationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  sailOptions: {
    gap: 8,
  },
  sailOption: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.background,
  },
  sailOptionEditing: {
    backgroundColor: `${IOS_COLORS.blue}08`,
    borderWidth: 1,
    borderColor: IOS_COLORS.blue,
    gap: 8,
    paddingVertical: 12,
  },
  sailOptionSelected: {
    backgroundColor: `${IOS_COLORS.blue}10`,
    borderWidth: 1,
    borderColor: IOS_COLORS.blue,
  },
  sailOptionMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sailOptionInfo: {
    flex: 1,
  },
  sailOptionName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  sailOptionNameSelected: {
    color: IOS_COLORS.blue,
    fontWeight: '600',
  },
  sailNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  sailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  weightBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  weightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sailConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sailConditionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sailConditionText: {
    fontSize: 12,
    color: IOS_COLORS.gray,
  },
  sailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 6,
    paddingLeft: 30,
  },
  sailActionButton: {
    width: 32,
    height: 28,
    borderRadius: 7,
    backgroundColor: `${IOS_COLORS.blue}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sailActionButtonDanger: {
    backgroundColor: `${IOS_COLORS.red}10`,
  },
  editSailInput: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: IOS_COLORS.label,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: `${IOS_COLORS.purple}15`,
    borderRadius: 6,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_COLORS.purple,
  },
  emptyCategoryText: {
    fontSize: 14,
    color: IOS_COLORS.gray,
    paddingVertical: 12,
    textAlign: 'center',
  },
  inlineAddForm: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    marginTop: 8,
  },
  inlineAddInput: {
    backgroundColor: IOS_COLORS.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  weightPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  weightPickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  weightPickerOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  weightPickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.background,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  weightPickerOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.gray2,
  },
  inlineAddActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 2,
  },
  inlineAddCancel: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  inlineAddCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  inlineAddSave: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.blue,
  },
  inlineAddSaveDisabled: {
    backgroundColor: IOS_COLORS.gray,
  },
  inlineAddSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Notes
  notesSection: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: 2,
  },
  notesSubLabel: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 10,
  },
  notesInput: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: IOS_COLORS.label,
    minHeight: 80,
    lineHeight: 22,
  },
  // Tip
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: `${IOS_COLORS.purple}08`,
    borderRadius: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  recommendationWarningCard: {
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 12,
  },
  recommendationWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#9A3412',
    lineHeight: 17,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FED7AA',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9A3412',
  },
  // Bottom Action
  bottomAction: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.green,
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: IOS_COLORS.gray,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SailSelectionWizard;
