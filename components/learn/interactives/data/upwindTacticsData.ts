/**
 * Upwind Tactics - Lesson Data
 * Basic upwind sailing strategies for beginners
 *
 * This lesson covers:
 * - What upwind sailing is and why you can't sail directly into the wind
 * - The zigzag pattern of beating upwind
 * - Tacking maneuvers
 * - Choosing which side of the course to sail
 * - Understanding laylines
 * - Basic wind shift concepts
 */

export interface UpwindTacticsStep {
  time: number;
  label: string;
  description: string;
  details?: string[];
  proTip?: string;
  boats: BoatPosition[];
  marks?: MarkPosition[];
  highlights?: string[];
  showLaylines?: boolean;
  showTackZone?: boolean;
  windShiftAngle?: number; // degrees offset from true wind
}

export interface BoatPosition {
  id: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
  label?: string;
  showPath?: boolean; // Show previous path
  pathPoints?: { x: number; y: number }[];
  tack?: 'port' | 'starboard';
}

export interface MarkPosition {
  id: string;
  type: 'windward' | 'leeward' | 'gate-left' | 'gate-right' | 'start-pin' | 'rc-boat';
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

// Standard upwind course marks
const UPWIND_MARKS: MarkPosition[] = [
  { id: 'windward', type: 'windward', x: 400, y: 120, label: 'Windward Mark' },
  { id: 'start-pin', type: 'start-pin', x: 200, y: 420 },
  { id: 'rc-boat', type: 'rc-boat', x: 600, y: 420 },
];

export const UPWIND_TACTICS_STEPS: UpwindTacticsStep[] = [
  // ==================== STEP 1: WHAT IS UPWIND SAILING ====================
  {
    time: 0,
    label: 'What is Upwind Sailing?',
    description:
      'Upwind sailing means sailing toward the direction the wind is coming from. The catch? Sailboats can\'t sail directly into the wind - there\'s a "no-go zone" of about 45° on either side of the wind.',
    details: [
      'The wind pushes against your sails - you can\'t sail directly into it',
      'The "no-go zone" is roughly 90° wide (45° on each side)',
      'To go upwind, you sail at an angle to the wind',
      'This is called "beating" or "sailing close-hauled"',
    ],
    proTip:
      'Think of it like walking up a steep hill - you can\'t walk straight up, so you zigzag back and forth. Sailing upwind is the same concept!',
    marks: UPWIND_MARKS,
    boats: [
      // Boat trying to sail into no-go zone (crossed out) - positioned below the zone label
      { id: 'noGo', color: '#CBD5E1', x: 400, y: 310, rotation: 0, label: 'No-Go!' },
      // Boats at correct angles - outside the no-go zone, positioned so labels don't overlap boats
      { id: 'port', color: BOAT_COLORS.blue, x: 240, y: 380, rotation: -45, tack: 'port', label: 'Port Tack' },
      { id: 'starboard', color: BOAT_COLORS.red, x: 560, y: 380, rotation: 45, tack: 'starboard', label: 'Starboard Tack' },
    ],
  },

  // ==================== STEP 2: THE UPWIND COURSE ====================
  {
    time: 10,
    label: 'The Upwind Course',
    description:
      'To sail from the start to the windward mark, you sail a zigzag course. Each "zig" and "zag" is called a leg or a board. The goal is to reach the windward mark as efficiently as possible.',
    details: [
      'You alternate between port tack and starboard tack',
      'The windward mark is your target at the top of the course',
      'Each zigzag leg gets you closer to the mark',
      'The shortest path isn\'t always a straight line upwind!',
    ],
    proTip:
      'A good upwind sailor thinks several moves ahead - like a chess player. Where you are on the course affects your options later.',
    marks: UPWIND_MARKS,
    boats: [
      // Boat with zigzag path
      {
        id: 'boat1',
        color: BOAT_COLORS.blue,
        x: 350,
        y: 200,
        rotation: -45,
        showPath: true,
        pathPoints: [
          { x: 300, y: 400 },
          { x: 450, y: 300 },
          { x: 350, y: 200 },
        ],
      },
      // Other boats on course
      { id: 'boat2', color: BOAT_COLORS.red, x: 480, y: 280, rotation: 45, tack: 'starboard' },
      { id: 'boat3', color: BOAT_COLORS.green, x: 280, y: 350, rotation: -45, tack: 'port' },
    ],
    highlights: ['zigzag-path'],
  },

  // ==================== STEP 3: TACKING EXPLAINED ====================
  {
    time: 20,
    label: 'Tacking Explained',
    description:
      'A "tack" is when you turn the boat through the wind to change direction. The bow (front) of the boat passes through the wind, and you switch from one side to the other.',
    details: [
      'During a tack, the bow turns through the wind',
      'The sails swing from one side to the other',
      'You move from port tack to starboard tack (or vice versa)',
      'A good tack is smooth and doesn\'t lose much speed',
    ],
    proTip:
      'The key to a good tack is timing and crew coordination. Call "Ready about!" then "Helm\'s a-lee!" as you turn.',
    showTackZone: true,
    marks: [{ id: 'windward', type: 'windward', x: 400, y: 80, label: 'Windward Mark' }],
    boats: [
      // Before tack (starboard)
      { id: 'before', color: BOAT_COLORS.blue, x: 320, y: 300, rotation: 45, label: 'Before', tack: 'starboard' },
      // Mid-tack (head to wind)
      { id: 'mid', color: BOAT_COLORS.blue, x: 400, y: 260, rotation: 0, label: 'Tacking' },
      // After tack (port)
      { id: 'after', color: BOAT_COLORS.blue, x: 480, y: 220, rotation: -45, label: 'After', tack: 'port' },
    ],
    highlights: ['tack-sequence'],
  },

  // ==================== STEP 4: CHOOSING YOUR SIDE ====================
  {
    time: 30,
    label: 'Choosing Your Side',
    description:
      'Which side of the course should you sail on? This depends on wind shifts, current, and where the pressure is. Often, the side with more wind or a favorable shift is the "favored" side.',
    details: [
      'Starboard tack: Wind comes over your right (starboard) side',
      'Port tack: Wind comes over your left (port) side',
      'Look for more wind pressure (darker water = more wind)',
      'Consider geographic features that might affect wind',
    ],
    proTip:
      'Before the start, sail upwind on both tacks and compare your compass headings. If one tack points higher toward the mark, that side might be favored.',
    marks: UPWIND_MARKS,
    boats: [
      // Boats on different sides
      { id: 'left', color: BOAT_COLORS.blue, x: 250, y: 250, rotation: -45, label: 'Left Side', tack: 'port' },
      { id: 'right', color: BOAT_COLORS.red, x: 550, y: 250, rotation: 45, label: 'Right Side', tack: 'starboard' },
      { id: 'middle', color: BOAT_COLORS.green, x: 400, y: 300, rotation: -45, label: 'Middle' },
    ],
    highlights: ['course-sides'],
  },

  // ==================== STEP 5: LAYLINES ====================
  {
    time: 40,
    label: 'Laylines',
    description:
      'Laylines are imaginary lines extending from the windward mark at your tacking angle. When you reach a layline, you can sail directly to the mark on one tack - no more tacking needed!',
    details: [
      'The port layline extends to the left of the mark',
      'The starboard layline extends to the right of the mark',
      'Hit the layline and you can fetch the mark in one tack',
      'Overstaying on one side past the layline wastes distance',
    ],
    proTip:
      'Don\'t sail to the layline too early! You lose tactical options and can\'t respond to wind shifts. Approach the mark with flexibility.',
    showLaylines: true,
    marks: [{ id: 'windward', type: 'windward', x: 400, y: 80, label: 'Windward Mark' }],
    boats: [
      // Boat on starboard layline
      { id: 'onLayline', color: BOAT_COLORS.blue, x: 550, y: 200, rotation: 45, label: 'On Layline', tack: 'starboard' },
      // Boat approaching layline
      { id: 'approaching', color: BOAT_COLORS.red, x: 450, y: 300, rotation: -45, label: 'Approaching' },
      // Boat overstanding
      { id: 'overstand', color: BOAT_COLORS.orange, x: 620, y: 180, rotation: 45, label: 'Overstanding!' },
    ],
    highlights: ['laylines'],
  },

  // ==================== STEP 6: WIND SHIFTS ====================
  {
    time: 50,
    label: 'Wind Shifts',
    description:
      'The wind rarely stays constant - it "shifts" left and right. A "lift" lets you point higher toward the mark. A "header" forces you to point lower. Smart sailors use shifts to their advantage.',
    details: [
      'Lift: Wind shift that lets you point closer to your target',
      'Header: Wind shift that forces you away from your target',
      'When you get a header, consider tacking to the lifted tack',
      'Sailing "in phase" with shifts means faster progress upwind',
    ],
    proTip:
      'Watch your compass or a fixed point on shore. If you can point higher than before, you\'re lifted. If you\'re forced lower, you\'re headed - time to tack!',
    windShiftAngle: 15, // Show wind shifted 15 degrees
    marks: [{ id: 'windward', type: 'windward', x: 400, y: 80, label: 'Windward Mark' }],
    boats: [
      // Boat that tacked on header (good)
      { id: 'smart', color: BOAT_COLORS.green, x: 350, y: 200, rotation: -30, label: 'Lifted!', tack: 'port' },
      // Boat that didn't tack (bad)
      { id: 'stuck', color: BOAT_COLORS.red, x: 500, y: 280, rotation: 60, label: 'Headed', tack: 'starboard' },
    ],
    highlights: ['wind-shift'],
  },

  // ==================== STEP 7: TIPS FOR SUCCESS ====================
  {
    time: 60,
    label: 'Tips for Upwind Success',
    description:
      'Putting it all together: the best upwind sailors combine boat speed with smart tactics. Here are key principles for sailing fast upwind.',
    details: [
      'Keep the boat flat - heeling slows you down',
      'Look for pressure (wind) - sail toward the dark water',
      'Minimize tacks - each tack costs time and distance',
      'Stay in phase with wind shifts',
      'Don\'t go to the laylines too early',
    ],
    proTip:
      'The best sailors balance two goals: sailing fast (boat speed) and sailing smart (tactics). Neither alone wins races - you need both!',
    marks: UPWIND_MARKS,
    boats: [
      // Fleet sailing upwind well
      { id: 'boat1', color: BOAT_COLORS.blue, x: 320, y: 200, rotation: -45, tack: 'port' },
      { id: 'boat2', color: BOAT_COLORS.red, x: 420, y: 180, rotation: 45, tack: 'starboard' },
      { id: 'boat3', color: BOAT_COLORS.green, x: 360, y: 280, rotation: -45, tack: 'port' },
      { id: 'boat4', color: BOAT_COLORS.orange, x: 480, y: 260, rotation: 45, tack: 'starboard' },
    ],
    highlights: ['success'],
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

export const UPWIND_TACTICS_QUIZ: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Why can\'t a sailboat sail directly into the wind?',
    options: [
      { id: 'a', text: 'The captain doesn\'t want to', isCorrect: false },
      { id: 'b', text: 'The wind pushes against the sails - there\'s no way to generate forward force', isCorrect: true },
      { id: 'c', text: 'It\'s against racing rules', isCorrect: false },
      { id: 'd', text: 'The boat would go too fast', isCorrect: false },
    ],
    explanation:
      'Sailboats generate forward motion by the wind flowing across the sails at an angle. When pointed directly into the wind, there\'s no angle for the wind to create lift - the sails just flap uselessly. This creates the "no-go zone."',
    hint: 'Think about how sails actually work - they need wind flowing across them at an angle.',
  },
  {
    id: 'q2',
    question: 'What is a "tack" in sailing?',
    options: [
      { id: 'a', text: 'A small nail used to hold sails', isCorrect: false },
      { id: 'b', text: 'Turning the boat so the bow passes through the wind', isCorrect: true },
      { id: 'c', text: 'Sailing directly downwind', isCorrect: false },
      { id: 'd', text: 'Dropping the anchor', isCorrect: false },
    ],
    explanation:
      'A tack is the maneuver where you turn the bow (front) of the boat through the wind, switching from one side to the other. The sails swing across and you change from port tack to starboard tack (or vice versa).',
    hint: 'This maneuver involves turning through the wind direction...',
  },
  {
    id: 'q3',
    question: 'What is a layline?',
    options: [
      { id: 'a', text: 'A rope that holds the mast in place', isCorrect: false },
      { id: 'b', text: 'The line sailors stand behind at the start', isCorrect: false },
      { id: 'c', text: 'An imaginary line from the mark at your tacking angle - sail to it and you can fetch the mark', isCorrect: true },
      { id: 'd', text: 'The line painted on the hull', isCorrect: false },
    ],
    explanation:
      'Laylines extend from the windward mark at approximately your close-hauled sailing angle. Once you reach a layline, you can sail directly to the mark on that tack without needing to tack again.',
    hint: 'This helps you know when you can sail directly to the mark...',
  },
  {
    id: 'q4',
    question: 'What should you do when you get a "header" (wind shift forcing you away from the mark)?',
    options: [
      { id: 'a', text: 'Keep sailing the same direction', isCorrect: false },
      { id: 'b', text: 'Consider tacking to the other side where you\'ll be lifted', isCorrect: true },
      { id: 'c', text: 'Stop the boat and wait', isCorrect: false },
      { id: 'd', text: 'Head directly into the wind', isCorrect: false },
    ],
    explanation:
      'When you\'re headed (forced to point away from your target), the other tack is often lifted (pointing closer to your target). Tacking on headers and sailing the lifts is called "staying in phase" with the wind shifts.',
    hint: 'If one tack is worse, what does that mean for the other tack?',
  },
];

// Deep dive content
export const DEEP_DIVE_CONTENT = {
  title: 'Deep Dive: Upwind Tactics',
  sections: [
    {
      title: 'Understanding Wind Angles',
      content:
        'Most boats can sail about 45° off the true wind direction when close-hauled. This means your no-go zone is roughly 90° wide. High-performance boats like foiling AC75s can point even closer, while cruising boats might only manage 50-55°.',
    },
    {
      title: 'Velocity Made Good (VMG)',
      content:
        'VMG measures how fast you\'re actually getting toward the windward mark, not just how fast you\'re sailing. Pinching (pointing too high) makes you slow; footing (bearing away) makes you fast but takes you off course. The optimal VMG balances both.',
    },
    {
      title: 'Strategic Sailing',
      content:
        'Top sailors think about the whole beat before starting. They consider: Where\'s the most wind? Which side is favored? Where are the shifts coming from? Having a plan before you start is crucial.',
    },
    {
      title: 'The "Bang the Corner" Trap',
      content:
        'Going all the way to one side of the course (banging the corner) is risky. If the wind shifts the other way, you lose massively. Better sailors stay more central, keeping their options open.',
    },
  ],
  proTips: [
    'Practice tacking until it\'s smooth and automatic',
    'Learn to read the water - dark patches mean more wind',
    'Watch other boats - they show you where the wind is',
    'Keep your head out of the boat - look around constantly',
    'Don\'t follow the fleet blindly - trust your own observations',
    'Sail your own race, but be aware of the competition',
  ],
};
