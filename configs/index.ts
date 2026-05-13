/**
 * Interest Event Configs — barrel export
 *
 * Each interest provides its own InterestEventConfig that drives
 * event cards, content modules, debrief, AI analysis, and the reflect tab.
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'
import { SAILING_EVENT_CONFIG } from './sailing'
import { NURSING_EVENT_CONFIG } from './nursing'
import { DRAWING_EVENT_CONFIG } from './drawing'
import { DESIGN_EVENT_CONFIG } from './design'
import { FITNESS_EVENT_CONFIG } from './fitness'
import { KNITTING_EVENT_CONFIG } from './knitting'
import { FIBER_ARTS_EVENT_CONFIG } from './fiber-arts'
import { PAINTING_PRINTING_EVENT_CONFIG } from './painting-printing'
import { LIFELONG_LEARNING_EVENT_CONFIG } from './lifelong-learning'
import { REGENERATIVE_AGRICULTURE_EVENT_CONFIG } from './regenerative-agriculture'
import { GLOBAL_HEALTH_EVENT_CONFIG } from './global-health'
import { SELF_MASTERY_EVENT_CONFIG } from './self-mastery'
import { makeGenericEventConfig, GENERIC_EVENT_CONFIG } from './generic'

export { SAILING_EVENT_CONFIG } from './sailing'
export { NURSING_EVENT_CONFIG } from './nursing'
export { DRAWING_EVENT_CONFIG } from './drawing'
export { DESIGN_EVENT_CONFIG } from './design'
export { FITNESS_EVENT_CONFIG } from './fitness'
export { KNITTING_EVENT_CONFIG } from './knitting'
export { FIBER_ARTS_EVENT_CONFIG } from './fiber-arts'
export { PAINTING_PRINTING_EVENT_CONFIG } from './painting-printing'
export { LIFELONG_LEARNING_EVENT_CONFIG } from './lifelong-learning'
export { REGENERATIVE_AGRICULTURE_EVENT_CONFIG } from './regenerative-agriculture'
export { GLOBAL_HEALTH_EVENT_CONFIG } from './global-health'
export { SELF_MASTERY_EVENT_CONFIG } from './self-mastery'
export { GENERIC_EVENT_CONFIG, makeGenericEventConfig } from './generic'

/**
 * Lookup map: interest slug → event config.
 * Used by useInterestEventConfig() to resolve the active config.
 */
export const INTEREST_EVENT_CONFIGS: Record<string, InterestEventConfig> = {
  'sail-racing': SAILING_EVENT_CONFIG,
  nursing: NURSING_EVENT_CONFIG,
  drawing: DRAWING_EVENT_CONFIG,
  design: DESIGN_EVENT_CONFIG,
  fitness: FITNESS_EVENT_CONFIG,
  'health-and-fitness': FITNESS_EVENT_CONFIG,
  knitting: KNITTING_EVENT_CONFIG,
  'fiber-arts': FIBER_ARTS_EVENT_CONFIG,
  'painting-printing': PAINTING_PRINTING_EVENT_CONFIG,
  'lifelong-learning': LIFELONG_LEARNING_EVENT_CONFIG,
  'regenerative-agriculture': REGENERATIVE_AGRICULTURE_EVENT_CONFIG,
  'global-health': GLOBAL_HEALTH_EVENT_CONFIG,
  'self-mastery': SELF_MASTERY_EVENT_CONFIG,
  'lac-craft-business': makeGenericEventConfig('lac-craft-business', 'Activity', { teamNoun: 'Self-Help Group' }),
  'food-processing': makeGenericEventConfig('food-processing', 'Activity', { teamNoun: 'Self-Help Group' }),
  'textile-weaving': makeGenericEventConfig('textile-weaving', 'Activity', { teamNoun: 'Self-Help Group' }),
  golf: makeGenericEventConfig('golf', 'Round', { teamNoun: 'Group' }),
}

/**
 * Get the event config for an interest slug.
 * Falls back to a generic config (not sailing) for unknown interests.
 */
export function getInterestEventConfig(slug: string): InterestEventConfig {
  return INTEREST_EVENT_CONFIGS[slug] ?? GENERIC_EVENT_CONFIG
}
