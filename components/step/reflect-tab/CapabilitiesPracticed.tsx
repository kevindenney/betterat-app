import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Plus, Sparkles, X } from 'lucide-react-native';
import {
  GRAY_4,
  GRAY_5,
  GRAY_6,
  IOS_GREEN,
  IOS_GREEN_TINT,
  IOS_PURPLE_DEEP,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';
import { REFLECT } from '@/lib/design-tokens-ios';

export type EvidenceStrength = 'worth-noting' | 'material' | 'strong';

export interface CapabilityEvidenceRow {
  capabilityId: string;
  capabilityName: string;
  confirmed: boolean;
  strength: EvidenceStrength;
  pipLevel: number;
  evidenceCount: number;
  /** Where the row came from — 'ai' rows are model suggestions awaiting confirmation. */
  source?: 'plan' | 'ai' | 'manual';
  /** Verbatim snippet from the learner's own notes that justifies the tag.
      Surfaced on the public face; absent when no clean substring was found. */
  evidenceQuote?: string;
}

export type CapabilitySuggestState = 'idle' | 'loading' | 'done';

export interface CapabilitiesPracticedProps {
  rows: CapabilityEvidenceRow[];
  capturesCount: number;
  suggestState: CapabilitySuggestState;
  onSuggest: () => void;
  onToggleConfirm: (id: string) => void;
  onChangeStrength: (id: string, strength: EvidenceStrength) => void;
  onAddCapability: () => void;
}

const STRENGTH_ORDER: EvidenceStrength[] = ['worth-noting', 'material', 'strong'];

export function CapabilitiesPracticed({
  rows,
  capturesCount,
  suggestState,
  onSuggest,
  onToggleConfirm,
  onChangeStrength,
  onAddCapability,
}: CapabilitiesPracticedProps) {
  const capturesLabel = `${capturesCount} capture${capturesCount === 1 ? '' : 's'}`;
  const hasAiRows = rows.some((row) => row.source === 'ai');
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <Sparkles size={13} color={IOS_PURPLE_DEEP} />
          <Text style={styles.eyebrow}>Capabilities you practiced</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onAddCapability} style={styles.addButton}>
          <Plus size={13} color={REFLECT.base} />
          <Text style={styles.addText}>add</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>No capabilities tagged yet. Add one if this session developed a specific skill.</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <CapabilityRow
              key={row.capabilityId}
              row={row}
              onToggleConfirm={onToggleConfirm}
              onChangeStrength={onChangeStrength}
            />
          ))}
        </View>
      )}

      {capturesCount > 0 ? (
        suggestState === 'loading' ? (
          <View style={styles.suggestRow}>
            <Sparkles size={13} color={IOS_PURPLE_DEEP} />
            <Text style={styles.hint}>Finding suggestions…</Text>
          </View>
        ) : suggestState === 'done' ? (
          <Text style={styles.hint}>
            {hasAiRows
              ? 'Suggested for you · tap ✓ to confirm or ✗ to remove'
              : 'No new capabilities to suggest.'}
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={onSuggest}
            style={styles.suggestButton}
          >
            <Sparkles size={13} color={IOS_PURPLE_DEEP} />
            <Text style={styles.suggestText}>Suggest from your {capturesLabel}</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

function CapabilityRow({
  row,
  onToggleConfirm,
  onChangeStrength,
}: {
  row: CapabilityEvidenceRow;
  onToggleConfirm: (id: string) => void;
  onChangeStrength: (id: string, strength: EvidenceStrength) => void;
}) {
  const nextStrength = STRENGTH_ORDER[(STRENGTH_ORDER.indexOf(row.strength) + 1) % STRENGTH_ORDER.length];
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.confirmed }}
        accessibilityLabel={`Confirm ${row.capabilityName}`}
        onPress={() => onToggleConfirm(row.capabilityId)}
        style={[styles.check, row.confirmed && styles.checkOn]}
      >
        {row.confirmed ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : <X size={12} color={GRAY_4} />}
      </Pressable>
      <View style={styles.rowBody}>
        <Text style={styles.name}>{row.capabilityName}</Text>
        <View style={styles.metaRow}>
          <Pips level={row.pipLevel} />
          {row.source === 'ai' ? <Text style={styles.aiChip}>New</Text> : null}
          <Text style={styles.meta}>{row.evidenceCount} captures evidence this</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Change strength for ${row.capabilityName}`}
        onPress={() => onChangeStrength(row.capabilityId, nextStrength)}
        style={[styles.badge, badgeStyle(row.strength)]}
      >
        <Text style={styles.badgeText}>{strengthLabel(row.strength)}</Text>
      </Pressable>
    </View>
  );
}

function Pips({ level }: { level: number }) {
  return (
    <View style={styles.pips}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View
          key={index}
          style={[styles.pip, index < level && styles.pipOn]}
        />
      ))}
    </View>
  );
}

function strengthLabel(strength: EvidenceStrength) {
  if (strength === 'material') return 'Material';
  if (strength === 'strong') return 'Strong';
  return 'Worth noting';
}

function badgeStyle(strength: EvidenceStrength) {
  if (strength === 'material') return styles.badgeMaterial;
  if (strength === 'strong') return styles.badgeStrong;
  return styles.badgeWorth;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderColor: GRAY_5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 10,
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
    fontWeight: '800',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: IOS_PURPLE_DEEP,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addText: {
    fontSize: 12,
    fontWeight: '700',
    color: REFLECT.base,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkOn: {
    borderColor: IOS_GREEN,
    backgroundColor: IOS_GREEN,
  },
  rowBody: {
    flex: 1,
    gap: 5,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: LABEL,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pips: {
    flexDirection: 'row',
    gap: 2,
  },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GRAY_5,
  },
  pipOn: {
    backgroundColor: IOS_GREEN,
  },
  meta: {
    fontSize: 11,
    color: LABEL_3,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeWorth: {
    backgroundColor: GRAY_6,
  },
  badgeMaterial: {
    backgroundColor: REFLECT.tint,
  },
  badgeStrong: {
    backgroundColor: IOS_GREEN_TINT,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: LABEL_2,
  },
  empty: {
    fontSize: 13,
    color: LABEL_3,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  hint: {
    fontSize: 11,
    color: LABEL_3,
    fontStyle: 'italic',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: GRAY_6,
  },
  suggestText: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_PURPLE_DEEP,
  },
  aiChip: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: IOS_PURPLE_DEEP,
    backgroundColor: GRAY_6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
