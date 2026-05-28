/**
 * /demo — persona-pick entry for the multi-audience demo program.
 *
 * Three vertical sections (sail racing, JHU nursing, India SHG)
 * each with persona cards. Tap a card → call mint_demo_session →
 * follow the returned magic link → land signed in as that persona
 * on their role-appropriate route.
 *
 * The edge function is Codex's slice (Wave 1). Until it ships, the
 * cards still render — taps surface a typed "demo not enabled"
 * state. This unblocks the entire frontend without waiting on the
 * backend deploy.
 *
 * Personas with `available: false` render as disabled "Coming soon"
 * cards so the vertical's intent reads even before seed lands.
 */

import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  DEMO_VERTICALS,
  personasByVertical,
  type DemoPersona,
  type DemoVerticalSection,
} from '@/lib/demo/personas';
import {
  mintDemoSession,
  followDemoMagicLink,
  DemoSessionUnavailableError,
} from '@/services/DemoSessionService';

type CardState =
  | { status: 'idle' }
  | { status: 'pending'; personaKey: string }
  | { status: 'error'; personaKey: string; message: string };

export default function DemoScreen() {
  const [state, setState] = useState<CardState>({ status: 'idle' });

  const handlePersonaPress = useCallback(async (persona: DemoPersona) => {
    if (!persona.available) return;
    setState({ status: 'pending', personaKey: persona.key });
    try {
      const result = await mintDemoSession({
        personaKey: persona.key,
        redirectTo: persona.landingRoute,
      });
      await followDemoMagicLink(result.actionLink);
      // The magic link replaces the page on web and deep-links on
      // native, so the "pending" state stays visible until the page
      // navigates. No success state needed inline.
    } catch (err) {
      const message =
        err instanceof DemoSessionUnavailableError
          ? 'Demo sign-in is not enabled in this environment yet. The edge function ships in Wave 1.'
          : err instanceof Error
            ? err.message
            : 'Could not start the demo session.';
      setState({ status: 'error', personaKey: persona.key, message });
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, title: 'Demo' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>BetterAt demo</Text>
          <Text style={styles.title}>Pick a persona to step into.</Text>
          <Text style={styles.subtitle}>
            Each card opens BetterAt as that person, with their plans, cohort,
            and portfolio already populated. Demo accounts reset nightly — feel
            free to poke around.
          </Text>
        </View>

        {DEMO_VERTICALS.map((section) => (
          <VerticalSection
            key={section.vertical}
            section={section}
            personas={personasByVertical(section.vertical)}
            state={state}
            onPress={handlePersonaPress}
          />
        ))}

        <Text style={styles.footnote}>
          Magic-link sign-in. No password. Sessions are sandbox accounts; nothing
          you do touches real users.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface VerticalSectionProps {
  section: DemoVerticalSection;
  personas: DemoPersona[];
  state: CardState;
  onPress: (persona: DemoPersona) => void;
}

function VerticalSection({ section, personas, state, onPress }: VerticalSectionProps) {
  if (personas.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={[styles.sectionRule, { backgroundColor: section.accent }]} />
      <Text style={[styles.sectionLabel, { color: section.accent }]}>
        {section.label}
      </Text>
      <Text style={styles.sectionTagline}>{section.tagline}</Text>
      <View style={styles.cardGrid}>
        {personas.map((persona) => (
          <PersonaCard
            key={persona.key}
            persona={persona}
            state={state}
            onPress={() => onPress(persona)}
          />
        ))}
      </View>
    </View>
  );
}

interface PersonaCardProps {
  persona: DemoPersona;
  state: CardState;
  onPress: () => void;
}

function PersonaCard({ persona, state, onPress }: PersonaCardProps) {
  const isPending = state.status === 'pending' && state.personaKey === persona.key;
  const isError = state.status === 'error' && state.personaKey === persona.key;
  const disabled = !persona.available || isPending;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        pressed && !disabled && styles.cardPressed,
        !persona.available && styles.cardUnavailable,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={`Be ${persona.displayName}, ${persona.role}`}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: persona.avatarColor },
          !persona.available && styles.avatarMuted,
        ]}
      >
        <Text style={styles.avatarInitial}>{persona.initial}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.personaName} numberOfLines={1}>
          {persona.displayName}
        </Text>
        <Text style={styles.personaRole} numberOfLines={1}>
          {persona.role}
        </Text>
        <Text style={styles.personaBlurb} numberOfLines={2}>
          {persona.blurb}
        </Text>
      </View>
      <View style={styles.cardCta}>
        {!persona.available ? (
          <Text style={styles.ctaSoon}>Coming soon</Text>
        ) : isPending ? (
          <Text style={styles.ctaPending}>Opening…</Text>
        ) : (
          <>
            <Text style={styles.ctaText}>
              Be {persona.displayName.split(' ')[0]}
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </>
        )}
      </View>
      {isError ? (
        <Text style={styles.errorText} numberOfLines={3}>
          {state.message}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48, gap: 24 },
  header: { gap: 8 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#64748B',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginTop: 4,
  },
  section: { gap: 8 },
  sectionRule: {
    width: 32,
    height: 3,
    borderRadius: 999,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionTagline: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginBottom: 10,
  },
  cardGrid: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  cardUnavailable: { opacity: 0.55 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMuted: { backgroundColor: '#94A3B8' },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardBody: { flex: 1, gap: 2, paddingTop: 1 },
  personaName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  personaRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  personaBlurb: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#475569',
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  ctaText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ctaPending: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ctaSoon: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#64748B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  errorText: {
    width: '100%',
    marginTop: 8,
    fontSize: 12,
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 8,
    lineHeight: 17,
  },
  footnote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 17,
  },
});
