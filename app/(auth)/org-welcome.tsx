/**
 * Post-Onboarding Welcome Screen
 * One-time interstitial after org creation — gives the new org owner
 * clear next actions: create first blueprint, customize profile, share link.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';

interface ActionCard {
  emoji: string;
  title: string;
  description: string;
  route: string;
  primary?: boolean;
}

export default function OrgWelcomeScreen() {
  const { interest, orgName, orgId: _orgId } = useLocalSearchParams<{
    interest?: string;
    orgName?: string;
    orgId?: string;
  }>();
  const router = useRouter();
  const ctx = getOnboardingContext(interest);
  const orgLabel = ctx.organizationLabel;
  // Title-case the org name in case the AI returned lowercase
  const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
  const displayName = orgName ? titleCase(orgName) : `Your ${orgLabel}`;

  const actions: ActionCard[] = [
    {
      emoji: '\u{1F4D0}',
      title: 'Create Your First Blueprint',
      description: `Create a learning path that ${ctx.memberLabel}s can subscribe to and follow at their own pace.`,
      route: '/organization/templates',
      primary: true,
    },
    {
      emoji: '\u{1F465}',
      title: 'Invite Members',
      description: `Share a join link or send invites so ${ctx.memberLabel}s can find your ${orgLabel}.`,
      route: '/organization/members',
    },
    {
      emoji: '\u{1F4CA}',
      title: 'Explore Your Dashboard',
      description: `See the admin view where you'll track ${ctx.memberLabel} progress and manage your ${orgLabel}.`,
      route: '/organization/cohort-dashboard',
    },
  ];

  const handleAction = (route: string) => {
    router.replace(route as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Success header */}
          <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 32 }}>
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#DCFCE7',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Text style={{ fontSize: 36 }}>{'\u2705'}</Text>
            </View>
            <Text style={{
              fontSize: 28,
              fontWeight: '800',
              color: '#0F172A',
              textAlign: 'center',
              marginBottom: 8,
            }}>
              {displayName} is live!
            </Text>
            <Text style={{
              fontSize: 16,
              color: '#64748B',
              textAlign: 'center',
              lineHeight: 24,
              maxWidth: 320,
            }}>
              Your {orgLabel} is set up and ready for {ctx.memberLabel}s. Here's what to do next.
            </Text>
          </View>

          {/* Action cards */}
          <View style={{ gap: 16 }}>
            {actions.map((action, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleAction(action.route)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: action.primary ? '#2563EB' : '#FFFFFF',
                  borderRadius: 16,
                  padding: 20,
                  ...(action.primary ? {} : {
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }),
                  ...Platform.select({
                    web: {
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    },
                    default: {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 3,
                      elevation: 2,
                    },
                  }),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{action.emoji}</Text>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: action.primary ? '#FFFFFF' : '#0F172A',
                    flex: 1,
                  }}>
                    {action.title}
                  </Text>
                  <Text style={{
                    fontSize: 18,
                    color: action.primary ? 'rgba(255,255,255,0.7)' : '#94A3B8',
                  }}>
                    {'\u203A'}
                  </Text>
                </View>
                <Text style={{
                  fontSize: 14,
                  color: action.primary ? 'rgba(255,255,255,0.85)' : '#64748B',
                  lineHeight: 20,
                  marginLeft: 36,
                }}>
                  {action.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Share link teaser */}
          <View style={{
            marginTop: 28,
            backgroundColor: '#F1F5F9',
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 20, marginRight: 12 }}>{'\u{1F517}'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#334155' }}>
                Your shareable link
              </Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                better.at/{orgName
                  ? orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  : orgLabel}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                // TODO: copy to clipboard
              }}
              style={{
                backgroundColor: '#E2E8F0',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569' }}>Copy</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </>
  );
}
