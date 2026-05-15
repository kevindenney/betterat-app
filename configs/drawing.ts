/**
 * Drawing Interest Event Configuration
 *
 * Defines the drawing-specific constants as a single InterestEventConfig
 * that drives the event card experience for the drawing interest.
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const DRAWING_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'drawing',

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
  catalogSubtitle: 'Browse drawing courses and techniques',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'drawing_session',
      label: 'Drawing Session',
      icon: 'brush',
      description: 'Standard drawing session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'subject', type: 'text', label: 'Subject', placeholder: 'What are you drawing?' },
        {
          id: 'medium',
          type: 'select',
          label: 'Medium',
          options: [
            { value: 'graphite', label: 'Graphite' },
            { value: 'charcoal', label: 'Charcoal' },
            { value: 'ink', label: 'Ink' },
            { value: 'colored_pencil', label: 'Colored Pencil' },
            { value: 'pastel', label: 'Pastel' },
            { value: 'digital', label: 'Digital' },
            { value: 'mixed_media', label: 'Mixed Media' },
          ],
        },
        {
          id: 'surface',
          type: 'select',
          label: 'Surface',
          options: [
            { value: 'sketchbook', label: 'Sketchbook' },
            { value: 'drawing_paper', label: 'Drawing Paper' },
            { value: 'toned_paper', label: 'Toned Paper' },
            { value: 'canvas', label: 'Canvas' },
            { value: 'digital', label: 'Digital' },
          ],
        },
        {
          id: 'reference_type',
          type: 'select',
          label: 'Reference Type',
          options: [
            { value: 'life', label: 'Life' },
            { value: 'photo', label: 'Photo' },
            { value: 'imagination', label: 'Imagination' },
            { value: 'plein_air', label: 'Plein Air' },
          ],
        },
        {
          id: 'technique_focus',
          type: 'text',
          label: 'Technique Focus',
          placeholder: 'e.g., cross-hatching, blending...',
        },
      ],
    },
    {
      id: 'study_sketch',
      label: 'Study Sketch',
      icon: 'flash',
      description: 'Quick focused study',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        {
          id: 'duration',
          type: 'duration',
          label: 'Duration',
          placeholder: '5-30 min',
        },
        { id: 'subject', type: 'text', label: 'Subject', placeholder: 'What are you studying?' },
        {
          id: 'medium',
          type: 'select',
          label: 'Medium',
          options: [
            { value: 'graphite', label: 'Graphite' },
            { value: 'charcoal', label: 'Charcoal' },
            { value: 'ink', label: 'Ink' },
            { value: 'colored_pencil', label: 'Colored Pencil' },
            { value: 'pastel', label: 'Pastel' },
            { value: 'digital', label: 'Digital' },
            { value: 'mixed_media', label: 'Mixed Media' },
          ],
        },
        {
          id: 'purpose',
          type: 'select',
          label: 'Purpose',
          options: [
            { value: 'gesture', label: 'Gesture' },
            { value: 'value', label: 'Value' },
            { value: 'proportion', label: 'Proportion' },
            { value: 'warmup', label: 'Warmup' },
            { value: 'exploration', label: 'Exploration' },
          ],
        },
      ],
    },
    {
      id: 'technique_drill',
      label: 'Technique Drill',
      icon: 'fitness',
      description: 'Focused technique practice',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'technique',
          type: 'text',
          label: 'Technique',
          placeholder: 'e.g., hatching, stippling...',
        },
        {
          id: 'medium',
          type: 'select',
          label: 'Medium',
          options: [
            { value: 'graphite', label: 'Graphite' },
            { value: 'charcoal', label: 'Charcoal' },
            { value: 'ink', label: 'Ink' },
            { value: 'colored_pencil', label: 'Colored Pencil' },
            { value: 'pastel', label: 'Pastel' },
            { value: 'digital', label: 'Digital' },
            { value: 'mixed_media', label: 'Mixed Media' },
          ],
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
      id: 'master_copy',
      label: 'Master Copy',
      icon: 'palette',
      description: 'Study from a master artist',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'artist_name',
          type: 'text',
          label: 'Artist Name',
          placeholder: 'Name of the master artist',
        },
        {
          id: 'artwork_title',
          type: 'text',
          label: 'Artwork Title',
          placeholder: 'Title of the artwork',
        },
        {
          id: 'medium',
          type: 'select',
          label: 'Medium',
          options: [
            { value: 'graphite', label: 'Graphite' },
            { value: 'charcoal', label: 'Charcoal' },
            { value: 'ink', label: 'Ink' },
            { value: 'colored_pencil', label: 'Colored Pencil' },
            { value: 'pastel', label: 'Pastel' },
            { value: 'digital', label: 'Digital' },
            { value: 'mixed_media', label: 'Mixed Media' },
          ],
        },
        {
          id: 'focus',
          type: 'select',
          label: 'Focus',
          options: [
            { value: 'composition', label: 'Composition' },
            { value: 'value', label: 'Value' },
            { value: 'color', label: 'Color' },
            { value: 'brushwork', label: 'Brushwork' },
            { value: 'anatomy', label: 'Anatomy' },
          ],
        },
      ],
    },
    {
      id: 'critique_session',
      label: 'Critique Session',
      icon: 'chatbubbles',
      description: 'Group or instructor critique',
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
        {
          id: 'instructor',
          type: 'text',
          label: 'Instructor',
          placeholder: 'Instructor or facilitator name',
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
          id: 'medium',
          type: 'select',
          label: 'Medium',
          options: [
            { value: 'graphite', label: 'Graphite' },
            { value: 'charcoal', label: 'Charcoal' },
            { value: 'ink', label: 'Ink' },
            { value: 'colored_pencil', label: 'Colored Pencil' },
            { value: 'pastel', label: 'Pastel' },
            { value: 'digital', label: 'Digital' },
            { value: 'mixed_media', label: 'Mixed Media' },
          ],
        },
        {
          id: 'dimensions',
          type: 'text',
          label: 'Dimensions',
          placeholder: 'e.g., 9x12 in, A3...',
        },
        { id: 'subject', type: 'text', label: 'Subject', placeholder: 'Subject matter' },
        {
          id: 'description',
          type: 'text',
          label: 'Description',
          placeholder: 'Brief description of the piece',
        },
      ],
    },
  ],

  defaultSubtype: 'drawing_session',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    reference_images: {
      id: 'reference_images',
      label: 'References',
      shortLabel: 'Refs',
      icon: 'images',
      description: 'Reference photos mood board and inspiration',
    },
    composition: {
      id: 'composition',
      label: 'Composition',
      shortLabel: 'Comp',
      icon: 'grid',
      description: 'Thumbnail sketches and layout planning',
    },
    technique_focus: {
      id: 'technique_focus',
      label: 'Technique Focus',
      shortLabel: 'Technique',
      icon: 'color-wand',
      description: 'Specific technique to practice',
    },
    materials: {
      id: 'materials',
      label: 'Materials',
      shortLabel: 'Materials',
      icon: 'construct',
      description: 'Medium paper/canvas and tools selected',
    },
    checklist: {
      id: 'checklist',
      label: 'Session Checklist',
      shortLabel: 'Tasks',
      icon: 'checkbox-marked-outline',
      description: 'Workspace lighting materials ready',
    },
    color_study: {
      id: 'color_study',
      label: 'Color Study',
      shortLabel: 'Color',
      icon: 'color-palette',
      description: 'Color palette planning and swatches',
    },
    value_study: {
      id: 'value_study',
      label: 'Value Study',
      shortLabel: 'Values',
      icon: 'contrast',
      description: 'Tonal planning and value thumbnails',
    },
    artist_study: {
      id: 'artist_study',
      label: 'Artist Study',
      shortLabel: 'Artist',
      icon: 'person',
      description: 'Master artist you are studying',
    },
    time_plan: {
      id: 'time_plan',
      label: 'Time Plan',
      shortLabel: 'Time',
      icon: 'timer',
      description: 'Time allocation for warmup main and cooldown',
    },
    share_with_instructor: {
      id: 'share_with_instructor',
      label: 'Share with Instructor',
      shortLabel: 'Share',
      icon: 'share-variant',
      description: 'Share plan with teacher',
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
      label: 'Progress Photos',
      shortLabel: 'Photos',
      icon: 'camera',
      description: 'Before during and after photos',
    },
    learning_notes: {
      id: 'learning_notes',
      label: 'Session Notes',
      shortLabel: 'Notes',
      icon: 'lightbulb-outline',
      description: 'What worked and what to try differently',
    },
    instructor_feedback: {
      id: 'instructor_feedback',
      label: 'Instructor Feedback',
      shortLabel: 'Feedback',
      icon: 'message-text',
      description: 'Teacher or peer critique notes',
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
    value_study: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    artist_study: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    time_plan: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    share_with_instructor: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
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
        'value_study',
        'artist_study',
        'time_plan',
        'share_with_instructor',
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
        'composition',
      ],
      defaultModules: ['progress_photos', 'learning_notes'],
      maxModules: 4,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    drawing_session: {
      subtypeId: 'drawing_session',
    },
    study_sketch: {
      subtypeId: 'study_sketch',
      excludedModules: ['composition', 'color_study', 'value_study', 'artist_study'],
      phaseDefaultOverrides: {
        days_before: ['reference_images', 'technique_focus', 'materials'],
      },
    },
    technique_drill: {
      subtypeId: 'technique_drill',
      excludedModules: ['composition', 'color_study', 'value_study', 'artist_study', 'portfolio_tag'],
    },
    master_copy: {
      subtypeId: 'master_copy',
      excludedModules: ['color_study'],
      labelOverrides: {
        composition: 'Study Composition',
      },
      additionalModules: ['artist_study'],
    },
    critique_session: {
      subtypeId: 'critique_session',
      excludedModules: ['timer', 'materials', 'checklist', 'time_plan'],
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
      description: 'High-level session performance summary',
    },
    {
      id: 'composition_analysis',
      label: 'Composition Analysis',
      description: 'Layout, design, and visual flow assessment',
    },
    {
      id: 'proportion_accuracy',
      label: 'Proportion Accuracy',
      description: 'Measurement accuracy and spatial relationships',
    },
    {
      id: 'value_structure',
      label: 'Value Structure',
      description: 'Tonal range, contrast, and light/shadow assessment',
    },
    {
      id: 'line_quality',
      label: 'Line Quality',
      description: 'Confidence, variety, and expressiveness of line work',
    },
    {
      id: 'technique_execution',
      label: 'Technique Execution',
      description: 'Medium control and technique application review',
    },
    {
      id: 'creative_choices',
      label: 'Creative Choices',
      description: 'Artistic decisions, interpretation, and expression',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Specific areas for improvement and next steps',
    },
    {
      id: 'plan_vs_execution',
      label: 'Plan vs Execution',
      description: 'Comparison of session plan to actual drawing decisions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'proportional_accuracy',
      label: 'Proportional Accuracy',
      description: 'Accuracy of measurements and spatial relationships',
    },
    {
      id: 'value_range',
      label: 'Value Range',
      description: 'Full use of tonal range from light to dark',
    },
    {
      id: 'edge_control',
      label: 'Edge Control',
      description: 'Variety and intentionality of hard, soft, and lost edges',
    },
    {
      id: 'composition',
      label: 'Composition',
      description: 'Effectiveness of layout, focal point, and visual flow',
    },
    {
      id: 'medium_control',
      label: 'Medium Control',
      description: 'Skill and confidence in handling the chosen medium',
    },
    {
      id: 'observation',
      label: 'Observation',
      description: 'Ability to see and render accurately from reference',
    },
    {
      id: 'overall_growth',
      label: 'Overall Growth',
      description: 'Composite score across all drawing dimensions',
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
          id: 'setup_references',
          type: 'boolean',
          label: 'Did your references work well?',
        },
        {
          id: 'setup_reference_issue',
          type: 'text',
          label: 'What reference issues did you have?',
          showWhen: { questionId: 'setup_references', answerIn: ['false'] },
        },
      ],
    },
    {
      id: 'composition',
      title: 'Composition',
      emoji: '\uD83D\uDCD0',
      description: 'Planning and layout',
      questions: [
        {
          id: 'comp_followed_plan',
          type: 'select',
          label: 'Did you follow your composition plan?',
          options: [
            { value: 'yes', label: 'Yes \u2014 stuck to my plan' },
            { value: 'mostly', label: 'Mostly \u2014 minor changes' },
            { value: 'partially', label: 'Partially \u2014 significant changes' },
            { value: 'no', label: 'No \u2014 went a different direction' },
          ],
        },
        {
          id: 'comp_overall',
          type: 'select',
          label: 'How was the overall composition?',
          options: [
            { value: 'strong', label: 'Strong \u2014 effective design' },
            { value: 'good', label: 'Good \u2014 works well' },
            { value: 'okay', label: 'Okay \u2014 could be better' },
            { value: 'weak', label: 'Weak \u2014 needs rethinking' },
          ],
        },
      ],
    },
    {
      id: 'technique',
      title: 'Technique Execution',
      emoji: '\u270F\uFE0F',
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
      id: 'observation',
      title: 'Observation & Accuracy',
      emoji: '\uD83D\uDC41\uFE0F',
      description: 'Seeing and rendering',
      questions: [
        {
          id: 'obs_proportions',
          type: 'select',
          label: 'How were your proportions?',
          options: [
            { value: 'accurate', label: 'Accurate \u2014 measured well' },
            { value: 'close', label: 'Close \u2014 minor issues' },
            { value: 'off', label: 'Off \u2014 noticeable errors' },
            { value: 'struggled', label: 'Struggled \u2014 need proportion practice' },
          ],
        },
        {
          id: 'obs_values',
          type: 'select',
          label: 'How was your value range?',
          options: [
            { value: 'full_range', label: 'Full range \u2014 good contrast' },
            { value: 'moderate', label: 'Moderate range' },
            { value: 'limited', label: 'Limited range \u2014 too flat' },
            { value: 'no_focus', label: "Didn't focus on values" },
          ],
        },
        {
          id: 'obs_seeing',
          type: 'select',
          label: 'How was your observational accuracy?',
          options: [
            { value: 'clear', label: 'Saw clearly \u2014 drew what I saw' },
            { value: 'mostly', label: 'Mostly \u2014 some assumptions crept in' },
            { value: 'mixed', label: 'Mixed \u2014 drawing from knowledge not observation' },
            { value: 'slow_down', label: 'Need to slow down and look more' },
          ],
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
          id: 'process_breaks',
          type: 'boolean',
          label: 'Did you take effective breaks?',
        },
        {
          id: 'process_step_back',
          type: 'boolean',
          label: 'Did you step back to evaluate regularly?',
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
          placeholder: 'The part of the drawing you are most proud of...',
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
    { id: 'gesture', label: 'Gesture', icon: 'body' },
    { id: 'contour', label: 'Contour', icon: 'create' },
    { id: 'value', label: 'Value', icon: 'contrast' },
    { id: 'proportion', label: 'Proportion', icon: 'resize' },
    { id: 'perspective', label: 'Perspective', icon: 'cube' },
    { id: 'anatomy', label: 'Anatomy', icon: 'body' },
    { id: 'composition', label: 'Composition', icon: 'grid' },
    { id: 'color_theory', label: 'Color Theory', icon: 'color-palette' },
    { id: 'medium_technique', label: 'Medium Technique', icon: 'brush' },
    { id: 'master_study', label: 'Master Study', icon: 'school' },
    { id: 'general', label: 'General', icon: 'pencil' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'gesture-drawing', label: 'Gesture Drawing' },
    { id: 'contour-accuracy', label: 'Contour Accuracy' },
    { id: 'value-rendering', label: 'Value Rendering' },
    { id: 'proportion-measurement', label: 'Proportion Measurement' },
    { id: 'perspective-construction', label: 'Perspective Construction' },
    { id: 'anatomical-knowledge', label: 'Anatomical Knowledge' },
    { id: 'composition-design', label: 'Composition Design' },
    { id: 'color-mixing', label: 'Color Mixing' },
    { id: 'medium-control', label: 'Medium Control' },
    { id: 'observational-accuracy', label: 'Observational Accuracy' },
    { id: 'creative-expression', label: 'Creative Expression' },
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
        id: 'time_lapse',
        label: 'Time-Lapse Video',
        icon: 'videocam',
        type: 'video',
        description: 'Time-lapse recording of the drawing session',
      },
      {
        id: 'session_timer',
        label: 'Session Timer',
        icon: 'stopwatch',
        type: 'timer',
        description: 'Pomodoro or timed session tracking',
      },
      {
        id: 'final_highres',
        label: 'Final High-Res',
        icon: 'image',
        type: 'photo',
        description: 'High-resolution capture of the finished piece for portfolio',
      },
      {
        id: 'text_notes',
        label: 'Text Notes',
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
      { value: 'session_log', label: 'Session Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Sessions',
      hoursLabel: 'Drawing Hours',
      skillsLabel: 'Techniques',
      streakLabel: 'Drawing Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your drawing',
      primaryLegend: 'Session',
      secondaryLegend: 'Study',
      eventVerb: 'practiced',
      stat1Label: 'Sessions',
      stat2Label: 'Pieces',
      stat3Label: 'In Studio',
      stat4Label: 'Critique Score',
      comparisonNoun: 'sessions',
      performanceSubtitle: 'Your technique progress over time',
      performanceEmpty: 'Complete some sessions to see your progress trend',
      emptyIcon: 'brush-outline',
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
        subtitle: 'Active drawing tools',
        moduleIds: ['reference_images', 'technique_focus', 'timer'],
      },
    ],
    after_race: [
      {
        id: 'session-review',
        label: 'Session Review',
        subtitle: 'Documentation and critique',
        moduleIds: ['progress_photos', 'learning_notes', 'instructor_feedback', 'portfolio_tag'],
      },
    ],
  },
}
