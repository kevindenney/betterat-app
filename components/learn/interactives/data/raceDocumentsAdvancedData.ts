/**
 * Race Documents Advanced - Lesson Data
 * Comprehensive coverage of all race document types for experienced sailors
 *
 * This lesson covers all 6 document types:
 * - Notice of Race (NOR) - deep dive into legal and eligibility
 * - Sailing Instructions (SI) - detailed analysis of procedures
 * - Course Diagram - complex course types
 * - Amendments - handling changes
 * - NOTAM - safety and operational notices
 * - Other Documents - supplementary materials
 */

import { DocumentSection, QuizQuestion } from './raceDocumentsBasicsData';

// Extended section with advanced details
export interface AdvancedDocumentSection extends DocumentSection {
  commonMistakes?: string[];
  ruleReferences?: string[];
  realWorldExamples?: string[];
}

// Scenario for practical quiz questions
export interface DocumentScenario {
  id: string;
  title: string;
  situation: string;
  documentType: string;
  relevantSection: string;
  question: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  explanation: string;
}

// Workflow step for document review process
export interface DocumentWorkflowStep {
  timing: string;
  documents: string[];
  actions: string[];
  criticalItems: string[];
}

// Visual state for advanced lesson
export interface AdvancedDocumentVisualState {
  activeDocument: 'nor' | 'si' | 'course' | 'amendment' | 'notam' | 'other' | 'workflow' | 'all' | 'none';
  focusArea?: string;
  highlightedSections?: string[];
  showComparison?: boolean;
  animationState?: 'intro' | 'zoom' | 'highlight' | 'workflow' | 'scenario';
}

// Advanced step structure
export interface AdvancedRaceDocumentsStep {
  time: number;
  label: string;
  description: string;
  details?: string[];
  proTip?: string;
  commonMistakes?: string[];
  visualState: AdvancedDocumentVisualState;
  interactiveSections?: AdvancedDocumentSection[];
}

// NOR Advanced Sections - Legal and Eligibility
export const NOR_LEGAL_SECTIONS: AdvancedDocumentSection[] = [
  {
    id: 'nor-insurance',
    name: 'Insurance Requirements',
    description: 'Third-party liability insurance coverage minimums required to race.',
    examples: ['Valid third-party liability insurance of €2,000,000', 'Certificate must be presented at registration'],
    importance: 'critical',
    position: { x: 5, y: 20, width: 90, height: 15 },
    commonMistakes: ['Assuming your regular boat insurance covers racing', 'Not checking the currency (USD vs EUR)'],
    ruleReferences: ['NOR Section 4 - Eligibility'],
  },
  {
    id: 'nor-measurement',
    name: 'Measurement Certificates',
    description: 'Required boat measurement or rating certificates.',
    examples: ['Valid class measurement certificate', 'Current IRC/ORC rating certificate'],
    importance: 'critical',
    position: { x: 5, y: 36, width: 90, height: 15 },
    commonMistakes: ['Expired certificates', 'Changes to boat not reflected in certificate'],
  },
  {
    id: 'nor-safety',
    name: 'Safety Equipment',
    description: 'Required safety equipment beyond standard class rules.',
    examples: ['Category 3 safety equipment per World Sailing OSR', 'AIS transponder required', 'EPIRB for offshore'],
    importance: 'critical',
    position: { x: 5, y: 52, width: 90, height: 15 },
    commonMistakes: ['Equipment inspections expired', 'Missing required items from checklist'],
  },
  {
    id: 'nor-advertising',
    name: 'Advertising Restrictions',
    description: 'Rules about boat graphics, sponsor logos, and event advertising.',
    examples: ['Boats may be required to display event advertising', 'Restrictions on competitor advertising'],
    importance: 'helpful',
    position: { x: 5, y: 68, width: 90, height: 12 },
  },
];

// NOR Advanced Sections - Rules
export const NOR_RULES_SECTIONS: AdvancedDocumentSection[] = [
  {
    id: 'nor-rrs-mods',
    name: 'RRS Modifications',
    description: 'Specific Racing Rules that are modified for this event.',
    examples: ['Rule 44.1 is changed to allow One-Turn Penalty', 'Appendix T (Arbitration) will apply'],
    importance: 'critical',
    position: { x: 5, y: 20, width: 90, height: 18 },
    ruleReferences: ['RRS 86.1(b) - Permitted changes'],
    commonMistakes: ['Assuming standard penalties apply', 'Not checking for Appendix changes'],
  },
  {
    id: 'nor-class-rules',
    name: 'Class Rule Applicability',
    description: 'Which class rules apply and any modifications.',
    examples: ['J/70 Class Rules shall apply', 'Class Rule 3.4 is modified to allow...'],
    importance: 'critical',
    position: { x: 5, y: 40, width: 90, height: 15 },
  },
  {
    id: 'nor-prescriptions',
    name: 'National Prescriptions',
    description: 'National authority prescriptions that may modify the RRS.',
    examples: ['US Sailing prescriptions apply', 'World Sailing Regulation 19 applies'],
    importance: 'important',
    position: { x: 5, y: 57, width: 90, height: 15 },
  },
];

// SI Advanced Sections - Starting Procedures
export const SI_START_SECTIONS: AdvancedDocumentSection[] = [
  {
    id: 'si-sequence',
    name: 'Start Sequence Variations',
    description: 'Details of the starting sequence, including any variations from Rule 26.',
    examples: ['5-4-1-0 minute sequence', 'Rolling starts for pursuit races', 'Multi-class sequences'],
    importance: 'critical',
    position: { x: 5, y: 15, width: 90, height: 18 },
    commonMistakes: ['Assuming standard 5 minute sequence', 'Missing class-specific prep signals'],
  },
  {
    id: 'si-flags',
    name: 'Flag Rules (I, Z, U, Black)',
    description: 'Which starting penalty flags may be used and their consequences.',
    examples: ['The I flag may be displayed', 'Rule 30.3 (U flag) or 30.4 (Black flag) may be used'],
    importance: 'critical',
    position: { x: 5, y: 35, width: 90, height: 18 },
    ruleReferences: ['RRS 30 - Starting Penalties'],
    commonMistakes: ['Not understanding Black Flag consequences', 'Crossing early under Z flag'],
  },
  {
    id: 'si-recalls',
    name: 'Recall Procedures',
    description: 'How individual and general recalls are signaled and handled.',
    examples: ['X flag for individual recall', 'First substitute for general recall'],
    importance: 'important',
    position: { x: 5, y: 55, width: 90, height: 15 },
  },
];

// SI Advanced Sections - Course Configuration
export const SI_COURSE_SECTIONS: AdvancedDocumentSection[] = [
  {
    id: 'si-course-types',
    name: 'Course Configurations',
    description: 'Different course types and how they are designated.',
    examples: ['Course 1: W-L (2 laps)', 'Course 2: Triangle-Sausage', 'Course 3: Trapezoid'],
    importance: 'critical',
    position: { x: 5, y: 15, width: 90, height: 18 },
  },
  {
    id: 'si-gate-marks',
    name: 'Gates vs Single Marks',
    description: 'How to navigate gate marks versus single leeward marks.',
    examples: ['Leeward gate with marks G1 and G2', 'Pass between gate marks then round either'],
    importance: 'important',
    position: { x: 5, y: 35, width: 90, height: 15 },
    commonMistakes: ['Treating gate as single mark', 'Incorrect rounding direction'],
  },
  {
    id: 'si-course-change',
    name: 'Course Changes',
    description: 'How course changes are signaled during the race.',
    examples: ['C flag with new bearing', 'Shortened course (S flag)', 'Course change at mark'],
    importance: 'important',
    position: { x: 5, y: 52, width: 90, height: 15 },
    ruleReferences: ['RRS 32, 33 - Shortening and Course Changes'],
  },
  {
    id: 'si-offset',
    name: 'Offset Marks',
    description: 'Offset marks create separation at busy mark roundings.',
    examples: ['Offset mark 50m from windward mark', 'Leave offset mark to port after windward'],
    importance: 'helpful',
    position: { x: 5, y: 69, width: 90, height: 12 },
  },
];

// SI Advanced Sections - Scoring
export const SI_SCORING_SECTIONS: AdvancedDocumentSection[] = [
  {
    id: 'si-scoring-system',
    name: 'Scoring System',
    description: 'Which scoring system is used and any modifications.',
    examples: ['Low Point scoring per Appendix A', 'High Point scoring (1 point for 1st)', 'Bonus point system'],
    importance: 'critical',
    position: { x: 5, y: 15, width: 90, height: 18 },
  },
  {
    id: 'si-time-limits',
    name: 'Time Limits',
    description: 'Race time limits and mark rounding time limits.',
    examples: ['Time limit: 90 minutes', 'Mark 1 time limit: 40 minutes', 'Finishing window: 30 minutes'],
    importance: 'important',
    position: { x: 5, y: 35, width: 90, height: 15 },
    ruleReferences: ['RRS 35 - Time Limits'],
    commonMistakes: ['Not understanding mark rounding time limits'],
  },
  {
    id: 'si-throwouts',
    name: 'Throwout Rules',
    description: 'How many races can be discarded from your series score.',
    examples: ['1 throwout after 4 races', '2 throwouts if 8 or more races completed'],
    importance: 'important',
    position: { x: 5, y: 52, width: 90, height: 15 },
  },
  {
    id: 'si-tiebreakers',
    name: 'Tie-Breaking',
    description: 'How ties in series scoring are resolved.',
    examples: ['Per Appendix A', 'Most first places, then most seconds, etc.'],
    importance: 'helpful',
    position: { x: 5, y: 69, width: 90, height: 12 },
  },
];

// Amendment Sections
export const AMENDMENT_SECTIONS: AdvancedDocumentSection[] = [
  {
    id: 'amendment-header',
    name: 'Amendment Header',
    description: 'Identifies which document is being amended and effective date.',
    examples: ['Amendment 1 to Sailing Instructions', 'Effective: Saturday, 0800'],
    importance: 'critical',
    position: { x: 5, y: 8, width: 90, height: 18 },
  },
  {
    id: 'amendment-changes',
    name: 'Changes Section',
    description: 'The specific changes being made, usually with strikethrough and new text.',
    examples: ['SI 10.2 is changed to read: "..."', 'Delete SI 8.4', 'Add new SI 12.3'],
    importance: 'critical',
    position: { x: 5, y: 30, width: 90, height: 40 },
    commonMistakes: ['Not reading the full context of changed sections', 'Missing deletions'],
  },
  {
    id: 'amendment-location',
    name: 'Posting Location',
    description: 'Where amendments are posted and how to check for them.',
    examples: ['Posted on official notice board', 'Available online at event website', 'VHF announcement'],
    importance: 'important',
    position: { x: 5, y: 72, width: 90, height: 15 },
  },
];

// NOTAM Sections
export const NOTAM_SECTIONS: AdvancedDocumentSection[] = [
  {
    id: 'notam-header',
    name: 'Notice Header',
    description: 'Type of notice, issuing authority, and validity period.',
    examples: ['NOTAM 2024-0142', 'Valid: May 15, 0600 - May 17, 1800'],
    importance: 'critical',
    position: { x: 5, y: 8, width: 90, height: 15 },
  },
  {
    id: 'notam-area',
    name: 'Affected Area',
    description: 'Geographic area or waters affected by the notice.',
    examples: ['Bay area north of Marker 5', 'Shipping channel Charlie', 'Coordinates with radius'],
    importance: 'critical',
    position: { x: 5, y: 25, width: 90, height: 25 },
  },
  {
    id: 'notam-activity',
    name: 'Activity/Restriction',
    description: 'What activity is occurring or what restrictions apply.',
    examples: ['Military exercises', 'Commercial shipping transit', 'Dredging operations', 'Safety exclusion zone'],
    importance: 'critical',
    position: { x: 5, y: 52, width: 90, height: 20 },
    commonMistakes: ['Ignoring commercial shipping schedules', 'Not adjusting tactics for restricted areas'],
  },
  {
    id: 'notam-impact',
    name: 'Racing Impact',
    description: 'How this affects your race - course changes, timing adjustments.',
    examples: ['Course may be modified to avoid area', 'Start delayed until vessel passes', 'Mark positions changed'],
    importance: 'important',
    position: { x: 5, y: 74, width: 90, height: 15 },
  },
];

// Other Documents Sections
export const OTHER_DOCS_SECTIONS: AdvancedDocumentSection[] = [
  {
    id: 'other-regatta-guide',
    name: 'Regatta/Event Guide',
    description: 'Comprehensive guide to the event with logistics and social information.',
    examples: ['Venue map', 'Social schedule', 'Local restaurants', 'Emergency contacts'],
    importance: 'helpful',
    position: { x: 5, y: 15, width: 90, height: 18 },
  },
  {
    id: 'other-venue-info',
    name: 'Venue Information',
    description: 'Practical information about the sailing venue.',
    examples: ['Launching procedures', 'Parking locations', 'Fuel availability', 'Crane services'],
    importance: 'important',
    position: { x: 5, y: 35, width: 90, height: 18 },
  },
  {
    id: 'other-protest',
    name: 'Protest Forms',
    description: 'Blank protest forms and filing procedures.',
    examples: ['Protest time limit', 'Where to file', 'Required information', 'Hearing schedule'],
    importance: 'important',
    position: { x: 5, y: 55, width: 90, height: 15 },
  },
  {
    id: 'other-results',
    name: 'Results & Standings',
    description: 'Race results, series standings, and scoring summaries.',
    examples: ['Preliminary results', 'Official results after protest time', 'Series standings'],
    importance: 'helpful',
    position: { x: 5, y: 72, width: 90, height: 12 },
  },
];

// Document Review Workflow
export const DOCUMENT_REVIEW_WORKFLOW: DocumentWorkflowStep[] = [
  {
    timing: 'Pre-Registration (Weeks Before)',
    documents: ['NOR'],
    actions: ['Verify eligibility', 'Check insurance requirements', 'Note entry deadline', 'Review schedule'],
    criticalItems: ['Entry deadline', 'Insurance minimums', 'Measurement certificate requirements'],
  },
  {
    timing: 'Pre-Travel (Days Before)',
    documents: ['NOR', 'Venue Info', 'SI (if available)'],
    actions: ['Plan travel logistics', 'Prepare required documents', 'Review safety equipment list'],
    criticalItems: ['Insurance certificate', 'Measurement certificate', 'Safety equipment'],
  },
  {
    timing: 'Night Before Racing',
    documents: ['SI', 'Course Diagrams'],
    actions: ['Study rule modifications', 'Learn start procedure', 'Memorize course configurations', 'Review penalties'],
    criticalItems: ['Rule changes', 'Start sequence', 'Penalty system'],
  },
  {
    timing: 'Race Morning',
    documents: ['Amendments', 'NOTAM', 'Updated SI'],
    actions: ['Check notice board', 'Look for amendments', 'Review NOTAM', 'Confirm course for day'],
    criticalItems: ['Any amendments', 'Start time', 'Weather warnings', 'Course changes'],
  },
  {
    timing: 'On the Water',
    documents: ['SI (copy)', 'Course Card'],
    actions: ['Confirm course with RC signals', 'Monitor VHF for changes', 'Reference SI if needed'],
    criticalItems: ['Course signal', 'Mark rounding directions', 'VHF channel'],
  },
  {
    timing: 'Post-Race',
    documents: ['Results', 'Protest Forms'],
    actions: ['Check preliminary results', 'File protest if needed (within time limit)', 'Review official results'],
    criticalItems: ['Protest time limit', 'Scoring questions'],
  },
];

// Lesson Steps
export const RACE_DOCUMENTS_ADVANCED_STEPS: AdvancedRaceDocumentsStep[] = [
  // STEP 1: Introduction
  {
    time: 0,
    label: 'Beyond the Basics',
    description: 'Experienced sailors know that the details in race documents can win or lose races. Let\'s master all six document types and learn to read between the lines.',
    details: [
      'Six document types: NOR, SI, Course Diagram, Amendments, NOTAM, Other',
      'Each document can contain race-critical information',
      'Missing a detail can mean disqualification or tactical disadvantage',
      'A systematic review process ensures nothing is missed',
    ],
    proTip: 'The best sailors create personal checklists for document review - never rely on memory alone!',
    visualState: {
      activeDocument: 'all',
      animationState: 'intro',
    },
  },

  // STEP 2: NOR - Legal and Eligibility
  {
    time: 10,
    label: 'NOR Deep Dive: Legal Requirements',
    description: 'The NOR\'s fine print matters. Insurance, measurement certificates, and safety equipment can determine if you\'re even allowed to race.',
    details: [
      'Insurance: Verify coverage amount AND currency (€ vs $)',
      'Measurement: Certificate must be current and reflect boat configuration',
      'Safety Equipment: May require items beyond class rules',
      'Qualifications: Sailor certifications or experience requirements',
    ],
    proTip: 'Contact your insurance company BEFORE the event to verify racing coverage meets requirements.',
    commonMistakes: [
      'Assuming home club insurance covers regattas',
      'Forgetting measurement certificate expired',
      'Missing safety equipment check deadline',
    ],
    visualState: {
      activeDocument: 'nor',
      focusArea: 'legal',
      highlightedSections: ['nor-insurance', 'nor-measurement', 'nor-safety'],
    },
    interactiveSections: NOR_LEGAL_SECTIONS,
  },

  // STEP 3: NOR - Rules and Modifications
  {
    time: 20,
    label: 'NOR Deep Dive: Rules Framework',
    description: 'The NOR establishes which racing rules apply and may modify standard rules. Understanding these changes is crucial for tactical decisions.',
    details: [
      'RRS Version: Which year\'s Racing Rules of Sailing apply',
      'Rule Modifications: Specific rules changed for this event',
      'Class Rules: Applicable class rules and any modifications',
      'National Prescriptions: Authority-specific rule additions',
    ],
    proTip: 'Keep a copy of the current RRS and your class rules on your phone for quick reference.',
    visualState: {
      activeDocument: 'nor',
      focusArea: 'rules',
      highlightedSections: ['nor-rrs-mods', 'nor-class-rules', 'nor-prescriptions'],
    },
    interactiveSections: NOR_RULES_SECTIONS,
  },

  // STEP 4: SI - Starting Procedures
  {
    time: 30,
    label: 'SI Master Class: Starting Procedures',
    description: 'Different events use different starting procedures. Understanding I, Z, U, and Black flag rules can save your race - or your series.',
    details: [
      'Sequence variations: 5-4-1-0 vs 3-2-1-0 vs rolling starts',
      'I flag: Round the ends if OCS - no sailing through line',
      'Z flag: 20% penalty if in triangle in last minute',
      'U flag: Disqualified if in triangle in last minute (but not black listed)',
      'Black flag: Disqualified AND cannot start any restart',
    ],
    proTip: 'When Black flag is up, be conservative! A DSQ here carries through general recalls.',
    commonMistakes: [
      'Treating Z flag like I flag',
      'Not understanding Black flag carries to restarts',
      'Assuming standard sequence without checking',
    ],
    visualState: {
      activeDocument: 'si',
      focusArea: 'start',
      highlightedSections: ['si-sequence', 'si-flags', 'si-recalls'],
    },
    interactiveSections: SI_START_SECTIONS,
  },

  // STEP 5: SI - Course Configurations
  {
    time: 40,
    label: 'SI Master Class: Course Configurations',
    description: 'Beyond simple windward-leeward courses, learn to read complex course configurations and handle on-water course changes.',
    details: [
      'Multi-leg courses: Trapezoid, Triangle-Sausage, Inner/Outer loops',
      'Gate marks: Choose either mark, pass between first',
      'Offset marks: Creates separation at busy roundings',
      'Course changes: C flag with new bearing, shortened course',
    ],
    proTip: 'Visualize each course configuration before racing. Draw it on paper if needed.',
    visualState: {
      activeDocument: 'si',
      focusArea: 'course',
      highlightedSections: ['si-course-types', 'si-gate-marks', 'si-course-change', 'si-offset'],
    },
    interactiveSections: SI_COURSE_SECTIONS,
  },

  // STEP 6: SI - Scoring
  {
    time: 50,
    label: 'SI Master Class: Finishing and Scoring',
    description: 'How you finish and how you\'re scored can be modified. Know the time limits, throwout rules, and tie-breakers.',
    details: [
      'Time limits: Race time limit AND mark rounding time limits',
      'Scoring system: Low point (most common), high point, or custom',
      'Throwouts: Number of discards based on races sailed',
      'Tie-breaking: Usually most first places, then seconds, etc.',
    ],
    proTip: 'Calculate throwout scenarios during a series to know when to take risks.',
    visualState: {
      activeDocument: 'si',
      focusArea: 'scoring',
      highlightedSections: ['si-scoring-system', 'si-time-limits', 'si-throwouts'],
    },
    interactiveSections: SI_SCORING_SECTIONS,
  },

  // STEP 7: Complex Course Diagrams
  {
    time: 60,
    label: 'Complex Course Types',
    description: 'Learn to read complex course diagrams including Olympic courses, trapezoids, and distance race waypoints.',
    details: [
      'Trapezoid course: Adds reaching legs to W/L',
      'Inner/Outer loops: Different boats may sail different courses',
      'Distance racing: GPS waypoints with exclusion zones',
      'Multi-class: Different course lengths for different classes',
    ],
    proTip: 'For complex courses, brief your crew on the sequence and verify at each mark.',
    visualState: {
      activeDocument: 'course',
      focusArea: 'complex',
      highlightedSections: ['course-windward', 'course-leeward', 'course-arrows'],
    },
  },

  // STEP 8: Amendments
  {
    time: 70,
    label: 'Amendments: Handling Changes',
    description: 'Amendments modify the NOR or SI after publication. Missing an amendment can lead to disqualification or tactical errors.',
    details: [
      'Posted on official notice board AND online',
      'Check EVERY race morning for new amendments',
      'Amendments supersede original document',
      'Read the FULL context of changed sections',
    ],
    proTip: 'Take a photo of the notice board each morning as proof of what was posted.',
    commonMistakes: [
      'Only checking once at registration',
      'Not reading online postings',
      'Missing verbal announcements',
    ],
    visualState: {
      activeDocument: 'amendment',
      highlightedSections: ['amendment-header', 'amendment-changes'],
    },
    interactiveSections: AMENDMENT_SECTIONS,
  },

  // STEP 9: NOTAM
  {
    time: 80,
    label: 'NOTAM: Safety and Operations',
    description: 'Notices to Mariners affect your race area. Commercial shipping, restricted zones, and safety warnings can change your racing tactics.',
    details: [
      'Military exercises may create exclusion zones',
      'Commercial shipping has right of way - period',
      'Dredging or construction affects water depth',
      'Weather warnings may lead to course modifications',
    ],
    proTip: 'A NOTAM might explain an unusual course layout - the RC is working around restrictions.',
    visualState: {
      activeDocument: 'notam',
      highlightedSections: ['notam-area', 'notam-activity', 'notam-impact'],
    },
    interactiveSections: NOTAM_SECTIONS,
  },

  // STEP 10: Other Documents
  {
    time: 90,
    label: 'Supplementary Documents',
    description: 'Regatta guides, venue information, and competitor guides round out your preparation.',
    details: [
      'Regatta Guide: Social events, local information, emergency contacts',
      'Venue Info: Launching, parking, facilities, local customs',
      'Protest Forms: Know the process before you need it',
      'Results: Check for scoring errors promptly',
    ],
    proTip: 'Download everything before race day - cell service at sailing venues is often poor.',
    visualState: {
      activeDocument: 'other',
      highlightedSections: ['other-venue-info', 'other-protest'],
    },
    interactiveSections: OTHER_DOCS_SECTIONS,
  },

  // STEP 11: Document Review Workflow
  {
    time: 100,
    label: 'Your Document Review System',
    description: 'A systematic approach to reviewing all race documents ensures you never miss critical information.',
    details: [
      'Pre-registration: Eligibility, insurance, deadlines',
      'Pre-travel: Logistics, equipment, documents',
      'Night before: SI deep dive, course memorization',
      'Race morning: Amendments, NOTAM, weather',
      'On water: Confirm signals, reference SI',
      'Post-race: Results, protests within time limit',
    ],
    proTip: 'Create a personal checklist app or printed card that you use for every regatta.',
    visualState: {
      activeDocument: 'workflow',
      animationState: 'workflow',
    },
  },

  // STEP 12: Quiz Intro
  {
    time: 110,
    label: 'Test Your Expertise',
    description: 'Apply your advanced knowledge to real-world scenarios. These questions test practical decision-making based on race documents.',
    details: [
      'Eight scenario-based questions',
      'Focus on practical application of document knowledge',
      'Learn from common mistakes',
    ],
    visualState: {
      activeDocument: 'all',
      animationState: 'scenario',
    },
  },
];

// Advanced Quiz - Scenario Based
export const RACE_DOCUMENTS_ADVANCED_QUIZ: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'An amendment to the Sailing Instructions is posted 30 minutes before the first race. What should you do?',
    options: [
      { id: 'a', text: 'Ignore it - too late to change anything', isCorrect: false },
      { id: 'b', text: 'Read it immediately and adjust your preparation', isCorrect: true },
      { id: 'c', text: 'Ask the RC to postpone the race', isCorrect: false },
      { id: 'd', text: 'File a protest against the RC', isCorrect: false },
    ],
    explanation: 'Amendments can be posted at any time and are immediately effective. It\'s your responsibility to check for them and adjust accordingly. Common amendments before racing might change start times, course signals, or even penalty systems.',
    hint: 'Think about whose responsibility it is to check for updates...',
  },
  {
    id: 'q2',
    question: 'The SI specifies "Rule 44.3 is changed to a One-Turn Penalty." What does this mean for your racing?',
    options: [
      { id: 'a', text: 'You cannot take any penalty turns', isCorrect: false },
      { id: 'b', text: 'The standard Two-Turns Penalty is reduced to One-Turn', isCorrect: true },
      { id: 'c', text: 'Protests are not allowed', isCorrect: false },
      { id: 'd', text: 'You must wait until after finishing to take a penalty', isCorrect: false },
    ],
    explanation: 'Many events modify Rule 44.3 to require only a One-Turn Penalty instead of the standard Two-Turns. This makes taking a penalty less costly, which may affect your tactical decisions about whether to take a penalty or risk a protest.',
    hint: 'Rule 44.3 normally requires two turns...',
  },
  {
    id: 'q3',
    question: 'Where would you find information about a military exercise creating an exclusion zone in the racing area?',
    options: [
      { id: 'a', text: 'The NOR', isCorrect: false },
      { id: 'b', text: 'The Sailing Instructions', isCorrect: false },
      { id: 'c', text: 'A NOTAM (Notice to Mariners)', isCorrect: true },
      { id: 'd', text: 'The Course Diagram', isCorrect: false },
    ],
    explanation: 'NOTAMs (Notices to Mariners) contain information about temporary conditions affecting navigation, including military exercises, commercial shipping patterns, and safety exclusion zones. The RC may modify the course based on NOTAMs.',
  },
  {
    id: 'q4',
    question: 'The Black Flag is displayed at the preparatory signal. What happens if you\'re over the line (OCS) at the start?',
    options: [
      { id: 'a', text: 'Two-Turns Penalty', isCorrect: false },
      { id: 'b', text: '20% scoring penalty', isCorrect: false },
      { id: 'c', text: 'Disqualification without a hearing, even for restarts', isCorrect: true },
      { id: 'd', text: 'Warning only for first offense', isCorrect: false },
    ],
    explanation: 'Under Black Flag (Rule 30.4), if you\'re in the triangle formed by the start line and the first mark during the last minute before the start, you\'re disqualified without a hearing. Critically, this disqualification carries through to any restart - you cannot sail that race at all.',
    hint: 'Black flag is the most severe starting penalty...',
  },
  {
    id: 'q5',
    question: 'An offset mark is shown on the course diagram 50m from the windward mark. What is its purpose?',
    options: [
      { id: 'a', text: 'An alternative finish mark', isCorrect: false },
      { id: 'b', text: 'To create separation at the busy mark rounding', isCorrect: true },
      { id: 'c', text: 'A spectator viewing point', isCorrect: false },
      { id: 'd', text: 'Emergency anchor point for the RC', isCorrect: false },
    ],
    explanation: 'Offset marks create separation between boats approaching and leaving a mark. After rounding the windward mark, you must also round the offset mark, which spreads out the traffic and reduces collisions and protests at busy marks.',
  },
  {
    id: 'q6',
    question: 'The SI states: "Time limit: 90 minutes. Mark 1 rounding time limit: 45 minutes." What happens if no boat rounds Mark 1 within 45 minutes?',
    options: [
      { id: 'a', text: 'The race must start within 90 minutes', isCorrect: false },
      { id: 'b', text: 'Each lap takes 45 minutes maximum', isCorrect: false },
      { id: 'c', text: 'The race will be abandoned', isCorrect: true },
      { id: 'd', text: 'The first boat gets bonus points', isCorrect: false },
    ],
    explanation: 'A mark rounding time limit means if no boat in the race rounds that mark within the specified time, the race is abandoned. This prevents races from dragging on in light wind conditions. The regular time limit applies to finishing.',
    hint: 'What happens if no boat can make progress in light air?',
  },
  {
    id: 'q7',
    question: 'You arrive at the venue and cannot find any posted amendments. What should you do?',
    options: [
      { id: 'a', text: 'Assume there are no amendments', isCorrect: false },
      { id: 'b', text: 'Check online posting AND ask the Race Committee', isCorrect: true },
      { id: 'c', text: 'Protest the Race Committee', isCorrect: false },
      { id: 'd', text: 'Skip the race to be safe', isCorrect: false },
    ],
    explanation: 'Never assume there are no amendments. The official notice board location should be specified in the NOR or SI. Also check the online posting location. If you\'re still unsure, ask the RC directly before racing. It\'s your responsibility to find the information.',
  },
  {
    id: 'q8',
    question: 'The NOR requires "Valid third-party liability insurance of at least €2,000,000." Your policy shows $2,000,000 USD coverage. What is your status?',
    options: [
      { id: 'a', text: 'You can race - the amounts are close enough', isCorrect: false },
      { id: 'b', text: 'You are not eligible - €2M is more than $2M USD', isCorrect: true },
      { id: 'c', text: 'You pay a fine to make up the difference', isCorrect: false },
      { id: 'd', text: 'The organizing authority will provide coverage', isCorrect: false },
    ],
    explanation: 'Currency matters! €2,000,000 is typically more than $2,000,000 USD. If the NOR specifies a currency, your coverage must meet or exceed that amount in that currency. Contact your insurer well before the event to verify or increase coverage.',
    hint: 'Check the exchange rate - these are not equal amounts.',
  },
];

// Deep Dive Content
export const RACE_DOCUMENTS_ADVANCED_DEEP_DIVE = {
  title: 'Advanced Document Mastery',
  sections: [
    {
      title: 'Document Hierarchy',
      content: 'Race documents have a specific hierarchy. The Racing Rules of Sailing (RRS) are the foundation. The NOR can change certain rules (per RRS 86.1(b)). The SI can then change both the NOR and RRS (with some exceptions). When documents conflict, generally the later document prevails, but always check the SI for specific precedence rules.',
    },
    {
      title: 'Reading Between the Lines',
      content: 'Sometimes what\'s NOT in a document is as important as what is. If the SI doesn\'t mention a specific rule or procedure, the standard RRS applies. If a class rule isn\'t mentioned, the full class rules apply. Experienced sailors know to check for both modifications and omissions.',
    },
    {
      title: 'Protests and Document Evidence',
      content: 'Race documents are evidence in protests. If you\'re protested for a rules violation, having the correct interpretation of the SI is crucial. Take screenshots or photos of relevant sections. In protest hearings, the jury will reference the official documents.',
    },
    {
      title: 'International Events',
      content: 'At international events, documents may be in multiple languages. The NOR specifies which language prevails in case of conflict. Additionally, different national prescriptions may apply depending on the organizing authority\'s nationality.',
    },
  ],
  proTips: [
    'Create a "document kit" folder on your phone with all event documents',
    'Highlight or annotate rule modifications that affect your sailing style',
    'Set calendar reminders for entry deadlines and document review dates',
    'Keep a laminated course card on deck for quick reference',
    'Take photos of the notice board each morning as evidence',
    'Know protest time limits - they\'re often shorter than you think',
    'Brief your crew on key SI sections before leaving the dock',
  ],
};

// Document metadata for all 6 types
export const ALL_DOCUMENT_METADATA = {
  nor: {
    title: 'Notice of Race',
    abbreviation: 'NOR',
    color: '#3B82F6', // Blue
    icon: 'document-text',
    purpose: 'Announces the event and provides entry information',
  },
  si: {
    title: 'Sailing Instructions',
    abbreviation: 'SI',
    color: '#10B981', // Green
    icon: 'list',
    purpose: 'Detailed race rules and procedures',
  },
  course: {
    title: 'Course Diagram',
    abbreviation: 'Course',
    color: '#F59E0B', // Orange
    icon: 'navigate',
    purpose: 'Visual guide to the race course',
  },
  amendment: {
    title: 'Amendment',
    abbreviation: 'Amend',
    color: '#EF4444', // Red
    icon: 'create',
    purpose: 'Changes to NOR or SI after publication',
  },
  notam: {
    title: 'NOTAM',
    abbreviation: 'NOTAM',
    color: '#8B5CF6', // Purple
    icon: 'warning',
    purpose: 'Notices to mariners about conditions',
  },
  other: {
    title: 'Other Documents',
    abbreviation: 'Other',
    color: '#64748B', // Gray
    icon: 'folder',
    purpose: 'Supplementary event materials',
  },
};
