/**
 * MODULE_CONTENT entries for Drawing interest modules.
 * Each entry provides: notesPrompt, aiCoach, network tips, history,
 * and optional tool/items/alert/richContent.
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

export const DRAWING_MODULE_CONTENT: Record<string, ModuleContent> = {
  reference_images: {
    tool: 'reference_images',
    richContent: true,
    notesPrompt: 'What are you drawing today? Describe your subject, reference images, and what you want to capture.',
    aiCoach: {
      title: 'See Before You Draw',
      body: 'The best artists spend more time looking than drawing. Before you pick up a pencil, study your reference. Where does the light fall? What\'s the darkest dark and lightest light? Your last session you nailed the value range on that portrait — carry that intentional seeing forward.',
      question: 'Look at your reference for 60 seconds without drawing. What\'s the single most interesting shape you see?',
    },
    network: [
      { name: 'Kenji T.', role: 'Urban sketcher', tip: 'I take 3 reference photos from different angles before I start. Having options means I can pick the most interesting composition, not just the obvious one.' },
      { name: 'Sophie T.', role: 'Watercolorist', tip: 'Pin your reference at eye level next to your easel. Looking down at a phone and up at your canvas introduces subtle perspective errors.' },
    ],
    history: {
      summary: '12 sessions logged • Portraits, landscapes, still life',
      detail: 'Your last session focused on architectural perspective. You noted the vanishing point placement was more accurate than previous attempts.',
    },
  },

  composition: {
    notesPrompt: 'How will you arrange the elements? What\'s your focal point? Consider rule of thirds, leading lines, and negative space.',
    aiCoach: {
      title: 'Design the Eye\'s Journey',
      body: 'Composition isn\'t decoration — it\'s the invisible architecture that guides the viewer\'s eye. A strong composition makes even simple subjects compelling. Your recent still life had a great triangular arrangement — that instinct is developing.',
      question: 'Do a 30-second thumbnail sketch. Where does the viewer\'s eye enter, and where does it rest?',
    },
    network: [
      { name: 'Lucas R.', role: 'Portrait artist', tip: 'I do 4-6 thumbnail sketches (2" squares) before committing to a composition. It takes 5 minutes and saves hours of frustration.' },
      { name: 'Maya P.', role: 'Digital illustrator', tip: 'Squint at your composition — if the big shapes aren\'t interesting when blurred, the details won\'t save it.' },
    ],
    history: {
      summary: '8 compositions planned • Improving on focal point placement',
      detail: 'You\'ve been experimenting with off-center focal points. Last session\'s asymmetric composition was your strongest yet.',
    },
  },

  technique_focus: {
    tool: 'technique_focus',
    notesPrompt: 'What specific technique are you practicing today? What skill do you want to develop or refine?',
    aiCoach: {
      title: 'Deliberate Practice, Not Just Drawing',
      body: 'Drawing for fun is great, but growth comes from deliberate practice — targeting a specific weakness with focused exercises. You\'ve been working on hatching consistency. Today, push that further: can you create 5 distinct value steps using only parallel lines?',
      question: 'What\'s the technique you avoid because it\'s uncomfortable? That\'s probably what you should practice today.',
    },
    network: [
      { name: 'Olivia C.', role: 'Oil painter', tip: 'Set a timer for 20 minutes of pure technique practice before starting your main piece. It\'s like stretching before exercise — warms up your hand and your eye.' },
      { name: 'Kenji T.', role: 'Urban sketcher', tip: 'Film your hand while you draw. Watching the replay reveals habits you can\'t feel in the moment — grip tension, stroke speed, unnecessary lifting.' },
    ],
    history: {
      summary: '6 technique sessions • Hatching, blending, edge control',
      detail: 'Your hatching has improved significantly. Instructor noted cleaner line confidence in your last study.',
    },
  },

  materials: {
    tool: 'materials',
    notesPrompt: 'What materials will you use today? Any new media to try? Is your workspace set up?',
    aiCoach: {
      title: 'Know Your Tools',
      body: 'Every medium has a personality. Charcoal is bold and forgiving. Graphite is precise and unforgiving. Watercolor has a mind of its own. The more you understand your tools, the more you can let them work with you instead of fighting them.',
      question: 'If you could only use one tool today, which would you choose and why?',
    },
    network: [
      { name: 'Sophie T.', role: 'Watercolorist', tip: 'Lay out ALL your materials before you start. Nothing kills flow like searching for a specific pencil mid-drawing.' },
      { name: 'Lucas R.', role: 'Portrait artist', tip: 'Keep a swatch card for every pencil/charcoal you own. Knowing what 2B vs 4B actually looks like on YOUR paper saves guessing.' },
    ],
    history: {
      summary: 'Primary media: graphite, charcoal • Experimenting with ink',
      detail: 'You\'ve been exploring ink wash techniques. The last session\'s brush control showed real improvement over previous attempts.',
    },
  },

  color_study: {
    tool: 'color_study',
    notesPrompt: 'What colors are you working with today? What relationships are you exploring — complementary, analogous, split-complementary?',
    aiCoach: {
      title: 'Color Is Relationship',
      body: 'A color in isolation means nothing — it only comes alive next to other colors. That red looks different next to green than it does next to orange. Your eye is getting better at seeing temperature shifts. Push that today: can you paint a "warm" shadow and a "cool" highlight?',
      question: 'Mix your three most-used colors together. What neutral do you get? Understanding your palette\'s bias is powerful.',
    },
    network: [
      { name: 'Maya P.', role: 'Digital illustrator', tip: 'I start every color study by identifying the warmest warm and coolest cool. Everything else falls between those two anchors.' },
      { name: 'Olivia C.', role: 'Oil painter', tip: 'Limit yourself to 3 colors plus white. Forced limitations teach you more about color mixing than a full palette ever will.' },
    ],
    history: {
      summary: '5 color studies • Warm/cool relationships improving',
      detail: 'Your last study successfully separated light temperature from shadow temperature — a key breakthrough in color understanding.',
    },
  },

  value_study: {
    notesPrompt: 'Map out the values in your subject. Where are the lightest lights and darkest darks? How many value steps do you need?',
    aiCoach: {
      title: 'Value Does the Heavy Lifting',
      body: 'Color gets the glory, but value does the work. A painting with perfect color and wrong values looks off. A painting with perfect values and wrong color still reads beautifully. Your notan studies are getting stronger — the 2-value breakdown of that landscape was excellent.',
      question: 'Squint at your subject until you can only see 3 values: light, mid, dark. Sketch that pattern in 60 seconds.',
    },
    network: [
      { name: 'Lucas R.', role: 'Portrait artist', tip: 'Do a 3-value notan before every portrait. If the pattern of light and shadow isn\'t interesting at 3 values, adding more detail won\'t fix it.' },
    ],
    history: {
      summary: '4 value studies • Notan practice improving',
      detail: 'You successfully identified the key value groupings in your last still life before starting. This pre-planning led to a more cohesive final piece.',
    },
  },

  artist_study: {
    richContent: true,
    notesPrompt: 'Which artist or master work are you studying today? What specific technique or approach are you trying to learn from them?',
    aiCoach: {
      title: 'Stand on Giants\' Shoulders',
      body: 'Every great artist learned by studying other great artists. Copying isn\'t cheating — it\'s how you internalize techniques your conscious mind can\'t yet articulate. Your Sargent study last week showed you how he uses lost edges. What will you steal today?',
      question: 'Pick one specific thing this artist does better than anyone else. Focus only on learning that one thing.',
    },
    network: [
      { name: 'Olivia C.', role: 'Oil painter', tip: 'When copying a master, don\'t just copy what you see — try to copy the ORDER they worked. Process matters as much as result.' },
      { name: 'Kenji T.', role: 'Urban sketcher', tip: 'I keep a "stolen techniques" journal. Each master study, I write one sentence: "From [artist], I learned [technique]." It becomes your personal curriculum.' },
    ],
    history: {
      summary: '3 master studies • Sargent, Rembrandt, Mucha',
      detail: 'Your Sargent study focused on edge control — lost and found edges. You noted how he uses sharp edges only at focal points.',
    },
  },

  time_plan: {
    notesPrompt: 'How long is today\'s session? How will you divide your time between warm-up, study, and main work?',
    aiCoach: {
      title: 'Time Is Your Medium Too',
      body: 'A focused 45-minute session beats a distracted 3-hour session every time. Plan your time: warm-up, technique practice, main work, and 5 minutes at the end to step back and evaluate. Your sessions are getting more structured — that discipline shows in the work.',
      question: 'Set a timer for your warm-up. When it goes off, stop — even if you\'re not done. This trains discipline.',
    },
    network: [
      { name: 'Maya P.', role: 'Digital illustrator', tip: 'I use the Pomodoro technique: 25 minutes drawing, 5 minutes evaluating from a distance. The breaks give your eye fresh perspective.' },
    ],
    history: {
      summary: 'Avg session: 65 min • Sessions getting more structured',
      detail: 'You\'ve been consistently allocating warm-up time. Session quality has improved since you started planning time blocks.',
    },
  },

  share_with_instructor: {
    richContent: true,
    notesPrompt: 'What do you want feedback on? What specific questions do you have for your instructor?',
    aiCoach: {
      title: 'Ask Better Questions, Get Better Feedback',
      body: 'Don\'t just show your work and ask "what do you think?" — ask targeted questions. "How can I improve the value transitions in the background?" gets you actionable feedback. Your instructor has noted your growing self-awareness about your own work.',
      question: 'Before sharing: what do YOU think is strongest and weakest about this piece? Lead with that — it shows self-critique skill.',
    },
    network: [
      { name: 'Sophie T.', role: 'Watercolorist', tip: 'I photograph my work in progress at 3 stages and share all three. It helps the instructor see your process, not just the result.' },
    ],
    history: {
      summary: '4 shares with instructor • Feedback on edges, values, composition',
      detail: 'Last feedback focused on pushing value contrast further. Instructor noted your composition sense is strong.',
    },
  },

  instructor_feedback: {
    notesPrompt: 'What feedback did you receive? What specific areas were highlighted for improvement? What was praised?',
    aiCoach: {
      title: 'Feedback Is Fuel',
      body: 'The students who improve fastest aren\'t the most talented — they\'re the ones who seek, absorb, and act on feedback. Write down what your instructor said while it\'s fresh. Then pick ONE thing to focus on next session.',
      question: 'What was the single most actionable piece of feedback? How will you apply it in your next session?',
    },
    network: [
      { name: 'Lucas R.', role: 'Portrait artist', tip: 'I keep a "feedback log" — date, what was said, and whether I addressed it in the next session. It creates accountability.' },
    ],
    history: {
      summary: '3 feedback entries • Improving on specific critique points',
      detail: 'You\'ve been good at implementing feedback on values. The edge control feedback from last time showed improvement in this session.',
    },
  },

  portfolio_tag: {
    richContent: true,
    notesPrompt: 'Is this piece portfolio-worthy? What category does it fit? What does it demonstrate about your skills?',
    aiCoach: {
      title: 'Curate Your Growth',
      body: 'A portfolio isn\'t a collection of everything you\'ve done — it\'s a curated story of your best work and growth. Tag pieces that show your strongest skills AND pieces that show the biggest improvement. Both tell a compelling story.',
      question: 'If someone saw only this piece, what would they know about your abilities?',
    },
    network: [
      { name: 'Maya P.', role: 'Digital illustrator', tip: 'I tag pieces as "showcase" (best work) or "growth" (biggest improvement). A portfolio needs both to tell your story.' },
    ],
    history: {
      summary: '6 pieces tagged • Portraits, landscapes, studies',
      detail: 'Your portfolio shows strongest work in portraiture. Landscape pieces are improving and may be ready for inclusion.',
    },
  },

  timer: {
    notesPrompt: 'Track your time. How long did each phase take? Did you stick to your plan?',
    aiCoach: {
      title: 'Measure Your Practice',
      body: 'Tracking time isn\'t about pressure — it\'s about awareness. Knowing you spent 40 minutes on the underpainting and 20 on details tells you where your attention goes. Over time, patterns emerge that help you work more efficiently.',
      question: 'Was your time split today intentional, or did you lose track? Awareness is the first step to control.',
    },
    network: [
      { name: 'Kenji T.', role: 'Urban sketcher', tip: 'I set a gentle alarm at the halfway point. It\'s amazing how often I\'m still on the first stage when it goes off — it keeps me moving.' },
    ],
    history: {
      summary: 'Avg session time: 65 min • Tracking consistently',
      detail: 'Your time awareness has improved. You\'re spending more proportional time on initial planning stages.',
    },
  },
};
