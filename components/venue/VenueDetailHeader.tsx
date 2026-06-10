/**
 * VenueDetailHeader
 *
 * Sits above the feed in the venue detail screen.
 * Shows yacht clubs and racing areas as horizontally scrolling pills.
 * Racing area pills are interactive filter chips — tapping selects/deselects
 * to filter the feed below. A "+" pill opens the AddRacingAreaSheet.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { useVenueRacingAreas } from '@/hooks/useVenueRacingAreas';
import { supabase } from '@/services/supabase';
import { triggerHaptic } from '@/lib/haptics';

interface VenueDetailHeaderProps {
  venueId: string;
  selectedAreaId?: string | null;
  onAreaSelect?: (areaId: string | null) => void;
  onAddArea?: () => void;
}

interface YachtClub {
  id: string;
  name: string;
}

export function VenueDetailHeader({
  venueId,
  selectedAreaId,
  onAreaSelect,
  onAddArea,
}: VenueDetailHeaderProps) {
  const [clubs, setClubs] = useState<YachtClub[]>([]);
  const { racingAreas } = useVenueRacingAreas(venueId);

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const { data } = await supabase
          .from('clubs')
          .select('id, name')
          .eq('venue_id', venueId);
        setClubs(data || []);
      } catch {
        // silent
      }
    };

    fetchClubs();
  }, [venueId]);

  const handleAreaPress = (areaId: string) => {
    triggerHaptic('selection');
    if (!onAreaSelect) return;
    // Toggle: if already selected, deselect (null); otherwise select
    onAreaSelect(selectedAreaId === areaId ? null : areaId);
  };

  if (clubs.length === 0 && racingAreas.length === 0) return null;

  return (
    <View style={styles.container}>
      {clubs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>YACHT CLUBS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {clubs.map((club) => (
              <View key={club.id} style={styles.pill}>
                <Text style={styles.pillText}>{club.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {racingAreas.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>RACING AREAS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {racingAreas.map((area) => {
              const isSelected = selectedAreaId === area.id;
              return (
                <Pressable
                  key={area.id}
                  onPress={() => handleAreaPress(area.id)}
                  style={[
                    styles.pill,
                    isSelected && styles.pillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      isSelected && styles.pillTextSelected,
                    ]}
                  >
                    {area.areaName}
                  </Text>
                </Pressable>
              );
            })}

            {/* Add Area pill */}
            {onAddArea && (
              <Pressable
                onPress={() => {
                  triggerHaptic('impactLight');
                  onAddArea();
                }}
                style={styles.addPill}
              >
                <Ionicons
                  name="add"
                  size={16}
                  color={IOS_COLORS.systemBlue}
                />
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

      {/* Show Add pill even when no racing areas yet */}
      {racingAreas.length === 0 && onAddArea && (
        <View style={styles.section}>
          <Text style={styles.label}>RACING AREAS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            <Pressable
              onPress={() => {
                triggerHaptic('impactLight');
                onAddArea();
              }}
              style={styles.addPill}
            >
              <Ionicons
                name="add"
                size={16}
                color={IOS_COLORS.systemBlue}
              />
              <Text style={styles.addPillText}>Add Area</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  section: {
    marginBottom: IOS_SPACING.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.xs,
  },
  pillRow: {
    flexDirection: 'row',
    paddingHorizontal: IOS_SPACING.lg,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: IOS_RADIUS.sm,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  pillSelected: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderColor: IOS_COLORS.systemBlue,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.label,
    letterSpacing: -0.08,
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: IOS_RADIUS.sm,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
    gap: 4,
  },
  addPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
    letterSpacing: -0.08,
  },
});

export default VenueDetailHeader;
