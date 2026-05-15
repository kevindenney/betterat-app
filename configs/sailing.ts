/**
 * Sailing Interest Event Configuration
 *
 * Extracts all sailing-specific constants into a single InterestEventConfig
 * that drives the event card experience for the sail-racing interest.
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'
import { DEBRIEF_PHASES } from '@/components/races/review/debriefQuestions'

export const SAILING_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'sail-racing',

  // ---------------------------------------------------------------------------
  // Phase labels
  // ---------------------------------------------------------------------------
  phaseLabels: {
    days_before: { full: 'Days Before', short: 'Before' },
    on_water: { full: 'On Water', short: 'Racing' },
    after_race: { full: 'After Race', short: 'Review' },
  },

  // ---------------------------------------------------------------------------
  // Event chrome
  // ---------------------------------------------------------------------------
  addEventLabel: 'Add Race',
  eventNoun: 'Race',
  teamNoun: 'Crew',
  catalogRoute: '/catalog-race',
  catalogSubtitle: 'Find and follow races',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'fleet',
      label: 'Fleet Race',
      icon: 'sail-boat',
      description: 'Standard fleet racing with multiple boats',
    },
    {
      id: 'match',
      label: 'Match Race',
      icon: 'sword-cross',
      description: 'One-on-one match racing',
    },
    {
      id: 'team',
      label: 'Team Race',
      icon: 'account-multiple',
      description: 'Team racing format',
    },
    {
      id: 'distance',
      label: 'Distance Race',
      icon: 'map-marker-multiple',
      description: 'Offshore or distance racing',
    },
    {
      id: 'blank_activity',
      label: 'Blank Step',
      icon: 'plus-circle-outline',
      description: 'Create your own — define what, why, who, and how',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'title', type: 'text', label: 'Activity Title', placeholder: 'Name this activity', required: true },
      ],
    },
  ],

  defaultSubtype: 'fleet',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    conditions: {
      id: 'conditions',
      label: 'Conditions',
      shortLabel: 'Wx',
      icon: 'weather-partly-cloudy',
      description: 'Wind, waves, and weather forecast',
    },
    strategy: {
      id: 'strategy',
      label: 'Strategy',
      shortLabel: 'Strategy',
      icon: 'compass-outline',
      description: 'Race strategy recommendations',
    },
    rig_setup: {
      id: 'rig_setup',
      label: 'Rig Setup',
      shortLabel: 'Rig',
      icon: 'tune-vertical',
      description: 'Tuning and rig settings for conditions',
    },
    course: {
      id: 'course',
      label: 'Course',
      shortLabel: 'Course',
      icon: 'map-marker-path',
      description: 'Course layout, marks, and distances',
    },
    fleet_analysis: {
      id: 'fleet_analysis',
      label: 'Fleet Analysis',
      shortLabel: 'Fleet',
      icon: 'sail-boat',
      description: 'Fleet composition and competitor insights',
    },
    regulatory: {
      id: 'regulatory',
      label: 'Regulatory',
      shortLabel: 'Rules',
      icon: 'file-document-outline',
      description: 'Sailing instructions and notices',
    },
    checklist: {
      id: 'checklist',
      label: 'Checklist',
      shortLabel: 'Tasks',
      icon: 'checkbox-marked-outline',
      description: 'Pre-race preparation checklist',
    },
    start_sequence: {
      id: 'start_sequence',
      label: 'Start Sequence',
      shortLabel: 'Start',
      icon: 'flag-checkered',
      description: 'Starting sequence and signals',
    },
    tide_currents: {
      id: 'tide_currents',
      label: 'Tides & Currents',
      shortLabel: 'Tides',
      icon: 'waves',
      description: 'Tidal state and current predictions',
    },
    competitor_notes: {
      id: 'competitor_notes',
      label: 'Competitor Notes',
      shortLabel: 'Notes',
      icon: 'account-group-outline',
      description: 'Notes on key competitors',
    },
    team_assignments: {
      id: 'team_assignments',
      label: 'Team Assignments',
      shortLabel: 'Team',
      icon: 'account-multiple',
      description: 'Team positions and pairing assignments',
    },
    match_opponent: {
      id: 'match_opponent',
      label: 'Opponent Analysis',
      shortLabel: 'Opponent',
      icon: 'sword-cross',
      description: 'Match racing opponent analysis',
    },
    distance_waypoints: {
      id: 'distance_waypoints',
      label: 'Waypoints',
      shortLabel: 'Waypoints',
      icon: 'map-marker-multiple',
      description: 'Distance race waypoints and routing',
    },
    results_preview: {
      id: 'results_preview',
      label: 'Results',
      shortLabel: 'Results',
      icon: 'podium',
      description: 'Race results and standings',
    },
    learning_notes: {
      id: 'learning_notes',
      label: 'Learning Notes',
      shortLabel: 'Learn',
      icon: 'lightbulb-outline',
      description: 'Post-race learnings and takeaways',
    },
    share_with_team: {
      id: 'share_with_team',
      label: 'Share with Team',
      shortLabel: 'Team',
      icon: 'share-variant',
      description: 'Share race prep with coach and crew',
    },
    // Blank step modules (What/Why/Who/How + media + reflection)
    plan_what: { id: 'plan_what', label: 'What', shortLabel: 'What', icon: 'help-circle-outline', description: 'Define what you\'re working on' },
    plan_why: { id: 'plan_why', label: 'Why', shortLabel: 'Why', icon: 'bulb-outline', description: 'Why does this matter?' },
    plan_who: { id: 'plan_who', label: 'Who', shortLabel: 'Who', icon: 'people-outline', description: 'Who\'s involved?' },
    plan_how: { id: 'plan_how', label: 'How', shortLabel: 'How', icon: 'map-outline', description: 'How will you approach this?' },
    progress_photos: { id: 'progress_photos', label: 'Photos', shortLabel: 'Photos', icon: 'camera', description: 'Capture visual evidence' },
    voice_memo: { id: 'voice_memo', label: 'Voice Memo', shortLabel: 'Voice', icon: 'mic', description: 'Record audio notes' },
    text_notes: { id: 'text_notes', label: 'Notes', shortLabel: 'Notes', icon: 'create', description: 'Written observations' },
    time_log: { id: 'time_log', label: 'Time Log', shortLabel: 'Timer', icon: 'timer', description: 'Track time spent' },
    gibbs_reflection: { id: 'gibbs_reflection', label: 'Gibbs Reflection', shortLabel: 'Gibbs', icon: 'sync-circle', description: 'Structured reflective cycle' },
    clinical_reasoning: { id: 'clinical_reasoning', label: 'Reasoning', shortLabel: 'Reason', icon: 'git-network', description: 'Document your reasoning' },
    self_assessment: { id: 'self_assessment', label: 'Self-Assessment', shortLabel: 'Assess', icon: 'analytics', description: 'Rate your performance' },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    conditions: { collapsed: 48, minExpanded: 120, maxExpanded: 200 },
    strategy: { collapsed: 48, minExpanded: 150, maxExpanded: 300 },
    rig_setup: { collapsed: 48, minExpanded: 100, maxExpanded: 180 },
    course: { collapsed: 48, minExpanded: 120, maxExpanded: 250 },
    fleet_analysis: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    regulatory: { collapsed: 48, minExpanded: 80, maxExpanded: 150 },
    checklist: { collapsed: 48, minExpanded: 100, maxExpanded: 250 },
    start_sequence: { collapsed: 48, minExpanded: 80, maxExpanded: 150 },
    tide_currents: { collapsed: 48, minExpanded: 100, maxExpanded: 180 },
    competitor_notes: { collapsed: 48, minExpanded: 80, maxExpanded: 200 },
    team_assignments: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    match_opponent: { collapsed: 48, minExpanded: 120, maxExpanded: 220 },
    distance_waypoints: { collapsed: 48, minExpanded: 120, maxExpanded: 250 },
    results_preview: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    learning_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 250 },
    share_with_team: { collapsed: 48, minExpanded: 100, maxExpanded: 180 },
  },

  // ---------------------------------------------------------------------------
  // Phase -> module configuration
  // ---------------------------------------------------------------------------
  phaseModuleConfig: {
    days_before: {
      phase: 'days_before',
      availableModules: [
        'conditions',
        'course',
        'fleet_analysis',
        'regulatory',
        'rig_setup',
        'checklist',
        'competitor_notes',
        'tide_currents',
        'share_with_team',
        'strategy',
        'start_sequence',
      ],
      defaultModules: [
        'conditions',
        'course',
        'checklist',
        'strategy',
        'share_with_team',
      ],
      maxModules: 6,
    },
    on_water: {
      phase: 'on_water',
      availableModules: [
        'conditions',
        'strategy',
        'tide_currents',
        'course',
        'start_sequence',
      ],
      defaultModules: ['conditions', 'strategy'],
      maxModules: 3,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'results_preview',
        'learning_notes',
        'conditions',
        'strategy',
        'competitor_notes',
        'fleet_analysis',
      ],
      defaultModules: ['results_preview', 'learning_notes'],
      maxModules: 4,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    fleet: {
      subtypeId: 'fleet',
      excludedModules: ['team_assignments', 'match_opponent', 'distance_waypoints'],
    },
    match: {
      subtypeId: 'match',
      additionalModules: ['match_opponent'],
      excludedModules: ['fleet_analysis', 'team_assignments', 'distance_waypoints'],
      labelOverrides: {
        strategy: 'Match Strategy',
        competitor_notes: 'Opponent Notes',
      },
    },
    team: {
      subtypeId: 'team',
      additionalModules: ['team_assignments'],
      excludedModules: ['match_opponent', 'distance_waypoints'],
      labelOverrides: {
        fleet_analysis: 'Team Analysis',
        strategy: 'Team Strategy',
      },
    },
    distance: {
      subtypeId: 'distance',
      additionalModules: ['distance_waypoints'],
      excludedModules: ['start_sequence', 'team_assignments', 'match_opponent'],
      labelOverrides: {
        conditions: 'Weather Outlook',
        course: 'Route',
        strategy: 'Passage Planning',
        rig_setup: 'Boat Prep',
        regulatory: 'Safety & Docs',
        checklist: 'Departure Checklist',
      },
    },
    blank_activity: {
      subtypeId: 'blank_activity',
      phaseDefaultOverrides: {
        days_before: ['plan_what', 'plan_why', 'plan_who', 'plan_how'],
        on_water: ['progress_photos', 'voice_memo', 'text_notes', 'time_log'],
        after_race: ['gibbs_reflection', 'clinical_reasoning', 'self_assessment', 'learning_notes'],
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
      description: 'High-level race performance summary',
    },
    {
      id: 'start_analysis',
      label: 'Start Analysis',
      description: 'Start execution, timing, and positioning review',
    },
    {
      id: 'upwind_analysis',
      label: 'Upwind Analysis',
      description: 'Upwind speed, shift play, and tactical review',
    },
    {
      id: 'downwind_analysis',
      label: 'Downwind Analysis',
      description: 'Downwind angles, pressure connection, and jibe timing',
    },
    {
      id: 'tactical_decisions',
      label: 'Tactical Decisions',
      description: 'Key tactical decisions and their outcomes',
    },
    {
      id: 'boat_handling',
      label: 'Boat Handling',
      description: 'Maneuver execution and boat handling assessment',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Specific areas for improvement and next steps',
    },
    {
      id: 'plan_vs_execution',
      label: 'Plan vs Execution',
      description: 'Comparison of pre-race strategy to actual race decisions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'puff_response',
      label: 'Puff Response',
      description: 'Ability to respond to puffs with correct trim and mode',
    },
    {
      id: 'shift_awareness',
      label: 'Shift Awareness',
      description: 'Recognition and use of wind shifts upwind',
    },
    {
      id: 'delayed_tack_usage',
      label: 'Delayed Tack Usage',
      description: 'Discipline to wait for the right moment to tack',
    },
    {
      id: 'downwind_detection',
      label: 'Downwind Shift Detection',
      description: 'Ability to detect and react to shifts while running',
    },
    {
      id: 'getting_in_phase',
      label: 'Getting In Phase',
      description: 'Consistency of being on the lifted tack or favored jibe',
    },
    {
      id: 'covering_tactics',
      label: 'Covering Tactics',
      description: 'Effectiveness of covering and tactical positioning',
    },
    {
      id: 'overall_framework',
      label: 'Overall Framework',
      description: 'Composite score across all framework dimensions',
    },
  ],

  // ---------------------------------------------------------------------------
  // Debrief phases (re-export from existing constant)
  // ---------------------------------------------------------------------------
  debriefPhases: DEBRIEF_PHASES,

  // ---------------------------------------------------------------------------
  // Drill / practice categories
  // ---------------------------------------------------------------------------
  drillCategories: [
    { id: 'starting', label: 'Starting', icon: 'flag' },
    { id: 'upwind', label: 'Upwind', icon: 'arrow-up' },
    { id: 'downwind', label: 'Downwind', icon: 'arrow-down' },
    { id: 'mark_rounding', label: 'Marks', icon: 'navigation' },
    { id: 'boat_handling', label: 'Boat Handling', icon: 'boat' },
    { id: 'crew_work', label: 'Crew Work', icon: 'people' },
    { id: 'rules', label: 'Rules', icon: 'book' },
    { id: 'fitness', label: 'Fitness', icon: 'fitness' },
    { id: 'general', label: 'General', icon: 'flag-checkered' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'equipment-prep', label: 'Equipment Prep' },
    { id: 'pre-race-planning', label: 'Pre-Race Planning' },
    { id: 'crew-coordination', label: 'Crew Coordination' },
    { id: 'prestart-sequence', label: 'Prestart Sequence' },
    { id: 'start-execution', label: 'Start Execution' },
    { id: 'upwind-execution', label: 'Upwind Execution' },
    { id: 'shift-awareness', label: 'Shift Awareness' },
    { id: 'windward-rounding', label: 'Windward Rounding' },
    { id: 'downwind-speed', label: 'Downwind Speed' },
    { id: 'leeward-rounding', label: 'Leeward Rounding' },
    { id: 'finish-execution', label: 'Finish Execution' },
  ],

  // ---------------------------------------------------------------------------
  // Evidence capture
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'gps_track',
      label: 'GPS Track',
      icon: 'navigate',
      type: 'gps',
      description: 'Continuous GPS track recording via CoreLocation',
    },
    secondaryCapture: [
      {
        id: 'race_timer',
        label: 'Race Timer Events',
        icon: 'timer',
        type: 'timer',
        description: 'Start sequence and leg timer events',
      },
      {
        id: 'photo',
        label: 'Photo',
        icon: 'camera',
        type: 'photo',
        description: 'Race photos and screenshots',
      },
      {
        id: 'voice_memo',
        label: 'Voice Memo',
        icon: 'microphone',
        type: 'audio',
        description: 'Voice notes during or after racing',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Reflect tab configuration
  // ---------------------------------------------------------------------------
  reflectConfig: {
    segments: [
      { value: 'progress', label: 'Progress' },
      { value: 'racelog', label: 'Race Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Races',
      hoursLabel: 'Hours on Water',
      skillsLabel: 'Skills Tracked',
      streakLabel: 'Race Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your sailing',
      primaryLegend: 'Race',
      secondaryLegend: 'Training',
      eventVerb: 'raced',
      stat1Label: 'Races',
      stat2Label: 'Podiums',
      stat3Label: 'On Water',
      stat4Label: 'Avg Finish',
      comparisonNoun: 'races',
      performanceSubtitle: 'Your average finish position over time',
      performanceEmpty: 'Complete some races to see your performance trend',
      emptyIcon: 'boat-outline',
    },
  },

  // ---------------------------------------------------------------------------
  // Tile sections (visual grouping for config-driven rendering)
  // ---------------------------------------------------------------------------
  tileSections: {
    days_before: [
      {
        id: 'race-intel',
        label: 'Race Intel',
        subtitle: 'Documents and weather forecast',
        moduleIds: ['conditions', 'course'],
      },
      {
        id: 'equipment',
        label: 'Equipment',
        subtitle: 'Sails, rigging, electronics, and safety',
        moduleIds: ['rig_setup', 'checklist'],
      },
      {
        id: 'strategy',
        label: 'Strategy',
        subtitle: 'Wind, start, and tide planning',
        moduleIds: ['strategy', 'start_sequence', 'tide_currents'],
      },
    ],
    on_water: [
      {
        id: 'live',
        label: 'Live',
        subtitle: 'Real-time conditions and strategy',
        moduleIds: ['conditions', 'strategy', 'tide_currents'],
      },
    ],
    after_race: [
      {
        id: 'review',
        label: 'Review',
        subtitle: 'Results and learnings',
        moduleIds: ['results_preview', 'learning_notes', 'competitor_notes'],
      },
    ],
  },
}
