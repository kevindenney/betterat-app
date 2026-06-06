/**
 * Create Org Event sheet — §4.1 "Make one race".
 *
 * Modal overlay launched from the Org Admin · Calendar header. A race is just
 * an event with the is_race toggle on (D30/D31), so this one form authors both:
 * the toggle progressively discloses the race note. Writes through
 * useCreateOrgEvent → admin_create_org_event (SECURITY DEFINER, gated by
 * is_org_admin_member). D33: flipping is_race does NOT create a scoring row —
 * course/marks/scoring are set up afterward in the race cockpit.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudioButton } from '@/components/studio/StudioShell';
import { useCreateOrgEvent } from '@/hooks/useCreateOrgEvent';
import { composeEventTimes } from '@/lib/admin/adminCalendar';

export interface CreateOrgEventSheetProps {
  visible: boolean;
  orgId: string;
  orgName: string;
  onClose: () => void;
  onCreated?: (stepId: string) => void;
}

function todayISODate(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function CreateOrgEventSheet({
  visible,
  orgId,
  orgName,
  onClose,
  onCreated,
}: CreateOrgEventSheetProps) {
  const create = useCreateOrgEvent(orgId);
  const [title, setTitle] = useState('');
  const [isRace, setIsRace] = useState(false);
  const [date, setDate] = useState(todayISODate());
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('11:00');
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setIsRace(false);
    setDate(todayISODate());
    setStart('09:00');
    setEnd('11:00');
    setPlace('');
    setDescription('');
    setError(null);
  }

  function handleClose() {
    if (create.isPending) return;
    reset();
    onClose();
  }

  function handleSubmit() {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Give the event a title');
      return;
    }
    let times;
    try {
      times = composeEventTimes(date, start, end);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check the date and times');
      return;
    }
    create.mutate(
      {
        title: trimmed,
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        isRace,
        description: description.trim() || null,
        placeName: place.trim() || null,
      },
      {
        onSuccess: (stepId) => {
          onCreated?.(stepId);
          reset();
          onClose();
        },
        onError: (e) => {
          setError(e instanceof Error ? e.message : 'Could not create the event');
        },
      },
    );
  }

  if (!visible) return null;

  const noun = isRace ? 'race' : 'event';

  return (
    <View style={s.scrim} pointerEvents="auto">
      <Pressable style={s.scrimPress} onPress={handleClose} />
      <View style={s.sheet}>
        <View style={s.head}>
          <View style={s.headText}>
            <Text style={s.title}>New {noun}</Text>
            <Text style={s.note}>A scheduled {orgName} event your members can show up to</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
          </Pressable>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
          <Field label="Title">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={isRace ? 'e.g. Dragon Saturday Series — Race 4' : 'e.g. Learn to Sail — Dinghy Intro'}
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={s.input}
            />
          </Field>

          <Pressable style={s.raceToggle} onPress={() => setIsRace((v) => !v)}>
            <View style={[s.toggle, isRace ? s.toggleOn : s.toggleOff]}>
              <View style={[s.toggleKnob, isRace ? s.toggleKnobOn : s.toggleKnobOff]} />
            </View>
            <View style={s.raceToggleText}>
              <View style={s.raceToggleTitleRow}>
                <Ionicons
                  name={isRace ? 'boat' : 'calendar'}
                  size={14}
                  color={isRace ? '#007AFF' : 'rgba(60, 60, 67, 0.6)'}
                />
                <Text style={s.raceToggleTitle}>This is a race</Text>
              </View>
              <Text style={s.raceToggleBody}>
                {isRace
                  ? 'Badged ⛵ on the calendar and Atlas. Course, marks and scoring are set up afterward in the race cockpit.'
                  : 'Leave off for a regular scheduled event (briefing, training, social).'}
              </Text>
            </View>
          </Pressable>

          <Field label="Date">
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              autoCapitalize="none"
              style={s.input}
            />
          </Field>

          <View style={s.twoColRow}>
            <Field label="Start" flex={1}>
              <TextInput
                value={start}
                onChangeText={setStart}
                placeholder="HH:MM"
                placeholderTextColor="rgba(60, 60, 67, 0.4)"
                style={s.input}
              />
            </Field>
            <Field label="End" flex={1}>
              <TextInput
                value={end}
                onChangeText={setEnd}
                placeholder="HH:MM (optional)"
                placeholderTextColor="rgba(60, 60, 67, 0.4)"
                style={s.input}
              />
            </Field>
          </View>
          <Text style={s.helper}>
            Times are in your local timezone. Leave the date blank to file it as unscheduled.
          </Text>

          <Field label="Place (optional)">
            <TextInput
              value={place}
              onChangeText={setPlace}
              placeholder="e.g. Kellett Island Clubhouse"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              style={s.input}
            />
          </Field>

          <Field label="Description (optional)">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is it, who's it for?"
              placeholderTextColor="rgba(60, 60, 67, 0.4)"
              multiline
              numberOfLines={3}
              style={[s.input, s.inputMultiline]}
            />
          </Field>
        </ScrollView>

        <View style={s.footer}>
          {error ? (
            <Text style={s.error} numberOfLines={2}>
              {error}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={s.footerActions}>
            <StudioButton variant="ghost" label="Cancel" onPress={handleClose} />
            <StudioButton
              variant="primary"
              accent="navy"
              icon={isRace ? 'boat' : 'add'}
              label={create.isPending ? 'Creating…' : `Create ${noun}`}
              onPress={handleSubmit}
            />
          </View>
        </View>
      </View>
    </View>
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
    <View style={[s.field, flex !== undefined && { flex }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  scrimPress: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  sheet: {
    width: 560,
    maxWidth: '92%',
    maxHeight: 720,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...({ boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)' } as any),
  },
  head: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.2 },
  note: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },

  body: { flex: 1 },
  bodyInner: { paddingHorizontal: 22, paddingVertical: 18, gap: 16 },

  field: { gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    fontSize: 13.5,
    color: '#1C1C1E',
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  helper: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16, marginTop: -4 },

  twoColRow: { flexDirection: 'row', gap: 14 },

  raceToggle: {
    padding: 14,
    backgroundColor: '#EFEFF4',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  raceToggleText: { flex: 1, minWidth: 0 },
  raceToggleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  raceToggleTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  raceToggleBody: {
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 16,
    marginTop: 3,
  },
  toggle: { width: 36, height: 22, borderRadius: 12, padding: 2, marginTop: 2 },
  toggleOn: { backgroundColor: '#007AFF' },
  toggleOff: { backgroundColor: '#D1D1D6' },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    ...({ boxShadow: '0 1px 3px rgba(0,0,0,0.15)' } as any),
  },
  toggleKnobOn: { marginLeft: 14 },
  toggleKnobOff: { marginLeft: 0 },

  footer: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  error: { flex: 1, fontSize: 11.5, color: '#FF3B30', fontWeight: '500' },
});
