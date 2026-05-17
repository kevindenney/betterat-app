import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { InsightCard } from './InsightCard';
import { ConceptCard } from './ConceptCard';
import { SettledFoundationRow } from './SettledFoundationRow';
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
  onRefineInsight: (insightId: string) => void;
  onDiscardInsight: (insightId: string) => void;
  onOpenConcept: (conceptId: string) => void;
}

export function PlaybookLanding({
  stats,
  insights,
  concepts,
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
