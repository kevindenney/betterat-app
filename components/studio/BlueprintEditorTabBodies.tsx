/**
 * Blueprint editor sub-tab bodies — Frames 18-23 of the JHSON Admin Suite.
 *
 * Six fully-rendered tab bodies that the existing /studio/blueprints/[id]
 * editor switches between when the user navigates Steps, Capabilities,
 * Pricing & access, Cohorts, Mentor settings, Activity. Cover tab is
 * already implemented as OverviewBody; these complete the editor.
 *
 * Demo data — all fields are visual today. Real wiring lands when the
 * blueprint_steps + blueprint_capabilities tables convene.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useBlueprintSteps,
  BlueprintStepTemplate,
  BlueprintSubStep,
  StepCategory,
} from '@/hooks/useBlueprintSteps';
import {
  useBlueprintCapabilities,
  CapabilityStrength,
  strengthLabel,
} from '@/hooks/useBlueprintCapabilities';
import { useBlueprintPricing } from '@/hooks/useBlueprintPricing';
import { useBlueprintCohorts } from '@/hooks/useBlueprintCohorts';
import { useBlueprintActivity } from '@/hooks/useBlueprintActivity';

// =============================================================================
// FRAME 18 · STEPS
// =============================================================================

const CAT_TONES: Record<string, { bg: string; fg: string; label: string }> = {
  asmt: { bg: 'rgba(90, 107, 139, 0.14)', fg: '#5A6B8B', label: 'Assessment' },
  rsn: { bg: 'rgba(122, 90, 139, 0.14)', fg: '#7A5A8B', label: 'Clinical reasoning' },
  proc: { bg: 'rgba(139, 90, 60, 0.12)', fg: '#8B5A3C', label: 'Procedural' },
  comm: { bg: 'rgba(110, 139, 90, 0.14)', fg: '#6E8B5A', label: 'Communication' },
};

export function StepsTabBody({
  blueprintId,
  orgId,
}: {
  blueprintId: string;
  orgId: string | null;
}) {
  const { steps, loading, addStep, deleteStep, updateStep } = useBlueprintSteps(
    blueprintId,
    orgId,
  );
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // Auto-expand the second step (or first if there's only one) for visual
  // continuity with the design canonical — shows an in-line editor for at
  // least one row when the page first loads.
  React.useEffect(() => {
    if (expandedId) return;
    if (steps.length === 0) return;
    setExpandedId(steps[Math.min(1, steps.length - 1)].id);
  }, [steps, expandedId]);

  if (loading) {
    return (
      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        <Text style={s.sectionHint}>Loading steps…</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>Steps</Text>
          <Text style={s.sectionH2}>The shape students will work through</Text>
        </View>
        <Text style={s.sectionHint}>Click any row to expand · changes save inline</Text>
      </View>

      {steps.length === 0 ? (
        <View style={s.emptyStepsCard}>
          <Text style={s.emptyStepsText}>
            No steps yet. Click <Text style={{ fontWeight: '600' }}>Add step</Text> below to
            author the first one.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {steps.map((step, idx) => (
            <BlueprintStepRow
              key={step.id}
              step={step}
              displayN={idx + 1}
              expanded={expandedId === step.id}
              onToggleExpand={() =>
                setExpandedId((cur) => (cur === step.id ? null : step.id))
              }
              onSave={(input) =>
                updateStep.mutateAsync({ id: step.id, ...input })
              }
              onDelete={() => deleteStep.mutate(step.id)}
            />
          ))}
        </View>
      )}

      <Pressable
        style={s.addStep}
        onPress={() => addStep.mutate({ title: 'New step' })}
      >
        <View style={s.addStepPlus}>
          <Ionicons name="add" size={16} color="#28406B" />
        </View>
        <Text style={s.addStepLabel}>
          <Text style={{ fontWeight: '600' }}>
            {addStep.isPending ? 'Adding…' : 'Add step'}
          </Text>{' '}
          — blank, or duplicate the last one
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={s.addStepTempl}>Start from template ›</Text>
      </Pressable>
    </ScrollView>
  );
}

function categoryToCatKey(cat: StepCategory): 'asmt' | 'rsn' | 'proc' | 'comm' {
  switch (cat) {
    case 'assessment':
      return 'asmt';
    case 'reasoning':
      return 'rsn';
    case 'procedural':
      return 'proc';
    case 'communication':
      return 'comm';
    default:
      return 'comm';
  }
}

function BlueprintStepRow({
  step,
  displayN,
  expanded,
  onToggleExpand,
  onSave,
  onDelete,
}: {
  step: BlueprintStepTemplate;
  displayN: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onSave: (input: {
    title?: string;
    description?: string | null;
    whatQuestion?: string | null;
    subSteps?: BlueprintSubStep[];
    preceptorRole?: string | null;
  }) => Promise<unknown>;
  onDelete: () => void;
}) {
  const catKey = categoryToCatKey(step.category);
  const cat = CAT_TONES[catKey];

  const [title, setTitle] = React.useState(step.title);
  const [description, setDescription] = React.useState(step.description ?? '');
  const [whatQuestion, setWhatQuestion] = React.useState(step.whatQuestion ?? '');
  const [preceptorRole, setPreceptorRole] = React.useState(step.preceptorRole ?? '');
  const [subSteps, setSubSteps] = React.useState<BlueprintSubStep[]>(step.subSteps);

  React.useEffect(() => {
    setTitle(step.title);
    setDescription(step.description ?? '');
    setWhatQuestion(step.whatQuestion ?? '');
    setPreceptorRole(step.preceptorRole ?? '');
    setSubSteps(step.subSteps);
  }, [step.id, step.title, step.description, step.whatQuestion, step.preceptorRole, step.subSteps]);

  const persistTitle = () => {
    const next = title.trim();
    if (next && next !== step.title) onSave({ title: next });
  };
  const persistDescription = () => {
    const next = description.trim();
    if (next !== (step.description ?? '')) onSave({ description: next || null });
  };
  const persistWhat = () => {
    const next = whatQuestion.trim();
    if (next !== (step.whatQuestion ?? '')) onSave({ whatQuestion: next || null });
  };
  const persistPreceptor = () => {
    const next = preceptorRole.trim();
    if (next !== (step.preceptorRole ?? '')) onSave({ preceptorRole: next || null });
  };

  const updateSubStepAt = (idx: number, text: string) => {
    setSubSteps((cur) => cur.map((ss, i) => (i === idx ? { ...ss, text } : ss)));
  };
  const persistSubSteps = () => {
    const cleaned = subSteps
      .map((ss, i) => ({ n: i + 1, text: ss.text.trim() }))
      .filter((ss) => ss.text.length > 0);
    if (JSON.stringify(cleaned) !== JSON.stringify(step.subSteps)) onSave({ subSteps: cleaned });
  };
  const removeSubStepAt = (idx: number) => {
    const next = subSteps.filter((_, i) => i !== idx).map((ss, i) => ({ n: i + 1, text: ss.text }));
    setSubSteps(next);
    onSave({ subSteps: next });
  };
  const appendSubStep = () => {
    const next = [...subSteps, { n: subSteps.length + 1, text: '' }];
    setSubSteps(next);
  };

  return (
    <View style={[s.stepRow, expanded && s.stepRowExpanded]}>
      <View style={s.stepGrip}>
        <Ionicons name="reorder-three-outline" size={18} color="rgba(60, 60, 67, 0.3)" />
      </View>
      <View style={s.stepNum}>
        <Text style={s.stepNumText}>{displayN}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.stepTitleRow}>
          {expanded ? (
            <TextInput
              style={[s.stepInput, { flex: 1, marginRight: 8 }]}
              value={title}
              onChangeText={setTitle}
              onBlur={persistTitle}
              placeholder="Step title"
            />
          ) : (
            <Pressable style={{ flex: 1 }} onPress={onToggleExpand}>
              <Text style={s.stepTitle}>{step.title}</Text>
            </Pressable>
          )}
          <View style={[s.catChip, { backgroundColor: cat.bg }]}>
            <Text style={[s.catChipText, { color: cat.fg }]}>{cat.label}</Text>
          </View>
        </View>
        {expanded ? (
          <TextInput
            style={[s.stepInput, { marginTop: 6, minHeight: 56 }]}
            value={description}
            onChangeText={setDescription}
            onBlur={persistDescription}
            multiline
            placeholder="What does this step look like at the bedside?"
            placeholderTextColor="rgba(60, 60, 67, 0.4)"
          />
        ) : step.description ? (
          <Pressable onPress={onToggleExpand}>
            <Text style={s.stepDesc}>{step.description}</Text>
          </Pressable>
        ) : null}
        {!expanded && step.capabilityTags.length > 0 ? (
          <View style={s.tagRow}>
            {step.capabilityTags.map((t) => (
              <View key={t} style={s.tagChip}>
                <Text style={s.tagChipText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {expanded ? (
          <View style={s.stepEdit}>
            <View style={s.stepField}>
              <Text style={s.stepFieldLabel}>What — the question the student answers</Text>
              <TextInput
                style={s.stepInput}
                value={whatQuestion}
                onChangeText={setWhatQuestion}
                onBlur={persistWhat}
                placeholder="Phrase as a single question, asked at the bedside before action."
                placeholderTextColor="rgba(60, 60, 67, 0.4)"
              />
            </View>

            <View style={s.stepField}>
              <Text style={s.stepFieldLabel}>How — sub-steps shown to the student</Text>
              <View style={{ gap: 6 }}>
                {subSteps.map((ss, idx) => (
                  <View key={`${ss.n}-${idx}`} style={s.subStep}>
                    <View style={s.subStepGrip}>
                      <Ionicons
                        name="reorder-three-outline"
                        size={14}
                        color="rgba(60, 60, 67, 0.3)"
                      />
                    </View>
                    <View style={s.subStepN}>
                      <Text style={s.subStepNText}>{idx + 1}</Text>
                    </View>
                    <TextInput
                      style={s.subStepInput}
                      value={ss.text}
                      onChangeText={(text) => updateSubStepAt(idx, text)}
                      onBlur={persistSubSteps}
                      placeholder="Sub-step text"
                      placeholderTextColor="rgba(60, 60, 67, 0.4)"
                    />
                    <Pressable hitSlop={4} onPress={() => removeSubStepAt(idx)}>
                      <Ionicons name="close" size={12} color="rgba(60, 60, 67, 0.4)" />
                    </Pressable>
                  </View>
                ))}
              </View>
              <Pressable style={s.addSub} onPress={appendSubStep}>
                <Ionicons name="add" size={12} color="rgba(60, 60, 67, 0.6)" />
                <Text style={s.addSubText}>Add sub-step</Text>
              </Pressable>
            </View>

            <View style={s.stepFieldRow}>
              <View style={s.stepField}>
                <Text style={s.stepFieldLabel}>Who — preceptor role (optional)</Text>
                <TextInput
                  style={s.stepInput}
                  value={preceptorRole}
                  onChangeText={setPreceptorRole}
                  onBlur={persistPreceptor}
                  placeholder="e.g. Charge nurse or rapid-response RN"
                  placeholderTextColor="rgba(60, 60, 67, 0.4)"
                />
              </View>
              <View style={s.stepField}>
                <Text style={s.stepFieldLabel}>Capabilities trained</Text>
                <View style={s.tagRow}>
                  {step.capabilityTags.map((t) => (
                    <View key={t} style={s.tagChip}>
                      <Text style={s.tagChipText}>{t}</Text>
                    </View>
                  ))}
                  <View style={s.tagChipAdd}>
                    <Ionicons name="add" size={11} color="rgba(60, 60, 67, 0.6)" />
                    <Text style={s.tagChipAddText}>Add</Text>
                  </View>
                </View>
                <Text style={s.stepFieldHelp}>
                  Capability picker wires from the Capabilities tab.
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>
      <View style={s.rowActions}>
        <Pressable style={s.rowActionBtn} onPress={onToggleExpand}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={13}
            color="rgba(60, 60, 67, 0.6)"
          />
        </Pressable>
        <Pressable style={s.rowActionBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={13} color="#FF3B30" />
        </Pressable>
      </View>
    </View>
  );
}

// =============================================================================
// FRAME 19 · CAPABILITIES
// =============================================================================

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Procedural: 'construct-outline',
  Assessment: 'pulse-outline',
  Communication: 'chatbubbles-outline',
  'Clinical reasoning': 'bulb-outline',
  Tactics: 'flag-outline',
  Boathandling: 'boat-outline',
  Professionalism: 'shield-outline',
  Other: 'apps-outline',
};

const CATEGORY_TONE_KEY: Record<string, 'proc' | 'asmt' | 'comm' | 'rsn'> = {
  Procedural: 'proc',
  Assessment: 'asmt',
  Communication: 'comm',
  'Clinical reasoning': 'rsn',
  Tactics: 'rsn',
  Boathandling: 'proc',
  Professionalism: 'comm',
  Other: 'asmt',
};

export function CapabilitiesTabBody({
  blueprintId,
  orgId,
}: {
  blueprintId: string;
  orgId: string | null;
}) {
  const { groups, totalSelected, loading, setCapability } = useBlueprintCapabilities(
    blueprintId,
    orgId,
  );

  const cycleStrength = (current: CapabilityStrength): CapabilityStrength => {
    // off → primary → secondary → supporting → off
    if (current === 0) return 3;
    if (current === 3) return 2;
    if (current === 2) return 1;
    return 0;
  };

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>
            Org_competencies · {orgId ? 'org taxonomy' : 'no org'}
          </Text>
          <Text style={s.sectionH2}>Which capabilities does this blueprint train?</Text>
        </View>
        <Text style={s.sectionHint}>
          {loading
            ? 'Loading…'
            : `${totalSelected} selected · coverage strength sets how much evidence this blueprint contributes`}
        </Text>
      </View>

      <View style={s.capGrid}>
        {groups.map((g) => {
          const toneKey = CATEGORY_TONE_KEY[g.category] ?? 'asmt';
          const cat = CAT_TONES[toneKey];
          const icon = CATEGORY_ICON[g.category] ?? 'apps-outline';
          return (
            <View key={g.category} style={s.capGroupCard}>
              <View style={s.capGroupHead}>
                <View style={[s.capIco, { backgroundColor: cat.bg }]}>
                  <Ionicons name={icon} size={14} color={cat.fg} />
                </View>
                <Text style={s.capGroupName}>{g.category}</Text>
                <Text style={s.capGroupCount}>
                  {g.selectedCount} of {g.totalCount} selected
                </Text>
              </View>
              {g.caps.map((c) => (
                <Pressable
                  key={c.competencyId}
                  onPress={() =>
                    setCapability.mutate({
                      competencyId: c.competencyId,
                      strength: cycleStrength(c.strength),
                    })
                  }
                  style={[s.capItem, !c.selected && s.capItemOff]}
                >
                  <View style={[s.capCheck, c.selected && s.capCheckOn]}>
                    {c.selected ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.capLabel, !c.selected && s.capLabelOff]}>{c.fullLabel}</Text>
                    {c.isNew ? (
                      <View style={s.newChip}>
                        <Text style={s.newChipText}>New</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={s.coverage}>
                    {[0, 1, 2].map((i) => (
                      <View
                        key={i}
                        style={[
                          s.covSeg,
                          i < c.strength && (c.strength === 1 ? s.covSegSup : s.covSegOn),
                        ]}
                      />
                    ))}
                    <Text style={[s.covLabelMini, !c.selected && s.capLabelOff]}>
                      {strengthLabel(c.strength)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>

      <View style={s.legendCard}>
        <Text style={s.legendEyebrow}>Coverage strength</Text>
        <View style={s.legendRow}>
          <View style={[s.covSeg, s.covSegOn]} />
          <View style={[s.covSeg, s.covSegOn]} />
          <View style={[s.covSeg, s.covSegOn]} />
          <Text style={s.legendText}>
            <Text style={s.legendStrong}>Primary</Text> — main thing this trains
          </Text>
        </View>
        <View style={s.legendRow}>
          <View style={[s.covSeg, s.covSegSec]} />
          <View style={[s.covSeg, s.covSegSec]} />
          <View style={s.covSeg} />
          <Text style={s.legendText}>
            <Text style={s.legendStrong}>Secondary</Text> — practiced incidentally
          </Text>
        </View>
        <View style={s.legendRow}>
          <View style={[s.covSeg, s.covSegSup]} />
          <View style={s.covSeg} />
          <View style={s.covSeg} />
          <Text style={s.legendText}>
            <Text style={s.legendStrong}>Supporting</Text> — touched, not assessed
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// =============================================================================
// FRAME 20 · PRICING & ACCESS
// =============================================================================

export function PricingTabBody({
  blueprintId,
  orgId,
  orgName,
  orgShort,
}: {
  blueprintId: string;
  orgId: string | null;
  orgName: string | null;
  orgShort: string | null;
}) {
  const { pricing, loading, update, removeCohort } = useBlueprintPricing(blueprintId, orgId);

  const [priceInput, setPriceInput] = React.useState('');
  const [payoutInput, setPayoutInput] = React.useState('');
  const [trialInput, setTrialInput] = React.useState('');

  React.useEffect(() => {
    if (!pricing) return;
    setPriceInput(
      pricing.pricePerSeatCents != null
        ? (pricing.pricePerSeatCents / 100).toFixed(2)
        : '14.00',
    );
    setPayoutInput(String(pricing.authorPayoutPct));
    setTrialInput(String(pricing.trialDays));
  }, [pricing]);

  if (loading || !pricing) {
    return (
      <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
        <Text style={s.sectionHint}>Loading pricing…</Text>
      </ScrollView>
    );
  }

  const isInstitutional = pricing.accessMode === 'institutional';

  const persistPrice = () => {
    const parsed = parseFloat(priceInput);
    if (Number.isFinite(parsed) && parsed >= 0) {
      update.mutate({ pricePerSeatCents: Math.round(parsed * 100) });
    }
  };
  const persistPayout = () => {
    const parsed = parseInt(payoutInput, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      update.mutate({ authorPayoutPct: parsed });
    }
  };
  const persistTrial = () => {
    const parsed = parseInt(trialInput, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      update.mutate({ trialDays: parsed });
    }
  };

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>Access model</Text>
          <Text style={s.sectionH2}>Who is paying for this blueprint?</Text>
        </View>
      </View>

      <View style={s.togglePair}>
        <Pressable
          onPress={() => update.mutate({ accessMode: 'institutional' })}
          style={[s.toggleCard, isInstitutional && s.toggleCardOn]}
        >
          <View style={[s.radio, isInstitutional && s.radioOn]} />
          <Text style={s.toggleCardH4}>Institutional · org-paid</Text>
          <Text style={s.toggleCardLead}>
            {orgName ?? 'Your org'} pays from its plan. Free to enrolled students in selected
            cohorts.
          </Text>
          <View style={s.toggleCardWho}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#28406B" />
            <Text style={s.toggleCardWhoText}>{orgShort ?? '·'} · enrolled seats</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => update.mutate({ accessMode: 'independent' })}
          style={[s.toggleCard, !isInstitutional && s.toggleCardOn]}
        >
          <View style={[s.radio, !isInstitutional && s.radioOn]} />
          <Text style={s.toggleCardH4}>Independent · per-seat</Text>
          <Text style={s.toggleCardLead}>
            Listed publicly. Anyone with a BetterAt account can subscribe. Author earns a
            payout per active seat.
          </Text>
          <View style={s.toggleCardWho}>
            <Ionicons name="globe-outline" size={13} color="rgba(60, 60, 67, 0.6)" />
            <Text style={[s.toggleCardWhoText, { color: 'rgba(60, 60, 67, 0.6)' }]}>
              Open marketplace
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={[s.panel, !isInstitutional && { opacity: 0.55 }]}>
        <View style={s.panelHead}>
          <Text style={s.panelEyebrow}>Institutional configuration</Text>
          <Text style={s.panelHint}>
            {isInstitutional
              ? 'Confirm org and choose cohort scope'
              : 'Switch to Institutional above to edit'}
          </Text>
        </View>
        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Paying organization</Text>
            <View style={s.selectFake}>
              <View style={s.orgShield}>
                <Text style={s.orgShieldText}>{orgShort ?? '·'}</Text>
              </View>
              <Text style={[s.selectFakeText, { flex: 1 }]}>
                {orgName ?? 'No org assigned'}
              </Text>
              <Ionicons name="chevron-down" size={12} color="rgba(60, 60, 67, 0.4)" />
            </View>
            <Text style={s.fieldHelp}>Charges roll up to the org's plan invoice.</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Cohort scope</Text>
            <View style={s.segControl}>
              <Pressable
                style={[s.segOpt, pricing.cohortScope === 'all' && s.segOptOn]}
                onPress={() => isInstitutional && update.mutate({ cohortScope: 'all' })}
              >
                <Text
                  style={
                    pricing.cohortScope === 'all' ? s.segOptTextOn : s.segOptText
                  }
                >
                  All cohorts
                </Text>
              </Pressable>
              <Pressable
                style={[s.segOpt, pricing.cohortScope === 'specific' && s.segOptOn]}
                onPress={() => isInstitutional && update.mutate({ cohortScope: 'specific' })}
              >
                <Text
                  style={
                    pricing.cohortScope === 'specific' ? s.segOptTextOn : s.segOptText
                  }
                >
                  Specific cohorts
                </Text>
              </Pressable>
            </View>
            <Text style={s.fieldHelp}>
              Limit which cohorts see this blueprint in their library.
            </Text>
          </View>
        </View>
        <View style={[s.stepField, { marginTop: 12 }]}>
          <Text style={s.fieldLabel}>Assigned cohorts</Text>
          <View style={s.tagRow}>
            {pricing.assignedCohorts.length === 0 ? (
              <Text style={s.fieldHelp}>
                No cohorts assigned yet. Add one from the Cohorts tab.
              </Text>
            ) : (
              pricing.assignedCohorts.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => removeCohort.mutate(c.id)}
                  style={[
                    s.tagChip,
                    {
                      borderWidth: 0.5,
                      borderColor: 'rgba(40, 64, 107, 0.30)',
                      backgroundColor: '#FFFFFF',
                    },
                  ]}
                >
                  <Text style={s.tagChipText}>{c.name}</Text>
                  <Ionicons name="close" size={11} color="#28406B" />
                </Pressable>
              ))
            )}
            <View style={s.tagChipDashed}>
              <Ionicons name="add" size={11} color="rgba(60, 60, 67, 0.6)" />
              <Text style={s.tagChipAddText}>Add cohort</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[s.card, isInstitutional && { opacity: 0.55 }]}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.eyebrow}>
              Independent pricing{isInstitutional ? ' · disabled' : ''}
            </Text>
            <Text style={s.cardH3}>Per-seat & per-cohort pricing</Text>
          </View>
          {isInstitutional ? (
            <Text style={s.cardHeadMeta}>Switch to Independent above to edit</Text>
          ) : null}
        </View>
        <View style={s.cardBody}>
          <View style={s.row3}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Per-seat price · month</Text>
              <View style={[s.input, s.inputAffix]}>
                <Text style={s.inputAffixPrefix}>USD</Text>
                <TextInput
                  style={s.inputAffixField}
                  value={priceInput}
                  onChangeText={setPriceInput}
                  onBlur={persistPrice}
                  keyboardType="decimal-pad"
                  editable={!isInstitutional}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Author payout %</Text>
              <View style={[s.input, s.inputAffix]}>
                <TextInput
                  style={s.inputAffixField}
                  value={payoutInput}
                  onChangeText={setPayoutInput}
                  onBlur={persistPayout}
                  keyboardType="number-pad"
                  editable={!isInstitutional}
                />
                <Text style={s.inputAffixSuffix}>%</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Trial · days</Text>
              <TextInput
                style={s.input}
                value={trialInput}
                onChangeText={setTrialInput}
                onBlur={persistTrial}
                keyboardType="number-pad"
                editable={!isInstitutional}
              />
            </View>
          </View>
          <View style={s.licensePrev}>
            <Text style={s.licenseBold}>License preview</Text>
            <Text style={s.licenseLine}>Non-transferable, single-seat subscription.</Text>
            <Text style={s.licenseLine}>
              Author retains all step content. BetterAt routes payouts via Stripe Connect.
            </Text>
            <Text style={s.licenseLine}>Refund window: 14 days from first activation.</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// =============================================================================
// FRAME 21 · COHORTS — backed by blueprint_cohorts
// =============================================================================

function formatCohortStartDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CohortsTabBody({
  blueprintId,
  orgId,
}: {
  blueprintId: string;
  orgId: string | null;
}) {
  const { assigned, unassigned, loading, assign, unassign } = useBlueprintCohorts(
    blueprintId,
    orgId,
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const totalStudents = assigned.reduce((sum, c) => sum + c.memberCount, 0);
  const summary =
    assigned.length === 0
      ? 'No cohorts subscribed yet'
      : `${assigned.length} cohort${assigned.length === 1 ? '' : 's'} · ${totalStudents} student${
          totalStudents === 1 ? '' : 's'
        }`;

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>Cohorts subscribed</Text>
          <Text style={s.sectionH2}>{loading ? 'Loading cohorts…' : summary}</Text>
        </View>
        <Pressable
          style={[s.btnPrimary, (loading || unassigned.length === 0) && { opacity: 0.5 }]}
          onPress={() => {
            if (loading || unassigned.length === 0) return;
            setPickerOpen((v) => !v);
          }}
        >
          <Ionicons name="add" size={13} color="#FFFFFF" />
          <Text style={s.btnPrimaryText}>Assign to cohort</Text>
        </Pressable>
      </View>

      {pickerOpen && unassigned.length > 0 && (
        <View style={[s.cohortCard, { gap: 8 }]}>
          <Text style={s.eyebrow}>Available cohorts</Text>
          {unassigned.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                assign.mutate(c.id, {
                  onSuccess: () => {
                    if (unassigned.length <= 1) setPickerOpen(false);
                  },
                });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: '#F4F1EC',
              }}
            >
              <View>
                <Text style={s.cohortName}>{c.name}</Text>
                <Text style={s.cohortMeta}>
                  {c.memberCount} student{c.memberCount === 1 ? '' : 's'}
                  {c.maxSeats != null ? ` of ${c.maxSeats}` : ''}
                  {formatCohortStartDate(c.startDate)
                    ? ` · starts ${formatCohortStartDate(c.startDate)}`
                    : ''}
                </Text>
              </View>
              <Ionicons name="add-circle-outline" size={18} color="#28406B" />
            </Pressable>
          ))}
        </View>
      )}

      {!loading && assigned.length === 0 && (
        <View style={[s.cohortCard, { alignItems: 'center', paddingVertical: 20 }]}>
          <Text style={s.cohortMeta}>
            No cohorts subscribed yet. Tap "Assign to cohort" to attach one.
          </Text>
        </View>
      )}

      {assigned.map((c) => {
        const seatLine =
          c.maxSeats != null
            ? `${c.memberCount} of ${c.maxSeats} seats`
            : `${c.memberCount} student${c.memberCount === 1 ? '' : 's'}`;
        const dateLine = formatCohortStartDate(c.startDate);
        const meta = dateLine ? `${seatLine} · starts ${dateLine}` : seatLine;
        const statusTone =
          c.status === 'active'
            ? { bg: 'rgba(30, 143, 71, 0.12)', text: '#1E8F47', label: 'Active' }
            : c.status === 'completed'
              ? { bg: 'rgba(89, 100, 119, 0.12)', text: '#596477', label: 'Completed' }
              : { bg: 'rgba(214, 167, 67, 0.12)', text: '#A07A2B', label: c.status ?? 'Planned' };
        return (
          <View key={c.id} style={s.cohortCard}>
            <View style={s.cohortHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.cohortName}>{c.name}</Text>
                <Text style={s.cohortMeta}>{meta}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.statusChip, { backgroundColor: statusTone.bg }]}>
                  <Text style={[s.statusChipText, { color: statusTone.text }]}>
                    {statusTone.label}
                  </Text>
                </View>
                <Pressable
                  onPress={() => unassign.mutate(c.id)}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close" size={16} color="#596477" />
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// =============================================================================
// FRAME 22 · MENTOR SETTINGS
// =============================================================================

export function MentorSettingsTabBody() {
  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>Mentor permissions</Text>
          <Text style={s.sectionH2}>Who can mentor and what they can do</Text>
        </View>
      </View>

      <View style={s.card}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.eyebrow}>Who can mentor</Text>
            <Text style={s.cardH3}>Eligibility</Text>
          </View>
        </View>
        <View style={s.cardBody}>
          <ToggleSetting
            title="Faculty members assigned to the cohort"
            sub="All faculty in the cohort's mentor list."
            on
          />
          <ToggleSetting
            title="Preceptors at the placement site"
            sub="Auto-detected by site claim; auditable in the audit log."
            on
          />
          <ToggleSetting
            title="Peer mentors (senior students)"
            sub="Cohort admin must explicitly elevate. Limited to comment + suggest."
            on={false}
          />
        </View>
      </View>

      <View style={s.card}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.eyebrow}>What mentors can do</Text>
            <Text style={s.cardH3}>Action permissions</Text>
          </View>
        </View>
        <View style={s.cardBody}>
          <ToggleSetting
            title="Comment on student reflections"
            sub="Visible to the student and other mentors on the step."
            on
          />
          <ToggleSetting
            title="Mark steps as settled"
            sub="The 'aha' moment that closes a step. Stays settled until explicitly reopened."
            on
          />
          <ToggleSetting
            title="Propose follow-up steps"
            sub="Inserts a templated step into the student's timeline. Student can decline."
            on
          />
          <ToggleSetting
            title="Edit blueprint content"
            sub="Only the blueprint's authors can edit. Mentors comment, not edit."
            on={false}
          />
        </View>
      </View>

      <View style={s.card}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.eyebrow}>Notification cadence</Text>
            <Text style={s.cardH3}>When mentors hear from this blueprint</Text>
          </View>
        </View>
        <View style={s.cardBody}>
          <View style={s.row3}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Daily digest</Text>
              <View style={s.selectFake}>
                <Text style={s.selectFakeText}>8:00 AM · weekdays</Text>
                <Ionicons name="chevron-down" size={12} color="rgba(60, 60, 67, 0.4)" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>On-action ping</Text>
              <View style={s.selectFake}>
                <Text style={s.selectFakeText}>Flagged + Wants follow-up</Text>
                <Ionicons name="chevron-down" size={12} color="rgba(60, 60, 67, 0.4)" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Weekly summary</Text>
              <View style={s.selectFake}>
                <Text style={s.selectFakeText}>Fri 4:00 PM</Text>
                <Ionicons name="chevron-down" size={12} color="rgba(60, 60, 67, 0.4)" />
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function ToggleSetting({ title, sub, on }: { title: string; sub: string; on: boolean }) {
  return (
    <View style={s.toggleSetting}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleSettingTitle}>{title}</Text>
        <Text style={s.toggleSettingSub}>{sub}</Text>
      </View>
      <View style={[s.switch, on && s.switchOn]}>
        <View style={[s.switchKnob, on && s.switchKnobOn]} />
      </View>
    </View>
  );
}

// =============================================================================
// FRAME 23 · ACTIVITY
// =============================================================================

function tagTone(t: 'ok' | 'warn' | 'plain') {
  switch (t) {
    case 'ok':
      return { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47' };
    case 'warn':
      return { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632' };
    case 'plain':
      return { bg: 'rgba(40, 64, 107, 0.08)', fg: '#28406B' };
  }
}

function aviStyle(tone: 'navy' | 'brown' | 'warm' | 'green') {
  switch (tone) {
    case 'navy':
      return '#28406B';
    case 'green':
      return '#6E8B5A';
    case 'brown':
      return '#8B5A3C';
    case 'warm':
      return '#B8855A';
  }
}

export function ActivityTabBody({ blueprintId }: { blueprintId: string }) {
  const { groups, total, loading } = useBlueprintActivity(blueprintId, 50);

  const headline = loading
    ? 'Loading activity…'
    : total === 0
      ? 'No activity yet — edits and publishes will appear here'
      : `What students, mentors, and authors did on this blueprint`;
  const hint = loading
    ? ''
    : total === 0
      ? 'audit_events filtered to this blueprint'
      : `${total} event${total === 1 ? '' : 's'} loaded`;

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>Activity</Text>
          <Text style={s.sectionH2}>{headline}</Text>
        </View>
        {hint ? <Text style={s.sectionHint}>{hint}</Text> : null}
      </View>

      {!loading && groups.length === 0 ? (
        <View style={[s.cohortCard, { alignItems: 'center', paddingVertical: 24 }]}>
          <Text style={s.cohortMeta}>
            Nothing yet. As authors publish, deans review, and students settle steps, events land
            here in real time.
          </Text>
        </View>
      ) : null}

      {groups.map((day) => (
        <View key={day.label} style={{ gap: 6 }}>
          <View style={s.actDayHead}>
            <Text style={s.actDayDate}>{day.label}</Text>
            <Text style={s.actDayCount}>
              {day.count} event{day.count === 1 ? '' : 's'}
            </Text>
          </View>
          {day.rows.map((r) => {
            const tt = r.tag ? tagTone(r.tag.tone) : null;
            return (
              <View key={r.id} style={s.actRow}>
                <View style={[s.actAv, { backgroundColor: aviStyle(r.actorTone) }]}>
                  <Text style={s.actAvText}>{r.actorInitials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.actText}>
                    <Text style={s.actStrong}>{r.actorName}</Text>
                    <Text>{' · '}{r.description}</Text>
                  </Text>
                  {r.tag && tt ? (
                    <View style={[s.actTagChip, { backgroundColor: tt.bg, marginTop: 4 }]}>
                      <Text style={[s.actTagText, { color: tt.fg }]}>{r.tag.label}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.actWhen}>{r.whenLabel}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 40, gap: 18 },

  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
    gap: 12,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  sectionH2: { marginTop: 4, fontSize: 18, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.3 },
  sectionHint: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  // STEPS
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  stepRowExpanded: { borderColor: 'rgba(40, 64, 107, 0.25)', shadowColor: '#28406B', shadowOpacity: 0.05, shadowRadius: 8 },
  stepGrip: { paddingTop: 2 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5F4EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { fontSize: 11, fontWeight: '700', color: 'rgba(60, 60, 67, 0.85)' },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  stepDesc: { marginTop: 4, fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    borderRadius: 4,
  },
  tagChipText: { fontSize: 10.5, fontWeight: '600', color: '#28406B' },
  tagChipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#EDEBE2',
    borderRadius: 4,
  },
  tagChipAddText: { fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '600' },
  tagChipDashed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.10)',
  },
  catChip: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 3, borderRadius: 4 },
  catChipText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  rowActions: { flexDirection: 'row', gap: 4 },
  rowActionBtn: { padding: 4 },

  stepEdit: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: 14,
  },
  stepField: { gap: 6 },
  stepFieldRow: { flexDirection: 'row', gap: 14 },
  stepFieldLabel: { fontSize: 11, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600' },
  stepInput: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    fontSize: 13,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
  },
  stepFieldHelp: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },

  subStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F5F4EE',
    borderRadius: 8,
  },
  subStepGrip: { paddingTop: 1 },
  subStepN: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(40, 64, 107, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subStepNText: { fontSize: 10, fontWeight: '700', color: '#28406B' },
  subStepInput: { flex: 1, fontSize: 12.5, color: '#1C1C1E', paddingVertical: 0 },

  addSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F5F4EE',
    borderRadius: 7,
    marginTop: 4,
  },
  addSubText: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },

  selectFake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  selectFakeText: { fontSize: 13, color: '#1C1C1E' },

  addStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(40, 64, 107, 0.25)',
  },
  addStepPlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStepLabel: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)' },
  addStepTempl: { fontSize: 11.5, color: '#28406B', fontWeight: '600' },

  emptyStepsCard: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  emptyStepsText: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 18,
  },

  // CAPABILITIES
  capGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  capGroupCard: {
    flex: 1,
    minWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 16,
    gap: 6,
  },
  capGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  capIco: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capGroupName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  capGroupCount: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  capItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  capItemOff: { opacity: 0.55 },
  capCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capCheckOn: { backgroundColor: '#28406B', borderColor: '#28406B' },
  capLabel: { fontSize: 12.5, color: '#1C1C1E' },
  capLabelOff: { color: 'rgba(60, 60, 67, 0.6)' },
  coverage: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  covSeg: { width: 14, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.06)' },
  covSegOn: { backgroundColor: '#28406B' },
  covSegSec: { backgroundColor: '#4E6A85' },
  covSegSup: { backgroundColor: 'rgba(40, 64, 107, 0.18)' },
  covLabelMini: {
    marginLeft: 6,
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    minWidth: 70,
  },
  newChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: 'rgba(30, 143, 71, 0.12)',
    borderRadius: 4,
  },
  newChipText: { fontSize: 9.5, fontWeight: '700', color: '#1E8F47', letterSpacing: 0.3, textTransform: 'uppercase' },

  legendCard: {
    padding: 14,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 6,
  },
  legendEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { marginLeft: 8, fontSize: 12, color: 'rgba(60, 60, 67, 0.85)' },
  legendStrong: { color: '#1C1C1E', fontWeight: '600' },

  // PRICING
  togglePair: { flexDirection: 'row', gap: 14 },
  toggleCard: {
    flex: 1,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 10,
  },
  toggleCardOn: { borderColor: '#28406B', borderWidth: 1.5, backgroundColor: 'rgba(40, 64, 107, 0.04)' },
  toggleCardH4: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  toggleCardLead: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  toggleCardWho: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  toggleCardWhoText: { fontSize: 11.5, color: '#28406B', fontWeight: '600' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D1D1D6',
  },
  radioOn: { borderColor: '#28406B', borderWidth: 5 },

  panel: {
    padding: 18,
    backgroundColor: 'rgba(40, 64, 107, 0.05)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(40, 64, 107, 0.15)',
  },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  panelEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  panelHint: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },

  fieldLabel: { fontSize: 11, color: 'rgba(60, 60, 67, 0.85)', fontWeight: '600', marginBottom: 6 },
  fieldHelp: { marginTop: 4, fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },

  orgShield: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgShieldText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  row2: { flexDirection: 'row', gap: 14 },
  row3: { flexDirection: 'row', gap: 14 },

  segControl: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
    gap: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  segOpt: { flex: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  segOptOn: { backgroundColor: '#F5F4EE' },
  segOptText: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  segOptTextOn: { fontSize: 11.5, color: '#28406B', fontWeight: '600' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  cardHead: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardH3: { marginTop: 4, fontSize: 15, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.2 },
  cardHeadMeta: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  cardBody: { padding: 18, gap: 14 },

  input: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    fontSize: 13,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
  },
  inputAffix: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
  inputAffixPrefix: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    backgroundColor: '#F5F4EE',
    borderRightWidth: 0.5,
    borderRightColor: '#D1D1D6',
  },
  inputAffixSuffix: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
    backgroundColor: '#F5F4EE',
    borderLeftWidth: 0.5,
    borderLeftColor: '#D1D1D6',
  },
  inputAffixField: { flex: 1, paddingHorizontal: 10, fontSize: 13, color: '#1C1C1E', paddingVertical: 9 },

  licensePrev: {
    padding: 14,
    backgroundColor: '#F5F4EE',
    borderRadius: 10,
    gap: 2,
  },
  licenseBold: { fontSize: 12, fontWeight: '700', color: '#1C1C1E' },
  licenseLine: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.85)' },

  // COHORTS
  cohortCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 18,
  },
  cohortHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cohortName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.2 },
  cohortMeta: { marginTop: 4, fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },
  cohortDivider: { height: 0.5, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 14 },
  cohortMentors: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cohortMentorsLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  mentorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F5F4EE',
    borderRadius: 999,
  },
  mentorAv: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorAvText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  mentorName: { fontSize: 12, color: '#1C1C1E', fontWeight: '500' },
  mentorAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(40, 64, 107, 0.08)',
    borderRadius: 999,
  },
  mentorAddText: { fontSize: 11.5, color: '#28406B', fontWeight: '600' },

  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusChipText: { fontSize: 11, fontWeight: '600' },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#28406B',
    borderRadius: 8,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // MENTOR SETTINGS
  toggleSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 6,
  },
  toggleSettingTitle: { fontSize: 13, color: '#1C1C1E', fontWeight: '500' },
  toggleSettingSub: { marginTop: 2, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 17 },

  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D1D1D6',
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: '#28406B' },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  switchKnobOn: { alignSelf: 'flex-end' },

  // ACTIVITY
  actDayHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 4, paddingHorizontal: 4 },
  actDayDate: { fontSize: 12, color: '#1C1C1E', fontWeight: '600' },
  actDayCount: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  actRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  actAv: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actAvText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  actText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  actStrong: { color: '#1C1C1E', fontWeight: '500' },
  actTagChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 4,
  },
  actTagText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  actWhen: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', alignSelf: 'flex-start' },
});
