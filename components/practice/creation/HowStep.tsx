/**
 * HowStep Component
 *
 * Step 4 of the 4Q wizard: How to do the practice?
 * - Review/customize drill instructions
 * - Set success criteria
 * - Final session summary
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  BookOpen,
  Target,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  Edit3,
  CheckCircle,
  FileText,
} from 'lucide-react-native';
import { IOS_COLORS } from '@/components/cards/constants';
import {
  HowStepData,
  DrillInstructions,
  Drill,
  WhatStepDrill,
  WhoStepMember,
  DRILL_CATEGORY_META,
} from '@/types/practice';

interface HowStepProps {
  data: HowStepData;
  drills: WhatStepDrill[];
  availableDrills: Drill[];
  members: WhoStepMember[];
  estimatedDuration: number;
  onDrillInstructionsChange: (drillId: string, instructions: string) => void;
  onDrillSuccessCriteriaChange: (drillId: string, criteria: string) => void;
  onSessionNotesChange: (notes: string) => void;
}

function DrillInstructionCard({
  drill,
  drillRef,
  instruction,
  onInstructionsChange,
  onSuccessCriteriaChange,
}: {
  drill: Drill;
  drillRef: WhatStepDrill;
  instruction?: DrillInstructions;
  onInstructionsChange: (instructions: string) => void;
  onSuccessCriteriaChange: (criteria: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const categoryMeta = DRILL_CATEGORY_META[drill.category];

  // Use custom instructions if set, otherwise use drill default
  const displayInstructions = instruction?.customInstructions || drill.instructions || '';
  const hasCustomInstructions = !!instruction?.customInstructions;
  const successCriteria = instruction?.successCriteria || '';

  return (
    <View style={styles.instructionCard}>
      <TouchableOpacity
        style={styles.instructionHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.instructionTitle}>
          <Text style={styles.drillOrder}>#{drillRef.orderIndex + 1}</Text>
          <View style={styles.drillTitleInfo}>
            <Text style={styles.drillName}>{drill.name}</Text>
            <Text style={styles.drillMeta}>
              {categoryMeta?.label} · {drillRef.durationMinutes || drill.durationMinutes} min
              {drillRef.repetitions && ` · ${drillRef.repetitions} reps`}
            </Text>
          </View>
        </View>
        {expanded ? (
          <ChevronUp size={18} color={IOS_COLORS.gray3} />
        ) : (
          <ChevronDown size={18} color={IOS_COLORS.gray3} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.instructionContent}>
          {/* Instructions */}
          <View style={styles.instructionSection}>
            <View style={styles.instructionSectionHeader}>
              <BookOpen size={14} color={IOS_COLORS.indigo} />
              <Text style={styles.instructionSectionTitle}>Instructions</Text>
              {hasCustomInstructions && (
                <View style={styles.customBadge}>
                  <Text style={styles.customBadgeText}>Custom</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => setIsEditing(!isEditing)}
                hitSlop={8}
              >
                <Edit3 size={14} color={IOS_COLORS.indigo} />
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <TextInput
                style={styles.instructionTextInput}
                value={displayInstructions}
                onChangeText={onInstructionsChange}
                placeholder="Enter drill instructions..."
                placeholderTextColor={IOS_COLORS.gray3}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.instructionText}>
                {displayInstructions || 'No instructions set'}
              </Text>
            )}
          </View>

          {/* Success Criteria */}
          <View style={styles.instructionSection}>
            <View style={styles.instructionSectionHeader}>
              <Target size={14} color={IOS_COLORS.green} />
              <Text style={styles.instructionSectionTitle}>Success Criteria</Text>
            </View>

            <TextInput
              style={styles.criteriaInput}
              value={successCriteria}
              onChangeText={onSuccessCriteriaChange}
              placeholder="How will you know this drill was successful?"
              placeholderTextColor={IOS_COLORS.gray3}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        </View>
      )}
    </View>
  );
}

function SessionSummary({
  drillCount,
  memberCount,
  estimatedDuration,
}: {
  drillCount: number;
  memberCount: number;
  estimatedDuration: number;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Session Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <BookOpen size={20} color={IOS_COLORS.indigo} />
          <Text style={styles.summaryValue}>{drillCount}</Text>
          <Text style={styles.summaryLabel}>Drills</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Users size={20} color={IOS_COLORS.indigo} />
          <Text style={styles.summaryValue}>{memberCount}</Text>
          <Text style={styles.summaryLabel}>Crew</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Clock size={20} color={IOS_COLORS.indigo} />
          <Text style={styles.summaryValue}>{estimatedDuration}</Text>
          <Text style={styles.summaryLabel}>Minutes</Text>
        </View>
      </View>
    </View>
  );
}

export function HowStep({
  data,
  drills,
  availableDrills,
  members,
  estimatedDuration,
  onDrillInstructionsChange,
  onDrillSuccessCriteriaChange,
  onSessionNotesChange,
}: HowStepProps) {
  const getDrillInstruction = (drillId: string) => {
    return data.drillInstructions.find((i) => i.drillId === drillId);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Session Summary */}
      <SessionSummary
        drillCount={drills.length}
        memberCount={members.length}
        estimatedDuration={estimatedDuration}
      />

      {/* Drill Instructions Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <BookOpen size={18} color={IOS_COLORS.indigo} />
          <Text style={styles.sectionTitle}>Drill Instructions</Text>
        </View>

        <Text style={styles.sectionSubtext}>
          Review and customize instructions for each drill
        </Text>

        {drills.map((drillRef) => {
          const drill = availableDrills.find((d) => d.id === drillRef.drillId);
          if (!drill) return null;

          return (
            <DrillInstructionCard
              key={drillRef.drillId}
              drill={drill}
              drillRef={drillRef}
              instruction={getDrillInstruction(drillRef.drillId)}
              onInstructionsChange={(instructions) =>
                onDrillInstructionsChange(drillRef.drillId, instructions)
              }
              onSuccessCriteriaChange={(criteria) =>
                onDrillSuccessCriteriaChange(drillRef.drillId, criteria)
              }
            />
          );
        })}
      </View>

      {/* Session Notes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={18} color={IOS_COLORS.indigo} />
          <Text style={styles.sectionTitle}>Session Notes</Text>
        </View>

        <Text style={styles.sectionSubtext}>
          Any additional notes or reminders for this practice
        </Text>

        <TextInput
          style={styles.notesInput}
          value={data.sessionNotes || ''}
          onChangeText={onSessionNotesChange}
          placeholder="Add any notes for this session..."
          placeholderTextColor={IOS_COLORS.gray3}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Ready Indicator */}
      <View style={styles.readyCard}>
        <CheckCircle size={24} color={IOS_COLORS.green} />
        <View style={styles.readyText}>
          <Text style={styles.readyTitle}>Ready to create!</Text>
          <Text style={styles.readySubtext}>
            Review your selections above, then tap Create Session
          </Text>
        </View>
      </View>

      {/* Spacer */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  summaryCard: {
    backgroundColor: IOS_COLORS.indigo,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  section: {
    backgroundColor: IOS_COLORS.systemBackground,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  sectionSubtext: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    marginBottom: 12,
  },
  instructionCard: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  instructionTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drillOrder: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_COLORS.indigo,
    width: 28,
    textAlign: 'center',
  },
  drillTitleInfo: {
    flex: 1,
  },
  drillName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  drillMeta: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    marginTop: 2,
  },
  instructionContent: {
    padding: 12,
    paddingTop: 0,
    gap: 12,
  },
  instructionSection: {
    gap: 8,
  },
  instructionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  instructionSectionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customBadge: {
    backgroundColor: `${IOS_COLORS.orange}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_COLORS.orange,
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 8,
    padding: 10,
  },
  instructionTextInput: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    borderWidth: 1,
    borderColor: IOS_COLORS.indigo,
  },
  criteriaInput: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 8,
    padding: 10,
    minHeight: 50,
  },
  notesInput: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: IOS_COLORS.label,
    minHeight: 100,
    lineHeight: 20,
  },
  readyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: `${IOS_COLORS.green}10`,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.green}30`,
  },
  readyText: {
    flex: 1,
  },
  readyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.green,
  },
  readySubtext: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
});

export default HowStep;
