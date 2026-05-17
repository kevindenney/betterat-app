/**
 * SuggestionsService — combines blueprint / follow / mentor suggestion sources
 * into a ranked, capped list for the Plan tab's <SuggestionsRow>.
 *
 * Phase 1 · iOS register · D12a. The service is a pure ranker — callers fetch
 * each source independently (different hooks, different query keys) and pass
 * the raw inputs in. The service merges, ranks, and caps the result.
 *
 * v1 scope: blueprint + follow channels are typed but expected empty until
 * the dedicated hooks (useFollowsRecentSteps and a "next-recommended-step"
 * derivation on useSubscribedBlueprints) are plumbed. Mentor channel maps
 * directly from useCrossInterestSuggestions output. The row hides cleanly
 * when the merged list is empty.
 *
 * Ranking: recency-first within each source, then interleaved round-robin
 * (blueprint > follow > mentor) so any one source can't crowd the list.
 * Capped at 3.
 */

import type { SuggestionKind, SuggestionRowItem } from '@/components/step/plan-tab';

export interface BlueprintSuggestionInput {
  id: string;
  title: string;
  byline: string;
  /** Caller's "this is a blueprint you follow" relationship phrase. */
  relationship?: string;
  /** Recency hint — higher = newer. */
  recency?: number;
  onPress: () => void;
}

export interface FollowSuggestionInput {
  id: string;
  title: string;
  byline: string;
  relationship?: string;
  recency?: number;
  onPress: () => void;
}

export interface MentorSuggestionInput {
  id: string;
  title: string;
  byline?: string;
  recency?: number;
  onPress: () => void;
}

export interface BuildSuggestionsInput {
  blueprints?: BlueprintSuggestionInput[];
  follows?: FollowSuggestionInput[];
  mentor?: MentorSuggestionInput[];
  /** Cap on returned items. Defaults to 3 per D12a. */
  limit?: number;
}

function byRecencyDesc<T extends { recency?: number }>(a: T, b: T): number {
  return (b.recency ?? 0) - (a.recency ?? 0);
}

function toRowItem(
  kind: SuggestionKind,
  item: { id: string; title: string; byline?: string; relationship?: string; onPress: () => void },
): SuggestionRowItem {
  const subtitle = [item.byline, item.relationship].filter(Boolean).join(' · ');
  return {
    id: `${kind}:${item.id}`,
    kind,
    title: item.title,
    subtitle: subtitle || (kind === 'mentor' ? 'AI Coach · mentor' : ''),
    onPress: item.onPress,
  };
}

export function buildSuggestions({
  blueprints = [],
  follows = [],
  mentor = [],
  limit = 3,
}: BuildSuggestionsInput): SuggestionRowItem[] {
  const blueprintRows = [...blueprints]
    .sort(byRecencyDesc)
    .map((b) => toRowItem('blueprint', b));
  const followRows = [...follows]
    .sort(byRecencyDesc)
    .map((f) => toRowItem('follow', f));
  const mentorRows = [...mentor]
    .sort(byRecencyDesc)
    .map((m) =>
      toRowItem('mentor', {
        ...m,
        byline: m.byline ?? 'AI Coach',
        relationship: 'mentor',
      }),
    );

  const result: SuggestionRowItem[] = [];
  let bi = 0;
  let fi = 0;
  let mi = 0;
  while (result.length < limit) {
    const before = result.length;
    if (bi < blueprintRows.length) result.push(blueprintRows[bi++]);
    if (result.length >= limit) break;
    if (fi < followRows.length) result.push(followRows[fi++]);
    if (result.length >= limit) break;
    if (mi < mentorRows.length) result.push(mentorRows[mi++]);
    if (result.length === before) break;
  }
  return result;
}

/**
 * Convenience helper to convert raw cross-interest AI suggestions into the
 * mentor-channel input for <SuggestionsRow>. Pass the result of
 * useCrossInterestSuggestions's `.suggestions` array straight through.
 */
export function crossInterestToMentorInput<T extends {
  suggestion: string;
  sourceInterestName?: string;
}>(
  suggestions: T[],
  onSelect: (s: T) => void,
): MentorSuggestionInput[] {
  return suggestions.map((s, idx) => ({
    id: `xi-${idx}`,
    title: s.suggestion.length > 64 ? `${s.suggestion.slice(0, 64)}…` : s.suggestion,
    byline: s.sourceInterestName ? `From ${s.sourceInterestName}` : 'AI Coach',
    recency: suggestions.length - idx,
    onPress: () => onSelect(s),
  }));
}
