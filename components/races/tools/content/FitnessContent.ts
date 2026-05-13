/**
 * MODULE_CONTENT entries for Fitness interest modules.
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

export const FITNESS_MODULE_CONTENT: Record<string, ModuleContent> = {
  workout_plan: {
    tool: 'workout_plan',
    notesPrompt: 'What exercises are you doing today? Sets, reps, weight targets? What\'s the focus — strength, hypertrophy, endurance?',
    aiCoach: {
      title: 'Train With a Plan',
      body: 'Walking into the gym without a plan is like driving without a destination. You\'ll move, but you won\'t get anywhere specific. Your last squat session hit a PR at 225 — today, ride that momentum. Progressive overload is about small, consistent increases.',
      question: 'What\'s the ONE lift you\'re prioritizing today? Everything else supports that movement.',
    },
    network: [
      { name: 'Alex T.', role: 'Powerlifter', tip: 'I write my workout on a note card and bring it to the gym. Phone workout apps are fine, but I always get distracted by notifications.' },
      { name: 'Jordan K.', role: 'Runner', tip: 'For compound lifts, I write down my working weight the night before. No decision fatigue at the rack — just load and go.' },
    ],
    history: {
      summary: '48 workouts logged • Squat PR: 225lb • Bench PR: 185lb',
      detail: 'You\'ve been consistent with 4x/week training. Upper body strength is progressing well. Lower body recovery has been an area of focus.',
    },
  },

  warmup: {
    tool: 'warmup',
    notesPrompt: 'How will you warm up? Mobility work, activation drills, warm-up sets — what does your body need today?',
    aiCoach: {
      title: 'Earn Your First Working Set',
      body: 'A proper warm-up isn\'t optional — it\'s what separates training from gambling with your joints. 10 minutes of targeted mobility and activation can double your performance and halve your injury risk. Your hip mobility has been improving since you added 90/90 stretches.',
      question: 'Where do you feel tightest right now? That\'s where your warm-up should focus.',
    },
    network: [
      { name: 'Mia C.', role: 'Yoga/Mobility', tip: 'I spend 5 minutes on foam rolling whatever feels stiffest, then 3 minutes of targeted mobility for today\'s main lift pattern.' },
      { name: 'Chris H.', role: 'Olympic lifter', tip: 'Never skip warm-up sets. I do empty bar × 10, then 50% × 5, 70% × 3, 85% × 1 before my working weight. It locks in the movement pattern.' },
    ],
    history: {
      summary: 'Warming up consistently • Hip mobility improved 15%',
      detail: 'Since adding dedicated mobility work, your squat depth has improved and you\'ve reported less knee discomfort.',
    },
  },

  nutrition: {
    tool: 'nutrition',
    notesPrompt: 'What did you eat pre-workout? Hydration status? Any supplements? What\'s your post-workout nutrition plan?',
    aiCoach: {
      title: 'Fuel the Machine',
      body: 'You can\'t out-train a bad diet, and you can\'t perform on an empty tank. Pre-workout nutrition should give you energy without weighing you down. Post-workout is your recovery window. Your consistent protein intake has been showing in your recovery times.',
      question: 'Did you eat 2-3 hours before training? If not, how will that affect your session, and what\'s your plan?',
    },
    network: [
      { name: 'Ryan O.', role: 'Calisthenics', tip: 'I keep it simple: banana + coffee 45 min before, protein shake + fruit within 30 min after. Don\'t overthink it.' },
      { name: 'Sofia M.', role: 'CrossFit', tip: 'Track your water intake on training days. I aim for 20oz before I even walk into the gym. Dehydration kills performance before you feel thirsty.' },
    ],
    history: {
      summary: 'Protein target: 160g/day • Hydration: improving',
      detail: 'You\'ve been hitting protein targets consistently. Pre-workout meal timing has been more reliable the past 2 weeks.',
    },
  },

  goals: {
    notesPrompt: 'What are you working toward today? What\'s your specific target — weight, reps, time, or technique improvement?',
    aiCoach: {
      title: 'Outcome + Process',
      body: 'Great goals have two parts: the outcome (what you want to achieve) and the process (how you\'ll get there today). "Squat 250" is an outcome. "Focus on bracing and staying upright out of the hole" is the process that gets you there.',
      question: 'What\'s one thing you can do better today than last session? Be specific.',
    },
    network: [
      { name: 'Alex T.', role: 'Powerlifter', tip: 'I set one performance goal and one technique goal per session. Even if I miss the weight, nailing the technique is still a win.' },
    ],
    history: {
      summary: '4 goals set this week • 3 achieved',
      detail: 'You\'ve been setting realistic, progressive goals. Your deadlift technique goal last session (neutral spine at heavy loads) was a great focus area.',
    },
  },

  previous_session: {
    notesPrompt: 'Review your last workout. What went well? What needs improvement? How does that inform today?',
    aiCoach: {
      title: 'Learn From Last Time',
      body: 'Your training log is a goldmine of data. Last session\'s notes said your bench press felt heavy at the top — that\'s a lockout weakness. Today, you could add board presses or heavy tricep work to address it. Training smart means connecting the dots between sessions.',
      question: 'Look at your last session. Is there a cue or correction from last time that you should carry into today?',
    },
    network: [
      { name: 'Jordan K.', role: 'Runner', tip: 'I re-read my last session notes in the car before walking in. 2 minutes of review prevents repeating the same mistakes.' },
    ],
    history: {
      summary: 'Last session: Upper body push • RPE 7-8',
      detail: 'Bench press felt strong at 175×5. Overhead press was slightly fatigued. Noted right shoulder tightness in last set.',
    },
  },

  body_status: {
    tool: 'body_status',
    notesPrompt: 'How does your body feel today? Energy level, soreness, sleep quality, any niggles or injuries?',
    aiCoach: {
      title: 'Listen to Your Body',
      body: 'Your body gives you signals every day. Ignoring them doesn\'t make you tough — it makes you injured. A planned deload day when you\'re beat up is smarter than an unplanned month off with a pulled muscle. Today\'s self-assessment: be honest.',
      question: 'On a 1-10 scale, how ready are you to train hard today? If it\'s below 6, consider adjusting your plan.',
    },
    network: [
      { name: 'Mia C.', role: 'Yoga/Mobility', tip: 'I do a 30-second body scan every morning before training. Stand still, close your eyes, and notice what hurts, what\'s tight, what feels good.' },
      { name: 'Chris H.', role: 'Olympic lifter', tip: 'If sleep was bad, I auto-reduce my working weights by 10%. The math works: 90% of your best with good form beats 100% with bad form every time.' },
    ],
    history: {
      summary: 'Avg sleep: 7.2h • Energy trending up • Right shoulder monitored',
      detail: 'Your sleep consistency has improved. The right shoulder tightness is manageable with targeted warm-up. No acute injuries.',
    },
    alert: {
      title: 'Recovery Check',
      body: 'If you trained heavy yesterday and slept poorly, today might be a technique day or active recovery. Adjust the plan to match your readiness.',
    },
  },

  program_context: {
    notesPrompt: 'Where are you in your program? What week/phase? Are you in accumulation, intensification, or deload?',
    aiCoach: {
      title: 'Zoom Out',
      body: 'Today\'s workout matters, but it matters most in the context of your overall program. You\'re in week 3 of a 4-week block — this is where the volume peaks before you deload. Trust the process. The gains happen during recovery.',
      question: 'How does today\'s session fit into this week\'s overall training plan?',
    },
    network: [
      { name: 'Alex T.', role: 'Powerlifter', tip: 'I plan in 4-week blocks: 3 weeks building, 1 week deload. Every 12 weeks, I test maxes. Having a macro view prevents random training.' },
    ],
    history: {
      summary: 'Program: 5/3/1 variant • Week 3 of 4 • Strength phase',
      detail: 'You\'ve been following the program consistently. Compliance has been your strongest attribute this training cycle.',
    },
  },

  conditions: {
    notesPrompt: 'Training conditions today: gym or outdoor? Temperature? Equipment availability? Anything affecting your session?',
    aiCoach: {
      title: 'Adapt to Your Environment',
      body: 'The best athletes adapt their training to conditions, not the other way around. Crowded gym? Have a backup exercise order. Training outside in heat? Hydrate extra and monitor intensity. Your ability to adjust on the fly is a skill worth developing.',
      question: 'Is anything about today\'s environment different from your usual? How will you adapt?',
    },
    network: [
      { name: 'Sofia M.', role: 'CrossFit', tip: 'I always have a Plan B exercise for every lift in case the rack is taken. Dumbbell bench instead of barbell. Lunges instead of leg press.' },
    ],
    history: {
      summary: 'Trains at gym 4x/week • Outdoor runs 2x/week',
      detail: 'You\'ve been good at adapting when equipment is unavailable. Last week you subbed goblet squats when racks were full — good adaptation.',
    },
  },

  share_with_coach: {
    richContent: true,
    notesPrompt: 'What do you want your coach to see? Progress updates, form questions, program adjustments?',
    aiCoach: {
      title: 'Coach Communication',
      body: 'Your coach can only help with what they know. Share your wins, your struggles, and your honest RPE ratings. A good coach adjusts the program based on real data, not guesses. The more transparent you are, the better your programming gets.',
      question: 'What\'s one thing about your training this week that your coach should know?',
    },
    network: [
      { name: 'Chris H.', role: 'Olympic lifter', tip: 'I film my heaviest set of each main lift and send it to my coach. Video tells the truth — you can\'t fake form on camera.' },
    ],
    history: {
      summary: '3 coach check-ins this month • Program adjustments made',
      detail: 'Your coach reduced squat volume based on your recovery feedback. This led to better session quality.',
    },
  },

  recovery_status: {
    notesPrompt: 'How are you recovering? Sleep, soreness, mood, appetite, grip strength? Any signs of overtraining?',
    aiCoach: {
      title: 'Recovery Is Where You Grow',
      body: 'Training tears you down. Recovery builds you up. If you\'re not recovering well, more training isn\'t the answer — better recovery is. Track your sleep, manage stress, and eat enough. The athletes who recover best progress fastest.',
      question: 'Rate your recovery from last session: 1 (still wrecked) to 10 (completely fresh). What helped or hurt?',
    },
    network: [
      { name: 'Mia C.', role: 'Yoga/Mobility', tip: 'My top recovery tools ranked: 1) Sleep, 2) Nutrition, 3) Walking, 4) Foam rolling. Everything else is marginal compared to those four.' },
      { name: 'Ryan O.', role: 'Calisthenics', tip: 'If my grip strength is noticeably weaker when I wake up, I know my CNS is still fried. I take that as a sign to go easy.' },
    ],
    history: {
      summary: 'Recovery score trending: 7.5/10 avg • Sleep: 7.2h avg',
      detail: 'Recovery has improved since adding a dedicated mobility day on Wednesdays. DOMS duration has decreased.',
    },
  },

  post_nutrition: {
    notesPrompt: 'What did you eat/drink post-workout? Did you hit your protein window? Hydration status?',
    aiCoach: {
      title: 'The Recovery Window',
      body: 'The "anabolic window" isn\'t as narrow as bro-science suggests, but getting quality protein and carbs within 2 hours of training does optimize recovery. Your consistent post-workout shakes have been supporting your progress well.',
      question: 'Did you get 30-40g protein within 2 hours? What was your post-workout meal?',
    },
    network: [
      { name: 'Jordan K.', role: 'Runner', tip: 'After long runs I need carbs more than protein. After lifting, protein is king. Match your post-workout nutrition to the type of session.' },
    ],
    history: {
      summary: 'Post-workout protein: 85% compliance • Avg 35g within 1 hour',
      detail: 'Your protein timing has been consistent. Consider adding more carbs post-workout on heavy leg days for glycogen replenishment.',
    },
  },

  program_adjustments: {
    notesPrompt: 'Any changes needed to your program based on today\'s performance? What should be adjusted for next session?',
    aiCoach: {
      title: 'Adapt and Progress',
      body: 'No program survives contact with reality unchanged. The best lifters make small adjustments session to session based on how they feel and perform. Missed reps? Drop 5% and rebuild. Crushed it? Add 5lbs next time. Autoregulation is a skill.',
      question: 'Based on today\'s session, what one adjustment will you make for next time?',
    },
    network: [
      { name: 'Alex T.', role: 'Powerlifter', tip: 'I adjust volume before intensity. If I\'m struggling, I cut a set before I cut weight. Keeps the neural adaptation while managing fatigue.' },
    ],
    history: {
      summary: '3 adjustments this cycle • All progressive',
      detail: 'You increased bench press working weight by 5lb based on last week\'s RPE being consistently below target. Good self-regulation.',
    },
  },

  results_preview: {
    notesPrompt: 'What were your key numbers today? PRs, working weights, times, distances? How did it compare to your plan?',
    aiCoach: {
      title: 'Data Drives Progress',
      body: 'You can\'t improve what you don\'t measure. Log your key numbers — even on bad days. A "bad" day that\'s logged is infinitely more valuable than a "good" day you forgot. Your training data tells a story of consistent progress.',
      question: 'What was your top set today? How did it compare to your target?',
    },
    network: [
      { name: 'Sofia M.', role: 'CrossFit', tip: 'I rate every session 1-10 for effort and 1-10 for execution. High effort + low execution = fatigue. Low effort + high execution = peak form.' },
    ],
    history: {
      summary: '48 sessions logged • Steady progressive overload',
      detail: 'Your squat has increased 20lb over 8 weeks. Bench press is progressing at ~2.5lb/week. Deadlift PR attempt upcoming.',
    },
  },
};
