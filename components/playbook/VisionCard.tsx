/**
 * VisionCard — editable Vision surface for the Playbook home.
 *
 * The Vision is stored in `user_interest_manifesto.content` (the field already
 * powers the Manifesto feature). This card reuses `useManifestoAutoSave` so
 * edits debounce-save to the same row — there is no duplicate column in the
 * `playbooks` table.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useManifestoAutoSave } from '@/hooks/useManifesto';

interface VisionCardProps {
  interestId: string;
  interestName: string;
}

export function VisionCard({ interestId, interestName }: VisionCardProps) {
  const { manifesto, saveContent } = useManifestoAutoSave(interestId, interestName);
  const [text, setText] = useState('');

  useEffect(() => {
    setText(manifesto?.content ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifesto?.id]);

  const handleChange = (next: string) => {
    setText(next);
    saveContent(next);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBubble}>
          <Ionicons name="compass-outline" size={18} color={IOS_COLORS.systemIndigo} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Vision</Text>
          <Text style={styles.subtitle}>
            Why you're practicing {interestName}. This anchors every suggestion.
          </Text>
        </View>
      </View>
      <TextInput
        value={text}
        onChangeText={handleChange}
        placeholder={`What does being great at ${interestName} look like for you?`}
        placeholderTextColor={IOS_COLORS.tertiaryLabel}
        multiline
        textAlignVertical="top"
        style={styles.input}
      />
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
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
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
  input: {
    minHeight: 120,
    fontSize: 15,
    lineHeight: 22,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: 10,
    padding: IOS_SPACING.md,
    ...Platform.select({
      web: { outlineWidth: 0 } as Record<string, unknown>,
      default: {},
    }),
  },
});
