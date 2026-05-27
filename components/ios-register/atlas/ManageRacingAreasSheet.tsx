/**
 * ManageRacingAreasSheet — list of the viewer's user-defined racing
 * areas with a Delete button on each row. Reached from the Layers
 * sheet's "Manage areas" link. Edit (rename / resize / reshape) is
 * intentionally out of scope for v1 — delete + recreate works.
 *
 * Only `source !== 'official'` rows are shown so users can't soft-
 * delete the curated/seeded HK areas. The hook's underlying mutation
 * just flips `is_active` false so history is preserved.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useDeleteRacingArea } from '@/hooks/useDeleteRacingArea';

interface ManageRacingAreasSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface AreaRow {
  id: string;
  area_name: string;
  source: string | null;
  classes_used: string[] | null;
  radius_meters: number | null;
  created_by: string | null;
}

function formatMeters(meters: number | null): string {
  if (meters == null) return '';
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return km % 1 === 0 ? `${km} km` : `${km.toFixed(1)} km`;
}

export function ManageRacingAreasSheet({ visible, onClose }: ManageRacingAreasSheetProps) {
  const { user } = useAuth();
  const deleteArea = useDeleteRacingArea();

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ['atlas-racing-areas', 'manage', user?.id ?? null],
    enabled: visible && Boolean(user?.id),
    queryFn: async (): Promise<AreaRow[]> => {
      const { data, error } = await supabase
        .from('venue_racing_areas')
        .select('id, area_name, source, classes_used, radius_meters, created_by')
        .eq('is_active', true)
        .neq('source', 'official')
        .order('area_name');
      if (error) {
        console.warn('[atlas] manage areas fetch error', error);
        return [];
      }
      return (data ?? []) as AreaRow[];
    },
  });

  const handleDelete = (area: AreaRow) => {
    showConfirm(
      `Delete "${area.area_name}"?`,
      'This hides the racing area from your Atlas. Seeded official areas are not affected.',
      () => {
        deleteArea.mutate(area.id);
      },
      { destructive: true, confirmText: 'Delete' },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <View style={styles.handle} />
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={IOS_COLORS.label} />
            </Pressable>
          </View>
          <Text style={styles.title}>Manage racing areas</Text>
          <Text style={styles.hint}>
            Community-added areas you can delete. Seeded official areas aren’t shown.
          </Text>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={IOS_COLORS.systemBlue} />
            </View>
          ) : areas.length === 0 ? (
            <Text style={styles.empty}>No community areas yet. Long-press on water to add one.</Text>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {areas.map((area) => {
                const radius = formatMeters(area.radius_meters);
                const classes = (area.classes_used ?? []).join(' · ');
                const subtitle = [radius, classes].filter(Boolean).join(' · ');
                return (
                  <View key={area.id} style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {area.area_name}
                      </Text>
                      {subtitle ? (
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleDelete(area)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.deleteBtn,
                        pressed && styles.deleteBtnPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${area.area_name}`}
                    >
                      <Ionicons name="trash-outline" size={18} color="#C4474A" />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    flex: 1,
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60, 60, 67, 0.28)',
  },
  closeBtn: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 120, 130, 0.12)',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  hint: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  center: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  empty: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 6,
    paddingVertical: 16,
  },
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(120, 120, 130, 0.07)',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    lineHeight: 19,
  },
  rowMeta: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(196, 71, 74, 0.12)',
  },
  deleteBtnPressed: {
    backgroundColor: 'rgba(196, 71, 74, 0.22)',
  },
});
