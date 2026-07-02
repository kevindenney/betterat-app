/**
 * AI Fallback Handler
 * 
 * Gracefully handles credit exhaustion and API errors with mock responses.
 * Prevents app crashes when Anthropic API credits run out.
 */

import { createLogger } from '@/lib/utils/logger';
import { CircuitOpenError, getAICircuitBreaker, resetAICircuitBreaker } from '@/lib/utils/aiCircuitBreaker';

const logger = createLogger('AIFallback');

// Track if we're in fallback mode
let isInFallbackMode = false;
let fallbackReason: string | null = null;
let fallbackActivatedAt: Date | null = null;

// Errors that trigger fallback mode
const CREDIT_EXHAUSTION_PATTERNS = [
  'credit balance is too low',
  'insufficient credits',
  'rate limit exceeded',
  'quota exceeded',
  'billing',
  'payment required',
];

// API overload/unavailable patterns (529, 503, etc.)
const API_OVERLOAD_PATTERNS = [
  'overload',
  'service unavailable',
  'temporarily unavailable',
  'too many requests',
  'server is busy',
  'capacity',
];

/**
 * Check if an error indicates credit exhaustion
 */
export function isCreditExhaustedError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase();

  return CREDIT_EXHAUSTION_PATTERNS.some(pattern => message.includes(pattern));
}

/**
 * Check if an error indicates API overload (529, 503, etc.)
 */
export function isAPIOverloadError(error: unknown): boolean {
  if (!error) return false;

  // Check for HTTP status codes
  const status = (error as any)?.status || (error as any)?.statusCode;
  if (status === 529 || status === 503 || status === 502) {
    return true;
  }

  const message = error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase();

  // Check for overload patterns in message
  if (API_OVERLOAD_PATTERNS.some(pattern => message.includes(pattern))) {
    return true;
  }

  // Also check for status codes in error message (e.g., "529" or "503")
  if (message.includes('529') || message.includes('503') || message.includes('502')) {
    return true;
  }

  return false;
}

/**
 * Check if an error should trigger fallback mode (credit exhaustion OR API overload)
 */
export function shouldTriggerFallback(error: unknown): boolean {
  return isCreditExhaustedError(error) || isAPIOverloadError(error);
}

/**
 * Activate fallback mode
 */
export function activateFallbackMode(reason: string): void {
  if (!isInFallbackMode) {
    logger.warn('AI Fallback mode activated', { reason });
    isInFallbackMode = true;
    fallbackReason = reason;
    fallbackActivatedAt = new Date();
  }
}

/**
 * Deactivate fallback mode (e.g., after credits are refilled)
 * Also resets the circuit breaker so requests can flow again.
 */
export function deactivateFallbackMode(): void {
  if (isInFallbackMode) {
    logger.info('AI Fallback mode deactivated');
    isInFallbackMode = false;
    fallbackReason = null;
    fallbackActivatedAt = null;
    resetAICircuitBreaker();
  }
}

/**
 * Check if currently in fallback mode
 */
export function isAIInFallbackMode(): boolean {
  return isInFallbackMode;
}

/**
 * Get fallback status for UI display.
 * Includes circuit breaker state so the UI can show retry countdowns.
 */
export function getFallbackStatus(): {
  active: boolean;
  reason: string | null;
  since: Date | null;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  retryInMs: number;
} {
  const breakerStatus = getAICircuitBreaker().getStatus();
  return {
    active: isInFallbackMode || breakerStatus.state === 'OPEN',
    reason: fallbackReason,
    since: fallbackActivatedAt,
    circuitState: breakerStatus.state,
    retryInMs: breakerStatus.msUntilHalfOpen,
  };
}

/**
 * Wrap an AI call with fallback handling
 * Returns the fallback value if in fallback mode or on credit exhaustion
 */
export async function withAIFallback<T>(
  aiCall: () => Promise<T>,
  fallbackValue: T,
  options?: {
    fallbackMessage?: string;
    onFallback?: () => void;
  }
): Promise<{ result: T; usedFallback: boolean }> {
  // If already in fallback mode, skip the API call
  if (isInFallbackMode) {
    logger.debug('Using fallback (already in fallback mode)');
    options?.onFallback?.();
    return { result: fallbackValue, usedFallback: true };
  }

  try {
    const result = await aiCall();
    // Successful call — deactivate fallback mode if it was on (API recovered)
    if (isInFallbackMode) {
      deactivateFallbackMode();
    }
    return { result, usedFallback: false };
  } catch (error) {
    // Circuit breaker is open — use fallback without activating sticky mode
    // (the breaker will probe automatically)
    if (error instanceof CircuitOpenError) {
      logger.debug('Using fallback (circuit breaker open)');
      options?.onFallback?.();
      return { result: fallbackValue, usedFallback: true };
    }

    if (shouldTriggerFallback(error)) {
      const reason = isAPIOverloadError(error)
        ? 'Anthropic API overloaded'
        : options?.fallbackMessage || 'Credit exhaustion detected';
      activateFallbackMode(reason);
      options?.onFallback?.();
      return { result: fallbackValue, usedFallback: true };
    }

    // Re-throw non-fallback errors
    throw error;
  }
}

/**
 * Generate a mock rig tuning recommendation for fallback
 */
export function generateMockRigTuning(params: {
  className?: string;
  windSpeed?: number;
}): any {
  const { className = 'Unknown', windSpeed = 12 } = params;
  
  // Determine wind range description
  let windRange = 'medium';
  if (windSpeed < 8) windRange = 'light';
  else if (windSpeed > 16) windRange = 'heavy';

  return {
    guideId: 'fallback-mock',
    guideTitle: `${className} General Guidelines`,
    guideSource: 'BetterAt Fallback (AI unavailable)',
    sectionTitle: `${windRange.charAt(0).toUpperCase() + windRange.slice(1)} Air Setup`,
    conditionSummary: `${windSpeed} knots - ${windRange} conditions`,
    isAIGenerated: false,
    isFallback: true,
    confidence: 0.5,
    settings: [
      {
        key: 'shrouds',
        label: 'Shroud Tension',
        value: windRange === 'light' ? 'Loose - allow rig movement' 
             : windRange === 'heavy' ? 'Tight - stabilize rig'
             : 'Medium - standard tension',
        reasoning: 'General principle for ' + windRange + ' conditions',
      },
      {
        key: 'backstay',
        label: 'Backstay',
        value: windRange === 'light' ? 'Ease for fuller sails'
             : windRange === 'heavy' ? 'Tension for flatter sails'
             : 'Moderate tension',
        reasoning: 'Adjust for power vs. depower',
      },
      {
        key: 'outhaul',
        label: 'Outhaul',
        value: windRange === 'light' ? 'Ease 2-3" from band'
             : windRange === 'heavy' ? 'Full to band'
             : '1-2" from band',
        reasoning: 'Foot depth control',
      },
    ],
    notes: [
      '⚠️ AI recommendations unavailable - using general guidelines',
      'Upload a class-specific tuning guide for detailed settings',
      'These are physics-based general principles only',
    ],
    caveats: [
      'AI credits exhausted - showing fallback recommendations',
      'For precise settings, please add credits at console.anthropic.com',
    ],
  };
}

/**
 * Generate a mock race strategy for fallback
 */
export function generateMockStrategy(params: {
  raceName?: string;
  windSpeed?: number;
  windDirection?: number;
}): any {
  const { raceName = 'Race', windSpeed = 12, windDirection = 180 } = params;

  return {
    isFallback: true,
    analysis: '⚠️ AI strategy unavailable - showing general guidance',
    recommendations: {
      startStrategy: 'Favor the end with best angle to first mark. Start with clear air.',
      upwindStrategy: 'Sail lifted tack. Tack on significant headers (5°+).',
      downwindStrategy: 'Sail pressure. Gybe in lulls.',
      markRoundings: 'Wide entry, tight exit. Maintain speed through turns.',
    },
    contingencies: [
      {
        trigger: 'Wind shift > 10°',
        response: 'Re-evaluate favored side of course',
        confidence: 0.7,
      },
    ],
    confidence: 'low',
    caveats: [
      'AI credits exhausted - showing general principles only',
      'For venue-specific strategy, add credits at console.anthropic.com',
    ],
  };
}
