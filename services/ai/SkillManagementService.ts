/**
 * Claude Skills Management Service
 * Handles uploading, listing, and managing custom Claude Skills for the application
 *
 * Features:
 * - Upload custom skills to Anthropic
 * - List and retrieve skill metadata
 * - Cache skill IDs for performance
 * - Automatic skill initialization on app startup
 * - Race phase detection and skill selection
 * - Context-aware skill invocation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { BOAT_TUNING_SKILL_CONTENT } from '@/skills/tuning-guides/boatTuningSkill';
import { RACE_LEARNING_SKILL_CONTENT } from '@/skills/race-learning-analyst/skillContent';
import { LEARNING_EVENT_EXTRACTOR_SKILL_CONTENT } from '@/skills/learning-event-extractor/skillContent';
import { TEAM_RACING_SKILL_CONTENT } from '@/skills/team-racing-analyst/skillContent';
import { createLogger } from '@/lib/utils/logger';

// Race Phase Types
export type RacePhase =
  | 'pre-race'
  | 'start-sequence'
  | 'first-beat'
  | 'weather-mark'
  | 'reaching'
  | 'running'
  | 'leeward-mark'
  | 'final-beat'
  | 'finish';

interface SkillDefinition {
  description: string;
  content: string;
  aliases?: string[];
}

const BUILT_IN_SKILL_DEFINITIONS: Record<string, SkillDefinition> = {
  'race-strategy-analyst': {
    description: 'Expert sailing race strategist combining BetterAt Playbook and BetterAt Coach frameworks with championship execution techniques',
    aliases: ['race-strategy', 'sailing-strategy', 'regatta-strategy', 'tactical-racing'],
    content: `# Race Strategy Analyst

Elite sailing race strategist trained on championship playbooks from BetterAt Playbook, BetterAt Coach, Hans Fogh, and Olympic-level coaches. Your role is to transform course data, venue intelligence, and live conditions into a decisive plan that blends theory (why) with execution (how).

## Core Expertise
- Oscillating vs persistent shift logic, header/lift math, and line bias detection  
- Time-on-distance acceleration drills, start box geometry, and line holding under traffic  
- Layline discipline with current correction, minimizing maneuver cost, and VMG preservation  
- Downwind apparent-wind sailing, pressure lane management, and mark approach shaping  
- Fleet management: tight/loose cover, leverage control, comeback routing, and risk envelopes  
- Series strategy: top-third scoring, discard math, weather windows, and opponent psychology  

## Inputs You May Receive
- Parsed race documents (course type, marks, distances, restrictions)  
- Venue intelligence (typical wind, current patterns, topography, hazards)  
- Environmental data (wind forecast, tidal intel, bathymetry, slack windows)  
- Sailor profile (strengths, weaknesses, comfort level)  
- Competition tier (club → international)  

## Strategic Operating Principles
1. **Boat Speed First** – never sacrifice baseline speed unless the fleet position demands it.  
2. **Clean Air is Currency** – worth 5–10 boat lengths; plan to own lanes at key moments.  
3. **Immediate Header Response** – tack on ≥5° headers unless leverage dictates otherwise.  
4. **Maneuver Discipline** – each extra tack/gybe costs 2–3 boat lengths in medium breeze.  
5. **Laylines are Defensive** – approach from the inside, keep both options open.  
6. **Current > Wind in Heavy Tide** – tide gates, eddies, and slack windows trump small shifts.  
7. **Consistency Wins Series** – bias toward top-third finishes unless situation demands a punch.  

## Output Contract
Return JSON with the following structure:

\`\`\`json
{
  "analysis": "Narrative covering strategy, tactics, and risk posture.",
  "recommendations": {
    "startStrategy": "Detailed start plan (favored end, timing, lane protection).",
    "upwindStrategy": "Which side to play and why, shift rules, current integration.",
    "downwindStrategy": "VMG plan, pressure lines, mode changes, traffic notes.",
    "markRoundings": "Approach angles, exit priorities, congestion avoidance.",
    "timing": "Is the race window optimal? If not, suggest better timing."
  },
  "contingencies": [
    {
      "trigger": "What condition changes?",
      "response": "How to adapt?",
      "confidence": 0.0 - 1.0
    }
  ],
  "confidence": "high | moderate | low",
  "caveats": ["List of unknowns or data quality issues"]
}
\`\`\`

- Always cite theory (framework or empirical reference).  
- Pair every recommendation with execution detail (time, angle, positioning).  
- Flag risk levels and note what you need to monitor on the water.`
  },
  'race-learning-analyst': {
    description: 'Detects recurring post-race patterns and personalizes coaching feedback for each sailor',
    aliases: ['learning-analyst', 'post-race-learning', 'ai-learning-coach'],
    content: RACE_LEARNING_SKILL_CONTENT
  },
  'learning-event-extractor': {
    description: 'Extracts structured learnable events from unstructured sailor feedback for adaptive learning nudges',
    aliases: ['event-extractor', 'learning-extractor', 'adaptive-learning'],
    content: LEARNING_EVENT_EXTRACTOR_SKILL_CONTENT
  },
  'tidal-opportunism-analyst': {
    description: 'Identifies current-driven opportunities, eddies, and anchoring decisions using bathymetry and WorldTides intel',
    aliases: ['bathymetric-tidal-analyst', 'tidal-opportunism', 'current-opportunism-analyst'],
    content: `# Tidal Opportunism Analyst

You are the tactician that extracts every advantage from moving water. Blend bathymetry, tidal intelligence, and on-course geometry to recommend opportunistic plays rooted in proven big-fleet racing practice.

## Expected Inputs
- \`bathymetry\`: depth grid, contours, substrate data, notable features.  
- \`tidalIntel\`: current speed/direction, trend (rising/falling/slack), range, coefficient, slack windows from WorldTides Pro.  
- \`strategicFeatures\`: zones flagged by our bathymetric analysis (acceleration, eddy, adverse, shear).  
- \`raceMeta\`: course marks, legs, start time, duration, fleet size, and restrictions.  
- \`weather\`: wind direction/speed profile so you can evaluate wind-vs-current interplay.  

If a field is missing or simulated, call it out explicitly in your caveats.

## Doctrine & Heuristics
1. **Tide Height ≠ Current Set** – current reversals can lag tide turns by 60–120 minutes.  
2. **Slack is Local** – compare stations and consider shoreline geography; publish offsets.  
3. **Use Eddies & Relief** – bight-side back eddies, point acceleration, channel shear boundaries.  
4. **Depth Controls Speed** – shallows slow flow; narrows or shoals accelerate it.  
5. **Anchor When VMG Collapses** – be ready to anchor immediately when sternway starts.  
6. **Wind Interaction Matters** – opposing wind/current builds sea state and reduces VMG; aligned flow flattens it.  
7. **Plan Gates** – identify when crossing “the Race” or tidal necks is high/low percentage.  

## Analysis Checklist
1. Map current vectors at start, mid-race, end; note direction changes and rate of build/decay.  
2. Cross-reference acceleration/eddy zones with leg geometry and mark approaches.  
3. Examine slack windows ±30 minutes; recommend tasks suited for neutral current (crosses, anchoring, kites).  
4. Evaluate shoreline relief lanes for upwind vs downwind advantage.  
5. Propose anchoring protocol (depth, scope, trigger) if foul tide risk exceeds VMG threshold.  

## Output Contract
Return JSON:

\`\`\`json
{
  "analysis": "Narrative explaining current behavior, spatial variability, and key timing notes.",
  "opportunisticMoves": [
    {
      "window": {
        "start": "ISO timestamp",
        "end": "ISO timestamp",
        "slackPhase": "high | low | none"
      },
      "location": "Description or coordinates",
      "maneuver": "cross_the_race | hug_shore | play_eddy | anchor | delay_start | other",
      "whyItWorks": "Physics-based explanation referencing bathymetry/current intel.",
      "expectedGain": "Boat lengths, minutes, or qualitative advantage",
      "risk": "low | medium | high",
      "monitor": ["What to watch to confirm/abort"]
    }
  ],
  "anchoringPlan": {
    "shouldPrepare": true,
    "recommendedDepth": "meters",
    "scope": "7:1",
    "triggers": ["lost steerage way", "current > target boat speed"],
    "relaunchSteps": ["Procedure after slack/turn"]
  },
  "reliefLanes": [
    {
      "leg": "Leg identifier",
      "side": "left | right | middle",
      "reason": "eddy | depth-relief | channel-acceleration",
      "proof": "Reference to intel (station offset, bathymetry)"
    }
  ],
  "caveats": ["Data gaps, conflicting sources, weather impacts"],
  "confidence": "high | moderate | low"
}
\`\`\`

Provide specific coordinates or mark references when recommending moves. If data sources disagree, surface both options with pros/cons.`
  },
  'boat-tuning-analyst': {
    description: 'Transforms BetterAt tuning guides into class-specific rig and sail settings matched to live race conditions',
    aliases: ['rig-tuning-analyst', 'boat-tuning', 'tuning-analyst'],
    content: BOAT_TUNING_SKILL_CONTENT
  },
  'slack-window-planner': {
    description: 'Builds maneuver timelines around upcoming slack, high, and low water windows',
    aliases: ['slack-window-strategist', 'slack-planning-analyst'],
    content: `# Slack Window Planner

Specialist at sequencing race tasks around slack, high, and low water transitions. Use tide intel, race schedule, and leg geometry to craft a minute-by-minute plan.

## Inputs
- \`timeline\`: ordered list of upcoming slack/high/low events with timestamps and confidence.  
- \`racePlan\`: start time, leg list (name, distance, heading, expected duration), mark ETAs.  
- \`tidalIntel\`: current speed trend, slack window bounds, flow direction, coefficient.  
- \`operationalTasks\`: maneuvers the crew is considering (e.g., “cross channel”, “gybe set”, “anchor”).  

## Planning Rules
1. **Neutralize Crossings in Slack** – schedule channel crosses or risky tacks within slack ±30 min.  
2. **Back-Off During Peak Flow** – avoid low-probability moves when current > crew’s VMG margin.  
3. **Buffer Setup Time** – include prep/cleanup minutes before and after each maneuver.  
4. **Highlight Conflicts** – flag when planned maneuvers overlap known foul-tide windows.  
5. **Coordinate Fleet Windows** – note if opponents up/down course will see different slack timing.  

## Output Contract
Return JSON:

\`\`\`json
{
  "schedule": [
    {
      "window": "pre-start | start | leg-1 | mark-1 | finish | contingency",
      "targetTime": "ISO timestamp",
      "tidePhase": "flood | ebb | slack | high | low",
      "recommendedActions": ["List maneuvers or setup tasks with responsible roles"],
      "reason": "Explain tidal logic referencing slack window offsets",
      "riskMitigation": ["Checks or backups if timing slips"]
    }
  ],
  "crossingPlan": {
    "shouldDelay": false,
    "bestWindows": [
      {
        "start": "ISO",
        "end": "ISO",
        "confidence": "0-1",
        "notes": "Size of relief / expected current"
      }
    ],
    "avoidWindows": ["ISO timestamps or leg references to avoid"]
  },
  "alerts": [
    {
      "type": "timing_conflict | slack_missed | prep_time_insufficient",
      "message": "Human-readable warning",
      "urgency": "info | warning | critical"
    }
  ],
  "caveats": ["Data assumptions or missing intel"],
  "confidence": "high | moderate | low"
}
\`\`\`

If timing uncertainty is high (>20 min), provide fallback sequences. Always include UTC offsets and local time conversions when possible.`
  },
  'current-counterplay-advisor': {
    description: 'Advises on current-based tactics against opponents (lee bow, cover, split timing)',
    aliases: ['current-counterplay', 'current-tactics-advisor'],
    content: `# Current Counterplay Advisor

You design move-by-move current tactics against specific opponents. Blend race strategy with opportunistic current leverage to disrupt rivals or defend a lead.

## Inputs
- \`fleetState\`: positions, headings, boat polars, leverage to each side of course.  
- \`tidalIntel\`: current vectors, slack windows, strength differentials across course.  
- \`racePlan\`: course legs, remaining distance, mark geometry.  
- \`opponentProfiles\`: strengths/weaknesses, likely tactical tendencies.  

## Tactical Playbook
1. **Lee-Bow Current** – tack under opponent when flood favors your leeward lane; quantify expected lift.  
2. **Force into Foul Tide** – herd a rival into adverse current or delay their access to relief.  
3. **Split Protection** – use tidal gates to control when opponents can cross; cover from shore-based relief.  
4. **Anchoring Asymmetric** – if you must anchor, plan a relaunch that puts opponents in stronger foul current.  
5. **Gate Timing** – arrive at channel pinch points during favorable set while opponents face ebb.  
6. **Sea State Leverage** – opposing wind/current punishes slower boats; choose battles accordingly.  

## Output Contract
Return JSON:

\`\`\`json
{
  "analysis": "Narrative explaining current leverage vs key opponents.",
  "plays": [
    {
      "name": "Lee-bow at mid-beat",
      "situation": "Leg 1 port tack, opponent on starboard 2 BL to windward",
      "execution": [
        "Step-by-step maneuver timeline"
      ],
      "currentEffect": "Explain set/drift advantage with quantitative estimate",
      "expectedOutcome": "e.g., gain 3 boat lengths, force them into foul current",
      "risk": "low | medium | high",
      "abortIf": ["Conditions that invalidate the play"]
    }
  ],
  "defensiveGuidance": [
    {
      "threat": "Opponent squeezing from starboard layline",
      "counter": "Tack into relief lane before they slam-dunk",
      "reason": "Relief is 0.6 kts weaker within 200m of shore"
    }
  ],
  "monitoringChecklist": ["Station comparisons", "Wind shifts", "Sea-state build"],
  "caveats": ["Assumptions about opponent skill or current reliability"],
  "confidence": "high | moderate | low"
}
\`\`\`

Always note if recommendations rely on unverified intel (e.g., simulated eddy). When in doubt, present two contingencies: conservative coverage vs aggressive punch.`
  },
  'finishing-line-tactics': {
    description: 'Master finish line strategy using four-laylines concept, favored end identification, and tactical ducking from BetterAt Coach doctrine',
    aliases: ['finishing-tactics', 'finish-line-strategy', 'finish-tactics'],
    content: `# Finishing Line Tactics

Master the often-overlooked final leg where positions are won or lost. Apply BetterAt Coach's proven principles for identifying the favored end, managing the four-laylines approach, and executing tactical finishes.

## Core Principle: The Downwind End is Favored
Just as the **upwind end** is favored at the start, the **downwind end** is favored at the finish. This principle accounts for more places won or lost than any other finishing tactic.

**Buddy Friedrichs Example (1968 Olympics Gold Medal):**
- On port tack laying starboard end of long finish line
- Met four Dragons on starboard sequentially
- Ducked all four sterns rather than tacking
- **Result**: 5th → 1st in ~200 yards, won gold medal
- **Lesson**: Geometric advantage of favored end overwhelms tactical cost of ducking

## The Four-Laylines Concept

Every upwind finish has **four critical laylines**:
1. Port tack layline to starboard end (committee boat)
2. Starboard tack layline to starboard end
3. Port tack layline to port end (buoy/pin)
4. Starboard tack layline to port end

**Fundamental Rule**: Never sail past the first layline you reach.

- **Starboard tack boat** → Tack on port tack layline to starboard end
- **Port tack boat** → Tack on starboard tack layline to port end
- **Why**: Sailing past first layline = sailing parallel to line (extra distance) vs crossing it (shortest)

## Determining Favored End

### Method 1: Harry Sindle Technique
At weather mark (2 legs before finish):
1. While head-to-wind during tack, observe finish line
2. Note which end is **abaft abeam** (behind beam)
3. That end will be downwind at finish (barring major shifts)
4. Gives you 2 legs to plan approach

### Method 2: Long Tack Analysis
- **Port tack is long tack** → wind backed → starboard end downwind
- **Starboard tack is long tack** → wind veered → port end downwind

### Method 3: Visual Comparison
- Compare distance to pin/buoy vs committee boat
- Closer-appearing end usually favored
- Cross-check: Which layline will you reach first?

### Method 4: Race Committee Bias
- Wind veered (clockwise from course) → port end favored
- Wind backed (counterclockwise) → starboard end favored

## Tactical Decision Framework

### Ducking Multiple Boats for Favored End
\`\`\`
IF favored end advantage > (2 × boats to duck) boat lengths:
  → Duck all sterns, reach favored end
ELSE IF marginal advantage:
  → Tack on first/second boat
ELSE:
  → Continue to unfavored end
\`\`\`

**Quantifiable Trigger**: Favored end saves 8+ boat lengths, must duck 3 boats @ ~1.5 lengths each → net gain 3.5 lengths. **Do it.**

### Head Reaching (Shooting the Line)
**Conditions**: Displacement boat, light-moderate air, flat water

**Execution**:
1. Approach at full close-hauled speed
2. At **1 boat length** from line, shoot dead into wind
3. Boat slows but sails shorter distance
4. **Common Error**: Shooting too early (stall before line)
5. **Fix**: Sail farther than instinct suggests

### Leading and Defending
**Sleuth vs Whirlwind Example**:
- Tack on competitor **just as mast comes abeam**
- They lose luffing rights but too close to duck
- Pins them to leeward, away from favored end
- **Timing**: Mast within 0.5-1 boat length of abeam

## Output Contract
Return JSON:

\`\`\`json
{
  "favoredEnd": {
    "end": "port | starboard | neutral",
    "advantage": "boat lengths or time",
    "confidence": "high | medium | low",
    "methods": ["long_tack | sindle | visual | wind_analysis"]
  },
  "fourLaylines": {
    "portToPort": "bearing degrees",
    "starboardToPort": "bearing degrees",
    "portToStarboard": "bearing degrees",
    "starboardToStarboard": "bearing degrees",
    "firstLaylineReached": "Which you'll hit first"
  },
  "approachStrategy": {
    "currentTack": "port | starboard",
    "recommendedTack": "stay | tack_now | tack_at_layline",
    "reasoning": "Link favored end, competitors, geometry"
  },
  "tacticalDecisions": [
    {
      "scenario": "Duck 2 starboard tackers to reach port end",
      "action": "duck | tack | lee_bow | cover",
      "expectedGain": "positions or boat lengths",
      "risk": "low | medium | high",
      "triggers": ["Conditions making this right"]
    }
  ],
  "competitorManagement": {
    "boatsAhead": "count and positions",
    "keyThreat": "Boat and their advantage",
    "coveringPlan": "If leading: pin them away",
    "breakawayPlan": "If trailing: split for favored"
  },
  "caveats": ["Data gaps, wind shift risks"],
  "confidence": "high | moderate | low"
}
\`\`\`

## Common Mistakes

1. **Sailing Parallel to Line** – Sail past first layline → extra distance → lost positions. **Fix**: Tack on first layline.
2. **Ignoring Favored End** – Finish at nearest, not downwind end → lose 1-5 positions. **Fix**: Check favored end 5 min before finish.
3. **Refusing to Duck** – Tack to avoid ducking at heavily favored end → finish wrong end → lose 3-10 positions. **Fix**: Calculate net gain, duck when justified.
4. **Premature Head Reaching** – Shoot 2-3 lengths out → stall → lose 2-10 lengths. **Fix**: Sail farther than instinct suggests.

## Expected Outcomes
- **Immediate**: 70%+ favored end identification accuracy
- **Short-term**: Net gain 0.5-1 positions per finish
- **Long-term**: Strategic finish planning integrated into weather leg
- **Advanced**: Calculated high-risk moves (ducking multiple boats) when justified

## Source
BetterAt Coach's *The Yachtsman's Guide to Racing Tactics*, Chapter 13. Includes Buddy Friedrichs 1968 Olympics, Harry Sindle technique, and Sleuth vs Whirlwind scenario.`
  },
  'team-racing-analyst': {
    description: 'Expert team racing tactician encoding World Sailing Call Book 2025-2028 scenarios, combination scoring, and RRS Appendix D',
    aliases: ['team-racing', 'team-race-analyst', 'team-racing-strategy'],
    content: TEAM_RACING_SKILL_CONTENT
  }
};

// BetterAt Playbook Tactics Skills Registry
export const SKILL_REGISTRY = {
  // Core strategy skills
  'race-strategy-analyst': 'skill_01KGEyGE97qaPmquNwc48MqT',
  'tidal-opportunism-analyst': 'skill_01859NpM6B8cz7E1NdpbdZzC',
  'slack-window-planner': 'skill_01FCQFcE8NTV1eouW4pjoutE',
  'current-counterplay-advisor': 'skill_01PefwFB6ANCctXtzn4G1kj8',

  // Tactical execution skills (BetterAt Playbook + BetterAt Coach)
  'starting-line-mastery': 'skill_012pEW2MsTCL43kPzqAR21Km',
  'upwind-strategic-positioning': 'skill_01AuNhbjToKmtQtUes4VJRW9',
  'upwind-tactical-combat': 'skill_011j4LTzxf7c1Fn4nwZbLWA7',
  'downwind-speed-and-position': 'skill_01EEj8tqRPPsopupvpiBmzyD',
  'mark-rounding-execution': 'skill_01HeDxSUo8fm1Re7fdqCGhMi',

  // Boat tuning skill
  'boat-tuning-analyst': 'skill_01LwivxRwARQY3ga2LwUJNCj',

  // Post-race learning skill
  'race-learning-analyst': 'skill_01NsZX8FL8JfeNhqQ7qFQLLW',

  // Adaptive learning event extraction skill
  'learning-event-extractor': 'skill_builtin_learning_event_extractor',

  // BetterAt Coach finishing tactics (built-in fallback until API upload succeeds)
  'finishing-line-tactics': 'skill_builtin_finishing_line_tactics',

  // Long distance / offshore racing skill
  'long-distance-racing-analyst': 'skill_01SKz4JZUgvufuxgkSMkVqXe',

  // Team racing skill
  'team-racing-analyst': 'skill_builtin_team_racing_analyst',
} as const;

// Race Type Detection - determines if a race should use distance racing skill
export type RaceType = 'fleet' | 'distance' | 'team';

export function detectRaceType(raceContext: {
  courseLengthNm?: number;
  estimatedDurationHours?: number;
  waypoints?: number;
  raceType?: string;
  raceName?: string;
}): RaceType {
  // Explicit type takes precedence
  if (raceContext.raceType === 'team') return 'team';
  if (raceContext.raceType === 'distance') return 'distance';
  if (raceContext.raceType === 'fleet') return 'fleet';

  // Check race name for team racing keywords (check before distance)
  const name = (raceContext.raceName || '').toLowerCase();
  const teamKeywords = ['team racing', 'team race', '3v3', '4v4', '3 v 3', '4 v 4'];
  if (teamKeywords.some(kw => name.includes(kw))) {
    return 'team';
  }
  // Standalone "team" only if it appears as a distinct word (avoid "steam", "teammate", etc.)
  if (/\bteam\b/.test(name) && !name.includes('teammate')) {
    return 'team';
  }

  // Check race name for distance keywords
  const distanceKeywords = ['offshore', 'passage', 'ocean', 'distance', 'around', 'transpac', 'fastnet', 'sydney hobart', 'rolex', 'middle sea', 'giraglia'];
  if (distanceKeywords.some(kw => name.includes(kw))) {
    return 'distance';
  }

  // Course length > 20nm suggests distance race
  if (raceContext.courseLengthNm && raceContext.courseLengthNm > 20) {
    return 'distance';
  }

  // Duration > 4 hours suggests distance race
  if (raceContext.estimatedDurationHours && raceContext.estimatedDurationHours > 4) {
    return 'distance';
  }

  // Many waypoints (> 3) suggests distance/passage race
  if (raceContext.waypoints && raceContext.waypoints > 3) {
    return 'distance';
  }

  return 'fleet';
}

// Race Type to Primary Skill Mapping
export const RACE_TYPE_TO_SKILL: Record<RaceType, keyof typeof SKILL_REGISTRY> = {
  'fleet': 'race-strategy-analyst',
  'distance': 'long-distance-racing-analyst',
  'team': 'team-racing-analyst',
};

// Race Phase to Skill Mapping
export const PHASE_TO_SKILLS: Record<RacePhase, (keyof typeof SKILL_REGISTRY)[]> = {
  'pre-race': [
    'starting-line-mastery',
    'upwind-strategic-positioning',
    'race-strategy-analyst',
    'tidal-opportunism-analyst'
  ],
  'start-sequence': [
    'starting-line-mastery'
  ],
  'first-beat': [
    'upwind-strategic-positioning',
    'upwind-tactical-combat',
    'tidal-opportunism-analyst'
  ],
  'weather-mark': [
    'mark-rounding-execution'
  ],
  'reaching': [
    'downwind-speed-and-position',
    'current-counterplay-advisor'
  ],
  'running': [
    'downwind-speed-and-position',
    'tidal-opportunism-analyst'
  ],
  'leeward-mark': [
    'mark-rounding-execution'
  ],
  'final-beat': [
    'upwind-tactical-combat',
    'upwind-strategic-positioning',
    'finishing-line-tactics'
  ],
  'finish': [
    'finishing-line-tactics',
    'mark-rounding-execution'
  ]
};

/**
 * Get primary skill for a race phase
 */
export function getPrimarySkillForPhase(phase: RacePhase): keyof typeof SKILL_REGISTRY {
  const skills = PHASE_TO_SKILLS[phase];
  return skills[0]; // Return first (primary) skill
}

/**
 * Get skill ID from skill name
 */
export function getSkillId(skillName: keyof typeof SKILL_REGISTRY): string {
  return SKILL_REGISTRY[skillName];
}

type BuiltInSkillKey = keyof typeof BUILT_IN_SKILL_DEFINITIONS;

function resolveBuiltInSkill(skillName: string): { key: BuiltInSkillKey; definition: SkillDefinition } | null {
  if (skillName in BUILT_IN_SKILL_DEFINITIONS) {
    const key = skillName as BuiltInSkillKey;
    return { key, definition: BUILT_IN_SKILL_DEFINITIONS[key] };
  }

  const lower = skillName.toLowerCase();
  for (const [key, definition] of Object.entries(BUILT_IN_SKILL_DEFINITIONS)) {
    if (definition.aliases?.some(alias => alias.toLowerCase() === lower)) {
      return { key: key as BuiltInSkillKey, definition };
    }
  }

  return null;
}

function getPreconfiguredSkillId(skillKey: BuiltInSkillKey): string | null {
  const candidate = (SKILL_REGISTRY as Record<string, string>)[skillKey];
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith('skill_builtin_')) {
    return candidate;
  }

  // Anthropic-issued skill IDs always begin with skill_0 and include base62 characters
  if (/^skill_0[0-9A-Za-z]+$/.test(candidate)) {
    return candidate;
  }

  return null;
}

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  uploadedAt: Date;
  source: 'anthropic' | 'custom';
}

const logger = createLogger('SkillManagementService');

export class SkillManagementService {
  private skillCache: Map<string, SkillMetadata> = new Map();
  private readonly CACHE_KEY = '@regattaflow:claude_skills_cache';
  private initialized = false;
  private readonly EDGE_FUNCTION_URL: string;
  private remoteSkillProxyEnabled: boolean;
  private remoteSkillDisableReason: string | null = null;
  private remoteSkillNoticeLogged = false;
  private loggedSkipForSkill = new Set<string>();
  private loggedPreconfiguredSkill = new Set<string>();

  constructor() {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      logger.warn('No Supabase URL found');
      this.EDGE_FUNCTION_URL = '';
    } else {
      this.EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/anthropic-skills-proxy`;
    }

    const disableViaEnv =
      (process.env.EXPO_PUBLIC_DISABLE_REMOTE_SKILLS ?? '').toLowerCase() === 'true';

    if (disableViaEnv) {
      this.remoteSkillProxyEnabled = false;
      this.remoteSkillDisableReason = 'Disabled via EXPO_PUBLIC_DISABLE_REMOTE_SKILLS';
    } else if (!this.EDGE_FUNCTION_URL) {
      this.remoteSkillProxyEnabled = false;
      this.remoteSkillDisableReason = 'No Supabase Edge Function URL configured';
    } else {
      this.remoteSkillProxyEnabled = true;
    }

    // Don't load cache on construction - do it lazily
  }

  /**
   * Initialize the service (lazy initialization to avoid web compatibility issues)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Only use AsyncStorage on native platforms
    if (Platform.OS !== 'web') {
      await this.loadCachedSkills();
    }

    this.initialized = true;
  }

  /**
   * Call the Anthropic Skills proxy Edge Function
   */
  private async callSkillsProxy(action: string, params: Record<string, any> = {}): Promise<any | null> {
    if (!this.remoteSkillProxyEnabled) {
      throw new Error(this.remoteSkillDisableReason || 'Skill proxy disabled');
    }

    // Get Supabase credentials for authentication
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Supabase authentication headers
    if (supabaseAnonKey) {
      headers['apikey'] = supabaseAnonKey;
      headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
    }

    try {
      const response = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...params }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        const normalizedMessage = errorMessage.toLowerCase();

        if (
          response.status === 404 ||
          /not\s+found/i.test(errorMessage) ||
          normalizedMessage.includes('function not found')
        ) {
          this.disableRemoteSkills('Skill proxy edge function not deployed on this Supabase project');
          this.logRemoteSkillsDisabled();
          return null;
        } else if (response.status === 401 || response.status === 403) {
          this.disableRemoteSkills('Skill proxy access denied (check Supabase anon key permissions)');
          this.logRemoteSkillsDisabled();
          return null;
        } else if (response.status >= 500) {
          this.disableRemoteSkills(
            `Skill proxy returned server error (HTTP ${response.status}). Check Supabase Edge Function logs.`
          );
          this.logRemoteSkillsDisabled();
          return null;
        }

        throw new Error(`Anthropic API error: ${errorMessage}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('Network request failed')) {
        this.disableRemoteSkills('Skill proxy unreachable (offline or blocked network)', error);
        this.logRemoteSkillsDisabled();
        return null;
      }
      throw error;
    }
  }

  /**
   * Upload a custom skill to Anthropic
   * @param name Skill name (e.g., 'race-strategy-analyst')
   * @param description Brief description of the skill
   * @param content Skill content (markdown/text defining the skill's expertise)
   * @returns Skill ID if successful
   */
  async uploadSkill(
    name: string,
    description: string,
    content: string
  ): Promise<string | null> {
    await this.ensureInitialized();

    if (!this.remoteSkillProxyEnabled) {
      this.logRemoteSkillsDisabled();
      return null;
    }

    try {
      logger.debug(`Uploading skill '${name}'`);

      // First check if the skill already exists
      const existingSkillId = await this.getSkillId(name);
      if (existingSkillId) {
        logger.debug(`Found existing skill '${name}' with ID: ${existingSkillId}`);
        return existingSkillId;
      }

      // Upload via Edge Function proxy
      logger.debug(`Uploading skill '${name}' via Edge Function proxy`);
      const response = await this.callSkillsProxy('create_skill', {
        name,
        description,
        content
      });

      if (!response) {
        this.logRemoteSkillsDisabled();
        return null;
      }

      const skillId = (response as any).id;

      if (skillId) {
        logger.debug(`Skill '${name}' uploaded successfully. ID: ${skillId}`);

        // Cache the skill metadata
        const metadata: SkillMetadata = {
          id: skillId,
          name,
          description,
          version: 'latest',
          uploadedAt: new Date(),
          source: 'custom'
        };

        this.skillCache.set(name, metadata);
        await this.saveCachedSkills();

        return skillId;
      }

      logger.warn(`Skill upload returned no ID for '${name}'`);
      return null;
    } catch (error) {
      logger.error(`Failed to upload skill '${name}':`, error);

      // If skill already exists (multiple error message patterns), try to retrieve it
      const errorMessage = (error as any)?.message?.toLowerCase() || '';
      const isDuplicateError =
        errorMessage.includes('already exists') ||
        errorMessage.includes('cannot reuse an existing display_title') ||
        errorMessage.includes('display_title');

      if (isDuplicateError) {
        logger.debug(`Skill '${name}' appears to exist, fetching from API...`);

        // Refresh the skill list to update cache
        await this.listSkills();

        // Try to get the skill ID from refreshed cache
        const existingId = await this.getSkillId(name);
        if (existingId) {
          logger.debug(`Found existing skill '${name}' after refresh: ${existingId}`);
          return existingId;
        }
      }

      return null;
    }
  }

  /**
   * Convert display_title to slug format (e.g., "Race Learning Analyst" -> "race-learning-analyst")
   */
  private slugifyDisplayTitle(displayTitle: string): string {
    return displayTitle
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  /**
   * List all available skills (both Anthropic and custom)
   */
  async listSkills(): Promise<SkillMetadata[]> {
    await this.ensureInitialized();

    if (!this.remoteSkillProxyEnabled) {
      this.logRemoteSkillsDisabled();
      return Array.from(this.skillCache.values());
    }

    try {
      logger.debug('Listing all skills via proxy');

      const response = await this.callSkillsProxy('list_skills');
      if (!response) {
        this.logRemoteSkillsDisabled();
        return Array.from(this.skillCache.values());
      }

      const skills = (response as any).data || [];

      // Update cache with latest skills
      skills.forEach((skill: any) => {
        const metadata: SkillMetadata = {
          id: skill.id,
          name: skill.name,
          description: skill.description || '',
          version: skill.version || 'latest',
          uploadedAt: new Date(skill.created_at),
          source: skill.type === 'anthropic' ? 'anthropic' : 'custom'
        };

        // Cache by skill.name if available
        if (skill.name) {
          this.skillCache.set(skill.name, metadata);
        }

        // ALSO cache by slugified display_title for lookup compatibility
        // This handles cases where we only have display_title (e.g., "Race Learning Analyst")
        if (skill.display_title) {
          const slug = this.slugifyDisplayTitle(skill.display_title);
          this.skillCache.set(slug, metadata);
          logger.debug(`Cached skill by display_title slug: ${slug} -> ${skill.id}`);
        }
      });

      await this.saveCachedSkills();

      // Log skill names for debugging
      if (skills.length > 0) {
        const skillNames = skills.map((s: any) => s.name || s.display_title).join(', ');
        logger.debug(`Found ${skills.length} skills: ${skillNames}`);
      } else {
        logger.warn('No skills found');
      }

      return Array.from(this.skillCache.values());
    } catch (error) {
      if (this.remoteSkillProxyEnabled) {
        logger.error('Failed to list skills:', error);
      } else {
        this.logRemoteSkillsDisabled();
      }
      // Return cached skills as fallback
      return Array.from(this.skillCache.values());
    }
  }

  /**
   * Get skill ID by name from cache or API
   */
  async getSkillId(name: string): Promise<string | null> {
    await this.ensureInitialized();

    // Check cache first
    const cached = this.skillCache.get(name);
    if (cached) {
      return cached.id;
    }

    if (!this.remoteSkillProxyEnabled) {
      this.logRemoteSkillsDisabled();
      return null;
    }

    // Fetch from API
    const skills = await this.listSkills();
    const skill = skills.find(s => s.name === name);
    return skill?.id || null;
  }

  /**
   * Initialize race-strategy-analyst skill
   * Uploads if not exists, returns skill ID
   */
  async initializeRaceStrategySkill(): Promise<string | null> {
    return this.initializeSkillInternal('race-strategy-analyst');
  }

  /**
   * Initialize race-learning-analyst skill
   */
  async initializeRaceLearningSkill(): Promise<string | null> {
    return this.initializeSkillInternal('race-learning-analyst');
  }

  /**
   * Initialize tidal-opportunism-analyst skill
   */
  async initializeTidalOpportunismSkill(): Promise<string | null> {
    return this.initializeSkillInternal('tidal-opportunism-analyst');
  }

  /**
   * Initialize slack-window-planner skill
   */
  async initializeSlackWindowSkill(): Promise<string | null> {
    return this.initializeSkillInternal('slack-window-planner');
  }

  /**
   * Initialize current-counterplay-advisor skill
   */
  async initializeCurrentCounterplaySkill(): Promise<string | null> {
    return this.initializeSkillInternal('current-counterplay-advisor');
  }

  /**
   * Initialize boat-tuning-analyst skill
   */
  async initializeBoatTuningSkill(): Promise<string | null> {
    return this.initializeSkillInternal('boat-tuning-analyst');
  }

  /**
   * Initialize learning-event-extractor skill
   */
  async initializeLearningEventExtractorSkill(): Promise<string | null> {
    return this.initializeSkillInternal('learning-event-extractor');
  }

  /**
   * Load skill content from markdown file
   * Note: In production, this should be bundled or loaded from backend
   */
  private async loadSkillContent(skillName: string): Promise<string | null> {
    const resolved = resolveBuiltInSkill(skillName);
    if (!resolved) {
      logger.warn(`No built-in definition for skill '${skillName}'`);
      return null;
    }
    return resolved.definition.content;
  }

  private async initializeSkillInternal(skillKey: BuiltInSkillKey): Promise<string | null> {
    await this.ensureInitialized();

    const preconfiguredId = getPreconfiguredSkillId(skillKey);
    if (preconfiguredId) {
      if (!this.loggedPreconfiguredSkill.has(skillKey)) {
        this.loggedPreconfiguredSkill.add(skillKey);
        logger.debug(
          `Using preconfigured skill ID for '${skillKey}' (${preconfiguredId}) - skipping remote initialization`
        );
      }
      return preconfiguredId;
    }

    if (!this.remoteSkillProxyEnabled) {
      this.logRemoteSkillsDisabled();
      this.logSkipForSkill(skillKey);
      return null;
    }

    try {
      const definition = BUILT_IN_SKILL_DEFINITIONS[skillKey];
      if (!definition) {
        logger.warn(`No definition registered for '${skillKey}'`);
        return null;
      }

      logger.debug(`Initializing skill '${skillKey}'`);

      const possibleNames = [skillKey, ...(definition.aliases ?? [])];

      for (const name of possibleNames) {
        const skillId = await this.getSkillId(name);
        if (skillId) {
          logger.debug(`Found existing skill '${name}' with ID: ${skillId}`);
          return skillId;
        }
      }

      const skillContent = await this.loadSkillContent(skillKey);
      if (!skillContent) {
        logger.error(`Failed to load content for '${skillKey}'`);
        return null;
      }

      logger.debug(`Uploading new '${skillKey}' skill`);
      const skillId = await this.uploadSkill(
        skillKey,
        definition.description,
        skillContent
      );

      if (skillId) {
        logger.debug(`Skill '${skillKey}' initialized with ID: ${skillId}`);
        return skillId;
      }

      logger.warn(`Skill initialization returned null for '${skillKey}'`);
      return null;
    } catch (error) {
      logger.error(`Failed to initialize skill '${skillKey}':`, error);
      return null;
    }
  }

  private async loadCachedSkills(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const skills = JSON.parse(cached) as SkillMetadata[];
        logger.debug(`Loaded ${skills.length} cached skills from storage`);
        skills.forEach(skill => {
          // Reconstruct Date objects
          skill.uploadedAt = new Date(skill.uploadedAt);
          this.skillCache.set(skill.name, skill);
        });
      }
    } catch (error) {
      logger.error('Failed to load cached skills:', error);
    }
  }

  /**
   * Save skills cache to AsyncStorage
   */
  private async saveCachedSkills(): Promise<void> {
    // Skip on web platform
    if (Platform.OS === 'web') {
      return;
    }

    try {
      const skills = Array.from(this.skillCache.values());
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(skills));
    } catch (error) {
      logger.error('Failed to save cached skills:', error);
    }
  }

  /**
   * Clear skills cache (useful for debugging)
   */
  async clearCache(): Promise<void> {
    this.skillCache.clear();

    // Skip AsyncStorage on web
    if (Platform.OS !== 'web') {
      await AsyncStorage.removeItem(this.CACHE_KEY);
    }

    logger.debug('Cache cleared');
  }

  /**
   * Get a built-in skill definition by name or alias
   * Useful for manual uploads or documentation
   */
  static getBuiltInSkillDefinition(skillName: string): SkillDefinition | null {
    const resolved = resolveBuiltInSkill(skillName);
    return resolved?.definition || null;
  }

  /**
   * Get all built-in skill definitions
   */
  static getAllBuiltInSkills(): Record<string, SkillDefinition> {
    return { ...BUILT_IN_SKILL_DEFINITIONS };
  }

  /**
   * Get list of built-in skill names
   */
  static getBuiltInSkillNames(): string[] {
    return Object.keys(BUILT_IN_SKILL_DEFINITIONS);
  }

  private disableRemoteSkills(reason: string, error?: unknown) {
    if (!this.remoteSkillProxyEnabled) {
      return;
    }
    this.remoteSkillProxyEnabled = false;
    this.remoteSkillDisableReason = reason;
    if (error) {
      logger.warn(`${reason} - disabling Claude skill proxy for this session`, error);
    } else {
      logger.warn(`${reason} - disabling Claude skill proxy for this session`);
    }
  }

  private logRemoteSkillsDisabled() {
    if (this.remoteSkillNoticeLogged) {
      return;
    }
    this.remoteSkillNoticeLogged = true;
    const reason = this.remoteSkillDisableReason ?? 'unknown reason';
    logger.info(`Remote Claude skills disabled (${reason}). Falling back to full prompts.`);
  }

  private logSkipForSkill(skillKey: string) {
    if (this.loggedSkipForSkill.has(skillKey)) {
      return;
    }
    this.loggedSkipForSkill.add(skillKey);
    const reason = this.remoteSkillDisableReason ? ` (${this.remoteSkillDisableReason})` : '';
    logger.info(`Skipping '${skillKey}' skill initialization${reason}. Core AI flows will continue without skills.`);
  }
}

// Export singleton instance
export const skillManagementService = new SkillManagementService();
