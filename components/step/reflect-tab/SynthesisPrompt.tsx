import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import {
  IOS_PURPLE,
  IOS_PURPLE_DEEP,
  IOS_PURPLE_TINT,
  LABEL,
  LABEL_2,
} from '@/lib/design-tokens-step-loop-ios';

export interface SynthesisPromptProps {
  capturesCount: number;
  copy: string;
  state?: 'idle' | 'drafting' | 'drafted' | 'dismissed';
  onDraft: () => Promise<string>;
  onDismiss: () => void;
}

export function SynthesisPrompt({
  capturesCount,
  copy,
  state = 'idle',
  onDraft,
  onDismiss,
}: SynthesisPromptProps) {
  const [busy, setBusy] = useState(false);

  if (state === 'dismissed') return null;
  // Nothing to synthesize from yet — the "draft from your 0 captures" copy
  // reads broken, so suppress the prompt until at least one capture exists.
  if (capturesCount === 0) return null;

  const handleDraft = async () => {
    if (busy || state === 'drafting') return;
    setBusy(true);
    try {
      await onDraft();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <Sparkles size={14} color={IOS_PURPLE_DEEP} />
          <Text style={styles.eyebrow}>Draft from your captures</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss draft prompt"
          onPress={onDismiss}
          hitSlop={8}
        >
          <X size={14} color={LABEL_2} />
        </Pressable>
      </View>
      <Text style={styles.copy}>
        {copy || `Want a first draft from your ${capturesCount} captures? Tap to draft, or write the first line yourself.`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Draft reflection from captures"
        onPress={handleDraft}
        disabled={busy || state === 'drafting'}
        style={({ pressed }) => [styles.draftLink, pressed && styles.draftLinkPressed]}
      >
        <Text style={styles.draftText}>
          {busy || state === 'drafting' ? 'Drafting…' : state === 'drafted' ? 'Draft again' : 'Tap to draft'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_PURPLE_TINT,
    borderColor: 'rgba(88, 86, 214, 0.16)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: IOS_PURPLE_DEEP,
  },
  copy: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    color: LABEL,
  },
  draftLink: {
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: IOS_PURPLE,
    paddingBottom: 1,
  },
  draftLinkPressed: {
    opacity: 0.7,
  },
  draftText: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_PURPLE_DEEP,
  },
});
