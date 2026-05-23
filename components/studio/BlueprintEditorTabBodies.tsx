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

// =============================================================================
// FRAME 18 · STEPS
// =============================================================================

const CAT_TONES: Record<string, { bg: string; fg: string; label: string }> = {
  asmt: { bg: 'rgba(90, 107, 139, 0.14)', fg: '#5A6B8B', label: 'Assessment' },
  rsn: { bg: 'rgba(122, 90, 139, 0.14)', fg: '#7A5A8B', label: 'Clinical reasoning' },
  proc: { bg: 'rgba(139, 90, 60, 0.12)', fg: '#8B5A3C', label: 'Procedural' },
  comm: { bg: 'rgba(110, 139, 90, 0.14)', fg: '#6E8B5A', label: 'Communication' },
};

export function StepsTabBody({ blueprintId }: { blueprintId: string }) {
  const { steps, loading, addStep, deleteStep, updateStep } = useBlueprintSteps(blueprintId);
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

interface CapItem {
  label: string;
  on: boolean;
  strength: 0 | 1 | 2 | 3; // 0=none, 1=supporting, 2=secondary, 3=primary
  isNew?: boolean;
}

interface CapGroup {
  category: 'proc' | 'asmt' | 'comm' | 'rsn';
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  caps: CapItem[];
}

const CAP_GROUPS: CapGroup[] = [
  {
    category: 'proc',
    icon: 'construct-outline',
    name: 'Procedural',
    caps: [
      { label: 'IV insertion · supervised', on: true, strength: 2 },
      { label: 'Medication administration', on: false, strength: 0 },
      { label: 'Foley catheter placement', on: false, strength: 0 },
      { label: 'NG tube placement', on: false, strength: 0 },
    ],
  },
  {
    category: 'asmt',
    icon: 'pulse-outline',
    name: 'Assessment',
    caps: [
      { label: 'Head-to-toe assessment', on: true, strength: 2 },
      { label: 'Cardiac telemetry interpretation', on: true, strength: 1 },
    ],
  },
  {
    category: 'comm',
    icon: 'chatbubbles-outline',
    name: 'Communication',
    caps: [
      { label: 'ISBAR handoff communication', on: true, strength: 3 },
      { label: 'Discharge teach-back', on: false, strength: 0 },
    ],
  },
  {
    category: 'rsn',
    icon: 'bulb-outline',
    name: 'Clinical reasoning',
    caps: [{ label: 'Sepsis bundle recognition', on: true, strength: 3, isNew: true }],
  },
];

function strengthLabel(s: 0 | 1 | 2 | 3): string {
  return ['—', 'Supporting', 'Secondary', 'Primary'][s];
}

export function CapabilitiesTabBody() {
  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>Org_competencies · JHSON taxonomy</Text>
          <Text style={s.sectionH2}>Which capabilities does this blueprint train?</Text>
        </View>
        <Text style={s.sectionHint}>
          Coverage strength sets how much evidence this blueprint contributes
        </Text>
      </View>

      <View style={s.capGrid}>
        {CAP_GROUPS.map((g) => {
          const cat = CAT_TONES[g.category];
          const selected = g.caps.filter((c) => c.on).length;
          return (
            <View key={g.name} style={s.capGroupCard}>
              <View style={s.capGroupHead}>
                <View style={[s.capIco, { backgroundColor: cat.bg }]}>
                  <Ionicons name={g.icon} size={14} color={cat.fg} />
                </View>
                <Text style={s.capGroupName}>{g.name}</Text>
                <Text style={s.capGroupCount}>
                  {selected} of {g.caps.length} selected
                </Text>
              </View>
              {g.caps.map((c) => (
                <View key={c.label} style={[s.capItem, !c.on && s.capItemOff]}>
                  <View style={[s.capCheck, c.on && s.capCheckOn]}>
                    {c.on ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.capLabel, !c.on && s.capLabelOff]}>{c.label}</Text>
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
                    <Text style={[s.covLabelMini, !c.on && s.capLabelOff]}>
                      {strengthLabel(c.strength)}
                    </Text>
                  </View>
                </View>
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

export function PricingTabBody() {
  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>Access model</Text>
          <Text style={s.sectionH2}>Who is paying for this blueprint?</Text>
        </View>
      </View>

      <View style={s.togglePair}>
        <View style={[s.toggleCard, s.toggleCardOn]}>
          <View style={[s.radio, s.radioOn]} />
          <Text style={s.toggleCardH4}>Institutional · org-paid</Text>
          <Text style={s.toggleCardLead}>
            Johns Hopkins School of Nursing pays from its plan. Free to enrolled students in
            selected cohorts.
          </Text>
          <View style={s.toggleCardWho}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#28406B" />
            <Text style={s.toggleCardWhoText}>JHSON · BSN seats</Text>
          </View>
        </View>
        <View style={s.toggleCard}>
          <View style={s.radio} />
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
        </View>
      </View>

      <View style={s.panel}>
        <View style={s.panelHead}>
          <Text style={s.panelEyebrow}>Institutional configuration</Text>
          <Text style={s.panelHint}>Confirm org and choose cohort scope</Text>
        </View>
        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Paying organization</Text>
            <View style={s.selectFake}>
              <View style={s.orgShield}>
                <Text style={s.orgShieldText}>JH</Text>
              </View>
              <Text style={[s.selectFakeText, { flex: 1 }]}>Johns Hopkins School of Nursing</Text>
              <Ionicons name="chevron-down" size={12} color="rgba(60, 60, 67, 0.4)" />
            </View>
            <Text style={s.fieldHelp}>Charges roll up to JHSON's plan invoice.</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Cohort scope</Text>
            <View style={s.segControl}>
              <View style={s.segOpt}>
                <Text style={s.segOptText}>All cohorts</Text>
              </View>
              <View style={[s.segOpt, s.segOptOn]}>
                <Text style={s.segOptTextOn}>Specific cohorts</Text>
              </View>
            </View>
            <Text style={s.fieldHelp}>Limit which cohorts see this blueprint in their library.</Text>
          </View>
        </View>
        <View style={[s.stepField, { marginTop: 12 }]}>
          <Text style={s.fieldLabel}>Assigned cohorts</Text>
          <View style={s.tagRow}>
            <View style={[s.tagChip, { borderWidth: 0.5, borderColor: 'rgba(40, 64, 107, 0.30)', backgroundColor: '#FFFFFF' }]}>
              <Text style={s.tagChipText}>BSN Class of 2027 — Cohort A</Text>
              <Ionicons name="close" size={11} color="#28406B" />
            </View>
            <View style={[s.tagChipDashed]}>
              <Ionicons name="add" size={11} color="rgba(60, 60, 67, 0.6)" />
              <Text style={s.tagChipAddText}>Add cohort</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[s.card, { opacity: 0.55 }]}>
        <View style={s.cardHead}>
          <View>
            <Text style={s.eyebrow}>Independent pricing · disabled</Text>
            <Text style={s.cardH3}>Per-seat & per-cohort pricing</Text>
          </View>
          <Text style={s.cardHeadMeta}>Switch to Independent above to enable</Text>
        </View>
        <View style={s.cardBody}>
          <View style={s.row3}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Per-seat price · month</Text>
              <View style={[s.input, s.inputAffix]}>
                <Text style={s.inputAffixPrefix}>USD</Text>
                <TextInput style={s.inputAffixField} defaultValue="14.00" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Author payout %</Text>
              <View style={[s.input, s.inputAffix]}>
                <TextInput style={s.inputAffixField} defaultValue="70" />
                <Text style={s.inputAffixSuffix}>%</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Trial · days</Text>
              <TextInput style={s.input} defaultValue="7" />
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
// FRAME 21 · COHORTS
// =============================================================================

interface CohortBp {
  name: string;
  students: number;
  weekOf: string;
  mentors: { initials: string; name: string; tone: 'navy' | 'brown' | 'green' }[];
}

const COHORTS_BP: CohortBp[] = [
  {
    name: 'BSN Class of 2027 — Cohort A',
    students: 30,
    weekOf: 'Wk 6 of 18 · 22 students settled at least 1 step',
    mentors: [
      { initials: 'SP', name: 'Dean S. Park', tone: 'navy' },
      { initials: 'RM', name: 'Dr. R. Murphy', tone: 'brown' },
      { initials: 'JK', name: 'J. Kim, RN', tone: 'green' },
    ],
  },
];

export function CohortsTabBody() {
  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>Cohorts subscribed</Text>
          <Text style={s.sectionH2}>1 cohort, 30 students, 3 mentors</Text>
        </View>
        <Pressable style={s.btnPrimary}>
          <Ionicons name="add" size={13} color="#FFFFFF" />
          <Text style={s.btnPrimaryText}>Assign to cohort</Text>
        </Pressable>
      </View>

      {COHORTS_BP.map((c) => (
        <View key={c.name} style={s.cohortCard}>
          <View style={s.cohortHead}>
            <View>
              <Text style={s.cohortName}>{c.name}</Text>
              <Text style={s.cohortMeta}>
                {c.students} students · {c.weekOf}
              </Text>
            </View>
            <View style={[s.statusChip, { backgroundColor: 'rgba(30, 143, 71, 0.12)' }]}>
              <Text style={[s.statusChipText, { color: '#1E8F47' }]}>Active</Text>
            </View>
          </View>
          <View style={s.cohortDivider} />
          <View style={s.cohortMentors}>
            <Text style={s.cohortMentorsLabel}>Mentors</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {c.mentors.map((m) => (
                <View key={m.initials} style={s.mentorPill}>
                  <View
                    style={[
                      s.mentorAv,
                      {
                        backgroundColor:
                          m.tone === 'navy' ? '#28406B' : m.tone === 'brown' ? '#8B5A3C' : '#6E8B5A',
                      },
                    ]}
                  >
                    <Text style={s.mentorAvText}>{m.initials}</Text>
                  </View>
                  <Text style={s.mentorName}>{m.name}</Text>
                </View>
              ))}
              <Pressable style={s.mentorAdd}>
                <Ionicons name="add" size={12} color="#28406B" />
                <Text style={s.mentorAddText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
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

interface ActivityRow {
  initials: string;
  aviTone: 'navy' | 'green' | 'steel' | 'brown' | 'warm';
  actorBold: string;
  rest: string;
  when: string;
  tag?: { label: string; tone: 'ok' | 'warn' | 'plain' };
}

interface ActivityDay {
  label: string;
  count: string;
  rows: ActivityRow[];
}

const ACTIVITY: ActivityDay[] = [
  {
    label: 'Today · Sat May 23',
    count: '14 events',
    rows: [
      {
        initials: 'ET',
        aviTone: 'navy',
        actorBold: 'Emily Tran',
        rest: ' settled step 3 · ISBAR handoff to rapid response.',
        when: '2:14p',
        tag: { label: 'Settled', tone: 'ok' },
      },
      {
        initials: 'NH',
        aviTone: 'steel',
        actorBold: 'Nora Helms',
        rest: ' reflected on step 2 · flagged for mentor follow-up.',
        when: '1:08p',
        tag: { label: 'Wants follow-up', tone: 'warn' },
      },
      {
        initials: 'JK',
        aviTone: 'brown',
        actorBold: 'J. Kim, RN',
        rest: ' marked Devon Aldridge\'s step 5 (Reassess after 1 hour) as settled.',
        when: '11:42a',
        tag: { label: 'Mentor signed off', tone: 'plain' },
      },
      {
        initials: 'RM',
        aviTone: 'warm',
        actorBold: 'Dr. R. Murphy',
        rest: ' changed coverage strength on ISBAR handoff from secondary to primary.',
        when: '9:02a',
      },
    ],
  },
  {
    label: 'Yesterday · Fri May 22',
    count: '38 events',
    rows: [
      {
        initials: 'DA',
        aviTone: 'green',
        actorBold: 'Devon Aldridge',
        rest: ' started step 1 at Johns Hopkins Hospital — East Baltimore.',
        when: 'Fri 4:42p',
      },
      {
        initials: 'SP',
        aviTone: 'navy',
        actorBold: 'Dean S. Park',
        rest: ' published v0.4 to BSN Class of 2027 — Cohort A.',
        when: 'Fri 10:18a',
        tag: { label: 'Published', tone: 'ok' },
      },
    ],
  },
];

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

function aviStyle(tone: 'navy' | 'green' | 'steel' | 'brown' | 'warm') {
  switch (tone) {
    case 'navy':
      return '#28406B';
    case 'green':
      return '#6E8B5A';
    case 'steel':
      return '#5A6B8B';
    case 'brown':
      return '#8B5A3C';
    case 'warm':
      return '#B8855A';
  }
}

export function ActivityTabBody() {
  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.sectionHead}>
        <View>
          <Text style={s.eyebrow}>Activity</Text>
          <Text style={s.sectionH2}>What students and mentors did on this blueprint</Text>
        </View>
        <Text style={s.sectionHint}>Last 90 days · 52 events total</Text>
      </View>

      {ACTIVITY.map((day) => (
        <View key={day.label} style={{ gap: 6 }}>
          <View style={s.actDayHead}>
            <Text style={s.actDayDate}>{day.label}</Text>
            <Text style={s.actDayCount}>{day.count}</Text>
          </View>
          {day.rows.map((r, i) => {
            const tt = r.tag ? tagTone(r.tag.tone) : null;
            return (
              <View key={i} style={s.actRow}>
                <View style={[s.actAv, { backgroundColor: aviStyle(r.aviTone) }]}>
                  <Text style={s.actAvText}>{r.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.actText}>
                    <Text style={s.actStrong}>{r.actorBold}</Text>
                    <Text>{r.rest}</Text>
                  </Text>
                  {r.tag && tt ? (
                    <View style={[s.actTagChip, { backgroundColor: tt.bg, marginTop: 4 }]}>
                      <Text style={[s.actTagText, { color: tt.fg }]}>{r.tag.label}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.actWhen}>{r.when}</Text>
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
