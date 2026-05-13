/**
 * Downwind Basics - Lesson Data
 * Introduction to downwind sailing for beginners
 *
 * This lesson covers:
 * - What downwind sailing is
 * - The downwind course layout
 * - Gybing maneuvers
 * - Sailing angles and VMG
 * - Reading the wind downwind
 * - Strategic gybing
 */

export interface DownwindBasicsStep {
  time: number;
  label: string;
  description: string;
  details?: string[];
  proTip?: string;
  boats: BoatPosition[];
  marks?: MarkPosition[];
  highlights?: string[];
  showVMGAngles?: boolean;
  showGybeZone?: boolean;
}

export interface BoatPosition {
  id: string;
  color: string;
  x: number;
  y: number;
  rotation: number;
  label?: string;
  showPath?: boolean;
  pathPoints?: { x: number; y: number }[];
  hasSpinnaker?: boolean;
  angle?: 'dead-downwind' | 'broad-reach' | 'hot-angle';
}

export interface MarkPosition {
  id: string;
  type: 'windward' | 'leeward' | 'gate-left' | 'gate-right';
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

// Standard downwind course marks
const DOWNWIND_MARKS: MarkPosition[] = [
  { id: 'windward', type: 'windward', x: 400, y: 120, label: 'Windward Mark' },
  { id: 'gate-left', type: 'gate-left', x: 300, y: 420, label: 'Gate' },
  { id: 'gate-right', type: 'gate-right', x: 500, y: 420 },
];

export const DOWNWIND_BASICS_STEPS: DownwindBasicsStep[] = [
  // ==================== STEP 1: WHAT IS DOWNWIND SAILING ====================
  {
    time: 0,
    label: 'What is Downwind Sailing?',
    description:
      'Downwind sailing means sailing in the same direction the wind is blowing - from the windward mark down to the leeward mark or gate. The wind pushes you from behind!',
    details: [
      'You\'re sailing with the wind, not against it',
      'The boat is pushed by the wind filling the sails from behind',
      'It feels easier than upwind, but has its own challenges',
      'Speed and angles matter just as much as upwind',
    ],
    proTip:
      'Downwind sailing can feel deceptively simple, but the best sailors know there\'s a lot of technique and strategy involved. Don\'t just "run" straight down!',
    marks: DOWNWIND_MARKS,
    boats: [
      { id: 'boat1', color: BOAT_COLORS.blue, x: 350, y: 200, rotation: 160, hasSpinnaker: true },
      { id: 'boat2', color: BOAT_COLORS.red, x: 450, y: 250, rotation: 200, hasSpinnaker: true },
      { id: 'boat3', color: BOAT_COLORS.green, x: 380, y: 320, rotation: 180, hasSpinnaker: true },
    ],
  },

  // ==================== STEP 2: THE DOWNWIND COURSE ====================
  {
    time: 10,
    label: 'The Downwind Course',
    description:
      'After rounding the windward mark, you sail downwind to the leeward gate. Modern courses use a "gate" (two marks) at the bottom, giving you options for which way to round.',
    details: [
      'Round the windward mark and head downwind',
      'The leeward gate has two marks - choose either one',
      'After the gate, you go back upwind',
      'Course shape is called a "windward-leeward" or "sausage" course',
    ],
    proTip:
      'When approaching the leeward gate, think ahead - which gate gives you the best angle for the next upwind leg? It\'s not always the one you\'re closest to.',
    marks: DOWNWIND_MARKS,
    boats: [
      {
        id: 'boat1',
        color: BOAT_COLORS.blue,
        x: 380,
        y: 280,
        rotation: 170,
        showPath: true,
        pathPoints: [
          { x: 400, y: 100 },
          { x: 380, y: 280 },
        ],
        hasSpinnaker: true,
      },
      { id: 'boat2', color: BOAT_COLORS.red, x: 340, y: 380, rotation: 175, hasSpinnaker: true },
    ],
    highlights: ['course-layout'],
  },

  // ==================== STEP 3: GYBING EXPLAINED ====================
  {
    time: 20,
    label: 'Gybing Explained',
    description:
      'A "gybe" (or "jibe") is when you turn the boat so the stern (back) passes through the wind. The boom swings across to the other side. It\'s the downwind equivalent of a tack.',
    details: [
      'The stern (back) of the boat turns through the wind',
      'The boom swings rapidly from one side to the other',
      'More dramatic than a tack - the boom moves fast!',
      'Good crew coordination prevents accidents',
    ],
    proTip:
      'Always call "Gybe-ho!" or "Gybing!" loudly before you gybe. The boom can swing with force, and everyone needs to duck! In heavy wind, control the boom with the mainsheet.',
    showGybeZone: true,
    marks: [
      { id: 'gate-left', type: 'gate-left', x: 300, y: 420 },
      { id: 'gate-right', type: 'gate-right', x: 500, y: 420 },
    ],
    boats: [
      { id: 'before', color: BOAT_COLORS.blue, x: 320, y: 250, rotation: 150, label: 'Before', hasSpinnaker: true },
      { id: 'mid', color: BOAT_COLORS.blue, x: 400, y: 300, rotation: 180, label: 'Gybing' },
      { id: 'after', color: BOAT_COLORS.blue, x: 480, y: 350, rotation: 210, label: 'After', hasSpinnaker: true },
    ],
    highlights: ['gybe-sequence'],
  },

  // ==================== STEP 4: SAILING ANGLES ====================
  {
    time: 30,
    label: 'Sailing Angles (VMG)',
    description:
      'Here\'s a key insight: sailing straight downwind ("dead downwind") is often NOT the fastest way to the mark! Sailing at an angle and gybing ("hot angles") can be faster overall.',
    details: [
      'VMG = Velocity Made Good (speed toward your goal)',
      'Dead downwind: Pointing straight at mark, but slower',
      'Hot angles: More distance, but much more speed',
      'Optimal VMG angle is usually 10-20° off dead downwind',
    ],
    proTip:
      'Think of it like this: would you rather sail 100 meters at 5 knots, or 110 meters at 7 knots? The longer but faster route often wins!',
    showVMGAngles: true,
    marks: DOWNWIND_MARKS,
    boats: [
      { id: 'deadDownwind', color: BOAT_COLORS.red, x: 400, y: 250, rotation: 180, label: 'Slow!', angle: 'dead-downwind' },
      { id: 'hotAngle1', color: BOAT_COLORS.green, x: 300, y: 280, rotation: 155, label: 'Fast!', angle: 'hot-angle', hasSpinnaker: true },
      { id: 'hotAngle2', color: BOAT_COLORS.blue, x: 500, y: 280, rotation: 205, label: 'Fast!', angle: 'hot-angle', hasSpinnaker: true },
    ],
    highlights: ['vmg-angles'],
  },

  // ==================== STEP 5: READING THE WIND ====================
  {
    time: 40,
    label: 'Reading the Wind Downwind',
    description:
      'Just like upwind, you need to read the wind downwind. Look for "puffs" (gusts) and "pressure" (more wind). Sailing in more wind makes a huge difference!',
    details: [
      'Darker water = more wind (look for ripples)',
      'Puffs travel across the water - sail toward them',
      '"Lanes" of pressure can carry you down the course',
      'The apparent wind feels lighter downwind - stay alert!',
    ],
    proTip:
      'When you\'re sailing downwind, the apparent wind (what you feel) is much lighter than the true wind because you\'re moving with it. Look at the water, not just your wind indicator!',
    marks: DOWNWIND_MARKS,
    boats: [
      { id: 'inPressure', color: BOAT_COLORS.green, x: 320, y: 280, rotation: 165, label: 'In Pressure!', hasSpinnaker: true },
      { id: 'outPressure', color: BOAT_COLORS.red, x: 500, y: 300, rotation: 195, label: 'Light Air' },
    ],
    highlights: ['pressure-lanes'],
  },

  // ==================== STEP 6: WHEN TO GYBE ====================
  {
    time: 50,
    label: 'When to Gybe',
    description:
      'Strategic gybing is key to downwind success. Gybe to sail toward more pressure, to cover competitors, or when you\'re being headed (wind shifts behind you).',
    details: [
      'Gybe to sail toward more wind pressure',
      'Gybe when the wind shifts behind you (heading shift)',
      'Gybe to stay between competitors and the mark',
      'Don\'t gybe too often - each gybe costs time',
    ],
    proTip:
      'A good rule: gybe when you can sail a better angle toward the mark on the other gybe. If the new gybe points more directly at the gate, it\'s probably time to gybe.',
    marks: DOWNWIND_MARKS,
    boats: [
      { id: 'boat1', color: BOAT_COLORS.blue, x: 280, y: 200, rotation: 150, hasSpinnaker: true },
      { id: 'boat2', color: BOAT_COLORS.blue, x: 400, y: 280, rotation: 180, label: 'Gybe here?' },
      { id: 'boat3', color: BOAT_COLORS.blue, x: 480, y: 360, rotation: 200, hasSpinnaker: true },
    ],
    highlights: ['gybe-decision'],
  },

  // ==================== STEP 7: TIPS FOR SUCCESS ====================
  {
    time: 60,
    label: 'Tips for Downwind Success',
    description:
      'Putting it together: the best downwind sailors combine speed, angles, and smart gybing. Here are the key principles.',
    details: [
      'Don\'t sail dead downwind - use VMG angles',
      'Stay in the pressure - sail toward dark water',
      'Watch for "death rolls" - keep the boat stable',
      'Plan your approach to the leeward gate early',
      'Gybe smoothly and at the right moments',
    ],
    proTip:
      'The biggest beginner mistake downwind is "death rolling" - the boat rocking side to side until it capsizes. Keep your weight centered and adjust the sails smoothly.',
    marks: DOWNWIND_MARKS,
    boats: [
      { id: 'boat1', color: BOAT_COLORS.blue, x: 300, y: 200, rotation: 155, hasSpinnaker: true },
      { id: 'boat2', color: BOAT_COLORS.red, x: 450, y: 240, rotation: 195, hasSpinnaker: true },
      { id: 'boat3', color: BOAT_COLORS.green, x: 350, y: 320, rotation: 170, hasSpinnaker: true },
      { id: 'boat4', color: BOAT_COLORS.orange, x: 420, y: 380, rotation: 185, hasSpinnaker: true, label: 'You!' },
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

export const DOWNWIND_BASICS_QUIZ: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'What is a "gybe" in sailing?',
    options: [
      { id: 'a', text: 'Turning the boat so the bow passes through the wind', isCorrect: false },
      { id: 'b', text: 'Turning the boat so the stern passes through the wind', isCorrect: true },
      { id: 'c', text: 'Stopping the boat completely', isCorrect: false },
      { id: 'd', text: 'Raising the spinnaker', isCorrect: false },
    ],
    explanation:
      'A gybe is when you turn the boat so the stern (back) passes through the wind direction. The boom swings across from one side to the other. It\'s the downwind equivalent of a tack.',
    hint: 'Think about which end of the boat passes through the wind direction...',
  },
  {
    id: 'q2',
    question: 'Is sailing dead downwind (straight toward the mark) always the fastest route?',
    options: [
      { id: 'a', text: 'Yes, it\'s the shortest distance so it\'s always fastest', isCorrect: false },
      { id: 'b', text: 'No, sailing at an angle and gybing can be faster due to higher boat speed', isCorrect: true },
      { id: 'c', text: 'It depends on the wind direction only', isCorrect: false },
      { id: 'd', text: 'Yes, but only in light wind', isCorrect: false },
    ],
    explanation:
      'Sailing at "hot angles" (10-20° off dead downwind) and gybing is often faster because the boat speed increases significantly. VMG (Velocity Made Good) can be higher even though you sail more distance.',
    hint: 'Would you rather go 100m slowly or 110m much faster?',
  },
  {
    id: 'q3',
    question: 'What is VMG (Velocity Made Good)?',
    options: [
      { id: 'a', text: 'How fast your GPS says you\'re going', isCorrect: false },
      { id: 'b', text: 'Your maximum possible speed', isCorrect: false },
      { id: 'c', text: 'How fast you\'re actually getting toward your target', isCorrect: true },
      { id: 'd', text: 'The wind speed', isCorrect: false },
    ],
    explanation:
      'VMG measures your effective speed toward your destination, not just your boat speed. You might be sailing fast at an angle, but what matters is how quickly you\'re actually getting to the mark.',
    hint: 'Think about your progress toward the goal, not just your speed...',
  },
  {
    id: 'q4',
    question: 'What is a "death roll" and how do you avoid it?',
    options: [
      { id: 'a', text: 'A racing rule - avoid by studying the rules', isCorrect: false },
      { id: 'b', text: 'Dangerous rocking that leads to capsize - keep weight centered and adjust sails smoothly', isCorrect: true },
      { id: 'c', text: 'A type of gybe - just practice more', isCorrect: false },
      { id: 'd', text: 'Sailing too fast - slow down', isCorrect: false },
    ],
    explanation:
      'A death roll is an oscillating roll that builds until the boat capsizes. It happens downwind when the boat becomes unstable. Prevent it by keeping your weight centered, steering smoothly, and trimming the sails properly.',
    hint: 'This is about boat stability while sailing downwind...',
  },
];

// Deep dive content
export const DEEP_DIVE_CONTENT = {
  title: 'Deep Dive: Downwind Sailing',
  sections: [
    {
      title: 'Spinnaker Basics',
      content:
        'A spinnaker is a large, colorful sail used downwind. It\'s like a parachute that catches the wind. Asymmetric spinnakers are easier to handle than symmetric ones. Many racing boats use spinnakers to go much faster downwind.',
    },
    {
      title: 'Apparent Wind',
      content:
        'Apparent wind is what you feel on the boat - a combination of true wind and the wind created by your movement. Downwind, these partially cancel out, making the apparent wind feel light. This is why it\'s important to watch the water, not just feel the wind.',
    },
    {
      title: 'The Oscillation Gybe',
      content:
        'Advanced sailors "oscillate" down the course, gybing on wind shifts just like tacking on shifts upwind. When the wind shifts behind you (you\'re being headed), the other gybe becomes favored. Sail the favorable gybe!',
    },
    {
      title: 'Covering Downwind',
      content:
        'Just like upwind, you can "cover" competitors downwind by staying between them and the mark. Your "dirty air" will slow them down. If you\'re leading, sail defensively. If behind, try to sail your own race in clear air.',
    },
  ],
  proTips: [
    'Look behind you! The wind and competitors are there',
    'Practice gybes until they\'re smooth and fast',
    'In waves, use the waves to surf and accelerate',
    'Keep the boat flat - heeling slows you down downwind too',
    'Communicate clearly with your crew during gybes',
    'At the leeward gate, plan your rounding before you arrive',
  ],
};
