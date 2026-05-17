import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

export interface RedeemLandingBlueprint {
  id: string;
  title: string;
  stepCount: number;
  durationMonths: number;
  capabilities: string[];
}

export interface RedeemLandingAuthor {
  name: string;
  affiliation: string | null;
  avatarInitials: string;
}

export interface RedeemLandingProps {
  token: string;
  blueprintAuthor: RedeemLandingAuthor;
  blueprint: RedeemLandingBlueprint;
  fleetCount: number;
  fleetSampleAvatars: { initials: string; color: string }[];
  freeMonths: number;
  postFreePrice: string;
  onAccept: () => Promise<void> | void;
  onSkip: () => void;
}

export function RedeemLanding({
  blueprintAuthor,
  blueprint,
  fleetCount,
  fleetSampleAvatars,
  freeMonths,
  postFreePrice,
  onAccept,
  onSkip,
}: RedeemLandingProps) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await onAccept();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to accept invitation';
      setErrorMessage(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <View style={styles.welcomePill}>
        <Sparkles size={14} color="#6D28D9" />
        <Text style={styles.welcomePillText}>Welcome to BetterAt</Text>
      </View>

      <View style={styles.authorBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{blueprintAuthor.avatarInitials}</Text>
        </View>
        <View style={styles.authorCopy}>
          <Text style={styles.authorName}>{blueprintAuthor.name}</Text>
          {blueprintAuthor.affiliation ? (
            <Text style={styles.authorAffiliation}>{blueprintAuthor.affiliation}</Text>
          ) : null}
          <Text style={styles.authorSubtitle}>shared a blueprint with you</Text>
        </View>
      </View>

      <Text style={styles.title}>{blueprint.title}</Text>

      <View style={styles.statsCard}>
        <Stat label="steps" value={String(blueprint.stepCount)} />
        <View style={styles.statDivider} />
        <Stat label="months" value={String(blueprint.durationMonths)} />
        <View style={styles.statDivider} />
        <Stat label="capabilities" value={String(blueprint.capabilities.length)} />
      </View>

      <View style={styles.capabilityBlock}>
        <Text style={styles.sectionEyebrow}>You'll work on</Text>
        <View style={styles.chipRow}>
          {blueprint.capabilities.slice(0, 6).map((cap) => (
            <View key={cap} style={styles.chip}>
              <Text style={styles.chipText}>{cap}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.fleetBadge}>
        <View style={styles.fleetAvatars}>
          {fleetSampleAvatars.slice(0, 3).map((p, idx) => (
            <View
              key={p.initials + idx}
              style={[styles.fleetAvatar, { backgroundColor: p.color, marginLeft: idx === 0 ? 0 : -8 }]}
            >
              <Text style={styles.fleetAvatarText}>{p.initials}</Text>
            </View>
          ))}
        </View>
        <View style={styles.fleetCopy}>
          <Text style={styles.fleetEyebrow}>Fleet of practitioners</Text>
          <Text style={styles.fleetLine}>{fleetCount} sailors using this blueprint</Text>
        </View>
      </View>

      <Pressable
        style={[styles.acceptCta, busy && styles.acceptCtaBusy]}
        onPress={handleAccept}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
        <Text style={styles.acceptCtaText}>{busy ? 'Setting up' : 'Accept & start preparing'}</Text>
      </Pressable>

      <Text style={styles.privacyHint}>
        First {freeMonths} months free, then {postFreePrice}. We won't email you until you ask us to.
      </Text>

      {errorMessage ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <Pressable onPress={onSkip} style={styles.skip}>
        <Text style={styles.skipText}>Not now</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 48,
    gap: 18,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  welcomePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  welcomePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6D28D9',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  authorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  authorCopy: {
    gap: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  authorAffiliation: {
    fontSize: 12,
    color: '#6B7280',
  },
  authorSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    color: '#111827',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    justifyContent: 'space-around',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
  },
  capabilityBlock: {
    gap: 8,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  fleetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  fleetAvatars: {
    flexDirection: 'row',
  },
  fleetAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fleetAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fleetCopy: {
    flex: 1,
  },
  fleetEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fleetLine: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  acceptCta: {
    backgroundColor: '#6D28D9',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  acceptCtaBusy: {
    opacity: 0.7,
  },
  acceptCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  privacyHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorBlock: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
});
