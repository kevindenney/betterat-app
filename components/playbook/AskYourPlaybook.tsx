/**
 * AskYourPlaybook — input card for Q&A against a playbook. Calls
 * `playbook-qa` via PlaybookAIService and renders the answer inline.
 * A "Pin" button saves the Q&A to `playbook_qa` through the hook so it
 * shows up on the Q&A tab.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  PlaybookAIService,
  type PlaybookQAResponse,
  type PlaybookQAConceptUpdate,
} from '@/services/ai/PlaybookAIService';
import { useCreatePlaybookQA } from '@/hooks/usePlaybook';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

interface AskYourPlaybookProps {
  interestName: string;
  interestSlug?: string;
  playbookId: string | undefined;
}

const DEFAULT_SUGGESTIONS = [
  'What have I been working on lately?',
  'Where am I improving the most?',
  'What should I focus on next?',
];

const INTEREST_SUGGESTIONS: Record<string, string[]> = {
  'sail-racing': [
    'What mast rake should I use in 12-15 knots?',
    'What are my key rig tuning settings for light air?',
    'What did I learn from my last race debrief?',
  ],
};

// ---------------------------------------------------------------------------
// Simple markdown renderer — handles **bold**, bullet lists, paragraphs
// ---------------------------------------------------------------------------

function renderMarkdownLines(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n');
    const isBulletBlock = lines.every(
      (l) => /^[\-\*]\s/.test(l.trim()) || !l.trim(),
    );

    if (isBulletBlock) {
      return (
        <View key={pIdx} style={mdStyles.bulletBlock}>
          {lines
            .filter((l) => l.trim())
            .map((line, lIdx) => (
              <View key={lIdx} style={mdStyles.bulletRow}>
                <Text style={mdStyles.bulletDot}>{'\u2022'}</Text>
                <Text style={mdStyles.bulletText}>
                  {renderBold(line.replace(/^[\-\*]\s*/, ''))}
                </Text>
              </View>
            ))}
        </View>
      );
    }

    return (
      <Text key={pIdx} style={mdStyles.paragraph}>
        {renderBold(para.replace(/\n/g, ' '))}
      </Text>
    );
  });
}

function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={mdStyles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

const mdStyles = StyleSheet.create({
  paragraph: {
    fontSize: 14,
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
  bulletBlock: {
    gap: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    width: 16,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AskYourPlaybook({
  interestName,
  interestSlug,
  playbookId,
}: AskYourPlaybookProps) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<PlaybookQAResponse | null>(null);
  const { user } = useAuth();
  const createQA = useCreatePlaybookQA();

  const [savingInsight, setSavingInsight] = useState(false);

  const suggestions =
    (interestSlug && INTEREST_SUGGESTIONS[interestSlug]) || DEFAULT_SUGGESTIONS;

  const handleAsk = async () => {
    if (!question.trim() || !playbookId) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await PlaybookAIService.ask(playbookId, question.trim());
      setAnswer(res);
    } catch (err) {
      showAlert('Ask failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  /** Save a concept update insight as a suggestion in the queue */
  const handleSaveInsight = async (update: PlaybookQAConceptUpdate) => {
    if (!playbookId || !user?.id) return;
    setSavingInsight(true);
    try {
      await supabase.from('playbook_suggestions').insert({
        playbook_id: playbookId,
        user_id: user.id,
        kind: 'concept_update',
        payload: {
          target_concept_id: update.concept_id,
          rationale: `From Q&A: ${update.new_insight}`,
          append_insight: update.new_insight,
        },
        provenance: { source: 'qa_compounding', model: 'gemini-2.5-flash' },
        status: 'pending',
      });
      showAlert('Queued', `Insight queued as suggestion for "${update.title}".`);
    } catch (err) {
      showAlert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingInsight(false);
    }
  };

  const handlePin = async () => {
    if (!answer || !playbookId || !user?.id) return;
    try {
      await createQA.mutateAsync({
        playbook_id: playbookId,
        user_id: user.id,
        question: question.trim(),
        answer_md: answer.answer_md,
        sources: answer.sources,
        pinned: true,
      });
      showAlert('Pinned', 'Saved to your Q&A tab.');
    } catch (err) {
      showAlert('Pin failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBubble}>
          <Ionicons name="sparkles" size={18} color={IOS_COLORS.systemPurple} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Ask your Playbook</Text>
          <Text style={styles.subtitle}>
            Pull answers from your {interestName} concepts, resources, and
            debriefs.
          </Text>
        </View>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder={`Ask anything about your ${interestName} practice…`}
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          onSubmitEditing={handleAsk}
          returnKeyType="search"
          editable={!busy}
          style={styles.input}
        />
        <TouchableOpacity
          onPress={handleAsk}
          disabled={busy || !playbookId}
          style={[styles.askButton, (busy || !playbookId) && styles.askButtonDisabled]}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      {answer && (
        <View style={styles.answerBox}>
          <View style={styles.answerContent}>
            {renderMarkdownLines(answer.answer_md)}
          </View>
          {answer.sources.length > 0 && (
            <View style={styles.sourcesRow}>
              {answer.sources.map((s, i) => (
                <View key={`${s.type}-${s.id}-${i}`} style={styles.sourceChip}>
                  <Text style={styles.sourceChipText}>
                    {s.type} · {s.label}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.answerActions}>
            <Pressable onPress={handlePin} style={styles.pinBtn}>
              <Ionicons name="bookmark-outline" size={14} color={IOS_COLORS.systemPurple} />
              <Text style={styles.pinText}>Pin to Q&A</Text>
            </Pressable>
          </View>
          {/* Compounding loop: concept update suggestions from Q&A */}
          {(answer.concept_updates ?? []).length > 0 ? (
            <View style={styles.compoundSection}>
              <View style={styles.compoundHeader}>
                <Ionicons name="sparkles-outline" size={13} color={IOS_COLORS.systemTeal} />
                <Text style={styles.compoundTitle}>Strengthen your knowledge</Text>
              </View>
              {(answer.concept_updates ?? []).map((cu, i) => (
                <TouchableOpacity
                  key={`cu-${i}`}
                  onPress={() => handleSaveInsight(cu)}
                  disabled={savingInsight}
                  style={styles.compoundChip}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={14} color={IOS_COLORS.systemTeal} />
                  <View style={styles.compoundChipText}>
                    <Text style={styles.compoundChipTitle} numberOfLines={1}>
                      Update "{cu.title}"
                    </Text>
                    <Text style={styles.compoundChipDesc} numberOfLines={2}>
                      {cu.new_insight}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {/* Knowledge gaps */}
          {(answer.knowledge_gaps ?? []).length > 0 ? (
            <View style={styles.compoundSection}>
              <View style={styles.compoundHeader}>
                <Ionicons name="alert-circle-outline" size={13} color={IOS_COLORS.systemOrange} />
                <Text style={[styles.compoundTitle, { color: IOS_COLORS.systemOrange }]}>
                  Knowledge gaps detected
                </Text>
              </View>
              {(answer.knowledge_gaps ?? []).map((gap, i) => (
                <View key={`gap-${i}`} style={styles.gapChip}>
                  <Text style={styles.gapTopic}>{gap.topic}</Text>
                  <Text style={styles.gapDesc} numberOfLines={2}>
                    {gap.description}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
      {!answer && !busy && (
        <View style={styles.chipRow}>
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setQuestion(s)}
              style={styles.chip}
              activeOpacity={0.85}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: IOS_SPACING.md,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(175, 82, 222, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: 10,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    minHeight: 40,
    ...Platform.select({
      web: { outlineWidth: 0 } as Record<string, unknown>,
      default: {},
    }),
  },
  askButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askButtonDisabled: {
    opacity: 0.4,
  },
  answerBox: {
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: 10,
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
  answerContent: {
    gap: IOS_SPACING.sm,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  sourceChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  sourceChipText: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '600',
  },
  answerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(175, 82, 222, 0.1)',
  },
  pinText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemPurple,
  },
  compoundSection: {
    gap: 6,
    paddingTop: IOS_SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  compoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compoundTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.systemTeal,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  compoundChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: IOS_SPACING.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(90, 200, 250, 0.08)',
  },
  compoundChipText: {
    flex: 1,
  },
  compoundChipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.systemTeal,
  },
  compoundChipDesc: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
  },
  gapChip: {
    padding: IOS_SPACING.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
  },
  gapTopic: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.systemOrange,
  },
  gapDesc: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: IOS_SPACING.sm,
  },
  chip: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  chipText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
});
