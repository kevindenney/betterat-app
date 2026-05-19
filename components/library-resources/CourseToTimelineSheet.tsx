/**
 * CourseToTimelineSheet — modal to select course lessons and batch-create
 * timeline steps from them.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useCreateStepsFromCourse } from '@/hooks/useTimelineSteps';
import type { LibraryResourceRecord } from '@/types/library';
import { getCourseMetadata, getAllLessons } from '@/types/library';

interface CourseToTimelineSheetProps {
  visible: boolean;
  resource: LibraryResourceRecord;
  userId: string;
  interestId: string;
  onClose: () => void;
  onSuccess?: (stepCount: number) => void;
}

export function CourseToTimelineSheet({
  visible,
  resource,
  userId,
  interestId,
  onClose,
  onSuccess,
}: CourseToTimelineSheetProps) {
  const { course_structure } = getCourseMetadata(resource);
  const allLessons = useMemo(
    () => (course_structure ? getAllLessons(course_structure) : []),
    [course_structure],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(allLessons.map((l) => l.id)),
  );
  const [spacingDays, setSpacingDays] = useState('1');
  const createSteps = useCreateStepsFromCourse();

  const toggleLesson = useCallback((lessonId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === allLessons.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allLessons.map((l) => l.id)));
    }
  }, [selectedIds.size, allLessons]);

  const handleCreate = useCallback(() => {
    const selectedLessons = allLessons.filter((l) => selectedIds.has(l.id));
    if (selectedLessons.length === 0) return;

    createSteps.mutate(
      {
        userId,
        interestId,
        resourceId: resource.id,
        courseTitle: resource.title,
        authorOrCreator: resource.author_or_creator ?? undefined,
        lessons: selectedLessons,
        spacingDays: parseInt(spacingDays, 10) || 0,
        startDate: new Date().toISOString(),
      },
      {
        onSuccess: (steps) => {
          onSuccess?.(steps.length);
          onClose();
        },
      },
    );
  }, [allLessons, selectedIds, spacingDays, userId, interestId, resource, createSteps, onSuccess, onClose]);

  if (!course_structure) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Add to Timeline
          </Text>
          <Pressable
            onPress={handleCreate}
            disabled={selectedIds.size === 0 || createSteps.isPending}
          >
            {createSteps.isPending ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
            ) : (
              <Text
                style={[
                  styles.createText,
                  selectedIds.size === 0 && styles.createTextDisabled,
                ]}
              >
                Create {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Course info */}
          <View style={styles.courseInfo}>
            <Text style={styles.courseTitle}>{resource.title}</Text>
            {resource.author_or_creator && (
              <Text style={styles.courseAuthor}>by {resource.author_or_creator}</Text>
            )}
            <Text style={styles.courseStat}>
              {course_structure.total_lessons} lessons
              {course_structure.estimated_hours
                ? ` · ~${course_structure.estimated_hours}h`
                : ''}
            </Text>
          </View>

          {/* Spacing option */}
          <View style={styles.spacingRow}>
            <Text style={styles.spacingLabel}>Days between lessons</Text>
            <TextInput
              style={styles.spacingInput}
              value={spacingDays}
              onChangeText={setSpacingDays}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>

          {/* Select all toggle */}
          <Pressable style={styles.selectAllRow} onPress={toggleAll}>
            <Ionicons
              name={selectedIds.size === allLessons.length ? 'checkbox' : 'square-outline'}
              size={20}
              color={IOS_COLORS.systemBlue}
            />
            <Text style={styles.selectAllText}>
              {selectedIds.size === allLessons.length ? 'Deselect All' : 'Select All'}
            </Text>
          </Pressable>

          {/* Module / Lesson list */}
          {course_structure.modules
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((mod) => (
              <View key={mod.id} style={styles.moduleGroup}>
                <Text style={styles.moduleTitle}>{mod.title}</Text>
                {mod.lessons
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((lesson) => {
                    const isSelected = selectedIds.has(lesson.id);
                    return (
                      <Pressable
                        key={lesson.id}
                        style={styles.lessonRow}
                        onPress={() => toggleLesson(lesson.id)}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={isSelected ? IOS_COLORS.systemBlue : IOS_COLORS.systemGray3}
                        />
                        <View style={styles.lessonInfo}>
                          <Text
                            style={[
                              styles.lessonTitle,
                              !isSelected && styles.lessonTitleDeselected,
                            ]}
                            numberOfLines={2}
                          >
                            {lesson.title}
                          </Text>
                          {lesson.duration_minutes != null && (
                            <Text style={styles.lessonDuration}>
                              {lesson.duration_minutes} min
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
              </View>
            ))}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: IOS_SPACING.sm,
  },
  cancelText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
  createText: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  createTextDisabled: {
    color: IOS_COLORS.systemGray3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.md,
  },
  courseInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: IOS_SPACING.md,
    gap: 4,
  },
  courseTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  courseAuthor: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  courseStat: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
  },
  spacingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: IOS_SPACING.sm,
  },
  spacingLabel: {
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  spacingInput: {
    width: 50,
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    borderRadius: 8,
    padding: 4,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: 4,
  },
  selectAllText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
  moduleGroup: {
    gap: IOS_SPACING.xs,
  },
  moduleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingHorizontal: 4,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: IOS_SPACING.sm,
  },
  lessonInfo: {
    flex: 1,
    gap: 2,
  },
  lessonTitle: {
    fontSize: 15,
    color: IOS_COLORS.label,
  },
  lessonTitleDeselected: {
    color: IOS_COLORS.tertiaryLabel,
  },
  lessonDuration: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
});
