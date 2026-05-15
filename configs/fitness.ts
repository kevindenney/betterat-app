/**
 * Fitness Interest Event Configuration
 *
 * Defines all fitness-specific constants for the BetterAt platform,
 * driving the event card experience for the fitness interest.
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const FITNESS_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'health-and-fitness',

  // ---------------------------------------------------------------------------
  // Phase labels
  // ---------------------------------------------------------------------------
  phaseLabels: {
    days_before: { full: 'Plan', short: 'Plan' },
    on_water: { full: 'Do', short: 'Do' },
    after_race: { full: 'Reflect', short: 'Reflect' },
  },

  // ---------------------------------------------------------------------------
  // Event chrome
  // ---------------------------------------------------------------------------
  addEventLabel: 'Add Workout',
  eventNoun: 'Workout',
  teamNoun: 'Team',
  catalogRoute: '/(tabs)/learn',
  catalogSubtitle: 'Browse workout programs and plans',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'strength',
      label: 'Strength',
      icon: 'barbell',
      description: 'Strength training session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Gym name or location' },
        { id: 'program_name', type: 'text', label: 'Program Name', placeholder: 'e.g. Starting Strength, PPL' },
        {
          id: 'body_region',
          type: 'select',
          label: 'Body Region',
          options: [
            { value: 'upper_push', label: 'Upper Push' },
            { value: 'upper_pull', label: 'Upper Pull' },
            { value: 'lower', label: 'Lower' },
            { value: 'full_body', label: 'Full Body' },
            { value: 'arms', label: 'Arms' },
            { value: 'core', label: 'Core' },
          ],
        },
        {
          id: 'equipment',
          type: 'multi-select',
          label: 'Equipment',
          options: [
            { value: 'barbell', label: 'Barbell' },
            { value: 'dumbbells', label: 'Dumbbells' },
            { value: 'kettlebells', label: 'Kettlebells' },
            { value: 'cables', label: 'Cables' },
            { value: 'machines', label: 'Machines' },
            { value: 'bodyweight', label: 'Bodyweight' },
            { value: 'bands', label: 'Bands' },
          ],
        },
      ],
    },
    {
      id: 'cardio',
      label: 'Cardio',
      icon: 'bicycle',
      description: 'Cardio endurance session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Gym, park, trail, etc.' },
        {
          id: 'activity',
          type: 'select',
          label: 'Activity',
          options: [
            { value: 'running', label: 'Running' },
            { value: 'cycling', label: 'Cycling' },
            { value: 'swimming', label: 'Swimming' },
            { value: 'rowing', label: 'Rowing' },
            { value: 'elliptical', label: 'Elliptical' },
            { value: 'stairmaster', label: 'Stairmaster' },
            { value: 'hiking', label: 'Hiking' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'distance', type: 'text', label: 'Distance', placeholder: 'e.g. 5km, 3 miles' },
        { id: 'route_plan', type: 'text', label: 'Route Plan', placeholder: 'Route or course description' },
      ],
    },
    {
      id: 'hiit',
      label: 'HIIT',
      icon: 'flash',
      description: 'High intensity interval training',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Gym, park, home, etc.' },
        { id: 'interval_scheme', type: 'text', label: 'Interval Scheme', placeholder: 'e.g. 30s on / 30s off' },
        { id: 'rounds', type: 'number', label: 'Rounds' },
        {
          id: 'equipment',
          type: 'multi-select',
          label: 'Equipment',
          options: [
            { value: 'barbell', label: 'Barbell' },
            { value: 'dumbbells', label: 'Dumbbells' },
            { value: 'kettlebells', label: 'Kettlebells' },
            { value: 'cables', label: 'Cables' },
            { value: 'machines', label: 'Machines' },
            { value: 'bodyweight', label: 'Bodyweight' },
            { value: 'bands', label: 'Bands' },
          ],
        },
      ],
    },
    {
      id: 'sport',
      label: 'Sport',
      icon: 'football',
      description: 'Sport-specific training or competition',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'sport', type: 'text', label: 'Sport', placeholder: 'e.g. Basketball, Soccer, Tennis' },
        { id: 'drill_type', type: 'text', label: 'Drill Type', placeholder: 'e.g. Scrimmage, Skills, Conditioning' },
        { id: 'focus_area', type: 'text', label: 'Focus Area', placeholder: 'e.g. Footwork, Shooting, Defense' },
      ],
    },
    {
      id: 'nutrition',
      label: 'Nutrition',
      icon: 'nutrition',
      description: 'Meal planning and nutrition tracking',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        {
          id: 'meal_focus',
          type: 'select',
          label: 'Meal Focus',
          options: [
            { value: 'meal_prep', label: 'Meal Prep' },
            { value: 'daily_tracking', label: 'Daily Tracking' },
            { value: 'pre_workout', label: 'Pre-Workout Nutrition' },
            { value: 'post_workout', label: 'Post-Workout Recovery' },
          ],
        },
        { id: 'target_calories', type: 'number', label: 'Target Calories' },
        { id: 'notes', type: 'text', label: 'Notes', placeholder: 'Focus for today...' },
      ],
    },
  ],

  defaultSubtype: 'strength',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    workout_plan: {
      id: 'workout_plan',
      label: 'Workout Plan',
      shortLabel: 'Plan',
      icon: 'clipboard-text',
      description: 'Exercises sets reps and target weights',
    },
    warmup: {
      id: 'warmup',
      label: 'Warmup',
      shortLabel: 'Warmup',
      icon: 'flash',
      description: 'Warmup routine and mobility drills',
    },
    nutrition: {
      id: 'nutrition',
      label: 'Nutrition',
      shortLabel: 'Nutrition',
      icon: 'restaurant',
      description: 'Pre-workout nutrition and hydration',
    },
    goals: {
      id: 'goals',
      label: 'Session Goals',
      shortLabel: 'Goals',
      icon: 'ribbon',
      description: 'What to achieve today',
    },
    checklist: {
      id: 'checklist',
      label: 'Gear Checklist',
      shortLabel: 'Gear',
      icon: 'checkbox-marked-outline',
      description: 'Shoes belt wraps water towel',
    },
    previous_session: {
      id: 'previous_session',
      label: 'Previous Session',
      shortLabel: 'Previous',
      icon: 'time',
      description: 'Last session numbers for reference',
    },
    body_status: {
      id: 'body_status',
      label: 'Body Status',
      shortLabel: 'Body',
      icon: 'body',
      description: 'Energy soreness and sleep quality',
    },
    program_context: {
      id: 'program_context',
      label: 'Program Context',
      shortLabel: 'Program',
      icon: 'calendar',
      description: 'Where this fits in training block',
    },
    conditions: {
      id: 'conditions',
      label: 'Conditions',
      shortLabel: 'Conditions',
      icon: 'weather-partly-cloudy',
      description: 'Weather for outdoor or gym status',
    },
    share_with_coach: {
      id: 'share_with_coach',
      label: 'Share with Coach',
      shortLabel: 'Share',
      icon: 'share-variant',
      description: 'Share plan with trainer',
    },
    timer: {
      id: 'timer',
      label: 'Rest Timer',
      shortLabel: 'Timer',
      icon: 'timer',
      description: 'Set rest and interval timer',
    },
    results_preview: {
      id: 'results_preview',
      label: 'Session Results',
      shortLabel: 'Results',
      icon: 'podium',
      description: 'Actual vs planned weights reps and times',
    },
    learning_notes: {
      id: 'learning_notes',
      label: 'Session Notes',
      shortLabel: 'Notes',
      icon: 'lightbulb-outline',
      description: 'Form cues and technique adjustments',
    },
    recovery_status: {
      id: 'recovery_status',
      label: 'Recovery Status',
      shortLabel: 'Recovery',
      icon: 'heart-pulse',
      description: 'Post-workout RPE and soreness',
    },
    post_nutrition: {
      id: 'post_nutrition',
      label: 'Post-Workout Nutrition',
      shortLabel: 'Post-Nutrition',
      icon: 'restaurant',
      description: 'Recovery nutrition log',
    },
    program_adjustments: {
      id: 'program_adjustments',
      label: 'Program Adjustments',
      shortLabel: 'Adjust',
      icon: 'settings',
      description: 'Changes to upcoming programming',
    },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    workout_plan: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    warmup: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    nutrition: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    goals: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    checklist: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    previous_session: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    body_status: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    program_context: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    conditions: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    share_with_coach: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    timer: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    results_preview: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    learning_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    recovery_status: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    post_nutrition: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    program_adjustments: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
  },

  // ---------------------------------------------------------------------------
  // Phase -> module configuration
  // ---------------------------------------------------------------------------
  phaseModuleConfig: {
    days_before: {
      phase: 'days_before',
      availableModules: [
        'workout_plan',
        'warmup',
        'nutrition',
        'goals',
        'checklist',
        'previous_session',
        'body_status',
        'program_context',
        'conditions',
        'share_with_coach',
      ],
      defaultModules: [
        'workout_plan',
        'warmup',
        'nutrition',
        'goals',
        'checklist',
      ],
      maxModules: 6,
    },
    on_water: {
      phase: 'on_water',
      availableModules: [
        'workout_plan',
        'timer',
        'body_status',
        'goals',
        'warmup',
      ],
      defaultModules: ['workout_plan', 'timer'],
      maxModules: 3,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'results_preview',
        'learning_notes',
        'workout_plan',
        'body_status',
        'post_nutrition',
        'goals',
        'program_adjustments',
      ],
      defaultModules: ['results_preview', 'learning_notes'],
      maxModules: 4,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    strength: {
      subtypeId: 'strength',
    },
    cardio: {
      subtypeId: 'cardio',
      excludedModules: ['previous_session'],
      labelOverrides: {
        workout_plan: 'Cardio Plan',
      },
    },
    hiit: {
      subtypeId: 'hiit',
      labelOverrides: {
        workout_plan: 'Interval Plan',
      },
    },
    sport: {
      subtypeId: 'sport',
      labelOverrides: {
        workout_plan: 'Game Plan',
      },
    },
    nutrition: {
      subtypeId: 'nutrition',
      excludedModules: ['workout_plan', 'warmup', 'timer', 'previous_session'],
      labelOverrides: {
        goals: 'Nutrition Goals',
        body_status: 'How You Feel',
        results_preview: 'Nutrition Log',
        learning_notes: 'Nutrition Notes',
      },
    },
  },

  // ---------------------------------------------------------------------------
  // AI analysis sections
  // ---------------------------------------------------------------------------
  aiAnalysisSections: [
    {
      id: 'overall_summary',
      label: 'Overall Summary',
      description: 'High-level workout performance summary',
    },
    {
      id: 'volume_analysis',
      label: 'Volume Analysis',
      description: 'Total sets, reps, and tonnage review',
    },
    {
      id: 'intensity_analysis',
      label: 'Intensity Analysis',
      description: 'Load selection and RPE assessment',
    },
    {
      id: 'form_analysis',
      label: 'Form Analysis',
      description: 'Movement quality and technique review',
    },
    {
      id: 'progressive_overload',
      label: 'Progressive Overload',
      description: 'Week-over-week progression tracking',
    },
    {
      id: 'recovery_readiness',
      label: 'Recovery Readiness',
      description: 'Recovery status and readiness assessment',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Specific areas for improvement and next steps',
    },
    {
      id: 'plan_vs_execution',
      label: 'Plan vs Execution',
      description: 'Comparison of planned workout to actual performance',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'volume_compliance',
      label: 'Volume Compliance',
      description: 'Adherence to planned sets and reps',
    },
    {
      id: 'intensity_accuracy',
      label: 'Intensity Accuracy',
      description: 'Hitting target weights and RPE zones',
    },
    {
      id: 'form_quality',
      label: 'Form Quality',
      description: 'Movement quality and technique consistency',
    },
    {
      id: 'progressive_overload',
      label: 'Progressive Overload',
      description: 'Consistent progression in load or volume over time',
    },
    {
      id: 'recovery_management',
      label: 'Recovery Management',
      description: 'Balancing training stress with adequate recovery',
    },
    {
      id: 'consistency',
      label: 'Consistency',
      description: 'Training frequency and schedule adherence',
    },
    {
      id: 'overall_fitness',
      label: 'Overall Fitness',
      description: 'Composite score across all fitness dimensions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Debrief phases
  // ---------------------------------------------------------------------------
  debriefPhases: [
    {
      id: 'preparation',
      title: 'Preparation',
      emoji: '\u2699\uFE0F',
      description: 'Pre-workout readiness',
      questions: [
        {
          id: 'prep_nutrition',
          type: 'select',
          label: 'Pre-workout nutrition',
          options: [
            { value: 'on_point', label: 'On point — well fueled' },
            { value: 'adequate', label: 'Adequate — could be better' },
            { value: 'poor', label: 'Poor — underfueled or wrong timing' },
            { value: 'skipped', label: 'Skipped — empty stomach' },
          ],
        },
        {
          id: 'prep_energy',
          type: 'select',
          label: 'Energy level',
          options: [
            { value: 'high', label: 'High energy — ready to go' },
            { value: 'normal', label: 'Normal energy' },
            { value: 'low', label: 'Low energy — tired' },
            { value: 'very_low', label: 'Very low — should have rested' },
          ],
        },
      ],
    },
    {
      id: 'warmup',
      title: 'Warmup',
      emoji: '\uD83D\uDD25',
      description: 'How was your warmup?',
      questions: [
        {
          id: 'warmup_completed',
          type: 'boolean',
          label: 'Did you complete your full warmup?',
        },
        {
          id: 'warmup_pain',
          type: 'boolean',
          label: 'Any pain or discomfort during warmup?',
        },
        {
          id: 'warmup_pain_detail',
          type: 'textarea',
          label: 'Where and what kind of pain?',
          placeholder: 'Describe the pain or discomfort',
          showWhen: {
            questionId: 'warmup_pain',
            answerIn: ['true'],
          },
        },
      ],
    },
    {
      id: 'main_session',
      title: 'Main Session',
      emoji: '\uD83D\uDCAA',
      description: 'The core workout',
      questions: [
        {
          id: 'session_completed',
          type: 'select',
          label: 'How much of the planned session did you complete?',
          options: [
            { value: '100', label: '100% — completed everything' },
            { value: '90', label: '90%+ — nearly all planned' },
            { value: '75', label: '75%+ — most of it' },
            { value: '50', label: '50%+ — about half' },
            { value: 'less_than_half', label: 'Less than half — had to cut short' },
          ],
        },
        {
          id: 'session_weights',
          type: 'select',
          label: 'How were your weights / targets?',
          options: [
            { value: 'hit_all', label: 'Hit all targets — strong day' },
            { value: 'close', label: 'Close to targets — within 5%' },
            { value: 'below', label: 'Below targets — not feeling it' },
            { value: 'above', label: 'Above targets — PR day!' },
            { value: 'na', label: 'N/A — cardio/bodyweight' },
          ],
        },
        {
          id: 'session_form',
          type: 'select',
          label: 'Movement form quality',
          options: [
            { value: 'excellent', label: 'Excellent — textbook form' },
            { value: 'good', label: 'Good — mostly solid' },
            { value: 'fair', label: 'Fair — some breakdown' },
            { value: 'poor', label: 'Poor — form suffered' },
          ],
        },
        {
          id: 'session_notes',
          type: 'textarea',
          label: 'Any specific exercise notes?',
          placeholder: 'Notes on specific exercises, sets, or reps',
        },
      ],
    },
    {
      id: 'intensity',
      title: 'Intensity',
      emoji: '\uD83D\uDD25',
      description: 'Effort and performance',
      questions: [
        {
          id: 'intensity_rpe',
          type: 'select',
          label: 'Overall session RPE',
          options: [
            { value: 'rpe_9_10', label: 'RPE 9-10 — max effort' },
            { value: 'rpe_7_8', label: 'RPE 7-8 — hard' },
            { value: 'rpe_5_6', label: 'RPE 5-6 — moderate' },
            { value: 'rpe_3_4', label: 'RPE 3-4 — easy' },
            { value: 'rpe_1_2', label: 'RPE 1-2 — very easy' },
          ],
        },
        {
          id: 'intensity_right',
          type: 'boolean',
          label: 'Was the intensity appropriate for today?',
        },
        {
          id: 'intensity_milestone',
          type: 'boolean',
          label: 'Any personal records or milestones?',
        },
        {
          id: 'intensity_milestone_detail',
          type: 'text',
          label: 'What milestone?',
          placeholder: 'Describe the PR or milestone',
          showWhen: {
            questionId: 'intensity_milestone',
            answerIn: ['true'],
          },
        },
      ],
    },
    {
      id: 'recovery',
      title: 'Recovery',
      emoji: '\uD83E\uDDCA',
      description: 'Post-workout and recovery',
      questions: [
        {
          id: 'recovery_cooldown',
          type: 'boolean',
          label: 'Did you do a proper cooldown/stretch?',
        },
        {
          id: 'recovery_soreness',
          type: 'select',
          label: 'Expected soreness',
          options: [
            { value: 'none', label: 'No soreness expected' },
            { value: 'mild', label: 'Mild — normal DOMS' },
            { value: 'moderate', label: 'Moderate — will feel it tomorrow' },
            { value: 'significant', label: 'Significant — might need extra rest' },
          ],
        },
        {
          id: 'recovery_injury_risk',
          type: 'boolean',
          label: 'Any injury concerns?',
        },
        {
          id: 'recovery_injury_detail',
          type: 'textarea',
          label: 'Describe the concern',
          placeholder: 'Describe the injury concern or discomfort',
          showWhen: {
            questionId: 'recovery_injury_risk',
            answerIn: ['true'],
          },
        },
      ],
    },
    {
      id: 'overall',
      title: 'Overall',
      emoji: '\uD83D\uDCDD',
      description: 'Looking back at this workout',
      questions: [
        {
          id: 'overall_feeling',
          type: 'select',
          label: 'How do you feel about this session?',
          options: [
            { value: 'crushed_it', label: 'Crushed it — great session' },
            { value: 'solid', label: 'Solid — good work' },
            { value: 'okay', label: 'Okay — average session' },
            { value: 'tough', label: 'Tough — grinded through' },
            { value: 'learning', label: 'Learning moment — valuable insights' },
          ],
        },
        {
          id: 'overall_what_worked',
          type: 'textarea',
          label: 'What worked well?',
          placeholder: 'What went right today?',
        },
        {
          id: 'overall_next_focus',
          type: 'textarea',
          label: 'What to focus on next session?',
          placeholder: 'Areas to improve or prioritize',
        },
        {
          id: 'overall_key_learning',
          type: 'textarea',
          label: 'Key takeaway from today?',
          placeholder: 'One thing to remember from this session',
        },
      ],
    },
  ],

  // ---------------------------------------------------------------------------
  // Drill / practice categories
  // ---------------------------------------------------------------------------
  drillCategories: [
    { id: 'compound_lifts', label: 'Compound Lifts', icon: 'barbell' },
    { id: 'olympic_lifts', label: 'Olympic Lifts', icon: 'flash' },
    { id: 'isolation', label: 'Isolation', icon: 'body' },
    { id: 'mobility', label: 'Mobility', icon: 'walk' },
    { id: 'cardio_endurance', label: 'Cardio Endurance', icon: 'bicycle' },
    { id: 'interval_training', label: 'Intervals', icon: 'timer' },
    { id: 'plyometrics', label: 'Plyometrics', icon: 'trending-up' },
    { id: 'core', label: 'Core', icon: 'fitness' },
    { id: 'sport_specific', label: 'Sport Specific', icon: 'football' },
    { id: 'recovery', label: 'Recovery', icon: 'heart-pulse' },
    { id: 'general', label: 'General', icon: 'dumbbell' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'squat-pattern', label: 'Squat Pattern' },
    { id: 'hinge-pattern', label: 'Hinge Pattern' },
    { id: 'push-pattern', label: 'Push Pattern' },
    { id: 'pull-pattern', label: 'Pull Pattern' },
    { id: 'carry-pattern', label: 'Carry Pattern' },
    { id: 'rotational-power', label: 'Rotational Power' },
    { id: 'cardio-endurance', label: 'Cardio Endurance' },
    { id: 'interval-capacity', label: 'Interval Capacity' },
    { id: 'mobility-flexibility', label: 'Mobility & Flexibility' },
    { id: 'movement-quality', label: 'Movement Quality' },
    { id: 'sport-technique', label: 'Sport Technique' },
  ],

  // ---------------------------------------------------------------------------
  // Evidence capture
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'health_data',
      label: 'Watch/Tracker Data',
      icon: 'watch',
      type: 'health_data',
      description: 'HR pace distance calories via HealthKit or Garmin',
    },
    secondaryCapture: [
      {
        id: 'workout_log',
        label: 'Workout Log',
        icon: 'clipboard-text',
        type: 'activity_log',
        description: 'Log of exercises sets reps and weights',
      },
      {
        id: 'form_check',
        label: 'Form Check Video',
        icon: 'video',
        type: 'video',
        description: 'Video for form review and technique check',
      },
      {
        id: 'photo',
        label: 'Photo',
        icon: 'camera',
        type: 'photo',
        description: 'Progress photos or gym setup',
      },
      {
        id: 'voice_memo',
        label: 'Voice Memo',
        icon: 'microphone',
        type: 'audio',
        description: 'Voice notes during or after workout',
      },
      {
        id: 'gps_outdoor',
        label: 'GPS for Outdoor',
        icon: 'map-marker',
        type: 'gps',
        description: 'GPS tracking for outdoor cardio sessions',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Reflect tab configuration
  // ---------------------------------------------------------------------------
  reflectConfig: {
    segments: [
      { value: 'progress', label: 'Progress' },
      { value: 'workout_log', label: 'Workout Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Workouts',
      hoursLabel: 'Training Hours',
      skillsLabel: 'Movements',
      streakLabel: 'Training Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your training',
      primaryLegend: 'Workout',
      secondaryLegend: 'Recovery',
      eventVerb: 'trained',
      stat1Label: 'Workouts',
      stat2Label: 'PRs',
      stat3Label: 'Training',
      stat4Label: 'Avg Intensity',
      comparisonNoun: 'workouts',
      performanceSubtitle: 'Your training intensity over time',
      performanceEmpty: 'Complete some workouts to see your progress trend',
      emptyIcon: 'barbell-outline',
    },
  },

  // ---------------------------------------------------------------------------
  // Tile sections (visual grouping for config-driven rendering)
  // ---------------------------------------------------------------------------
  tileSections: {
    days_before: [
      {
        id: 'training-plan',
        label: 'Training Plan',
        subtitle: 'Workout, warmup, and goals',
        moduleIds: ['workout_plan', 'warmup', 'goals'],
      },
      {
        id: 'readiness',
        label: 'Readiness',
        subtitle: 'Nutrition, body status, and history',
        moduleIds: ['nutrition', 'body_status', 'previous_session'],
      },
      {
        id: 'gear-context',
        label: 'Gear & Context',
        subtitle: 'Equipment and program context',
        moduleIds: ['checklist', 'conditions', 'program_context'],
      },
    ],
    on_water: [
      {
        id: 'active-training',
        label: 'Active Training',
        subtitle: 'Plan and timer',
        moduleIds: ['workout_plan', 'timer', 'body_status'],
      },
    ],
    after_race: [
      {
        id: 'workout-review',
        label: 'Workout Review',
        subtitle: 'Results, notes, and recovery',
        moduleIds: ['results_preview', 'learning_notes', 'recovery_status', 'post_nutrition'],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // AI measurement extraction
  // ---------------------------------------------------------------------------
  measurementConfig: {
    enabled: true,
    categories: ['exercise', 'health'],
    prTrackingEnabled: true,
    progressiveOverloadDetection: true,
  },

  // ---------------------------------------------------------------------------
  // Nutrition tracking
  // ---------------------------------------------------------------------------
  nutritionConfig: {
    enabled: true,
    targets: [
      { label: 'Calories', key: 'calories_daily', unit: 'cal' },
      { label: 'Protein', key: 'protein_daily_g', unit: 'g' },
      { label: 'Carbs', key: 'carbs_daily_g', unit: 'g' },
      { label: 'Fat', key: 'fat_daily_g', unit: 'g' },
    ],
    mealTypes: [
      { value: 'breakfast', label: 'Breakfast' },
      { value: 'lunch', label: 'Lunch' },
      { value: 'dinner', label: 'Dinner' },
      { value: 'snack', label: 'Snack' },
      { value: 'pre_workout', label: 'Pre-Workout' },
      { value: 'post_workout', label: 'Post-Workout' },
    ],
  },
}
