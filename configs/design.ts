/**
 * Design Interest Event Configuration
 *
 * Defines the design-specific constants as a single InterestEventConfig
 * that drives the event card experience for the design interest.
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const DESIGN_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'design',

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
  addEventLabel: 'Add Project',
  eventNoun: 'Project',
  teamNoun: 'Team',
  catalogRoute: '/(tabs)/learn',
  catalogSubtitle: 'Browse design courses and resources',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'design_project',
      label: 'Design Project',
      icon: 'color-palette',
      description: 'Standard design project',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'brief', type: 'text', label: 'Brief', placeholder: 'What is the design brief?' },
        {
          id: 'discipline',
          type: 'select',
          label: 'Discipline',
          options: [
            { value: 'graphic', label: 'Graphic Design' },
            { value: 'ui_ux', label: 'UI/UX Design' },
            { value: 'branding', label: 'Branding' },
            { value: 'typography', label: 'Typography' },
            { value: 'illustration', label: 'Illustration' },
            { value: 'motion', label: 'Motion Design' },
            { value: 'product', label: 'Product Design' },
            { value: 'print', label: 'Print Design' },
          ],
        },
        {
          id: 'tools',
          type: 'select',
          label: 'Tools',
          options: [
            { value: 'figma', label: 'Figma' },
            { value: 'sketch', label: 'Sketch' },
            { value: 'illustrator', label: 'Illustrator' },
            { value: 'photoshop', label: 'Photoshop' },
            { value: 'indesign', label: 'InDesign' },
            { value: 'after_effects', label: 'After Effects' },
            { value: 'procreate', label: 'Procreate' },
            { value: 'pen_paper', label: 'Pen & Paper' },
          ],
        },
      ],
    },
    {
      id: 'design_study',
      label: 'Design Study',
      icon: 'flash',
      description: 'Quick focused study',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration', placeholder: '15-60 min' },
        { id: 'subject', type: 'text', label: 'Subject', placeholder: 'What are you studying?' },
        {
          id: 'study_type',
          type: 'select',
          label: 'Study Type',
          options: [
            { value: 'layout', label: 'Layout' },
            { value: 'color', label: 'Color Theory' },
            { value: 'typography', label: 'Typography' },
            { value: 'composition', label: 'Composition' },
            { value: 'trend_research', label: 'Trend Research' },
          ],
        },
      ],
    },
    {
      id: 'critique_session',
      label: 'Critique Session',
      icon: 'chatbubbles',
      description: 'Group or mentor critique',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'time', type: 'time', label: 'Time' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Studio, classroom...' },
        { id: 'pieces_count', type: 'number', label: 'Pieces Count', placeholder: 'Number of pieces' },
        {
          id: 'critique_group',
          type: 'text',
          label: 'Critique Group',
          placeholder: 'Group name or class',
        },
      ],
    },
    {
      id: 'portfolio_piece',
      label: 'Portfolio Piece',
      icon: 'image',
      description: 'Finished work for portfolio',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'title', type: 'text', label: 'Title', placeholder: 'Title of the piece' },
        {
          id: 'discipline',
          type: 'select',
          label: 'Discipline',
          options: [
            { value: 'graphic', label: 'Graphic Design' },
            { value: 'ui_ux', label: 'UI/UX Design' },
            { value: 'branding', label: 'Branding' },
            { value: 'typography', label: 'Typography' },
            { value: 'illustration', label: 'Illustration' },
            { value: 'motion', label: 'Motion Design' },
            { value: 'product', label: 'Product Design' },
          ],
        },
        { id: 'description', type: 'text', label: 'Description', placeholder: 'Brief description' },
      ],
    },
  ],

  defaultSubtype: 'design_project',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    reference_images: {
      id: 'reference_images',
      label: 'References',
      shortLabel: 'Refs',
      icon: 'images',
      description: 'Mood board and design inspiration',
    },
    composition: {
      id: 'composition',
      label: 'Layout',
      shortLabel: 'Layout',
      icon: 'grid',
      description: 'Wireframes and layout planning',
    },
    technique_focus: {
      id: 'technique_focus',
      label: 'Design Focus',
      shortLabel: 'Focus',
      icon: 'color-wand',
      description: 'Specific design technique to practice',
    },
    materials: {
      id: 'materials',
      label: 'Tools & Assets',
      shortLabel: 'Tools',
      icon: 'construct',
      description: 'Software, fonts, and assets selected',
    },
    checklist: {
      id: 'checklist',
      label: 'Project Checklist',
      shortLabel: 'Tasks',
      icon: 'checkbox-marked-outline',
      description: 'Files, assets, and deliverables ready',
    },
    color_study: {
      id: 'color_study',
      label: 'Color Palette',
      shortLabel: 'Color',
      icon: 'color-palette',
      description: 'Color palette planning and swatches',
    },
    timer: {
      id: 'timer',
      label: 'Session Timer',
      shortLabel: 'Timer',
      icon: 'stopwatch',
      description: 'Pomodoro or timed session tracker',
    },
    progress_photos: {
      id: 'progress_photos',
      label: 'Progress Screenshots',
      shortLabel: 'Screenshots',
      icon: 'camera',
      description: 'Before, during, and after screenshots',
    },
    learning_notes: {
      id: 'learning_notes',
      label: 'Design Notes',
      shortLabel: 'Notes',
      icon: 'lightbulb-outline',
      description: 'What worked and what to try differently',
    },
    instructor_feedback: {
      id: 'instructor_feedback',
      label: 'Mentor Feedback',
      shortLabel: 'Feedback',
      icon: 'message-text',
      description: 'Mentor or peer critique notes',
    },
    portfolio_tag: {
      id: 'portfolio_tag',
      label: 'Portfolio Tag',
      shortLabel: 'Portfolio',
      icon: 'bookmark',
      description: 'Tag finished work for portfolio',
    },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    reference_images: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    composition: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    technique_focus: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    materials: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    checklist: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    color_study: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    timer: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    progress_photos: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    learning_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    instructor_feedback: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    portfolio_tag: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
  },

  // ---------------------------------------------------------------------------
  // Phase -> module configuration
  // ---------------------------------------------------------------------------
  phaseModuleConfig: {
    days_before: {
      phase: 'days_before',
      availableModules: [
        'reference_images',
        'composition',
        'technique_focus',
        'materials',
        'checklist',
        'color_study',
      ],
      defaultModules: [
        'reference_images',
        'composition',
        'technique_focus',
        'materials',
        'checklist',
      ],
      maxModules: 6,
    },
    on_water: {
      phase: 'on_water',
      availableModules: [
        'reference_images',
        'technique_focus',
        'timer',
        'composition',
      ],
      defaultModules: ['reference_images', 'technique_focus'],
      maxModules: 3,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'progress_photos',
        'learning_notes',
        'technique_focus',
        'reference_images',
        'instructor_feedback',
        'portfolio_tag',
      ],
      defaultModules: ['progress_photos', 'learning_notes'],
      maxModules: 4,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    design_project: {
      subtypeId: 'design_project',
    },
    design_study: {
      subtypeId: 'design_study',
      excludedModules: ['portfolio_tag'],
      phaseDefaultOverrides: {
        days_before: ['reference_images', 'technique_focus', 'materials'],
      },
    },
    critique_session: {
      subtypeId: 'critique_session',
      excludedModules: ['timer', 'materials', 'checklist'],
    },
    portfolio_piece: {
      subtypeId: 'portfolio_piece',
      excludedModules: ['timer'],
      labelOverrides: {
        progress_photos: 'Final Documentation',
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
      description: 'High-level project performance summary',
    },
    {
      id: 'composition_analysis',
      label: 'Layout & Composition',
      description: 'Layout, hierarchy, and visual flow assessment',
    },
    {
      id: 'typography_assessment',
      label: 'Typography',
      description: 'Type choices, hierarchy, and readability',
    },
    {
      id: 'color_usage',
      label: 'Color Usage',
      description: 'Palette effectiveness, contrast, and harmony',
    },
    {
      id: 'visual_hierarchy',
      label: 'Visual Hierarchy',
      description: 'Information architecture and user flow',
    },
    {
      id: 'technique_execution',
      label: 'Technique Execution',
      description: 'Tool proficiency and technique application',
    },
    {
      id: 'creative_choices',
      label: 'Creative Choices',
      description: 'Artistic decisions, originality, and expression',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Specific areas for improvement and next steps',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'layout_composition',
      label: 'Layout & Composition',
      description: 'Effectiveness of layout, grid usage, and visual flow',
    },
    {
      id: 'typography',
      label: 'Typography',
      description: 'Type selection, hierarchy, spacing, and readability',
    },
    {
      id: 'color_theory',
      label: 'Color Theory',
      description: 'Palette choices, contrast, and color harmony',
    },
    {
      id: 'visual_hierarchy',
      label: 'Visual Hierarchy',
      description: 'Clear communication of information priority',
    },
    {
      id: 'tool_proficiency',
      label: 'Tool Proficiency',
      description: 'Skill and confidence with design tools',
    },
    {
      id: 'creativity',
      label: 'Creativity',
      description: 'Originality, expression, and problem-solving',
    },
    {
      id: 'overall_growth',
      label: 'Overall Growth',
      description: 'Composite score across all design dimensions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Debrief phases
  // ---------------------------------------------------------------------------
  debriefPhases: [
    {
      id: 'setup',
      title: 'Setup',
      emoji: '\uD83C\uDFA8',
      description: 'How was your workspace and tools?',
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
          id: 'setup_references',
          type: 'boolean',
          label: 'Did your references and mood board help?',
        },
      ],
    },
    {
      id: 'execution',
      title: 'Design Execution',
      emoji: '\u270F\uFE0F',
      description: 'How was your design process?',
      questions: [
        {
          id: 'exec_quality',
          type: 'select',
          label: 'How was your execution?',
          options: [
            { value: 'excellent', label: 'Excellent \u2014 noticeable improvement' },
            { value: 'good', label: 'Good \u2014 solid work' },
            { value: 'fair', label: 'Fair \u2014 some progress' },
            { value: 'struggling', label: 'Struggling \u2014 need more study' },
          ],
        },
        {
          id: 'exec_discoveries',
          type: 'boolean',
          label: 'Any technique discoveries or breakthroughs?',
        },
        {
          id: 'exec_discovery_detail',
          type: 'textarea',
          label: 'What did you discover?',
          showWhen: { questionId: 'exec_discoveries', answerIn: ['true'] },
        },
      ],
    },
    {
      id: 'process',
      title: 'Process',
      emoji: '\uD83D\uDD04',
      description: 'How was your creative process?',
      questions: [
        {
          id: 'process_focus',
          type: 'select',
          label: 'How was your focus?',
          options: [
            { value: 'deep', label: 'Deep focus \u2014 in the zone' },
            { value: 'good', label: 'Good focus \u2014 occasional breaks' },
            { value: 'distracted', label: 'Distracted \u2014 hard to concentrate' },
            { value: 'scattered', label: "Scattered \u2014 couldn't settle in" },
          ],
        },
        {
          id: 'process_iteration',
          type: 'boolean',
          label: 'Did you iterate on your designs effectively?',
        },
      ],
    },
    {
      id: 'overall',
      title: 'Overall Assessment',
      emoji: '\uD83D\uDCDD',
      description: 'Looking back at this project',
      questions: [
        {
          id: 'overall_feeling',
          type: 'select',
          label: 'How do you feel about this project?',
          options: [
            { value: 'very_satisfied', label: 'Very satisfied \u2014 proud of the work' },
            { value: 'satisfied', label: 'Satisfied \u2014 good progress' },
            { value: 'neutral', label: 'Neutral \u2014 some wins some losses' },
            { value: 'unsatisfied', label: 'Unsatisfied \u2014 frustrating session' },
            { value: 'learning', label: 'Learning moment \u2014 valuable insights' },
          ],
        },
        {
          id: 'overall_key_learning',
          type: 'textarea',
          label: 'Key learning from this project?',
          placeholder: 'One thing to remember...',
        },
      ],
    },
  ],

  // ---------------------------------------------------------------------------
  // Drill / practice categories
  // ---------------------------------------------------------------------------
  drillCategories: [
    { id: 'layout', label: 'Layout', icon: 'grid' },
    { id: 'typography', label: 'Typography', icon: 'text' },
    { id: 'color', label: 'Color', icon: 'color-palette' },
    { id: 'composition', label: 'Composition', icon: 'resize' },
    { id: 'branding', label: 'Branding', icon: 'diamond' },
    { id: 'ui_patterns', label: 'UI Patterns', icon: 'phone-portrait' },
    { id: 'illustration', label: 'Illustration', icon: 'brush' },
    { id: 'motion', label: 'Motion', icon: 'play' },
    { id: 'general', label: 'General', icon: 'pencil' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'layout-composition', label: 'Layout & Composition' },
    { id: 'typography', label: 'Typography' },
    { id: 'color-theory', label: 'Color Theory' },
    { id: 'visual-hierarchy', label: 'Visual Hierarchy' },
    { id: 'branding-identity', label: 'Branding & Identity' },
    { id: 'ui-ux', label: 'UI/UX Design' },
    { id: 'illustration', label: 'Illustration' },
    { id: 'motion-design', label: 'Motion Design' },
    { id: 'tool-proficiency', label: 'Tool Proficiency' },
    { id: 'creative-problem-solving', label: 'Creative Problem Solving' },
  ],

  // ---------------------------------------------------------------------------
  // Evidence capture
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'progress_screenshot',
      label: 'Progress Screenshots',
      icon: 'camera',
      type: 'photo',
      description: 'Screenshots at key stages of the design process',
    },
    secondaryCapture: [
      {
        id: 'time_lapse',
        label: 'Time-Lapse Recording',
        icon: 'videocam',
        type: 'video',
        description: 'Screen recording of the design session',
      },
      {
        id: 'session_timer',
        label: 'Session Timer',
        icon: 'stopwatch',
        type: 'timer',
        description: 'Pomodoro or timed session tracking',
      },
      {
        id: 'final_export',
        label: 'Final Export',
        icon: 'image',
        type: 'photo',
        description: 'High-resolution export of the finished design',
      },
      {
        id: 'text_notes',
        label: 'Text Notes',
        icon: 'document-text',
        type: 'text',
        description: 'Written observations and design rationale',
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
      eventsLabel: 'Projects',
      hoursLabel: 'Design Hours',
      skillsLabel: 'Techniques',
      streakLabel: 'Design Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your design work',
      primaryLegend: 'Project',
      secondaryLegend: 'Study',
      eventVerb: 'designed',
      stat1Label: 'Projects',
      stat2Label: 'Pieces',
      stat3Label: 'In Studio',
      stat4Label: 'Critique Score',
      comparisonNoun: 'projects',
      performanceSubtitle: 'Your design progress over time',
      performanceEmpty: 'Complete some projects to see your progress trend',
      emptyIcon: 'color-palette-outline',
    },
  },

  // ---------------------------------------------------------------------------
  // Tile sections
  // ---------------------------------------------------------------------------
  tileSections: {
    days_before: [],
    on_water: [
      {
        id: 'in-session',
        label: 'Creating',
        subtitle: 'Active design tools',
        moduleIds: ['reference_images', 'technique_focus', 'timer'],
      },
    ],
    after_race: [
      {
        id: 'project-review',
        label: 'Project Review',
        subtitle: 'Documentation and critique',
        moduleIds: ['progress_photos', 'learning_notes', 'instructor_feedback', 'portfolio_tag'],
      },
    ],
  },
}
