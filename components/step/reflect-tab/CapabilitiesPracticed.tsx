import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Plus, Sparkles, X } from 'lucide-react-native';
import {
  GRAY_4,
  GRAY_5,
  GRAY_6,
  IOS_BLUE,
  IOS_BLUE_TINT,
  IOS_GREEN,
  IOS_GREEN_TINT,
  IOS_PURPLE_DEEP,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

export type EvidenceStrength = 'worth-noting' | 'material' | 'strong';

export interface CapabilityEvidenceRow {
  capabilityId: string;
  capabilityName: string;
  confirmed: boolean;
  strength: EvidenceStrength;
  pipLevel: number;
  evidenceCount: number;
}

export interface CapabilitiesPracticedProps {
  rows: CapabilityEvidenceRow[];
  capturesCount: number;
  onToggleConfirm: (id: string) => void;
  onChangeStrength: (id: string, strength: EvidenceStrength) => void;
  onAddCapability: () => void;
}

const STRENGTH_ORDER: EvidenceStrength[] = ['worth-noting', 'material', 'strong'];

export function CapabilitiesPracticed({
  rows,
  capturesCount,
  onToggleConfirm,
  onChangeStrength,
  onAddCapability,
}: CapabilitiesPracticedProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <Sparkles size={13} color={IOS_PURPLE_DEEP} />
          <Text style={styles.eyebrow}>Capabilities you practiced</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onAddCapability} style={styles.addButton}>
          <Plus size={13} color={IOS_BLUE} />
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

      <Text style={styles.hint}>
        AI tagged these from your {capturesCount} captures · tap to confirm or remove
      </Text>
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
    color: IOS_BLUE,
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
    backgroundColor: IOS_BLUE_TINT,
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
});
