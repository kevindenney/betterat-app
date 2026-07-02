/**
 * DueDatePickerModal — Date + time picker for step due dates.
 *
 * Quick-pick shortcuts plus native date/time inputs.
 * User picks date (and optionally time), then hits Save.
 */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

// ── Helpers ────────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function nextMonday(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return startOfDay(d);
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function relativeLabel(iso: string): string | null {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(iso + 'T12:00:00'));
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} days ago`;
  return null;
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Quick-pick options ─────────────────────────────────────────────────────────

interface QuickOption {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  getDate: () => Date;
}

function getQuickOptions(): QuickOption[] {
  const today = startOfDay(new Date());
  return [
    { label: 'Today', icon: 'today-outline', getDate: () => today },
    { label: 'Tomorrow', icon: 'sunny-outline', getDate: () => addDays(today, 1) },
    { label: 'Next Monday', icon: 'calendar-outline', getDate: () => nextMonday(today) },
    { label: 'In 1 week', icon: 'time-outline', getDate: () => addDays(today, 7) },
    { label: 'In 2 weeks', icon: 'time-outline', getDate: () => addDays(today, 14) },
    { label: 'In 1 month', icon: 'calendar-number-outline', getDate: () => {
      const d = new Date(today);
      d.setMonth(d.getMonth() + 1);
      return d;
    }},
  ];
}

// ── Time presets ───────────────────────────────────────────────────────────────

const TIME_PRESETS = [
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '2:00 PM', value: '14:00' },
  { label: '5:00 PM', value: '17:00' },
  { label: '7:00 PM', value: '19:00' },
];

function TimePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 7,
        backgroundColor: selected ? '#2563eb' : '#f5f5f5',
        borderWidth: 1,
        borderColor: selected ? '#2563eb' : '#e5e5e5',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          color: selected ? '#fff' : '#333',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface DueDatePickerModalProps {
  visible: boolean;
  /** Current due_at value — full ISO string or null */
  currentDate: string | null;
  onSelect: (isoDatetime: string) => void;
  onClear: () => void;
  onClose: () => void;
  /** Header copy — defaults to "Set Due Date"; pass "When" for the composer. */
  title?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DueDatePickerModal({
  visible,
  currentDate,
  onSelect,
  onClear,
  onClose,
  title = 'Set Due Date',
}: DueDatePickerModalProps) {
  const quickOptions = useMemo(getQuickOptions, [visible]);

  // Parse existing date into local date/time parts
  const existingParts = useMemo(() => {
    if (!currentDate) return { date: '', time: '' };
    try {
      const d = new Date(currentDate);
      const datePart = d.toISOString().split('T')[0];
      const h = d.getHours();
      const m = d.getMinutes();
      // Only show time if it was explicitly set (not midnight or 23:59)
      const hasTime = !(h === 0 && m === 0) && !(h === 23 && m === 59);
      const timePart = hasTime ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : '';
      return { date: datePart, time: timePart };
    } catch {
      return { date: '', time: '' };
    }
  }, [currentDate]);

  // Local draft state
  const [draftDate, setDraftDate] = useState(existingParts.date);
  const [draftTime, setDraftTime] = useState(existingParts.time);
  const [saving, setSaving] = useState(false);

  // Reset draft when modal opens or currentDate changes
  useEffect(() => {
    if (visible) {
      setDraftDate(existingParts.date);
      setDraftTime(existingParts.time);
      setSaving(false);
    }
  }, [visible, existingParts.date, existingParts.time]);

  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(draftDate);

  const handleQuickPick = useCallback((opt: QuickOption) => {
    setDraftDate(toISODate(opt.getDate()));
    // Keep existing time if set
  }, []);

  const handleSave = useCallback(() => {
    if (!draftDate) return;
    // Build ISO datetime — use time if set, otherwise end of day. The regex
    // gate only checks digit shape, so a calendar-invalid value like
    // 2026-13-01 still reaches here; guard before toISOString() throws.
    const timePart = draftTime || '23:59:59';
    const parsed = new Date(`${draftDate}T${timePart}`);
    if (Number.isNaN(parsed.getTime())) {
      showAlert('Invalid date', 'Please enter a valid date as YYYY-MM-DD.');
      return;
    }
    setSaving(true);
    onSelect(parsed.toISOString());
  }, [draftDate, draftTime, onSelect]);

  const handleClear = useCallback(() => {
    setSaving(true);
    onClear();
  }, [onClear]);

  const relLabel = draftDate ? relativeLabel(draftDate) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            width: 360,
            maxWidth: '92%',
            overflow: 'hidden',
            ...(Platform.OS === 'web'
              ? { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.18,
                  shadowRadius: 32,
                  elevation: 12,
                }),
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 8,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#111' }}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#f0f0f0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={16} color="#666" />
            </Pressable>
          </View>

          {/* Preview of selected date */}
          {hasDate && (
            <View
              style={{
                marginHorizontal: 20,
                marginTop: 4,
                marginBottom: 4,
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: '#f0f7ff',
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="calendar" size={18} color="#2563eb" />
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af' }}>
                    {formatDisplayDate(draftDate)}
                    {draftTime ? ` at ${formatTime12h(draftTime)}` : ''}
                  </Text>
                  {relLabel && (
                    <Text style={{ fontSize: 12, color: '#3b82f6', marginTop: 1 }}>
                      {relLabel}
                    </Text>
                  )}
                </View>
              </View>
              {currentDate && (
                <Pressable
                  onPress={handleClear}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 6,
                    backgroundColor: '#dbeafe',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#2563eb' }}>Clear</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Quick picks */}
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <Text style={sectionLabel}>Quick pick</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {quickOptions.map((opt) => {
                const optIso = toISODate(opt.getDate());
                const isSelected = optIso === draftDate;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => handleQuickPick(opt)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: isSelected ? '#2563eb' : '#f5f5f5',
                      borderWidth: 1,
                      borderColor: isSelected ? '#2563eb' : '#e5e5e5',
                    }}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={14}
                      color={isSelected ? '#fff' : '#555'}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: isSelected ? '#fff' : '#333',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Date input */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Text style={sectionLabel}>Date</Text>
            {Platform.OS === 'web' ? (
              <WebInput
                type="date"
                value={draftDate}
                onChange={setDraftDate}
              />
            ) : (
              <>
                <TextInput
                  style={[nativeInputStyle, draftDate.length > 0 && !hasDate && { borderColor: '#FF9500' }]}
                  value={draftDate}
                  onChangeText={setDraftDate}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
                {draftDate.length > 0 && !hasDate && (
                  <Text style={{ fontSize: 11, color: '#FF9500', marginTop: 4, paddingHorizontal: 20 }}>
                    Use format YYYY-MM-DD (e.g. 2026-04-15)
                  </Text>
                )}
              </>
            )}
          </View>

          {/* Time quick picks */}
          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            <Text style={sectionLabel}>Time (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <TimePill label="No time" selected={draftTime === ''} onPress={() => setDraftTime('')} />
              {TIME_PRESETS.map((t) => (
                <TimePill
                  key={t.value}
                  label={t.label}
                  selected={draftTime === t.value}
                  onPress={() => setDraftTime(t.value)}
                />
              ))}
            </View>
          </View>

          {/* Action buttons */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 20,
              gap: 10,
            }}
          >
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: '#f5f5f5',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '500', color: '#555' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!hasDate || saving}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: hasDate && !saving ? '#2563eb' : '#ccc',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {saving && <ActivityIndicator size="small" color="#fff" />}
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const sectionLabel = {
  fontSize: 12,
  fontWeight: '500' as const,
  color: '#888',
  marginBottom: 8,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
};

const nativeInputStyle = {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 10,
  padding: 12,
  fontSize: 15,
  color: '#111',
  backgroundColor: '#fafafa',
};

// ── Web-only: native <input> with type="date" or type="time" ───────────────────

function WebInput({
  type,
  value,
  onChange,
  placeholder,
}: {
  type: 'date' | 'time';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  if (Platform.OS !== 'web') return null;

  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange((e.target as HTMLInputElement).value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '12px',
        fontSize: '15px',
        border: '1px solid #ddd',
        borderRadius: '10px',
        backgroundColor: '#fafafa',
        color: value ? '#111' : '#999',
        fontFamily: 'inherit',
        outline: 'none',
        cursor: 'pointer',
        boxSizing: 'border-box' as const,
      }}
    />
  );
}
