/**
 * Race Documents Basics - Lesson Data
 * An introduction to essential race documents for beginners
 *
 * This lesson covers the three core documents every sailor needs to understand:
 * - Notice of Race (NOR)
 * - Sailing Instructions (SI)
 * - Course Diagram
 */

// Document section with interactive tap zone
export interface DocumentSection {
  id: string;
  name: string;
  description: string;
  examples: string[];
  importance: 'critical' | 'important' | 'helpful';
  // Position for tap zone (percentage of document width/height)
  position: { x: number; y: number; width: number; height: number };
}

// Visual state for each step
export interface DocumentVisualState {
  activeDocument: 'nor' | 'si' | 'course' | 'all' | 'timeline' | 'none';
  highlightedSections?: string[];
  showDocumentPreview?: boolean;
  animationState?: 'intro' | 'zoom' | 'highlight' | 'compare' | 'timeline';
  showAllDocuments?: boolean;
}

// Step in the lesson
export interface RaceDocumentsStep {
  time: number;
  label: string;
  description: string;
  details?: string[];
  proTip?: string;
  visualState: DocumentVisualState;
  interactiveSections?: DocumentSection[];
}

// NOR Document Sections
export const NOR_SECTIONS: DocumentSection[] = [
  {
    id: 'nor-header',
    name: 'Event Header',
    description: 'The official title of the regatta, organizing club/authority, and dates.',
    examples: ['2024 Spring Series', 'Organized by ABC Yacht Club', 'May 15-17, 2024'],
    importance: 'important',
    position: { x: 5, y: 5, width: 90, height: 12 },
  },
  {
    id: 'nor-rules',
    name: 'Rules',
    description: 'Which racing rules apply: Racing Rules of Sailing (RRS), class rules, and any prescriptions.',
    examples: ['RRS 2021-2024', 'J/70 Class Rules', 'US Sailing Prescriptions'],
    importance: 'critical',
    position: { x: 5, y: 18, width: 90, height: 12 },
  },
  {
    id: 'nor-eligibility',
    name: 'Eligibility',
    description: 'Who can enter: boat class requirements, membership requirements, sailor qualifications.',
    examples: ['Open to all J/70 class boats', 'Club membership required', 'Valid World Sailing ID'],
    importance: 'critical',
    position: { x: 5, y: 31, width: 90, height: 12 },
  },
  {
    id: 'nor-entry',
    name: 'Entry & Fees',
    description: 'How to register, entry deadlines, and associated costs.',
    examples: ['Online registration at yachtscoring.com', 'Entry fee: $150', 'Deadline: May 1'],
    importance: 'important',
    position: { x: 5, y: 44, width: 90, height: 12 },
  },
  {
    id: 'nor-schedule',
    name: 'Schedule',
    description: 'Timeline of events including registration, racing days, and social events.',
    examples: ['Registration: 0800-0900', 'First warning: 1100', 'Awards: 1700 Sunday'],
    importance: 'important',
    position: { x: 5, y: 57, width: 90, height: 12 },
  },
  {
    id: 'nor-venue',
    name: 'Venue',
    description: 'Location details including launching, parking, and facilities.',
    examples: ['Racing in Bay Area', 'Launch at Main Ramp', 'Parking in Lot B'],
    importance: 'helpful',
    position: { x: 5, y: 70, width: 90, height: 12 },
  },
];

// SI Document Sections
export const SI_SECTIONS: DocumentSection[] = [
  {
    id: 'si-rules',
    name: 'Rules & Changes',
    description: 'Any modifications to the standard Racing Rules of Sailing for this event.',
    examples: ['Rule 44.1 changed to One-Turn Penalty', 'Appendix T applies', 'Rule 40 deleted'],
    importance: 'critical',
    position: { x: 5, y: 5, width: 90, height: 12 },
  },
  {
    id: 'si-signals',
    name: 'Signals & Course',
    description: 'How the Race Committee will communicate course and signals to competitors.',
    examples: ['Course displayed on signal boat', 'Flag signals per RRS', 'VHF Channel 72'],
    importance: 'critical',
    position: { x: 5, y: 18, width: 90, height: 14 },
  },
  {
    id: 'si-start',
    name: 'Starting Procedure',
    description: 'Details of the start sequence, flags, and any variations from standard.',
    examples: ['5-4-1-0 sequence', 'Class flag with sound', 'I flag in effect'],
    importance: 'critical',
    position: { x: 5, y: 33, width: 90, height: 14 },
  },
  {
    id: 'si-marks',
    name: 'Marks & Course',
    description: 'Description of course marks, rounding directions, and course configurations.',
    examples: ['Orange cylindrical marks', 'Leave all marks to port', 'Windward-Leeward course'],
    importance: 'critical',
    position: { x: 5, y: 48, width: 90, height: 12 },
  },
  {
    id: 'si-finish',
    name: 'Finish',
    description: 'Where and how the finish is conducted.',
    examples: ['Finish between RC boat and orange buoy', 'Blue flag at finish', 'Sound signal for first boat'],
    importance: 'important',
    position: { x: 5, y: 61, width: 90, height: 12 },
  },
  {
    id: 'si-penalties',
    name: 'Penalties & Protests',
    description: 'What penalties apply and how to file protests.',
    examples: ['Two-Turns Penalty', 'Protest time limit: 60 minutes', 'Red flag required'],
    importance: 'important',
    position: { x: 5, y: 74, width: 90, height: 12 },
  },
];

// Course Diagram Sections
export const COURSE_SECTIONS: DocumentSection[] = [
  {
    id: 'course-wind',
    name: 'Wind Direction',
    description: 'Arrow showing the prevailing wind direction for orientation.',
    examples: ['Arrow pointing to top = wind from bottom', 'Windward mark is upwind'],
    importance: 'important',
    position: { x: 75, y: 5, width: 20, height: 15 },
  },
  {
    id: 'course-startline',
    name: 'Start/Finish Line',
    description: 'The line between the Race Committee boat and pin end mark.',
    examples: ['Dashed line at bottom', 'RC boat on starboard end', 'Pin on port end'],
    importance: 'critical',
    position: { x: 20, y: 75, width: 60, height: 15 },
  },
  {
    id: 'course-windward',
    name: 'Windward Mark',
    description: 'The mark at the top of the course, sailed upwind to reach.',
    examples: ['Orange cylinder', 'Mark 1 or "W"', 'Leave to port'],
    importance: 'critical',
    position: { x: 35, y: 10, width: 30, height: 20 },
  },
  {
    id: 'course-leeward',
    name: 'Leeward Mark/Gate',
    description: 'The mark(s) at the bottom of the course, sailed downwind to reach.',
    examples: ['Gate = two marks', 'Pass between gate marks', 'Single leeward mark'],
    importance: 'critical',
    position: { x: 30, y: 50, width: 40, height: 20 },
  },
  {
    id: 'course-arrows',
    name: 'Rounding Directions',
    description: 'Arrows showing which side to pass each mark.',
    examples: ['Curved arrow = direction to round', 'Leave to port = round counterclockwise'],
    importance: 'important',
    position: { x: 50, y: 30, width: 25, height: 15 },
  },
];

// Lesson Steps
export const RACE_DOCUMENTS_BASICS_STEPS: RaceDocumentsStep[] = [
  // ==================== STEP 1: INTRODUCTION ====================
  {
    time: 0,
    label: 'Your Race Day Paperwork',
    description: 'Before any race, you\'ll encounter three essential documents. Understanding them is key to being prepared and racing safely.',
    details: [
      'Race documents are published before every regatta',
      'They contain essential information you need to know',
      'Not reading them can result in penalties or disqualification',
      'Most documents are now published online',
    ],
    proTip: 'Download the documents to your phone or print them before race day - you\'ll want them handy! RegattaFlow was designed to help you organize and review all your race documents in one place.',
    visualState: {
      activeDocument: 'all',
      showAllDocuments: true,
      animationState: 'intro',
    },
  },

  // ==================== STEP 2: NOR INTRODUCTION ====================
  {
    time: 10,
    label: 'Notice of Race (NOR)',
    description: 'The NOR is your invitation to the race. It tells you what, when, where, and how to register.',
    details: [
      'Published weeks or months before the event',
      'Contains entry requirements and deadlines',
      'Tells you if you\'re eligible to race',
      'Outlines the schedule and venue information',
    ],
    proTip: 'Check the NOR first to see if you\'re eligible and can make the dates before doing anything else!',
    visualState: {
      activeDocument: 'nor',
      showDocumentPreview: true,
      animationState: 'zoom',
    },
    interactiveSections: NOR_SECTIONS,
  },

  // ==================== STEP 3: NOR DEEP DIVE ====================
  {
    time: 20,
    label: 'NOR Key Sections',
    description: 'Let\'s look at what each section of a NOR contains and why it matters.',
    details: [
      'Organizing Authority: Who\'s running the race',
      'Rules: What racing rules apply (RRS, class rules, prescriptions)',
      'Eligibility: Who can enter (class restrictions, membership)',
      'Entry: How to register, deadlines, and fees',
      'Schedule: Racing and social calendar',
      'Venue: Where to go and what facilities are available',
    ],
    proTip: 'Pay special attention to eligibility requirements - insurance, membership, and certification requirements can prevent you from racing!',
    visualState: {
      activeDocument: 'nor',
      highlightedSections: ['nor-rules', 'nor-eligibility', 'nor-entry'],
      animationState: 'highlight',
    },
    interactiveSections: NOR_SECTIONS,
  },

  // ==================== STEP 4: SI INTRODUCTION ====================
  {
    time: 30,
    label: 'Sailing Instructions (SI)',
    description: 'The Sailing Instructions are the detailed rules for YOUR specific race. They\'re the most important document to read carefully.',
    details: [
      'Published closer to race day (often with the NOR)',
      'Contains specific rules for this event',
      'May modify the standard Racing Rules of Sailing',
      'Details the starting procedure and course',
    ],
    proTip: 'Print or download the SI and keep it on your boat during racing - you may need to reference it!',
    visualState: {
      activeDocument: 'si',
      showDocumentPreview: true,
      animationState: 'zoom',
    },
    interactiveSections: SI_SECTIONS,
  },

  // ==================== STEP 5: SI DEEP DIVE ====================
  {
    time: 40,
    label: 'SI Key Sections',
    description: 'The SI contains critical information that varies from race to race. Missing a rule change here can cost you the race!',
    details: [
      'Changes to Racing Rules: Modifications specific to this event',
      'Signals and Course: How to read the RC signals',
      'Start/Finish: Exact details of the start sequence and finish',
      'Penalties: What penalties apply (one-turn, two-turns, scoring)',
      'Time Limits: How long you have to finish',
      'Protests: How and when to file',
    ],
    proTip: 'Always check if the SI modifies any Racing Rules - a different penalty system can change your on-water decisions!',
    visualState: {
      activeDocument: 'si',
      highlightedSections: ['si-rules', 'si-start', 'si-penalties'],
      animationState: 'highlight',
    },
    interactiveSections: SI_SECTIONS,
  },

  // ==================== STEP 6: COURSE DIAGRAM ====================
  {
    time: 50,
    label: 'Course Diagram',
    description: 'The course diagram shows you exactly where you\'ll be racing and the path you need to follow around the marks.',
    details: [
      'Shows all mark positions relative to the wind',
      'Indicates rounding directions (port or starboard)',
      'May show multiple course configurations',
      'Includes start and finish line locations',
    ],
    proTip: 'Memorize the mark sequence before the race - you won\'t have time to check the diagram during racing!',
    visualState: {
      activeDocument: 'course',
      showDocumentPreview: true,
      animationState: 'zoom',
    },
    interactiveSections: COURSE_SECTIONS,
  },

  // ==================== STEP 7: PUTTING IT TOGETHER ====================
  {
    time: 60,
    label: 'Putting It All Together',
    description: 'These three documents work together to give you everything you need for race day. Here\'s when to read each one.',
    details: [
      'NOR: Read when deciding whether to enter (weeks before)',
      'SI: Study carefully the night before and morning of race',
      'Course Diagram: Review at the venue, confirm with RC signals',
      'Check for amendments on race day - they can change everything!',
    ],
    proTip: 'Create a pre-race checklist that includes reviewing all documents. The best sailors never skip this step!',
    visualState: {
      activeDocument: 'timeline',
      animationState: 'timeline',
      showAllDocuments: true,
    },
  },

  // ==================== STEP 8: QUIZ INTRO ====================
  {
    time: 70,
    label: 'Test Your Knowledge',
    description: 'Let\'s see how well you understand the essential race documents. Answer these questions to complete the lesson!',
    details: [
      'Five questions about NOR, SI, and Course Diagrams',
      'Focus on practical knowledge you\'ll use on race day',
      'Review any sections you\'re unsure about',
    ],
    visualState: {
      activeDocument: 'all',
      showAllDocuments: true,
      animationState: 'intro',
    },
  },
];

// Quiz questions
export interface QuizQuestion {
  id: string;
  question: string;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  explanation: string;
  hint?: string;
}

export const RACE_DOCUMENTS_BASICS_QUIZ: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'What is the primary purpose of the Notice of Race (NOR)?',
    options: [
      { id: 'a', text: 'To announce the race and provide entry information', isCorrect: true },
      { id: 'b', text: 'To describe the race course layout', isCorrect: false },
      { id: 'c', text: 'To list the results after racing', isCorrect: false },
      { id: 'd', text: 'To record protest decisions', isCorrect: false },
    ],
    explanation: 'The NOR is like an invitation to the race. It announces the event, provides eligibility requirements, entry procedures, fees, and the schedule. It\'s published well in advance so sailors can decide whether to enter.',
    hint: 'Think about what you need to know before you decide to enter a race...',
  },
  {
    id: 'q2',
    question: 'When should you read the Sailing Instructions?',
    options: [
      { id: 'a', text: 'After the race is over', isCorrect: false },
      { id: 'b', text: 'Only if there\'s a problem', isCorrect: false },
      { id: 'c', text: 'Before racing, and keep a copy during racing', isCorrect: true },
      { id: 'd', text: 'The Race Committee reads them for you', isCorrect: false },
    ],
    explanation: 'The Sailing Instructions contain critical race-specific rules that you need to know before you race. Many top sailors read them the night before AND again on race morning. Keep a copy on your boat in case you need to reference them!',
    hint: 'Think about when you need to know the specific rules for your race...',
  },
  {
    id: 'q3',
    question: 'What does a course diagram typically show?',
    options: [
      { id: 'a', text: 'Weather forecasts for the race', isCorrect: false },
      { id: 'b', text: 'Mark positions and rounding directions', isCorrect: true },
      { id: 'c', text: 'Competitor rankings from previous races', isCorrect: false },
      { id: 'd', text: 'Entry fees and payment information', isCorrect: false },
    ],
    explanation: 'The course diagram shows you the layout of the race course: where the marks are positioned relative to the wind, which direction to round each mark, and where the start and finish lines are located.',
    hint: 'Picture what you need to navigate around the race course...',
  },
  {
    id: 'q4',
    question: 'In the Sailing Instructions, where would you find information about penalties?',
    options: [
      { id: 'a', text: 'In the NOR only', isCorrect: false },
      { id: 'b', text: 'In the Scoring section', isCorrect: false },
      { id: 'c', text: 'In the Penalties section of the SI', isCorrect: true },
      { id: 'd', text: 'Penalties are always the same - no need to check', isCorrect: false },
    ],
    explanation: 'The SI has a specific section about penalties that may modify the standard Racing Rules. Some events use One-Turn Penalties instead of Two-Turns, or may have scoring penalties instead. Always check this section!',
    hint: 'The SI can change standard Racing Rules - including penalties...',
  },
  {
    id: 'q5',
    question: 'Why is it important to check if the SI modifies any Racing Rules?',
    options: [
      { id: 'a', text: 'It\'s not important - rules never change', isCorrect: false },
      { id: 'b', text: 'The standard rules may be changed for this specific event', isCorrect: true },
      { id: 'c', text: 'To impress other sailors with your knowledge', isCorrect: false },
      { id: 'd', text: 'The RC will announce all changes on the water', isCorrect: false },
    ],
    explanation: 'Sailing Instructions can modify the standard Racing Rules of Sailing for a specific event. For example, the penalty for a foul might be One-Turn instead of Two-Turns, or certain rules might be deleted entirely. Knowing these changes affects your on-water decisions!',
    hint: 'What happens if you expect a Two-Turn penalty but the SI specifies One-Turn?',
  },
];

// Deep dive content
export const RACE_DOCUMENTS_DEEP_DIVE = {
  title: 'More About Race Documents',
  sections: [
    {
      title: 'Document Hierarchy',
      content: 'Race documents have a hierarchy: the Racing Rules of Sailing are the foundation, the NOR can change some rules, and the SI can change NOR and RRS (with some exceptions). When documents conflict, the SI usually takes precedence.',
    },
    {
      title: 'Where to Find Documents',
      content: 'Most race documents are published on the organizing club\'s website, on scoring platforms like Yacht Scoring or Regatta Network, or on class association websites. Always verify you have the most recent version before race day!',
    },
    {
      title: 'Amendments',
      content: 'Race documents can be changed after publication through "Amendments." These are posted on the official notice board (physical or online). It\'s your responsibility to check for amendments before each race day!',
    },
  ],
  proTips: [
    'Save documents to your phone for offline access on the water',
    'Highlight or note any rule modifications that affect your sailing',
    'Create a summary card of the most important information',
    'Check the official notice board each morning for amendments',
    'If something in the SI seems unclear, ask the Race Committee before racing',
  ],
};

// Document metadata for rendering
export const DOCUMENT_METADATA = {
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
};

// Timeline for when to read each document
export const DOCUMENT_TIMELINE = [
  {
    document: 'nor',
    timing: 'Weeks Before',
    actions: ['Check eligibility', 'Note entry deadline', 'Review schedule', 'Submit entry'],
  },
  {
    document: 'si',
    timing: 'Night Before / Race Morning',
    actions: ['Study rule changes', 'Learn start procedure', 'Understand penalties', 'Note course signals'],
  },
  {
    document: 'course',
    timing: 'At the Venue',
    actions: ['Memorize mark sequence', 'Confirm rounding directions', 'Match to RC signals', 'Brief your crew'],
  },
];
