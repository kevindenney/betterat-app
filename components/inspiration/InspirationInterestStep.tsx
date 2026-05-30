/**
 * InspirationInterestStep — Step 2 of the wizard.
 *
 * Reveal screen: icon + name hero, editable details, color picker, overlaps.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { resolveIonicon } from './resolveIonicon';
import type {
  InspirationExtraction,
  InspirationInterestReview,
  ProposedInterest,
} from '@/types/inspiration';
import type { Interest } from '@/providers/InterestProvider';

interface InspirationInterestStepProps {
  extraction: InspirationExtraction;
  userInterests: Interest[];
  initialEdits: Partial<ProposedInterest>;
  initialSelectedExistingInterestId?: string | null;
  onComplete: (review: InspirationInterestReview) => void;
}

const COLOR_OPTIONS = [
  '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF3B30',
  '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#5AC8FA',
  '#A2845E', '#8E8E93',
];

export function InspirationInterestStep({
  extraction,
  userInterests,
  initialEdits,
  initialSelectedExistingInterestId = null,
  onComplete,
}: InspirationInterestStepProps) {
  const proposed = extraction.proposed_interest;

  const [name, setName] = useState(initialEdits.name ?? proposed.name);
  const [description, setDescription] = useState(
    initialEdits.description ?? proposed.description,
  );
  const [accentColor, setAccentColor] = useState(
    initialEdits.accent_color ?? proposed.accent_color,
  );
  const [selectedExistingInterestId, setSelectedExistingInterestId] = useState<string | null>(
    initialSelectedExistingInterestId,
  );
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);

  const aiSuggestedColor = proposed.accent_color;
  const overlaps = extraction.existing_interest_overlaps ?? [];
  const overlapMap = new Map(overlaps.map((overlap) => [overlap.slug, overlap]));
  const rankedExistingInterests = [...userInterests].sort((a, b) => {
    const aScore = overlapMap.has(a.slug) ? 1 : 0;
    const bScore = overlapMap.has(b.slug) ? 1 : 0;
    return bScore - aScore || a.name.localeCompare(b.name);
  });
  const selectedExistingInterest = rankedExistingInterests.find(
    (interest) => interest.id === selectedExistingInterestId,
  ) ?? null;
  const usingExistingInterest = !!selectedExistingInterest;
  const activeAccentColor = usingExistingInterest
    ? selectedExistingInterest.accent_color
    : accentColor;
  const activeName = usingExistingInterest
    ? selectedExistingInterest.name
    : name;
  const activeDescription = usingExistingInterest
    ? selectedExistingInterest.description?.trim() || 'We’ll add this generated plan to your existing interest.'
    : description;
  const activeIconName = resolveIonicon(
    usingExistingInterest
      ? selectedExistingInterest.icon_name ?? proposed.icon_name
      : initialEdits.icon_name ?? proposed.icon_name,
  );

  const handleContinue = () => {
    if (selectedExistingInterest) {
      onComplete({
        interestEdits: {},
        selectedExistingInterestId: selectedExistingInterest.id,
      });
      return;
    }

    const edits: Partial<ProposedInterest> = {};
    if (name !== proposed.name) edits.name = name;
    if (description !== proposed.description) edits.description = description;
    if (accentColor !== proposed.accent_color) edits.accent_color = accentColor;
    if (name !== proposed.name) {
      edits.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
    onComplete({
      interestEdits: edits,
      selectedExistingInterestId: null,
    });
  };

  return (
    <View style={styles.outer}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={[styles.iconBox, { backgroundColor: activeAccentColor }]}>
            <Ionicons name={activeIconName} size={32} color="#fff" />
          </View>

          {!usingExistingInterest && editingName ? (
            <TextInput
              style={[styles.heroTitle, styles.heroTitleEditing, { color: activeAccentColor }]}
              value={name}
              onChangeText={setName}
              onBlur={() => setEditingName(false)}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => setEditingName(false)}
            />
          ) : (
            usingExistingInterest ? (
              <View style={styles.editableRow}>
                <Text style={[styles.heroTitle, { color: activeAccentColor }]}>{activeName}</Text>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} style={styles.editableRow}>
                <Text style={[styles.heroTitle, { color: activeAccentColor }]}>{activeName}</Text>
                <Ionicons name="pencil" size={13} color={IOS_COLORS.tertiaryLabel} style={styles.pencilIcon} />
              </Pressable>
            )
          )}

          {/* Mini switcher preview */}
          <View style={styles.switcher}>
            <View style={[styles.switcherDot, { backgroundColor: activeAccentColor }]} />
            <Text style={styles.switcherText} numberOfLines={1}>{activeName}</Text>
            <Ionicons name="checkmark" size={13} color={IOS_COLORS.tertiaryLabel} />
          </View>
        </View>

        {/* ── Source summary ── */}
        {extraction.source_summary ? (
          <View style={styles.summaryCard}>
            <Ionicons name="sparkles" size={13} color={IOS_COLORS.systemBlue} style={{ marginTop: 2 }} />
            <Text style={styles.summaryText} numberOfLines={3}>
              {extraction.source_summary}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.label}>ADD THIS PLAN TO</Text>
          <View style={styles.destinationList}>
            <Pressable
              onPress={() => setSelectedExistingInterestId(null)}
              style={[
                styles.destinationCard,
                !usingExistingInterest && styles.destinationCardActive,
              ]}
            >
              <View style={styles.destinationCopy}>
                <Text style={styles.destinationTitle}>Create a new interest</Text>
                <Text style={styles.destinationSubtitle} numberOfLines={2}>
                  {proposed.name}
                </Text>
              </View>
              <View style={[
                styles.destinationRadio,
                !usingExistingInterest && styles.destinationRadioActive,
              ]}>
                {!usingExistingInterest ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : null}
              </View>
            </Pressable>

            {rankedExistingInterests.map((interest) => {
              const overlap = overlapMap.get(interest.slug);
              const selected = selectedExistingInterestId === interest.id;
              return (
                <Pressable
                  key={interest.id}
                  onPress={() => setSelectedExistingInterestId(interest.id)}
                  style={[
                    styles.destinationCard,
                    selected && styles.destinationCardActive,
                  ]}
                >
                  <View style={styles.destinationLeading}>
                    <View style={[styles.destinationDot, { backgroundColor: interest.accent_color }]} />
                  </View>
                  <View style={styles.destinationCopy}>
                    <Text style={styles.destinationTitle}>{interest.name}</Text>
                    <Text style={styles.destinationSubtitle} numberOfLines={2}>
                      {overlap?.relevance || interest.description || 'Add this generated plan to your existing interest.'}
                    </Text>
                  </View>
                  <View style={[
                    styles.destinationRadio,
                    selected && styles.destinationRadioActive,
                  ]}>
                    {selected ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Description ── */}
        <View style={styles.section}>
          <Text style={styles.label}>{usingExistingInterest ? 'CURRENT INTEREST' : 'ABOUT'}</Text>
          {!usingExistingInterest && editingDescription ? (
            <TextInput
              style={styles.descInput}
              value={description}
              onChangeText={setDescription}
              onBlur={() => setEditingDescription(false)}
              autoFocus
              multiline
              textAlignVertical="top"
            />
          ) : (
            usingExistingInterest ? (
              <View style={styles.selectedInterestCard}>
                <Text style={styles.descText}>{activeDescription}</Text>
              </View>
            ) : (
              <Pressable onPress={() => setEditingDescription(true)} style={styles.editableRow}>
                <Text style={styles.descText}>{activeDescription}</Text>
                <Ionicons name="pencil" size={12} color={IOS_COLORS.tertiaryLabel} style={styles.pencilIcon} />
              </Pressable>
            )
          )}
        </View>

        {/* ── Color ── */}
        {!usingExistingInterest && (
          <View style={styles.section}>
            <Text style={styles.label}>COLOR</Text>
            <View style={styles.colorGrid}>
              {!COLOR_OPTIONS.includes(aiSuggestedColor) && (
                <Pressable
                  onPress={() => setAccentColor(aiSuggestedColor)}
                  style={[
                    styles.swatch,
                    { backgroundColor: aiSuggestedColor },
                    accentColor === aiSuggestedColor && styles.swatchActive,
                  ]}
                >
                  {accentColor === aiSuggestedColor ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Ionicons name="sparkles" size={10} color="#fff" />
                  )}
                </Pressable>
              )}
              {COLOR_OPTIONS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setAccentColor(color)}
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    accentColor === color && styles.swatchActive,
                  ]}
                >
                  {accentColor === color && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                  {color === aiSuggestedColor && accentColor !== color && (
                    <Ionicons name="sparkles" size={10} color="rgba(255,255,255,0.8)" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Overlaps ── */}
        {overlaps.length > 0 && (
          <View style={styles.section}>
            <View style={styles.overlapHeader}>
              <Ionicons name="git-merge-outline" size={14} color={IOS_COLORS.systemBlue} />
              <Text style={styles.label}>CONNECTS TO YOUR INTERESTS</Text>
            </View>
            <View style={styles.chipRow}>
              {overlaps.map((o) => (
                <View key={o.slug} style={styles.chip}>
                  <View style={[styles.chipDot, { backgroundColor: IOS_COLORS.systemBlue }]} />
                  <Text style={styles.chipText}>{o.slug.replace(/-/g, ' ')}</Text>
                </View>
              ))}
            </View>
            {overlaps.some((o) => o.relevance) && (
              <View style={styles.overlapNotes}>
                {overlaps.map((o) =>
                  o.relevance ? (
                    <Text key={`r-${o.slug}`} style={styles.overlapNote}>
                      <Text style={styles.overlapSlug}>{o.slug.replace(/-/g, ' ')}</Text>
                      {' \u2014 '}
                      {o.relevance}
                    </Text>
                  ) : null,
                )}
              </View>
            )}
          </View>
        )}

        {/* Confidence */}
        {extraction.confidence != null && (
          <View style={styles.confidence}>
            <Ionicons name="shield-checkmark-outline" size={13} color={IOS_COLORS.systemGreen} />
            <Text style={styles.confidenceText}>
              {Math.round(extraction.confidence * 100)}% match confidence
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Footer ── */}
        <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          style={[styles.cta, { backgroundColor: activeAccentColor }]}
        >
          <Text style={styles.ctaText}>
            {usingExistingInterest ? 'Use This Interest' : 'Looks Good'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 28,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroTitleEditing: {
    borderBottomWidth: 2,
    paddingBottom: 2,
    minWidth: 200,
  },
  editableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pencilIcon: {
    marginTop: 2,
  },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  switcherDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  switcherText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },

  // ── Summary ──
  summaryCard: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: `${IOS_COLORS.systemBlue}06`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.systemBlue}12`,
    marginBottom: 28,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 19,
  },

  // ── Sections ──
  section: {
    marginBottom: 24,
  },
  destinationList: {
    gap: 10,
  },
  destinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  destinationCardActive: {
    borderColor: IOS_COLORS.systemBlue,
    backgroundColor: `${IOS_COLORS.systemBlue}0D`,
  },
  destinationLeading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  destinationCopy: {
    flex: 1,
    minWidth: 0,
  },
  destinationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  destinationSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  destinationRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.separator,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemBackground,
  },
  destinationRadioActive: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderColor: IOS_COLORS.systemBlue,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // ── Description ──
  descText: {
    fontSize: 15,
    color: IOS_COLORS.label,
    lineHeight: 22,
  },
  descInput: {
    fontSize: 15,
    color: IOS_COLORS.label,
    lineHeight: 22,
    padding: 12,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemBlue,
    minHeight: 64,
  },
  selectedInterestCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },

  // ── Color ──
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },

  // ── Overlaps ──
  overlapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${IOS_COLORS.systemBlue}14`,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.systemBlue}22`,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
    textTransform: 'capitalize',
  },
  overlapNotes: {
    marginTop: 12,
    paddingLeft: 2,
  },
  overlapNote: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 19,
    marginBottom: 4,
  },
  overlapSlug: {
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
    textTransform: 'capitalize',
  },

  // ── Confidence ──
  confidence: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  confidenceText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 24,
    paddingTop: IOS_SPACING.m,
    paddingBottom: IOS_SPACING.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
