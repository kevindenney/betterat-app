/**
 * Self-Mastery Interest Event Configuration
 *
 * Defines all self-mastery-specific constants for the BetterAt platform,
 * driving the event card experience for the self-mastery interest.
 *
 * Draws on frameworks from:
 * - Kelly McGonigal, The Willpower Instinct (I Will / I Won't / I Want, pause-and-plan)
 * - James Clear, Atomic Habits (Four Laws, identity-based habits, systems over goals)
 * - Neil Fiore, The Now Habit (procrastination as anxiety, Unschedule, guilt-free play)
 * - Brian Tracy, No Excuses (self-discipline as master skill, eat the frog)
 * - David Allen, Getting Things Done (capture, clarify, next actions, weekly review)
 * - Annie Murphy Paul, The Extended Mind (embodied, situated, distributed cognition)
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const SELF_MASTERY_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'self-mastery',

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
  addEventLabel: 'Add Practice',
  eventNoun: 'Practice',
  teamNoun: 'Circle',
  catalogRoute: '/(tabs)/learn',
  catalogSubtitle: 'Browse self-mastery programs and challenges',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'daily_practice',
      label: 'Daily Practice',
      icon: 'shield-checkmark',
      description: 'Full-day willpower tracking with I Will / I Won\'t / I Want',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        {
          id: 'i_will',
          type: 'text',
          label: 'I Will',
          placeholder: 'What I commit to doing today...',
        },
        {
          id: 'i_wont',
          type: 'text',
          label: 'I Won\'t',
          placeholder: 'What I commit to resisting today...',
        },
        {
          id: 'i_want',
          type: 'text',
          label: 'I Want',
          placeholder: 'The deeper motivation behind both...',
        },
        {
          id: 'the_frog',
          type: 'text',
          label: 'Eat the Frog',
          placeholder: 'The hardest most important thing to do first...',
        },
        {
          id: 'identity_statement',
          type: 'text',
          label: 'Identity Vote',
          placeholder: 'I am the type of person who...',
        },
      ],
    },
    {
      id: 'challenge',
      label: 'Challenge',
      icon: 'flag',
      description: 'Time-bound identity experiment with measurable commitments',
      formFields: [
        { id: 'date', type: 'date', label: 'Start Date', required: true },
        { id: 'duration', type: 'duration', label: 'Challenge Duration' },
        {
          id: 'challenge_name',
          type: 'text',
          label: 'Challenge Name',
          placeholder: 'e.g. 1700kcal for 7 days, meditate daily for 30 days',
        },
        {
          id: 'identity_target',
          type: 'text',
          label: 'Identity Target',
          placeholder: 'I am the type of person who...',
        },
        {
          id: 'success_criteria',
          type: 'text',
          label: 'Success Criteria',
          placeholder: 'Specific measurable outcome...',
        },
        {
          id: 'challenge_domain',
          type: 'multi-select',
          label: 'Domain',
          options: [
            { value: 'nutrition', label: 'Nutrition' },
            { value: 'exercise', label: 'Exercise' },
            { value: 'meditation', label: 'Meditation' },
            { value: 'productivity', label: 'Productivity' },
            { value: 'communication', label: 'Communication' },
            { value: 'sleep', label: 'Sleep' },
            { value: 'finances', label: 'Finances' },
            { value: 'learning', label: 'Learning' },
            { value: 'other', label: 'Other' },
          ],
        },
      ],
    },
    {
      id: 'meditation',
      label: 'Meditation',
      icon: 'leaf',
      description: 'Mindfulness, breath work, or body scan for interoception training',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'practice_type',
          type: 'select',
          label: 'Practice Type',
          options: [
            { value: 'breath_focus', label: 'Breath Focus' },
            { value: 'body_scan', label: 'Body Scan (Interoception)' },
            { value: 'mindfulness', label: 'Mindfulness' },
            { value: 'loving_kindness', label: 'Loving Kindness' },
            { value: 'urge_surfing', label: 'Urge Surfing' },
            { value: 'settling_in', label: 'Settling In (Pre-Work)' },
            { value: 'walking', label: 'Walking Meditation' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'guidance',
          type: 'select',
          label: 'Guidance',
          options: [
            { value: 'self_directed', label: 'Self-Directed' },
            { value: 'guided_app', label: 'Guided (App)' },
            { value: 'guided_teacher', label: 'Guided (Teacher)' },
            { value: 'group', label: 'Group Sit' },
          ],
        },
      ],
    },
    {
      id: 'habit_design',
      label: 'Habit Design',
      icon: 'construct',
      description: 'Design a new atomic habit using the Four Laws framework',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        {
          id: 'habit_statement',
          type: 'text',
          label: 'Habit',
          placeholder: 'The specific behavior to build or break...',
        },
        {
          id: 'direction',
          type: 'select',
          label: 'Direction',
          options: [
            { value: 'build', label: 'Build (new habit)' },
            { value: 'break', label: 'Break (existing habit)' },
          ],
        },
        {
          id: 'implementation_intention',
          type: 'text',
          label: 'Implementation Intention',
          placeholder: 'I will [behavior] at [time] in [location]...',
        },
        {
          id: 'habit_stack',
          type: 'text',
          label: 'Habit Stack',
          placeholder: 'After [current habit] I will [new habit]...',
        },
        {
          id: 'two_minute_version',
          type: 'text',
          label: 'Two-Minute Version',
          placeholder: 'Scaled down to start in 2 minutes or less...',
        },
      ],
    },
    {
      id: 'unschedule',
      label: 'Unschedule',
      icon: 'calendar-clear',
      description: 'Schedule play first then track focused work blocks',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        {
          id: 'play_scheduled',
          type: 'text',
          label: 'Play Scheduled',
          placeholder: 'What guilt-free play and rest is guaranteed today...',
        },
        {
          id: 'work_blocks',
          type: 'number',
          label: 'Work Blocks Completed',
          placeholder: '30-minute focused blocks actually completed',
        },
        {
          id: 'language_check',
          type: 'select',
          label: 'Self-Talk Check',
          options: [
            { value: 'i_choose', label: 'I choose to (autonomy)' },
            { value: 'i_have_to', label: 'I have to (obligation)' },
            { value: 'mixed', label: 'Mixed' },
          ],
        },
      ],
    },
    {
      id: 'weekly_review',
      label: 'Weekly Review',
      icon: 'refresh-circle',
      description: 'GTD-style system review: capture, clarify, organize, reflect',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'review_phase',
          type: 'multi-select',
          label: 'Phases Completed',
          options: [
            { value: 'capture', label: 'Capture (brain dump)' },
            { value: 'clarify', label: 'Clarify (next actions)' },
            { value: 'organize', label: 'Organize (file and sort)' },
            { value: 'reflect', label: 'Reflect (review lists)' },
            { value: 'someday_maybe', label: 'Someday/Maybe audit' },
            { value: 'horizons', label: 'Horizons of Focus check' },
          ],
        },
        {
          id: 'open_loops_captured',
          type: 'number',
          label: 'Open Loops Captured',
        },
        {
          id: 'inbox_zero',
          type: 'boolean',
          label: 'Reached inbox zero?',
        },
      ],
    },
    {
      id: 'temptation_log',
      label: 'Temptation Log',
      icon: 'alert-circle',
      description: 'Real-time impulse capture with trigger and response',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        {
          id: 'impulse',
          type: 'text',
          label: 'The Impulse',
          placeholder: 'What did you want to do...',
        },
        {
          id: 'trigger',
          type: 'select',
          label: 'Trigger Type',
          options: [
            { value: 'stress', label: 'Stress / Anxiety' },
            { value: 'boredom', label: 'Boredom' },
            { value: 'fatigue', label: 'Fatigue / Low Energy' },
            { value: 'social', label: 'Social Pressure' },
            { value: 'environment', label: 'Environmental Cue' },
            { value: 'habit', label: 'Autopilot / Habit' },
            { value: 'avoidance', label: 'Avoidance / Dread' },
            { value: 'reward', label: 'Promise of Reward' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'underlying_fear',
          type: 'select',
          label: 'Underlying Fear',
          options: [
            { value: 'failure', label: 'Fear of failure' },
            { value: 'judgment', label: 'Fear of judgment' },
            { value: 'overwhelm', label: 'Overwhelm' },
            { value: 'perfectionism', label: 'Perfectionism' },
            { value: 'none', label: 'No fear — just craving' },
            { value: 'unsure', label: 'Not sure yet' },
          ],
        },
        {
          id: 'awareness_level',
          type: 'select',
          label: 'Awareness Level',
          options: [
            { value: 'before', label: 'Caught it before acting' },
            { value: 'during', label: 'Noticed during' },
            { value: 'after', label: 'Realized after' },
            { value: 'autopilot', label: 'Full autopilot' },
          ],
        },
        {
          id: 'outcome',
          type: 'select',
          label: 'What Happened',
          options: [
            { value: 'resisted', label: 'Resisted — chose not to' },
            { value: 'redirected', label: 'Redirected — chose something else' },
            { value: 'gave_in', label: 'Gave in' },
            { value: 'delayed', label: 'Delayed — paused and decided later' },
          ],
        },
      ],
    },
    {
      id: 'environment_audit',
      label: 'Environment Audit',
      icon: 'scan',
      description: 'Assess and redesign your space, movement, and social setup',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        {
          id: 'space',
          type: 'text',
          label: 'Space',
          placeholder: 'Where are you working / practicing...',
        },
        {
          id: 'audit_focus',
          type: 'multi-select',
          label: 'Focus Areas',
          options: [
            { value: 'cue_design', label: 'Habit Cue Design' },
            { value: 'friction', label: 'Friction Reduction' },
            { value: 'nature', label: 'Nature / Attention Restoration' },
            { value: 'movement', label: 'Movement Opportunity' },
            { value: 'social', label: 'Social / Accountability Setup' },
            { value: 'analog_digital', label: 'Analog vs Digital Tools' },
            { value: 'personalization', label: 'Space Personalization' },
          ],
        },
        {
          id: 'changes_made',
          type: 'text',
          label: 'Changes Made',
          placeholder: 'What did you change about your environment...',
        },
      ],
    },
    {
      id: 'walking_think',
      label: 'Walking Think',
      icon: 'walk',
      description: 'Walking session for creative or integrative thinking',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'setting',
          type: 'select',
          label: 'Setting',
          options: [
            { value: 'nature', label: 'Nature / Park' },
            { value: 'neighborhood', label: 'Neighborhood' },
            { value: 'urban', label: 'Urban' },
            { value: 'indoor', label: 'Indoor / Treadmill' },
          ],
        },
        {
          id: 'thinking_focus',
          type: 'text',
          label: 'Thinking Focus',
          placeholder: 'What problem or question are you walking with...',
        },
        {
          id: 'social',
          type: 'select',
          label: 'Social',
          options: [
            { value: 'solo', label: 'Solo' },
            { value: 'walking_meeting', label: 'Walking Meeting' },
            { value: 'walk_and_talk', label: 'Walk and Talk (friend)' },
          ],
        },
      ],
    },
    {
      id: 'reading_study',
      label: 'Reading / Study',
      icon: 'book',
      description: 'Book chapter, course module, or concept application',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'source',
          type: 'text',
          label: 'Source',
          placeholder: 'Book title, chapter, course, podcast...',
        },
        {
          id: 'key_concept',
          type: 'text',
          label: 'Key Concept',
          placeholder: 'The main idea to apply...',
        },
        {
          id: 'experiment',
          type: 'text',
          label: 'Experiment to Try',
          placeholder: 'How will you test this concept this week...',
        },
      ],
    },
  ],

  defaultSubtype: 'daily_practice',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    // --- Intention phase modules ---
    i_will_wont_want: {
      id: 'i_will_wont_want',
      label: 'I Will / I Won\'t / I Want',
      shortLabel: 'Three Powers',
      icon: 'shield-checkmark',
      description: 'Define your three willpower commitments for the day',
    },
    identity_statement: {
      id: 'identity_statement',
      label: 'Identity Vote',
      shortLabel: 'Identity',
      icon: 'person-circle',
      description: 'I am the type of person who... Cast votes for who you want to become',
    },
    eat_the_frog: {
      id: 'eat_the_frog',
      label: 'Eat the Frog',
      shortLabel: 'Frog',
      icon: 'alert-circle',
      description: 'Your hardest most important task — do it first',
    },
    trigger_forecast: {
      id: 'trigger_forecast',
      label: 'Trigger Forecast',
      shortLabel: 'Triggers',
      icon: 'warning',
      description: 'Predict where temptation, dread, or avoidance will show up',
    },
    fear_diagnosis: {
      id: 'fear_diagnosis',
      label: 'Fear Diagnosis',
      shortLabel: 'Fears',
      icon: 'eye',
      description: 'Name the real fear: failure, judgment, overwhelm, or perfectionism',
    },
    next_actions: {
      id: 'next_actions',
      label: 'Next Actions',
      shortLabel: 'Actions',
      icon: 'arrow-forward-circle',
      description: 'Concrete next physical actions — not vague intentions',
    },
    environment_design: {
      id: 'environment_design',
      label: 'Environment Design',
      shortLabel: 'Environment',
      icon: 'grid',
      description: 'Make good cues obvious, remove bad cues, prep the space',
    },
    energy_status: {
      id: 'energy_status',
      label: 'Energy & Body Status',
      shortLabel: 'Energy',
      icon: 'body',
      description: 'Sleep, stress, body signals, interoceptive check-in',
    },
    unschedule_plan: {
      id: 'unschedule_plan',
      label: 'Unschedule',
      shortLabel: 'Unschedule',
      icon: 'calendar-clear',
      description: 'Play and rest scheduled first — work fills the gaps',
    },

    // --- Practice phase modules ---
    willpower_log: {
      id: 'willpower_log',
      label: 'Willpower Log',
      shortLabel: 'WP Log',
      icon: 'list',
      description: 'Real-time decision moments — conscious choice vs autopilot',
    },
    two_minute_wins: {
      id: 'two_minute_wins',
      label: 'Two-Minute Wins',
      shortLabel: '2-Min',
      icon: 'checkmark-circle',
      description: 'Tiny actions knocked out immediately — build momentum',
    },
    thirty_minute_block: {
      id: 'thirty_minute_block',
      label: '30-Minute Block',
      shortLabel: '30 Min',
      icon: 'timer',
      description: 'Commit to 30 min of focused work — permission to stop after',
    },
    habit_tracking: {
      id: 'habit_tracking',
      label: 'Habit Tracking',
      shortLabel: 'Habits',
      icon: 'checkbox-marked-outline',
      description: 'Visual streak for active habits — don\'t break the chain',
    },
    meditation_practice: {
      id: 'meditation_practice',
      label: 'Meditation',
      shortLabel: 'Meditate',
      icon: 'leaf',
      description: '5-minute meditation or interoception practice',
    },
    body_signals: {
      id: 'body_signals',
      label: 'Body Signals',
      shortLabel: 'Body',
      icon: 'pulse',
      description: 'What is your body telling you? Gut feelings, tension, energy',
    },
    movement_thinking: {
      id: 'movement_thinking',
      label: 'Movement & Thinking',
      shortLabel: 'Move',
      icon: 'walk',
      description: 'Walking, gesturing, moving while thinking — embodied cognition',
    },

    // --- Reflection phase modules ---
    wins_and_losses: {
      id: 'wins_and_losses',
      label: 'Wins & Losses',
      shortLabel: 'Wins',
      icon: 'trophy',
      description: 'What went right, what didn\'t, what was autopilot',
    },
    never_miss_twice: {
      id: 'never_miss_twice',
      label: 'Never Miss Twice',
      shortLabel: 'Recovery',
      icon: 'refresh',
      description: 'If you broke a streak, how quickly did you recover?',
    },
    pattern_recognition: {
      id: 'pattern_recognition',
      label: 'Pattern Recognition',
      shortLabel: 'Patterns',
      icon: 'analytics',
      description: 'AI identifies recurring triggers, avoidance, and displacement',
    },
    fear_vs_reality: {
      id: 'fear_vs_reality',
      label: 'Fear vs Reality',
      shortLabel: 'Fear Check',
      icon: 'eye-off',
      description: 'Was the dread worse than the thing itself?',
    },
    identity_evidence: {
      id: 'identity_evidence',
      label: 'Identity Evidence',
      shortLabel: 'Evidence',
      icon: 'person-circle',
      description: 'What votes did you cast today for who you want to become?',
    },
    experiment_results: {
      id: 'experiment_results',
      label: 'Experiment Results',
      shortLabel: 'Experiment',
      icon: 'flask',
      description: 'How did this week\'s personal experiment go?',
    },
    weekly_review_notes: {
      id: 'weekly_review_notes',
      label: 'Weekly Review',
      shortLabel: 'Review',
      icon: 'refresh-circle',
      description: 'GTD review: capture, clarify, organize, reflect',
    },
    environment_notes: {
      id: 'environment_notes',
      label: 'Environment Notes',
      shortLabel: 'Space',
      icon: 'grid',
      description: 'What spaces, movement, or social setups helped or hurt today?',
    },
    discipline_compound: {
      id: 'discipline_compound',
      label: 'Compound Growth',
      shortLabel: 'Compound',
      icon: 'trending-up',
      description: 'How today\'s discipline builds tomorrow\'s capacity',
    },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    i_will_wont_want: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    identity_statement: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    eat_the_frog: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    trigger_forecast: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    fear_diagnosis: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    next_actions: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    environment_design: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    energy_status: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    unschedule_plan: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    willpower_log: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    two_minute_wins: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    thirty_minute_block: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    habit_tracking: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    meditation_practice: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    body_signals: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    movement_thinking: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    wins_and_losses: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    never_miss_twice: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    pattern_recognition: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    fear_vs_reality: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    identity_evidence: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    experiment_results: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    weekly_review_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    environment_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    discipline_compound: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
  },

  // ---------------------------------------------------------------------------
  // Phase -> module configuration
  // ---------------------------------------------------------------------------
  phaseModuleConfig: {
    days_before: {
      phase: 'days_before',
      availableModules: [
        'i_will_wont_want',
        'identity_statement',
        'eat_the_frog',
        'trigger_forecast',
        'fear_diagnosis',
        'next_actions',
        'environment_design',
        'energy_status',
        'unschedule_plan',
      ],
      defaultModules: [
        'i_will_wont_want',
        'eat_the_frog',
        'identity_statement',
        'next_actions',
        'energy_status',
      ],
      maxModules: 6,
    },
    on_water: {
      phase: 'on_water',
      availableModules: [
        'willpower_log',
        'two_minute_wins',
        'thirty_minute_block',
        'habit_tracking',
        'meditation_practice',
        'body_signals',
        'movement_thinking',
      ],
      defaultModules: ['willpower_log', 'habit_tracking', 'thirty_minute_block'],
      maxModules: 4,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'wins_and_losses',
        'never_miss_twice',
        'pattern_recognition',
        'fear_vs_reality',
        'identity_evidence',
        'experiment_results',
        'weekly_review_notes',
        'environment_notes',
        'discipline_compound',
      ],
      defaultModules: ['wins_and_losses', 'identity_evidence', 'pattern_recognition'],
      maxModules: 5,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    daily_practice: {
      subtypeId: 'daily_practice',
    },
    challenge: {
      subtypeId: 'challenge',
      additionalModules: ['habit_tracking'],
      labelOverrides: {
        wins_and_losses: 'Challenge Progress',
        discipline_compound: 'Streak Status',
      },
    },
    meditation: {
      subtypeId: 'meditation',
      excludedModules: ['eat_the_frog', 'next_actions', 'thirty_minute_block', 'two_minute_wins'],
      labelOverrides: {
        energy_status: 'Pre-Meditation State',
        body_signals: 'Body Awareness',
        wins_and_losses: 'Practice Notes',
      },
    },
    habit_design: {
      subtypeId: 'habit_design',
      additionalModules: ['environment_design'],
      labelOverrides: {
        trigger_forecast: 'Cue Design',
        experiment_results: 'Habit Experiment Results',
      },
    },
    unschedule: {
      subtypeId: 'unschedule',
      excludedModules: ['eat_the_frog'],
      labelOverrides: {
        i_will_wont_want: 'Today\'s Commitments',
        thirty_minute_block: 'Focused Work Block',
        wins_and_losses: 'Work vs Play Balance',
      },
    },
    weekly_review: {
      subtypeId: 'weekly_review',
      excludedModules: [
        'i_will_wont_want',
        'eat_the_frog',
        'trigger_forecast',
        'fear_diagnosis',
        'willpower_log',
        'thirty_minute_block',
        'meditation_practice',
      ],
      labelOverrides: {
        next_actions: 'Clarified Next Actions',
        wins_and_losses: 'Week in Review',
        pattern_recognition: 'Weekly Patterns',
      },
      phaseDefaultOverrides: {
        days_before: ['next_actions', 'energy_status'],
        after_race: ['wins_and_losses', 'pattern_recognition', 'weekly_review_notes'],
      },
    },
    temptation_log: {
      subtypeId: 'temptation_log',
      excludedModules: [
        'eat_the_frog',
        'next_actions',
        'unschedule_plan',
        'thirty_minute_block',
        'two_minute_wins',
        'weekly_review_notes',
      ],
      labelOverrides: {
        willpower_log: 'Impulse Detail',
        fear_vs_reality: 'Was the Dread Worse?',
      },
    },
    environment_audit: {
      subtypeId: 'environment_audit',
      additionalModules: ['environment_design', 'environment_notes'],
      labelOverrides: {
        trigger_forecast: 'Cue Audit',
      },
    },
    walking_think: {
      subtypeId: 'walking_think',
      excludedModules: [
        'eat_the_frog',
        'thirty_minute_block',
        'two_minute_wins',
        'weekly_review_notes',
      ],
      labelOverrides: {
        movement_thinking: 'Walk Notes',
        body_signals: 'Post-Walk State',
      },
    },
    reading_study: {
      subtypeId: 'reading_study',
      labelOverrides: {
        experiment_results: 'Concept Application',
        identity_evidence: 'How This Changes My Identity',
      },
    },
  },

  // ---------------------------------------------------------------------------
  // AI analysis sections
  // ---------------------------------------------------------------------------
  aiAnalysisSections: [
    {
      id: 'awareness_score',
      label: 'Awareness Score',
      description: 'Decision points caught consciously vs autopilot',
    },
    {
      id: 'identity_alignment',
      label: 'Identity Alignment',
      description: 'Are daily actions voting for or against the stated identity?',
    },
    {
      id: 'frog_compliance',
      label: 'Frog Compliance',
      description: 'Did you do the hardest thing first and how often?',
    },
    {
      id: 'avoidance_pattern_map',
      label: 'Avoidance Pattern Map',
      description: 'Recurring triggers by time, location, emotion, and displacement behaviors',
    },
    {
      id: 'fear_diagnosis_trend',
      label: 'Fear Diagnosis',
      description: 'Which fears are driving procrastination and are they shifting?',
    },
    {
      id: 'system_trust_score',
      label: 'System Trust',
      description: 'Are commitments captured and reviewed? Is the GTD system maintained?',
    },
    {
      id: 'habit_scorecard',
      label: 'Habit Scorecard',
      description: 'Four Laws audit: are habits obvious, attractive, easy, satisfying?',
    },
    {
      id: 'extended_mind_usage',
      label: 'Extended Mind Usage',
      description: 'Leveraging body, space, and social resources vs brute-forcing in your head',
    },
    {
      id: 'streak_momentum',
      label: 'Streak & Momentum',
      description: 'Consistency across active challenges and never-miss-twice compliance',
    },
    {
      id: 'compound_growth',
      label: 'Compound Growth',
      description: 'Week-over-week trend in discipline capacity and habit stacking',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'self_awareness',
      label: 'Self-Awareness',
      description: 'Catching impulses, noticing autopilot, interoception accuracy',
    },
    {
      id: 'i_will_power',
      label: 'I Will Power',
      description: 'Follow-through on commitments and eating the frog',
    },
    {
      id: 'i_wont_power',
      label: 'I Won\'t Power',
      description: 'Resistance to temptation and craving surfing',
    },
    {
      id: 'i_want_clarity',
      label: 'I Want Clarity',
      description: 'Connection to deeper motivation and identity',
    },
    {
      id: 'anxiety_management',
      label: 'Anxiety Management',
      description: 'Recognizing fear-driven avoidance and choosing autonomy over obligation',
    },
    {
      id: 'system_integrity',
      label: 'System Integrity',
      description: 'GTD capture rate, weekly review consistency, next-action clarity',
    },
    {
      id: 'habit_architecture',
      label: 'Habit Architecture',
      description: 'Environment design, habit stacking, two-minute rule, Four Laws usage',
    },
    {
      id: 'embodied_cognition',
      label: 'Embodied Cognition',
      description: 'Using body signals, movement, and gesture as thinking tools',
    },
    {
      id: 'environmental_design',
      label: 'Environmental Design',
      description: 'Space optimization, nature exposure, cue management',
    },
    {
      id: 'social_cognition',
      label: 'Social Cognition',
      description: 'Using other people as cognitive resources and accountability',
    },
    {
      id: 'recovery',
      label: 'Recovery',
      description: 'Bouncing back after a slip with self-compassion not guilt',
    },
    {
      id: 'consistency',
      label: 'Consistency',
      description: 'Showing up day after day and the compound effect',
    },
  ],

  // ---------------------------------------------------------------------------
  // Debrief phases
  // ---------------------------------------------------------------------------
  debriefPhases: [
    {
      id: 'awareness',
      title: 'Awareness',
      emoji: '\uD83D\uDC41',
      description: 'How present were you to your decisions today?',
      questions: [
        {
          id: 'decisions_noticed',
          type: 'select',
          label: 'How many decision points did you consciously notice?',
          options: [
            { value: 'many', label: 'Many — caught most impulses in real time' },
            { value: 'several', label: 'Several — caught some, missed some' },
            { value: 'few', label: 'Few — mostly on autopilot' },
            { value: 'none', label: 'None — didn\'t think about it' },
          ],
        },
        {
          id: 'autopilot_moments',
          type: 'textarea',
          label: 'Any autopilot moments you caught after the fact?',
          placeholder: 'Reached for phone, grabbed a snack, opened social media...',
        },
        {
          id: 'body_awareness',
          type: 'select',
          label: 'Did you notice body signals (tension, gut feelings, energy)?',
          options: [
            { value: 'tuned_in', label: 'Tuned in — used body as radar' },
            { value: 'somewhat', label: 'Somewhat — noticed a few signals' },
            { value: 'disconnected', label: 'Disconnected — all in my head' },
          ],
        },
      ],
    },
    {
      id: 'resistance',
      title: 'Resistance',
      emoji: '\uD83D\uDEE1',
      description: 'What did you face and how did you respond?',
      questions: [
        {
          id: 'dread_experienced',
          type: 'boolean',
          label: 'Did you feel dread or avoidance about something today?',
        },
        {
          id: 'dread_source',
          type: 'select',
          label: 'What was the underlying driver?',
          options: [
            { value: 'fear_failure', label: 'Fear of failure' },
            { value: 'fear_judgment', label: 'Fear of being judged' },
            { value: 'overwhelm', label: 'Overwhelm — too big to start' },
            { value: 'perfectionism', label: 'Perfectionism — can\'t be good enough' },
            { value: 'resentment', label: 'Resentment — I don\'t want to be told' },
            { value: 'fatigue', label: 'Just tired / depleted' },
            { value: 'none', label: 'No resistance today' },
          ],
          showWhen: {
            questionId: 'dread_experienced',
            answerIn: ['true'],
          },
        },
        {
          id: 'dread_vs_reality',
          type: 'select',
          label: 'Was the dread worse than the thing itself?',
          options: [
            { value: 'much_worse', label: 'Much worse — the thing was easy' },
            { value: 'somewhat_worse', label: 'Somewhat worse' },
            { value: 'about_right', label: 'About right — it was hard' },
            { value: 'didnt_do_it', label: 'Didn\'t do it — still avoiding' },
          ],
          showWhen: {
            questionId: 'dread_experienced',
            answerIn: ['true'],
          },
        },
        {
          id: 'language_used',
          type: 'select',
          label: 'What self-talk dominated today?',
          options: [
            { value: 'i_choose', label: 'I choose to / I want to (autonomy)' },
            { value: 'i_have_to', label: 'I have to / I should (obligation)' },
            { value: 'mixed', label: 'Mixed' },
            { value: 'didnt_notice', label: 'Didn\'t notice' },
          ],
        },
      ],
    },
    {
      id: 'identity',
      title: 'Identity',
      emoji: '\uD83E\uDE9E',
      description: 'Who did your actions say you are today?',
      questions: [
        {
          id: 'identity_votes',
          type: 'select',
          label: 'How many actions today voted for the person you want to become?',
          options: [
            { value: 'strong_majority', label: 'Strong majority — clear identity alignment' },
            { value: 'slight_majority', label: 'Slight majority — more good than bad' },
            { value: 'split', label: 'Split — mixed signals' },
            { value: 'minority', label: 'Minority — mostly off-track' },
          ],
        },
        {
          id: 'strongest_vote',
          type: 'textarea',
          label: 'What was your strongest identity vote today?',
          placeholder: 'The action that most proved who you\'re becoming...',
        },
        {
          id: 'habit_streak',
          type: 'select',
          label: 'Active habit streak status',
          options: [
            { value: 'maintained', label: 'Maintained — chain unbroken' },
            { value: 'recovered', label: 'Broke it but recovered today (never miss twice)' },
            { value: 'broken', label: 'Broken — need to restart' },
            { value: 'no_streak', label: 'No active streak' },
          ],
        },
      ],
    },
    {
      id: 'execution',
      title: 'Execution',
      emoji: '\uD83D\uDC38',
      description: 'Did you do what mattered most?',
      questions: [
        {
          id: 'frog_eaten',
          type: 'select',
          label: 'Did you eat the frog?',
          options: [
            { value: 'first_thing', label: 'Yes — first thing' },
            { value: 'eventually', label: 'Yes — but not first' },
            { value: 'partially', label: 'Partially — started but didn\'t finish' },
            { value: 'no', label: 'No — avoided it' },
          ],
        },
        {
          id: 'focused_blocks',
          type: 'select',
          label: 'How many 30-minute focused blocks did you complete?',
          options: [
            { value: '4_plus', label: '4+ blocks — deep work day' },
            { value: '2_3', label: '2-3 blocks — solid' },
            { value: '1', label: '1 block — at least I started' },
            { value: '0', label: '0 blocks — couldn\'t get traction' },
          ],
        },
        {
          id: 'open_loops',
          type: 'select',
          label: 'Open loop status',
          options: [
            { value: 'all_captured', label: 'All captured in a trusted system' },
            { value: 'mostly', label: 'Mostly captured — a few floating' },
            { value: 'many_loose', label: 'Many loose — need a brain dump' },
          ],
        },
        {
          id: 'two_minute_rule',
          type: 'boolean',
          label: 'Did you apply the two-minute rule (do tiny tasks immediately)?',
        },
      ],
    },
    {
      id: 'environment',
      title: 'Environment',
      emoji: '\uD83C\uDF3F',
      description: 'How did your body, space, and social world support you?',
      questions: [
        {
          id: 'movement',
          type: 'select',
          label: 'Did you move your body today?',
          options: [
            { value: 'intentional', label: 'Intentional exercise + movement throughout day' },
            { value: 'some', label: 'Some movement — walk, stretch, etc.' },
            { value: 'sedentary', label: 'Mostly sedentary' },
          ],
        },
        {
          id: 'nature_exposure',
          type: 'boolean',
          label: 'Did you get nature exposure (outdoors, park, even a window view)?',
        },
        {
          id: 'space_quality',
          type: 'select',
          label: 'How well did your physical space support your work?',
          options: [
            { value: 'excellent', label: 'Excellent — intentionally designed' },
            { value: 'adequate', label: 'Adequate — worked fine' },
            { value: 'hindered', label: 'Hindered — space worked against me' },
          ],
        },
        {
          id: 'social_support',
          type: 'select',
          label: 'Did you engage with others as a thinking or accountability resource?',
          options: [
            { value: 'yes_helpful', label: 'Yes — it helped' },
            { value: 'yes_unhelpful', label: 'Yes — but it didn\'t help' },
            { value: 'no', label: 'No — solo today' },
          ],
        },
        {
          id: 'analog_vs_digital',
          type: 'select',
          label: 'Did digital tools help or hurt today?',
          options: [
            { value: 'helped', label: 'Helped — tools extended my thinking' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'hurt', label: 'Hurt — screens contracted my thinking' },
          ],
        },
      ],
    },
    {
      id: 'recovery_compassion',
      title: 'Recovery',
      emoji: '\uD83D\uDCA7',
      description: 'How did you handle setbacks?',
      questions: [
        {
          id: 'slip_today',
          type: 'boolean',
          label: 'Did you slip on any commitment today?',
        },
        {
          id: 'response_to_slip',
          type: 'select',
          label: 'How did you respond?',
          options: [
            { value: 'compassion_restart', label: 'Self-compassion — got back on track' },
            { value: 'guilt_restart', label: 'Felt guilty but got back on track' },
            { value: 'what_the_hell', label: 'What-the-hell effect — gave up for the day' },
            { value: 'didnt_notice', label: 'Didn\'t notice until now' },
          ],
          showWhen: {
            questionId: 'slip_today',
            answerIn: ['true'],
          },
        },
        {
          id: 'play_scheduled',
          type: 'boolean',
          label: 'Did you have guilt-free play / rest today?',
        },
        {
          id: 'overall_feeling',
          type: 'select',
          label: 'How do you feel about today overall?',
          options: [
            { value: 'powerful', label: 'Powerful — I chose well' },
            { value: 'solid', label: 'Solid — good day' },
            { value: 'mixed', label: 'Mixed — some wins some losses' },
            { value: 'tough', label: 'Tough — grinded through' },
            { value: 'learning', label: 'Learning day — valuable data' },
          ],
        },
        {
          id: 'key_insight',
          type: 'textarea',
          label: 'One key insight from today?',
          placeholder: 'The one thing worth remembering...',
        },
      ],
    },
  ],

  // ---------------------------------------------------------------------------
  // Drill / practice categories
  // ---------------------------------------------------------------------------
  drillCategories: [
    { id: 'meditation', label: 'Meditation', icon: 'leaf' },
    { id: 'impulse_awareness', label: 'Impulse Awareness', icon: 'eye' },
    { id: 'habit_design', label: 'Habit Design', icon: 'construct' },
    { id: 'environment_design', label: 'Environment Design', icon: 'grid' },
    { id: 'deep_work', label: 'Deep Work', icon: 'timer' },
    { id: 'gtd_processing', label: 'GTD Processing', icon: 'arrow-forward-circle' },
    { id: 'fear_work', label: 'Fear & Resistance Work', icon: 'eye-off' },
    { id: 'identity_practice', label: 'Identity Practice', icon: 'person-circle' },
    { id: 'movement_cognition', label: 'Movement & Cognition', icon: 'walk' },
    { id: 'social_accountability', label: 'Social & Accountability', icon: 'people' },
    { id: 'reading_application', label: 'Reading & Application', icon: 'book' },
    { id: 'general', label: 'General', icon: 'shield-checkmark' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    // McGonigal
    { id: 'i-will-power', label: 'I Will Power' },
    { id: 'i-wont-power', label: 'I Won\'t Power' },
    { id: 'i-want-clarity', label: 'I Want Clarity' },
    { id: 'pause-and-plan', label: 'Pause & Plan Response' },
    { id: 'urge-surfing', label: 'Urge Surfing' },
    // Clear
    { id: 'identity-alignment', label: 'Identity Alignment' },
    { id: 'cue-design', label: 'Cue & Environment Design' },
    { id: 'habit-stacking', label: 'Habit Stacking' },
    { id: 'streak-maintenance', label: 'Streak Maintenance' },
    // Fiore
    { id: 'anxiety-recognition', label: 'Anxiety Recognition' },
    { id: 'autonomy-language', label: 'Autonomy Language (I Choose)' },
    { id: 'play-rest-balance', label: 'Play & Rest Balance' },
    // Tracy
    { id: 'frog-eating', label: 'Eat the Frog Discipline' },
    { id: 'single-handling', label: 'Single-Handling Focus' },
    // Allen
    { id: 'capture-practice', label: 'Capture Practice' },
    { id: 'next-action-thinking', label: 'Next-Action Thinking' },
    { id: 'weekly-review', label: 'Weekly Review' },
    // Paul
    { id: 'interoception', label: 'Interoception (Body Signals)' },
    { id: 'embodied-thinking', label: 'Embodied Thinking (Movement)' },
    { id: 'space-cognition', label: 'Space & Cognition' },
    { id: 'social-cognition', label: 'Social Cognition' },
  ],

  // ---------------------------------------------------------------------------
  // Evidence capture
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'conversation_log',
      label: 'AI Conversation',
      icon: 'chatbubbles',
      type: 'text',
      description: 'Real-time conversational capture of impulses, decisions, and reflections',
    },
    secondaryCapture: [
      {
        id: 'voice_memo',
        label: 'Voice Memo',
        icon: 'microphone',
        type: 'audio',
        description: 'Voice capture of in-the-moment impulses and reflections',
      },
      {
        id: 'journal_entry',
        label: 'Journal Entry',
        icon: 'document-text',
        type: 'text',
        description: 'Written journal for deeper reflection and pattern analysis',
      },
      {
        id: 'photo',
        label: 'Photo',
        icon: 'camera',
        type: 'photo',
        description: 'Environment photos, whiteboard captures, habit tracker photos',
      },
      {
        id: 'health_data',
        label: 'Health Data',
        icon: 'watch',
        type: 'health_data',
        description: 'HRV, sleep, activity from wearables for willpower biology',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Reflect tab configuration
  // ---------------------------------------------------------------------------
  reflectConfig: {
    segments: [
      { value: 'progress', label: 'Progress' },
      { value: 'practice_log', label: 'Practice Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Practices',
      hoursLabel: 'Practice Hours',
      skillsLabel: 'Skills',
      streakLabel: 'Practice Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your practice',
      primaryLegend: 'Practice',
      secondaryLegend: 'Rest',
      eventVerb: 'practiced',
      stat1Label: 'Practices',
      stat2Label: 'Streaks',
      stat3Label: 'Practice',
      stat4Label: 'Awareness',
      comparisonNoun: 'practices',
      performanceSubtitle: 'Your self-mastery growth over time',
      performanceEmpty: 'Complete some practices to see your progress trend',
      emptyIcon: 'shield-checkmark-outline',
    },
  },

  // ---------------------------------------------------------------------------
  // Tile sections (visual grouping for config-driven rendering)
  // ---------------------------------------------------------------------------
  tileSections: {
    days_before: [
      {
        id: 'willpower-commitment',
        label: 'Willpower Commitment',
        subtitle: 'Three powers, identity, and the frog',
        moduleIds: ['i_will_wont_want', 'identity_statement', 'eat_the_frog'],
      },
      {
        id: 'resistance-forecast',
        label: 'Resistance Forecast',
        subtitle: 'Predict triggers, name fears, design environment',
        moduleIds: ['trigger_forecast', 'fear_diagnosis', 'environment_design'],
      },
      {
        id: 'readiness-system',
        label: 'Readiness & System',
        subtitle: 'Energy, next actions, and the unschedule',
        moduleIds: ['energy_status', 'next_actions', 'unschedule_plan'],
      },
    ],
    on_water: [
      {
        id: 'active-practice',
        label: 'Active Practice',
        subtitle: 'Willpower log, habits, focused work, and meditation',
        moduleIds: ['willpower_log', 'habit_tracking', 'thirty_minute_block', 'meditation_practice'],
      },
      {
        id: 'embodied-awareness',
        label: 'Embodied Awareness',
        subtitle: 'Body signals, movement, and two-minute wins',
        moduleIds: ['body_signals', 'movement_thinking', 'two_minute_wins'],
      },
    ],
    after_race: [
      {
        id: 'daily-review',
        label: 'Daily Review',
        subtitle: 'Wins, identity evidence, and recovery',
        moduleIds: ['wins_and_losses', 'identity_evidence', 'never_miss_twice'],
      },
      {
        id: 'pattern-insight',
        label: 'Pattern & Insight',
        subtitle: 'AI patterns, fear check, and experiment results',
        moduleIds: ['pattern_recognition', 'fear_vs_reality', 'experiment_results'],
      },
      {
        id: 'system-growth',
        label: 'System & Growth',
        subtitle: 'Weekly review, environment notes, and compound growth',
        moduleIds: ['weekly_review_notes', 'environment_notes', 'discipline_compound'],
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // AI measurement extraction
  // ---------------------------------------------------------------------------
  measurementConfig: {
    enabled: true,
    categories: ['health', 'performance'],
    prTrackingEnabled: false,
    progressiveOverloadDetection: false,
  },

  // ---------------------------------------------------------------------------
  // Nutrition tracking (optional — enabled when challenge involves nutrition)
  // ---------------------------------------------------------------------------
  nutritionConfig: {
    enabled: true,
    targets: [
      { label: 'Calories', key: 'calories_daily', unit: 'cal' },
      { label: 'Protein', key: 'protein_daily_g', unit: 'g' },
      { label: 'Fiber', key: 'fiber_daily_g', unit: 'g' },
    ],
    mealTypes: [
      { value: 'breakfast', label: 'Breakfast' },
      { value: 'lunch', label: 'Lunch' },
      { value: 'dinner', label: 'Dinner' },
      { value: 'snack', label: 'Snack' },
    ],
  },
}
