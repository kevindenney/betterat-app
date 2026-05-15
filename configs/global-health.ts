/**
 * Global Health Interest Event Configuration
 *
 * Defines the global-health-specific constants as a single InterestEventConfig
 * that drives the event card experience for the global health interest.
 *
 * Anchor org: Mayan Health Initiative (Chicago / San Marcos, Guatemala)
 */

import type { InterestEventConfig } from '@/types/interestEventConfig'

export const GLOBAL_HEALTH_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  interestSlug: 'global-health',

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
  addEventLabel: 'Add Mission',
  eventNoun: 'Mission',
  teamNoun: 'Team',
  catalogRoute: '/(tabs)/learn',
  catalogSubtitle: 'Browse programs, missions, and health initiatives',

  // ---------------------------------------------------------------------------
  // Event subtypes
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'medical_mission',
      label: 'Medical Mission',
      icon: 'airplane',
      description: 'Multi-day medical mission trip to underserved communities',
      formFields: [
        { id: 'date', type: 'date', label: 'Start Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Community or region' },
        {
          id: 'mission_type',
          type: 'select',
          label: 'Mission Type',
          options: [
            { value: 'pediatric', label: 'Pediatric' },
            { value: 'surgical', label: 'Surgical' },
            { value: 'maternal', label: 'Maternal Health' },
            { value: 'rehab', label: 'Rehabilitation' },
            { value: 'nutrition', label: 'Nutrition' },
            { value: 'general', label: 'General Medical' },
          ],
        },
        { id: 'team_size', type: 'number', label: 'Team Size', placeholder: 'Number of volunteers' },
      ],
    },
    {
      id: 'clinic_day',
      label: 'Clinic Day',
      icon: 'medkit',
      description: 'Single-day pediatric or general clinic session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'location', type: 'text', label: 'Clinic Location', placeholder: 'Clinic or community name' },
        { id: 'patient_count', type: 'number', label: 'Patients Seen', placeholder: 'Number of patients' },
        {
          id: 'specialty',
          type: 'select',
          label: 'Specialty',
          options: [
            { value: 'pediatrics', label: 'Pediatrics' },
            { value: 'general', label: 'General Medicine' },
            { value: 'dental', label: 'Dental' },
            { value: 'ophthal', label: 'Ophthalmology' },
            { value: 'dermatology', label: 'Dermatology' },
          ],
        },
      ],
    },
    {
      id: 'rehab_session',
      label: 'Rehabilitation Session',
      icon: 'accessibility',
      description: 'Physical, occupational, or speech therapy session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'therapy_type',
          type: 'select',
          label: 'Therapy Type',
          options: [
            { value: 'physical', label: 'Physical Therapy' },
            { value: 'occupational', label: 'Occupational Therapy' },
            { value: 'speech', label: 'Speech Therapy' },
          ],
        },
        { id: 'patient_count', type: 'number', label: 'Patients Treated', placeholder: 'Number of patients' },
      ],
    },
    {
      id: 'nutrition_screening',
      label: 'Nutrition Screening',
      icon: 'nutrition',
      description: 'Malnutrition screening and supplement distribution',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'location', type: 'text', label: 'Community', placeholder: 'Village or community name' },
        { id: 'children_screened', type: 'number', label: 'Children Screened', placeholder: 'Number screened' },
        { id: 'malnourished_identified', type: 'number', label: 'Malnourished Identified', placeholder: 'Cases identified' },
        {
          id: 'supplements',
          type: 'select',
          label: 'Supplements Distributed',
          options: [
            { value: 'nutributter', label: 'Nutributter' },
            { value: 'plumpy_nut', label: "Plumpy'Nut" },
            { value: 'vitamins', label: 'Vitamins' },
            { value: 'other', label: 'Other' },
          ],
        },
      ],
    },
    {
      id: 'ultrasound_session',
      label: 'Ultrasound Session',
      icon: 'pulse',
      description: 'Feto-maternal ultrasound for prenatal care',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'location', type: 'text', label: 'Clinic Location', placeholder: 'Clinic name' },
        { id: 'scans_performed', type: 'number', label: 'Scans Performed', placeholder: 'Number of scans' },
        { id: 'high_risk_identified', type: 'number', label: 'High-Risk Identified', placeholder: 'High-risk pregnancies' },
      ],
    },
    {
      id: 'fundraising_event',
      label: 'Fundraising Event',
      icon: 'heart',
      description: 'Gala, benefit, donor event, or campaign',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'event_name', type: 'text', label: 'Event Name', placeholder: 'Name of the event' },
        {
          id: 'event_type',
          type: 'select',
          label: 'Event Type',
          options: [
            { value: 'gala', label: 'Gala / Dinner' },
            { value: 'benefit', label: 'Benefit Concert / Show' },
            { value: 'online', label: 'Online Campaign' },
            { value: 'run_walk', label: 'Run / Walk' },
            { value: 'auction', label: 'Auction' },
            { value: 'donor_meeting', label: 'Donor Meeting' },
          ],
        },
        { id: 'attendees', type: 'number', label: 'Attendees', placeholder: 'Number of attendees' },
      ],
    },
  ],

  defaultSubtype: 'medical_mission',

  // ---------------------------------------------------------------------------
  // Content module metadata
  // ---------------------------------------------------------------------------
  moduleInfo: {
    patient_intake: {
      id: 'patient_intake',
      label: 'Patient Intake',
      shortLabel: 'Intake',
      icon: 'clipboard',
      description: 'Patient registration and initial assessment',
    },
    supply_inventory: {
      id: 'supply_inventory',
      label: 'Supply Inventory',
      shortLabel: 'Supplies',
      icon: 'cube',
      description: 'Medical supplies, medications, and equipment tracking',
    },
    clinic_notes: {
      id: 'clinic_notes',
      label: 'Clinic Notes',
      shortLabel: 'Notes',
      icon: 'document-text',
      description: 'Clinical observations and treatment notes',
    },
    community_assessment: {
      id: 'community_assessment',
      label: 'Community Assessment',
      shortLabel: 'Community',
      icon: 'people',
      description: 'Community health needs and demographics assessment',
    },
    ultrasound_log: {
      id: 'ultrasound_log',
      label: 'Ultrasound Log',
      shortLabel: 'Ultrasound',
      icon: 'pulse',
      description: 'Feto-maternal ultrasound findings and referrals',
    },
    rehab_progress: {
      id: 'rehab_progress',
      label: 'Rehab Progress',
      shortLabel: 'Rehab',
      icon: 'accessibility',
      description: 'Rehabilitation therapy progress and milestones',
    },
    nutrition_tracking: {
      id: 'nutrition_tracking',
      label: 'Nutrition Tracking',
      shortLabel: 'Nutrition',
      icon: 'nutrition',
      description: 'Malnutrition screening data and supplement distribution',
    },
    donor_report: {
      id: 'donor_report',
      label: 'Donor Report',
      shortLabel: 'Donors',
      icon: 'heart',
      description: 'Impact metrics and donor communication',
    },
    mission_logistics: {
      id: 'mission_logistics',
      label: 'Mission Logistics',
      shortLabel: 'Logistics',
      icon: 'map',
      description: 'Travel, lodging, and operational logistics',
    },
    team_roster: {
      id: 'team_roster',
      label: 'Team Roster',
      shortLabel: 'Team',
      icon: 'people-circle',
      description: 'Volunteer and staff assignments and roles',
    },
    progress_photos: {
      id: 'progress_photos',
      label: 'Progress Photos',
      shortLabel: 'Photos',
      icon: 'camera',
      description: 'Photos documenting clinical work and community impact',
    },
    cultural_context: {
      id: 'cultural_context',
      label: 'Cultural Context',
      shortLabel: 'Culture',
      icon: 'globe',
      description: 'Cultural considerations, language notes, and community traditions',
    },
  },

  // ---------------------------------------------------------------------------
  // Module height configs
  // ---------------------------------------------------------------------------
  moduleHeights: {
    patient_intake: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    supply_inventory: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    clinic_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    community_assessment: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    ultrasound_log: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    rehab_progress: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    nutrition_tracking: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    donor_report: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    mission_logistics: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    team_roster: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    progress_photos: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    cultural_context: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
  },

  // ---------------------------------------------------------------------------
  // Phase -> module configuration
  // ---------------------------------------------------------------------------
  phaseModuleConfig: {
    days_before: {
      phase: 'days_before',
      availableModules: [
        'mission_logistics',
        'team_roster',
        'supply_inventory',
        'community_assessment',
        'cultural_context',
      ],
      defaultModules: ['mission_logistics', 'team_roster', 'supply_inventory', 'community_assessment'],
      maxModules: 5,
    },
    on_water: {
      phase: 'on_water',
      availableModules: [
        'patient_intake',
        'clinic_notes',
        'nutrition_tracking',
        'rehab_progress',
        'ultrasound_log',
        'progress_photos',
      ],
      defaultModules: ['patient_intake', 'clinic_notes', 'progress_photos'],
      maxModules: 6,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'donor_report',
        'progress_photos',
        'clinic_notes',
        'community_assessment',
      ],
      defaultModules: ['donor_report', 'progress_photos'],
      maxModules: 4,
    },
  },

  // ---------------------------------------------------------------------------
  // Subtype-specific module overrides
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    medical_mission: {
      subtypeId: 'medical_mission',
    },
    clinic_day: {
      subtypeId: 'clinic_day',
      excludedModules: ['mission_logistics'],
      phaseDefaultOverrides: {
        on_water: ['patient_intake', 'clinic_notes', 'progress_photos'],
      },
    },
    rehab_session: {
      subtypeId: 'rehab_session',
      excludedModules: ['ultrasound_log', 'nutrition_tracking'],
      phaseDefaultOverrides: {
        on_water: ['rehab_progress', 'clinic_notes', 'progress_photos'],
      },
    },
    nutrition_screening: {
      subtypeId: 'nutrition_screening',
      excludedModules: ['ultrasound_log', 'rehab_progress'],
      phaseDefaultOverrides: {
        on_water: ['nutrition_tracking', 'patient_intake', 'progress_photos'],
      },
    },
    ultrasound_session: {
      subtypeId: 'ultrasound_session',
      excludedModules: ['rehab_progress', 'nutrition_tracking'],
      phaseDefaultOverrides: {
        on_water: ['ultrasound_log', 'clinic_notes', 'progress_photos'],
      },
    },
    fundraising_event: {
      subtypeId: 'fundraising_event',
      excludedModules: ['patient_intake', 'clinic_notes', 'ultrasound_log', 'rehab_progress', 'nutrition_tracking'],
      phaseDefaultOverrides: {
        days_before: ['mission_logistics', 'team_roster'],
        on_water: ['progress_photos'],
        after_race: ['donor_report', 'progress_photos'],
      },
      labelOverrides: {
        mission_logistics: 'Event Logistics',
        team_roster: 'Volunteer List',
        progress_photos: 'Event Photos',
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
      description: 'High-level mission performance and impact summary',
    },
    {
      id: 'clinical_impact',
      label: 'Clinical Impact',
      description: 'Patient outcomes, diagnoses, and treatments delivered',
    },
    {
      id: 'community_reach',
      label: 'Community Reach',
      description: 'Communities served, population coverage, and outreach effectiveness',
    },
    {
      id: 'resource_utilization',
      label: 'Resource Utilization',
      description: 'Supply usage, cost efficiency, and waste reduction',
    },
    {
      id: 'team_effectiveness',
      label: 'Team Effectiveness',
      description: 'Volunteer coordination, skill utilization, and team dynamics',
    },
    {
      id: 'sustainability',
      label: 'Sustainability',
      description: 'Local capacity building, training outcomes, and long-term impact',
    },
    {
      id: 'recommendations',
      label: 'Recommendations',
      description: 'Specific areas for improvement and next mission planning',
    },
  ],

  // ---------------------------------------------------------------------------
  // Framework scoring dimensions
  // ---------------------------------------------------------------------------
  frameworkScores: [
    {
      id: 'patient_outcomes',
      label: 'Patient Outcomes',
      description: 'Quality and effectiveness of patient care delivered',
    },
    {
      id: 'community_engagement',
      label: 'Community Engagement',
      description: 'Depth of community connection and trust building',
    },
    {
      id: 'resource_efficiency',
      label: 'Resource Efficiency',
      description: 'Effective use of medical supplies, funds, and volunteer time',
    },
    {
      id: 'cultural_sensitivity',
      label: 'Cultural Sensitivity',
      description: 'Respect for local customs, language use, and cultural practices',
    },
    {
      id: 'team_coordination',
      label: 'Team Coordination',
      description: 'Communication, role clarity, and collaborative effectiveness',
    },
    {
      id: 'sustainability_planning',
      label: 'Sustainability Planning',
      description: 'Building local capacity and ensuring long-term program viability',
    },
  ],

  // ---------------------------------------------------------------------------
  // Debrief phases
  // ---------------------------------------------------------------------------
  debriefPhases: [
    {
      id: 'preparation',
      title: 'Mission Preparation',
      emoji: '\u{1F4CB}',
      description: 'How was mission planning and logistics?',
      questions: [
        {
          id: 'prep_logistics',
          type: 'select',
          label: 'How was the logistics preparation?',
          options: [
            { value: 'excellent', label: 'Excellent \u2014 everything arranged smoothly' },
            { value: 'good', label: 'Good \u2014 minor hiccups resolved' },
            { value: 'fair', label: 'Fair \u2014 some gaps' },
            { value: 'poor', label: 'Poor \u2014 significant issues' },
          ],
        },
        {
          id: 'prep_supplies',
          type: 'boolean',
          label: 'Were medical supplies and equipment sufficient?',
        },
        {
          id: 'prep_supply_gaps',
          type: 'text',
          label: 'What supplies were missing or insufficient?',
          showWhen: { questionId: 'prep_supplies', answerIn: ['false'] },
        },
        {
          id: 'prep_team',
          type: 'select',
          label: 'How was the team briefing and role assignment?',
          options: [
            { value: 'thorough', label: 'Thorough \u2014 everyone knew their role' },
            { value: 'adequate', label: 'Adequate \u2014 some confusion' },
            { value: 'insufficient', label: 'Insufficient \u2014 roles were unclear' },
          ],
        },
      ],
    },
    {
      id: 'clinical_operations',
      title: 'Clinical Operations',
      emoji: '\u{1FA7A}',
      description: 'How was the clinical care delivery?',
      questions: [
        {
          id: 'clinical_flow',
          type: 'select',
          label: 'How was patient flow and clinic organization?',
          options: [
            { value: 'smooth', label: 'Smooth \u2014 efficient throughput' },
            { value: 'good', label: 'Good \u2014 minor bottlenecks' },
            { value: 'challenging', label: 'Challenging \u2014 significant wait times' },
            { value: 'overwhelmed', label: 'Overwhelmed \u2014 demand exceeded capacity' },
          ],
        },
        {
          id: 'clinical_quality',
          type: 'select',
          label: 'How was the quality of care delivered?',
          options: [
            { value: 'high', label: 'High \u2014 comprehensive, thorough care' },
            { value: 'good', label: 'Good \u2014 standard quality maintained' },
            { value: 'adequate', label: 'Adequate \u2014 constrained by resources' },
            { value: 'limited', label: 'Limited \u2014 difficult conditions' },
          ],
        },
        {
          id: 'clinical_patients',
          type: 'number',
          label: 'Approximate number of patients seen?',
          placeholder: 'Total patients',
        },
        {
          id: 'clinical_referrals',
          type: 'number',
          label: 'Patients referred for further care?',
          placeholder: 'Number of referrals',
        },
      ],
    },
    {
      id: 'community_impact',
      title: 'Community Impact',
      emoji: '\u{1F30E}',
      description: 'How was the community engagement and impact?',
      questions: [
        {
          id: 'community_reception',
          type: 'select',
          label: 'How was the community reception?',
          options: [
            { value: 'welcoming', label: 'Welcoming \u2014 strong community engagement' },
            { value: 'positive', label: 'Positive \u2014 good participation' },
            { value: 'cautious', label: 'Cautious \u2014 some hesitancy' },
            { value: 'difficult', label: 'Difficult \u2014 barriers to engagement' },
          ],
        },
        {
          id: 'community_language',
          type: 'select',
          label: 'How was language/communication?',
          options: [
            { value: 'fluent', label: 'Fluent \u2014 team had local language skills' },
            { value: 'translated', label: 'Translated \u2014 good interpreter support' },
            { value: 'limited', label: 'Limited \u2014 communication challenges' },
          ],
        },
        {
          id: 'community_education',
          type: 'boolean',
          label: 'Were health education sessions conducted?',
        },
        {
          id: 'community_education_topics',
          type: 'text',
          label: 'What topics were covered?',
          showWhen: { questionId: 'community_education', answerIn: ['true'] },
        },
      ],
    },
    {
      id: 'logistics',
      title: 'Logistics & Operations',
      emoji: '\u{1F69A}',
      description: 'How were travel, housing, and operational logistics?',
      questions: [
        {
          id: 'logistics_transport',
          type: 'select',
          label: 'How was transportation and travel?',
          options: [
            { value: 'smooth', label: 'Smooth \u2014 no issues' },
            { value: 'manageable', label: 'Manageable \u2014 minor delays' },
            { value: 'difficult', label: 'Difficult \u2014 road/weather challenges' },
          ],
        },
        {
          id: 'logistics_accommodation',
          type: 'select',
          label: 'How were the accommodations?',
          options: [
            { value: 'comfortable', label: 'Comfortable \u2014 well organized' },
            { value: 'adequate', label: 'Adequate \u2014 basic but functional' },
            { value: 'challenging', label: 'Challenging \u2014 difficult conditions' },
          ],
        },
        {
          id: 'logistics_notes',
          type: 'textarea',
          label: 'Any logistics improvements for next time?',
          placeholder: 'Notes on what to change...',
        },
      ],
    },
    {
      id: 'follow_up',
      title: 'Follow-Up & Sustainability',
      emoji: '\u{1F331}',
      description: 'Looking ahead to ongoing impact',
      questions: [
        {
          id: 'followup_training',
          type: 'boolean',
          label: 'Was training provided to local health workers?',
        },
        {
          id: 'followup_training_detail',
          type: 'text',
          label: 'What training was provided?',
          showWhen: { questionId: 'followup_training', answerIn: ['true'] },
        },
        {
          id: 'followup_supplies_left',
          type: 'boolean',
          label: 'Were medical supplies left for the community?',
        },
        {
          id: 'followup_next_steps',
          type: 'textarea',
          label: 'Key follow-up actions needed?',
          placeholder: 'Patient follow-ups, supply replenishment, next mission dates...',
        },
        {
          id: 'followup_impact',
          type: 'textarea',
          label: 'Most impactful moment or story from this mission?',
          placeholder: 'A story that captures the mission\'s impact...',
        },
      ],
    },
  ],

  // ---------------------------------------------------------------------------
  // Drill / practice categories
  // ---------------------------------------------------------------------------
  drillCategories: [
    { id: 'clinical_skills', label: 'Clinical Skills', icon: 'medkit' },
    { id: 'community_health', label: 'Community Health', icon: 'people' },
    { id: 'nutrition_assessment', label: 'Nutrition Assessment', icon: 'nutrition' },
    { id: 'rehabilitation', label: 'Rehabilitation', icon: 'accessibility' },
    { id: 'ultrasound', label: 'Ultrasound', icon: 'pulse' },
    { id: 'fundraising', label: 'Fundraising', icon: 'heart' },
    { id: 'cultural_competency', label: 'Cultural Competency', icon: 'globe' },
  ],

  // ---------------------------------------------------------------------------
  // Skill areas
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'pediatric-assessment', label: 'Pediatric Assessment' },
    { id: 'malnutrition-screening', label: 'Malnutrition Screening' },
    { id: 'physical-therapy', label: 'Physical Therapy' },
    { id: 'occupational-therapy', label: 'Occupational Therapy' },
    { id: 'fetal-ultrasound', label: 'Fetal Ultrasound' },
    { id: 'community-health-education', label: 'Community Health Education' },
    { id: 'cross-cultural-communication', label: 'Cross-Cultural Communication' },
    { id: 'medical-spanish', label: 'Medical Spanish / Mam' },
    { id: 'supply-chain-management', label: 'Supply Chain Management' },
    { id: 'donor-relations', label: 'Donor Relations' },
  ],

  // ---------------------------------------------------------------------------
  // Evidence capture
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'progress_photo',
      label: 'Mission Photos',
      icon: 'camera',
      type: 'photo',
      description: 'Photos documenting clinical work, community engagement, and impact',
    },
    secondaryCapture: [
      {
        id: 'clinic_notes',
        label: 'Clinic Notes',
        icon: 'document-text',
        type: 'text',
        description: 'Clinical observations and patient summaries',
      },
      {
        id: 'patient_count',
        label: 'Patient Count',
        icon: 'people',
        type: 'text',
        description: 'Number of patients seen and treatments provided',
      },
      {
        id: 'supply_log',
        label: 'Supply Log',
        icon: 'cube',
        type: 'text',
        description: 'Supplies used and remaining inventory',
      },
    ],
    privacyNote: 'Ensure patient privacy — obtain consent before photographing patients, especially children.',
  },

  // ---------------------------------------------------------------------------
  // Reflect tab configuration
  // ---------------------------------------------------------------------------
  reflectConfig: {
    segments: [
      { value: 'progress', label: 'Impact' },
      { value: 'session_log', label: 'Mission Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Missions',
      hoursLabel: 'Service Hours',
      skillsLabel: 'Skills',
      streakLabel: 'Mission Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your global health work',
      primaryLegend: 'Mission',
      secondaryLegend: 'Fundraising',
      eventVerb: 'served',
      stat1Label: 'Missions',
      stat2Label: 'Patients Served',
      stat3Label: 'In Field',
      stat4Label: 'Impact Score',
      comparisonNoun: 'missions',
      performanceSubtitle: 'Your mission impact over time',
      performanceEmpty: 'Complete some missions to see your impact trend',
      emptyIcon: 'medkit-outline',
    },
  },

  // ---------------------------------------------------------------------------
  // Tile sections (visual grouping for config-driven rendering)
  // ---------------------------------------------------------------------------
  tileSections: {
    days_before: [
      {
        id: 'mission-planning',
        label: 'MISSION PLANNING',
        subtitle: 'Logistics, team, and supplies',
        moduleIds: ['mission_logistics', 'team_roster', 'supply_inventory', 'community_assessment', 'cultural_context'],
      },
    ],
    on_water: [
      {
        id: 'clinical-care',
        label: 'CLINICAL CARE',
        subtitle: 'Patient care and documentation',
        moduleIds: ['patient_intake', 'clinic_notes', 'nutrition_tracking', 'rehab_progress', 'ultrasound_log'],
      },
      {
        id: 'documentation',
        label: 'DOCUMENTATION',
        subtitle: 'Photos and records',
        moduleIds: ['progress_photos'],
      },
    ],
    after_race: [
      {
        id: 'impact-reporting',
        label: 'IMPACT REPORTING',
        subtitle: 'Outcomes and donor communication',
        moduleIds: ['donor_report', 'progress_photos', 'clinic_notes', 'community_assessment'],
      },
    ],
  },
}
