/**
 * BrainDumpEntry — Unstructured "dump first, structure later" entry for steps.
 *
 * Single large text area with real-time URL detection, people pill extraction,
 * and a "Structure with AI" CTA. Replaces the old blank 4Q form as the default
 * entry point for new steps.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { BrainDumpPreview } from './BrainDumpPreview';
import { PersonPill } from './PersonPill';
import {
  parseBrainDump,
  enrichUrls,
  type ParsedBrainDump,
} from '@/services/ai/BrainDumpAIService';
import { usePeopleResolver } from '@/hooks/usePeopleResolver';
import type { ExtractedUrl, BrainDumpData } from '@/types/step-detail';

interface BrainDumpEntryProps {
  /** Existing brain dump data (if resuming a draft) */
  initialData?: BrainDumpData;
  /** Called when the user taps "Structure with AI" */
  onStructureWithAI: (brainDump: BrainDumpData) => void;
  /** Called on every text change for auto-save */
  onDraftChange?: (brainDump: BrainDumpData) => void;
  /** Whether AI structuring is in progress */
  isStructuring?: boolean;
  /** Interest slug for interest-aware entity extraction */
  interestSlug?: string;
  /** When true, renders as a plain View instead of ScrollView (for embedding in parent scroll) */
  embedded?: boolean;
}

export function BrainDumpEntry({
  initialData,
  onStructureWithAI,
  onDraftChange,
  isStructuring = false,
  interestSlug,
  embedded = false,
}: BrainDumpEntryProps) {
  const [text, setText] = useState(initialData?.raw_text ?? '');
  const [parsed, setParsed] = useState<ParsedBrainDump>({
    extracted_urls: initialData?.extracted_urls ?? [],
    extracted_people: initialData?.extracted_people ?? [],
    extracted_topics: initialData?.extracted_topics ?? [],
    extracted_dates: initialData?.extracted_dates ?? [],
    extracted_equipment: initialData?.extracted_equipment ?? [],
    extracted_locations: initialData?.extracted_locations ?? [],
  });
  const [enrichedUrls, setEnrichedUrls] = useState<ExtractedUrl[]>(
    initialData?.extracted_urls ?? [],
  );
  const [isEnriching, setIsEnriching] = useState(false);

  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enrichTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse text on change (debounced 300ms)
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);

    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    parseTimerRef.current = setTimeout(() => {
      const result = parseBrainDump(newText, interestSlug);
      setParsed(result);

      // If new URLs detected, enrich them (debounced further)
      if (result.extracted_urls.length > 0) {
        if (enrichTimerRef.current) clearTimeout(enrichTimerRef.current);
        enrichTimerRef.current = setTimeout(async () => {
          setIsEnriching(true);
          try {
            const enriched = await enrichUrls(result.extracted_urls);
            setEnrichedUrls(enriched);
          } catch {
            setEnrichedUrls(result.extracted_urls);
          } finally {
            setIsEnriching(false);
          }
        }, 500);
      } else {
        setEnrichedUrls([]);
      }
    }, 300);

    // Auto-save draft (debounced 800ms)
    if (onDraftChange) {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        const result = parseBrainDump(newText, interestSlug);
        onDraftChange({
          raw_text: newText,
          extracted_urls: result.extracted_urls,
          extracted_people: result.extracted_people,
          extracted_topics: result.extracted_topics,
          extracted_dates: result.extracted_dates,
          extracted_equipment: result.extracted_equipment,
          extracted_locations: result.extracted_locations,
          source_step_id: initialData?.source_step_id,
          source_review_notes: initialData?.source_review_notes,
          created_at: initialData?.created_at ?? new Date().toISOString(),
        });
      }, 800);
    }
  }, [initialData, onDraftChange, interestSlug]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
      if (enrichTimerRef.current) clearTimeout(enrichTimerRef.current);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, []);

  // Resolve extracted people names against platform users
  const { resolvedPeople, selectMatch, dismissPerson } = usePeopleResolver(parsed.extracted_people);

  const buildBrainDumpData = useCallback((): BrainDumpData => {
    const latest = parseBrainDump(text, interestSlug);

    // Build resolved person entities from profile-linked people
    const personEntities = resolvedPeople
      .filter((p) => p.status === 'exact' && p.match)
      .map((p) => ({
        raw_text: p.raw_name,
        type: 'person' as const,
        matched_user_id: p.match!.user_id,
        matched_display_name: p.match!.display_name,
        confidence: 'exact' as const,
      }));

    return {
      raw_text: text,
      extracted_urls: enrichedUrls.length > 0 ? enrichedUrls : latest.extracted_urls,
      extracted_people: latest.extracted_people,
      extracted_topics: latest.extracted_topics,
      extracted_dates: latest.extracted_dates,
      extracted_equipment: latest.extracted_equipment,
      extracted_locations: latest.extracted_locations,
      extracted_entities: personEntities.length > 0 ? personEntities : undefined,
      source_step_id: initialData?.source_step_id,
      source_review_notes: initialData?.source_review_notes,
      created_at: initialData?.created_at ?? new Date().toISOString(),
    };
  }, [text, enrichedUrls, initialData, interestSlug, resolvedPeople]);

  const handleStructure = useCallback(() => {
    onStructureWithAI(buildBrainDumpData());
  }, [onStructureWithAI, buildBrainDumpData]);

  const handleRemoveUrl = useCallback((urlToRemove: string) => {
    setEnrichedUrls((prev) => prev.filter((u) => u.url !== urlToRemove));
    // Also remove from text
    setText((prev) => prev.replace(urlToRemove, '').replace(/\n{3,}/g, '\n\n').trim());
  }, []);

  const hasContent = text.trim().length > 0;
  const displayUrls = enrichedUrls.length > 0 ? enrichedUrls : parsed.extracted_urls;

  const Wrapper = embedded ? View : ScrollView;
  const wrapperProps = embedded
    ? { style: [styles.content, { paddingBottom: IOS_SPACING.sm }] }
    : { style: styles.container, contentContainerStyle: styles.content, showsVerticalScrollIndicator: false, keyboardShouldPersistTaps: 'handled' as const };

  return (
    <Wrapper {...wrapperProps}>
      {/* Seed card from previous step */}
      {initialData?.source_review_notes && (
        <View style={styles.seedCard}>
          <View style={styles.seedHeader}>
            <Ionicons name="arrow-redo-outline" size={14} color={STEP_COLORS.coral} />
            <Text style={styles.seedLabel}>From your last session</Text>
          </View>
          <Text style={styles.seedText}>{initialData.source_review_notes}</Text>
        </View>
      )}

      {/* Main text area */}
      <View style={styles.textAreaWrapper}>
        <TextInput
          style={styles.textArea}
          value={text}
          onChangeText={handleTextChange}
          placeholder={"What's on your mind? Paste links, jot notes from last session, mention who you're practicing with..."}
          placeholderTextColor={STEP_COLORS.tertiaryLabel}
          multiline
          textAlignVertical="top"
          autoFocus={!initialData?.raw_text}
        />
      </View>

      {/* Detected URLs */}
      {displayUrls.length > 0 && (
        <View style={styles.section}>
          <BrainDumpPreview urls={displayUrls} onRemove={handleRemoveUrl} />
          {isEnriching && (
            <View style={styles.enrichingRow}>
              <ActivityIndicator size="small" color={STEP_COLORS.accent} />
              <Text style={styles.enrichingText}>Fetching link details...</Text>
            </View>
          )}
        </View>
      )}

      {/* Detected people (profile-linked) */}
      {resolvedPeople.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={14} color={STEP_COLORS.secondaryLabel} />
            <Text style={styles.sectionLabel}>People Mentioned</Text>
          </View>
          <View style={styles.pillRow}>
            {resolvedPeople.map((person) => (
              <PersonPill
                key={person.raw_name}
                person={person}
                onSelect={selectMatch}
                onDismiss={dismissPerson}
              />
            ))}
          </View>
        </View>
      )}

      {/* Detected topics */}
      {parsed.extracted_topics.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={14} color={STEP_COLORS.secondaryLabel} />
            <Text style={styles.sectionLabel}>Topics Detected</Text>
          </View>
          <View style={styles.pillRow}>
            {[...new Set(parsed.extracted_topics)].map((topic) => (
              <View key={topic} style={styles.topicPill}>
                <Text style={styles.topicPillText}>{topic}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Detected dates */}
      {parsed.extracted_dates.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={14} color={STEP_COLORS.secondaryLabel} />
            <Text style={styles.sectionLabel}>Dates Detected</Text>
          </View>
          <View style={styles.pillRow}>
            {parsed.extracted_dates.map((d) => (
              <View key={d.rough_iso} style={styles.datePill}>
                <Ionicons name="calendar" size={12} color={IOS_COLORS.systemIndigo} />
                <Text style={styles.datePillText}>{d.raw}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Detected equipment */}
      {parsed.extracted_equipment.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="build-outline" size={14} color={STEP_COLORS.secondaryLabel} />
            <Text style={styles.sectionLabel}>Equipment Detected</Text>
          </View>
          <View style={styles.pillRow}>
            {parsed.extracted_equipment.map((eq) => (
              <View key={eq} style={styles.equipmentPill}>
                <Ionicons name="build" size={12} color={IOS_COLORS.systemOrange} />
                <Text style={styles.equipmentPillText}>{eq}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Detected locations */}
      {parsed.extracted_locations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={14} color={STEP_COLORS.secondaryLabel} />
            <Text style={styles.sectionLabel}>Locations Detected</Text>
          </View>
          <View style={styles.pillRow}>
            {parsed.extracted_locations.map((loc) => (
              <View key={loc} style={styles.locationPill}>
                <Ionicons name="location" size={12} color={IOS_COLORS.systemGreen} />
                <Text style={styles.locationPillText}>{loc}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.structureButton, (!hasContent || isStructuring) && styles.structureButtonDisabled]}
          onPress={handleStructure}
          disabled={!hasContent || isStructuring}
        >
          {isStructuring ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons
              name="sparkles"
              size={18}
              color={hasContent ? '#FFFFFF' : IOS_COLORS.systemGray3}
            />
          )}
          <Text
            style={[
              styles.structureButtonText,
              (!hasContent || isStructuring) && styles.structureButtonTextDisabled,
            ]}
          >
            {isStructuring ? 'Structuring...' : 'Structure'}
          </Text>
        </Pressable>

      </View>
    </Wrapper>
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
  seedCard: {
    backgroundColor: STEP_COLORS.coralLight,
    borderRadius: 12,
    padding: IOS_SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(216,149,117,0.20)',
  },
  seedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  seedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: STEP_COLORS.coral,
    letterSpacing: 0.3,
  },
  seedText: {
    fontSize: 14,
    color: STEP_COLORS.label,
    lineHeight: 20,
  },
  textAreaWrapper: {
    backgroundColor: STEP_COLORS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STEP_COLORS.cardBorder,
    overflow: 'hidden',
  },
  textArea: {
    fontSize: 15,
    color: STEP_COLORS.label,
    padding: IOS_SPACING.md,
    minHeight: 180,
    lineHeight: 22,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        resize: 'vertical',
      } as any,
    }),
  },
  section: {
    gap: IOS_SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: STEP_COLORS.secondaryLabel,
    letterSpacing: 0.3,
  },
  enrichingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  enrichingText: {
    fontSize: 12,
    color: STEP_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.xs,
  },
  topicPill: {
    backgroundColor: 'rgba(175,82,222,0.08)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  topicPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.systemPurple,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(88,86,214,0.08)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  datePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemIndigo,
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
  actions: {
    gap: IOS_SPACING.sm,
    marginTop: IOS_SPACING.sm,
  },
  structureButton: {
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
  structureButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray5,
    ...Platform.select({
      web: { boxShadow: 'none' } as any,
      default: {
        shadowOpacity: 0,
        elevation: 0,
      },
    }),
  },
  structureButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  structureButtonTextDisabled: {
    color: IOS_COLORS.systemGray3,
  },
});
