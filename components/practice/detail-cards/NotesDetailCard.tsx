/**
 * Notes Detail Card
 *
 * Apple HIG compliant card showing:
 * - Session reflection notes
 * - Overall rating (star display)
 * - AI next-focus suggestion
 * - Key takeaways
 *
 * Tufte design: Clean typography, minimal decoration.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  MessageSquare,
  Star,
  Sparkles,
  Lightbulb,
  ChevronRight,
  Edit3,
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/components/cards/constants';
import { CARD_EXPAND_DURATION, CARD_COLLAPSE_DURATION } from '@/constants/navigationAnimations';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Star Rating Component
 */
function StarRating({
  rating,
  maxRating = 5,
  size = 20,
  onSelect,
  editable = false,
}: {
  rating: number;
  maxRating?: number;
  size?: number;
  onSelect?: (rating: number) => void;
  editable?: boolean;
}) {
  const stars = [];
  for (let i = 1; i <= maxRating; i++) {
    stars.push(
      <TouchableOpacity
        key={i}
        onPress={() => editable && onSelect?.(i)}
        disabled={!editable}
        activeOpacity={editable ? 0.7 : 1}
        style={styles.starButton}
      >
        <Star
          size={size}
          color={IOS_COLORS.orange}
          fill={i <= rating ? IOS_COLORS.orange : 'transparent'}
        />
      </TouchableOpacity>
    );
  }
  return <View style={styles.starRow}>{stars}</View>;
}

interface NotesDetailCardProps {
  sessionStatus: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  reflectionNotes?: string | null;
  overallRating?: number | null;
  aiNextFocusSuggestion?: string | null;
  keyTakeaway?: string | null;
  isExpanded?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  onSaveReflection?: (notes: string, rating: number) => Promise<void>;
  onAcceptSuggestion?: () => void;
}

export function NotesDetailCard({
  sessionStatus,
  reflectionNotes,
  overallRating,
  aiNextFocusSuggestion,
  keyTakeaway,
  isExpanded = false,
  onToggle,
  onPress,
  onSaveReflection,
  onAcceptSuggestion,
}: NotesDetailCardProps) {
  const rotation = useSharedValue(isExpanded ? 1 : 0);
  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState(reflectionNotes || '');
  const [rating, setRating] = useState(overallRating || 0);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    rotation.value = withTiming(isExpanded ? 1 : 0, {
      duration: isExpanded ? CARD_EXPAND_DURATION : CARD_COLLAPSE_DURATION,
    });
  }, [isExpanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => {
    'worklet';
    const rotationValue = rotation.value ?? 0;
    return {
      transform: [{ rotate: `${interpolate(rotationValue, [0, 1], [0, 90])}deg` }],
    };
  });

  const handlePress = () => {
    if (editMode) return; // Don't collapse while editing
    LayoutAnimation.configureNext({
      duration: isExpanded ? CARD_COLLAPSE_DURATION : CARD_EXPAND_DURATION,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    if (onToggle) {
      onToggle();
    } else if (onPress) {
      onPress();
    }
  };

  const handleSave = async () => {
    if (!onSaveReflection) return;
    setIsSaving(true);
    try {
      await onSaveReflection(notes, rating);
      setEditMode(false);
    } finally {
      setIsSaving(false);
    }
  };

  const isCompleted = sessionStatus === 'completed';
  const hasContent = reflectionNotes || overallRating || aiNextFocusSuggestion || keyTakeaway;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={editMode ? 1 : 0.7}
    >
      {/* Collapsed View */}
      {!isExpanded && (
        <View style={styles.tufteGrid}>
          {/* Notes summary row */}
          <View style={styles.tufteRow}>
            <MessageSquare size={18} color={IOS_COLORS.blue} />
            {overallRating ? (
              <StarRating rating={overallRating} size={16} />
            ) : (
              <Text style={styles.tufteValue}>
                {isCompleted ? 'Add reflection' : 'Session notes'}
              </Text>
            )}
            <Animated.View style={chevronStyle}>
              <MaterialCommunityIcons name="chevron-right" size={18} color={IOS_COLORS.gray3} />
            </Animated.View>
          </View>

          {/* Preview of notes */}
          {reflectionNotes && (
            <Text style={styles.notesPreview} numberOfLines={2}>
              {reflectionNotes}
            </Text>
          )}

          {/* AI suggestion preview */}
          {aiNextFocusSuggestion && (
            <View style={styles.aiPreviewRow}>
              <Sparkles size={12} color={IOS_COLORS.cyan} />
              <Text style={styles.aiPreviewText} numberOfLines={1}>
                {aiNextFocusSuggestion}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionLabel}>
              {isCompleted ? 'REFLECTION' : 'SESSION NOTES'}
            </Text>
            {isCompleted && !editMode && onSaveReflection && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditMode(true)}
              >
                <Edit3 size={14} color={IOS_COLORS.blue} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Rating Section (for completed sessions) */}
          {isCompleted && (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>How did it go?</Text>
              <StarRating
                rating={editMode ? rating : (overallRating || 0)}
                size={28}
                editable={editMode}
                onSelect={setRating}
              />
            </View>
          )}

          {/* Notes Section */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>
              {isCompleted ? 'What did you learn?' : 'Pre-session notes'}
            </Text>
            {editMode ? (
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add your notes here..."
                placeholderTextColor={IOS_COLORS.gray3}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : reflectionNotes ? (
              <Text style={styles.notesText}>{reflectionNotes}</Text>
            ) : (
              <Text style={styles.notesPlaceholder}>
                {isCompleted
                  ? 'Tap edit to add your reflection'
                  : 'No pre-session notes yet'}
              </Text>
            )}
          </View>

          {/* Save Button (edit mode) */}
          {editMode && (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditMode(false);
                  setNotes(reflectionNotes || '');
                  setRating(overallRating || 0);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Key Takeaway */}
          {keyTakeaway && !editMode && (
            <View style={styles.takeawaySection}>
              <View style={styles.takeawayHeader}>
                <Lightbulb size={16} color={IOS_COLORS.orange} />
                <Text style={styles.takeawayLabel}>Key Takeaway</Text>
              </View>
              <Text style={styles.takeawayText}>{keyTakeaway}</Text>
            </View>
          )}

          {/* AI Next Focus Suggestion */}
          {aiNextFocusSuggestion && !editMode && (
            <View style={styles.aiSuggestionSection}>
              <View style={styles.aiSuggestionHeader}>
                <Sparkles size={16} color={IOS_COLORS.cyan} />
                <Text style={styles.aiSuggestionLabel}>Suggestion</Text>
              </View>
              <Text style={styles.aiSuggestionText}>{aiNextFocusSuggestion}</Text>
              {onAcceptSuggestion && (
                <TouchableOpacity
                  style={styles.acceptSuggestionButton}
                  onPress={onAcceptSuggestion}
                >
                  <Text style={styles.acceptSuggestionText}>Use for next session</Text>
                  <ChevronRight size={16} color={IOS_COLORS.cyan} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Empty state for non-completed sessions */}
          {!hasContent && !isCompleted && !editMode && (
            <View style={styles.emptyContent}>
              <MessageSquare size={24} color={IOS_COLORS.gray3} />
              <Text style={styles.emptyText}>
                Add notes to prepare for your practice
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
    flex: 1,
  },
  tufteGrid: {
    gap: 8,
  },
  tufteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tufteValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  starRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 2,
  },
  notesPreview: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    marginLeft: 28,
    lineHeight: 18,
  },
  aiPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 28,
    marginTop: 4,
  },
  aiPreviewText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.cyan,
    fontStyle: 'italic',
  },
  expandedContent: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.blue,
  },
  ratingSection: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
    backgroundColor: `${IOS_COLORS.orange}08`,
    borderRadius: 12,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  notesSection: {
    gap: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesInput: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: IOS_COLORS.label,
    minHeight: 100,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
  },
  notesText: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.label,
    lineHeight: 22,
  },
  notesPlaceholder: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
    color: IOS_COLORS.gray,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.gray6,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.blue,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.systemBackground,
  },
  takeawaySection: {
    backgroundColor: `${IOS_COLORS.orange}08`,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  takeawayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  takeawayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  takeawayText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
  aiSuggestionSection: {
    backgroundColor: `${IOS_COLORS.cyan}08`,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiSuggestionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.cyan,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiSuggestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  acceptSuggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${IOS_COLORS.cyan}30`,
    marginTop: 4,
  },
  acceptSuggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.cyan,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: IOS_COLORS.gray,
    textAlign: 'center',
  },
});

export default NotesDetailCard;
