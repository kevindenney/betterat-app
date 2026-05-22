/**
 * BeforeTheShiftCard (D37) — checklist of library items the step expects
 * the user to read/watch before the activity. Renders on the Plan tab.
 * Each row has a read-check; tap toggles step_library_before.read_at.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { FORMAT_ICON, FORMAT_TINT } from '@/components/library/resources/formatStyles';
import type { LibraryFormat } from '@/components/library/resources/types';

export interface BeforeShiftItem {
  id: string;
  format: LibraryFormat;
  title: string;
  meta: string;
  read: boolean;
}

interface Props {
  items: BeforeShiftItem[];
  totalEstimate?: string;
  onToggle?: (id: string) => void;
  onAddFromLibrary?: () => void;
}

export function BeforeTheShiftCard({
  items,
  totalEstimate,
  onToggle,
  onAddFromLibrary,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Ionicons name="bookmark" size={14} color="#5C2DAA" />
          <Text style={styles.headLabel}>From your library, before shift</Text>
        </View>
        {totalEstimate ? (
          <Text style={styles.est}>{totalEstimate}</Text>
        ) : null}
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyHint}>
          Pin a link, PDF, or note you want to skim before doing this.
        </Text>
      ) : null}

      {items.map((item) => {
        const tint = FORMAT_TINT[item.format];
        return (
          <View
            key={item.id}
            style={[styles.row, item.read ? styles.rowDone : null]}
          >
            <TouchableOpacity
              onPress={() => onToggle?.(item.id)}
              hitSlop={6}
              style={[
                styles.check,
                item.read ? styles.checkRead : null,
              ]}
            >
              {item.read ? (
                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
              ) : null}
            </TouchableOpacity>
            <View style={[styles.glyph, { backgroundColor: `${tint}1F` }]}>
              <Ionicons name={FORMAT_ICON[item.format]} size={15} color={tint} />
            </View>
            <View style={styles.body}>
              <Text
                style={[styles.title, item.read ? styles.titleRead : null]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.meta}
              </Text>
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        onPress={onAddFromLibrary}
        activeOpacity={0.6}
        style={styles.addRow}
      >
        <Ionicons name="add" size={14} color="#007AFF" />
        <Text style={styles.addText}>Pin from library</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#5C2DAA',
    letterSpacing: 0.2,
  },
  est: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  emptyHint: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 16,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  rowDone: {
    opacity: 0.85,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(60,60,67,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRead: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 16,
  },
  titleRead: {
    color: IOS_COLORS.secondaryLabel,
  },
  meta: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginTop: 2,
    borderRadius: 8,
  },
  addText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
});
