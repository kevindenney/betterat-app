import type { InterestEventConfig } from '@/types/interestEventConfig';

export const NURSING_EVENT_CONFIG: InterestEventConfig = {
  // ---------------------------------------------------------------------------
  // IDENTITY
  // ---------------------------------------------------------------------------
  interestSlug: 'nursing',

  // ---------------------------------------------------------------------------
  // PHASE LABELS
  // ---------------------------------------------------------------------------
  phaseLabels: {
    days_before: { full: 'Plan', short: 'Plan' },
    on_water: { full: 'Do', short: 'Do' },
    after_race: { full: 'Reflect', short: 'Reflect' },
  },

  addEventLabel: 'Add Clinical',
  eventNoun: 'Clinical',
  teamNoun: 'Team',
  catalogRoute: '/(tabs)/learn',
  catalogSubtitle: 'Browse courses and clinical skills',

  // ---------------------------------------------------------------------------
  // EVENT SUBTYPES
  // ---------------------------------------------------------------------------
  eventSubtypes: [
    {
      id: 'clinical_shift',
      label: 'Clinical Shift',
      icon: 'medical-bag',
      description: 'Standard clinical rotation shift',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'start_time', type: 'time', label: 'Start Time', required: true },
        { id: 'end_time', type: 'time', label: 'End Time', required: true },
        { id: 'facility', type: 'text', label: 'Facility', placeholder: 'Hospital or clinic name' },
        {
          id: 'unit_type',
          type: 'select',
          label: 'Unit Type',
          options: [
            { value: 'med-surg', label: 'Med-Surg' },
            { value: 'icu', label: 'ICU' },
            { value: 'er', label: 'ER' },
            { value: 'ob', label: 'OB' },
            { value: 'peds', label: 'Peds' },
            { value: 'psych', label: 'Psych' },
            { value: 'community', label: 'Community' },
            { value: 'or', label: 'OR' },
            { value: 'pacu', label: 'PACU' },
            { value: 'rehab', label: 'Rehab' },
          ],
        },
        { id: 'preceptor', type: 'text', label: 'Preceptor', placeholder: 'Preceptor name' },
        { id: 'patient_count', type: 'number', label: 'Patient Count' },
        { id: 'learning_objectives', type: 'text', label: 'Learning Objectives', placeholder: 'Goals for this shift' },
        { id: 'program_course', type: 'text', label: 'Program / Course', placeholder: 'e.g., NUR 302 Adult Health' },
      ],
    },
    {
      id: 'skills_lab',
      label: 'Skills Lab',
      icon: 'flask',
      description: 'Simulation lab skills practice',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'time', type: 'time', label: 'Time', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Lab room or building' },
        {
          id: 'skills_to_practice',
          type: 'multi-select',
          label: 'Skills to Practice',
          options: [
            { value: 'iv_insertion', label: 'IV Insertion' },
            { value: 'foley_catheter', label: 'Foley Catheter' },
            { value: 'wound_care', label: 'Wound Care' },
            { value: 'blood_draw', label: 'Blood Draw' },
            { value: 'injections', label: 'Injections' },
            { value: 'ng_tube', label: 'NG Tube' },
            { value: 'trach_care', label: 'Trach Care' },
            { value: 'vital_signs', label: 'Vital Signs' },
          ],
        },
        { id: 'instructor', type: 'text', label: 'Instructor', placeholder: 'Instructor name' },
      ],
    },
    {
      id: 'simulation',
      label: 'Simulation',
      icon: 'monitor',
      description: 'High-fidelity simulation scenario',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'time', type: 'time', label: 'Time', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        { id: 'sim_center', type: 'text', label: 'Sim Center', placeholder: 'Simulation center name' },
        {
          id: 'scenario_type',
          type: 'select',
          label: 'Scenario Type',
          options: [
            { value: 'code_blue', label: 'Code Blue' },
            { value: 'rapid_response', label: 'Rapid Response' },
            { value: 'deterioration', label: 'Deterioration' },
            { value: 'med_error', label: 'Med Error' },
            { value: 'communication', label: 'Communication' },
            { value: 'ob_emergency', label: 'OB Emergency' },
            { value: 'peds', label: 'Peds' },
          ],
        },
        {
          id: 'fidelity',
          type: 'select',
          label: 'Fidelity',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ],
        },
        { id: 'team_size', type: 'number', label: 'Team Size' },
      ],
    },
    {
      id: 'competency_checkoff',
      label: 'Competency Checkoff',
      icon: 'check-all',
      description: 'Competency validation assessment',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'time', type: 'time', label: 'Time', required: true },
        { id: 'skill_name', type: 'text', label: 'Skill Name', placeholder: 'Competency being evaluated' },
        { id: 'evaluator', type: 'text', label: 'Evaluator', placeholder: 'Evaluator name' },
        { id: 'attempt_number', type: 'number', label: 'Attempt Number' },
        { id: 'location', type: 'text', label: 'Location', placeholder: 'Location of checkoff' },
      ],
    },
    {
      id: 'nclex_practice',
      label: 'NCLEX Practice',
      icon: 'school',
      description: 'NCLEX preparation study session',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'duration', type: 'duration', label: 'Duration' },
        {
          id: 'topics',
          type: 'multi-select',
          label: 'Topics',
          options: [
            { value: 'fundamentals', label: 'Fundamentals' },
            { value: 'pharmacology', label: 'Pharmacology' },
            { value: 'med-surg', label: 'Med-Surg' },
            { value: 'pediatrics', label: 'Pediatrics' },
            { value: 'ob', label: 'OB' },
            { value: 'psych', label: 'Psych' },
            { value: 'community', label: 'Community' },
            { value: 'leadership', label: 'Leadership' },
          ],
        },
        { id: 'question_count', type: 'number', label: 'Question Count' },
        {
          id: 'source',
          type: 'select',
          label: 'Source',
          options: [
            { value: 'uworld', label: 'UWorld' },
            { value: 'kaplan', label: 'Kaplan' },
            { value: 'ati', label: 'ATI' },
            { value: 'hesi', label: 'HESI' },
          ],
        },
      ],
    },
    {
      id: 'blank_activity',
      label: 'Blank Activity',
      icon: 'plus-circle-outline',
      description: 'Create your own — define what, why, who, and how',
      formFields: [
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'title', type: 'text', label: 'Activity Title', placeholder: 'Name this activity', required: true },
      ],
    },
  ],

  defaultSubtype: 'clinical_shift',

  // ---------------------------------------------------------------------------
  // MODULE INFO
  // ---------------------------------------------------------------------------
  moduleInfo: {
    // ── What / Why / Who / How plan modules ──
    plan_what: {
      id: 'plan_what',
      label: 'What',
      shortLabel: 'What',
      icon: 'help-circle-outline',
      description: 'What activity are you doing? Describe the task or skill',
    },
    plan_why: {
      id: 'plan_why',
      label: 'Why',
      shortLabel: 'Why',
      icon: 'bulb-outline',
      description: 'Why are you doing this? Learning objectives and rationale',
    },
    plan_who: {
      id: 'plan_who',
      label: 'Who',
      shortLabel: 'Who',
      icon: 'people-outline',
      description: 'Who is involved? Patients, preceptor, team members',
    },
    plan_how: {
      id: 'plan_how',
      label: 'How',
      shortLabel: 'How',
      icon: 'map-outline',
      description: 'How will you approach it? Resources, tools, technique',
    },
    // ── Existing prep modules ──
    patient_overview: {
      id: 'patient_overview',
      label: 'Patient Overview',
      shortLabel: 'Patients',
      icon: 'people',
      description: 'Assigned patients diagnoses and history',
    },
    medications: {
      id: 'medications',
      label: 'Medications',
      shortLabel: 'Meds',
      icon: 'medkit',
      description: 'Med list timing interactions and high-alerts',
    },
    procedures: {
      id: 'procedures',
      label: 'Procedures',
      shortLabel: 'Procs',
      icon: 'bandage',
      description: 'Skills and procedures expected today',
    },
    clinical_objectives: {
      id: 'clinical_objectives',
      label: 'Clinical Objectives',
      shortLabel: 'Goals',
      icon: 'ribbon',
      description: 'Learning goals aligned to competencies',
    },
    checklist: {
      id: 'checklist',
      label: 'Shift Checklist',
      shortLabel: 'Tasks',
      icon: 'checkbox-marked-outline',
      description: 'Equipment badge stethoscope drug guide',
    },
    lab_values: {
      id: 'lab_values',
      label: 'Lab Values',
      shortLabel: 'Labs',
      icon: 'flask',
      description: 'Key lab results and normal ranges',
    },
    care_plan: {
      id: 'care_plan',
      label: 'Care Plan',
      shortLabel: 'Plan',
      icon: 'clipboard-text',
      description: 'Nursing care plan or concept map',
    },
    unit_protocols: {
      id: 'unit_protocols',
      label: 'Unit Protocols',
      shortLabel: 'Protocols',
      icon: 'shield-check',
      description: 'Unit-specific policies infection control',
    },
    preceptor_goals: {
      id: 'preceptor_goals',
      label: 'Preceptor Goals',
      shortLabel: 'Preceptor',
      icon: 'school',
      description: 'What preceptor wants you to focus on',
    },
    drug_reference: {
      id: 'drug_reference',
      label: 'Drug Reference',
      shortLabel: 'Drugs',
      icon: 'pill',
      description: 'Quick reference for unfamiliar meds',
    },
    share_with_preceptor: {
      id: 'share_with_preceptor',
      label: 'Share with Preceptor',
      shortLabel: 'Share',
      icon: 'share-variant',
      description: 'Share plan before shift',
    },
    // ── Experience / media capture modules ──
    progress_photos: {
      id: 'progress_photos',
      label: 'Photos',
      shortLabel: 'Photos',
      icon: 'camera',
      description: 'De-identified photos of skills, setups, or documentation',
    },
    voice_memo: {
      id: 'voice_memo',
      label: 'Voice Memo',
      shortLabel: 'Voice',
      icon: 'mic',
      description: 'Quick voice notes and verbal reflections',
    },
    video_capture: {
      id: 'video_capture',
      label: 'Video',
      shortLabel: 'Video',
      icon: 'videocam',
      description: 'Record skill demonstrations or sim scenarios',
    },
    text_notes: {
      id: 'text_notes',
      label: 'Notes',
      shortLabel: 'Notes',
      icon: 'create',
      description: 'Written observations and clinical reasoning',
    },
    // ── Existing during-shift modules ──
    competency_log: {
      id: 'competency_log',
      label: 'Competency Log',
      shortLabel: 'Skills',
      icon: 'trophy',
      description: 'Skills performed attempts and proficiency',
    },
    learning_notes: {
      id: 'learning_notes',
      label: 'Learning Notes',
      shortLabel: 'Notes',
      icon: 'lightbulb-outline',
      description: 'What you learned and clinical reasoning moments',
    },
    preceptor_feedback: {
      id: 'preceptor_feedback',
      label: 'Preceptor Feedback',
      shortLabel: 'Feedback',
      icon: 'message-text',
      description: 'Preceptor verbal feedback captured',
    },
    clinical_hours: {
      id: 'clinical_hours',
      label: 'Hours Logged',
      shortLabel: 'Hours',
      icon: 'clock-outline',
      description: 'Total clinical hours for the shift',
    },
    time_log: {
      id: 'time_log',
      label: 'Time Log',
      shortLabel: 'Timer',
      icon: 'timer',
      description: 'Clinical hours tracking auto-running',
    },
    // ── Reflect / debrief modules ──
    gibbs_reflection: {
      id: 'gibbs_reflection',
      label: 'Gibbs Reflection',
      shortLabel: 'Gibbs',
      icon: 'sync-circle',
      description: 'Structured reflection using the Gibbs reflective cycle',
    },
    clinical_reasoning: {
      id: 'clinical_reasoning',
      label: 'Clinical Reasoning',
      shortLabel: 'Reasoning',
      icon: 'git-network',
      description: 'Document your clinical decision-making process',
    },
    ebp_connection: {
      id: 'ebp_connection',
      label: 'Evidence-Based Practice',
      shortLabel: 'EBP',
      icon: 'library',
      description: 'Connect your experience to research and best practices',
    },
    self_assessment: {
      id: 'self_assessment',
      label: 'Self-Assessment',
      shortLabel: 'Self',
      icon: 'analytics',
      description: 'Rate your confidence and identify growth areas',
    },
  },

  // ---------------------------------------------------------------------------
  // MODULE HEIGHTS (uniform for nursing)
  // ---------------------------------------------------------------------------
  moduleHeights: {
    plan_what: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    plan_why: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    plan_who: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    plan_how: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    patient_overview: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    medications: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    procedures: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    clinical_objectives: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    checklist: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    lab_values: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    care_plan: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    unit_protocols: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    preceptor_goals: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    drug_reference: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    share_with_preceptor: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    progress_photos: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    voice_memo: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    video_capture: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    text_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    competency_log: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    learning_notes: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    preceptor_feedback: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    clinical_hours: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    time_log: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    gibbs_reflection: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    clinical_reasoning: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    ebp_connection: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
    self_assessment: { collapsed: 48, minExpanded: 100, maxExpanded: 200 },
  },

  // ---------------------------------------------------------------------------
  // PHASE MODULE CONFIG
  // ---------------------------------------------------------------------------
  phaseModuleConfig: {
    days_before: {
      phase: 'days_before',
      availableModules: [
        'plan_what',
        'plan_why',
        'plan_who',
        'plan_how',
        'patient_overview',
        'medications',
        'procedures',
        'clinical_objectives',
        'checklist',
        'lab_values',
        'care_plan',
        'unit_protocols',
        'preceptor_goals',
        'drug_reference',
        'share_with_preceptor',
      ],
      defaultModules: [
        'patient_overview',
        'medications',
        'procedures',
        'clinical_objectives',
        'checklist',
      ],
      maxModules: 8,
    },
    on_water: {
      phase: 'on_water',
      availableModules: [
        'progress_photos',
        'voice_memo',
        'video_capture',
        'text_notes',
        'time_log',
        'competency_log',
        'patient_overview',
        'clinical_objectives',
        'medications',
        'procedures',
      ],
      defaultModules: [
        'progress_photos',
        'voice_memo',
        'text_notes',
        'time_log',
      ],
      maxModules: 6,
    },
    after_race: {
      phase: 'after_race',
      availableModules: [
        'gibbs_reflection',
        'clinical_reasoning',
        'ebp_connection',
        'self_assessment',
        'competency_log',
        'learning_notes',
        'preceptor_feedback',
        'clinical_hours',
        'patient_overview',
        'clinical_objectives',
        'medications',
      ],
      defaultModules: [
        'gibbs_reflection',
        'clinical_reasoning',
        'self_assessment',
        'learning_notes',
      ],
      maxModules: 6,
    },
  },

  // ---------------------------------------------------------------------------
  // SUBTYPE OVERRIDES
  // ---------------------------------------------------------------------------
  subtypeOverrides: {
    blank_activity: {
      subtypeId: 'blank_activity',
      phaseDefaultOverrides: {
        days_before: [
          'plan_what',
          'plan_why',
          'plan_who',
          'plan_how',
        ],
        on_water: [
          'progress_photos',
          'voice_memo',
          'text_notes',
          'time_log',
        ],
        after_race: [
          'gibbs_reflection',
          'clinical_reasoning',
          'self_assessment',
          'learning_notes',
        ],
      },
    },
    clinical_shift: {
      subtypeId: 'clinical_shift',
      // Uses the global defaults (patient_overview, medications, etc.)
    },
    skills_lab: {
      subtypeId: 'skills_lab',
      excludedModules: ['patient_overview', 'lab_values'],
      labelOverrides: { procedures: 'Lab Skills' },
    },
    simulation: {
      subtypeId: 'simulation',
      excludedModules: ['patient_overview'],
      labelOverrides: { care_plan: 'Sim Objectives' },
    },
    competency_checkoff: {
      subtypeId: 'competency_checkoff',
      excludedModules: [
        'patient_overview',
        'lab_values',
        'care_plan',
        'unit_protocols',
        'drug_reference',
        'time_log',
        'medications',
      ],
    },
    nclex_practice: {
      subtypeId: 'nclex_practice',
      excludedModules: [
        'patient_overview',
        'lab_values',
        'care_plan',
        'unit_protocols',
        'drug_reference',
        'preceptor_goals',
        'share_with_preceptor',
        'time_log',
        'procedures',
        'medications',
        'competency_log',
        'preceptor_feedback',
        'clinical_hours',
      ],
      phaseDefaultOverrides: {
        days_before: ['clinical_objectives', 'checklist'],
      },
    },
  },

  // ---------------------------------------------------------------------------
  // AI ANALYSIS SECTIONS
  // ---------------------------------------------------------------------------
  aiAnalysisSections: [
    { id: 'overall_summary', label: 'Overall Summary', description: 'High-level summary of shift performance' },
    { id: 'clinical_reasoning', label: 'Clinical Reasoning', description: 'Quality of clinical thinking and decision-making' },
    { id: 'patient_safety', label: 'Patient Safety', description: 'Safety awareness and adherence to protocols' },
    { id: 'communication', label: 'Communication', description: 'Team and patient communication effectiveness' },
    { id: 'time_management', label: 'Time Management', description: 'Organization and time utilization during shift' },
    { id: 'technical_skills', label: 'Technical Skills', description: 'Competency in clinical procedures and skills' },
    { id: 'documentation', label: 'Documentation', description: 'Quality and completeness of clinical documentation' },
    { id: 'recommendations', label: 'Recommendations', description: 'Actionable suggestions for improvement' },
    { id: 'plan_vs_execution', label: 'Plan vs Execution', description: 'How well pre-shift plan matched actual shift' },
  ],

  // ---------------------------------------------------------------------------
  // FRAMEWORK SCORES
  // ---------------------------------------------------------------------------
  frameworkScores: [
    { id: 'clinical_judgment', label: 'Clinical Judgment', description: 'Ability to interpret data and make sound clinical decisions' },
    { id: 'communication', label: 'Communication', description: 'Effective SBAR handoff and team communication' },
    { id: 'safety', label: 'Safety', description: 'Patient safety awareness and protocol adherence' },
    { id: 'prioritization', label: 'Prioritization', description: 'Ability to triage and prioritize patient care' },
    { id: 'technical_proficiency', label: 'Technical Proficiency', description: 'Competence in clinical skills and procedures' },
    { id: 'documentation', label: 'Documentation', description: 'Accuracy and timeliness of clinical documentation' },
    { id: 'overall_competency', label: 'Overall Competency', description: 'Holistic assessment of nursing competency' },
  ],

  // ---------------------------------------------------------------------------
  // DEBRIEF PHASES
  // ---------------------------------------------------------------------------
  debriefPhases: [
    // Phase 1: Description (Gibbs Stage 1)
    {
      id: 'description',
      title: 'Description',
      emoji: '\uD83D\uDCCB',
      description: 'What happened?',
      questions: [
        {
          id: 'desc_what_happened',
          type: 'textarea',
          label: 'Describe the key event or experience',
          placeholder: 'What happened? Who was involved? What did you do? What was the outcome?',
        },
        {
          id: 'desc_context',
          type: 'select',
          label: 'What type of experience was this?',
          options: [
            { value: 'routine', label: 'Routine care \u2014 expected situation' },
            { value: 'challenging', label: 'Challenging \u2014 stretched my abilities' },
            { value: 'critical', label: 'Critical moment \u2014 required quick thinking' },
            { value: 'new', label: 'First time \u2014 new skill or situation' },
            { value: 'collaborative', label: 'Collaborative \u2014 team-based care' },
          ],
        },
        {
          id: 'desc_interventions',
          type: 'multi-select',
          label: 'Skills or interventions involved',
          hint: 'Select all that apply',
          options: [
            { value: 'vital_signs', label: 'Vital Signs' },
            { value: 'medication_administration', label: 'Medication Administration' },
            { value: 'iv_insertion_management', label: 'IV Insertion/Management' },
            { value: 'wound_care', label: 'Wound Care' },
            { value: 'foley_catheter', label: 'Foley Catheter' },
            { value: 'blood_draw', label: 'Blood Draw' },
            { value: 'patient_education', label: 'Patient Education' },
            { value: 'assessment', label: 'Head-to-Toe Assessment' },
            { value: 'sbar_handoff', label: 'SBAR Handoff' },
            { value: 'documentation', label: 'Documentation' },
            { value: 'other', label: 'Other' },
          ],
        },
      ],
    },

    // Phase 2: Feelings (Gibbs Stage 2)
    {
      id: 'feelings',
      title: 'Feelings',
      emoji: '\uD83D\uDCAD',
      description: 'What were you thinking and feeling?',
      questions: [
        {
          id: 'feelings_during',
          type: 'select',
          label: 'How did you feel during the experience?',
          options: [
            { value: 'confident', label: 'Confident \u2014 I knew what to do' },
            { value: 'nervous', label: 'Nervous \u2014 but managed it' },
            { value: 'overwhelmed', label: 'Overwhelmed \u2014 a lot happening at once' },
            { value: 'curious', label: 'Curious \u2014 wanted to learn more' },
            { value: 'uncertain', label: 'Uncertain \u2014 unsure of my decisions' },
            { value: 'empowered', label: 'Empowered \u2014 making a real difference' },
          ],
        },
        {
          id: 'feelings_now',
          type: 'textarea',
          label: 'How do you feel about it now, looking back?',
          placeholder: 'Has your perspective changed since the experience?',
        },
      ],
    },

    // Phase 3: Evaluation (Gibbs Stage 3)
    {
      id: 'evaluation',
      title: 'Evaluation',
      emoji: '\u2696\uFE0F',
      description: 'What was good and bad about the experience?',
      questions: [
        {
          id: 'eval_went_well',
          type: 'textarea',
          label: 'What went well?',
          placeholder: 'What aspects of the experience were positive?',
        },
        {
          id: 'eval_challenges',
          type: 'textarea',
          label: 'What was challenging or could have gone better?',
          placeholder: 'What aspects were difficult or did not go as planned?',
        },
        {
          id: 'eval_safety',
          type: 'select',
          label: 'Patient safety during this experience',
          options: [
            { value: 'no_concerns', label: 'No safety concerns' },
            { value: 'minor_concern', label: 'Minor concern \u2014 caught and addressed' },
            { value: 'near_miss', label: 'Near miss \u2014 important learning moment' },
            { value: 'concern_raised', label: 'Safety concern raised with preceptor' },
          ],
        },
      ],
    },

    // Phase 4: Analysis (Gibbs Stage 4)
    {
      id: 'analysis',
      title: 'Analysis',
      emoji: '\uD83D\uDD2C',
      description: 'What sense can you make of the situation?',
      questions: [
        {
          id: 'analysis_clinical_reasoning',
          type: 'textarea',
          label: 'What was your clinical reasoning?',
          placeholder: 'Walk through your thought process. What data did you gather? What did you prioritize and why?',
        },
        {
          id: 'analysis_theory_connection',
          type: 'textarea',
          label: 'How does this connect to what you have learned in class?',
          placeholder: 'Link to nursing theory, pathophysiology, pharmacology, or evidence-based practice...',
        },
        {
          id: 'analysis_communication',
          type: 'select',
          label: 'How effective was your communication?',
          options: [
            { value: 'excellent', label: 'Excellent \u2014 clear SBAR, good therapeutic communication' },
            { value: 'good', label: 'Good \u2014 conveyed main points effectively' },
            { value: 'developing', label: 'Developing \u2014 some gaps in communication' },
            { value: 'needs_work', label: 'Needs work \u2014 significant communication challenges' },
          ],
        },
      ],
    },

    // Phase 5: Conclusion (Gibbs Stage 5)
    {
      id: 'conclusion',
      title: 'Conclusion',
      emoji: '\uD83C\uDFAF',
      description: 'What else could you have done?',
      questions: [
        {
          id: 'conclusion_key_learning',
          type: 'textarea',
          label: 'What is the most important thing you learned?',
          placeholder: 'The single biggest takeaway from this experience...',
        },
        {
          id: 'conclusion_different',
          type: 'textarea',
          label: 'What would you do differently next time?',
          placeholder: 'If you faced the same situation again, what would you change?',
        },
        {
          id: 'conclusion_confidence',
          type: 'select',
          label: 'How has this experience affected your confidence?',
          options: [
            { value: 'much_more', label: 'Much more confident' },
            { value: 'somewhat_more', label: 'Somewhat more confident' },
            { value: 'same', label: 'About the same' },
            { value: 'identified_gaps', label: 'Identified gaps to work on' },
          ],
        },
      ],
    },

    // Phase 6: Action Plan (Gibbs Stage 6)
    {
      id: 'action_plan',
      title: 'Action Plan',
      emoji: '\uD83D\uDE80',
      description: 'What will you do going forward?',
      questions: [
        {
          id: 'action_next_steps',
          type: 'textarea',
          label: 'What specific steps will you take to improve?',
          placeholder: 'Concrete actions: review a topic, practice a skill, discuss with preceptor...',
        },
        {
          id: 'action_resources',
          type: 'textarea',
          label: 'What resources do you need?',
          placeholder: 'Textbook chapters, articles, simulation time, preceptor mentoring...',
        },
        {
          id: 'action_ebp',
          type: 'boolean',
          label: 'Did this experience prompt you to look up evidence or guidelines?',
        },
        {
          id: 'action_ebp_detail',
          type: 'textarea',
          label: 'What did you find?',
          placeholder: 'Summarize the evidence or guideline and how it applies...',
          showWhen: { questionId: 'action_ebp', answerIn: ['true'] },
        },
        {
          id: 'action_preceptor_discuss',
          type: 'boolean',
          label: 'Would you like to discuss this with your preceptor?',
        },
      ],
    },
  ],

  // ---------------------------------------------------------------------------
  // DRILL CATEGORIES (nursing practice areas)
  // ---------------------------------------------------------------------------
  drillCategories: [
    { id: 'clinical_skills', label: 'Clinical Skills', icon: 'medkit' },
    { id: 'pharmacology', label: 'Pharmacology', icon: 'pill' },
    { id: 'assessment', label: 'Assessment', icon: 'clipboard-text' },
    { id: 'communication', label: 'Communication', icon: 'message-text' },
    { id: 'critical_thinking', label: 'Critical Thinking', icon: 'lightbulb-outline' },
    { id: 'nclex_prep', label: 'NCLEX Prep', icon: 'school' },
  ],

  // ---------------------------------------------------------------------------
  // SKILL AREAS
  // ---------------------------------------------------------------------------
  skillAreas: [
    { id: 'assessment', label: 'Assessment' },
    { id: 'medication_administration', label: 'Medication Administration' },
    { id: 'iv_therapy', label: 'IV Therapy' },
    { id: 'wound_care', label: 'Wound Care' },
    { id: 'patient_education', label: 'Patient Education' },
    { id: 'documentation', label: 'Documentation' },
    { id: 'communication', label: 'Communication' },
    { id: 'safety', label: 'Safety & Infection Control' },
    { id: 'critical_thinking', label: 'Critical Thinking' },
    { id: 'time_management', label: 'Time Management' },
  ],

  // ---------------------------------------------------------------------------
  // EVIDENCE CAPTURE
  // ---------------------------------------------------------------------------
  evidenceCapture: {
    primaryCapture: {
      id: 'progress_photos',
      label: 'Photos',
      icon: 'camera',
      type: 'photo',
      description: 'De-identified photos of skills, setups, or documentation',
    },
    secondaryCapture: [
      {
        id: 'voice_memo',
        label: 'Voice Memo',
        icon: 'mic',
        type: 'audio',
        description: 'Quick voice notes and verbal reflections',
      },
      {
        id: 'video_capture',
        label: 'Video',
        icon: 'videocam',
        type: 'video',
        description: 'Record skill demonstrations or sim scenarios',
      },
      {
        id: 'text_notes',
        label: 'Notes',
        icon: 'create',
        type: 'text',
        description: 'Written observations and clinical reasoning',
      },
      {
        id: 'clinical_hours_timer',
        label: 'Clinical Hours Timer',
        icon: 'timer',
        type: 'timer',
        description: 'Auto-running clinical hours tracker',
      },
      {
        id: 'competency_attempt_markers',
        label: 'Competency Markers',
        icon: 'checkbox-marked-outline',
        type: 'activity_log',
        description: 'Mark competency attempts during activity',
      },
    ],
    privacyNote: 'HIPAA — No patient identifiers in photos or video. De-identify all media. Reference patients by assigned number only.',
  },

  // ---------------------------------------------------------------------------
  // REFLECT CONFIG
  // ---------------------------------------------------------------------------
  reflectConfig: {
    segments: [
      { value: 'progress', label: 'Progress' },
      { value: 'racelog', label: 'Shift Log' },
      { value: 'profile', label: 'Profile' },
    ],
    progressStats: {
      eventsLabel: 'Shifts',
      hoursLabel: 'Clinical Hours',
      skillsLabel: 'Competencies',
      streakLabel: 'Shift Streak',
    },
    progressLabels: {
      seeMoreText: 'See more of your clinical work',
      primaryLegend: 'Clinical',
      secondaryLegend: 'Study',
      eventVerb: 'completed',
      stat1Label: 'Shifts',
      stat2Label: 'Skills Practiced',
      stat3Label: 'Clinical Hours',
      stat4Label: 'Competencies',
      comparisonNoun: 'shifts',
      performanceSubtitle: 'Your skill confidence over time',
      performanceEmpty: 'Complete some shifts to see your progress trend',
      emptyIcon: 'medkit-outline',
    },
  },

  // ---------------------------------------------------------------------------
  // Tile sections (visual grouping for config-driven rendering)
  // ---------------------------------------------------------------------------
  tileSections: {
    days_before: [
      {
        id: 'patient-care',
        label: 'Patient Care',
        subtitle: 'Patients, medications, and lab values',
        moduleIds: ['patient_overview', 'medications', 'lab_values'],
      },
      {
        id: 'clinical-prep',
        label: 'Clinical Prep',
        subtitle: 'Procedures, care plan, and objectives',
        moduleIds: ['procedures', 'care_plan', 'clinical_objectives'],
      },
      {
        id: 'team',
        label: 'Team',
        subtitle: 'Protocols, preceptor, and sharing',
        moduleIds: ['unit_protocols', 'preceptor_goals', 'share_with_preceptor'],
      },
    ],
    on_water: [
      {
        id: 'capture',
        label: 'Capture',
        subtitle: 'Record your experience as it happens',
        moduleIds: ['progress_photos', 'voice_memo', 'video_capture', 'text_notes'],
      },
      {
        id: 'track',
        label: 'Track',
        subtitle: 'Time, skills, and clinical tasks',
        moduleIds: ['time_log', 'competency_log', 'clinical_objectives'],
      },
    ],
    after_race: [
      {
        id: 'reflection',
        label: 'Structured Reflection',
        subtitle: 'Gibbs cycle, clinical reasoning, and evidence connection',
        moduleIds: ['gibbs_reflection', 'clinical_reasoning', 'ebp_connection', 'self_assessment'],
      },
      {
        id: 'outcomes',
        label: 'Outcomes',
        subtitle: 'Competencies, feedback, and hours',
        moduleIds: ['competency_log', 'learning_notes', 'preceptor_feedback', 'clinical_hours'],
      },
    ],
  },
};
