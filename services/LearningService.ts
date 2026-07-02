/**
 * Learning Service
 *
 * Handles all learning platform operations:
 * - Course catalog
 * - Enrollments
 * - Progress tracking
 * - Access control
 * 
 * Performance optimizations:
 * - In-memory cache for instant access
 * - AsyncStorage persistence across sessions
 * - Stale-while-revalidate pattern
 * - Combined queries to reduce round trips
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import type { Course as CatalogCourse } from './CourseCatalogService';

const logger = createLogger('LearningService');

// ============================================
// CACHE CONFIGURATION
// ============================================
const CACHE_KEY = 'learning_courses_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes - courses don't change often
const STALE_TTL = 60 * 60 * 1000; // 1 hour - show stale data while refreshing

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache for instant access (survives component re-renders)
let memoryCache: CacheEntry<LearningCourse[]> | null = null;
// Cache for individual course details (keyed by courseId)
const courseDetailCache = new Map<string, CacheEntry<LearningCourse>>();
const COURSE_DETAIL_CACHE_KEY_PREFIX = 'learning_course_detail_';

// ============================================
// TYPES
// ============================================

export interface LearningCourse {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  long_description: string | null;
  thumbnail_url: string | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes: number;
  price_cents: number | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  is_published: boolean;
  is_featured: boolean;
  order_index: number;
  requires_subscription: boolean;
  min_subscription_tier: string;
  instructor_name: string | null;
  instructor_bio: string | null;
  learning_objectives: string[];
  created_at: string;
  updated_at: string;
  // Joined data
  learning_modules?: LearningModule[];
}

export interface LearningModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
  // Joined data
  learning_lessons?: LearningLesson[];
}

export interface LearningLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  lesson_type: 'video' | 'interactive' | 'text' | 'quiz';
  video_url: string | null;
  video_thumbnail_url: string | null;
  duration_seconds: number;
  interactive_component: string | null;
  interactive_config: Record<string, unknown>;
  content_markdown: string | null;
  order_index: number;
  is_free_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  stripe_payment_id: string | null;
  stripe_checkout_session_id: string | null;
  amount_paid_cents: number | null;
  access_type: 'purchase' | 'subscription' | 'gift' | 'promo';
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  progress_percent: number;
  last_accessed_at: string | null;
  certificate_issued_at: string | null;
  certificate_url: string | null;
}

export interface LearningLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  started_at: string | null;
  completed_at: string | null;
  is_completed: boolean;
  watch_time_seconds: number;
  last_position_seconds: number;
  interactions_count: number;
  interaction_data: Record<string, unknown>;
  quiz_score: number | null;
  quiz_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface CourseWithProgress extends LearningCourse {
  enrollment?: LearningEnrollment | null;
  progress_percent?: number;
  is_enrolled?: boolean;
  can_access?: boolean;
}

export interface LessonWithProgress extends LearningLesson {
  progress?: LearningLessonProgress | null;
}

export interface CourseFilters {
  level?: 'beginner' | 'intermediate' | 'advanced';
  isFeatured?: boolean;
  searchQuery?: string;
}

// ============================================
// SERVICE CLASS
// ============================================

export class LearningService {
  // ==========================================
  // COURSES
  // ==========================================

  // ==========================================
  // CACHE HELPERS
  // ==========================================

  /**
   * Get cached courses from memory or storage
   */
  private static async getCachedCourses(): Promise<{ data: LearningCourse[] | null; isStale: boolean }> {
    const now = Date.now();

    // Check memory cache first (instant)
    if (memoryCache && (now - memoryCache.timestamp) < CACHE_TTL) {
      logger.debug('getCourses: Using fresh memory cache');
      return { data: memoryCache.data, isStale: false };
    }

    // Check if memory cache is stale but usable
    if (memoryCache && (now - memoryCache.timestamp) < STALE_TTL) {
      logger.debug('getCourses: Using stale memory cache');
      return { data: memoryCache.data, isStale: true };
    }

    // Try AsyncStorage (persists across sessions)
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const entry: CacheEntry<LearningCourse[]> = JSON.parse(cached);
        const age = now - entry.timestamp;

        if (age < CACHE_TTL) {
          memoryCache = entry; // Populate memory cache
          logger.debug('getCourses: Using fresh storage cache');
          return { data: entry.data, isStale: false };
        }

        if (age < STALE_TTL) {
          memoryCache = entry;
          logger.debug('getCourses: Using stale storage cache');
          return { data: entry.data, isStale: true };
        }
      }
    } catch (err) {
      logger.warn('getCourses: Failed to read storage cache:', err);
    }

    return { data: null, isStale: false };
  }

  /**
   * Save courses to cache
   */
  private static async setCachedCourses(courses: LearningCourse[]): Promise<void> {
    const entry: CacheEntry<LearningCourse[]> = {
      data: courses,
      timestamp: Date.now(),
    };

    // Always update memory cache
    memoryCache = entry;

    // Persist to AsyncStorage (async, don't block)
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry)).catch(err => {
      logger.warn('getCourses: Failed to write storage cache:', err);
    });
  }

  /**
   * Clear courses cache (call after mutations)
   */
  static async clearCoursesCache(): Promise<void> {
    memoryCache = null;
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (err) {
      logger.warn('clearCoursesCache: Failed to clear storage:', err);
    }
  }

  // ==========================================
  // COURSES
  // ==========================================

  /**
   * Get all published courses with caching
   * Uses stale-while-revalidate pattern for instant perceived performance
   */
  static async getCourses(filters?: CourseFilters): Promise<LearningCourse[]> {
    const hasFilters = filters?.level || filters?.isFeatured || filters?.searchQuery;

    // Only use cache for unfiltered requests
    if (!hasFilters) {
      const { data: cached, isStale } = await this.getCachedCourses();

      if (cached && !isStale) {
        logger.debug('getCourses: Returning fresh cached data');
        return cached;
      }

      if (cached && isStale) {
        logger.debug('getCourses: Returning stale data, refreshing in background');
        // Return stale data immediately, refresh in background
        this.fetchAndCacheCourses().catch(err => {
          logger.warn('Background refresh failed:', err);
        });
        return cached;
      }
    }

    // No cache or filtered request - fetch fresh
    return this.fetchAndCacheCourses(filters);
  }

  /**
   * Fetch courses from Supabase and update cache
   * Uses single combined query for better performance
   */
  private static async fetchAndCacheCourses(filters?: CourseFilters): Promise<LearningCourse[]> {
    try {
      logger.debug('fetchAndCacheCourses: Starting optimized query...');
      const startTime = Date.now();

      // Single combined query with modules (more efficient than 2 queries)
      let query = supabase
        .from('learning_courses')
        .select(`
          *,
          learning_modules (
            id,
            course_id,
            title,
            order_index
          )
        `)
        .eq('is_published', true)
        .order('order_index', { ascending: true });

      if (filters?.level) {
        query = query.eq('level', filters.level);
      }

      if (filters?.isFeatured) {
        query = query.eq('is_featured', true);
      }

      if (filters?.searchQuery) {
        query = query.or(`title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`);
      }

      // Shorter timeout since we have cache fallback
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 15000)
      );

      const { data, error } = await Promise.race([query, timeoutPromise]) as any;

      const duration = Date.now() - startTime;
      logger.debug(`fetchAndCacheCourses: Completed in ${duration}ms, ${data?.length || 0} courses`);

      if (error) {
        throw error;
      }

      const courses = (data || []).map((course: any) => ({
        ...course,
        learning_modules: course.learning_modules?.sort(
          (a: any, b: any) => a.order_index - b.order_index
        ) || [],
      }));

      // Cache unfiltered results
      if (!filters?.level && !filters?.isFeatured && !filters?.searchQuery) {
        await this.setCachedCourses(courses);
      }

      return courses;
    } catch (error) {
      logger.error('fetchAndCacheCourses error:', error);

      // On error, try to return stale cache as fallback
      if (memoryCache) {
        logger.warn('Returning stale cache due to fetch error');
        return memoryCache.data;
      }

      throw error;
    }
  }

  // ==========================================
  // COURSE DETAIL CACHE HELPERS
  // ==========================================

  /**
   * Get cached course detail from memory or storage
   */
  private static async getCachedCourseDetail(courseId: string): Promise<{ data: LearningCourse | null; isStale: boolean }> {
    const now = Date.now();

    // Check memory cache first (instant)
    const memEntry = courseDetailCache.get(courseId);
    if (memEntry && (now - memEntry.timestamp) < CACHE_TTL) {
      logger.debug('getCourse: Using fresh memory cache');
      return { data: memEntry.data, isStale: false };
    }

    if (memEntry && (now - memEntry.timestamp) < STALE_TTL) {
      logger.debug('getCourse: Using stale memory cache');
      return { data: memEntry.data, isStale: true };
    }

    // Try AsyncStorage
    try {
      const cached = await AsyncStorage.getItem(COURSE_DETAIL_CACHE_KEY_PREFIX + courseId);
      if (cached) {
        const entry: CacheEntry<LearningCourse> = JSON.parse(cached);
        const age = now - entry.timestamp;

        if (age < CACHE_TTL) {
          courseDetailCache.set(courseId, entry);
          logger.debug('getCourse: Using fresh storage cache');
          return { data: entry.data, isStale: false };
        }

        if (age < STALE_TTL) {
          courseDetailCache.set(courseId, entry);
          logger.debug('getCourse: Using stale storage cache');
          return { data: entry.data, isStale: true };
        }
      }
    } catch (err) {
      logger.warn('getCourse: Failed to read storage cache:', err);
    }

    return { data: null, isStale: false };
  }

  /**
   * Save course detail to cache
   */
  private static async setCachedCourseDetail(courseId: string, course: LearningCourse): Promise<void> {
    const entry: CacheEntry<LearningCourse> = {
      data: course,
      timestamp: Date.now(),
    };

    courseDetailCache.set(courseId, entry);

    // Persist to AsyncStorage (async, don't block)
    AsyncStorage.setItem(
      COURSE_DETAIL_CACHE_KEY_PREFIX + courseId,
      JSON.stringify(entry)
    ).catch(err => {
      logger.warn('getCourse: Failed to write storage cache:', err);
    });
  }

  /**
   * Get a single course by ID with modules and lessons
   * Uses caching with stale-while-revalidate for fast loading
   */
  static async getCourse(courseId: string): Promise<LearningCourse | null> {
    // Check cache first
    const { data: cached, isStale } = await this.getCachedCourseDetail(courseId);

    if (cached && !isStale) {
      logger.debug('getCourse: Returning fresh cached course');
      return cached;
    }

    if (cached && isStale) {
      logger.debug('getCourse: Returning stale cache, refreshing in background');
      // Return stale data immediately, refresh in background
      this.fetchAndCacheCourseDetail(courseId).catch(err => {
        logger.warn('getCourse: Background refresh failed:', err);
      });
      return cached;
    }

    // No cache - fetch fresh
    return this.fetchAndCacheCourseDetail(courseId);
  }

  /**
   * Fetch course detail from Supabase with optimized single query
   */
  private static async fetchAndCacheCourseDetail(courseId: string): Promise<LearningCourse | null> {
    try {
      logger.debug('fetchAndCacheCourseDetail: Starting optimized fetch for:', courseId);
      const startTime = Date.now();

      // Single combined query for course + modules + lessons
      const query = supabase
        .from('learning_courses')
        .select(`
          *,
          learning_modules (
            *,
            learning_lessons (*)
          )
        `)
        .eq('id', courseId)
        .eq('is_published', true)
        .single();

      // Shorter timeout since we have cache fallback
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Course query timed out')), 10000)
      );

      const { data, error } = await Promise.race([query, timeoutPromise]) as any;

      const duration = Date.now() - startTime;
      logger.debug(`fetchAndCacheCourseDetail: Completed in ${duration}ms`);

      if (error) {
        if (error.code === 'PGRST116') {
          logger.debug('fetchAndCacheCourseDetail: Course not found');
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      // Sort modules and lessons by order_index
      const course: LearningCourse = {
        ...data,
        learning_modules: (data.learning_modules || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((module: any) => ({
            ...module,
            learning_lessons: (module.learning_lessons || [])
              .sort((a: any, b: any) => a.order_index - b.order_index),
          })),
      };

      // Cache the result
      await this.setCachedCourseDetail(courseId, course);

      return course;
    } catch (error) {
      logger.error('fetchAndCacheCourseDetail error:', error);

      // On error, try to return stale cache as fallback
      const cachedEntry = courseDetailCache.get(courseId);
      if (cachedEntry) {
        logger.warn('Returning stale course cache due to fetch error');
        return cachedEntry.data;
      }

      throw error;
    }
  }

  /**
   * Get a course by slug (published courses only)
   */
  static async getCourseBySlug(slug: string): Promise<LearningCourse | null> {
    try {
      const { data, error } = await supabase
        .from('learning_courses')
        .select(`
          *,
          learning_modules (
            *,
            learning_lessons (
              *
            )
          )
        `)
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        logger.error('Error fetching course by slug:', error);
        throw error;
      }

      // Sort modules and lessons
      if (data?.learning_modules) {
        data.learning_modules.sort((a: LearningModule, b: LearningModule) => a.order_index - b.order_index);
        data.learning_modules.forEach((m: LearningModule) => {
          if (m.learning_lessons) {
            m.learning_lessons.sort((a: LearningLesson, b: LearningLesson) => a.order_index - b.order_index);
          }
        });
      }

      return data;
    } catch (error) {
      logger.error('getCourseBySlug error:', error);
      throw error;
    }
  }

  /**
   * Get a course by slug for enrollment purposes (checks both published and unpublished)
   * This is useful when checking enrollments - we need to find the course even if it's not published
   */
  static async getCourseBySlugForEnrollment(slug: string): Promise<LearningCourse | null> {
    try {
      // First try published courses (normal flow)
      const published = await this.getCourseBySlug(slug);
      if (published) {
        return published;
      }

      // If not found, try without published filter (for enrollment checks)
      const { data, error } = await supabase
        .from('learning_courses')
        .select('id, slug, title, is_published')
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') return null;
        logger.error('Error fetching course by slug for enrollment:', error);
        return null;
      }

      if (data) {
        logger.warn(`Course "${slug}" found but is_published=${data.is_published}`);
        // Return minimal course data for enrollment purposes
        return {
          id: data.id,
          slug: data.slug,
          title: data.title,
          is_published: data.is_published,
        } as LearningCourse;
      }

      return null;
    } catch (error) {
      logger.error('getCourseBySlugForEnrollment error:', error);
      return null;
    }
  }

  /**
   * Get courses with user's enrollment and progress info
   */
  static async getCoursesWithProgress(userId: string): Promise<CourseWithProgress[]> {
    try {
      // Get all published courses
      const courses = await this.getCourses();

      // Get user's enrollments
      const { data: enrollments } = await supabase
        .from('learning_enrollments')
        .select('*')
        .eq('user_id', userId);

      // Get user's subscription tier
      const { data: user } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

      const userTier = user?.subscription_tier || 'free';
      const hasProAccess = ['sailor_pro', 'championship', 'professional'].includes(userTier);

      // Combine data
      return courses.map(course => {
        const enrollment = enrollments?.find(e => e.course_id === course.id) || null;
        const isEnrolled = !!enrollment;
        const canAccess = hasProAccess || isEnrolled || course.min_subscription_tier === 'free';

        return {
          ...course,
          enrollment,
          progress_percent: enrollment?.progress_percent || 0,
          is_enrolled: isEnrolled,
          can_access: canAccess,
        };
      });
    } catch (error) {
      logger.error('getCoursesWithProgress error:', error);
      throw error;
    }
  }

  // ==========================================
  // ENROLLMENTS
  // ==========================================

  /**
   * Ensure a catalog-only course exists in the database.
   * Creates the course, modules, and lessons from the JSON catalog if not already present.
   * Returns the course UUID on success, or null on failure.
   */
  static async ensureCourseInDatabase(catalogCourse: CatalogCourse): Promise<string | null> {
    try {
      // Check if it already exists by slug
      const { data: existing } = await supabase
        .from('learning_courses')
        .select('id')
        .eq('slug', catalogCourse.slug)
        .maybeSingle();

      if (existing?.id) {
        logger.info(`Course "${catalogCourse.slug}" already exists in DB: ${existing.id}`);
        return existing.id;
      }

      // Map catalog level to DB level
      const level = (catalogCourse.level || 'beginner').toLowerCase() as 'beginner' | 'intermediate' | 'advanced';

      // Insert the course
      const { data: courseRow, error: courseError } = await supabase
        .from('learning_courses')
        .insert({
          slug: catalogCourse.slug,
          title: catalogCourse.title,
          description: catalogCourse.description || null,
          long_description: catalogCourse.longDescription || null,
          level,
          duration_minutes: catalogCourse.duration?.totalMinutes || 0,
          price_cents: catalogCourse.price?.cents ?? 0,
          is_published: true,
          is_featured: false,
          order_index: parseInt(catalogCourse.id.replace('course-', ''), 10) || 99,
          requires_subscription: (catalogCourse.price?.tier || 'free') !== 'free',
          min_subscription_tier: catalogCourse.price?.tier || 'free',
          instructor_name: catalogCourse.instructor?.name || null,
          instructor_bio: catalogCourse.instructor?.bio || null,
          learning_objectives: catalogCourse.whatYouLearn || [],
        })
        .select('id')
        .single();

      if (courseError || !courseRow?.id) {
        logger.error('Failed to insert course:', courseError);
        return null;
      }

      const courseId = courseRow.id;
      logger.info(`Created course "${catalogCourse.slug}" with id ${courseId}`);

      // Insert modules and lessons
      if (catalogCourse.modules && catalogCourse.modules.length > 0) {
        for (const mod of catalogCourse.modules) {
          const { data: moduleRow, error: modError } = await supabase
            .from('learning_modules')
            .insert({
              course_id: courseId,
              title: mod.title,
              order_index: mod.orderIndex,
              duration_minutes: mod.durationMinutes || 0,
            })
            .select('id')
            .single();

          if (modError || !moduleRow?.id) {
            logger.error(`Failed to insert module "${mod.title}":`, modError);
            continue;
          }

          // Insert lessons for this module
          if (mod.lessons && mod.lessons.length > 0) {
            const lessonRows = mod.lessons.map(lesson => ({
              module_id: moduleRow.id,
              title: lesson.title,
              description: lesson.description || null,
              lesson_type: lesson.lessonType || 'text',
              interactive_component: lesson.interactiveComponent || null,
              order_index: lesson.orderIndex,
              duration_seconds: lesson.durationSeconds || 0,
              is_free_preview: lesson.isFreePreview || false,
            }));

            const { error: lessonsError } = await supabase
              .from('learning_lessons')
              .insert(lessonRows);

            if (lessonsError) {
              logger.error(`Failed to insert lessons for module "${mod.title}":`, lessonsError);
            }
          }
        }
      }

      return courseId;
    } catch (error) {
      logger.error('ensureCourseInDatabase error:', error);
      return null;
    }
  }

  /**
   * Enroll a user in a course
   */
  static async enrollInCourse(
    userId: string,
    courseId: string,
    options?: {
      stripePaymentId?: string;
      stripeCheckoutSessionId?: string;
      amountPaidCents?: number;
      accessType?: 'purchase' | 'subscription' | 'gift' | 'promo';
    }
  ): Promise<LearningEnrollment> {
    try {
      const { data, error } = await supabase
        .from('learning_enrollments')
        .insert({
          user_id: userId,
          course_id: courseId,
          stripe_payment_id: options?.stripePaymentId,
          stripe_checkout_session_id: options?.stripeCheckoutSessionId,
          amount_paid_cents: options?.amountPaidCents,
          access_type: options?.accessType || 'purchase',
          enrolled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error enrolling in course:', error);
        throw error;
      }

      logger.info(`User ${userId} enrolled in course ${courseId}`);
      return data;
    } catch (error) {
      logger.error('enrollInCourse error:', error);
      throw error;
    }
  }

  /**
   * Get a user's enrollments
   */
  static async getEnrollments(userId: string): Promise<LearningEnrollment[]> {
    try {
      const { data, error } = await supabase
        .from('learning_enrollments')
        .select('*')
        .eq('user_id', userId)
        .order('enrolled_at', { ascending: false });

      if (error) {
        logger.error('Error fetching enrollments:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('getEnrollments error:', error);
      throw error;
    }
  }

  /**
   * Check if a user is enrolled in a course
   */
  static async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    try {
      // Validate that courseId is a valid UUID before querying
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId);
      if (!isUUID) {
        logger.warn('isEnrolled called with non-UUID courseId:', courseId, '- skipping database query');
        return false;
      }

      const { data, error } = await supabase
        .from('learning_enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();

      if (error) {
        logger.error('Error checking enrollment:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('isEnrolled error:', error);
      return false;
    }
  }

  /**
   * Check if a user is enrolled in a course by slug
   * Useful when course might not be found in database lookup but enrollment exists
   * This method joins enrollments with courses table to find enrollments by slug
   */
  static async isEnrolledBySlug(userId: string, courseSlug: string): Promise<boolean> {
    try {
      // First, try to get the course by slug to get its UUID
      const course = await this.getCourseBySlug(courseSlug);
      if (course?.id) {
        // Course found, use standard enrollment check
        return this.isEnrolled(userId, course.id);
      }

      // Course not found by direct lookup, but enrollment might still exist
      // Try to find enrollment by joining with courses table on slug
      const { data, error } = await supabase
        .from('learning_enrollments')
        .select('id, learning_courses!inner(slug)')
        .eq('user_id', userId)
        .eq('learning_courses.slug', courseSlug)
        .maybeSingle();

      if (error) {
        // If join fails, try alternative: get all user enrollments and check course slugs
        logger.warn('Join query failed, trying alternative method:', error);
        const enrollments = await this.getEnrollments(userId);
        for (const enrollment of enrollments) {
          try {
            const enrolledCourse = await this.getCourse(enrollment.course_id);
            if (enrolledCourse?.slug === courseSlug) {
              return true;
            }
          } catch (err) {
            // Skip if course lookup fails
            continue;
          }
        }
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('isEnrolledBySlug error:', error);
      return false;
    }
  }

  /**
   * Pro subscription tiers that get all courses included. Must include 'pro' —
   * that's the value the Stripe and RevenueCat webhooks actually write; the old
   * list ('sailor_pro'/'championship'/'professional') matched no live tier, so
   * every real Pro subscriber was denied "included with Pro" courses.
   */
  static readonly PRO_TIERS = ['pro', 'sailor_pro', 'championship', 'professional'];

  /**
   * Check user's subscription tier and if they have Pro access
   */
  static async checkSubscriptionAccess(userId: string): Promise<{
    tier: string;
    hasProAccess: boolean;
    subscriptionStatus: string;
  }> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('subscription_tier, subscription_status')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return { tier: 'free', hasProAccess: false, subscriptionStatus: 'inactive' };
      }

      const tier = user.subscription_tier || 'free';
      const status = user.subscription_status || 'inactive';
      const hasProAccess = this.PRO_TIERS.includes(tier) && status === 'active';

      return {
        tier,
        hasProAccess,
        subscriptionStatus: status,
      };
    } catch (error) {
      logger.error('checkSubscriptionAccess error:', error);
      return { tier: 'free', hasProAccess: false, subscriptionStatus: 'inactive' };
    }
  }

  /**
   * Check if a user can access a course (enrolled OR has subscription)
   */
  static async canAccessCourse(userId: string, courseId: string): Promise<boolean> {
    try {
      // Check subscription access
      const { hasProAccess } = await this.checkSubscriptionAccess(userId);

      // Pro+ subscribers can access all courses
      if (hasProAccess) {
        return true;
      }

      // Check individual enrollment
      return this.isEnrolled(userId, courseId);
    } catch (error) {
      logger.error('canAccessCourse error:', error);
      return false;
    }
  }

  /**
   * Enroll a Pro subscriber in a course for free
   */
  static async enrollProSubscriber(userId: string, courseId: string): Promise<boolean> {
    try {
      const { hasProAccess } = await this.checkSubscriptionAccess(userId);
      
      if (!hasProAccess) {
        logger.error('User does not have Pro subscription');
        return false;
      }

      // Check if already enrolled
      const isAlreadyEnrolled = await this.isEnrolled(userId, courseId);
      if (isAlreadyEnrolled) {
        return true;
      }

      // Create enrollment with subscription access type
      const { error } = await supabase
        .from('learning_enrollments')
        .insert({
          user_id: userId,
          course_id: courseId,
          access_type: 'subscription',
          enrolled_at: new Date().toISOString(),
        });

      if (error) {
        logger.error('Failed to enroll Pro subscriber:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('enrollProSubscriber error:', error);
      return false;
    }
  }

  /**
   * Update enrollment with start/access time
   */
  static async markCourseStarted(userId: string, courseId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('learning_enrollments')
        .update({
          started_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .is('started_at', null);

      if (error) {
        logger.error('Error marking course started:', error);
      }
    } catch (error) {
      logger.error('markCourseStarted error:', error);
    }
  }

  /**
   * Update last accessed time
   */
  static async updateLastAccessed(userId: string, courseId: string): Promise<void> {
    try {
      await supabase
        .from('learning_enrollments')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('course_id', courseId);
    } catch (error) {
      logger.error('updateLastAccessed error:', error);
    }
  }

  // ==========================================
  // LESSON PROGRESS
  // ==========================================

  /**
   * Get or create lesson progress record
   */
  static async getLessonProgress(userId: string, lessonId: string): Promise<LearningLessonProgress | null> {
    try {
      const { data, error } = await supabase
        .from('learning_lesson_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching lesson progress:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('getLessonProgress error:', error);
      return null;
    }
  }

  /**
   * Update lesson progress
   */
  static async updateLessonProgress(
    userId: string,
    lessonId: string,
    progress: Partial<{
      watch_time_seconds: number;
      last_position_seconds: number;
      interactions_count: number;
      interaction_data: Record<string, unknown>;
      is_completed: boolean;
    }>
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { ...progress };

      if (progress.is_completed) {
        updates.completed_at = now;
      }

      // Upsert progress record
      const { error } = await supabase
        .from('learning_lesson_progress')
        .upsert(
          {
            user_id: userId,
            lesson_id: lessonId,
            started_at: now,
            ...updates,
          },
          {
            onConflict: 'user_id,lesson_id',
          }
        );

      if (error) {
        logger.error('Error updating lesson progress:', error);
        throw error;
      }

      // If lesson completed, update course progress
      if (progress.is_completed) {
        await this.recalculateCourseProgress(userId, lessonId);
      }
    } catch (error) {
      logger.error('updateLessonProgress error:', error);
      throw error;
    }
  }

  /**
   * Mark a lesson as complete
   */
  static async markLessonComplete(userId: string, lessonId: string): Promise<void> {
    await this.updateLessonProgress(userId, lessonId, { is_completed: true });
  }

  /**
   * Recalculate and update course progress after lesson completion
   */
  private static async recalculateCourseProgress(userId: string, lessonId: string): Promise<void> {
    try {
      // Get the course ID for this lesson
      const { data: lesson } = await supabase
        .from('learning_lessons')
        .select('module_id, learning_modules!inner(course_id)')
        .eq('id', lessonId)
        .single();

      if (!lesson) return;

      const courseId = (lesson as any).learning_modules.course_id;

      // Count total and completed lessons
      const { data: totalData } = await supabase
        .from('learning_lessons')
        .select('id, learning_modules!inner(course_id)')
        .eq('learning_modules.course_id', courseId);

      const totalLessons = totalData?.length || 0;

      const { data: completedData } = await supabase
        .from('learning_lesson_progress')
        .select('lesson_id, learning_lessons!inner(module_id, learning_modules!inner(course_id))')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .eq('learning_lessons.learning_modules.course_id', courseId);

      const completedLessons = completedData?.length || 0;

      // Calculate progress percentage
      const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      // Update enrollment
      const updates: Record<string, unknown> = { progress_percent: progressPercent };

      if (progressPercent === 100) {
        updates.completed_at = new Date().toISOString();
      }

      await supabase
        .from('learning_enrollments')
        .update(updates)
        .eq('user_id', userId)
        .eq('course_id', courseId);

      logger.debug(`Updated course ${courseId} progress for user ${userId}: ${progressPercent}%`);
    } catch (error) {
      logger.error('recalculateCourseProgress error:', error);
    }
  }

  /**
   * Get all lesson progress for a course
   */
  static async getCourseProgress(
    userId: string,
    courseId: string
  ): Promise<{
    enrollment: LearningEnrollment | null;
    lessonProgress: LearningLessonProgress[];
    completedCount: number;
    totalCount: number;
    progressPercent: number;
  }> {
    try {
      // Get enrollment
      const { data: enrollment } = await supabase
        .from('learning_enrollments')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();

      // Get all lessons for the course
      const { data: lessons } = await supabase
        .from('learning_lessons')
        .select('id, learning_modules!inner(course_id)')
        .eq('learning_modules.course_id', courseId);

      const lessonIds = lessons?.map(l => l.id) || [];
      const totalCount = lessonIds.length;

      // Get progress for all lessons
      const { data: progress } = await supabase
        .from('learning_lesson_progress')
        .select('*')
        .eq('user_id', userId)
        .in('lesson_id', lessonIds);

      const lessonProgress = progress || [];
      const completedCount = lessonProgress.filter(p => p.is_completed).length;
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        enrollment,
        lessonProgress,
        completedCount,
        totalCount,
        progressPercent,
      };
    } catch (error) {
      logger.error('getCourseProgress error:', error);
      return {
        enrollment: null,
        lessonProgress: [],
        completedCount: 0,
        totalCount: 0,
        progressPercent: 0,
      };
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  /**
   * Get the next lesson to continue from
   */
  static async getNextLesson(
    userId: string,
    courseId: string
  ): Promise<LearningLesson | null> {
    try {
      // Get course with all lessons
      const course = await this.getCourse(courseId);
      if (!course?.learning_modules) return null;

      // Flatten lessons
      const allLessons: LearningLesson[] = [];
      for (const module of course.learning_modules) {
        if (module.learning_lessons) {
          allLessons.push(...module.learning_lessons);
        }
      }

      if (allLessons.length === 0) return null;

      // Get user's progress
      const { lessonProgress } = await this.getCourseProgress(userId, courseId);
      const completedIds = new Set(lessonProgress.filter(p => p.is_completed).map(p => p.lesson_id));

      // Find first incomplete lesson
      for (const lesson of allLessons) {
        if (!completedIds.has(lesson.id)) {
          return lesson;
        }
      }

      // All complete, return first lesson
      return allLessons[0];
    } catch (error) {
      logger.error('getNextLesson error:', error);
      return null;
    }
  }

  /**
   * Get featured courses for homepage
   */
  static async getFeaturedCourses(): Promise<LearningCourse[]> {
    return this.getCourses({ isFeatured: true });
  }
}

export default LearningService;
