/**
 * Marketing site top nav — shared across /schools, /schools/pricing,
 * /schools/start-pilot.
 *
 * Different chrome than the in-app top header: wordmark + section links
 * (For practitioners / For schools / For authors / Pricing / About) +
 * Sign in + Book a demo CTA. Light type, looser grid, brand voice.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export interface MktNavProps {
  active?: 'practitioners' | 'schools' | 'authors' | 'pricing' | 'about';
  showBookDemo?: boolean;
}

export function MktNav({ active = 'schools', showBookDemo = true }: MktNavProps) {
  const router = useRouter();
  return (
    <View style={s.nav}>
      <Pressable onPress={() => router.push('/schools')} style={s.wordmark}>
        <Text style={s.wordmarkBetter}>Better</Text>
        <Text style={s.wordmarkAt}>At</Text>
      </Pressable>
      <View style={s.links}>
        <NavLink label="For practitioners" active={active === 'practitioners'} />
        <NavLink
          label="For schools & teams"
          active={active === 'schools'}
          onPress={() => router.push('/schools')}
        />
        <NavLink label="For authors" active={active === 'authors'} />
        <NavLink
          label="Pricing"
          active={active === 'pricing'}
          onPress={() => router.push('/schools/pricing')}
        />
        <NavLink label="About" active={active === 'about'} />
      </View>
      <View style={s.ctas}>
        <Pressable onPress={() => router.push('/(auth)/login' as any)}>
          <Text style={s.signIn}>Sign in</Text>
        </Pressable>
        {showBookDemo ? (
          <Pressable style={s.bookDemo}>
            <Text style={s.bookDemoText}>Book a demo</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function NavLink({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Text style={[s.link, active && s.linkOn]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 56,
    paddingVertical: 22,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
    gap: 32,
  },
  wordmark: { flexDirection: 'row', alignItems: 'baseline' },
  wordmarkBetter: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0E1117',
    letterSpacing: -0.5,
  },
  wordmarkAt: {
    fontSize: 22,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: -0.5,
  },
  links: { flex: 1, flexDirection: 'row', gap: 24, marginLeft: 36 },
  link: { fontSize: 14, color: 'rgba(60, 60, 67, 0.7)', fontWeight: '500' },
  linkOn: { color: '#0E1117', fontWeight: '600' },
  ctas: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  signIn: { fontSize: 14, color: '#0E1117', fontWeight: '500' },
  bookDemo: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  bookDemoText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
});
