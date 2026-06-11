/**
 * RaceLocalKnowledgeAdder — the compact "add to local knowledge" chip card
 * shown on a race step's Do and Review tabs.
 *
 * The local-knowledge layer is homed on the race area in Atlas; this surface
 * only *appends* to it. `phase` distinguishes in-the-moment captures on the Do
 * tab ('live') from post-race notes on the Review tab ('review'). A tapped
 * template also lands in Do observations so it shows in the running log.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { useStepDetail } from '@/hooks/useStepDetail';
import { useRaceStartTracking } from '@/hooks/useRaceStartTracking';
import { LOCAL_KNOWLEDGE_TEMPLATES } from '@/lib/atlasRaceStep';
import type {
  AtlasRaceNoteKind,
  AtlasRaceNotePhase,
  StepActData,
  StepMetadata,
} from '@/types/step-detail';

interface RaceLocalKnowledgeAdderProps {
  stepId: string;
  phase?: AtlasRaceNotePhase;
  readOnly?: boolean;
}

export function RaceLocalKnowledgeAdder({ stepId, phase = 'live', readOnly }: RaceLocalKnowledgeAdderProps) {
  const { data: step } = useStepDetail(stepId);
  if (!step) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={IOS_COLORS.secondaryLabel} />
      </View>
    );
  }
  return <AdderBody step={step} phase={phase} readOnly={readOnly} />;
}

function AdderBody({
  step,
  phase,
  readOnly,
}: {
  step: NonNullable<ReturnType<typeof useStepDetail>['data']>;
  phase: AtlasRaceNotePhase;
  readOnly?: boolean;
}) {
  const metadata = (step.metadata ?? {}) as StepMetadata;
  const act = useMemo(
    () => ((metadata.act ?? (step.metadata as any)?.act_data ?? {}) as StepActData) ?? {},
    [metadata.act, step.metadata],
  );
  const { appendStampedNote } = useRaceStartTracking(step, act);

  const [draft, setDraft] = useState('');
  const [addedKinds, setAddedKinds] = useState<Set<AtlasRaceNoteKind>>(new Set());
  const [draftAddedCount, setDraftAddedCount] = useState(0);

  // Where this note lands in Atlas: explicit race-area choice from the race
  // plan first, then the step's own location. When neither exists the note
  // has no anchor — say so instead of implying it attached somewhere.
  const areaLabel =
    metadata.race_plan?.area_name ?? step.location_name ?? null;

  const handleChip = (kind: AtlasRaceNoteKind, text: string) => {
    appendStampedNote(text, phase);
    setAddedKinds((prev) => new Set(prev).add(kind));
  };

  const handleAddDraft = () => {
    const text = draft.trim();
    if (!text) return;
    appendStampedNote(text, phase);
    setDraft('');
    setDraftAddedCount((n) => n + 1);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>ADD TO LOCAL KNOWLEDGE</Text>
      <Text style={styles.body}>
        {phase === 'review'
          ? 'Tap a tag or write your own — each one saves a note to this course’s local-knowledge layer in Atlas.'
          : 'Tap a tag in the moment. It saves to Do observations and attaches to this course’s local-knowledge layer in Atlas.'}
      </Text>
      <View style={styles.chipRow}>
        {LOCAL_KNOWLEDGE_TEMPLATES.map((template) => {
          const added = addedKinds.has(template.kind);
          return (
            <Pressable
              key={template.kind}
              style={[styles.chip, added && styles.chipAdded, readOnly && styles.chipDisabled]}
              onPress={() => handleChip(template.kind, template.text)}
              disabled={readOnly}
              accessibilityRole="button"
              accessibilityLabel={`Add note: ${template.label}`}
            >
              {added && (
                <Ionicons name="checkmark" size={12} color={IOS_COLORS.systemGreen} />
              )}
              <Text style={[styles.chipText, added && styles.chipTextAdded]}>
                {template.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!readOnly && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add your own note…"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            returnKeyType="done"
            onSubmitEditing={handleAddDraft}
            multiline={false}
          />
          <Pressable
            style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}
            onPress={handleAddDraft}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Add note"
          >
            <Ionicons name="arrow-up" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {draftAddedCount > 0 && (
        <Text style={styles.savedHint}>
          {draftAddedCount === 1 ? 'Note saved.' : `${draftAddedCount} notes saved.`}
        </Text>
      )}

      <View style={styles.anchorRow}>
        <Ionicons
          name={areaLabel ? 'location' : 'alert-circle-outline'}
          size={12}
          color={areaLabel ? IOS_COLORS.secondaryLabel : IOS_COLORS.systemOrange}
        />
        <Text style={[styles.anchorText, !areaLabel && styles.anchorTextWarn]} numberOfLines={2}>
          {areaLabel
            ? `Attaches to ${areaLabel}`
            : 'Not linked to a race area yet — set Where on this step’s Plan so these notes land in Atlas.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_COLORS.secondaryLabel,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_COLORS.secondaryLabel,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipAdded: {
    backgroundColor: 'rgba(52,199,89,0.12)',
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  chipTextAdded: {
    color: IOS_COLORS.systemGreen,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: IOS_COLORS.label,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.35,
  },
  savedHint: {
    fontSize: 11.5,
    color: IOS_COLORS.systemGreen,
    fontWeight: '600',
  },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  anchorText: {
    flexShrink: 1,
    fontSize: 11.5,
    color: IOS_COLORS.secondaryLabel,
  },
  anchorTextWarn: {
    color: IOS_COLORS.systemOrange,
  },
});

export default RaceLocalKnowledgeAdder;
