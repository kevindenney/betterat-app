import React from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkspaceDomain } from '@/hooks/useWorkspaceDomain';
import { useOrganization } from '@/providers/OrganizationProvider';
import {
  OrganizationInviteRecord,
  organizationInviteService,
} from '@/services/OrganizationInviteService';
import {
  InviteRolePreset,
  organizationInviteRolePresetService,
} from '@/services/OrganizationInviteRolePresetService';
import {
  canRespondToInviteStatus,
  isInviteDecisionTerminal,
  isValidInviteToken,
  normalizeInviteToken,
} from '@/lib/org-invites/routeFlow';

function formatOrgType(value?: string | null) {
  if (!value) return 'Organization';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function OrganizationAccessSettingsScreen() {
  const params = useLocalSearchParams<{
    inviteToken?: string;
    inviteRole?: string;
    inviteRoleKey?: string;
    inviteName?: string;
    inviteEmail?: string;
    participantId?: string;
    programId?: string;
    sessionId?: string;
    autoInvite?: string;
  }>();
  const {
    organizationProviderActive,
    loading,
    ready,
    providerMountedAt,
    membershipLoadAttempt,
    membershipLoadError,
    membershipLoadDebug,
    membershipLoadErrorPayload,
    memberships,
    activeOrganizationId,
    activeMembership,
    activeOrganization,
    setActiveOrganizationId,
    refreshMemberships,
    canManageActiveOrganization,
    defaultContentVisibility,
    updateDefaultContentVisibility,
  } = useOrganization();
  const { user, signedIn } = useAuth();
  const { activeDomain } = useWorkspaceDomain();
  const [savingVisibility, setSavingVisibility] = React.useState(false);
  const [inviteHistoryLoading, setInviteHistoryLoading] = React.useState(false);
  const [inviteHistory, setInviteHistory] = React.useState<OrganizationInviteRecord[]>([]);
  const [resolvedTokenInvite, setResolvedTokenInvite] = React.useState<OrganizationInviteRecord | null>(null);
  const [tokenActionLoading, setTokenActionLoading] = React.useState(false);
  const [tokenLookupLoading, setTokenLookupLoading] = React.useState(false);
  const [tokenLookupInput, setTokenLookupInput] = React.useState('');
  const [inviteRoleOptions, setInviteRoleOptions] = React.useState<InviteRolePreset[]>([]);
  const [showDebugInfo, setShowDebugInfo] = React.useState(false);
  const showDevDebugPanel = __DEV__;
  const autoInviteHandledRef = React.useRef(false);
  const invalidParamAlertShownRef = React.useRef<string | null>(null);
  const displayMemberships = React.useMemo(() => {
    const byIdentity = new Map<string, (typeof memberships)[number]>();
    for (const membership of memberships) {
      if (!membership.organization_id) continue;

      const org = membership.organization;
      const slug = (org?.slug || '').trim().toLowerCase();
      const type = (org?.organization_type || '').trim().toLowerCase();
      const name = (org?.name || '').trim().toLowerCase();
      const key = slug || `${type}|${name}` || membership.organization_id;

      if (!byIdentity.has(key)) {
        byIdentity.set(key, membership);
      }
    }
    return Array.from(byIdentity.values());
  }, [memberships]);

  React.useEffect(() => {
    if (!showDevDebugPanel) return;
    const snapshot = {
      organizationProviderActive,
      loading,
      ready,
      providerMountedAt,
      membershipLoadAttempt,
      membershipLoadError,
      hasDebugPayload: Boolean(membershipLoadDebug),
    };
    // eslint-disable-next-line no-console
    console.log('[organization-access] context snapshot', JSON.stringify(snapshot));
  }, [
    showDevDebugPanel,
    organizationProviderActive,
    loading,
    ready,
    providerMountedAt,
    membershipLoadAttempt,
    membershipLoadError,
    membershipLoadDebug,
  ]);

  const handleChangeVisibility = async (next: 'public' | 'org_members') => {
    if (next === defaultContentVisibility || savingVisibility) return;
    setSavingVisibility(true);
    try {
      await updateDefaultContentVisibility(next);
    } catch (error) {
      showAlert('Unable to update visibility', 'Please try again in a moment.');
    } finally {
      setSavingVisibility(false);
    }
  };

  const loadInviteHistory = React.useCallback(async () => {
    if (!activeOrganization?.id) return;
    try {
      setInviteHistoryLoading(true);
      const rows = await organizationInviteService.listOrganizationInvites(activeOrganization.id, 25);
      setInviteHistory(rows);
    } catch (error) {
      console.error('[organization-access] Failed to load invite history:', error);
    } finally {
      setInviteHistoryLoading(false);
    }
  }, [activeOrganization?.id]);

  React.useEffect(() => {
    void loadInviteHistory();
  }, [loadInviteHistory]);

  const resolveInviteToken = React.useCallback(
    async (token: string, markOpened: boolean) => {
      const normalized = String(token || '').trim();
      if (!normalized) return null;

      try {
        setTokenLookupLoading(true);
        const invite = markOpened
          ? await organizationInviteService.markInviteOpenedByToken(normalized)
          : await organizationInviteService.getInviteByToken(normalized);
        setResolvedTokenInvite(invite);
        return invite;
      } catch (error) {
        console.error('[organization-access] Failed to resolve invite token:', error);
        setResolvedTokenInvite(null);
        showAlert('Invite Not Found', 'This invite token is invalid or no longer active.');
        return null;
      } finally {
        setTokenLookupLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    const token = normalizeInviteToken(params.inviteToken);
    setTokenLookupInput(token);
    if (!token) return;
    if (!isValidInviteToken(token)) {
      if (invalidParamAlertShownRef.current !== token) {
        invalidParamAlertShownRef.current = token;
        showAlert(
          'Invalid Invite Token',
          'This invite token format is invalid. Paste a valid 24-character token to continue.'
        );
      }
      return;
    }
    invalidParamAlertShownRef.current = null;
    void resolveInviteToken(token, true);
  }, [params.inviteToken, resolveInviteToken]);

  const canRespondToTokenInvite = React.useMemo(() => {
    if (!signedIn || !resolvedTokenInvite?.invitee_email || !user?.email) return false;
    return (
      String(resolvedTokenInvite.invitee_email).trim().toLowerCase() ===
      String(user.email).trim().toLowerCase()
    );
  }, [resolvedTokenInvite?.invitee_email, signedIn, user?.email]);

  const handleTokenInviteResponse = React.useCallback(
    async (status: 'accepted' | 'declined') => {
      if (!resolvedTokenInvite?.id) return;
      if (!canRespondToTokenInvite) {
        showAlert(
          'Invite Email Mismatch',
          'Sign in with the invited email address to respond to this invite.'
        );
        return;
      }

      try {
        setTokenActionLoading(true);
        const token = String(resolvedTokenInvite.invite_token || '').trim();
        if (!token) {
          showAlert('Invite Token Missing', 'This invite cannot be responded to because its token is missing.');
          return;
        }
        const next = status === 'accepted'
          ? await organizationInviteService.acceptInviteByTokenForCurrentUser(token)
          : await organizationInviteService.declineInviteByTokenForCurrentUser(token);
        setResolvedTokenInvite(next);
        if (activeOrganization?.id === next.organization_id) {
          void loadInviteHistory();
        }
        if (status === 'accepted') {
          await refreshMemberships();
          showAlert('Invite Accepted', 'Your organization access has been activated.');
        }
      } catch (error) {
        console.error('[organization-access] Failed to update token invite status:', error);
        showAlert('Unable to update invite', 'Please try again in a moment.');
      } finally {
        setTokenActionLoading(false);
      }
    },
    [activeOrganization?.id, canRespondToTokenInvite, loadInviteHistory, refreshMemberships, resolvedTokenInvite]
  );

  const handleLookupInviteToken = React.useCallback(async () => {
    const token = normalizeInviteToken(tokenLookupInput);
    if (!token) {
      showAlert('Enter Invite Token', 'Paste the invite token to continue.');
      return;
    }
    if (!isValidInviteToken(token)) {
      showAlert('Invalid Invite Token', 'Invite tokens must be 24 lowercase letters or numbers.');
      return;
    }

    router.replace({
      pathname: '/settings/organization-access',
      params: { inviteToken: token },
    });
    await resolveInviteToken(token, true);
  }, [resolveInviteToken, tokenLookupInput]);

  const loadRoleOptions = React.useCallback(async () => {
    const domain = activeDomain || 'generic';
    try {
      const presets = await organizationInviteRolePresetService.listPresets(domain);
      setInviteRoleOptions(presets);
    } catch (error) {
      console.error('[organization-access] Failed to load role presets:', error);
      setInviteRoleOptions([]);
    }
  }, [activeDomain]);

  React.useEffect(() => {
    void loadRoleOptions();
  }, [loadRoleOptions]);

  const handleInviteByRole = React.useCallback(
    async (
      role: string,
      person?: { name?: string; email?: string; participantId?: string; programId?: string; sessionId?: string },
      roleKey?: string
    ) => {
      const rolePayload = organizationInviteRolePresetService.resolveRolePayload(
        inviteRoleOptions,
        role,
        roleKey
      );
      const resolvedRole = rolePayload.roleLabel;
      const resolvedRoleKey = rolePayload.roleKey;
      const orgName = activeOrganization?.name || 'our organization';
      const subject = `Invitation to join ${orgName} as ${resolvedRole}`;
      const greetingTarget = person?.name?.trim() || person?.email?.trim() || '';
      const greeting = greetingTarget ? `Hi ${greetingTarget},\n\n` : `Hi,\n\n`;
      const emailHint = person?.email?.trim()
        ? `Preferred invitation email: ${person.email.trim()}\n\n`
        : '';
      let inviteToken: string | null = null;

      if (activeOrganization?.id && canManageActiveOrganization) {
        try {
          const created = await organizationInviteService.createInvite({
            organization_id: activeOrganization.id,
            role_label: resolvedRole,
            role_key: resolvedRoleKey,
            invitee_name: person?.name?.trim() || null,
            invitee_email: person?.email?.trim() || null,
            participant_id: person?.participantId || null,
            program_id: person?.programId || null,
            session_id: person?.sessionId || null,
            status: 'sent',
            channel: 'email',
            metadata: {
              source: 'organization_access',
              auto_invite: params.autoInvite === '1',
              active_domain: activeDomain,
              role_key: resolvedRoleKey,
              role_label: resolvedRole,
            },
          });
          inviteToken = created.invite_token || null;
          void loadInviteHistory();
        } catch (error) {
          console.error('[organization-access] Failed to record invite:', error);
        }
      }

      const webBase =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : process.env.EXPO_PUBLIC_APP_URL || 'https://better.at';
      const inviteLink = inviteToken
        ? `${webBase}/settings/organization-access?inviteToken=${encodeURIComponent(inviteToken)}&inviteRole=${encodeURIComponent(resolvedRole)}&inviteRoleKey=${encodeURIComponent(resolvedRoleKey)}`
        : null;
      const tokenSection = inviteToken
        ? `Invite token: ${inviteToken}\n${inviteLink ? `Invite link: ${inviteLink}\n` : ''}\n`
        : '';

      const body =
        greeting +
        `You are invited to join ${orgName} on BetterAt as a ${resolvedRole}.\n\n` +
        emailHint +
        tokenSection +
        `Please reply to this email to confirm onboarding and access details.\n\n` +
        `Thanks.`;

      const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      try {
        await Linking.openURL(mailto);
      } catch (error) {
        showAlert('Unable to open email app', 'Please configure an email app and try again.');
      }
    },
    [
      activeDomain,
      activeOrganization?.id,
      activeOrganization?.name,
      canManageActiveOrganization,
      inviteRoleOptions,
      loadInviteHistory,
      params.autoInvite,
    ]
  );

  React.useEffect(() => {
    if (autoInviteHandledRef.current) return;
    if (params.autoInvite !== '1') return;
    if (!canManageActiveOrganization) return;
    if (!params.inviteRole) return;
    autoInviteHandledRef.current = true;
    void handleInviteByRole(String(params.inviteRole), {
      name: params.inviteName ? String(params.inviteName) : undefined,
      email: params.inviteEmail ? String(params.inviteEmail) : undefined,
      participantId: params.participantId ? String(params.participantId) : undefined,
      programId: params.programId ? String(params.programId) : undefined,
      sessionId: params.sessionId ? String(params.sessionId) : undefined,
    }, params.inviteRoleKey ? String(params.inviteRoleKey) : undefined);
  }, [
    canManageActiveOrganization,
    handleInviteByRole,
    params.autoInvite,
    params.inviteEmail,
    params.inviteName,
    params.participantId,
    params.programId,
    params.sessionId,
    params.inviteRoleKey,
    params.inviteRole,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Organization Access</Text>
            <Text style={styles.headerSubtitle}>Workspace, role, and content visibility</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Have an Invite Token?</Text>
          <Text style={styles.bodyText}>
            Open a link or paste your token here to review and respond to your invite.
          </Text>
          <TextInput
            value={tokenLookupInput}
            onChangeText={setTokenLookupInput}
            placeholder="Paste invite token"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Pressable
            onPress={() => void handleLookupInviteToken()}
            disabled={tokenLookupLoading}
            style={[styles.pill, styles.pillBlock, tokenLookupLoading ? styles.pillDisabled : styles.pillBlue]}
          >
            <Text style={tokenLookupLoading ? styles.pillDisabledText : styles.pillBlueText}>
              {tokenLookupLoading ? 'Checking token...' : 'Check Invite Token'}
            </Text>
          </Pressable>
        </View>

        {showDevDebugPanel ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>Dev Diagnostics</Text>
              <Pressable onPress={() => setShowDebugInfo((prev) => !prev)} style={[styles.pill, styles.pillGray]}>
                <Text style={styles.pillGrayText}>{showDebugInfo ? 'Hide debug' : 'Show debug'}</Text>
              </Pressable>
            </View>
            {showDebugInfo ? (
              <>
                <Text style={styles.debugText}>loading: {String(loading)}</Text>
                <Text style={styles.debugTextTight}>ready: {String(ready)}</Text>
                <Text style={styles.debugTextTight}>organizationProviderActive: {String(organizationProviderActive)}</Text>
                <Text style={styles.debugTextTight}>providerMountedAt: {providerMountedAt || 'null'}</Text>
                <Text style={styles.debugTextTight}>membershipLoadAttempt: {membershipLoadAttempt}</Text>
                <Text style={styles.debugTextTight}>membershipLoadError: {membershipLoadError || 'null'}</Text>
                <ScrollView style={styles.debugScroll}>
                  <Text style={styles.debugMono}>{JSON.stringify(membershipLoadDebug, null, 2)}</Text>
                </ScrollView>
                <Pressable
                  onPress={() => void refreshMemberships()}
                  style={[styles.pill, styles.pillSelfStart, styles.pillGray, styles.mt3]}
                >
                  <Text style={styles.pillGrayText}>Retry</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        {resolvedTokenInvite ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Invite Link</Text>
            <Text style={styles.valueTitle}>{resolvedTokenInvite.role_label || 'Organization Invite'}</Text>
            <Text style={styles.bodyTextTight}>Status: {resolvedTokenInvite.status}</Text>
            {resolvedTokenInvite.invitee_email ? (
              <Text style={styles.metaText}>Invited email: {resolvedTokenInvite.invitee_email}</Text>
            ) : null}
            {resolvedTokenInvite.invite_token ? (
              <Text style={styles.metaText}>Token: {resolvedTokenInvite.invite_token}</Text>
            ) : null}

            {!signedIn ? (
              <Text style={styles.amberText}>
                Sign in with the invited email to accept or decline this invite.
              </Text>
            ) : !canRespondToTokenInvite ? (
              <Text style={styles.amberText}>
                You are signed in as {user?.email || 'another account'}. Sign in with the invited email to respond.
              </Text>
            ) : canRespondToInviteStatus(resolvedTokenInvite.status) ? (
              <View style={[styles.row, styles.mt3]}>
                <Pressable
                  onPress={() => void handleTokenInviteResponse('accepted')}
                  disabled={tokenActionLoading}
                  style={[styles.pill, styles.mr2, tokenActionLoading ? styles.pillDisabled : styles.pillEmerald]}
                >
                  <Text style={tokenActionLoading ? styles.pillDisabledText : styles.pillEmeraldText}>Accept</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleTokenInviteResponse('declined')}
                  disabled={tokenActionLoading}
                  style={[styles.pill, tokenActionLoading ? styles.pillDisabled : styles.pillRose]}
                >
                  <Text style={tokenActionLoading ? styles.pillDisabledText : styles.pillRoseText}>Decline</Text>
                </Pressable>
              </View>
            ) : isInviteDecisionTerminal(resolvedTokenInvite.status) ? (
              <Text style={[styles.bodyTextTight, styles.mt3]}>
                This invite has already been {String(resolvedTokenInvite.status).toLowerCase()}.
              </Text>
            ) : null}
          </View>
        ) : null}

        {!ready || loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading organization memberships...</Text>
          </View>
        ) : membershipLoadError ? (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.errorTitle}>Could not load organizations</Text>
            <Text style={styles.errorBody}>{membershipLoadError}</Text>
            <Pressable
              onPress={() => void refreshMemberships()}
              style={[styles.pill, styles.pillSelfStart, styles.pillRose, styles.mt3]}
            >
              <Text style={styles.pillRoseText}>Retry</Text>
            </Pressable>
            {showDevDebugPanel && showDebugInfo && membershipLoadErrorPayload ? (
              <View style={[styles.debugScroll, styles.mt3]}>
                <Text style={styles.debugMono}>{JSON.stringify(membershipLoadErrorPayload, null, 2)}</Text>
              </View>
            ) : null}
          </View>
        ) : displayMemberships.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.valueTitleFlush}>No organization memberships yet</Text>
            <Text style={styles.bodyText}>
              You can still use BetterAt personally. Join a club or institution to unlock organization workspaces.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, styles.cardFlush]}>
              <Text style={styles.sectionLabelFlush}>Workspace Context</Text>
              {displayMemberships.map((membership) => {
                const isActive = activeOrganizationId === membership.organization_id;
                const org = membership.organization;
                return (
                  <Pressable
                    key={membership.id}
                    onPress={() => {
                      if (!isActive) {
                        void setActiveOrganizationId(membership.organization_id);
                      }
                    }}
                    style={styles.membershipRow}
                  >
                    <View style={styles.membershipInfo}>
                      <Text style={styles.membershipName}>{org?.name || 'Unnamed Organization'}</Text>
                      <Text style={styles.metaText}>
                        {formatOrgType(org?.organization_type)} • Role: {membership.role} • Membership: {membership.membership_status || membership.status}
                      </Text>
                    </View>
                    {isActive ? (
                      <View style={styles.row}>
                        <Text style={styles.currentBadge}>Current</Text>
                        <CheckCircle2 size={20} color="#007AFF" />
                      </View>
                    ) : (
                      <Circle size={20} color="#9CA3AF" />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Current Access</Text>
              <Text style={styles.valueTitle}>{activeOrganization?.name || 'No active organization'}</Text>
              <Text style={styles.bodyTextTight}>
                {activeMembership
                  ? `${formatOrgType(activeOrganization?.organization_type)} • ${activeMembership.role} • ${activeMembership.is_verified ? 'Verified member' : 'Not verified'}`
                  : 'Select an organization workspace above.'}
              </Text>
              {canManageActiveOrganization && (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push('/organization/members' as any)}
                >
                  <Text style={styles.primaryButtonText}>Manage Members</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Invite People</Text>
              <Text style={styles.bodyText}>
                Invite the clinical educators and support staff who guide experiential learning.
              </Text>

              {(params.inviteRole || params.inviteName || params.inviteEmail) && (
                <View style={styles.prefillBox}>
                  <Text style={styles.prefillLabel}>Prefilled Invite</Text>
                  <Text style={styles.prefillStrong}>
                    Role: {params.inviteRole ? String(params.inviteRole) : resolvedTokenInvite?.role_label || 'Not set'}
                  </Text>
                  {(params.inviteName || resolvedTokenInvite?.invitee_name) ? (
                    <Text style={styles.prefillMeta}>
                      Name: {params.inviteName ? String(params.inviteName) : String(resolvedTokenInvite?.invitee_name || '')}
                    </Text>
                  ) : null}
                  {(params.inviteEmail || resolvedTokenInvite?.invitee_email) ? (
                    <Text style={styles.prefillMeta}>
                      Email: {params.inviteEmail ? String(params.inviteEmail) : String(resolvedTokenInvite?.invitee_email || '')}
                    </Text>
                  ) : null}
                  {resolvedTokenInvite?.invite_token ? (
                    <Text style={styles.prefillMeta}>Token: {resolvedTokenInvite.invite_token}</Text>
                  ) : null}
                  {resolvedTokenInvite?.status ? (
                    <Text style={styles.prefillMeta}>Status: {resolvedTokenInvite.status}</Text>
                  ) : null}
                  <Pressable
                    onPress={() =>
                      void handleInviteByRole(
                        String(params.inviteRole || resolvedTokenInvite?.role_label || 'Team Member'),
                        {
                          name: params.inviteName ? String(params.inviteName) : (resolvedTokenInvite?.invitee_name || undefined),
                          email: params.inviteEmail ? String(params.inviteEmail) : (resolvedTokenInvite?.invitee_email || undefined),
                          participantId: params.participantId
                            ? String(params.participantId)
                            : (resolvedTokenInvite?.participant_id || undefined),
                          programId: params.programId
                            ? String(params.programId)
                            : (resolvedTokenInvite?.program_id || undefined),
                          sessionId: params.sessionId
                            ? String(params.sessionId)
                            : (resolvedTokenInvite?.session_id || undefined),
                        },
                        params.inviteRoleKey
                          ? String(params.inviteRoleKey)
                          : (resolvedTokenInvite?.role_key || undefined)
                      )
                    }
                    disabled={!canManageActiveOrganization}
                    style={[styles.pill, styles.pillBlock, canManageActiveOrganization ? styles.pillOutlineBlue : styles.pillDisabled]}
                  >
                    <Text style={canManageActiveOrganization ? styles.pillBlueText : styles.pillDisabledText}>
                      Send this invite
                    </Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.roleWrap}>
                {inviteRoleOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => void handleInviteByRole(option.role, undefined, option.key)}
                    disabled={!canManageActiveOrganization}
                    style={[styles.pill, styles.roleChip, canManageActiveOrganization ? styles.pillBlue : styles.pillDisabled]}
                  >
                    <Text style={canManageActiveOrganization ? styles.pillBlueText : styles.pillDisabledText}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {!canManageActiveOrganization && (
                <Text style={styles.amberTextTight}>
                  You need an admin/manager role in this workspace to send invites.
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionLabel}>Recent Invite Activity</Text>
                <Pressable onPress={() => void loadInviteHistory()} style={[styles.pillSmall, styles.pillBlue]}>
                  <Text style={styles.pillBlueTextSmall}>Refresh</Text>
                </Pressable>
              </View>

              {inviteHistoryLoading ? (
                <View style={[styles.row, styles.mt3]}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.inlineLoadingText}>Loading invite history...</Text>
                </View>
              ) : inviteHistory.length === 0 ? (
                <Text style={[styles.bodyText, styles.mt3]}>No invite records yet.</Text>
              ) : (
                <View style={styles.mt3}>
                  {inviteHistory.slice(0, 10).map((row) => (
                    <View key={row.id} style={styles.historyRow}>
                      <Text style={styles.historyTitle}>
                        {row.role_label}
                        {row.invitee_name ? ` • ${row.invitee_name}` : ''}
                        {row.invitee_email ? ` • ${row.invitee_email}` : ''}
                      </Text>
                      <Text style={styles.metaText}>
                        Status: {row.status} • Sent: {row.sent_at ? new Date(row.sent_at).toLocaleString() : 'n/a'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Default Content Visibility</Text>
              <Text style={styles.bodyText}>
                Set whether new organization content should default to public or members-only.
              </Text>

              <Pressable
                style={styles.visibilityRow}
                onPress={() => void handleChangeVisibility('public')}
                disabled={!canManageActiveOrganization || savingVisibility}
              >
                <View style={styles.visibilityIcon}>
                  {defaultContentVisibility === 'public' ? (
                    <CheckCircle2 size={18} color="#007AFF" />
                  ) : (
                    <Circle size={18} color="#9CA3AF" />
                  )}
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.optionTitle}>Public by default</Text>
                  <Text style={styles.metaText}>Anyone can view published content from this organization.</Text>
                </View>
              </Pressable>

              <Pressable
                style={[styles.visibilityRow, styles.mt2]}
                onPress={() => void handleChangeVisibility('org_members')}
                disabled={!canManageActiveOrganization || savingVisibility}
              >
                <View style={styles.visibilityIcon}>
                  {defaultContentVisibility === 'org_members' ? (
                    <CheckCircle2 size={18} color="#007AFF" />
                  ) : (
                    <Circle size={18} color="#9CA3AF" />
                  )}
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.optionTitle}>Members-only by default</Text>
                  <Text style={styles.metaText}>Only active members can view published content from this organization.</Text>
                </View>
              </Pressable>

              {!canManageActiveOrganization && (
                <Text style={styles.amberText}>
                  You need an admin/manager role in this workspace to change visibility defaults.
                </Text>
              )}

              {savingVisibility && (
                <View style={[styles.row, styles.mt3]}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.inlineLoadingText}>Saving visibility setting...</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardFlush: {
    padding: 0,
    overflow: 'hidden',
  },
  cardError: {
    borderColor: '#FECDD3',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabelFlush: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bodyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 20,
  },
  bodyTextTight: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  valueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
  },
  valueTitleFlush: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillBlock: {
    marginTop: 12,
    alignItems: 'center',
  },
  pillSelfStart: {
    alignSelf: 'flex-start',
  },
  pillBlue: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  pillBlueText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '500',
  },
  pillBlueTextSmall: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '500',
  },
  pillOutlineBlue: {
    borderColor: '#93C5FD',
    backgroundColor: '#FFFFFF',
  },
  pillGray: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  pillGrayText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '500',
  },
  pillDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  pillDisabledText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  pillEmerald: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  pillEmeraldText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '500',
  },
  pillRose: {
    borderColor: '#FECDD3',
    backgroundColor: '#FFF1F2',
  },
  pillRoseText: {
    color: '#BE123C',
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex1: {
    flex: 1,
  },
  mt2: {
    marginTop: 8,
  },
  mt3: {
    marginTop: 12,
  },
  mr2: {
    marginRight: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 12,
  },
  debugTextTight: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
  },
  debugScroll: {
    marginTop: 8,
    maxHeight: 192,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 12,
  },
  debugMono: {
    fontSize: 12,
    color: '#374151',
  },
  amberText: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 12,
  },
  amberTextTight: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 8,
  },
  loadingBlock: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    marginTop: 12,
  },
  inlineLoadingText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#BE123C',
  },
  errorBody: {
    fontSize: 14,
    color: '#BE123C',
    marginTop: 8,
  },
  membershipRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  membershipInfo: {
    flex: 1,
    paddingRight: 12,
  },
  membershipName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  currentBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
    marginRight: 8,
  },
  prefillBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  prefillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prefillStrong: {
    fontSize: 14,
    color: '#1E40AF',
    marginTop: 4,
  },
  prefillMeta: {
    fontSize: 12,
    color: '#1D4ED8',
    marginTop: 4,
  },
  roleWrap: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  roleChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  historyRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  visibilityRow: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  visibilityIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
});
