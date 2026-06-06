import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowRight, Sparkles } from 'lucide-react-native';
import { fontFamily } from '@/lib/design-tokens-editorial';

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
  /** "your Worlds coach" — eyebrow line above the quoted blueprint title. */
  role?: string;
}

export interface RedeemLandingProps {
  token: string;
  blueprintAuthor: RedeemLandingAuthor;
  blueprint: RedeemLandingBlueprint;
  fleetCount: number;
  fleetSampleAvatars: { initials: string; color: string }[];
  freeMonths: number;
  postFreePrice: string;
  /** Optional subtitle line below the quoted title. */
  blueprintSubtitle?: string;
  /** Optional updated-at meta shown in the blueprint preview head ("Updated April · v3.2"). */
  blueprintVersionLine?: string;
  /** Welcome-pill copy ("Welcoming you · 90 days free"). */
  welcomePillText?: string;
  /** Fleet badge primary line ("63 Worlds sailors already started"). */
  fleetTagline?: string;
  /** Fleet badge sub line ("Same race · same conditions · same fleet"). */
  fleetSubline?: string;
  onAccept: () => Promise<void> | void;
  onSkip: () => void;
}

const COLORS = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  ink: '#1C1C1E',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  line: '#E5E5EA',
  purple: '#5856D6',
  purpleDeep: '#3F3DAB',
  purpleSoft: '#D7D6F4',
  purpleTint: '#EFEFFB',
  blue: '#007AFF',
  blueDeep: '#0040DD',
  green: '#34C759',
  greenDeep: '#0A6B2A',
  greenSoft: '#B7E8C2',
  greenTint: '#E8F8EC',
  gray6: '#F2F2F7',
  serif: fontFamily.serif,
};

export function RedeemLanding({
  blueprintAuthor,
  blueprint,
  fleetCount,
  fleetSampleAvatars,
  freeMonths,
  postFreePrice,
  blueprintSubtitle,
  blueprintVersionLine,
  welcomePillText,
  fleetTagline,
  fleetSubline,
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
      {/* Pill row: welcome pill + Not now */}
      <View style={styles.pillRow}>
        <View style={styles.welcomePill}>
          <Sparkles size={11} color={COLORS.purpleDeep} />
          <Text style={styles.welcomePillText}>
            {welcomePillText ?? `Welcoming you · ${freeMonths * 30} days free`}
          </Text>
        </View>
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={styles.notNow}>Not now</Text>
        </Pressable>
      </View>

      {/* Hero: glyph, coach byline, italic quoted title, sub */}
      <View style={styles.hero}>
        <View style={styles.glyph}>
          <Text style={styles.glyphB}>b</Text>
          <View style={styles.glyphUnderline} />
        </View>
        <Text style={styles.byName}>
          <Text style={styles.byNameStrong}>{blueprintAuthor.name}</Text>
          {blueprintAuthor.role ? `, ${blueprintAuthor.role}, ` : ', '}
          is welcoming you to
        </Text>
        <Text style={styles.title}>“{blueprint.title}”</Text>
        {blueprintSubtitle ? <Text style={styles.subHead}>{blueprintSubtitle}</Text> : null}
      </View>

      {/* Blueprint preview card */}
      <View style={styles.preview}>
        <View style={styles.previewHead}>
          <Text style={styles.previewLbl}>Your blueprint</Text>
          {blueprintVersionLine ? (
            <Text style={styles.previewMeta}>{blueprintVersionLine}</Text>
          ) : null}
        </View>
        <View style={styles.stats}>
          <Stat label="Steps" value={String(blueprint.stepCount)} />
          <Stat label="Months" value={String(blueprint.durationMonths)} />
          <Stat label="Capabilities" value={String(blueprint.capabilities.length)} />
        </View>
        <View style={styles.caps}>
          {blueprint.capabilities.slice(0, 6).map((cap) => (
            <View key={cap} style={styles.capChip}>
              <Text style={styles.capChipText}>{cap}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Fleet badge */}
      <View style={styles.fleet}>
        <View style={styles.fleetAvatars}>
          {fleetSampleAvatars.slice(0, 4).map((p, idx) => (
            <View
              key={p.initials + idx}
              style={[
                styles.fleetAvatar,
                { backgroundColor: p.color, marginLeft: idx === 0 ? 0 : -8 },
              ]}
            >
              <Text style={styles.fleetAvatarText}>{p.initials}</Text>
            </View>
          ))}
        </View>
        <View style={styles.fleetCopy}>
          <Text style={styles.fleetName}>
            {fleetTagline ?? `${fleetCount} sailors already started`}
          </Text>
          <Text style={styles.fleetDesc}>{fleetSubline ?? 'Same race · same conditions · same fleet'}</Text>
        </View>
      </View>

      {/* Primary CTA */}
      <Pressable
        style={[styles.cta, busy && styles.ctaBusy]}
        onPress={handleAccept}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.ctaText}>Accept &amp; start preparing</Text>
            <ArrowRight size={16} color="#FFFFFF" />
          </>
        )}
      </Pressable>
      <Text style={styles.priv}>
        <Text style={styles.privStrong}>
          Free for {freeMonths * 30} days · then {postFreePrice}
        </Text>
        {' · cancel anytime · no card now'}
      </Text>

      {errorMessage ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
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
    backgroundColor: COLORS.bg,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 32,
    gap: 12,
    maxWidth: 460,
    alignSelf: 'center',
    width: '100%',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  welcomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 9,
    paddingRight: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.purpleTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.purpleSoft,
  },
  welcomePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.purpleDeep,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  notNow: {
    color: COLORS.label3,
    fontSize: 12,
    letterSpacing: -0.05,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 12,
    gap: 6,
  },
  glyph: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1F2D44',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0B1525',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  glyphB: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -2,
    marginBottom: -2,
  },
  glyphUnderline: {
    width: 18,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginTop: 3,
    borderRadius: 1,
  },
  byName: {
    fontSize: 11.5,
    color: COLORS.label3,
    marginTop: 10,
    textAlign: 'center',
  },
  byNameStrong: {
    color: COLORS.label,
    fontWeight: '600',
  },
  title: {
    fontFamily: COLORS.serif,
    fontStyle: 'italic',
    fontSize: 23,
    fontWeight: '500',
    color: COLORS.label,
    textAlign: 'center',
    lineHeight: 27,
    letterSpacing: -0.4,
    marginTop: 0,
  },
  subHead: {
    fontSize: 12.5,
    color: COLORS.label2,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: -0.05,
  },
  preview: {
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 14,
  },
  previewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  previewLbl: {
    fontSize: 9.5,
    fontWeight: '700',
    color: COLORS.label2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  previewMeta: {
    fontSize: 10,
    color: COLORS.label3,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: COLORS.gray6,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.label,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.label3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  caps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  capChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: COLORS.purpleTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.purpleSoft,
  },
  capChipText: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.purpleDeep,
  },
  fleet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.greenTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.greenSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 4,
  },
  fleetAvatars: {
    flexDirection: 'row',
  },
  fleetAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  fleetAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fleetCopy: {
    flex: 1,
  },
  fleetName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.greenDeep,
    letterSpacing: -0.1,
  },
  fleetDesc: {
    fontSize: 10.5,
    color: COLORS.greenDeep,
    opacity: 0.85,
    marginTop: 1,
  },
  cta: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: COLORS.blue,
    shadowOpacity: 0.36,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  ctaBusy: {
    opacity: 0.74,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  priv: {
    textAlign: 'center',
    fontSize: 10.5,
    color: COLORS.label3,
    marginTop: 6,
    lineHeight: 14,
  },
  privStrong: {
    color: COLORS.label2,
    fontWeight: '500',
  },
  errorBlock: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
  },
});
