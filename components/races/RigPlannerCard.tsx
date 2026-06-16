/**
 * Rig Planner Card
 *
 * Card component for managing rig and sail settings.
 * Displays wind band presets and allows note-taking for crew sync.
 */

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { RigPreset } from '@/lib/races';

export interface RigPlannerCardProps {
  /** Available rig presets for different wind conditions */
  presets: RigPreset[];
  /** Currently selected wind band ID */
  selectedBand: string | null;
  /** Callback when a wind band is selected */
  onSelectBand: (bandId: string) => void;
  /** User's notes/adjustments */
  notes: string;
  /** Callback when notes change */
  onChangeNotes: (value: string) => void;
  /** Callback to open chat/review */
  onOpenChat?: () => void;
  /** Whether using generic (non-class-specific) defaults */
  isGenericDefaults?: boolean;
  /** Boat class name for display */
  boatClassName?: string | null;
  /** Callback to add a tuning guide */
  onAddTuningGuide?: () => void;
}

/**
 * Rig Planner Card Component
 */
export function RigPlannerCard({
  presets,
  selectedBand,
  onSelectBand,
  notes,
  onChangeNotes,
  onOpenChat,
  isGenericDefaults = false,
  boatClassName,
  onAddTuningGuide,
}: RigPlannerCardProps) {
  if (!presets || presets.length === 0) {
    return null;
  }

  const activePreset = presets.find((preset) => preset.id === selectedBand) ?? presets[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rig &amp; Sail Planner</Text>
        {onOpenChat && (
          <TouchableOpacity
            onPress={onOpenChat}
            accessibilityRole="button"
            style={styles.chatButton}
          >
            <MaterialCommunityIcons name="chat-processing-outline" size={16} color="#007AFF" />
            <Text style={styles.chatButtonText}>Review chat</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Warning when using generic defaults */}
      {isGenericDefaults && (
        <View style={styles.warningContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={18}
            color="#b45309"
            style={{ marginTop: 2 }}
          />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Generic Settings Shown</Text>
            <Text style={styles.warningText}>
              These are generic rig settings, not specific to {boatClassName || 'your boat class'}.
              Add a tuning guide for accurate {boatClassName || 'class'}-specific recommendations.
            </Text>
            {onAddTuningGuide && (
              <Pressable onPress={onAddTuningGuide} style={styles.addGuideButton}>
                <MaterialCommunityIcons name="book-plus-outline" size={14} color="#b45309" />
                <Text style={styles.addGuideText}>Add tuning guide</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View style={styles.presetsContainer}>
        {presets.map((preset) => {
          const isActive = preset.id === activePreset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              onPress={() => onSelectBand(preset.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[
                styles.presetButton,
                isActive ? styles.presetButtonActive : styles.presetButtonInactive,
              ]}
            >
              <Text
                style={[
                  styles.presetButtonText,
                  isActive ? styles.presetButtonTextActive : styles.presetButtonTextInactive,
                ]}
              >
                {preset.label} • {preset.windRange}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.detailsPanel}>
        <RigPlannerDetailRow label="Uppers" value={activePreset.uppers} />
        <RigPlannerDetailRow label="Lowers" value={activePreset.lowers} />
        <RigPlannerDetailRow label="Runners" value={activePreset.runners} />
        <RigPlannerDetailRow label="Mast Ram" value={activePreset.ram} />
        <Text style={styles.detailsNotes}>{activePreset.notes}</Text>
      </View>

      <TextInput
        value={notes}
        onChangeText={onChangeNotes}
        placeholder="Notes or adjustments (e.g., traveller +1 cm, jib lead aft ½ hole)"
        multiline
        numberOfLines={3}
        style={styles.notesInput}
        placeholderTextColor="#94A3B8"
      />
      <Text style={styles.helperText}>
        Track tweaks made dockside so the crew can sync after racing.
      </Text>
    </View>
  );
}

/**
 * Detail row for rig settings
 */
function RigPlannerDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  warningText: {
    fontSize: 12,
    color: '#D97706',
    marginTop: 4,
  },
  addGuideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  addGuideText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  presetButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  presetButtonInactive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetButtonTextActive: {
    color: '#FFFFFF',
  },
  presetButtonTextInactive: {
    color: '#1D4ED8',
  },
  detailsPanel: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  detailsNotes: {
    fontSize: 11,
    color: '#1E3A8A',
    marginTop: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#334155',
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  detailValue: {
    fontSize: 12,
    color: '#1E40AF',
    textAlign: 'right',
    marginLeft: 12,
    flex: 1,
  },
});

export default RigPlannerCard;
