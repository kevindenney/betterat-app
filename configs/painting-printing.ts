/**
 * Painting & Printing Interest Event Configuration
 *
 * Defines the painting & printing-specific constants as a single InterestEventConfig
 * that drives the event card experience for the painting-printing interest.
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const PAINTING_PRINTING_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'painting-printing',

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
  catalogSubtitle: 'Browse painting and printmaking courses',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'painting_session',
      label: 'Painting',
      icon: 'brush',
      description: 'Painting session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'subject', type: 'text', label: 'Subject', placeholder: 'What are you painting?' },
        {
          id: 'medium',
          type: 'select',
          label: 'Medium',
          options: [
            { value: 'oil', label: 'Oil' },
            { value: 'acrylic', label: 'Acrylic' },
            { value: 'watercolor', label: 'Watercolor' },
            { value: 'gouache', label: 'Gouache' },
            { value: 'encaustic', label: 'Encaustic' },
            { value: 'mixed_media', label: 'Mixed Media' },
          ],
        },
        {
          id: 'surface',
          type: 'select',
          label: 'Surface',
          options: [
            { value: 'canvas', label: 'Canvas' },
            { value: 'panel', label: 'Panel' },
            { value: 'paper', label: 'Paper' },
            { value: 'linen', label: 'Linen' },
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
      ],
    },
    {
      id: 'printmaking_session',
      label: 'Printmaking',
      icon: 'layers',
      description: 'Printmaking session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'technique',
          type: 'select',
          label: 'Technique',
          options: [
            { value: 'relief', label: 'Relief' },
            { value: 'intaglio', label: 'Intaglio' },
            { value: 'lithography', label: 'Lithography' },
            { value: 'screen_print', label: 'Screen Print' },
            { value: 'monoprint', label: 'Monoprint' },
            { value: 'collagraph', label: 'Collagraph' },
          ],
        },
        {
          id: 'plate_material',
          type: 'text',
          label: 'Plate Material',
          placeholder: 'e.g., linoleum, copper, wood...',
        },
        {
          id: 'edition_size',
          type: 'number',
          label: 'Edition Size',
          placeholder: 'Number of prints in edition',
        },
        {
          id: 'ink_type',
          type: 'text',
          label: 'Ink Type',
          placeholder: 'e.g., oil-based, water-based...',
        },
      ],
    },
    {
      id: 'plein_air',
      label: 'Plein Air',
      icon: 'sunny',
      description: 'Plein air painting session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Where are you painting?' },
        {
          id: 'medium',
          type: 'select',
          label: 'Medium',
          options: [
            { value: 'oil', label: 'Oil' },
            { value: 'watercolor', label: 'Watercolor' },
            { value: 'gouache', label: 'Gouache' },
            { value: 'pastel', label: 'Pastel' },
          ],
        },
        { id: 'weather', type: 'text', label: 'Weather', placeholder: 'Weather conditions' },
        { id: 'subject', type: 'text', label: 'Subject', placeholder: 'What are you painting?' },
      ],
    },
    {
      id: 'study_sketch',
      label: 'Quick Study',
      icon: 'flash',
      description: 'Quick focused study',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'subject', type: 'text', label: 'Subject', placeholder: 'What are you studying?' },
        {
          id: 'medium',
          type: 'select',
          label: 'Medium',
          options: [
            { value: 'graphite', label: 'Graphite' },
            { value: 'charcoal', label: 'Charcoal' },
            { value: 'ink', label: 'Ink' },
            { value: 'watercolor', label: 'Watercolor' },
            { value: 'oil', label: 'Oil' },
          ],
        },
        {
          id: 'purpose',
          type: 'select',
          label: 'Purpose',
          options: [
            { value: 'value', label: 'Value' },
            { value: 'color', label: 'Color' },
            { value: 'composition', label: 'Composition' },
            { value: 'gesture', label: 'Gesture' },
            { value: 'master_copy', label: 'Master Copy' },
          ],
        },
      ],
    },
    {
      id: 'master_copy',
      label: 'Master Copy',
      icon: 'school',
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
            { value: 'oil', label: 'Oil' },
            { value: 'acrylic', label: 'Acrylic' },
            { value: 'watercolor', label: 'Watercolor' },
            { value: 'gouache', label: 'Gouache' },
            { value: 'encaustic', label: 'Encaustic' },
            { value: 'mixed_media', label: 'Mixed Media' },
          ],
        },
        {
          id: 'focus',
          type: 'select',
          label: 'Focus',
          options: [
            { value: 'composition', label: 'Composition' },
            { value: 'color', label: 'Color' },
            { value: 'brushwork', label: 'Brushwork' },
            { value: 'value', label: 'Value' },
            { value: 'technique', label: 'Technique' },
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
            { value: 'oil', label: 'Oil' },
            { value: 'acrylic', label: 'Acrylic' },
            { value: 'watercolor', label: 'Watercolor' },
            { value: 'gouache', label: 'Gouache' },
            { value: 'encaustic', label: 'Encaustic' },
            { value: 'mixed_media', label: 'Mixed Media' },
          ],
        },
        {
          id: 'dimensions',
          type: 'text',
          label: 'Dimensions',
          placeholder: 'e.g., 24x36 in, 60x90 cm...',
        },
        {
          id: 'edition_info',
          type: 'text',
          label: 'Edition Info',
          placeholder: 'Edition details for prints',
        },
        {
          id: 'description',
          type: 'text',
          label: 'Description',
          placeholder: 'Brief description of the piece',
        },
      ],
    },
  ],

  defaultSubtype: 'painting_session',

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
    materials: {
      id: 'materials',
      label: 'Materials',
      shortLabel: 'Materials',
      icon: 'construct',
      description: 'Paints brushes surfaces and tools selected',
    },
    palette_plan: {
      id: 'palette_plan',
      label: 'Palette Plan',
      shortLabel: 'Palette',
      icon: 'color-palette',
      description: 'Color mixing plan and palette layout',
    },
    print_registration: {
      id: 'print_registration',
      label: 'Print Registration',
      shortLabel: 'Reg',
      icon: 'layers',
      description: 'Registration marks and multi-layer alignment',
    },
    edition_tracking: {
      id: 'edition_tracking',
      label: 'Edition Tracking',
      shortLabel: 'Edition',
      icon: 'copy',
      description: 'Print edition numbering and quality tracking',
    },
    progress_photos: {
      id: 'progress_photos',
      label: 'Progress Photos',
      shortLabel: 'Photos',
      icon: 'camera',
      description: 'Before during and after photos',
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
      description: 'Studio setup materials and workspace ready',
    },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    reference_images: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    composition: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    color_study: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    value_study: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    materials: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    palette_plan: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    print_registration: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    edition_tracking: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    progress_photos: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    instructor_feedback: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    checklist: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
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
        'color_study',
        'value_study',
        'materials',
        'palette_plan',
        'print_registration',
        'checklist',
      ],
      defaultModules: [
        'reference_images',
        'composition',
        'materials',
        'palette_plan',
      ],
      maxModules: 6,
    },
    on_water: {
      phase: 'on_water',
      availableModules: [
        'reference_images',
        'palette_plan',
        'progress_photos',
        'print_registration',
      ],
      defaultModules: ['reference_images', 'progress_photos'],
      maxModules: 3,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'progress_photos',
        'edition_tracking',
        'instructor_feedback',
        'composition',
      ],
      defaultModules: ['progress_photos', 'instructor_feedback'],
      maxModules: 4,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    painting_session: {
      subtypeId: 'painting_session',
    },
    printmaking_session: {
      subtypeId: 'printmaking_session',
      additionalModules: ['print_registration', 'edition_tracking'],
    },
    plein_air: {
      subtypeId: 'plein_air',
      excludedModules: ['print_registration', 'edition_tracking'],
    },
    study_sketch: {
      subtypeId: 'study_sketch',
      excludedModules: ['print_registration', 'edition_tracking', 'palette_plan'],
      phaseDefaultOverrides: {
        days_before: ['reference_images', 'materials'],
      },
    },
    master_copy: {
      subtypeId: 'master_copy',
      excludedModules: ['print_registration', 'edition_tracking'],
      labelOverrides: {
        composition: 'Study Composition',
      },
    },
    critique_session: {
      subtypeId: 'critique_session',
      excludedModules: ['materials', 'checklist', 'print_registration', 'palette_plan'],
    },
    portfolio_piece: {
      subtypeId: 'portfolio_piece',
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
      id: 'color_analysis',
      label: 'Color Analysis',
      description: 'Color harmony, mixing accuracy, and palette effectiveness',
    },
    {
      id: 'composition_assessment',
      label: 'Composition Assessment',
      description: 'Layout, design, and visual flow assessment',
    },
    {
      id: 'technique_execution',
      label: 'Technique Execution',
      description: 'Medium control and technique application review',
    },
    {
      id: 'print_quality',
      label: 'Print Quality',
      description: 'Registration, inking, and edition consistency for printmaking',
    },
    {
      id: 'creative_vision',
      label: 'Creative Vision',
      description: 'Artistic intent, interpretation, and expression',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Specific areas for improvement and next steps',
    },
    {
      id: 'plan_vs_execution',
      label: 'Plan vs Execution',
      description: 'Comparison of session plan to actual painting decisions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'color_harmony',
      label: 'Color Harmony',
      description: 'Effectiveness of color relationships and palette choices',
    },
    {
      id: 'composition',
      label: 'Composition',
      description: 'Effectiveness of layout, focal point, and visual flow',
    },
    {
      id: 'brushwork_mark_making',
      label: 'Brushwork/Mark Making',
      description: 'Confidence, variety, and expressiveness of marks',
    },
    {
      id: 'value_structure',
      label: 'Value Structure',
      description: 'Tonal range, contrast, and light/shadow structure',
    },
    {
      id: 'technical_execution',
      label: 'Technical Execution',
      description: 'Skill and control in handling the chosen medium',
    },
    {
      id: 'creative_expression',
      label: 'Creative Expression',
      description: 'Artistic voice, interpretation, and personal expression',
    },
    {
      id: 'overall_growth',
      label: 'Overall Growth',
      description: 'Composite score across all painting dimensions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Debrief phases
  // ---------------------------------------------------------------------------
  debriefPhases: [
    {
      id: 'setup',
      title: 'Studio & Materials Setup',
      emoji: '\uD83C\uDFA8',
      description: 'How was your studio and materials?',
      questions: [
        {
          id: 'setup_studio',
          type: 'select',
          label: 'How was your studio setup?',
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
          label: 'Did your materials work well?',
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
      id: 'composition',
      title: 'Composition & Design',
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
      id: 'color',
      title: 'Color & Value',
      emoji: '\uD83C\uDF08',
      description: 'Color mixing and value relationships',
      questions: [
        {
          id: 'color_mixing',
          type: 'select',
          label: 'How was your color mixing?',
          options: [
            { value: 'excellent', label: 'Excellent \u2014 accurate and efficient' },
            { value: 'good', label: 'Good \u2014 mostly on target' },
            { value: 'fair', label: 'Fair \u2014 some muddy mixes' },
            { value: 'struggling', label: 'Struggling \u2014 need more practice' },
          ],
        },
        {
          id: 'color_harmony',
          type: 'select',
          label: 'How was your color harmony?',
          options: [
            { value: 'unified', label: 'Unified \u2014 colors sing together' },
            { value: 'good', label: 'Good \u2014 mostly harmonious' },
            { value: 'disjointed', label: 'Disjointed \u2014 some jarring notes' },
            { value: 'chaotic', label: 'Chaotic \u2014 no clear palette' },
          ],
        },
        {
          id: 'color_values',
          type: 'select',
          label: 'How was your value structure?',
          options: [
            { value: 'full_range', label: 'Full range \u2014 good contrast' },
            { value: 'moderate', label: 'Moderate range' },
            { value: 'limited', label: 'Limited range \u2014 too flat' },
            { value: 'no_focus', label: "Didn't focus on values" },
          ],
        },
      ],
    },
    {
      id: 'technique',
      title: 'Technique & Medium',
      emoji: '\uD83D\uDD8C\uFE0F',
      description: 'How was your technique today?',
      questions: [
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
      id: 'print_quality',
      title: 'Print Quality',
      emoji: '\uD83D\uDDBC\uFE0F',
      description: 'For printmaking sessions',
      questions: [
        {
          id: 'print_registration',
          type: 'select',
          label: 'How was your registration?',
          options: [
            { value: 'perfect', label: 'Perfect \u2014 spot on' },
            { value: 'good', label: 'Good \u2014 minor shifts' },
            { value: 'off', label: 'Off \u2014 noticeable misalignment' },
            { value: 'na', label: 'N/A \u2014 single layer' },
          ],
        },
        {
          id: 'print_consistency',
          type: 'select',
          label: 'How consistent was the edition?',
          options: [
            { value: 'very_consistent', label: 'Very consistent across prints' },
            { value: 'mostly', label: 'Mostly consistent' },
            { value: 'variable', label: 'Variable \u2014 some rejects' },
            { value: 'na', label: 'N/A \u2014 not editioning' },
          ],
        },
        {
          id: 'print_inking',
          type: 'select',
          label: 'How was your inking?',
          options: [
            { value: 'even', label: 'Even \u2014 good coverage' },
            { value: 'good', label: 'Good \u2014 minor variations' },
            { value: 'uneven', label: 'Uneven \u2014 needs work' },
            { value: 'na', label: 'N/A \u2014 not a print session' },
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
    { id: 'color_mixing', label: 'Color Mixing', icon: 'color-palette' },
    { id: 'brushwork', label: 'Brushwork', icon: 'brush' },
    { id: 'print_registration', label: 'Print Registration', icon: 'layers' },
    { id: 'editioning', label: 'Editioning', icon: 'copy' },
    { id: 'composition', label: 'Composition', icon: 'grid' },
    { id: 'value_studies', label: 'Value Studies', icon: 'contrast' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'color-theory', label: 'Color Theory' },
    { id: 'composition', label: 'Composition' },
    { id: 'medium-mastery', label: 'Medium Mastery' },
    { id: 'printmaking-techniques', label: 'Printmaking Techniques' },
    { id: 'plein-air', label: 'Plein Air' },
    { id: 'figure-painting', label: 'Figure Painting' },
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
        id: 'final_documentation',
        label: 'Final Documentation',
        icon: 'image',
        type: 'photo',
        description: 'High-resolution capture of the finished piece for portfolio',
      },
      {
        id: 'edition_record',
        label: 'Edition Record',
        icon: 'document-text',
        type: 'text',
        description: 'Edition numbering, quality notes, and print log',
      },
      {
        id: 'process_video',
        label: 'Process Video',
        icon: 'videocam',
        type: 'video',
        description: 'Time-lapse or recording of the painting process',
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
      hoursLabel: 'Studio Hours',
      skillsLabel: 'Techniques',
      streakLabel: 'Painting Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your painting',
      primaryLegend: 'Session',
      secondaryLegend: 'Study',
      eventVerb: 'painted',
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
        id: 'in-studio',
        label: 'In Studio',
        subtitle: 'Active painting and printing tools',
        moduleIds: ['reference_images', 'palette_plan', 'progress_photos', 'print_registration'],
      },
    ],
    after_race: [
      {
        id: 'session-review',
        label: 'Session Review',
        subtitle: 'Documentation and critique',
        moduleIds: ['progress_photos', 'edition_tracking', 'instructor_feedback', 'composition'],
      },
    ],
  },
}
