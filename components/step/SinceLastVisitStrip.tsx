/**
 * SinceLastVisitStrip — canonical §C-Sun "what's new since you were here" strip.
 *
 * Purple summary chip showing up to 3 most-relevant events since the user's
 * last visit. Renders nothing when empty.
 *
 * Event kinds:
 *   - peer-step-completion → tap routes to Blueprint Index (filtered to done)
 *   - peer-note            → tap routes to Step Discussion (PR 2 dependency)
 *   - coach-reply          → tap routes to Step Discussion (PR 2 dependency)
 *
 * Until PR 2 (Discussion) lands, peer-note + coach-reply events render but
 * tap is a no-op. Step-completion events route correctly via the PR 1
 * Blueprint Index route.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles, ChevronRight } from 'lucide-react-native';

export type SinceVisitEventKind = 'peer-step-completion' | 'peer-note' | 'coach-reply';

export interface SinceVisitEvent {
  id: string;
  kind: SinceVisitEventKind;
  /** Pre-rendered one-line summary, e.g. "Phyl finished Step 4". */
  summary: string;
}

export interface SinceLastVisitStripProps {
  events: SinceVisitEvent[];
  onTapEvent?: (event: SinceVisitEvent) => void;
}

export function SinceLastVisitStrip({ events, onTapEvent }: SinceLastVisitStripProps) {
  if (events.length === 0) return null;
  const visible = events.slice(0, 3);
  const moreCount = events.length - visible.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.eyebrowRow}>
        <Sparkles size={12} color={C.purpleDeep} />
        <Text style={styles.eyebrow}>Since your last visit</Text>
      </View>
      <View style={styles.list}>
        {visible.map((event) => (
          <Pressable
            key={event.id}
            style={({ pressed }) => [
              styles.eventRow,
              pressed && onTapEvent && styles.eventRowPressed,
            ]}
            onPress={() => onTapEvent?.(event)}
            disabled={!onTapEvent}
            accessibilityRole="button"
            accessibilityLabel={event.summary}
          >
            <Text style={styles.eventText} numberOfLines={2}>
              {event.summary}
            </Text>
            {onTapEvent ? <ChevronRight size={13} color={C.purpleDeep} /> : null}
          </Pressable>
        ))}
        {moreCount > 0 ? (
          <Text style={styles.moreText}>+{moreCount} more</Text>
        ) : null}
      </View>
    </View>
  );
}

const C = {
  purple: '#5856D6',
  purpleDeep: '#3F3DAB',
  purpleSoft: '#D7D6F4',
  purpleTint: '#EFEFFB',
  label: '#1C1C1E',
  label2: '#3C3C43',
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.purpleTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.purpleSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: C.purpleDeep,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  list: {
    gap: 6,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventRowPressed: {
    opacity: 0.7,
  },
  eventText: {
    flex: 1,
    fontSize: 12.5,
    color: C.label,
    letterSpacing: -0.05,
    lineHeight: 17,
  },
  moreText: {
    fontSize: 11,
    color: C.purpleDeep,
    fontWeight: '600',
    marginTop: 2,
  },
});
