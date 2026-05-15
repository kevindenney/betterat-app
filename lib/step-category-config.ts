/**
 * Step Category Config — per-category labels, placeholders, and AI guidance.
 *
 * When a step has a category (e.g. 'nutrition', 'strength'), this config
 * drives the UI labels, placeholder text, tab names, and AI system prompt
 * customization so the experience feels tailored.
 */

export interface StepCategoryLabels {
  /** Badge text shown at top of step card (e.g. "NUTRITION", "STRENGTH") */
  badge: string;
  /** Tab labels [plan, act, review] */
  tabs: { plan: string; act: string; review: string };
  /** Plan question titles */
  questions: {
    what: string;
    how: string;
    why: string;
    who: string;
    where: string;
  };
  /** Plan question placeholder text */
  placeholders: {
    what: string;
    why: string;
    where: string;
    subStep: string;
  };
  /** AI system prompt injection — tells the AI what kind of step this is */
  aiGuidance: string;
  /** Section header in the Act/Draw phase */
  actHeader: string;
  /** Section description */
  planHeader: string;
  planSubheader: string;
  /** Refinement chat input placeholder */
  refinementPlaceholder: string;
}

const DEFAULT_LABELS: StepCategoryLabels = {
  badge: 'STEP',
  tabs: { plan: 'Plan', act: 'Do', review: 'Reflect' },
  questions: {
    what: 'What will you do?',
    how: 'How will you do it?',
    why: 'Why is this next?',
    who: 'Who will you do this with?',
    where: 'Where will you do this?',
  },
  placeholders: {
    what: "Describe what you'll focus on...",
    why: 'What makes this the right next step?',
    where: 'Location, venue, or address...',
    subStep: 'Add sub-step',
  },
  aiGuidance: '',
  actHeader: 'EVIDENCE',
  planHeader: 'STEP PLANNING',
  planSubheader: 'Define what, how, and why',
  refinementPlaceholder: 'Add a detail, adjust the plan...',
};

const NUTRITION_LABELS: StepCategoryLabels = {
  badge: 'NUTRITION',
  tabs: { plan: 'Plan', act: 'Do', review: 'Reflect' },
  questions: {
    what: "What's your nutrition plan?",
    how: 'What meals will you prepare?',
    why: 'What nutrition goals does this support?',
    who: 'Who are you cooking or eating with?',
    where: 'Where will you eat or prep?',
  },
  placeholders: {
    what: 'What meals are you planning? Any macro or calorie targets?',
    why: 'e.g. Hit 150g protein, fuel for leg day, meal prep for the week...',
    where: 'Kitchen, restaurant, meal prep service...',
    subStep: 'Add a meal or food item',
  },
  aiGuidance: 'This is a NUTRITION-focused step. Help the user plan meals, track macros, and hit nutrition targets. Ask about specific foods, portions, and timing relative to workouts. Do not discuss exercise programming.',
  actHeader: 'MEAL LOG',
  planHeader: 'NUTRITION PLANNING',
  planSubheader: 'Plan meals, set targets, and prep',
  refinementPlaceholder: 'Add a meal, swap an ingredient, adjust macros...',
};

const STRENGTH_LABELS: StepCategoryLabels = {
  badge: 'STRENGTH',
  tabs: { plan: 'Plan', act: 'Do', review: 'Reflect' },
  questions: {
    what: 'What will you train?',
    how: 'What exercises will you do?',
    why: 'Why this workout next?',
    who: 'Who will you train with?',
    where: 'Where will you train?',
  },
  placeholders: {
    what: 'e.g. Upper push day — bench, OHP, triceps...',
    why: 'e.g. Progressive overload on bench, deload week...',
    where: 'Gym name or location...',
    subStep: 'Add an exercise',
  },
  aiGuidance: 'This is a STRENGTH training step. Help the user plan sets, reps, weight selections, and rest periods. Reference their recent PRs and progressive overload patterns.',
  actHeader: 'TRAINING LOG',
  planHeader: 'WORKOUT PLANNING',
  planSubheader: 'Plan exercises, sets, and targets',
  refinementPlaceholder: 'Add a warmup, swap an exercise, adjust...',
};

const CARDIO_LABELS: StepCategoryLabels = {
  badge: 'CARDIO',
  tabs: { plan: 'Plan', act: 'Do', review: 'Reflect' },
  questions: {
    what: 'What cardio will you do?',
    how: 'What is your route or plan?',
    why: 'Why this session?',
    who: 'Who will you run/ride with?',
    where: 'Where will you go?',
  },
  placeholders: {
    what: 'e.g. 5K easy run, 30 min spin, trail hike...',
    why: 'e.g. Base building, active recovery, race prep...',
    where: 'Trail, park, gym, route...',
    subStep: 'Add a segment or interval',
  },
  aiGuidance: 'This is a CARDIO session. Help the user plan distance, pace, duration, and route. Reference their recent cardio history.',
  actHeader: 'SESSION LOG',
  planHeader: 'CARDIO PLANNING',
  planSubheader: 'Plan distance, pace, and route',
  refinementPlaceholder: 'Add a segment, adjust pace, change route...',
};

const HIIT_LABELS: StepCategoryLabels = {
  badge: 'HIIT',
  tabs: { plan: 'Plan', act: 'Do', review: 'Reflect' },
  questions: {
    what: 'What HIIT workout will you do?',
    how: 'What intervals will you use?',
    why: 'Why this intensity?',
    who: 'Who will you train with?',
    where: 'Where will you train?',
  },
  placeholders: {
    what: 'e.g. Tabata circuits, EMOM, 30/30 intervals...',
    why: 'e.g. Improve VO2 max, fat loss, conditioning...',
    where: 'Gym, park, home...',
    subStep: 'Add a round or exercise',
  },
  aiGuidance: 'This is a HIIT training step. Help plan work/rest intervals, round counts, and exercise selection.',
  actHeader: 'INTERVAL LOG',
  planHeader: 'HIIT PLANNING',
  planSubheader: 'Plan intervals, rounds, and intensity',
  refinementPlaceholder: 'Add a round, swap an exercise, adjust intervals...',
};

const SPORT_LABELS: StepCategoryLabels = {
  badge: 'SPORT',
  tabs: { plan: 'Plan', act: 'Do', review: 'Reflect' },
  questions: {
    what: 'What will you practice or play?',
    how: 'What drills or activities?',
    why: 'What skills are you building?',
    who: 'Who will you play with?',
    where: 'Where will you play?',
  },
  placeholders: {
    what: 'e.g. Basketball shooting drills, soccer scrimmage...',
    why: 'e.g. Improve footwork, game preparation...',
    where: 'Court, field, gym...',
    subStep: 'Add a drill or activity',
  },
  aiGuidance: 'This is a sport-specific training step. Help plan drills, skill work, and game preparation.',
  actHeader: 'SESSION LOG',
  planHeader: 'SPORT PLANNING',
  planSubheader: 'Plan drills, skills, and gameplay',
  refinementPlaceholder: 'Add a drill, swap an activity, adjust...',
};

const RACE_DAY_CHECK_LABELS: StepCategoryLabels = {
  badge: 'RACE DAY',
  tabs: { plan: 'Plan', act: 'Do', review: 'Reflect' },
  questions: {
    what: 'What needs to be checked?',
    how: 'What is your checklist?',
    why: 'What race is this for?',
    who: 'Who is on your crew?',
    where: 'Where is the race venue?',
  },
  placeholders: {
    what: 'e.g. Mast rake, shroud tension, sail inventory...',
    why: 'e.g. Moonraker race, Dragon Worlds qualifier, April 11th',
    where: 'Race venue or start area...',
    subStep: 'Add a check item',
  },
  aiGuidance: 'This is a race day preparation checklist for sailing. Help enumerate pre-race checks: rig tuning measurements, equipment, sail selection, logistics, and crew coordination. Reference any linked playbook resources for specific tuning values.',
  actHeader: 'CHECKLIST',
  planHeader: 'RACE DAY PREP',
  planSubheader: 'Rig checks, logistics, and crew tasks',
  refinementPlaceholder: 'Add a check item, rig setting, or note...',
};

const READING_LABELS: StepCategoryLabels = {
  badge: 'READING',
  tabs: { plan: 'Plan', act: 'Do', review: 'Reflect' },
  questions: {
    what: 'What will you read?',
    how: 'How will you approach this reading?',
    why: 'Why this book or article now?',
    who: 'Who recommended this or who will you discuss it with?',
    where: 'Where will you read?',
  },
  placeholders: {
    what: 'Book title, article, chapter, or newsletter...',
    why: 'e.g. Recommended by coach, relevant to current challenge, book club...',
    where: 'Coffee shop, commute, before bed...',
    subStep: 'Add a chapter or section',
  },
  aiGuidance:
    'This is a READING step. Help the user plan their reading: key themes to watch for, questions to hold while reading, and how to connect insights to their practice. Ask about specific chapters, takeaways, and application to their goals.',
  actHeader: 'READING LOG',
  planHeader: 'READING PLAN',
  planSubheader: 'Plan what to read and why it matters',
  refinementPlaceholder: 'Add a chapter, note a key idea, adjust focus...',
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const CATEGORY_CONFIGS: Record<string, StepCategoryLabels> = {
  nutrition: NUTRITION_LABELS,
  strength: STRENGTH_LABELS,
  cardio: CARDIO_LABELS,
  hiit: HIIT_LABELS,
  sport: SPORT_LABELS,
  race_day_check: RACE_DAY_CHECK_LABELS,
  reading: READING_LABELS,
  reading_study: READING_LABELS,
};

/**
 * Get step category labels for a given category.
 * Falls back to default labels for unknown categories.
 */
export function getStepCategoryLabels(category?: string): StepCategoryLabels {
  if (!category || category === 'general') return DEFAULT_LABELS;
  return CATEGORY_CONFIGS[category] ?? DEFAULT_LABELS;
}
