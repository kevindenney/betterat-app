/**
 * Interest vernacular registry — maps an interest id to the words real
 * practitioners use on the L3/L4 timeline surfaces (eyebrow verb,
 * librarian voice). This is the first slice of the broader "interest
 * vocab" plan (see memory: project_interest_vernacular_personas).
 *
 * The four primitives the timeline exposes — step, phase, capability,
 * crew — each need per-interest translation eventually. For v1 we
 * translate only the loudest two: the verb eyebrow above the title
 * ("ZOOM · CURRENT ARC · REFLECTING") and the librarian card eyebrow
 * ("The librarian noticed"). Everything else stays as-is until the
 * interest config grows.
 *
 * Resolution rule:
 *   - Match by interest.id (case-insensitive substring) against a short
 *     list of known verticals; fall back to `DEFAULT_VOCAB` for unknown
 *     interests. We match substrings rather than exact ids because the
 *     interest id format isn't fully standardised yet — "sail-racing",
 *     "sailing", "sail_racing" should all hit the sailing entry.
 *   - The verb tier (early / mid / late) is picked from the user's
 *     position within the arc:
 *       early  → first ~⅓ of the arc, the user is mostly PLANNING
 *       mid    → middle ~⅓, the user is mostly DOING
 *       late   → final ~⅓ or post-arc, the user is mostly REFLECTING
 *     Each interest provides its own native verb for each tier.
 */

export type ArcVerbTier = 'early' | 'mid' | 'late';

export interface InterestVocab {
  /** Stable id used by debug logs. Not shown to the user. */
  id: string;
  /**
   * Top eyebrow verb shown above the season title. The full eyebrow
   * renders as "ZOOM · <SCOPE> · <VERB>" — this is just the verb half.
   */
  verb: Record<ArcVerbTier, string>;
  /**
   * Persona-native noun for the calendar block the L3/L4 timeline shows
   * — what a sailor calls an "arc", a nurse calls a "rotation", an
   * entrepreneur a "season". Lower-case; callers capitalize as needed
   * ("Current rotation", "this season"). Replaces hardcoded "arc"
   * literals that leaked the sailing word to every persona.
   */
  periodNoun: string;
  /**
   * Persona-native noun for a dated anchor — the fixed point in time the
   * runway builds toward. A sailor races, a nurse works a shift, an
   * entrepreneur sells at a market day, a runner has a race. Used to label
   * the dated-anchor key in THE WORK legend; sailing's "race" is NOT
   * universal (see project_interest_vernacular_personas). Lower-case.
   */
  anchorNoun: string;
  /**
   * Lifetime-vision placeholder shown on L4 — the question that prompts
   * the user to name what they're building toward. Phrased natively per
   * persona. NOT derived from `verb.mid`: the eyebrow verb ("SHIPPING",
   * "ROTATING") reads as a standalone activity label but breaks when
   * slotted into a sentence ("What are you rotating toward?"). Falls back
   * to the default prompt when a persona omits it.
   */
  visionPrompt?: string;
  /**
   * Eyebrow shown above the lilac librarian card. Spoken in the
   * persona's native voice — academic "the librarian noticed" works
   * for nursing; sailors think of it as a "logbook", entrepreneurs
   * want a quieter second-person observation, etc.
   */
  librarianEyebrow: string;
  /**
   * Section eyebrow above the capability-mix chart (CapabilityMix —
   * the stacked-area "what mix did you practice" surface). "CAPABILITY"
   * is nursing-native; other personas read it as generic-tracker
   * vocab. Each interest provides its own framing.
   */
  capabilityHeader: string;
  /**
   * Section eyebrow above the peer row. Sailing "CREW" reads naturally;
   * for nursing students "COHORT" is the native term, for knitters
   * "KAL" / "CIRCLE", for golfers "FOURSOME", etc.
   *
   * Despite the persona vocab, the lane no longer means "people who
   * showed up" — it means *people who had input into your steps*:
   * tagged in with-who, blueprint author, suggested-to-you, or
   * suggested-by-you. The header keeps the persona word for warmth;
   * inputSubtitle below it clarifies the new meaning.
   */
  crewHeader: string;
  /**
   * Dim subtitle under crewHeader explaining what the dots mean in
   * each persona's voice. Examples: "who shaped this arc" (sailing),
   * "who shaped these shifts" (nursing).
   */
  inputSubtitle: string;
  /**
   * Deliberate semantic palette for this interest. Each entry maps a
   * capability LABEL family (matched by `pattern`) to a stable color
   * + canonical short label that survives across the app. This
   * replaces hashed-from-string color assignment so the same idea
   * (e.g. "Sail Selection", "Sail Design", "Sail Measurement") shares
   * one stable color family, and adjacent capabilities are picked to
   * be perceptually distinct.
   */
  palette?: { pattern: RegExp; canonicalLabel: string; color: string }[];
  /**
   * Ordered list of (regex → vernacular label) pairs used to detect
   * named phases from step titles. The phase generator scans every
   * step in a week against these patterns and uses the most-frequent
   * matched label as the week's named phase. When nothing matches,
   * the generator falls back to the week's dominant capability label.
   *
   * Order matters: more-specific patterns come first so "spring
   * series race 3" hits "Spring Series" before the generic "Race"
   * pattern.
   */
  phasePatterns?: { pattern: RegExp; label: string }[];
  /**
   * Title patterns that mark a step as a *milestone* — a single moment
   * of achievement worth surfacing on the L4 arc lane ("Won FFG
   * Spring", "Passed NCLEX", "First ₹1000"). Unlike phasePatterns
   * which classify a period of work, these classify discrete events.
   *
   * A match qualifies the step; the milestone strip renders the
   * step's *actual title* (not a canonical label), so the user sees
   * their own words back. Match is on title text only, case-insensitive.
   *
   * Persona-tuned: sailors win/qualify; nurses pass/certify;
   * entrepreneurs launch/register/sell-first.
   */
  milestonePatterns?: RegExp[];
}

const DEFAULT_VOCAB: InterestVocab = {
  id: 'default',
  verb: {
    early: 'PLANNING',
    mid: 'IN MOTION',
    late: 'REFLECTING',
  },
  periodNoun: 'arc',
  anchorNoun: 'anchor',
  visionPrompt: 'What are you building toward, long-term?',
  librarianEyebrow: 'This arc · the librarian noticed',
  capabilityHeader: 'CAPABILITY MIX',
  crewHeader: 'TEAM',
  inputSubtitle: 'who shaped this arc',
};

const SAILING_VOCAB: InterestVocab = {
  id: 'sailing',
  verb: {
    early: 'TUNING UP',
    mid: 'RACING',
    late: 'DEBRIEFING',
  },
  periodNoun: 'arc',
  anchorNoun: 'race',
  visionPrompt: 'What are you racing toward, long-term?',
  librarianEyebrow: 'This arc · logbook noticed',
  capabilityHeader: 'PRACTICE LOG',
  crewHeader: 'FLEET',
  inputSubtitle: 'who shaped this arc',
  // Deliberate sailing palette — 13 capability families, vivid and
  // perceptually distinct (same family color across the app). Tuned to
  // match the nursing-design palette's separation: no two co-occurring
  // families share a hue. Order matters — first match wins, so more-
  // specific patterns lead. "Boat handling" is the most-tagged sailing
  // capability, so it leads and owns the warm orange the eye lands on.
  palette: [
    { pattern: /\bsail\b|\bsails\b|sail\s+(selection|design|trim|measurement|inventory|set|change)/i, canonicalLabel: 'Sails', color: '#2F8FB0' },
    { pattern: /boat\s?handl|maneuver|manoeuvr|\bhelm|steer|spinnaker|hoist|douse|roll\s?tack|\bgyb|\bjibe/i, canonicalLabel: 'Boat handling', color: '#E2792E' },
    { pattern: /\brig\b|rigging|rake|shroud|forestay|\bmast\b|\bram\b|spreader|tension|tune/i, canonicalLabel: 'Rig', color: '#B86EAA' },
    { pattern: /boat.?speed|points\s+of\s+sail|optim|hull/i, canonicalLabel: 'Boatspeed', color: '#5BA46F' },
    { pattern: /start|line\s+work/i, canonicalLabel: 'Starts', color: '#C99632' },
    { pattern: /tactic|(windward|leeward)\s+mark|mark\s+(round|trap|combination|approach)|shift|cover|\blane|situational\s+awareness|lee.?bow|\bduck\b/i, canonicalLabel: 'Tactics', color: '#C4474A' },
    { pattern: /crew|comm|radio|coordination|handoff|brief|debrief|teamwork|alignment/i, canonicalLabel: 'Crew', color: '#7BA0C4' },
    { pattern: /weather|wind|breeze|forecast|conditions|venue|local/i, canonicalLabel: 'Conditions', color: '#7E6FC8' },
    { pattern: /fitness|strength|endurance|nutrition|recovery|sleep/i, canonicalLabel: 'Fitness', color: '#C46E49' },
    { pattern: /tactical\s+recovery|race\s+execution|race\s+(history|rules?|culture)/i, canonicalLabel: 'Race craft', color: '#A04CC4' },
    { pattern: /goal|commit|decision|plan|register|entry/i, canonicalLabel: 'Planning', color: '#5BA4A6' },
    { pattern: /logistics|ship|trailer|travel|gear/i, canonicalLabel: 'Logistics', color: '#8A8A8A' },
    { pattern: /navigation|chart|gps|safety|survival/i, canonicalLabel: 'Safety & Nav', color: '#2E6CA8' },
  ],
  phasePatterns: [
    // Named events — most specific first so they win against
    // generic words like "championship" or "tune-up".
    { pattern: /spring\s+series/i, label: 'Spring Series' },
    { pattern: /winter\s+series|frostbite/i, label: 'Frostbite' },
    { pattern: /summer\s+series/i, label: 'Summer Series' },
    { pattern: /easter\s+regatta/i, label: 'Easter Regatta' },
    { pattern: /\bworlds?\b/i, label: 'Worlds' },
    { pattern: /\bAPAC\b|asia.?pacific/i, label: 'APAC' },
    { pattern: /european\s+championship/i, label: 'Europeans' },
    { pattern: /club\s+champ(?:ionship|s)?/i, label: 'Club Champs' },
    { pattern: /championship|champs\b/i, label: 'Champs' },
    { pattern: /regatta/i, label: 'Regatta' },
    // Race-related (order matters — specific phrasings first)
    { pattern: /\brace\s*\d/i, label: 'Race day' },
    { pattern: /race\s+day|race\s+morning/i, label: 'Race day' },
    { pattern: /qualif(?:ier|ying)/i, label: 'Qualifier' },
    { pattern: /race\s+plan|race\s+strategy/i, label: 'Race planning' },
    { pattern: /race\s+(history|culture|rules?|regulations?)/i, label: 'Race study' },
    // Tuning / rig — both orders (tune the rig + rig tune)
    { pattern: /tune.?up/i, label: 'Tune-up' },
    { pattern: /tune\s+(?:the\s+)?rig|rig\s+tun(?:e|ing)?|rig\s+setup?|tuning/i, label: 'Rig tuning' },
    { pattern: /\brake\b|shroud|forestay|measure\s+rig|measure\s+rake/i, label: 'Rig tuning' },
    { pattern: /mast\s+(step|base|partner|bend)/i, label: 'Rig tuning' },
    // Boat / sails
    { pattern: /boat.?speed|points\s+of\s+sail/i, label: 'Boatspeed' },
    { pattern: /sail\s+(detail|select|set|trim|change|inventory)/i, label: 'Sail work' },
    { pattern: /boat\s+optim|hull\s+optim|optim.+(hull|rig|sail)/i, label: 'Boat optimization' },
    // Crew
    { pattern: /crew\s+(roster|work|comm|communication|teamwork|sync|brief)/i, label: 'Crew work' },
    { pattern: /\bcrew\b/i, label: 'Crew work' },
    // Conditions / techniques
    { pattern: /start.?(?:s|drill|practice|line)|line\s+work|start.?line/i, label: 'Start drills' },
    { pattern: /heavy\s+air|big\s+breeze|25.?30\s*kt|strong\s+breeze/i, label: 'Heavy air' },
    { pattern: /light\s+air|drifter|shifty\s+breeze/i, label: 'Light air' },
    { pattern: /downwind|spinnaker|kite\b|gybe|jibe/i, label: 'Downwind' },
    { pattern: /upwind|beating?|tacking/i, label: 'Upwind' },
    { pattern: /mark\s+rounding|rounding\s+mark/i, label: 'Mark roundings' },
    { pattern: /tactical|tactics|tactic\b|shift/i, label: 'Tactics' },
    // Offshore / venue / weather
    { pattern: /\boffshore\b/i, label: 'Offshore' },
    { pattern: /local\s+conditions|venue\s+scout|venue\s+conditions|local\s+venue/i, label: 'Venue scouting' },
    { pattern: /weather\s+(forecast|strategy|routing)|\brouting\b/i, label: 'Weather strategy' },
    { pattern: /sea\s+survival|safety\s+training|safety\s+gear/i, label: 'Safety training' },
    { pattern: /navigation|chart\s+work|gps\b/i, label: 'Navigation' },
    // Planning / logistics / goal-setting
    { pattern: /goal.?setting|\bgoal\b|aims?\b/i, label: 'Goal-setting' },
    { pattern: /commit\s+to|register\s+for|entry\s+form/i, label: 'Goal-setting' },
    { pattern: /ship\s+(?:the\s+)?boat|logistics|trailer/i, label: 'Logistics' },
    { pattern: /gear\s+(select|prep|inventory)/i, label: 'Gear prep' },
    { pattern: /nutrition|endurance|strength|fitness/i, label: 'Fitness' },
    // Generic catch-alls last
    { pattern: /\brace\b/i, label: 'Racing' },
    { pattern: /\bdebrief\b/i, label: 'Debrief' },
  ],
  milestonePatterns: [
    /\b(won|win|winning)\b/i,
    /\bpodium(ed|ing)?\b/i,
    /\bfirst\s+(place|race|win|regatta|series)\b/i,
    /\bqualif(?:ied|ying)\s+for\b/i,
    /\bcompleted\s+(?:the\s+)?(?:worlds?|championship|regatta|series)\b/i,
    /\bnew\s+boat\b/i,
    /\bbought\s+(?:a\s+)?boat\b/i,
    /\b(top\s+\d+|top-\d+)\b/i,
    /\bcrew(?:ed)?\s+for\s+the\s+first\s+time\b/i,
    /\byacht\s*master\b/i,
  ],
};

const NURSING_VOCAB: InterestVocab = {
  id: 'nursing',
  verb: {
    early: 'PREPPING',
    mid: 'ROTATING',
    late: 'DEBRIEFING',
  },
  periodNoun: 'rotation',
  anchorNoun: 'shift',
  visionPrompt: 'What kind of nurse are you becoming?',
  librarianEyebrow: "This rotation · preceptor's debrief",
  capabilityHeader: 'CAPABILITY MIX',
  crewHeader: 'COHORT',
  inputSubtitle: 'who shaped these shifts',
  // Deliberate nursing palette — 9 capability families, perceptually
  // distinct, with the same family color across the app. Order matters:
  // first match wins, so more-specific patterns lead. Without this,
  // every raw capability label ("Smooth catheter advancement",
  // "Troubleshooting difficult catheter placement", "Correct needle
  // angle") becomes its own band with its own colliding label —
  // unreadable on the chart.
  palette: [
    {
      pattern: /catheter|i\.?v\.?|iv\b|needle|vein|insertion|first.?stick|venipuncture|cannula/i,
      canonicalLabel: 'Procedures',
      color: '#2F8FB0',
    },
    {
      pattern: /head.?to.?toe|vital\s+signs?|assessment|evaluation|focused\s+exam|history\s+taking|clinical\s+(judgment|reasoning|skill|placement|practice|rotation|observation|decision)|^clinical$|^clinical\b(?!\s+communication)/i,
      canonicalLabel: 'Assessment',
      color: '#5BA46F',
    },
    {
      pattern: /medication|dosing|administration|pharmac|drug\s+calc|titrat/i,
      canonicalLabel: 'Pharmacology',
      color: '#7E6FC8',
    },
    {
      pattern: /infection|sterile|aseptic|ppe\b|hand\s+hygiene|handwash|barrier/i,
      canonicalLabel: 'Infection control',
      color: '#5BA4A6',
    },
    {
      pattern: /patient[\s\/\-]+(family[\s\/\-]+)?(education|teaching)|family[\s\/\-]+education|teach.?back|discharge[\s\/\-]+teach|health[\s\/\-]+literacy|capstone|\breading\b|\blearning\b|study\s+(session|time)|skill[\s-]+lab|simulation\s+lab|simulation\b/i,
      canonicalLabel: 'Education',
      color: '#C99632',
    },
    {
      pattern: /patient\s+communication|clinical\s+communication|handoff|sbar|huddle|family\s+conference/i,
      canonicalLabel: 'Communication',
      color: '#C46E49',
    },
    {
      pattern: /chart|documentation|electronic\s+(record|health)|ehr\b|nursing\s+notes?/i,
      canonicalLabel: 'Documentation',
      color: '#7BA0C4',
    },
    {
      pattern: /discharge\s+planning|care\s+plan|care\s+coordination|transitions?\s+of\s+care/i,
      canonicalLabel: 'Care planning',
      color: '#B86EAA',
    },
    {
      pattern: /fall\s+prevention|restraint|rapid\s+response|emergency|code\s+blue|safety/i,
      canonicalLabel: 'Safety',
      color: '#C4474A',
    },
  ],
  phasePatterns: [
    { pattern: /med.?surg/i, label: 'Med-Surg' },
    { pattern: /\bICU\b|intensive\s+care/i, label: 'ICU' },
    { pattern: /\bpeds\b|pediatric/i, label: 'Peds' },
    { pattern: /\bOB\b|labor|obstetric|maternity/i, label: 'OB' },
    { pattern: /sim|simulation\s+lab/i, label: 'Sim lab' },
    { pattern: /capstone/i, label: 'Capstone' },
    { pattern: /fundamentals/i, label: 'Fundamentals' },
    { pattern: /adult\s+health/i, label: 'Adult Health' },
    { pattern: /preceptorship/i, label: 'Preceptorship' },
    { pattern: /community\s+health|public\s+health/i, label: 'Community health' },
    { pattern: /mental\s+health|psych/i, label: 'Mental health' },
  ],
  milestonePatterns: [
    /\bpassed\b/i,
    /\bcertified\b/i,
    /\blicensed\b/i,
    /\bgraduated\b/i,
    /\bNCLEX\b/i,
    /\bboard\s+exam\b/i,
    /\bfirst\s+(IV|catheter|patient|code|stick|shift)\b/i,
    /\bcapstone\s+(complete|defense|defended)\b/i,
    /\bclinical\s+(start|ended)\b/i,
    /\bstarted\s+(?:the\s+)?(?:rotation|preceptorship)\b/i,
    /\bRN\b/i,
  ],
};

const ENTREPRENEUR_VOCAB: InterestVocab = {
  id: 'entrepreneur',
  verb: {
    early: 'PLANNING',
    mid: 'SHIPPING',
    late: 'TALLYING',
  },
  periodNoun: 'season',
  anchorNoun: 'market day',
  visionPrompt: 'What are you building toward, long-term?',
  librarianEyebrow: 'This season · what your books noticed',
  capabilityHeader: 'BUSINESS MIX',
  crewHeader: 'TEAM',
  inputSubtitle: 'who shaped this season',
  // Deliberate rural-entrepreneur palette — vivid, perceptually distinct
  // families so the BUSINESS MIX river reads as colour, not the 3-tone
  // neutral fallback. Order matters (first match wins): craft families and
  // specific finance patterns lead so e.g. "reeling" beats a generic word.
  // Sister capabilities collapse into one canonical stream + colour
  // ("Costing a batch" + "Pricing for profit" → "Costing & pricing").
  palette: [
    { pattern: /silk|cocoon|sericultur|tasar|reel/i, canonicalLabel: 'Silk', color: '#5BA4A6' },
    { pattern: /weav|loom|warp|weft|gamcha|natural\s+dye|handloom|weaver/i, canonicalLabel: 'Weaving', color: '#A04CC4' },
    { pattern: /tailor|stitch|garment|sewing|blouse|petticoat|measurement/i, canonicalLabel: 'Tailoring', color: '#7BA0C4' },
    { pattern: /murmura|recipe|food\s+safety|hygiene|shelf.?life|fssai|food\s+licens/i, canonicalLabel: 'Food craft', color: '#5BA46F' },
    { pattern: /crop|kitchen\s+garden|irrigation|harvest|planting|garden/i, canonicalLabel: 'Kitchen garden', color: '#C46E49' },
    { pattern: /scheme|subsid|grant|welfare|yojana|nrlm/i, canonicalLabel: 'Schemes', color: '#7E6FC8' },
    { pattern: /shg|bank\s+linkage|credit|revolving|community\s+investment/i, canonicalLabel: 'SHG finance', color: '#2F8FB0' },
    { pattern: /loan|mudra/i, canonicalLabel: 'Loans', color: '#C4474A' },
    { pattern: /document|record|complianc|licens|registration|paperwork/i, canonicalLabel: 'Licensing & records', color: '#8A8A8A' },
    { pattern: /cost|pric|business\s+plan|persisten|follow.?up/i, canonicalLabel: 'Costing & pricing', color: '#C99632' },
    { pattern: /sell|buyer|customer|outreach/i, canonicalLabel: 'Selling', color: '#E2792E' },
    { pattern: /packag|brand|differen/i, canonicalLabel: 'Branding', color: '#B86EAA' },
    { pattern: /sourc|batch\s+production|quality|finished\s+product|goal\s+setting/i, canonicalLabel: 'Production', color: '#2E6CA8' },
  ],
  phasePatterns: [
    { pattern: /diwali/i, label: 'Diwali rush' },
    { pattern: /wedding\s+season|wedding\s+orders?/i, label: 'Wedding season' },
    { pattern: /\beid\b/i, label: 'Eid prep' },
    { pattern: /\bholi\b/i, label: 'Holi prep' },
    { pattern: /raksha\s+bandhan|rakhi/i, label: 'Rakhi prep' },
    { pattern: /onam|pongal|navratri/i, label: 'Festival prep' },
    { pattern: /launch/i, label: 'Launch' },
    { pattern: /restock|reorder/i, label: 'Restock' },
    { pattern: /\bsamples?\b/i, label: 'Samples' },
    { pattern: /new\s+collection|drop\b/i, label: 'New collection' },
    { pattern: /\bGST\b|filing|return/i, label: 'GST / filing' },
    { pattern: /pop.?up|exhibition\b|fair\b/i, label: 'Pop-up / fair' },
  ],
  milestonePatterns: [
    /\bfirst\s+(sale|customer|order|₹\d|\$\d|rupee)/i,
    /\blaunched?\b/i,
    /\bregistered\s+(?:the\s+)?(?:business|company|brand)\b/i,
    /\bGST\s+(?:filed|number|registration)\b/i,
    /\bincorporat(ed|ion)\b/i,
    /\bfirst\s+1000\b/i,
    /\bonline\s+now\b/i,
    /\bnew\s+brand\b/i,
  ],
};

const GOLF_VOCAB: InterestVocab = {
  id: 'golf',
  verb: {
    early: 'WARMING UP',
    mid: 'PLAYING',
    late: 'SCORING',
  },
  periodNoun: 'season',
  anchorNoun: 'tournament',
  visionPrompt: "What's the game you're building toward?",
  librarianEyebrow: "This season · coach's notebook",
  capabilityHeader: 'ROUND MIX',
  crewHeader: 'FOURSOME',
  inputSubtitle: 'who shaped your game',
  phasePatterns: [
    { pattern: /club\s+championship|club\s+champs/i, label: 'Club Champs' },
    { pattern: /championship|tourney|tournament/i, label: 'Tournament' },
    { pattern: /member.?guest/i, label: 'Member-Guest' },
    { pattern: /league/i, label: 'League' },
    { pattern: /lesson/i, label: 'Lesson' },
    { pattern: /\brange\b|driving\s+range/i, label: 'Range work' },
    { pattern: /putting\s+practice|putting\s+green/i, label: 'Putting work' },
    { pattern: /short\s+game/i, label: 'Short game' },
    { pattern: /\bround\b|18\s+holes?/i, label: 'Round' },
  ],
};

const DRAWING_VOCAB: InterestVocab = {
  id: 'drawing',
  verb: {
    early: 'WARMING UP',
    mid: 'DRAWING',
    late: 'REVIEWING',
  },
  periodNoun: 'sketchbook',
  anchorNoun: 'show',
  visionPrompt: 'What are you working toward as an artist?',
  librarianEyebrow: 'This sketchbook · studio notes',
  capabilityHeader: 'STUDIO LOG',
  crewHeader: 'STUDIO',
  inputSubtitle: 'who shaped your work',
  // Deliberate drawing palette — perceptually distinct capability
  // families, same color across the app. Order matters: first match
  // wins, so more-specific patterns lead. Without this, every raw
  // capability goal ("Keep proportions believable", "Confident single
  // line", "Read the form before drawing") becomes its own band with
  // its own sentence-length colliding label — unreadable on the chart.
  palette: [
    { pattern: /proportion|measur|scale|relationship|sight.?siz/i, canonicalLabel: 'Proportion', color: '#C46E49' },
    { pattern: /line(\s+(work|control|quality|weight|confidence))?|contour|single\s+stroke|mark.?making/i, canonicalLabel: 'Line control', color: '#5BA46F' },
    { pattern: /perspective|foreshorten|vanishing|depth|three.?dimension|3d\b|space\b/i, canonicalLabel: 'Perspective', color: '#5A7A98' },
    { pattern: /observ|see\b|seeing|look(ing)?\b|read\s+the\s+form|reference|from\s+life|negative\s+space/i, canonicalLabel: 'Observation', color: '#7E6FC8' },
    { pattern: /shape|silhouette|form|construct|block.?in|massing/i, canonicalLabel: 'Shape', color: '#C99632' },
    { pattern: /value|tone|tonal|shade|shading|light|shadow|contrast/i, canonicalLabel: 'Value', color: '#8A8A8A' },
    { pattern: /gesture|movement|flow|rhythm|action|loose/i, canonicalLabel: 'Gesture', color: '#C4474A' },
    { pattern: /composition|layout|framing|balance|focal/i, canonicalLabel: 'Composition', color: '#7BA0C4' },
    { pattern: /anatomy|figure|skeleton|muscle|gesture\s+anatomy/i, canonicalLabel: 'Anatomy', color: '#B86EAA' },
    { pattern: /detail|render|finish|texture|polish/i, canonicalLabel: 'Rendering', color: '#4F9DA6' },
    { pattern: /color|colour|hue|palette|saturation/i, canonicalLabel: 'Color', color: '#A04CC4' },
    { pattern: /habit|consisten|routine|discipline|daily\s+(practice|drawing|sketch)|mileage|regular/i, canonicalLabel: 'Discipline', color: '#8E8E93' },
  ],
  phasePatterns: [
    { pattern: /anatomy/i, label: 'Anatomy' },
    { pattern: /portrait/i, label: 'Portrait' },
    { pattern: /plein.?air|outdoor/i, label: 'Plein air' },
    { pattern: /still.?life/i, label: 'Still life' },
    { pattern: /life\s+drawing|figure\s+drawing/i, label: 'Life drawing' },
    { pattern: /landscape/i, label: 'Landscape' },
    { pattern: /sketchbook/i, label: 'Sketchbook' },
    { pattern: /studies?\b/i, label: 'Studies' },
    { pattern: /gesture/i, label: 'Gesture' },
    { pattern: /perspective/i, label: 'Perspective' },
    { pattern: /value\s+study|tonal/i, label: 'Value study' },
  ],
};

const KNITTING_VOCAB: InterestVocab = {
  id: 'knitting',
  verb: {
    early: 'CASTING ON',
    mid: 'KNITTING',
    late: 'BINDING OFF',
  },
  periodNoun: 'project',
  anchorNoun: 'deadline',
  visionPrompt: 'What do you want to be able to make?',
  librarianEyebrow: 'This project · pattern notes',
  capabilityHeader: 'PROJECT LOG',
  crewHeader: 'CIRCLE',
  inputSubtitle: 'who shaped this project',
  phasePatterns: [
    { pattern: /\bsocks?\b/i, label: 'Socks' },
    { pattern: /sweater|jumper|pullover|cardigan/i, label: 'Sweater' },
    { pattern: /\blace\b/i, label: 'Lace' },
    { pattern: /cable/i, label: 'Cables' },
    { pattern: /shawl/i, label: 'Shawl' },
    { pattern: /colorwork|stranded|fair\s+isle/i, label: 'Colorwork' },
    { pattern: /\bKAL\b|knit.?along/i, label: 'KAL' },
    { pattern: /\b(scarf|cowl)\b/i, label: 'Scarf / Cowl' },
    { pattern: /blanket|afghan/i, label: 'Blanket' },
    { pattern: /\bhat\b|beanie/i, label: 'Hat' },
  ],
};

const RUNNING_VOCAB: InterestVocab = {
  id: 'running',
  verb: {
    early: 'BASE BUILDING',
    mid: 'SHARPENING',
    late: 'RACING',
  },
  periodNoun: 'block',
  anchorNoun: 'race',
  visionPrompt: 'What race or distance are you training toward?',
  librarianEyebrow: 'This block · the log noticed',
  capabilityHeader: 'TRAINING MIX',
  crewHeader: 'SQUAD',
  inputSubtitle: 'who shaped this block',
  // Deliberate running palette — distinct hues per training quality so the
  // TRAINING MIX river reads as colour, not the neutral fallback. Order
  // matters (first match wins): "Power endurance" hits Strength before the
  // generic "endurance" in Aerobic base; "Threshold pace" hits Threshold
  // before the generic "pace" in Racing & goals.
  palette: [
    { pattern: /interval|vo2|\b400|\b800|reps?\b|track\s+session/i, canonicalLabel: 'Speed', color: '#C4474A' },
    { pattern: /threshold|tempo|lactate/i, canonicalLabel: 'Threshold', color: '#E2792E' },
    { pattern: /hill|strength|power|plyo|drill|form|cadence|technique/i, canonicalLabel: 'Strength & form', color: '#C99632' },
    { pattern: /aerobic|\bbase\b|enduranc|easy|mileage|long\s+run|steady/i, canonicalLabel: 'Aerobic base', color: '#5BA46F' },
    { pattern: /taper|recover|\brest\b|sleep|mobility|stretch/i, canonicalLabel: 'Recovery', color: '#7BA0C4' },
    { pattern: /race|goal|commit|register|entry|pacing|pace\b|\bpb\b|\bpr\b/i, canonicalLabel: 'Racing & goals', color: '#7E6FC8' },
    { pattern: /nutrition|fuel|hydrat|diet/i, canonicalLabel: 'Fuel', color: '#5BA4A6' },
    { pattern: /injur|rehab|prehab|gait|niggle/i, canonicalLabel: 'Health', color: '#8A8A8A' },
  ],
  phasePatterns: [
    { pattern: /taper/i, label: 'Taper' },
    { pattern: /race\s+week|race\s+day/i, label: 'Race week' },
    { pattern: /\bbase\b|base.?build/i, label: 'Base' },
    { pattern: /\bpeak|sharpen/i, label: 'Peak' },
    { pattern: /long\s+run/i, label: 'Long run' },
  ],
  milestonePatterns: [
    /\b(first|new)\s+(pb|pr|personal\s+best)\b/i,
    /\bregister(ed)?\s+for\b/i,
    /\bfirst\s+(5k|10k|half|marathon)\b/i,
    /\bbroke\s+\d/i,
    /\bsub.?\d/i,
  ],
};

/**
 * Substring → vocab. Order matters: more-specific patterns first so
 * "sail racing" hits sailing before any future "racing" generic.
 */
const VOCAB_PATTERNS: { pattern: RegExp; vocab: InterestVocab }[] = [
  { pattern: /sail/i, vocab: SAILING_VOCAB },
  { pattern: /nurs/i, vocab: NURSING_VOCAB },
  { pattern: /entrepren|business|home.?biz|seller/i, vocab: ENTREPRENEUR_VOCAB },
  { pattern: /golf/i, vocab: GOLF_VOCAB },
  { pattern: /draw|sketch|paint|illustrat/i, vocab: DRAWING_VOCAB },
  { pattern: /knit|crochet|fiber.?art/i, vocab: KNITTING_VOCAB },
  { pattern: /\brun(ning)?\b|marathon|\bjog/i, vocab: RUNNING_VOCAB },
];

/**
 * Resolve an interest id/label to its vocab. Accepts either or both —
 * real data passes a UUID for `id` (no semantic content) plus a
 * human label ("Sail Racing"), while sample data passes a slug-ish
 * id ("sailing"). The matcher tests patterns against ALL provided
 * strings, so a UUID id + "Sail Racing" label still resolves to
 * sailing.
 */
export function resolveInterestVocab(
  ...candidates: (string | null | undefined)[]
): InterestVocab {
  const haystack = candidates.filter(Boolean).join(' ');
  if (!haystack) return DEFAULT_VOCAB;
  for (const entry of VOCAB_PATTERNS) {
    if (entry.pattern.test(haystack)) return entry.vocab;
  }
  return DEFAULT_VOCAB;
}

/**
 * Pick the verb tier from the user's position within the arc. The
 * thresholds are deliberately wide so a sailor at week 1 of 8 reads
 * as `TUNING UP` (early), at week 4 reads as `RACING` (mid), and at
 * week 8 reads as `DEBRIEFING` (late). Pre-week-1 and post-final
 * positions clamp to early / late respectively.
 */
export function pickVerbTier(currentWeek: number, totalWeeks: number): ArcVerbTier {
  if (totalWeeks <= 1) return 'mid';
  const ratio = (currentWeek - 1) / Math.max(1, totalWeeks - 1);
  if (ratio < 0.34) return 'early';
  if (ratio < 0.75) return 'mid';
  return 'late';
}

/**
 * Resolve a capability label to a (canonicalLabel, color) pair using
 * the interest's deliberate palette. Falls back to the raw label +
 * a stable hash-derived color when no palette pattern matches — this
 * keeps unknown capabilities visible while the palette grows.
 */
export function resolveCapabilityVisuals(
  rawLabel: string,
  vocab: InterestVocab,
): { canonicalLabel: string; color: string } {
  const palette = vocab.palette ?? [];
  for (const entry of palette) {
    if (entry.pattern.test(rawLabel)) {
      return { canonicalLabel: entry.canonicalLabel, color: entry.color };
    }
  }
  // Fallback — keep the user's exact label; pick a stable color from a
  // small neutral set so even unknown capabilities don't blow up the
  // chart's color story.
  const FALLBACK_COLORS = ['#9B9085', '#B0A28E', '#8C9CA8'];
  let h = 0;
  for (let i = 0; i < rawLabel.length; i++) {
    h = ((h << 5) - h + rawLabel.charCodeAt(i)) | 0;
  }
  return {
    canonicalLabel: rawLabel,
    color: FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length]!,
  };
}

/**
 * Cross-interest "combo" capability tags ("Sail Racing + Drawing") are
 * emitted by the AI suggestion engine on cross-interest steps — they name
 * an interest pair, not a skill family. Left in the capability river they
 * create a phantom band that bleeds another interest into this one (the
 * same leak the pinned-step exclusion guards against, arriving via
 * suggestion steps instead of pins). Skip them from capability accounting;
 * the step itself still shows in the Browse Weeks list below.
 */
export function isCrossInterestCapabilityLabel(label: string): boolean {
  return /\s\+\s/.test(label);
}

/** Convenience — fully composed eyebrow line for the SeasonHeaderChips. */
export function composeArcEyebrow(
  vocab: InterestVocab,
  tier: ArcVerbTier,
  scopeLabel = `CURRENT ${vocab.periodNoun.toUpperCase()}`,
): string {
  return `ZOOM · ${scopeLabel} · ${vocab.verb[tier]}`;
}

/**
 * Scan a week's step titles against the interest's phase patterns and
 * return the most-frequent matched label. Returns null when nothing
 * matches — callers should fall back to capability-name labeling.
 *
 * Ties are broken by pattern order in `phasePatterns` (more-specific
 * patterns appear first in each vocab so they win against generics).
 */
export function detectPhaseLabelFromTitles(
  titles: string[],
  vocab: InterestVocab,
): string | null {
  const patterns = vocab.phasePatterns;
  if (!patterns || patterns.length === 0 || titles.length === 0) return null;
  const counts = new Map<string, { count: number; firstSeen: number }>();
  for (const title of titles) {
    for (let i = 0; i < patterns.length; i++) {
      const entry = patterns[i]!;
      if (entry.pattern.test(title)) {
        const existing = counts.get(entry.label);
        if (existing) existing.count += 1;
        else counts.set(entry.label, { count: 1, firstSeen: i });
        // Each title can contribute to multiple labels; that's OK —
        // "Spring Series Race 3" should boost both labels but Spring
        // Series wins on tie because its pattern comes first.
      }
    }
  }
  if (counts.size === 0) return null;
  let bestLabel: string | null = null;
  let bestCount = 0;
  let bestFirstSeen = Number.POSITIVE_INFINITY;
  for (const [label, info] of counts) {
    if (
      info.count > bestCount ||
      (info.count === bestCount && info.firstSeen < bestFirstSeen)
    ) {
      bestLabel = label;
      bestCount = info.count;
      bestFirstSeen = info.firstSeen;
    }
  }
  return bestLabel;
}

/**
 * Scan step titles for milestone-pattern matches and return the
 * matching step titles in input order, deduplicated. Used by the L4
 * arc lane to surface a small "moments worth marking" annotation row
 * beneath each season's bricks ("✓ Won FFG Spring · 🎓 Passed NCLEX
 * · 🚀 First customer").
 *
 * Each pattern is treated as a single qualifier — there is no scoring
 * or label normalization. The user sees their own step title back, in
 * the same words they wrote, so the surface stays honest to *their*
 * voice rather than the librarian's.
 */
export function detectMilestoneTitles(
  titles: string[],
  vocab: InterestVocab,
  maxResults = 3,
): string[] {
  const patterns = vocab.milestonePatterns;
  if (!patterns || patterns.length === 0 || titles.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const title of titles) {
    const trimmed = title.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        seen.add(trimmed.toLowerCase());
        out.push(trimmed);
        if (out.length >= maxResults) return out;
        break;
      }
    }
  }
  return out;
}
