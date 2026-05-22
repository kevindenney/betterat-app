/**
 * Cross-org subscription preview (Frames 15-17 of the institutions pass).
 *
 * Emily Shaw — a Hopkins MSN student — buys Noor Khoury's "Drawing daily"
 * blueprint with Apple Pay. The transaction is between Emily and Noor (via
 * Stripe Connect); Hopkins is invoiced only for the seat itself, not for
 * what students subscribe to with their own wallet.
 *
 * Three frames side-by-side following the same preview-page pattern as
 * /schools/preview/student-onboarding. Production integration happens
 * when Stripe Connect setup + cross-org plan_subscriptions schema lands.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import {
  DiscoverDetailFrame,
  ApplePaySheetFrame,
  PracticeDrawingFrame,
} from '@/components/onboarding/CrossOrgSubscriptionPreview';
import { MktNav } from '@/components/marketing/MktNav';
import { Footer } from '../index';

export default function CrossOrgSubscriptionPreviewPage() {
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <MktNav active="schools" showBookDemo={false} />

        <View style={s.heading}>
          <Text style={s.eyebrow}>Design preview · Frames 15–17</Text>
          <Text style={s.title}>
            A Hopkins student buys a drawing blueprint from an illustrator in Berlin
          </Text>
          <Text style={s.sub}>
            The architectural commitment: Emily is enrolled at Hopkins, but Hopkins
            doesn't get to dictate her interests. She finds Noor Khoury's{' '}
            <Text style={s.subEm}>Drawing daily — 30 days of line</Text> on Discover,
            subscribes with Apple Pay, and the blueprint appears on her phone as a
            new interest alongside Nursing. The transaction is between Emily and
            Noor (via Stripe Connect); Hopkins is invoiced only for the seat itself.
          </Text>
        </View>

        <View style={s.frameRow}>
          <FrameWithCaption
            ordinal="15"
            caption="Discover detail · Noor's blueprint"
            body="The Discover detail surface uses the locked grammar — coral
              discovery accent, full-bleed cover, single italic-serif paragraph of
              editorial prose, author strip beneath. New affordance: a sticky
              purchase bar above the tab bar with price and the Subscribe CTA. The
              chrome doesn't change because Emily is a Hopkins student; this
              transaction is hers, not the org's."
          >
            <DiscoverDetailFrame />
          </FrameWithCaption>

          <FrameWithCaption
            ordinal="16"
            caption="Apple Pay sheet · subscription confirm"
            body="Native Apple Pay shape, two BetterAt-specific blocks. The
              merchant row names Noor Khoury · via Stripe, not BetterAt — the
              transaction is between Emily and Noor. The navy info card explicitly
              tells Emily her school doesn't see this — answering the privacy
              question before it's asked."
          >
            <ApplePaySheetFrame />
          </FrameWithCaption>

          <FrameWithCaption
            ordinal="17"
            caption="Practice · Drawing is now Emily's second interest"
            body="The interest-switcher dropdown is open, showing Nursing · Hopkins
              MSN (her org context) and Drawing · Noor Khoury (her personal
              subscription) coexist in the same picker. Notice the absence of org
              chrome on the Drawing context — no JH chip, no navy ground. Same app,
              two contexts, no seam."
          >
            <PracticeDrawingFrame />
          </FrameWithCaption>
        </View>

        <View style={s.intNote}>
          <Text style={s.intNoteTitle}>Integration scope</Text>
          <Text style={s.intNoteBody}>
            The three components live in
            <Text style={s.code}>
              {' '}
              components/onboarding/CrossOrgSubscriptionPreview.tsx{' '}
            </Text>
            as reusable Phone-frame previews. Production wiring needs three pieces:
            Stripe Connect setup (merchant onboarding for independent authors —
            new), in-app purchase flow (modify
            <Text style={s.code}> components/discover/* </Text>
            to surface the sticky Subscribe bar + open Apple Pay), and the interest
            switcher dropdown plumbing (new state in
            <Text style={s.code}> providers/InterestProvider </Text>
            to track multi-interest membership across orgs).
          </Text>
          <Text style={[s.intNoteBody, { marginTop: 8 }]}>
            <Text style={{ fontWeight: '700' }}>Note:</Text> the org-chip should
            disappear from the top header when the active interest is{' '}
            <Text style={s.code}>Personal</Text> (not org-affiliated). That's a
            tiny conditional in
            <Text style={s.code}> TabScreenToolbar </Text>.
          </Text>
        </View>

        <Footer />
      </ScrollView>
    </View>
  );
}

function FrameWithCaption({
  ordinal,
  caption,
  body,
  children,
}: {
  ordinal: string;
  caption: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.frameCol}>
      <View style={s.phoneSlot}>{children}</View>
      <Text style={s.frameCaption}>
        <Text style={s.frameCaptionStrong}>Frame {ordinal}</Text> · {caption}
      </Text>
      <Text style={s.frameBody}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFEAD8',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
  scroll: { paddingBottom: 0 },

  heading: {
    paddingHorizontal: 56,
    paddingTop: 56,
    paddingBottom: 28,
    maxWidth: 920,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: 'rgba(60, 60, 67, 0.55)',
    marginBottom: 12,
  },
  title: {
    fontSize: 36,
    fontWeight: '500',
    color: '#0E1117',
    letterSpacing: -0.6,
    marginBottom: 14,
    fontFamily: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }),
  },
  sub: { fontSize: 15.5, lineHeight: 24, color: 'rgba(60, 60, 67, 0.7)', maxWidth: 720 },
  subEm: { fontStyle: 'italic' },

  frameRow: {
    flexDirection: 'row',
    gap: 28,
    paddingHorizontal: 56,
    paddingVertical: 28,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  frameCol: { width: 360, alignItems: 'center', gap: 14 },
  phoneSlot: { alignItems: 'center' },
  frameCaption: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', textAlign: 'center' },
  frameCaptionStrong: { color: '#1C1C1E', fontWeight: '600' },
  frameBody: {
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'left',
    paddingHorizontal: 4,
  },

  intNote: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    margin: 28,
    marginTop: 24,
    padding: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#D97757',
  },
  intNoteTitle: { fontSize: 13, fontWeight: '700', color: '#D97757', marginBottom: 6 },
  intNoteBody: { fontSize: 13, lineHeight: 19, color: 'rgba(60, 60, 67, 0.85)' },
  code: {
    fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
    fontSize: 12,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
});
