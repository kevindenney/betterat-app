import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Anchor, Lock, Users } from 'lucide-react-native';
import type { CaptureVisibility } from '@/types/sharing';

export interface ShareCaptureSheetProps {
  visible: boolean;
  capture: {
    id: string;
    kind: 'voice' | 'text' | 'note' | 'photo' | 'video' | 'scan' | 'measurement' | 'media_link';
    body: string;
    timestamp?: string;
    audioDurationSec?: number;
  };
  currentVisibility: CaptureVisibility;
  isNursing: boolean;
  onChangeVisibility: (visibility: CaptureVisibility) => Promise<void> | void;
  onDismiss: () => void;
}

const RINGS: { key: CaptureVisibility; name: string; desc: string; icon: 'lock' | 'users' | 'anchor' }[] = [
  { key: 'private', name: 'Private', desc: 'Only you and your coach', icon: 'lock' },
  { key: 'crew', name: 'Crew', desc: 'People on your boat / study group', icon: 'users' },
  { key: 'fleet', name: 'Fleet / Cohort', desc: 'Everyone who raced this race / did this rotation', icon: 'anchor' },
];

function iconFor(kind: ShareCaptureSheetProps['capture']['kind']): string {
  if (kind === 'voice') return 'voice';
  if (kind === 'photo' || kind === 'video' || kind === 'scan') return kind;
  return 'note';
}

function formatPreviewMeta(capture: ShareCaptureSheetProps['capture']): string {
  const bits: string[] = [];
  if (capture.timestamp) bits.push(new Date(capture.timestamp).toLocaleTimeString());
  bits.push(iconFor(capture.kind));
  if (capture.audioDurationSec) bits.push(`${capture.audioDurationSec}s`);
  return bits.join(' · ');
}

export function ShareCaptureSheet({
  visible,
  capture,
  currentVisibility,
  isNursing,
  onChangeVisibility,
  onDismiss,
}: ShareCaptureSheetProps) {
  const [busy, setBusy] = useState<CaptureVisibility | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePick = async (next: CaptureVisibility) => {
    setBusy(next);
    setErrorMessage(null);
    try {
      await onChangeVisibility(next);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update visibility';
      setErrorMessage(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Share this capture</Text>
          <Text style={styles.sub}>Only this single observation — not the whole step.</Text>

          <View style={styles.preview}>
            <Text style={styles.previewMeta}>{formatPreviewMeta(capture)}</Text>
            <Text style={styles.previewBody}>"{capture.body}"</Text>
          </View>

          {RINGS.map((ring) => {
            const selected = ring.key === currentVisibility;
            const isBusy = busy === ring.key;
            return (
              <Pressable
                key={ring.key}
                style={[styles.ringRow, selected && styles.ringRowSelected, isBusy && styles.ringRowBusy]}
                onPress={() => void handlePick(ring.key)}
                disabled={busy !== null}
              >
                <View style={[styles.ringIcon, selected && styles.ringIconSelected]}>
                  {ring.icon === 'lock' ? (
                    <Lock size={16} color={selected ? '#FFFFFF' : '#6B7280'} />
                  ) : ring.icon === 'users' ? (
                    <Users size={16} color={selected ? '#FFFFFF' : '#6B7280'} />
                  ) : (
                    <Anchor size={16} color={selected ? '#FFFFFF' : '#6B7280'} />
                  )}
                </View>
                <View style={styles.ringCopy}>
                  <Text style={styles.ringName}>{ring.name}</Text>
                  <Text style={styles.ringDesc}>{ring.desc}</Text>
                </View>
                {selected ? <View style={styles.check} /> : null}
              </Pressable>
            );
          })}

          {isNursing ? (
            <View style={styles.nursingNote}>
              <Text style={styles.nursingNoteTitle}>Nursing interest</Text>
              <Text style={styles.nursingNoteBody}>
                Sharing to Crew/Fleet hides patient identifiers by default. Capture is scanned before posting.
              </Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Pressable style={styles.done} onPress={onDismiss}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sub: {
    fontSize: 13,
    color: '#6B7280',
  },
  preview: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  previewMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  previewBody: {
    fontSize: 14,
    color: '#111827',
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  ringRowSelected: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  ringRowBusy: {
    opacity: 0.6,
  },
  ringIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringIconSelected: {
    backgroundColor: '#16A34A',
  },
  ringCopy: {
    flex: 1,
    gap: 2,
  },
  ringName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  ringDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
  check: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
  },
  nursingNote: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FED7AA',
    gap: 4,
  },
  nursingNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A3412',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nursingNoteBody: {
    fontSize: 12,
    color: '#9A3412',
  },
  errorBlock: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
  },
  done: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
});
