/**
 * Onboarding State Service
 * Manages onboarding flow state, tracks progress, and stores preferences
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  OnboardingState,
  OnboardingStep,
  OnboardingPreferences,
  ExperienceLevel,
  BoatClassSelection,
  ClubSelection,
  FleetSelection,
  RaceSelection,
} from '@/types/onboarding';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('OnboardingStateService');

const STORAGE_KEY = 'regattaflow_onboarding_state';
// Removed: FLOW_KEY ('regattaflow_onboarding_flow') — defined but never read
// or written per D2 audit §1.2/§3.1 finding 4. The useNewFlow toggle is
// in-memory only; persisted flow type is not used.
const ONBOARDING_SEEN_KEY = 'regattaflow_onboarding_seen';
const CACHED_USERNAME_KEY = 'regattaflow_cached_username';

// Post-signup practical onboarding: name-only (boat/club deferred to in-app prompts)
const POST_SIGNUP_STEPS: OnboardingStep[] = [
  'name-photo',
];

/**
 * Create initial onboarding state
 */
function createInitialState(): OnboardingState {
  return {
    currentStep: 'name-photo',
    completedSteps: [],
    preferences: {},
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

export class OnboardingStateService {
  private static state: OnboardingState | null = null;
  private static useNewFlow: boolean = true;

  // ============================================================================
  // Returning User Detection
  // ============================================================================

  /**
   * Check if user has completed onboarding before (returning user)
   */
  static async hasSeenOnboarding(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
      return value === 'true';
    } catch (error) {
      logger.error('[OnboardingStateService] Failed to check hasSeenOnboarding', error);
      return false;
    }
  }

  /**
   * Mark onboarding as seen (call on completion)
   */
  static async markOnboardingSeen(): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
      logger.debug('[OnboardingStateService] Marked onboarding as seen');
    } catch (error) {
      logger.error('[OnboardingStateService] Failed to mark onboarding as seen', error);
    }
  }

  /**
   * Cache username for welcome back screen (call on sign out)
   */
  static async cacheUsername(name: string): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHED_USERNAME_KEY, name);
      logger.debug('[OnboardingStateService] Cached username:', name);
    } catch (error) {
      logger.error('[OnboardingStateService] Failed to cache username', error);
    }
  }

  /**
   * Get cached username for welcome back screen
   */
  static async getCachedUsername(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(CACHED_USERNAME_KEY);
    } catch (error) {
      logger.error('[OnboardingStateService] Failed to get cached username', error);
      return null;
    }
  }

  /**
   * Clear cached username (call on account deletion)
   */
  static async clearCachedUsername(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHED_USERNAME_KEY);
      logger.debug('[OnboardingStateService] Cleared cached username');
    } catch (error) {
      logger.error('[OnboardingStateService] Failed to clear cached username', error);
    }
  }

  /**
   * Reset onboarding seen flag (for testing/dev purposes)
   */
  static async resetOnboardingSeen(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ONBOARDING_SEEN_KEY);
      logger.debug('[OnboardingStateService] Reset onboarding seen flag');
    } catch (error) {
      logger.error('[OnboardingStateService] Failed to reset onboarding seen flag', error);
    }
  }

  // ============================================================================
  // Flow Type Management
  // ============================================================================

  /**
   * Check if new onboarding flow is enabled
   */
  static isNewFlowEnabled(): boolean {
    return this.useNewFlow;
  }

  /**
   * Set which onboarding flow to use
   */
  static setFlowType(useNew: boolean): void {
    this.useNewFlow = useNew;
  }

  /**
   * Get the appropriate step list based on flow type
   */
  private static getStepList(): OnboardingStep[] {
    return POST_SIGNUP_STEPS;
  }

  /**
   * Get the first step for the current flow
   */
  static getFirstStep(): OnboardingStep {
    return 'name-photo';
  }

  /**
   * Get the starting route for onboarding (practical onboarding only)
   */
  static async getStartingRoute(): Promise<string> {
    return '/onboarding/profile/name-photo';
  }

  /**
   * Load onboarding state from storage
   */
  static async loadState(): Promise<OnboardingState> {
    try {
      if (this.state) {
        return this.state;
      }

      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.state = JSON.parse(stored) as OnboardingState;
        logger.debug('[OnboardingStateService] Loaded state from storage', {
          currentStep: this.state.currentStep,
          completedSteps: this.state.completedSteps.length,
        });
        return this.state;
      }

      this.state = createInitialState();
      return this.state;
    } catch (error) {
      logger.error('[OnboardingStateService] Failed to load state', error);
      this.state = createInitialState();
      return this.state;
    }
  }

  /**
   * Save onboarding state to storage
   */
  static async saveState(): Promise<void> {
    try {
      if (!this.state) {
        return;
      }

      this.state.lastUpdatedAt = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      logger.debug('[OnboardingStateService] Saved state to storage');
    } catch (error) {
      logger.error('[OnboardingStateService] Failed to save state', error);
    }
  }

  /**
   * Clear onboarding state (on completion or reset)
   */
  static async clearState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      this.state = null;
      logger.debug('[OnboardingStateService] Cleared onboarding state');
    } catch (error) {
      logger.error('[OnboardingStateService] Failed to clear state', error);
    }
  }

  /**
   * Get current step
   */
  static async getCurrentStep(): Promise<OnboardingStep> {
    const state = await this.loadState();
    return state.currentStep;
  }

  /**
   * Set current step
   */
  static async setCurrentStep(step: OnboardingStep): Promise<void> {
    const state = await this.loadState();
    state.currentStep = step;
    await this.saveState();
  }

  /**
   * Mark a step as completed
   */
  static async completeStep(step: OnboardingStep): Promise<void> {
    const state = await this.loadState();
    if (!state.completedSteps.includes(step)) {
      state.completedSteps.push(step);
    }
    await this.saveState();
  }

  /**
   * Check if a step is completed
   */
  static async isStepCompleted(step: OnboardingStep): Promise<boolean> {
    const state = await this.loadState();
    return state.completedSteps.includes(step);
  }

  /**
   * Get next step based on current path
   */
  static async getNextStep(currentStep: OnboardingStep): Promise<OnboardingStep | null> {
    await this.loadState();
    const path = this.getStepList();
    const currentIndex = path.indexOf(currentStep);

    if (currentIndex === -1 || currentIndex === path.length - 1) {
      return null;
    }

    return path[currentIndex + 1];
  }

  /**
   * Get previous step based on current path
   */
  static async getPreviousStep(currentStep: OnboardingStep): Promise<OnboardingStep | null> {
    await this.loadState();
    const path = this.getStepList();
    const currentIndex = path.indexOf(currentStep);

    if (currentIndex <= 0) {
      return null;
    }

    return path[currentIndex - 1];
  }

  /**
   * Get progress percentage
   */
  static async getProgress(): Promise<number> {
    const state = await this.loadState();
    const path = this.getStepList();
    const currentIndex = path.indexOf(state.currentStep);

    if (currentIndex === -1) {
      return 0;
    }

    return Math.round((currentIndex / (path.length - 1)) * 100);
  }

  /**
   * Get step number (1-indexed)
   */
  static async getStepNumber(step: OnboardingStep): Promise<{ current: number; total: number }> {
    await this.loadState();
    const path = this.getStepList();
    const currentIndex = path.indexOf(step);

    return {
      current: currentIndex + 1,
      total: path.length,
    };
  }

  // ============================================================================
  // Preference Setters
  // ============================================================================

  /**
   * Set setup path (quick or full)
   */
  static async setSetupPath(path: 'quick' | 'full'): Promise<void> {
    const state = await this.loadState();
    state.preferences.setupPath = path;
    await this.saveState();
    logger.debug('[OnboardingStateService] Set setup path:', path);
  }

  /**
   * Set user info
   */
  static async setUserInfo(userId: string, userName: string, avatarUrl?: string): Promise<void> {
    const state = await this.loadState();
    state.preferences.userId = userId;
    state.preferences.userName = userName;
    state.preferences.avatarUrl = avatarUrl;
    await this.saveState();
  }

  /**
   * Set experience level
   */
  static async setExperienceLevel(level: ExperienceLevel): Promise<void> {
    const state = await this.loadState();
    state.preferences.experienceLevel = level;
    await this.saveState();
    logger.debug('[OnboardingStateService] Set experience level:', level);
  }

  /**
   * Set boat class selection
   */
  static async setBoatClass(boatClass: BoatClassSelection | null): Promise<void> {
    const state = await this.loadState();
    if (boatClass) {
      state.preferences.boatClass = boatClass;
      state.preferences.hasNoBoat = false;
    } else {
      state.preferences.boatClass = undefined;
      state.preferences.hasNoBoat = true;
    }
    await this.saveState();
    logger.debug('[OnboardingStateService] Set boat class:', boatClass?.name || 'none');
  }

  /**
   * Set home club selection
   */
  static async setHomeClub(club: ClubSelection | null): Promise<void> {
    const state = await this.loadState();
    if (club) {
      state.preferences.homeClub = club;
      state.preferences.hasNoClub = false;
    } else {
      state.preferences.homeClub = undefined;
      state.preferences.hasNoClub = true;
    }
    await this.saveState();
    logger.debug('[OnboardingStateService] Set home club:', club?.name || 'none');
  }

  /**
   * Set primary fleet selection
   */
  static async setPrimaryFleet(fleet: FleetSelection | null): Promise<void> {
    const state = await this.loadState();
    if (fleet) {
      state.preferences.primaryFleet = fleet;
      state.preferences.hasNoFleet = false;
    } else {
      state.preferences.primaryFleet = undefined;
      state.preferences.hasNoFleet = true;
    }
    await this.saveState();
    logger.debug('[OnboardingStateService] Set primary fleet:', fleet?.name || 'none');
  }

  /**
   * Set selected races
   */
  static async setSelectedRaces(races: RaceSelection[]): Promise<void> {
    const state = await this.loadState();
    state.preferences.selectedRaces = races;
    await this.saveState();
    logger.debug('[OnboardingStateService] Set selected races:', races.length);
  }

  /**
   * Add a race to selected races
   */
  static async addRace(race: RaceSelection): Promise<void> {
    const state = await this.loadState();
    const races = state.preferences.selectedRaces || [];
    if (!races.find((r) => r.id === race.id)) {
      races.push(race);
      state.preferences.selectedRaces = races;
      await this.saveState();
    }
  }

  /**
   * Remove a race from selected races
   */
  static async removeRace(raceId: string): Promise<void> {
    const state = await this.loadState();
    const races = state.preferences.selectedRaces || [];
    state.preferences.selectedRaces = races.filter((r) => r.id !== raceId);
    await this.saveState();
  }

  // ============================================================================
  // Preference Getters
  // ============================================================================

  /**
   * Get all preferences
   */
  static async getPreferences(): Promise<Partial<OnboardingPreferences>> {
    const state = await this.loadState();
    return state.preferences;
  }

  /**
   * Get complete preferences (throws if missing required fields)
   */
  static async getCompletePreferences(): Promise<OnboardingPreferences> {
    const state = await this.loadState();
    const prefs = state.preferences;

    if (!prefs.userId || !prefs.userName || !prefs.setupPath) {
      throw new Error('Missing required onboarding preferences');
    }

    return prefs as OnboardingPreferences;
  }
}
