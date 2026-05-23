/**
 * <PlanInServiceOfCard> — "Is this step in service of an event?"
 *
 * Sibling to PlanWhereCard and PlanWithCard. Lets the user link the Step
 * to a scheduled shared Event (a regatta, tournament, market day, pitch,
 * etc.) so the timeline + Atlas surfaces can show "12 steps anchored
 * toward HKDW 2027" and the amber NEXT tag knows where to anchor.
 *
 * Per the Step→Event model: Step is universal, Event is optional. We
 * never force a link — most personal practice steps don't have one.
 */

import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import {
  useUserUpcomingEvents,
  type StepTargetEventKind,
  type UpcomingEventOption,
} from '@/hooks/useUserUpcomingEvents';
import { useTargetEvent } from '@/hooks/useTargetEvent';

export interface PlanInServiceOfCardProps {
  /** Current Step.target_event_kind, if set. */
  targetEventKind?: StepTargetEventKind | null;
  /** Current Step.target_event_id, if set. */
  targetEventId?: string | null;
  readOnly?: boolean;
  /**
   * Apply or clear the link. Caller persists by writing
   * (target_event_kind, target_event_id) on timeline_steps.
   */
  onChange: (
    next:
      | { kind: StepTargetEventKind; id: string }
      | null,
  ) => void;
}

export function PlanInServiceOfCard({
  targetEventKind,
  targetEventId,
  readOnly,
  onChange,
}: PlanInServiceOfCardProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const { data: linked } = useTargetEvent({
    kind: targetEventKind,
    id: targetEventId,
  });

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const handlePick = useCallback(
    (opt: UpcomingEventOption) => {
      onChange({ kind: opt.kind, id: opt.id });
      setPickerVisible(false);
    },
    [onChange],
  );

  const hasLink = Boolean(targetEventKind && targetEventId);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="flag-outline" size={12} color={STEP_COLORS.secondaryLabel} />
        <Text style={styles.eyebrow}>In service of</Text>
      </View>

      {hasLink && linked ? (
        <View style={styles.linkRow}>
          <Ionicons name="trophy" size={14} color={STEP_COLORS.accent} />
          <View style={styles.linkText}>
            <Text style={styles.linkName} numberOfLines={1}>
              {linked.label}
            </Text>
            {linked.subtitle ? (
              <Text style={styles.linkSub} numberOfLines={1}>
                {linked.subtitle}
                {linked.starts_at ? ` · ${formatWhen(linked.starts_at)}` : ''}
              </Text>
            ) : linked.starts_at ? (
              <Text style={styles.linkSub} numberOfLines={1}>
                {formatWhen(linked.starts_at)}
              </Text>
            ) : null}
          </View>
          {!readOnly && (
            <Pressable onPress={handleClear} hitSlop={6}>
              <Ionicons name="close-circle" size={18} color={IOS_COLORS.systemGray3} />
            </Pressable>
          )}
        </View>
      ) : null}

      {!readOnly && (
        <Pressable style={styles.pickBtn} onPress={() => setPickerVisible(true)}>
          <Ionicons name="link-outline" size={16} color={STEP_COLORS.accent} />
          <Text style={styles.pickText}>
            {hasLink ? 'Change event' : 'Link to an event'}
          </Text>
          {!hasLink ? (
            <Text style={styles.pickHint}> · regatta, tournament, market, pitch</Text>
          ) : null}
        </Pressable>
      )}

      <PickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={handlePick}
      />
    </View>
  );
}

function PickerModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (opt: UpcomingEventOption) => void;
}) {
  const { data: events = [], isLoading } = useUserUpcomingEvents();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.sheet}>
        <View style={modalStyles.sheetHead}>
          <Text style={modalStyles.sheetTitle}>Link to an event</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={IOS_COLORS.label} />
          </Pressable>
        </View>
        <Text style={modalStyles.sheetHint}>
          Pick a scheduled event this step is working toward. Most steps don't have one — leave it blank if this is just practice.
        </Text>
        <ScrollView style={modalStyles.sheetBody}>
          {isLoading ? (
            <Text style={modalStyles.sheetEmpty}>Loading your upcoming events…</Text>
          ) : events.length === 0 ? (
            <Text style={modalStyles.sheetEmpty}>
              No upcoming events found for your active interest. Steps without an event link still appear in your timeline normally.
            </Text>
          ) : (
            events.map((opt) => (
              <Pressable
                key={`${opt.kind}:${opt.id}`}
                style={modalStyles.eventRow}
                onPress={() => onPick(opt)}
              >
                <View style={modalStyles.eventIcon}>
                  <Ionicons name="trophy" size={18} color={STEP_COLORS.accent} />
                </View>
                <View style={modalStyles.eventText}>
                  <Text style={modalStyles.eventName} numberOfLines={1}>{opt.label}</Text>
                  <Text style={modalStyles.eventSub} numberOfLines={1}>
                    {[opt.subtitle, opt.starts_at ? formatWhen(opt.starts_at) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.systemGray3} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: STEP_COLORS.secondaryLabel,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    flex: 1,
    minWidth: 0,
  },
  linkName: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  linkSub: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 1,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingVertical: IOS_SPACING.xs,
    flexWrap: 'wrap',
  },
  pickText: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.accent,
  },
  pickHint: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
});

const modalStyles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  sheetHint: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 18,
  },
  sheetBody: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sheetEmpty: {
    fontSize: 14,
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
    paddingTop: 40,
    paddingHorizontal: 12,
    lineHeight: 20,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventText: {
    flex: 1,
    minWidth: 0,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  eventSub: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
  },
});
