/**
 * AIStructureReview — Review overlay showing AI-populated 4Q fields.
 * Users can edit each field before confirming the structured plan.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import type {
  StepPlanData,
  SubStep,
  AnyExtractedEntity,
  ExtractedPersonEntity,
  ExtractedEquipmentEntity,
  ExtractedLocationEntity,
  ExtractedDateEntity,
  DateEnrichment,
} from '@/types/step-detail';
import { DateEnrichmentCard } from './DateEnrichmentCard';

interface AIStructureReviewProps {
  /** AI-generated plan data to review */
  planData: StepPlanData;
  /** Suggested title from AI */
  suggestedTitle?: string;
  /** Resolved entities from EntityResolutionService */
  resolvedEntities?: AnyExtractedEntity[];
  /** Date enrichment data (weather/tide/rig) */
  dateEnrichment?: DateEnrichment;
  /** Whether date enrichment is still loading */
  isEnrichingDate?: boolean;
  /** Whether entity resolution is in progress */
  isResolvingEntities?: boolean;
  /** Error from entity resolution */
  entityResolutionError?: string | null;
  /** Called when user resolves an ambiguous person */
  onResolveAmbiguousPerson?: (rawText: string, userId: string, displayName: string) => void;
  /** Called when user confirms the plan */
  onConfirm: (planData: StepPlanData, title?: string) => void;
  /** Called when user wants to go back to brain dump */
  onBack: () => void;
}

interface SectionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
  isEditing: boolean;
  onToggleEdit: () => void;
}

function ReviewSection({ icon, label, children, isEditing, onToggleEdit }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
        <Ionicons name={icon} size={16} color={STEP_COLORS.label} />
        <Text style={styles.sectionLabel}>{label}</Text>
        <Pressable onPress={onToggleEdit} hitSlop={8} style={styles.editButton}>
          <Text style={styles.editButtonText}>{isEditing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

export function AIStructureReview({
  planData,
  suggestedTitle,
  resolvedEntities,
  dateEnrichment,
  isEnrichingDate,
  isResolvingEntities,
  entityResolutionError: _entityResolutionError,
  onResolveAmbiguousPerson,
  onConfirm,
  onBack,
}: AIStructureReviewProps) {
  const [what, setWhat] = useState(planData.what_will_you_do ?? '');
  const [why, setWhy] = useState(planData.why_reasoning ?? '');
  const [subSteps, setSubSteps] = useState<SubStep[]>(planData.how_sub_steps ?? []);
  const [who, setWho] = useState((planData.who_collaborators ?? []).join(', '));
  const [title, setTitle] = useState(suggestedTitle ?? '');
  const [editingSection, setEditingSection] = useState<string | null>(null);

  const toggleEdit = useCallback((section: string) => {
    setEditingSection((prev) => (prev === section ? null : section));
  }, []);

  const handleConfirm = useCallback(() => {
    const confirmedPlan: StepPlanData = {
      ...planData,
      what_will_you_do: what,
      how_sub_steps: subSteps,
      why_reasoning: why,
      who_collaborators: who
        .split(/,\s*/)
        .map((n) => n.trim())
        .filter(Boolean),
    };
    onConfirm(confirmedPlan, title.trim() || undefined);
  }, [planData, what, subSteps, why, who, title, onConfirm]);

  const handleSubStepTextChange = useCallback((id: string, newText: string) => {
    setSubSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: newText } : s)),
    );
  }, []);

  const handleAddSubStep = useCallback(() => {
    setSubSteps((prev) => {
      const newStep: SubStep = {
        id: `sub_${Date.now()}`,
        text: '',
        completed: false,
        sort_order: prev.length,
      };
      return [...prev, newStep];
    });
  }, []);

  const handleRemoveSubStep = useCallback((id: string) => {
    setSubSteps((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Refs for delayed focus on web
  const whyInputRef = useRef<TextInput>(null);
  const whatInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (editingSection === 'why' && whyInputRef.current) {
      setTimeout(() => whyInputRef.current?.focus(), 100);
    }
    if (editingSection === 'what' && whatInputRef.current) {
      setTimeout(() => whatInputRef.current?.focus(), 100);
    }
  }, [editingSection]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={STEP_COLORS.accent} />
        </Pressable>
        <View style={styles.headerTextGroup}>
          <Ionicons name="sparkles" size={16} color={IOS_COLORS.systemPurple} />
          <Text style={styles.headerTitle}>Structured Plan</Text>
        </View>
      </View>

      <Text style={styles.headerSubtitle}>
        Review and edit the plan below, then confirm to save.
      </Text>

      {/* Suggested title */}
      <View style={styles.titleSection}>
        <Text style={styles.titleLabel}>Suggested title</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Step title..."
          placeholderTextColor={STEP_COLORS.tertiaryLabel}
        />
      </View>

      {/* What */}
      <ReviewSection
        icon="bulb-outline"
        label="What"
        isEditing={editingSection === 'what'}
        onToggleEdit={() => toggleEdit('what')}
      >
        {editingSection === 'what' ? (
          <TextInput
            ref={whatInputRef}
            style={styles.editTextArea}
            value={what}
            onChangeText={setWhat}
            multiline
            textAlignVertical="top"
          />
        ) : (
          <Text style={styles.fieldText}>{what || 'No description'}</Text>
        )}
      </ReviewSection>

      {/* How */}
      <ReviewSection
        icon="list-outline"
        label="How"
        isEditing={editingSection === 'how'}
        onToggleEdit={() => toggleEdit('how')}
      >
        {subSteps.map((step, i) => (
          <View key={step.id} style={styles.subStepRow}>
            <View style={styles.subStepCheckbox}>
              <Text style={styles.subStepNumber}>{i + 1}</Text>
            </View>
            {editingSection === 'how' ? (
              <>
                <TextInput
                  style={[styles.subStepInput, { flex: 1 }]}
                  value={step.text}
                  onChangeText={(t) => handleSubStepTextChange(step.id, t)}
                  multiline
                  placeholder="Describe this step..."
                  placeholderTextColor={STEP_COLORS.tertiaryLabel}
                />
                <Pressable onPress={() => handleRemoveSubStep(step.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={IOS_COLORS.systemGray3} />
                </Pressable>
              </>
            ) : (
              <Text style={styles.subStepText}>{step.text}</Text>
            )}
          </View>
        ))}
        {editingSection === 'how' && (
          <Pressable style={styles.addSubStepButton} onPress={handleAddSubStep}>
            <Ionicons name="add-circle-outline" size={16} color={STEP_COLORS.accent} />
            <Text style={styles.addSubStepText}>Add step</Text>
          </Pressable>
        )}
        {subSteps.length === 0 && editingSection !== 'how' && (
          <Text style={styles.emptyText}>No sub-steps — tap Edit to add</Text>
        )}
      </ReviewSection>

      {/* Why */}
      <ReviewSection
        icon="help-circle-outline"
        label="Why"
        isEditing={editingSection === 'why'}
        onToggleEdit={() => toggleEdit('why')}
      >
        {editingSection === 'why' ? (
          <TextInput
            ref={whyInputRef}
            style={styles.editTextArea}
            value={why}
            onChangeText={setWhy}
            multiline
            textAlignVertical="top"
            placeholder="Why is this important? What are you working toward?"
            placeholderTextColor={STEP_COLORS.tertiaryLabel}
          />
        ) : (
          <Text style={styles.fieldText}>{why || 'No reasoning — tap Edit to add'}</Text>
        )}
      </ReviewSection>

      {/* Who */}
      <ReviewSection
        icon="people-outline"
        label="Who"
        isEditing={editingSection === 'who'}
        onToggleEdit={() => toggleEdit('who')}
      >
        {editingSection === 'who' ? (
          <TextInput
            style={styles.editInput}
            value={who}
            onChangeText={setWho}
            placeholder="Names separated by commas..."
            placeholderTextColor={STEP_COLORS.tertiaryLabel}
            autoFocus
          />
        ) : (
          <View style={styles.peoplePills}>
            {who
              .split(/,\s*/)
              .filter(Boolean)
              .map((name) => (
                <View key={name} style={styles.personPill}>
                  <Ionicons name="person" size={12} color={STEP_COLORS.accent} />
                  <Text style={styles.personPillText}>{name}</Text>
                </View>
              ))}
            {!who.trim() && <Text style={styles.emptyText}>No collaborators</Text>}
          </View>
        )}
      </ReviewSection>

      {/* Capability goals */}
      {planData.capability_goals && planData.capability_goals.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
            <Ionicons name="trophy-outline" size={16} color={STEP_COLORS.label} />
            <Text style={styles.sectionLabel}>Skills</Text>
          </View>
          <View style={styles.peoplePills}>
            {planData.capability_goals.map((goal) => (
              <View key={goal} style={styles.goalPill}>
                <Text style={styles.goalPillText}>{goal}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Entity resolution loading indicator */}
      {isResolvingEntities && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
          <ActivityIndicator size="small" color={IOS_COLORS.systemIndigo} />
          <Text style={{ fontSize: 13, color: STEP_COLORS.secondaryLabel, fontStyle: 'italic' }}>
            Recognizing equipment, people, locations...
          </Text>
        </View>
      )}

      {/* Resolved entities */}
      {resolvedEntities && resolvedEntities.length > 0 && (
        <>
          {/* Equipment entities */}
          {resolvedEntities.filter((e): e is ExtractedEquipmentEntity => e.type === 'equipment').length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
                <Ionicons name="build-outline" size={16} color={STEP_COLORS.label} />
                <Text style={styles.sectionLabel}>Equipment</Text>
              </View>
              <View style={styles.peoplePills}>
                {resolvedEntities
                  .filter((e): e is ExtractedEquipmentEntity => e.type === 'equipment')
                  .map((eq) => (
                    <View key={eq.raw_text} style={styles.equipmentPill}>
                      <Ionicons name="build" size={12} color={IOS_COLORS.systemOrange} />
                      <Text style={styles.equipmentPillText}>
                        {eq.resolved_name || eq.raw_text}
                      </Text>
                      {eq.ownership !== 'unknown' && (
                        <View style={[
                          styles.ownershipBadge,
                          eq.ownership === 'mine' ? styles.ownershipMine : styles.ownershipNeeded,
                        ]}>
                          <Text style={styles.ownershipText}>{eq.ownership}</Text>
                        </View>
                      )}
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Location entities */}
          {resolvedEntities.filter((e): e is ExtractedLocationEntity => e.type === 'location').length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
                <Ionicons name="location-outline" size={16} color={STEP_COLORS.label} />
                <Text style={styles.sectionLabel}>Location</Text>
              </View>
              <View style={styles.peoplePills}>
                {resolvedEntities
                  .filter((e): e is ExtractedLocationEntity => e.type === 'location')
                  .map((loc) => (
                    <View key={loc.raw_text} style={styles.locationPill}>
                      <Ionicons name="location" size={12} color={IOS_COLORS.systemGreen} />
                      <Text style={styles.locationPillText}>
                        {loc.resolved_name || loc.raw_text}
                      </Text>
                      {loc.venue_id && (
                        <Ionicons name="checkmark-circle" size={12} color={IOS_COLORS.systemGreen} />
                      )}
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Ambiguous people resolution */}
          {resolvedEntities
            .filter((e): e is ExtractedPersonEntity => e.type === 'person' && e.confidence === 'ambiguous')
            .map((person) => (
              <View key={person.raw_text} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="help-circle-outline" size={16} color={IOS_COLORS.systemOrange} />
                  <Text style={styles.sectionLabel}>Did you mean "{person.raw_text}"?</Text>
                </View>
                <View style={styles.disambiguationOptions}>
                  {person.ambiguous_matches?.map((match) => (
                    <Pressable
                      key={match.user_id}
                      style={styles.disambiguationOption}
                      onPress={() => onResolveAmbiguousPerson?.(person.raw_text, match.user_id, match.display_name)}
                    >
                      <Text style={styles.disambiguationEmoji}>{match.avatar_emoji || '👤'}</Text>
                      <Text style={styles.disambiguationName}>{match.display_name}</Text>
                    </Pressable>
                  ))}
                  <Pressable style={styles.disambiguationOption}>
                    <Text style={styles.disambiguationName}>Not on BetterAt</Text>
                  </Pressable>
                </View>
              </View>
            ))}
        </>
      )}

      {/* Date enrichment card (weather/tide/rig) */}
      {(() => {
        const dateEntities = resolvedEntities?.filter(
          (e): e is ExtractedDateEntity => e.type === 'date',
        ) ?? [];
        const firstDate = dateEntities[0];
        if (!firstDate && !isEnrichingDate) return null;
        return (
          <DateEnrichmentCard
            dateLabel={firstDate?.raw_text ?? ''}
            dateIso={firstDate?.parsed_iso ?? ''}
            enrichment={dateEnrichment}
            isLoading={isEnrichingDate}
          />
        );
      })()}

      {/* Confirm button */}
      <View style={styles.actions}>
        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          <Text style={styles.confirmButtonText}>Looks good</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: IOS_SPACING.md,
    paddingBottom: 100,
    gap: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: STEP_COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: STEP_COLORS.label,
  },
  headerSubtitle: {
    fontSize: 13,
    color: STEP_COLORS.secondaryLabel,
    marginTop: -8,
  },
  titleSection: {
    gap: 4,
  },
  titleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: STEP_COLORS.secondaryLabel,
    letterSpacing: 0.3,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: STEP_COLORS.label,
    backgroundColor: STEP_COLORS.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STEP_COLORS.cardBorder,
    padding: IOS_SPACING.sm,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  section: {
    backgroundColor: STEP_COLORS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STEP_COLORS.cardBorder,
    padding: IOS_SPACING.sm,
    gap: IOS_SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: STEP_COLORS.label,
  },
  editButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
  fieldText: {
    fontSize: 14,
    color: STEP_COLORS.label,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 13,
    color: STEP_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  editTextArea: {
    fontSize: 14,
    color: STEP_COLORS.label,
    backgroundColor: STEP_COLORS.pageBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STEP_COLORS.border,
    padding: IOS_SPACING.sm,
    minHeight: 80,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'vertical' } as any,
    }),
  },
  editInput: {
    fontSize: 14,
    color: STEP_COLORS.label,
    backgroundColor: STEP_COLORS.pageBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STEP_COLORS.border,
    padding: IOS_SPACING.sm,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  subStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  subStepCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: STEP_COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  subStepNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: STEP_COLORS.accent,
  },
  subStepText: {
    flex: 1,
    fontSize: 14,
    color: STEP_COLORS.label,
    lineHeight: 20,
  },
  subStepInput: {
    flex: 1,
    fontSize: 14,
    color: STEP_COLORS.label,
    backgroundColor: STEP_COLORS.pageBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STEP_COLORS.border,
    padding: IOS_SPACING.xs,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  addSubStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  addSubStepText: {
    fontSize: 13,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
  peoplePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.xs,
  },
  personPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: STEP_COLORS.accentLight,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  personPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_COLORS.accent,
  },
  goalPill: {
    backgroundColor: 'rgba(255,149,0,0.1)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  goalPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemOrange,
  },
  equipmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,149,0,0.08)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  equipmentPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemOrange,
  },
  ownershipBadge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ownershipMine: {
    backgroundColor: 'rgba(52,199,89,0.12)',
  },
  ownershipNeeded: {
    backgroundColor: 'rgba(255,59,48,0.08)',
  },
  ownershipText: {
    fontSize: 10,
    fontWeight: '600',
    color: STEP_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  locationPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemGreen,
  },
  disambiguationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.xs,
  },
  disambiguationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: STEP_COLORS.pageBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: STEP_COLORS.border,
  },
  disambiguationEmoji: {
    fontSize: 16,
  },
  disambiguationName: {
    fontSize: 13,
    fontWeight: '500',
    color: STEP_COLORS.label,
  },
  actions: {
    marginTop: IOS_SPACING.sm,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: STEP_COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(61,138,90,0.25)' } as any,
      default: {
        shadowColor: STEP_COLORS.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
