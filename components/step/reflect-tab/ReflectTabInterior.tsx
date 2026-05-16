import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { ReflectCompletionState, ReflectPromptAnswer } from './reflectState';

export interface ReflectPatternCallout {
  title: string;
  body: string;
}

export interface ReflectCarryForward {
  title: string;
  bullets: string[];
}

export interface ReflectTabInteriorProps {
  state: ReflectCompletionState;
  summaryText?: string | null;
  answers: ReflectPromptAnswer[];
  readOnly?: boolean;
  completedAtLabel?: string;
  captureCount?: number;
  promptsAnsweredCount?: number;
  capabilitiesAdvancedCount?: number;
  patternCallout?: ReflectPatternCallout | null;
  carryForward?: ReflectCarryForward | null;
  onGoToDo?: () => void;
  onAddFreeformNote?: () => void;
  onChangeAnswer?: (id: string, value: string) => void;
  onMarkComplete?: () => void;
  onPlanNextStep?: () => void;
  footer?: React.ReactNode;
}

export function ReflectTabInterior({
  state,
  summaryText,
  answers,
  readOnly,
  completedAtLabel,
  captureCount = 0,
  promptsAnsweredCount,
  capabilitiesAdvancedCount = 0,
  patternCallout,
  carryForward,
  onGoToDo,
  onAddFreeformNote,
  onChangeAnswer,
  onMarkComplete,
  onPlanNextStep,
  footer,
}: ReflectTabInteriorProps) {
  const complete = state === 'complete';
  const ready = state === 'ready';
  const answeredCount = promptsAnsweredCount ?? answers.filter((answer) => answer.answer?.trim()).length;

  if (state === 'empty') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.emptyHero}>
          <View style={styles.emptyGlyph}>
            <Ionicons name="sparkles-outline" size={26} color={REFLECT_GREEN} />
          </View>
          <Text style={styles.emptyTitle}>Reflect fills in after Do.</Text>
          <Text style={styles.emptyBody}>
            Capture a voice note, photo, or quick note first. The prompts here will stay quiet until
            there is something real to reflect on.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={onAddFreeformNote} disabled={readOnly || !onAddFreeformNote}>
            <Text style={styles.secondaryButtonText}>Jot a freeform note instead</Text>
          </Pressable>
        </View>

        <GhostPrompt label="What worked" tone="green" />
        <GhostPrompt label="What to improve" tone="purple" />

        <Pressable style={styles.primaryGhostButton} onPress={onGoToDo} disabled={readOnly || !onGoToDo}>
          <Text style={styles.primaryGhostButtonText}>Go capture in Do</Text>
        </Pressable>
        {footer}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.statusPill, complete && styles.statusPillComplete]}>
        <View style={[styles.statusDot, complete && styles.statusDotComplete]} />
        <Text style={[styles.statusText, complete && styles.statusTextComplete]}>
          {complete ? `Reflect shipped${completedAtLabel ? ` · ${completedAtLabel}` : ''}` : 'Reflect in progress'}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.eyebrow}>{complete ? 'Reflection digest' : 'AI draft'}</Text>
        <Text style={styles.summaryText}>
          {summaryText?.trim() || 'No Reflect summary yet. Add a note or ask AI to analyze this step.'}
        </Text>
      </View>

      {complete && (
        <View style={styles.statRow}>
          <StatTile label="prompts" value={`${answeredCount} answered`} />
          <StatTile label="captures" value={`${captureCount} cited`} />
          <StatTile label="capabilities" value={`${capabilitiesAdvancedCount} advanced`} emphasized />
        </View>
      )}

      {!complete && (
        <>
          <PromptGroup
            title="What worked"
            tone="green"
            answers={answers.filter((answer) => answer.kind === 'what_worked')}
            readOnly={readOnly}
            onChangeAnswer={onChangeAnswer}
          />

          {patternCallout && (
            <View style={styles.patternCard}>
              <View style={styles.patternFlag} />
              <Text style={styles.patternTitle}>{patternCallout.title}</Text>
              <Text style={styles.patternBody}>{patternCallout.body}</Text>
            </View>
          )}

          <PromptGroup
            title="What to improve"
            tone="purple"
            answers={answers.filter((answer) => answer.kind === 'what_to_improve')}
            readOnly={readOnly}
            onChangeAnswer={onChangeAnswer}
          />

          <Pressable
            style={[styles.primaryButton, !ready && styles.primaryButtonDisabled]}
            onPress={onMarkComplete}
            disabled={readOnly || !ready || !onMarkComplete}
          >
            <Text style={[styles.primaryButtonText, !ready && styles.primaryButtonTextDisabled]}>
              Mark Reflect complete
            </Text>
          </Pressable>
          {!ready && <Text style={styles.hintText}>{getCompletionHint(state)}</Text>}
        </>
      )}

      {complete && (
        <View style={styles.carryCard}>
          <Text style={styles.eyebrow}>Carry forward</Text>
          <Text style={styles.carryTitle}>{carryForward?.title || 'Plan the next step from this reflection.'}</Text>
          {(carryForward?.bullets?.length ? carryForward.bullets : ['Name what to watch next.', 'Keep the strongest cue visible.']).map(
            (bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ),
          )}
          <Pressable style={styles.primaryButton} onPress={onPlanNextStep} disabled={readOnly || !onPlanNextStep}>
            <Text style={styles.primaryButtonText}>Plan next step</Text>
          </Pressable>
        </View>
      )}

      {footer}
    </ScrollView>
  );
}

function PromptGroup({
  title,
  tone,
  answers,
  readOnly,
  onChangeAnswer,
}: {
  title: string;
  tone: 'green' | 'purple';
  answers: ReflectPromptAnswer[];
  readOnly?: boolean;
  onChangeAnswer?: (id: string, value: string) => void;
}) {
  return (
    <View style={styles.promptGroup}>
      <Text style={[styles.promptGroupTitle, tone === 'purple' && styles.promptGroupTitlePurple]}>{title}</Text>
      {answers.map((answer) => (
        <View key={answer.id} style={[styles.promptCard, tone === 'purple' && styles.promptCardPurple]}>
          <Text style={styles.promptText}>{answer.prompt}</Text>
          <TextInput
            style={styles.answerInput}
            value={answer.answer ?? ''}
            onChangeText={(value) => onChangeAnswer?.(answer.id, value)}
            placeholder="Write what you noticed..."
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
            editable={!readOnly}
            multiline
            textAlignVertical="top"
          />
          {answer.capabilityLabel && (
            <View style={styles.capabilityPill}>
              <Text style={styles.capabilityText}>{answer.capabilityLabel}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function GhostPrompt({ label, tone }: { label: string; tone: 'green' | 'purple' }) {
  return (
    <View style={[styles.ghostPrompt, tone === 'purple' && styles.ghostPromptPurple]}>
      <Text style={styles.ghostLabel}>{label}</Text>
      <View style={styles.ghostLine} />
      <View style={[styles.ghostLine, styles.ghostLineShort]} />
    </View>
  );
}

function StatTile({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <View style={[styles.statTile, emphasized && styles.statTileEmphasized]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getCompletionHint(state: ReflectCompletionState): string {
  if (state === 'needs_worked') return 'Answer one What worked prompt to continue.';
  if (state === 'needs_improve') return 'Answer one What to improve prompt to close the loop.';
  return 'Reflect is not ready to complete yet.';
}

const REFLECT_GREEN = '#248A3D';
const REFLECT_GREEN_SOFT = 'rgba(52,199,89,0.13)';
const REFLECT_PURPLE_SOFT = 'rgba(120,91,169,0.12)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: IOS_SPACING.md,
    paddingBottom: 96,
    gap: IOS_SPACING.sm,
  },
  emptyHero: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52,199,89,0.2)',
    backgroundColor: '#F8FBF7',
    padding: 22,
    gap: 10,
  },
  emptyGlyph: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(52,199,89,0.45)',
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  secondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_COLORS.systemBlue,
  },
  ghostPrompt: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(52,199,89,0.34)',
    backgroundColor: 'rgba(52,199,89,0.04)',
    padding: 16,
    gap: 9,
  },
  ghostPromptPurple: {
    borderColor: 'rgba(120,91,169,0.34)',
    backgroundColor: 'rgba(120,91,169,0.04)',
  },
  ghostLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ghostLine: {
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(60,60,67,0.12)',
  },
  ghostLineShort: {
    width: '68%',
  },
  primaryGhostButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,122,255,0.35)',
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  primaryGhostButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: IOS_COLORS.systemBlue,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  statusPillComplete: {
    backgroundColor: REFLECT_GREEN_SOFT,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  statusDotComplete: {
    backgroundColor: REFLECT_GREEN,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: IOS_COLORS.systemBlue,
  },
  statusTextComplete: {
    color: REFLECT_GREEN,
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    padding: 17,
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: IOS_COLORS.label,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    padding: 12,
  },
  statTileEmphasized: {
    backgroundColor: REFLECT_GREEN_SOFT,
    borderColor: 'rgba(52,199,89,0.25)',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
  },
  promptGroup: {
    gap: 9,
  },
  promptGroupTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: REFLECT_GREEN,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  promptGroupTitlePurple: {
    color: '#785BA9',
  },
  promptCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52,199,89,0.24)',
    backgroundColor: REFLECT_GREEN_SOFT,
    padding: 15,
    gap: 10,
  },
  promptCardPurple: {
    borderColor: 'rgba(120,91,169,0.24)',
    backgroundColor: REFLECT_PURPLE_SOFT,
  },
  promptText: {
    fontSize: 14,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  answerInput: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
  },
  capabilityPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  capabilityText: {
    fontSize: 12,
    fontWeight: '800',
    color: IOS_COLORS.secondaryLabel,
  },
  patternCard: {
    borderRadius: 22,
    backgroundColor: '#F4FAF4',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52,199,89,0.28)',
    padding: 16,
    gap: 7,
  },
  patternFlag: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: REFLECT_GREEN,
  },
  patternTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: IOS_COLORS.label,
  },
  patternBody: {
    fontSize: 13,
    lineHeight: 19,
    color: IOS_COLORS.secondaryLabel,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray5,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  primaryButtonTextDisabled: {
    color: IOS_COLORS.tertiaryLabel,
  },
  hintText: {
    marginTop: -4,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
  },
  carryCard: {
    borderRadius: 26,
    backgroundColor: '#F6FAF6',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.24)',
    padding: 18,
    gap: 12,
  },
  carryTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    color: IOS_COLORS.label,
    letterSpacing: -0.35,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: REFLECT_GREEN,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
  },
});
