import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookmarkPlus, Check } from 'lucide-react-native';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { HingeDayEntryKind, HingeDayEntry } from '@/services/HingeBuildService';

export interface DayTileProps {
  day: string;
  date: string;
  entry: HingeDayEntry | null;
  onPress?: () => void;
  onSaveToLibrary?: () => void;
  saving?: boolean;
  saved?: boolean;
}

const EYEBROW_COLOR: Record<HingeDayEntryKind, string> = {
  flagged: '#2563EB',
  reflection: '#6D28D9',
  note: '#16A34A',
};

const EYEBROW_LABEL: Record<HingeDayEntryKind, string> = {
  flagged: 'Flagged',
  reflection: 'Reflection',
  note: 'Note',
};

export function DayTile({ day, date, entry, onPress, onSaveToLibrary, saving, saved }: DayTileProps) {
  const empty = entry == null;
  const Container: any = onPress && !empty ? Pressable : View;
  const canSave = !empty && entry!.refinable && !!onSaveToLibrary;
  return (
    <Container
      onPress={onPress}
      style={[styles.tile, empty && styles.tileEmpty]}
    >
      <Text style={styles.day}>{day}</Text>
      <Text style={styles.date}>{date}</Text>

      {empty ? (
        <Text style={styles.emptyBody}>No entry</Text>
      ) : (
        <>
          <Text style={[styles.eyebrow, { color: EYEBROW_COLOR[entry!.kind] }]}>
            {EYEBROW_LABEL[entry!.kind]}
          </Text>
          <Text style={styles.body} numberOfLines={canSave ? 3 : 4}>
            {entry!.body}
          </Text>
          {entry!.provenance ? (
            <Text style={styles.provenance} numberOfLines={1}>
              {entry!.provenance}
            </Text>
          ) : null}
          {canSave ? (
            saved ? (
              <View style={styles.saveRow}>
                <Check size={13} color="#16A34A" strokeWidth={2.6} />
                <Text style={styles.savedText}>Saved to library</Text>
              </View>
            ) : (
              <Pressable
                onPress={onSaveToLibrary}
                disabled={saving}
                hitSlop={6}
                accessibilityRole="button"
                style={styles.saveRow}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <>
                    <BookmarkPlus size={13} color="#007AFF" strokeWidth={2.2} />
                    <Text style={styles.saveText}>Save to library</Text>
                  </>
                )}
              </Pressable>
            )
          ) : null}
        </>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 168,
    minHeight: 200,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    padding: 12,
    gap: 4,
  },
  tileEmpty: {
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  day: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    letterSpacing: 0.4,
  },
  date: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  body: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: '#1F2937',
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    marginTop: 4,
  },
  provenance: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  emptyBody: {
    flex: 1,
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 32,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    minHeight: 22,
  },
  saveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  savedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
});
