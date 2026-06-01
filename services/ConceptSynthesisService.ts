/**
 * ConceptSynthesisService
 *
 * Phase 6 uses a light-weight synthesis draft for concept detail. Until the
 * dedicated AI endpoint lands, this service composes a readable first-pass
 * synthesis from the concept body and any trail quotes already attached.
 */

export interface ConceptSynthesisDraftInput {
  title: string;
  body: string;
  quotes: string[];
}

export function draftConceptSynthesis({
  title,
  body,
  quotes,
}: ConceptSynthesisDraftInput): string {
  const cleanBody = body.trim();
  const firstQuote = quotes.find((quote) => quote.trim().length > 0)?.trim();

  const sentences: string[] = [];
  if (cleanBody) {
    sentences.push(cleanBody);
  } else {
    sentences.push(`"${title}" is still taking shape in your own words.`);
  }

  if (firstQuote) {
    sentences.push(`Right now it shows up most clearly in the line: “${firstQuote}”`);
  } else {
    sentences.push('As you test it in more steps, the trail of moments below will turn this into a clearer working idea.');
  }

  return sentences.join('\n\n');
}
