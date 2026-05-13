import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
  View,
} from 'react-native';
import { EmbeddedInteractiveDemo } from './EmbeddedInteractiveDemo';
import courseCatalogData from '../../docs/academy/course-catalog.json';

// Type definition for course catalog (matches JSON structure)
type CourseCatalog = typeof courseCatalogData;
type Course = CourseCatalog['levels'][number]['courses'][number];

// Use imported course catalog data
const COURSE_CATALOG = courseCatalogData as CourseCatalog;

export function RacingAcademySection() {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = React.useState(false);
  const [selectedLevel, setSelectedLevel] = useState('level-2'); // Start with intermediate (flagship course)
  const [showAllCourses, setShowAllCourses] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDesktop = mounted && width > 768;

  const currentLevel = useMemo(
    () => COURSE_CATALOG.levels.find((l) => l.id === selectedLevel),
    [selectedLevel]
  );

  const coursesToShow = useMemo(() => {
    if (!currentLevel) return [];
    return showAllCourses ? currentLevel.courses : currentLevel.courses.slice(0, 3);
  }, [currentLevel, showAllCourses]);

  const freeCourse = useMemo<Course | undefined>(
    () => COURSE_CATALOG.levels
      .flatMap((level): Course[] => level.courses)
      .find((course) => course.price.cents === 0 && course.status === 'available'),
    []
  );

  const _comingSoonCourses = useMemo<Course[]>(
    () => COURSE_CATALOG.levels
      .flatMap((level): Course[] => level.courses)
      .filter((course) => course.status === 'coming-soon')
      .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime())
      .slice(0, 6),
    []
  );

  // Enhanced navigation handlers with analytics tracking
  const handleCoursePress = (course: Course) => {
    // Track analytics (if analytics service is available)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'course_clicked', {
        course_id: course.id,
        course_name: course.title,
        course_level: course.level,
        course_status: course.status,
        course_price: course.price.cents,
      });
    }

    if (course.status === 'coming-soon') {
      void Linking.openURL(
        `mailto:learn@regattaflow.com?subject=Course%20Waitlist%3A%20${encodeURIComponent(course.title)}&body=Please%20notify%20me%20when%20this%20course%20is%20available.`
      );
    } else {
      // Navigate to course detail page using slug (more reliable than JSON catalog ID)
      router.push({
        pathname: '/(tabs)/learn/[courseId]',
        params: { courseId: course.slug },
      });
    }
  };

  const handleStartFree = () => {
    if (freeCourse) {
      // Track analytics
      if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'start_free_course', {
          course_id: freeCourse.id,
          course_title: freeCourse.title,
        });
      }
      // Navigate to free course detail page using slug
      router.push({
        pathname: '/(tabs)/learn/[courseId]',
        params: { courseId: freeCourse.slug },
      });
    }
  };

  const handleViewAll = () => {
    // Track analytics
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'view_all_courses_clicked');
    }
    // Navigate to learn page
    router.push('/(tabs)/learn');
  };

  const handleEnroll = (course: Course) => {
    if (course.status === 'coming-soon') {
      void Linking.openURL(
        `mailto:learn@regattaflow.com?subject=Course%20Waitlist%3A%20${encodeURIComponent(course.title)}&body=Please%20notify%20me%20when%20this%20course%20is%20available.`
      );
    } else if (course.price.cents === 0) {
      // Free course - navigate directly using slug
      router.push({
        pathname: '/(tabs)/learn/[courseId]',
        params: { courseId: course.slug },
      });
    } else {
      // Paid course - navigate to course detail page (handles enrollment/checkout) using slug
      router.push({
        pathname: '/(tabs)/learn/[courseId]',
        params: { courseId: course.slug },
      });
    }
  };

  const _handleContactSales = (packageId: string) => {
    // Track analytics
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'contact_sales_clicked', {
        package_id: packageId,
      });
    }

    void Linking.openURL(
      `mailto:sales@regattaflow.com?subject=${encodeURIComponent(`Institutional Package Inquiry: ${packageId}`)}`
    );
  };

  const _handleScheduleCall = () => {
    // Track analytics
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'schedule_call_clicked');
    }

    void Linking.openURL('https://calendly.com/regattaflow-sales');
  };

  const _handleNotifyMe = () => {
    // Track analytics
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'notify_me_clicked');
    }

    void Linking.openURL(
      'mailto:learn@regattaflow.com?subject=Academy%20Notifications&body=Please%20notify%20me%20when%20new%20courses%20are%20available.'
    );
  };

  return (
    <View style={styles.container} id="learn-section" {...(Platform.OS === 'web' ? { 'data-section': 'learn-section' } : {})}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#F8FAFC', '#EFF6FF', '#F0F9FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          {/* Hero Header */}
          <View style={styles.heroHeader}>
            <View style={styles.iconBadge}>
              <Ionicons name="school-outline" size={40} color="#8B5CF6" />
            </View>
            <Text style={[styles.mainTitle, isDesktop && styles.mainTitleDesktop]}>
              Learn
            </Text>
            <Text style={[styles.heroSubtitle, isDesktop && styles.heroSubtitleDesktop]}>
              Master sailing tactics through interactive, AI-powered lessons
            </Text>
            <Text style={[styles.heroDescription, isDesktop && styles.heroDescriptionDesktop]}>
              From your first race to championship-level strategy — learn with step-by-step
              interactive animations, real-time feedback, and AI-powered analysis
              </Text>
            </View>

          {/* Free Course CTA - Prominent */}
          {freeCourse && (
            <View style={styles.freeCourseBanner}>
              <LinearGradient
                colors={['#8B5CF6', '#6D28D9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.freeCourseGradient, isDesktop && { flexDirection: 'row' }, !isDesktop && { flexDirection: 'column' }]}
              >
                <View style={styles.freeCourseContent}>
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>FREE</Text>
                  </View>
                  <View style={styles.freeCourseText}>
                    <Text style={styles.freeCourseTitle}>Start Learning Today</Text>
                    <Text style={styles.freeCourseSubtitle}>
                      Begin with "{freeCourse.title}" — a complete introduction to sailboat racing
            </Text>
          </View>
                </View>
                <TouchableOpacity
                  style={styles.startFreeButton}
                  onPress={handleStartFree}
                  activeOpacity={0.8}
                >
                  <Text style={styles.startFreeButtonText}>Start Free Course</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}

          {/* Interactive Demo Preview */}
          <View style={styles.interactiveDemoSection}>
            <View style={styles.demoHeader}>
              <Text style={[styles.demoTitle, isDesktop && styles.demoTitleDesktop]}>
                Experience Interactive Learning
              </Text>
              <Text style={[styles.demoSubtitle, isDesktop && styles.demoSubtitleDesktop]}>
                Try a lesson from "Winning Starts & First Beats" — scrub the timeline, explore each step
              </Text>
            </View>

            <View style={[styles.demoContainer, isDesktop && styles.demoContainerDesktop, !isDesktop && styles.demoContainerMobile]}>
              <View style={styles.demoStandaloneWrapper}>
                <EmbeddedInteractiveDemo
                  component="StartingSequence"
                  screenWidth={isDesktop ? 800 : Math.min(width - 48, 600)}
                  screenHeight={isDesktop ? 600 : undefined}
                  autoReset={true}
                  resetDelay={8000}
                />
              </View>

              <View style={styles.demoFeatures}>
                <Text style={[styles.demoFeaturesTitle, isDesktop && styles.demoFeaturesTitleDesktop]}>
                  What makes it interactive?
                </Text>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="hand-left-outline" size={24} color="#8B5CF6" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Scrub the Timeline</Text>
                    <Text style={styles.featureText}>
                      Jump to any moment, review steps at your own pace
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: '#DBEAFE' }]}>
                    <Ionicons name="eye-outline" size={24} color="#2196F3" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Visual Learning</Text>
                    <Text style={styles.featureText}>
                      Animated boat movements, wind indicators, tactical overlays
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="bulb-outline" size={24} color="#F59E0B" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Pro Tips</Text>
                    <Text style={styles.featureText}>
                      Expert insights at key decision points
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="checkmark-done-outline" size={24} color="#10B981" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>Quiz Yourself</Text>
                    <Text style={styles.featureText}>
                      Test your knowledge with instant feedback
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Learning Path Navigation */}
          <View style={styles.learningPathSection}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
              Choose Your Learning Path
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.levelTabsContainer}
              contentContainerStyle={styles.levelTabsContent}
            >
              {COURSE_CATALOG.levels.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  style={[
                    styles.levelTab,
                    selectedLevel === level.id && styles.levelTabActive,
                  ]}
                  onPress={() => {
                    setSelectedLevel(level.id);
                    setShowAllCourses(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.levelTabText,
                      selectedLevel === level.id && styles.levelTabTextActive,
                    ]}
                  >
                    {level.name}
                  </Text>
                  <Text
                    style={[
                      styles.levelTabSubtext,
                      selectedLevel === level.id && styles.levelTabSubtextActive,
                    ]}
                  >
                    {level.courses.length} {level.courses.length === 1 ? 'course' : 'courses'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Level Description */}
            {currentLevel && (
              <View style={styles.levelInfo}>
                <Text style={styles.levelDescription}>{currentLevel.description}</Text>
                <View style={styles.targetAudienceBadge}>
                  <Ionicons name="people-outline" size={16} color="#6B7280" />
                  <Text style={styles.targetAudienceText}>For: {currentLevel.targetAudience}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Course Cards Grid */}
          <View style={[styles.coursesGrid, isDesktop && styles.coursesGridDesktop]}>
            {coursesToShow.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                isDesktop={isDesktop}
                onPress={() => handleCoursePress(course)}
                onEnroll={() => handleEnroll(course)}
              />
            ))}
          </View>

          {/* Show More Button */}
          {currentLevel && currentLevel.courses.length > 3 && !showAllCourses && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowAllCourses(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.showMoreButtonText}>
                Show {currentLevel.courses.length - 3} More{' '}
                {currentLevel.courses.length - 3 === 1 ? 'Course' : 'Courses'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#8B5CF6" />
            </TouchableOpacity>
          )}

          {/* View All Courses CTA */}
          <View style={styles.viewAllCoursesSection}>
          <TouchableOpacity
              style={styles.viewAllCoursesButton}
            onPress={handleViewAll}
            activeOpacity={0.8}
          >
              <Text style={styles.viewAllCoursesButtonText}>Browse All Courses</Text>
              <Ionicons name="arrow-forward" size={20} color="#8B5CF6" />
            </TouchableOpacity>
          </View>

          {/* Why Choose Academy */}
          <View style={styles.whyChooseSection}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
              Why Learn with RegattaFlow?
            </Text>

            <View style={[styles.benefitsGrid, isDesktop && styles.benefitsGridDesktop]}>
              <View style={styles.benefitCard}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="flash" size={32} color="#8B5CF6" />
                </View>
                <Text style={styles.benefitTitle}>Interactive Learning</Text>
                <Text style={styles.benefitText}>
                  Not just videos — step through animated scenarios, practice decisions, get instant feedback
                </Text>
              </View>

              <View style={styles.benefitCard}>
                <View style={[styles.benefitIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="analytics" size={32} color="#2196F3" />
                </View>
                <Text style={styles.benefitTitle}>Connected Analysis</Text>
                <Text style={styles.benefitText}>
                  Connect lessons to your actual race data. See where tactics apply to your sailing
                </Text>
              </View>

              <View style={styles.benefitCard}>
                <View style={[styles.benefitIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="trophy" size={32} color="#F59E0B" />
                </View>
                <Text style={styles.benefitTitle}>Championship Tactics</Text>
                <Text style={styles.benefitText}>
                  Learn from Olympic coaches and world champions. Professional-level instruction, accessible pricing
                </Text>
              </View>

              <View style={styles.benefitCard}>
                <View style={[styles.benefitIcon, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="repeat" size={32} color="#10B981" />
                </View>
                <Text style={styles.benefitTitle}>Learn at Your Pace</Text>
                <Text style={styles.benefitText}>
                  Scrub timelines, repeat steps, practice scenarios. Master concepts before moving forward
                </Text>
              </View>
            </View>
          </View>

          {/* Final CTA */}
          <View style={styles.finalCTA}>
            <LinearGradient
              colors={['#1E3A8A', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.finalCTAGradient}
            >
              <Text style={[styles.finalCTATitle, isDesktop && styles.finalCTATitleDesktop]}>
                Ready to improve your racing?
              </Text>
              <Text style={[styles.finalCTASubtitle, isDesktop && styles.finalCTASubtitleDesktop]}>
                Start with a free lesson, then progress through interactive tactics modules at your own pace
              </Text>
              <View style={styles.finalCTAButtons}>
                <TouchableOpacity
                  style={styles.finalCTAButtonPrimary}
                  onPress={handleStartFree}
                  activeOpacity={0.8}
                >
                  <Text style={styles.finalCTAButtonPrimaryText}>Start Free Course</Text>
                  <Ionicons name="arrow-forward" size={20} color="#1E3A8A" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.finalCTAButtonSecondary}
            onPress={handleViewAll}
            activeOpacity={0.8}
          >
                  <Text style={styles.finalCTAButtonSecondaryText}>Browse All Courses</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
          </View>
        </View>
      </LinearGradient>
      </ScrollView>
    </View>
  );
}

// Helper function to get level display name
function getLevelDisplayName(levelId: string): string {
  const levelMap: Record<string, string> = {
    'level-1': 'Beginner',
    'level-2': 'Intermediate',
    'level-3': 'Advanced',
    'specializations': 'Specialization',
  };
  return levelMap[levelId] || levelId;
}

// Helper function to get level color
function getLevelColor(levelId: string): string {
  const colorMap: Record<string, string> = {
    'level-1': '#10B981',
    'level-2': '#F59E0B',
    'level-3': '#EF4444',
    'specializations': '#8B5CF6',
  };
  return colorMap[levelId] || '#6B7280';
}

// Course Card Component
interface CourseCardProps {
  course: CourseCatalog['levels'][0]['courses'][0];
  isDesktop: boolean;
  onPress: () => void;
  onEnroll: () => void;
}

function CourseCard({ course, isDesktop, onPress, onEnroll }: CourseCardProps) {
  const levelColor = getLevelColor(course.level);
  const levelName = getLevelDisplayName(course.level);
  const isFlagship = course.slug === 'winning-starts-first-beats';

  return (
    <TouchableOpacity
      style={[styles.courseCard, isDesktop && styles.courseCardDesktop]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Course Thumbnail */}
      <View style={styles.courseThumbnailContainer}>
        <View style={[styles.courseThumbnail, { backgroundColor: '#F3E8FF' }]}>
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons
              name={
                course.level === 'level-1'
                  ? 'flag-outline'
                  : course.level === 'level-2'
                  ? 'navigate-outline'
                  : course.level === 'level-3'
                  ? 'trophy-outline'
                  : 'boat-outline'
              }
              size={48}
              color="#8B5CF6"
            />
      </View>

          {/* Status Badges */}
          {course.status === 'coming-soon' && (
            <View style={styles.comingSoonBadge}>
              <Ionicons name="time-outline" size={14} color="#FFFFFF" />
              <Text style={styles.comingSoonText}>Planned</Text>
            </View>
          )}

          {isFlagship && (
            <View style={styles.flagshipBadge}>
              <Ionicons name="rocket" size={14} color="#FFFFFF" />
              <Text style={styles.flagshipText}>Flagship</Text>
            </View>
          )}
        </View>

        {/* Quick Stats Bar */}
        <View style={styles.quickStatsBar}>
          <View style={styles.quickStat}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.quickStatText}>{course.duration.totalMinutes} min</Text>
          </View>
          <View style={styles.quickStat}>
            <Ionicons name="book-outline" size={14} color="#6B7280" />
            <Text style={styles.quickStatText}>
              {course.modules?.length || 0} {course.modules?.length === 1 ? 'module' : 'modules'}
            </Text>
          </View>
          {course.skillsUsed && course.skillsUsed.length > 0 && (
            <View style={styles.quickStat}>
              <Ionicons name="flash-outline" size={14} color="#8B5CF6" />
              <Text style={[styles.quickStatText, { color: '#8B5CF6' }]}>
                {course.skillsUsed.length} {course.skillsUsed.length === 1 ? 'tool' : 'tools'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Course Content */}
      <View style={styles.courseContent}>
        {/* Level Badge */}
        <View style={styles.courseLevelBadge}>
          <View style={[styles.levelDot, { backgroundColor: levelColor }]} />
          <Text style={styles.levelBadgeText}>{levelName}</Text>
        </View>

        <Text style={[styles.courseTitle, isDesktop && styles.courseTitleDesktop]}>
          {course.title}
        </Text>
        <Text style={[styles.courseDescription, isDesktop && styles.courseDescriptionDesktop]}>
          {course.description}
        </Text>

        {/* What You'll Learn */}
        {course.whatYouLearn && course.whatYouLearn.length > 0 && (
          <View style={styles.whatYouLearnSection}>
            <Text style={styles.whatYouLearnTitle}>What you'll learn:</Text>
            <View style={styles.learningPointsList}>
              {course.whatYouLearn.slice(0, 3).map((point, idx) => (
                <View key={idx} style={styles.learningPoint}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.learningPointText}>{point}</Text>
                </View>
              ))}
              {course.whatYouLearn.length > 3 && (
                <Text style={styles.morePointsText}>
                  +{course.whatYouLearn.length - 3} more{' '}
                  {course.whatYouLearn.length - 3 === 1 ? 'skill' : 'skills'}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Interactive Features Highlight */}
        {course.skillsUsed && course.skillsUsed.length > 0 && (
          <View style={styles.interactiveFeaturesBox}>
            <View style={styles.interactiveHeader}>
              <Ionicons name="flash" size={18} color="#8B5CF6" />
              <Text style={styles.interactiveHeaderText}>Interactive Learning</Text>
            </View>
            <View style={styles.skillChips}>
              {course.skillsUsed.slice(0, 2).map((skill, idx) => (
                <View key={idx} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>
                    {skill.replace(/-/g, ' ').replace(/interactive/i, '').trim()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Instructor */}
        {course.instructor && (
          <View style={styles.instructorSection}>
            <View style={styles.instructorAvatar}>
              <Text style={styles.instructorInitials}>
                {course.instructor.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </Text>
            </View>
            <View style={styles.instructorInfo}>
              <Text style={styles.instructorName}>{course.instructor.name}</Text>
              <Text style={styles.instructorTitle} numberOfLines={2}>
                {course.instructor.bio}
              </Text>
            </View>
          </View>
        )}

        {/* Module Preview */}
        {course.modules && course.modules.length > 0 && (
          <View style={styles.modulePreviewSection}>
            <Text style={styles.modulePreviewTitle}>Course modules:</Text>
            <View style={styles.modulesList}>
              {course.modules.slice(0, 3).map((module, idx) => (
                <View key={module.id} style={styles.moduleItem}>
                  <View style={styles.moduleNumber}>
                    <Text style={styles.moduleNumberText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.moduleItemTitle} numberOfLines={1}>
            {module.title}
          </Text>
                  {module.durationMinutes && (
                    <Text style={styles.moduleLessonCount}>{module.durationMinutes} min</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Course Footer - Price & CTA */}
      <View style={styles.courseFooter}>
        <View style={styles.priceSection}>
          {course.price.cents === 0 ? (
            <Text style={styles.priceFree}>FREE</Text>
          ) : course.status === 'coming-soon' ? (
            <Text style={styles.releaseDate}>
              {new Date(course.releaseDate).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          ) : (
            <View style={styles.priceContainer}>
              <Text style={styles.price}>${(course.price.cents / 100).toFixed(0)}</Text>
              <Text style={styles.priceLabel}>/year</Text>
          </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.enrollButton,
            course.status === 'coming-soon' && styles.enrollButtonSecondary,
            course.price.cents === 0 && styles.enrollButtonFree,
          ]}
          onPress={onEnroll}
          activeOpacity={0.8}
        >
          <Text style={styles.enrollButtonText}>
            {course.status === 'coming-soon'
              ? 'Notify Me'
              : course.price.cents === 0
              ? 'Start Free'
              : 'Enroll Now'}
        </Text>
          <Ionicons
            name={course.status === 'coming-soon' ? 'notifications-outline' : 'arrow-forward'}
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// Pricing Card Component
interface PricingCardProps {
  tier: CourseCatalog['pricingTiers'][0];
  isDesktop: boolean;
  isFeatured: boolean;
}

function _PricingCard({ tier, isDesktop: _isDesktop, isFeatured }: PricingCardProps) {
  const getPriceDisplay = () => {
    if (tier.price.cents === 0) {
      return { amount: 'FREE', period: '' };
    }
    if (tier.price.monthly && tier.price.yearly) {
      return {
        amount: `$${(tier.price.yearly.cents / 100).toFixed(0)}`,
        period: '/year',
        monthly: `$${(tier.price.monthly.cents / 100).toFixed(0)}/month`,
      };
    }
    return {
      amount: `$${((tier.price.cents || 0) / 100).toFixed(0)}`,
      period: tier.price.period === 'year' ? '/year' : '/month',
    };
  };

  const priceDisplay = getPriceDisplay();

  return (
    <View style={[styles.pricingCard, isFeatured && styles.pricingCardFeatured]}>
      {isFeatured && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>
      )}

      <Text style={styles.tierName}>{tier.name}</Text>

      <View style={styles.tierPriceContainer}>
        {tier.price.cents === 0 ? (
          <Text style={styles.tierPriceFree}>FREE</Text>
        ) : (
          <>
            <Text style={styles.tierPrice}>{priceDisplay.amount}</Text>
            <Text style={styles.tierPriceLabel}>{priceDisplay.period}</Text>
            {priceDisplay.monthly && (
              <Text style={styles.tierPriceMonthly}>{priceDisplay.monthly}</Text>
            )}
          </>
        )}
          </View>

      <View style={styles.tierFeaturesList}>
        {tier.includes.map((item, idx) => (
          <View key={idx} style={styles.tierFeatureItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.tierFeatureText}>{item}</Text>
        </View>
        ))}
        </View>

      <TouchableOpacity
        style={[styles.tierButton, isFeatured && styles.tierButtonFeatured]}
        activeOpacity={0.8}
      >
        <Text
          style={[styles.tierButtonText, isFeatured && styles.tierButtonTextFeatured]}
        >
          {tier.price.cents === 0 ? 'Start Free' : 'Get Started'}
        </Text>
      </TouchableOpacity>
      </View>
  );
}

// Institutional Card Component
interface InstitutionalCardProps {
  package: CourseCatalog['institutionalPackages'][0];
  isDesktop: boolean;
  onContactSales: () => void;
}

function _InstitutionalCard({ package: pkg, isDesktop, onContactSales }: InstitutionalCardProps) {
  return (
    <View style={[styles.institutionalCard, isDesktop && styles.institutionalCardDesktop]}>
      <View style={styles.institutionalCardHeader}>
        <Text style={styles.packageName}>{pkg.name}</Text>
        <View style={styles.packagePriceRow}>
          <Text style={styles.packagePrice}>
            ${(pkg.price.cents / 100).toFixed(0)}
          </Text>
          <Text style={styles.packagePriceLabel}>/month</Text>
        </View>
      </View>

      <View style={styles.packageUsersBadge}>
        <Ionicons name="people" size={16} color="#2196F3" />
        <Text style={styles.packageUsersText}>
          {pkg.userLimit === 'unlimited'
            ? 'Unlimited users'
            : `Up to ${pkg.userLimit} users`}
        </Text>
      </View>

      <View style={styles.packageFeaturesList}>
        {pkg.includes.map((feature, idx) => (
          <View key={idx} style={styles.packageFeature}>
            <Ionicons name="checkmark" size={18} color="#10B981" />
            <Text style={styles.packageFeatureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.contactSalesButton}
        activeOpacity={0.8}
        onPress={onContactSales}
      >
        <Text style={styles.contactSalesButtonText}>Contact Sales</Text>
        <Ionicons name="mail-outline" size={18} color="#2196F3" />
    </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  gradient: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    ...Platform.select({
      web: {
        minHeight: 'auto',
      },
    }),
  },
  content: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  contentDesktop: {
    // Additional desktop styles if needed
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(62, 146, 204, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 16,
    gap: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E92CC',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  titleDesktop: {
    fontSize: 32,
  },
  pricingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(62, 146, 204, 0.15)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  pricingNoteText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitleDesktop: {
    fontSize: 18,
  },
  modulesGrid: {
    gap: 24,
    marginBottom: 40,
  },
  modulesGridDesktop: {
    flexDirection: 'row',
    gap: 32,
  },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  moduleCardDesktop: {
    flex: 1,
    minWidth: 280,
    maxWidth: 360,
  },
  moduleIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  moduleContent: {
    flex: 1,
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  moduleTitle: {
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  moduleTitleDesktop: {
    fontSize: 20,
  },
  moduleTitleMobile: {
    fontSize: 18,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moduleDescription: {
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 20,
  },
  moduleDescriptionDesktop: {
    fontSize: 15,
  },
  moduleDescriptionMobile: {
    fontSize: 14,
  },
  moduleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginBottom: 12,
  },
  duration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    fontSize: 13,
    color: '#6B7280',
  },
  modulePricing: {
    alignItems: 'flex-end',
  },
  modulePrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  learnMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3E92CC',
    backgroundColor: 'transparent',
  },
  viewAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3E92CC',
  },
  // Hero Header
  heroHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 48,
    maxWidth: 800,
    alignSelf: 'center',
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  mainTitleDesktop: {
    fontSize: 48,
  },
  heroSubtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitleDesktop: {
    fontSize: 24,
  },
  heroDescription: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    textAlign: 'center',
  },
  heroDescriptionDesktop: {
    fontSize: 18,
  },
  // Free Course Banner
  freeCourseBanner: {
    marginHorizontal: 24,
    marginBottom: 64,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 40px rgba(139, 92, 246, 0.3)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  freeCourseGradient: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  freeCourseContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  freeBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  freeBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  freeCourseText: {
    flex: 1,
  },
  freeCourseTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  freeCourseSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  startFreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  startFreeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  // Learning Path Section
  learningPathSection: {
    paddingHorizontal: 24,
    marginBottom: 48,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionTitleDesktop: {
    fontSize: 32,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  sectionSubtitleDesktop: {
    fontSize: 18,
  },
  levelTabsContainer: {
    marginBottom: 24,
  },
  levelTabsContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  levelTabs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  levelTab: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    minWidth: 120,
    alignItems: 'center',
  },
  levelTabActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  levelTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  levelTabTextActive: {
    color: '#FFFFFF',
  },
  levelTabSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  levelTabSubtextActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  levelInfo: {
    backgroundColor: '#F9FAFB',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  levelDescription: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 12,
    textAlign: 'center',
  },
  targetAudienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  targetAudienceText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Course Cards
  coursesGrid: {
    gap: 24,
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  coursesGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  courseCardDesktop: {
    width: '30%',
    minWidth: 350,
    maxWidth: 400,
  },
  courseThumbnailContainer: {
    position: 'relative',
  },
  courseThumbnail: {
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(107, 114, 128, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  flagshipBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  flagshipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickStatsBar: {
    flexDirection: 'row',
    gap: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickStatText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Course Content
  courseContent: {
    padding: 20,
    flex: 1,
  },
  courseLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  levelBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  courseTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 28,
  },
  courseTitleDesktop: {
    fontSize: 22,
  },
  courseDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 16,
  },
  courseDescriptionDesktop: {
    fontSize: 15,
  },
  // What You'll Learn
  whatYouLearnSection: {
    marginBottom: 16,
  },
  whatYouLearnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 10,
  },
  learningPointsList: {
    gap: 8,
  },
  learningPoint: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  learningPointText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  morePointsText: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '600',
    marginTop: 4,
  },
  // Interactive Features
  interactiveFeaturesBox: {
    backgroundColor: '#F3E8FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  interactiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  interactiveHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6D28D9',
  },
  skillChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  skillChip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  skillChipText: {
    fontSize: 12,
    color: '#6D28D9',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  // Instructor
  instructorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginBottom: 16,
  },
  instructorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructorInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  instructorTitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  // Module Preview
  modulePreviewSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginBottom: 16,
  },
  modulePreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 10,
  },
  modulesList: {
    gap: 8,
  },
  moduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moduleNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  moduleItemTitle: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
  },
  moduleLessonCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  // Course Footer
  courseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  priceSection: {
    flex: 1,
  },
  priceFree: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10B981',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
  },
  priceLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  releaseDate: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  enrollButtonSecondary: {
    backgroundColor: '#6B7280',
  },
  enrollButtonFree: {
    backgroundColor: '#10B981',
  },
  enrollButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Show More
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: 24,
    marginBottom: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  showMoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  // View All Courses Section
  viewAllCoursesSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  viewAllCoursesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  viewAllCoursesButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  // Pricing Section
  pricingSection: {
    paddingHorizontal: 24,
    paddingVertical: 64,
    backgroundColor: '#F9FAFB',
  },
  pricingGrid: {
    gap: 24,
  },
  pricingGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  pricingCardDesktop: {
    width: '22%',
    minWidth: 280,
  },
  pricingCardFeatured: {
    borderColor: '#8B5CF6',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 40px rgba(139, 92, 246, 0.2)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    marginLeft: -60,
    backgroundColor: '#8B5CF6',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tierName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  tierPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  tierPrice: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1F2937',
  },
  tierPriceLabel: {
    fontSize: 18,
    color: '#6B7280',
    marginLeft: 6,
  },
  tierPriceFree: {
    fontSize: 48,
    fontWeight: '800',
    color: '#10B981',
  },
  tierPriceMonthly: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  tierFeaturesList: {
    gap: 12,
    marginBottom: 24,
  },
  tierFeatureItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  tierFeatureText: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
  },
  tierButton: {
    paddingVertical: 14,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    alignItems: 'center',
  },
  tierButtonFeatured: {
    backgroundColor: '#8B5CF6',
  },
  tierButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  tierButtonTextFeatured: {
    color: '#FFFFFF',
  },
  // Institutional
  institutionalSection: {
    paddingHorizontal: 24,
    paddingVertical: 64,
  },
  institutionalHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  institutionalTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  institutionalTitleDesktop: {
    fontSize: 36,
  },
  institutionalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 600,
  },
  institutionalSubtitleDesktop: {
    fontSize: 18,
  },
  institutionalGrid: {
    gap: 24,
    marginBottom: 48,
  },
  institutionalGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  institutionalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  institutionalCardDesktop: {
    width: '45%',
    minWidth: 320,
  },
  institutionalCardHeader: {
    marginBottom: 16,
  },
  packageName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  packagePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  packagePrice: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2196F3',
  },
  packagePriceLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  packageUsersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  packageUsersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  packageFeaturesList: {
    gap: 12,
    marginBottom: 24,
  },
  packageFeature: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  packageFeatureText: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
  },
  contactSalesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  contactSalesButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2196F3',
  },
  institutionalCTA: {
    backgroundColor: '#F9FAFB',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  institutionalCTAText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
    maxWidth: 600,
  },
  institutionalCTATextDesktop: {
    fontSize: 18,
  },
  scheduleCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  scheduleCallButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Timeline
  roadmapSection: {
    paddingHorizontal: 24,
    paddingVertical: 64,
    backgroundColor: '#F9FAFB',
  },
  roadmapHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  roadmapTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 8,
  },
  roadmapTitleDesktop: {
    fontSize: 32,
  },
  roadmapSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  roadmapSubtitleDesktop: {
    fontSize: 18,
  },
  timeline: {
    maxWidth: 800,
    alignSelf: 'center',
    marginBottom: 32,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
  },
  timelineLine: {
    alignItems: 'center',
    width: 40,
  },
  timelineLineBefore: {
    width: 2,
    flex: 1,
    backgroundColor: '#D1D5DB',
    minHeight: 20,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
    borderWidth: 4,
    borderColor: '#F3E8FF',
  },
  timelineLineAfter: {
    width: 2,
    flex: 1,
    backgroundColor: '#D1D5DB',
    minHeight: 20,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 24,
  },
  timelineDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 8,
  },
  timelineTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  timelineMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  timelineLevel: {
    fontSize: 14,
    color: '#6B7280',
  },
  timelineDuration: {
    fontSize: 14,
    color: '#6B7280',
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    maxWidth: 400,
    alignSelf: 'center',
  },
  notifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  // Why Choose
  whyChooseSection: {
    paddingHorizontal: 24,
    paddingVertical: 64,
  },
  benefitsGrid: {
    gap: 24,
  },
  benefitsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  benefitCard: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  benefitCardDesktop: {
    width: '45%',
    minWidth: 280,
  },
  benefitIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  benefitTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 24,
  },
  // Final CTA
  finalCTA: {
    paddingHorizontal: 24,
    paddingVertical: 64,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 24,
    marginBottom: 24,
  },
  finalCTAGradient: {
    padding: 48,
    alignItems: 'center',
  },
  finalCTATitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  finalCTATitleDesktop: {
    fontSize: 40,
  },
  finalCTASubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 32,
    textAlign: 'center',
    maxWidth: 600,
  },
  finalCTASubtitleDesktop: {
    fontSize: 20,
  },
  finalCTAButtons: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  finalCTAButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  finalCTAButtonPrimaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  finalCTAButtonSecondary: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  finalCTAButtonSecondaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Interactive Demo Section
  interactiveDemoSection: {
    paddingHorizontal: 24,
    paddingVertical: 64,
    backgroundColor: '#F9FAFB',
  },
  demoHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  demoTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  demoTitleDesktop: {
    fontSize: 36,
  },
  demoSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 600,
    lineHeight: 24,
  },
  demoSubtitleDesktop: {
    fontSize: 18,
  },
  demoContainer: {
    gap: 32,
    alignItems: 'flex-start',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  demoContainerDesktop: {
    flexDirection: 'row',
    gap: 48,
    alignItems: 'flex-start',
  },
  demoContainerMobile: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  demoStandaloneWrapper: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06)',
        border: '1px solid #E5E7EB',
      },
      default: {
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      },
    }),
  },
  demoFeatures: {
    flex: 1,
    gap: 24,
    width: '100%',
  },
  demoFeaturesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  demoFeaturesTitleDesktop: {
    fontSize: 24,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
  },
});
