/**
 * Club Onboarding Chat Interface
 * Conversational AI-powered club setup experience
 * Transforms 45-minute form into 5-minute conversation
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrganization } from '@/providers/OrganizationProvider';
import { getOnboardingContext } from '@/lib/onboarding/interestContext';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ClubOnboardingChat');

interface OrgData {
  name: string;
  description: string;
  program_name?: string;
  program_description?: string;
  expected_students?: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ClubOnboardingChatProps {
  interestSlug?: string;
  onSkipToManual?: () => void;
}

export function ClubOnboardingChat({ interestSlug, onSkipToManual }: ClubOnboardingChatProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { refreshMemberships, setActiveOrganizationId } = useOrganization();
  const ctx = getOnboardingContext(interestSlug);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: ctx.onboarding.chatGreeting,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedOrgData, setCompletedOrgData] = useState<OrgData | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrapeSkillId = process.env.EXPO_PUBLIC_CLAUDE_SKILL_CLUB_SCRAPE || null;

  const isLikelyUrl = (value: string) => {
    if (!value) return false;
    const trimmed = value.trim();
    // Reject if it has spaces (not a URL), is too short, or has no dot
    if (trimmed.length < 5 || trimmed.includes(' ') || !trimmed.includes('.')) return false;
    try {
      const normalized = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
      const parsed = new URL(normalized);
      // Must have a real TLD (hostname with a dot)
      return parsed.hostname.includes('.');
    } catch {
      return false;
    }
  };

  const formatScrapeSummary = (url: string, data: any) => {
    const summaryLines: string[] = [];
    if (data?.summary) {
      summaryLines.push(data.summary.trim());
    } else {
      summaryLines.push(`I scanned ${url} and pulled out a few highlights.`);
    }

    if (Array.isArray(data?.classes) && data.classes.length > 0) {
      const classLines = data.classes.slice(0, 5).map((cls: any) => `• ${cls.name}${cls.description ? ` — ${cls.description}` : ''}`);
      summaryLines.push('\nKey classes/fleets:\n' + classLines.join('\n'));
    }

    if (Array.isArray(data?.events) && data.events.length > 0) {
      const eventLines = data.events.slice(0, 5).map((evt: any) => {
        const pieces: string[] = [];
        if (evt.name) pieces.push(evt.name);
        if (evt.date) pieces.push(evt.date);
        return `• ${pieces.join(' — ')}`;
      });
      summaryLines.push('\nUpcoming events mentioned:\n' + eventLines.join('\n'));
    }

    return summaryLines.join('\n\n').trim();
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !user) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    const userEntry: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    let conversation: Message[] = [...messages, userEntry];
    setMessages(conversation);

    setLoading(true);

    // Debug: check auth state before calling edge function
    const { data: sessionData } = await supabase.auth.getSession();
    logger.debug('Auth debug:', {
      hasUser: !!user,
      userId: user?.id,
      hasSession: !!sessionData?.session,
      hasAccessToken: !!sessionData?.session?.access_token,
      tokenPrefix: sessionData?.session?.access_token?.substring(0, 20) + '...',
      isLikelyUrl: isLikelyUrl(userMessage),
    });

    try {
      if (isLikelyUrl(userMessage)) {
        const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke('club-scrape', {
          body: {
            url: userMessage,
            skillId: scrapeSkillId,
          },
        });

        if (scrapeError) {
          console.error('Club scrape function error:', scrapeError);
          throw new Error(scrapeError.message || 'Failed to scan that website');
        }

        if (scrapeData?.success && scrapeData?.data) {
          const importMessage: Message = {
            role: 'assistant',
            content: formatScrapeSummary(userMessage, scrapeData.data),
            timestamp: new Date(),
          };

          conversation = [...conversation, importMessage];
          setMessages(conversation);
        } else if (scrapeData?.error) {
          const importMessage: Message = {
            role: 'assistant',
            content: `I attempted to scan ${userMessage}, but ran into an issue: ${scrapeData.error}. Try another page or provide key details manually.`,
            timestamp: new Date(),
          };
          conversation = [...conversation, importMessage];
          setMessages(conversation);
        }
      }

      const payloadMessages = conversation.map(({ role, content }) => ({ role, content }));

      logger.debug('Invoking club-onboarding edge function:', {
        messageCount: payloadMessages.length,
        interestSlug,
        organizationLabel: ctx.organizationLabel,
      });

      const { data, error } = await supabase.functions.invoke('club-onboarding', {
        body: {
          messages: payloadMessages,
          interestSlug: interestSlug || undefined,
          organizationLabel: ctx.organizationLabel,
        },
      });

      logger.debug('Edge function response:', {
        hasData: !!data,
        hasError: !!error,
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        dataSuccess: data?.success,
      });

      if (error) {
        console.error('Club onboarding function error:', error);
        throw new Error(error.message || 'Edge function error');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unable to continue onboarding conversation');
      }

      const responseText = typeof data.message === 'string' && data.message.length > 0
        ? data.message
        : `Thanks! I captured that. Could you share a bit more about your ${ctx.organizationLabel}?`;

      const assistantEntry: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };

      conversation = [...conversation, assistantEntry];
      setMessages(conversation);

      // Detect completion — AI called complete_setup tool
      if (data.complete && data.orgData) {
        setCompletedOrgData(data.orgData as OrgData);
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      const fallback = error?.message
        ? `I ran into an issue processing that. Let's try again — what's your ${ctx.organizationLabel}'s name?`
        : `Sorry, I had a technical issue. Please try again, or use the "Skip" option below to set up manually.`;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: fallback,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!completedOrgData || !user) return;
    setCreatingOrg(true);

    try {
      // Create the organization
      const slug = completedOrgData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const orgPayload = {
        name: completedOrgData.name,
        slug,
        organization_type: 'community',  // Valid: club, institution, association, business, community, other
        created_by: user.id,
        interest_slug: interestSlug || 'general',
        metadata: {
          description: completedOrgData.description,
          program_name: completedOrgData.program_name || null,
          program_description: completedOrgData.program_description || null,
          expected_students: completedOrgData.expected_students || null,
        },
      };

      logger.debug('Creating org with payload:', JSON.stringify(orgPayload, null, 2));

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert(orgPayload)
        .select('id')
        .single();

      if (orgError) {
        console.error('[ClubOnboardingChat] Org insert error:', { code: orgError.code, details: orgError.details, hint: orgError.hint, message: orgError.message });
        throw orgError;
      }

      const memberPayload = {
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        membership_status: 'active',
      };

      logger.debug('Creating membership with payload:', JSON.stringify(memberPayload, null, 2));

      const { error: memberError } = await supabase
        .from('organization_memberships')
        .insert(memberPayload);

      if (memberError) {
        console.error('[ClubOnboardingChat] Membership insert error:', { code: memberError.code, details: memberError.details, hint: memberError.hint, message: memberError.message });
        throw memberError;
      }

      logger.debug('Org created:', org.id);

      // Refresh org provider so it picks up the new membership, then set it active
      await refreshMemberships();
      await setActiveOrganizationId(org.id);

      router.replace({
        pathname: '/(auth)/org-welcome',
        params: {
          interest: interestSlug || '',
          orgName: completedOrgData.name,
          orgId: org.id,
        },
      } as any);
    } catch (error: any) {
      console.error('[ClubOnboardingChat] Org creation failed:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `There was a problem creating your ${ctx.organizationLabel}. ${error?.message || 'Please try again.'}`,
        timestamp: new Date(),
      }]);
      setCompletedOrgData(null);
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleStartOver = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Let's start fresh!\n\n${ctx.onboarding.organizationPrompt}`,
        timestamp: new Date(),
      },
    ]);
    setInputValue('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F5F7FA' }}
    >
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{
          backgroundColor: '#E3F2FD',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 14, color: '#1976D2', fontWeight: '600' }}>
            Chat with our onboarding specialist to set up your workspace.
          </Text>
          <TouchableOpacity onPress={handleStartOver}>
            <Text style={{ fontSize: 14, color: '#1976D2', textDecorationLine: 'underline' }}>
              Start Over
            </Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {messages.map((msg, i) => (
            <View key={i} style={{
              marginBottom: 16,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
            }}>
              {/* Message Bubble */}
              <View style={{
                backgroundColor: msg.role === 'user' ? '#007AFF' : '#FFFFFF',
                padding: 14,
                borderRadius: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              }}>
                <Text style={{
                  color: msg.role === 'user' ? '#FFFFFF' : '#1F2937',
                  fontSize: 15,
                  lineHeight: 22,
                }}>
                  {msg.content}
                </Text>
              </View>

              {/* Timestamp */}
              <Text style={{
                fontSize: 11,
                color: '#9CA3AF',
                marginTop: 4,
                marginLeft: msg.role === 'user' ? 0 : 8,
                marginRight: msg.role === 'user' ? 8 : 0,
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <View style={{
              alignSelf: 'flex-start',
              backgroundColor: '#FFFFFF',
              padding: 14,
              borderRadius: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={{ marginLeft: 8, color: '#6B7280', fontSize: 14 }}>
                Thinking...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Completion CTA */}
        {completedOrgData ? (
          <View style={{ marginTop: 16, gap: 8 }}>
            <TouchableOpacity
              onPress={handleCreateOrg}
              disabled={creatingOrg}
              style={{
                backgroundColor: creatingOrg ? '#93C5FD' : '#2563EB',
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              {creatingOrg && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />}
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>
                {creatingOrg ? 'Creating...' : `Launch ${completedOrgData.name}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCompletedOrgData(null)}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 14, color: '#64748B' }}>Continue chatting</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Input Area */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 16,
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}>
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Type your message..."
                placeholderTextColor="#9CA3AF"
                style={{
                  flex: 1,
                  fontSize: 15,
                  paddingVertical: 8,
                  color: '#1F2937',
                }}
                onSubmitEditing={handleSendMessage}
                editable={!loading}
                multiline
                maxLength={500}
              />

              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={loading || !inputValue.trim()}
                style={{
                  backgroundColor: loading || !inputValue.trim() ? '#E5E7EB' : '#007AFF',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 20,
                  marginLeft: 8,
                }}
              >
                <Text style={{
                  color: loading || !inputValue.trim() ? '#9CA3AF' : '#FFFFFF',
                  fontSize: 15,
                  fontWeight: '600',
                }}>
                  Send
                </Text>
              </TouchableOpacity>
            </View>

            {/* Skip to manual setup */}
            <TouchableOpacity
              onPress={() => {
                if (onSkipToManual) {
                  onSkipToManual();
                } else {
                  router.replace('/(tabs)/races');
                }
              }}
              style={{
                alignItems: 'center',
                paddingVertical: 14,
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 14, color: '#64748B', fontWeight: '500' }}>
                Skip — I'll set up manually
              </Text>
            </TouchableOpacity>
          </>
        )}

      </View>
    </KeyboardAvoidingView>
  );
}

export default ClubOnboardingChat;
