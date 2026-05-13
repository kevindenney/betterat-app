/**
 * Types of Races - Lesson Data
 * An introduction to different sailboat racing formats: fleet, match, team, and distance racing
 *
 * This lesson explains the four main types of competitive sailing races,
 * with animated visualizations showing how each format works.
 */

export interface RaceTypeStep {
  time: number; // Timeline position (seconds)
  label: string;
  description: string;
  details?: string[];
  proTip?: string;
  boats: BoatPosition[];
  marks?: MarkPosition[];
  teams?: TeamDefinition[];
  highlights?: string[];
  raceType: 'fleet' | 'match' | 'team' | 'distance' | 'overview';
}

export interface BoatPosition {
  id: string;
  color: string;
  x: number;
  y: number;
  rotation: number; // degrees, 0 = pointing right (east)
  hasSpinnaker?: boolean;
  label?: string; // Position number or team indicator
  teamId?: 'A' | 'B';
  isOffshore?: boolean; // For larger offshore boats
}

export interface MarkPosition {
  id: string;
  type: 'windward' | 'leeward' | 'gate-left' | 'gate-right' | 'start-pin' | 'rc-boat' | 'offset' | 'island' | 'waypoint';
  x: number;
  y: number;
  label?: string;
}

export interface TeamDefinition {
  id: 'A' | 'B';
  name: string;
  color: string;
}

// Fleet racing colors - many boats
const FLEET_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Orange
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

// Match racing colors - two boats
const MATCH_COLORS = {
  boat1: '#3B82F6', // Blue
  boat2: '#EF4444', // Red
};

// Team racing colors
const TEAM_COLORS = {
  teamA: '#3B82F6', // Blue team
  teamB: '#EF4444', // Red team
};

// Offshore/distance racing colors
const OFFSHORE_COLORS = [
  '#1E3A5F', // Dark blue
  '#DC2626', // Red
  '#059669', // Teal
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#0891B2', // Cyan
];

// Standard course marks
const STANDARD_MARKS: MarkPosition[] = [
  { id: 'windward', type: 'windward', x: 400, y: 80 },
  { id: 'gate-left', type: 'gate-left', x: 350, y: 380 },
  { id: 'gate-right', type: 'gate-right', x: 450, y: 380 },
  { id: 'start-pin', type: 'start-pin', x: 200, y: 420 },
  { id: 'rc-boat', type: 'rc-boat', x: 600, y: 420 },
];

// Match racing marks (shorter course)
const MATCH_MARKS: MarkPosition[] = [
  { id: 'windward', type: 'windward', x: 400, y: 100 },
  { id: 'leeward', type: 'leeward', x: 400, y: 380 },
  { id: 'start-pin', type: 'start-pin', x: 250, y: 420 },
  { id: 'rc-boat', type: 'rc-boat', x: 550, y: 420 },
];

// Team racing marks
const TEAM_MARKS: MarkPosition[] = [
  { id: 'windward', type: 'windward', x: 400, y: 80 },
  { id: 'gate-left', type: 'gate-left', x: 320, y: 380 },
  { id: 'gate-right', type: 'gate-right', x: 480, y: 380 },
  { id: 'start-pin', type: 'start-pin', x: 200, y: 420 },
  { id: 'rc-boat', type: 'rc-boat', x: 600, y: 420 },
];

// Distance racing waypoints
const DISTANCE_MARKS: MarkPosition[] = [
  { id: 'start', type: 'rc-boat', x: 100, y: 400, label: 'Start' },
  { id: 'waypoint1', type: 'island', x: 250, y: 300, label: 'Headland' },
  { id: 'waypoint2', type: 'waypoint', x: 500, y: 150, label: 'Offshore Mark' },
  { id: 'waypoint3', type: 'island', x: 700, y: 250, label: 'Island' },
  { id: 'finish', type: 'rc-boat', x: 650, y: 420, label: 'Finish' },
];

// Overview marks - show mini course elements for each quadrant
const OVERVIEW_MARKS: MarkPosition[] = [
  // Fleet quadrant (top-left) - mini windward mark
  { id: 'fleet-mark', type: 'windward', x: 150, y: 60, label: 'Fleet Racing' },
  // Match quadrant (top-right) - nothing needed, "VS" shown differently
  // Team quadrant (bottom-left) - nothing needed
  // Distance quadrant (bottom-right) - mini waypoints
  { id: 'dist-island', type: 'island', x: 650, y: 320, label: 'Distance' },
  { id: 'dist-waypoint', type: 'waypoint', x: 550, y: 400 },
];

export const TYPES_OF_RACES_STEPS: RaceTypeStep[] = [
  // ==================== STEP 1: INTRODUCTION ====================
  {
    time: 0,
    label: 'Four Ways to Race',
    description:
      'Sailboat racing comes in four main formats: Fleet Racing, Match Racing, Team Racing, and Distance Racing. Each offers unique challenges and excitement!',
    details: [
      'Fleet Racing: Many boats, first to finish wins',
      'Match Racing: One-on-one duels between two boats',
      'Team Racing: Teams of boats working together',
      'Distance Racing: Long races across open water',
    ],
    proTip:
      'Most sailors start with fleet racing at their local club, then may explore other formats as they develop their skills and interests.',
    raceType: 'overview',
    marks: OVERVIEW_MARKS,
    boats: [
      // ===== FLEET RACING (Top-left quadrant: x 50-350, y 50-220) =====
      // Many boats racing toward a mark - shows the "many boats" concept
      { id: 'fleet1', color: FLEET_COLORS[0], x: 100, y: 180, rotation: -45 },
      { id: 'fleet2', color: FLEET_COLORS[1], x: 130, y: 190, rotation: -50 },
      { id: 'fleet3', color: FLEET_COLORS[2], x: 160, y: 175, rotation: -40 },
      { id: 'fleet4', color: FLEET_COLORS[3], x: 190, y: 185, rotation: -45 },
      { id: 'fleet5', color: FLEET_COLORS[4], x: 220, y: 170, rotation: -35 },
      { id: 'fleet6', color: FLEET_COLORS[5], x: 250, y: 180, rotation: -55 },

      // ===== MATCH RACING (Top-right quadrant: x 450-750, y 50-220) =====
      // Two boats head-to-head, close together - shows "duel" concept
      { id: 'match1', color: MATCH_COLORS.boat1, x: 550, y: 140, rotation: -45 },
      { id: 'match2', color: MATCH_COLORS.boat2, x: 620, y: 150, rotation: -45 },

      // ===== TEAM RACING (Bottom-left quadrant: x 50-350, y 280-450) =====
      // Two color-coded teams clearly separated - shows "teams" concept
      // Blue team (positions 1, 3, 5)
      { id: 'teamA1', color: TEAM_COLORS.teamA, x: 100, y: 340, rotation: -45, teamId: 'A' },
      { id: 'teamA2', color: TEAM_COLORS.teamA, x: 160, y: 370, rotation: -45, teamId: 'A' },
      { id: 'teamA3', color: TEAM_COLORS.teamA, x: 220, y: 400, rotation: -45, teamId: 'A' },
      // Red team (positions 2, 4, 6)
      { id: 'teamB1', color: TEAM_COLORS.teamB, x: 130, y: 355, rotation: -45, teamId: 'B' },
      { id: 'teamB2', color: TEAM_COLORS.teamB, x: 190, y: 385, rotation: -45, teamId: 'B' },
      { id: 'teamB3', color: TEAM_COLORS.teamB, x: 250, y: 415, rotation: -45, teamId: 'B' },

      // ===== DISTANCE RACING (Bottom-right quadrant: x 450-750, y 280-450) =====
      // Boats spread out over long distance - shows "distance" concept
      { id: 'offshore1', color: OFFSHORE_COLORS[0], x: 480, y: 420, rotation: -20 },
      { id: 'offshore2', color: OFFSHORE_COLORS[1], x: 560, y: 380, rotation: -15 },
      { id: 'offshore3', color: OFFSHORE_COLORS[2], x: 620, y: 350, rotation: -25 },
    ],
  },

  // ==================== STEP 2: FLEET RACING ====================
  {
    time: 10,
    label: 'Fleet Racing',
    description:
      'Fleet racing is the most common format. All boats start together and race the same course. The first boat to finish wins!',
    details: [
      'Fleets can range from 5 boats to over 100',
      'All boats start at the same time',
      'Everyone races the same course',
      'Your position at the finish determines your score',
    ],
    proTip:
      'Fleet racing is where most sailors learn to race. It teaches you to handle traffic, read wind shifts, and think tactically.',
    raceType: 'fleet',
    marks: STANDARD_MARKS,
    boats: [
      // Large fleet at the start
      { id: 'boat1', color: FLEET_COLORS[0], x: 250, y: 420, rotation: -45 },
      { id: 'boat2', color: FLEET_COLORS[1], x: 300, y: 418, rotation: -45 },
      { id: 'boat3', color: FLEET_COLORS[2], x: 350, y: 415, rotation: -45 },
      { id: 'boat4', color: FLEET_COLORS[3], x: 400, y: 420, rotation: -45 },
      { id: 'boat5', color: FLEET_COLORS[4], x: 450, y: 418, rotation: -45 },
      { id: 'boat6', color: FLEET_COLORS[5], x: 500, y: 422, rotation: -45 },
      { id: 'boat7', color: FLEET_COLORS[6], x: 550, y: 420, rotation: -45 },
      { id: 'boat8', color: FLEET_COLORS[7], x: 325, y: 425, rotation: -45 },
    ],
    highlights: ['start-line'],
  },

  // ==================== STEP 3: FLEET RACING - SCORING ====================
  {
    time: 20,
    label: 'Fleet Racing Scoring',
    description:
      'In fleet racing, your finishing position equals your points. First place = 1 point, second = 2 points, and so on. Lowest score wins the series!',
    details: [
      '1st place = 1 point, 2nd = 2 points, 3rd = 3 points...',
      'A regatta has multiple races (series)',
      'Add up your points from all races',
      'Lowest total score wins the series',
    ],
    proTip:
      'Consistency matters! A sailor with 2-2-2 (6 points) beats one with 1-1-10 (12 points). Avoiding bad races is key.',
    raceType: 'fleet',
    marks: [
      { id: 'finish-pin', type: 'start-pin', x: 200, y: 380 },
      { id: 'finish-rc', type: 'rc-boat', x: 600, y: 380 },
    ],
    boats: [
      // Boats finishing in order with position labels
      { id: 'boat1', color: FLEET_COLORS[0], x: 320, y: 375, rotation: 90, label: '1st' },
      { id: 'boat2', color: FLEET_COLORS[1], x: 350, y: 380, rotation: 88, label: '2nd' },
      { id: 'boat3', color: FLEET_COLORS[2], x: 380, y: 385, rotation: 92, label: '3rd' },
      { id: 'boat4', color: FLEET_COLORS[3], x: 410, y: 390, rotation: 85, label: '4th' },
      { id: 'boat5', color: FLEET_COLORS[4], x: 440, y: 395, rotation: 90, label: '5th' },
      { id: 'boat6', color: FLEET_COLORS[5], x: 470, y: 400, rotation: 88, label: '6th' },
      { id: 'boat7', color: FLEET_COLORS[6], x: 500, y: 405, rotation: 92, label: '7th' },
      { id: 'boat8', color: FLEET_COLORS[7], x: 530, y: 410, rotation: 86, label: '8th' },
    ],
    highlights: ['finish-line'],
  },

  // ==================== STEP 4: MATCH RACING ====================
  {
    time: 30,
    label: 'Match Racing',
    description:
      'Match racing is a one-on-one duel between two boats. Used in the America\'s Cup, it\'s the most intense form of racing - beat your opponent, win the match!',
    details: [
      'Only two boats compete at a time',
      'Beat your opponent to win the match',
      'Pre-start maneuvering is crucial',
      'Used in America\'s Cup and SailGP',
    ],
    proTip:
      'In match racing, your only goal is to beat the other boat. You don\'t need to be fast - just faster than your opponent!',
    raceType: 'match',
    marks: MATCH_MARKS,
    boats: [
      { id: 'blue', color: MATCH_COLORS.boat1, x: 350, y: 300, rotation: -45 },
      { id: 'red', color: MATCH_COLORS.boat2, x: 450, y: 280, rotation: -45 },
    ],
    highlights: ['match-racing'],
  },

  // ==================== STEP 5: MATCH RACING - PRE-START ====================
  {
    time: 40,
    label: 'Match Racing Pre-Start',
    description:
      'The pre-start in match racing is a tactical battle. Boats circle, maneuver, and try to gain control before the start signal. It\'s like a chess match on the water!',
    details: [
      'Boats enter from opposite ends of the start area',
      'Circling and "dial-up" maneuvers are common',
      'Goal: Control your opponent, gain the advantage',
      'Penalties can be given for rule violations',
    ],
    proTip:
      'The boat that controls the pre-start usually wins. Top match racers spend hours practicing these maneuvers.',
    raceType: 'match',
    marks: MATCH_MARKS,
    boats: [
      // Boats circling each other in pre-start
      { id: 'blue', color: MATCH_COLORS.boat1, x: 380, y: 380, rotation: 135 },
      { id: 'red', color: MATCH_COLORS.boat2, x: 420, y: 400, rotation: -45 },
    ],
    highlights: ['pre-start-circle'],
  },

  // ==================== STEP 6: TEAM RACING ====================
  {
    time: 50,
    label: 'Team Racing',
    description:
      'Team racing pits two teams against each other, usually 3 boats per team. The twist: your team\'s combined score determines the winner!',
    details: [
      'Two teams of 3 (or 4) boats each',
      'Team scores are added together',
      'Lowest combined score wins',
      '1-2-3 (6 points) beats 4-5-6 (15 points)',
    ],
    proTip:
      'The magic number in 3v3 team racing is 10. If your team\'s combined positions equal 10 or less, you win!',
    raceType: 'team',
    marks: TEAM_MARKS,
    teams: [
      { id: 'A', name: 'Blue Team', color: TEAM_COLORS.teamA },
      { id: 'B', name: 'Red Team', color: TEAM_COLORS.teamB },
    ],
    boats: [
      // Blue team
      { id: 'blue1', color: TEAM_COLORS.teamA, x: 280, y: 300, rotation: -45, teamId: 'A', label: '1' },
      { id: 'blue2', color: TEAM_COLORS.teamA, x: 350, y: 320, rotation: -45, teamId: 'A', label: '3' },
      { id: 'blue3', color: TEAM_COLORS.teamA, x: 420, y: 350, rotation: -45, teamId: 'A', label: '5' },
      // Red team
      { id: 'red1', color: TEAM_COLORS.teamB, x: 320, y: 310, rotation: -45, teamId: 'B', label: '2' },
      { id: 'red2', color: TEAM_COLORS.teamB, x: 380, y: 330, rotation: -45, teamId: 'B', label: '4' },
      { id: 'red3', color: TEAM_COLORS.teamB, x: 450, y: 360, rotation: -45, teamId: 'B', label: '6' },
    ],
    highlights: ['team-positions'],
  },

  // ==================== STEP 7: TEAM RACING - COMBINATIONS ====================
  {
    time: 60,
    label: 'Team Racing Tactics',
    description:
      'In team racing, boats work together! A fast teammate might slow down to help a slower one pass an opponent. It\'s all about the team score.',
    details: [
      '"Pass-backs": Fast boats slow opponents to help teammates',
      '"Mark traps": Block opponents at marks',
      'Communication between teammates is crucial',
      'Individual glory doesn\'t matter - only team victory',
    ],
    proTip:
      'A common combination: Your 1st place boat slows to block the opponent\'s 2nd, letting your 3rd place boat pass into 2nd. 1-2-4 beats 3-5-6!',
    raceType: 'team',
    marks: TEAM_MARKS,
    teams: [
      { id: 'A', name: 'Blue Team', color: TEAM_COLORS.teamA },
      { id: 'B', name: 'Red Team', color: TEAM_COLORS.teamB },
    ],
    boats: [
      // Showing a "pass-back" combination
      // Blue boat 1 slowing down red boat 2
      { id: 'blue1', color: TEAM_COLORS.teamA, x: 360, y: 280, rotation: -45, teamId: 'A', label: '1' },
      { id: 'red1', color: TEAM_COLORS.teamB, x: 340, y: 300, rotation: -45, teamId: 'B', label: '2' },
      // Blue boat 2 passing through
      { id: 'blue2', color: TEAM_COLORS.teamA, x: 320, y: 320, rotation: -45, teamId: 'A', label: '→3' },
      // Rest of the fleet
      { id: 'red2', color: TEAM_COLORS.teamB, x: 400, y: 340, rotation: -45, teamId: 'B', label: '4' },
      { id: 'blue3', color: TEAM_COLORS.teamA, x: 380, y: 360, rotation: -45, teamId: 'A', label: '5' },
      { id: 'red3', color: TEAM_COLORS.teamB, x: 440, y: 380, rotation: -45, teamId: 'B', label: '6' },
    ],
    highlights: ['pass-back'],
  },

  // ==================== STEP 8: DISTANCE RACING ====================
  {
    time: 70,
    label: 'Distance Racing',
    description:
      'Distance racing takes sailors across open water - from coastal races lasting hours to ocean crossings taking weeks. It\'s the ultimate test of seamanship and endurance!',
    details: [
      'Races range from hours to months in length',
      'Navigate between waypoints, islands, or continents',
      'Weather routing is a critical skill',
      'Famous races: Sydney-Hobart, Fastnet, Vendée Globe',
    ],
    proTip:
      'Distance racing requires different skills than buoy racing: navigation, weather prediction, boat maintenance, and often crew management over long periods.',
    raceType: 'distance',
    marks: DISTANCE_MARKS,
    boats: [
      // Fleet spread out on ocean course
      { id: 'boat1', color: OFFSHORE_COLORS[0], x: 200, y: 350, rotation: -30, isOffshore: true },
      { id: 'boat2', color: OFFSHORE_COLORS[1], x: 320, y: 280, rotation: -20, isOffshore: true },
      { id: 'boat3', color: OFFSHORE_COLORS[2], x: 450, y: 200, rotation: 10, isOffshore: true },
      { id: 'boat4', color: OFFSHORE_COLORS[3], x: 550, y: 180, rotation: 45, isOffshore: true },
      { id: 'boat5', color: OFFSHORE_COLORS[4], x: 620, y: 280, rotation: 90, isOffshore: true },
    ],
    highlights: ['distance-course'],
  },

  // ==================== STEP 9: DISTANCE RACING - TYPES ====================
  {
    time: 80,
    label: 'Types of Distance Races',
    description:
      'Distance racing ranges from day races around local landmarks to solo circumnavigations of the globe. The variety is incredible!',
    details: [
      'Coastal races: Hours to a day around headlands and islands',
      'Offshore classics: Sydney-Hobart (628nm), Fastnet (695nm)',
      'Ocean races: Transatlantic, Transpacific crossings',
      'Round-the-world: Vendée Globe (solo), Ocean Race (crewed)',
    ],
    proTip:
      'The Vendée Globe is the "Everest of sailing" - sailors race solo, non-stop around the world for about 80 days. No outside assistance allowed!',
    raceType: 'distance',
    marks: [
      { id: 'start', type: 'rc-boat', x: 50, y: 250, label: 'Start' },
      { id: 'atlantic', type: 'waypoint', x: 200, y: 200, label: 'Atlantic' },
      { id: 'southern', type: 'waypoint', x: 400, y: 400, label: 'Southern Ocean' },
      { id: 'pacific', type: 'waypoint', x: 600, y: 200, label: 'Pacific' },
      { id: 'finish', type: 'rc-boat', x: 750, y: 250, label: 'Finish' },
    ],
    boats: [
      // Single boat on world route (representing solo racing)
      { id: 'solo', color: OFFSHORE_COLORS[0], x: 400, y: 380, rotation: 90, isOffshore: true, label: 'Solo' },
      // Crewed boats on ocean race
      { id: 'crew1', color: OFFSHORE_COLORS[1], x: 250, y: 180, rotation: 20, isOffshore: true },
      { id: 'crew2', color: OFFSHORE_COLORS[2], x: 550, y: 220, rotation: -30, isOffshore: true },
    ],
    highlights: ['world-route'],
  },

  // ==================== STEP 10: OTHER FORMATS ====================
  {
    time: 90,
    label: 'Handicap & Pursuit Racing',
    description:
      'Handicap systems let different boats race together fairly by adjusting finish times. Pursuit races start slower boats first - first across the line wins!',
    details: [
      'PHRF, IRC, ORC: Common handicap rating systems',
      'Your boat gets a rating based on its speed potential',
      'Corrected time determines the winner',
      'Pursuit racing: Staggered starts based on rating',
    ],
    proTip:
      'Handicap racing is great for mixed fleets - a well-sailed slower boat can beat a poorly-sailed fast one on corrected time!',
    raceType: 'overview',
    marks: STANDARD_MARKS,
    boats: [
      // Mixed fleet with different boat sizes representing handicap systems
      // Fast boats (PHRF - Performance Handicap Racing Fleet) - smaller dinghies
      { id: 'phrf1', color: '#1E40AF', x: 380, y: 280, rotation: -45, label: 'PHRF' },
      { id: 'phrf2', color: '#1E40AF', x: 420, y: 300, rotation: -40 },
      // Medium boats (IRC - International Rating Certificate) - mid-size keelboats
      { id: 'irc1', color: '#059669', x: 320, y: 340, rotation: -45, isOffshore: true, label: 'IRC' },
      { id: 'irc2', color: '#059669', x: 360, y: 360, rotation: -50, isOffshore: true },
      // Large boats (ORC - Offshore Racing Congress) - large offshore racers
      { id: 'orc1', color: '#DC2626', x: 280, y: 400, rotation: -45, isOffshore: true, label: 'ORC' },
      { id: 'orc2', color: '#DC2626', x: 450, y: 380, rotation: -42, isOffshore: true },
    ],
    highlights: ['mixed-fleet'],
  },

  // ==================== STEP 11: CHOOSING YOUR FORMAT ====================
  {
    time: 100,
    label: 'Which Format is for You?',
    description:
      'Each racing format offers something different. Start with fleet racing to learn the basics, then explore match, team, or distance racing as you develop!',
    details: [
      'Fleet Racing: Best for learning, most opportunities',
      'Match Racing: Intense one-on-one tactical duels',
      'Team Racing: Collaborative strategy with teammates',
      'Distance Racing: Adventure, navigation, endurance',
    ],
    proTip:
      'Start with fleet racing at your local club. As you grow, you might discover a passion for the America\'s Cup-style intensity of match racing, the teamwork of team racing, or the adventure of offshore sailing!',
    raceType: 'overview',
    marks: STANDARD_MARKS,
    boats: [
      // Happy fleet sailing upwind - positioned above the gate marks
      { id: 'boat1', color: FLEET_COLORS[0], x: 350, y: 250, rotation: -45 },
      { id: 'boat2', color: FLEET_COLORS[1], x: 390, y: 270, rotation: -40 },
      { id: 'boat3', color: FLEET_COLORS[2], x: 430, y: 260, rotation: -50 },
      { id: 'boat4', color: FLEET_COLORS[3], x: 470, y: 280, rotation: -45 },
      { id: 'boat5', color: FLEET_COLORS[4], x: 310, y: 280, rotation: -35 },
      { id: 'boat6', color: FLEET_COLORS[5], x: 510, y: 270, rotation: -55 },
    ],
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

export const TYPES_OF_RACES_QUIZ: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'In fleet racing, how are points scored?',
    options: [
      { id: 'a', text: 'Highest speed wins', isCorrect: false },
      { id: 'b', text: 'First place = 1 point, second = 2 points, etc. (lowest wins)', isCorrect: true },
      { id: 'c', text: 'All boats get equal points', isCorrect: false },
      { id: 'd', text: 'Only the winner gets points', isCorrect: false },
    ],
    explanation:
      'Fleet racing uses "low point" scoring. Your finishing position equals your points (1st = 1 point, 2nd = 2 points, etc.), and the lowest total score across all races wins the series.',
    hint: 'Think about golf scoring - lower is better!',
  },
  {
    id: 'q2',
    question: 'How many boats compete in a match race?',
    options: [
      { id: 'a', text: 'As many as want to enter', isCorrect: false },
      { id: 'b', text: 'Exactly three', isCorrect: false },
      { id: 'c', text: 'Exactly two', isCorrect: true },
      { id: 'd', text: 'Teams of four', isCorrect: false },
    ],
    explanation:
      'Match racing is a one-on-one duel between exactly two boats. The format is used in prestigious events like the America\'s Cup.',
    hint: 'The word "match" suggests a direct competition between opponents...',
  },
  {
    id: 'q3',
    question: 'In team racing, why might a leading boat slow down?',
    options: [
      { id: 'a', text: 'They are tired', isCorrect: false },
      { id: 'b', text: 'To help a teammate pass an opponent', isCorrect: true },
      { id: 'c', text: 'It\'s required by the rules', isCorrect: false },
      { id: 'd', text: 'To save energy for the next race', isCorrect: false },
    ],
    explanation:
      'In team racing, the combined team score matters. A fast boat might slow down to block an opponent, allowing a teammate to pass. This "pass-back" tactic can change the team result from losing to winning!',
    hint: 'Remember - in team racing, individual position doesn\'t matter, only the team total.',
  },
  {
    id: 'q4',
    question: 'What is the Vendée Globe?',
    options: [
      { id: 'a', text: 'A fleet racing championship', isCorrect: false },
      { id: 'b', text: 'A solo, non-stop, round-the-world race', isCorrect: true },
      { id: 'c', text: 'A match racing event in France', isCorrect: false },
      { id: 'd', text: 'A team racing college championship', isCorrect: false },
    ],
    explanation:
      'The Vendée Globe is considered the "Everest of sailing" - a solo, non-stop race around the world without assistance. Sailors spend about 80 days alone at sea, covering over 24,000 nautical miles.',
    hint: 'This race is known as the ultimate test of solo sailing endurance...',
  },
  {
    id: 'q5',
    question: 'What famous sailing event uses match racing?',
    options: [
      { id: 'a', text: 'The Olympics', isCorrect: false },
      { id: 'b', text: 'The Volvo Ocean Race', isCorrect: false },
      { id: 'c', text: 'The America\'s Cup', isCorrect: true },
      { id: 'd', text: 'The Fastnet Race', isCorrect: false },
    ],
    explanation:
      'The America\'s Cup, the oldest trophy in international sport (dating to 1851), uses match racing format. Two teams face off in a series of one-on-one races.',
    hint: 'This is one of the most prestigious sailing events, often called "the oldest trophy in international sport."',
  },
  {
    id: 'q6',
    question: 'Which racing format is best for someone new to racing?',
    options: [
      { id: 'a', text: 'Match racing - it\'s simpler with fewer boats', isCorrect: false },
      { id: 'b', text: 'Distance racing - more time to learn', isCorrect: false },
      { id: 'c', text: 'Fleet racing - most accessible and common', isCorrect: true },
      { id: 'd', text: 'Team racing - teammates can help you', isCorrect: false },
    ],
    explanation:
      'Fleet racing is the best starting point because it\'s the most common format, available at almost every sailing club, and teaches fundamental racing skills that apply to all formats.',
    hint: 'Which format offers the most opportunities to race and learn?',
  },
];

// Deep dive content
export const DEEP_DIVE_CONTENT = {
  title: 'Deep Dive: Racing Formats',
  sections: [
    {
      title: 'Fleet Racing Classes',
      content:
        'Fleet racing happens in many boat classes - from small dinghies like Optimists and Lasers to large keelboats like J/70s and Melges 24s. One-design classes (identical boats) ensure the best sailor wins, not the best boat.',
    },
    {
      title: 'Match Racing History',
      content:
        'Match racing dates back to the 1851 America\'s Cup. Modern match racing uses umpires on the water who make instant calls on rule violations. Penalties are served by doing turns during the race.',
    },
    {
      title: 'Team Racing Origins',
      content:
        'Team racing became popular at American colleges and is now raced worldwide. The format rewards tactical thinking, teamwork, and quick decision-making. Many top sailors developed their skills through college team racing.',
    },
    {
      title: 'Distance Racing Classics',
      content:
        'The Sydney-Hobart (628nm) and Fastnet Race (695nm) are legendary offshore classics, testing crews against unpredictable conditions. The Vendée Globe and Ocean Race represent the pinnacle of ocean racing - circumnavigating the globe.',
    },
    {
      title: 'Handicap Systems',
      content:
        'Handicap systems like PHRF, IRC, and ORC allow different boats to race together fairly. Each boat gets a "rating" that adjusts their finish time. This means a slower boat can beat a faster one on corrected time!',
    },
  ],
  proTips: [
    'Join your local sailing club - most have regular fleet racing programs',
    'Try a match racing clinic to experience intense one-on-one competition',
    'If you\'re in college, the sailing team is a great way to try team racing',
    'Crew on an offshore race to experience distance racing before committing to your own boat',
    'Watch America\'s Cup coverage to see world-class match racing in action',
    'Start with one-design fleet racing to focus on skills, not equipment',
  ],
};
