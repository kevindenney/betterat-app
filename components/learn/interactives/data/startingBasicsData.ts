/**
 * Starting Basics - Lesson Data
 * An introduction to the fundamentals of starting a sailboat race
 * for absolute beginners.
 *
 * This lesson covers:
 * - What a starting line is
 * - The goal of a good start
 * - Basic positioning options
 * - How to approach the line
 * - The start signal
 * - What happens if you're early (OCS)
 * - Tips for your first start
 */

export interface StartingBasicsStep {
  time: number;
  label: string;
  description: string;
  details?: string[];
  proTip?: string;
  boats: BoatPosition[];
  marks?: MarkPosition[];
  highlights?: string[];
  showOCSZone?: boolean;
}

export interface BoatPosition {
  id: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
  label?: string;
  isOCS?: boolean; // Over the line early
  hasArrow?: boolean; // Show movement arrow
}

export interface MarkPosition {
  id: string;
  type: 'start-pin' | 'rc-boat' | 'windward';
  x: number;
  y: number;
  label?: string;
}

// Boat colors
const BOAT_COLORS = {
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#10B981',
  orange: '#F59E0B',
  purple: '#8B5CF6',
};

// Standard start line marks
const START_LINE_MARKS: MarkPosition[] = [
  { id: 'rc-boat', type: 'rc-boat', x: 600, y: 350, label: 'Committee Boat' },
  { id: 'start-pin', type: 'start-pin', x: 200, y: 350, label: 'Pin Mark' },
];

export const STARTING_BASICS_STEPS: StartingBasicsStep[] = [
  // ==================== STEP 1: WHAT IS A STARTING LINE ====================
  {
    time: 0,
    label: 'What is a Starting Line?',
    description:
      'A starting line is an imaginary line between two objects: the committee boat (RC boat) and a mark called the "pin." All boats must start by crossing this line after the signal.',
    details: [
      'The committee boat (RC) is usually on the right (starboard end)',
      'The pin mark is on the left (port end)',
      'The "line" is the invisible connection between them',
      'You must be behind the line when the start signal sounds',
    ],
    proTip:
      'Before your first race, sail along the line to see where it is. Many beginners don\'t realize exactly where the "line" is until they practice finding it.',
    marks: START_LINE_MARKS,
    boats: [
      // Show boats lined up behind the line
      { id: 'boat1', color: BOAT_COLORS.blue, x: 250, y: 400, rotation: -45 },
      { id: 'boat2', color: BOAT_COLORS.red, x: 350, y: 390, rotation: -45 },
      { id: 'boat3', color: BOAT_COLORS.green, x: 450, y: 395, rotation: -45 },
      { id: 'boat4', color: BOAT_COLORS.orange, x: 550, y: 385, rotation: -45 },
    ],
  },

  // ==================== STEP 2: THE GOAL OF A GOOD START ====================
  {
    time: 10,
    label: 'The Goal of a Good Start',
    description:
      'A good start means crossing the line at full speed, right as the signal sounds, with "clear air" (no boats blocking your wind). Getting this right gives you a huge advantage!',
    details: [
      'Cross the line at the exact moment of the start signal',
      'Be at full speed when you cross (not stopped or slow)',
      'Have clear air - no boats between you and the wind',
      'Be in a position to sail your planned course',
    ],
    proTip:
      'For your first few races, focus on just crossing the line cleanly after the signal. Speed and positioning come with practice.',
    marks: START_LINE_MARKS,
    boats: [
      // Boat crossing at speed with clear air
      { id: 'boat1', color: BOAT_COLORS.blue, x: 400, y: 350, rotation: -45, label: 'Good!' },
      // Other boats behind
      { id: 'boat2', color: BOAT_COLORS.red, x: 300, y: 400, rotation: -45 },
      { id: 'boat3', color: BOAT_COLORS.green, x: 450, y: 410, rotation: -45 },
      { id: 'boat4', color: BOAT_COLORS.orange, x: 500, y: 395, rotation: -45 },
    ],
    highlights: ['good-start'],
  },

  // ==================== STEP 3: WHERE CAN YOU START ====================
  {
    time: 20,
    label: 'Where Can You Start?',
    description:
      'You can start anywhere along the line - near the pin (port end), near the committee boat (starboard end), or in the middle. Each position has advantages.',
    details: [
      'Pin End (left): Good if the wind favors this side',
      'Boat End (right): Often less crowded, easier escape',
      'Middle: Flexible, but can get "squeezed" by boats on either side',
      'The whole line is legal - pick what suits your comfort level',
    ],
    proTip:
      'As a beginner, the boat end (starboard/committee boat end) is often easiest. It\'s usually less crowded and gives you more options if things don\'t go perfectly.',
    marks: START_LINE_MARKS,
    boats: [
      // Boats at different positions along the line
      { id: 'boat1', color: BOAT_COLORS.blue, x: 230, y: 380, rotation: -45, label: 'Pin End' },
      { id: 'boat2', color: BOAT_COLORS.red, x: 400, y: 370, rotation: -45, label: 'Middle' },
      { id: 'boat3', color: BOAT_COLORS.green, x: 560, y: 375, rotation: -45, label: 'Boat End' },
    ],
    highlights: ['line-positions'],
  },

  // ==================== STEP 4: APPROACHING THE LINE ====================
  {
    time: 30,
    label: 'Approaching the Line',
    description:
      'Most sailors approach the line on a "reach" (wind from the side), staying below the line until close to start time. This gives you control and lets you accelerate when needed.',
    details: [
      'Stay behind the line until close to start time',
      'Approach on a reach (wind from your side) for control',
      'Keep looking around - be aware of other boats',
      'Give yourself room to maneuver and accelerate',
    ],
    proTip:
      'Stay a few boat lengths below the line until 30 seconds before the start. This gives you room to build speed without crossing early.',
    marks: START_LINE_MARKS,
    boats: [
      // Boats reaching below the line
      { id: 'boat1', color: BOAT_COLORS.blue, x: 200, y: 420, rotation: 90, hasArrow: true },
      { id: 'boat2', color: BOAT_COLORS.red, x: 350, y: 430, rotation: 85, hasArrow: true },
      { id: 'boat3', color: BOAT_COLORS.green, x: 500, y: 425, rotation: 88, hasArrow: true },
    ],
    highlights: ['approach'],
  },

  // ==================== STEP 5: THE START SIGNAL ====================
  {
    time: 40,
    label: 'The Start Signal',
    description:
      'The race committee signals the start with a horn or gun and by dropping a flag. When you hear the signal and see the flag drop, the race has begun - you can cross the line!',
    details: [
      'A loud horn or gun sounds at the start',
      'A flag is dropped or lowered on the committee boat',
      'Both signals happen at the same time',
      'You\'re now racing - cross the line and go!',
    ],
    proTip:
      'Watch the flag AND listen for the horn. Sometimes the horn fails or you can\'t hear it over the wind. The flag is the official signal.',
    marks: [
      { id: 'rc-boat', type: 'rc-boat', x: 600, y: 350, label: 'FLAG DOWN!' },
      { id: 'start-pin', type: 'start-pin', x: 200, y: 350 },
    ],
    boats: [
      // Boats accelerating across the line
      { id: 'boat1', color: BOAT_COLORS.blue, x: 280, y: 350, rotation: -45 },
      { id: 'boat2', color: BOAT_COLORS.red, x: 380, y: 345, rotation: -45 },
      { id: 'boat3', color: BOAT_COLORS.green, x: 480, y: 355, rotation: -45 },
      { id: 'boat4', color: BOAT_COLORS.orange, x: 540, y: 350, rotation: -45 },
    ],
    highlights: ['start-signal'],
  },

  // ==================== STEP 6: OVER EARLY (OCS) ====================
  {
    time: 50,
    label: 'Over Early (OCS)',
    description:
      'If you cross the line BEFORE the start signal, you\'re "Over Early" (OCS). You must go back and re-start. If you don\'t, you\'ll be disqualified for that race.',
    details: [
      'OCS = "On Course Side" (wrong side of the line at the start)',
      'The committee boat will signal boats that are over early',
      'You must sail back, get completely behind the line, then re-cross',
      'It\'s much better to start late than to start early!',
    ],
    proTip:
      'If you think you might be over early, go back immediately! Even if you weren\'t over, it\'s better to restart than risk disqualification.',
    marks: START_LINE_MARKS,
    showOCSZone: true,
    boats: [
      // One boat clearly over early
      { id: 'boat1', color: BOAT_COLORS.red, x: 350, y: 300, rotation: -45, isOCS: true, label: 'OCS!' },
      // Other boats correctly behind line
      { id: 'boat2', color: BOAT_COLORS.blue, x: 250, y: 380, rotation: -45 },
      { id: 'boat3', color: BOAT_COLORS.green, x: 450, y: 390, rotation: -45 },
      { id: 'boat4', color: BOAT_COLORS.orange, x: 550, y: 385, rotation: -45 },
    ],
    highlights: ['ocs'],
  },

  // ==================== STEP 7: TIPS FOR YOUR FIRST START ====================
  {
    time: 60,
    label: 'Tips for Your First Start',
    description:
      'Your first starts can feel chaotic, but these simple tips will help you get going safely and learn quickly.',
    details: [
      'Start near the committee boat - it\'s usually less crowded',
      'Stay a bit behind other boats until you\'re comfortable',
      'Focus on crossing AFTER the signal, not exactly ON the signal',
      'Keep your head up and watch for other boats',
      'Ask experienced sailors for tips at your club!',
    ],
    proTip:
      'Remember: the start is important, but it\'s just the beginning. A great sailor can recover from a bad start. Focus on finishing the race and learning from each experience.',
    marks: START_LINE_MARKS,
    boats: [
      // Happy fleet starting together
      { id: 'boat1', color: BOAT_COLORS.blue, x: 250, y: 360, rotation: -45 },
      { id: 'boat2', color: BOAT_COLORS.red, x: 350, y: 355, rotation: -45 },
      { id: 'boat3', color: BOAT_COLORS.green, x: 450, y: 360, rotation: -45 },
      { id: 'boat4', color: BOAT_COLORS.orange, x: 530, y: 365, rotation: -45, label: 'You!' },
    ],
    highlights: ['tips'],
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

export const STARTING_BASICS_QUIZ: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'What are the two objects that define a starting line?',
    options: [
      { id: 'a', text: 'Two buoys floating in the water', isCorrect: false },
      { id: 'b', text: 'The committee boat and the pin mark', isCorrect: true },
      { id: 'c', text: 'The finish line and windward mark', isCorrect: false },
      { id: 'd', text: 'Two flags on the shore', isCorrect: false },
    ],
    explanation:
      'The starting line runs between the committee boat (RC boat) on the starboard end and a pin mark on the port end. The "line" is imaginary but very real for scoring purposes!',
    hint: 'One is a boat, one is a mark...',
  },
  {
    id: 'q2',
    question: 'What are the three goals of a good start?',
    options: [
      { id: 'a', text: 'Start early, sail fast, beat everyone', isCorrect: false },
      { id: 'b', text: 'Full speed, on time, with clear air', isCorrect: true },
      { id: 'c', text: 'Stay safe, avoid boats, finish the race', isCorrect: false },
      { id: 'd', text: 'Win the start, win the race, get a trophy', isCorrect: false },
    ],
    explanation:
      'A good start means crossing the line at full speed, exactly when the signal sounds, with clear air (no boats blocking your wind). This sets you up for a strong race.',
    hint: 'Think about what puts you in the best position right after the start...',
  },
  {
    id: 'q3',
    question: 'What happens if you cross the starting line before the signal?',
    options: [
      { id: 'a', text: 'You get a head start advantage', isCorrect: false },
      { id: 'b', text: 'Nothing, you just keep racing', isCorrect: false },
      { id: 'c', text: 'You must return and re-start, or be disqualified', isCorrect: true },
      { id: 'd', text: 'You go to the back of the fleet', isCorrect: false },
    ],
    explanation:
      'Being over the line early (OCS) means you must sail back, get completely behind the line, and re-cross properly. If you don\'t return, you\'ll be disqualified from that race.',
    hint: 'Starting early isn\'t an advantage - it\'s a penalty...',
  },
  {
    id: 'q4',
    question: 'For a beginner, where is often the easiest place to start?',
    options: [
      { id: 'a', text: 'Right in the middle of the line', isCorrect: false },
      { id: 'b', text: 'At the pin end (port/left side)', isCorrect: false },
      { id: 'c', text: 'Near the committee boat (starboard/right side)', isCorrect: true },
      { id: 'd', text: 'Behind all the other boats', isCorrect: false },
    ],
    explanation:
      'The committee boat end (starboard side) is often less crowded and gives beginners more room to maneuver. It\'s a good place to learn without getting caught in the chaos of a crowded pin end.',
    hint: 'Which end is usually less crowded and gives more escape options?',
  },
];

// Deep dive content
export const DEEP_DIVE_CONTENT = {
  title: 'Deep Dive: Starting Fundamentals',
  sections: [
    {
      title: 'Why Starts Matter',
      content:
        'A good start can make or break your race. Starting in clean air at full speed puts you ahead of the fleet, while a poor start means fighting through "dirty air" (disturbed wind from boats ahead). Studies show that boats in the top 10 at the first mark usually finish in the top 10.',
    },
    {
      title: 'The Starting Sequence',
      content:
        'Most races use a 5-minute countdown: a warning signal at 5 minutes, a preparatory signal at 4 minutes, and the start at 0. Flags and horns mark each signal. Learn this sequence before your first race!',
    },
    {
      title: 'Right-of-Way Basics',
      content:
        'At the start, boats on starboard tack (wind from the right) have right-of-way over boats on port tack. Also, boats to leeward (downwind) of you generally have rights. These rules help prevent collisions.',
    },
    {
      title: 'Building Confidence',
      content:
        'Start with smaller club races where the pressure is low. Practice arriving early to watch other starts. Ask experienced sailors to mentor you. Most clubs are very welcoming to new racers!',
    },
  ],
  proTips: [
    'Arrive early and watch the fleet starts before yours',
    'Sail the course before the race to understand the wind and marks',
    'Find a buddy to practice starts with before race day',
    'Keep a notebook of what works and what doesn\'t',
    'Ask questions! Sailors love helping newcomers',
    'Focus on finishing races before worrying about winning',
  ],
};
