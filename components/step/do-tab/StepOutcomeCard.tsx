/**
 * <StepOutcomeCard> — per-step business-outcome capture (entrepreneur vocab).
 *
 * Renders only for steps whose interest resolves to the entrepreneur
 * persona. Captures the sale a step produced — units sold, turnover
 * earned, customers served — writes it onto the step's
 * `metadata.outcome`, then rolls the week up into `business_outcomes`
 * (which feeds the money lane + EARNINGS headline). Turnover, not net:
 * revenue only, no cost field.
 */

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Coins } from 'lucide-react-native';
import {
  GRAY_5,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';
import { resolveInterestVocab } from '@/components/ios-register/timeline-zoom/interestVocab';
import { moneyConfigForCurrency } from '@/components/ios-register/timeline-zoom/interestMoney';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useStepOutcomeRollup } from '@/hooks/useStepOutcomeRollup';
import { useActivePlan } from '@/hooks/usePlan';
import type { BusinessOutcomeData, StepMetadata } from '@/types/step-detail';

const ACCENT = '#5BA46F';

interface StepOutcomeCardProps {
  stepId: string;
  interestId?: string | null;
  interestName?: string | null;
  interestSlug?: string | null;
}

function toInt(s: string): number {
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function StepOutcomeCard({ stepId, interestId, interestName, interestSlug }: StepOutcomeCardProps) {
  const { data: step } = useStepDetail(stepId);
  const resolvedInterestId = interestId ?? step?.interest_id ?? null;
  const vocab = useMemo(
    () => resolveInterestVocab(resolvedInterestId, interestName ?? null, interestSlug ?? null),
    [resolvedInterestId, interestName, interestSlug],
  );
  const isEntrepreneur = vocab.id === 'entrepreneur';
  const { data: activePlan } = useActivePlan(resolvedInterestId);

  const existing = (step?.metadata as StepMetadata | undefined)?.outcome;
  // Currency is anchored on the plan (the business); a prior outcome on
  // this step wins so an in-progress edit keeps its own currency.
  const planCurrency = existing?.currency ?? activePlan?.currency ?? 'USD';
  const symbol = moneyConfigForCurrency(planCurrency).symbol;

  const [units, setUnits] = useState(existing?.units_sold ? String(existing.units_sold) : '');
  const [revenue, setRevenue] = useState(
    existing?.revenue_minor ? String(existing.revenue_minor / 100) : '',
  );
  const [newCustomers, setNewCustomers] = useState(
    existing?.customer_count ? String(existing.customer_count) : '',
  );
  const [repeat, setRepeat] = useState(existing?.repeat_count ? String(existing.repeat_count) : '');
  const [saved, setSaved] = useState(false);

  const updateMetadata = useUpdateStepMetadata(stepId);
  const rollup = useStepOutcomeRollup(resolvedInterestId);
  const busy = updateMetadata.isPending || rollup.isPending;

  // Hooks must run unconditionally; bail on render after they're set up.
  if (!isEntrepreneur) return null;

  const dirty =
    units.trim() !== '' ||
    revenue.trim() !== '' ||
    newCustomers.trim() !== '' ||
    repeat.trim() !== '';

  const handleSave = async () => {
    const revenueMajor = parseFloat(revenue.replace(/[^\d.]/g, ''));
    const outcome: BusinessOutcomeData = {
      units_sold: toInt(units),
      revenue_minor: Number.isFinite(revenueMajor) ? Math.round(revenueMajor * 100) : 0,
      currency: planCurrency,
      customer_count: toInt(newCustomers),
      repeat_count: toInt(repeat),
      captured_at: new Date().toISOString(),
    };
    try {
      const updated = await updateMetadata.mutateAsync({ outcome });
      await rollup.mutateAsync({ step: updated, outcome });
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch {
      // Surfaced via mutation error state below.
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.eye}>
          <Coins size={12} color={ACCENT} />
          <Text style={styles.eyeText}>This sale</Text>
        </View>
        {saved ? <Text style={styles.savedPill}>Logged ✓</Text> : null}
      </View>

      <View style={styles.grid}>
        <Field label="Units sold" value={units} onChange={setUnits} />
        <Field label="Revenue" value={revenue} onChange={setRevenue} prefix={symbol} />
        <Field label="New customers" value={newCustomers} onChange={setNewCustomers} />
        <Field label="Repeat" value={repeat} onChange={setRepeat} />
      </View>

      {rollup.isError || updateMetadata.isError ? (
        <Text style={styles.error}>
          {rollup.error?.message ?? updateMetadata.error?.message ?? 'Could not save'}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, (!dirty || busy) && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={!dirty || busy}
        accessibilityRole="button"
        accessibilityLabel="Log this sale"
      >
        {busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>{existing ? 'Update sale' : 'Log sale'}</Text>
        )}
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="0"
          placeholderTextColor={LABEL_3}
          keyboardType="number-pad"
          inputMode="numeric"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  eye: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyeText: {
    fontSize: 10,
    fontWeight: '700',
    color: LABEL_2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  savedPill: {
    fontSize: 11,
    fontWeight: '700',
    color: ACCENT,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  field: {
    flexGrow: 1,
    flexBasis: '46%',
  },
  fieldLabel: {
    fontSize: 11,
    color: LABEL_2,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  prefix: {
    fontSize: 14,
    color: LABEL_2,
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: LABEL,
    padding: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  error: {
    fontSize: 12,
    color: '#C4842A',
    marginTop: 8,
  },
  button: {
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
