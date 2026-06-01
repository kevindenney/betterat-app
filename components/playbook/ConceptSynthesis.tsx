import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// The synthesis body is AI-drafted Markdown using a narrow subset — ATX
// headings (#/##/###), inline **bold**, and blank-line-separated paragraphs.
// We render that subset inline rather than pull in a full Markdown engine.

function renderInline(text: string, keyPrefix: string) {
  // Split on ** pairs; odd segments are bold.
  return text.split('**').map((segment, i) =>
    i % 2 === 1 ? (
      <Text key={`${keyPrefix}-b${i}`} style={styles.bold}>
        {segment}
      </Text>
    ) : (
      <Text key={`${keyPrefix}-t${i}`}>{segment}</Text>
    ),
  );
}

function renderMarkdown(body: string) {
  if (!body) return null;
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      const heading = block.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        return (
          <Text key={`blk-${i}`} style={styles.heading}>
            {renderInline(heading[2], `blk-${i}`)}
          </Text>
        );
      }
      return (
        <Text key={`blk-${i}`} style={styles.body}>
          {renderInline(block, `blk-${i}`)}
        </Text>
      );
    });
}

export function ConceptSynthesis({
  body,
  draftedAtLabel,
}: {
  body: string;
  draftedAtLabel?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eye}>Synthesis</Text>
      {renderMarkdown(body)}
      {draftedAtLabel ? <Text style={styles.meta}>Synthesized from your quotes · drafted {draftedAtLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    padding: 14,
    gap: 10,
  },
  eye: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: '#7C4DFF',
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    color: '#1C1C1E',
    fontFamily: 'Georgia',
  },
  heading: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: 'Georgia',
  },
  bold: {
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    color: 'rgba(60,60,67,0.6)',
  },
});
