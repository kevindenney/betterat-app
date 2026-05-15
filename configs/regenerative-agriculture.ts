/**
 * Regenerative Agriculture Interest Event Configuration
 *
 * Defines the regenerative-agriculture-specific constants as a single
 * InterestEventConfig that drives the event card experience for the
 * regenerative agriculture interest.
 *
 * Anchor org: The Open Field (Khunti/Ranchi, Jharkhand, India)
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const REGENERATIVE_AGRICULTURE_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'regenerative-agriculture',

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
  teamNoun: 'Crew',
  catalogRoute: '/(tabs)/learn',
  catalogSubtitle: 'Browse farming workshops and growing techniques',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'growing_session',
      label: 'Growing Session',
      icon: 'leaf',
      description: 'Planting, tending, field work',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'crop', type: 'text', label: 'Crop', placeholder: 'What are you growing?' },
        {
          id: 'activity_type',
          type: 'select',
          label: 'Activity',
          options: [
            { value: 'planting', label: 'Planting' },
            { value: 'weeding', label: 'Weeding' },
            { value: 'watering', label: 'Watering' },
            { value: 'pruning', label: 'Pruning' },
            { value: 'transplanting', label: 'Transplanting' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'plot', type: 'text', label: 'Plot/Bed', placeholder: 'e.g., Bed 3, North Field' },
      ],
    },
    {
      id: 'harvest',
      label: 'Harvest',
      icon: 'nutrition',
      description: 'Harvesting crops with quantity/quality tracking',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'crop', type: 'text', label: 'Crop', placeholder: 'What are you harvesting?' },
        { id: 'quantity', type: 'text', label: 'Quantity', placeholder: 'e.g., 5 kg, 2 baskets' },
        {
          id: 'quality',
          type: 'select',
          label: 'Quality',
          options: [
            { value: 'excellent', label: 'Excellent' },
            { value: 'good', label: 'Good' },
            { value: 'fair', label: 'Fair' },
            { value: 'poor', label: 'Poor' },
          ],
        },
      ],
    },
    {
      id: 'cooking_workshop',
      label: 'Cooking Workshop',
      icon: 'restaurant',
      description: 'Tribal cuisine, farm-to-table, preservation, fermentation',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'cuisine_type',
          type: 'select',
          label: 'Cuisine Type',
          options: [
            { value: 'tribal', label: 'Tribal Cuisine' },
            { value: 'farm_to_table', label: 'Farm-to-Table' },
            { value: 'preservation', label: 'Preservation' },
            { value: 'fermentation', label: 'Fermentation' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'dish', type: 'text', label: 'Dish', placeholder: 'What are you making?' },
        { id: 'ingredients_source', type: 'text', label: 'Ingredients Source', placeholder: 'e.g., on-farm, local market' },
      ],
    },
    {
      id: 'soil_session',
      label: 'Soil Session',
      icon: 'earth',
      description: 'Soil health, composting, cover cropping',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'soil_activity',
          type: 'select',
          label: 'Activity',
          options: [
            { value: 'composting', label: 'Composting' },
            { value: 'cover_cropping', label: 'Cover Cropping' },
            { value: 'soil_testing', label: 'Soil Testing' },
            { value: 'mulching', label: 'Mulching' },
            { value: 'vermiculture', label: 'Vermiculture' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'plot', type: 'text', label: 'Plot/Bed', placeholder: 'Location of soil work' },
      ],
    },
    {
      id: 'market_day',
      label: 'Market Day',
      icon: 'cart',
      description: 'Farmers market with sales/customer tracking',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'market_name', type: 'text', label: 'Market Name', placeholder: 'Name of the market' },
        { id: 'products', type: 'text', label: 'Products', placeholder: 'What are you selling?' },
        { id: 'revenue', type: 'text', label: 'Revenue', placeholder: 'Total sales' },
        {
          id: 'customer_count',
          type: 'number',
          label: 'Customer Count',
          placeholder: 'Number of customers',
        },
      ],
    },
    {
      id: 'workshop',
      label: 'Workshop',
      icon: 'school',
      description: 'Rainwater harvesting, organic certification, nursery management, seed saving',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'workshop_topic',
          type: 'select',
          label: 'Topic',
          options: [
            { value: 'rainwater_harvesting', label: 'Rainwater Harvesting' },
            { value: 'organic_certification', label: 'Organic Certification' },
            { value: 'nursery_management', label: 'Nursery Management' },
            { value: 'seed_saving', label: 'Seed Saving' },
            { value: 'permaculture', label: 'Permaculture Design' },
            { value: 'other', label: 'Other' },
          ],
        },
        { id: 'instructor', type: 'text', label: 'Instructor', placeholder: 'Workshop instructor' },
      ],
    },
    {
      id: 'farm_walk',
      label: 'Farm Walk',
      icon: 'walk',
      description: 'Observation walk / agro-tourism tour',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'route', type: 'text', label: 'Route', placeholder: 'Areas covered in the walk' },
        {
          id: 'visitor_count',
          type: 'number',
          label: 'Visitors',
          placeholder: 'Number of visitors',
        },
        { id: 'observations', type: 'text', label: 'Key Observations', placeholder: 'What did you notice?' },
      ],
    },
  ],

  defaultSubtype: 'growing_session',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    crop_plan: {
      id: 'crop_plan',
      label: 'Crop Plan',
      shortLabel: 'Crop',
      icon: 'document-text',
      description: 'Planting schedule and crop rotation notes',
    },
    soil_log: {
      id: 'soil_log',
      label: 'Soil Log',
      shortLabel: 'Soil',
      icon: 'earth',
      description: 'Soil health observations and test results',
    },
    weather_notes: {
      id: 'weather_notes',
      label: 'Weather Notes',
      shortLabel: 'Weather',
      icon: 'cloud',
      description: 'Weather conditions and their impact',
    },
    field_photos: {
      id: 'field_photos',
      label: 'Field Photos',
      shortLabel: 'Photos',
      icon: 'camera',
      description: 'Photos of crops, soil, and field conditions',
    },
    recipe_notes: {
      id: 'recipe_notes',
      label: 'Recipe Notes',
      shortLabel: 'Recipe',
      icon: 'restaurant',
      description: 'Recipes and cooking notes from farm produce',
    },
    harvest_log: {
      id: 'harvest_log',
      label: 'Harvest Log',
      shortLabel: 'Harvest',
      icon: 'nutrition',
      description: 'Harvest quantities, quality, and storage notes',
    },
    market_notes: {
      id: 'market_notes',
      label: 'Market Notes',
      shortLabel: 'Market',
      icon: 'cart',
      description: 'Market sales, customer feedback, and trends',
    },
    mentor_feedback: {
      id: 'mentor_feedback',
      label: 'Mentor Feedback',
      shortLabel: 'Mentor',
      icon: 'message-text',
      description: 'Feedback from experienced farmers or mentors',
    },
    checklist: {
      id: 'checklist',
      label: 'Session Checklist',
      shortLabel: 'Tasks',
      icon: 'checkbox-marked-outline',
      description: 'Tools, seeds, and supplies ready',
    },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    crop_plan: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    soil_log: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    weather_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    field_photos: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    recipe_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    harvest_log: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    market_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    mentor_feedback: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    checklist: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
  },

  // ---------------------------------------------------------------------------
  // Phase -> module configuration
  // ---------------------------------------------------------------------------
  phaseModuleConfig: {
    days_before: {
      phase: 'days_before',
      availableModules: [
        'crop_plan',
        'soil_log',
        'weather_notes',
        'checklist',
      ],
      defaultModules: ['crop_plan', 'weather_notes', 'checklist'],
      maxModules: 4,
    },
    on_water: {
      phase: 'on_water',
      availableModules: ['field_photos', 'soil_log', 'weather_notes', 'recipe_notes'],
      defaultModules: ['field_photos', 'soil_log'],
      maxModules: 4,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'harvest_log',
        'field_photos',
        'market_notes',
        'mentor_feedback',
        'recipe_notes',
      ],
      defaultModules: ['harvest_log', 'field_photos'],
      maxModules: 5,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    growing_session: {
      subtypeId: 'growing_session',
    },
    harvest: {
      subtypeId: 'harvest',
      additionalModules: ['harvest_log'],
      phaseDefaultOverrides: {
        after_race: ['harvest_log', 'field_photos', 'market_notes'],
      },
    },
    cooking_workshop: {
      subtypeId: 'cooking_workshop',
      excludedModules: ['soil_log', 'crop_plan'],
      additionalModules: ['recipe_notes'],
      labelOverrides: {
        field_photos: 'Cooking Photos',
      },
    },
    soil_session: {
      subtypeId: 'soil_session',
      phaseDefaultOverrides: {
        on_water: ['soil_log', 'field_photos'],
      },
    },
    market_day: {
      subtypeId: 'market_day',
      excludedModules: ['soil_log', 'crop_plan'],
      additionalModules: ['market_notes'],
      labelOverrides: {
        field_photos: 'Market Photos',
      },
    },
    workshop: {
      subtypeId: 'workshop',
      excludedModules: ['harvest_log', 'market_notes'],
      additionalModules: ['mentor_feedback'],
    },
    farm_walk: {
      subtypeId: 'farm_walk',
      excludedModules: ['harvest_log', 'market_notes', 'recipe_notes'],
      labelOverrides: {
        field_photos: 'Walk Photos',
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
      id: 'soil_health',
      label: 'Soil Health',
      description: 'Soil condition assessment and improvement tracking',
    },
    {
      id: 'crop_performance',
      label: 'Crop Performance',
      description: 'Growth progress, pest/disease status, yield estimates',
    },
    {
      id: 'sustainability',
      label: 'Sustainability Practices',
      description: 'Water use, organic methods, biodiversity impact',
    },
    {
      id: 'community_impact',
      label: 'Community & Market Impact',
      description: 'Market success, customer engagement, community benefit',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Specific areas for improvement and next steps',
    },
    {
      id: 'plan_vs_execution',
      label: 'Plan vs Execution',
      description: 'Comparison of crop plan to actual field decisions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'soil_health',
      label: 'Soil Health',
      description: 'Building and maintaining healthy, living soil',
    },
    {
      id: 'crop_management',
      label: 'Crop Management',
      description: 'Planting, rotation, pest management, and yield optimization',
    },
    {
      id: 'water_systems',
      label: 'Water Systems',
      description: 'Irrigation, rainwater harvesting, and water conservation',
    },
    {
      id: 'traditional_cuisine',
      label: 'Traditional Cuisine',
      description: 'Knowledge and skill in traditional/tribal food preparation',
    },
    {
      id: 'organic_techniques',
      label: 'Organic Techniques',
      description: 'Organic farming methods and certification readiness',
    },
    {
      id: 'overall_growth',
      label: 'Overall Growth',
      description: 'Composite score across all farming dimensions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Debrief phases
  // ---------------------------------------------------------------------------
  debriefPhases: [
    {
      id: 'conditions',
      title: 'Conditions & Setup',
      emoji: '\uD83C\uDF24\uFE0F',
      description: 'Weather, soil, and preparation',
      questions: [
        {
          id: 'conditions_weather',
          type: 'select',
          label: 'How were the weather conditions?',
          options: [
            { value: 'ideal', label: 'Ideal \u2014 perfect for the work' },
            { value: 'good', label: 'Good \u2014 manageable' },
            { value: 'challenging', label: 'Challenging \u2014 heat, rain, or wind' },
            { value: 'difficult', label: 'Difficult \u2014 delayed or changed plans' },
          ],
        },
        {
          id: 'conditions_soil',
          type: 'select',
          label: 'How was the soil condition?',
          options: [
            { value: 'excellent', label: 'Excellent \u2014 rich and workable' },
            { value: 'good', label: 'Good \u2014 adequate' },
            { value: 'needs_work', label: 'Needs work \u2014 compacted or depleted' },
            { value: 'not_applicable', label: 'N/A' },
          ],
        },
        {
          id: 'conditions_tools',
          type: 'boolean',
          label: 'Were all tools and supplies ready?',
        },
      ],
    },
    {
      id: 'work_quality',
      title: 'Work Quality',
      emoji: '\uD83C\uDF31',
      description: 'How was the work itself?',
      questions: [
        {
          id: 'work_execution',
          type: 'select',
          label: 'How well did the work go?',
          options: [
            { value: 'excellent', label: 'Excellent \u2014 everything went smoothly' },
            { value: 'good', label: 'Good \u2014 solid progress' },
            { value: 'fair', label: 'Fair \u2014 some setbacks' },
            { value: 'struggled', label: 'Struggled \u2014 significant challenges' },
          ],
        },
        {
          id: 'work_technique',
          type: 'textarea',
          label: 'Any technique or method you tried that was new?',
          placeholder: 'New approach or technique...',
        },
      ],
    },
    {
      id: 'harvest_cooking',
      title: 'Harvest & Cooking',
      emoji: '\uD83C\uDF3D',
      description: 'What was produced or prepared?',
      questions: [
        {
          id: 'harvest_satisfaction',
          type: 'select',
          label: 'How satisfied are you with the harvest/output?',
          options: [
            { value: 'very', label: 'Very satisfied \u2014 exceeded expectations' },
            { value: 'satisfied', label: 'Satisfied \u2014 as expected' },
            { value: 'mixed', label: 'Mixed \u2014 some good, some not' },
            { value: 'not_applicable', label: 'N/A \u2014 no harvest today' },
          ],
        },
        {
          id: 'harvest_notes',
          type: 'textarea',
          label: 'Any notable observations about quality or yield?',
          placeholder: 'Size, taste, appearance...',
        },
      ],
    },
    {
      id: 'learning_community',
      title: 'Learning & Community',
      emoji: '\uD83E\uDD1D',
      description: 'What did you learn and who did you connect with?',
      questions: [
        {
          id: 'learning_insight',
          type: 'textarea',
          label: 'What did you learn today?',
          placeholder: 'A technique, observation, or tradition...',
        },
        {
          id: 'community_engagement',
          type: 'select',
          label: 'How was community engagement?',
          options: [
            { value: 'strong', label: 'Strong \u2014 great collaboration' },
            { value: 'good', label: 'Good \u2014 helpful interactions' },
            { value: 'solo', label: 'Solo \u2014 worked independently' },
            { value: 'not_applicable', label: 'N/A' },
          ],
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
          placeholder: 'Timing, technique, preparation...',
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
    { id: 'planting', label: 'Planting & Growing', icon: 'leaf' },
    { id: 'soil', label: 'Soil Health', icon: 'earth' },
    { id: 'water', label: 'Water Systems', icon: 'water' },
    { id: 'cooking', label: 'Cooking & Preservation', icon: 'restaurant' },
    { id: 'seed_saving', label: 'Seed Saving', icon: 'nutrition' },
    { id: 'marketing', label: 'Marketing & Sales', icon: 'cart' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'soil-health', label: 'Soil Health' },
    { id: 'crop-management', label: 'Crop Management' },
    { id: 'water-systems', label: 'Water Systems' },
    { id: 'traditional-cuisine', label: 'Traditional Cuisine' },
    { id: 'organic-techniques', label: 'Organic Techniques' },
    { id: 'seed-saving', label: 'Seed Saving' },
  ],

  // ---------------------------------------------------------------------------
  // Evidence capture
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'field_photo',
      label: 'Field Photo',
      icon: 'camera',
      type: 'photo',
      description: 'Photos of crops, soil, and field conditions',
    },
    secondaryCapture: [
      {
        id: 'harvest_weight',
        label: 'Harvest Weight',
        icon: 'scale',
        type: 'text',
        description: 'Weight and quantity of harvest',
      },
      {
        id: 'soil_reading',
        label: 'Soil Reading',
        icon: 'earth',
        type: 'text',
        description: 'pH, moisture, and nutrient readings',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Reflect tab configuration
  // ---------------------------------------------------------------------------
  reflectConfig: {
    segments: [
      { value: 'progress', label: 'Progress' },
      { value: 'session_log', label: 'Farm Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Sessions',
      hoursLabel: 'Field Hours',
      skillsLabel: 'Techniques',
      streakLabel: 'Growing Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your farming journey',
      primaryLegend: 'Session',
      secondaryLegend: 'Practice',
      eventVerb: 'worked',
      stat1Label: 'Sessions',
      stat2Label: 'Crops',
      stat3Label: 'In Crew',
      stat4Label: 'Skill Score',
      comparisonNoun: 'sessions',
      performanceSubtitle: 'Your growing progress over time',
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
        id: 'in-field',
        label: 'In Field',
        subtitle: 'Active field tools',
        moduleIds: ['field_photos', 'soil_log', 'weather_notes', 'recipe_notes'],
      },
    ],
    after_race: [
      {
        id: 'session-review',
        label: 'Harvest Review',
        subtitle: 'Documentation and feedback',
        moduleIds: [
          'harvest_log',
          'field_photos',
          'market_notes',
          'mentor_feedback',
          'recipe_notes',
        ],
      },
    ],
  },
}
