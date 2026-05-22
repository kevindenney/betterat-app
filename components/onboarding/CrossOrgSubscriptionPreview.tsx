/**
 * Cross-org subscription previews (Frames 15-17 of the institutions pass).
 *
 * Reusable phone-mockup components that render Emily Shaw (Hopkins MSN
 * student) buying Noor Khoury's "Drawing daily" blueprint with Apple Pay,
 * then landing in Practice with Drawing alongside Nursing in the interest
 * switcher.
 *
 *   - DiscoverDetailFrame    · Frame 15 · Noor's blueprint detail with
 *                              sticky Subscribe purchase bar
 *   - ApplePaySheetFrame     · Frame 16 · Apple-Pay-shaped subscription
 *                              confirm with "via Stripe" merchant + the
 *                              navy "your school doesn't see this" note
 *   - PracticeDrawingFrame   · Frame 17 · Interest switcher open showing
 *                              Drawing as a second interest alongside
 *                              Nursing, with the first Drawing step card
 *                              peeking below
 *
 * Architectural commitment: the seam between "the org pays for the seat"
 * and "the practitioner pays for content" is designed to be invisible
 * while staying honest about who owes whom what.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { PhoneFrame } from './StudentOnboardingPreview';

// ---------------------------------------------------------------------------
// Frame 15 — Discover detail · Noor's "Drawing daily" blueprint
// ---------------------------------------------------------------------------

export function DiscoverDetailFrame() {
  return (
    <PhoneFrame statusBarTime="21:08">
      <View style={s.f15Root}>
        {/* Discover top nav */}
        <View style={s.f15TopNav}>
          <Ionicons name="chevron-back" size={22} color="#D97757" />
          <Text style={s.f15BackText}>Discover</Text>
          <Text style={s.f15PersonText}>Person</Text>
          <View style={s.f15Avatar}>
            <Text style={s.f15AvatarText}>ES</Text>
            <View style={s.f15AvatarPip}>
              <Text style={s.f15AvatarPipText}>JH</Text>
            </View>
          </View>
        </View>

        {/* Cover hero */}
        <View style={s.f15Cover}>
          <Svg viewBox="0 0 300 260" style={s.f15CoverDoodle}>
            <Path
              d="M20,40 C60,80 80,30 140,60 S220,90 280,40"
              stroke="#fff"
              strokeWidth={1.5}
              fill="none"
            />
            <Path
              d="M10,120 C70,160 110,90 180,140 S250,170 290,120"
              stroke="#fff"
              strokeWidth={1.5}
              fill="none"
            />
            <Path
              d="M20,200 C60,240 100,180 160,210 S230,250 290,200"
              stroke="#fff"
              strokeWidth={1.5}
              fill="none"
            />
            <Circle cx={80} cy={80} r={20} stroke="#fff" strokeWidth={1} fill="none" />
            <Circle cx={220} cy={180} r={14} stroke="#fff" strokeWidth={1} fill="none" />
          </Svg>
          <View style={s.f15CoverContent}>
            <Text style={s.f15CoverEyebrow}>Drawing · habit blueprint</Text>
            <View>
              <Text style={s.f15CoverTitle}>
                Drawing daily{'\n'}30 days of line
              </Text>
              <Text style={s.f15CoverSub}>
                A month of small line studies — fifteen minutes a day. By Noor
                Khoury, illustrator, Berlin.
              </Text>
            </View>
          </View>
        </View>

        {/* Author strip */}
        <View style={s.f15Author}>
          <View style={s.f15AuthorAvi}>
            <Text style={s.f15AuthorAviText}>NK</Text>
          </View>
          <View style={s.f15AuthorCol}>
            <Text style={s.f15AuthorName}>Noor Khoury</Text>
            <Text style={s.f15AuthorSub}>Independent · 842 subscribers · ★ 4.9</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="rgba(60, 60, 67, 0.4)" />
        </View>

        {/* Body */}
        <View style={s.f15Body}>
          <Text style={s.f15Lede}>
            A daily drawing habit isn't about getting good. It's about{' '}
            <Text style={s.f15LedeEm}>looking long enough to be surprised.</Text>{' '}
            Thirty prompts, fifteen minutes each, no skill prerequisite. Includes
            weekly mentor review on prompts you submit.
          </Text>
          <View style={s.f15Stats}>
            <View>
              <Text style={s.f15StatLabel}>Duration</Text>
              <Text style={s.f15StatValue}>30 days · 15m / day</Text>
            </View>
            <View>
              <Text style={s.f15StatLabel}>Steps</Text>
              <Text style={s.f15StatValue}>30</Text>
            </View>
            <View>
              <Text style={s.f15StatLabel}>Mentor</Text>
              <Text style={s.f15StatValue}>Noor · weekly</Text>
            </View>
          </View>
        </View>

        {/* Sticky purchase bar */}
        <View style={s.f15PurchaseBar}>
          <View style={s.f15PriceCol}>
            <Text style={s.f15PriceLabel}>Monthly subscription</Text>
            <Text style={s.f15PriceValue}>
              €9.00 / mo <Text style={s.f15PriceValueSub}>· cancel any time</Text>
            </Text>
          </View>
          <View style={s.f15SubscribeBtn}>
            <Ionicons name="logo-apple" size={16} color="#FFFFFF" />
            <Text style={s.f15SubscribeText}>Subscribe</Text>
          </View>
        </View>

        {/* Tab bar */}
        <View style={s.tabbar}>
          <Tab icon="flag" label="Practice" />
          <Tab icon="book" label="Library" />
          <Tab icon="compass" label="Discover" active accentColor="#D97757" />
          <Tab icon="time-outline" label="Reflect" />
        </View>
      </View>
    </PhoneFrame>
  );
}

// ---------------------------------------------------------------------------
// Frame 16 — Apple Pay sheet
// ---------------------------------------------------------------------------

export function ApplePaySheetFrame() {
  return (
    <PhoneFrame statusBarLight statusBarTime="21:09">
      <View style={s.f16Root}>
        {/* Faded background */}
        <View style={s.f16Bg}>
          <View style={s.f16BgNav} />
          <View style={s.f16BgCover} />
        </View>

        {/* Sheet */}
        <View style={s.f16Sheet}>
          <View style={s.f16SheetHead}>
            <Ionicons name="close" size={20} color="rgba(60, 60, 67, 0.4)" />
            <Text style={s.f16SheetTitle}>Apple Pay</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Merchant */}
          <View style={s.f16Card}>
            <View style={s.f16MerchantAvi}>
              <Text style={s.f16MerchantAviText}>NK</Text>
            </View>
            <View style={s.f16MerchantCol}>
              <Text style={s.f16MerchantName}>Noor Khoury · The Line Drawn</Text>
              <Text style={s.f16MerchantSub}>via Stripe · ★★★★★ verified author</Text>
            </View>
          </View>

          {/* Line items */}
          <View style={[s.f16Card, s.f16CardPlain]}>
            <View style={s.f16LineItem}>
              <View>
                <Text style={s.f16LineItemTitle}>Drawing daily · 30 days of line</Text>
                <Text style={s.f16LineItemSub}>Monthly · auto-renews</Text>
              </View>
              <Text style={s.f16LineItemAmt}>€9.00</Text>
            </View>
            <View style={[s.f16LineItem, s.f16LineItemTotal]}>
              <Text style={s.f16LineItemTitleStrong}>Total · today</Text>
              <Text style={s.f16LineItemAmtStrong}>€9.00</Text>
            </View>
          </View>

          {/* Pay with */}
          <View style={s.f16Card}>
            <View style={s.f16Visa}>
              <Text style={s.f16VisaText}>VISA</Text>
            </View>
            <View style={s.f16MerchantCol}>
              <Text style={s.f16MerchantName}>Visa · 5483</Text>
              <Text style={s.f16MerchantSub}>Personal · not Hopkins MSN</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="rgba(60, 60, 67, 0.4)" />
          </View>

          {/* School-doesn't-see-this note */}
          <View style={s.f16HopkinsNote}>
            <Ionicons name="information-circle" size={14} color="#28406B" />
            <Text style={s.f16HopkinsText}>
              <Text style={s.f16HopkinsStrong}>Your school doesn't see this.</Text>{' '}
              Personal subscriptions are billed to your own card and don't appear
              in Hopkins's admin reports.
            </Text>
          </View>

          {/* Confirm */}
          <View style={s.f16PayBtn}>
            <Text style={s.f16PayText}>Pay with</Text>
            <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
          </View>
          <Text style={s.f16Renew}>
            Subscription renews monthly until cancelled · Manage in{' '}
            <Text style={s.f16RenewLink}>Subscriptions</Text>
          </Text>
        </View>
      </View>
    </PhoneFrame>
  );
}

// ---------------------------------------------------------------------------
// Frame 17 — Practice with Drawing as a second interest
// ---------------------------------------------------------------------------

export function PracticeDrawingFrame() {
  return (
    <PhoneFrame statusBarTime="21:09">
      <View style={s.f17Root}>
        {/* Top header — Drawing context, NO org chip */}
        <View style={s.f17Header}>
          <View style={s.f17Interest}>
            <View style={s.f17DrawingDot} />
            <Text style={s.f17InterestName}>Drawing</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(60, 60, 67, 0.4)" />
          </View>
          <View style={s.f17Right}>
            <Text style={s.f17StepCounter}>Step 1 of 30</Text>
            <View style={s.f17Avatar}>
              <Text style={s.f17AvatarText}>ES</Text>
              <View style={s.f17AvatarPip}>
                <Text style={s.f17AvatarPipText}>JH</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Interest switcher dropdown (open) */}
        <View style={s.f17Switcher}>
          <Text style={s.f17SwitcherEyebrow}>Your interests · tap to switch</Text>

          <View style={s.f17InterestRow}>
            <View style={[s.f17Dot, { backgroundColor: '#7A6A8E' }]} />
            <View style={s.f17InterestRowCol}>
              <Text style={s.f17InterestRowName}>Nursing</Text>
              <Text style={s.f17InterestRowSub}>
                Hopkins MSN · 27 steps on timeline · 3 due today
              </Text>
            </View>
          </View>

          <View style={[s.f17InterestRow, s.f17InterestRowActive]}>
            <View style={[s.f17Dot, { backgroundColor: '#B8855A' }]} />
            <View style={s.f17InterestRowCol}>
              <View style={s.f17InterestRowNameRow}>
                <Text style={s.f17InterestRowName}>Drawing</Text>
                <View style={s.f17NewBadge}>
                  <Text style={s.f17NewBadgeText}>New</Text>
                </View>
              </View>
              <Text style={s.f17InterestRowSub}>
                Noor Khoury · 1 of 30 steps · €9 / mo
              </Text>
            </View>
            <Ionicons name="checkmark" size={16} color="#007AFF" />
          </View>

          <View style={s.f17SwitcherDivider} />

          <View style={s.f17AddRow}>
            <Ionicons name="add" size={14} color="#007AFF" />
            <Text style={s.f17AddText}>Add an interest</Text>
          </View>
        </View>

        {/* First Drawing step card (peeking) */}
        <View style={s.f17StepCard}>
          <View style={s.f17Provenance}>
            <View style={s.f17ProvMono}>
              <Text style={s.f17ProvMonoText}>NK</Text>
            </View>
            <View style={s.f17ProvCol}>
              <Text style={s.f17ProvTitle}>Drawing daily · 30 days of line</Text>
              <Text style={s.f17ProvSub}>Noor Khoury · 842 also on this</Text>
            </View>
            <Ionicons name="chevron-forward" size={12} color="rgba(60, 60, 67, 0.4)" />
          </View>

          <View style={s.f17StepEyebrow}>
            <View style={s.f17StepDot} />
            <Text style={s.f17StepEyebrowText}>Day 1 · tonight</Text>
          </View>
          <Text style={s.f17StepTitle}>A single continuous line, no lifting</Text>
          <Text style={s.f17StepMeta}>15 minutes · any pen, any paper</Text>

          <Text style={s.f17Prompt}>
            "Find an object on your desk. Draw it without lifting your pen,
            without looking down at the paper. Set a timer."
          </Text>
          <Text style={s.f17PromptAttr}>— Noor's prompt</Text>
        </View>

        <View style={s.tabbar}>
          <Tab icon="flag" label="Practice" active />
          <Tab icon="book" label="Library" />
          <Tab icon="compass" label="Discover" />
          <Tab icon="time-outline" label="Reflect" />
        </View>
      </View>
    </PhoneFrame>
  );
}

// ---------------------------------------------------------------------------
// Shared Tab
// ---------------------------------------------------------------------------

function Tab({
  icon,
  label,
  active,
  accentColor = '#007AFF',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  accentColor?: string;
}) {
  return (
    <View style={s.tab}>
      <Ionicons
        name={icon}
        size={20}
        color={active ? accentColor : 'rgba(60, 60, 67, 0.6)'}
      />
      <Text style={[s.tabText, active && { color: accentColor, fontWeight: '600' }]}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  // ──────────────── Frame 15 ────────────────
  f15Root: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 4 },
  f15TopNav: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  f15BackText: { fontSize: 16, color: '#D97757' },
  f15PersonText: {
    marginLeft: 'auto',
    fontSize: 14,
    color: 'rgba(60, 60, 67, 0.6)',
  },
  f15Avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7A6A8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f15AvatarText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  f15AvatarPip: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    minWidth: 12,
    height: 12,
    paddingHorizontal: 2,
    borderRadius: 6,
    backgroundColor: '#28406B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f15AvatarPipText: { fontSize: 6.5, fontWeight: '700', color: '#FFFFFF' },

  f15Cover: {
    marginHorizontal: 16,
    height: 220,
    borderRadius: 18,
    backgroundColor: '#8B6E5A',
    overflow: 'hidden',
    ...({ boxShadow: '0 12px 28px -16px rgba(184, 133, 90, 0.5)' } as any),
  },
  f15CoverDoodle: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0.18 },
  f15CoverContent: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    padding: 22,
    justifyContent: 'space-between',
  },
  f15CoverEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.8)',
  },
  f15CoverTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '500',
    letterSpacing: -0.5,
    lineHeight: 30,
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
    marginBottom: 6,
  },
  f15CoverSub: {
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.85)',
    maxWidth: 230,
  },

  f15Author: {
    marginTop: 14,
    marginHorizontal: 16,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...({ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as any),
  },
  f15AuthorAvi: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#B8855A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f15AuthorAviText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  f15AuthorCol: { flex: 1, minWidth: 0 },
  f15AuthorName: { fontSize: 13.5, fontWeight: '600', color: '#1C1C1E' },
  f15AuthorSub: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },

  f15Body: { paddingHorizontal: 26, paddingTop: 16, paddingBottom: 12 },
  f15Lede: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#1C1C1E',
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
  },
  f15LedeEm: { fontStyle: 'italic' },
  f15Stats: { flexDirection: 'row', gap: 14, marginTop: 18 },
  f15StatLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
  },
  f15StatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 4,
  },

  f15PurchaseBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  f15PriceCol: { flex: 1, minWidth: 0 },
  f15PriceLabel: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '500' },
  f15PriceValue: {
    marginTop: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  f15PriceValueSub: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', fontWeight: '400' },
  f15SubscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: '#D97757',
    borderRadius: 22,
  },
  f15SubscribeText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  // ──────────────── Frame 16 ────────────────
  f16Root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  f16Bg: { padding: 22, paddingTop: 60, opacity: 0.32 },
  f16BgNav: { height: 56, backgroundColor: '#E5E5EA', borderRadius: 14, marginBottom: 12 },
  f16BgCover: { height: 220, backgroundColor: '#8B6E5A', borderRadius: 18 },

  f16Sheet: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    padding: 8,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(244,244,247,0.96)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  f16SheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  f16SheetTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: '#000000' },

  f16Card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  f16CardPlain: { padding: 0, overflow: 'hidden' },
  f16MerchantAvi: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#8B6E5A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f16MerchantAviText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  f16MerchantCol: { flex: 1, minWidth: 0 },
  f16MerchantName: { fontSize: 13.5, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  f16MerchantSub: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },

  f16LineItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(60, 60, 67, 0.29)',
  },
  f16LineItemTotal: { borderBottomWidth: 0 },
  f16LineItemTitle: { fontSize: 13.5, color: '#1C1C1E', letterSpacing: -0.1 },
  f16LineItemTitleStrong: { fontSize: 13.5, fontWeight: '600', color: '#1C1C1E' },
  f16LineItemSub: { marginTop: 1, fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  f16LineItemAmt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    fontVariant: ['tabular-nums'],
  },
  f16LineItemAmtStrong: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },

  f16Visa: {
    width: 38,
    height: 26,
    borderRadius: 5,
    backgroundColor: '#0F2944',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f16VisaText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },

  f16HopkinsNote: {
    backgroundColor: 'rgba(40, 64, 107, 0.06)',
    borderRadius: 10,
    padding: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
  },
  f16HopkinsText: {
    flex: 1,
    fontSize: 11.5,
    color: 'rgba(60, 60, 67, 0.85)',
    lineHeight: 17,
  },
  f16HopkinsStrong: { fontWeight: '600' },

  f16PayBtn: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  f16PayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  f16Renew: {
    marginTop: 4,
    fontSize: 10.5,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 15,
  },
  f16RenewLink: { color: '#007AFF' },

  // ──────────────── Frame 17 ────────────────
  f17Root: { flex: 1, backgroundColor: '#F2F2F7' },
  f17Header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  f17Interest: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  f17DrawingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B8855A' },
  f17InterestName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  f17Right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  f17StepCounter: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  f17Avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#7A6A8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f17AvatarText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  f17AvatarPip: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#28406B',
    borderWidth: 1.5,
    borderColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f17AvatarPipText: { fontSize: 8, fontWeight: '700', color: '#FFFFFF' },

  f17Switcher: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    ...({ boxShadow: '0 10px 28px -12px rgba(0,0,0,0.18)' } as any),
  },
  f17SwitcherEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.6)',
    marginBottom: 10,
  },
  f17InterestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  f17InterestRowActive: { backgroundColor: 'rgba(0, 122, 255, 0.10)' },
  f17Dot: { width: 10, height: 10, borderRadius: 5 },
  f17InterestRowCol: { flex: 1, minWidth: 0 },
  f17InterestRowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  f17InterestRowName: { fontSize: 14, fontWeight: '500', color: '#1C1C1E', letterSpacing: -0.1 },
  f17InterestRowSub: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 1 },
  f17NewBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: '#1E8F47',
    borderRadius: 3,
    marginLeft: 4,
  },
  f17NewBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  f17SwitcherDivider: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(60, 60, 67, 0.29)',
    marginVertical: 8,
  },
  f17AddRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6 },
  f17AddText: { fontSize: 13, color: '#007AFF', fontWeight: '500' },

  f17StepCard: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
    ...({ boxShadow: '0 8px 22px -10px rgba(0,0,0,0.10)' } as any),
  },
  f17Provenance: {
    backgroundColor: 'rgba(184, 133, 90, 0.08)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  f17ProvMono: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#B8855A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  f17ProvMonoText: { fontSize: 8.5, fontWeight: '700', color: '#FFFFFF' },
  f17ProvCol: { flex: 1, minWidth: 0 },
  f17ProvTitle: { fontSize: 11, fontWeight: '600', color: '#1C1C1E', lineHeight: 13 },
  f17ProvSub: { fontSize: 10.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 12, marginTop: 1 },

  f17StepEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  f17StepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B8855A' },
  f17StepEyebrowText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#B8855A',
  },
  f17StepTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: '#1C1C1E',
    lineHeight: 26,
    paddingHorizontal: 18,
    marginTop: 6,
  },
  f17StepMeta: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.6)',
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 12,
  },
  f17Prompt: {
    fontSize: 13,
    lineHeight: 20,
    color: '#1C1C1E',
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
    paddingHorizontal: 18,
  },
  f17PromptAttr: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    marginTop: 8,
    fontSize: 11,
    color: 'rgba(60, 60, 67, 0.6)',
  },

  // Tab bar
  tabbar: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  tab: { alignItems: 'center', gap: 2, paddingHorizontal: 12 },
  tabText: { fontSize: 10, color: 'rgba(60, 60, 67, 0.6)' },
});
