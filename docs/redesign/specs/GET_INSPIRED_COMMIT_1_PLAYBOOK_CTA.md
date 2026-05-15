# Get Inspired Commit 1 Spec: Playbook Home CTA

## Discrepancies

No repo contradiction found. The shipped iOS-register Playbook tab renders `app/playbook-ios.tsx` through `app/(tabs)/playbook/index.tsx` when `PLAYBOOK_IOS_REGISTER=true`; the current iOS Playbook home has no Get Inspired entry point.

## Mounting Screen

Tab switch file: `app/(tabs)/playbook/index.tsx`

iOS-register home file: `app/playbook-ios.tsx`

The CTA belongs inside `PlaybookIosPreview`, between the Vision card and the `Working on this season` shelf. That keeps the Books-library home readable while giving Get Inspired one prominent acquisition entry point.

`app/(tabs)/playbook/index.tsx` should own modal state in the iOS branch:

```tsx
import { InspirationWizard } from '@/components/inspiration/InspirationWizard';

export default function PlaybookTab() {
  const [inspirationWizardOpen, setInspirationWizardOpen] = React.useState(false);

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
```

`app/playbook-ios.tsx` should extend props:

```tsx
type Props = {
  embedded?: boolean;
  onOpenInspiration?: () => void;
};
```

## CTA Component

Use an inline element in `app/playbook-ios.tsx`, not a new `components/ios-register/` component.

Reason: this is a one-off Playbook-home acquisition card with production behavior (`InspirationWizard` modal open). The running-state surface remains the reusable canonical loading-narration component; the CTA does not need reuse until another surface asks for the same acquisition card.

## Tap Target Behavior

Production tap behavior:

```tsx
onPress={onOpenInspiration}
```

No route push in this commit. The production Get Inspired flow is the existing `InspirationWizard` modal, not the visual-only `/get-inspired-ios` preview route.

If a future route-backed modal replaces the current wizard, the reversible substitution is:

```tsx
router.push('/get-inspired-ios' as any);
```

## Visual Spec

Reference: the canonical Get Inspired iOS running-state handoff plus iOS-register Playbook home chrome. Use white grouped card, SF Pro typography, system-blue action affordance, and coral only for marked/AI content.

Insert this helper inside `app/playbook-ios.tsx`:

```tsx
function GetInspiredHeroCTA({
  onPress,
}: {
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.inspirationCard,
        pressed && styles.inspirationCardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Get Inspired"
      accessibilityHint="Opens a flow to turn a link, pasted text, or idea into a first plan."
    >
      <View style={styles.inspirationGlyph}>
        <Ionicons
          name="sparkles-outline"
          size={20}
          color={IOS_REGISTER.accentMarkedContent}
        />
      </View>
      <View style={styles.inspirationText}>
        <Text style={styles.inspirationEyebrow}>GET INSPIRED</Text>
        <Text style={styles.inspirationTitle}>Start from something inspiring</Text>
        <Text style={styles.inspirationBody}>
          Drop a link, paste text, or describe what you want to learn.
          BetterAt will turn it into a first plan.
        </Text>
      </View>
      <View style={styles.inspirationAction}>
        <Text style={styles.inspirationActionText}>Start</Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={IOS_REGISTER.accentUserAction}
        />
      </View>
    </Pressable>
  );
}
```

Add styles:

```tsx
inspirationCard: {
  marginHorizontal: 20,
  marginTop: 18,
  marginBottom: 10,
  padding: 16,
  borderRadius: 18,
  backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
inspirationCardPressed: {
  opacity: 0.82,
},
inspirationGlyph: {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: IOS_REGISTER.accentMarkedContentTint,
},
inspirationText: {
  flex: 1,
  gap: 3,
},
inspirationEyebrow: {
  ...IOS_REGISTER_TEXT.eyebrow,
  color: IOS_REGISTER.accentMarkedContent,
},
inspirationTitle: {
  ...IOS_REGISTER_TEXT.cardTitle,
  color: IOS_COLORS.label,
},
inspirationBody: {
  ...IOS_REGISTER_TEXT.body,
  color: IOS_COLORS.secondaryLabel,
},
inspirationAction: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2,
},
inspirationActionText: {
  ...IOS_REGISTER_TEXT.callout,
  color: IOS_REGISTER.accentUserAction,
  fontWeight: '600',
},
```

Render location:

```tsx
<VisionCard ... />
<GetInspiredHeroCTA onPress={onOpenInspiration} />
<SectionHeader title="Working on this season" ... />
```

## Accessibility

- `accessibilityRole`: `button`
- `accessibilityLabel`: `Get Inspired`
- `accessibilityHint`: `Opens a flow to turn a link, pasted text, or idea into a first plan.`
- Hit target: entire card, minimum 44pt in both dimensions.

## State

No disabled/loading state in this commit.

Reason: the CTA opens the wizard; the pipeline does not start until the user submits input inside `InspirationCaptureStep`. Any in-flight state belongs to the modal's running surface, not the Playbook home card. If background inspiration jobs ship later, this card can gain an `inFlightCount` badge in a separate data-layer-backed commit.

## Verification

- `PLAYBOOK_IOS_REGISTER=true`: Playbook tab shows one Get Inspired card between Vision and concept shelf.
- Tapping the card opens `InspirationWizard`.
- `PLAYBOOK_IOS_REGISTER=false`: legacy `PlaybookHome` remains unchanged.
- VoiceOver reads the card as a button with the specified label and hint.

## Commit Message

```text
feat(redesign): add Get Inspired CTA to iOS Playbook home

Add the single iOS-register Playbook home entry point for Get Inspired.

- render a compact hero CTA between the Vision card and concept shelf
- keep the CTA inline in app/playbook-ios.tsx because it is not reused yet
- let app/(tabs)/playbook/index.tsx own InspirationWizard modal state in
  the PLAYBOOK_IOS_REGISTER branch
- tapping the CTA opens the existing wizard; no route-backed modal migration
  happens in this commit

This prepares the Get Inspired running-state cutover without changing the
pipeline behavior.
```
