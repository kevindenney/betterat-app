import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { HKDW_BLUEPRINT_SLUG, HKDW_PROFILE_WELCOMED_COLUMN } from '@/lib/hkdwPhaseP';
import { useSubscribedBlueprints } from '@/hooks/useBlueprint';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

const profileWelcomeKey = (userId?: string | null) => ['profiles', userId ?? '', HKDW_PROFILE_WELCOMED_COLUMN] as const;

export function DragonWorldsPracticeWelcomeBanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: subscribedBlueprints } = useSubscribedBlueprints(null);

  const isSubscribed = useMemo(
    () => (subscribedBlueprints ?? []).some((bp) => bp.blueprint_slug === HKDW_BLUEPRINT_SLUG),
    [subscribedBlueprints],
  );

  const welcomeQuery = useQuery({
    queryKey: profileWelcomeKey(user?.id),
    enabled: FEATURE_FLAGS.REDEEM && !!user?.id && isSubscribed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(HKDW_PROFILE_WELCOMED_COLUMN)
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.[HKDW_PROFILE_WELCOMED_COLUMN] as string | null | undefined;
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('profiles')
        .update({ [HKDW_PROFILE_WELCOMED_COLUMN]: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(profileWelcomeKey(user?.id), new Date().toISOString());
    },
  });

  const dismiss = useCallback(() => {
    if (!dismissMutation.isPending) {
      dismissMutation.mutate();
    }
  }, [dismissMutation]);

  const viewBlueprint = useCallback(() => {
    router.push(`/blueprint/${HKDW_BLUEPRINT_SLUG}` as any);
  }, []);

  if (!FEATURE_FLAGS.REDEEM || !user?.id || !isSubscribed) return null;
  if (welcomeQuery.isLoading) return null;
  if (welcomeQuery.data) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.accent} />
      <View style={styles.grid}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>KD</Text>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>
            <Ionicons name="sparkles" size={12} color="#007AFF" /> Welcome to BetterAt
          </Text>
          <Text style={styles.title}>
            You are now following <Text style={styles.kevin}>Kevin's</Text>{' '}
            <Text style={styles.italic}>Dragon Worlds 2027</Text> blueprint.
          </Text>
          <Text style={styles.body}>
            Tap any step below to start planning. Your reflections will be shared with Kevin.
          </Text>
        </View>
        <Pressable
          onPress={dismiss}
          disabled={dismissMutation.isPending}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Dragon Worlds welcome banner"
          style={styles.close}
        >
          {dismissMutation.isPending ? (
            <ActivityIndicator size="small" color="#8E8E93" />
          ) : (
            <Ionicons name="close" size={18} color="#8E8E93" />
          )}
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={dismiss}
          disabled={dismissMutation.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Got it</Text>
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        </Pressable>
        <Pressable
          onPress={viewBlueprint}
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>View blueprint</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.18)',
    overflow: 'hidden',
    shadowColor: '#14223D',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#007AFF',
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingLeft: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4E6A85',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 2,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: '#007AFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: {
    color: '#14223D',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  kevin: {
    color: '#007AFF',
    fontWeight: '800',
  },
  italic: {
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
    fontStyle: 'italic',
  },
  body: {
    color: '#5A6685',
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#007AFF',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondary: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  secondaryText: {
    color: '#5A6685',
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
});

export default DragonWorldsPracticeWelcomeBanner;
