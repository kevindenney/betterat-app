/**
 * Fiber Arts Interest Event Configuration
 *
 * Defines the fiber-arts-specific constants as a single InterestEventConfig
 * that drives the event card experience for the fiber arts interest.
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const FIBER_ARTS_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'fiber-arts',

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
  teamNoun: 'Group',
  catalogRoute: '/(tabs)/learn',
  catalogSubtitle: 'Browse fiber arts programs and techniques',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'spinning_session',
      label: 'Spinning',
      icon: 'sync',
      description: 'Spinning session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'fiber_type',
          type: 'select',
          label: 'Fiber Type',
          options: [
            { value: 'merino', label: 'Merino' },
            { value: 'bfl', label: 'BFL' },
            { value: 'corriedale', label: 'Corriedale' },
            { value: 'alpaca', label: 'Alpaca' },
            { value: 'silk', label: 'Silk' },
            { value: 'blend', label: 'Blend' },
          ],
        },
        {
          id: 'drafting_method',
          type: 'select',
          label: 'Drafting Method',
          options: [
            { value: 'short_draw', label: 'Short Draw' },
            { value: 'long_draw', label: 'Long Draw' },
            { value: 'worsted', label: 'Worsted' },
            { value: 'woolen', label: 'Woolen' },
          ],
        },
        {
          id: 'wheel_or_spindle',
          type: 'select',
          label: 'Wheel or Spindle',
          options: [
            { value: 'wheel', label: 'Wheel' },
            { value: 'spindle', label: 'Spindle' },
            { value: 'e_spinner', label: 'E-Spinner' },
          ],
        },
      ],
    },
    {
      id: 'weaving_session',
      label: 'Weaving',
      icon: 'grid',
      description: 'Weaving session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'loom_type',
          type: 'select',
          label: 'Loom Type',
          options: [
            { value: 'floor_loom', label: 'Floor Loom' },
            { value: 'rigid_heddle', label: 'Rigid Heddle' },
            { value: 'tapestry', label: 'Tapestry' },
            { value: 'inkle', label: 'Inkle' },
            { value: 'backstrap', label: 'Backstrap' },
          ],
        },
        {
          id: 'project',
          type: 'text',
          label: 'Project',
          placeholder: 'What are you weaving?',
        },
        {
          id: 'pattern_structure',
          type: 'text',
          label: 'Pattern Structure',
          placeholder: 'e.g., plain weave, twill...',
        },
      ],
    },
    {
      id: 'dyeing_session',
      label: 'Dyeing',
      icon: 'color-fill',
      description: 'Dyeing session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'dye_type',
          type: 'select',
          label: 'Dye Type',
          options: [
            { value: 'acid', label: 'Acid' },
            { value: 'natural', label: 'Natural' },
            { value: 'fiber_reactive', label: 'Fiber Reactive' },
            { value: 'indigo', label: 'Indigo' },
          ],
        },
        {
          id: 'fiber_or_fabric',
          type: 'text',
          label: 'Fiber or Fabric',
          placeholder: 'What are you dyeing?',
        },
        {
          id: 'color_recipe',
          type: 'text',
          label: 'Color Recipe',
          placeholder: 'Dye ratios and process notes',
        },
      ],
    },
    {
      id: 'felting_session',
      label: 'Felting',
      icon: 'water',
      description: 'Felting session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'felting_type',
          type: 'select',
          label: 'Felting Type',
          options: [
            { value: 'wet', label: 'Wet' },
            { value: 'needle', label: 'Needle' },
            { value: 'nuno', label: 'Nuno' },
          ],
        },
        {
          id: 'fiber',
          type: 'text',
          label: 'Fiber',
          placeholder: 'What fiber are you using?',
        },
        {
          id: 'project',
          type: 'text',
          label: 'Project',
          placeholder: 'What are you felting?',
        },
      ],
    },
    {
      id: 'technique_practice',
      label: 'Practice',
      icon: 'fitness',
      description: 'Focused technique practice',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'technique',
          type: 'text',
          label: 'Technique',
          placeholder: 'e.g., long draw, plain weave...',
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
      id: 'critique_session',
      label: 'Critique',
      icon: 'chatbubbles',
      description: 'Group or instructor critique',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'time', type: 'time', label: 'Time' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Studio, classroom...' },
        { id: 'pieces_count', type: 'number', label: 'Pieces Count', placeholder: 'Number of pieces' },
        {
          id: 'instructor',
          type: 'text',
          label: 'Instructor',
          placeholder: 'Instructor or facilitator name',
        },
      ],
    },
  ],

  defaultSubtype: 'spinning_session',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    fiber_prep: {
      id: 'fiber_prep',
      label: 'Fiber Preparation',
      shortLabel: 'Fiber Prep',
      icon: 'cut',
      description: 'Fiber washing carding and combing preparation',
    },
    draft_plan: {
      id: 'draft_plan',
      label: 'Draft Plan',
      shortLabel: 'Draft',
      icon: 'document-text',
      description: 'Drafting plan and technique approach',
    },
    color_recipe: {
      id: 'color_recipe',
      label: 'Color Recipe',
      shortLabel: 'Color',
      icon: 'color-palette',
      description: 'Dye formulas ratios and color planning',
    },
    warp_plan: {
      id: 'warp_plan',
      label: 'Warp Plan',
      shortLabel: 'Warp',
      icon: 'grid',
      description: 'Warp threading and tie-up planning',
    },
    progress_photos: {
      id: 'progress_photos',
      label: 'Progress Photos',
      shortLabel: 'Photos',
      icon: 'camera',
      description: 'Before during and after photos',
    },
    sample_notes: {
      id: 'sample_notes',
      label: 'Sample Notes',
      shortLabel: 'Samples',
      icon: 'document-text',
      description: 'Notes on samples swatches and test pieces',
    },
    instructor_feedback: {
      id: 'instructor_feedback',
      label: 'Instructor Feedback',
      shortLabel: 'Feedback',
      icon: 'message-text',
      description: 'Teacher or peer critique notes',
    },
    checklist: {
      id: 'checklist',
      label: 'Session Checklist',
      shortLabel: 'Tasks',
      icon: 'checkbox-marked-outline',
      description: 'Equipment materials and workspace ready',
    },
    materials: {
      id: 'materials',
      label: 'Materials',
      shortLabel: 'Materials',
      icon: 'construct',
      description: 'Fibers tools and equipment selected',
    },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    fiber_prep: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    draft_plan: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    color_recipe: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    warp_plan: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    progress_photos: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    sample_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
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
        'fiber_prep',
        'draft_plan',
        'color_recipe',
        'warp_plan',
        'materials',
        'checklist',
      ],
      defaultModules: [
        'fiber_prep',
        'draft_plan',
        'materials',
        'checklist',
      ],
      maxModules: 6,
    },
    on_water: {
      phase: 'on_water',
      availableModules: [
        'draft_plan',
        'color_recipe',
        'progress_photos',
      ],
      defaultModules: ['draft_plan', 'progress_photos'],
      maxModules: 3,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'progress_photos',
        'sample_notes',
        'instructor_feedback',
      ],
      defaultModules: ['progress_photos', 'sample_notes'],
      maxModules: 3,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    spinning_session: {
      subtypeId: 'spinning_session',
    },
    weaving_session: {
      subtypeId: 'weaving_session',
      additionalModules: ['warp_plan'],
    },
    dyeing_session: {
      subtypeId: 'dyeing_session',
      additionalModules: ['color_recipe'],
      excludedModules: ['warp_plan'],
    },
    felting_session: {
      subtypeId: 'felting_session',
      excludedModules: ['warp_plan', 'color_recipe'],
    },
    technique_practice: {
      subtypeId: 'technique_practice',
      excludedModules: ['warp_plan', 'color_recipe'],
    },
    critique_session: {
      subtypeId: 'critique_session',
      excludedModules: ['materials', 'checklist', 'warp_plan'],
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
      id: 'fiber_preparation',
      label: 'Fiber Preparation',
      description: 'Assessment of fiber selection washing and preparation',
    },
    {
      id: 'technique_execution',
      label: 'Technique Execution',
      description: 'Drafting spinning weaving or felting technique review',
    },
    {
      id: 'color_design',
      label: 'Color & Design',
      description: 'Color choices dye application and design assessment',
    },
    {
      id: 'consistency',
      label: 'Consistency',
      description: 'Evenness tension and uniformity evaluation',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Specific areas for improvement and next steps',
    },
    {
      id: 'plan_vs_execution',
      label: 'Plan vs Execution',
      description: 'Comparison of session plan to actual fiber arts decisions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'drafting_consistency',
      label: 'Drafting Consistency',
      description: 'Evenness and control of fiber drafting technique',
    },
    {
      id: 'yarn_evenness',
      label: 'Yarn Evenness',
      description: 'Uniformity of thickness twist and texture in spun yarn',
    },
    {
      id: 'color_accuracy',
      label: 'Color Accuracy',
      description: 'Precision in achieving intended colors and dye results',
    },
    {
      id: 'structural_integrity',
      label: 'Structural Integrity',
      description: 'Strength balance and durability of woven or felted fabric',
    },
    {
      id: 'finishing',
      label: 'Finishing',
      description: 'Quality of washing blocking and final finishing steps',
    },
    {
      id: 'overall_growth',
      label: 'Overall Growth',
      description: 'Composite score across all fiber arts dimensions',
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
      description: 'How were your materials and workspace?',
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
          id: 'setup_materials',
          type: 'boolean',
          label: 'Were your materials well prepared?',
        },
        {
          id: 'setup_material_issue',
          type: 'text',
          label: 'What material issues did you have?',
          showWhen: { questionId: 'setup_materials', answerIn: ['false'] },
        },
      ],
    },
    {
      id: 'technique',
      title: 'Technique Execution',
      emoji: '\uD83E\uDDF5',
      description: 'How was your technique today?',
      questions: [
        {
          id: 'tech_target',
          type: 'select',
          label: 'How was your technique execution?',
          options: [
            { value: 'excellent', label: 'Excellent \u2014 noticeable improvement' },
            { value: 'good', label: 'Good \u2014 solid practice' },
            { value: 'fair', label: 'Fair \u2014 some progress' },
            { value: 'struggling', label: 'Struggling \u2014 need more study' },
          ],
        },
        {
          id: 'tech_discoveries',
          type: 'boolean',
          label: 'Any technique discoveries or breakthroughs?',
        },
        {
          id: 'tech_discovery_detail',
          type: 'textarea',
          label: 'What did you discover?',
          showWhen: { questionId: 'tech_discoveries', answerIn: ['true'] },
        },
      ],
    },
    {
      id: 'fiber_quality',
      title: 'Fiber & Material Quality',
      emoji: '\uD83D\uDC11',
      description: 'How did the fiber and materials perform?',
      questions: [
        {
          id: 'fiber_behavior',
          type: 'select',
          label: 'How did the fiber behave?',
          options: [
            { value: 'excellent', label: 'Excellent \u2014 worked beautifully' },
            { value: 'good', label: 'Good \u2014 as expected' },
            { value: 'challenging', label: 'Challenging \u2014 needed adjustments' },
            { value: 'difficult', label: 'Difficult \u2014 not suited to technique' },
          ],
        },
        {
          id: 'fiber_prep_quality',
          type: 'select',
          label: 'How was the fiber preparation?',
          options: [
            { value: 'thorough', label: 'Thorough \u2014 well prepared' },
            { value: 'adequate', label: 'Adequate \u2014 could be better' },
            { value: 'minimal', label: 'Minimal \u2014 affected results' },
            { value: 'skipped', label: 'Skipped \u2014 went straight to work' },
          ],
        },
        {
          id: 'fiber_notes',
          type: 'textarea',
          label: 'Notes on fiber and materials',
          placeholder: 'Observations about the fiber, tools, or equipment...',
        },
      ],
    },
    {
      id: 'design',
      title: 'Design & Color',
      emoji: '\uD83C\uDFA8',
      description: 'How were your design and color choices?',
      questions: [
        {
          id: 'design_outcome',
          type: 'select',
          label: 'How did the design turn out?',
          options: [
            { value: 'exceeded', label: 'Exceeded expectations' },
            { value: 'matched', label: 'Matched my plan' },
            { value: 'close', label: 'Close \u2014 minor differences' },
            { value: 'different', label: 'Different \u2014 went another direction' },
          ],
        },
        {
          id: 'color_accuracy',
          type: 'select',
          label: 'How accurate were the colors?',
          options: [
            { value: 'spot_on', label: 'Spot on \u2014 exactly as planned' },
            { value: 'close', label: 'Close \u2014 minor variations' },
            { value: 'off', label: 'Off \u2014 noticeable differences' },
            { value: 'na', label: 'N/A \u2014 not color-focused' },
          ],
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
          placeholder: 'The part of the work you are most proud of...',
        },
        {
          id: 'overall_change',
          type: 'textarea',
          label: 'What would you change if you could redo it?',
          placeholder: 'Decisions, techniques, approach...',
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
    { id: 'fiber_preparation', label: 'Fiber Preparation', icon: 'cut' },
    { id: 'drafting', label: 'Drafting', icon: 'swap-horizontal' },
    { id: 'warping', label: 'Warping', icon: 'grid' },
    { id: 'pattern_drafting', label: 'Pattern Drafting', icon: 'document-text' },
    { id: 'color_theory', label: 'Color Theory', icon: 'color-palette' },
    { id: 'finishing', label: 'Finishing', icon: 'check-all' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'spinning', label: 'Spinning' },
    { id: 'weaving', label: 'Weaving' },
    { id: 'dyeing', label: 'Dyeing' },
    { id: 'felting', label: 'Felting' },
    { id: 'fiber-identification', label: 'Fiber Identification' },
    { id: 'equipment-maintenance', label: 'Equipment Maintenance' },
  ],

  // ---------------------------------------------------------------------------
  // Evidence capture
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'progress_photo',
      label: 'Progress Photos',
      icon: 'camera',
      type: 'photo',
      description: 'Camera captures at beginning, midpoint, and completion',
    },
    secondaryCapture: [
      {
        id: 'sample_swatch',
        label: 'Sample Swatch',
        icon: 'image',
        type: 'photo',
        description: 'Photo of sample swatches and test pieces',
      },
      {
        id: 'process_notes',
        label: 'Process Notes',
        icon: 'document-text',
        type: 'text',
        description: 'Written observations and notes during the session',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Reflect tab configuration
  // ---------------------------------------------------------------------------
  reflectConfig: {
    segments: [
      { value: 'progress', label: 'Progress' },
      { value: 'project_log', label: 'Project Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Sessions',
      hoursLabel: 'Studio Hours',
      skillsLabel: 'Techniques',
      streakLabel: 'Studio Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your fiber arts',
      primaryLegend: 'Session',
      secondaryLegend: 'Practice',
      eventVerb: 'practiced',
      stat1Label: 'Sessions',
      stat2Label: 'Projects',
      stat3Label: 'In Studio',
      stat4Label: 'Critique Score',
      comparisonNoun: 'sessions',
      performanceSubtitle: 'Your technique progress over time',
      performanceEmpty: 'Complete some sessions to see your progress trend',
      emptyIcon: 'color-wand-outline',
    },
  },

  // ---------------------------------------------------------------------------
  // Tile sections (visual grouping for config-driven rendering)
  // ---------------------------------------------------------------------------
  tileSections: {
    days_before: [],
    on_water: [
      {
        id: 'in-studio',
        label: 'In Studio',
        subtitle: 'Active fiber arts tools',
        moduleIds: ['draft_plan', 'color_recipe', 'progress_photos'],
      },
    ],
    after_race: [
      {
        id: 'session-review',
        label: 'Session Review',
        subtitle: 'Documentation and feedback',
        moduleIds: ['progress_photos', 'sample_notes', 'instructor_feedback'],
      },
    ],
  },
}
