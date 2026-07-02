/**
 * FeatureTourService — Manages feature tour state for first-time users
 *
 * Tracks which tutorial steps the user has completed in the races tab tour.
 * The tour teaches core interface patterns: race cards, add race, phase tabs,
 * and social features.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('FeatureTourService');

const TOUR_COMPLETED_KEY = 'regattaflow_feature_tour_completed';
const TOUR_STEP_KEY = 'regattaflow_feature_tour_step';
const TOUR_STARTED_KEY = 'regattaflow_feature_tour_started';
const TOUR_PRICING_PROMPT_SEEN_KEY = 'regattaflow_feature_tour_pricing_prompt_seen';

/**
 * Tour step identifiers in order.
 * The core walkthrough ends at add_your_race. pricing_trial is triggered separately.
 */
export const TOUR_STEPS = [
  'welcome',              // Step 1: Full-screen welcome card
  'race_timeline',        // Step 2: Spotlight on race carousel
  'prep_overview',        // Step 3: Spotlight on detail cards zone (Prep/Race/Review)
  'tab_sweep',            // Step 4: Full-screen card showing all 4 tabs
  'add_your_race',        // Step 5: Spotlight on + button
  'pricing_trial',        // Step 6: Full-screen pricing modal
] as const;

export type TourStep = typeof TOUR_STEPS[number];

/** How the tour step should be rendered */
export type TourRenderMode = 'spotlight' | 'fullscreen_card' | 'fullscreen_modal';

/**
 * Tour step configuration with display properties
 */
export interface TourStepConfig {
  id: TourStep;
  title: string;
  description: string;
  position: 'top' | 'bottom';
  targetElement: string; // CSS-like identifier for the target element
  renderMode: TourRenderMode;
}

/** Steps rendered as full-screen overlays (not spotlight) */
export const FULLSCREEN_STEPS: readonly TourStep[] = ['welcome', 'tab_sweep', 'pricing_trial'];

/**
 * Configuration for each tour step
 */
export const TOUR_STEP_CONFIGS: Record<TourStep, TourStepConfig> = {
  welcome: {
    id: 'welcome',
    title: 'Your race companion',
    description: 'BetterAt helps you prepare for races, learn tactics, and track your progress.',
    position: 'bottom',
    targetElement: 'none',
    renderMode: 'fullscreen_card',
  },
  race_timeline: {
    id: 'race_timeline',
    title: 'Swipe to browse races',
    description: 'Drag left for completed races and right for upcoming ones. Each card shows your prep progress.',
    position: 'bottom',
    targetElement: 'race-cards-carousel',
    renderMode: 'spotlight',
  },
  prep_overview: {
    id: 'prep_overview',
    title: 'Prep, Race, Review',
    description: 'Every race has three phases. Prep your checklist and strategy, track on the water, then review and improve.',
    position: 'top',
    targetElement: 'detail-cards-zone',
    renderMode: 'spotlight',
  },
  tab_sweep: {
    id: 'tab_sweep',
    title: 'Explore every tab',
    description: 'Four tabs to power your sailing journey.',
    position: 'bottom',
    targetElement: 'none',
    renderMode: 'fullscreen_card',
  },
  add_your_race: {
    id: 'add_your_race',
    title: 'Add your first race',
    description: 'Tap + to create your first race from a notice or manual entry.',
    position: 'bottom',
    targetElement: 'add-race-button',
    renderMode: 'spotlight',
  },
  pricing_trial: {
    id: 'pricing_trial',
    title: 'Choose your plan',
    description: 'Start with a 14-day free trial of all features.',
    position: 'bottom',
    targetElement: 'none',
    renderMode: 'fullscreen_modal',
  },
};

/**
 * Interest-aware overrides for tour step copy.
 * Falls back to TOUR_STEP_CONFIGS when no override exists.
 */
const INTEREST_TOUR_OVERRIDES: Record<string, Partial<Record<TourStep, { title?: string; description?: string }>>> = {
  'sail-racing': {}, // Defaults are already sailing-oriented
};

const GENERIC_TOUR_OVERRIDES: Partial<Record<TourStep, { title?: string; description?: string }>> = {
  welcome: {
    title: 'Welcome to BetterAt',
    description: 'BetterAt helps you track progress, learn from others, and stay on top of your goals.',
  },
  race_timeline: {
    title: 'Browse your timeline',
    description: 'Swipe through your steps and milestones. Each card shows your progress.',
  },
  prep_overview: {
    title: 'Plan, Do, Review',
    description: 'Every step has three phases. Plan your approach, do the work, then review and improve.',
  },
  tab_sweep: {
    title: 'Explore every tab',
    description: 'Four tabs to power your journey.',
  },
  add_your_race: {
    title: 'Add your first step',
    description: 'Tap + to create your first timeline step.',
  },
};

/**
 * Get tour step config with interest-aware copy.
 * Sailing uses the original configs; other interests get generic overrides.
 */
export function getInterestAwareStepConfig(
  step: TourStep,
  interestSlug?: string | null,
): TourStepConfig {
  const base = TOUR_STEP_CONFIGS[step];
  const overrides = interestSlug
    ? (INTEREST_TOUR_OVERRIDES[interestSlug]?.[step] ?? GENERIC_TOUR_OVERRIDES[step])
    : GENERIC_TOUR_OVERRIDES[step];

  if (!overrides) return base;

  return {
    ...base,
    ...(overrides.title ? { title: overrides.title } : {}),
    ...(overrides.description ? { description: overrides.description } : {}),
  };
}

interface TourState {
  completed: boolean;
  currentStep: TourStep | null;
  startedAt: string | null;
  completedAt: string | null;
}

export class FeatureTourService {
  private static cache: TourState | null = null;

  /**
   * Load tour state from storage
   */
  private static async loadState(): Promise<TourState> {
    if (this.cache) return this.cache;

    try {
      const [completed, currentStep, startedAt] = await Promise.all([
        AsyncStorage.getItem(TOUR_COMPLETED_KEY),
        AsyncStorage.getItem(TOUR_STEP_KEY),
        AsyncStorage.getItem(TOUR_STARTED_KEY),
      ]);

      // Migration: if stored step is not in the current TOUR_STEPS, reset the tour
      let validStep = currentStep as TourStep | null;
      if (validStep && !(TOUR_STEPS as readonly string[]).includes(validStep)) {
        logger.debug('[FeatureTourService] Stored step not in TOUR_STEPS, resetting tour:', validStep);
        await Promise.all([
          AsyncStorage.removeItem(TOUR_COMPLETED_KEY),
          AsyncStorage.removeItem(TOUR_STEP_KEY),
          AsyncStorage.removeItem(TOUR_STARTED_KEY),
        ]);
        validStep = null;
      }

      this.cache = {
        completed: completed === 'true',
        currentStep: validStep,
        startedAt: startedAt,
        completedAt: null,
      };

      return this.cache;
    } catch (error) {
      logger.error('[FeatureTourService] Failed to load state', error);
      this.cache = {
        completed: false,
        currentStep: null,
        startedAt: null,
        completedAt: null,
      };
      return this.cache;
    }
  }

  /**
   * Check if the user has completed the feature tour
   */
  static async hasCompletedTour(): Promise<boolean> {
    const state = await this.loadState();
    return state.completed;
  }

  /**
   * Check if the tour has been started
   */
  static async hasTourStarted(): Promise<boolean> {
    const state = await this.loadState();
    return state.startedAt !== null;
  }

  /**
   * Check if pricing prompt was already shown.
   */
  static async hasSeenPricingPrompt(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(TOUR_PRICING_PROMPT_SEEN_KEY);
      return value === 'true';
    } catch (error) {
      logger.error('[FeatureTourService] Failed to read pricing prompt state', error);
      return false;
    }
  }

  /**
   * Mark pricing prompt as shown so it does not repeat.
   */
  static async markPricingPromptSeen(): Promise<void> {
    try {
      await AsyncStorage.setItem(TOUR_PRICING_PROMPT_SEEN_KEY, 'true');
    } catch (error) {
      logger.error('[FeatureTourService] Failed to save pricing prompt state', error);
    }
  }

  /**
   * Get the current tour step
   * Returns null if tour not started or already completed
   */
  static async getCurrentStep(): Promise<TourStep | null> {
    const state = await this.loadState();
    if (state.completed) return null;
    return state.currentStep;
  }

  /**
   * Get the current step index (1-based for display)
   */
  static async getCurrentStepIndex(): Promise<number> {
    const state = await this.loadState();
    if (!state.currentStep) return 0;
    const index = TOUR_STEPS.indexOf(state.currentStep);
    return index + 1;
  }

  /**
   * Get total number of steps
   */
  static getTotalSteps(): number {
    return TOUR_STEPS.length;
  }

  /**
   * Get step configuration for the current step
   */
  static async getCurrentStepConfig(): Promise<TourStepConfig | null> {
    const currentStep = await this.getCurrentStep();
    if (!currentStep) return null;
    return TOUR_STEP_CONFIGS[currentStep];
  }

  /**
   * Start the feature tour
   */
  static async startTour(): Promise<void> {
    try {
      const startedAt = new Date().toISOString();
      const firstStep = TOUR_STEPS[0];

      await Promise.all([
        AsyncStorage.setItem(TOUR_STARTED_KEY, startedAt),
        AsyncStorage.setItem(TOUR_STEP_KEY, firstStep),
        AsyncStorage.removeItem(TOUR_COMPLETED_KEY),
      ]);

      this.cache = {
        completed: false,
        currentStep: firstStep,
        startedAt: startedAt,
        completedAt: null,
      };

      logger.debug('[FeatureTourService] Tour started');
    } catch (error) {
      logger.error('[FeatureTourService] Failed to start tour', error);
    }
  }

  /**
   * Advance to the next tour step
   * Returns the next step, or null if tour is complete
   */
  static async advanceToNextStep(): Promise<TourStep | null> {
    try {
      const state = await this.loadState();
      if (state.completed || !state.currentStep) return null;

      const currentIndex = TOUR_STEPS.indexOf(state.currentStep);
      const nextIndex = currentIndex + 1;

      if (nextIndex >= TOUR_STEPS.length) {
        // Tour complete
        await this.completeTour();
        return null;
      }

      const nextStep = TOUR_STEPS[nextIndex];
      await AsyncStorage.setItem(TOUR_STEP_KEY, nextStep);

      if (this.cache) {
        this.cache.currentStep = nextStep;
      }

      logger.debug('[FeatureTourService] Advanced to step:', nextStep);
      return nextStep;
    } catch (error) {
      logger.error('[FeatureTourService] Failed to advance step', error);
      return null;
    }
  }

  /**
   * Move to the previous tour step.
   * Returns the previous step, or null if already at the first step.
   */
  static async goToPreviousStep(): Promise<TourStep | null> {
    try {
      const state = await this.loadState();
      if (state.completed || !state.currentStep) return null;

      const currentIndex = TOUR_STEPS.indexOf(state.currentStep);
      const previousIndex = currentIndex - 1;

      if (previousIndex < 0) {
        return state.currentStep;
      }

      const previousStep = TOUR_STEPS[previousIndex];
      await AsyncStorage.setItem(TOUR_STEP_KEY, previousStep);

      if (this.cache) {
        this.cache.currentStep = previousStep;
      }

      logger.debug('[FeatureTourService] Moved to previous step:', previousStep);
      return previousStep;
    } catch (error) {
      logger.error('[FeatureTourService] Failed to move to previous step', error);
      return null;
    }
  }

  /**
   * Jump directly to a specific step index (1-based).
   * Returns the selected step, or null if index is invalid.
   */
  static async goToStepIndex(index: number): Promise<TourStep | null> {
    try {
      if (index < 1 || index > TOUR_STEPS.length) {
        return null;
      }

      const step = TOUR_STEPS[index - 1];
      const state = await this.loadState();

      if (!state.startedAt) {
        await AsyncStorage.setItem(TOUR_STARTED_KEY, new Date().toISOString());
        if (this.cache) {
          this.cache.startedAt = new Date().toISOString();
        }
      }

      await Promise.all([
        AsyncStorage.setItem(TOUR_STEP_KEY, step),
        AsyncStorage.removeItem(TOUR_COMPLETED_KEY),
      ]);

      if (this.cache) {
        this.cache.currentStep = step;
        this.cache.completed = false;
      }

      logger.debug('[FeatureTourService] Jumped to step index:', index);
      return step;
    } catch (error) {
      logger.error('[FeatureTourService] Failed to jump to step index', error);
      return null;
    }
  }

  /**
   * Skip the tour entirely
   */
  static async skipTour(): Promise<void> {
    await this.completeTour();
    logger.debug('[FeatureTourService] Tour skipped');
  }

  /**
   * Mark the tour as completed
   */
  static async completeTour(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(TOUR_COMPLETED_KEY, 'true'),
        AsyncStorage.removeItem(TOUR_STEP_KEY),
      ]);

      if (this.cache) {
        this.cache.completed = true;
        this.cache.currentStep = null;
        this.cache.completedAt = new Date().toISOString();
      }

      logger.debug('[FeatureTourService] Tour completed');
    } catch (error) {
      logger.error('[FeatureTourService] Failed to complete tour', error);
    }
  }

  /**
   * Reset the tour (for testing/dev purposes)
   */
  static async resetTour(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(TOUR_COMPLETED_KEY),
        AsyncStorage.removeItem(TOUR_STEP_KEY),
        AsyncStorage.removeItem(TOUR_STARTED_KEY),
        AsyncStorage.removeItem(TOUR_PRICING_PROMPT_SEEN_KEY),
      ]);

      this.cache = null;
      logger.debug('[FeatureTourService] Tour reset');
    } catch (error) {
      logger.error('[FeatureTourService] Failed to reset tour', error);
    }
  }

  /**
   * Check if a specific step is the current step
   */
  static async isCurrentStep(step: TourStep): Promise<boolean> {
    const currentStep = await this.getCurrentStep();
    return currentStep === step;
  }

  /**
   * Get the step config for a specific step
   */
  static getStepConfig(step: TourStep): TourStepConfig {
    return TOUR_STEP_CONFIGS[step];
  }

  /**
   * Clear the cache (useful when user signs out)
   */
  static clearCache(): void {
    this.cache = null;
  }
}
