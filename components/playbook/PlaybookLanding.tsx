import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { InsightCard } from './InsightCard';
import { ConceptCard } from './ConceptCard';
import { SettledFoundationRow } from './SettledFoundationRow';
import { OnDeckBanner } from '@/components/timelines';
import type { Phase6ConceptRecord } from '@/services/PlaybookService';
import type { PlaybookInsightRecord } from '@/types/playbook';

export interface PlaybookLandingProps {
  stats: {
    insights: number;
    testing: number;
    settled: number;
  };
  insights: PlaybookInsightRecord[];
  concepts: Phase6ConceptRecord[];
  subscribedBlueprintCount?: number;
  onOpenBlueprints?: () => void;
  onRefineInsight: (insightId: string) => void;
  onDiscardInsight: (insightId: string) => void;
  onOpenConcept: (conceptId: string) => void;
}

export function PlaybookLanding({
  stats,
  insights,
  concepts,
  subscribedBlueprintCount = 0,
  onOpenBlueprints,
  onRefineInsight,
  onDiscardInsight,
  onOpenConcept,
}: PlaybookLandingProps) {
  const inDevelopment = concepts.filter((concept) => concept.state !== 'settled');
  const settled = concepts.filter((concept) => concept.state === 'settled');

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.title}>Playbook</Text>
        <Text style={styles.stats}>
          {stats.insights} insights · {stats.testing} testing · {stats.settled} settled
        </Text>
      </View>

      <OnDeckBanner />

      <Pressable
        style={[styles.entryCard, !onOpenBlueprints && styles.entryCardDisabled]}
        onPress={onOpenBlueprints}
        disabled={!onOpenBlueprints}
      >
        <View style={styles.entryCopy}>
          <Text style={styles.entryEyebrow}>Network browsing</Text>
          <Text style={styles.entryTitle}>Blueprints you follow</Text>
          <Text style={styles.entryBody}>
            {subscribedBlueprintCount > 0
              ? `${subscribedBlueprintCount} subscribed blueprint${subscribedBlueprintCount === 1 ? '' : 's'} ready to browse and add into your timeline.`
              : 'Browse subscribed blueprints and pull their steps into your timeline.'}
          </Text>
        </View>
        <Text style={styles.entryCta}>Open</Text>
      </Pressable>

      <Section title="Recent insights" subtitle="Raw captures waiting to become concepts">
        {insights.length === 0 ? (
          <Text style={styles.empty}>No recent insights. Drop a concept from the universal + to start the loop.</Text>
        ) : (
          insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={{
                id: insight.id,
                sourceLabel: 'From quick capture',
                sourceIcon: insight.kind === 'voice' ? 'microphone' : 'bulb',
                body: insight.content,
              }}
              onRefine={() => onRefineInsight(insight.id)}
              onDiscard={() => onDiscardInsight(insight.id)}
            />
          ))
        )}
      </Section>

      <Section title="Concepts in development" subtitle="Forming and Testing ideas">
        {inDevelopment.length === 0 ? (
          <Text style={styles.empty}>No concepts in development yet.</Text>
        ) : (
          inDevelopment.map((concept) => (
            <ConceptCard
              key={concept.id}
              state={concept.state}
              title={concept.title}
              whenLabel={`${concept.linked_step_count} linked steps`}
              meta={[
                { icon: 'steps', label: `${concept.linked_step_count} steps` },
                { icon: 'quotes', label: `${concept.quote_count} quotes` },
                { icon: 'caps', label: `${concept.capability_count} capabilities` },
              ]}
              onPress={() => onOpenConcept(concept.id)}
            />
          ))
        )}
      </Section>

      <Section title="Settled foundations" subtitle="Closed ideas that now carry weight">
        {settled.length === 0 ? (
          <Text style={styles.empty}>Nothing settled yet.</Text>
        ) : (
          settled.map((concept) => (
            <SettledFoundationRow
              key={concept.id}
              name={concept.title}
              settledAt={concept.settled_at ? `Settled ${new Date(concept.settled_at).toLocaleDateString()}` : 'Settled'}
              evidenceStepCount={concept.evidence_step_count}
              onPress={() => onOpenConcept(concept.id)}
            />
          ))
        )}
      </Section>
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 22,
    padding: 16,
    paddingBottom: 96,
  },
  hero: {
    gap: 8,
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  entryCardDisabled: {
    opacity: 0.7,
  },
  entryCopy: {
    flex: 1,
    gap: 4,
  },
  entryEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60,60,67,0.6)',
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  entryBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#3C3C43',
  },
  entryCta: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  stats: {
    fontSize: 15,
    color: '#3C3C43',
  },
  section: {
    gap: 12,
  },
  sectionHead: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: 'rgba(60,60,67,0.6)',
  },
  sectionBody: {
    gap: 10,
  },
  empty: {
    fontSize: 14,
    color: 'rgba(60,60,67,0.6)',
  },
});
