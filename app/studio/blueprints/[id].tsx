/**
 * Creator Studio · Blueprint editor (Frame 5)
 *
 * Two-column editor body:
 *   Left  · Cover card + About card (title, subtitle, description, duration, skill)
 *   Right · Pricing & access card (institutional/independent toggle + author credits)
 *           + Cohorts & mentors card
 *
 * The sidebar shifts from Studio-home shape to Editor shape: the
 * Practice/Studio/Mentor switcher is hidden; "Editing" eyebrow + the
 * blueprint name appear instead; section nav lists the editor sub-views;
 * Status block sits below; user card shows "Editing now" instead of email.
 *
 * Other tabs (Steps · Capabilities · Pricing & access · Cohorts · Mentor
 * settings · Activity) are stubbed — they render placeholders for Phase 3+.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest, type Interest } from '@/providers/InterestProvider';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import {
  useStudioBlueprint,
  COVER_GRADIENT_OPTIONS,
  BlueprintAccessMode,
  BlueprintAuthor,
  BlueprintBillingCadence,
  BlueprintCurrency,
  BlueprintDurationUnit,
  BlueprintSkillLevel,
} from '@/hooks/useStudioBlueprint';
import {
  useCreateBlueprint,
  useRemoveBlueprintCoAuthor,
  useUpdateBlueprintMeta,
} from '@/hooks/useBlueprintEditor';
import { useBlueprintPricing } from '@/hooks/useBlueprintPricing';
import { BlueprintCohortLinkSheet } from '@/components/admin/BlueprintCohortLinkSheet';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  StudioShell,
  StudioHeader,
  StudioPanel,
  StudioButton,
  StudioTabs,
  StudioNavSection,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';
import { Gradient } from '@/components/studio/Gradient';
import { BlueprintCoAuthorSheet } from '@/components/studio/BlueprintCoAuthorSheet';
import {
  StepsTabBody,
  CapabilitiesTabBody,
  PricingTabBody,
  CohortsTabBody,
  MentorSettingsTabBody,
  ActivityTabBody,
} from '@/components/studio/BlueprintEditorTabBodies';

type EditorTab =
  | 'overview'
  | 'steps'
  | 'capabilities'
  | 'pricing'
  | 'cohorts'
  | 'mentor'
  | 'activity';

const DURATION_UNITS: { value: BlueprintDurationUnit; label: string }[] = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
];

const SKILL_LEVELS: { value: BlueprintSkillLevel; label: string }[] = [
  { value: 'introductory', label: 'Introductory' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const CURRENCIES: { value: BlueprintCurrency; label: string }[] = [
  { value: 'usd', label: 'USD' },
  { value: 'hkd', label: 'HKD' },
  { value: 'gbp', label: 'GBP' },
  { value: 'eur', label: 'EUR' },
  { value: 'aud', label: 'AUD' },
  { value: 'cad', label: 'CAD' },
  { value: 'sgd', label: 'SGD' },
];

const BILLING_OPTIONS: { value: BlueprintBillingCadence; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one_time', label: 'One-time' },
];

export default function BlueprintEditorPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const blueprintId = typeof id === 'string' ? id : 'new';
  const { user, userProfile } = useAuth();
  const { currentInterest, userInterests, allInterests } = useInterest();
  const menu = useProfileMenuData();
  const { blueprint, isInstitutional, loading: blueprintLoading } = useStudioBlueprint(blueprintId);
  const isNew = blueprint.isNew;
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;

  const createBlueprint = useCreateBlueprint();
  const updateMeta = useUpdateBlueprintMeta(blueprintId);
  const { syncStripe } = useBlueprintPricing(blueprintId, blueprint.orgId);

  const [tab, setTab] = useState<EditorTab>('overview');
  const [title, setTitle] = useState(blueprint.title);
  const [subtitle, setSubtitle] = useState(blueprint.subtitle);
  const [description, setDescription] = useState(blueprint.description);
  const [interestId, setInterestId] = useState<string | null>(
    blueprint.interestId ?? currentInterest?.id ?? null,
  );
  const [durationValue, setDurationValue] = useState(blueprint.durationValue);
  const [durationUnit, setDurationUnit] = useState<BlueprintDurationUnit>(blueprint.durationUnit);
  const [skillLevel, setSkillLevel] = useState<BlueprintSkillLevel>(blueprint.skillLevel);
  const [accessMode, setAccessMode] = useState<BlueprintAccessMode>(
    blueprint.accessMode,
  );
  const [priceText, setPriceText] = useState(
    blueprint.pricePerMonth != null ? String(blueprint.pricePerMonth) : '',
  );
  const [currency, setCurrency] = useState<BlueprintCurrency>(blueprint.currency);
  const [billingCadence, setBillingCadence] = useState<BlueprintBillingCadence>(
    blueprint.billingCadence,
  );
  const [coverGradientIdx, setCoverGradientIdx] = useState(0);

  const interestOptions = React.useMemo(() => {
    const rows = userInterests.length > 0 ? userInterests : allInterests;
    const byId = new Map<string, Interest>();
    rows.forEach((interest) => byId.set(interest.id, interest));
    if (currentInterest) byId.set(currentInterest.id, currentInterest);
    return Array.from(byId.values());
  }, [allInterests, currentInterest, userInterests]);

  // Seed local form state once per loaded record (on id change or first
  // load). Resyncing on every refetched field value would wipe in-progress
  // typing whenever a background refetch lands.
  const formSyncKey = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (blueprintLoading) return;
    if (formSyncKey.current === blueprint.id) return;
    formSyncKey.current = blueprint.id;
    setTitle(blueprint.title);
    setSubtitle(blueprint.subtitle);
    setDescription(blueprint.description);
    setInterestId(blueprint.interestId ?? currentInterest?.id ?? null);
    setDurationValue(blueprint.durationValue);
    setDurationUnit(blueprint.durationUnit);
    setSkillLevel(blueprint.skillLevel);
    setAccessMode(blueprint.accessMode);
    setPriceText(blueprint.pricePerMonth != null ? String(blueprint.pricePerMonth) : '');
    setCurrency(blueprint.currency);
    setBillingCadence(blueprint.billingCadence);
  }, [blueprintLoading, blueprint, currentInterest?.id]);

  React.useEffect(() => {
    if (!isNew || interestId || !currentInterest?.id) return;
    setInterestId(currentInterest.id);
  }, [currentInterest?.id, interestId, isNew]);

  function parsePriceCents(): number | null {
    const trimmed = priceText.trim();
    if (trimmed === '') return 0;
    const parsed = parseFloat(trimmed);
    if (!isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }

  function parseDurationValue(): number | null {
    const parsed = parseInt(durationValue, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }

  function liveVersionLabel(current: string): string {
    const trimmed = current.trim();
    if (!trimmed || /^v0\./i.test(trimmed)) return 'v1.0 live';
    if (/draft/i.test(trimmed)) return trimmed.replace(/draft/ig, 'live');
    if (/live/i.test(trimmed)) return trimmed;
    return `${trimmed} live`;
  }

  const busy = createBlueprint.isPending || updateMeta.isPending || syncStripe.isPending;

  async function handleCreate() {
    if (!user) return;
    try {
      const { id: newId } = await createBlueprint.mutateAsync({
        title,
        subtitle,
        description,
        accessMode,
        orgId: blueprint.orgId,
        interestId,
        pricePerSeatCents: accessMode === 'independent' ? parsePriceCents() : null,
        billingCadence,
        currency,
        durationValue: parseDurationValue(),
        durationUnit,
        skillLevel,
        authorUserId: user.id,
      });
      router.replace(`/studio/blueprints/${newId}`);
    } catch (err) {
      showAlert('Could not create blueprint', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  async function handlePublish() {
    try {
      const priceCents = accessMode === 'independent' ? parsePriceCents() : null;
      if (accessMode === 'independent' && priceCents == null) {
        showAlert('Enter a valid price', 'Use 0 for a free blueprint, or enter a paid price.');
        return;
      }
      await updateMeta.mutateAsync({
        title,
        subtitle,
        description,
        interestId,
        accessMode,
        orgId: blueprint.orgId,
        pricePerSeatCents: priceCents,
        billingCadence,
        currency,
        durationValue: parseDurationValue(),
        durationUnit,
        skillLevel,
      });
      if (accessMode === 'independent' && priceCents != null && priceCents > 0) {
        await syncStripe.mutateAsync();
      }
      await updateMeta.mutateAsync({
        status: 'live',
        version: liveVersionLabel(blueprint.version),
        publishedAt: new Date().toISOString(),
      });
      if (accessMode === 'independent') {
        showAlert(
          'Published',
          priceCents != null && priceCents > 0
            ? 'Saved and listed on Stripe. It will now appear in the marketplace catalog.'
            : 'Saved as a free blueprint. It will now appear in the marketplace catalog.',
        );
      } else {
        showAlert('Published', 'Saved and published to your workspace.');
      }
    } catch (err) {
      showAlert('Publish failed', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  function handlePreview() {
    if (accessMode !== 'independent') {
      showAlert('Preview unavailable', 'Institution-managed blueprint previews are not wired yet.');
      return;
    }
    // The marketplace page only serves 'live' blueprints (the RPC returns
    // not_listed otherwise), so previewing a draft would dead-end on the
    // "isn't listed" screen. Guide the author to publish first.
    if (blueprint.status !== 'live') {
      showAlert('Publish to preview', 'Publish this blueprint to see its public marketplace listing.');
      return;
    }
    router.push(`/marketplace/${blueprint.id}` as any);
  }

  if (!user || menu.loading) {
    return <StudioLoading />;
  }

  const displayName =
    userProfile?.full_name || userProfile?.display_name || user?.email || 'You';
  const initials = getInitials(displayName);
  // Org chrome follows the blueprint's owning org (not the user's last
  // active membership), so opening a JHSON blueprint while RHKYC is your
  // "default" org still puts you in JHSON's studio chrome.
  const blueprintOrgMembership = blueprint.orgId
    ? menu.memberships.find((m) => m.org_id === blueprint.orgId)
    : null;
  const activeOrg = blueprintOrgMembership ?? menu.activeOrg;
  const orgShortName = activeOrg ? shortNameLabel(activeOrg.org_name) : null;

  const navSections: StudioNavSection[] = [
    {
      eyebrow: 'Editing',
      items: [
        {
          key: 'this',
          icon: 'git-branch-outline',
          label: title || 'Untitled blueprint',
          count: blueprint.status === 'draft' ? 'Draft' : undefined,
          active: true,
        },
      ],
    },
    {
      eyebrow: 'Sections',
      items: [
        {
          key: 'cover',
          icon: 'image-outline',
          label: 'Cover & about',
          active: tab === 'overview',
          onPress: () => setTab('overview'),
        },
        {
          key: 'steps',
          icon: 'list-outline',
          label: 'Steps',
          count: `${blueprint.stepsWritten} / ${blueprint.estimatedSteps}`,
          active: tab === 'steps',
          onPress: () => setTab('steps'),
        },
        {
          key: 'capabilities',
          icon: 'flag-outline',
          label: 'Capabilities & outcomes',
          active: tab === 'capabilities',
          onPress: () => setTab('capabilities'),
        },
        {
          key: 'pricing',
          icon: 'pricetag-outline',
          label: 'Pricing & access',
          active: tab === 'pricing',
          onPress: () => setTab('pricing'),
        },
        {
          key: 'cohorts',
          icon: 'people-outline',
          label: 'Cohorts & mentors',
          active: tab === 'cohorts',
          onPress: () => setTab('cohorts'),
        },
        {
          key: 'mentor',
          icon: 'chatbubble-outline',
          label: 'Mentor settings',
          active: tab === 'mentor',
          onPress: () => setTab('mentor'),
        },
      ],
    },
    {
      eyebrow: 'Status',
      items: [],
      footer: (
        <View>
          <Text style={styles.statusLabel}>
            {blueprint.status === 'draft' ? `Draft · ${blueprint.version}` : blueprint.status.toUpperCase()}
          </Text>
          <Text style={styles.statusBody}>
            {blueprint.stepsWritten < blueprint.estimatedSteps
              ? `Add ${blueprint.estimatedSteps - blueprint.stepsWritten} more steps, set pricing, request peer review before publishing.`
              : 'Set pricing and request peer review before publishing.'}
          </Text>
        </View>
      ),
    },
  ];

  const tabs = [
    { key: 'overview', label: 'Overview' },
    {
      key: 'steps',
      label: 'Steps',
      count: `${blueprint.stepsWritten} of ${blueprint.estimatedSteps}`,
    },
    { key: 'capabilities', label: 'Capabilities' },
    { key: 'pricing', label: 'Pricing & access' },
    { key: 'cohorts', label: 'Cohorts' },
    { key: 'mentor', label: 'Mentor settings' },
    { key: 'activity', label: 'Activity' },
  ];
  const compactEditorTabs: StudioNavSection['items'] = [
    {
      key: 'overview',
      icon: 'image-outline',
      label: 'About',
      active: tab === 'overview',
      onPress: () => setTab('overview'),
    },
    {
      key: 'steps',
      icon: 'list-outline',
      label: 'Steps',
      count: blueprint.stepsWritten,
      active: tab === 'steps',
      onPress: () => setTab('steps'),
    },
    {
      key: 'capabilities',
      icon: 'flag-outline',
      label: 'Skills',
      active: tab === 'capabilities',
      onPress: () => setTab('capabilities'),
    },
    {
      key: 'pricing',
      icon: 'pricetag-outline',
      label: 'Price',
      active: tab === 'pricing',
      onPress: () => setTab('pricing'),
    },
    {
      key: 'cohorts',
      icon: 'people-outline',
      label: 'Cohorts',
      active: tab === 'cohorts',
      onPress: () => setTab('cohorts'),
    },
  ];

  return (
    <View style={styles.root}>
      <StudioShell
        accent="purple"
        org={{
          name: activeOrg ? activeOrg.org_name : 'Personal',
          role: `Studio · ${displayName.split(' ').slice(0, 2).join(' ')}`,
          mono: activeOrg ? activeOrg.org_short_name : initials,
          monoColor: activeOrg ? 'navy' : 'solo',
        }}
        ctxLens="studio"
        ctxLensOptions={['practice', 'studio']}
        onCtxChange={(lens) => {
          if (lens === 'practice') router.push('/');
        }}
        navSections={navSections}
        user={{
          name: displayName,
          email: user?.email ?? '',
          initials,
          statusLine: 'Editing now',
        }}
        compactBottomTabs={compactEditorTabs}
      >
        <StudioHeader
          compact={compact}
          crumbs={['Creator Studio', 'Blueprints', title || 'Untitled blueprint']}
          onCrumbPress={() => router.push('/studio')}
          title={title || 'Untitled blueprint'}
          subtitleParts={[
            <Text key="last-saved" style={styles.subText}>
              {blueprint.lastSavedLabel}
            </Text>,
            ...(blueprint.coAuthorInvited
              ? [
                  <Text key="coauth" style={styles.coauthorText}>
                    Co-author invited: {blueprint.coAuthorInvited}
                  </Text>,
                ]
              : []),
          ]}
          pill={{
            label:
              blueprint.status === 'draft'
                ? `Draft · ${blueprint.version}`
                : blueprint.status.toUpperCase(),
            tone: blueprint.status === 'draft' ? 'amber' : 'green',
          }}
          actions={
            <>
              {!isNew ? (
                <StudioButton
                  variant="muted"
                  icon="eye-outline"
                  label="Preview"
                  onPress={handlePreview}
                />
              ) : null}
              <StudioButton
                variant="primary"
                accent="purple"
                icon={
                  isNew
                    ? 'add-circle-outline'
                    : blueprint.status === 'live'
                    ? 'sync-outline'
                    : 'rocket-outline'
                }
                label={
                  busy
                    ? 'Working…'
                    : isNew
                    ? 'Create blueprint'
                    : blueprint.status === 'live'
                    ? 'Update'
                    : isInstitutional && orgShortName
                    ? `Publish to ${orgShortName}`
                    : 'Publish'
                }
                onPress={busy ? undefined : isNew ? handleCreate : handlePublish}
              />
            </>
          }
        />

        {compact ? null : (
          <StudioTabs
            tabs={tabs}
            active={tab}
            accent="purple"
            scrollable={compact}
            onChange={(k) => setTab(k as EditorTab)}
          />
        )}

        {tab !== 'overview' && isNew ? (
          <SaveFirstBody onGoToOverview={() => setTab('overview')} />
        ) : tab === 'overview' ? (
          <OverviewBody
            blueprint={blueprint}
            isInstitutional={isInstitutional}
            orgShortName={orgShortName}
            authorCreditOrgId={blueprint.orgId ?? activeOrg?.org_id ?? menu.memberships[0]?.org_id ?? null}
            title={title}
            onTitle={setTitle}
            subtitle={subtitle}
            onSubtitle={setSubtitle}
            description={description}
            onDescription={setDescription}
            interests={interestOptions}
            selectedInterestId={interestId}
            onInterestId={setInterestId}
            durationValue={durationValue}
            onDurationValue={setDurationValue}
            durationUnit={durationUnit}
            onDurationUnit={setDurationUnit}
            skillLevel={skillLevel}
            onSkillLevel={setSkillLevel}
            accessMode={accessMode}
            onAccessMode={setAccessMode}
            priceText={priceText}
            onPriceText={setPriceText}
            currency={currency}
            onCurrency={setCurrency}
            billingCadence={billingCadence}
            onBillingCadence={setBillingCadence}
            coverGradientIdx={coverGradientIdx}
            onCoverGradient={setCoverGradientIdx}
          />
        ) : tab === 'steps' ? (
          <StepsTabBody blueprintId={blueprintId} orgId={blueprint.orgId} />
        ) : tab === 'capabilities' ? (
          <CapabilitiesTabBody blueprintId={blueprintId} orgId={blueprint.orgId} />
        ) : tab === 'pricing' ? (
          <PricingTabBody
            blueprintId={blueprintId}
            orgId={blueprint.orgId}
            orgName={blueprint.orgName}
            orgShort={blueprint.orgShort}
          />
        ) : tab === 'cohorts' ? (
          <CohortsTabBody
            blueprintId={blueprintId}
            orgId={blueprint.orgId}
            accessMode={accessMode}
          />
        ) : tab === 'mentor' ? (
          <MentorSettingsTabBody blueprintId={blueprintId} orgId={blueprint.orgId} />
        ) : tab === 'activity' ? (
          <ActivityTabBody blueprintId={blueprintId} />
        ) : (
          <StubTabBody tab={tab} />
        )}
      </StudioShell>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Overview tab body — left (cover + about) / right (pricing + cohorts)
// ---------------------------------------------------------------------------

function OverviewBody({
  blueprint,
  isInstitutional,
  orgShortName,
  authorCreditOrgId,
  title,
  onTitle,
  subtitle,
  onSubtitle,
  description,
  onDescription,
  interests,
  selectedInterestId,
  onInterestId,
  durationValue,
  onDurationValue,
  durationUnit,
  onDurationUnit,
  skillLevel,
  onSkillLevel,
  accessMode,
  onAccessMode,
  priceText,
  onPriceText,
  currency,
  onCurrency,
  billingCadence,
  onBillingCadence,
  coverGradientIdx,
  onCoverGradient,
}: {
  blueprint: ReturnType<typeof useStudioBlueprint>['blueprint'];
  isInstitutional: boolean;
  orgShortName: string | null;
  authorCreditOrgId: string | null;
  title: string;
  onTitle: (v: string) => void;
  subtitle: string;
  onSubtitle: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
  interests: Interest[];
  selectedInterestId: string | null;
  onInterestId: (v: string | null) => void;
  durationValue: string;
  onDurationValue: (v: string) => void;
  durationUnit: BlueprintDurationUnit;
  onDurationUnit: (v: BlueprintDurationUnit) => void;
  skillLevel: BlueprintSkillLevel;
  onSkillLevel: (v: BlueprintSkillLevel) => void;
  accessMode: BlueprintAccessMode;
  onAccessMode: (m: BlueprintAccessMode) => void;
  priceText: string;
  onPriceText: (v: string) => void;
  currency: BlueprintCurrency;
  onCurrency: (v: BlueprintCurrency) => void;
  billingCadence: BlueprintBillingCadence;
  onBillingCadence: (v: BlueprintBillingCadence) => void;
  coverGradientIdx: number;
  onCoverGradient: (i: number) => void;
}) {
  const gradient = COVER_GRADIENT_OPTIONS[coverGradientIdx];
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;

  const coverCard = (
    <CoverCard
      gradient={gradient}
      orgShort={blueprint.orgShort}
      orgName={blueprint.orgName}
      title={title}
      onPickGradient={onCoverGradient}
      selectedIdx={coverGradientIdx}
    />
  );
  const aboutCard = (
    <AboutCard
      title={title}
      onTitle={onTitle}
      subtitle={subtitle}
      onSubtitle={onSubtitle}
      description={description}
      onDescription={onDescription}
      interests={interests}
      selectedInterestId={selectedInterestId}
      onInterestId={onInterestId}
      durationValue={durationValue}
      onDurationValue={onDurationValue}
      durationUnit={durationUnit}
      onDurationUnit={onDurationUnit}
      skillLevel={skillLevel}
      onSkillLevel={onSkillLevel}
    />
  );
  const pricingCard = (
    <PricingCard
      accessMode={accessMode}
      onAccessMode={onAccessMode}
      priceText={priceText}
      onPriceText={onPriceText}
      currency={currency}
      onCurrency={onCurrency}
      billingCadence={billingCadence}
      onBillingCadence={onBillingCadence}
      isInstitutional={isInstitutional}
      orgShortName={orgShortName}
      authors={blueprint.authors}
      isNew={blueprint.isNew}
      blueprintId={blueprint.id}
      orgId={accessMode === 'institutional' ? authorCreditOrgId : null}
    />
  );
  const cohortsCard = (
    <CohortsCard
      cohorts={blueprint.cohorts}
      blueprintId={blueprint.id}
      orgId={blueprint.orgId}
      isNew={blueprint.isNew}
      blueprintTitle={title || blueprint.title || 'this blueprint'}
      accessMode={accessMode}
    />
  );

  // Keep Overview in a single scroll container so tall cards and native
  // select popovers are not clipped by independent fixed-height columns.
  if (compact) {
    return (
      <ScrollView style={styles.editorBodyScroll} contentContainerStyle={styles.colInner}>
        {coverCard}
        {aboutCard}
        {pricingCard}
        {cohortsCard}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.editorBodyScroll} contentContainerStyle={styles.editorBodyInner}>
      <View style={styles.editorGrid}>
        <View style={styles.leftCol}>
          {coverCard}
          {aboutCard}
        </View>

        <View style={styles.rightCol}>
          {pricingCard}
          {cohortsCard}
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Cover card
// ---------------------------------------------------------------------------

function CoverCard({
  gradient,
  orgShort,
  orgName,
  title,
  onPickGradient,
  selectedIdx,
}: {
  gradient: [string, string];
  orgShort: string | null;
  orgName: string | null;
  title: string;
  onPickGradient: (i: number) => void;
  selectedIdx: number;
}) {
  return (
    <StudioPanel title="Cover" meta={<Text style={styles.panelMetaText}>1080 × 1350 · shown on Discover</Text>}>
      <View style={cover.body}>
        <Gradient colors={gradient} style={cover.preview}>
          {orgShort ? (
            <View style={cover.badge}>
              <Text style={cover.badgeText}>{orgShort}</Text>
            </View>
          ) : null}
          <View style={cover.previewText}>
            {orgName ? <Text style={cover.previewOrg}>{orgName.toUpperCase()}</Text> : null}
            <Text style={cover.previewTitle} numberOfLines={2}>
              {title || 'Untitled\nBlueprint'}
            </Text>
          </View>
        </Gradient>
        <View style={cover.actions}>
          <StudioButton variant="ghost" icon="cloud-upload-outline" label="Replace image" />
          <StudioButton variant="ghost" icon="color-palette-outline" label="Generate gradient" />
          <View style={cover.swatchRow}>
            {COVER_GRADIENT_OPTIONS.map((g, i) => (
              <Pressable
                key={i}
                onPress={() => onPickGradient(i)}
                style={[cover.swatch, i === selectedIdx && cover.swatchOn]}
              >
                <Gradient colors={g} style={cover.swatchFill} />
              </Pressable>
            ))}
          </View>
          <Text style={cover.help}>
            Covers show on Discover & subscriber Library. They never appear inside a step.
          </Text>
        </View>
      </View>
    </StudioPanel>
  );
}

// ---------------------------------------------------------------------------
// About card — title, subtitle, description, duration, skill
// ---------------------------------------------------------------------------

function AboutCard({
  title,
  onTitle,
  subtitle,
  onSubtitle,
  description,
  onDescription,
  interests,
  selectedInterestId,
  onInterestId,
  durationValue,
  onDurationValue,
  durationUnit,
  onDurationUnit,
  skillLevel,
  onSkillLevel,
}: {
  title: string;
  onTitle: (v: string) => void;
  subtitle: string;
  onSubtitle: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
  interests: Interest[];
  selectedInterestId: string | null;
  onInterestId: (v: string | null) => void;
  durationValue: string;
  onDurationValue: (v: string) => void;
  durationUnit: BlueprintDurationUnit;
  onDurationUnit: (v: BlueprintDurationUnit) => void;
  skillLevel: BlueprintSkillLevel;
  onSkillLevel: (v: BlueprintSkillLevel) => void;
}) {
  return (
    <StudioPanel title="About this blueprint" meta={<Text style={styles.panelMetaText}>Shown on Discover detail</Text>}>
      <View style={about.body}>
        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={onTitle}
            placeholder="Untitled blueprint"
            style={about.input}
            placeholderTextColor="rgba(60, 60, 67, 0.4)"
          />
        </Field>
        <Field label="Sub-title · one line">
          <TextInput
            value={subtitle}
            onChangeText={onSubtitle}
            placeholder="A short hook that shows on Discover."
            style={about.input}
            placeholderTextColor="rgba(60, 60, 67, 0.4)"
          />
        </Field>
        <Field label="Interest">
          {interests.length === 0 ? (
            <Text style={about.helpText}>
              No interests available yet. Add an interest from your profile first.
            </Text>
          ) : (
            <View style={about.optionWrap}>
              {interests.map((interest) => (
                <ChoicePill
                  key={interest.id}
                  label={interest.name}
                  selected={selectedInterestId === interest.id}
                  onPress={() => onInterestId(interest.id)}
                />
              ))}
            </View>
          )}
        </Field>
        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={onDescription}
            placeholder="What is this blueprint for? Who is it for? What will a subscriber take away?"
            multiline
            style={[about.input, about.inputMultiline]}
            placeholderTextColor="rgba(60, 60, 67, 0.4)"
          />
        </Field>
        <Field label="Estimated duration">
          <View style={about.durationRow}>
            <TextInput
              value={durationValue}
              onChangeText={(next) => onDurationValue(next.replace(/[^\d]/g, ''))}
              placeholder="12"
              style={[about.input, about.durationNumberInput]}
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              keyboardType="number-pad"
            />
            <View style={about.optionWrap}>
              {DURATION_UNITS.map((unit) => (
                <ChoicePill
                  key={unit.value}
                  label={unit.label}
                  selected={durationUnit === unit.value}
                  onPress={() => onDurationUnit(unit.value)}
                />
              ))}
            </View>
          </View>
        </Field>
        <Field label="Skill level">
          <View style={about.optionWrap}>
            {SKILL_LEVELS.map((level) => (
              <ChoicePill
                key={level.value}
                label={level.label}
                selected={skillLevel === level.value}
                onPress={() => onSkillLevel(level.value)}
              />
            ))}
          </View>
        </Field>
      </View>
    </StudioPanel>
  );
}

function ChoicePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[about.choicePill, selected && about.choicePillOn]}>
      <Text style={[about.choiceText, selected && about.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  children,
  flex,
}: {
  label: string;
  children: React.ReactNode;
  flex?: number;
}) {
  return (
    <View style={[about.field, flex !== undefined && { flex }]}>
      <Text style={about.label}>{label}</Text>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pricing & access card
// ---------------------------------------------------------------------------

function PricingCard({
  accessMode,
  onAccessMode,
  priceText,
  onPriceText,
  currency,
  onCurrency,
  billingCadence,
  onBillingCadence,
  isInstitutional,
  orgShortName,
  authors,
  isNew,
  blueprintId,
  orgId,
}: {
  accessMode: BlueprintAccessMode;
  onAccessMode: (m: BlueprintAccessMode) => void;
  priceText: string;
  onPriceText: (v: string) => void;
  currency: BlueprintCurrency;
  onCurrency: (v: BlueprintCurrency) => void;
  billingCadence: BlueprintBillingCadence;
  onBillingCadence: (v: BlueprintBillingCadence) => void;
  isInstitutional: boolean;
  orgShortName: string | null;
  authors: BlueprintAuthor[];
  isNew: boolean;
  blueprintId: string;
  orgId: string | null;
}) {
  const [coAuthorSheetOpen, setCoAuthorSheetOpen] = useState(false);
  const removeCoAuthor = useRemoveBlueprintCoAuthor(blueprintId, orgId);

  const handleAddCoAuthor = () => {
    if (isNew) {
      showAlert('Create the blueprint first', 'Save this blueprint before inviting a co-author.');
      return;
    }
    setCoAuthorSheetOpen(true);
  };

  const handleRemoveCoAuthor = async (author: BlueprintAuthor) => {
    if (author.is_primary || removeCoAuthor.isPending) return;
    try {
      await removeCoAuthor.mutateAsync(author.user_id);
    } catch (err) {
      showAlert('Could not remove co-author', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <>
      <StudioPanel title="Pricing & access" meta={<Text style={styles.panelMetaText}>How students get this</Text>}>
        <View style={pricing.body}>
          <Text style={pricing.eyebrow}>Access mode</Text>
          <View style={pricing.modeRow}>
            <Pressable
              onPress={() => onAccessMode('institutional')}
              style={[pricing.modeCard, accessMode === 'institutional' && pricing.modeCardOn]}
            >
              <View style={pricing.modeHead}>
                {accessMode === 'institutional' ? (
                  <Ionicons name="checkmark-circle" size={14} color="#6B5BBF" />
                ) : null}
                <Text
                  style={[
                    pricing.modeTitle,
                    accessMode === 'institutional' && pricing.modeTitleOn,
                  ]}
                >
                  {orgShortName ? `${orgShortName}-managed` : 'Institution-managed'}
                </Text>
              </View>
              <Text style={pricing.modeBody}>
                {isInstitutional
                  ? `Free to all seated students. ${orgShortName ?? 'The institution'} pays the institutional fee.`
                  : 'Requires an institution. Join one to enable.'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onAccessMode('independent')}
              style={[pricing.modeCard, accessMode === 'independent' && pricing.modeCardOn]}
            >
              <View style={pricing.modeHead}>
                {accessMode === 'independent' ? (
                  <Ionicons name="checkmark-circle" size={14} color="#6B5BBF" />
                ) : null}
                <Text
                  style={[
                    pricing.modeTitle,
                    accessMode === 'independent' && pricing.modeTitleOn,
                  ]}
                >
                  Independent sale
                </Text>
              </View>
              <Text style={pricing.modeBody}>
                Anyone can buy it. You receive payouts.
              </Text>
            </Pressable>
          </View>

        {accessMode === 'institutional' && isInstitutional ? (
          <View style={pricing.instNote}>
            <Text style={pricing.instText}>
              Because this blueprint is part of the{' '}
              <Text style={pricing.instStrong}>
                {orgShortName ?? 'institutional'} plan
              </Text>
              , you don't set a personal price and you won't receive payouts.{' '}
              {orgShortName ?? "The institution"}'s plan covers your authorship under your faculty agreement.
            </Text>
            <Pressable style={pricing.instLinkRow}>
              <Ionicons name="arrow-forward" size={12} color="#28406B" />
              <Text style={pricing.instLink}>
                View your author terms with {orgShortName ?? 'the institution'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={pricing.independentFields}>
            <View style={pricing.priceRow}>
              <Field label="Price" flex={1}>
                <TextInput
                  value={priceText}
                  onChangeText={onPriceText}
                  placeholder="9"
                  style={about.input}
                  placeholderTextColor="rgba(60, 60, 67, 0.4)"
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>
            <Field label="Currency">
              <View style={about.optionWrap}>
                {CURRENCIES.map((option) => (
                  <ChoicePill
                    key={option.value}
                    label={option.label}
                    selected={currency === option.value}
                    onPress={() => onCurrency(option.value)}
                  />
                ))}
              </View>
            </Field>
            <Field label="Billing">
              <View style={about.optionWrap}>
                {BILLING_OPTIONS.map((option) => (
                  <ChoicePill
                    key={option.value}
                    label={option.label}
                    selected={billingCadence === option.value}
                    onPress={() => onBillingCadence(option.value)}
                  />
                ))}
              </View>
            </Field>
          </View>
        )}

          <Text style={[pricing.eyebrow, { marginTop: 4 }]}>Author credit · for the cover</Text>
          <View style={pricing.chipRow}>
            {authors.map((a) => (
              <View key={a.user_id} style={pricing.authorChip}>
                <View style={[pricing.authorAvi, { backgroundColor: a.gradient[0] }]}>
                  <Text style={pricing.authorAviText}>{a.initials}</Text>
                </View>
                <Text style={pricing.authorName}>{a.display_name}</Text>
                {a.is_primary ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${a.display_name}`}
                    hitSlop={8}
                    onPress={() => handleRemoveCoAuthor(a)}
                  >
                    <Ionicons name="close" size={11} color="rgba(60, 60, 67, 0.55)" />
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add co-author"
              onPress={handleAddCoAuthor}
              style={pricing.authorAddChip}
            >
              <Ionicons name="add" size={12} color="#007AFF" />
              <Text style={pricing.authorAddText}>Add co-author</Text>
            </Pressable>
          </View>
        </View>
      </StudioPanel>
      <BlueprintCoAuthorSheet
        visible={coAuthorSheetOpen}
        blueprintId={blueprintId}
        orgId={orgId}
        existingAuthors={authors}
        onClose={() => setCoAuthorSheetOpen(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Cohorts card
// ---------------------------------------------------------------------------

function CohortsCard({
  cohorts,
  blueprintId,
  orgId,
  isNew,
  blueprintTitle,
  accessMode,
}: {
  cohorts: ReturnType<typeof useStudioBlueprint>['blueprint']['cohorts'];
  blueprintId: string;
  orgId: string | null;
  isNew: boolean;
  blueprintTitle: string;
  accessMode: BlueprintAccessMode;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  // Linking needs a saved blueprint (real id) and an owning org.
  const isInstitutional = accessMode === 'institutional';
  const canLink = isInstitutional && !isNew && !!orgId;

  if (!isInstitutional) {
    return (
      <StudioPanel
        title="Cohorts & mentors"
        meta={<Text style={styles.panelMetaText}>Institution-managed only</Text>}
      >
        <View style={cohort.body}>
          <Text style={cohort.empty}>
            Personal blueprints are shared with individual subscribers. Switch Pricing & access to
            Institution-managed when this blueprint should be assigned to cohorts.
          </Text>
        </View>
      </StudioPanel>
    );
  }

  return (
    <StudioPanel title="Cohorts & mentors" meta={<Text style={styles.panelMetaText}>Who's on this blueprint</Text>}>
      <View style={cohort.body}>
        {cohorts.length === 0 ? (
          <Text style={cohort.empty}>
            No cohorts assigned yet. Add a cohort to gate enrollment by class or season.
          </Text>
        ) : (
          cohorts.map((c) => (
            <View key={c.id} style={cohort.row}>
              <View style={cohort.rowInfo}>
                <Text style={cohort.name}>{c.name}</Text>
                <Text style={cohort.state}>
                  {c.state === 'pending'
                    ? `Pending${c.opensAtLabel ? ` — opens ${c.opensAtLabel}` : ''}`
                    : c.state === 'open'
                    ? 'Open'
                    : 'Closed'}
                </Text>
              </View>
              <View style={cohort.rowRight}>
                <Text style={cohort.enrolled}>
                  {c.enrolledCount} / {c.capacity} enrolled
                </Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(60, 60, 67, 0.4)" />
              </View>
            </View>
          ))
        )}
        <Pressable
          style={[cohort.addRow, !canLink && cohort.addRowDisabled]}
          disabled={!canLink}
          onPress={() => setLinkOpen(true)}
        >
          <Ionicons name="add" size={14} color={canLink ? '#007AFF' : 'rgba(60, 60, 67, 0.4)'} />
          <Text style={[cohort.addText, !canLink && cohort.addTextDisabled]}>
            {isNew ? 'Save the blueprint to add a cohort' : 'Add a cohort'}
          </Text>
        </Pressable>
      </View>

      {canLink ? (
        <BlueprintCohortLinkSheet
          visible={linkOpen}
          blueprintId={blueprintId}
          orgId={orgId as string}
          blueprintTitle={blueprintTitle}
          linkedCohortIds={cohorts.map((c) => c.id)}
          onClose={() => setLinkOpen(false)}
        />
      ) : null}
    </StudioPanel>
  );
}

// ---------------------------------------------------------------------------
// Stub for non-Overview tabs
// ---------------------------------------------------------------------------

// A new blueprint has no persisted row yet, so Steps / Capabilities / Cohorts /
// Mentor / Activity have nothing to read or write against (querying them by the
// literal route id "new" 400s). Send the author back to Overview to hit
// "Create blueprint" first.
function SaveFirstBody({ onGoToOverview }: { onGoToOverview: () => void }) {
  return (
    <View style={styles.stubWrap}>
      <View style={styles.stubInner}>
        <View style={styles.stubIconWrap}>
          <Ionicons name="save-outline" size={28} color="rgba(107, 91, 191, 0.6)" />
        </View>
        <Text style={styles.stubTitle}>Create the blueprint first</Text>
        <Text style={styles.stubBody}>
          Add a title and the basics on the Overview tab, then tap “Create blueprint.”
          Once it’s saved you can author steps, capabilities, cohorts, and more.
        </Text>
        <StudioButton
          variant="primary"
          accent="purple"
          icon="arrow-back-outline"
          label="Back to Overview"
          onPress={onGoToOverview}
        />
      </View>
    </View>
  );
}

function StubTabBody({ tab }: { tab: EditorTab }) {
  const labels: Record<EditorTab, string> = {
    overview: 'Overview',
    steps: 'Steps',
    capabilities: 'Capabilities & outcomes',
    pricing: 'Pricing & access',
    cohorts: 'Cohorts',
    mentor: 'Mentor settings',
    activity: 'Activity',
  };
  return (
    <View style={styles.stubWrap}>
      <View style={styles.stubInner}>
        <View style={styles.stubIconWrap}>
          <Ionicons name="construct-outline" size={28} color="rgba(107, 91, 191, 0.6)" />
        </View>
        <Text style={styles.stubTitle}>{labels[tab]} coming next</Text>
        <Text style={styles.stubBody}>
          This section is part of a later phase. The Overview tab is wired today —
          author cover, about copy, access mode, and cohorts assignment all live.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortNameLabel(orgName: string): string {
  // "Johns Hopkins · MSN" → "Hopkins MSN"; "Royal Hong Kong Yacht Club" → "RHKYC"
  if (orgName.includes(' · ')) {
    return orgName.split(' · ').slice(0, 2).join(' ');
  }
  const tokens = orgName.split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return orgName;
  // 3+ words: acronym
  return tokens.map((t) => t[0]).join('').toUpperCase();
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
  subText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.6)' },
  coauthorText: { fontSize: 13.5, color: '#6B5BBF' },
  panelMetaText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },

  // Sidebar status block (rendered inside the "Status" section footer)
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C99632',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusBody: {
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 15,
    marginTop: 4,
  },

  // Two-column editor body
  editorBodyScroll: { flex: 1, minHeight: 0 },
  editorBodyInner: { paddingBottom: 80 },
  editorGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  leftCol: { flex: 1.3, minWidth: 0, gap: 14 },
  rightCol: { flex: 1, minWidth: 0, gap: 14 },
  colInner: { gap: 14, paddingRight: 4, paddingBottom: 80 },

  // Stub
  stubWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stubInner: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 36,
    maxWidth: 460,
  },
  stubIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(107, 91, 191, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stubTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E' },
  stubBody: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },

});

const cover = StyleSheet.create({
  body: {
    flexDirection: 'row',
    // Next to the fixed 160pt preview, a narrow column (iPad portrait)
    // crushes the actions to ~100pt and wraps button labels one char per
    // line — let the actions block drop below the preview instead.
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  preview: {
    width: 160,
    height: 200,
    borderRadius: 12,
    padding: 14,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    ...({
      boxShadow: '0 8px 24px -10px rgba(184, 90, 102, 0.4)',
    } as any),
  },
  previewText: { zIndex: 1 },
  previewOrg: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.8)',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: -0.2,
    lineHeight: 17,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  actions: { flexGrow: 1, flexBasis: 180, gap: 8 },
  swatchRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 6,
    overflow: 'hidden',
  },
  swatchFill: { flex: 1 },
  swatchOn: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  help: {
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 15,
    marginTop: 6,
  },
});

const about = StyleSheet.create({
  body: {
    padding: 16,
    gap: 12,
  },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    fontSize: 14,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  inputMultiline: { minHeight: 90, paddingVertical: 11 },
  row: { flexDirection: 'row', gap: 12 },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  durationNumberInput: {
    width: 96,
    flexGrow: 0,
  },
  optionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  choicePill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    backgroundColor: '#FFFFFF',
  },
  choicePillOn: {
    borderColor: '#6B5BBF',
    backgroundColor: 'rgba(107, 91, 191, 0.10)',
  },
  choiceText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.85)',
  },
  choiceTextOn: {
    color: '#6B5BBF',
  },
  helpText: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 17,
  },
  selectInput: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 14, color: '#1C1C1E' },
});

const pricing = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    backgroundColor: '#FFFFFF',
  },
  modeCardOn: {
    borderWidth: 2,
    borderColor: '#6B5BBF',
    backgroundColor: 'rgba(107, 91, 191, 0.08)',
  },
  modeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  modeTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  modeTitleOn: { color: '#6B5BBF' },
  modeBody: {
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 16,
  },
  instNote: {
    padding: 12,
    backgroundColor: 'rgba(40, 64, 107, 0.05)',
    borderRadius: 9,
    borderLeftWidth: 2,
    borderLeftColor: '#28406B',
  },
  instText: { fontSize: 11.5, color: '#4D4A43', lineHeight: 17 },
  instStrong: { color: '#1C1C1E', fontWeight: '600' },
  instLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  instLink: { fontSize: 11.5, color: '#28406B', fontWeight: '600' },
  independentRow: { flexDirection: 'row', gap: 12 },
  independentFields: { gap: 12 },
  priceRow: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  authorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    backgroundColor: '#EFEFF4',
    borderRadius: 999,
  },
  authorAvi: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAviText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '700' },
  authorName: { fontSize: 12, color: '#1C1C1E' },
  authorAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderStyle: 'dashed',
    borderRadius: 999,
  },
  authorAddText: { fontSize: 12, color: '#007AFF' },
});

const cohort = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingVertical: 4 },
  empty: {
    paddingVertical: 14,
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  rowInfo: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  state: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  enrolled: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  addText: { fontSize: 13, color: '#007AFF', fontWeight: '500' },
  addRowDisabled: { opacity: 0.6 },
  addTextDisabled: { color: 'rgba(60, 60, 67, 0.4)' },
});
