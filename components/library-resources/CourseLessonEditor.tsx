/**
 * CourseLessonEditor — inline editor for course modules and lessons.
 * Used inside AddResourceSheet when resource_type is 'online_course'.
 */

import React, { useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { CourseModule, CourseLesson } from '@/types/library';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

interface CourseLessonEditorProps {
  modules: CourseModule[];
  onChange: (modules: CourseModule[]) => void;
}

export function CourseLessonEditor({ modules, onChange }: CourseLessonEditorProps) {
  const addModule = useCallback(() => {
    const newModule: CourseModule = {
      id: generateId(),
      title: '',
      sort_order: modules.length,
      lessons: [],
    };
    onChange([...modules, newModule]);
  }, [modules, onChange]);

  const updateModuleTitle = useCallback(
    (moduleId: string, title: string) => {
      onChange(
        modules.map((m) => (m.id === moduleId ? { ...m, title } : m)),
      );
    },
    [modules, onChange],
  );

  const removeModule = useCallback(
    (moduleId: string) => {
      onChange(modules.filter((m) => m.id !== moduleId));
    },
    [modules, onChange],
  );

  const addLesson = useCallback(
    (moduleId: string) => {
      const newLesson: CourseLesson = {
        id: generateId(),
        title: '',
        sort_order: 0,
      };
      onChange(
        modules.map((m) => {
          if (m.id !== moduleId) return m;
          const lessons = [...m.lessons, { ...newLesson, sort_order: m.lessons.length }];
          return { ...m, lessons };
        }),
      );
    },
    [modules, onChange],
  );

  const updateLessonTitle = useCallback(
    (moduleId: string, lessonId: string, title: string) => {
      onChange(
        modules.map((m) => {
          if (m.id !== moduleId) return m;
          return {
            ...m,
            lessons: m.lessons.map((l) =>
              l.id === lessonId ? { ...l, title } : l,
            ),
          };
        }),
      );
    },
    [modules, onChange],
  );

  const removeLesson = useCallback(
    (moduleId: string, lessonId: string) => {
      onChange(
        modules.map((m) => {
          if (m.id !== moduleId) return m;
          return {
            ...m,
            lessons: m.lessons.filter((l) => l.id !== lessonId),
          };
        }),
      );
    },
    [modules, onChange],
  );

  return (
    <View style={styles.container}>
      {modules.map((mod, mi) => (
        <View key={mod.id} style={styles.moduleCard}>
          {/* Module header */}
          <View style={styles.moduleHeader}>
            <Text style={styles.moduleNumber}>Module {mi + 1}</Text>
            <Pressable onPress={() => removeModule(mod.id)} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={IOS_COLORS.systemGray3} />
            </Pressable>
          </View>
          <TextInput
            style={styles.moduleInput}
            value={mod.title}
            onChangeText={(text) => updateModuleTitle(mod.id, text)}
            placeholder="Module title"
            placeholderTextColor={IOS_COLORS.tertiaryLabel}
          />

          {/* Lessons */}
          {mod.lessons.map((lesson, li) => (
            <View key={lesson.id} style={styles.lessonRow}>
              <Text style={styles.lessonBullet}>{li + 1}.</Text>
              <TextInput
                style={styles.lessonInput}
                value={lesson.title}
                onChangeText={(text) => updateLessonTitle(mod.id, lesson.id, text)}
                placeholder="Lesson title"
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
              />
              <Pressable onPress={() => removeLesson(mod.id, lesson.id)} hitSlop={8}>
                <Ionicons name="remove-circle-outline" size={16} color={IOS_COLORS.systemRed} />
              </Pressable>
            </View>
          ))}

          {/* Add lesson */}
          <Pressable style={styles.addLessonBtn} onPress={() => addLesson(mod.id)}>
            <Ionicons name="add" size={14} color={IOS_COLORS.systemBlue} />
            <Text style={styles.addLessonText}>Add Lesson</Text>
          </Pressable>
        </View>
      ))}

      {/* Add module */}
      <Pressable style={styles.addModuleBtn} onPress={addModule}>
        <Ionicons name="add-circle-outline" size={18} color={IOS_COLORS.systemBlue} />
        <Text style={styles.addModuleText}>Add Module</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: IOS_SPACING.sm,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: IOS_SPACING.sm,
    gap: IOS_SPACING.xs,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moduleNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  moduleInput: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    padding: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  lessonBullet: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
    width: 20,
  },
  lessonInput: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.label,
    padding: 4,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  addLessonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
    paddingVertical: 2,
  },
  addLessonText: {
    fontSize: 13,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  addModuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray4,
    borderStyle: 'dashed',
  },
  addModuleText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
});
