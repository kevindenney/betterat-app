/**
 * CourseContextSheet — inline popup showing the full course structure
 * from the library resource this step was created from. Highlights the
 * current lesson and shows completion progress.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import { ResourceTypeIcon, getResourceTypeLabel } from '@/components/library-resources/ResourceTypeIcon';
import { getResourcesByIds } from '@/services/LibraryService';
import {
  getCourseMetadata,
  getAllLessons,
  getCourseCompletionPercent,
} from '@/types/library';
import type { LibraryResourceRecord, CourseLesson } from '@/types/library';

interface CourseContext {
  resource_id: string;
  course_title: string;
  author_or_creator?: string;
  lesson_id?: string;
  lesson_index?: number;
  total_lessons?: number;
}

interface CourseContextSheetProps {
  visible: boolean;
  onClose: () => void;
  courseContext: CourseContext;
}

export function CourseContextSheet({ visible, onClose, courseContext }: CourseContextSheetProps) {
  const [resource, setResource] = useState<LibraryResourceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible || !courseContext.resource_id) return;
    setLoading(true);
    setError(false);
    getResourcesByIds([courseContext.resource_id])
      .then((resources) => {
        setResource(resources[0] ?? null);
        if (!resources[0]) setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [visible, courseContext.resource_id]);

  const { course_structure, progress } = resource
    ? getCourseMetadata(resource)
    : { course_structure: undefined, progress: undefined };

  const allLessons = course_structure ? getAllLessons(course_structure) : [];
  const completedIds = new Set(progress?.completed_lesson_ids ?? []);
  const completionPercent = resource ? getCourseCompletionPercent(resource) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="school-outline" size={20} color={IOS_COLORS.systemPurple} />
            <Text style={styles.headerTitle} numberOfLines={1}>Course</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={28} color={IOS_COLORS.secondaryLabel} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={IOS_COLORS.systemPurple} />
          </View>
        ) : error || !resource ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={40} color={IOS_COLORS.tertiaryLabel} />
            <Text style={styles.errorText}>Could not load course details</Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Resource card */}
            <View style={styles.resourceCard}>
              <View style={styles.resourceHeader}>
                <ResourceTypeIcon type={resource.resource_type} size={28} />
                <View style={styles.resourceInfo}>
                  <Text style={styles.resourceTitle}>{resource.title}</Text>
                  {resource.author_or_creator && (
                    <Text style={styles.resourceAuthor}>by {resource.author_or_creator}</Text>
                  )}
                </View>
              </View>

              {resource.description && (
                <Text style={styles.resourceDescription} numberOfLines={3}>
                  {resource.description}
                </Text>
              )}

              <View style={styles.metaRow}>
                <Text style={styles.typeBadge}>
                  {getResourceTypeLabel(resource.resource_type)}
                </Text>
                {resource.source_platform && (
                  <Text style={styles.platformText}>{resource.source_platform}</Text>
                )}
              </View>

              {/* Progress bar */}
              {allLessons.length > 0 && (
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>
                      {completedIds.size} of {allLessons.length} lessons completed
                    </Text>
                    <Text style={styles.progressPercent}>{completionPercent}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[styles.progressBarFill, { width: `${completionPercent}%` }]}
                    />
                  </View>
                </View>
              )}

              {/* Open source URL */}
              {resource.url && (
                <Pressable
                  style={styles.openUrlButton}
                  onPress={() => Linking.openURL(resource.url!)}
                >
                  <Ionicons name="open-outline" size={16} color={STEP_COLORS.accent} />
                  <Text style={styles.openUrlText}>Open course</Text>
                </Pressable>
              )}
            </View>

            {/* Lesson list */}
            {course_structure && course_structure.modules.length > 0 && (
              <View style={styles.lessonsSection}>
                <Text style={styles.lessonsHeader}>LESSONS</Text>
                {course_structure.modules
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((mod) => (
                    <View key={mod.id}>
                      {course_structure.modules.length > 1 && (
                        <Text style={styles.moduleTitle}>{mod.title}</Text>
                      )}
                      {mod.lessons
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((lesson, lessonIdx) => {
                          const isCurrent = lesson.id === courseContext.lesson_id;
                          const isCompleted = completedIds.has(lesson.id);
                          return (
                            <LessonRow
                              key={lesson.id}
                              lesson={lesson}
                              index={lessonIdx}
                              isCurrent={isCurrent}
                              isCompleted={isCompleted}
                            />
                          );
                        })}
                    </View>
                  ))}
              </View>
            )}

            {/* Fallback: no course structure */}
            {(!course_structure || allLessons.length === 0) && (
              <View style={styles.noStructure}>
                <Ionicons name="list-outline" size={24} color={IOS_COLORS.tertiaryLabel} />
                <Text style={styles.noStructureText}>
                  No lesson structure available for this resource
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function LessonRow({
  lesson,
  index,
  isCurrent,
  isCompleted,
}: {
  lesson: CourseLesson;
  index: number;
  isCurrent: boolean;
  isCompleted: boolean;
}) {
  return (
    <Pressable
      style={[styles.lessonRow, isCurrent && styles.lessonRowCurrent]}
      onPress={() => {
        if (lesson.url) Linking.openURL(lesson.url);
      }}
    >
      <View
        style={[
          styles.lessonIndicator,
          isCompleted && styles.lessonIndicatorCompleted,
          isCurrent && styles.lessonIndicatorCurrent,
        ]}
      >
        {isCompleted ? (
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        ) : isCurrent ? (
          <Ionicons name="play" size={10} color="#FFFFFF" />
        ) : (
          <Text style={styles.lessonNumber}>{index + 1}</Text>
        )}
      </View>

      <View style={styles.lessonInfo}>
        <Text
          style={[
            styles.lessonTitle,
            isCurrent && styles.lessonTitleCurrent,
            isCompleted && styles.lessonTitleCompleted,
          ]}
          numberOfLines={2}
        >
          {lesson.title}
        </Text>
        {lesson.duration_minutes != null && (
          <Text style={styles.lessonDuration}>{lesson.duration_minutes} min</Text>
        )}
      </View>

      {isCurrent && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>Current</Text>
        </View>
      )}

      {lesson.url && (
        <Ionicons name="open-outline" size={14} color={IOS_COLORS.tertiaryLabel} />
      )}
    </Pressable>
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
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: IOS_COLORS.tertiaryLabel,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.md,
    paddingBottom: 40,
  },
  resourceCard: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    padding: IOS_SPACING.md,
    gap: 10,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  resourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resourceInfo: {
    flex: 1,
    gap: 2,
  },
  resourceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
    lineHeight: 22,
  },
  resourceAuthor: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  resourceDescription: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: '500',
    color: STEP_COLORS.accent,
    backgroundColor: STEP_COLORS.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  platformText: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  progressSection: {
    gap: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 12,
    color: IOS_COLORS.systemGreen,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: IOS_COLORS.systemGreen,
    borderRadius: 3,
  },
  openUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  openUrlText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
  lessonsSection: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  lessonsHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.5,
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.xs,
  },
  moduleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.label,
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.sm,
    paddingBottom: 4,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  lessonRowCurrent: {
    backgroundColor: 'rgba(175,82,222,0.06)',
  },
  lessonIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemGray5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonIndicatorCompleted: {
    backgroundColor: IOS_COLORS.systemGreen,
  },
  lessonIndicatorCurrent: {
    backgroundColor: IOS_COLORS.systemPurple,
  },
  lessonNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  lessonInfo: {
    flex: 1,
    gap: 2,
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
    lineHeight: 19,
  },
  lessonTitleCurrent: {
    fontWeight: '700',
    color: IOS_COLORS.systemPurple,
  },
  lessonTitleCompleted: {
    color: IOS_COLORS.secondaryLabel,
  },
  lessonDuration: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  currentBadge: {
    backgroundColor: IOS_COLORS.systemPurple,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  noStructure: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: IOS_SPACING.xl,
  },
  noStructureText: {
    fontSize: 14,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
  },
});
