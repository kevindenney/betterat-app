import { useCallback, useState } from 'react';
import { Clipboard, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import {
  createShareLink,
  shareStepDirect,
  shareStepToGroup,
} from '@/services/SharedStepsService';
import type {
  ShareStepSheetGroup,
  ShareStepSheetRecipient,
} from '@/components/share/ShareStepSheet';

interface UseShareStepResult {
  open: (step: { id: string; title: string; body: string }) => void;
  close: () => void;
  visible: boolean;
  step: { id: string; title: string; body: string } | null;
  recentRecipients: ShareStepSheetRecipient[];
  defaultGroup: ShareStepSheetGroup | undefined;
  shareDirect: (recipientId: string) => Promise<void>;
  shareToGroup: (groupId: string) => Promise<void>;
  copyLink: () => Promise<string>;
}

async function loadRecentRecipients(userId: string): Promise<ShareStepSheetRecipient[]> {
  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);
  if (error || !data || data.length === 0) return [];

  const followingIds = (data as { following_id: string }[]).map((row) => row.following_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', followingIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  return followingIds
    .map((id) => {
      const profile = profileMap.get(id) as { id: string; full_name?: string | null } | undefined;
      const name = profile?.full_name ?? 'Practitioner';
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase() ?? '')
        .join('');
      return { id, name, initials: initials || 'PR' };
    })
    .filter(Boolean) as ShareStepSheetRecipient[];
}

async function loadDefaultGroup(userId: string): Promise<ShareStepSheetGroup | undefined> {
  const { data, error } = await supabase
    .from('fleet_followers')
    .select('fleet_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return undefined;

  const { data: fleet } = await supabase
    .from('fleets')
    .select('id, name')
    .eq('id', (data as { fleet_id: string }).fleet_id)
    .single();
  if (!fleet) return undefined;

  const { count: memberCount } = await supabase
    .from('fleet_followers')
    .select('id', { count: 'exact', head: true })
    .eq('fleet_id', (fleet as { id: string }).id);

  return {
    id: (fleet as { id: string }).id,
    name: (fleet as { name: string }).name,
    memberCount: memberCount ?? 0,
  };
}

export function useShareStep(): UseShareStepResult {
  const { user } = useAuth();
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<{ id: string; title: string; body: string } | null>(null);

  const { data: recentRecipients = [] } = useQuery({
    queryKey: ['phase8-share-recent-recipients', user?.id],
    queryFn: () => loadRecentRecipients(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: defaultGroup } = useQuery({
    queryKey: ['phase8-share-default-group', user?.id],
    queryFn: () => loadDefaultGroup(user!.id),
    enabled: Boolean(user?.id),
  });

  const open = useCallback(
    (next: { id: string; title: string; body: string }) => {
      setStep(next);
      setVisible(true);
    },
    [],
  );

  const close = useCallback(() => {
    setVisible(false);
    setStep(null);
  }, []);

  const shareDirect = useCallback(
    async (recipientId: string) => {
      if (!user?.id || !step) return;
      await shareStepDirect({ senderUserId: user.id, stepId: step.id, recipientUserId: recipientId });
      toast.show('Shared with recipient', 'success');
      close();
    },
    [user?.id, step, toast, close],
  );

  const shareToGroup = useCallback(
    async (groupId: string) => {
      if (!user?.id || !step) return;
      await shareStepToGroup({
        senderUserId: user.id,
        stepId: step.id,
        groupId,
        groupKind: 'fleet',
      });
      toast.show('Shared to fleet', 'success');
      close();
    },
    [user?.id, step, toast, close],
  );

  const copyLink = useCallback(async () => {
    if (!user?.id || !step) return '';
    const { url } = await createShareLink({ senderUserId: user.id, stepId: step.id });
    if (Platform.OS === 'web') {
      try {
        await (navigator as any).clipboard?.writeText?.(url);
      } catch {
        // ignore
      }
    } else {
      try {
        (Clipboard as any).setString?.(url);
      } catch {
        // ignore
      }
    }
    toast.show('Link copied', 'success');
    return url;
  }, [user?.id, step, toast]);

  return {
    open,
    close,
    visible,
    step,
    recentRecipients,
    defaultGroup,
    shareDirect,
    shareToGroup,
    copyLink,
  };
}
