import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OnDeckBanner } from '@/components/timelines';
import type { Phase6ConceptRecord } from '@/services/PlaybookService';
import type {
  PlaybookConceptLifecycleState,
  PlaybookInsightRecord,
} from '@/types/playbook';
import { fontFamily } from '@/lib/design-tokens-editorial';

// ── palette (matches the concepts-redesign mock) ────────────────────
const ACCENT = '#7C4DFF';
const ACCENT_SOFT = '#F1ECFF';
const ACCENT_INK = '#4A2FB0';
const GOLD = '#FF9500';
const GOLD_SOFT = '#FFF4E5';
const GREEN_INK = '#1E8E3E';
const GREEN_SOFT = '#E3F7E8';
const LABEL = '#1C1C1E';
const MUTED = 'rgba(60,60,67,0.6)';
const MUTED_2 = 'rgba(60,60,67,0.45)';
const FAINT = 'rgba(60,60,67,0.3)';
const SEP = 'rgba(60,60,67,0.16)';
const SEP_SOFT = 'rgba(60,60,67,0.09)';

/** How many steps a concept needs to advance to the next lifecycle stage. */
const ADVANCE_THRESHOLD = 3;

type UIState = 'forming' | 'testing' | 'settled';

/** Collapse the 4-state model (seed/forming/testing/settled) onto the
 *  3 the surface speaks. `seed` and the legacy forming-with-tension read
 *  as "forming" here. */
function uiState(state: PlaybookConceptLifecycleState | undefined): UIState {
  if (state === 'settled') return 'settled';
  if (state === 'testing') return 'testing';
  return 'forming';
}

export interface PlaybookLandingProps {
  insights: PlaybookInsightRecord[];
  concepts: Phase6ConceptRecord[];
  onRefineInsight: (insightId: string) => void;
  onDiscardInsight: (insightId: string) => void;
  onOpenConcept: (conceptId: string) => void;
  /** Inline card action — open the concept's detail with the step picker armed. */
  onLinkConcept?: (conceptId: string) => void;
  /** Inline card action — open the concept's detail with the editor armed. */
  onEditConcept?: (conceptId: string) => void;
  /** Capture rail action — drop a raw thought into the inbox. */
  onCapture?: () => void;
  hideHero?: boolean;
  librarianStrip?: React.ReactNode;
  librarianNoticed?: React.ReactNode;
}

export function PlaybookLanding({
  insights,
  concepts,
  onRefineInsight,
  onDiscardInsight,
  onOpenConcept,
  onLinkConcept,
  onEditConcept,
  onCapture,
  hideHero = false,
  librarianStrip,
  librarianNoticed,
}: PlaybookLandingProps) {
  const inDevelopment = concepts.filter((c) => uiState(c.state) !== 'settled');
  const settled = concepts.filter((c) => uiState(c.state) === 'settled');

  const formingCount = concepts.filter((c) => uiState(c.state) === 'forming').length;
  const testingCount = concepts.filter((c) => uiState(c.state) === 'testing').length;
  const settledCount = settled.length;

  const link = onLinkConcept ?? onOpenConcept;
  const edit = onEditConcept ?? onOpenConcept;

  return (
    <View style={styles.wrap}>
      {hideHero ? null : (
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Concepts</Text>
          <Text style={styles.heroSub}>
            Mental models you're forming, refining, or have settled. Each gets
            sharper as you test it in real steps.
          </Text>
        </View>
      )}

      {librarianStrip}

      {/* lifecycle pipeline */}
      <View style={styles.pipe}>
        <PipeCol kind="forming" label="Forming" n={formingCount} />
        <Ionicons name="chevron-forward" size={14} color={FAINT} style={styles.pipeArrow} />
        <PipeCol kind="testing" label="Testing" n={testingCount} />
        <Ionicons name="chevron-forward" size={14} color={FAINT} style={styles.pipeArrow} />
        <PipeCol kind="settled" label="Settled" n={settledCount} />
      </View>

      <OnDeckBanner />

      {librarianNoticed}

      {/* recent insights rail */}
      <View style={styles.section}>
        <View style={styles.secHead}>
          <Text style={styles.secTitle}>Recent insights</Text>
          {onCapture ? (
            <Pressable onPress={onCapture} hitSlop={8}>
              <Text style={styles.secMore}>Capture +</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.secSub}>
          Raw captures waiting to become concepts — one tap turns one into a
          forming idea.
        </Text>
        {insights.length === 0 && !onCapture ? (
          <Text style={styles.empty}>
            No recent insights. Drop a thought from the universal + to start the loop.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {insights.map((insight) => (
              <View key={insight.id} style={styles.insight}>
                <Text style={styles.insightCap}>Raw capture</Text>
                <Text style={styles.insightQ} numberOfLines={3}>
                  {insight.content}
                </Text>
                <View style={styles.insightActions}>
                  <Pressable
                    onPress={() => onRefineInsight(insight.id)}
                    style={styles.insightMake}
                    hitSlop={6}
                  >
                    <Ionicons name="sparkles" size={13} color={ACCENT} />
                    <Text style={styles.insightMakeText}>Make a concept</Text>
                  </Pressable>
                  <Pressable onPress={() => onDiscardInsight(insight.id)} hitSlop={8}>
                    <Ionicons name="close" size={15} color={MUTED_2} />
                  </Pressable>
                </View>
              </View>
            ))}
            {onCapture ? (
              <Pressable
                onPress={onCapture}
                style={[styles.insight, styles.insightAdd]}
              >
                <View style={styles.insightAddPlus}>
                  <Ionicons name="add" size={18} color={ACCENT} />
                </View>
                <Text style={styles.insightAddText}>Capture a thought</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </View>

      {/* in development */}
      <View style={styles.section}>
        <View style={styles.secHead}>
          <Text style={styles.secTitle}>In development</Text>
          <Text style={styles.secCount}>{inDevelopment.length}</Text>
        </View>
        <Text style={styles.secSub}>
          Forming and testing ideas. Link them to steps to build evidence.
        </Text>
        {inDevelopment.length === 0 ? (
          <Text style={styles.empty}>No concepts in development yet.</Text>
        ) : (
          <View style={styles.cards}>
            {inDevelopment.map((concept) => (
              <DevCard
                key={concept.id}
                concept={concept}
                onPress={() => onOpenConcept(concept.id)}
                onLink={() => link(concept.id)}
                onEdit={() => edit(concept.id)}
              />
            ))}
          </View>
        )}
      </View>

      {/* settled foundations */}
      <View style={styles.section}>
        <View style={styles.secHead}>
          <Text style={styles.secTitle}>Settled foundations</Text>
        </View>
        <Text style={styles.secSub}>
          Tested ideas that now carry weight — they quietly back the steps you take.
        </Text>
        {settled.length === 0 ? (
          <Text style={styles.empty}>
            Nothing settled yet — concepts arrive here once they've held up across
            three tested steps.
          </Text>
        ) : (
          <View style={styles.cards}>
            {settled.map((concept) => (
              <FoundationRow
                key={concept.id}
                concept={concept}
                onPress={() => onOpenConcept(concept.id)}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function PipeCol({
  kind,
  label,
  n,
}: {
  kind: UIState;
  label: string;
  n: number;
}) {
  const dotColor = kind === 'forming' ? GOLD : kind === 'testing' ? ACCENT : GREEN_INK;
  return (
    <View style={styles.pipeCol}>
      <View style={styles.pipeK}>
        <View style={[styles.pipeDot, { backgroundColor: dotColor }]} />
        <Text style={styles.pipeKText}>{label}</Text>
      </View>
      <Text style={styles.pipeN}>{n}</Text>
      <Text style={styles.pipeLab}>{n === 1 ? 'concept' : 'concepts'}</Text>
    </View>
  );
}

function maturity(concept: Phase6ConceptRecord): {
  goal: string;
  goalSettled: boolean;
  pct: number;
} {
  const s = uiState(concept.state);
  if (s === 'forming') {
    const have = concept.linked_step_count ?? 0;
    const pct = Math.min(1, have / ADVANCE_THRESHOLD);
    return {
      goal: `Link ${ADVANCE_THRESHOLD} steps to start testing`,
      goalSettled: false,
      pct: Math.max(0.08, pct),
    };
  }
  const have = concept.evidence_step_count ?? 0;
  const remaining = Math.max(0, ADVANCE_THRESHOLD - have);
  return {
    goal:
      remaining === 0
        ? 'Ready to settle'
        : `${remaining} more tested step${remaining === 1 ? '' : 's'} to settle`,
    goalSettled: false,
    pct: Math.min(1, have / ADVANCE_THRESHOLD),
  };
}

function DevCard({
  concept,
  onPress,
  onLink,
  onEdit,
}: {
  concept: Phase6ConceptRecord;
  onPress: () => void;
  onLink: () => void;
  onEdit: () => void;
}) {
  const s = uiState(concept.state);
  const m = maturity(concept);
  const syn = (concept.ai_synthesis_text ?? concept.body_md ?? '').trim();
  const stateColor = s === 'forming' ? GOLD : ACCENT;
  const stateBg = s === 'forming' ? GOLD_SOFT : ACCENT_SOFT;
  const stateInk = s === 'forming' ? GOLD : ACCENT_INK;

  return (
    <Pressable onPress={onPress} style={styles.ccard}>
      <View style={styles.ccardTop}>
        <View style={[styles.stateChip, { backgroundColor: stateBg }]}>
          <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
          <Text style={[styles.stateText, { color: stateInk }]}>{s}</Text>
        </View>
      </View>

      <Text style={styles.ccardTitle}>{concept.title}</Text>
      {syn ? (
        <Text style={styles.ccardSyn} numberOfLines={2}>
          {syn}
        </Text>
      ) : null}

      <View style={styles.mat}>
        <View style={styles.matTrack}>
          <View style={[styles.matFill, { width: `${Math.round(m.pct * 100)}%` }]} />
        </View>
        <View style={styles.matCap}>
          <Text style={styles.matGoal}>{m.goal}</Text>
          <View style={styles.metrics}>
            <Metric n={concept.linked_step_count ?? 0} icon="footsteps-outline" />
            <Metric n={concept.quote_count ?? 0} icon="chatbubble-ellipses-outline" />
            <Metric n={concept.capability_count ?? 0} icon="layers-outline" />
          </View>
        </View>
      </View>

      <View style={styles.inlineCta}>
        {s === 'forming' ? (
          <>
            <Pressable onPress={onLink} style={[styles.chipBtn, styles.chipPrimary]}>
              <Ionicons name="link" size={13} color="#fff" />
              <Text style={styles.chipPrimaryText}>Link a step</Text>
            </Pressable>
            <Pressable onPress={onEdit} style={[styles.chipBtn, styles.chipGhost]}>
              <Ionicons name="create-outline" size={13} color="#3C3C43" />
              <Text style={styles.chipGhostText}>Edit</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={onLink} style={[styles.chipBtn, styles.chipSoft]}>
            <Ionicons name="link" size={13} color={ACCENT_INK} />
            <Text style={styles.chipSoftText}>Link another</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function Metric({ n, icon }: { n: number; icon: keyof typeof Ionicons.glyphMap }) {
  const zero = n === 0;
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={12} color={zero ? FAINT : MUTED_2} />
      <Text style={[styles.metricText, zero && styles.metricZero]}>{n}</Text>
    </View>
  );
}

function FoundationRow({
  concept,
  onPress,
}: {
  concept: Phase6ConceptRecord;
  onPress: () => void;
}) {
  const backs = concept.evidence_step_count ?? concept.linked_step_count ?? 0;
  return (
    <Pressable onPress={onPress} style={styles.found}>
      <View style={styles.seal}>
        <Ionicons name="ribbon-outline" size={20} color={GREEN_INK} />
      </View>
      <View style={styles.foundBody}>
        <Text style={styles.foundTitle}>{concept.title}</Text>
        <Text style={styles.foundSub}>
          {backs > 0 ? `Backs ${backs} step${backs === 1 ? '' : 's'}` : 'Settled foundation'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={FAINT} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
    padding: 16,
    paddingBottom: 96,
  },
  hero: {
    gap: 4,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: LABEL,
  },
  heroSub: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '500',
  },

  // pipeline
  pipe: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipeCol: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 11,
  },
  pipeArrow: {
    marginHorizontal: -7,
    zIndex: 2,
  },
  pipeK: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pipeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pipeKText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MUTED,
  },
  pipeN: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: LABEL,
    marginTop: 4,
  },
  pipeLab: {
    fontSize: 11.5,
    color: MUTED_2,
    fontWeight: '600',
    marginTop: -1,
  },

  // sections
  section: {
    gap: 6,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  secTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: LABEL,
  },
  secMore: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  secCount: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  secSub: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
    marginBottom: 6,
  },
  empty: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
    textAlign: 'center',
  },

  // insights rail
  rail: {
    gap: 10,
    paddingRight: 4,
  },
  insight: {
    width: 208,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    borderRadius: 14,
    padding: 13,
    gap: 9,
  },
  insightCap: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: MUTED_2,
  },
  insightQ: {
    fontSize: 13.5,
    color: '#3C3C43',
    fontWeight: '500',
    lineHeight: 19,
    minHeight: 57,
  },
  insightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insightMake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightMakeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ACCENT,
  },
  insightAdd: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    gap: 6,
  },
  insightAddPlus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightAddText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: MUTED,
  },

  // concept cards
  cards: {
    gap: 11,
  },
  ccard: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
  },
  ccardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ccardTitle: {
    fontSize: 21,
    lineHeight: 25,
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    color: LABEL,
    marginBottom: 5,
  },
  ccardSyn: {
    fontSize: 13.5,
    color: MUTED,
    fontWeight: '500',
    lineHeight: 19,
  },
  mat: {
    marginTop: 12,
  },
  matTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: SEP_SOFT,
    overflow: 'hidden',
  },
  matFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 999,
  },
  matCap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  matGoal: {
    fontSize: 11.5,
    fontWeight: '600',
    color: ACCENT_INK,
    flexShrink: 1,
  },
  metrics: {
    flexDirection: 'row',
    gap: 11,
    marginLeft: 8,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: MUTED,
  },
  metricZero: {
    color: FAINT,
  },
  inlineCta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  chipPrimary: {
    backgroundColor: ACCENT,
  },
  chipPrimaryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#fff',
  },
  chipSoft: {
    backgroundColor: ACCENT_SOFT,
  },
  chipSoftText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ACCENT_INK,
  },
  chipGhost: {
    backgroundColor: SEP_SOFT,
  },
  chipGhostText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3C3C43',
  },

  // settled foundation row
  found: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SEP,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  seal: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: GREEN_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundBody: {
    flex: 1,
    minWidth: 0,
  },
  foundTitle: {
    fontSize: 18,
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    color: LABEL,
    lineHeight: 22,
  },
  foundSub: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '600',
    marginTop: 2,
  },
});
