/**
 * Course Detail Screen
 * Shows full course information, modules, and lessons
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { LearningService, type LearningCourse, type LearningModule, type LearningLesson } from '@/services/LearningService';
import { LessonProgressService, type LessonProgress } from '@/services/LessonProgressService';
import { coursePaymentService } from '@/services/CoursePaymentService';
import CourseCatalogService, { type Course as CatalogCourse } from '@/services/CourseCatalogService';
import { getCourseWithLessons, type BetterAtCourse, type BetterAtLesson } from '@/services/BetterAtCourseService';
import { useAuth } from '@/providers/AuthProvider';
import { useCoachingStatus } from '@/hooks/useCoachingStatus';
import { CourseCompletionCoachPrompt } from '@/components/learn/CoachRecruitmentBanner';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { showAlert, showAlertWithButtons, showConfirm } from '@/lib/utils/crossPlatformAlert';

export default function CourseDetailScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { user } = useAuth();
  const { relationship: coachingRelationship } = useCoachingStatus();
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState<LearningCourse | null>(null);
  const [betterAtCourse, setBetterAtCourse] = useState<BetterAtCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [lessonProgress, setLessonProgress] = useState<Map<string, LessonProgress>>(new Map());
  const [courseProgress, setCourseProgress] = useState(0);
  const [hasProSubscription, setHasProSubscription] = useState(false);
  const [userSubscriptionTier, setUserSubscriptionTier] = useState<string>('free');

  const showCourseUnavailable = (message: string) => {
    showAlertWithButtons(
      'Course Not Available',
      message,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Browse Learn', onPress: () => router.push('/(tabs)/learn') },
        {
          text: 'Contact Support',
          onPress: () =>
            Linking.openURL(
              `mailto:info@better.at?subject=${encodeURIComponent('Course setup issue')}&body=${encodeURIComponent(`Course: ${String(courseId || '')}\n\nIssue: ${message}`)}`
            ),
        },
      ]
    );
  };

  useEffect(() => {
    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  // Check enrollment when user, courseId, or course data changes
  useEffect(() => {
    if (courseId && user?.id && course?.id) {
      checkEnrollment();
    }
  }, [courseId, user?.id, course?.id]);

  const loadCourse = async () => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId);

      // Try BetterAt DB-backed course first (nursing, drawing, fitness)
      if (isUUID) {
        try {
          const dbCourse = await getCourseWithLessons(courseId);
          if (dbCourse && dbCourse.lessons && dbCourse.lessons.length > 0) {
            setBetterAtCourse(dbCourse);
            setLoading(false);
            setEnrolled(true); // BetterAt courses are freely accessible
            return;
          }
        } catch (err) {
          // Not a BetterAt course, continue with legacy flow
        }
      }

      // First, try to load from JSON catalog (single source of truth)
      let catalogCourse: CatalogCourse | undefined;
      
      if (isUUID) {
        catalogCourse = CourseCatalogService.getCourseById(courseId);
      } else {
        // Try by slug first (most common case from navigation)
        catalogCourse = CourseCatalogService.getCourseBySlug(courseId);
      }
      
      // If found in catalog, convert to LearningCourse format for compatibility
      if (catalogCourse) {
        // Try to get the database UUID by looking up the course by slug
        // This ensures we have the real UUID for enrollment operations
        let dbCourseId: string | null = null;
        let courseExistsInDb = false;
        try {
          const dbCourse = await Promise.race([
            LearningService.getCourseBySlugForEnrollment(catalogCourse.slug),
            new Promise<LearningCourse | null>((resolve) => 
              setTimeout(() => resolve(null), 10000)
            )
          ]) as LearningCourse | null;
          
          if (dbCourse && dbCourse.id) {
            dbCourseId = dbCourse.id; // Use the database UUID
            courseExistsInDb = true;
          } else {
            console.log('[CourseDetail] Course not found in database — using catalog-only mode.');
            // Course doesn't exist in database yet - we'll use null to indicate this
            // and skip enrollment operations
            dbCourseId = null;
            courseExistsInDb = false;
          }
        } catch (err: any) {
          // Check if it's a 406 or other error indicating course doesn't exist
          const isNotFoundError = err?.code === 'PGRST116' || err?.status === 406 || err?.message?.includes('406');
          if (isNotFoundError) {
            console.log('[CourseDetail] Course not found in database (404/406) — using catalog-only mode.');
            dbCourseId = null;
            courseExistsInDb = false;
          } else {
            console.warn('[CourseDetail] Error looking up course in database:', err);
            // For other errors, we'll still try to proceed but mark as not in DB
            dbCourseId = null;
            courseExistsInDb = false;
          }
        }
        
        const convertedCourse: LearningCourse = {
          id: dbCourseId || catalogCourse.id, // Use database UUID if available, otherwise catalog ID (for display only)
          // Store metadata about whether course exists in DB
          ...(courseExistsInDb ? {} : { _catalogOnly: true } as any),
          slug: catalogCourse.slug,
          title: catalogCourse.title,
          description: catalogCourse.description,
          long_description: catalogCourse.longDescription || null,
          thumbnail_url: catalogCourse.thumbnailUrl || null,
          level: catalogCourse.level === 'level-1' ? 'beginner' : catalogCourse.level === 'level-2' ? 'intermediate' : 'advanced',
          duration_minutes: catalogCourse.duration.totalMinutes,
          price_cents: catalogCourse.price.cents,
          stripe_price_id: null,
          stripe_product_id: null,
          is_published: catalogCourse.status === 'available',
          is_featured: catalogCourse.slug === 'winning-starts-first-beats',
          order_index: 0,
          requires_subscription: false,
          min_subscription_tier: 'free',
          instructor_name: catalogCourse.instructor?.name || null,
          instructor_bio: catalogCourse.instructor?.bio || null,
          learning_objectives: catalogCourse.whatYouLearn || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          learning_modules: catalogCourse.modules?.map((mod) => ({
            id: mod.id,
            course_id: dbCourseId || catalogCourse.id, // Use database UUID for course_id reference
            title: mod.title,
            description: null,
            order_index: mod.orderIndex,
            duration_minutes: mod.durationMinutes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            learning_lessons: mod.lessons?.map((lesson) => ({
              id: lesson.id,
              module_id: mod.id,
              title: lesson.title,
              description: lesson.description || null,
              lesson_type: lesson.lessonType as 'video' | 'text' | 'interactive' | 'quiz',
              interactive_component: lesson.interactiveComponent || null,
              video_url: null,
              order_index: lesson.orderIndex,
              duration_seconds: lesson.durationSeconds,
              is_free_preview: lesson.isFreePreview || false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })) || [],
          })) || [],
        };
        
        setCourse(convertedCourse);
        setLoading(false);
        return;
      }
      
      // Fallback to Supabase (for backward compatibility)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 45000)
      );
      
      let courseData: LearningCourse | null = null;
      
      if (isUUID) {
        // It's a UUID - use getCourse
        courseData = await Promise.race([
          LearningService.getCourse(courseId),
          timeoutPromise,
        ]) as LearningCourse | null;
      } else {
        // It's a slug - use getCourseBySlug
        courseData = await Promise.race([
          LearningService.getCourseBySlug(courseId),
          timeoutPromise,
        ]) as LearningCourse | null;
      }
      
      setCourse(courseData);
    } catch (err: any) {
      console.error('[CourseDetail] Failed to load course:', err);
      const errorMessage = err?.message?.includes('timeout') 
        ? 'Request timed out. Please check your connection.'
        : 'Unable to load course. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const checkEnrollment = async () => {
    if (!courseId || !user?.id) {
      return;
    }

    // Wait for course to load so we have the actual UUID
    if (!course?.id) {
      return;
    }
    
    // Use course.id (UUID) instead of courseId (might be slug)
    let actualCourseId = course.id;
    
    // Check if course is catalog-only (not in database)
    // Even if marked as catalog-only, the course might exist in DB (previous lookup may have timed out)
    // So we should try to find it by slug and check enrollment
    if ((course as any)._catalogOnly) {
      
        // Try to find the course in database by slug (maybe previous lookup timed out)
        const courseSlug = course.slug || courseId;
        try {
          const dbCourse = await Promise.race([
            LearningService.getCourseBySlugForEnrollment(courseSlug),
            new Promise<LearningCourse | null>((resolve) => 
              setTimeout(() => resolve(null), 10000)
            )
          ]) as LearningCourse | null;
        
        if (dbCourse?.id) {
          actualCourseId = dbCourse.id;
          // Update course state to remove catalog-only flag
          setCourse({ ...course, id: dbCourse.id, _catalogOnly: false } as any);
        } else {
          // Course not found, but check if user is enrolled by slug (enrollment might exist even if course lookup fails)
          const isEnrolledBySlug = await Promise.race([
            LearningService.isEnrolledBySlug(user.id, courseSlug),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000))
          ]);
          
          if (isEnrolledBySlug) {
            setEnrolled(true);
            // Still try to load subscription status
            try {
              const { hasProAccess, tier } = await LearningService.checkSubscriptionAccess(user.id);
              setHasProSubscription(hasProAccess);
              setUserSubscriptionTier(tier);
            } catch (err) {
              console.warn('[CourseDetail] Failed to check subscription:', err);
            }
            return;
          } else {
            setEnrolled(false);
            return;
          }
        }
      } catch (err) {
        console.warn('[CourseDetail] Error looking up course in database:', err);
        setEnrolled(false);
        return;
      }
    }
    
    // Validate that we have a UUID (not a catalog string ID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actualCourseId);
    if (!isUUID) {
      console.warn('[CourseDetail] Course ID is not a valid UUID, trying to find by slug...');
      
      // Last resort: try to find course by slug
      const courseSlug = course.slug || courseId;
      try {
        const dbCourse = await Promise.race([
          LearningService.getCourseBySlug(courseSlug),
          new Promise<LearningCourse | null>((resolve) => 
            setTimeout(() => resolve(null), 5000)
          )
        ]) as LearningCourse | null;
        
        if (dbCourse?.id) {
          actualCourseId = dbCourse.id;
        } else {
          console.warn('[CourseDetail] Course ID is not a valid UUID and course not found in database');
          setEnrolled(false);
          return;
        }
      } catch (err) {
        console.warn('[CourseDetail] Error looking up course:', err);
        setEnrolled(false);
        return;
      }
    }

    try {
      
      // Run both queries in PARALLEL with 30-second timeout (was 10s, too short for slow connections)
      const QUERY_TIMEOUT = 30000;
      
      const subscriptionPromise = Promise.race([
        LearningService.checkSubscriptionAccess(user.id),
        new Promise<{ hasProAccess: boolean; tier: string; timedOut?: boolean }>((resolve) =>
          setTimeout(() => {
            resolve({ hasProAccess: false, tier: 'free', timedOut: true });
          }, QUERY_TIMEOUT)
        )
      ]);

      const enrollmentPromise = Promise.race([
        LearningService.isEnrolled(user.id, actualCourseId).then(result => ({ isEnrolled: result, timedOut: false })),
        new Promise<{ isEnrolled: boolean; timedOut: boolean }>((resolve) =>
          setTimeout(() => {
            resolve({ isEnrolled: false, timedOut: true });
          }, QUERY_TIMEOUT)
        )
      ]);
      
      // Wait for BOTH queries in parallel
      const [subscriptionResult, enrollmentResult] = await Promise.all([
        subscriptionPromise,
        enrollmentPromise
      ]);
      
      const { hasProAccess, tier } = subscriptionResult;
      setHasProSubscription(hasProAccess);
      setUserSubscriptionTier(tier);

      const { isEnrolled } = enrollmentResult;
      setEnrolled(isEnrolled);
      
      // If enrolled or has Pro access, load progress (non-blocking)
      if (isEnrolled || hasProAccess) {
        loadLessonProgress().catch((err) => {
          console.warn('[CourseDetail] Failed to load progress:', err);
        });
      }
    } catch (err) {
      console.error('[CourseDetail] Failed to check enrollment:', err);
    }
  };

  const loadLessonProgress = async () => {
    if (!courseId || !user?.id || !course?.id) return;
    
    // Use course.id (UUID) instead of courseId (might be slug)
    const actualCourseId = course.id;
    
    // Validate that we have a UUID (not a catalog string ID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actualCourseId);
    if (!isUUID) {
      console.warn('[CourseDetail] Course ID is not a valid UUID, skipping progress load');
      return;
    }
    
    try {
      // Get course progress summary
      const summary = await LessonProgressService.getCourseProgressSummary(user.id, actualCourseId);
      if (summary) {
        setCourseProgress(summary.progress_percent);
      }
      
      // Get individual lesson progress
      const progress = await LessonProgressService.getCourseProgress(user.id, actualCourseId);
      const progressMap = new Map<string, LessonProgress>();
      progress.forEach(p => {
        progressMap.set(p.lesson_id, p);
      });
      setLessonProgress(progressMap);
    } catch (err) {
      console.error('[CourseDetail] Failed to load lesson progress:', err);
    }
  };

  const handleLessonPress = (lesson: LearningLesson) => {
    router.push({
      pathname: '/(tabs)/learn/[courseId]/player',
      params: { 
        courseId: courseId!,
        lessonId: lesson.id,
      },
    });
  };

  const [purchasing, setPurchasing] = useState(false);

  const handleEnroll = async () => {
    // Check if user is authenticated - redirect to sign-in if not
    if (!user?.id) {
      if (Platform.OS === 'web') {
        router.push('/login');
      } else {
        showConfirm(
          'Sign In Required',
          'Please sign in to enroll in this course.',
          () => router.push('/login'),
          { confirmText: 'Sign In' }
        );
      }
      return;
    }

    if (!courseId || !course?.id) {
      showAlert('Error', 'Course information is missing. Please try refreshing the page.');
      return;
    }

    // Use course.id (UUID) instead of courseId (might be slug)
    let actualCourseId = course.id;

    // Check if course is catalog-only (not in database)
    // Even if marked as catalog-only, try to find it in database (maybe previous lookup timed out)
    if ((course as any)._catalogOnly) {
      const courseSlug = course.slug || courseId;
      try {
        const dbCourse = await Promise.race([
          LearningService.getCourseBySlugForEnrollment(courseSlug),
          new Promise<LearningCourse | null>((resolve) =>
            setTimeout(() => resolve(null), 10000)
          )
        ]) as LearningCourse | null;

        if (dbCourse?.id) {
          actualCourseId = dbCourse.id;
          setCourse({ ...course, id: dbCourse.id, _catalogOnly: false } as any);
        } else {
          // Course not in DB — try to auto-create it from catalog data
          const catalogCourse = CourseCatalogService.getCourseBySlug(courseSlug);
          if (catalogCourse) {
            try {
              const createdId = await LearningService.ensureCourseInDatabase(catalogCourse);
              if (createdId) {
                actualCourseId = createdId;
                setCourse({ ...course, id: createdId, _catalogOnly: false } as any);
              } else {
                showCourseUnavailable('Unable to set up this course. Please try again later.');
                return;
              }
            } catch (createErr) {
              console.error('[CourseDetail] Failed to create course in DB:', createErr);
              showAlert('Error', 'Unable to set up this course. Please try again later.');
              return;
            }
          } else {
            showCourseUnavailable('This course could not be found. Please try again later.');
            return;
          }
        }
      } catch (err) {
        console.error('[CourseDetail] Error looking up course in database:', err);
        showAlert('Error', 'Unable to verify course. Please try again later.');
        return;
      }
    }

    // Validate that we have a UUID (not a catalog string ID)
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actualCourseId);
    if (!isValidUUID) {
      const courseSlug = course.slug || courseId;
      try {
        const dbCourse = await Promise.race([
          LearningService.getCourseBySlug(courseSlug),
          new Promise<LearningCourse | null>((resolve) =>
            setTimeout(() => resolve(null), 10000)
          )
        ]) as LearningCourse | null;

        if (dbCourse?.id) {
          actualCourseId = dbCourse.id;
        } else {
          showCourseUnavailable('This course has not been set up in the database yet. Please try again later.');
          return;
        }
      } catch (err) {
        console.error('[CourseDetail] Error looking up course:', err);
        showAlert('Error', 'Unable to verify course. Please try again later.');
        return;
      }
    }

    try {
      setPurchasing(true);

      // Pro subscribers get free access
      if (hasProSubscription) {
        const success = await LearningService.enrollProSubscriber(user.id, actualCourseId);
        if (success) {
          setEnrolled(true);
          await loadLessonProgress();
          showAlert('Success!', 'You now have access to this course with your Pro subscription.');
        } else {
          showAlert('Error', 'Failed to enroll. Please try again.');
        }
        return;
      }

      // Check if course requires payment
      if (course?.price_cents && course.price_cents > 0) {
        const result = await coursePaymentService.purchaseCourse(
          user.id,
          actualCourseId
        );

        if (result.error) {
          showAlert('Error', result.error);
          return;
        }

        if (result.free) {
          setEnrolled(true);
          showAlert('Success', 'You are now enrolled in this course!');
          return;
        }

        if (result.url) {
          if (Platform.OS === 'web') {
            window.location.href = result.url;
          } else {
            const supported = await Linking.canOpenURL(result.url);
            if (supported) {
              await Linking.openURL(result.url);
            } else {
              showAlert('Error', 'Unable to open checkout page');
            }
          }
        }
      } else {
        // Free course - enroll directly using the actual UUID
        await LearningService.enrollInCourse(user.id, actualCourseId);
        setEnrolled(true);
        await loadLessonProgress();
        showAlert('Success', 'You are now enrolled in this free course!');
      }
    } catch (err) {
      console.error('[CourseDetail] Failed to enroll:', err);
      showAlert('Error', err instanceof Error ? err.message : 'Failed to process enrollment. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  // Check for purchase success from URL params (after Stripe redirect)
  useEffect(() => {
    const checkPurchaseSuccess = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        const purchaseStatus = urlParams.get('purchase');
        
        if (sessionId && courseId) {
          const verified = await coursePaymentService.verifyPurchase(sessionId, courseId);
          if (verified) {
            setEnrolled(true);
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            showAlert('Success', 'Your purchase is complete! You now have access to this course.');
          }
        } else if (purchaseStatus === 'cancelled') {
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    };
    
    checkPurchaseSuccess();
  }, [courseId]);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatPrice = (cents: number | null) => {
    if (!cents) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const renderModule = ({ item: module }: { item: LearningModule }) => {
    const lessons = module.learning_lessons || [];
    
    return (
      <View style={styles.moduleCard}>
        <View style={styles.moduleHeader}>
          <View style={styles.moduleHeaderLeft}>
            <View style={styles.moduleIcon}>
              <Ionicons name="book-outline" size={20} color={IOS_COLORS.systemBlue} />
            </View>
            <View style={styles.moduleHeaderText}>
              <Text style={styles.moduleTitle}>{module.title}</Text>
              {module.description && (
                <Text style={styles.moduleDescription}>{module.description}</Text>
              )}
            </View>
          </View>
          <Text style={styles.moduleLessonCount}>
            {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
          </Text>
        </View>

        {lessons.length > 0 && (
          <View style={styles.lessonsList}>
            {lessons.map((lesson, index) => {
              const progress = lessonProgress.get(lesson.id);
              const isLessonCompleted = progress?.is_completed || false;
              
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={[
                    styles.lessonItem,
                    index < lessons.length - 1 && styles.lessonItemBorder,
                  ]}
                  onPress={() => handleLessonPress(lesson)}
                  disabled={!enrolled && !lesson.is_free_preview}
                >
                  <View style={styles.lessonItemLeft}>
                    <View style={[
                      styles.lessonNumber,
                      lesson.is_free_preview && styles.lessonNumberFree,
                      isLessonCompleted && styles.lessonNumberCompleted,
                    ]}>
                      {isLessonCompleted ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : (
                        <Text style={[
                          styles.lessonNumberText,
                          isLessonCompleted && styles.lessonNumberTextCompleted,
                        ]}>
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    <View style={styles.lessonItemText}>
                      <Text style={[
                        styles.lessonTitle,
                        isLessonCompleted && styles.lessonTitleCompleted,
                      ]}>
                        {lesson.title}
                      </Text>
                      {lesson.description && (
                        <Text style={styles.lessonDescription} numberOfLines={1}>
                          {lesson.description}
                        </Text>
                      )}
                      <View style={styles.lessonMeta}>
                        <Ionicons name="time-outline" size={12} color="#64748B" />
                        <Text style={styles.lessonMetaText}>
                          {Math.floor((lesson.duration_seconds || 0) / 60)} min
                        </Text>
                        {lesson.is_free_preview && (
                          <>
                            <Text style={styles.lessonMetaSeparator}>•</Text>
                            <Text style={styles.lessonFreeBadge}>Free Preview</Text>
                          </>
                        )}
                        {isLessonCompleted && (
                          <>
                            <Text style={styles.lessonMetaSeparator}>•</Text>
                            <Text style={styles.lessonCompletedBadge}>Completed</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                  <Ionicons 
                    name={isLessonCompleted ? "checkmark-circle" : (enrolled || lesson.is_free_preview ? "play-circle-outline" : "lock-closed-outline")} 
                    size={24} 
                    color={isLessonCompleted ? "#10B981" : (enrolled || lesson.is_free_preview ? IOS_COLORS.systemBlue : "#94A3B8")}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
          <Text style={styles.loadingText}>Loading course...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render BetterAt course detail (nursing, drawing, fitness)
  if (betterAtCourse) {
    const lessons = betterAtCourse.lessons || [];
    const levelColors: Record<string, string> = {
      beginner: '#10B981', intermediate: IOS_COLORS.systemBlue, advanced: '#8B5CF6',
    };

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>
          <View style={styles.courseInfo}>
            <View style={styles.courseHeader}>
              <Text style={styles.courseTitle}>{betterAtCourse.title}</Text>
              <View style={[styles.levelBadge, { backgroundColor: levelColors[betterAtCourse.level] || '#64748B' }]}>
                <Text style={styles.levelText}>{betterAtCourse.level}</Text>
              </View>
            </View>
            {betterAtCourse.description && (
              <Text style={styles.courseDescription}>{betterAtCourse.description}</Text>
            )}
            <View style={styles.courseMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="book-outline" size={16} color="#64748B" />
                <Text style={styles.metaText}>{lessons.length} lessons</Text>
              </View>
              {betterAtCourse.topic && (
                <View style={styles.metaItem}>
                  <Ionicons name="folder-outline" size={16} color="#64748B" />
                  <Text style={styles.metaText}>{betterAtCourse.topic}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.modulesSection}>
            <Text style={styles.sectionTitle}>Lessons</Text>
            <View style={styles.moduleCard}>
              <View style={styles.lessonsList}>
                {lessons.map((lesson, index) => (
                  <TouchableOpacity
                    key={lesson.id}
                    style={[
                      styles.lessonItem,
                      index < lessons.length - 1 && styles.lessonItemBorder,
                    ]}
                    onPress={() => {
                      router.push({
                        pathname: '/(tabs)/learn/[courseId]/player',
                        params: { courseId: courseId!, lessonId: lesson.id },
                      });
                    }}
                  >
                    <View style={styles.lessonItemLeft}>
                      <View style={styles.lessonNumber}>
                        <Text style={styles.lessonNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.lessonItemText}>
                        <Text style={styles.lessonTitle}>{lesson.title}</Text>
                        {lesson.description && (
                          <Text style={styles.lessonDescription} numberOfLines={1}>
                            {lesson.description}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name="play-circle-outline" size={24} color={IOS_COLORS.systemBlue} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error || !course) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error || 'Course not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadCourse}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const modules = course.learning_modules || [];
  const levelColors: Record<string, string> = {
    beginner: '#10B981',
    intermediate: IOS_COLORS.systemBlue,
    advanced: '#8B5CF6',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Course Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          
          {course.is_featured && (
            <View style={styles.featuredBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          )}
        </View>

        {/* Course Info */}
        <View style={styles.courseInfo}>
          <View style={styles.courseHeader}>
            <Text style={styles.courseTitle}>{course.title}</Text>
            <View style={[styles.levelBadge, { backgroundColor: levelColors[course.level] || '#64748B' }]}>
              <Text style={styles.levelText}>{course.level}</Text>
            </View>
          </View>

          {course.description && (
            <Text style={styles.courseDescription}>{course.description}</Text>
          )}

          {course.long_description && (
            <Text style={styles.courseLongDescription}>{course.long_description}</Text>
          )}

          {/* Course Meta */}
          <View style={styles.courseMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#64748B" />
              <Text style={styles.metaText}>{formatDuration(course.duration_minutes)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="book-outline" size={16} color="#64748B" />
              <Text style={styles.metaText}>{modules.length} modules</Text>
            </View>
            {course.instructor_name && (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={16} color="#64748B" />
                <Text style={styles.metaText}>{course.instructor_name}</Text>
              </View>
            )}
          </View>

          {/* Learning Objectives */}
          {course.learning_objectives && course.learning_objectives.length > 0 && (
            <View style={styles.objectivesSection}>
              <Text style={styles.sectionTitle}>What you'll learn</Text>
              {course.learning_objectives.map((objective, index) => (
                <View key={index} style={styles.objectiveItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.objectiveText}>{objective}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Instructor Bio */}
          {course.instructor_bio && (
            <View style={styles.instructorSection}>
              <Text style={styles.sectionTitle}>About the instructor</Text>
              <Text style={styles.instructorBio}>{course.instructor_bio}</Text>
            </View>
          )}
        </View>

        {/* Modules and Lessons */}
        <View style={styles.modulesSection}>
          <Text style={styles.sectionTitle}>Course Content</Text>
          {modules.length > 0 ? (
            <FlatList
              data={modules}
              renderItem={renderModule}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyModules}>
              <Text style={styles.emptyModulesText}>No modules available yet</Text>
            </View>
          )}
        </View>

        {/* Bottom spacing for CTA button */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Enroll CTA — positioned above floating tab bar */}
      <View style={[styles.ctaContainer, Platform.OS !== 'web' && { bottom: FLOATING_TAB_BAR_HEIGHT + Math.max(Math.round(insets.bottom / 2), 8) + 8 }]}>
        {enrolled ? (
          <View style={styles.enrolledContainer}>
            <View style={styles.enrolledBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.enrolledText}>Enrolled</Text>
              {courseProgress > 0 && (
                <Text style={styles.progressBadge}>{courseProgress}% complete</Text>
              )}
            </View>
            {courseProgress > 0 && courseProgress < 100 && (
              <View style={styles.progressBarSmall}>
                <View style={[styles.progressBarFill, { width: `${courseProgress}%` }]} />
              </View>
            )}
            {courseProgress === 100 && (
              <CourseCompletionCoachPrompt
                courseName={course?.title ?? 'this course'}
              />
            )}
          </View>
        ) : (
          <View style={styles.ctaButtonContainer}>
            {/* Show Pro badge if user has Pro subscription */}
            {hasProSubscription && course.price_cents && course.price_cents > 0 && (
              <View style={styles.proBadge}>
                <Ionicons name="star" size={14} color="#8B5CF6" />
                <Text style={styles.proBadgeText}>Included with your Pro subscription</Text>
              </View>
            )}
            <TouchableOpacity 
              style={[
                styles.enrollButton, 
                purchasing && styles.enrollButtonDisabled,
                hasProSubscription && styles.enrollButtonPro,
              ]} 
              onPress={handleEnroll}
              disabled={purchasing}
              accessibilityRole="button"
              accessibilityLabel={hasProSubscription 
                ? 'Start Course - Included with Pro'
                : course.price_cents && course.price_cents > 0 
                  ? `Enroll for ${formatPrice(course.price_cents)}`
                  : 'Enroll for Free'
              }
            >
              {purchasing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.enrollButtonText}>
                    {hasProSubscription
                      ? 'Start Course'
                      : course.price_cents && course.price_cents > 0 
                        ? `Enroll for ${formatPrice(course.price_cents)}`
                        : 'Enroll for Free'
                    }
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 180,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: IOS_COLORS.systemBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  courseInfo: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  courseTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginRight: 12,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  courseDescription: {
    fontSize: 16,
    color: '#1E293B',
    lineHeight: 24,
    marginBottom: 12,
  },
  courseLongDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  courseMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#64748B',
  },
  objectivesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  objectiveText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  instructorSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  instructorBio: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  modulesSection: {
    padding: 16,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }),
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
  },
  moduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  moduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleHeaderText: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  moduleDescription: {
    fontSize: 12,
    color: '#64748B',
  },
  moduleLessonCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  lessonsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  lessonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  lessonItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  lessonItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  lessonNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberFree: {
    backgroundColor: '#DBEAFE',
  },
  lessonNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  lessonItemText: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  lessonDescription: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lessonMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  lessonMetaSeparator: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  lessonFreeBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  lessonCompletedBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  lessonNumberCompleted: {
    backgroundColor: '#10B981',
  },
  lessonNumberTextCompleted: {
    color: '#FFFFFF',
  },
  lessonTitleCompleted: {
    color: '#64748B',
  },
  emptyModules: {
    padding: 32,
    alignItems: 'center',
  },
  emptyModulesText: {
    fontSize: 14,
    color: '#64748B',
  },
  bottomSpacing: {
    height: 20,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 70 : 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    zIndex: 100,
    borderRadius: 12,
    marginHorizontal: 8,
    ...(Platform.OS !== 'web' && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    }),
    ...(Platform.OS === 'web' && {
      boxShadow: '0px -2px 10px rgba(0, 0, 0, 0.1)',
    }),
  },
  ctaButtonContainer: {
    flex: 1,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  proBadgeText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    paddingVertical: 14,
    borderRadius: 10,
  },
  enrollButtonPro: {
    backgroundColor: '#8B5CF6',
  },
  enrollButtonDisabled: {
    opacity: 0.7,
  },
  enrollButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  enrolledContainer: {
    flex: 1,
  },
  enrolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    paddingVertical: 14,
    borderRadius: 10,
  },
  enrolledText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
  },
  progressBadge: {
    fontSize: 12,
    color: '#047857',
    marginLeft: 4,
  },
  progressBarSmall: {
    height: 4,
    backgroundColor: '#A7F3D0',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  courseCoachPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  courseCoachPromptText: {
    fontSize: 13,
    color: IOS_COLORS.systemBlue,
  },
});
