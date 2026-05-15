/**
 * Generic Interest Event Configuration
 *
 * Provides a sensible default for interests that don't yet have a dedicated
 * config file. Uses neutral terminology ("Activity", "Session") so no
 * interest-specific jargon leaks through.
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

/**
 * Build a generic config with a custom eventNoun / slug.
 * Keeps all module and debrief structure neutral.
 */
export function makeGenericEventConfig(
  slug: string,
  eventNoun: string,
  opts?: { teamNoun?: string; addEventLabel?: string },
): InterestEventConfig {
  return {
    interestSlug: slug,

    phaseLabels: {
      days_before: { full: 'Plan', short: 'Plan' },
      on_water: { full: 'Do', short: 'Do' },
      after_race: { full: 'Reflect', short: 'Reflect' },
    },

    addEventLabel: opts?.addEventLabel ?? `Add ${eventNoun}`,
    eventNoun,
    teamNoun: opts?.teamNoun ?? 'Group',
    catalogRoute: '/(tabs)/learn',
    catalogSubtitle: `Browse programs and resources`,

    eventSubtypes: [
      {
        id: 'session',
        label: eventNoun,
        icon: 'calendar',
        description: `A ${eventNoun.toLowerCase()} event`,
        formFields: [
          { id: 'date', type: 'date', label: 'Date', required: true },
          { id: 'duration', type: 'duration', label: 'Duration' },
          { id: 'notes', type: 'text', label: 'Notes', placeholder: 'Any details...' },
        ],
      },
    ],

    defaultSubtype: 'session',

    moduleInfo: {
      preparation: {
        id: 'preparation',
        label: 'Preparation',
        shortLabel: 'Prep',
        icon: 'clipboard',
        description: 'Prepare for this activity',
      },
      notes: {
        id: 'notes',
        label: 'Notes',
        shortLabel: 'Notes',
        icon: 'document-text',
        description: 'Capture notes during the activity',
      },
      reflection: {
        id: 'reflection',
        label: 'Reflection',
        shortLabel: 'Reflect',
        icon: 'book',
        description: 'Reflect on what happened',
      },
      checklist: {
        id: 'checklist',
        label: 'Checklist',
        shortLabel: 'Tasks',
        icon: 'checkbox-marked-outline',
        description: 'Track preparation tasks',
      },
    },

    moduleHeights: {
      preparation: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
      notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
      reflection: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
      checklist: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    },

    phaseModuleConfig: {
      days_before: {
        phase: 'days_before',
        availableModules: ['preparation', 'checklist'],
        defaultModules: ['preparation', 'checklist'],
        maxModules: 4,
      },
      on_water: {
        phase: 'on_water',
        availableModules: ['notes'],
        defaultModules: ['notes'],
        maxModules: 4,
      },
      after_race: {
        phase: 'after_race',
        availableModules: ['reflection', 'notes'],
        defaultModules: ['reflection'],
        maxModules: 4,
      },
    },

    subtypeOverrides: {},

    aiAnalysisSections: [
      { id: 'overall_summary', label: 'Overall Summary', description: 'High-level activity summary' },
      { id: 'recommendations', label: 'Recommendations', description: 'Suggested next steps' },
    ],

    frameworkScores: [
      { id: 'overall_progress', label: 'Overall Progress', description: 'Composite progress score' },
    ],

    debriefPhases: [
      {
        id: 'reflection',
        title: 'Reflection',
        emoji: '\uD83D\uDCDD',
        description: 'Looking back at this activity',
        questions: [
          {
            id: 'overall_feeling',
            type: 'select',
            label: 'How did it go?',
            options: [
              { value: 'great', label: 'Great \u2014 exceeded expectations' },
              { value: 'good', label: 'Good \u2014 solid progress' },
              { value: 'okay', label: 'Okay \u2014 some value' },
              { value: 'difficult', label: 'Difficult \u2014 struggled' },
            ],
          },
          {
            id: 'key_learning',
            type: 'textarea',
            label: 'Key learning?',
            placeholder: 'What stood out...',
          },
          {
            id: 'next_step',
            type: 'textarea',
            label: 'What will you do differently next time?',
            placeholder: 'One thing to change...',
          },
        ],
      },
    ],

    drillCategories: [
      { id: 'practice', label: 'Practice', icon: 'fitness' },
    ],

    skillAreas: [
      { id: 'general', label: 'General' },
    ],

    evidenceCapture: {
      primaryCapture: {
        id: 'note',
        label: 'Note',
        icon: 'document-text',
        type: 'text',
        description: 'Capture a note about this activity',
      },
      secondaryCapture: [
        {
          id: 'photo',
          label: 'Photo',
          icon: 'camera',
          type: 'photo',
          description: 'Add a photo',
        },
      ],
    },

    reflectConfig: {
      segments: [
        { value: 'progress', label: 'Progress' },
        { value: 'session_log', label: 'Activity Log' },
        { value: 'profile', label: 'Profile' },
      ],
      progressStats: {
        eventsLabel: 'Activities',
        hoursLabel: 'Hours',
        skillsLabel: 'Skills',
        streakLabel: 'Streak',
      },
      progressLabels: {
        seeMoreText: 'See more of your journey',
        primaryLegend: eventNoun,
        secondaryLegend: 'Practice',
        eventVerb: 'completed',
        stat1Label: 'Activities',
        stat2Label: 'Programs',
        stat3Label: 'In Group',
        stat4Label: 'Score',
        comparisonNoun: 'activities',
        performanceSubtitle: 'Your progress over time',
        performanceEmpty: 'Complete some activities to see your progress trend',
        emptyIcon: 'bar-chart-outline',
      },
    },

    tileSections: {
      days_before: [],
      on_water: [
        {
          id: 'active',
          label: 'In Progress',
          subtitle: 'Active session tools',
          moduleIds: ['notes'],
        },
      ],
      after_race: [
        {
          id: 'review',
          label: 'Review',
          subtitle: 'Reflection and notes',
          moduleIds: ['reflection', 'notes'],
        },
      ],
    },
  }
}

/** Default generic config (uses "Activity" as the event noun) */
export const GENERIC_EVENT_CONFIG = makeGenericEventConfig('generic', 'Activity')
