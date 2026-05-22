/**
 * Student onboarding flow preview (Frames 12-14 of the institutions pass).
 *
 * Shows the three mobile frames side-by-side like the design canonical so
 * the school-domain claim flow can be reviewed without touching the live
 * auth path. Production integration is a separate task once domain-claim
 * backend wires up.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import {
  StudentEmailEntryFrame,
  StudentWelcomeFrame,
  StudentFirstHomeFrame,
} from '@/components/onboarding/StudentOnboardingPreview';
import { MktNav } from '@/components/marketing/MktNav';
import { Footer } from '../index';

export default function StudentOnboardingPreviewPage() {
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <MktNav active="schools" showBookDemo={false} />

        <View style={s.heading}>
          <Text style={s.eyebrow}>Design preview · Frames 12–14</Text>
          <Text style={s.title}>A new MSN student installs the app</Text>
          <Text style={s.sub}>
            Once Hopkins has verified <Text style={s.subMono}>@jh.edu</Text>, every
            student who signs in with that domain is auto-enrolled. Phone number
            verification stays unchanged — the new pieces are: email entry that
            recognizes the org domain, a one-time welcome ritual when the seat
            redeems, and the org chip living in the practice chrome forever after.
          </Text>
        </View>

        <View style={s.frameRow}>
          <FrameWithCaption
            ordinal="12"
            caption="Email entry · @jh.edu recognized"
            body="The moment the domain is typed, a navy info card snaps in below
              confirming we know the org. Same green check used everywhere for
              'domain owner verified.' Emily doesn't have to know which Hopkins
              plan she's joining — the system already does."
          >
            <StudentEmailEntryFrame />
          </FrameWithCaption>

          <FrameWithCaption
            ordinal="13"
            caption="Welcome surface · org-tinted, one-time"
            body="Earned exception. The only surface in the app with a full-bleed
              colored ground — the navy register isn't the app's normal chrome,
              it's a welcome ritual that names the institution Emily just joined.
              Three blocks: seat fact, cohort identity, two-row preview of what's
              already on her timeline."
          >
            <StudentWelcomeFrame />
          </FrameWithCaption>

          <FrameWithCaption
            ordinal="14"
            caption="First Practice home · org chip live in chrome"
            body="Emily lands inside the app, day one of clinical. The JH chip in
              the top header confirms her org context. A one-time blue card explains
              the setup, dismissible. The first step is already on her timeline —
              provenance row carries the blueprint's name and '28 also starting
              today,' then a serif-italic intention from Dr. Murphy."
          >
            <StudentFirstHomeFrame />
          </FrameWithCaption>
        </View>

        <View style={s.intNote}>
          <Text style={s.intNoteTitle}>Integration scope</Text>
          <Text style={s.intNoteBody}>
            These three components live in
            <Text style={s.code}> components/onboarding/StudentOnboardingPreview.tsx </Text>
            as reusable Phone-frame previews. Wiring them into production auth
            (modify <Text style={s.code}>app/(auth)/signup</Text>, add post-signup
            org-welcome routing, add the JH chip to{' '}
            <Text style={s.code}>TabScreenToolbar</Text>) is a follow-up once the
            domain-claim backend (verified email domain → auto-org-membership)
            is real. The components plug in unchanged.
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
  subMono: {
    fontFamily: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
    color: '#0E1117',
  },

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
    borderLeftColor: '#6B5BBF',
  },
  intNoteTitle: { fontSize: 13, fontWeight: '700', color: '#6B5BBF', marginBottom: 6 },
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
