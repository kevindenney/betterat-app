/**
 * Playbook Home route.
 *
 * When FEATURE_FLAGS.PLAYBOOK_IOS_REGISTER is on (default 2026-05-15
 * cutover), renders the iOS register preview as the canonical tab —
 * Apple Books library treatment with Vision card, concept shelf, and
 * recent reflections. When off, renders the legacy <PlaybookHome />
 * eight-section layout (this-week's-focus + ask-your-playbook +
 * suggestions + raw inbox + shared/inherited).
 *
 * Revert is a single flag flip: set EXPO_PUBLIC_FF_PLAYBOOK_IOS_REGISTER=false
 * and reload. No code path changes between the two states.
 *
 * One playbook per (user, interest). Interest is resolved via
 * `useInterest().currentInterest` inside both renderers.
 */

import React from 'react';
import { PlaybookHome } from '@/components/playbook/PlaybookHome';
import { PlaybookIosPreview } from '@/app/playbook-ios';
import { InspirationWizard } from '@/components/inspiration/InspirationWizard';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export default function PlaybookIndexScreen() {
  const [inspirationWizardOpen, setInspirationWizardOpen] =
    React.useState(false);

  if (FEATURE_FLAGS.PLAYBOOK_IOS_REGISTER) {
    return (
      <>
        <PlaybookIosPreview
          embedded
          onOpenInspiration={() => setInspirationWizardOpen(true)}
        />
        <InspirationWizard
          visible={inspirationWizardOpen}
          onClose={() => setInspirationWizardOpen(false)}
        />
      </>
    );
  }
  return <PlaybookHome />;
}
