/**
 * MODULE_CONTENT entries for Sailing interest modules.
 */

interface ModuleContent {
  notesPrompt: string;
  aiCoach: { title: string; body: string; question: string };
  network: { name: string; role: string; tip: string }[];
  history: { summary: string; detail: string };
  items?: { label: string; detail: string; status?: 'alert' | 'ok' | 'info' }[];
  alert?: { title: string; body: string };
  richContent?: boolean;
  drillableItems?: boolean;
  tool?: string;
}

export const SAILING_MODULE_CONTENT: Record<string, ModuleContent> = {
  conditions: {
    tool: 'conditions',
    notesPrompt: 'What are the conditions? Wind speed, direction, shifts, sea state, current, forecast changes?',
    aiCoach: {
      title: 'Read the Racecourse',
      body: 'The sailors who win aren\'t faster — they\'re smarter about conditions. Wind shifts, current lines, and pressure changes are the invisible chess board. Your last race, you identified the persistent shift early and gained 5 boats on the first beat. Keep developing that instinct.',
      question: 'Is the wind oscillating or persistent today? How will that change your upwind strategy?',
    },
    network: [
      { name: 'Jake M.', role: 'Dragon class champion', tip: 'I check 3 weather sources and take the average. Then I go out early and sail the course to feel what the numbers are actually doing.' },
      { name: 'Sarah L.', role: 'Olympic campaigner', tip: 'Current is the biggest overlooked factor. A half-knot of current at the top mark changes your layline by 50 meters. Always factor it in.' },
    ],
    history: {
      summary: '24 races logged • Best results in 8-14 knots oscillating',
      detail: 'You perform well in shifty conditions but struggle when the breeze is light and patchy. Work on reading puffs on the water.',
    },
  },

  strategy: {
    tool: 'strategy',
    notesPrompt: 'What\'s your game plan? Favored side of the course? When will you tack/gybe? Where\'s the most pressure?',
    aiCoach: {
      title: 'Plan to Win, Adapt to Conditions',
      body: 'A strategy isn\'t a rigid plan — it\'s a framework for making fast decisions on the water. Go in with a plan, but hold it loosely. The best sailors have a Plan A and a Plan B before the gun. Your risk management has improved — you\'re protecting top-5 finishes instead of gambling for first.',
      question: 'Where is the pressure? Which side of the course has more wind? That\'s where you want to be.',
    },
    network: [
      { name: 'Sarah L.', role: 'Olympic campaigner', tip: 'I make my strategy decision in the last 3 minutes before the start. Everything before that is data collection. Committing too early means you miss late changes.' },
      { name: 'Marcus K.', role: 'Match race tactician', tip: 'Think in legs, not the whole race. Win the first beat, then reassess. Many sailors plan the entire race and miss what\'s actually happening.' },
    ],
    history: {
      summary: 'Strategy notes from 18 races • Trending toward right side preference',
      detail: 'You tend to favor the right side. Last 3 races where the left paid, you were late to recognize the shift. Practice looking left more.',
    },
  },

  rig_setup: {
    tool: 'rig_setup',
    notesPrompt: 'Rig tune: mast rake, shroud tension, spreader angle? Sail selection and trim targets?',
    aiCoach: {
      title: 'Set Up for the Conditions',
      body: 'Rig setup is the foundation everything else sits on. A well-tuned rig in the right mode for the conditions is free speed. You don\'t have to be the best sailor if your boat is set up faster. Your upwind trim has improved — the telltales are flowing consistently now.',
      question: 'What wind range are you setting up for? Do you need to change gears if the breeze changes?',
    },
    network: [
      { name: 'Tom R.', role: 'Boat builder / tuner', tip: 'Write down your settings for every race with the conditions. After 20 races, you\'ll have your own tuning guide that\'s worth more than any class guide.' },
      { name: 'Jake M.', role: 'Dragon class champion', tip: 'Rig tune is 80% of your speed upwind. Get the basics right: forestay tension controls headstay sag which controls jib shape. Everything follows from there.' },
    ],
    history: {
      summary: 'Tuning notes from 12 races • Light air setup improving',
      detail: 'Your light air rig settings are getting more consistent. Heavy air setup needs more work — consider easing the rig when it builds over 18 knots.',
    },
  },

  course: {
    notesPrompt: 'What\'s the course layout? Windward-leeward? Triangle? Gate? What are the leg lengths and angles?',
    aiCoach: {
      title: 'Know the Chessboard',
      body: 'Understanding the course geometry helps you plan your angles and laylines before you\'re in the heat of racing. Where are the marks relative to the wind? Are gates offset? Is there a reach leg where you can gain or lose? Visual the course before you sail it.',
      question: 'Can you draw the course from memory? If not, study the sailing instructions again. Knowing the course cold removes one variable from your decision-making.',
    },
    network: [
      { name: 'Sarah L.', role: 'Olympic campaigner', tip: 'I always sail past the weather mark before the race to check the layline angles and look for current around the mark. 5 minutes of recon saves 30 seconds of racing.' },
    ],
    history: {
      summary: '18 courses sailed • Windward-leeward most common',
      detail: 'Your mark rounding technique has improved, especially at the bottom gate. Top mark approaches still need work on layline judgment.',
    },
  },

  fleet_analysis: {
    notesPrompt: 'Who\'s fast in these conditions? Who are you racing against for position? What are the hot boats doing for setup?',
    aiCoach: {
      title: 'Race the Fleet, Not the Course',
      body: 'Knowing who\'s fast and what they\'re doing gives you reference points on the water. If the top boats are all going left, there\'s probably a reason. You don\'t have to copy them — but you should understand why before going the other way.',
      question: 'Who are the 3 boats you\'re most likely to be racing against today? What do they do well?',
    },
    network: [
      { name: 'Marcus K.', role: 'Match race tactician', tip: 'Before the start, note the boat numbers of whoever is fast in pre-race sailing. They\'ve found something — try to set up near them and observe.' },
    ],
    history: {
      summary: 'Fleet of 32 boats • You\'re consistently top 10',
      detail: 'You\'ve been racing well against the mid-fleet. To break into the top 5, study what the consistent podium finishers do differently at starts.',
    },
  },

  start_sequence: {
    tool: 'start_sequence',
    notesPrompt: 'Start plan: favored end? Line bias? Time-distance runs? Where do you want to be at the gun?',
    aiCoach: {
      title: 'Win the Start, Control the Race',
      body: 'A great start doesn\'t guarantee a win, but a bad start almost guarantees a loss. The start is the one moment where preparation beats talent. Know the line bias, have your time-distance dialed, and have a backup plan if your spot is taken.',
      question: 'Which end is favored? Have you sailed both ends to check? Sometimes the "wrong" end has better lanes.',
    },
    network: [
      { name: 'Jake M.', role: 'Dragon class champion', tip: 'I do 2 practice starts every day before racing. Not full-speed port-starboard — just time-distance approaches to the line. It calibrates my timing.' },
      { name: 'Sarah L.', role: 'Olympic campaigner', tip: 'The start is won in the last 90 seconds. Before that, just be in the right area with options. Don\'t commit too early.' },
    ],
    history: {
      summary: 'Starts logged: 24 • Top-10 start rate: 65%',
      detail: 'Your starts have improved since you started doing time-distance runs. Right side of the line remains stronger for you.',
    },
  },

  tide_currents: {
    notesPrompt: 'What\'s the tidal state? Current strength and direction across the course? How does it change during the race?',
    aiCoach: {
      title: 'The Hidden Variable',
      body: 'Current is the great equalizer — it affects everyone equally, but those who account for it gain a massive edge. Even a quarter knot can mean 2 boat lengths per minute. That\'s the difference between rounding the mark in clear air or in a pack.',
      question: 'Will the current change during the race? If the tide turns, does that change which side of the course pays?',
    },
    network: [
      { name: 'Tom R.', role: 'Boat builder / tuner', tip: 'Drop a floating object near a mark and watch which way it moves. The tide tables tell you what should happen — your eyes tell you what IS happening.' },
    ],
    history: {
      summary: '12 races with significant current • Learning tidal patterns',
      detail: 'You\'re getting better at accounting for current at marks. Your layline calls in current have improved over the season.',
    },
  },

  competitor_notes: {
    notesPrompt: 'Notes on key competitors: who\'s fast today, who\'s on form, anyone to watch or avoid?',
    aiCoach: {
      title: 'Know Your Rivals',
      body: 'The best competitors study their competition. Not to copy, but to understand. What sails are they using? What side of the course do they favor? Where do they like to start? This intelligence helps you make better decisions under pressure.',
      question: 'Who finished ahead of you in the last race? What did they do differently that you could learn from?',
    },
    network: [
      { name: 'Marcus K.', role: 'Match race tactician', tip: 'Keep a notebook on your top 5 rivals. Over a season, patterns emerge: boat 42 always goes left, boat 17 wins at mark roundings. Knowledge is tactical advantage.' },
    ],
    history: {
      summary: 'Notes on 8 regular competitors',
      detail: 'You\'ve been tracking your key rivals\' tendencies. This is paying off — you anticipated their moves in the last two races.',
    },
  },

  team_assignments: {
    notesPrompt: 'Crew roles and assignments: who\'s doing what? Any special maneuver plans? Communication calls?',
    aiCoach: {
      title: 'The Crew Makes the Boat',
      body: 'Boat speed is a team sport. Clear role assignments and practiced communication make maneuvers smooth and fast. The best teams don\'t just know what to do — they know what to say and when. Your crew\'s tacking has gotten crisper since you standardized the calls.',
      question: 'Does every crew member know their role at every mark rounding? Walk through it verbally before the race.',
    },
    network: [
      { name: 'Jake M.', role: 'Dragon class champion', tip: 'We brief every mark rounding before the start. "Rounding to port, kite up, skipper calls the peel." No surprises, no confusion.' },
    ],
    history: {
      summary: '3 regular crew • Communication improving',
      detail: 'Crew coordination at mark roundings has improved. Focus on spinnaker hoists — getting cleaner but still room for faster sets.',
    },
  },

  share_with_team: {
    richContent: true,
    notesPrompt: 'What do you want to share with your crew? Pre-race strategy, conditions notes, post-race debrief?',
    aiCoach: {
      title: 'Align Your Team',
      body: 'Sharing your race plan with the crew isn\'t a lecture — it\'s a conversation. The best crews co-create strategy because the trimmer sees different things than the helm. Brief together, debrief together, improve together.',
      question: 'Before you share: has every crew member had a chance to contribute their observations?',
    },
    network: [
      { name: 'Sarah L.', role: 'Olympic campaigner', tip: 'I share my pre-race notes with my crew via the app the night before. It means we show up already aligned and use dock time for fine-tuning, not briefing from scratch.' },
    ],
    history: {
      summary: '8 team shares this season • Crew engagement: high',
      detail: 'The crew has been contributing more observations since you started sharing your prep notes. This collaborative approach is improving team decision-making.',
    },
  },

  regulatory: {
    notesPrompt: 'Sailing instructions, course signals, protests committee notes — anything official you need to be aware of?',
    aiCoach: {
      title: 'Know the Rules of the Game',
      body: 'Knowing the racing rules and sailing instructions isn\'t about being a sea lawyer — it\'s about racing with confidence. When you know your rights, you can push harder at marks and starts without fear of a protest. When you don\'t, you give up water unnecessarily.',
      question: 'Have you read the sailing instructions? Are there any special rules or course changes for today?',
    },
    network: [
      { name: 'Marcus K.', role: 'Match race tactician', tip: 'Read the sailing instructions. Every time. I\'ve won protests because the other boat didn\'t read the SI that said "mark to be left to port."' },
    ],
    history: {
      summary: '0 protests filed/received this season',
      detail: 'Clean season so far. Your understanding of mark room and right-of-way situations has improved.',
    },
  },

  match_opponent: {
    notesPrompt: 'Who\'s your match opponent? What are their tendencies? Where are they strong and where can you exploit?',
    aiCoach: {
      title: 'Study Your Opponent',
      body: 'Match racing is chess on water. Knowing your opponent\'s tendencies — their preferred start, their comfort zone, their weak maneuvers — gives you the ability to dictate the race. Force them into uncomfortable situations.',
      question: 'What does your opponent do when they\'re behind? That\'s where you want to keep them.',
    },
    network: [
      { name: 'Marcus K.', role: 'Match race tactician', tip: 'In match racing, the pre-start is 60% of the race. Win the entry, control the dial-up, and you\'re already ahead.' },
    ],
    history: {
      summary: '4 match races this season • Win rate: 75%',
      detail: 'Your pre-start entries have been strong. Downwind positioning against experienced opponents needs work.',
    },
  },

  distance_waypoints: {
    notesPrompt: 'Key waypoints, turning marks, routing strategy? Tidal gates, wind shifts to expect?',
    aiCoach: {
      title: 'Plan the Long Game',
      body: 'Distance racing rewards patience and planning. Every waypoint is a decision point — do you follow the rhumb line or play the weather routing? The best distance sailors think 3 waypoints ahead. Your last offshore race showed great tactical patience.',
      question: 'What\'s the key decision point on this race? Where will the race be won or lost?',
    },
    network: [
      { name: 'Tom R.', role: 'Offshore navigator', tip: 'In distance racing, the weather file changes every 6 hours. Re-route every time new data comes in. The boats that re-route win.' },
    ],
    history: {
      summary: '3 distance races • Avg finish: top 20%',
      detail: 'Your routing has improved. The decision to stay inshore during the last race when the fleet went offshore was the right call.',
    },
  },
};
