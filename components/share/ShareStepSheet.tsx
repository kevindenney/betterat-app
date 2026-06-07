import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Anchor, ChevronRight, Link as LinkIcon, Send, Sparkles } from 'lucide-react-native';
import { fontFamily } from '@/lib/design-tokens-editorial';

export type ShareMode = 'direct' | 'group' | 'link' | 'suggest';

export interface ShareStepSheetRecipient {
  id: string;
  initials: string;
  avatarColor?: string;
  name: string;
  /** Disambiguator (email / handle) shown beneath the name when present. */
  handle?: string;
}

export interface ShareStepSheetGroup {
  id: string;
  name: string;
  memberCount: number;
}

export interface ShareStepSheetProps {
  visible: boolean;
  step: { id: string; title: string; body: string };
  recentRecipients: ShareStepSheetRecipient[];
  defaultGroup?: ShareStepSheetGroup;
  onShareDirect: (recipientId: string) => Promise<void> | void;
  onShareToGroup: (groupId: string) => Promise<void> | void;
  onCopyLink: () => Promise<string> | string;
  /**
   * Optional "Suggest as a next step" path. When provided, a new mode
   * row appears that opens a recipient picker; on selection this is
   * called with the chosen user_id and an optional message. The
   * recipient sees the suggestion in their Practice Inbox.
   */
  onSuggestDirect?: (recipientId: string, message?: string) => Promise<void> | void;
  onDismiss: () => void;
}

const AVATAR_PALETTE = ['#4338CA', '#9333EA', '#16A34A', '#E11D48', '#0EA5E9'];

function avatarColor(seed: string, override?: string): string {
  if (override) return override;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function ShareStepSheet({
  visible,
  step,
  recentRecipients,
  defaultGroup,
  onShareDirect,
  onShareToGroup,
  onCopyLink,
  onSuggestDirect,
  onDismiss,
}: ShareStepSheetProps) {
  const [busyKind, setBusyKind] = useState<ShareMode | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [suggestPickerOpen, setSuggestPickerOpen] = useState(false);
  const canSuggest = Boolean(onSuggestDirect);

  const wrap =
    <T,>(kind: ShareMode, fn: () => Promise<T> | T) =>
    async () => {
      setBusyKind(kind);
      try {
        const result = await fn();
        return result;
      } finally {
        setBusyKind(null);
      }
    };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable testID="share-step-sheet" style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Share this step</Text>
          <Text style={styles.sub}>They'll see your plan · they can fork their own copy.</Text>

          <View style={styles.preview}>
            <Text style={styles.previewEyebrow}>Your step</Text>
            <Text style={styles.previewTitle} numberOfLines={2}>{step.title}</Text>
            {step.body ? <Text style={styles.previewBody} numberOfLines={3}>{step.body}</Text> : null}
          </View>

          <Pressable
            testID="share-step-direct"
            style={[styles.modeRow, busyKind === 'direct' && styles.modeRowBusy]}
            disabled={busyKind !== null}
            onPress={() => {
              if (recentRecipients[0]) {
                void wrap('direct', () => onShareDirect(recentRecipients[0].id))();
              }
            }}
          >
            <View style={styles.modeIcon}>
              <Send size={18} color="#2563EB" />
            </View>
            <View style={styles.modeCopy}>
              <Text style={styles.modeName}>Direct to a person</Text>
              <Text style={styles.modeDesc}>Send to a follow or crew member · they get a notification</Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>

          {canSuggest ? (
            <Pressable
              testID="share-step-suggest"
              style={[styles.modeRow, busyKind === 'suggest' && styles.modeRowBusy]}
              disabled={busyKind !== null}
              onPress={() => setSuggestPickerOpen(true)}
            >
              <View style={[styles.modeIcon, styles.modeIconSuggest]}>
                <Sparkles size={18} color="#7C3AED" />
              </View>
              <View style={styles.modeCopy}>
                <Text style={styles.modeName}>Suggest as a next step</Text>
                <Text style={styles.modeDesc}>
                  Lands in their Practice Inbox · they can add it to their timeline
                </Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}

          {defaultGroup ? (
            <Pressable
              testID="share-step-group"
              style={[styles.modeRow, busyKind === 'group' && styles.modeRowBusy]}
              disabled={busyKind !== null}
              onPress={() => void wrap('group', () => onShareToGroup(defaultGroup.id))()}
            >
              <View style={styles.modeIcon}>
                <Anchor size={18} color="#16A34A" />
              </View>
              <View style={styles.modeCopy}>
                <Text style={styles.modeName}>To fleet · {defaultGroup.name}</Text>
                <Text style={styles.modeDesc}>{defaultGroup.memberCount} members · everyone in your fleet sees it</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}

          <Pressable
            testID="share-step-copy-link"
            style={[styles.modeRow, busyKind === 'link' && styles.modeRowBusy]}
            disabled={busyKind !== null}
            onPress={async () => {
              const url = await wrap('link', onCopyLink)();
              if (typeof url === 'string') setCopiedUrl(url);
            }}
          >
            <View style={styles.modeIcon}>
              <LinkIcon size={18} color="#0EA5E9" />
            </View>
            <View style={styles.modeCopy}>
              <Text style={styles.modeName}>Copy link</Text>
              <Text style={styles.modeDesc}>
                {copiedUrl ? `Copied · ${copiedUrl}` : 'Anyone with the link can view · expires in 30 days'}
              </Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>

          {recentRecipients.length > 0 ? (
            <View style={styles.recentBlock}>
              <Text style={styles.recentEyebrow}>Recent</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentRow}
              >
                {recentRecipients.map((person) => (
                  <Pressable
                    key={person.id}
                    style={styles.personTile}
                    onPress={() => void wrap('direct', () => onShareDirect(person.id))()}
                    disabled={busyKind !== null}
                  >
                    <View style={[styles.personAvatar, { backgroundColor: avatarColor(person.id, person.avatarColor) }]}>
                      <Text style={styles.personInitials}>{person.initials.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.personName} numberOfLines={1}>{person.name}</Text>
                    {person.handle ? (
                      <Text style={styles.personHandle} numberOfLines={1}>
                        {person.handle}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Pressable style={styles.cancel} onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>

      <Modal
        visible={suggestPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSuggestPickerOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setSuggestPickerOpen(false)}>
          <Pressable testID="share-suggest-sheet" style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title}>Suggest to…</Text>
            <Text style={styles.sub}>Pick a person — the step lands in their Inbox as a suggestion.</Text>
            {recentRecipients.length === 0 ? (
              <Text style={styles.suggestEmpty}>
                No one to suggest to yet. Follow a mentor or crew member first.
              </Text>
            ) : (
              <ScrollView style={styles.suggestList}>
                {recentRecipients.map((person, index) => (
                  <Pressable
                    key={person.id}
                    testID={`share-suggest-recipient-${index + 1}`}
                    style={[styles.suggestRow, busyKind === 'suggest' && styles.modeRowBusy]}
                    disabled={busyKind !== null || !onSuggestDirect}
                    onPress={async () => {
                      if (!onSuggestDirect) return;
                      await wrap('suggest', () => onSuggestDirect(person.id))();
                      setSuggestPickerOpen(false);
                    }}
                  >
                    <View
                      style={[
                        styles.personAvatar,
                        { backgroundColor: avatarColor(person.id, person.avatarColor) },
                      ]}
                    >
                      <Text style={styles.personInitials}>
                        {person.initials.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.suggestNameWrap}>
                      <Text style={styles.suggestName} numberOfLines={1}>
                        {person.name}
                      </Text>
                      {person.handle ? (
                        <Text style={styles.suggestHandle} numberOfLines={1}>
                          {person.handle}
                        </Text>
                      ) : null}
                    </View>
                    <ChevronRight size={18} color="#9CA3AF" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable style={styles.cancel} onPress={() => setSuggestPickerOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  previewEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#6B7280',
  },
  previewTitle: {
    fontSize: 18,
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    color: '#111827',
  },
  previewBody: {
    fontSize: 13,
    color: '#4B5563',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  modeRowBusy: {
    opacity: 0.7,
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  modeIconSuggest: {
    backgroundColor: 'rgba(124,58,237,0.10)',
    borderColor: 'rgba(124,58,237,0.30)',
  },
  suggestList: {
    maxHeight: 320,
    marginVertical: 4,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  suggestNameWrap: {
    flex: 1,
    gap: 1,
  },
  suggestName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  suggestHandle: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  suggestEmpty: {
    paddingVertical: 18,
    paddingHorizontal: 4,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  modeCopy: {
    flex: 1,
    gap: 2,
  },
  modeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  modeDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
  recentBlock: {
    gap: 8,
  },
  recentEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#6B7280',
  },
  recentRow: {
    gap: 12,
    paddingVertical: 4,
  },
  personTile: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitials: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  personName: {
    fontSize: 12,
    color: '#374151',
    maxWidth: 64,
  },
  personHandle: {
    fontSize: 9.5,
    color: '#9CA3AF',
    maxWidth: 64,
    marginTop: 1,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
});
