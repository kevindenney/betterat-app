import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  voiceCount?: number;
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
  voiceCount = 0,
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
      <ScrollView style={styles.container} contentContainerStyle={styles.emptyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.fromDoRow}>
          <Text style={styles.fromDoLabel}>
            From Do · <Text style={styles.fromDoNum}>{captureCount} captures</Text> ·{' '}
            <Text style={styles.fromDoNum}>{voiceCount} voice</Text>
          </Text>
          <Text style={styles.fromDoStatus}>Not started</Text>
        </View>

        <View style={styles.emptyHero}>
          <LinearGradient
            colors={['rgba(52,199,89,0.06)', 'rgba(255,255,255,0)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.emptyGlyphWrap}>
            <View style={styles.emptyGlyphOrbit} pointerEvents="none" />
            <View style={styles.emptyGlyph}>
              <Ionicons name="book-outline" size={26} color={EMPTY_GLYPH_ICON} />
            </View>
          </View>
          <Text style={styles.emptyTitle}>Nothing to reflect on yet</Text>
          <Text style={styles.emptyBody}>
            Reflect fills in once you've captured moments in <Text style={styles.emptyBodyEm}>Do</Text>
            {' — '}prompts will surface here automatically.
          </Text>
        </View>

        <View style={styles.previewLabelRow}>
          <Text style={styles.previewLabel}>What this will look like</Text>
          <Text style={styles.previewSub}>After captures</Text>
        </View>

        <View style={styles.ghostList}>
          <GhostRow tone="green" icon="arrow-up" barWidths={['100%', '64%']} />
          <GhostRow tone="purple" icon="construct-outline" barWidths={['84%', '64%']} />
        </View>

        <Pressable
          style={styles.freeformPrompt}
          onPress={onAddFreeformNote}
          disabled={readOnly || !onAddFreeformNote}
          accessibilityRole="button"
          accessibilityLabel="Jot a freeform note"
        >
          <View style={styles.freeformGlyph}>
            <Ionicons name="pencil" size={14} color="#FFFFFF" />
          </View>
          <View style={styles.freeformCopy}>
            <Text style={styles.freeformTitle}>Jot a freeform note instead</Text>
            <View style={styles.freeformSubRow}>
              <Text style={styles.freeformSub}>For when the activity happened off-app</Text>
              <Ionicons name="arrow-forward" size={11} color={EMPTY_FREEFORM_SUB} />
            </View>
          </View>
        </Pressable>

        <Pressable
          style={styles.openDoButton}
          onPress={onGoToDo}
          disabled={readOnly || !onGoToDo}
          accessibilityRole="button"
        >
          <Ionicons name="play" size={16} color="#FFFFFF" />
          <Text style={styles.openDoButtonText}>Open Do tab</Text>
        </Pressable>
        <Text style={styles.openDoHint}>
          Or <Text style={styles.openDoHintEm}>reflect later</Text>
          {' — '}this tab will fill itself in once captures arrive.
        </Text>
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

function GhostRow({
  tone,
  icon,
  barWidths,
}: {
  tone: 'green' | 'purple';
  icon: React.ComponentProps<typeof Ionicons>['name'];
  barWidths: [string, string];
}) {
  return (
    <View style={[styles.ghostRow, tone === 'green' ? styles.ghostRowGreen : styles.ghostRowPurple]}>
      <View style={styles.ghostGlyph}>
        <Ionicons name={icon} size={10} color={IOS_COLORS.tertiaryLabel} />
      </View>
      <View style={styles.ghostBarStack}>
        <View style={[styles.ghostBar, { width: barWidths[0] as any }]} />
        <View style={[styles.ghostBar, { width: barWidths[1] as any }]} />
      </View>
      <Ionicons name="chevron-down" size={12} color={IOS_COLORS.systemGray3} />
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
const EMPTY_GLYPH_ICON = 'rgba(60,60,67,0.3)';
const EMPTY_FREEFORM_SUB = 'rgba(0,86,179,0.85)';
const EMPTY_GHOST_BAR = '#F2F2F7';
const EMPTY_GHOST_STRIPE_GREEN = 'rgba(52,199,89,0.55)';
const EMPTY_GHOST_STRIPE_PURPLE = 'rgba(88,86,214,0.55)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: IOS_SPACING.md,
    paddingBottom: 96,
    gap: IOS_SPACING.sm,
  },
  emptyContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 96,
    gap: 8,
  },
  fromDoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  fromDoLabel: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.02,
  },
  fromDoNum: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  fromDoStatus: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.02,
  },
  emptyHero: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
    backgroundColor: '#FFFFFF',
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    marginTop: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  emptyGlyphWrap: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyGlyphOrbit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 33,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: IOS_COLORS.systemGray4,
  },
  emptyGlyph: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemGray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 12.5,
    lineHeight: 18.75,
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.05,
    textAlign: 'center',
    maxWidth: 240,
  },
  emptyBodyEm: {
    fontStyle: 'italic',
    color: IOS_COLORS.label,
    fontWeight: '500',
  },
  previewLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  previewSub: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
    fontStyle: 'italic',
  },
  ghostList: {
    gap: 6,
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: IOS_COLORS.systemGray4,
    borderRadius: 12,
    paddingVertical: 10,
    paddingRight: 11,
    paddingLeft: 9.5,
    gap: 8,
    borderLeftWidth: 2,
  },
  ghostRowGreen: {
    borderLeftColor: EMPTY_GHOST_STRIPE_GREEN,
  },
  ghostRowPurple: {
    borderLeftColor: EMPTY_GHOST_STRIPE_PURPLE,
  },
  ghostGlyph: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemGray6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: IOS_COLORS.systemGray3,
  },
  ghostBarStack: {
    flex: 1,
    gap: 5,
  },
  ghostBar: {
    height: 7,
    borderRadius: 4,
    backgroundColor: EMPTY_GHOST_BAR,
  },
  freeformPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,122,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,122,255,0.18)',
  },
  freeformGlyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemBlue,
  },
  freeformCopy: {
    flex: 1,
  },
  freeformTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.15,
    lineHeight: 14.4,
  },
  freeformSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  freeformSub: {
    fontSize: 10.5,
    color: EMPTY_FREEFORM_SUB,
    letterSpacing: -0.02,
  },
  openDoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemBlue,
    marginTop: 12,
  },
  openDoButtonText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  openDoHint: {
    marginTop: 8,
    fontSize: 10.5,
    lineHeight: 14.7,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  openDoHintEm: {
    fontStyle: 'italic',
    color: IOS_COLORS.label,
    fontWeight: '500',
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
