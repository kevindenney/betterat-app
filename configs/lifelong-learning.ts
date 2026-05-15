/**
 * Lifelong Learning Interest Event Configuration
 *
 * Defines the lifelong-learning-specific constants as a single InterestEventConfig
 * that drives the event card experience for the lifelong learning interest.
 *
 * Anchor org: Hollyhock (Cortes Island, BC)
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const LIFELONG_LEARNING_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'lifelong-learning',

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
  teamNoun: 'Cohort',
  catalogRoute: '/(tabs)/learn',
  catalogSubtitle: 'Browse programs, retreats, and learning experiences',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'retreat_session',
      label: 'Retreat Session',
      icon: 'home',
      description: 'Workshop block within a multi-day retreat',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'retreat_name', type: 'text', label: 'Retreat Name', placeholder: 'Name of the retreat' },
        {
          id: 'session_type',
          type: 'select',
          label: 'Session Type',
          options: [
            { value: 'morning', label: 'Morning Session' },
            { value: 'afternoon', label: 'Afternoon Session' },
            { value: 'evening', label: 'Evening Session' },
            { value: 'full_day', label: 'Full Day' },
          ],
        },
        { id: 'facilitator', type: 'text', label: 'Facilitator', placeholder: 'Session facilitator' },
      ],
    },
    {
      id: 'meditation_sit',
      label: 'Meditation Sit',
      icon: 'leaf',
      description: 'Contemplative practice (vipassana, zen, yoga nidra, etc.)',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'tradition',
          type: 'select',
          label: 'Tradition',
          options: [
            { value: 'vipassana', label: 'Vipassana' },
            { value: 'zen', label: 'Zen' },
            { value: 'yoga_nidra', label: 'Yoga Nidra' },
            { value: 'loving_kindness', label: 'Loving Kindness' },
            { value: 'mindfulness', label: 'Mindfulness' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'guidance', type: 'text', label: 'Guidance', placeholder: 'Guided or self-directed' },
      ],
    },
    {
      id: 'creative_workshop',
      label: 'Creative Workshop',
      icon: 'color-palette',
      description: 'Creative expression (watercolour, writing, weaving, singing, dance, photography)',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'medium',
          type: 'select',
          label: 'Medium',
          options: [
            { value: 'watercolour', label: 'Watercolour' },
            { value: 'writing', label: 'Writing' },
            { value: 'weaving', label: 'Weaving' },
            { value: 'singing', label: 'Singing' },
            { value: 'dance', label: 'Dance' },
            { value: 'photography', label: 'Photography' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'instructor', type: 'text', label: 'Instructor', placeholder: 'Workshop instructor' },
      ],
    },
    {
      id: 'movement_practice',
      label: 'Movement Practice',
      icon: 'body',
      description: 'Yoga, dance, tai chi, qi gong',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'modality',
          type: 'select',
          label: 'Modality',
          options: [
            { value: 'yoga', label: 'Yoga' },
            { value: 'dance', label: 'Dance' },
            { value: 'tai_chi', label: 'Tai Chi' },
            { value: 'qi_gong', label: 'Qi Gong' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'level', type: 'text', label: 'Level', placeholder: 'e.g., beginner, intermediate...' },
      ],
    },
    {
      id: 'group_dialogue',
      label: 'Group Dialogue',
      icon: 'people',
      description: 'Facilitation, council, circle work',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'format',
          type: 'select',
          label: 'Format',
          options: [
            { value: 'council', label: 'Council' },
            { value: 'circle', label: 'Circle' },
            { value: 'open_space', label: 'Open Space' },
            { value: 'world_cafe', label: 'World Cafe' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'topic', type: 'text', label: 'Topic', placeholder: 'Discussion topic or theme' },
      ],
    },
    {
      id: 'nature_immersion',
      label: 'Nature Immersion',
      icon: 'leaf',
      description: 'Garden work, forest bathing, foraging',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'activity',
          type: 'select',
          label: 'Activity',
          options: [
            { value: 'garden_work', label: 'Garden Work' },
            { value: 'forest_bathing', label: 'Forest Bathing' },
            { value: 'foraging', label: 'Foraging' },
            { value: 'nature_walk', label: 'Nature Walk' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Where in nature' },
      ],
    },
  ],

  defaultSubtype: 'retreat_session',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    intention_setting: {
      id: 'intention_setting',
      label: 'Intention Setting',
      shortLabel: 'Intention',
      icon: 'compass',
      description: 'Set your intention for this session or retreat',
    },
    facilitator_notes: {
      id: 'facilitator_notes',
      label: 'Facilitator Notes',
      shortLabel: 'Facilitator',
      icon: 'person',
      description: 'Notes from or about the facilitator',
    },
    reflection_journal: {
      id: 'reflection_journal',
      label: 'Reflection Journal',
      shortLabel: 'Reflect',
      icon: 'book',
      description: 'Personal reflections and insights',
    },
    reading_materials: {
      id: 'reading_materials',
      label: 'Reading Materials',
      shortLabel: 'Reading',
      icon: 'document-text',
      description: 'Recommended readings and resources',
    },
    body_awareness: {
      id: 'body_awareness',
      label: 'Body Awareness',
      shortLabel: 'Body',
      icon: 'body',
      description: 'Somatic awareness and body scan notes',
    },
    creative_output: {
      id: 'creative_output',
      label: 'Creative Output',
      shortLabel: 'Creative',
      icon: 'color-palette',
      description: 'Photos or notes on creative work produced',
    },
    community_notes: {
      id: 'community_notes',
      label: 'Community Notes',
      shortLabel: 'Community',
      icon: 'people',
      description: 'Connections, conversations, and community insights',
    },
    checklist: {
      id: 'checklist',
      label: 'Session Checklist',
      shortLabel: 'Tasks',
      icon: 'checkbox-marked-outline',
      description: 'Preparation and packing checklist',
    },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    intention_setting: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    facilitator_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    reflection_journal: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    reading_materials: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    body_awareness: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    creative_output: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    community_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    checklist: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
  },

  // ---------------------------------------------------------------------------
  // Phase -> module configuration
  // ---------------------------------------------------------------------------
  phaseModuleConfig: {
    days_before: {
      phase: 'days_before',
      availableModules: [
        'intention_setting',
        'reading_materials',
        'body_awareness',
        'checklist',
      ],
      defaultModules: ['intention_setting', 'reading_materials', 'checklist'],
      maxModules: 4,
    },
    on_water: {
      phase: 'on_water',
      availableModules: ['facilitator_notes', 'body_awareness', 'creative_output', 'community_notes'],
      defaultModules: ['facilitator_notes', 'body_awareness'],
      maxModules: 4,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'reflection_journal',
        'creative_output',
        'community_notes',
        'facilitator_notes',
      ],
      defaultModules: ['reflection_journal', 'community_notes'],
      maxModules: 4,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    retreat_session: {
      subtypeId: 'retreat_session',
    },
    meditation_sit: {
      subtypeId: 'meditation_sit',
      excludedModules: ['creative_output', 'reading_materials'],
      phaseDefaultOverrides: {
        on_water: ['body_awareness'],
      },
    },
    creative_workshop: {
      subtypeId: 'creative_workshop',
      additionalModules: ['creative_output'],
      labelOverrides: {
        creative_output: 'Workshop Output',
      },
    },
    movement_practice: {
      subtypeId: 'movement_practice',
      excludedModules: ['reading_materials', 'creative_output'],
      phaseDefaultOverrides: {
        on_water: ['body_awareness', 'facilitator_notes'],
      },
    },
    group_dialogue: {
      subtypeId: 'group_dialogue',
      excludedModules: ['creative_output', 'body_awareness'],
      phaseDefaultOverrides: {
        on_water: ['community_notes', 'facilitator_notes'],
      },
    },
    nature_immersion: {
      subtypeId: 'nature_immersion',
      excludedModules: ['reading_materials'],
      labelOverrides: {
        body_awareness: 'Nature Awareness',
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
      description: 'High-level session experience summary',
    },
    {
      id: 'presence_depth',
      label: 'Presence & Depth',
      description: 'Quality of attention and engagement during the session',
    },
    {
      id: 'creative_expression',
      label: 'Creative Expression',
      description: 'Creative output and artistic exploration',
    },
    {
      id: 'community_connection',
      label: 'Community Connection',
      description: 'Relationships and community engagement',
    },
    {
      id: 'integration',
      label: 'Integration',
      description: 'How insights are being integrated into daily life',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Suggested next practices and programs',
    },
    {
      id: 'plan_vs_execution',
      label: 'Intention vs Experience',
      description: 'Comparison of session intention to actual experience',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'mindfulness_depth',
      label: 'Mindfulness Depth',
      description: 'Depth and consistency of contemplative practice',
    },
    {
      id: 'creative_expression',
      label: 'Creative Expression',
      description: 'Range and authenticity of creative output',
    },
    {
      id: 'facilitation',
      label: 'Facilitation',
      description: 'Ability to hold space and guide group processes',
    },
    {
      id: 'somatic_awareness',
      label: 'Somatic Awareness',
      description: 'Body awareness and embodied learning',
    },
    {
      id: 'reflective_practice',
      label: 'Reflective Practice',
      description: 'Quality and depth of self-reflection and journaling',
    },
    {
      id: 'overall_growth',
      label: 'Overall Growth',
      description: 'Composite score across all learning dimensions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Debrief phases
  // ---------------------------------------------------------------------------
  debriefPhases: [
    {
      id: 'arrival',
      title: 'Arrival & Setting',
      emoji: '\uD83C\uDF3F',
      description: 'How was your arrival and the environment?',
      questions: [
        {
          id: 'arrival_space',
          type: 'select',
          label: 'How was the space and environment?',
          options: [
            { value: 'perfect', label: 'Perfect \u2014 nourishing and supportive' },
            { value: 'good', label: 'Good \u2014 mostly comfortable' },
            { value: 'okay', label: 'Okay \u2014 some distractions' },
            { value: 'difficult', label: 'Difficult \u2014 hard to settle in' },
          ],
        },
        {
          id: 'arrival_readiness',
          type: 'boolean',
          label: 'Did you feel ready and prepared for the session?',
        },
        {
          id: 'arrival_barrier',
          type: 'text',
          label: 'What got in the way of settling in?',
          showWhen: { questionId: 'arrival_readiness', answerIn: ['false'] },
        },
      ],
    },
    {
      id: 'engagement',
      title: 'Engagement & Presence',
      emoji: '\uD83E\uDDD8',
      description: 'Quality of attention and participation',
      questions: [
        {
          id: 'engagement_presence',
          type: 'select',
          label: 'How present were you during the session?',
          options: [
            { value: 'deeply', label: 'Deeply present \u2014 fully absorbed' },
            { value: 'mostly', label: 'Mostly present \u2014 occasional wandering' },
            { value: 'intermittent', label: 'Intermittent \u2014 in and out' },
            { value: 'distracted', label: 'Distracted \u2014 hard to focus' },
          ],
        },
        {
          id: 'engagement_moment',
          type: 'textarea',
          label: 'What was the most meaningful moment?',
          placeholder: 'A moment that stood out...',
        },
      ],
    },
    {
      id: 'connection',
      title: 'Connection & Community',
      emoji: '\uD83E\uDD1D',
      description: 'Relationships and group dynamics',
      questions: [
        {
          id: 'connection_quality',
          type: 'select',
          label: 'How was the group connection?',
          options: [
            { value: 'deep', label: 'Deep \u2014 meaningful exchanges' },
            { value: 'warm', label: 'Warm \u2014 friendly and open' },
            { value: 'surface', label: 'Surface \u2014 polite but shallow' },
            { value: 'solo', label: 'Solo \u2014 mostly internal work' },
          ],
        },
        {
          id: 'connection_insight',
          type: 'textarea',
          label: 'Any insight from others that stayed with you?',
          placeholder: 'Something someone said or did...',
        },
      ],
    },
    {
      id: 'integration',
      title: 'Integration',
      emoji: '\uD83C\uDF31',
      description: 'What will you carry forward?',
      questions: [
        {
          id: 'integration_takeaway',
          type: 'textarea',
          label: 'What is your key takeaway?',
          placeholder: 'The one thing you want to remember...',
        },
        {
          id: 'integration_practice',
          type: 'textarea',
          label: 'What practice will you continue at home?',
          placeholder: 'A daily or weekly commitment...',
        },
      ],
    },
    {
      id: 'overall',
      title: 'Overall',
      emoji: '\uD83D\uDCDD',
      description: 'Looking back at this session',
      questions: [
        {
          id: 'overall_feeling',
          type: 'select',
          label: 'How do you feel about this session?',
          options: [
            { value: 'transformed', label: 'Transformed \u2014 a shift happened' },
            { value: 'nourished', label: 'Nourished \u2014 fed my soul' },
            { value: 'neutral', label: 'Neutral \u2014 some value, some not' },
            { value: 'unsatisfied', label: 'Unsatisfied \u2014 didn\u2019t land' },
            { value: 'learning', label: 'Learning moment \u2014 valuable insights' },
          ],
        },
        {
          id: 'overall_strongest',
          type: 'textarea',
          label: 'What was the strongest element?',
          placeholder: 'The part you are most grateful for...',
        },
        {
          id: 'overall_change',
          type: 'textarea',
          label: 'What would you change?',
          placeholder: 'Timing, format, content...',
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
    { id: 'meditation', label: 'Meditation', icon: 'leaf' },
    { id: 'movement', label: 'Movement', icon: 'body' },
    { id: 'creative', label: 'Creative Expression', icon: 'color-palette' },
    { id: 'dialogue', label: 'Dialogue & Facilitation', icon: 'people' },
    { id: 'nature', label: 'Nature Connection', icon: 'leaf' },
    { id: 'journaling', label: 'Journaling', icon: 'book' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'mindfulness-depth', label: 'Mindfulness Depth' },
    { id: 'creative-expression', label: 'Creative Expression' },
    { id: 'facilitation', label: 'Facilitation' },
    { id: 'somatic-awareness', label: 'Somatic Awareness' },
    { id: 'reflective-practice', label: 'Reflective Practice' },
    { id: 'community-building', label: 'Community Building' },
  ],

  // ---------------------------------------------------------------------------
  // Evidence capture
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'journal_entry',
      label: 'Journal Entry',
      icon: 'book',
      type: 'text',
      description: 'Reflection or insight from the session',
    },
    secondaryCapture: [
      {
        id: 'creative_photo',
        label: 'Creative Output Photo',
        icon: 'camera',
        type: 'photo',
        description: 'Photo of creative work produced during the session',
      },
      {
        id: 'reading_note',
        label: 'Reading Note',
        icon: 'document-text',
        type: 'text',
        description: 'Key passage or insight from reading materials',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Reflect tab configuration
  // ---------------------------------------------------------------------------
  reflectConfig: {
    segments: [
      { value: 'progress', label: 'Progress' },
      { value: 'session_log', label: 'Learning Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Sessions',
      hoursLabel: 'Practice Hours',
      skillsLabel: 'Practices',
      streakLabel: 'Learning Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your learning journey',
      primaryLegend: 'Session',
      secondaryLegend: 'Practice',
      eventVerb: 'attended',
      stat1Label: 'Sessions',
      stat2Label: 'Programs',
      stat3Label: 'In Cohort',
      stat4Label: 'Growth Score',
      comparisonNoun: 'sessions',
      performanceSubtitle: 'Your learning depth over time',
      performanceEmpty: 'Complete some sessions to see your progress trend',
      emptyIcon: 'leaf-outline',
    },
  },

  // ---------------------------------------------------------------------------
  // Tile sections (visual grouping for config-driven rendering)
  // ---------------------------------------------------------------------------
  tileSections: {
    days_before: [],
    on_water: [
      {
        id: 'in-session',
        label: 'In Session',
        subtitle: 'Active session tools',
        moduleIds: ['facilitator_notes', 'body_awareness', 'creative_output', 'community_notes'],
      },
    ],
    after_race: [
      {
        id: 'session-review',
        label: 'Integration & Reflection',
        subtitle: 'Journaling and community notes',
        moduleIds: [
          'reflection_journal',
          'creative_output',
          'community_notes',
          'facilitator_notes',
        ],
      },
    ],
  },
}
