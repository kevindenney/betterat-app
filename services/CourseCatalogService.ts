/**
 * Course Catalog Service
 * 
 * Single source of truth for Racing Academy course data.
 * Loads from JSON catalog file for consistency across landing page and /learn page.
 */

import courseCatalogData from '@/docs/academy/course-catalog.json';

// Type definitions matching JSON structure
type CourseCatalog = typeof courseCatalogData;

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  longDescription?: string;
  level: string;
  status: 'available' | 'coming-soon';
  releaseDate?: string;
  duration: {
    totalMinutes: number;
    lessons: number;
    estimatedHours: number;
  };
  price: {
    cents: number;
    currency: string;
    tier?: string;
  };
  whatYouLearn?: string[];
  modules?: {
    id: string;
    title: string;
    orderIndex: number;
    durationMinutes: number;
    lessons?: {
      id: string;
      title: string;
      lessonType: string;
      interactiveComponent?: string;
      orderIndex: number;
      durationSeconds: number;
      isFreePreview?: boolean;
      description?: string;
    }[];
  }[];
  instructor?: {
    name: string;
    bio: string;
    photoUrl?: string;
  };
  thumbnailUrl?: string;
  skillsUsed?: string[];
  targetMarkets?: string[];
  tags?: string[];
  certificate?: {
    enabled: boolean;
    name: string;
  };
}

export interface Level {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  prerequisites?: string;
  estimatedTotalDuration?: string;
  courses: Course[];
}

export interface PricingTier {
  id: string;
  name: string;
  price: {
    cents: number;
    currency: string;
    period?: string;
    monthly?: {
      cents: number;
      currency: string;
      period: string;
    };
    yearly?: {
      cents: number;
      currency: string;
      period: string;
    };
  };
  includes: string[];
  excludes?: string[];
}

export interface InstitutionalPackage {
  id: string;
  name: string;
  price: {
    cents: number;
    currency: string;
    period: string;
  };
  userLimit: number | 'unlimited';
  includes: string[];
}

class CourseCatalogService {
  private catalog: CourseCatalog;

  constructor() {
    this.catalog = courseCatalogData as CourseCatalog;
  }

  /**
   * Get all learning levels
   */
  getLevels(): Level[] {
    return this.catalog.levels;
  }

  /**
   * Get all courses across all levels
   */
  getAllCourses(): Course[] {
    return this.catalog.levels.flatMap((level) => level.courses);
  }

  /**
   * Get courses for a specific level
   */
  getCoursesByLevel(levelId: string): Course[] {
    const level = this.catalog.levels.find((l) => l.id === levelId);
    return level?.courses || [];
  }

  /**
   * Get a course by its slug
   */
  getCourseBySlug(slug: string): Course | undefined {
    return this.getAllCourses().find((course) => course.slug === slug);
  }

  /**
   * Get a course by its ID
   */
  getCourseById(id: string): Course | undefined {
    return this.getAllCourses().find((course) => course.id === id);
  }

  /**
   * Get featured courses
   */
  getFeaturedCourses(): Course[] {
    return this.getAllCourses().filter((course) => {
      // Check if course has flagship badge or is marked as featured
      return course.slug === 'winning-starts-first-beats' || course.status === 'available';
    });
  }

  /**
   * Get only available (not coming-soon) courses
   */
  getAvailableCourses(): Course[] {
    return this.getAllCourses().filter((course) => course.status === 'available');
  }

  /**
   * Get free courses
   */
  getFreeCourses(): Course[] {
    return this.getAllCourses().filter((course) => course.price.cents === 0 && course.status === 'available');
  }

  /**
   * Get coming soon courses
   */
  getComingSoonCourses(): Course[] {
    return this.getAllCourses()
      .filter((course) => course.status === 'coming-soon')
      .sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateA - dateB;
      });
  }

  /**
   * Get pricing tiers for individual plans
   */
  getPricingTiers(): PricingTier[] {
    return this.catalog.pricingTiers;
  }

  /**
   * Get institutional packages
   */
  getInstitutionalPackages(): InstitutionalPackage[] {
    return this.catalog.institutionalPackages;
  }

  /**
   * Get a specific level by ID
   */
  getLevelById(levelId: string): Level | undefined {
    return this.catalog.levels.find((l) => l.id === levelId);
  }

  /**
   * Get behavior-based topic categories for organizing courses by
   * race phase / common problem rather than skill level.
   * Maps to "Organize by Behavior" principle from Apple's Design Discoverable Interfaces.
   */
  getTopics(): { id: string; label: string; description: string; icon: string }[] {
    return [
      { id: 'starting', label: 'Starts', description: 'Win the start line', icon: 'flag' },
      { id: 'upwind', label: 'Upwind', description: 'Beat to windward', icon: 'arrow-up' },
      { id: 'marks', label: 'Marks', description: 'Rounding & laylines', icon: 'navigate' },
      { id: 'downwind', label: 'Downwind', description: 'Fast runs & gybes', icon: 'arrow-down' },
      { id: 'strategy', label: 'Strategy', description: 'Race tactics & weather', icon: 'bulb' },
      { id: 'boat-handling', label: 'Boat Skills', description: 'Trim, maneuvers & rules', icon: 'boat' },
      { id: 'preparation', label: 'Race Prep', description: 'Pre-race planning', icon: 'clipboard' },
    ];
  }

  /**
   * Get courses matching a behavior-based topic tag.
   * Courses can appear in multiple topics based on their tags.
   */
  getCoursesByTopic(topicId: string): Course[] {
    return this.getAllCourses().filter((course) => {
      const tags = course.tags || [];
      const skills = course.skillsUsed || [];
      // Match by tag, skill, or title keywords
      return (
        tags.includes(topicId) ||
        skills.some((s) => s.toLowerCase().includes(topicId)) ||
        course.title.toLowerCase().includes(topicId)
      );
    });
  }
}

export default new CourseCatalogService();

