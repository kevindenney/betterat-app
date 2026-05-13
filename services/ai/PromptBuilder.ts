import { EventContext, RaceContext, ClubSummary } from './ContextResolvers';

export function buildEventDocumentPrompt(
  context: EventContext,
  clubSummary?: ClubSummary,
  documentType: 'nor' | 'si' | 'amendment' = 'nor'
) {
  const event = context.event;
  const club = clubSummary ?? { name: context.club?.club_name ?? 'the club' };

  const previous = context.previousDocuments
    .map(doc => `- ${doc.document_type.toUpperCase()} (created ${doc.created_at})`)
    .join('\n') || 'None';

  return {
    system: `You are Claude, assisting a sailing club with race documentation.
Use a professional, concise tone. Always produce valid Markdown with clear headings.`,
    messages: [
      {
        role: 'user' as const,
        content: [
          `Club: ${club.name}`,
          `Event: ${event.title}`,
          `Dates: ${event.start_date} – ${event.end_date}`,
          `Location: ${event.location_name ?? 'TBD'}`,
          `Document type: ${documentType.toUpperCase()}`,
          `Previous AI documents:\n${previous}`,
          documentType === 'nor'
            ? 'Include a section for eligibility, schedule of races, fees, and communications.'
            : documentType === 'si'
            ? 'Provide marks, courses, penalties, scoring, and safety instructions.'
            : 'Describe the amendment clearly with change tracking and effective time.',
        ].join('\n\n'),
      },
    ],
  };
}

export function buildRaceCommsPrompt(context: RaceContext, updateType: string) {
  const preparationContext = context.preparation
    ? [
        '\n--- Sailor Preparation Context ---',
        context.preparation.raceBrief
          ? `Race Brief: ${context.preparation.raceBrief.name} (${context.preparation.raceBrief.series})`
          : '',
        context.preparation.raceBrief?.weatherSummary
          ? `Forecasted conditions: ${context.preparation.raceBrief.weatherSummary}`
          : '',
        context.preparation.raceBrief?.tideSummary
          ? `Tide: ${context.preparation.raceBrief.tideSummary}`
          : '',
        context.preparation.rigNotes
          ? `Sailor's rig notes: ${context.preparation.rigNotes}`
          : '',
        context.preparation.acknowledgements
          ? `Acknowledgements: ${JSON.stringify(context.preparation.acknowledgements)}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return {
    system: `You draft concise race committee communications.
Output short paragraphs labelled for SMS, Email, and Notice Board.
Add urgency rating (low/medium/high).
When sailor preparation context is available, use it to provide more personalized and relevant communications.`,
    messages: [
      {
        role: 'user' as const,
        content: [
          `Race: ${context.race.name ?? context.race.id}`,
          `Scheduled start: ${context.race.start_time ?? 'TBD'}`,
          context.regatta ? `Regatta: ${context.regatta.title}` : '',
          `Update type: ${updateType}`,
          context.weather ? `Weather: ${JSON.stringify(context.weather)}` : '',
          preparationContext,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  };
}

export function buildSupportPrompt(club: ClubSummary, conversationHistory: { role: 'user' | 'assistant'; message: string }[], newQuestion: string) {
  const history = conversationHistory
    .slice(-6)
    .map(entry => `${entry.role === 'user' ? 'Member' : 'Assistant'}: ${entry.message}`)
    .join('\n');

  return {
    system: `You help members of ${club.name}. Provide accurate, polite answers.
If unsure, ask to contact the club office. End with a suggested next action.`,
    messages: [
      {
        role: 'user' as const,
        content: [history, `Member: ${newQuestion}`].filter(Boolean).join('\n'),
      },
    ],
  };
}

export function buildDailySummaryPrompt(club: ClubSummary, stats: Record<string, any>) {
  return {
    system: `Generate a daily operations summary for the sailing club.
Highlight registrations, payments, comms, and upcoming deadlines. Keep under 250 words.`,
    messages: [
      {
        role: 'user' as const,
        content: JSON.stringify({
          club: club.name,
          timezone: club.timezone,
          stats,
        }),
      },
    ],
  };
}

