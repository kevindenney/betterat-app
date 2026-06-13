import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS, STEP_PALETTE } from '@/lib/step-theme';
import { gearErrorMessage, getGearLabels, type GearItem } from '@/services/GearService';
import {
  useInterestGear,
  useSetStepGearSelection,
  useStepGear,
  useToggleStepGearItem,
} from '@/hooks/useGear';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

function itemSummary(item: GearItem): string {
  const spec = item.spec ?? {};
  const parts = [spec.class_name, spec.sail_number, spec.model, spec.manufacturer, spec.subcategory]
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map(String)
    .filter(Boolean);
  if (item.status === 'loaned') parts.unshift('loaned');
  if (item.status === 'backup') parts.unshift('backup');
  if (item.status === 'retired') parts.unshift('retired');
  return parts.slice(0, 2).join(' · ');
}

function itemIcon(item: Pick<GearItem, 'kind'>, slug?: string | null): string {
  const kind = item.kind.toLowerCase();
  if (kind.includes('boat') || slug?.includes('sail')) return 'boat-outline';
  if (kind.includes('sail') || kind.includes('rig')) return 'flag-outline';
  if (kind.includes('club') || slug?.includes('golf')) return 'golf-outline';
  if (kind.includes('kit') || slug?.includes('nursing')) return 'medkit-outline';
  if (kind.includes('machine')) return 'cog-outline';
  return 'construct-outline';
}

function isKitInterest(slug?: string | null): boolean {
  const normalized = String(slug ?? '').toLowerCase();
  return normalized.includes('nursing') || normalized.includes('clinical');
}

interface StepGearPickerProps {
  stepId: string;
  interestId: string;
  interestSlug?: string | null;
  readOnly?: boolean;
}

export function StepGearPicker({
  stepId,
  interestId,
  interestSlug,
  readOnly = false,
}: StepGearPickerProps) {
  const labels = getGearLabels(interestSlug);
  const kitMode = isKitInterest(interestSlug);
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useInterestGear(readOnly ? null : interestId);
  const { data: stepGear = [] } = useStepGear(stepId);
  const setSelection = useSetStepGearSelection(stepId);
  const toggleGear = useToggleStepGearItem(stepId);

  const activeItems = useMemo(
    () => items.filter((item) => item.status !== 'retired'),
    [items],
  );
  const rootItems = useMemo(
    () => activeItems.filter((item) => !item.parent_id),
    [activeItems],
  );
  const selectedRows = stepGear.filter((row) => row.role === labels.stepRole);
  const selectedIds = new Set(selectedRows.map((row) => row.gear_item_id));
  const explicitSelected = selectedRows[0]?.gear_item ?? null;
  const defaultSelected = rootItems.find((item) => item.is_primary) ?? rootItems[0] ?? null;
  const displayedSelected = explicitSelected ?? defaultSelected;
  const displayedSummary = displayedSelected
    ? itemSummary(displayedSelected) || (explicitSelected ? 'selected' : 'primary')
    : '';

  if (kitMode) {
    if (readOnly && selectedRows.length === 0) return null;
    const visibleItems = readOnly
      ? selectedRows.map((row) => row.gear_item).filter(Boolean) as GearItem[]
      : activeItems.slice(0, 5);
    if (visibleItems.length === 0) return null;
    return (
      <View style={styles.block}>
        <Text style={styles.label}>{labels.pickerTitle}</Text>
        <View style={styles.list}>
          {visibleItems.map((item) => {
            const selected = selectedIds.has(item.id);
            return (
              <Pressable
                key={item.id}
                disabled={readOnly || toggleGear.isPending}
                onPress={() => {
                  toggleGear.mutate(
                    { role: labels.stepRole, gearItemId: item.id, selected },
                    { onError: (error) => showAlert('Could not update kit', gearErrorMessage(error)) },
                  );
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && !readOnly && styles.pressed,
                ]}
              >
                <Ionicons name={itemIcon(item, interestSlug) as any} size={16} color={STEP_COLORS.secondaryLabel} />
                <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                <View style={styles.spacer} />
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={selected ? STEP_COLORS.complete : STEP_COLORS.tertiaryLabel}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (!displayedSelected) return null;

  return (
    <>
      <View style={styles.block}>
        <Text style={styles.label}>{labels.pickerTitle}</Text>
        <Pressable
          disabled={readOnly}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.compactPicker,
            pressed && !readOnly && styles.pressed,
          ]}
        >
          <Ionicons
            name={itemIcon(displayedSelected, interestSlug) as any}
            size={15}
            color={STEP_COLORS.accent}
            style={styles.compactLeadingIcon}
          />
          <Text style={styles.compactLine} numberOfLines={1}>
            <Text style={styles.compactTitleInline}>{displayedSelected.name}</Text>
            {displayedSummary ? (
              <Text style={styles.compactSubInline}> · {displayedSummary}</Text>
            ) : null}
          </Text>
          {!readOnly ? (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={STEP_COLORS.tertiaryLabel}
              style={styles.compactChevron}
            />
          ) : null}
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{labels.pickerTitle}</Text>
                <Text style={styles.sheetSubtitle}>{labels.pickerSubtitle}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color={STEP_COLORS.secondaryLabel} />
              </Pressable>
            </View>
            <ScrollView style={styles.sheetList} contentContainerStyle={{ paddingBottom: 18 }}>
              {rootItems.map((item) => {
                const selected = displayedSelected.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setSelection.mutate(
                        { role: labels.stepRole, gearItemId: item.id },
                        {
                          onSuccess: () => setOpen(false),
                          onError: (error) => showAlert('Could not save gear', gearErrorMessage(error)),
                        },
                      );
                    }}
                    style={({ pressed }) => [
                      styles.sheetRow,
                      selected && styles.sheetRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name={itemIcon(item, interestSlug) as any} size={18} color={selected ? STEP_COLORS.accent : STEP_COLORS.secondaryLabel} />
                    <View style={styles.singleMeta}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>{itemSummary(item) || 'active'}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark" size={18} color={STEP_COLORS.accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 7,
    marginTop: IOS_SPACING.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: STEP_COLORS.tertiaryLabel,
  },
  list: { gap: 6 },
  row: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: STEP_PALETTE.bgSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_PALETTE.borderTertiary,
  },
  singlePicker: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: STEP_PALETTE.bgSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_PALETTE.borderTertiary,
  },
  compactPicker: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 3,
    paddingLeft: 28,
    paddingRight: 22,
    alignSelf: 'stretch',
    width: '100%',
    position: 'relative',
  },
  compactLeadingIcon: {
    position: 'absolute',
    left: 0,
    top: 3,
  },
  compactLine: {
    alignSelf: 'stretch',
    marginLeft: 28,
    marginRight: 22,
    fontSize: 14,
    lineHeight: 18,
    color: STEP_COLORS.tertiaryLabel,
  },
  compactTitleInline: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: STEP_COLORS.label,
  },
  compactSubInline: {
    fontSize: 13,
    lineHeight: 18,
    color: STEP_COLORS.tertiaryLabel,
  },
  compactChevron: {
    position: 'absolute',
    right: 0,
    top: 5,
  },
  singleMeta: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: STEP_COLORS.label },
  rowSub: { fontSize: 12, color: STEP_COLORS.tertiaryLabel, marginTop: 1 },
  spacer: { flex: 1 },
  pressed: { opacity: 0.72 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: STEP_COLORS.cardBg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: STEP_COLORS.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: STEP_COLORS.label },
  sheetSubtitle: { fontSize: 13, color: STEP_COLORS.secondaryLabel, marginTop: 3 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STEP_PALETTE.bgSecondary,
  },
  sheetList: { marginHorizontal: -2 },
  sheetRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  sheetRowSelected: {
    backgroundColor: STEP_COLORS.headerBg,
    borderColor: STEP_COLORS.border,
  },
});
