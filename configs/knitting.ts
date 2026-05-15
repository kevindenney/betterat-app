/**
 * Knitting Interest Event Configuration
 *
 * Defines the knitting-specific constants as a single InterestEventConfig
 * that drives the event card experience for the knitting interest.
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const KNITTING_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'knitting',

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
  addEventLabel: 'Add Session',
  eventNoun: 'Session',
  teamNoun: 'Circle',
  catalogRoute: '/(tabs)/learn',
  catalogSubtitle: 'Browse knitting workshops and techniques',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'knitting_session',
      label: 'Knitting Session',
      icon: 'cut',
      description: 'Standard knitting session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'project', type: 'text', label: 'Project', placeholder: 'What are you knitting?' },
        {
          id: 'yarn_weight',
          type: 'select',
          label: 'Yarn Weight',
          options: [
            { value: 'lace', label: 'Lace' },
            { value: 'fingering', label: 'Fingering' },
            { value: 'sport', label: 'Sport' },
            { value: 'dk', label: 'DK' },
            { value: 'worsted', label: 'Worsted' },
            { value: 'aran', label: 'Aran' },
            { value: 'bulky', label: 'Bulky' },
            { value: 'super_bulky', label: 'Super Bulky' },
          ],
        },
        {
          id: 'needle_size',
          type: 'text',
          label: 'Needle Size',
          placeholder: 'e.g., US 7 / 4.5mm',
        },
        {
          id: 'technique_focus',
          type: 'text',
          label: 'Technique Focus',
          placeholder: 'e.g., cables, colorwork...',
        },
      ],
    },
    {
      id: 'swatch',
      label: 'Gauge Swatch',
      icon: 'grid',
      description: 'Gauge swatch',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'yarn', type: 'text', label: 'Yarn', placeholder: 'Yarn name and fiber content' },
        {
          id: 'needle_size',
          type: 'text',
          label: 'Needle Size',
          placeholder: 'e.g., US 7 / 4.5mm',
        },
        {
          id: 'stitch_pattern',
          type: 'text',
          label: 'Stitch Pattern',
          placeholder: 'e.g., stockinette, ribbing...',
        },
        {
          id: 'gauge_result',
          type: 'text',
          label: 'Gauge Result',
          placeholder: 'e.g., 20 sts x 28 rows = 4 in',
        },
      ],
    },
    {
      id: 'technique_practice',
      label: 'Technique Practice',
      icon: 'fitness',
      description: 'Focused technique practice',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'technique',
          type: 'text',
          label: 'Technique',
          placeholder: 'e.g., kitchener stitch, short rows...',
        },
        {
          id: 'repetitions',
          type: 'number',
          label: 'Repetitions',
          placeholder: 'Number of repetitions',
        },
      ],
    },
    {
      id: 'pattern_work',
      label: 'Pattern Work',
      icon: 'document-text',
      description: 'Pattern following session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'pattern_name',
          type: 'text',
          label: 'Pattern Name',
          placeholder: 'Name of the pattern',
        },
        {
          id: 'section',
          type: 'text',
          label: 'Section',
          placeholder: 'e.g., sleeve, yoke, body...',
        },
        {
          id: 'row_count',
          type: 'number',
          label: 'Row Count',
          placeholder: 'Number of rows completed',
        },
      ],
    },
    {
      id: 'knit_along',
      label: 'Knit-Along',
      icon: 'people',
      description: 'Group KAL session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'time', type: 'time', label: 'Time' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Yarn shop, cafe...' },
        {
          id: 'pattern_name',
          type: 'text',
          label: 'Pattern Name',
          placeholder: 'KAL pattern name',
        },
        {
          id: 'group_name',
          type: 'text',
          label: 'Group Name',
          placeholder: 'Knitting circle or group name',
        },
      ],
    },
    {
      id: 'finishing_session',
      label: 'Finishing Session',
      icon: 'checkmark-circle',
      description: 'Blocking, seaming, and finishing',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'project', type: 'text', label: 'Project', placeholder: 'Project being finished' },
        {
          id: 'finishing_type',
          type: 'select',
          label: 'Finishing Type',
          options: [
            { value: 'blocking', label: 'Blocking' },
            { value: 'seaming', label: 'Seaming' },
            { value: 'weaving_ends', label: 'Weaving Ends' },
            { value: 'buttons', label: 'Buttons' },
            { value: 'zipper', label: 'Zipper' },
          ],
        },
      ],
    },
  ],

  defaultSubtype: 'knitting_session',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    pattern_notes: {
      id: 'pattern_notes',
      label: 'Pattern Notes',
      shortLabel: 'Pattern',
      icon: 'document-text',
      description: 'Pattern annotations and modifications',
    },
    yarn_info: {
      id: 'yarn_info',
      label: 'Yarn Info',
      shortLabel: 'Yarn',
      icon: 'color-palette',
      description: 'Yarn details, colorway, and dye lot',
    },
    gauge_swatch: {
      id: 'gauge_swatch',
      label: 'Gauge Swatch',
      shortLabel: 'Gauge',
      icon: 'grid',
      description: 'Gauge measurements and swatch notes',
    },
    stitch_pattern: {
      id: 'stitch_pattern',
      label: 'Stitch Pattern',
      shortLabel: 'Stitch',
      icon: 'apps',
      description: 'Stitch pattern charts and instructions',
    },
    progress_photos: {
      id: 'progress_photos',
      label: 'Progress Photos',
      shortLabel: 'Photos',
      icon: 'camera',
      description: 'Photos of work in progress and finished pieces',
    },
    measurement_check: {
      id: 'measurement_check',
      label: 'Measurement Check',
      shortLabel: 'Measure',
      icon: 'resize',
      description: 'Project measurements against pattern specs',
    },
    instructor_feedback: {
      id: 'instructor_feedback',
      label: 'Instructor Feedback',
      shortLabel: 'Feedback',
      icon: 'message-text',
      description: 'Teacher or mentor feedback notes',
    },
    checklist: {
      id: 'checklist',
      label: 'Session Checklist',
      shortLabel: 'Tasks',
      icon: 'checkbox-marked-outline',
      description: 'Materials and supplies ready',
    },
    materials: {
      id: 'materials',
      label: 'Materials',
      shortLabel: 'Materials',
      icon: 'construct',
      description: 'Yarn, needles, and notions selected',
    },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    pattern_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    yarn_info: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    gauge_swatch: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    stitch_pattern: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    progress_photos: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    measurement_check: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    instructor_feedback: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    checklist: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    materials: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
  },

  // ---------------------------------------------------------------------------
  // Phase -> module configuration
  // ---------------------------------------------------------------------------
  phaseModuleConfig: {
    days_before: {
      phase: 'days_before',
      availableModules: [
        'pattern_notes',
        'yarn_info',
        'gauge_swatch',
        'stitch_pattern',
        'materials',
        'checklist',
      ],
      defaultModules: ['pattern_notes', 'yarn_info', 'gauge_swatch', 'materials'],
      maxModules: 6,
    },
    on_water: {
      phase: 'on_water',
      availableModules: ['pattern_notes', 'stitch_pattern', 'progress_photos'],
      defaultModules: ['pattern_notes', 'stitch_pattern'],
      maxModules: 3,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'progress_photos',
        'measurement_check',
        'instructor_feedback',
        'pattern_notes',
      ],
      defaultModules: ['progress_photos', 'measurement_check'],
      maxModules: 4,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    knitting_session: {
      subtypeId: 'knitting_session',
    },
    swatch: {
      subtypeId: 'swatch',
      excludedModules: ['checklist', 'progress_photos'],
      phaseDefaultOverrides: {
        days_before: ['yarn_info', 'gauge_swatch', 'materials'],
      },
    },
    technique_practice: {
      subtypeId: 'technique_practice',
      excludedModules: ['gauge_swatch', 'measurement_check'],
    },
    pattern_work: {
      subtypeId: 'pattern_work',
      additionalModules: ['stitch_pattern'],
      labelOverrides: {
        pattern_notes: 'Pattern Instructions',
      },
    },
    knit_along: {
      subtypeId: 'knit_along',
      excludedModules: ['checklist', 'gauge_swatch'],
    },
    finishing_session: {
      subtypeId: 'finishing_session',
      excludedModules: ['gauge_swatch', 'stitch_pattern'],
      labelOverrides: {
        progress_photos: 'Finished Project Photos',
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
      description: 'High-level session performance summary',
    },
    {
      id: 'tension_consistency',
      label: 'Tension Consistency',
      description: 'Evenness and consistency of stitch tension',
    },
    {
      id: 'pattern_accuracy',
      label: 'Pattern Accuracy',
      description: 'Accuracy following pattern instructions and stitch counts',
    },
    {
      id: 'construction_quality',
      label: 'Construction Quality',
      description: 'Garment shaping, seaming, and structural integrity',
    },
    {
      id: 'finishing_quality',
      label: 'Finishing Quality',
      description: 'Blocking, weaving ends, and finishing details',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Specific areas for improvement and next steps',
    },
    {
      id: 'plan_vs_execution',
      label: 'Plan vs Execution',
      description: 'Comparison of session plan to actual knitting decisions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'tension_evenness',
      label: 'Tension Evenness',
      description: 'Consistency and evenness of stitch tension throughout the work',
    },
    {
      id: 'gauge_accuracy',
      label: 'Gauge Accuracy',
      description: 'Ability to achieve and maintain target gauge',
    },
    {
      id: 'pattern_fidelity',
      label: 'Pattern Fidelity',
      description: 'Accuracy in following pattern instructions and stitch counts',
    },
    {
      id: 'construction',
      label: 'Construction',
      description: 'Garment shaping, joining, and structural techniques',
    },
    {
      id: 'finishing',
      label: 'Finishing',
      description: 'Quality of blocking, seaming, and finishing details',
    },
    {
      id: 'overall_growth',
      label: 'Overall Growth',
      description: 'Composite score across all knitting dimensions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Debrief phases
  // ---------------------------------------------------------------------------
  debriefPhases: [
    {
      id: 'setup',
      title: 'Materials & Setup',
      emoji: '\uD83E\uDDF6',
      description: 'How was your workspace and materials?',
      questions: [
        {
          id: 'setup_workspace',
          type: 'select',
          label: 'How was your workspace setup?',
          options: [
            { value: 'perfect', label: 'Perfect \u2014 everything ready' },
            { value: 'good', label: 'Good \u2014 minor adjustments' },
            { value: 'okay', label: 'Okay \u2014 some issues' },
            { value: 'problematic', label: 'Problematic \u2014 need better setup' },
          ],
        },
        {
          id: 'setup_yarn_needles',
          type: 'boolean',
          label: 'Were your yarn and needles working well together?',
        },
        {
          id: 'setup_yarn_issue',
          type: 'text',
          label: 'What yarn/needle issues did you have?',
          showWhen: { questionId: 'setup_yarn_needles', answerIn: ['false'] },
        },
      ],
    },
    {
      id: 'tension',
      title: 'Tension & Gauge',
      emoji: '\uD83D\uDCCF',
      description: 'Consistency and gauge accuracy',
      questions: [
        {
          id: 'tension_consistency',
          type: 'select',
          label: 'How was your tension consistency?',
          options: [
            { value: 'even', label: 'Even \u2014 consistent throughout' },
            { value: 'mostly', label: 'Mostly even \u2014 minor variations' },
            { value: 'uneven', label: 'Uneven \u2014 noticeable changes' },
            { value: 'struggled', label: 'Struggled \u2014 need more practice' },
          ],
        },
        {
          id: 'tension_gauge',
          type: 'select',
          label: 'How was your gauge accuracy?',
          options: [
            { value: 'on_gauge', label: 'On gauge \u2014 matches pattern' },
            { value: 'close', label: 'Close \u2014 minor difference' },
            { value: 'off', label: 'Off gauge \u2014 needs adjustment' },
            { value: 'not_checked', label: "Didn't check gauge" },
          ],
        },
      ],
    },
    {
      id: 'technique',
      title: 'Technique Execution',
      emoji: '\uD83E\uDDF6',
      description: 'How was your technique today?',
      questions: [
        {
          id: 'tech_pattern',
          type: 'select',
          label: 'How well did you follow the pattern?',
          options: [
            { value: 'perfectly', label: 'Perfectly \u2014 no mistakes' },
            { value: 'mostly', label: 'Mostly \u2014 caught and fixed errors' },
            { value: 'some_errors', label: 'Some errors \u2014 had to tink/frog' },
            { value: 'struggled', label: 'Struggled \u2014 pattern was confusing' },
          ],
        },
        {
          id: 'tech_execution',
          type: 'select',
          label: 'How was your technique execution?',
          options: [
            { value: 'excellent', label: 'Excellent \u2014 noticeable improvement' },
            { value: 'good', label: 'Good \u2014 solid practice' },
            { value: 'fair', label: 'Fair \u2014 some progress' },
            { value: 'struggling', label: 'Struggling \u2014 need more study' },
          ],
        },
      ],
    },
    {
      id: 'progress',
      title: 'Project Progress',
      emoji: '\uD83D\uDCCA',
      description: 'How much did you accomplish?',
      questions: [
        {
          id: 'progress_rows',
          type: 'number',
          label: 'How many rows did you complete?',
          placeholder: 'Number of rows',
        },
        {
          id: 'progress_mistakes',
          type: 'boolean',
          label: 'Did you encounter any mistakes that needed fixing?',
        },
        {
          id: 'progress_mistake_detail',
          type: 'textarea',
          label: 'What mistakes did you fix and how?',
          showWhen: { questionId: 'progress_mistakes', answerIn: ['true'] },
        },
      ],
    },
    {
      id: 'overall',
      title: 'Overall Assessment',
      emoji: '\uD83D\uDCDD',
      description: 'Looking back at this session',
      questions: [
        {
          id: 'overall_feeling',
          type: 'select',
          label: 'How do you feel about this session?',
          options: [
            { value: 'very_satisfied', label: 'Very satisfied \u2014 proud of the work' },
            { value: 'satisfied', label: 'Satisfied \u2014 good progress' },
            { value: 'neutral', label: 'Neutral \u2014 some wins some losses' },
            { value: 'unsatisfied', label: 'Unsatisfied \u2014 frustrating session' },
            { value: 'learning', label: 'Learning moment \u2014 valuable insights' },
          ],
        },
        {
          id: 'overall_strongest',
          type: 'textarea',
          label: 'What was the strongest element?',
          placeholder: 'The part of the session you are most proud of...',
        },
        {
          id: 'overall_change',
          type: 'textarea',
          label: 'What would you change if you could redo it?',
          placeholder: 'Yarn choice, needle size, technique approach...',
        },
        {
          id: 'overall_key_learning',
          type: 'textarea',
          label: 'Key learning from this session?',
          placeholder: 'One thing to remember...',
        },
      ],
    },
  ],

  // ---------------------------------------------------------------------------
  // Drill / practice categories
  // ---------------------------------------------------------------------------
  drillCategories: [
    { id: 'casting_on', label: 'Casting On', icon: 'play' },
    { id: 'stitch_patterns', label: 'Stitch Patterns', icon: 'apps' },
    { id: 'colorwork', label: 'Colorwork', icon: 'color-palette' },
    { id: 'shaping', label: 'Shaping', icon: 'resize' },
    { id: 'finishing', label: 'Finishing', icon: 'check-all' },
    { id: 'fixing_mistakes', label: 'Fixing Mistakes', icon: 'build' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'tension-control', label: 'Tension Control' },
    { id: 'pattern-reading', label: 'Pattern Reading' },
    { id: 'garment-construction', label: 'Garment Construction' },
    { id: 'colorwork', label: 'Colorwork' },
    { id: 'lace', label: 'Lace' },
    { id: 'cables', label: 'Cables' },
  ],

  // ---------------------------------------------------------------------------
  // Evidence capture
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'progress_photo',
      label: 'Progress Photo',
      icon: 'camera',
      type: 'photo',
      description: 'Photos of work in progress and finished pieces',
    },
    secondaryCapture: [
      {
        id: 'stitch_count',
        label: 'Stitch Count',
        icon: 'calculator',
        type: 'text',
        description: 'Current stitch and row counts',
      },
      {
        id: 'project_measurements',
        label: 'Project Measurements',
        icon: 'resize',
        type: 'text',
        description: 'Width, length, and gauge measurements',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Reflect tab configuration
  // ---------------------------------------------------------------------------
  reflectConfig: {
    segments: [
      { value: 'progress', label: 'Progress' },
      { value: 'session_log', label: 'Project Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Sessions',
      hoursLabel: 'Knitting Hours',
      skillsLabel: 'Techniques',
      streakLabel: 'Knitting Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your knitting',
      primaryLegend: 'Session',
      secondaryLegend: 'Practice',
      eventVerb: 'knitted',
      stat1Label: 'Sessions',
      stat2Label: 'Projects',
      stat3Label: 'In Circle',
      stat4Label: 'Skill Score',
      comparisonNoun: 'sessions',
      performanceSubtitle: 'Your technique progress over time',
      performanceEmpty: 'Complete some sessions to see your progress trend',
      emptyIcon: 'cut-outline',
    },
  },

  // ---------------------------------------------------------------------------
  // Tile sections (visual grouping for config-driven rendering)
  // ---------------------------------------------------------------------------
  tileSections: {
    days_before: [
      {
        id: 'session-planning',
        label: 'Session Planning',
        subtitle: 'Prepare your materials and pattern',
        moduleIds: ['pattern_notes', 'yarn_info', 'gauge_swatch', 'materials'],
      },
    ],
    on_water: [
      {
        id: 'in-session',
        label: 'In Session',
        subtitle: 'Active knitting tools',
        moduleIds: ['pattern_notes', 'stitch_pattern', 'progress_photos'],
      },
    ],
    after_race: [
      {
        id: 'session-review',
        label: 'Session Review',
        subtitle: 'Documentation and feedback',
        moduleIds: [
          'progress_photos',
          'measurement_check',
          'instructor_feedback',
          'pattern_notes',
        ],
      },
    ],
  },
}
