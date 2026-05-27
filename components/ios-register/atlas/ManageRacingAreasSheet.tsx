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

import React, { useState } from 'react';
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
  // Inline confirm — the id of the row showing its [Cancel] [Delete]
  // confirmation. Avoids the z-index war between system confirm dialogs
  // and the sheet's Modal portal on web.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  const requestDelete = (area: AreaRow) => setPendingDeleteId(area.id);
  const cancelDelete = () => setPendingDeleteId(null);
  const confirmDelete = (area: AreaRow) => {
    deleteArea.mutate(area.id, {
      onSettled: () => setPendingDeleteId(null),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTapZone} onPress={onClose} />
        <View style={styles.sheet}>
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
                const isPending = pendingDeleteId === area.id;
                return (
                  <View key={area.id} style={[styles.row, isPending && styles.rowPending]}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {area.area_name}
                      </Text>
                      {isPending ? (
                        <Text style={styles.rowConfirmText} numberOfLines={2}>
                          Delete this area? It hides from your Atlas; seeded official areas aren’t affected.
                        </Text>
                      ) : subtitle ? (
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {isPending ? (
                      <View style={styles.confirmRow}>
                        <Pressable
                          onPress={cancelDelete}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.cancelBtn,
                            pressed && styles.cancelBtnPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Cancel delete"
                        >
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDelete(area)}
                          disabled={deleteArea.isPending}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.confirmDeleteBtn,
                            pressed && styles.confirmDeleteBtnPressed,
                            deleteArea.isPending && { opacity: 0.6 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Confirm delete ${area.area_name}`}
                        >
                          {deleteArea.isPending ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.confirmDeleteBtnText}>Delete</Text>
                          )}
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => requestDelete(area)}
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
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  backdropTapZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  rowPending: {
    backgroundColor: 'rgba(196, 71, 74, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(196, 71, 74, 0.32)',
  },
  rowConfirmText: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(120, 120, 130, 0.14)',
  },
  cancelBtnPressed: {
    backgroundColor: 'rgba(120, 120, 130, 0.26)',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  confirmDeleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#C4474A',
    minWidth: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnPressed: {
    backgroundColor: '#A93B3E',
  },
  confirmDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
