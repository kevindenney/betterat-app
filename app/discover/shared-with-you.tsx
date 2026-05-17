import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useToast } from '@/components/ui/AppToast';
import { SharedWithYouInbox } from '@/components/discover/SharedWithYouInbox';
import {
  getSharedWithYouInbox,
  markSharedStepRead,
  recordForkedSharedStep,
} from '@/services/SharedStepsService';
import { addToTimeline } from '@/services/AddToTimelineService';
import type { SharedInboxItem } from '@/types/sharing';

const IOS_BLUE = '#007AFF';

export default function SharedWithYouRoute() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['phase8-shared-with-you', user?.id],
    queryFn: () => getSharedWithYouInbox(user!.id),
    enabled: Boolean(user?.id),
  });

  const markRead = useMutation({
    mutationFn: (sharedStepId: string) => markSharedStepRead(sharedStepId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phase8-shared-with-you', user?.id] }),
  });

  const forkMutation = useMutation({
    mutationFn: async (item: SharedInboxItem) => {
      if (!user?.id || !currentInterest?.id) {
        throw new Error('Pick an interest before forking shared steps.');
      }
      const created = await addToTimeline({
        userId: user.id,
        interestId: currentInterest.id,
        preview: {
          sourceLabel: `From ${item.sender_name}`,
          title: item.step_title,
          body: item.step_body,
          capabilities: [],
        },
        placement: 'next-up',
        sourceType: 'user_fork',
        sourceId: item.step_id,
        sourceUserId: item.sender_user_id,
      });
      await recordForkedSharedStep({
        sharedStepId: item.shared_step_id,
        forkedStepId: created.id,
      });
      return created;
    },
    onSuccess: () => {
      toast.show('Forked into your timeline', 'success');
      queryClient.invalidateQueries({ queryKey: ['phase8-shared-with-you', user?.id] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to fork';
      toast.show(message, 'error');
    },
  });

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Shared with you',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <ChevronLeft size={20} color={IOS_BLUE} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ),
        }}
      />

      <SharedWithYouInbox
        items={items}
        isLoading={isLoading}
        onView={(item) => {
          if (!item.read_at) markRead.mutate(item.shared_step_id);
          router.push(`/step/${item.step_id}` as any);
        }}
        onFork={async (item) => {
          await forkMutation.mutateAsync(item);
        }}
        onComment={() => toast.show('Comments coming in Phase 8.1', 'info')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  backText: {
    fontSize: 15,
    color: IOS_BLUE,
    marginLeft: -2,
  },
});
